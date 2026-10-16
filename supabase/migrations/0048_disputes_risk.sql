-- ============================================================
-- 0048_disputes_risk.sql
-- P4 — Clôture audit C11/§45/§48 : litige de mission + événements
-- de risque. NON destructif.
--
-- disputes : un litige est ouvert PAR une partie de la mission
-- (client ou développeur) contre l'autre. Statuts :
-- open → under_review → resolved | rejected (modération plus tard
-- via la console admin, service_role).
--
-- risk_events : journal d'incidents (tentatives d'usurpation,
-- paiements rejetés en rafale…), écriture service_role ONLY.
-- Aucune table risk_scores : le score se dérive d'un simple
-- count(*) sur les événements critiques — pas de valeur inventée.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Table disputes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  complainant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  respondent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'under_review', 'resolved', 'rejected')),
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS disputes_mission_idx ON public.disputes (mission_id);
CREATE INDEX IF NOT EXISTS disputes_status_idx ON public.disputes (status, created_at DESC);

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='disputes' AND policyname='disputes_select_parties') THEN
    CREATE POLICY "disputes_select_parties"
      ON public.disputes FOR SELECT
      TO authenticated
      USING (complainant_id = auth.uid() OR respondent_id = auth.uid());
  END IF;
END $$;

-- Écriture uniquement via les RPC ci-dessous (SECURITY DEFINER).

-- ------------------------------------------------------------
-- 2. RPC open_dispute : ouverture transactionnelle par un
--    participant de la mission, une seule dispute ouverte par
--    mission.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.open_dispute(
  p_mission_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_mission public.missions%ROWTYPE;
  v_reason TEXT := NULLIF(TRIM(COALESCE(p_reason, '')), '');
  v_respondent UUID;
  v_dispute_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;
  IF v_reason IS NULL OR LENGTH(v_reason) < 10 THEN
    RAISE EXCEPTION 'Motif trop court (10 caractères minimum).' USING ERRCODE = 'TLBAD';
  END IF;

  SELECT * INTO v_mission FROM public.missions WHERE id = p_mission_id FOR UPDATE;
  IF v_mission.id IS NULL THEN
    RAISE EXCEPTION 'Mission introuvable.' USING ERRCODE = 'TLNOS';
  END IF;

  IF v_mission.client_id = v_user THEN
    v_respondent := v_mission.developer_id;
  ELSIF v_mission.developer_id = v_user THEN
    v_respondent := v_mission.client_id;
  ELSE
    RAISE EXCEPTION 'Vous ne participez pas à cette mission.' USING ERRCODE = 'TLAUT';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.disputes
     WHERE mission_id = p_mission_id AND status IN ('open', 'under_review')
  ) THEN
    RAISE EXCEPTION 'Un litige est déjà ouvert sur cette mission.' USING ERRCODE = 'TLDUP';
  END IF;

  INSERT INTO public.disputes (mission_id, complainant_id, respondent_id, reason)
  VALUES (p_mission_id, v_user, v_respondent, v_reason)
  RETURNING id INTO v_dispute_id;

  RETURN JSONB_BUILD_OBJECT('id', v_dispute_id, 'status', 'open');
END;
$$;

-- ------------------------------------------------------------
-- 3. RPC list_my_disputes : mes litiges (demandeur ou défendeur).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_my_disputes()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;

  RETURN COALESCE((
    SELECT JSONB_AGG(d ORDER BY d.created_at DESC)
    FROM (
      SELECT di.id, di.mission_id, di.reason, di.status, di.resolution,
             di.created_at, di.resolved_at,
             (di.complainant_id = v_user) AS i_am_complainant
        FROM public.disputes di
       WHERE di.complainant_id = v_user OR di.respondent_id = v_user
    ) d
  ), '[]'::JSONB);
END;
$$;

-- ------------------------------------------------------------
-- 4. RPC set_dispute_status : modération (admin uniquement, garde
--    is_admin() dans le corps — pattern admin_set_sponsoring_prices).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_dispute_status(
  p_dispute_id UUID,
  p_status TEXT,
  p_resolution TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT := COALESCE(TRIM(COALESCE(p_status, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès administrateur requis.' USING ERRCODE = 'TLAUT';
  END IF;
  IF v_status NOT IN ('open', 'under_review', 'resolved', 'rejected') THEN
    RAISE EXCEPTION 'Statut invalide.' USING ERRCODE = 'TLBAD';
  END IF;

  UPDATE public.disputes
     SET status = v_status,
         resolution = COALESCE(p_resolution, resolution),
         resolved_at = CASE WHEN v_status IN ('resolved', 'rejected') THEN NOW() ELSE NULL END
   WHERE id = p_dispute_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Litige introuvable.' USING ERRCODE = 'TLNOD';
  END IF;

  RETURN JSONB_BUILD_OBJECT('id', p_dispute_id, 'status', v_status);
END;
$$;

REVOKE ALL ON FUNCTION public.open_dispute(UUID, TEXT) FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.open_dispute(UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.list_my_disputes() FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.list_my_disputes() TO authenticated;
REVOKE ALL ON FUNCTION public.set_dispute_status(UUID, TEXT, TEXT) FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.set_dispute_status(UUID, TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- 5. Table risk_events : écriture service_role ONLY (comme
--    track_event en 0039). Aucune policy : lecture console admin.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.risk_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'critical')),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS risk_events_user_idx ON public.risk_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS risk_events_severity_idx ON public.risk_events (severity, created_at DESC);

ALTER TABLE public.risk_events ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 6. RPC log_risk_event : écriture service_role only.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_risk_event(
  p_user_id UUID,
  p_event TEXT,
  p_severity TEXT DEFAULT 'info',
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Accès interdit.' USING ERRCODE = 'TLAAC';
  END IF;
  IF p_event IS NULL OR TRIM(p_event) = '' THEN
    RAISE EXCEPTION 'Événement manquant.' USING ERRCODE = 'TLEVM';
  END IF;

  INSERT INTO public.risk_events (user_id, event, severity, metadata)
  VALUES (p_user_id, p_event, COALESCE(p_severity, 'info'), COALESCE(p_metadata, '{}'::JSONB));

  RETURN JSONB_BUILD_OBJECT('ok', TRUE, 'event', p_event);
END;
$$;

REVOKE ALL ON FUNCTION public.log_risk_event(UUID, TEXT, TEXT, JSONB) FROM PUBLIC, ANON, AUTHENTICATED;
GRANT EXECUTE ON FUNCTION public.log_risk_event(UUID, TEXT, TEXT, JSONB) TO service_role;

COMMIT;