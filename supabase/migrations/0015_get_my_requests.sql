-- ------------------------------------------------------------
-- 0015 — get_my_requests : le client liste ses propres briefs.
-- La table requests ne gratifie pas client_id (public restreint) ;
-- cette RPC security definer expose UNIQUEMENT les briefs du
-- propriétaire connecté, avec les colonnes publiques + compteurs.
-- ------------------------------------------------------------
create or replace function public.get_my_requests()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_items jsonb;
begin
  if v_user_id is null then
    return null;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'client_name', r.client_name,
      'client_city', r.client_city,
      'project_type', r.project_type,
      'budget', r.budget,
      'description', r.description,
      'status', r.status,
      'features', r.features,
      'deadline', r.deadline,
      'management_key', r.management_key,
      'created_at', r.created_at,
      'max_unlocks', r.max_unlocks,
      'current_unlocks_count', r.current_unlocks_count
    )
    order by r.created_at desc
  ), '[]'::jsonb) into v_items
  from public.requests r
  where r.client_id = v_user_id;

  return v_items;
end;
$$;

revoke execute on function public.get_my_requests() from public;
revoke execute on function public.get_my_requests() from anon;
grant execute on function public.get_my_requests() to authenticated;