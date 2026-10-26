-- ============================================================
-- 0070 : statistiques de l'espace développeur + alerte email
-- « nouveaux projets ».
--
-- Constat en production : la migration 0067 n'a jamais été
-- appliquée (public.notification_preferences absente, erreur
-- 42P01). La présente migration est donc AUTONOME : elle crée
-- elle-même tout ce dont elle dépend.
--
--   0. socle analytics : analytic_events + track_event (0039) ;
--   1. notification_preferences + RLS + backfill + gating
--      de notify_user (0067) ;
--   2. colonne email_new_projects ;
--   3. RPC get_my_developer_stats().
--
-- NON destructif et idempotent : IF NOT EXISTS, CREATE OR
-- REPLACE, DROP POLICY IF EXISTS. Rejouable sans risque.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0. Socle analytics (migration 0039). Écriture réservée au
--    service_role : aucune donnée inventée.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analytic_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID REFERENCES public.requests(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS analytic_events_created_idx
  ON public.analytic_events (created_at DESC);
CREATE INDEX IF NOT EXISTS analytic_events_name_idx
  ON public.analytic_events (event, created_at DESC);

ALTER TABLE public.analytic_events ENABLE ROW LEVEL SECURITY;

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

-- ------------------------------------------------------------
-- 1. Préférences de notifications (migration 0067).
--    Source de vérité : une ligne par utilisateur, lue par
--    l'écran Paramètres, par notify_user et par la diffusion
--    des emails. Absence de ligne = tout actif.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY DEFAULT auth.uid()
    REFERENCES auth.users (id) ON DELETE CASCADE,
  in_app BOOLEAN NOT NULL DEFAULT TRUE,
  email_contact BOOLEAN NOT NULL DEFAULT TRUE,
  email_replies BOOLEAN NOT NULL DEFAULT TRUE,
  email_unread_reminders BOOLEAN NOT NULL DEFAULT TRUE,
  email_price_offers BOOLEAN NOT NULL DEFAULT TRUE,
  email_new_projects BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.notification_preferences IS
  'Préférences de notifications par utilisateur (in-app + e-mails). '
  'Remplace user_metadata.email_prefs, non lus côté SQL.';

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_preferences_select_own"
  ON public.notification_preferences;
CREATE POLICY "notification_preferences_select_own"
  ON public.notification_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notification_preferences_insert_own"
  ON public.notification_preferences;
CREATE POLICY "notification_preferences_insert_own"
  ON public.notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notification_preferences_update_own"
  ON public.notification_preferences;
CREATE POLICY "notification_preferences_update_own"
  ON public.notification_preferences FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Backfill des préférences héritées de user_metadata.email_prefs.
INSERT INTO public.notification_preferences (
  user_id,
  email_contact,
  email_replies,
  email_unread_reminders,
  email_price_offers
)
SELECT
  u.id,
  coalesce((u.raw_user_meta_data -> 'email_prefs' ->> 'contact')::boolean, TRUE),
  coalesce((u.raw_user_meta_data -> 'email_prefs' ->> 'replies')::boolean, TRUE),
  coalesce((u.raw_user_meta_data -> 'email_prefs' ->> 'unreadReminders')::boolean, TRUE),
  coalesce((u.raw_user_meta_data -> 'email_prefs' ->> 'priceOffers')::boolean, TRUE)
FROM auth.users u
WHERE u.raw_user_meta_data -> 'email_prefs' IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Gating : notify_user ne crée plus de notification in-app pour
-- un utilisateur l'ayant désactivée (signature inchangée).
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
  v_in_app BOOLEAN;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.in_app INTO v_in_app
  FROM public.notification_preferences p
  WHERE p.user_id = p_user_id;

  IF NOT coalesce(v_in_app, TRUE) THEN
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
-- 2. Préférence « alerte email nouveaux projets ».
--    (no-op si la table vient d'être créée ci-dessus)
-- ------------------------------------------------------------
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS email_new_projects BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.notification_preferences.email_new_projects IS
  'Alerte email à chaque nouveau projet correspondant au profil développeur.';

-- ------------------------------------------------------------
-- 3. Statistiques du développeur connecté.
--    Vues/clics : analytic_events. Contacts ouverts : conversations
--    directes (request_id NULL) créées par contact_developer.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_developer_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_has_events boolean := to_regclass('public.analytic_events') IS NOT NULL;
  v_views_total integer := 0;
  v_views_30d integer := 0;
  v_clicks_total integer := 0;
  v_clicks_30d integer := 0;
  v_contacts_total integer := 0;
  v_contacts_30d integer := 0;
  v_conversion integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous pour consulter vos statistiques.'
      USING ERRCODE = 'TLNAU';
  END IF;

  IF v_has_events THEN
    EXECUTE $q$
      SELECT
        count(*) FILTER (WHERE event = 'profile_view'),
        count(*) FILTER (
          WHERE event = 'profile_view'
            AND created_at >= now() - interval '30 days'
        ),
        count(*) FILTER (WHERE event = 'contact_click'),
        count(*) FILTER (
          WHERE event = 'contact_click'
            AND created_at >= now() - interval '30 days'
        )
      FROM public.analytic_events
      WHERE metadata ->> 'developer_id' = $1
    $q$
    INTO v_views_total, v_views_30d, v_clicks_total, v_clicks_30d
    USING v_user::text;
  END IF;

  SELECT count(*)::integer INTO v_contacts_total
  FROM public.conversations
  WHERE developer_id = v_user
    AND request_id IS NULL;

  SELECT count(*)::integer INTO v_contacts_30d
  FROM public.conversations
  WHERE developer_id = v_user
    AND request_id IS NULL
    AND created_at >= now() - interval '30 days';

  IF v_clicks_30d > 0 THEN
    v_conversion := least(
      100,
      round(v_contacts_30d::numeric * 100 / v_clicks_30d)::integer
    );
  END IF;

  RETURN jsonb_build_object(
    'profile_views', v_views_total,
    'profile_views_30d', v_views_30d,
    'contact_clicks', v_clicks_total,
    'contact_clicks_30d', v_clicks_30d,
    'contacts', v_contacts_total,
    'contacts_30d', v_contacts_30d,
    'conversion_rate', v_conversion,
    'tracking_available', v_has_events
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_developer_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_developer_stats() TO authenticated;

-- Recharge du cache PostgREST.
NOTIFY pgrst, 'reload schema';

COMMIT;
