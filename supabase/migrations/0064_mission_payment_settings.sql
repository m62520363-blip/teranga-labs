-- ============================================================
-- 0064_mission_payment_settings.sql
-- Configuration du paiement Chariow des missions :
--   - produit Chariow (mission_product_id) ;
--   - variante de prix par montant exact (mission_price_variants).
-- Les deux clés sont seedées vides : tant qu'aucun produit ni aucune
-- variante ne sont déclarés, mission-checkout refuse en 503 — jamais
-- de montant approché. Un RPC admin valide puis écrit la config.
-- NON destructif, idempotent.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Seeds (on conflict do nothing : ne jamais écraser une config)
-- ------------------------------------------------------------
-- 'mission_product_id' : represente "pas encore configure" par une chaine
-- JSON vide. Un cast ''::jsonb serait invalide (chaine vide = JSON invalide)
-- et ferait echouer la migration en 22P02. On reprend la representation
-- que produit deja admin_set_mission_payment_config via to_jsonb(''),
-- soit '""'::jsonb — d'ou un value #>> '{}' = '' lisible par la RPC.
INSERT INTO public.app_settings (key, value) VALUES
  ('mission_product_id', '""'::jsonb),
  ('mission_price_variants', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------
-- 2. RPC ADMIN — lire la config de paiement des missions
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_mission_payment_config()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès administrateur requis.' USING ERRCODE = 'TLAUT';
  END IF;

  RETURN jsonb_build_object(
    'product_id', COALESCE(
      (SELECT value #>> '{}' FROM public.app_settings WHERE key = 'mission_product_id'),
      ''
    ),
    'price_variants', COALESCE(
      (SELECT value FROM public.app_settings WHERE key = 'mission_price_variants'),
      '{}'::jsonb
    )
  );
END;
$$;

-- ------------------------------------------------------------
-- 3. RPC ADMIN — écrire la config de paiement des missions
--    p_product_id      : identifiant produit Chariow (vide = retirer)
--    p_price_variants  : {"15000":"pvr_…"} montant exact -> variante
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_mission_payment_config(
  p_product_id text,
  p_price_variants jsonb
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product text;
  v_key text;
  v_value text;
  v_count integer := 0;
  v_amount integer;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès administrateur requis.' USING ERRCODE = 'TLAUT';
  END IF;

  v_product := COALESCE(btrim(p_product_id), '');
  IF v_product <> '' AND v_product !~ '^[A-Za-z0-9_-]{1,128}$' THEN
    RAISE EXCEPTION 'Identifiant produit invalide.' USING ERRCODE = 'TLBAD';
  END IF;

  IF p_price_variants IS NULL THEN
    p_price_variants := '{}'::jsonb;
  END IF;
  IF jsonb_typeof(p_price_variants) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Les variantes de prix doivent être un objet montant -> identifiant.' USING ERRCODE = 'TLBAD';
  END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(p_price_variants)) > 500 THEN
    RAISE EXCEPTION 'Trop de variantes de prix (500 maximum).' USING ERRCODE = 'TLBAD';
  END IF;

  FOR v_key, v_value IN SELECT k, value #>> '{}' FROM jsonb_each(p_price_variants) LOOP
    IF v_key !~ '^[0-9]{1,10}$' THEN
      RAISE EXCEPTION 'Montant invalide dans les variantes : %', v_key USING ERRCODE = 'TLBAD';
    END IF;
    v_amount := v_key::integer;
    IF v_amount < 1 OR v_amount > 100000000 THEN
      RAISE EXCEPTION 'Montant hors bornes (1..100000000) : %', v_amount USING ERRCODE = 'TLBAD';
    END IF;
    IF COALESCE(btrim(v_value), '') !~ '^[A-Za-z0-9_-]{1,128}$' THEN
      RAISE EXCEPTION 'Variante de prix invalide pour %.', v_amount USING ERRCODE = 'TLBAD';
    END IF;
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO public.app_settings (key, value, updated_at)
  VALUES ('mission_product_id', to_jsonb(v_product), now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  INSERT INTO public.app_settings (key, value, updated_at)
  VALUES ('mission_price_variants', p_price_variants, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  INSERT INTO public.admin_actions (admin_id, entity_type, entity_id, action, message, metadata)
  VALUES (
    auth.uid(), 'settings', NULL, 'set_mission_payment_config',
    'Paiement missions : produit = ' || NULLIF(v_product, '') || ', ' || v_count || ' variante(s) de prix.',
    jsonb_build_object('product_id', v_product, 'variants', v_count)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'product_id', v_product,
    'variants', v_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_mission_payment_config() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_mission_payment_config(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_mission_payment_config() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_mission_payment_config(text, jsonb) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
