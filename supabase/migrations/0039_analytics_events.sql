-- ============================================================
-- 0039_analytics_events.sql
-- P1 — Événements d'usage (§36). Écriture uniquement côté serveur
-- (service_role) : aucune donnée inventée, chaque ligne correspond
-- à une action RÉELLE constatée en base.
-- NON destructif.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Table analytic_events
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analytic_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID REFERENCES public.requests(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS analytic_events_created_idx ON public.analytic_events (created_at DESC);
CREATE INDEX IF NOT EXISTS analytic_events_name_idx ON public.analytic_events (event, created_at DESC);

ALTER TABLE public.analytic_events ENABLE ROW LEVEL SECURITY;

-- Pas de lecture publique (les tableaux de bord utilisent RPC service_role ou
-- l'admin). Écriture via track_event uniquement.

-- ------------------------------------------------------------
-- 2. RPC track_event : journal d'usage, écriture service_role only.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.track_event(
  p_event TEXT,
  p_actor_id UUID DEFAULT NULL,
  p_request_id UUID DEFAULT NULL,
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

  INSERT INTO public.analytic_events (event, actor_id, request_id, metadata)
  VALUES (p_event, p_actor_id, p_request_id, p_metadata);

  RETURN JSONB_BUILD_OBJECT('ok', TRUE, 'event', p_event);
END;
$$;

REVOKE ALL ON FUNCTION public.track_event(TEXT, UUID, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_event(TEXT, UUID, UUID, JSONB) TO service_role;

COMMIT;