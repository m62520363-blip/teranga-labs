-- ============================================================
-- 0065_escrow_auto_refund_leaderboard.sql
-- 1. Remboursement automatique à l'annulation (fonds bloqués).
-- 2. Correctifs classement : cron (signature + mois précédent),
--    50 points par projet terminé, récompenses 10/7/4 (0056).
-- NON destructif, idempotent.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Finalisation automatique du remboursement (escrow).
--    Bookkeeping uniquement : paiement → refunded, ligne pending
--    retirée du wallet développeur, mission → refunded, notifications.
--    L'appelant insère sa propre ligne de mission_events.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mission_finalize_auto_refund(
  p_mission_id uuid,
  p_actor uuid DEFAULT NULL,
  p_context text DEFAULT 'annulation'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_m public.missions%ROWTYPE;
  v_payment public.mission_payments%ROWTYPE;
  v_amount integer;
BEGIN
  SELECT * INTO v_m FROM public.missions WHERE id = p_mission_id FOR UPDATE;
  IF v_m.id IS NULL THEN
    RAISE EXCEPTION 'Mission introuvable.' USING ERRCODE = 'TLNMI';
  END IF;

  SELECT * INTO v_payment
    FROM public.mission_payments
   WHERE mission_id = p_mission_id
     AND status IN ('confirmed', 'refunding')
   ORDER BY confirmed_at DESC NULLS LAST
   LIMIT 1
     FOR UPDATE;
  IF v_payment.id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'auto_refund', false,
                              'reason', 'no_confirmed_payment', 'refunded_fcfa', 0);
  END IF;

  v_amount := v_payment.amount_fcfa;

  -- Fonds déjà libérés au développeur : remboursement manuel (admin/litige).
  IF EXISTS (
    SELECT 1 FROM public.earnings_ledger e
     WHERE e.mission_id = p_mission_id AND e.kind = 'available'
  ) THEN
    RETURN jsonb_build_object('ok', true, 'auto_refund', false,
                              'reason', 'funds_released', 'refunded_fcfa', 0);
  END IF;

  IF v_payment.status = 'refunded' THEN
    RETURN jsonb_build_object('ok', true, 'auto_refund', false,
                              'reason', 'already_refunded', 'refunded_fcfa', v_amount);
  END IF;

  UPDATE public.mission_payments
     SET status = 'refunded', refunded_at = now()
   WHERE id = v_payment.id;

  -- Les fonds bloqués repartent au client : la ligne pending
  -- disparaît du résumé wallet du développeur (somme des kind='pending').
  DELETE FROM public.earnings_ledger
   WHERE mission_id = p_mission_id AND kind = 'pending';

  UPDATE public.missions
     SET status = 'refunded',
         refund_amount_fcfa = v_amount,
         completed_at = NULL
   WHERE id = p_mission_id;

  PERFORM public.notify_user(
    v_m.client_id, 'refund_completed',
    'Remboursement effectué',
    'Votre remboursement de ' || v_amount || ' FCFA a été traité automatiquement après l''annulation.',
    '/missions'
  );
  PERFORM public.notify_user(
    v_m.developer_id, 'mission_cancelled',
    'Mission annulée',
    'La mission a été annulée et le client a été remboursé.',
    '/missions'
  );

  RETURN jsonb_build_object('ok', true, 'auto_refund', true,
                            'refunded_fcfa', v_amount, 'mission_status', 'refunded',
                            'context', p_context, 'actor', p_actor);
END;
$$;

-- Interne uniquement : les appels authentifiés passent par
-- mission_update_status / mission_request_cancellation (déjà verrouillés).
REVOKE ALL ON FUNCTION public.mission_finalize_auto_refund(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mission_finalize_auto_refund(uuid, uuid, text) TO service_role;

-- ------------------------------------------------------------
-- 1b. Annulation acceptée (cancellation_requested → cancelled)
--     avec fonds encore bloqués → remboursement automatique.
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
  v_effective TEXT;
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
  ELSIF v_from = 'awaiting_payment' AND p_to_status = 'cancellation_requested' AND (v_is_client OR v_is_dev) THEN
    v_allowed := TRUE;
  ELSIF v_from IN ('draft', 'negotiating', 'awaiting_agreement', 'awaiting_payment')
        AND p_to_status = 'cancelled' AND (v_is_client OR v_is_dev) THEN
    v_allowed := TRUE; -- aucune somme engagée : annulation directe
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

  -- Annulation acceptée, fonds encore bloqués → remboursement auto.
  v_effective := p_to_status;
  IF p_to_status = 'cancelled'
     AND EXISTS (
       SELECT 1 FROM public.mission_payments mp
        WHERE mp.mission_id = p_mission_id AND mp.status = 'confirmed'
     )
     AND EXISTS (
       SELECT 1 FROM public.earnings_ledger el
        WHERE el.mission_id = p_mission_id AND el.kind = 'pending'
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.earnings_ledger el
        WHERE el.mission_id = p_mission_id AND el.kind = 'available'
     )
  THEN
    v_effective := 'refunded';
  END IF;

  IF v_effective = 'refunded' AND p_to_status = 'cancelled' THEN
    INSERT INTO public.mission_events (mission_id, actor_id, status_from, status_to, comment)
    VALUES (p_mission_id, v_user_id, v_from, 'refunded',
            coalesce(p_comment, 'Annulation acceptée : remboursement automatique.'));
    RETURN public.mission_finalize_auto_refund(p_mission_id, v_user_id, 'annulation_acceptee')
      || jsonb_build_object('mission_id', p_mission_id, 'status', 'refunded', 'was', v_from);
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
-- 1c. Annulation demandée : remboursement immédiat si aucun
--     travail engagé (paiement confirmé, fonds bloqués).
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
  v_auto jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;
  SELECT * INTO v_m FROM public.missions WHERE id = p_mission_id FOR UPDATE;
  IF v_m.id IS NULL OR (v_m.client_id <> v_user AND v_m.developer_id <> v_user) THEN
    RAISE EXCEPTION 'Mission non trouvée.' USING ERRCODE = 'TLNMI';
  END IF;
  IF nullif(btrim(coalesce(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Un motif d''annulation est requis.' USING ERRCODE = 'TLBAD';
  END IF;

  v_result := public.mission_update_status(p_mission_id, 'cancellation_requested', btrim(p_reason));

  UPDATE public.missions SET cancellation_reason = btrim(p_reason) WHERE id = p_mission_id;

  -- Travail non commencé + paiement confirmé → remboursement intégral.
  SELECT coalesce(sum(amount_fcfa), 0) INTO v_paid
    FROM public.mission_payments
   WHERE mission_id = p_mission_id AND status = 'confirmed';

  IF v_m.status IN ('payment_confirmed') AND v_paid > 0 THEN
    UPDATE public.missions SET refund_amount_fcfa = v_paid, status = 'refund_in_progress'
     WHERE id = p_mission_id;
    INSERT INTO public.mission_events (mission_id, actor_id, status_from, status_to, comment)
    VALUES (p_mission_id, v_user, 'cancellation_requested', 'refund_in_progress',
            'Annulation avant démarrage : remboursement intégral automatique.');
    v_result := v_result || jsonb_build_object('refund_proposed', v_paid);

    v_auto := public.mission_finalize_auto_refund(p_mission_id, v_user, 'annulation_avant_demarrage');
    v_result := v_result || jsonb_build_object('auto_refund', v_auto);

    INSERT INTO public.mission_events (mission_id, actor_id, status_from, status_to, comment)
    VALUES (p_mission_id, v_user, 'refund_in_progress', 'refunded',
            'Remboursement automatique de ' || v_paid || ' FCFA exécuté.');
    v_result := v_result || jsonb_build_object('status', 'refunded');
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.mission_request_cancellation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mission_request_cancellation(uuid, text) TO authenticated;

-- ------------------------------------------------------------
-- 1d. Remboursement manuel admin : neutralise vraiment les fonds
--     (la ligne pending était laissée en place → wallet inchangé).
-- ------------------------------------------------------------
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
  IF v_m.status NOT IN ('refund_in_progress', 'cancellation_requested', 'dispute_open', 'refunded') THEN
    RAISE EXCEPTION 'Statut incompatible avec un remboursement.' USING ERRCODE = 'TLSTS';
  END IF;

  SELECT * INTO v_payment
    FROM public.mission_payments
   WHERE mission_id = p_mission_id AND status IN ('confirmed', 'refunding')
   LIMIT 1
   FOR UPDATE;
  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'Aucun paiement confirmé à rembourser.' USING ERRCODE = 'TLNPD';
  END IF;
  IF coalesce(p_refund_amount_fcfa, 0) <= 0 OR p_refund_amount_fcfa > v_payment.amount_fcfa THEN
    RAISE EXCEPTION 'Montant de remboursement invalide.' USING ERRCODE = 'TLBAD';
  END IF;

  UPDATE public.mission_payments
     SET status = 'refunded', refunded_at = now()
   WHERE id = v_payment.id;

  -- Fonds encore bloqués : la ligne pending disparaît du wallet dev.
  -- Fonds déjà libérés : compensation sur la ligne disponible.
  IF EXISTS (
    SELECT 1 FROM public.earnings_ledger el
     WHERE el.mission_id = p_mission_id AND el.kind = 'pending'
  ) THEN
    DELETE FROM public.earnings_ledger
     WHERE mission_id = p_mission_id AND kind = 'pending';
  ELSE
    UPDATE public.earnings_ledger
       SET amount = amount - p_refund_amount_fcfa
     WHERE mission_id = p_mission_id AND kind = 'available';
    INSERT INTO public.earnings_ledger (developer_id, mission_id, amount_fcfa, kind, note)
    VALUES (v_m.developer_id, p_mission_id, -p_refund_amount_fcfa, 'refund',
            coalesce(p_note, 'Remboursement client'))
    ON CONFLICT (mission_id, kind) WHERE mission_id IS NOT NULL AND kind IN ('pending', 'available')
    DO NOTHING;
  END IF;

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

-- ------------------------------------------------------------
-- 2. Cron : appel correct (signature int×int, pas de timestamps).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.leaderboard_settle_month(p_year integer, p_month integer)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès administrateur requis.' USING ERRCODE = 'TLAUT';
  END IF;

  IF p_month < 1 OR p_month > 12 THEN
    RAISE EXCEPTION 'Mois invalide.' USING ERRCODE = 'TLEVL';
  END IF;

  v_result := public._leaderboard_settle(p_year, p_month);

  RETURN jsonb_build_object(
    'ok', true,
    'year', p_year,
    'month', p_month,
    'credited', coalesce((v_result->>'credited')::int, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.leaderboard_settle_month(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leaderboard_settle_month(integer, integer) TO authenticated;

-- ------------------------------------------------------------
-- 3. 50 points par projet terminé (classement).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._leaderboard_standings(p_year INT, p_month INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_start TIMESTAMPTZ := date_trunc('month', make_date(p_year, p_month, 1));
  v_end   TIMESTAMPTZ := date_trunc('month', make_date(p_year, p_month, 1) + INTERVAL '1 month');
  v_regional JSONB;
  v_countries JSONB;
BEGIN
  WITH scored AS (
    SELECT
      mm.developer_id,
      mm.cnt,
      COALESCE(NULLIF(trim(d.full_name), ''), d.username, d.id::text) AS full_name,
      d.username,
      d.city,
      d.avatar_url,
      COALESCE(trim(d.country), '') AS country
    FROM (
      SELECT m.developer_id, COUNT(*)::INT AS cnt
        FROM public.missions m
       WHERE m.status = 'completed'
         AND m.completed_at IS NOT NULL
         AND m.completed_at >= v_start
         AND m.completed_at <  v_end
       GROUP BY m.developer_id
    ) mm
    JOIN public.developers d ON d.id = mm.developer_id
    WHERE mm.cnt >= 2 -- leaderboard-config.minProjectsToAppear
  )
  SELECT COALESCE(jsonb_agg(jb ORDER BY (jb->>'rank')::INT ASC), '[]'::jsonb)
  INTO v_regional
  FROM (
    SELECT jsonb_build_object(
      'rank', row_number() OVER (ORDER BY cnt DESC, developer_id ASC),
      'developer_id', developer_id,
      'username', username,
      'full_name', full_name,
      'city', city,
      'country', country,
      'avatar_url', avatar_url,
      'completed_projects', cnt,
      'points', (cnt * 50)::INT
    ) AS jb
    FROM scored
  ) s;

  WITH scored AS (
    SELECT
      mm.developer_id,
      mm.cnt,
      COALESCE(NULLIF(trim(d.full_name), ''), d.username, d.id::text) AS full_name,
      d.username,
      d.city,
      d.avatar_url,
      COALESCE(trim(d.country), '') AS country
    FROM (
      SELECT m.developer_id, COUNT(*)::INT AS cnt
        FROM public.missions m
       WHERE m.status = 'completed'
         AND m.completed_at IS NOT NULL
         AND m.completed_at >= v_start
         AND m.completed_at <  v_end
       GROUP BY m.developer_id
    ) mm
    JOIN public.developers d ON d.id = mm.developer_id
    WHERE mm.cnt >= 2
  )
  SELECT COALESCE(jsonb_agg(jb ORDER BY jb->>'key' ASC), '[]'::jsonb)
  INTO v_countries
  FROM (
    SELECT jsonb_build_object(
      'key', s.country,
      'rows', (
        SELECT COALESCE(jsonb_agg(jb ORDER BY (jb->>'rank')::INT ASC), '[]'::jsonb)
        FROM (
          SELECT jsonb_build_object(
            'rank', row_number() OVER (ORDER BY cnt DESC, developer_id ASC),
            'developer_id', developer_id,
            'username', username,
            'full_name', full_name,
            'city', city,
            'country', country,
            'avatar_url', avatar_url,
            'completed_projects', cnt,
            'points', (cnt * 50)::INT
          ) AS jb
          FROM scored s2
          WHERE s2.country = s.country
        ) inner_rows
      )
    ) AS jb FROM (
      SELECT DISTINCT country FROM scored WHERE country <> ''
    ) s
  ) grp;

  RETURN jsonb_build_object(
    'regional', v_regional,
    'countries', v_countries
  );
END;
$$;

-- ------------------------------------------------------------
-- 4. get_leaderboard : points sur snapshot + config publiée.
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
              'points', (completed_projects * 50)::INT,
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
          'points', (completed_projects * 50)::INT,
          'tokens_awarded', tokens_awarded
        ) AS jb
        FROM public.leaderboard_monthly lbm
        LEFT JOIN public.developers d ON d.id = lbm.developer_id
        WHERE lbm.year = v_year AND lbm.month = v_month AND lbm.scope = 'regional'
      ) regional_rows;
    ELSE
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
      'points_per_project', 50,
      'rewards', jsonb_build_object(
        'regional', jsonb_build_object('1', 10, '2', 7, '3', 4)
      )
    ),
    'regional', v_regional,
    'countries', v_countries
  );
END;
$$;

COMMIT;
