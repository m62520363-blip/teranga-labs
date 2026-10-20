-- ============================================================
-- 0058_public_profile.sql
-- Profil public activable/désactivable par le développeur,
-- critères minimaux vérifiés côté serveur.
-- NON destructif, idempotent.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Colonne visibilité
-- ------------------------------------------------------------
ALTER TABLE public.developers
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

-- Rétrocompatibilité : les profils déjà actifs/ vérifiés restent visibles.
UPDATE public.developers
   SET is_public = TRUE
 WHERE status IN ('active', 'verified')
   AND is_public = FALSE
   AND username IS NOT NULL;

COMMENT ON COLUMN public.developers.is_public IS
  'Profil public activable par le développeur (critères serveur).';

-- ------------------------------------------------------------
-- 2. Critères + progression
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_profile_completion()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_dev public.developers%ROWTYPE;
  v_has_specialty boolean;
  v_missing text[] := '{}';
  v_done integer := 0;
  v_total integer := 4;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;
  SELECT * INTO v_dev FROM public.developers WHERE id = v_user;
  IF v_dev.id IS NULL THEN
    RAISE EXCEPTION 'Profil développeur requis.' USING ERRCODE = 'TLNOD';
  END IF;

  IF nullif(btrim(coalesce(v_dev.full_name, '')), '') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.developer_profiles dp
        WHERE dp.developer_id = v_user
          AND nullif(btrim(coalesce(dp.professional_title, '')), '') IS NOT NULL
     ) THEN
    v_done := v_done + 1;
  ELSE
    v_missing := v_missing || 'professional_title';
  END IF;

  IF nullif(btrim(coalesce(v_dev.bio, '')), '') IS NOT NULL AND length(btrim(v_dev.bio)) >= 40 THEN
    v_done := v_done + 1;
  ELSE
    v_missing := v_missing || 'bio';
  END IF;

  IF coalesce(array_length(v_dev.skills, 1), 0) >= 1 THEN
    v_done := v_done + 1;
  ELSE
    v_missing := v_missing || 'skills';
  END IF;

  v_has_specialty := EXISTS (
    SELECT 1 FROM public.developer_profiles dp
     WHERE dp.developer_id = v_user
       AND nullif(btrim(coalesce(dp.main_specialty, '')), '') IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM public.developer_services ds WHERE ds.developer_id = v_user
  );
  IF v_has_specialty THEN
    v_done := v_done + 1;
  ELSE
    v_missing := v_missing || 'specialty';
  END IF;

  RETURN jsonb_build_object(
    'is_public', v_dev.is_public,
    'progress', CASE WHEN v_total = 0 THEN 0 ELSE round(v_done * 100.0 / v_total)::integer END,
    'missing', to_jsonb(v_missing),
    'can_publish', coalesce(array_length(v_missing, 1), 0) = 0,
    'has_username', v_dev.username IS NOT NULL,
    'status', v_dev.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_profile_completion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile_completion() TO authenticated;

-- ------------------------------------------------------------
-- 3. Activation / désactivation
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_public_profile(p_publish boolean)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_completion jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;

  IF p_publish IS NOT TRUE THEN
    UPDATE public.developers SET is_public = FALSE WHERE id = v_user;
    RETURN jsonb_build_object('ok', true, 'is_public', false);
  END IF;

  v_completion := public.get_public_profile_completion();
  IF (v_completion->>'can_publish')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'Profil incomplet : renseignez les champs obligatoires avant de publier.'
      USING ERRCODE = 'TLINC';
  END IF;
  IF (v_completion->>'has_username')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'Un nom public (username) est requis pour publier votre profil.'
      USING ERRCODE = 'TLINC';
  END IF;

  UPDATE public.developers SET is_public = TRUE WHERE id = v_user;
  RETURN jsonb_build_object('ok', true, 'is_public', true);
END;
$$;

REVOKE ALL ON FUNCTION public.set_public_profile(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_public_profile(boolean) TO authenticated;

-- ------------------------------------------------------------
-- 4. get_public_developer_profile : filtre is_public
--    (sauf pour le propriétaire ou l'admin qui prévisualise)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_developer_profile(
  p_identifier text,
  p_viewer_role text default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_identifier text := nullif(btrim(p_identifier), '');
  v_viewer text := lower(nullif(btrim(coalesce(p_viewer_role, '')), ''));
  v_caller uuid := auth.uid();
  v_dev public.developers%ROWTYPE;
  v_prof public.developer_profiles%ROWTYPE;
  v_response_minutes numeric;
  v_response_rate numeric;
BEGIN
  IF v_identifier IS NULL THEN
    RAISE EXCEPTION 'Profil introuvable.' USING ERRCODE = 'TLNOK';
  END IF;

  IF v_identifier ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT * INTO v_dev
      FROM public.developers
     WHERE id = v_identifier::uuid
       AND status IN ('active', 'verified')
       AND (is_public = TRUE OR id = v_caller OR public.is_admin());
  ELSE
    SELECT * INTO v_dev
      FROM public.developers
     WHERE username = lower(v_identifier)
       AND status IN ('active', 'verified')
       AND (is_public = TRUE OR id = v_caller OR public.is_admin());
  END IF;

  IF v_dev.id IS NULL THEN
    RAISE EXCEPTION 'Profil introuvable.' USING ERRCODE = 'TLNOK';
  END IF;

  SELECT * INTO v_prof FROM public.developer_profiles WHERE developer_id = v_dev.id;

  SELECT round(coalesce(avg(gap_minutes), 0))::numeric
    INTO v_response_minutes
    FROM (
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

  SELECT round(
           count(distinct case when dev_replied then u.id end)::numeric
           / nullif(count(distinct case when client_wrote then u.id end), 0)::numeric
           * 100
         )::numeric
    INTO v_response_rate
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

  RETURN jsonb_build_object(
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
    'is_public', v_dev.is_public,
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
END;
$$;

-- Annuaire : n'afficher que les profils publics.
CREATE OR REPLACE FUNCTION public.list_approved_developers(
  p_query text default null,
  p_specialty text default null,
  p_technologies text[] default null,
  p_services text[] default null,
  p_city text default null,
  p_min_experience integer default null,
  p_availability text default null,
  p_min_rating numeric default null,
  p_verified_only boolean default false,
  p_project_type text default null,
  p_sort text default 'relevance',
  p_limit integer default 48,
  p_offset integer default 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
  v_specialty text := nullif(btrim(coalesce(p_specialty, '')), '');
  v_city text := nullif(btrim(coalesce(p_city, '')), '');
  v_limit integer := greatest(1, least(coalesce(p_limit, 48), 120));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_sort text := coalesce(nullif(btrim(p_sort), ''), 'relevance');
BEGIN
  return coalesce((
    select jsonb_agg(jb)
    from (
      select jsonb_build_object(
        'id', d.id,
        'username', d.username,
        'full_name', d.full_name,
        'professional_title', dp.professional_title,
        'main_specialty', dp.main_specialty,
        'avatar_url', d.avatar_url,
        'city', d.city,
        'country', d.country,
        'bio', d.bio,
        'skills', coalesce(to_jsonb(d.skills), '[]'::jsonb),
        'services', to_jsonb(coalesce(svc.services, '{}'::text[])),
        'experience_years', d.experience_years,
        'experience_level', dp.experience_level,
        'availability', dp.availability,
        'rate_min_fcfa', dp.rate_min_fcfa,
        'rate_max_fcfa', dp.rate_max_fcfa,
        'rating_avg', round(coalesce(d.rating_avg, 0), 1)::numeric,
        'review_count', d.reviews_count,
        'completed_projects_count', d.completed_projects_count,
        'projects_count', coalesce(prj.cnt, 0),
        'is_verified', d.is_verified,
        'reputation_score', d.reputation_score,
        'response_rate', rr.rate,
        'satisfaction_pct', case
          when d.reviews_count > 0 then round((coalesce(d.rating_avg, 0) / 5) * 100)::integer
          else null end,
        'phone_masked', public.mask_phone(coalesce(d.phone, d.whatsapp)),
        'email_masked', public.mask_email(du.email),
        'is_sponsored', (sp.ends_at is not null),
        'featured_until', sp.ends_at,
        'is_pro', (sub.ends_at is not null),
        'pro_until', sub.ends_at
      ) as jb
      from public.developers d
      left join public.developer_profiles dp on dp.developer_id = d.id
      left join auth.users du on du.id = d.id
      left join public.sponsored_profiles sp
        on sp.developer_id = d.id and sp.ends_at > now()
      left join public.subscriptions sub
        on sub.developer_id = d.id and sub.ends_at > now()
      left join lateral (
        select array_agg(ds.service order by ds.service) as services
          from public.developer_services ds
         where ds.developer_id = d.id
      ) svc on true
      left join lateral (
        select count(*)::integer as cnt
          from public.developer_projects pp
         where pp.developer_id = d.id
      ) prj on true
      left join lateral (
        select round(
                 count(distinct case when dev_replied then u.id end)::numeric
                 / nullif(count(distinct case when client_wrote then u.id end), 0)::numeric
                 * 100
               )::numeric as rate
          from (
            select
              u.id,
              bool_or(m.sender_id = d.id) as dev_replied,
              bool_or(m.sender_id <> d.id) as client_wrote
              from public.unlocks u
              join public.messages m on m.conversation_id = u.id
             where u.developer_id = d.id
             group by u.id
          ) u
      ) rr on true
      where d.status in ('active', 'verified')
        and d.is_public = true
        and (p_verified_only is false or d.is_verified = true)
        and (v_query is null or (
              d.full_name ilike '%' || v_query || '%'
              or d.username ilike '%' || v_query || '%'
              or coalesce(dp.professional_title, '') ilike '%' || v_query || '%'
              or coalesce(dp.main_specialty, '') ilike '%' || v_query || '%'
              or exists (
                select 1 from unnest(coalesce(d.skills, '{}'::text[])) s
                where s ilike '%' || v_query || '%'
              )
              or exists (
                select 1 from public.developer_services x
                where x.developer_id = d.id and x.service ilike '%' || v_query || '%'
              )
            ))
        and (v_specialty is null or dp.main_specialty = lower(v_specialty))
        and (p_technologies is null or d.skills && p_technologies)
        and (p_services is null or exists (
              select 1 from public.developer_services x
              where x.developer_id = d.id and x.service = any (p_services)
            ))
        and (v_city is null or lower(d.city) = lower(v_city)
              or lower(coalesce(d.country, '')) = lower(v_city))
        and (p_min_experience is null or coalesce(d.experience_years, 0) >= p_min_experience)
        and (p_availability is null or dp.availability = p_availability)
        and (p_min_rating is null or coalesce(d.rating_avg, 0) >= p_min_rating)
        and (p_project_type is null or exists (
              select 1 from public.developer_projects pp
              where pp.developer_id = d.id and pp.project_type = p_project_type
            ))
      order by
        case when sp.ends_at is not null then 0 else 1 end,
        case v_sort
          when 'experience' then -coalesce(d.experience_years, 0)
          when 'projects'   then -coalesce(d.completed_projects_count, 0)
          when 'rating'     then -coalesce(d.rating_avg, 0)
          when 'availability' then case coalesce(dp.availability, 'on_mission')
                                     when 'available_now' then 0
                                     when 'available_soon' then 1
                                     else 2 end
          else -coalesce(d.reputation_score, 0)
        end,
        case v_sort
          when 'rating' then -d.reviews_count
          when 'availability' then -coalesce(d.reputation_score, 0)
          else -coalesce(d.rating_avg, 0)
        end,
        d.created_at desc
      limit v_limit offset v_offset
    ) s
  ), '[]'::jsonb);
end;
$$;

COMMIT;
