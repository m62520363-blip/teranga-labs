-- ============================================================
-- 0056_security_hardening.sql
-- Durcissement sécurité suite audit (failles F1-F8, F11).
-- NON destructif, idempotent.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- F1 — phone_verified non falsifiable (developers + client_profiles)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.developers_protect_managed_cols()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user <> 'postgres' AND NOT public.is_admin() THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Colonne status protégée.' USING ERRCODE = 'TLPRV';
    END IF;
    IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
      RAISE EXCEPTION 'Colonne is_verified protégée.' USING ERRCODE = 'TLPRV';
    END IF;
    IF NEW.phone_verified IS DISTINCT FROM OLD.phone_verified THEN
      RAISE EXCEPTION 'Colonne phone_verified protégée.' USING ERRCODE = 'TLPRV';
    END IF;
    IF NEW.penalty IS DISTINCT FROM OLD.penalty THEN
      RAISE EXCEPTION 'Colonne penalty protégée.' USING ERRCODE = 'TLPRV';
    END IF;
    IF NEW.rating_avg IS DISTINCT FROM OLD.rating_avg
       OR NEW.reviews_count IS DISTINCT FROM OLD.reviews_count
       OR NEW.completed_projects_count IS DISTINCT FROM OLD.completed_projects_count
       OR NEW.reputation_score IS DISTINCT FROM OLD.reputation_score
       OR NEW.reputation_level IS DISTINCT FROM OLD.reputation_level
       OR NEW.score_components IS DISTINCT FROM OLD.score_components THEN
      RAISE EXCEPTION 'Colonnes de réputation protégées.' USING ERRCODE = 'TLPRV';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS developers_protect_managed_cols_trigger ON public.developers;
CREATE TRIGGER developers_protect_managed_cols_trigger
  BEFORE UPDATE ON public.developers
  FOR EACH ROW EXECUTE FUNCTION public.developers_protect_managed_cols();

CREATE OR REPLACE FUNCTION public.client_profiles_protect_cols()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user <> 'postgres' AND NOT public.is_admin() THEN
    IF NEW.phone_verified IS DISTINCT FROM OLD.phone_verified THEN
      RAISE EXCEPTION 'Colonne phone_verified protégée.' USING ERRCODE = 'TLPRV';
    END IF;
    IF NEW.phone_key IS DISTINCT FROM OLD.phone_key THEN
      RAISE EXCEPTION 'Colonne phone_key protégée.' USING ERRCODE = 'TLPRV';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS client_profiles_protect_cols_trigger ON public.client_profiles;
CREATE TRIGGER client_profiles_protect_cols_trigger
  BEFORE UPDATE ON public.client_profiles
  FOR EACH ROW EXECUTE FUNCTION public.client_profiles_protect_cols();

-- ------------------------------------------------------------
-- F2/F6/F7 — INSERT own restreints : statut forcément pending
-- ------------------------------------------------------------
DROP POLICY IF EXISTS payments_insert_own ON public.payments;
CREATE POLICY payments_insert_own ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (
    developer_id = auth.uid()
    AND status = 'pending'
  );

DROP POLICY IF EXISTS verification_requests_insert_own ON public.verification_requests;
CREATE POLICY verification_requests_insert_own ON public.verification_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    developer_id = auth.uid()
    AND verification_status = 'pending'
    AND payment_status = 'pending'
  );

DROP POLICY IF EXISTS payment_intents_insert_own ON public.payment_intents;
CREATE POLICY payment_intents_insert_own ON public.payment_intents
  FOR INSERT TO authenticated
  WITH CHECK (
    developer_id = auth.uid()
    AND status = 'pending'
  );

-- ------------------------------------------------------------
-- F3/F4/F5 — triggers de protection UPDATE (conversations,
-- formal_offers). Les chemins RPC SECURITY DEFINER passent en
-- current_user = 'postgres' et sont donc autorisés. La protection
-- messages arrive en 0057 (colonnes edited_at/audio absentes ici).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_conversations_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user = 'postgres' THEN
    RETURN NEW;
  END IF;
  IF NEW.developer_id IS DISTINCT FROM OLD.developer_id
     OR NEW.client_id IS DISTINCT FROM OLD.client_id
     OR NEW.request_id IS DISTINCT FROM OLD.request_id
     OR NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Conversation non modifiable directement.' USING ERRCODE = 'TLPRV';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_conversations_update_trigger ON public.conversations;
CREATE TRIGGER protect_conversations_update_trigger
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.protect_conversations_update();

CREATE OR REPLACE FUNCTION public.protect_offers_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user = 'postgres' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Devis modifiable uniquement via RPC.' USING ERRCODE = 'TLPRV';
END;
$$;

DROP TRIGGER IF EXISTS protect_offers_update_trigger ON public.formal_offers;
CREATE TRIGGER protect_offers_update_trigger
  BEFORE UPDATE ON public.formal_offers
  FOR EACH ROW EXECUTE FUNCTION public.protect_offers_update();

-- ------------------------------------------------------------
-- F8 — publish_brief : rôle client exigé
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publish_brief(
  p_client_name text,
  p_client_whatsapp text,
  p_client_city text,
  p_project_type text,
  p_budget integer,
  p_description text,
  p_features jsonb default '[]'::jsonb,
  p_deadline text default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_balance integer;
  v_req public.requests%ROWTYPE;
  v_gift boolean;
  v_brief_number integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous pour publier un brief.' USING ERRCODE = 'TLAUTH';
  END IF;

  SELECT role INTO v_role FROM public.user_roles WHERE user_id = v_user_id;
  IF v_role IS DISTINCT FROM 'client' THEN
    RAISE EXCEPTION 'Seuls les clients peuvent publier un brief.' USING ERRCODE = 'TLRJC';
  END IF;

  IF p_client_name IS NULL OR length(btrim(p_client_name)) < 2 THEN
    RAISE EXCEPTION 'Nom du client manquant.' USING ERRCODE = 'TLBAD';
  END IF;
  IF p_client_whatsapp IS NULL OR p_client_whatsapp = '' THEN
    RAISE EXCEPTION 'Numéro WhatsApp manquant.' USING ERRCODE = 'TLBAD';
  END IF;
  IF p_budget IS NULL OR p_budget < 10000 THEN
    RAISE EXCEPTION 'Budget invalide (minimum 10000 F).' USING ERRCODE = 'TLBAD';
  END IF;
  IF p_project_type NOT IN ('vitrine', 'e-commerce', 'landing page', 'app web', 'refonte') THEN
    RAISE EXCEPTION 'Type de projet invalide.' USING ERRCODE = 'TLBAD';
  END IF;

  PERFORM 1 FROM public.developers WHERE id = v_user_id FOR UPDATE;

  SELECT count(*)::INTEGER
    INTO v_brief_number
    FROM public.requests r
   WHERE r.client_id = v_user_id;

  v_gift := (v_brief_number = 0) AND NOT public.consumed_welcome_offer();

  IF NOT v_gift THEN
    SELECT coalesce(sum(t.amount), 0)::INTEGER INTO v_balance
      FROM public.token_transactions t
     WHERE t.developer_id = v_user_id;

    IF v_balance < 1 THEN
      RAISE EXCEPTION 'Tokens insuffisants. Rechargez vos Tokens pour publier un brief (1 Token).' USING ERRCODE = 'TLLOW';
    END IF;
  END IF;

  INSERT INTO public.requests (
    client_name, client_whatsapp, client_city, project_type, budget, description,
    client_id, features, deadline
  ) VALUES (
    p_client_name,
    p_client_whatsapp,
    p_client_city,
    p_project_type,
    p_budget,
    p_description,
    v_user_id,
    coalesce(p_features, '[]'::jsonb),
    p_deadline
  )
  RETURNING * INTO v_req;

  IF v_gift THEN
    INSERT INTO public.token_transactions (developer_id, amount, type, request_id, gift_key)
    VALUES (v_user_id, 0, 'bonus', v_req.id, 'gift:first_brief');
  ELSE
    INSERT INTO public.token_transactions (developer_id, amount, type, request_id)
    VALUES (v_user_id, -1, 'publish', v_req.id);
  END IF;

  RETURN jsonb_build_object(
    'id', v_req.id,
    'management_key', v_req.management_key,
    'gift', v_gift,
    'balance', (
      SELECT coalesce(sum(t.amount), 0)::INTEGER
      FROM public.token_transactions t
      WHERE t.developer_id = v_user_id
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.publish_brief(text, text, text, text, integer, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_brief(text, text, text, text, integer, text, jsonb, text) TO authenticated;

-- ------------------------------------------------------------
-- get_leaderboard : lecture seule (le settle passe par
-- settle_leaderboard / cron admin — plus d'écriture anonyme).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_leaderboard(p_year INT DEFAULT NULL, p_month INT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_year INT := COALESCE(p_year, date_part('year', NOW())::INT);
  v_month INT := COALESCE(p_month, date_part('month', NOW())::INT);
  v_now TIMESTAMPTZ := NOW();
  v_current BOOLEAN;
  v_standings JSONB;
  v_regional JSONB;
  v_countries JSONB;
  v_is_settled BOOLEAN;
BEGIN
  IF v_month < 1 OR v_month > 12 THEN
    RAISE EXCEPTION 'Mois invalide.' USING ERRCODE = 'TLEVL';
  END IF;

  v_current := (v_year = date_part('year', v_now)::INT AND v_month = date_part('month', v_now)::INT);

  IF v_current THEN
    v_standings := public._leaderboard_standings(v_year, v_month);
    v_regional := v_standings->'regional';
    v_countries := v_standings->'countries';
    v_is_settled := false;
  ELSE
    -- Mois clos : lecture du snapshot s'il existe, sinon calcul
    -- SANS crédit (le settlement est réservé à settle_leaderboard).
    SELECT count(*) > 0 INTO v_is_settled
      FROM public.leaderboard_monthly
     WHERE year = v_year AND month = v_month;

    IF v_is_settled THEN
      SELECT jsonb_object_agg(scope_key, rows ORDER BY scope_key)
      INTO v_countries
      FROM (
        SELECT scope_key,
               COALESCE(jsonb_agg(jb ORDER BY rank), '[]'::jsonb) AS rows
        FROM (
          SELECT
            scope_key, rank, developer_id, completed_projects, tokens_awarded,
            jsonb_build_object(
              'rank', rank,
              'developer_id', developer_id,
              'username', d.username,
              'full_name', COALESCE(NULLIF(trim(d.full_name), ''), d.username, developer_id::text),
              'city', d.city,
              'country', COALESCE(trim(d.country), ''),
              'avatar_url', d.avatar_url,
              'completed_projects', completed_projects,
              'tokens_awarded', tokens_awarded
            ) AS jb
          FROM public.leaderboard_monthly lbm
          LEFT JOIN public.developers d ON d.id = lbm.developer_id
          WHERE lbm.year = v_year AND lbm.month = v_month AND lbm.scope = 'country'
        ) t
        GROUP BY scope_key
      ) country_agg;

      SELECT jsonb_agg(jb ORDER BY rank)
      INTO v_regional
      FROM (
        SELECT jsonb_build_object(
          'rank', rank,
          'developer_id', developer_id,
          'username', d.username,
          'full_name', COALESCE(NULLIF(trim(d.full_name), ''), d.username, developer_id::text),
          'city', d.city,
          'country', COALESCE(trim(d.country), ''),
          'avatar_url', d.avatar_url,
          'completed_projects', completed_projects,
          'tokens_awarded', tokens_awarded
        ) AS jb
        FROM public.leaderboard_monthly lbm
        LEFT JOIN public.developers d ON d.id = lbm.developer_id
        WHERE lbm.year = v_year AND lbm.month = v_month AND lbm.scope = 'regional'
      ) regional_rows;
    ELSE
      -- Pas de snapshot : calcul live SANS écriture.
      v_standings := public._leaderboard_standings(v_year, v_month);
      v_regional := v_standings->'regional';
      v_countries := v_standings->'countries';
      v_is_settled := false;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'period', jsonb_build_object('year', v_year, 'month', v_month),
    'status', CASE WHEN v_is_settled THEN 'settled' ELSE 'live' END,
    'config', jsonb_build_object(
      'enabled', true,
      'min_projects', 2,
      'rewards', jsonb_build_object(
        'regional', jsonb_build_object('1', 10, '2', 7, '3', 4)
      )
    ),
    'regional', v_regional,
    'countries', v_countries
  );
END;
$$;

-- Verrou anti-course dans le settle.
CREATE OR REPLACE FUNCTION public._leaderboard_settle(p_year INT, p_month INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_standings JSONB;
  v_row JSONB;
  v_scope_key TEXT;
  v_rows JSONB;
  v_rank INT;
  v_developer UUID;
  v_cnt INT;
  v_tokens INT;
  v_credited INT := 0;
  v_r1 INT := 10;
  v_r2 INT := 7;
  v_r3 INT := 4;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('leaderboard_settle'), p_year * 100 + p_month);

  v_standings := public._leaderboard_standings(p_year, p_month);

  FOR v_row IN SELECT * FROM jsonb_array_elements(v_standings->'regional') LOOP
    v_rank := (v_row->>'rank')::INT;
    v_developer := (v_row->>'developer_id')::UUID;
    v_cnt := (v_row->>'completed_projects')::INT;
    v_tokens := CASE v_rank WHEN 1 THEN v_r1 WHEN 2 THEN v_r2 WHEN 3 THEN v_r3 ELSE 0 END;

    INSERT INTO public.leaderboard_monthly
      (year, month, scope, scope_key, rank, developer_id, completed_projects, tokens_awarded)
    VALUES
      (p_year, p_month, 'regional', 'aof', v_rank, v_developer, v_cnt, 0)
    ON CONFLICT (year, month, scope, scope_key, developer_id)
      DO UPDATE SET rank = EXCLUDED.rank,
                    completed_projects = EXCLUDED.completed_projects,
                    snapshot_at = NOW();

    IF v_tokens > 0 AND NOT EXISTS (
      SELECT 1 FROM public.token_transactions t
       WHERE t.developer_id = v_developer
         AND t.gift_key = 'leaderboard:' || p_year || ':' || p_month || ':regional:aof'
    ) THEN
      INSERT INTO public.token_transactions (developer_id, amount, type, gift_key)
      VALUES (v_developer, v_tokens, 'reward',
              'leaderboard:' || p_year || ':' || p_month || ':regional:aof');
      v_credited := v_credited + v_tokens;
      UPDATE public.leaderboard_monthly
         SET tokens_awarded = v_tokens
       WHERE year = p_year AND month = p_month AND scope = 'regional'
         AND scope_key = 'aof' AND developer_id = v_developer;
    END IF;

    IF v_tokens > 0 THEN
      INSERT INTO public.developer_badges (developer_id, badge_type, year, month, scope, scope_key, awarded_at)
      VALUES (
        v_developer,
        CASE v_rank WHEN 1 THEN 'top1_regional' WHEN 2 THEN 'top2_regional' ELSE 'top3_regional' END,
        p_year, p_month, 'regional', 'aof', NOW()
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- Pays : classement affiché uniquement, sans double récompense.
  FOR v_row IN SELECT * FROM jsonb_array_elements(v_standings->'countries') LOOP
    v_scope_key := v_row->>'key';
    v_rows := v_row->'rows';
    FOR v_row IN SELECT * FROM jsonb_array_elements(v_rows) LOOP
      v_rank := (v_row->>'rank')::INT;
      v_developer := (v_row->>'developer_id')::UUID;
      v_cnt := (v_row->>'completed_projects')::INT;

      INSERT INTO public.leaderboard_monthly
        (year, month, scope, scope_key, rank, developer_id, completed_projects, tokens_awarded)
      VALUES
        (p_year, p_month, 'country', v_scope_key, v_rank, v_developer, v_cnt, 0)
      ON CONFLICT (year, month, scope, scope_key, developer_id)
        DO UPDATE SET rank = EXCLUDED.rank,
                      completed_projects = EXCLUDED.completed_projects,
                      snapshot_at = NOW();
    END LOOP;
  END LOOP;

  INSERT INTO public.leaderboard_monthly_history
    (year, month, scope, scope_key, rank, developer_id, completed_projects, tokens_awarded, snapshot_at)
  SELECT year, month, scope, scope_key, rank, developer_id, completed_projects, tokens_awarded, snapshot_at
    FROM public.leaderboard_monthly
   WHERE year = p_year AND month = p_month
  ON CONFLICT (year, month, scope, scope_key, rank) DO NOTHING;

  RETURN jsonb_build_object(
    'ok', true,
    'period', jsonb_build_object('year', p_year, 'month', p_month),
    'credited', v_credited
  );
END;
$$;

-- ------------------------------------------------------------
-- F11 — verify_otp lié à l'appelant (même signature que 0037)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_otp(
  p_channel TEXT,
  p_target TEXT,
  p_code TEXT,
  p_purpose TEXT DEFAULT 'verification'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_rec public.otp_verifications%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN JSONB_BUILD_OBJECT('verified', FALSE, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO v_rec
    FROM public.otp_verifications
   WHERE channel = p_channel
     AND target = p_target
     AND purpose = p_purpose
     AND consumed_at IS NULL
     AND expires_at > NOW()
     AND user_id = v_user_id
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF v_rec.id IS NULL THEN
    RETURN JSONB_BUILD_OBJECT('verified', FALSE, 'reason', 'code_expired_or_missing');
  END IF;

  IF v_rec.attempts >= 5 THEN
    UPDATE public.otp_verifications SET consumed_at = NOW() WHERE id = v_rec.id;
    RETURN JSONB_BUILD_OBJECT('verified', FALSE, 'reason', 'too_many_attempts');
  END IF;

  IF ENCODE(SHA256(p_code::BYTEA), 'hex') <> v_rec.code_hash THEN
    UPDATE public.otp_verifications SET attempts = attempts + 1 WHERE id = v_rec.id;
    IF v_rec.attempts + 1 >= 5 THEN
      UPDATE public.otp_verifications SET consumed_at = NOW() WHERE id = v_rec.id;
      RETURN JSONB_BUILD_OBJECT('verified', FALSE, 'reason', 'too_many_attempts');
    END IF;
    RETURN JSONB_BUILD_OBJECT('verified', FALSE, 'reason', 'invalid_code');
  END IF;

  UPDATE public.otp_verifications
     SET consumed_at = NOW()
   WHERE id = v_rec.id;

  IF p_channel IN ('whatsapp', 'sms') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='developers' AND column_name='phone_verified') THEN
      UPDATE public.developers
         SET phone_verified = TRUE
       WHERE id = v_user_id
         AND NULLIF(whatsapp, '') = NULLIF(p_target, '');
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='client_profiles' AND column_name='phone_verified') THEN
      UPDATE public.client_profiles
         SET phone_verified = TRUE
       WHERE id = v_user_id
         AND NULLIF(phone, '') = NULLIF(p_target, '');
    END IF;
  END IF;

  RETURN JSONB_BUILD_OBJECT('verified', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_otp(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_otp(TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMIT;
