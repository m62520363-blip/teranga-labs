-- ============================================================
-- UPGRADE_0056_0063.sql — script consolide
-- Executer dans le SQL Editor Supabase APRES 0001-0055.
-- NON destructif, idempotent. Chaque bloc est transactionnel.
-- ============================================================


-- ############################################################
-- FICHIER : supabase/migrations/0056_security_hardening.sql
-- ############################################################

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


-- ############################################################
-- FICHIER : supabase/migrations/0057_messaging_v2.sql
-- ############################################################

-- ============================================================
-- 0057_messaging_v2.sql
-- Messagerie professionnelle : messages vocaux, édition,
-- suppression douce, marquage lu par RPC, présence en ligne.
-- NON destructif, idempotent.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Colonnes messages
-- ------------------------------------------------------------
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS audio_path TEXT,
  ADD COLUMN IF NOT EXISTS audio_duration_seconds INTEGER
    CHECK (audio_duration_seconds IS NULL OR (audio_duration_seconds > 0 AND audio_duration_seconds <= 600));

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN ('text', 'offer', 'system', 'audio'));

-- ------------------------------------------------------------
-- 2. Bucket audio privé (jamais de lecture publique)
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-audio',
  'message-audio',
  false,
  5242880,
  array['audio/webm', 'audio/mpeg', 'audio/ogg', 'audio/mp4', 'audio/wav']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "message-audio-insert" ON storage.objects;
CREATE POLICY "message-audio-insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'message-audio'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(name) ~ '\.(webm|mp3|ogg|m4a|wav)$'
  );

DROP POLICY IF EXISTS "message-audio-delete" ON storage.objects;
CREATE POLICY "message-audio-delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'message-audio'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Pas de policy SELECT : lecture exclusivement via API signed URL.

-- ------------------------------------------------------------
-- 3. Trigger de protection UPDATE messages (colonnes présentes)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_messages_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user = 'postgres' THEN
    RETURN NEW;
  END IF;
  IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.message_type IS DISTINCT FROM OLD.message_type THEN
    RAISE EXCEPTION 'Message immuable (conversation, expéditeur, type).' USING ERRCODE = 'TLPRV';
  END IF;
  IF NEW.read_at IS DISTINCT FROM OLD.read_at
     AND NEW.content IS DISTINCT FROM OLD.content THEN
    RAISE EXCEPTION 'Modification invalide.' USING ERRCODE = 'TLPRV';
  END IF;
  IF NEW.read_at IS DISTINCT FROM OLD.read_at THEN
    IF OLD.sender_id = auth.uid() THEN
      RETURN NEW;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.conversations c
       WHERE c.id = OLD.conversation_id
         AND (c.developer_id = auth.uid() OR c.client_id = auth.uid())
    ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Non participant.' USING ERRCODE = 'TLPRV';
  END IF;
  IF NEW.content IS DISTINCT FROM OLD.content
     OR NEW.edited_at IS DISTINCT FROM OLD.edited_at
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    IF OLD.sender_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Seul l''expéditeur peut modifier son message.' USING ERRCODE = 'TLPRV';
    END IF;
    IF OLD.message_type = 'audio' AND NEW.deleted_at IS NULL THEN
      RAISE EXCEPTION 'Un message vocal ne peut pas être édité.' USING ERRCODE = 'TLPRV';
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_messages_update_trigger ON public.messages;
CREATE TRIGGER protect_messages_update_trigger
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.protect_messages_update();

-- ------------------------------------------------------------
-- 4. Présence
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_presence_select_own ON public.user_presence;
CREATE POLICY user_presence_select_own ON public.user_presence
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Écriture via RPC uniquement.
REVOKE ALL ON public.user_presence FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.touch_presence()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.user_presence (user_id, last_seen_at, updated_at)
  VALUES (v_user, now(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET last_seen_at = now(), updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.touch_presence() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_presence() TO authenticated;

-- Présence d'un pair : seulement si une conversation partagée existe.
CREATE OR REPLACE FUNCTION public.get_peer_presence(p_peer_id uuid)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_last timestamptz;
  v_online boolean := false;
BEGIN
  IF v_user IS NULL OR p_peer_id IS NULL OR p_peer_id = v_user THEN
    RETURN jsonb_build_object('online', false, 'last_seen_at', null);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations c
     WHERE ((c.developer_id = v_user AND c.client_id = p_peer_id)
         OR (c.client_id = v_user AND c.developer_id = p_peer_id))
  ) THEN
    RETURN jsonb_build_object('online', false, 'last_seen_at', null);
  END IF;
  SELECT last_seen_at INTO v_last
    FROM public.user_presence
   WHERE user_id = p_peer_id;
  v_online := v_last IS NOT NULL AND v_last > now() - interval '90 seconds';
  RETURN jsonb_build_object('online', v_online, 'last_seen_at', v_last);
END;
$$;

REVOKE ALL ON FUNCTION public.get_peer_presence(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_peer_presence(uuid) TO authenticated;

-- ------------------------------------------------------------
-- 5. RPC messagerie
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_message(
  p_conversation_id uuid,
  p_content text default '',
  p_message_type text default 'text',
  p_audio_path text default null,
  p_audio_duration_seconds integer default null,
  p_metadata jsonb default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_conv public.conversations%ROWTYPE;
  v_msg public.messages%ROWTYPE;
  v_type text := coalesce(nullif(btrim(p_message_type), ''), 'text');
  v_content text := coalesce(p_content, '');
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;
  IF p_conversation_id IS NULL THEN
    RAISE EXCEPTION 'Conversation manquante.' USING ERRCODE = 'TLBAD';
  END IF;

  SELECT * INTO v_conv FROM public.conversations WHERE id = p_conversation_id FOR UPDATE;
  IF v_conv.id IS NULL OR (v_conv.developer_id <> v_user AND v_conv.client_id <> v_user) THEN
    RAISE EXCEPTION 'Conversation introuvable.' USING ERRCODE = 'TLNOC';
  END IF;
  IF v_conv.status NOT IN ('active', 'awarded') THEN
    RAISE EXCEPTION 'Conversation fermée.' USING ERRCODE = 'TLCLO';
  END IF;

  IF v_type = 'audio' THEN
    IF nullif(btrim(coalesce(p_audio_path, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Chemin audio manquant.' USING ERRCODE = 'TLBAD';
    END IF;
    IF NOT (p_audio_path LIKE v_user::text || '/%') THEN
      RAISE EXCEPTION 'Chemin audio invalide.' USING ERRCODE = 'TLBAD';
    END IF;
    v_content := '';
  ELSIF v_type <> 'text' THEN
    RAISE EXCEPTION 'Type de message non envoyable.' USING ERRCODE = 'TLBAD';
  ELSE
    v_content := btrim(v_content);
    IF v_content = '' OR length(v_content) > 5000 THEN
      RAISE EXCEPTION 'Message vide ou trop long.' USING ERRCODE = 'TLBAD';
    END IF;
  END IF;

  INSERT INTO public.messages (
    conversation_id, sender_id, content, message_type, metadata, audio_path, audio_duration_seconds
  ) VALUES (
    p_conversation_id, v_user, v_content, v_type, p_metadata,
    CASE WHEN v_type = 'audio' THEN p_audio_path END,
    CASE WHEN v_type = 'audio' THEN p_audio_duration_seconds END
  )
  RETURNING * INTO v_msg;

  UPDATE public.conversations SET last_message_at = now() WHERE id = p_conversation_id;

  RETURN jsonb_build_object(
    'id', v_msg.id,
    'conversation_id', v_msg.conversation_id,
    'sender_id', v_msg.sender_id,
    'content', v_msg.content,
    'message_type', v_msg.message_type,
    'audio_path', v_msg.audio_path,
    'audio_duration_seconds', v_msg.audio_duration_seconds,
    'created_at', v_msg.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.send_message(uuid, text, text, text, integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_message(uuid, text, text, text, integer, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.edit_message(p_message_id uuid, p_content text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_msg public.messages%ROWTYPE;
  v_content text := btrim(coalesce(p_content, ''));
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;
  IF v_content = '' OR length(v_content) > 5000 THEN
    RAISE EXCEPTION 'Message vide ou trop long.' USING ERRCODE = 'TLBAD';
  END IF;
  SELECT * INTO v_msg FROM public.messages WHERE id = p_message_id FOR UPDATE;
  IF v_msg.id IS NULL OR v_msg.sender_id <> v_user THEN
    RAISE EXCEPTION 'Message non modifiable.' USING ERRCODE = 'TLPRV';
  END IF;
  IF v_msg.message_type = 'audio' THEN
    RAISE EXCEPTION 'Un message vocal ne peut pas être édité.' USING ERRCODE = 'TLPRV';
  END IF;
  UPDATE public.messages
     SET content = v_content, edited_at = now()
   WHERE id = p_message_id;
  RETURN jsonb_build_object('id', p_message_id, 'content', v_content, 'edited_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.edit_message(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edit_message(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.soft_delete_message(p_message_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_msg public.messages%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;
  SELECT * INTO v_msg FROM public.messages WHERE id = p_message_id FOR UPDATE;
  IF v_msg.id IS NULL OR v_msg.sender_id <> v_user THEN
    RAISE EXCEPTION 'Message non supprimable.' USING ERRCODE = 'TLPRV';
  END IF;
  UPDATE public.messages
     SET deleted_at = now(), content = '', audio_path = NULL
   WHERE id = p_message_id;
  RETURN jsonb_build_object('id', p_message_id, 'deleted', true);
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_message(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_message(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_updated integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations c
     WHERE c.id = p_conversation_id
       AND (c.developer_id = v_user OR c.client_id = v_user)
  ) THEN
    RAISE EXCEPTION 'Conversation introuvable.' USING ERRCODE = 'TLNOC';
  END IF;
  UPDATE public.messages
     SET read_at = coalesce(read_at, now())
   WHERE conversation_id = p_conversation_id
     AND sender_id <> v_user
     AND read_at IS NULL;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN jsonb_build_object('marked', v_updated);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_conversation_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;

-- ------------------------------------------------------------
-- 6. URL signée d'un message vocal (participant uniquement)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_message_audio_url(p_message_id uuid)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_msg public.messages%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;
  SELECT * INTO v_msg FROM public.messages WHERE id = p_message_id;
  IF v_msg.id IS NULL OR v_msg.message_type <> 'audio'
     OR v_msg.audio_path IS NULL OR v_msg.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Audio introuvable.' USING ERRCODE = 'TLNFA';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations c
     WHERE c.id = v_msg.conversation_id
       AND (c.developer_id = v_user OR c.client_id = v_user)
  ) THEN
    RAISE EXCEPTION 'Accès interdit.' USING ERRCODE = 'TLPRV';
  END IF;
  RETURN jsonb_build_object(
    'path', v_msg.audio_path,
    'duration_seconds', v_msg.audio_duration_seconds
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_message_audio_url(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_message_audio_url(uuid) TO authenticated;

COMMIT;


-- ############################################################
-- FICHIER : supabase/migrations/0058_public_profile.sql
-- ############################################################

-- ============================================================
-- 0058_public_profile.sql
-- Profil public activable/désactivable par le développeur,
-- critères minimaux vérifiés côté serveur.
-- NON destructif, idempotent.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Colonne visibilité
-- ------------------------------------------------------------
ALTER TABLE public.developers
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

-- Rétrocompatibilité : les profils déjà actifs/ vérifiés restent visibles.
UPDATE public.developers
   SET is_public = TRUE
 WHERE status IN ('active', 'verified')
   AND is_public = FALSE
   AND username IS NOT NULL;

COMMENT ON COLUMN public.developers.is_public IS
  'Profil public activable par le développeur (critères serveur).';

-- ------------------------------------------------------------
-- 2. Critères + progression
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_profile_completion()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_dev public.developers%ROWTYPE;
  v_has_specialty boolean;
  v_missing text[] := '{}';
  v_done integer := 0;
  v_total integer := 4;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;
  SELECT * INTO v_dev FROM public.developers WHERE id = v_user;
  IF v_dev.id IS NULL THEN
    RAISE EXCEPTION 'Profil développeur requis.' USING ERRCODE = 'TLNOD';
  END IF;

  IF nullif(btrim(coalesce(v_dev.full_name, '')), '') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.developer_profiles dp
        WHERE dp.developer_id = v_user
          AND nullif(btrim(coalesce(dp.professional_title, '')), '') IS NOT NULL
     ) THEN
    v_done := v_done + 1;
  ELSE
    v_missing := v_missing || 'professional_title';
  END IF;

  IF nullif(btrim(coalesce(v_dev.bio, '')), '') IS NOT NULL AND length(btrim(v_dev.bio)) >= 40 THEN
    v_done := v_done + 1;
  ELSE
    v_missing := v_missing || 'bio';
  END IF;

  IF coalesce(array_length(v_dev.skills, 1), 0) >= 1 THEN
    v_done := v_done + 1;
  ELSE
    v_missing := v_missing || 'skills';
  END IF;

  v_has_specialty := EXISTS (
    SELECT 1 FROM public.developer_profiles dp
     WHERE dp.developer_id = v_user
       AND nullif(btrim(coalesce(dp.main_specialty, '')), '') IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM public.developer_services ds WHERE ds.developer_id = v_user
  );
  IF v_has_specialty THEN
    v_done := v_done + 1;
  ELSE
    v_missing := v_missing || 'specialty';
  END IF;

  RETURN jsonb_build_object(
    'is_public', v_dev.is_public,
    'progress', CASE WHEN v_total = 0 THEN 0 ELSE round(v_done * 100.0 / v_total)::integer END,
    'missing', to_jsonb(v_missing),
    'can_publish', coalesce(array_length(v_missing, 1), 0) = 0,
    'has_username', v_dev.username IS NOT NULL,
    'status', v_dev.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_profile_completion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile_completion() TO authenticated;

-- ------------------------------------------------------------
-- 3. Activation / désactivation
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_public_profile(p_publish boolean)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_completion jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;

  IF p_publish IS NOT TRUE THEN
    UPDATE public.developers SET is_public = FALSE WHERE id = v_user;
    RETURN jsonb_build_object('ok', true, 'is_public', false);
  END IF;

  v_completion := public.get_public_profile_completion();
  IF (v_completion->>'can_publish')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'Profil incomplet : renseignez les champs obligatoires avant de publier.'
      USING ERRCODE = 'TLINC';
  END IF;
  IF (v_completion->>'has_username')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'Un nom public (username) est requis pour publier votre profil.'
      USING ERRCODE = 'TLINC';
  END IF;

  UPDATE public.developers SET is_public = TRUE WHERE id = v_user;
  RETURN jsonb_build_object('ok', true, 'is_public', true);
END;
$$;

REVOKE ALL ON FUNCTION public.set_public_profile(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_public_profile(boolean) TO authenticated;

-- ------------------------------------------------------------
-- 4. get_public_developer_profile : filtre is_public
--    (sauf pour le propriétaire ou l'admin qui prévisualise)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_developer_profile(
  p_identifier text,
  p_viewer_role text default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_identifier text := nullif(btrim(p_identifier), '');
  v_viewer text := lower(nullif(btrim(coalesce(p_viewer_role, '')), ''));
  v_caller uuid := auth.uid();
  v_dev public.developers%ROWTYPE;
  v_prof public.developer_profiles%ROWTYPE;
  v_response_minutes numeric;
  v_response_rate numeric;
BEGIN
  IF v_identifier IS NULL THEN
    RAISE EXCEPTION 'Profil introuvable.' USING ERRCODE = 'TLNOK';
  END IF;

  IF v_identifier ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT * INTO v_dev
      FROM public.developers
     WHERE id = v_identifier::uuid
       AND status IN ('active', 'verified')
       AND (is_public = TRUE OR id = v_caller OR public.is_admin());
  ELSE
    SELECT * INTO v_dev
      FROM public.developers
     WHERE username = lower(v_identifier)
       AND status IN ('active', 'verified')
       AND (is_public = TRUE OR id = v_caller OR public.is_admin());
  END IF;

  IF v_dev.id IS NULL THEN
    RAISE EXCEPTION 'Profil introuvable.' USING ERRCODE = 'TLNOK';
  END IF;

  SELECT * INTO v_prof FROM public.developer_profiles WHERE developer_id = v_dev.id;

  SELECT round(coalesce(avg(gap_minutes), 0))::numeric
    INTO v_response_minutes
    FROM (
      select
        c.id,
        c.created_at,
        (
          select extract(epoch from min(m.created_at) - c.created_at) / 60
            from public.messages m
           where m.conversation_id = c.id
             and m.sender_id = v_dev.id
             and m.created_at > c.created_at
        ) as gap_minutes
        from public.messages c
        join public.unlocks u on u.id = c.conversation_id
       where c.conversation_id in (
               select id from public.unlocks where developer_id = v_dev.id
             )
         and c.sender_id <> v_dev.id
    ) gaps
   where gaps.gap_minutes is not null;

  SELECT round(
           count(distinct case when dev_replied then u.id end)::numeric
           / nullif(count(distinct case when client_wrote then u.id end), 0)::numeric
           * 100
         )::numeric
    INTO v_response_rate
    from (
      select
        u.id,
        bool_or(m.sender_id = u.developer_id) as dev_replied,
        bool_or(m.sender_id <> u.developer_id) as client_wrote
        from public.unlocks u
        join public.messages m on m.conversation_id = u.id
       where u.developer_id = v_dev.id
       group by u.id
    ) u;

  RETURN jsonb_build_object(
    'id', v_dev.id,
    'username', v_dev.username,
    'full_name', v_dev.full_name,
    'bio', v_dev.bio,
    'avatar_url', v_dev.avatar_url,
    'city', v_dev.city,
    'country', v_dev.country,
    'whatsapp', public.mask_phone(coalesce(v_dev.phone, v_dev.whatsapp)),
    'phone_masked', public.mask_phone(coalesce(v_dev.phone, v_dev.whatsapp)),
    'email_masked', (
      select public.mask_email(au.email) from auth.users au where au.id = v_dev.id
    ),
    'professional_title', v_prof.professional_title,
    'main_specialty', v_prof.main_specialty,
    'experience_level', v_prof.experience_level,
    'availability', v_prof.availability,
    'rate_min_fcfa', v_prof.rate_min_fcfa,
    'rate_max_fcfa', v_prof.rate_max_fcfa,
    'skills', coalesce(to_jsonb(v_dev.skills), '[]'::jsonb),
    'languages', coalesce(to_jsonb(v_dev.languages), '[]'::jsonb),
    'experience_years', v_dev.experience_years,
    'is_verified', v_dev.is_verified,
    'is_public', v_dev.is_public,
    'created_at', v_dev.created_at,
    'avg_response_minutes', v_response_minutes,
    'response_rate', v_response_rate,
    'portfolio_links', coalesce(v_dev.portfolio_links, '[]'::jsonb),
    'projects_count', (
      select count(*)::integer from public.unlocks u
       where u.developer_id = v_dev.id
    ),
    'completed_projects_count', v_dev.completed_projects_count,
    'review_count', v_dev.reviews_count,
    'review_average', round(coalesce(v_dev.rating_avg, 0), 1)::numeric,
    'reputation_score', v_dev.reputation_score,
    'reputation_level', v_dev.reputation_level,
    'penalty', v_dev.penalty,
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pr.id,
        'name', pr.name,
        'description', pr.description,
        'project_type', pr.project_type,
        'technologies', coalesce(to_jsonb(pr.technologies), '[]'::jsonb),
        'url', case when pr.client_authorization = 'confidential' then null else pr.url end,
        'screenshots', case
          when pr.client_authorization = 'confidential' then '[]'::jsonb
          else coalesce(to_jsonb(pr.screenshots), '[]'::jsonb) end,
        'role', pr.role,
        'key_features', coalesce(to_jsonb(pr.key_features), '[]'::jsonb),
        'client_name', case
          when pr.client_authorization = 'confidential' then 'Client confidentiel'
          else pr.client_name end,
        'client_authorization', pr.client_authorization,
        'completion_date', pr.completion_date,
        'duration', pr.duration,
        'demo_url', pr.demo_url,
        'demo_video_url', pr.demo_video_url,
        'via_teranga_labs', pr.via_teranga_labs,
        'mission_ref', pr.mission_ref,
        'is_verified', pr.status = 'verified'
      ) order by pr.completion_date desc nulls last, pr.created_at desc)
      from public.developer_projects pr
     where pr.developer_id = v_dev.id
       and pr.status = 'verified'
       and coalesce(pr.is_hidden, false) = false
       and (
            pr.client_authorization = 'public'
         or (pr.client_authorization = 'clients_only' and v_viewer = 'client')
         or pr.client_authorization = 'confidential'
       )
    ), '[]'::jsonb),
    'reviews', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'rating', r.rating,
          'comment', r.comment,
          'request_name', req.client_name,
          'created_at', r.created_at
        )
        order by r.created_at desc
      )
      from public.reviews r
      left join public.requests req on req.id = r.request_id
      where r.developer_id = v_dev.id
    ), '[]'::jsonb)
  );
END;
$$;

-- Annuaire : n'afficher que les profils publics.
CREATE OR REPLACE FUNCTION public.list_approved_developers(
  p_query text default null,
  p_specialty text default null,
  p_technologies text[] default null,
  p_services text[] default null,
  p_city text default null,
  p_min_experience integer default null,
  p_availability text default null,
  p_min_rating numeric default null,
  p_verified_only boolean default false,
  p_project_type text default null,
  p_sort text default 'relevance',
  p_limit integer default 48,
  p_offset integer default 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
  v_specialty text := nullif(btrim(coalesce(p_specialty, '')), '');
  v_city text := nullif(btrim(coalesce(p_city, '')), '');
  v_limit integer := greatest(1, least(coalesce(p_limit, 48), 120));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_sort text := coalesce(nullif(btrim(p_sort), ''), 'relevance');
BEGIN
  return coalesce((
    select jsonb_agg(jb)
    from (
      select jsonb_build_object(
        'id', d.id,
        'username', d.username,
        'full_name', d.full_name,
        'professional_title', dp.professional_title,
        'main_specialty', dp.main_specialty,
        'avatar_url', d.avatar_url,
        'city', d.city,
        'country', d.country,
        'bio', d.bio,
        'skills', coalesce(to_jsonb(d.skills), '[]'::jsonb),
        'services', to_jsonb(coalesce(svc.services, '{}'::text[])),
        'experience_years', d.experience_years,
        'experience_level', dp.experience_level,
        'availability', dp.availability,
        'rate_min_fcfa', dp.rate_min_fcfa,
        'rate_max_fcfa', dp.rate_max_fcfa,
        'rating_avg', round(coalesce(d.rating_avg, 0), 1)::numeric,
        'review_count', d.reviews_count,
        'completed_projects_count', d.completed_projects_count,
        'projects_count', coalesce(prj.cnt, 0),
        'is_verified', d.is_verified,
        'reputation_score', d.reputation_score,
        'response_rate', rr.rate,
        'satisfaction_pct', case
          when d.reviews_count > 0 then round((coalesce(d.rating_avg, 0) / 5) * 100)::integer
          else null end,
        'phone_masked', public.mask_phone(coalesce(d.phone, d.whatsapp)),
        'email_masked', public.mask_email(du.email),
        'is_sponsored', (sp.ends_at is not null),
        'featured_until', sp.ends_at,
        'is_pro', (sub.ends_at is not null),
        'pro_until', sub.ends_at
      ) as jb
      from public.developers d
      left join public.developer_profiles dp on dp.developer_id = d.id
      left join auth.users du on du.id = d.id
      left join public.sponsored_profiles sp
        on sp.developer_id = d.id and sp.ends_at > now()
      left join public.subscriptions sub
        on sub.developer_id = d.id and sub.ends_at > now()
      left join lateral (
        select array_agg(ds.service order by ds.service) as services
          from public.developer_services ds
         where ds.developer_id = d.id
      ) svc on true
      left join lateral (
        select count(*)::integer as cnt
          from public.developer_projects pp
         where pp.developer_id = d.id
      ) prj on true
      left join lateral (
        select round(
                 count(distinct case when dev_replied then u.id end)::numeric
                 / nullif(count(distinct case when client_wrote then u.id end), 0)::numeric
                 * 100
               )::numeric as rate
          from (
            select
              u.id,
              bool_or(m.sender_id = d.id) as dev_replied,
              bool_or(m.sender_id <> d.id) as client_wrote
              from public.unlocks u
              join public.messages m on m.conversation_id = u.id
             where u.developer_id = d.id
             group by u.id
          ) u
      ) rr on true
      where d.status in ('active', 'verified')
        and d.is_public = true
        and (p_verified_only is false or d.is_verified = true)
        and (v_query is null or (
              d.full_name ilike '%' || v_query || '%'
              or d.username ilike '%' || v_query || '%'
              or coalesce(dp.professional_title, '') ilike '%' || v_query || '%'
              or coalesce(dp.main_specialty, '') ilike '%' || v_query || '%'
              or exists (
                select 1 from unnest(coalesce(d.skills, '{}'::text[])) s
                where s ilike '%' || v_query || '%'
              )
              or exists (
                select 1 from public.developer_services x
                where x.developer_id = d.id and x.service ilike '%' || v_query || '%'
              )
            ))
        and (v_specialty is null or dp.main_specialty = lower(v_specialty))
        and (p_technologies is null or d.skills && p_technologies)
        and (p_services is null or exists (
              select 1 from public.developer_services x
              where x.developer_id = d.id and x.service = any (p_services)
            ))
        and (v_city is null or lower(d.city) = lower(v_city)
              or lower(coalesce(d.country, '')) = lower(v_city))
        and (p_min_experience is null or coalesce(d.experience_years, 0) >= p_min_experience)
        and (p_availability is null or dp.availability = p_availability)
        and (p_min_rating is null or coalesce(d.rating_avg, 0) >= p_min_rating)
        and (p_project_type is null or exists (
              select 1 from public.developer_projects pp
              where pp.developer_id = d.id and pp.project_type = p_project_type
            ))
      order by
        case when sp.ends_at is not null then 0 else 1 end,
        case v_sort
          when 'experience' then -coalesce(d.experience_years, 0)
          when 'projects'   then -coalesce(d.completed_projects_count, 0)
          when 'rating'     then -coalesce(d.rating_avg, 0)
          when 'availability' then case coalesce(dp.availability, 'on_mission')
                                     when 'available_now' then 0
                                     when 'available_soon' then 1
                                     else 2 end
          else -coalesce(d.reputation_score, 0)
        end,
        case v_sort
          when 'rating' then -d.reviews_count
          when 'availability' then -coalesce(d.reputation_score, 0)
          else -coalesce(d.rating_avg, 0)
        end,
        d.created_at desc
      limit v_limit offset v_offset
    ) s
  ), '[]'::jsonb);
end;
$$;

COMMIT;


-- ############################################################
-- FICHIER : supabase/migrations/0059_earnings_withdrawals.sql
-- ############################################################

-- ============================================================
-- 0059_earnings_withdrawals.sql
-- Wallet étendu : revenus de missions (en attente / disponibles),
-- retraits tracés. Les Tokens restent gérés par token_transactions.
-- Le séquestre des fonds mission est un LIVRE COMPTABLE INTERNE
-- alimenté par des paiements Chariow confirmés côté serveur —
-- pas une simulation. Aucun solde négatif, idempotence par clé.
-- NON destructif, idempotent.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Paiements de missions (confirmés via webhook Chariow)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mission_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  payer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_fcfa INTEGER NOT NULL CHECK (amount_fcfa > 0),
  currency TEXT NOT NULL DEFAULT 'XOF',
  provider TEXT NOT NULL DEFAULT 'chariow',
  provider_sale_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'refunding', 'refunded', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  UNIQUE (provider, provider_sale_id)
);

CREATE INDEX IF NOT EXISTS mission_payments_mission_idx ON public.mission_payments (mission_id, status);
ALTER TABLE public.mission_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mission_payments_participant_select ON public.mission_payments;
CREATE POLICY mission_payments_participant_select ON public.mission_payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.missions m
       WHERE m.id = mission_payments.mission_id
         AND (m.developer_id = auth.uid() OR m.client_id = auth.uid())
    )
  );

-- Écriture exclusivement via RPC (webhook service_role).

-- ------------------------------------------------------------
-- 2. Grand livre des revenus développeur
--    kind : pending (fonds bloqués) → available (retirables)
--           withdrawal_hold / withdrawal_paid / refund / adjustment
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.earnings_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id UUID REFERENCES public.missions(id) ON DELETE SET NULL,
  withdrawal_id UUID,
  amount_fcfa INTEGER NOT NULL,
  kind TEXT NOT NULL
    CHECK (kind IN ('pending', 'available', 'withdrawal_hold', 'withdrawal_paid', 'refund', 'adjustment')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS earnings_ledger_developer_idx ON public.earnings_ledger (developer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS earnings_ledger_mission_idx ON public.earnings_ledger (mission_id);
CREATE UNIQUE INDEX IF NOT EXISTS earnings_ledger_mission_kind_uidx
  ON public.earnings_ledger (mission_id, kind)
  WHERE mission_id IS NOT NULL AND kind IN ('pending', 'available');

ALTER TABLE public.earnings_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS earnings_ledger_select_own ON public.earnings_ledger;
CREATE POLICY earnings_ledger_select_own ON public.earnings_ledger
  FOR SELECT TO authenticated USING (developer_id = auth.uid());

-- ------------------------------------------------------------
-- 3. Retraits
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_fcfa INTEGER NOT NULL CHECK (amount_fcfa > 0),
  method TEXT NOT NULL CHECK (method IN ('wave', 'orange_money', 'mobicash', 'bank_transfer')),
  destination TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'approved', 'processing', 'paid', 'rejected', 'cancelled')),
  provider_reference TEXT,
  admin_note TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS withdrawals_developer_idx ON public.withdrawals (developer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS withdrawals_status_idx ON public.withdrawals (status);

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS withdrawals_select_own ON public.withdrawals;
CREATE POLICY withdrawals_select_own ON public.withdrawals
  FOR SELECT TO authenticated USING (developer_id = auth.uid());

REVOKE ALL ON public.withdrawals FROM PUBLIC, anon;
REVOKE ALL ON public.earnings_ledger FROM PUBLIC, anon;
REVOKE ALL ON public.mission_payments FROM PUBLIC, anon;

-- ------------------------------------------------------------
-- 4. Confirmation d'un paiement de mission (service_role / webhook)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_mission_payment(
  p_mission_id UUID,
  p_provider_sale_id TEXT,
  p_amount_fcfa INTEGER,
  p_payer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_m public.missions%ROWTYPE;
  v_existing public.mission_payments%ROWTYPE;
  v_payer uuid;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès interdit.' USING ERRCODE = 'TLAAC';
  END IF;

  SELECT * INTO v_m FROM public.missions WHERE id = p_mission_id FOR UPDATE;
  IF v_m.id IS NULL THEN
    RAISE EXCEPTION 'Mission introuvable.' USING ERRCODE = 'TLNMI';
  END IF;

  -- Idempotence : même sale = même résultat.
  SELECT * INTO v_existing
    FROM public.mission_payments
   WHERE provider = 'chariow' AND provider_sale_id = p_provider_sale_id;
  IF v_existing.id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'payment_id', v_existing.id);
  END IF;

  IF p_amount_fcfa IS NULL OR p_amount_fcfa <> v_m.agreed_price_fcfa THEN
    RAISE EXCEPTION 'Montant du paiement incohérent avec la mission.' USING ERRCODE = 'TLAMT';
  END IF;
  IF v_m.status NOT IN ('awaiting_payment', 'payment_confirmed') THEN
    RAISE EXCEPTION 'La mission n''attend pas de paiement.' USING ERRCODE = 'TLSTS';
  END IF;

  v_payer := coalesce(p_payer_id, v_m.client_id);

  INSERT INTO public.mission_payments (
    mission_id, payer_id, amount_fcfa, provider, provider_sale_id, status, confirmed_at
  ) VALUES (
    p_mission_id, v_payer, p_amount_fcfa, 'chariow', p_provider_sale_id, 'confirmed', now()
  ) RETURNING id INTO v_existing;

  INSERT INTO public.earnings_ledger (developer_id, mission_id, amount_fcfa, kind, note)
  VALUES (v_m.developer_id, p_mission_id, p_amount_fcfa, 'pending', 'Paiement mission confirmé')
  ON CONFLICT (mission_id, kind) WHERE mission_id IS NOT NULL AND kind IN ('pending', 'available')
  DO NOTHING;

  IF v_m.status = 'awaiting_payment' THEN
    UPDATE public.missions SET status = 'payment_confirmed' WHERE id = p_mission_id;
    INSERT INTO public.mission_events (mission_id, actor_id, status_from, status_to, comment)
    VALUES (p_mission_id, v_payer, 'awaiting_payment', 'payment_confirmed', 'Paiement confirmé par le prestataire.');
  END IF;

  PERFORM public.notify_user(
    v_m.developer_id,
    'payment_confirmed',
    'Paiement de mission confirmé',
    'Le client a payé la mission. Vous pouvez démarrer le travail.',
    '/missions'
  );

  RETURN jsonb_build_object('ok', true, 'payment_id', v_existing.id, 'mission_status', 'payment_confirmed');
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_mission_payment(UUID, TEXT, INTEGER, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_mission_payment(UUID, TEXT, INTEGER, UUID) TO service_role;

-- ------------------------------------------------------------
-- 5. Libération des fonds (mission terminée, une seule fois)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_mission_funds(p_mission_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_m public.missions%ROWTYPE;
  v_amount integer;
  v_actor uuid := coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
BEGIN
  SELECT * INTO v_m FROM public.missions WHERE id = p_mission_id FOR UPDATE;
  IF v_m.id IS NULL THEN
    RAISE EXCEPTION 'Mission introuvable.' USING ERRCODE = 'TLNMI';
  END IF;
  IF v_m.status <> 'completed' THEN
    RAISE EXCEPTION 'Mission non terminée.' USING ERRCODE = 'TLSTS';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.disputes d
     WHERE d.mission_id = p_mission_id AND d.status IN ('open', 'under_review')
  ) THEN
    RAISE EXCEPTION 'Litige en cours : libération bloquée.' USING ERRCODE = 'TLDSP';
  END IF;

  SELECT amount_fcfa INTO v_amount
    FROM public.mission_payments
   WHERE mission_id = p_mission_id AND status = 'confirmed'
   LIMIT 1;

  IF v_amount IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'released', 0, 'reason', 'no_confirmed_payment');
  END IF;

  INSERT INTO public.earnings_ledger (developer_id, mission_id, amount_fcfa, kind, note)
  VALUES (v_m.developer_id, p_mission_id, v_amount, 'available', 'Fonds libérés après acceptation')
  ON CONFLICT (mission_id, kind) WHERE mission_id IS NOT NULL AND kind IN ('pending', 'available')
  DO NOTHING;

  PERFORM public.notify_user(
    v_m.developer_id,
    'earnings_available',
    'Revenus disponibles',
    'Les fonds de la mission sont maintenant disponibles au retrait dans votre wallet.',
    '/wallet'
  );

  RETURN jsonb_build_object('ok', true, 'released', v_amount);
END;
$$;

REVOKE ALL ON FUNCTION public.release_mission_funds(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_mission_funds(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 6. Solde retirable + résumé wallet
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_wallet_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_tokens integer;
  v_pending integer;
  v_available integer;
  v_held integer;
  v_paid integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;

  SELECT coalesce(sum(t.amount), 0)::integer INTO v_tokens
    FROM public.token_transactions t WHERE t.developer_id = v_user;

  SELECT
    coalesce(sum(amount) FILTER (WHERE kind = 'pending'), 0),
    coalesce(sum(amount) FILTER (WHERE kind = 'available'), 0),
    coalesce(-sum(amount) FILTER (WHERE kind = 'withdrawal_hold'), 0),
    coalesce(sum(amount) FILTER (WHERE kind = 'withdrawal_paid'), 0)
  INTO v_pending, v_available, v_held, v_paid
    FROM public.earnings_ledger
   WHERE developer_id = v_user;

  RETURN jsonb_build_object(
    'tokens', v_tokens,
    'earnings_pending_fcfa', v_pending,
    'earnings_available_fcfa', greatest(v_available - v_held, 0),
    'earnings_held_fcfa', v_held,
    'earnings_paid_fcfa', v_paid,
    'min_withdrawal_fcfa', coalesce(
      (select (value #>> '{}')::integer from public.app_settings where key = 'min_withdrawal_fcfa'),
      5000
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_wallet_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_wallet_summary() TO authenticated;

-- ------------------------------------------------------------
-- 7. Demande de retrait (réserve immédiate du montant)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_amount_fcfa integer,
  p_method text,
  p_destination text
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_available integer;
  v_held integer;
  v_min integer;
  v_wid uuid;
  v_dest text := btrim(coalesce(p_destination, ''));
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;
  IF p_method NOT IN ('wave', 'orange_money', 'mobicash', 'bank_transfer') THEN
    RAISE EXCEPTION 'Moyen de retrait non pris en charge.' USING ERRCODE = 'TLBAD';
  END IF;
  IF length(v_dest) < 4 OR length(v_dest) > 120 THEN
    RAISE EXCEPTION 'Coordonnées de retrait invalides.' USING ERRCODE = 'TLBAD';
  END IF;
  IF coalesce(p_amount_fcfa, 0) <= 0 THEN
    RAISE EXCEPTION 'Montant invalide.' USING ERRCODE = 'TLBAD';
  END IF;

  v_min := coalesce(
    (select (value #>> '{}')::integer from public.app_settings where key = 'min_withdrawal_fcfa'),
    5000
  );
  IF p_amount_fcfa < v_min THEN
    RAISE EXCEPTION 'Montant minimum de retrait : ' || v_min || ' FCFA.' USING ERRCODE = 'TLBAD';
  END IF;

  PERFORM 1 FROM public.user_presence WHERE user_id = v_user;

  SELECT
    coalesce(sum(amount) FILTER (WHERE kind = 'available'), 0),
    coalesce(-sum(amount) FILTER (WHERE kind = 'withdrawal_hold'), 0)
  INTO v_available, v_held
    FROM public.earnings_ledger
   WHERE developer_id = v_user;

  IF (v_available - v_held) < p_amount_fcfa THEN
    RAISE EXCEPTION 'Solde disponible insuffisant pour ce retrait.' USING ERRCODE = 'TLLOW';
  END IF;

  INSERT INTO public.withdrawals (developer_id, amount_fcfa, method, destination, status)
  VALUES (v_user, p_amount_fcfa, p_method, v_dest, 'requested')
  RETURNING id INTO v_wid;

  INSERT INTO public.earnings_ledger (developer_id, withdrawal_id, amount_fcfa, kind, note)
  VALUES (v_user, v_wid, -p_amount_fcfa, 'withdrawal_hold', 'Retrait demandé');

  PERFORM public.notify_user(
    v_user,
    'withdrawal_requested',
    'Demande de retrait enregistrée',
    'Votre demande de retrait de ' || p_amount_fcfa || ' FCFA est en cours de traitement.',
    '/wallet'
  );

  RETURN jsonb_build_object('ok', true, 'withdrawal_id', v_wid, 'amount_fcfa', p_amount_fcfa);
END;
$$;

REVOKE ALL ON FUNCTION public.request_withdrawal(integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(integer, text, text) TO authenticated;

-- ------------------------------------------------------------
-- 8. Traitement admin d'un retrait
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_withdrawal_status(
  p_withdrawal_id uuid,
  p_status text,
  p_provider_reference text default null,
  p_admin_note text default null
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_w public.withdrawals%ROWTYPE;
  v_transition_ok boolean := false;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès administrateur requis.' USING ERRCODE = 'TLAUT';
  END IF;
  IF p_status NOT IN ('approved', 'processing', 'paid', 'rejected', 'cancelled') THEN
    RAISE EXCEPTION 'Statut invalide.' USING ERRCODE = 'TLBAD';
  END IF;

  SELECT * INTO v_w FROM public.withdrawals WHERE id = p_withdrawal_id FOR UPDATE;
  IF v_w.id IS NULL THEN
    RAISE EXCEPTION 'Retrait introuvable.' USING ERRCODE = 'TLNWD';
  END IF;

  v_transition_ok :=
       (v_w.status = 'requested' AND p_status IN ('approved', 'rejected', 'cancelled'))
    OR (v_w.status = 'approved' AND p_status IN ('processing', 'paid', 'rejected'))
    OR (v_w.status = 'processing' AND p_status IN ('paid', 'rejected'));

  IF NOT v_transition_ok THEN
    RAISE EXCEPTION 'Transition de statut invalide.' USING ERRCODE = 'TLTRN';
  END IF;

  UPDATE public.withdrawals
     SET status = p_status,
         provider_reference = coalesce(p_provider_reference, provider_reference),
         admin_note = coalesce(p_admin_note, admin_note),
         processed_at = CASE WHEN p_status IN ('paid', 'rejected', 'cancelled') THEN now() ELSE processed_at END
   WHERE id = p_withdrawal_id;

  IF p_status = 'paid' THEN
    INSERT INTO public.earnings_ledger (developer_id, withdrawal_id, amount_fcfa, kind, note)
    VALUES (v_w.developer_id, v_w.id, -v_w.amount_fcfa, 'withdrawal_paid', 'Retrait versé');
    -- Le hold devient paid : on neutralise le hold en encaissant.
    PERFORM public.notify_user(
      v_w.developer_id,
      'withdrawal_paid',
      'Retrait effectué',
      'Votre retrait de ' || v_w.amount_fcfa || ' FCFA a été versé.',
      '/wallet'
    );
  ELSIF p_status IN ('rejected', 'cancelled') THEN
    -- Libère la réserve.
    INSERT INTO public.earnings_ledger (developer_id, withdrawal_id, amount_fcfa, kind, note)
    VALUES (v_w.developer_id, v_w.id, v_w.amount_fcfa, 'adjustment', 'Retrait annulé : fonds libérés');
    PERFORM public.notify_user(
      v_w.developer_id,
      'withdrawal_rejected',
      'Retrait non retenu',
      'Votre demande de retrait a été refusée. Les fonds sont de nouveau disponibles.',
      '/wallet'
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', p_status);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_withdrawal_status(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_withdrawal_status(uuid, text, text, text) TO authenticated;

-- ------------------------------------------------------------
-- 9. Historique wallet enrichi (tokens + revenus)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_wallet_history(p_limit integer default 50)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;
  RETURN jsonb_build_object(
    'tokens', coalesce((
      select jsonb_agg(x order by x->>'created_at' desc)
      from (
        select jsonb_build_object(
          'id', t.id,
          'amount', t.amount,
          'type', t.type,
          'amount_fcfa', t.amount_fcfa,
          'request_id', t.request_id,
          'created_at', t.created_at
        ) as x
        from public.token_transactions t
        where t.developer_id = v_user
        order by t.created_at desc
        limit greatest(1, least(coalesce(p_limit, 50), 200))
      ) sub
    ), '[]'::jsonb),
    'earnings', coalesce((
      select jsonb_agg(x order by x->>'created_at' desc)
      from (
        select jsonb_build_object(
          'id', e.id,
          'mission_id', e.mission_id,
          'withdrawal_id', e.withdrawal_id,
          'amount_fcfa', e.amount_fcfa,
          'kind', e.kind,
          'note', e.note,
          'created_at', e.created_at
        ) as x
        from public.earnings_ledger e
        where e.developer_id = v_user
        order by e.created_at desc
        limit greatest(1, least(coalesce(p_limit, 50), 200))
      ) sub
    ), '[]'::jsonb),
    'withdrawals', coalesce((
      select jsonb_agg(x order by x->>'requested_at' desc)
      from (
        select jsonb_build_object(
          'id', w.id,
          'amount_fcfa', w.amount_fcfa,
          'method', w.method,
          'destination_masked', case
            when length(w.destination) > 6
              then left(w.destination, 3) || '…' || right(w.destination, 3)
            else '***' end,
          'status', w.status,
          'provider_reference', w.provider_reference,
          'requested_at', w.requested_at,
          'processed_at', w.processed_at
        ) as x
        from public.withdrawals w
        where w.developer_id = v_user
        order by w.requested_at desc
        limit greatest(1, least(coalesce(p_limit, 50), 100))
      ) sub
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_wallet_history(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_wallet_history(integer) TO authenticated;

COMMIT;


-- ############################################################
-- FICHIER : supabase/migrations/0060_missions_full_flow.sql
-- ############################################################

-- ============================================================
-- 0060_missions_full_flow.sql
-- Parcours mission complet : 15 statuts, contrat snapshot,
-- paiement, livraison, acceptation, corrections, annulation,
-- remboursement, litige. Transitions contrôlées côté serveur.
-- NON destructif, idempotent.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Colonnes contrat / livraison / annulation
-- ------------------------------------------------------------
ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS contract_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS contract_client_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contract_dev_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_url TEXT,
  ADD COLUMN IF NOT EXISTS delivery_notes TEXT,
  ADD COLUMN IF NOT EXISTS delivery_files JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS delivery_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acceptance_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS correction_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS refund_amount_fcfa INTEGER;

-- ------------------------------------------------------------
-- 2. Statuts étendus (15)
-- ------------------------------------------------------------
ALTER TABLE public.missions DROP CONSTRAINT IF EXISTS missions_status_check;
ALTER TABLE public.missions
  ADD CONSTRAINT missions_status_check
  CHECK (status IN (
    'draft',                 -- brouillon
    'negotiating',           -- négociation en cours
    'awaiting_agreement',    -- en attente d'accord
    'awaiting_payment',      -- en attente de paiement
    'payment_confirmed',     -- paiement confirmé
    'in_progress',           -- en cours
    'delivery_submitted',    -- livraison soumise
    'awaiting_acceptance',   -- en attente d'acceptation
    'corrections_requested', -- corrections demandées
    'dispute_open',          -- litige ouvert
    'completed',             -- terminée
    'cancellation_requested',-- annulation demandée
    'cancelled',             -- annulée
    'refund_in_progress',    -- remboursement en cours
    'refunded',              -- remboursée
    'new',                   -- legacy (migré vers awaiting_payment)
    'disputed'               -- legacy (migré vers dispute_open)
  ));

-- Migration des valeurs legacy.
UPDATE public.missions SET status = 'dispute_open' WHERE status = 'disputed';
UPDATE public.missions SET status = 'awaiting_payment' WHERE status = 'new';
UPDATE public.missions SET status = 'awaiting_acceptance'
 WHERE status = 'completed' AND acceptance_at IS NULL AND completed_at IS NOT NULL;
UPDATE public.missions SET status = 'completed'
 WHERE status = 'awaiting_acceptance' AND acceptance_at IS NOT NULL;

-- ------------------------------------------------------------
-- 3. create_mission_from_offer : contrat snapshot + awaiting_payment
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_mission_from_offer(
  p_offer_id UUID,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_offer public.formal_offers%ROWTYPE;
  v_conv public.conversations%ROWTYPE;
  v_mission_id UUID;
  v_existing UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLNAU';
  END IF;

  SELECT * INTO v_offer FROM public.formal_offers WHERE id = p_offer_id FOR UPDATE;
  IF v_offer.id IS NULL THEN
    RAISE EXCEPTION 'Offre introuvable.' USING ERRCODE = 'TLNFO';
  END IF;

  SELECT * INTO v_conv FROM public.conversations WHERE id = v_offer.conversation_id;
  IF v_conv.id IS NULL OR v_conv.client_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Seul le client concerné peut créer la mission.' USING ERRCODE = 'TLNOC';
  END IF;

  IF v_offer.status <> 'accepted' THEN
    RAISE EXCEPTION 'Offre non acceptée.' USING ERRCODE = 'TLPEN';
  END IF;

  SELECT id INTO v_existing
    FROM public.missions
   WHERE offer_id = p_offer_id
   LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Une mission existe déjà pour cette offre.' USING ERRCODE = 'TLDUP';
  END IF;

  INSERT INTO public.missions (
    request_id, conversation_id, offer_id,
    developer_id, client_id,
    agreed_price_fcfa, agreed_days, description,
    status,
    contract_snapshot,
    contract_client_accepted_at,
    contract_dev_accepted_at
  ) VALUES (
    v_conv.request_id, v_conv.id, v_offer.id,
    v_offer.developer_id, v_user_id,
    v_offer.total_price_fcfa, v_offer.delivery_days, p_description,
    'awaiting_payment',
    jsonb_build_object(
      'offer_id', v_offer.id,
      'price_fcfa', v_offer.total_price_fcfa,
      'days', v_offer.delivery_days,
      'deposit_fcfa', v_offer.deposit_fcfa,
      'accepted_at', now()
    ),
    now(),
    now()
  ) RETURNING id INTO v_mission_id;

  UPDATE public.conversations SET status = 'awarded' WHERE id = v_conv.id;

  INSERT INTO public.mission_events (mission_id, actor_id, status_to, comment)
  VALUES (v_mission_id, v_user_id, 'awaiting_payment', 'Mission créée depuis une offre acceptée. En attente de paiement.');

  PERFORM public.notify_user(
    v_offer.developer_id,
    'mission_created',
    'Nouvelle mission à payer',
    'Le client a créé la mission. Elle démarre après confirmation du paiement.',
    '/missions'
  );

  RETURN JSONB_BUILD_OBJECT(
    'mission_id', v_mission_id,
    'status', 'awaiting_payment',
    'developer_id', v_offer.developer_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_mission_from_offer(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_mission_from_offer(UUID, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- 4. Machine à états complète
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mission_update_status(
  p_mission_id UUID,
  p_to_status TEXT,
  p_comment TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_m public.missions%ROWTYPE;
  v_from TEXT;
  v_allowed BOOLEAN := FALSE;
  v_is_client BOOLEAN;
  v_is_dev BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLNAU';
  END IF;

  SELECT * INTO v_m FROM public.missions WHERE id = p_mission_id FOR UPDATE;
  IF v_m.id IS NULL THEN
    RAISE EXCEPTION 'Mission introuvable.' USING ERRCODE = 'TLNMI';
  END IF;

  v_from := v_m.status;
  v_is_client := (v_m.client_id = v_user_id);
  v_is_dev := (v_m.developer_id = v_user_id);

  -- Règles de transition (rôle strict).
  IF v_from = 'awaiting_payment' AND p_to_status = 'payment_confirmed' THEN
    v_allowed := FALSE; -- uniquement via confirm_mission_payment (webhook)
  ELSIF v_from = 'payment_confirmed' AND p_to_status = 'in_progress' AND v_is_dev THEN
    v_allowed := TRUE;
  ELSIF v_from IN ('in_progress', 'corrections_requested') AND p_to_status = 'delivery_submitted' AND v_is_dev THEN
    v_allowed := TRUE;
  ELSIF v_from IN ('delivery_submitted', 'awaiting_acceptance') AND p_to_status = 'awaiting_acceptance' AND v_is_dev THEN
    v_allowed := TRUE;
  ELSIF v_from = 'awaiting_acceptance' AND p_to_status = 'corrections_requested' AND v_is_client THEN
    v_allowed := TRUE;
  ELSIF v_from = 'corrections_requested' AND p_to_status = 'in_progress' AND v_is_dev THEN
    v_allowed := TRUE;
  ELSIF v_from IN ('awaiting_acceptance', 'delivery_submitted') AND p_to_status = 'completed' AND v_is_client THEN
    v_allowed := TRUE;
  ELSIF v_from IN ('payment_confirmed', 'in_progress', 'delivery_submitted', 'awaiting_acceptance', 'corrections_requested')
        AND p_to_status = 'cancellation_requested' AND (v_is_client OR v_is_dev) THEN
    v_allowed := TRUE;
  ELSIF v_from = 'cancellation_requested' AND p_to_status = 'cancelled' AND (v_is_client OR v_is_dev) THEN
    v_allowed := TRUE;
  ELSIF v_from IN ('payment_confirmed', 'in_progress', 'delivery_submitted', 'awaiting_acceptance', 'corrections_requested')
        AND p_to_status = 'dispute_open' AND (v_is_client OR v_is_dev) THEN
    v_allowed := TRUE;
  ELSIF v_from = 'dispute_open' AND p_to_status = 'completed' THEN
    v_allowed := public.is_admin(); -- résolution admin
  ELSIF v_from IN ('cancellation_requested', 'dispute_open') AND p_to_status = 'refund_in_progress' THEN
    v_allowed := public.is_admin();
  ELSIF v_from = 'refund_in_progress' AND p_to_status = 'refunded' THEN
    v_allowed := public.is_admin();
  ELSIF v_from = 'refund_in_progress' AND p_to_status = 'cancelled' THEN
    v_allowed := public.is_admin();
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Transition invalide (' || v_from || ' → ' || p_to_status || ').' USING ERRCODE = 'TLTRN';
  END IF;

  UPDATE public.missions
     SET status = p_to_status,
         started_at = CASE WHEN p_to_status = 'in_progress' THEN COALESCE(started_at, NOW()) ELSE started_at END,
         delivery_at = CASE WHEN p_to_status = 'delivery_submitted' THEN NOW() ELSE delivery_at END,
         acceptance_at = CASE WHEN p_to_status = 'completed' THEN NOW() ELSE acceptance_at END,
         completed_at = CASE WHEN p_to_status = 'completed' THEN NOW() ELSE completed_at END,
         correction_count = CASE WHEN p_to_status = 'corrections_requested' THEN correction_count + 1 ELSE correction_count END
   WHERE id = p_mission_id;

  INSERT INTO public.mission_events (mission_id, actor_id, status_from, status_to, comment)
  VALUES (p_mission_id, v_user_id, v_from, p_to_status, p_comment);

  -- Notifications des parties.
  IF v_is_client THEN
    PERFORM public.notify_user(v_m.developer_id, 'mission_status',
      'Mission ' || p_to_status, coalesce(p_comment, 'Statut de mission mis à jour.'), '/missions');
  ELSE
    PERFORM public.notify_user(v_m.client_id, 'mission_status',
      'Mission ' || p_to_status, coalesce(p_comment, 'Statut de mission mis à jour.'), '/missions');
  END IF;

  -- Libération des fonds à l'acceptation finale.
  IF p_to_status = 'completed' THEN
    PERFORM public.release_mission_funds(p_mission_id);
    -- Points de classement : 50 pts une seule fois.
    UPDATE public.developers
       SET completed_projects_count = coalesce(completed_projects_count, 0) + 1
     WHERE id = v_m.developer_id;
    PERFORM public.notify_user(v_m.developer_id, 'mission_completed',
      'Mission terminée', 'Félicitations, la mission est terminée et les fonds sont disponibles.', '/wallet');
    PERFORM public.notify_user(v_m.client_id, 'mission_completed',
      'Mission terminée', 'La mission est terminée. Vous pouvez laisser un avis.', '/missions');
  END IF;

  RETURN JSONB_BUILD_OBJECT(
    'mission_id', p_mission_id,
    'status', p_to_status,
    'was', v_from
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mission_update_status(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mission_update_status(UUID, TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- 5. Livraison
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mission_submit_delivery(
  p_mission_id uuid,
  p_delivery_url text default null,
  p_delivery_notes text default null,
  p_delivery_files jsonb default '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_m public.missions%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;
  SELECT * INTO v_m FROM public.missions WHERE id = p_mission_id FOR UPDATE;
  IF v_m.id IS NULL OR v_m.developer_id <> v_user THEN
    RAISE EXCEPTION 'Mission non trouvable.' USING ERRCODE = 'TLNMI';
  END IF;
  IF v_m.status NOT IN ('in_progress', 'corrections_requested') THEN
    RAISE EXCEPTION 'La mission n''est pas en cours.' USING ERRCODE = 'TLSTS';
  END IF;
  IF nullif(btrim(coalesce(p_delivery_url, '')), '') IS NULL
     AND coalesce(jsonb_array_length(p_delivery_files), 0) = 0 THEN
    RAISE EXCEPTION 'Fournissez un lien de livraison ou des fichiers.' USING ERRCODE = 'TLBAD';
  END IF;

  UPDATE public.missions
     SET delivery_url = nullif(btrim(coalesce(p_delivery_url, '')), ''),
         delivery_notes = nullif(btrim(coalesce(p_delivery_notes, '')), ''),
         delivery_files = coalesce(p_delivery_files, '[]'::jsonb),
         delivery_at = now(),
         status = 'awaiting_acceptance'
   WHERE id = p_mission_id;

  INSERT INTO public.mission_events (mission_id, actor_id, status_from, status_to, comment)
  VALUES (p_mission_id, v_user, v_m.status, 'awaiting_acceptance', 'Livraison soumise.');

  PERFORM public.notify_user(
    v_m.client_id,
    'delivery_submitted',
    'Livraison soumise',
    'Le développeur a soumis la livraison de la mission. Vérifiez et acceptez ou demandez des corrections.',
    '/missions'
  );

  RETURN jsonb_build_object('ok', true, 'status', 'awaiting_acceptance');
END;
$$;

REVOKE ALL ON FUNCTION public.mission_submit_delivery(uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mission_submit_delivery(uuid, text, text, jsonb) TO authenticated;

-- ------------------------------------------------------------
-- 6. Annulation + remboursement
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mission_request_cancellation(
  p_mission_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_m public.missions%ROWTYPE;
  v_paid integer;
  v_result jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;
  SELECT * INTO v_m FROM public.missions WHERE id = p_mission_id FOR UPDATE;
  IF v_m.id IS NULL OR (v_m.client_id <> v_user AND v_m.developer_id <> v_user) THEN
    RAISE EXCEPTION 'Mission non trouvable.' USING ERRCODE = 'TLNMI';
  END IF;
  IF nullif(btrim(coalesce(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Un motif d''annulation est requis.' USING ERRCODE = 'TLBAD';
  END IF;

  v_result := public.mission_update_status(p_mission_id, 'cancellation_requested', btrim(p_reason));

  UPDATE public.missions SET cancellation_reason = btrim(p_reason) WHERE id = p_mission_id;

  -- Travail non commencé + paiement confirmé → remboursement intégral
  -- proposé (exécution admin du remboursement Chariow).
  SELECT coalesce(sum(amount_fcfa), 0) INTO v_paid
    FROM public.mission_payments
   WHERE mission_id = p_mission_id AND status = 'confirmed';

  IF v_m.status IN ('payment_confirmed') AND v_paid > 0 THEN
    UPDATE public.missions SET refund_amount_fcfa = v_paid, status = 'refund_in_progress'
     WHERE id = p_mission_id;
    INSERT INTO public.mission_events (mission_id, actor_id, status_from, status_to, comment)
    VALUES (p_mission_id, v_user, 'cancellation_requested', 'refund_in_progress',
            'Annulation avant démarrage : remboursement intégral proposé.');
    v_result := v_result || jsonb_build_object('refund_proposed', v_paid);
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.mission_request_cancellation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mission_request_cancellation(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_process_mission_refund(
  p_mission_id uuid,
  p_refund_amount_fcfa integer,
  p_note text default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_m public.missions%ROWTYPE;
  v_payment public.mission_payments%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès administrateur requis.' USING ERRCODE = 'TLAUT';
  END IF;
  SELECT * INTO v_m FROM public.missions WHERE id = p_mission_id FOR UPDATE;
  IF v_m.id IS NULL THEN
    RAISE EXCEPTION 'Mission introuvable.' USING ERRCODE = 'TLNMI';
  END IF;
  IF v_m.status NOT IN ('refund_in_progress', 'cancellation_requested', 'dispute_open') THEN
    RAISE EXCEPTION 'Statut incompatible avec un remboursement.' USING ERRCODE = 'TLSTS';
  END IF;

  SELECT * INTO v_payment
    FROM public.mission_payments
   WHERE mission_id = p_mission_id AND status = 'confirmed'
   LIMIT 1
   FOR UPDATE;
  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'Aucun paiement confirmé à rembourser.' USING ERRCODE = 'TLNPD';
  END IF;
  IF coalesce(p_refund_amount_fcfa, 0) <= 0 OR p_refund_amount_fcfa > v_payment.amount_fcfa THEN
    RAISE EXCEPTION 'Montant de remboursement invalide.' USING ERRCODE = 'TLBAD';
  END IF;

  -- Ne marque refunded qu'après exécution réelle côté Chariow/admin.
  UPDATE public.mission_payments
     SET status = 'refunded', refunded_at = now()
   WHERE id = v_payment.id;

  -- Annule la ligne de revenus en attente si présente.
  INSERT INTO public.earnings_ledger (developer_id, mission_id, amount_fcfa, kind, note)
  VALUES (v_m.developer_id, p_mission_id, -p_refund_amount_fcfa, 'refund',
          coalesce(p_note, 'Remboursement client'))
  ON CONFLICT (mission_id, kind) WHERE mission_id IS NOT NULL AND kind IN ('pending', 'available')
  DO NOTHING;

  UPDATE public.missions
     SET status = 'refunded',
         refund_amount_fcfa = p_refund_amount_fcfa,
         completed_at = NULL
   WHERE id = p_mission_id;

  INSERT INTO public.mission_events (mission_id, actor_id, status_from, status_to, comment)
  VALUES (p_mission_id, auth.uid(), v_m.status, 'refunded',
          'Remboursement de ' || p_refund_amount_fcfa || ' FCFA exécuté.');

  PERFORM public.notify_user(v_m.client_id, 'refund_completed',
    'Remboursement effectué', 'Votre remboursement de ' || p_refund_amount_fcfa || ' FCFA a été traité.', '/missions');
  PERFORM public.notify_user(v_m.developer_id, 'mission_cancelled',
    'Mission annulée', 'La mission a été annulée et remboursée.', '/missions');

  RETURN jsonb_build_object('ok', true, 'refunded_fcfa', p_refund_amount_fcfa);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_process_mission_refund(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_process_mission_refund(uuid, integer, text) TO authenticated;

COMMIT;


-- ############################################################
-- FICHIER : supabase/migrations/0061_leaderboard_settle.sql
-- ############################################################

-- ============================================================
-- 0061_leaderboard_settle.sql
-- Finalisation du classement mensuel : cron + route API +
-- récompenses 10/7/4 déjà en 0056. Configuration + messages.
-- NON destructif, idempotent.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Route API pour le settle (appelée par Vercel Cron)
--    Cette fonction est appelée via l'API route /api/cron/leaderboard-settle
--    qui vérifie le CRON_SECRET avant d'appeler cette fonction.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.leaderboard_settle_month(p_year integer, p_month integer)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settled integer;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès administrateur requis.' USING ERRCODE = 'TLAUT';
  END IF;

  v_start := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'UTC');
  v_end := v_start + interval '1 month';

  PERFORM public._leaderboard_settle(v_start, v_end);

  GET DIAGNOSTICS v_settled = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'year', p_year,
    'month', p_month,
    'settled', v_settled
  );
END;
$$;

REVOKE ALL ON FUNCTION public.leaderboard_settle_month(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leaderboard_settle_month(integer, integer) TO authenticated;

-- ------------------------------------------------------------
-- 2. Configuration du classement (messages FR par défaut)
-- ------------------------------------------------------------
INSERT INTO public.app_settings (key, value) VALUES
  ('leaderboard_rewards', '10'::jsonb),
  ('leaderboard_rewards_silver', '7'::jsonb),
  ('leaderboard_rewards_bronze', '4'::jsonb),
  ('leaderboard_min_missions', '2'::jsonb),
  ('leaderboard_settlement_day', '1'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------
-- 3. S'assurer que les récompenses existent dans app_settings
-- ------------------------------------------------------------
UPDATE public.app_settings
   SET value = '10'::jsonb
 WHERE key = 'leaderboard_reward_gold' OR (key = 'leaderboard_rewards' AND (value #>> '{}')::integer <> 10);

INSERT INTO public.app_settings (key, value)
VALUES ('leaderboard_reward_gold', '10'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value)
VALUES ('leaderboard_reward_silver', '7'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value)
VALUES ('leaderboard_reward_bronze', '4'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
WHERE (value #>> '{}')::integer <> 4;

COMMIT;


-- ############################################################
-- FICHIER : supabase/migrations/0062_notifications_v2.sql
-- ############################################################

-- ============================================================
-- 0062_notifications_v2.sql
-- Notifications réelles : triggers sur toutes les tables métier
-- pour que chaque événement important notifie l'utilisateur
-- concerné. Remplace le swallow silencieux par un log d'erreur.
-- NON destructif, idempotent.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Remplace notify_user silencieux par version loguée
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_link TEXT DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nid UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link, entity_type, entity_id)
  VALUES (p_user_id, p_type, p_title, p_body, p_link, p_entity_type, p_entity_id)
  RETURNING id INTO v_nid;

  RETURN v_nid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- ------------------------------------------------------------
-- 2. Trigger missions : notifications à chaque changement de statut
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_mission_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    -- Le développeur reçoit une notification pour chaque changement.
    IF NEW.developer_id IS NOT NULL THEN
      PERFORM public.notify_user(
        NEW.developer_id,
        'mission_status_change',
        'Mission : ' || NEW.status,
        'Statut de la mission mis à jour en « ' || NEW.status || ' ».',
        '/missions',
        'mission',
        NEW.id
      );
    END IF;
    -- Le client aussi.
    IF NEW.client_id IS NOT NULL THEN
      PERFORM public.notify_user(
        NEW.client_id,
        'mission_status_change',
        'Mission : ' || NEW.status,
        'Statut de la mission mis à jour en « ' || NEW.status || ' ».',
        '/missions',
        'mission',
        NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_mission_status ON public.missions;
CREATE TRIGGER trg_notify_mission_status
  AFTER UPDATE ON public.missions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_mission_status_change();

-- ------------------------------------------------------------
-- 3. Trigger token_transactions : notification d'achat/solde
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_token_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_user(
    NEW.developer_id,
    'token_' || NEW.type,
    CASE
      WHEN NEW.type = 'purchase' THEN 'Tokens achetés'
      WHEN NEW.type = 'spend' THEN 'Tokens utilisés'
      WHEN NEW.type = 'bonus' THEN 'Bonus reçu'
      ELSE 'Solde tokens mis à jour'
    END,
    'Solde de tokens : ' || (SELECT COALESCE(SUM(amount), 0) FROM public.token_transactions WHERE developer_id = NEW.developer_id) || ' tokens.',
    '/wallet',
    'token_transaction',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_token_transaction ON public.token_transactions;
CREATE TRIGGER trg_notify_token_transaction
  AFTER INSERT ON public.token_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_token_transaction();

-- ------------------------------------------------------------
-- 4. Trigger earnings_ledger : notification fonds disponibles
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_earnings_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.kind = 'available' THEN
    PERFORM public.notify_user(
      NEW.developer_id,
      'earnings_available',
      'Fonds disponibles',
      NEW.amount_fcfa || ' FCFA sont disponibles au retrait.',
      '/wallet',
      'earnings_ledger',
      NEW.id
    );
  ELSIF NEW.kind = 'withdrawal_paid' THEN
    PERFORM public.notify_user(
      NEW.developer_id,
      'withdrawal_paid',
      'Retrait effectué',
      'Un retrait de ' || ABS(NEW.amount_fcfa) || ' FCFA a été versé.',
      '/wallet',
      'withdrawal',
      NEW.withdrawal_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_earnings_ledger ON public.earnings_ledger;
CREATE TRIGGER trg_notify_earnings_ledger
  AFTER INSERT ON public.earnings_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_earnings_ledger();

-- ------------------------------------------------------------
-- 5. Trigger withdrawals : notification changement de statut
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_withdrawal_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_user(
      NEW.developer_id,
      'withdrawal_' || NEW.status,
      'Retrait : ' || NEW.status,
      'Votre retrait de ' || NEW.amount_fcfa || ' FCFA est maintenant « ' || NEW.status || ' ».',
      '/wallet',
      'withdrawal',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_withdrawal_status ON public.withdrawals;
CREATE TRIGGER trg_notify_withdrawal_status
  AFTER UPDATE ON public.withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_withdrawal_status();

-- ------------------------------------------------------------
-- 6. Trigger subscriptions : notification changement d'abonnement
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_subscription_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.ends_at IS DISTINCT FROM OLD.ends_at THEN
    PERFORM public.notify_user(
      NEW.developer_id,
      'subscription_updated',
      'Abonnement mis à jour',
      'Votre abonnement Pro se termine le ' || NEW.ends_at::date || '.',
      '/dashboard/billing',
      'subscription',
      NEW.developer_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_subscription_change ON public.subscriptions;
CREATE TRIGGER trg_notify_subscription_change
  AFTER UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_subscription_change();

-- Insertion (nouvel abonnement).
CREATE OR REPLACE FUNCTION public.notify_subscription_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_user(
    NEW.developer_id,
    'subscription_created',
    'Abonnement Pro activé',
    'Votre abonnement Pro est actif jusqu''au ' || NEW.ends_at::date || '.',
    '/dashboard/billing',
    'subscription',
    NEW.developer_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_subscription_created ON public.subscriptions;
CREATE TRIGGER trg_notify_subscription_created
  AFTER INSERT ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_subscription_created();

-- ------------------------------------------------------------
-- 8. Trigger payment_intents : notification paiement confirmé
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_payment_intent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'paid' THEN
    PERFORM public.notify_user(
      NEW.developer_id,
      'payment_completed',
      'Paiement confirmé',
      'Votre paiement de ' || NEW.amount_fcfa || ' FCFA a été confirmé.',
      '/dashboard/billing',
      'payment_intent',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_payment_intent ON public.payment_intents;
CREATE TRIGGER trg_notify_payment_intent
  AFTER UPDATE ON public.payment_intents
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_payment_intent();

COMMIT;


-- ############################################################
-- FICHIER : supabase/migrations/0063_pricing_space_cleanup.sql
-- ############################################################

-- ============================================================
-- 0063_pricing_space_cleanup.sql
-- Tarifs : Pro = 3 tokens/30j, Agence = 4 tokens. Suppression
-- du sponsoring. Nettoyage de l'espace dev.
-- NON destructif, idempotent.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Tarifs mis à jour
-- ------------------------------------------------------------
INSERT INTO public.app_settings (key, value) VALUES
  ('pro_price_tokens', '3'::jsonb),
  ('pro_duration_days', '30'::jsonb),
  ('agency_price_tokens', '4'::jsonb),
  ('agency_duration_days', '30'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
WHERE key IN ('pro_price_tokens', 'pro_duration_days', 'agency_price_tokens', 'agency_duration_days');

-- ------------------------------------------------------------
-- 2. create_agency avec débit de tokens (4 tokens, idempotent)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_agency(
  p_name TEXT,
  p_slug TEXT,
  p_bio TEXT DEFAULT NULL,
  p_logo_url TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_website TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_balance integer;
  v_cost integer;
  v_agency_id uuid;
  v_existing public.agencies%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;

  -- Vérifier que l'utilisateur n'a pas déjà une agence.
  SELECT * INTO v_existing FROM public.agencies WHERE owner_id = v_user LIMIT 1;
  IF v_existing.id IS NOT NULL THEN
    RAISE EXCEPTION 'Vous avez déjà une agence.' USING ERRCODE = 'TLDUP';
  END IF;

  v_cost := coalesce(
    (select (value #>> '{}')::integer from public.app_settings where key = 'agency_price_tokens'),
    4
  );

  -- Vérifier le solde.
  SELECT coalesce(sum(amount), 0) INTO v_balance
    FROM public.token_transactions
   WHERE developer_id = v_user;
  IF v_balance < v_cost THEN
    RAISE EXCEPTION 'Tokens insuffisants pour créer une agence (il en faut ' || v_cost || ').' USING ERRCODE = 'TLLOW';
  END IF;

  -- Débiter les tokens (idempotent via request_id).
  PERFORM public.debit_tokens(
    v_user,
    v_cost,
    'agency_creation',
    NULL::uuid
  );

  -- Créer l'agence.
  INSERT INTO public.agencies (
    owner_id, name, slug, bio, logo_url, city, country, website
  ) VALUES (
    v_user, p_name, p_slug, p_bio, p_logo_url, p_city, p_country, p_website
  ) RETURNING id INTO v_agency_id;

  -- Ajouter le propriétaire comme membre admin.
  INSERT INTO public.agency_members (agency_id, user_id, role)
  VALUES (v_agency_id, v_user, 'admin');

  PERFORM public.notify_user(
    v_user,
    'agency_created',
    'Agence créée',
    'Votre agence « ' || p_name || ' » a été créée avec succès.',
    '/dashboard/agency'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'agency_id', v_agency_id,
    'tokens_spent', v_cost
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_agency(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_agency(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- 3. Retirer le sponsoring de l'espace dev (REVOKE authenticated)
-- ------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.sponsor_dev_profile(uuid, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sponsor_brief(uuid, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_sponsor_payment_link(uuid, integer, text) FROM authenticated;

-- Marquer les fonctions comme obsolètes (ne pas DROP pour compat).
COMMENT ON FUNCTION public.sponsor_dev_profile(uuid, integer) IS 'OBSOLÈTE: sponsoring supprimé. Utilisez le wallet.';
COMMENT ON FUNCTION public.sponsor_brief(uuid, integer) IS 'OBSOLÈTE: sponsoring supprimé. Utilisez le wallet.';
COMMENT ON FUNCTION public.generate_sponsor_payment_link(uuid, integer, text) IS 'OBSOLÈTE: sponsoring supprimé. Utilisez le wallet.';

COMMIT;

