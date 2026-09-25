-- 0021_admin_modules.sql
-- Fonctions d'administration additionnelles pour la console Teranga Labs Admin.
-- Toujours gardées derrière le garde public.is_admin(), comme leurs sœurs admin_*.

-- Liste des déblocages (missions) : client, projet, budget, développeur, CRM.
create or replace function public.admin_list_unlocks()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  return (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', u.id,
          'client_name', r.client_name,
          'client_city', r.client_city,
          'project_type', r.project_type,
          'budget', r.budget,
          'developer_name', d.full_name,
          'developer_username', d.username,
          'developer_city', d.city,
          'crm_status', u.crm_status,
          'notes', u.notes,
          'reminder_at', u.reminder_at,
          'created_at', u.created_at
        )
        order by u.created_at desc
      ),
      '[]'::jsonb
    )
    from public.unlocks u
    left join public.requests r on r.id = u.request_id
    left join public.developers d on d.id = u.developer_id
  );
end;
$function$;

-- Liste des notifications avec destinataire et rôle.
create or replace function public.admin_list_notifications(p_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 500));
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  return (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', n.id,
          'user_id', n.user_id,
          'recipient_email', u.email,
          'recipient_role', ur.role,
          'type', n.type,
          'title', n.title,
          'body', n.body,
          'link', n.link,
          'entity_type', n.entity_type,
          'entity_id', n.entity_id,
          'read', n.read,
          'created_at', n.created_at
        )
        order by n.created_at desc
      ),
      '[]'::jsonb
    )
    from public.notifications n
    left join auth.users u on u.id = n.user_id
    left join public.user_roles ur on ur.user_id = n.user_id
    limit v_limit
  );
end;
$function$;

-- Liste des administrateurs.
create or replace function public.admin_list_admins()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  return (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'user_id', ur.user_id,
          'email', u.email,
          'role', ur.role,
          'created_at', ur.created_at,
          'last_sign_in_at', u.last_sign_in_at
        )
        order by ur.created_at desc
      ),
      '[]'::jsonb
    )
    from public.user_roles ur
    join public.user_roles all_roles on all_roles.user_id = ur.user_id
    left join auth.users u on u.id = ur.user_id
    where ur.role = 'admin'
    group by ur.user_id, u.email, ur.role, ur.created_at, u.last_sign_in_at
  );
end;
$function$;

-- Annuaire des utilisateurs (destinataires possibles pour un envoi de notification).
create or replace function public.admin_list_users(p_limit integer default 200)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 200), 1000));
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  return (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', u.id,
          'email', u.email,
          'role', coalesce(ur.role, 'inconnu'),
          'full_name', coalesce(d.full_name, cp.contact_name, '—'),
          'created_at', u.created_at,
          'last_sign_in_at', u.last_sign_in_at
        )
        order by u.created_at desc
      ),
      '[]'::jsonb
    )
    from auth.users u
    left join public.user_roles ur on ur.user_id = u.id
    left join public.developers d on d.id = u.id
    left join public.client_profiles cp on cp.id = u.id
    limit v_limit
  );
end;
$function$;

revoke all on function public.admin_list_unlocks() from public, anon, authenticated;
revoke all on function public.admin_list_notifications(integer) from public, anon, authenticated;
revoke all on function public.admin_list_admins() from public, anon, authenticated;
revoke all on function public.admin_list_users(integer) from public, anon, authenticated;