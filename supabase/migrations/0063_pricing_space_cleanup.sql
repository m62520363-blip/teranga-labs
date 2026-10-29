-- ============================================================
-- 0063_pricing_space_cleanup.sql
-- Tarifs : Pro = 3 tokens/30j, Agence = 4 tokens. Suppression
-- du sponsoring. Nettoyage de l'espace dev.
-- NON destructif, idempotent.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Tarifs mis à jour
-- ------------------------------------------------------------
-- `key` doit etre qualifie : dans ON CONFLICT ... DO UPDATE, la table
-- virtuelle `excluded` porte les memes colonnes que la cible, donc un nom
-- nu y est ambigu (erreur 42702 "column reference is ambiguous").
INSERT INTO public.app_settings (key, value) VALUES
  ('pro_price_tokens', '3'::jsonb),
  ('pro_duration_days', '30'::jsonb),
  ('agency_price_tokens', '4'::jsonb),
  ('agency_duration_days', '30'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
WHERE app_settings.key IN ('pro_price_tokens', 'pro_duration_days', 'agency_price_tokens', 'agency_duration_days');

-- ------------------------------------------------------------
-- 2. Contrainte CHECK : autoriser le type 'agency_creation'
--    introduce par debit_tokens dans create_agency (section 3).
--    Sans cela, TOUTE creation d'agence echouerait sur
--    token_transactions_type_check (derniere definition : 0055,
--    qui n'anticipe pas ce type).
--    Idempotent : drop if exists + re-add.
-- ------------------------------------------------------------
alter table public.token_transactions
  drop constraint if exists token_transactions_type_check;

alter table public.token_transactions
  add constraint token_transactions_type_check
  check (type in (
    'purchase',        -- achat de pack (Pulse Chariow / admin)
    'unlock',          -- deblocage d'un contact
    'bonus',           -- bonus divers
    'publish',         -- publication d'un brief
    'contact',         -- contact direct payant
    'adjust',          -- ajustement administrateur
    'gift',            -- offre de bienvenue / cadeau
    'reward',          -- recompense de classement
    'sponsor',         -- sponsoring de profil (OBSOLETE, conserve pour l'historique)
    'sponsor_brief',   -- sponsoring de brief (OBSOLETE, conserve pour l'historique)
    'pro',             -- abonnement PRO
    'agency_creation'  -- creation d'agence (0063)
  ));

-- ------------------------------------------------------------
-- 3. create_agency avec débit de tokens (4 tokens, idempotent)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_agency(
  p_name TEXT,
  p_slug TEXT,
  p_bio TEXT DEFAULT NULL,
  p_logo_url TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_website TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_balance integer;
  v_cost integer;
  v_agency_id uuid;
  v_existing public.agencies%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;

  -- Vérifier que l'utilisateur n'a pas déjà une agence.
  SELECT * INTO v_existing FROM public.agencies WHERE owner_id = v_user LIMIT 1;
  IF v_existing.id IS NOT NULL THEN
    RAISE EXCEPTION 'Vous avez déjà une agence.' USING ERRCODE = 'TLDUP';
  END IF;

  v_cost := coalesce(
    (select (value #>> '{}')::integer from public.app_settings where key = 'agency_price_tokens'),
    4
  );

  -- Vérifier le solde.
  SELECT coalesce(sum(amount), 0) INTO v_balance
    FROM public.token_transactions
   WHERE developer_id = v_user;
  IF v_balance < v_cost THEN
    -- RAISE EXCEPTION n'accepte pas la concatenation "||" : placeholders "%".
    RAISE EXCEPTION 'Tokens insuffisants pour créer une agence (il en faut %).', v_cost USING ERRCODE = 'TLLOW';
  END IF;

  -- Débiter les tokens (idempotent via request_id).
  PERFORM public.debit_tokens(
    v_user,
    v_cost,
    'agency_creation',
    NULL::uuid
  );

  -- Créer l'agence.
  INSERT INTO public.agencies (
    owner_id, name, slug, bio, logo_url, city, country, website
  ) VALUES (
    v_user, p_name, p_slug, p_bio, p_logo_url, p_city, p_country, p_website
  ) RETURNING id INTO v_agency_id;

  -- Ajouter le propriétaire comme membre admin.
  INSERT INTO public.agency_members (agency_id, user_id, role)
  VALUES (v_agency_id, v_user, 'admin');

  PERFORM public.notify_user(
    v_user,
    'agency_created',
    'Agence créée',
    'Votre agence « ' || p_name || ' » a été créée avec succès.',
    '/dashboard/agency'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'agency_id', v_agency_id,
    'tokens_spent', v_cost
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_agency(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_agency(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- 4. Retirer le sponsoring de l'espace dev (REVOKE authenticated)
-- ------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.sponsor_dev_profile(uuid, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sponsor_brief(uuid, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_sponsor_payment_link(uuid, integer, text) FROM authenticated;

-- Marquer les fonctions comme obsolètes (ne pas DROP pour compat).
COMMENT ON FUNCTION public.sponsor_dev_profile(uuid, integer) IS 'OBSOLÈTE: sponsoring supprimé. Utilisez le wallet.';
COMMENT ON FUNCTION public.sponsor_brief(uuid, integer) IS 'OBSOLÈTE: sponsoring supprimé. Utilisez le wallet.';
COMMENT ON FUNCTION public.generate_sponsor_payment_link(uuid, integer, text) IS 'OBSOLÈTE: sponsoring supprimé. Utilisez le wallet.';

COMMIT;
