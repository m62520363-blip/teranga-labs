-- ============================================================
-- TERANGA LABS — Migration 0044 : Agences.
--
-- Une agence est une organisation qui regroupe plusieurs
-- développeurs validés. Chaque développeur appartient à UNE
-- seule agence au maximum (unique sur agency_members).
--
-- 1) Tables : agencies (+ code d'invitation secret) et agency_members.
-- 2) RLS : lecture publique des agences actives ; toute écriture via
--    RPC SECURITY DEFINER (jamais en ligne directe).
-- 3) RPC : create_agency, join_agency, rotate_agency_invite,
--    remove_agency_member, leave_agency, set_agency_status (admin),
--    list_agencies, get_agency, get_agency_by_developer, my_agency.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tables.
-- ------------------------------------------------------------
create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  bio text,
  logo_url text,
  city text,
  country text,
  website text,
  verified boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended')),
  invite_code uuid not null default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agencies_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,39}$')
);

create table if not exists public.agency_members (
  agency_id uuid not null references public.agencies(id) on delete cascade,
  developer_id uuid not null references auth.users(id) on delete cascade,
  role_in_agency text not null default 'member' check (role_in_agency in ('admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (agency_id, developer_id),
  unique (developer_id)
);

create index if not exists agencies_status_idx on public.agencies (status);
create index if not exists agencies_slug_idx on public.agencies (slug);

alter table public.agencies enable row level security;
alter table public.agency_members enable row level security;

-- Lecture publique : une agence n'apparaît qu'une fois active.
drop policy if exists agencies_select_public on public.agencies;
create policy agencies_select_public on public.agencies
  for select using (status = 'active');

-- Aucune écriture directe : tout passe par les RPC ci-dessous.

-- ------------------------------------------------------------
-- 2) Helpers.
-- ------------------------------------------------------------
create or replace function public.agency_role(p_agency uuid, p_user uuid default auth.uid())
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if p_agency is null or p_user is null then
    return null;
  end if;
  if exists (select 1 from public.agencies a where a.id = p_agency and a.owner_id = p_user) then
    return 'owner';
  end if;
  select role_in_agency into v_role
    from public.agency_members
   where agency_id = p_agency and developer_id = p_user;
  return v_role;
end;
$$;

-- ------------------------------------------------------------
-- 3) RPC — création.
-- ------------------------------------------------------------
create or replace function public.create_agency(
  p_name text,
  p_slug text,
  p_bio text default null,
  p_logo_url text default null,
  p_city text default null,
  p_country text default null,
  p_website text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_agency public.agencies%rowtype;
begin
  if v_user is null then
    raise exception 'Connectez-vous.' using errcode = 'TLAUT';
  end if;
  if nullif(btrim(p_name), '') is null or length(btrim(p_name)) < 2 then
    raise exception 'Nom d''agence trop court.' using errcode = 'TLBAD';
  end if;
  if v_slug = '' or v_slug !~ '^[a-z0-9][a-z0-9-]{1,39}$' then
    raise exception 'URL invalide (lettres minuscules, chiffres, tirets).' using errcode = 'TLBAD';
  end if;
  if exists (select 1 from public.agency_members where developer_id = v_user) then
    raise exception 'Vous êtes déjà membre d''une agence.' using errcode = 'TLAGM';
  end if;

  insert into public.agencies (
    name, slug, bio, logo_url, city, country, website, owner_id
  ) values (
    btrim(p_name), v_slug, nullif(btrim(coalesce(p_bio, '')), ''),
    nullif(btrim(coalesce(p_logo_url, '')), ''),
    nullif(btrim(coalesce(p_city, '')), ''),
    nullif(btrim(coalesce(p_country, '')), ''),
    nullif(btrim(coalesce(p_website, '')), '')
  )
  returning * into v_agency;

  insert into public.agency_members (agency_id, developer_id, role_in_agency)
  values (v_agency.id, v_user, 'admin');

  return jsonb_build_object('id', v_agency.id, 'slug', v_agency.slug);
end;
$$;

-- ------------------------------------------------------------
-- 4) RPC — rejoindre via code d'invitation.
-- ------------------------------------------------------------
create or replace function public.get_agency_by_invite(p_invite_code uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_agency public.agencies%rowtype;
begin
  if p_invite_code is null then
    raise exception 'Code d''invitation invalide.' using errcode = 'TLBAD';
  end if;
  select * into v_agency
    from public.agencies
   where invite_code = p_invite_code and status = 'active';
  if v_agency.id is null then
    raise exception 'Code d''invitation invalide.' using errcode = 'TLBAD';
  end if;
  return jsonb_build_object(
    'id', v_agency.id,
    'slug', v_agency.slug,
    'name', v_agency.name
  );
end;
$$;

create or replace function public.join_agency(
  p_agency_id uuid,
  p_invite_code uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_agency public.agencies%rowtype;
begin
  if v_user is null then
    raise exception 'Connectez-vous.' using errcode = 'TLAUT';
  end if;
  select * into v_agency from public.agencies where id = p_agency_id;
  if v_agency.id is null then
    raise exception 'Agence introuvable.' using errcode = 'TLNOK';
  end if;
  if v_agency.status <> 'active' then
    raise exception 'Cette agence n''est pas encore active.' using errcode = 'TLAGS';
  end if;
  if v_agency.invite_code <> p_invite_code then
    raise exception 'Code d''invitation invalide.' using errcode = 'TLBIN';
  end if;
  if exists (select 1 from public.agency_members where developer_id = v_user) then
    raise exception 'Vous êtes déjà membre d''une agence.' using errcode = 'TLAGM';
  end if;

  insert into public.agency_members (agency_id, developer_id, role_in_agency)
  values (v_agency.id, v_user, 'member');

  return jsonb_build_object('agency_id', v_agency.id, 'slug', v_agency.slug);
end;
$$;

-- ------------------------------------------------------------
-- 5) RPC — gestion des membres (admin / owner).
-- ------------------------------------------------------------
create or replace function public.rotate_agency_invite(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_code uuid;
begin
  if v_user is null then
    raise exception 'Connectez-vous.' using errcode = 'TLAUT';
  end if;
  v_role := public.agency_role(p_agency_id, v_user);
  if v_role is null or v_role = 'member' then
    raise exception 'Réservé à l''équipe de l''agence.' using errcode = 'TLAUT';
  end if;

  v_code := gen_random_uuid();
  update public.agencies set invite_code = v_code, updated_at = now()
   where id = p_agency_id;

  return jsonb_build_object('invite_code', v_code);
end;
$$;

create or replace function public.remove_agency_member(p_developer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_agency_id uuid;
  v_role text;
begin
  if v_user is null then
    raise exception 'Connectez-vous.' using errcode = 'TLAUT';
  end if;

  select agency_id into v_agency_id
    from public.agency_members where developer_id = v_user;
  if v_agency_id is null then
    raise exception 'Vous n''êtes membre d''aucune agence.' using errcode = 'TLAGS';
  end if;

  v_role := public.agency_role(v_agency_id, v_user);
  if v_role is null or v_role = 'member' then
    raise exception 'Réservé à l''équipe de l''agence.' using errcode = 'TLAUT';
  end if;

  if p_developer_id = (select owner_id from public.agencies where id = v_agency_id) then
    raise exception 'Impossible de retirer le fondateur.' using errcode = 'TLBAD';
  end if;

  -- Seul le fondateur peut retirer un autre administrateur.
  if public.agency_role(v_agency_id, p_developer_id) = 'admin'
     and public.agency_role(v_agency_id, v_user) <> 'owner' then
    raise exception 'Réservé au fondateur.' using errcode = 'TLAUT';
  end if;

  delete from public.agency_members
   where agency_id = v_agency_id and developer_id = p_developer_id;

  return jsonb_build_object('removed', p_developer_id);
end;
$$;

create or replace function public.leave_agency()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Connectez-vous.' using errcode = 'TLAUT';
  end if;
  if exists (select 1 from public.agencies where owner_id = v_user) then
    raise exception 'Le fondateur ne peut pas quitter son agence.' using errcode = 'TLBAD';
  end if;
  delete from public.agency_members where developer_id = v_user;
  return jsonb_build_object('left', v_user);
end;
$$;

create or replace function public.set_agency_status(p_agency_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès administrateur requis.' using errcode = 'TLAUT';
  end if;
  if p_status not in ('pending', 'active', 'suspended') then
    raise exception 'Statut invalide.' using errcode = 'TLBAD';
  end if;
  update public.agencies
     set status = p_status, updated_at = now()
   where id = p_agency_id;
  return jsonb_build_object('agency_id', p_agency_id, 'status', p_status);
end;
$$;

-- ------------------------------------------------------------
-- 6) RPC — lecture publique.
-- ------------------------------------------------------------
create or replace function public.list_agencies(
  p_limit integer default 24,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 24), 60));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
begin
  return coalesce((
    select jsonb_agg(jb order by jb->>'name')
    from (
      select jsonb_build_object(
        'id', a.id,
        'slug', a.slug,
        'name', a.name,
        'bio', a.bio,
        'logo_url', a.logo_url,
        'city', a.city,
        'country', a.country,
        'website', a.website,
        'verified', a.verified,
        'members_count', (
          select count(*) from public.agency_members am where am.agency_id = a.id
        )
      ) as jb
      from public.agencies a
     where a.status = 'active'
     order by a.name
     limit v_limit offset v_offset
    ) t
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_agency(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_slug text := lower(nullif(btrim(coalesce(p_slug, '')), ''));
  v_agency public.agencies%rowtype;
begin
  if v_slug is null then
    raise exception 'Agence introuvable.' using errcode = 'TLNOK';
  end if;
  select * into v_agency from public.agencies where slug = v_slug and status = 'active';
  if v_agency.id is null then
    raise exception 'Agence introuvable.' using errcode = 'TLNOK';
  end if;

  return jsonb_build_object(
    'id', v_agency.id,
    'slug', v_agency.slug,
    'name', v_agency.name,
    'bio', v_agency.bio,
    'logo_url', v_agency.logo_url,
    'city', v_agency.city,
    'country', v_agency.country,
    'website', v_agency.website,
    'verified', v_agency.verified,
    'owner_id', v_agency.owner_id,
    'created_at', v_agency.created_at,
    'members_count', (
      select count(*) from public.agency_members am where am.agency_id = v_agency.id
    ),
    'members', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'developer_id', d.id,
          'username', d.username,
          'full_name', d.full_name,
          'avatar_url', d.avatar_url,
          'main_specialty', dp.main_specialty,
          'is_verified', d.is_verified,
          'reputation_score', d.reputation_score
        )
        order by (am.role_in_agency = 'admin') desc, d.full_name
      )
      from public.agency_members am
      join public.developers d on d.id = am.developer_id and d.status in ('active', 'verified')
      left join public.developer_profiles dp on dp.developer_id = d.id
     where am.agency_id = v_agency.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_agency_by_developer(p_developer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_agency public.agencies%rowtype;
begin
  select a.* into v_agency
    from public.agencies a
    join public.agency_members am on am.agency_id = a.id
   where am.developer_id = p_developer_id
     and a.status = 'active';
  if v_agency.id is null then
    return null;
  end if;
  return jsonb_build_object(
    'id', v_agency.id,
    'slug', v_agency.slug,
    'name', v_agency.name,
    'logo_url', v_agency.logo_url
  );
end;
$$;

create or replace function public.my_agency()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user uuid := auth.uid();
  v_agency public.agencies%rowtype;
  v_role text;
begin
  if v_user is null then
    return null;
  end if;
  select a.* into v_agency
    from public.agencies a
    join public.agency_members am on am.agency_id = a.id
   where am.developer_id = v_user;
  if v_agency.id is null then
    return null;
  end if;
  v_role := public.agency_role(v_agency.id, v_user);

  return jsonb_build_object(
    'id', v_agency.id,
    'slug', v_agency.slug,
    'name', v_agency.name,
    'bio', v_agency.bio,
    'logo_url', v_agency.logo_url,
    'city', v_agency.city,
    'country', v_agency.country,
    'website', v_agency.website,
    'verified', v_agency.verified,
    'status', v_agency.status,
    'my_role', v_role,
    'invite_code', case when v_role in ('owner', 'admin') then v_agency.invite_code else null end,
    'members', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'developer_id', d.id,
          'username', d.username,
          'full_name', d.full_name,
          'avatar_url', d.avatar_url,
          'role_in_agency', am.role_in_agency,
          'is_verified', d.is_verified
        )
        order by (am.role_in_agency = 'admin') desc, d.full_name
      )
      from public.agency_members am
      join public.developers d on d.id = am.developer_id
     where am.agency_id = v_agency.id
    ), '[]'::jsonb)
  );
end;
$$;

-- ------------------------------------------------------------
-- 7) Accès.
-- ------------------------------------------------------------
grant execute on function public.create_agency(text, text, text, text, text, text, text) to authenticated;
grant execute on function public.get_agency_by_invite(uuid) to authenticated;
grant execute on function public.join_agency(uuid, uuid) to authenticated;
grant execute on function public.rotate_agency_invite(uuid) to authenticated;
grant execute on function public.remove_agency_member(uuid) to authenticated;
grant execute on function public.leave_agency() to authenticated;
grant execute on function public.set_agency_status(uuid, text) to authenticated;
grant execute on function public.list_agencies(integer, integer) to anon, authenticated;
grant execute on function public.get_agency(text) to anon, authenticated;
grant execute on function public.get_agency_by_developer(uuid) to anon, authenticated;
grant execute on function public.my_agency() to authenticated;