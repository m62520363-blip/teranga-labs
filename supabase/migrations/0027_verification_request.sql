-- ============================================================
-- TERANGA LABS — Migration 0027 : demande de vérification
-- côté développeur + cycle de statut complet.
--
-- Cycle :
--   active/verified
--     → submit_verification_request()      : request (payment pending)
--     → admin_confirm_verification_payment : status 'verification_pending'
--     → admin_review_verification
--         approve → 'verified' , is_verified = true
--         reject  → retour 'active' (reste actif, demande rejetée)
-- ============================================================

-- ------------------------------------------------------------
-- RPC SITE — ouvrir une demande de vérification
-- Validation serveur du prix et de la méthode ; idempotent par
-- développeur (une seule demande 'pending' à la fois). Ne touche
-- PAS developers.status (colonne gérée + trigger) : le basculement
-- vers 'verification_pending' se fait uniquement à la confirmation
-- du paiement (admin/service_role).
-- ------------------------------------------------------------
create or replace function public.submit_verification_request(p_method text default 'wave')
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

  if p_method not in ('wave', 'max_it') then
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

-- ------------------------------------------------------------
-- admin_confirm_verification_payment : bascule le développeur en
-- 'verification_pending' UNE FOIS le paiement encaissé (admin ou
-- service_role, donc jamais bloqué par le trigger).
-- ------------------------------------------------------------
create or replace function public.admin_confirm_verification_payment(p_verification uuid)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_req public.verification_requests%rowtype;
begin
  if not public.is_admin()
     and current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  select * into v_req from public.verification_requests where id = p_verification;
  if v_req.id is null then
    raise exception 'Demande de vérification introuvable.' using errcode = 'TLNOR';
  end if;

  if v_req.payment_status = 'confirmed' then
    return jsonb_build_object('verification_id', p_verification, 'payment_status', 'confirmed', 'already', true);
  end if;

  if v_req.payment_status <> 'pending' then
    raise exception 'Paiement non concerné par une confirmation.' using errcode = 'TLDUP';
  end if;

  update public.verification_requests
     set payment_status = 'confirmed',
         paid_at = now()
   where id = p_verification;

  update public.payments
     set status = 'confirmed', confirmed_at = now()
   where entity_type = 'verification_request'
     and entity_id = p_verification;

  update public.developers
     set status = 'verification_pending'
   where id = v_req.developer_id;

  perform public.notify_user(
    v_req.developer_id, 'payment_confirmed',
    'Paiement de la vérification confirmé',
    'Merci ! Votre profil est maintenant en cours de vérification par l''équipe TERANGA LABS.',
    '/verification'
  );

  insert into public.admin_actions (admin_id, entity_type, entity_id, action, message)
  values (
    case when public.is_admin() then auth.uid() else null end,
    'verification_request', p_verification, 'confirm_payment', 'Paiement confirmé'
  );

  return jsonb_build_object('verification_id', p_verification, 'payment_status', 'confirmed');
end;
$$;

-- ------------------------------------------------------------
-- admin_review_verification : approbation → 'verified' ; refus →
-- retour à 'active' (le développeur reste approuvé, il peut
-- redemander). Idempotent : ne jamais re-traiter un déjà examiné
-- (sauf idem approve pour rattraper une notification manquée).
-- ------------------------------------------------------------
create or replace function public.admin_review_verification(
  p_verification uuid,
  p_approve boolean,
  p_message text default null
)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_req public.verification_requests%rowtype;
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  select * into v_req from public.verification_requests where id = p_verification;
  if v_req.id is null then
    raise exception 'Demande de vérification introuvable.' using errcode = 'TLNOR';
  end if;

  if v_req.payment_status <> 'confirmed' then
    raise exception 'Le paiement doit être confirmé avant l''examen de la vérification.' using errcode = 'TLPEN';
  end if;

  if not p_approve and v_message is null then
    raise exception 'Précisez le motif du refus.' using errcode = 'TLBAD';
  end if;

  if p_approve and v_req.verification_status = 'verified' then
    return jsonb_build_object(
      'verification_id', p_verification,
      'verification_status', 'verified', 'already', true
    );
  end if;

  if p_approve then
    update public.verification_requests
       set verification_status = 'verified',
           reviewed_by = auth.uid(),
           reviewed_at = now()
     where id = p_verification;

    -- Le trigger envoie la notification « Badge Vérifié obtenu ».
    update public.developers
       set is_verified = true,
           status = 'verified'
     where id = v_req.developer_id;
  else
    update public.verification_requests
       set verification_status = 'rejected',
           reviewed_by = auth.uid(),
           reviewed_at = now(),
           rejection_reason = v_message
     where id = p_verification;

    update public.developers
       set status = 'active'
     where id = v_req.developer_id
       and status = 'verification_pending';

    perform public.notify_user(
      v_req.developer_id, 'verification_rejected',
      'Vérification de profil refusée',
      v_message,
      '/verification'
    );
  end if;

  insert into public.admin_actions (admin_id, entity_type, entity_id, action, message)
  values (auth.uid(), 'verification_request', p_verification,
          case when p_approve then 'approve_verification' else 'reject_verification' end,
          v_message);

  return jsonb_build_object(
    'verification_id', p_verification,
    'verification_status', case when p_approve then 'verified' else 'rejected' end
  );
end;
$$;