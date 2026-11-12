-- 0085_brief_edit_delete.sql
-- Ajout des RPC pour modifier et supprimer un brief côté client.

-- 1. Modifier un brief (contenu)
create or replace function public.update_brief_content(
  p_management_key uuid,
  p_client_name text default null,
  p_client_whatsapp text default null,
  p_project_type text default null,
  p_budget integer default null,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.requests%rowtype;
begin
  select * into v_req from public.requests where management_key = p_management_key;
  if v_req.id is null then
    raise exception 'Brief introuvable.' using errcode = 'TLNOR';
  end if;

  -- Ne permettre la modification que si le brief est encore ouvert
  if v_req.status <> 'ouvert' then
    raise exception 'Ce projet ne peut plus être modifié (statut : %).', v_req.status using errcode = 'TLBAD';
  end if;

  -- Ne pas permettre la modification si des développeurs ont déjà débloqué le contact
  if exists (select 1 from public.unlocks where request_id = v_req.id) then
    raise exception 'Ce projet ne peut plus être modifié car des développeurs ont déjà débloqué le contact.' using errcode = 'TLBAD';
  end if;

  update public.requests
  set client_name = coalesce(nullif(trim(p_client_name), ''), client_name),
      client_whatsapp = coalesce(nullif(trim(p_client_whatsapp), ''), client_whatsapp),
      project_type = coalesce(nullif(trim(p_project_type), ''), project_type),
      budget = coalesce(p_budget, budget),
      description = coalesce(nullif(trim(p_description), ''), description),
      updated_at = now()
  where id = v_req.id;

  return jsonb_build_object('ok', true, 'id', v_req.id);
end;
$$;

grant execute on function public.update_brief_content(uuid, text, text, text, integer, text) to anon, authenticated;

-- 2. Supprimer un brief (uniquement si aucun déblocage)
create or replace function public.delete_brief(
  p_management_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.requests%rowtype;
begin
  select * into v_req from public.requests where management_key = p_management_key;
  if v_req.id is null then
    raise exception 'Brief introuvable.' using errcode = 'TLNOR';
  end if;

  -- Ne pas permettre la suppression si des développeurs ont débloqué le contact
  if exists (select 1 from public.unlocks where request_id = v_req.id) then
    raise exception 'Ce projet ne peut pas être supprimé car des développeurs ont déjà débloqué le contact.' using errcode = 'TLBAD';
  end if;

  -- Supprimer les conversations liées
  delete from public.conversations where request_id = v_req.id;
  -- Supprimer le brief
  delete from public.requests where id = v_req.id;

  return jsonb_build_object('ok', true, 'id', v_req.id);
end;
$$;

grant execute on function public.delete_brief(uuid) to anon, authenticated;
