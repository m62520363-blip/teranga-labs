-- 0082_developer_profile_enhancements.sql
-- Ajout des champs disponibilité, tarif journalier et statistiques de profil.

-- 1. Nouveaux champs sur developers
alter table public.developers
  add column if not exists available boolean not null default true,
  add column if not exists daily_rate_fcfa integer,
  add column if not exists profile_views integer not null default 0,
  add column if not exists total_unlocks integer not null default 0,
  add column if not exists response_rate numeric(5,2);

-- 2. Fonction pour incrémenter les vues de profil
create or replace function public.increment_profile_views(p_developer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.developers
  set profile_views = profile_views + 1
  where id = p_developer_id;
end;
$$;

grant execute on function public.increment_profile_views(uuid) to anon, authenticated;

-- 3. Fonction pour mettre à jour la disponibilité et le tarif
create or replace function public.update_developer_availability(
  p_available boolean,
  p_daily_rate_fcfa integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Authentification requise.' using errcode = 'TLAUT';
  end if;

  update public.developers
  set available = p_available,
      daily_rate_fcfa = p_daily_rate_fcfa,
      updated_at = now()
  where id = v_uid;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.update_developer_availability(boolean, integer) to authenticated;

-- 4. Fonction pour calculer le taux de réponse
create or replace function public.refresh_developer_response_rate(p_developer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_responded integer;
  v_rate numeric(5,2);
begin
  select count(*)::integer into v_total
  from public.conversations
  where developer_id = p_developer_id;

  select count(*)::integer into v_responded
  from public.conversations
  where developer_id = p_developer_id
    and exists (
      select 1 from public.messages m
      where m.conversation_id = conversations.id
        and m.sender_id = p_developer_id
    );

  if v_total > 0 then
    v_rate := round((v_responded::numeric / v_total::numeric) * 100, 2);
  else
    v_rate := null;
  end if;

  update public.developers
  set response_rate = v_rate,
      total_unlocks = (select count(*)::integer from public.unlocks where developer_id = p_developer_id)
  where id = p_developer_id;
end;
$$;

grant execute on function public.refresh_developer_response_rate(uuid) to authenticated, service_role;
