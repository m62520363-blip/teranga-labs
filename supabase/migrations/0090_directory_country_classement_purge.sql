-- 0090_directory_country_classement_purge.sql
-- 1. Annuaire : filtre PAYS (les villes sont retirées de l'UI),
--    filtre COMPÉTENCES, filtre CLASSEMENT (points minimum).
-- 2. Classement : tous les développeurs actifs (indépendamment de
--    is_public), points = missions terminées × 50 + score de réputation,
--    niveau de réputation exposé.
-- 3. Purge des données de test / « texte » restantes.
--
-- À exécuter APRÈS 0089_public_profiles_default.sql.

begin;

-- ------------------------------------------------------------
-- 1. get_directory_filters : pays + compétences (villes retirées)
-- ------------------------------------------------------------
create or replace function public.get_directory_filters()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'specialties', coalesce((
      select jsonb_agg(x order by x)
        from (select distinct main_specialty as x
                from public.developer_profiles
               where main_specialty is not null) u
    ), '[]'::jsonb),
    'countries', coalesce((
      select jsonb_agg(x order by x)
        from (
          select distinct trim(d.country) as x
            from public.developers d
           where d.status in ('active', 'verified')
             and d.is_public = true
             and d.country is not null
             and trim(d.country) <> ''
        ) u
    ), '[]'::jsonb),
    -- Les villes ne sont plus utilisées par l'UI (filtre pays uniquement).
    'cities', '[]'::jsonb,
    'skills', coalesce((
      select jsonb_agg(x order by x)
        from (
          select distinct s as x
            from public.developers d
            cross join lateral unnest(coalesce(d.skills, '{}'::text[])) s
           where d.status in ('active', 'verified')
             and d.is_public = true
        ) u
    ), '[]'::jsonb),
    'services', coalesce((
      select jsonb_agg(x order by x)
        from (select distinct service as x from public.developer_services) u
    ), '[]'::jsonb),
    'project_types', coalesce((
      select jsonb_agg(x order by x)
        from (select distinct project_type as x
                from public.developer_projects
               where project_type is not null) u
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.get_directory_filters() to anon, authenticated;

-- ------------------------------------------------------------
-- 2. list_approved_developers : + p_country, + p_min_points,
--    + tri 'points', + reputation_level / cover_url en sortie.
--    (nouvelle signature : l'ancienne 13-paramètres est retirée
--     pour éviter une ambiguïté de surcharge)
-- ------------------------------------------------------------
drop function if exists public.list_approved_developers(
  text, text, text[], text, text, integer, text, numeric,
  boolean, text, text, integer, integer
);

create or replace function public.list_approved_developers(
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
  p_offset integer default 0,
  p_country text default null,
  p_min_points integer default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
  v_specialty text := nullif(btrim(coalesce(p_specialty, '')), '');
  v_city text := nullif(btrim(coalesce(p_city, '')), '');
  v_country text := nullif(btrim(coalesce(p_country, '')), '');
  v_limit integer := greatest(1, least(coalesce(p_limit, 48), 120));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_sort text := coalesce(nullif(btrim(p_sort), ''), 'relevance');
begin
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
        'cover_url', d.cover_url,
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
        'reputation_level', d.reputation_level,
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
        and (v_country is null or lower(coalesce(d.country, '')) = lower(v_country))
        and (p_min_experience is null or coalesce(d.experience_years, 0) >= p_min_experience)
        and (p_availability is null or dp.availability = p_availability)
        and (p_min_rating is null or coalesce(d.rating_avg, 0) >= p_min_rating)
        and (p_min_points is null or coalesce(d.reputation_score, 0) >= p_min_points)
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
          when 'points'     then -coalesce(d.reputation_score, 0)
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

grant execute on function public.list_approved_developers(
  text, text, text[], text, text, integer, text, numeric,
  boolean, text, text, integer, integer, text, integer
) to anon, authenticated;

-- ------------------------------------------------------------
-- 3. _leaderboard_standings : tous les développeurs actifs
--    (le classement est public, on n'exige plus is_public),
--    points = missions du mois × 50 + réputation cumulée,
--    niveau de réputation exposé.
-- ------------------------------------------------------------
create or replace function public._leaderboard_standings(p_year int, p_month int)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_start timestamptz := date_trunc('month', make_date(p_year, p_month, 1));
  v_end   timestamptz := date_trunc('month', make_date(p_year, p_month, 1) + interval '1 month');
  v_regional jsonb;
  v_countries jsonb;
begin
  with scored as (
    select
      d.id as developer_id,
      coalesce(mm.cnt, 0) as cnt,
      coalesce(nullif(trim(d.full_name), ''), d.username, d.id::text) as full_name,
      d.username,
      d.city,
      d.avatar_url,
      coalesce(d.reputation_score, 0) as reputation_score,
      d.reputation_level,
      coalesce(trim(d.country), '') as country
    from public.developers d
    left join (
      select m.developer_id, count(*)::int as cnt
        from public.missions m
       where m.status = 'completed'
         and m.completed_at is not null
         and m.completed_at >= v_start
         and m.completed_at <  v_end
       group by m.developer_id
    ) mm on mm.developer_id = d.id
    where d.status in ('active', 'verified')
  )
  select coalesce(jsonb_agg(jb order by (jb->>'rank')::int asc), '[]'::jsonb)
  into v_regional
  from (
    select jsonb_build_object(
      'rank', row_number() over (order by (cnt * 50 + reputation_score) desc, developer_id asc),
      'developer_id', developer_id,
      'username', username,
      'full_name', full_name,
      'city', city,
      'country', country,
      'avatar_url', avatar_url,
      'completed_projects', cnt,
      'reputation_score', reputation_score,
      'reputation_level', reputation_level,
      'points', (cnt * 50 + reputation_score)::int
    ) as jb
    from scored
  ) s;

  -- Pays : mêmes données, groupées par pays.
  with scored as (
    select
      d.id as developer_id,
      coalesce(mm.cnt, 0) as cnt,
      coalesce(nullif(trim(d.full_name), ''), d.username, d.id::text) as full_name,
      d.username,
      d.city,
      d.avatar_url,
      coalesce(d.reputation_score, 0) as reputation_score,
      d.reputation_level,
      coalesce(trim(d.country), '') as country
    from public.developers d
    left join (
      select m.developer_id, count(*)::int as cnt
        from public.missions m
       where m.status = 'completed'
         and m.completed_at is not null
         and m.completed_at >= v_start
         and m.completed_at <  v_end
       group by m.developer_id
    ) mm on mm.developer_id = d.id
    where d.status in ('active', 'verified')
      and coalesce(trim(d.country), '') <> ''
  )
  select coalesce(jsonb_agg(jb), '[]'::jsonb)
  into v_countries
  from (
    select jsonb_build_object(
      'country', country,
      'rows', (
        select coalesce(jsonb_agg(jb2 order by (jb2->>'rank')::int asc), '[]'::jsonb)
        from (
          select jsonb_build_object(
            'rank', row_number() over (order by (cnt * 50 + reputation_score) desc, developer_id asc),
            'developer_id', developer_id,
            'username', username,
            'full_name', full_name,
            'city', city,
            'avatar_url', avatar_url,
            'completed_projects', cnt,
            'reputation_score', reputation_score,
            'reputation_level', reputation_level,
            'points', (cnt * 50 + reputation_score)::int
          ) as jb2
          from scored s2
          where s2.country = scored.country
        ) inner_s
      )
    ) as jb
    from (select distinct country from scored) scored
  ) s;

  return jsonb_build_object(
    'regional', coalesce(v_regional, '[]'::jsonb),
    'countries', coalesce(v_countries, '[]'::jsonb)
  );
end;
$$;

grant execute on function public._leaderboard_standings(int, int)
  to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 4. Purge des données de test restantes (vérifié en prod le
--    12/11/2026 : 2 briefs « Test Client » sans conversation,
--    sans boost ni déblocage lié).
-- ------------------------------------------------------------
delete from public.requests
 where lower(client_name) like '%test client%'
    or lower(client_name) = 'test'
    or demo is true;

-- Contenu « texte » résiduel dans les profils développeurs
-- (noms, villes, titres, bios, niveaux de réputation).
update public.developers
   set full_name = null
 where full_name is not null
   and (lower(full_name) like '%texte%' or lower(full_name) like '%text client%');

update public.developers
   set city = null
 where city is not null
   and (lower(city) like '%texte%' or lower(city) like '%text client%');

-- La colonne professional_title appartient à developer_profiles
-- (et non à developers : correction du bug 42703).
update public.developer_profiles
   set professional_title = null
 where professional_title is not null
   and lower(professional_title) like '%texte%';

update public.developers
   set bio = null
 where bio is not null
   and (lower(bio) like '%texte client%' or lower(bio) like '%texte de démo%');

-- reputation_level est NOT NULL (0022) : on remet la valeur par
-- défaut au lieu de null (sinon violation 23502 et rollback).
update public.developers
   set reputation_level = 'Nouveau'
 where reputation_level is not null
   and (lower(reputation_level) like '%texte%' or lower(reputation_level) like '%test%');

update public.developers
   set reputation_score = 0
 where reputation_score is not null
   and reputation_score < 0;

commit;

-- ------------------------------------------------------------
-- (Optionnel) Relecture avant suppression de comptes démo :
--   select id, username, full_name, city, status, is_public
--     from public.developers
--    where lower(coalesce(username, '')) like '%test%'
--       or lower(coalesce(username, '')) like '%demo%'
--       or lower(coalesce(full_name, '')) like '%texte%';
-- Puis, si la liste est bien démo :
--   delete from public.developers where id in ('…');
-- ------------------------------------------------------------
