-- ============================================================
-- 0070 : statistiques de l'espace développeur + alerte email
-- « nouveaux projets ».
--
-- Modèle « Codeur » : le développeur doit pouvoir suivre la
-- performance de sa fiche publique (vues, clics « Contacter »,
-- contacts ouverts, conversion) et choisir de recevoir ou non
-- les nouveaux projets par email.
--
-- NON destructif :
--   * ajout d'une colonne avec valeur par défaut (true) ;
--   * RPC en lecture seule, tolérante à l'absence de la table
--     analytic_events (migrations 0039 non appliquées).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Préférence « alerte email nouveaux projets ».
--    Absence de ligne = actif (même logique que la migration 0067).
-- ------------------------------------------------------------
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS email_new_projects boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.notification_preferences.email_new_projects IS
  'Alerte email à chaque nouveau projet correspondant au profil développeur.';

-- ------------------------------------------------------------
-- 2. Statistiques du développeur connecté.
--    Les vues/clics proviennent de analytic_events (si présente) :
--    la fonction reste utilisable même si la table n'existe pas.
--    Les contacts ouverts sont comptés depuis les conversations
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
