-- 0083_developer_cover_photo.sql
-- Ajout du champ cover_url pour la photo de couverture du profil développeur.

alter table public.developers
  add column if not exists cover_url text;

-- RPC pour mettre à jour la photo de couverture
create or replace function public.update_developer_cover(p_cover_url text)
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
  set cover_url = p_cover_url,
      updated_at = now()
  where id = v_uid;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.update_developer_cover(text) to authenticated;
