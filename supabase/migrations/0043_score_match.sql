-- ============================================================
-- TERANGA LABS — Migration 0043 : TERANGA SCORE avancé
-- + TERANGA MATCH (compatibilité brief ↔ développeur).
--
-- 1) refresh_developer_reputation enrichi : le score 0-100 devient la
--    somme de 7 composantes (avis, progression, volume d'avis, complétude
--    de profil, réactivité, bonus vérifié, pénalités). Les composantes
--    sont stockées dans `developers.score_components` pour exposer un
--    détail public sans recalcul.
-- 2) Triggers de recalcul : missions (terminées), developer_services,
--    developer_profiles, et champs de profil développeur.
-- 3) teranga_match : top N développeurs compatibles avec un besoin
--    (type de projet, ville, budget), score 0-100 décomposé.
-- 4) get_developer_score : expose score + niveau + composantes pour une
--    fiche publique.
-- ============================================================

-- ------------------------------------------------------------
-- 1) developers : composantes du score (jamais modifiées par l'utilisateur).
-- ------------------------------------------------------------
alter table public.developers
  add column if not exists score_components jsonb not null default '{}'::jsonb;

-- ------------------------------------------------------------
-- 2) refresh_developer_reputation (v3 / SCORE AVANCÉ).
-- ------------------------------------------------------------
create or replace function public.refresh_developer_reputation(p_developer uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avg numeric;
  v_reviews integer;
  v_completed integer;
  v_penalty integer;
  v_verified boolean;
  v_prof_completion numeric;
  v_response_rate numeric;
  v_reviews_pts integer;
  v_progress_pts integer;
  v_feedback_pts integer;
  v_profile_pts integer;
  v_resp_pts integer;
  v_bonus_pts integer;
  v_score integer;
  v_components jsonb;
begin
  if p_developer is null then
    return;
  end if;

  -- Avis visibles uniquement (modération).
  select round(coalesce(avg(r.rating), 0), 2), count(*)::integer
    into v_avg, v_reviews
    from public.reviews r
   where r.developer_id = p_developer
     and coalesce(r.hidden, false) = false;

  -- Projets terminés : missions complétées (source contemporaine) sans
  -- jamais descendre sous l'héritage des déblocages gagnés.
  select greatest(
           (select count(*)::integer from public.missions mm
             where mm.developer_id = p_developer and mm.status = 'completed'),
           (select count(*)::integer from public.unlocks uu
             where uu.developer_id = p_developer and uu.crm_status = 'gagne')
         )
    into v_completed;

  select coalesce(penalty, 0), coalesce(is_verified, false)
    into v_penalty, v_verified
    from public.developers
   where id = p_developer;

  -- Complétude du profil (9 indicateurs binaires).
  select round((
      (case when coalesce(nullif(btrim(d.bio), ''), '') <> '' then 1 else 0 end)
    + (case when coalesce(nullif(btrim(d.avatar_url), ''), '') <> '' then 1 else 0 end)
    + (case when coalesce(nullif(btrim(d.city), ''), '') <> '' then 1 else 0 end)
    + (case when coalesce(nullif(btrim(d.whatsapp), ''), '') <> '' then 1 else 0 end)
    + (case when coalesce(d.experience_years, 0) > 0 then 1 else 0 end)
    + (case when coalesce(array_length(d.skills, 1), 0) > 0 then 1 else 0 end)
    + (case when exists (
         select 1 from public.developer_services s
          where s.developer_id = d.id) then 1 else 0 end)
    + (case when exists (
         select 1 from public.developer_profiles p
          where p.developer_id = d.id
            and nullif(btrim(p.professional_title), '') is not null) then 1 else 0 end)
    + (case when exists (
         select 1 from public.developer_profiles p
          where p.developer_id = d.id
            and nullif(btrim(p.main_specialty), '') is not null) then 1 else 0 end)
    / 9.0)::numeric, 4)::numeric
    into v_prof_completion
    from public.developers d
   where d.id = p_developer;

  -- Taux de réponse : discussions où le développeur a répondu au moins
  -- une fois, parmi les discussions où le client a écrit.
  select round(
           count(distinct case when dev_replied then u.id end)::numeric
           / nullif(count(distinct case when client_wrote then u.id end), 0)::numeric,
           4)
    into v_response_rate
    from (
      select
        u.id,
        bool_or(m.sender_id = u.developer_id) as dev_replied,
        bool_or(m.sender_id <> u.developer_id) as client_wrote
        from public.unlocks u
        join public.messages m on m.conversation_id = u.id
       where u.developer_id = p_developer
       group by u.id
    ) u;

  -- Pondérations : avis 35, progression 20, volume d'avis 15,
  -- complétude 15, réactivité 10, bonus vérifié 5. Sous 100 - pénalités.
  v_reviews_pts := round(least(coalesce(v_avg / 5, 0)::numeric, 1) * 35)::integer;
  v_progress_pts := round(least(v_completed / 5.0, 1) * 20)::integer;
  v_feedback_pts := round(least(v_reviews / 10.0, 1) * 15)::integer;
  v_profile_pts := round(coalesce(v_prof_completion, 0) * 15)::integer;
  v_resp_pts := round(coalesce(v_response_rate, 0) * 10)::integer;
  v_bonus_pts := case when v_verified then 5 else 0 end;

  v_score := round(
    v_reviews_pts
    + v_progress_pts
    + v_feedback_pts
    + v_profile_pts
    + v_resp_pts
    + v_bonus_pts
    - coalesce(v_penalty, 0)
  )::integer;
  v_score := greatest(0, least(100, v_score));

  v_components := jsonb_build_object(
    'reviews', v_reviews_pts,
    'progress', v_progress_pts,
    'feedback', v_feedback_pts,
    'profile', v_profile_pts,
    'responsiveness', v_resp_pts,
    'bonus', v_bonus_pts,
    'penalty', -v_penalty
  );

  update public.developers
     set rating_avg = v_avg,
         reviews_count = v_reviews,
         completed_projects_count = v_completed,
         reputation_score = v_score,
         score_components = v_components,
         reputation_level = case
           when v_score >= 85 then 'Expert'
           when v_score >= 70 then 'Confirmé'
           when v_score >= 40 then 'Actif'
           else 'Nouveau'
         end
   where id = p_developer;
end;
$$;

-- ------------------------------------------------------------
-- 3) Protection élargie : score_components est une colonne gérée.
-- ------------------------------------------------------------
create or replace function public.developers_protect_managed_cols()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role', '');
begin
  -- Seul l'utilisateur directement connecté (REST, current_user =
  -- 'authenticated') est bloqué. Les fonctions SECURITY DEFINER
  -- (exécutées sous le rôle propriétaire) et le service_role peuvent
  -- maintenir ces colonnes : réputation, pénalités, validation.
  if current_user = 'authenticated' and v_role <> 'service_role' and not public.is_admin() then
    new.status := old.status;
    new.is_verified := old.is_verified;
    new.penalty := old.penalty;
    new.rating_avg := old.rating_avg;
    new.reviews_count := old.reviews_count;
    new.completed_projects_count := old.completed_projects_count;
    new.reputation_score := old.reputation_score;
    new.reputation_level := old.reputation_level;
    new.score_components := old.score_components;
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 4) Triggers de recalcul automatique.
-- ------------------------------------------------------------
create or replace function public.tgf_reputation_on_missions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_developer_reputation(coalesce(new.developer_id, old.developer_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_reputation_on_missions on public.missions;
create trigger trg_reputation_on_missions
  after insert or update of status or delete on public.missions
  for each row
  execute function public.tgf_reputation_on_missions();

create or replace function public.tgf_reputation_on_developer_services()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_developer_reputation(coalesce(new.developer_id, old.developer_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_reputation_on_developer_services on public.developer_services;
create trigger trg_reputation_on_developer_services
  after insert or update or delete on public.developer_services
  for each row
  execute function public.tgf_reputation_on_developer_services();

create or replace function public.tgf_reputation_on_developer_profiles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_developer_reputation(coalesce(new.developer_id, old.developer_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_reputation_on_developer_profiles on public.developer_profiles;
create trigger trg_reputation_on_developer_profiles
  after insert or update or delete on public.developer_profiles
  for each row
  execute function public.tgf_reputation_on_developer_profiles();

create or replace function public.tgf_reputation_on_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_developer_reputation(new.id);
  return new;
end;
$$;

drop trigger if exists trg_reputation_on_profile_fields on public.developers;
create trigger trg_reputation_on_profile_fields
  after insert or update of bio, avatar_url, city, whatsapp, experience_years, skills
  on public.developers
  for each row
  execute function public.tgf_reputation_on_profile_fields();

-- ------------------------------------------------------------
-- 5) teranga_match : top N développeurs compatibles avec un besoin.
--    Score 0-100 = type de projet (45) + ville (20) + budget (15)
--    + réputation (15) + disponibilité (5). Aucune donnée privée.
-- ------------------------------------------------------------
create or replace function public.teranga_match(
  p_project_type text default null,
  p_city text default null,
  p_budget integer default null,
  p_services text[] default null,
  p_limit integer default 8
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_type text := nullif(btrim(coalesce(p_project_type, '')), '');
  v_city text := nullif(btrim(coalesce(p_city, '')), '');
  v_budget integer := coalesce(p_budget, 0);
  v_services text[] := p_services;
  v_limit integer := greatest(1, least(coalesce(p_limit, 8), 24));
begin
  return coalesce((
    select jsonb_agg(x order by x.score desc, x.reputation_score desc)
    from (
      select d.id as developer_id,
             d.username,
             d.full_name,
             d.avatar_url,
             d.city,
             d.country,
             dp.main_specialty,
             dp.rate_min_fcfa,
             d.is_verified,
             d.reputation_score,
             d.reputation_level,
             (
               (case
                 when exists (
                   select 1 from public.developer_projects pp
                    where pp.developer_id = d.id and pp.project_type = v_type
                 ) then 45
                 when exists (
                   select 1 from public.developer_services ds
                    where ds.developer_id = d.id and v_type is not null
                      and ds.service ilike '%' || v_type || '%'
                 ) then 35
                 else 0 end)
               + (case when v_city is not null
                       and lower(coalesce(d.city, '')) = lower(v_city) then 20 else 0 end)
               + (case when v_budget > 0
                       and (dp.rate_min_fcfa is null or dp.rate_min_fcfa <= v_budget * 1.2)
                       then 15
                       when v_budget > 0 and dp.rate_min_fcfa is null then 10
                       else 0 end)
               + round(coalesce(d.reputation_score, 0) / 100.0 * 15)::integer
               + (case when coalesce(dp.availability, '') = 'available_now' then 5 else 0 end)
             )::integer as score,
             jsonb_build_object(
               'type', (case
                 when exists (
                   select 1 from public.developer_projects pp
                    where pp.developer_id = d.id and pp.project_type = v_type
                 ) then 45
                 when exists (
                   select 1 from public.developer_services ds
                    where ds.developer_id = d.id and v_type is not null
                      and ds.service ilike '%' || v_type || '%'
                 ) then 35
                 else 0 end),
               'location', (case when v_city is not null
                                 and lower(coalesce(d.city, '')) = lower(v_city) then 20 else 0 end),
               'budget', (case when v_budget > 0
                               and (dp.rate_min_fcfa is null or dp.rate_min_fcfa <= v_budget * 1.2)
                               then 15
                               when v_budget > 0 and dp.rate_min_fcfa is null then 10
                               else 0 end),
               'reputation', round(coalesce(d.reputation_score, 0) / 100.0 * 15)::integer,
               'availability', (case when coalesce(dp.availability, '') = 'available_now' then 5 else 0 end)
             ) as components
      from public.developers d
      left join public.developer_profiles dp on dp.developer_id = d.id
     where d.status in ('active', 'verified')
       and (v_services is null or array_length(v_services, 1) is null or exists (
             select 1 from public.developer_services ds
              where ds.developer_id = d.id and ds.service = any (v_services)
           ))
       and (v_type is null or exists (
             select 1 from public.developer_projects pp
              where pp.developer_id = d.id and pp.project_type = v_type
           )
           or exists (
             select 1 from public.developer_services ds
              where ds.developer_id = d.id and ds.service ilike '%' || v_type || '%'
           ))
       and (v_city is null or lower(coalesce(d.city, '')) = lower(v_city)
            or lower(coalesce(d.country, '')) = lower(v_city))
     order by score desc, d.reputation_score desc
     limit v_limit
    ) x
  ), '[]'::jsonb);
end;
$$;

-- ------------------------------------------------------------
-- 6) get_developer_score : fiche publique — score, niveau, composantes.
-- ------------------------------------------------------------
create or replace function public.get_developer_score(p_identifier text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_identifier text := nullif(btrim(p_identifier), '');
  v_dev public.developers%rowtype;
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

  return jsonb_build_object(
    'developer_id', v_dev.id,
    'score', v_dev.reputation_score,
    'level', v_dev.reputation_level,
    'components', coalesce(v_dev.score_components, '{}'::jsonb)
  );
end;
$$;

-- ------------------------------------------------------------
-- 7) Accès.
-- ------------------------------------------------------------
grant execute on function public.teranga_match(text, text, integer, text[], integer) to anon, authenticated;
grant execute on function public.get_developer_score(text) to anon, authenticated;