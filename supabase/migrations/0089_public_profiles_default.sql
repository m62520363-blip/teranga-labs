-- 0089_public_profiles_default.sql
-- Rend les profils développeurs publics par défaut.

-- 1. Changer la valeur par défaut
alter table public.developers
  alter column is_public set default true;

-- 2. Mettre à jour tous les développeurs existants
update public.developers
set is_public = true
where is_public = false;

-- 3. RPC pour basculer la visibilité du profil
create or replace function public.toggle_developer_public(p_is_public boolean)
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
  set is_public = p_is_public,
      updated_at = now()
  where id = v_uid;

  if not found then
    raise exception 'Profil introuvable.' using errcode = 'TLNOK';
  end if;

  return jsonb_build_object('ok', true, 'is_public', p_is_public);
end;
$$;

grant execute on function public.toggle_developer_public(boolean) to authenticated;
