-- 0024 : un email par compte (natif Supabase) + un numéro WhatsApp par compte.
-- La règle est appliquée à la source (auth.users -> developers / client_profiles)
-- et exposée via is_phone_taken pour un message clair avant la soumission.

create or replace function public.normalize_phone(p_phone text)
returns text
language sql
immutable
parallel safe
as $$
  select case
    when p_phone is null or btrim(p_phone) = '' then null
    else right(regexp_replace(p_phone, '\D', '', 'g'), 9)
  end
$$;

-- ------------------------------------------------------------
-- Réconciliation des données existantes : le numéro 774974560
-- était présent sur deux comptes « Babacar Gueye ».
-- Le compte actif (b39162156@gmail.com) conserve le numéro ;
-- l'ancien compte suspendu (m62520363@gmail.com) est neutralisé.
-- ------------------------------------------------------------
update public.developers
set whatsapp = null
where id = 'f8149b8c-99cf-40d8-b158-49491b15fb62';

update public.client_profiles
set phone = null
where id = 'f8149b8c-99cf-40d8-b158-49491b15fb62';

-- ------------------------------------------------------------
-- Clé normalisée + index unique (garde-fou dur, toutes mises
-- à jour comprises : inscription ET modification de profil).
-- ------------------------------------------------------------
alter table public.developers
  add column if not exists whatsapp_key text
  generated always as (public.normalize_phone(whatsapp)) stored;

alter table public.client_profiles
  add column if not exists phone_key text
  generated always as (public.normalize_phone(phone)) stored;

create unique index if not exists developers_whatsapp_key_idx
  on public.developers (whatsapp_key)
  where whatsapp_key is not null;

create unique index if not exists client_profiles_phone_key_idx
  on public.client_profiles (phone_key)
  where phone_key is not null;

-- ------------------------------------------------------------
-- Message convivial avant la violation d'index : contrôle
-- croisé developers ET client_profiles (un numéro, un compte).
-- ------------------------------------------------------------
create or replace function public.check_phone_unique()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  if tg_table_name = 'developers' then
    v_key := public.normalize_phone(new.whatsapp);
  elsif tg_table_name = 'client_profiles' then
    v_key := public.normalize_phone(new.phone);
  else
    return new;
  end if;

  if v_key is not null and (
    exists (
      select 1 from public.developers
      where id <> new.id and public.normalize_phone(whatsapp) = v_key
    )
    or exists (
      select 1 from public.client_profiles
      where id <> new.id and public.normalize_phone(phone) = v_key
    )
  ) then
    raise exception 'TLWA: Ce numéro WhatsApp est déjà associé à un autre compte.';
  end if;

  return new;
end;
$$;

drop trigger if exists developers_whatsapp_unique_tg on public.developers;
create trigger developers_whatsapp_unique_tg
  before insert or update of whatsapp on public.developers
  for each row execute function public.check_phone_unique();

drop trigger if exists client_profiles_phone_unique_tg on public.client_profiles;
create trigger client_profiles_phone_unique_tg
  before insert or update of phone on public.client_profiles
  for each row execute function public.check_phone_unique();

-- ------------------------------------------------------------
-- Contrôle pré-inscription exposé (si indisponible -> false) :
-- visible par anon + authenticated pour vérifier avant submit.
-- ------------------------------------------------------------
create or replace function public.is_phone_taken(p_phone text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(
    select 1 from public.developers
    where public.normalize_phone(whatsapp) = public.normalize_phone(p_phone)
  )
  or exists(
    select 1 from public.client_profiles
    where public.normalize_phone(phone) = public.normalize_phone(p_phone)
  )
$$;

revoke execute on function public.is_phone_taken(text) from public, anon, authenticated;
grant execute on function public.is_phone_taken(text) to anon, authenticated;

-- Recharge du cache PostgREST pour exposer la nouvelle fonction.
notify pgrst, 'reload schema';