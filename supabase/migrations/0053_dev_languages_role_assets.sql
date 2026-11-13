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
--
-- NOTE : get_public_developer_profile n'est PAS redéfinie ici :
-- la version de 0058 (déjà en prod) est plus récente (filtre
-- is_public) et expose déjà languages. Voir la note en fin de
-- fichier.
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
    raise exception 'Profil développeur requis.' using errcode = 'TLNOD';
  end if;

  if v_dev.status in ('active', 'verified', 'suspended', 'verification_pending') then
    raise exception 'Votre compte est déjà actif, vérifié ou en cours de vérification : aucune nouvelle inscription n''est nécessaire.' using errcode = 'TLRJC';
  end if;

  -- Validations.
  if v_title is null or length(v_title) > 120 then
    raise exception 'Le titre professionnel est requis (120 caractères max).' using errcode = 'TLBAD';
  end if;
  if v_specialty is null or length(v_specialty) > 120 then
    raise exception 'La spécialité principale est requise.' using errcode = 'TLBAD';
  end if;
  if v_bio is not null and length(v_bio) > 2000 then
    raise exception 'Présentation trop longue (2000 caractères max).' using errcode = 'TLBAD';
  end if;
  if v_experience_level not in ('debutant', 'intermediaire', 'avance', 'expert') then
    raise exception 'Niveau d''expérience invalide.' using errcode = 'TLBAD';
  end if;
  if v_experience_years is null or v_experience_years < 0 or v_experience_years > 100 then
    raise exception 'Années d''expérience invalides.' using errcode = 'TLBAD';
  end if;
  if v_projects_estimate is null or v_projects_estimate < 0 then
    raise exception 'Nombre de projets réalisés invalide.' using errcode = 'TLBAD';
  end if;
  if v_availability not in ('available_now', 'available_soon', 'on_mission') then
    raise exception 'Disponibilité invalide.' using errcode = 'TLBAD';
  end if;
  if v_rate_min is null or v_rate_min < 0 or v_rate_max is null or v_rate_max < v_rate_min then
    raise exception 'Tarification invalide (minimum ± maximum en FCFA).' using errcode = 'TLBAD';
  end if;
  if not v_terms then
    raise exception 'Vous devez accepter les conditions d''utilisation et certifier l''exactitude des informations.' using errcode = 'TLBAD';
  end if;
  if jsonb_typeof(p_payload -> 'services') is distinct from 'array'
     or jsonb_array_length(p_payload -> 'services') = 0 then
    raise exception 'Sélectionnez au moins un service proposé.' using errcode = 'TLBAD';
  end if;
  if jsonb_typeof(p_payload -> 'skills') is distinct from 'array'
     or jsonb_array_length(p_payload -> 'skills') = 0 then
    raise exception 'Sélectionnez au moins une compétence technique.' using errcode = 'TLBAD';
  end if;

  -- Une seule inscription en attente.
  select count(*) into v_applications
    from public.developer_applications
   where developer_id = v_user and status = 'pending';

  if v_applications > 0 then
    raise exception 'Votre inscription est déjà en cours d''examen.' using errcode = 'TLDUP';
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

  -- Fiche développeur (bio, avatar, compétences, expérience).
  -- La soumission (re)met le dossier en 'pending' devant l'admin :
  -- c'est le seul moment où la colonne gérée est modifiée par le
  -- développeur, et uniquement vers 'pending' (protection en 13).
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
-- 5) get_public_developer_profile : SUPPRIMEE de cette migration.
--    La migration 0058_public_profile.sql (deja appliquee en prod)
--    en fournit la version la plus recente - avec le filtre
--    is_public + p_viewer_role - et expose deja languages.
--    Exécuter 0053 après 0058 ne doit donc PAS écraser cette
--    fonction (sinon les profils privés redeviendraient publics).
--    Une fois la colonne languages créée, 0058 retrouve son
--    fonctionnement sans erreur 42703.
-- ------------------------------------------------------------
