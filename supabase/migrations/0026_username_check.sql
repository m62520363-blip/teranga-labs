-- ============================================================
-- TERANGA LABS — Migration 0026 : contrôle de disponibilité
-- du pseudo public (username) utilisé à l'étape 1 de
-- l'inscription développeur. Sécurité : lecture seule sur la
-- colonne username, jamais d'email/téléphone.
-- ============================================================

create or replace function public.is_username_taken(p_username text)
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1
      from public.developers
     where username is not null
       and lower(username) = lower(nullif(btrim(p_username), ''))
  );
$$;

grant execute on function public.is_username_taken(text) to anon, authenticated;

-- ------------------------------------------------------------
-- get_my_developer_application : ajoute experience_years (champ
-- stocké sur developers, retourné par le dashboard) pour
-- préremplir l'onglet professionnel de l'onboarding.
-- ------------------------------------------------------------
create or replace function public.get_my_developer_application()
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  v_user uuid := auth.uid();
  v_dev public.developers%rowtype;
  v_prof public.developer_profiles%rowtype;
  v_app public.developer_applications%rowtype;
begin
  if v_user is null then
    raise exception 'Connectez-vous.' using errcode = 'TLNAU';
  end if;

  select * into v_dev from public.developers where id = v_user;
  if v_dev.id is null then
    return null;
  end if;

  select * into v_prof from public.developer_profiles where developer_id = v_user;
  select * into v_app from public.developer_applications where developer_id = v_user order by submitted_at desc limit 1;

  return jsonb_build_object(
    'first_name', v_dev.first_name,
    'last_name', v_dev.last_name,
    'full_name', v_dev.full_name,
    'username', v_dev.username,
    'email', null,
    'address', v_dev.address,
    'city', v_dev.city,
    'country', v_dev.country,
    'phone', v_dev.phone,
    'whatsapp', v_dev.whatsapp,
    'avatar_url', v_dev.avatar_url,
    'bio', v_dev.bio,
    'skills', coalesce(v_dev.skills, '{}'::text[]),
    'experience_years', v_dev.experience_years,
    'status', v_dev.status,
    'is_verified', v_dev.is_verified,
    'rejection_reason', v_dev.rejection_reason,
    'created_at', v_dev.created_at,
    'professional_title', v_prof.professional_title,
    'main_specialty', v_prof.main_specialty,
    'availability', v_prof.availability,
    'rate_min_fcfa', v_prof.rate_min_fcfa,
    'rate_max_fcfa', v_prof.rate_max_fcfa,
    'projects_estimate', v_prof.projects_estimate,
    'experience_level', v_prof.experience_level,
    'services', coalesce((
      select jsonb_agg(s.service order by s.service)
      from public.developer_services s where s.developer_id = v_user
    ), '[]'::jsonb),
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pr.id,
        'name', pr.name,
        'description', pr.description,
        'project_type', pr.project_type,
        'technologies', pr.technologies,
        'url', pr.url,
        'screenshots', pr.screenshots
      ) order by pr.created_at)
      from public.developer_projects pr where pr.developer_id = v_user
    ), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'kind', d.kind, 'name', d.name, 'url', d.url
      ) order by d.created_at)
      from public.developer_documents d where d.developer_id = v_user
    ), '[]'::jsonb),
    'links', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'kind', l.kind, 'label', l.label, 'url', l.url
      ) order by l.created_at)
      from public.developer_links l where l.developer_id = v_user
    ), '[]'::jsonb),
    'application', case when v_app.id is null then null else jsonb_build_object(
      'id', v_app.id,
      'status', v_app.status,
      'admin_message', v_app.admin_message,
      'reviewed_at', v_app.reviewed_at,
      'submitted_at', v_app.submitted_at
    ) end
  );
end;
$$;