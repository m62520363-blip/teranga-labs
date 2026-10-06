-- ============================================================
-- 0038_missions.sql
-- M3 — Workspace de mission (§22) : statut transactionnel,
-- états NEW → IN_PROGRESS → COMPLETED (→ DISPUTED / CANCELLED),
-- journal d'événements, création atomique depuis une offre acceptée.
-- NON destructif. Toutes les écritures passent par des RPC
-- SECURITY DEFINER : pas de bypass RLS possible.
-- ============================================================

BEGIN;

-- Fonction utilitaire updated_at (créée si absente — 0035 la
-- référence sans l'avoir créée, ce qui casse ses triggers).
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 1. Table missions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.requests(id) ON DELETE CASCADE NOT NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  offer_id UUID REFERENCES public.formal_offers(id) ON DELETE SET NULL,
  developer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'in_progress', 'completed', 'disputed', 'cancelled')),
  agreed_price_fcfa INTEGER NOT NULL CHECK (agreed_price_fcfa >= 1),
  agreed_days INTEGER NOT NULL CHECK (agreed_days >= 1),
  description TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS missions_developer_idx ON public.missions (developer_id, status);
CREATE INDEX IF NOT EXISTS missions_client_idx ON public.missions (client_id, status);
CREATE INDEX IF NOT EXISTS missions_request_idx ON public.missions (request_id);

CREATE TABLE IF NOT EXISTS public.mission_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status_from TEXT,
  status_to TEXT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mission_events_mission_idx ON public.mission_events (mission_id, created_at);

-- ------------------------------------------------------------
-- 2. RLS
-- ------------------------------------------------------------
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='missions' AND policyname='missions_participant_select') THEN
    CREATE POLICY "missions_participant_select"
      ON public.missions FOR SELECT
      TO authenticated
      USING (developer_id = auth.uid() OR client_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mission_events' AND policyname='mission_events_participant_select') THEN
    CREATE POLICY "mission_events_participant_select"
      ON public.mission_events FOR SELECT
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.missions m
         WHERE m.id = mission_events.mission_id
           AND (m.developer_id = auth.uid() OR m.client_id = auth.uid())
      ));
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3. RPC create_mission_from_offer : le CLIENT crée la mission
--    depuis une offre ACCEPTÉE. Atomique : mission + conversation
--    « awarded » + premier événement. Refus si l'offre est
--    pendante/rejetée ou si elle a déjà fondé une mission.
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
    agreed_price_fcfa, agreed_days, description
  ) VALUES (
    v_conv.request_id, v_conv.id, v_offer.id,
    v_offer.developer_id, v_user_id,
    v_offer.total_price_fcfa, v_offer.delivery_days, p_description
  ) RETURNING id INTO v_mission_id;

  UPDATE public.conversations SET status = 'awarded' WHERE id = v_conv.id;

  INSERT INTO public.mission_events (mission_id, actor_id, status_to, comment)
  VALUES (v_mission_id, v_user_id, 'new', 'Mission créée depuis une offre acceptée.');

  RETURN JSONB_BUILD_OBJECT(
    'mission_id', v_mission_id,
    'status', 'new',
    'developer_id', v_offer.developer_id
  );
END;
$$;

-- ------------------------------------------------------------
-- 4. RPC mission_update_status : machine à états avec garde-fous.
--    new→in_progress (développeur), in_progress→completed
--    (développeur), completed→disputed (client), new→cancelled
--    (client), in_progress→disputed (client), *→cancelled (client).
--    Journalise chaque transition.
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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLNAU';
  END IF;

  SELECT * INTO v_m FROM public.missions WHERE id = p_mission_id FOR UPDATE;
  IF v_m.id IS NULL THEN
    RAISE EXCEPTION 'Mission introuvable.' USING ERRCODE = 'TLNMI';
  END IF;

  v_from := v_m.status;

  -- Règles de transition.
  IF v_from = 'new' AND p_to_status = 'in_progress' AND v_m.developer_id = v_user_id THEN
    v_allowed := TRUE;
  ELSIF v_from = 'in_progress' AND p_to_status = 'completed' AND v_m.developer_id = v_user_id THEN
    v_allowed := TRUE;
  ELSIF v_from IN ('new', 'in_progress', 'completed') AND p_to_status = 'disputed' AND v_m.client_id = v_user_id THEN
    v_allowed := TRUE;
  ELSIF v_from IN ('new', 'in_progress') AND p_to_status = 'cancelled' AND v_m.client_id = v_user_id THEN
    v_allowed := TRUE;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Transition invalide.' USING ERRCODE = 'TLTRN';
  END IF;

  UPDATE public.missions
     SET status = p_to_status,
         started_at = CASE WHEN p_to_status = 'in_progress' THEN COALESCE(started_at, NOW()) ELSE started_at END,
         completed_at = CASE WHEN p_to_status = 'completed' THEN NOW() ELSE completed_at END
   WHERE id = p_mission_id;

  INSERT INTO public.mission_events (mission_id, actor_id, status_from, status_to, comment)
  VALUES (p_mission_id, v_user_id, v_from, p_to_status, p_comment);

  -- La confirmation côté client arrive via une transition
  -- completed→ completed confirmée (review), hors périmètre.
  RETURN JSONB_BUILD_OBJECT(
    'mission_id', p_mission_id,
    'status', p_to_status,
    'was', v_from
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_mission_from_offer(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_mission_from_offer(UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.mission_update_status(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mission_update_status(UUID, TEXT, TEXT) TO authenticated;

COMMIT;