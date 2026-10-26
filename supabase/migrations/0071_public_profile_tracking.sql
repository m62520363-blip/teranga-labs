-- ============================================================
-- 0071 : suivi public des fiches développeur sans clé service.
--
-- Constat : la production n'a pas SUPABASE_SERVICE_ROLE_KEY, donc
-- la route /api/analytics/track ne pouvait pas écrire (elle passe
-- par le client service_role). Les statistiques restaient à zéro.
--
-- Solution : une RPC SECURITY DEFINER, appelable par anon et
-- authenticated, limitée à une allow-list de deux événements et
-- à un développeur réellement existant. La table analytic_events
-- reste fermée en écriture directe (RLS active, aucune policy
-- d'INSERT) : seule cette fonction peut insérer.
--
-- L'acteur n'est jamais fourni par le client : il est déduit de
-- auth.uid() côté base (NULL pour un visiteur anonyme). Une visite
-- de sa propre fiche est donc ignorée sans pouvoir être falsifiée.
--
-- L'anti-abus repose sur le rate-limit de la route HTTP (60/min/IP)
-- et sur la fermeture de l'allow-list.
-- NON destructif et idempotent.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.track_public_event(
  p_event TEXT,
  p_developer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF p_event IS NULL OR p_event NOT IN ('profile_view', 'contact_click') THEN
    RAISE EXCEPTION 'Événement non autorisé.' USING ERRCODE = 'TLEVN';
  END IF;

  IF p_developer_id IS NULL THEN
    RAISE EXCEPTION 'Développeur manquant.' USING ERRCODE = 'TLEVM';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.developers d WHERE d.id = p_developer_id
  ) THEN
    RAISE EXCEPTION 'Développeur introuvable.' USING ERRCODE = 'TLNOK';
  END IF;

  -- Une visite de sa propre fiche ne gonfle pas les statistiques.
  IF v_actor IS NOT NULL AND v_actor = p_developer_id THEN
    RETURN jsonb_build_object('ok', TRUE, 'recorded', FALSE, 'self', TRUE);
  END IF;

  INSERT INTO public.analytic_events (event, actor_id, metadata)
  VALUES (
    p_event,
    v_actor,
    jsonb_build_object('developer_id', p_developer_id, 'source', 'public_rpc')
  );

  RETURN jsonb_build_object('ok', TRUE, 'recorded', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.track_public_event(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_public_event(TEXT, UUID)
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
