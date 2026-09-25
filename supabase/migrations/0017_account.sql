-- 0017_account.sql
-- Suppression de compte autonome (le client se supprime lui-même).
-- La fonction est SECURITY DEFINER : seul l'utilisateur connecté est supprimé
-- (auth.uid()), avec nettoyage ordonné de ses lignes publiques puis du
-- compte auth. Aucune clé service_role nécessaire côté application.

create or replace function public.delete_account(p_confirm text default '')
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Connectez-vous pour supprimer votre compte.' using errcode = 'TLNAU';
  end if;

  if nullif(btrim(coalesce(p_confirm, '')), '') <> 'SUPPRIMER' then
    raise exception 'Confirmation requise : tapez SUPPRIMER.' using errcode = 'TLBAD';
  end if;

  -- Nettoyage ordonne des lignes publiques liees a l'utilisateur.
  delete from public.token_refund_requests tr
    using public.unlocks u
   where tr.unlock_id = u.id and u.developer_id = v_uid;

  delete from public.messages m
    using public.conversations c
   where m.conversation_id = c.id
     and (c.developer_id = v_uid or c.client_id = v_uid);

  delete from public.formal_offers o
    using public.conversations c
   where o.conversation_id = c.id
     and (c.developer_id = v_uid or c.client_id = v_uid);

  delete from public.conversations
   where developer_id = v_uid or client_id = v_uid;

  delete from public.unlocks where developer_id = v_uid;
  delete from public.reviews where developer_id = v_uid or client_id = v_uid;
  delete from public.token_transactions where developer_id = v_uid;
  delete from public.token_orders where developer_id = v_uid;
  delete from public.reports where reporter_id = v_uid;
  delete from public.user_roles where user_id = v_uid;
  delete from public.requests where client_id = v_uid;
  delete from public.client_profiles where id = v_uid;
  delete from public.developers where id = v_uid;

  -- Suppression du compte auth (cascade sur auth.identities).
  delete from auth.users where id = v_uid;

  return jsonb_build_object('deleted', true);
end;
$$;