-- ============================================================
-- 0069_free_project_posting.sql
-- Modèle « Codeur » : la publication d'un projet est GRATUITE
-- côté client. La monétisation reste côté développeur
-- (1 Token par contact, abonnement Pro).
--
-- NON destructif :
--   * publish_brief ne débite plus de Token et ne consomme plus
--     l'offre de bienvenue (les contacts offerts restent intacts) ;
--   * les transactions passées ne sont pas modifiées.
--
-- Réversion : réappliquer la définition de publish_brief de la
-- migration 0056_security_hardening.sql.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. publish_brief : publication gratuite.
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
  v_req public.requests%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous pour publier un projet.' USING ERRCODE = 'TLAUTH';
  END IF;

  SELECT role INTO v_role FROM public.user_roles WHERE user_id = v_user_id;
  IF v_role IS DISTINCT FROM 'client' THEN
    RAISE EXCEPTION 'Seuls les clients peuvent publier un projet.' USING ERRCODE = 'TLRJC';
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

  -- Sérialise deux publications simultanées du même compte.
  PERFORM 1 FROM public.developers WHERE id = v_user_id FOR UPDATE;

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

  RETURN jsonb_build_object(
    'id', v_req.id,
    'management_key', v_req.management_key,
    'gift', false,
    'free', true,
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
-- 2. Compteurs publics du flux de projets (accueil + liste).
--    SECURITY DEFINER pour compter les messages/événements sans
--    exposer les tables au rôle anonyme.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_brief_stats(p_ids uuid[])
RETURNS TABLE (request_id uuid, offers_count integer, views_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id AS request_id,
    coalesce((
      SELECT count(*)::INTEGER
      FROM public.messages m
      JOIN public.conversations c ON c.id = m.conversation_id
      WHERE c.request_id = r.id
        AND m.message_type = 'offer'
        AND m.deleted_at IS NULL
    ), 0) AS offers_count,
    coalesce((
      SELECT count(*)::INTEGER
      FROM public.analytic_events a
      WHERE a.request_id = r.id
        AND a.event = 'brief_view'
    ), 0) AS views_count
  FROM public.requests r
  WHERE r.id = ANY(p_ids)
    AND r.status = 'ouvert'
    AND r.hidden = false;
$$;

REVOKE ALL ON FUNCTION public.get_public_brief_stats(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_brief_stats(uuid[]) TO anon, authenticated;

COMMIT;
