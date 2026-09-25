-- ============================================================
-- TERANGA LABS — Migration 0009 : Compte Développeur Pro
-- Carte de visite digitale (/dev/[username]), mini-CRM, garantie Token.
-- NB : la numérotation 0005 demandée était déjà utilisée par
-- 0005_payments.sql, d'où 0009 (fin de la chaîne 0001 → 0008).
-- ============================================================

-- ------------------------------------------------------------
-- 1. developers : fiche publique extensible
-- ------------------------------------------------------------
alter table public.developers
  add column username text,
  add column bio text,
  add column avatar_url text,
  add column portfolio_links jsonb not null default '[]'::jsonb,
  add column is_verified boolean not null default false,
  add column experience_years integer not null default 1;

-- username : unique, nullable (rétrocompatibilité), format SEO sûr.
create unique index developers_username_uidx on public.developers (username)
  where username is not null;

alter table public.developers
  add constraint developers_username_format
  check (
    username is null
    or username ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  );

alter table public.developers
  add constraint developers_experience_range
  check (experience_years between 0 and 100);

-- Protège les colonnes gérées par la modération : un développeur ne peut
-- JAMAIS s'auto-valider (status) ni s'octroyer le badge (is_verified).
create function public.developers_protect_managed_cols()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_role text := coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role', '');
begin
  if v_role <> 'service_role' and not public.is_admin() then
    new.status := old.status;
    new.is_verified := old.is_verified;
  end if;
  return new;
end;
$$;

create trigger developers_protect_managed_cols_trigger
  before update on public.developers
  for each row
  execute function public.developers_protect_managed_cols();

-- ------------------------------------------------------------
-- 2. unlocks : mini-CRM personnel du développeur
-- ------------------------------------------------------------
alter table public.unlocks
  add column crm_status text not null default 'a_contacter',
  add column notes text;

alter table public.unlocks
  add constraint unlocks_crm_status_check
  check (crm_status in ('a_contacter', 'en_discussion', 'gagne', 'perdu'));

-- ------------------------------------------------------------
-- 3. token_refund_requests : garantie Token (remboursement 1 clic)
-- ------------------------------------------------------------
create table public.token_refund_requests (
  id uuid primary key default gen_random_uuid(),
  unlock_id uuid not null references public.unlocks(id) on delete cascade,
  developer_id uuid not null references public.developers(id) on delete cascade,
  reason text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint token_refund_requests_status_check
    check (status in ('pending', 'approved', 'rejected'))
);

-- Une seule demande en attente par déblocage.
create unique index token_refund_requests_pending_uidx
  on public.token_refund_requests (unlock_id)
  where status = 'pending';

-- ------------------------------------------------------------
-- 4. RPC sécurisées (SECURITY DEFINER)
-- ------------------------------------------------------------

-- update_unlock_crm : le développeur pilote ses contacts débloqués.
create or replace function public.update_unlock_crm(
  p_unlock_id uuid,
  p_status text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_unlock public.unlocks%rowtype;
  v_notes text;
begin
  if v_user_id is null then
    raise exception 'Connectez-vous pour modifier vos contacts.' using errcode = 'TLNAU';
  end if;

  if p_status is null or p_status not in ('a_contacter', 'en_discussion', 'gagne', 'perdu') then
    raise exception 'Statut CRM invalide.' using errcode = 'TLBAD';
  end if;

  v_notes := nullif(btrim(coalesce(p_notes, '')), '');

  select * into v_unlock from public.unlocks where id = p_unlock_id;
  if v_unlock.id is null or v_unlock.developer_id <> v_user_id then
    raise exception 'Déblocage introuvable.' using errcode = 'TLNOU';
  end if;

  update public.unlocks
     set crm_status = p_status,
         notes = v_notes
   where id = p_unlock_id;

  return jsonb_build_object(
    'unlock_id', p_unlock_id,
    'crm_status', p_status,
    'notes', v_notes
  );
end;
$$;

-- request_token_refund : garantie Token, 1 clic, sans doublon en attente.
create or replace function public.request_token_refund(
  p_unlock_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_unlock public.unlocks%rowtype;
  v_reason text;
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'Connectez-vous pour contester un déblocage.' using errcode = 'TLNAU';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null then
    raise exception 'Précisez le motif de la demande (ex : faux numéro WhatsApp).' using errcode = 'TLBAD';
  end if;
  if length(v_reason) > 1000 then
    raise exception 'Motif trop long (1000 caractères maximum).' using errcode = 'TLBAD';
  end if;

  select * into v_unlock from public.unlocks where id = p_unlock_id;
  if v_unlock.id is null or v_unlock.developer_id <> v_user_id then
    raise exception 'Déblocage introuvable.' using errcode = 'TLNOU';
  end if;

  if exists (
    select 1 from public.token_refund_requests
    where unlock_id = p_unlock_id and status = 'pending'
  ) then
    raise exception 'Une demande de remboursement est déjà en cours pour ce contact.' using errcode = 'TLDUP';
  end if;

  insert into public.token_refund_requests (unlock_id, developer_id, reason)
  values (p_unlock_id, v_user_id, v_reason)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'unlock_id', p_unlock_id, 'status', 'pending');
end;
$$;

-- get_public_developer_profile : carte de visite publique. Accepte un
-- username OU un uuid (couvre /dev/moussa et /dev/[id]).
create or replace function public.get_public_developer_profile(
  p_identifier text
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_identifier text := nullif(btrim(p_identifier), '');
  v_dev public.developers%rowtype;
begin
  if v_identifier is null then
    raise exception 'Profil introuvable.' using errcode = 'TLNOK';
  end if;

  if v_identifier ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select * into v_dev
      from public.developers
     where id = v_identifier::uuid
       and status = 'active';
  else
    select * into v_dev
      from public.developers
     where username = lower(v_identifier)
       and status = 'active';
  end if;

  if v_dev.id is null then
    raise exception 'Profil introuvable.' using errcode = 'TLNOK';
  end if;

  return jsonb_build_object(
    'id', v_dev.id,
    'username', v_dev.username,
    'full_name', v_dev.full_name,
    'bio', v_dev.bio,
    'avatar_url', v_dev.avatar_url,
    'city', v_dev.city,
    'whatsapp', v_dev.whatsapp,
    'skills', coalesce(v_dev.skills::jsonb, '[]'::jsonb),
    'experience_years', v_dev.experience_years,
    'is_verified', v_dev.is_verified,
    'portfolio_links', coalesce(v_dev.portfolio_links, '[]'::jsonb),
    'projects_count', (
      select count(*)::integer from public.unlocks u
       where u.developer_id = v_dev.id
    ),
    'review_count', (
      select count(*)::integer from public.reviews r
       where r.developer_id = v_dev.id
    ),
    'review_average', (
      select round(coalesce(avg(r.rating), 0), 1)::numeric
        from public.reviews r
       where r.developer_id = v_dev.id
    ),
    'reviews', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'rating', r.rating,
          'comment', r.comment,
          'request_name', req.client_name,
          'created_at', r.created_at
        )
        order by r.created_at desc
      )
      from public.reviews r
      left join public.requests req on req.id = r.request_id
      where r.developer_id = v_dev.id
        and r.rating >= 3
    ), '[]'::jsonb)
  );
end;
$$;

-- ------------------------------------------------------------
-- get_my_unlocks étendu : expose le CRM + le statut de garantie.
-- ------------------------------------------------------------
create or replace function public.get_my_unlocks()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'unlock_id', u.id,
        'request_id', r.id,
        'client_name', r.client_name,
        'client_city', r.client_city,
        'project_type', r.project_type,
        'budget', r.budget,
        'client_whatsapp', r.client_whatsapp,
        'unlocked_at', u.created_at,
        'crm_status', u.crm_status,
        'notes', u.notes,
        'refund_status', tr.status
      )
      order by u.created_at desc
    ),
    '[]'::jsonb
  )
  from public.unlocks u
  join public.requests r on r.id = u.request_id
  left join public.token_refund_requests tr
    on tr.unlock_id = u.id
   and tr.status = 'pending'
  where u.developer_id = auth.uid();
$$;

-- ------------------------------------------------------------
-- Privilèges : uniquement via les RPC (jamais de table directe).
-- ------------------------------------------------------------
grant execute on function public.update_unlock_crm(uuid, text, text) to authenticated;
grant execute on function public.request_token_refund(uuid, text) to authenticated;
grant execute on function public.get_public_developer_profile(text) to anon, authenticated;
grant execute on function public.get_my_unlocks() to authenticated;