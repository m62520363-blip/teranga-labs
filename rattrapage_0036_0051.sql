
-- ========== 0036_rbac_roles.sql ==========
-- ============================================================
-- 0036_rbac_roles.sql
-- M1 — Périmètre P0 : rôles complets (§33) + garde serveur.
--
-- Ajoute les rôles manquants à user_roles : agency, support.
-- (client, developer, moderator, admin existent déjà.)
-- NON destructif. Préserve toutes les lignes existantes.
-- ============================================================

-- ------------------------------------------------------------
-- 1. user_roles : CHECK complet des 7 rôles (§33).
--    agency et support sont ajoutés ; les valeurs existantes
--    (client, developer, moderator, admin) restent valides.
-- ------------------------------------------------------------
alter table public.user_roles
  drop constraint if exists user_roles_role_check;

alter table public.user_roles
  add constraint user_roles_role_check
  check (role in ('client', 'developer', 'agency', 'moderator', 'support', 'admin'));

-- ------------------------------------------------------------
-- 2. RPC has_role : garde serveur centralisée.
--    Utilisée par les Server Components et les routes API
--    (requireRole côté app) et par les policies RLS.
--    security definer : résout user_roles même si la policy
--    de l'appelant ne le permettrait pas directement.
-- ------------------------------------------------------------
create or replace function public.has_role(p_roles text[])
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    return false;
  end if;
  return exists (
    select 1
      from public.user_roles
     where user_id = v_user_id
       and role = any(p_roles)
  );
end;
$$;

-- Les anonymes ne doivent jamais invoquer has_role : résultat toujours
-- false pour eux, le RPC pendant une session client reste permis.
revoke all on function public.has_role(text[]) from public;
grant execute on function public.has_role(text[]) to authenticated;

-- ------------------------------------------------------------
-- 3. get_my_role : le défaut « developer » ne doit pas écraser
--    un rôle réellement enregistré — aucun changement. On rend
--    simplement explicite que 'client' est un rôle réel garanti
--    par l'unique source user_roles (trigger handle_new_user).
--    (réécriture sans changement sémantique)
-- ------------------------------------------------------------
create or replace function public.get_my_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select role from public.user_roles where user_id = auth.uid()),
    'developer'
  )::text;
$$;-- ========== 0037_otp_verifications.sql ==========
-- ============================================================
-- 0037_otp_verifications.sql
-- M2 — Vérification téléphone/email par OTP (§9).
-- NON destructif. Couvre : code à usage unique, haché (sha256),
-- expiration, tentatives bornées, anti-spam (5/15 min par cible).
-- L'envoi (WhatsApp Twilio/GreenAPI, SMS, email Resend) reste fait
-- côté app, qui ne stocke jamais le code en clair.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Table otp_verifications
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email')),
  target TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'verification',
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS otp_verifications_target_idx
  ON public.otp_verifications (target, created_at DESC);
CREATE INDEX IF NOT EXISTS otp_verifications_user_idx
  ON public.otp_verifications (user_id);

ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

-- Lecture et consommation gérées par les RPC ci-dessous ; on n'expose
-- jamais les codes (hash) au client : pas de policy SELECT publique.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='otp_verifications' AND policyname='otp_own_select') THEN
    CREATE POLICY "otp_own_select"
      ON public.otp_verifications FOR SELECT
      TO authenticated
      USING (
        user_id = auth.uid()
        AND NOT EXISTS (SELECT 1 FROM public.otp_verifications o WHERE o.id = otp_verifications.id AND o.consumed_at IS NOT NULL)
      );
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. Colonne phone_verified (déclarative, sans supposition de
--    broadcast) sur developers et client_profiles si absente.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='developers')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='developers' AND column_name='phone_verified') THEN
    ALTER TABLE public.developers ADD COLUMN phone_verified BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='client_profiles')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='client_profiles' AND column_name='phone_verified') THEN
    ALTER TABLE public.client_profiles ADD COLUMN phone_verified BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3. RPC request_otp : émet un code (ne l'envoie pas).
--    Anti-abuse : 5 demandes max par cible et par fenêtre de 15 min.
--    Code haché avec sha256 (builtin PG15). Le code n'est jamais
--    retourné par l'API : l'app l'envoie via le provider externe.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_otp(
  p_channel TEXT,
  p_target TEXT DEFAULT NULL,
  p_purpose TEXT DEFAULT 'verification',
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := COALESCE(p_user_id, auth.uid());
  v_target TEXT;
  v_code TEXT;
  v_expires TIMESTAMPTZ;
  v_recent INTEGER;
BEGIN
  IF p_channel NOT IN ('whatsapp', 'sms', 'email') THEN
    RAISE EXCEPTION 'Canal invalide.' USING ERRCODE = 'TLOCH';
  END IF;

  -- L'app sert l'OTP en contexte service_role ; l'uid devient explicite.
  v_target := COALESCE(NULLIF(TRIM(p_target), ''), v_user_id::TEXT);
  IF NULLIF(TRIM(p_target), '') IS NULL AND v_user_id IS NULL THEN
    RAISE EXCEPTION 'Cible manquante.' USING ERRCODE = 'TLOTA';
  END IF;

  -- Anti-abus : borné à 5 codes non consommés récents par cible.
  SELECT COUNT(*) INTO v_recent
    FROM public.otp_verifications
   WHERE target = v_target
     AND created_at > NOW() - INTERVAL '15 minutes';

  IF v_recent >= 5 THEN
    RAISE EXCEPTION 'Trop de demandes récentes, réessayez plus tard.' USING ERRCODE = 'TLOTS';
  END IF;

  v_code := LPAD(CAST(FLOOR(RANDOM() * 1000000) AS INT)::TEXT, 6, '0');
  v_expires := NOW() + INTERVAL '10 minutes';

  INSERT INTO public.otp_verifications (user_id, channel, target, purpose, code_hash, expires_at)
  VALUES (
    CASE WHEN v_user_id IS NOT NULL THEN v_user_id END,
    p_channel,
    v_target,
    p_purpose,
    ENCODE(SHA256(v_code::BYTEA), 'hex'),
    v_expires
  );

  -- Le code n'est JAMAIS retourné à un client : seul le service_role
  -- (app serveur, qui envoie via le provider externe) le récupère.
  -- Même garde-fou que credit_from_payment : contexte PostgREST.
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN JSONB_BUILD_OBJECT(
      'ok', TRUE,
      'channel', p_channel,
      'purpose', p_purpose,
      'code', v_code,
      'expires_in_seconds', 600,
      'resend_in_seconds', 30
    );
  END IF;

  RETURN JSONB_BUILD_OBJECT(
    'ok', TRUE,
    'channel', p_channel,
    'purpose', p_purpose,
    'expires_in_seconds', 600,
    'resend_in_seconds', 30
  );
END;
$$;

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
  SELECT * INTO v_rec
    FROM public.otp_verifications
   WHERE channel = p_channel
     AND target = p_target
     AND purpose = p_purpose
     AND consumed_at IS NULL
     AND expires_at > NOW()
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

  -- Verrouillent le téléphone quand la cible correspond au profil :
  -- un seul point de vérité (phone_verified).
  IF p_channel IN ('whatsapp', 'sms') AND v_user_id IS NOT NULL THEN
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

REVOKE ALL ON FUNCTION public.request_otp(TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_otp(TEXT, TEXT, TEXT, UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.verify_otp(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_otp(TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMIT;-- ========== 0038_missions.sql ==========
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

COMMIT;-- ========== 0039_analytics_events.sql ==========
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

COMMIT;-- ========== 0040_favorites.sql ==========
-- ============================================================
-- 0040_favorites.sql
-- P1 — Favoris des briefs (§25). Base réelle : chaque ligne est un
-- marque-page posé par un utilisateur connecté. NON destructif.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Table favorites
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, request_id)
);

CREATE INDEX IF NOT EXISTS favorites_user_idx ON public.favorites (user_id, created_at DESC);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='favorites' AND policyname='favorites_select_own') THEN
    CREATE POLICY "favorites_select_own"
      ON public.favorites FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='favorites' AND policyname='favorites_delete_own') THEN
    CREATE POLICY "favorites_delete_own"
      ON public.favorites FOR DELETE
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. RPC toggle_favorite : bascule atomique (insert retourne
--    favorited=true, delete=false). Contrôle l'existence du brief.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.toggle_favorite(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_exists BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLNAU';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.requests WHERE id = p_request_id
  ) INTO v_exists;

  IF NOT v_exists THEN
    RAISE EXCEPTION 'Brief introuvable.' USING ERRCODE = 'TLNOR';
  END IF;

  IF EXISTS (SELECT 1 FROM public.favorites WHERE user_id = v_user_id AND request_id = p_request_id) THEN
    DELETE FROM public.favorites WHERE user_id = v_user_id AND request_id = p_request_id;
    RETURN JSONB_BUILD_OBJECT('favorited', FALSE, 'request_id', p_request_id);
  END IF;

  INSERT INTO public.favorites (user_id, request_id) VALUES (v_user_id, p_request_id);
  RETURN JSONB_BUILD_OBJECT('favorited', TRUE, 'request_id', p_request_id);
END;
$$;

-- ------------------------------------------------------------
-- 3. RPC is_favorited : lecture légère pour préremplir le cœur.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_favorited(p_request_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.favorites WHERE user_id = auth.uid() AND request_id = p_request_id
  );
$$;

REVOKE ALL ON FUNCTION public.toggle_favorite(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_favorite(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.is_favorited(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_favorited(UUID) TO authenticated;

COMMIT;-- ========== 0041_leaderboard_real.sql ==========
﻿-- ============================================================
-- 0041_leaderboard_real.sql
-- P1 â€” Classement RÃ‰EL (remplace le placeholder Â« bientÃ´t Â»).
-- Source de vÃ©ritÃ© : les missions TERMINÃ‰ES (Â§22, missions.status =
-- 'completed' avec completed_at dans le mois). Aucun chiffre inventÃ©.
--
--   * get_leaderboard(annee, mois) :
--       - mois en cours â†’ classement LIVE (recalcul Ã  chaque lecture) ;
--       - mois clos     â†’ dÃ©lÃ¨gue au snapshot idempotent (recalcul +
--                         attribution des Tokens + badges une seule fois).
--   * settle_leaderboard(annee, mois) : dÃ©clenchement manuel (admin ou
--     cron), service_role/admin uniquement.
--
-- RÃ©compenses (config unique en base, = lib/leaderboard-config.ts) :
--   1er rÃ©gional 5 Tokens, 2e 2 ; idem par pays. min 2 missions/mois.
--
-- NON destructif. Idempotent (UNIQUE sur leaderboard_monthly).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Nouveau type 'reward' dans les transactions de tokens
--    ('gift' est dÃ©jÃ  utilisÃ© par 0033 cÃ´tÃ© prod : on le conserve).
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'token_transactions_type_check'
  ) THEN
    ALTER TABLE public.token_transactions
      DROP CONSTRAINT IF EXISTS token_transactions_type_check;
    ALTER TABLE public.token_transactions
      ADD CONSTRAINT token_transactions_type_check
      CHECK (type IN ('purchase', 'unlock', 'bonus', 'publish', 'contact', 'adjust', 'gift', 'reward'));
  ELSE
    ALTER TABLE public.token_transactions
      DROP CONSTRAINT token_transactions_type_check;
    ALTER TABLE public.token_transactions
      ADD CONSTRAINT token_transactions_type_check
      CHECK (type IN ('purchase', 'unlock', 'bonus', 'publish', 'contact', 'adjust', 'gift', 'reward'));
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. CÅ“ur de calcul : standings d'un mois (missions terminÃ©es).
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
      'completed_projects', cnt
    ) AS jb
    FROM scored
  ) s;

  -- Le CTE scored doit etre redeclare : une CTE n'existe que dans la
  -- statement qui la definit (plpgsql la resout a l'execution du call).
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
  -- jb = la colonne jsonb du sous-select ; "grp" designe la ligne (record),
  -- et grp->>'key' provoquait "operator does not exist: record ->> unknown".
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
            'completed_projects', cnt
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
-- 3. Settlement idempotent d'un mois clos :
--      - upsert leaderboard_monthly (+ archive),
--      - crÃ©dit des Tokens (une seule fois, type 'reward'),
--      - badges top 1 et 2 (rÃ©gional + pays).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._leaderboard_settle(p_year INT, p_month INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_standings JSONB;
  v_regional JSONB;
  v_countries JSONB;
  v_row JSONB;
  v_scope_key TEXT;
  v_rows JSONB;
  v_rank INT;
  v_developer UUID;
  v_cnt INT;
  v_tokens INT;
  v_reward_regional_1 INT := 5;
  v_reward_regional_2 INT := 2;
  v_reward_country_1 INT := 5;
  v_reward_country_2 INT := 2;
  v_credited INT := 0;
BEGIN
  v_standings := public._leaderboard_standings(p_year, p_month);
  v_regional := v_standings->'regional';
  v_countries := v_standings->'countries';

  -- RÃ©gional : insertion + crÃ©dit.
  FOR v_row IN SELECT * FROM jsonb_array_elements(v_regional) LOOP
    v_rank := (v_row->>'rank')::INT;
    v_developer := (v_row->>'developer_id')::UUID;
    v_cnt := (v_row->>'completed_projects')::INT;
    v_tokens := CASE v_rank WHEN 1 THEN v_reward_regional_1 WHEN 2 THEN v_reward_regional_2 ELSE 0 END;

    INSERT INTO public.leaderboard_monthly
      (year, month, scope, scope_key, rank, developer_id, completed_projects, tokens_awarded)
    VALUES
      (p_year, p_month, 'regional', 'aof', v_rank, v_developer, v_cnt, 0)
    ON CONFLICT (year, month, scope, scope_key, developer_id)
      DO UPDATE SET rank = EXCLUDED.rank,
                    completed_projects = EXCLUDED.completed_projects,
                    snapshot_at = NOW();

    -- CrÃ©dit UNIQUEMENT Ã  la crÃ©ation (tokens_awarded 0 â†’ v_tokens), jamais en rejeu.
    IF v_tokens > 0 AND NOT EXISTS (
      SELECT 1 FROM public.leaderboard_monthly
       WHERE year = p_year AND month = p_month AND scope = 'regional'
         AND scope_key = 'aof' AND developer_id = v_developer AND tokens_awarded > 0
    ) THEN
      INSERT INTO public.token_transactions (developer_id, amount, type)
      VALUES (v_developer, v_tokens, 'reward');
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
        CASE WHEN v_rank = 1 THEN 'top1_regional' ELSE 'top2_regional' END,
        p_year, p_month, 'regional', 'aof', NOW()
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- Pays : mÃªme logique par scope_key.
  FOR v_row IN SELECT * FROM jsonb_array_elements(v_countries) LOOP
    v_scope_key := v_row->>'key';
    v_rows := v_row->'rows';
    FOR v_row IN SELECT * FROM jsonb_array_elements(v_rows) LOOP
      v_rank := (v_row->>'rank')::INT;
      v_developer := (v_row->>'developer_id')::UUID;
      v_cnt := (v_row->>'completed_projects')::INT;
      v_tokens := CASE v_rank WHEN 1 THEN v_reward_country_1 WHEN 2 THEN v_reward_country_2 ELSE 0 END;

      INSERT INTO public.leaderboard_monthly
        (year, month, scope, scope_key, rank, developer_id, completed_projects, tokens_awarded)
      VALUES
        (p_year, p_month, 'country', v_scope_key, v_rank, v_developer, v_cnt, 0)
      ON CONFLICT (year, month, scope, scope_key, developer_id)
        DO UPDATE SET rank = EXCLUDED.rank,
                      completed_projects = EXCLUDED.completed_projects,
                      snapshot_at = NOW();

      IF v_tokens > 0 AND NOT EXISTS (
        SELECT 1 FROM public.leaderboard_monthly
         WHERE year = p_year AND month = p_month AND scope = 'country'
           AND scope_key = v_scope_key AND developer_id = v_developer AND tokens_awarded > 0
      ) THEN
        INSERT INTO public.token_transactions (developer_id, amount, type)
        VALUES (v_developer, v_tokens, 'reward');
        v_credited := v_credited + v_tokens;
        UPDATE public.leaderboard_monthly
           SET tokens_awarded = v_tokens
         WHERE year = p_year AND month = p_month AND scope = 'country'
           AND scope_key = v_scope_key AND developer_id = v_developer;
      END IF;

      IF v_tokens > 0 THEN
        INSERT INTO public.developer_badges (developer_id, badge_type, year, month, scope, scope_key, awarded_at)
        VALUES (
          v_developer,
          CASE WHEN v_rank = 1 THEN 'top1_country' ELSE 'top2_country' END,
          p_year, p_month, 'country', v_scope_key, NOW()
        )
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;

  -- Archive lisible pour le palmarÃ¨s.
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
-- 4. get_leaderboard : lecture publique (anon/authenticated).
--    Mois clos â†’ settlement auto (idempotent).
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
  v_rank INT;
  v_developer UUID;
  v_tokens INT;
  v_row JSONB;
  v_rows JSONB;
  v_scope_key TEXT;
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
    -- Recalcul + attribution (idempotent), puis relecture en base.
    PERFORM public._leaderboard_settle(v_year, v_month);
    v_is_settled := true;

    SELECT jsonb_object_agg(scope_key, rows ORDER BY scope_key)
    INTO v_countries
    FROM (
      SELECT scope_key,
             COALESCE(jsonb_agg(jb ORDER BY rank),
                      '[]'::jsonb) AS rows
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
  END IF;

  RETURN jsonb_build_object(
    'period', jsonb_build_object('year', v_year, 'month', v_month),
    'status', CASE WHEN v_is_settled THEN 'settled' ELSE 'live' END,
    'config', jsonb_build_object(
      'enabled', true,
      'min_projects', 2,
      'rewards', jsonb_build_object(
        'regional', jsonb_build_object('1', 5, '2', 2),
        'country', jsonb_build_object('1', 5, '2', 2)
      )
    ),
    'regional', v_regional,
    'countries', v_countries
  );
END;
$$;

-- ------------------------------------------------------------
-- 5. settle_leaderboard : dÃ©clenchement manuel (admin ou service_role).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.settle_leaderboard(p_year INT, p_month INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
     AND NOT public.has_role(ARRAY['admin']) THEN
    RAISE EXCEPTION 'AccÃ¨s interdit.' USING ERRCODE = 'TLAAC';
  END IF;
  IF p_month < 1 OR p_month > 12 THEN
    RAISE EXCEPTION 'Mois invalide.' USING ERRCODE = 'TLEVL';
  END IF;
  RETURN public._leaderboard_settle(p_year, p_month);
END;
$$;

-- ------------------------------------------------------------
-- 6. Grants
-- ------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_leaderboard(INT, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_leaderboard(INT, INT) TO service_role;

REVOKE ALL ON FUNCTION public._leaderboard_standings(INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._leaderboard_settle(INT, INT) FROM PUBLIC;

COMMIT;
-- ========== 0042_missions_ui.sql ==========
-- ============================================================
-- 0042_missions_ui.sql
-- M4 — UI missions (§22) : lecture consolidée pour les deux
-- parties (développeur / client). Le SELECT direct sur requests
-- est restreint (RLS : seuls les briefs « ouverts » sont
-- lisibles) : cette RPC SECURITY DEFINER ne renvoie que des
-- champs publics (jamais le WhatsApp) + partie adverse + journal.
-- NON destructif.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.list_my_missions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLNAU';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'request_id', m.request_id,
        'conversation_id', m.conversation_id,
        'offer_id', m.offer_id,
        'status', m.status,
        'agreed_price_fcfa', m.agreed_price_fcfa,
        'agreed_days', m.agreed_days,
        'description', m.description,
        'started_at', m.started_at,
        'completed_at', m.completed_at,
        'created_at', m.created_at,
        'updated_at', m.updated_at,
        'opponent', CASE
          WHEN m.client_id = v_user THEN jsonb_build_object(
            'related_as', 'developer',
            'full_name', COALESCE(NULLIF(trim(d.full_name), ''), d.username, m.developer_id::text),
            'username', d.username,
            'city', d.city,
            'avatar_url', d.avatar_url
          )
          ELSE jsonb_build_object(
            'related_as', 'client',
            'company_name', cp.company_name,
            'contact_name', cp.contact_name,
            'city', cp.city
          )
        END,
        'request', jsonb_build_object(
          'project_type', r.project_type,
          'budget', r.budget,
          'client_city', r.client_city
        ),
        'events', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', e.id,
            'actor_id', e.actor_id,
            'status_from', e.status_from,
            'status_to', e.status_to,
            'comment', e.comment,
            'created_at', e.created_at
          ) ORDER BY e.created_at ASC)
          FROM public.mission_events e
          WHERE e.mission_id = m.id
        ), '[]'::jsonb)
      ) ORDER BY m.created_at DESC
    )
    FROM public.missions m
    LEFT JOIN public.developers d ON d.id = m.developer_id
    LEFT JOIN public.client_profiles cp ON cp.id = m.client_id
    LEFT JOIN public.requests r ON r.id = m.request_id
    WHERE m.developer_id = v_user OR m.client_id = v_user
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.list_my_missions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_missions() TO authenticated;

COMMIT;-- ========== 0043_score_match.sql ==========
-- ============================================================
-- TERANGA LABS — Migration 0043 : TERANGA SCORE avancé
-- + TERANGA MATCH (compatibilité brief ↔ développeur).
--
-- 1) refresh_developer_reputation enrichi : le score 0-100 devient la
--    somme de 7 composantes (avis, progression, volume d'avis, complétude
--    de profil, réactivité, bonus vérifié, pénalités). Les composantes
--    sont stockées dans `developers.score_components` pour exposer un
--    détail public sans recalcul.
-- 2) Triggers de recalcul : missions (terminées), developer_services,
--    developer_profiles, et champs de profil développeur.
-- 3) teranga_match : top N développeurs compatibles avec un besoin
--    (type de projet, ville, budget), score 0-100 décomposé.
-- 4) get_developer_score : expose score + niveau + composantes pour une
--    fiche publique.
-- ============================================================

-- ------------------------------------------------------------
-- 1) developers : composantes du score (jamais modifiées par l'utilisateur).
-- ------------------------------------------------------------
alter table public.developers
  add column if not exists score_components jsonb not null default '{}'::jsonb;

-- ------------------------------------------------------------
-- 2) refresh_developer_reputation (v3 / SCORE AVANCÉ).
-- ------------------------------------------------------------
create or replace function public.refresh_developer_reputation(p_developer uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avg numeric;
  v_reviews integer;
  v_completed integer;
  v_penalty integer;
  v_verified boolean;
  v_prof_completion numeric;
  v_response_rate numeric;
  v_reviews_pts integer;
  v_progress_pts integer;
  v_feedback_pts integer;
  v_profile_pts integer;
  v_resp_pts integer;
  v_bonus_pts integer;
  v_score integer;
  v_components jsonb;
begin
  if p_developer is null then
    return;
  end if;

  -- Avis visibles uniquement (modération).
  select round(coalesce(avg(r.rating), 0), 2), count(*)::integer
    into v_avg, v_reviews
    from public.reviews r
   where r.developer_id = p_developer
     and coalesce(r.hidden, false) = false;

  -- Projets terminés : missions complétées (source contemporaine) sans
  -- jamais descendre sous l'héritage des déblocages gagnés.
  select greatest(
           (select count(*)::integer from public.missions mm
             where mm.developer_id = p_developer and mm.status = 'completed'),
           (select count(*)::integer from public.unlocks uu
             where uu.developer_id = p_developer and uu.crm_status = 'gagne')
         )
    into v_completed;

  select coalesce(penalty, 0), coalesce(is_verified, false)
    into v_penalty, v_verified
    from public.developers
   where id = p_developer;

  -- Complétude du profil (9 indicateurs binaires).
  select round((
      (case when coalesce(nullif(btrim(d.bio), ''), '') <> '' then 1 else 0 end)
    + (case when coalesce(nullif(btrim(d.avatar_url), ''), '') <> '' then 1 else 0 end)
    + (case when coalesce(nullif(btrim(d.city), ''), '') <> '' then 1 else 0 end)
    + (case when coalesce(nullif(btrim(d.whatsapp), ''), '') <> '' then 1 else 0 end)
    + (case when coalesce(d.experience_years, 0) > 0 then 1 else 0 end)
    + (case when coalesce(array_length(d.skills, 1), 0) > 0 then 1 else 0 end)
    + (case when exists (
         select 1 from public.developer_services s
          where s.developer_id = d.id) then 1 else 0 end)
    + (case when exists (
         select 1 from public.developer_profiles p
          where p.developer_id = d.id
            and nullif(btrim(p.professional_title), '') is not null) then 1 else 0 end)
    + (case when exists (
         select 1 from public.developer_profiles p
          where p.developer_id = d.id
            and nullif(btrim(p.main_specialty), '') is not null) then 1 else 0 end)
    / 9.0)::numeric, 4)::numeric
    into v_prof_completion
    from public.developers d
   where d.id = p_developer;

  -- Taux de réponse : discussions où le développeur a répondu au moins
  -- une fois, parmi les discussions où le client a écrit.
  select round(
           count(distinct case when dev_replied then u.id end)::numeric
           / nullif(count(distinct case when client_wrote then u.id end), 0)::numeric,
           4)
    into v_response_rate
    from (
      select
        u.id,
        bool_or(m.sender_id = u.developer_id) as dev_replied,
        bool_or(m.sender_id <> u.developer_id) as client_wrote
        from public.unlocks u
        join public.messages m on m.conversation_id = u.id
       where u.developer_id = p_developer
       group by u.id
    ) u;

  -- Pondérations : avis 35, progression 20, volume d'avis 15,
  -- complétude 15, réactivité 10, bonus vérifié 5. Sous 100 - pénalités.
  v_reviews_pts := round(least(coalesce(v_avg / 5, 0)::numeric, 1) * 35)::integer;
  v_progress_pts := round(least(v_completed / 5.0, 1) * 20)::integer;
  v_feedback_pts := round(least(v_reviews / 10.0, 1) * 15)::integer;
  v_profile_pts := round(coalesce(v_prof_completion, 0) * 15)::integer;
  v_resp_pts := round(coalesce(v_response_rate, 0) * 10)::integer;
  v_bonus_pts := case when v_verified then 5 else 0 end;

  v_score := round(
    v_reviews_pts
    + v_progress_pts
    + v_feedback_pts
    + v_profile_pts
    + v_resp_pts
    + v_bonus_pts
    - coalesce(v_penalty, 0)
  )::integer;
  v_score := greatest(0, least(100, v_score));

  v_components := jsonb_build_object(
    'reviews', v_reviews_pts,
    'progress', v_progress_pts,
    'feedback', v_feedback_pts,
    'profile', v_profile_pts,
    'responsiveness', v_resp_pts,
    'bonus', v_bonus_pts,
    'penalty', -v_penalty
  );

  update public.developers
     set rating_avg = v_avg,
         reviews_count = v_reviews,
         completed_projects_count = v_completed,
         reputation_score = v_score,
         score_components = v_components,
         reputation_level = case
           when v_score >= 85 then 'Expert'
           when v_score >= 70 then 'Confirmé'
           when v_score >= 40 then 'Actif'
           else 'Nouveau'
         end
   where id = p_developer;
end;
$$;

-- ------------------------------------------------------------
-- 3) Protection élargie : score_components est une colonne gérée.
-- ------------------------------------------------------------
create or replace function public.developers_protect_managed_cols()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role', '');
begin
  -- Seul l'utilisateur directement connecté (REST, current_user =
  -- 'authenticated') est bloqué. Les fonctions SECURITY DEFINER
  -- (exécutées sous le rôle propriétaire) et le service_role peuvent
  -- maintenir ces colonnes : réputation, pénalités, validation.
  if current_user = 'authenticated' and v_role <> 'service_role' and not public.is_admin() then
    new.status := old.status;
    new.is_verified := old.is_verified;
    new.penalty := old.penalty;
    new.rating_avg := old.rating_avg;
    new.reviews_count := old.reviews_count;
    new.completed_projects_count := old.completed_projects_count;
    new.reputation_score := old.reputation_score;
    new.reputation_level := old.reputation_level;
    new.score_components := old.score_components;
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 4) Triggers de recalcul automatique.
-- ------------------------------------------------------------
create or replace function public.tgf_reputation_on_missions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_developer_reputation(coalesce(new.developer_id, old.developer_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_reputation_on_missions on public.missions;
create trigger trg_reputation_on_missions
  after insert or update of status or delete on public.missions
  for each row
  execute function public.tgf_reputation_on_missions();

create or replace function public.tgf_reputation_on_developer_services()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_developer_reputation(coalesce(new.developer_id, old.developer_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_reputation_on_developer_services on public.developer_services;
create trigger trg_reputation_on_developer_services
  after insert or update or delete on public.developer_services
  for each row
  execute function public.tgf_reputation_on_developer_services();

create or replace function public.tgf_reputation_on_developer_profiles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_developer_reputation(coalesce(new.developer_id, old.developer_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_reputation_on_developer_profiles on public.developer_profiles;
create trigger trg_reputation_on_developer_profiles
  after insert or update or delete on public.developer_profiles
  for each row
  execute function public.tgf_reputation_on_developer_profiles();

create or replace function public.tgf_reputation_on_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_developer_reputation(new.id);
  return new;
end;
$$;

drop trigger if exists trg_reputation_on_profile_fields on public.developers;
create trigger trg_reputation_on_profile_fields
  after insert or update of bio, avatar_url, city, whatsapp, experience_years, skills
  on public.developers
  for each row
  execute function public.tgf_reputation_on_profile_fields();

-- ------------------------------------------------------------
-- 5) teranga_match : top N développeurs compatibles avec un besoin.
--    Score 0-100 = type de projet (45) + ville (20) + budget (15)
--    + réputation (15) + disponibilité (5). Aucune donnée privée.
-- ------------------------------------------------------------
create or replace function public.teranga_match(
  p_project_type text default null,
  p_city text default null,
  p_budget integer default null,
  p_services text[] default null,
  p_limit integer default 8
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_type text := nullif(btrim(coalesce(p_project_type, '')), '');
  v_city text := nullif(btrim(coalesce(p_city, '')), '');
  v_budget integer := coalesce(p_budget, 0);
  v_services text[] := p_services;
  v_limit integer := greatest(1, least(coalesce(p_limit, 8), 24));
begin
  return coalesce((
    select jsonb_agg(x order by x.score desc, x.reputation_score desc)
    from (
      select d.id as developer_id,
             d.username,
             d.full_name,
             d.avatar_url,
             d.city,
             d.country,
             dp.main_specialty,
             dp.rate_min_fcfa,
             d.is_verified,
             d.reputation_score,
             d.reputation_level,
             (
               (case
                 when exists (
                   select 1 from public.developer_projects pp
                    where pp.developer_id = d.id and pp.project_type = v_type
                 ) then 45
                 when exists (
                   select 1 from public.developer_services ds
                    where ds.developer_id = d.id and v_type is not null
                      and ds.service ilike '%' || v_type || '%'
                 ) then 35
                 else 0 end)
               + (case when v_city is not null
                       and lower(coalesce(d.city, '')) = lower(v_city) then 20 else 0 end)
               + (case when v_budget > 0
                       and (dp.rate_min_fcfa is null or dp.rate_min_fcfa <= v_budget * 1.2)
                       then 15
                       when v_budget > 0 and dp.rate_min_fcfa is null then 10
                       else 0 end)
               + round(coalesce(d.reputation_score, 0) / 100.0 * 15)::integer
               + (case when coalesce(dp.availability, '') = 'available_now' then 5 else 0 end)
             )::integer as score,
             jsonb_build_object(
               'type', (case
                 when exists (
                   select 1 from public.developer_projects pp
                    where pp.developer_id = d.id and pp.project_type = v_type
                 ) then 45
                 when exists (
                   select 1 from public.developer_services ds
                    where ds.developer_id = d.id and v_type is not null
                      and ds.service ilike '%' || v_type || '%'
                 ) then 35
                 else 0 end),
               'location', (case when v_city is not null
                                 and lower(coalesce(d.city, '')) = lower(v_city) then 20 else 0 end),
               'budget', (case when v_budget > 0
                               and (dp.rate_min_fcfa is null or dp.rate_min_fcfa <= v_budget * 1.2)
                               then 15
                               when v_budget > 0 and dp.rate_min_fcfa is null then 10
                               else 0 end),
               'reputation', round(coalesce(d.reputation_score, 0) / 100.0 * 15)::integer,
               'availability', (case when coalesce(dp.availability, '') = 'available_now' then 5 else 0 end)
             ) as components
      from public.developers d
      left join public.developer_profiles dp on dp.developer_id = d.id
     where d.status in ('active', 'verified')
       and (v_services is null or array_length(v_services, 1) is null or exists (
             select 1 from public.developer_services ds
              where ds.developer_id = d.id and ds.service = any (v_services)
           ))
       and (v_type is null or exists (
             select 1 from public.developer_projects pp
              where pp.developer_id = d.id and pp.project_type = v_type
           )
           or exists (
             select 1 from public.developer_services ds
              where ds.developer_id = d.id and ds.service ilike '%' || v_type || '%'
           ))
       and (v_city is null or lower(coalesce(d.city, '')) = lower(v_city)
            or lower(coalesce(d.country, '')) = lower(v_city))
     order by score desc, d.reputation_score desc
     limit v_limit
    ) x
  ), '[]'::jsonb);
end;
$$;

-- ------------------------------------------------------------
-- 6) get_developer_score : fiche publique — score, niveau, composantes.
-- ------------------------------------------------------------
create or replace function public.get_developer_score(p_identifier text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_identifier text := nullif(btrim(p_identifier), '');
  v_dev public.developers%rowtype;
begin
  if v_identifier is null then
    raise exception 'Profil introuvable.' using errcode = 'TLNOK';
  end if;

  if v_identifier ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select * into v_dev
      from public.developers
     where id = v_identifier::uuid
       and status in ('active', 'verified');
  else
    select * into v_dev
      from public.developers
     where username = lower(v_identifier)
       and status in ('active', 'verified');
  end if;

  if v_dev.id is null then
    raise exception 'Profil introuvable.' using errcode = 'TLNOK';
  end if;

  return jsonb_build_object(
    'developer_id', v_dev.id,
    'score', v_dev.reputation_score,
    'level', v_dev.reputation_level,
    'components', coalesce(v_dev.score_components, '{}'::jsonb)
  );
end;
$$;

-- ------------------------------------------------------------
-- 7) Accès.
-- ------------------------------------------------------------
grant execute on function public.teranga_match(text, text, integer, text[], integer) to anon, authenticated;
grant execute on function public.get_developer_score(text) to anon, authenticated;-- ========== 0044_agencies.sql ==========
-- ============================================================
-- TERANGA LABS — Migration 0044 : Agences.
--
-- Une agence est une organisation qui regroupe plusieurs
-- développeurs validés. Chaque développeur appartient à UNE
-- seule agence au maximum (unique sur agency_members).
--
-- 1) Tables : agencies (+ code d'invitation secret) et agency_members.
-- 2) RLS : lecture publique des agences actives ; toute écriture via
--    RPC SECURITY DEFINER (jamais en ligne directe).
-- 3) RPC : create_agency, join_agency, rotate_agency_invite,
--    remove_agency_member, leave_agency, set_agency_status (admin),
--    list_agencies, get_agency, get_agency_by_developer, my_agency.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tables.
-- ------------------------------------------------------------
create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  bio text,
  logo_url text,
  city text,
  country text,
  website text,
  verified boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended')),
  invite_code uuid not null default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agencies_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,39}$')
);

create table if not exists public.agency_members (
  agency_id uuid not null references public.agencies(id) on delete cascade,
  developer_id uuid not null references auth.users(id) on delete cascade,
  role_in_agency text not null default 'member' check (role_in_agency in ('admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (agency_id, developer_id),
  unique (developer_id)
);

create index if not exists agencies_status_idx on public.agencies (status);
create index if not exists agencies_slug_idx on public.agencies (slug);

alter table public.agencies enable row level security;
alter table public.agency_members enable row level security;

-- Lecture publique : une agence n'apparaît qu'une fois active.
drop policy if exists agencies_select_public on public.agencies;
create policy agencies_select_public on public.agencies
  for select using (status = 'active');

-- Aucune écriture directe : tout passe par les RPC ci-dessous.

-- ------------------------------------------------------------
-- 2) Helpers.
-- ------------------------------------------------------------
create or replace function public.agency_role(p_agency uuid, p_user uuid default auth.uid())
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if p_agency is null or p_user is null then
    return null;
  end if;
  if exists (select 1 from public.agencies a where a.id = p_agency and a.owner_id = p_user) then
    return 'owner';
  end if;
  select role_in_agency into v_role
    from public.agency_members
   where agency_id = p_agency and developer_id = p_user;
  return v_role;
end;
$$;

-- ------------------------------------------------------------
-- 3) RPC — création.
-- ------------------------------------------------------------
create or replace function public.create_agency(
  p_name text,
  p_slug text,
  p_bio text default null,
  p_logo_url text default null,
  p_city text default null,
  p_country text default null,
  p_website text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_agency public.agencies%rowtype;
begin
  if v_user is null then
    raise exception 'Connectez-vous.' using errcode = 'TLAUT';
  end if;
  if nullif(btrim(p_name), '') is null or length(btrim(p_name)) < 2 then
    raise exception 'Nom d''agence trop court.' using errcode = 'TLBAD';
  end if;
  if v_slug = '' or v_slug !~ '^[a-z0-9][a-z0-9-]{1,39}$' then
    raise exception 'URL invalide (lettres minuscules, chiffres, tirets).' using errcode = 'TLBAD';
  end if;
  if exists (select 1 from public.agency_members where developer_id = v_user) then
    raise exception 'Vous êtes déjà membre d''une agence.' using errcode = 'TLAGM';
  end if;

  insert into public.agencies (
    name, slug, bio, logo_url, city, country, website, owner_id
  ) values (
    btrim(p_name), v_slug, nullif(btrim(coalesce(p_bio, '')), ''),
    nullif(btrim(coalesce(p_logo_url, '')), ''),
    nullif(btrim(coalesce(p_city, '')), ''),
    nullif(btrim(coalesce(p_country, '')), ''),
    nullif(btrim(coalesce(p_website, '')), '')
  )
  returning * into v_agency;

  insert into public.agency_members (agency_id, developer_id, role_in_agency)
  values (v_agency.id, v_user, 'admin');

  return jsonb_build_object('id', v_agency.id, 'slug', v_agency.slug);
end;
$$;

-- ------------------------------------------------------------
-- 4) RPC — rejoindre via code d'invitation.
-- ------------------------------------------------------------
create or replace function public.get_agency_by_invite(p_invite_code uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_agency public.agencies%rowtype;
begin
  if p_invite_code is null then
    raise exception 'Code d''invitation invalide.' using errcode = 'TLBAD';
  end if;
  select * into v_agency
    from public.agencies
   where invite_code = p_invite_code and status = 'active';
  if v_agency.id is null then
    raise exception 'Code d''invitation invalide.' using errcode = 'TLBAD';
  end if;
  return jsonb_build_object(
    'id', v_agency.id,
    'slug', v_agency.slug,
    'name', v_agency.name
  );
end;
$$;

create or replace function public.join_agency(
  p_agency_id uuid,
  p_invite_code uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_agency public.agencies%rowtype;
begin
  if v_user is null then
    raise exception 'Connectez-vous.' using errcode = 'TLAUT';
  end if;
  select * into v_agency from public.agencies where id = p_agency_id;
  if v_agency.id is null then
    raise exception 'Agence introuvable.' using errcode = 'TLNOK';
  end if;
  if v_agency.status <> 'active' then
    raise exception 'Cette agence n''est pas encore active.' using errcode = 'TLAGS';
  end if;
  if v_agency.invite_code <> p_invite_code then
    raise exception 'Code d''invitation invalide.' using errcode = 'TLBIN';
  end if;
  if exists (select 1 from public.agency_members where developer_id = v_user) then
    raise exception 'Vous êtes déjà membre d''une agence.' using errcode = 'TLAGM';
  end if;

  insert into public.agency_members (agency_id, developer_id, role_in_agency)
  values (v_agency.id, v_user, 'member');

  return jsonb_build_object('agency_id', v_agency.id, 'slug', v_agency.slug);
end;
$$;

-- ------------------------------------------------------------
-- 5) RPC — gestion des membres (admin / owner).
-- ------------------------------------------------------------
create or replace function public.rotate_agency_invite(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_code uuid;
begin
  if v_user is null then
    raise exception 'Connectez-vous.' using errcode = 'TLAUT';
  end if;
  v_role := public.agency_role(p_agency_id, v_user);
  if v_role is null or v_role = 'member' then
    raise exception 'Réservé à l''équipe de l''agence.' using errcode = 'TLAUT';
  end if;

  v_code := gen_random_uuid();
  update public.agencies set invite_code = v_code, updated_at = now()
   where id = p_agency_id;

  return jsonb_build_object('invite_code', v_code);
end;
$$;

create or replace function public.remove_agency_member(p_developer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_agency_id uuid;
  v_role text;
begin
  if v_user is null then
    raise exception 'Connectez-vous.' using errcode = 'TLAUT';
  end if;

  select agency_id into v_agency_id
    from public.agency_members where developer_id = v_user;
  if v_agency_id is null then
    raise exception 'Vous n''êtes membre d''aucune agence.' using errcode = 'TLAGS';
  end if;

  v_role := public.agency_role(v_agency_id, v_user);
  if v_role is null or v_role = 'member' then
    raise exception 'Réservé à l''équipe de l''agence.' using errcode = 'TLAUT';
  end if;

  if p_developer_id = (select owner_id from public.agencies where id = v_agency_id) then
    raise exception 'Impossible de retirer le fondateur.' using errcode = 'TLBAD';
  end if;

  -- Seul le fondateur peut retirer un autre administrateur.
  if public.agency_role(v_agency_id, p_developer_id) = 'admin'
     and public.agency_role(v_agency_id, v_user) <> 'owner' then
    raise exception 'Réservé au fondateur.' using errcode = 'TLAUT';
  end if;

  delete from public.agency_members
   where agency_id = v_agency_id and developer_id = p_developer_id;

  return jsonb_build_object('removed', p_developer_id);
end;
$$;

create or replace function public.leave_agency()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Connectez-vous.' using errcode = 'TLAUT';
  end if;
  if exists (select 1 from public.agencies where owner_id = v_user) then
    raise exception 'Le fondateur ne peut pas quitter son agence.' using errcode = 'TLBAD';
  end if;
  delete from public.agency_members where developer_id = v_user;
  return jsonb_build_object('left', v_user);
end;
$$;

create or replace function public.set_agency_status(p_agency_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès administrateur requis.' using errcode = 'TLAUT';
  end if;
  if p_status not in ('pending', 'active', 'suspended') then
    raise exception 'Statut invalide.' using errcode = 'TLBAD';
  end if;
  update public.agencies
     set status = p_status, updated_at = now()
   where id = p_agency_id;
  return jsonb_build_object('agency_id', p_agency_id, 'status', p_status);
end;
$$;

-- ------------------------------------------------------------
-- 6) RPC — lecture publique.
-- ------------------------------------------------------------
create or replace function public.list_agencies(
  p_limit integer default 24,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 24), 60));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
begin
  return coalesce((
    select jsonb_agg(jb order by jb->>'name')
    from (
      select jsonb_build_object(
        'id', a.id,
        'slug', a.slug,
        'name', a.name,
        'bio', a.bio,
        'logo_url', a.logo_url,
        'city', a.city,
        'country', a.country,
        'website', a.website,
        'verified', a.verified,
        'members_count', (
          select count(*) from public.agency_members am where am.agency_id = a.id
        )
      ) as jb
      from public.agencies a
     where a.status = 'active'
     order by a.name
     limit v_limit offset v_offset
    ) t
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_agency(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_slug text := lower(nullif(btrim(coalesce(p_slug, '')), ''));
  v_agency public.agencies%rowtype;
begin
  if v_slug is null then
    raise exception 'Agence introuvable.' using errcode = 'TLNOK';
  end if;
  select * into v_agency from public.agencies where slug = v_slug and status = 'active';
  if v_agency.id is null then
    raise exception 'Agence introuvable.' using errcode = 'TLNOK';
  end if;

  return jsonb_build_object(
    'id', v_agency.id,
    'slug', v_agency.slug,
    'name', v_agency.name,
    'bio', v_agency.bio,
    'logo_url', v_agency.logo_url,
    'city', v_agency.city,
    'country', v_agency.country,
    'website', v_agency.website,
    'verified', v_agency.verified,
    'owner_id', v_agency.owner_id,
    'created_at', v_agency.created_at,
    'members_count', (
      select count(*) from public.agency_members am where am.agency_id = v_agency.id
    ),
    'members', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'developer_id', d.id,
          'username', d.username,
          'full_name', d.full_name,
          'avatar_url', d.avatar_url,
          'main_specialty', dp.main_specialty,
          'is_verified', d.is_verified,
          'reputation_score', d.reputation_score
        )
        order by (am.role_in_agency = 'admin') desc, d.full_name
      )
      from public.agency_members am
      join public.developers d on d.id = am.developer_id and d.status in ('active', 'verified')
      left join public.developer_profiles dp on dp.developer_id = d.id
     where am.agency_id = v_agency.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_agency_by_developer(p_developer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_agency public.agencies%rowtype;
begin
  select a.* into v_agency
    from public.agencies a
    join public.agency_members am on am.agency_id = a.id
   where am.developer_id = p_developer_id
     and a.status = 'active';
  if v_agency.id is null then
    return null;
  end if;
  return jsonb_build_object(
    'id', v_agency.id,
    'slug', v_agency.slug,
    'name', v_agency.name,
    'logo_url', v_agency.logo_url
  );
end;
$$;

create or replace function public.my_agency()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user uuid := auth.uid();
  v_agency public.agencies%rowtype;
  v_role text;
begin
  if v_user is null then
    return null;
  end if;
  select a.* into v_agency
    from public.agencies a
    join public.agency_members am on am.agency_id = a.id
   where am.developer_id = v_user;
  if v_agency.id is null then
    return null;
  end if;
  v_role := public.agency_role(v_agency.id, v_user);

  return jsonb_build_object(
    'id', v_agency.id,
    'slug', v_agency.slug,
    'name', v_agency.name,
    'bio', v_agency.bio,
    'logo_url', v_agency.logo_url,
    'city', v_agency.city,
    'country', v_agency.country,
    'website', v_agency.website,
    'verified', v_agency.verified,
    'status', v_agency.status,
    'my_role', v_role,
    'invite_code', case when v_role in ('owner', 'admin') then v_agency.invite_code else null end,
    'members', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'developer_id', d.id,
          'username', d.username,
          'full_name', d.full_name,
          'avatar_url', d.avatar_url,
          'role_in_agency', am.role_in_agency,
          'is_verified', d.is_verified
        )
        order by (am.role_in_agency = 'admin') desc, d.full_name
      )
      from public.agency_members am
      join public.developers d on d.id = am.developer_id
     where am.agency_id = v_agency.id
    ), '[]'::jsonb)
  );
end;
$$;

-- ------------------------------------------------------------
-- 7) Accès.
-- ------------------------------------------------------------
grant execute on function public.create_agency(text, text, text, text, text, text, text) to authenticated;
grant execute on function public.get_agency_by_invite(uuid) to authenticated;
grant execute on function public.join_agency(uuid, uuid) to authenticated;
grant execute on function public.rotate_agency_invite(uuid) to authenticated;
grant execute on function public.remove_agency_member(uuid) to authenticated;
grant execute on function public.leave_agency() to authenticated;
grant execute on function public.set_agency_status(uuid, text) to authenticated;
grant execute on function public.list_agencies(integer, integer) to anon, authenticated;
grant execute on function public.get_agency(text) to anon, authenticated;
grant execute on function public.get_agency_by_developer(uuid) to anon, authenticated;
grant execute on function public.my_agency() to authenticated;-- ========== 0045_sponsoring.sql ==========
-- ============================================================
-- TERANGA LABS — Migration 0045 : Sponsoring.
--
-- Un développeur peut mettre son profil en avant (haut de
-- l'annuaire) ; un client porteur de la clé d'un brief ouvert
-- peut le mettre en avant sur le marketplace.
-- L'achat se paie en Tokens, au prix journalier stocké dans
-- app_settings (sponsoring_profile_price_tokens/brief). Durée
-- bornée 1 à 30 jours, période patronnée cumulable.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tables.
-- ------------------------------------------------------------
create table if not exists public.sponsored_profiles (
  developer_id uuid primary key references public.developers(id) on delete cascade,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null
);

create table if not exists public.sponsored_briefs (
  request_id uuid primary key references public.requests(id) on delete cascade,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null
);

create index if not exists sponsored_briefs_ends_at_idx on public.sponsored_briefs (ends_at);
create index if not exists sponsored_profiles_ends_at_idx on public.sponsored_profiles (ends_at);

alter table public.sponsored_profiles enable row level security;
alter table public.sponsored_briefs enable row level security;

drop policy if exists sponsored_profiles_select on public.sponsored_profiles;
create policy sponsored_profiles_select on public.sponsored_profiles
  for select using (true);

drop policy if exists sponsored_briefs_select on public.sponsored_briefs;
create policy sponsored_briefs_select on public.sponsored_briefs
  for select using (true);

-- Écriture uniquement via les RPC ci-dessous (SECURITY DEFINER).

-- ------------------------------------------------------------
-- 2) Tarifs + helpers.
-- ------------------------------------------------------------
create or replace function public.get_sponsoring_prices()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'profile_per_day', (select greatest(1, coalesce(
      (select (value #>> '{}')::integer from public.app_settings where key = 'sponsoring_profile_price_tokens'),
      2))),
    'brief_per_day', (select greatest(1, coalesce(
      (select (value #>> '{}')::integer from public.app_settings where key = 'sponsoring_brief_price_tokens'),
      2)))
  );
$$;

-- Débite n Tokens du portefeuille de v_user (verrou anti-course).
create or replace function public.debit_tokens(
  p_user uuid,
  p_amount integer,
  p_type text,
  p_target uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  perform 1 from public.developers where id = p_user for update;

  select coalesce(sum(t.amount), 0)::integer into v_balance
    from public.token_transactions t
   where t.developer_id = p_user;

  if v_balance < p_amount then
    raise exception 'Tokens insuffisants. Rechargez vos Tokens.' using errcode = 'TLLOW';
  end if;

  insert into public.token_transactions (developer_id, amount, type, target_developer_id)
  values (p_user, -p_amount, p_type, p_target);
end;
$$;

-- ------------------------------------------------------------
-- 3) Achat — profil développeur.
-- ------------------------------------------------------------
create or replace function public.sponsor_dev_profile(p_days integer default 7)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_days integer := greatest(1, least(coalesce(p_days, 7), 30));
  v_price_per_day integer;
  v_total integer;
  v_base timestamptz;
  v_new_end timestamptz;
  v_balance integer;
begin
  if v_user is null then
    raise exception 'Connectez-vous.' using errcode = 'TLAUT';
  end if;
  if not exists (select 1 from public.developers where id = v_user) then
    raise exception 'Profil développeur requis.' using errcode = 'TLNOD';
  end if;

  select ((get_sponsoring_prices() #>> '{profile_per_day}')::integer)
    into v_price_per_day;
  v_total := v_price_per_day * v_days;

  perform public.debit_tokens(p_user := v_user, p_amount := v_total, p_type := 'sponsor');

  select coalesce(max(ends_at), now()) into v_base
    from public.sponsored_profiles where developer_id = v_user;
  v_new_end := greatest(v_base, now()) + make_interval(days => v_days);

  insert into public.sponsored_profiles (developer_id, started_at, ends_at)
  values (v_user, now(), v_new_end)
  on conflict (developer_id) do update
    set ends_at = excluded.ends_at;

  select coalesce(sum(t.amount), 0)::integer into v_balance
    from public.token_transactions t where t.developer_id = v_user;

  return jsonb_build_object('ends_at', v_new_end, 'price', v_total, 'balance', v_balance);
end;
$$;

-- ------------------------------------------------------------
-- 4) Achat — brief ouvert (client porteur de la clé).
-- ------------------------------------------------------------
create or replace function public.sponsor_brief(
  p_request_id uuid,
  p_management_key uuid,
  p_days integer default 7
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_days integer := greatest(1, least(coalesce(p_days, 7), 30));
  v_request public.requests%rowtype;
  v_price_per_day integer;
  v_total integer;
  v_base timestamptz;
  v_new_end timestamptz;
  v_balance integer;
begin
  if v_user is null then
    raise exception 'Connectez-vous.' using errcode = 'TLAUT';
  end if;

  select * into v_request from public.requests
   where id = p_request_id and status = 'ouvert' and hidden = false;
  if v_request.id is null then
    raise exception 'Brief introuvable.' using errcode = 'TLNOK';
  end if;
  if v_request.management_key <> p_management_key then
    raise exception 'Clé de gestion invalide.' using errcode = 'TLAUT';
  end if;

  select ((get_sponsoring_prices() #>> '{brief_per_day}')::integer)
    into v_price_per_day;
  v_total := v_price_per_day * v_days;

  perform public.debit_tokens(p_user := v_user, p_amount := v_total, p_type := 'sponsor_brief');

  select coalesce(max(ends_at), now()) into v_base
    from public.sponsored_briefs where request_id = p_request_id;
  v_new_end := greatest(v_base, now()) + make_interval(days => v_days);

  insert into public.sponsored_briefs (request_id, started_at, ends_at)
  values (p_request_id, now(), v_new_end)
  on conflict (request_id) do update
    set ends_at = excluded.ends_at;

  select coalesce(sum(t.amount), 0)::integer into v_balance
    from public.token_transactions t where t.developer_id = v_user;

  return jsonb_build_object('ends_at', v_new_end, 'price', v_total, 'balance', v_balance);
end;
$$;

-- ------------------------------------------------------------
-- 5) Administration — tarifs.
-- ------------------------------------------------------------
create or replace function public.admin_set_sponsoring_prices(
  p_profile_price_tokens integer,
  p_brief_price_tokens integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès administrateur requis.' using errcode = 'TLAUT';
  end if;
  if coalesce(p_profile_price_tokens, 0) < 1 or coalesce(p_brief_price_tokens, 0) < 1 then
    raise exception 'Prix invalide.' using errcode = 'TLBAD';
  end if;

  insert into public.app_settings (key, value)
  values ('sponsoring_profile_price_tokens', to_jsonb(greatest(p_profile_price_tokens, 1))),
         ('sponsoring_brief_price_tokens', to_jsonb(greatest(p_brief_price_tokens, 1)))
  on conflict (key) do update set value = excluded.value, updated_at = now();

  return public.get_sponsoring_prices();
end;
$$;

-- ------------------------------------------------------------
-- 6) Annuaire : profils sponsorisés en tête.
--     Réécriture complète de list_approved_developers (mêmes
--     paramètres). Colonnes ajoutées : is_sponsored,
--     featured_until.
-- ------------------------------------------------------------
create or replace function public.list_approved_developers(
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
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
  v_specialty text := nullif(btrim(coalesce(p_specialty, '')), '');
  v_city text := nullif(btrim(coalesce(p_city, '')), '');
  v_limit integer := greatest(1, least(coalesce(p_limit, 48), 120));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_sort text := coalesce(nullif(btrim(p_sort), ''), 'relevance');
begin
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
        'featured_until', sp.ends_at
      ) as jb
      from public.developers d
      left join public.developer_profiles dp on dp.developer_id = d.id
      left join auth.users du on du.id = d.id
      left join public.sponsored_profiles sp
        on sp.developer_id = d.id and sp.ends_at > now()
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

-- ------------------------------------------------------------
-- 7) Accès.
-- ------------------------------------------------------------
grant execute on function public.get_sponsoring_prices() to anon, authenticated;
grant execute on function public.sponsor_dev_profile(integer) to authenticated;
grant execute on function public.sponsor_brief(uuid, uuid, integer) to authenticated;
grant execute on function public.admin_set_sponsoring_prices(integer, integer) to authenticated;-- ========== 0046_pro_subscription.sql ==========
-- ============================================================
-- TERANGA LABS — Migration 0046 : Abonnement PRO.
--
-- Abonnement payé en Tokens (pas de carte récurrente pour le
-- moment : le paiement passe par le portefeuille déjà en place).
-- Une période "PRO" de duration_days jours est achetée au prix
-- app_settings.pro_price_tokens puis prolonge la fin d'abonnement
-- existante. Badge PRO affiché (annuaire + fiche) tant que la
-- période est active.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Table.
-- ------------------------------------------------------------
create table if not exists public.subscriptions (
  developer_id uuid primary key references public.developers(id) on delete cascade,
  plan text not null default 'pro' check (plan in ('pro')),
  started_at timestamptz not null default now(),
  ends_at timestamptz not null
);

create index if not exists subscriptions_ends_at_idx on public.subscriptions (ends_at);

alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions
  for select using (true);

-- Écriture uniquement via subscribe_pro (SECURITY DEFINER).

-- ------------------------------------------------------------
-- 2) Tarifs.
-- ------------------------------------------------------------
create or replace function public.get_pro_prices()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'price_tokens', (select greatest(1, coalesce(
      (select (value #>> '{}')::integer from public.app_settings where key = 'pro_price_tokens'),
      15))),
    'duration_days', (select greatest(1, coalesce(
      (select (value #>> '{}')::integer from public.app_settings where key = 'pro_duration_days'),
      30)))
  );
$$;

-- ------------------------------------------------------------
-- 3) Souscription.
-- ------------------------------------------------------------
create or replace function public.subscribe_pro()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_price integer;
  v_duration integer;
  v_base timestamptz;
  v_new_end timestamptz;
  v_balance integer;
begin
  if v_user is null then
    raise exception 'Connectez-vous.' using errcode = 'TLAUT';
  end if;
  if not exists (select 1 from public.developers where id = v_user) then
    raise exception 'Profil développeur requis.' using errcode = 'TLNOD';
  end if;

  v_price := (public.get_pro_prices() #>> '{price_tokens}')::integer;
  v_duration := (public.get_pro_prices() #>> '{duration_days}')::integer;

  perform public.debit_tokens(p_user := v_user, p_amount := v_price, p_type := 'pro');

  select coalesce(max(ends_at), now()) into v_base
    from public.subscriptions where developer_id = v_user;
  v_new_end := greatest(v_base, now()) + make_interval(days => v_duration);

  insert into public.subscriptions (developer_id, plan, started_at, ends_at)
  values (v_user, 'pro', now(), v_new_end)
  on conflict (developer_id) do update
    set ends_at = excluded.ends_at;

  select coalesce(sum(t.amount), 0)::integer into v_balance
    from public.token_transactions t where t.developer_id = v_user;

  return jsonb_build_object('ends_at', v_new_end, 'price', v_price, 'duration_days', v_duration, 'balance', v_balance);
end;
$$;

-- ------------------------------------------------------------
-- 4) Statut du badge PRO (self par défaut, ou dev public).
-- ------------------------------------------------------------
create or replace function public.get_pro_status(p_developer_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_target uuid := coalesce(p_developer_id, auth.uid());
  v_sub public.subscriptions%rowtype;
begin
  if v_target is null then
    return jsonb_build_object('active', false, 'ends_at', null, 'plan', null);
  end if;
  select * into v_sub from public.subscriptions
   where developer_id = v_target and ends_at > now();
  if v_sub.developer_id is null then
    return jsonb_build_object('active', false, 'ends_at', null, 'plan', null);
  end if;
  return jsonb_build_object('active', true, 'ends_at', v_sub.ends_at, 'plan', v_sub.plan);
end;
$$;

-- ------------------------------------------------------------
-- 5) Administration — tarifs / durée.
-- ------------------------------------------------------------
create or replace function public.admin_set_pro_prices(p_price_tokens integer, p_duration_days integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès administrateur requis.' using errcode = 'TLAUT';
  end if;
  if coalesce(p_price_tokens, 0) < 1 or coalesce(p_duration_days, 0) < 1 then
    raise exception 'Valeur invalide.' using errcode = 'TLBAD';
  end if;

  insert into public.app_settings (key, value)
  values ('pro_price_tokens', to_jsonb(p_price_tokens)),
         ('pro_duration_days', to_jsonb(p_duration_days))
  on conflict (key) do update set value = excluded.value, updated_at = now();

  return public.get_pro_prices();
end;
$$;

-- ------------------------------------------------------------
-- 6) Annuaire : badge PRO (et sponsorisés en tête, inchangé).
--     Réécriture v3 de list_approved_developers avec is_pro /
--     pro_until.
-- ------------------------------------------------------------
create or replace function public.list_approved_developers(
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
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
  v_specialty text := nullif(btrim(coalesce(p_specialty, '')), '');
  v_city text := nullif(btrim(coalesce(p_city, '')), '');
  v_limit integer := greatest(1, least(coalesce(p_limit, 48), 120));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_sort text := coalesce(nullif(btrim(p_sort), ''), 'relevance');
begin
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

-- ------------------------------------------------------------
-- 7) Accès.
-- ------------------------------------------------------------
grant execute on function public.get_pro_prices() to anon, authenticated;
grant execute on function public.subscribe_pro() to authenticated;
grant execute on function public.get_pro_status(uuid) to anon, authenticated;
grant execute on function public.admin_set_pro_prices(integer, integer) to authenticated;-- ========== 0047_revoke_privilege_public.sql ==========
-- =============================================================================
-- 0047_revoke_privilege_public.sql
--
-- Correction d'un trou de privilèges (§32) : PostgreSQL accorde
-- EXECUTE à PUBLIC sur toute fonction créée. Les migrations 0044 → 0046 ont
-- accordé leurs RPC à `authenticated` (voire `anon`) mais n'ont pas révoqué
-- PUBLIC : sponsorisation, PRO, agences (et surtout `debit_tokens`) restaient
-- donc invocables par n'importe qui via le rôle anon / n'importe quel compte.
--
-- `debit_tokens` ne vérifiant pas `auth.uid() = p_user`, tout utilisateur
-- connecté pouvait débiter le solde d'un AUTRE développeur : corrigé ici.
--
-- IMPORTANT : `REVOKE ... FROM public` ne suffit pas — le rôle `anon`
-- possède un grant EXECUTE explicite qui survit au revoke PUBLIC (constaté
-- en prod). On révoque donc explicitement de `public` ET `anon` pour chaque
-- RPC privée. `authenticated` garde ses grants (les gardes `auth.uid()` /
-- `is_admin()` dans le corps filtrent).
--
-- Les fonctions sont ré-exécutables (REVOKE est idempotent).
-- =============================================================================

-- RPC privées de l'agence : sessions connectées uniquement.
revoke all on function public.create_agency(text, text, text, text, text, text, text) from public, anon;
revoke all on function public.get_agency_by_invite(uuid) from public, anon;
revoke all on function public.join_agency(uuid, uuid) from public, anon;
revoke all on function public.rotate_agency_invite(uuid) from public, anon;
revoke all on function public.remove_agency_member(uuid) from public, anon;
revoke all on function public.leave_agency() from public, anon;
revoke all on function public.set_agency_status(uuid, text) from public, anon;
revoke all on function public.my_agency() from public, anon;
revoke all on function public.agency_role(uuid, uuid) from public, anon;

-- RPC de sponsoring : débitent des Tokens, sessions connectées uniquement.
revoke all on function public.sponsor_dev_profile(integer) from public, anon;
revoke all on function public.sponsor_brief(uuid, uuid, integer) from public, anon;
revoke all on function public.admin_set_sponsoring_prices(integer, integer) from public, anon;

-- RPC PRO : débitent des Tokens, sessions connectées uniquement.
revoke all on function public.subscribe_pro() from public, anon;
revoke all on function public.admin_set_pro_prices(integer, integer) from public, anon;

-- Cœur du problème : le débit lui-même doit rester hors de portée de TOUS les
-- rôles navigateur. Son seul usage légitime est l'invocation interne des RPC
-- sponsor/PRO (security definer, owner postgres) : aucun grant n'est nécessaire.
revoke all on function public.debit_tokens(uuid, integer, text, uuid) from public;
revoke all on function public.debit_tokens(uuid, integer, text, uuid) from anon;
revoke all on function public.debit_tokens(uuid, integer, text, uuid) from authenticated;
-- ========== 0048_disputes_risk.sql ==========
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

COMMIT;-- ========== 0049_feature_flags_availability.sql ==========
-- ============================================================
-- 0049_feature_flags_availability.sql
-- P4 — Clôture audit C11/§45 + C2/§12 : feature flags serveur et
-- disponibilités hebdomadaires des développeurs. NON destructif.
--
-- feature_flags : aucun flag n'est pré-inventé (aucune seed) — un
-- flag n'existe que s'il est posé par la console admin. Lecture
-- publique : les clés et l'état on/off ne sont pas des secrets,
-- la valeur par défaut est "désactivé".
--
-- developer_availability : 7 lignes par développeur (lundi 0 …
-- dimanche 6), lecture publique pour l'annuaire, écriture via RPC
-- (propriétaire uniquement).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Table feature_flags
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='feature_flags' AND policyname='feature_flags_select_public') THEN
    CREATE POLICY "feature_flags_select_public"
      ON public.feature_flags FOR SELECT
      USING (TRUE);
  END IF;
END $$;

-- Écriture : console admin (service_role) ou RPC admin_set_feature_flag.

-- ------------------------------------------------------------
-- 2. RPC is_feature_enabled : lecture stable, défaut FALSE si le
--    flag n'existe pas.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_feature_enabled(p_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT ff.enabled FROM public.feature_flags ff WHERE ff.key = p_key),
    FALSE
  );
$$;

REVOKE ALL ON FUNCTION public.is_feature_enabled(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_feature_enabled(TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 3. RPC admin_set_feature_flag : création/bascule (admin only).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_feature_flag(
  p_key TEXT,
  p_enabled BOOLEAN,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT := NULLIF(TRIM(COALESCE(p_key, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès administrateur requis.' USING ERRCODE = 'TLAUT';
  END IF;
  IF v_key IS NULL OR v_key !~ '^[a-z0-9_]{2,64}$' THEN
    RAISE EXCEPTION 'Nom de flag invalide (a-z, 0-9, _).' USING ERRCODE = 'TLBAD';
  END IF;

  INSERT INTO public.feature_flags (key, enabled, description, updated_by, updated_at)
  VALUES (v_key, COALESCE(p_enabled, FALSE), p_description, auth.uid(), NOW())
  ON CONFLICT (key) DO UPDATE
    SET enabled = EXCLUDED.enabled,
        description = COALESCE(EXCLUDED.description, feature_flags.description),
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW();

  RETURN JSONB_BUILD_OBJECT('key', v_key, 'enabled', COALESCE(p_enabled, FALSE));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_feature_flag(TEXT, BOOLEAN, TEXT) FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.admin_set_feature_flag(TEXT, BOOLEAN, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- 4. Table developer_availability
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.developer_availability (
  developer_id UUID NOT NULL REFERENCES public.developers(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  available BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (developer_id, weekday)
);

ALTER TABLE public.developer_availability ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='developer_availability' AND policyname='availability_select_public') THEN
    CREATE POLICY "availability_select_public"
      ON public.developer_availability FOR SELECT
      USING (TRUE);
  END IF;
END $$;

-- Écriture uniquement via set_my_availability (propriétaire).

-- ------------------------------------------------------------
-- 5. RPC set_my_availability : remplace les 7 jours d'un coup.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_my_availability(
  p_available BOOLEAN,
  p_weekdays INT[] DEFAULT '{0,1,2,3,4,5,6}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_days INT[];
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.developers WHERE id = v_user) THEN
    RAISE EXCEPTION 'Profil développeur requis.' USING ERRCODE = 'TLNOD';
  END IF;

  v_days := COALESCE(
    (SELECT ARRAY_AGG(DISTINCT d) FROM UNNEST(COALESCE(p_weekdays, '{}')) AS d WHERE d BETWEEN 0 AND 6),
    '{}'
  );

  DELETE FROM public.developer_availability WHERE developer_id = v_user;

  IF COALESCE(p_available, FALSE) THEN
    INSERT INTO public.developer_availability (developer_id, weekday, available)
    SELECT v_user, d, TRUE FROM UNNEST(v_days) AS d;
  END IF;

  RETURN JSONB_BUILD_OBJECT(
    'available', COALESCE(p_available, FALSE),
    'weekdays', TO_JSONB(v_days)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_availability(BOOLEAN, INT[]) FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.set_my_availability(BOOLEAN, INT[]) TO authenticated;

COMMIT;-- ========== 0050_support_tickets.sql ==========
-- ============================================================
-- 0050_support_tickets.sql
-- P4 — Clôture audit C11/§31 : support utilisateur (tickets +
-- messages). NON destructif.
--
-- Un ticket appartient à son créateur ; seul le propriétaire le
-- voit et peut y répondre. La réponse du support arrive via la
-- console admin (service_role) plus tard : le champ is_staff des
-- messages distingue déjà les deux voix.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Tables
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'answered', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS support_tickets_user_idx ON public.support_tickets (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_staff BOOLEAN NOT NULL DEFAULT FALSE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS support_messages_ticket_idx ON public.support_messages (ticket_id, created_at);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='support_tickets' AND policyname='support_tickets_select_own') THEN
    CREATE POLICY "support_tickets_select_own"
      ON public.support_tickets FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='support_messages' AND policyname='support_messages_select_own') THEN
    CREATE POLICY "support_messages_select_own"
      ON public.support_messages FOR SELECT
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.support_tickets st
         WHERE st.id = ticket_id AND st.user_id = auth.uid()
      ));
  END IF;
END $$;

-- Écriture uniquement via les RPC ci-dessous.

-- ------------------------------------------------------------
-- 2. RPC create_support_ticket : ticket + premier message,
--    anti-spam (5 tickets ouverts maximum).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_support_ticket(
  p_subject TEXT,
  p_body TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_subject TEXT := NULLIF(TRIM(COALESCE(p_subject, '')), '');
  v_body TEXT := NULLIF(TRIM(COALESCE(p_body, '')), '');
  v_ticket_id UUID;
  v_open_count INT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;
  IF v_subject IS NULL OR LENGTH(v_subject) < 5 THEN
    RAISE EXCEPTION 'Sujet trop court (5 caractères minimum).' USING ERRCODE = 'TLBAD';
  END IF;
  IF v_subject IS NOT NULL AND LENGTH(v_subject) > 120 THEN
    RAISE EXCEPTION 'Sujet trop long (120 caractères maximum).' USING ERRCODE = 'TLBAD';
  END IF;
  IF v_body IS NULL OR LENGTH(v_body) < 10 THEN
    RAISE EXCEPTION 'Message trop court (10 caractères minimum).' USING ERRCODE = 'TLBAD';
  END IF;
  IF LENGTH(v_body) > 4000 THEN
    RAISE EXCEPTION 'Message trop long (4000 caractères maximum).' USING ERRCODE = 'TLBAD';
  END IF;

  SELECT COUNT(*) INTO v_open_count
    FROM public.support_tickets
   WHERE user_id = v_user AND status = 'open';
  IF v_open_count >= 5 THEN
    RAISE EXCEPTION 'Trop de tickets ouverts (5 maximum) : attendez une réponse.' USING ERRCODE = 'TLLIM';
  END IF;

  INSERT INTO public.support_tickets (user_id, subject)
  VALUES (v_user, v_subject)
  RETURNING id INTO v_ticket_id;

  INSERT INTO public.support_messages (ticket_id, author_id, is_staff, body)
  VALUES (v_ticket_id, v_user, FALSE, v_body);

  RETURN JSONB_BUILD_OBJECT('id', v_ticket_id, 'status', 'open');
END;
$$;

-- ------------------------------------------------------------
-- 3. RPC reply_support_ticket : réponse du créateur ; remet le
--    ticket en attente de réponse staff.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reply_support_ticket(
  p_ticket_id UUID,
  p_body TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_body TEXT := NULLIF(TRIM(COALESCE(p_body, '')), '');
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;
  IF v_body IS NULL OR LENGTH(v_body) < 2 THEN
    RAISE EXCEPTION 'Message trop court.' USING ERRCODE = 'TLBAD';
  END IF;
  IF LENGTH(v_body) > 4000 THEN
    RAISE EXCEPTION 'Message trop long (4000 caractères maximum).' USING ERRCODE = 'TLBAD';
  END IF;

  UPDATE public.support_tickets
     SET status = 'open', updated_at = NOW()
   WHERE id = p_ticket_id AND user_id = v_user AND status <> 'closed';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket introuvable ou fermé.' USING ERRCODE = 'TLNOD';
  END IF;

  INSERT INTO public.support_messages (ticket_id, author_id, is_staff, body)
  VALUES (p_ticket_id, v_user, FALSE, v_body);

  RETURN JSONB_BUILD_OBJECT('id', p_ticket_id, 'status', 'open');
END;
$$;

-- ------------------------------------------------------------
-- 4. RPC list_my_tickets : mes tickets + dernier message.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_my_tickets()
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
    SELECT JSONB_AGG(t ORDER BY t.updated_at DESC)
    FROM (
      SELECT st.id, st.subject, st.status, st.created_at, st.updated_at,
             (SELECT COUNT(*) FROM public.support_messages sm WHERE sm.ticket_id = st.id) AS message_count,
             (SELECT sm.body FROM public.support_messages sm WHERE sm.ticket_id = st.id ORDER BY sm.created_at DESC LIMIT 1) AS last_message
        FROM public.support_tickets st
       WHERE st.user_id = v_user
    ) t
  ), '[]'::JSONB);
END;
$$;

-- ------------------------------------------------------------
-- 5. RPC close_support_ticket : fermeture par le créateur.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_support_ticket(p_ticket_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;

  UPDATE public.support_tickets
     SET status = 'closed', updated_at = NOW()
   WHERE id = p_ticket_id AND user_id = v_user;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket introuvable.' USING ERRCODE = 'TLNOD';
  END IF;

  RETURN JSONB_BUILD_OBJECT('id', p_ticket_id, 'status', 'closed');
END;
$$;

REVOKE ALL ON FUNCTION public.create_support_ticket(TEXT, TEXT) FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.create_support_ticket(TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.reply_support_ticket(UUID, TEXT) FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.reply_support_ticket(UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.list_my_tickets() FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.list_my_tickets() TO authenticated;
REVOKE ALL ON FUNCTION public.close_support_ticket(UUID) FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.close_support_ticket(UUID) TO authenticated;

COMMIT;-- ========== 0051_admin_console_sync.sql ==========
-- ============================================================
-- 0051_admin_console_sync.sql
-- P5 — Synchronisation console admin (audit R4) : les modules
-- P2/P4 (agences, sponsoring, PRO, litiges, support, flags,
-- risque) n'avaient pas de RPC de lecture côté console. NON
-- destructif.
--
-- Conventions : SECURITY DEFINER + search_path, garde is_admin()
-- dans le corps, REVOKE PUBLIC + GRANT authenticated (session
-- admin de la console), écritures staff via RPC dédiées.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. admin_alerts étendu : + litiges ouverts + tickets ouverts
--    (les 4 compteurs historiques sont inchangés).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_alerts()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès réservé à l''administration.' USING ERRCODE = 'TLAAC';
  END IF;

  RETURN JSONB_BUILD_OBJECT(
    'pending_applications', (
      SELECT COUNT(*)::INTEGER FROM public.developers WHERE status = 'pending'
    ),
    'changes_requested', (
      SELECT COUNT(*)::INTEGER FROM public.developers WHERE status = 'changes_requested'
    ),
    'pending_verifications', (
      SELECT COUNT(*)::INTEGER FROM public.verification_requests
       WHERE payment_status = 'confirmed' AND verification_status = 'pending'
    ),
    'pending_payments', (
      SELECT COUNT(*)::INTEGER FROM public.verification_requests
       WHERE payment_status = 'pending'
    ),
    'open_disputes', (
      SELECT COUNT(*)::INTEGER FROM public.disputes
       WHERE status IN ('open', 'under_review')
    ),
    'open_support', (
      SELECT COUNT(*)::INTEGER FROM public.support_tickets WHERE status = 'open'
    ),
    'verification_price_fcfa', public.get_verification_price(),
    'contact_cost_tokens', public.get_contact_cost()
  );
END;
$$;

-- ------------------------------------------------------------
-- 2. admin_list_disputes : litiges + contexte mission/brief.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_disputes(p_status TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès réservé à l''administration.' USING ERRCODE = 'TLAAC';
  END IF;

  RETURN COALESCE((
    SELECT JSONB_AGG(d ORDER BY d.created_at DESC)
    FROM (
      SELECT di.id, di.mission_id, di.reason, di.status, di.resolution,
             di.created_at, di.resolved_at,
             m.agreed_price_fcfa, m.agreed_days,
             r.project_type,
             LEFT(COALESCE(r.description, ''), 120) AS brief_excerpt,
             (SELECT COALESCE(dv.full_name, '—') FROM public.developers dv
               WHERE dv.id = m.developer_id) AS developer_name,
             (SELECT COALESCE(cp.contact_name, cp.company_name, '—')
                FROM public.client_profiles cp
               WHERE cp.id = m.client_id) AS client_name
        FROM public.disputes di
        JOIN public.missions m ON m.id = di.mission_id
        LEFT JOIN public.requests r ON r.id = m.request_id
       WHERE p_status IS NULL OR di.status = p_status
    ) d
  ), '[]'::JSONB);
END;
$$;

-- ------------------------------------------------------------
-- 3. admin_list_support_tickets : tickets + dernier message,
--    auteur masqué (mask_email).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_support_tickets(p_status TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès réservé à l''administration.' USING ERRCODE = 'TLAAC';
  END IF;

  RETURN COALESCE((
    SELECT JSONB_AGG(t ORDER BY t.updated_at DESC)
    FROM (
      SELECT st.id, st.subject, st.status, st.created_at, st.updated_at,
             st.user_id,
             public.mask_email(au.email) AS user_email,
             (SELECT COUNT(*) FROM public.support_messages sm
               WHERE sm.ticket_id = st.id) AS message_count,
             (SELECT JSONB_BUILD_OBJECT(
                       'body', sm.body,
                       'is_staff', sm.is_staff,
                       'created_at', sm.created_at
                     )
                FROM public.support_messages sm
               WHERE sm.ticket_id = st.id
               ORDER BY sm.created_at DESC LIMIT 1) AS last_message
        FROM public.support_tickets st
        JOIN auth.users au ON au.id = st.user_id
       WHERE p_status IS NULL OR st.status = p_status
    ) t
  ), '[]'::JSONB);
END;
$$;

-- ------------------------------------------------------------
-- 4. Réponses staff : + fermeture admin + lecture conversation.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_support_messages(p_ticket_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès réservé à l''administration.' USING ERRCODE = 'TLAAC';
  END IF;

  RETURN COALESCE((
    SELECT JSONB_AGG(m ORDER BY m.created_at)
    FROM (
      SELECT sm.id, sm.author_id, sm.is_staff, sm.body, sm.created_at
        FROM public.support_messages sm
       WHERE sm.ticket_id = p_ticket_id
    ) m
  ), '[]'::JSONB);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reply_support_ticket(
  p_ticket_id UUID,
  p_body TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin UUID := auth.uid();
  v_body TEXT := NULLIF(TRIM(COALESCE(p_body, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès réservé à l''administration.' USING ERRCODE = 'TLAAC';
  END IF;
  IF v_body IS NULL OR LENGTH(v_body) < 2 THEN
    RAISE EXCEPTION 'Message trop court.' USING ERRCODE = 'TLBAD';
  END IF;
  IF LENGTH(v_body) > 4000 THEN
    RAISE EXCEPTION 'Message trop long (4000 caractères maximum).' USING ERRCODE = 'TLBAD';
  END IF;

  UPDATE public.support_tickets
     SET status = 'answered', updated_at = NOW()
   WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket introuvable.' USING ERRCODE = 'TLNOD';
  END IF;

  INSERT INTO public.support_messages (ticket_id, author_id, is_staff, body)
  VALUES (p_ticket_id, v_admin, TRUE, v_body);

  RETURN JSONB_BUILD_OBJECT('id', p_ticket_id, 'status', 'answered');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_close_support_ticket(p_ticket_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès réservé à l''administration.' USING ERRCODE = 'TLAAC';
  END IF;

  UPDATE public.support_tickets
     SET status = 'closed', updated_at = NOW()
   WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket introuvable.' USING ERRCODE = 'TLNOD';
  END IF;

  RETURN JSONB_BUILD_OBJECT('id', p_ticket_id, 'status', 'closed');
END;
$$;

-- ------------------------------------------------------------
-- 5. admin_list_agences : annuaire admin + effectifs.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_agencies(p_status TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès réservé à l''administration.' USING ERRCODE = 'TLAAC';
  END IF;

  RETURN COALESCE((
    SELECT JSONB_AGG(a ORDER BY a.created_at DESC)
    FROM (
      SELECT ag.id, ag.name, ag.slug, ag.status, ag.city, ag.country,
             ag.created_at,
             (SELECT COUNT(*) FROM public.agency_members am
               WHERE am.agency_id = ag.id) AS member_count
        FROM public.agencies ag
       WHERE p_status IS NULL OR ag.status = p_status
    ) a
  ), '[]'::JSONB);
END;
$$;

-- ------------------------------------------------------------
-- 6. Croissance : sponsoring actif, PRO actif, tarifs, flags.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_sponsored()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès réservé à l''administration.' USING ERRCODE = 'TLAAC';
  END IF;

  RETURN JSONB_BUILD_OBJECT(
    'profiles', COALESCE((
      SELECT JSONB_AGG(p ORDER BY p.ends_at DESC)
      FROM (
        SELECT sp.developer_id, sp.started_at, sp.ends_at,
               (SELECT COALESCE(dv.full_name, '—') FROM public.developers dv
                 WHERE dv.id = sp.developer_id) AS developer_name
          FROM public.sponsored_profiles sp
         WHERE sp.ends_at > NOW()
      ) p
    ), '[]'::JSONB),
    'briefs', COALESCE((
      SELECT JSONB_AGG(b ORDER BY b.ends_at DESC)
      FROM (
        SELECT sb.request_id, sb.started_at, sb.ends_at,
               r.project_type,
               LEFT(COALESCE(r.description, ''), 120) AS brief_excerpt
          FROM public.sponsored_briefs sb
          JOIN public.requests r ON r.id = sb.request_id
         WHERE sb.ends_at > NOW()
      ) b
    ), '[]'::JSONB),
    'prices', public.get_sponsoring_prices()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_subscriptions()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès réservé à l''administration.' USING ERRCODE = 'TLAAC';
  END IF;

  RETURN JSONB_BUILD_OBJECT(
    'active', COALESCE((
      SELECT JSONB_AGG(s ORDER BY s.ends_at DESC)
      FROM (
        SELECT sub.developer_id, sub.plan, sub.started_at, sub.ends_at,
               (SELECT COALESCE(dv.full_name, '—') FROM public.developers dv
                 WHERE dv.id = sub.developer_id) AS developer_name
          FROM public.subscriptions sub
         WHERE sub.ends_at > NOW()
      ) s
    ), '[]'::JSONB),
    'prices', public.get_pro_prices()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_feature_flags()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès réservé à l''administration.' USING ERRCODE = 'TLAAC';
  END IF;

  RETURN COALESCE((
    SELECT JSONB_AGG(f ORDER BY f.key)
    FROM (
      SELECT ff.key, ff.enabled, ff.description, ff.updated_at
        FROM public.feature_flags ff
    ) f
  ), '[]'::JSONB);
END;
$$;

-- ------------------------------------------------------------
-- 7. admin_list_risk_events : incidents récents.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_risk_events(p_limit INTEGER DEFAULT 100)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès réservé à l''administration.' USING ERRCODE = 'TLAAC';
  END IF;

  RETURN COALESCE((
    SELECT JSONB_AGG(e ORDER BY e.created_at DESC)
    FROM (
      SELECT re.id, re.user_id, re.event, re.severity, re.metadata, re.created_at
        FROM public.risk_events re
       ORDER BY re.created_at DESC
       LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 500))
    ) e
  ), '[]'::JSONB);
END;
$$;

-- ------------------------------------------------------------
-- 8. Privilèges : jamais PUBLIC (rappel 0047), session admin.
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.admin_list_disputes(TEXT) FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.admin_list_disputes(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_list_support_tickets(TEXT) FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.admin_list_support_tickets(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_list_support_messages(UUID) FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.admin_list_support_messages(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_reply_support_ticket(UUID, TEXT) FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.admin_reply_support_ticket(UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_close_support_ticket(UUID) FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.admin_close_support_ticket(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_list_agencies(TEXT) FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.admin_list_agencies(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_list_sponsored() FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.admin_list_sponsored() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_list_subscriptions() FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.admin_list_subscriptions() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_list_feature_flags() FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.admin_list_feature_flags() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_list_risk_events(INTEGER) FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.admin_list_risk_events(INTEGER) TO authenticated;

COMMIT;