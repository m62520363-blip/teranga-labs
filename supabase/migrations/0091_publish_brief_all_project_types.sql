-- ============================================================
-- 0091_publish_brief_all_project_types.sql
--
-- Bug : le formulaire client propose les 15 types de projet
-- (lib/tokens.ts PROJECT_TYPES) et la contrainte de la table
-- requests les accepte (0077), mais publish_brief (0069)
-- n'en valide que 5 : tout brief « design », « ia », « mobile »…
-- échoue avec « Type de projet invalide » (422 générique).
--
-- 1. Garantit la contrainte élargie (idempotent, reprend 0077
--    au cas où elle n'aurait jamais été appliquée).
-- 2. publish_brief : validation alignée sur les 15 types.
--    Publication toujours GRATUITE (0069 conservée : gift=false).
--
-- Non destructif, ré-exécutable.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Contrainte requests_project_type_check : 15 types
--    (identique à 0077_expand_project_types.sql).
-- ------------------------------------------------------------
ALTER TABLE public.requests
  DROP CONSTRAINT IF EXISTS requests_project_type_check;

ALTER TABLE public.requests
  ADD CONSTRAINT requests_project_type_check
  CHECK (project_type IN (
    'vitrine', 'e-commerce', 'landing page', 'app web', 'refonte',
    'design', 'marketing', 'seo', 'ia', 'mobile', 'saas', 'api',
    'automatisation', 'autre'
  ));

-- ------------------------------------------------------------
-- 2. publish_brief : corps 0069 (publication gratuite) avec
--    la liste des 15 types autorisés.
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
  IF p_project_type NOT IN (
    'vitrine', 'e-commerce', 'landing page', 'app web', 'refonte',
    'design', 'marketing', 'seo', 'ia', 'mobile', 'saas', 'api',
    'automatisation', 'autre'
  ) THEN
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

COMMIT;
