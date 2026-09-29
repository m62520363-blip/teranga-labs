-- ============================================================
-- TERANGA LABS — Migration 0029 : missions réalisées des
-- développeurs (portfolio enrichi, vérifié et confidentiel).
--
--  1. developer_projects étendu : rôle, fonctionnalités, date de
--     réalisation, durée, client (déclaré), autorisation de
--     publication, statut de vérification, aperçu déguisé,
--     lien avec une mission TERANGA LABS, masquage admin.
--  2. RPC développeur : list_my_missions, set_developer_mission,
--     delete_developer_mission.
--  3. RPC admin : admin_list_developer_missions,
--     admin_review_developer_mission,
--     admin_set_developer_mission_hidden.
--  4. get_public_developer_profile(identifier, viewer_role)
--     renvoie désormais `projects` : uniquement les missions
--     vérifiées, non masquées, autorisées selon le visiteur
--     (public / clients connectés / confidentiel masqué).
-- ============================================================

-- ------------------------------------------------------------
-- 1. developer_projects : nouvelles colonnes.
-- ------------------------------------------------------------
alter table public.developer_projects
  add column if not exists role text,
  add column if not exists key_features text[] not null default '{}'::text[],
  add column if not exists client_name text,
  add column if not exists client_authorization text not null default 'public'
    check (client_authorization in ('public', 'confidential', 'clients_only')),
  add column if not exists completion_date date,
  add column if not exists duration text,
  add column if not exists demo_url text,
  add column if not exists demo_video_url text,
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'verified', 'corrections', 'rejected')),
  add column if not exists admin_note text,
  add column if not exists is_hidden boolean not null default false,
  add column if not exists via_teranga_labs boolean not null default false,
  add column if not exists mission_ref text,
  add column if not exists conversation_id uuid
    references public.conversations(id) on delete set null,
  add column if not exists details_locked boolean not null default false,
  add column if not exists reviewed_at timestamptz,
  add column if not exists verified_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists developer_projects_status_idx
  on public.developer_projects (status);

create index if not exists developer_projects_created_idx
  on public.developer_projects (developer_id, created_at desc);

-- ------------------------------------------------------------
-- 2. RPC DÉVELOPPEUR — mes missions.
-- ------------------------------------------------------------
create or replace function public.list_my_missions()
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or not exists (
    select 1 from public.developers where id = v_user
  ) then
    raise exception 'Accès réservé aux développeurs.' using errcode = 'TLAAC';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'description', p.description,
      'project_type', p.project_type,
      'technologies', coalesce(to_jsonb(p.technologies), '[]'::jsonb),
      'url', p.url,
      'screenshots', coalesce(to_jsonb(p.screenshots), '[]'::jsonb),
      'role', p.role,
      'key_features', coalesce(to_jsonb(p.key_features), '[]'::jsonb),
      'client_name', p.client_name,
      'client_authorization', p.client_authorization,
      'completion_date', p.completion_date,
      'duration', p.duration,
      'demo_url', p.demo_url,
      'demo_video_url', p.demo_video_url,
      'status', p.status,
      'admin_note', p.admin_note,
      'is_hidden', p.is_hidden,
      'via_teranga_labs', p.via_teranga_labs,
      'mission_ref', p.mission_ref,
      'conversation_id', p.conversation_id,
      'details_locked', p.details_locked,
      'created_at', p.created_at,
      'updated_at', p.updated_at
    ) order by p.created_at desc)
    from public.developer_projects p
    where p.developer_id = v_user
  ), '[]'::jsonb);
end;
$$;

-- ------------------------------------------------------------
-- 3. RPC DÉVELOPPEUR — créer / modifier une mission.
--    p_payload jsonb : champs librement saisis par le dév.
--    p_tl_conversation uuid optionnel : rattache la mission à
--    une mission TERANGA LABS remportée (données officielles
--    verrouillées, statut 'verified').
-- ------------------------------------------------------------
create or replace function public.set_developer_mission(
  p_payload jsonb,
  p_tl_conversation uuid default null
)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_existing public.developer_projects%rowtype;
  v_name text;
  v_description text;
  v_project_type text;
  v_technologies text[];
  v_url text;
  v_screenshots text[];
  v_role text;
  v_key_features text[];
  v_client_name text;
  v_client_authorization text;
  v_completion_date date;
  v_duration text;
  v_demo_url text;
  v_demo_video_url text;
  v_ref text;
  v_tl_name text;
  v_tl_date date;
begin
  if v_user is null or not exists (
    select 1 from public.developers where id = v_user
  ) then
    raise exception 'Accès réservé aux développeurs.' using errcode = 'TLAAC';
  end if;

  v_name := nullif(regexp_replace(btrim(coalesce(p_payload ->> 'name', '')), '\s+', ' ', 'g'), '');
  if v_name is null then
    raise exception 'Le nom du projet est obligatoire.' using errcode = 'TLBAD';
  end if;

  v_project_type := nullif(regexp_replace(btrim(coalesce(p_payload ->> 'project_type', '')), '\s+', ' ', 'g'), '');
  v_client_authorization := nullif(btrim(coalesce(p_payload ->> 'client_authorization', 'public')), '');
  if v_client_authorization is null
     or v_client_authorization not in ('public', 'confidential', 'clients_only') then
    raise exception 'Autorisation de publication invalide.' using errcode = 'TLBAD';
  end if;

  -- URL : uniquement http(s) si fournies.
  v_url := nullif(regexp_replace(btrim(coalesce(p_payload ->> 'url', '')), '\s+', ' ', 'g'), '');
  if v_url is not null and v_url !~ '^https?://' then
    raise exception 'L''URL du projet doit commencer par http(s)://' using errcode = 'TLBAD';
  end if;
  v_demo_url := nullif(regexp_replace(btrim(coalesce(p_payload ->> 'demo_url', '')), '\s+', ' ', 'g'), '');
  if v_demo_url is not null and v_demo_url !~ '^https?://' then
    v_demo_url := null;
  end if;
  v_demo_video_url := nullif(regexp_replace(btrim(coalesce(p_payload ->> 'demo_video_url', '')), '\s+', ' ', 'g'), '');
  if v_demo_video_url is not null and v_demo_video_url !~ '^https?://' then
    v_demo_video_url := null;
  end if;

  select coalesce(array_agg(x order by x), '{}'::text[])
    into v_technologies
    from (
      select distinct nullif(regexp_replace(btrim(t.value), '\s+', ' ', 'g'), '') as x
        from jsonb_array_elements_text(coalesce(p_payload -> 'technologies', '[]'::jsonb)) t
       where nullif(regexp_replace(btrim(t.value), '\s+', ' ', 'g'), '') is not null
    ) a;

  select coalesce(array_agg(x order by x), '{}'::text[])
    into v_screenshots
    from (
      select distinct nullif(regexp_replace(btrim(t.value), '\s+', ' ', 'g'), '') as x
        from jsonb_array_elements_text(coalesce(p_payload -> 'screenshots', '[]'::jsonb)) t
       where nullif(regexp_replace(btrim(t.value), '\s+', ' ', 'g'), '') is not null
    ) a;

  select coalesce(array_agg(x order by x), '{}'::text[])
    into v_key_features
    from (
      select distinct nullif(regexp_replace(btrim(t.value), '\s+', ' ', 'g'), '') as x
        from jsonb_array_elements_text(coalesce(p_payload -> 'key_features', '[]'::jsonb)) t
       where nullif(regexp_replace(btrim(t.value), '\s+', ' ', 'g'), '') is not null
    ) a;

  v_description := nullif(regexp_replace(btrim(coalesce(p_payload ->> 'description', '')), '\s+', ' ', 'g'), '');
  v_role := nullif(regexp_replace(btrim(coalesce(p_payload ->> 'role', '')), '\s+', ' ', 'g'), '');
  v_client_name := nullif(regexp_replace(btrim(coalesce(p_payload ->> 'client_name', '')), '\s+', ' ', 'g'), '');
  v_duration := nullif(regexp_replace(btrim(coalesce(p_payload ->> 'duration', '')), '\s+', ' ', 'g'), '');

  if nullif(p_payload ->> 'completion_date', '') is not null then
    v_completion_date := (p_payload ->> 'completion_date')::date;
  end if;

  -- Data officielle d'une mission TERANGA LABS (lecture seule).
  if p_tl_conversation is not null then
    select c.last_message_at::date,
           nullif(btrim(coalesce(r.project_type, '')), '')
      into v_tl_date, v_tl_name
      from public.conversations c
      left join public.requests r on r.id = c.request_id
     where c.id = p_tl_conversation;
    if v_tl_date is null then
      raise exception 'Mission TERANGA LABS introuvable.' using errcode = 'TLNOR';
    end if;
    if not exists (
      select 1 from public.conversations c
       where c.id = p_tl_conversation
         and c.developer_id = v_user
         and c.status = 'awarded'
    ) then
      raise exception 'Cette mission ne vous appartient pas ou n''est pas gagnée.' using errcode = 'TLAAU';
    end if;
    v_name := initcap(coalesce(v_tl_name, 'Mission Teranga Labs'));
    v_completion_date := v_tl_date;
  end if;

  -- Référence #TL-AAAA-NNNN.
  select 'TL-' || to_char(now(), 'YYYY') || '-' || lpad((
    select coalesce(count(*), 0) + 1
      from public.developer_projects
     where extract(year from created_at) = extract(year from now())
  )::text, 4, '0')
    into v_ref;

  v_id := (p_payload ->> 'id')::uuid;

  if v_id is not null then
    select * into v_existing
      from public.developer_projects
     where id = v_id and developer_id = v_user;
    if v_existing.id is null then
      raise exception 'Mission introuvable.' using errcode = 'TLNOR';
    end if;

    update public.developer_projects
       set name = case when v_existing.details_locked then v_existing.name else v_name end,
           description = left(coalesce(v_description, v_existing.description), 2000),
           project_type = case
             when v_existing.details_locked then v_existing.project_type
             else left(coalesce(v_project_type, v_existing.project_type), 100) end,
           technologies = coalesce((select array_agg(left(x, 200)) from unnest(v_technologies) x), '{}'::text[]),
           url = case when v_existing.details_locked then v_existing.url else left(v_url, 500) end,
           screenshots = coalesce((select array_agg(left(x, 500)) from unnest(v_screenshots) x), '{}'::text[]),
           role = left(coalesce(v_role, v_existing.role), 200),
           key_features = coalesce((select array_agg(left(x, 500)) from unnest(v_key_features) x), '{}'::text[]),
           client_name = case
             when v_existing.client_authorization = 'confidential' then null
             else left(v_client_name, 200) end,
           client_authorization = v_client_authorization,
           completion_date = case
             when v_existing.details_locked then v_existing.completion_date
             else coalesce(v_completion_date, v_existing.completion_date) end,
           duration = left(coalesce(v_duration, v_existing.duration), 100),
           demo_url = left(v_demo_url, 500),
           demo_video_url = left(v_demo_video_url, 500),
           -- Modifier le contenu repasse en vérification (sauf mission TL officielle).
           status = case when v_existing.details_locked then 'verified' else 'pending' end,
           admin_note = case when v_existing.details_locked then v_existing.admin_note else null end,
           verified_at = case when v_existing.details_locked then v_existing.verified_at else null end,
           reviewed_at = null,
           updated_at = now()
     where id = v_existing.id;
  else
    insert into public.developer_projects (
      developer_id, name, description, project_type, technologies, url,
      screenshots, role, key_features, client_name, client_authorization,
      completion_date, duration, demo_url, demo_video_url,
      status, mission_ref, conversation_id, via_teranga_labs, details_locked,
      verified_at, is_hidden
    )
    values (
      v_user,
      left(v_name, 200),
      left(v_description, 2000),
      left(coalesce(v_project_type, 'autre'), 100),
      coalesce((select array_agg(left(x, 200)) from unnest(v_technologies) x), '{}'::text[]),
      left(v_url, 500),
      coalesce((select array_agg(left(x, 500)) from unnest(v_screenshots) x), '{}'::text[]),
      left(v_role, 200),
      coalesce((select array_agg(left(x, 500)) from unnest(v_key_features) x), '{}'::text[]),
      case when v_client_authorization = 'confidential' then null else left(v_client_name, 200) end,
      v_client_authorization,
      v_completion_date,
      left(v_duration, 100),
      left(v_demo_url, 500),
      left(v_demo_video_url, 500),
      case when p_tl_conversation is not null then 'verified' else 'pending' end,
      v_ref,
      p_tl_conversation,
      p_tl_conversation is not null,
      p_tl_conversation is not null,
      case when p_tl_conversation is not null then now() else null end,
      false
    )
    returning id into v_id;
  end if;

  return (select public.list_my_missions());
end;
$$;

-- ------------------------------------------------------------
-- 4. RPC DÉVELOPPEUR — supprimer une mission.
-- ------------------------------------------------------------
create or replace function public.delete_developer_mission(p_mission uuid)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_user uuid := auth.uid();
  v_existing public.developer_projects%rowtype;
begin
  if v_user is null or not exists (
    select 1 from public.developers where id = v_user
  ) then
    raise exception 'Accès réservé aux développeurs.' using errcode = 'TLAAC';
  end if;

  select * into v_existing
    from public.developer_projects
   where id = p_mission and developer_id = v_user;
  if v_existing.id is null then
    raise exception 'Mission introuvable.' using errcode = 'TLNOR';
  end if;

  delete from public.developer_projects where id = p_mission;
  return jsonb_build_object('ok', true);
end;
$$;

-- ------------------------------------------------------------
-- 5. RPC ADMIN — lister les missions développeurs.
-- ------------------------------------------------------------
create or replace function public.admin_list_developer_missions(
  p_status text default null,
  p_limit integer default 200
)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_status text := nullif(btrim(coalesce(p_status, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'developer_id', p.developer_id,
      'developer_name', d.full_name,
      'developer_username', d.username,
      'developer_email', (select au.email from auth.users au where au.id = d.id),
      'name', p.name,
      'description', p.description,
      'project_type', p.project_type,
      'technologies', coalesce(to_jsonb(p.technologies), '[]'::jsonb),
      'url', p.url,
      'screenshots', coalesce(to_jsonb(p.screenshots), '[]'::jsonb),
      'role', p.role,
      'key_features', coalesce(to_jsonb(p.key_features), '[]'::jsonb),
      'client_name', p.client_name,
      'client_authorization', p.client_authorization,
      'completion_date', p.completion_date,
      'duration', p.duration,
      'demo_url', p.demo_url,
      'demo_video_url', p.demo_video_url,
      'status', p.status,
      'admin_note', p.admin_note,
      'is_hidden', p.is_hidden,
      'via_teranga_labs', p.via_teranga_labs,
      'mission_ref', p.mission_ref,
      'details_locked', p.details_locked,
      'created_at', p.created_at,
      'updated_at', p.updated_at
    ) order by p.created_at desc)
    from public.developer_projects p
    left join public.developers d on d.id = p.developer_id
    where (v_status is null or p.status = v_status)
    limit greatest(1, least(p_limit, 500))
  ), '[]'::jsonb);
end;
$$;

-- ------------------------------------------------------------
-- 6. RPC ADMIN — examiner une mission
--    (approve | reject | corrections).
-- ------------------------------------------------------------
create or replace function public.admin_review_developer_mission(
  p_mission uuid,
  p_action text,
  p_message text default null
)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_mission public.developer_projects%rowtype;
  v_action text := nullif(btrim(coalesce(p_action, '')), '');
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  if v_action is null or v_action not in ('approve', 'reject', 'corrections') then
    raise exception 'Action invalide.' using errcode = 'TLBAD';
  end if;
  if v_action in ('reject', 'corrections') and v_message is null then
    raise exception 'Précisez le motif.' using errcode = 'TLBAD';
  end if;

  select * into v_mission from public.developer_projects where id = p_mission;
  if v_mission.id is null then
    raise exception 'Mission introuvable.' using errcode = 'TLNOR';
  end if;

  if v_action = 'approve' then
    update public.developer_projects
       set status = 'verified', verified_at = now(), reviewed_at = now(),
           admin_note = null
     where id = p_mission;
  elsif v_action = 'reject' then
    update public.developer_projects
       set status = 'rejected', admin_note = v_message, reviewed_at = now()
     where id = p_mission;
  else
    update public.developer_projects
       set status = 'corrections', admin_note = v_message, reviewed_at = now()
     where id = p_mission;
  end if;

  insert into public.admin_actions (admin_id, entity_type, entity_id, action, message)
  values (auth.uid(), 'developer_mission', p_mission, v_action, v_message);

  if v_action = 'approve' then
    perform public.notify_user(
      v_mission.developer_id, 'mission_verified',
      'Mission vérifiée : ' || coalesce(v_mission.name, 'Votre projet'),
      'Votre mission « ' || coalesce(v_mission.name, 'Projet') || ' » est maintenant affichée sur votre profil public avec la mention « Mission vérifiée par TERANGA LABS ».',
      '/dashboard', 'developer_mission', p_mission
    );
  elsif v_action = 'reject' then
    perform public.notify_user(
      v_mission.developer_id, 'mission_rejected',
      'Mission refusée',
      v_message,
      '/dashboard', 'developer_mission', p_mission
    );
  else
    perform public.notify_user(
      v_mission.developer_id, 'mission_changes',
      'Modifications demandées sur une mission',
      v_message,
      '/dashboard', 'developer_mission', p_mission
    );
  end if;

  return jsonb_build_object('ok', true, 'status',
    case when v_action = 'approve' then 'verified'
         when v_action = 'reject' then 'rejected'
         else 'corrections' end);
end;
$$;

-- ------------------------------------------------------------
-- 7. RPC ADMIN — masquer / afficher une mission.
-- ------------------------------------------------------------
create or replace function public.admin_set_developer_mission_hidden(
  p_mission uuid,
  p_hidden boolean
)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_mission public.developer_projects%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  select * into v_mission from public.developer_projects where id = p_mission;
  if v_mission.id is null then
    raise exception 'Mission introuvable.' using errcode = 'TLNOR';
  end if;

  update public.developer_projects
     set is_hidden = coalesce(p_hidden, false)
   where id = p_mission;

  insert into public.admin_actions (admin_id, entity_type, entity_id, action, message)
  values (auth.uid(), 'developer_mission', p_mission,
    case when coalesce(p_hidden, false) then 'hide' else 'unhide' end,
    case when coalesce(p_hidden, false) then 'Mission masquée temporairement' else 'Mission réaffichée' end);

  perform public.notify_user(
    v_mission.developer_id,
    case when coalesce(p_hidden, false) then 'mission_hidden' else 'mission_visible' end,
    case when coalesce(p_hidden, false) then 'Votre mission est temporairement masquée'
         else 'Votre mission est de nouveau visible' end,
    case when coalesce(p_hidden, false) then
      'La mission « ' || coalesce(v_mission.name, 'Projet') || ' » n''est plus affichée sur votre profil public en attendant un examen.'
      else 'La mission « ' || coalesce(v_mission.name, 'Projet') || ' » est de nouveau affichée sur votre profil public.' end,
    '/dashboard', 'developer_mission', p_mission
  );

  return jsonb_build_object('ok', true, 'is_hidden', coalesce(p_hidden, false));
end;
$$;

-- ------------------------------------------------------------
-- 8. get_public_developer_profile enrichi : missions vérifiées,
--    filtrées par visiteur, confidentielles masquées.
-- ------------------------------------------------------------
drop function if exists public.get_public_developer_profile(text);

create or replace function public.get_public_developer_profile(
  p_identifier text,
  p_viewer_role text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_identifier text := nullif(btrim(p_identifier), '');
  v_viewer text := lower(nullif(btrim(coalesce(p_viewer_role, '')), ''));
  v_dev public.developers%rowtype;
  v_prof public.developer_profiles%rowtype;
  v_response_minutes numeric;
  v_response_rate numeric;
begin
  if v_identifier is null then
    raise exception 'Profil introuvable.' using errcode = 'TLNOK';
  end if;

  if v_identifier ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select * into v_dev
      from public.developers
     where id = v_identifier::uuid
       and status in ('active', 'verified');
  else
    select * into v_dev
      from public.developers
     where username = lower(v_identifier)
       and status in ('active', 'verified');
  end if;

  if v_dev.id is null then
    raise exception 'Profil introuvable.' using errcode = 'TLNOK';
  end if;

  select * into v_prof from public.developer_profiles where developer_id = v_dev.id;

  select round(coalesce(avg(gap_minutes), 0))::numeric
    into v_response_minutes
    from (
      select
        c.id,
        c.created_at,
        (
          select extract(epoch from min(m.created_at) - c.created_at) / 60
            from public.messages m
           where m.conversation_id = c.id
             and m.sender_id = v_dev.id
             and m.created_at > c.created_at
        ) as gap_minutes
        from public.messages c
        join public.unlocks u on u.id = c.conversation_id
       where c.conversation_id in (
               select id from public.unlocks where developer_id = v_dev.id
             )
         and c.sender_id <> v_dev.id
    ) gaps
   where gaps.gap_minutes is not null;

  select round(
           count(distinct case when dev_replied then u.id end)::numeric
           / nullif(count(distinct case when client_wrote then u.id end), 0)::numeric
           * 100
         )::numeric
    into v_response_rate
    from (
      select
        u.id,
        bool_or(m.sender_id = u.developer_id) as dev_replied,
        bool_or(m.sender_id <> u.developer_id) as client_wrote
        from public.unlocks u
        join public.messages m on m.conversation_id = u.id
       where u.developer_id = v_dev.id
       group by u.id
    ) u;

  return jsonb_build_object(
    'id', v_dev.id,
    'username', v_dev.username,
    'full_name', v_dev.full_name,
    'bio', v_dev.bio,
    'avatar_url', v_dev.avatar_url,
    'city', v_dev.city,
    'country', v_dev.country,
    'whatsapp', public.mask_phone(coalesce(v_dev.phone, v_dev.whatsapp)),
    'phone_masked', public.mask_phone(coalesce(v_dev.phone, v_dev.whatsapp)),
    'email_masked', (
      select public.mask_email(au.email) from auth.users au where au.id = v_dev.id
    ),
    'professional_title', v_prof.professional_title,
    'main_specialty', v_prof.main_specialty,
    'experience_level', v_prof.experience_level,
    'availability', v_prof.availability,
    'rate_min_fcfa', v_prof.rate_min_fcfa,
    'rate_max_fcfa', v_prof.rate_max_fcfa,
    'skills', coalesce(to_jsonb(v_dev.skills), '[]'::jsonb),
    'experience_years', v_dev.experience_years,
    'is_verified', v_dev.is_verified,
    'created_at', v_dev.created_at,
    'avg_response_minutes', v_response_minutes,
    'response_rate', v_response_rate,
    'portfolio_links', coalesce(v_dev.portfolio_links, '[]'::jsonb),
    'projects_count', (
      select count(*)::integer from public.unlocks u
       where u.developer_id = v_dev.id
    ),
    'completed_projects_count', v_dev.completed_projects_count,
    'review_count', v_dev.reviews_count,
    'review_average', round(coalesce(v_dev.rating_avg, 0), 1)::numeric,
    'reputation_score', v_dev.reputation_score,
    'reputation_level', v_dev.reputation_level,
    'penalty', v_dev.penalty,
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pr.id,
        'name', pr.name,
        'description', pr.description,
        'project_type', pr.project_type,
        'technologies', coalesce(to_jsonb(pr.technologies), '[]'::jsonb),
        'url', case when pr.client_authorization = 'confidential' then null else pr.url end,
        'screenshots', case
          when pr.client_authorization = 'confidential' then '[]'::jsonb
          else coalesce(to_jsonb(pr.screenshots), '[]'::jsonb) end,
        'role', pr.role,
        'key_features', coalesce(to_jsonb(pr.key_features), '[]'::jsonb),
        'client_name', case
          when pr.client_authorization = 'confidential' then 'Client confidentiel'
          else pr.client_name end,
        'client_authorization', pr.client_authorization,
        'completion_date', pr.completion_date,
        'duration', pr.duration,
        'demo_url', pr.demo_url,
        'demo_video_url', pr.demo_video_url,
        'via_teranga_labs', pr.via_teranga_labs,
        'mission_ref', pr.mission_ref,
        'is_verified', pr.status = 'verified'
      ) order by pr.completion_date desc nulls last, pr.created_at desc)
      from public.developer_projects pr
     where pr.developer_id = v_dev.id
       and pr.status = 'verified'
       and coalesce(pr.is_hidden, false) = false
       and (
            pr.client_authorization = 'public'
         or (pr.client_authorization = 'clients_only' and v_viewer = 'client')
         or pr.client_authorization = 'confidential'
       )
    ), '[]'::jsonb),
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
    ), '[]'::jsonb)
  );
end;
$$;

-- ------------------------------------------------------------
-- 9. Droits.
-- ------------------------------------------------------------
grant execute on function public.list_my_missions() to authenticated;
grant execute on function public.set_developer_mission(jsonb, uuid) to authenticated;
grant execute on function public.delete_developer_mission(uuid) to authenticated;
grant execute on function public.admin_list_developer_missions(text, integer) to authenticated;
grant execute on function public.admin_review_developer_mission(uuid, text, text) to authenticated;
grant execute on function public.admin_set_developer_mission_hidden(uuid, boolean) to authenticated;
grant execute on function public.get_public_developer_profile(text, text) to anon, authenticated;