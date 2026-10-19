-- ============================================================
-- TERANGA LABS - Migration 0053 : langues parlees + role projet
-- + televersement d'images (avatar / captures de portfolio).
--
-- 1) public.developers.languages : langues parlees, saisies a
--    l'etape identite du wizard d'inscription (10 max).
-- 2) public.developer_projects.role : colonne deja creee en 0029
--    mais jamais renseignee par l'inscription ; le RPC
--    submit_developer_application l'ecrit desormais.
-- 3) Bucket storage developer-assets (avatar + captures) :
--    limites de type/taille cote serveur + politiques
--    proprietaire ({uid}/...), lecture publique.
-- 4) get_my_developer_application  : retourne languages + role.
-- 5) submit_developer_application  : persiste role projets.
-- 6) get_public_developer_profile : expose languages (affichage
--    profil public).
--
-- Toutes les ecritures sont ADDITIVES et idempotentes
-- (if not exists / on conflict do nothing / create or replace) :
-- la migration est non destructive et re-executable.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Colonne langues parlees
-- ------------------------------------------------------------
alter table public.developers
  add column if not exists languages text[];

comment on column public.developers.languages is
  'Langues parlees, saisies a l''etape identite du wizard (10 max).';

-- ------------------------------------------------------------
-- 2) Bucket de televersement : avatar + captures de portfolio
--    (JPG/PNG/WebP, 2 Mo max., chemin {uid}/fichier)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'developer-assets',
  'developer-assets',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "developer-assets-insert" on storage.objects;
create policy "developer-assets-insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'developer-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(name) ~ '\.(jpg|jpeg|png|webp)$'
  );

drop policy if exists "developer-assets-delete" on storage.objects;
create policy "developer-assets-delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'developer-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "developer-assets-select" on storage.objects;
create policy "developer-assets-select"
  on storage.objects for select
  using (bucket_id = 'developer-assets');

-- ------------------------------------------------------------
-- 3) RPC - lecture du dossier d'onboarding (reprise / prefill)
--    (derniere definition : 0026 + languages + role projets)
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
    'languages', coalesce(v_dev.languages, '{}'::text[]),
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
        'screenshots', pr.screenshots,
        'role', pr.role
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

-- ------------------------------------------------------------
-- 4) RPC - soumission du dossier d'inscription developpeur
--    (derniere definition : 0025 + ecriture du role projet)
-- ------------------------------------------------------------
create or replace function public.submit_developer_application(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_dev public.developers%rowtype;
  v_title text := nullif(btrim(coalesce(p_payload ->> 'professional_title', '')), '');
  v_specialty text := nullif(btrim(coalesce(p_payload ->> 'main_specialty', '')), '');
  v_bio text := nullif(btrim(coalesce(p_payload ->> 'bio', '')), '');
  v_avatar text := nullif(btrim(coalesce(p_payload ->> 'avatar_url', '')), '');
  v_experience_level text := p_payload ->> 'experience_level';
  v_experience_years integer := (p_payload ->> 'experience_years')::int;
  v_projects_estimate integer := (p_payload ->> 'projects_estimate')::int;
  v_availability text := p_payload ->> 'availability';
  v_rate_min integer := (p_payload ->> 'rate_min_fcfa')::int;
  v_rate_max integer := (p_payload ->> 'rate_max_fcfa')::int;
  v_terms boolean := coalesce((p_payload ->> 'terms_accepted')::boolean, false);
  v_applications integer;
begin
  if v_user is null then
    raise exception 'Connectez-vous pour envoyer votre inscription.' using errcode = 'TLNAU';
  end if;

  select * into v_dev from public.developers where id = v_user;
  if v_dev.id is null then
    raise exception 'Profil dÃ©veloppeur requis.' using errcode = 'TLNOD';
  end if;

  if v_dev.status in ('active', 'verified', 'suspended', 'verification_pending') then
    raise exception 'Votre compte est dÃ©jÃ  actif, vÃ©rifiÃ© ou en cours de vÃ©rification : aucune nouvelle inscription n''est nÃ©cessaire.' using errcode = 'TLRJC';
  end if;

  -- Validations.
  if v_title is null or length(v_title) > 120 then
    raise exception 'Le titre professionnel est requis (120 caractÃ¨res max).' using errcode = 'TLBAD';
  end if;
  if v_specialty is null or length(v_specialty) > 120 then
    raise exception 'La spÃ©cialitÃ© principale est requise.' using errcode = 'TLBAD';
  end if;
  if v_bio is not null and length(v_bio) > 2000 then
    raise exception 'PrÃ©sentation trop longue (2000 caractÃ¨res max).' using errcode = 'TLBAD';
  end if;
  if v_experience_level not in ('debutant', 'intermediaire', 'avance', 'expert') then
    raise exception 'Niveau d''expÃ©rience invalide.' using errcode = 'TLBAD';
  end if;
  if v_experience_years is null or v_experience_years < 0 or v_experience_years > 100 then
    raise exception 'AnnÃ©es d''expÃ©rience invalides.' using errcode = 'TLBAD';
  end if;
  if v_projects_estimate is null or v_projects_estimate < 0 then
    raise exception 'Nombre de projets rÃ©alisÃ©s invalide.' using errcode = 'TLBAD';
  end if;
  if v_availability not in ('available_now', 'available_soon', 'on_mission') then
    raise exception 'DisponibilitÃ© invalide.' using errcode = 'TLBAD';
  end if;
  if v_rate_min is null or v_rate_min < 0 or v_rate_max is null or v_rate_max < v_rate_min then
    raise exception 'Tarification invalide (minimum Â± maximum en FCFA).' using errcode = 'TLBAD';
  end if;
  if not v_terms then
    raise exception 'Vous devez accepter les conditions d''utilisation et certifier l''exactitude des informations.' using errcode = 'TLBAD';
  end if;
  if jsonb_typeof(p_payload -> 'services') is distinct from 'array'
     or jsonb_array_length(p_payload -> 'services') = 0 then
    raise exception 'SÃ©lectionnez au moins un service proposÃ©.' using errcode = 'TLBAD';
  end if;
  if jsonb_typeof(p_payload -> 'skills') is distinct from 'array'
     or jsonb_array_length(p_payload -> 'skills') = 0 then
    raise exception 'SÃ©lectionnez au moins une compÃ©tence technique.' using errcode = 'TLBAD';
  end if;

  -- Une seule inscription en attente.
  select count(*) into v_applications
    from public.developer_applications
   where developer_id = v_user and status = 'pending';

  if v_applications > 0 then
    raise exception 'Votre inscription est dÃ©jÃ  en cours d''examen.' using errcode = 'TLDUP';
  end if;

  -- Profil professionnel (upsert 1:1).
  insert into public.developer_profiles (
    developer_id, professional_title, main_specialty, availability,
    rate_min_fcfa, rate_max_fcfa, currency, projects_estimate,
    experience_level, terms_accepted_at, submitted_at, updated_at
  ) values (
    v_user, v_title, v_specialty, v_availability,
    v_rate_min, v_rate_max, 'FCFA', v_projects_estimate,
    v_experience_level, now(), now(), now()
  )
  on conflict (developer_id) do update
  set professional_title = excluded.professional_title,
      main_specialty = excluded.main_specialty,
      availability = excluded.availability,
      rate_min_fcfa = excluded.rate_min_fcfa,
      rate_max_fcfa = excluded.rate_max_fcfa,
      projects_estimate = excluded.projects_estimate,
      experience_level = excluded.experience_level,
      terms_accepted_at = excluded.terms_accepted_at,
      submitted_at = now(),
      updated_at = now();

  -- Fiche dÃ©veloppeur (bio, avatar, compÃ©tences, expÃ©rience).
  -- La soumission (re)met le dossier en 'pending' devant l'admin :
  -- c'est le seul moment oÃ¹ la colonne gÃ©rÃ©e est modifiÃ©e par le
  -- dÃ©veloppeur, et uniquement vers 'pending' (protection en 13).
  update public.developers
     set bio = coalesce(v_bio, bio),
         avatar_url = coalesce(v_avatar, avatar_url),
         skills = coalesce((
           select array_agg(v) from jsonb_array_elements_text(p_payload -> 'skills') v
         ), '{}'::text[]),
         experience_years = v_experience_years,
         rejection_reason = null,
         status = 'pending'
   where id = v_user;

  -- Services.
  delete from public.developer_services where developer_id = v_user;
  insert into public.developer_services (developer_id, service)
  select v_user, trim(v)
    from jsonb_array_elements_text(p_payload -> 'services') v
   where nullif(trim(v), '') is not null;

  -- Portfolio (remplacement propre).
  delete from public.developer_projects where developer_id = v_user;
  insert into public.developer_projects (
    developer_id, name, description, project_type, technologies, url, screenshots, role
  )
  select v_user,
         p ->> 'name',
         nullif(btrim(coalesce(p ->> 'description', '')), ''),
         nullif(btrim(coalesce(p ->> 'project_type', '')), ''),
         coalesce((
           select array_agg(x) from jsonb_array_elements_text(coalesce(p -> 'technologies', '[]'::jsonb)) x
         ), '{}'::text[]),
         nullif(btrim(coalesce(p ->> 'url', '')), ''),
         coalesce((
           select array_agg(x) from jsonb_array_elements_text(coalesce(p -> 'screenshots', '[]'::jsonb)) x
         ), '{}'::text[]),
         left(nullif(regexp_replace(btrim(coalesce(p ->> 'role', '')), '\s+', ' ', 'g'), ''), 200)
  from jsonb_array_elements(coalesce(p_payload -> 'projects', '[]'::jsonb)) p
  where nullif(btrim(coalesce(p ->> 'name', '')), '') is not null;

  -- Documents.
  delete from public.developer_documents where developer_id = v_user;
  insert into public.developer_documents (developer_id, kind, name, url)
  select v_user,
         case when d ->> 'kind' in ('cv', 'professional') then d ->> 'kind' else 'other' end,
         nullif(btrim(coalesce(d ->> 'name', '')), ''),
         nullif(btrim(coalesce(d ->> 'url', '')), '')
  from jsonb_array_elements(coalesce(p_payload -> 'documents', '[]'::jsonb)) d
  where nullif(btrim(coalesce(d ->> 'url', '')), '') is not null;

  -- Liens professionnels.
  delete from public.developer_links where developer_id = v_user;
  insert into public.developer_links (developer_id, kind, label, url)
  select v_user,
         case when l ->> 'kind' in ('github', 'linkedin') then l ->> 'kind' else 'other' end,
         nullif(btrim(coalesce(l ->> 'label', '')), ''),
         nullif(btrim(coalesce(l ->> 'url', '')), '')
  from jsonb_array_elements(coalesce(p_payload -> 'links', '[]'::jsonb)) l
  where nullif(btrim(coalesce(l ->> 'url', '')), '') is not null;

  -- Dossier d'application en attente.
  insert into public.developer_applications (developer_id, status)
  values (v_user, 'pending');

  return jsonb_build_object('ok', true, 'status', 'pending');
end;
$$;

-- ------------------------------------------------------------
-- 5) RPC - profil public (derniere definition : 0029 + langues)
-- ------------------------------------------------------------
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
    'languages', coalesce(to_jsonb(v_dev.languages), '[]'::jsonb),
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
