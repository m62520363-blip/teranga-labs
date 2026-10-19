-- ============================================================
-- TERANGA LABS — Migration 0054 : passage au paiement Chariow
--
-- Le prestataire unique de paiement devient Chariow (API +
-- Pulses). La méthode de vérification `chariow` remplace `wave`
-- pour les NOUVELLES demandes ; l'ancien libellé `wave` reste
-- accepté par la contrainte pour ne pas casser les lignes
-- historiques déjà en base.
--
-- À appliquer APRES 0053 (ouvia SQL Editor) :
--   1. verification_requests.method : + 'chariow'
--   2. submit_verification_request  : défaut 'chariow',
--      garde acceptant 'chariow' | 'max_it' | 'wave'
-- ============================================================

-- 1) Contrainte CHECK de la méthode ------------------------------------
alter table public.verification_requests
  drop constraint if exists verification_requests_method_check;

alter table public.verification_requests
  add constraint verification_requests_method_check
  check (method in ('chariow', 'max_it', 'wave'));

-- 2) RPC d'ouverture de demande ----------------------------------------
create or replace function public.submit_verification_request(p_method text default 'chariow')
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_user uuid := auth.uid();
  v_dev public.developers%rowtype;
  v_price integer;
  v_existing uuid;
  v_req uuid;
begin
  if v_user is null then
    raise exception 'Connectez-vous pour demander la vérification.' using errcode = 'TLNAU';
  end if;

  select * into v_dev from public.developers where id = v_user;
  if v_dev.id is null then
    raise exception 'Profil développeur requis.' using errcode = 'TLNOD';
  end if;

  if v_dev.status not in ('active', 'verified') then
    if v_dev.status in ('pending', 'verification_pending') then
      raise exception 'Votre compte n''est pas (encore) éligible à la vérification.' using errcode = 'TLPEN';
    end if;
    raise exception 'Votre compte ne permet pas de demander la vérification.' using errcode = 'TLRJC';
  end if;

  if p_method not in ('chariow', 'max_it', 'wave') then
    raise exception 'Méthode de paiement invalide.' using errcode = 'TLBAD';
  end if;

  select id into v_existing
    from public.verification_requests
   where developer_id = v_user
     and verification_status = 'pending';

  if v_existing is not null then
    raise exception 'Une demande de vérification est déjà en cours.' using errcode = 'TLDUP';
  end if;

  v_price := public.get_verification_price();
  if v_price is null or v_price <= 0 then
    raise exception 'La vérification est indisponible pour le moment.' using errcode = 'TLNOP';
  end if;

  insert into public.verification_requests (developer_id, amount_fcfa, method)
  values (v_user, v_price, p_method)
  returning id into v_req;

  insert into public.payments (
    developer_id, kind, method, amount_fcfa, currency, status,
    provider, entity_type, entity_id
  )
  values (
    v_user, 'verification', p_method, v_price, 'XOF', 'pending',
    p_method, 'verification_request', v_req
  );

  return jsonb_build_object('ok', true, 'request_id', v_req, 'amount_fcfa', v_price);
end;
$$;

grant execute on function public.submit_verification_request(text) to authenticated;
