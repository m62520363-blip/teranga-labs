-- 0034_client_token_orders.sql
--
-- Un client paie 1 Token par brief publie : il doit pouvoir acheter des
-- Tokens. Or token_orders.developer_id est NOT NULL avec cle etrangere
-- vers public.developers, et create_token_order (version 0028) exigeait
-- une ligne developers avant toute commande. Consequence : un compte
-- client pur ne pouvait commander ni en ligne (corrige au commit
-- 16c9c41 cote checkout) ni via le formulaire de commande manuelle.
--
-- Deux corrections :
--   1. create_token_order cree le profil minimal s'il manque, au lieu de
--      refuser la commande. Le statut 'pending' est celui d'une
--      inscription recue : c'est le seul statut du CHECK qui n'accorde
--      aucun acces et ne declenche pas de demande de verification.
--   2. create_token_order accepte desormais 'verified' en plus de
--      'active' pour le role non-client, comme le fait deja le checkout.
--      'verified' est le statut final d'un developpeur verifie (0027) :
--      sans cela, un developpeur verifie ne pouvait plus commander.
--
-- Les commandes creees pour un client portent le statut 'pending', donc
-- la validation humaine continue de s'appliquer : on ne contourne pas le
-- controle, on cesse d'exiger un profil qui n'a pas de sens pour un client.

create or replace function public.create_token_order(p_package_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_dev public.developers%rowtype;
  v_role text;
  v_pkg public.token_packages%rowtype;
  v_order public.token_orders%rowtype;
begin
  if v_user is null then
    raise exception 'Connectez-vous pour commander.' using errcode = 'TLNAU';
  end if;

  -- Profil developpeur minimal pour un client qui achete ses Tokens.
  -- Sans profil, token_orders.developer_id (NOT NULL, FK developers) rend
  -- l'insertion impossible.
  insert into public.developers (id, status)
  values (v_user, 'pending')
  on conflict (id) do nothing;

  select * into v_dev from public.developers where id = v_user;

  select role into v_role from public.user_roles where user_id = v_user;

  -- Un client peut commander meme non valide : il paie pour publier un
  -- brief, pas pour acceder a un espace developpeur.
  if v_dev.status not in ('active', 'verified') and v_role <> 'client' then
    if v_dev.status in ('pending', 'verification_pending') then
      raise exception 'Votre compte est en attente de validation.' using errcode = 'TLPEN';
    end if;
    raise exception 'Votre compte ne permet pas d''acheter des Tokens.' using errcode = 'TLRJC';
  end if;

  select * into v_pkg from public.token_packages where id = p_package_id;
  if v_pkg.id is null then
    raise exception 'Pack introuvable.' using errcode = 'TLNOP';
  end if;

  insert into public.token_orders (developer_id, package_id, package_name, tokens, price_fcfa)
  values (v_user, v_pkg.id, v_pkg.name, v_pkg.tokens, v_pkg.price_fcfa)
  returning * into v_order;

  return jsonb_build_object(
    'order_id', v_order.id,
    'package_name', v_order.package_name,
    'tokens', v_order.tokens,
    'price_fcfa', v_order.price_fcfa,
    'status', v_order.status
  );
end;
$$;

revoke all on function public.create_token_order(text) from public;
grant execute on function public.create_token_order(text) to authenticated;
