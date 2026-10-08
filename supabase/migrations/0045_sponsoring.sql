-- ============================================================
-- TERANGA LABS — Migration 0045 : Sponsoring.
--
-- Un développeur peut mettre son profil en avant (haut de
-- l'annuaire) ; un client porteur de la clé d'un brief ouvert
-- peut le mettre en avant sur le marketplace.
-- L'achat se paie en Tokens, au prix journalier stocké dans
-- app_settings (sponsoring_profile_price_tokens/brief). Durée
-- bornée 1 à 30 jours, période patronnée cumulable.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tables.
-- ------------------------------------------------------------
create table if not exists public.sponsored_profiles (
  developer_id uuid primary key references public.developers(id) on delete cascade,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null
);

create table if not exists public.sponsored_briefs (
  request_id uuid primary key references public.requests(id) on delete cascade,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null
);

create index if not exists sponsored_briefs_ends_at_idx on public.sponsored_briefs (ends_at);
create index if not exists sponsored_profiles_ends_at_idx on public.sponsored_profiles (ends_at);

alter table public.sponsored_profiles enable row level security;
alter table public.sponsored_briefs enable row level security;

drop policy if exists sponsored_profiles_select on public.sponsored_profiles;
create policy sponsored_profiles_select on public.sponsored_profiles
  for select using (true);

drop policy if exists sponsored_briefs_select on public.sponsored_briefs;
create policy sponsored_briefs_select on public.sponsored_briefs
  for select using (true);

-- Écriture uniquement via les RPC ci-dessous (SECURITY DEFINER).

-- ------------------------------------------------------------
-- 2) Tarifs + helpers.
-- ------------------------------------------------------------
create or replace function public.get_sponsoring_prices()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'profile_per_day', (select greatest(1, coalesce(
      (select (value #>> '{}')::integer from public.app_settings where key = 'sponsoring_profile_price_tokens'),
      2))),
    'brief_per_day', (select greatest(1, coalesce(
      (select (value #>> '{}')::integer from public.app_settings where key = 'sponsoring_brief_price_tokens'),
      2)))
  );
$$;

-- Débite n Tokens du portefeuille de v_user (verrou anti-course).
create or replace function public.debit_tokens(
  p_user uuid,
  p_amount integer,
  p_type text,
  p_target uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  perform 1 from public.developers where id = p_user for update;

  select coalesce(sum(t.amount), 0)::integer into v_balance
    from public.token_transactions t
   where t.developer_id = p_user;

  if v_balance < p_amount then
    raise exception 'Tokens insuffisants. Rechargez vos Tokens.' using errcode = 'TLLOW';
  end if;

  insert into public.token_transactions (developer_id, amount, type, target_developer_id)
  values (p_user, -p_amount, p_type, p_target);
end;
$$;

-- ------------------------------------------------------------
-- 3) Achat — profil développeur.
-- ------------------------------------------------------------
create or replace function public.sponsor_dev_profile(p_days integer default 7)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_days integer := greatest(1, least(coalesce(p_days, 7), 30));
  v_price_per_day integer;
  v_total integer;
  v_base timestamptz;
  v_new_end timestamptz;
  v_balance integer;
begin
  if v_user is null then
    raise exception 'Connectez-vous.' using errcode = 'TLAUT';
  end if;
  if not exists (select 1 from public.developers where id = v_user) then
    raise exception 'Profil développeur requis.' using errcode = 'TLNOD';
  end if;

  select ((get_sponsoring_prices() #>> '{profile_per_day}')::integer)
    into v_price_per_day;
  v_total := v_price_per_day * v_days;

  perform public.debit_tokens(p_user := v_user, p_amount := v_total, p_type := 'sponsor');

  select coalesce(max(ends_at), now()) into v_base
    from public.sponsored_profiles where developer_id = v_user;
  v_new_end := greatest(v_base, now()) + make_interval(days => v_days);

  insert into public.sponsored_profiles (developer_id, started_at, ends_at)
  values (v_user, now(), v_new_end)
  on conflict (developer_id) do update
    set ends_at = excluded.ends_at;

  select coalesce(sum(t.amount), 0)::integer into v_balance
    from public.token_transactions t where t.developer_id = v_user;

  return jsonb_build_object('ends_at', v_new_end, 'price', v_total, 'balance', v_balance);
end;
$$;

-- ------------------------------------------------------------
-- 4) Achat — brief ouvert (client porteur de la clé).
-- ------------------------------------------------------------
create or replace function public.sponsor_brief(
  p_request_id uuid,
  p_management_key uuid,
  p_days integer default 7
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_days integer := greatest(1, least(coalesce(p_days, 7), 30));
  v_request public.requests%rowtype;
  v_price_per_day integer;
  v_total integer;
  v_base timestamptz;
  v_new_end timestamptz;
  v_balance integer;
begin
  if v_user is null then
    raise exception 'Connectez-vous.' using errcode = 'TLAUT';
  end if;

  select * into v_request from public.requests
   where id = p_request_id and status = 'ouvert' and hidden = false;
  if v_request.id is null then
    raise exception 'Brief introuvable.' using errcode = 'TLNOK';
  end if;
  if v_request.management_key <> p_management_key then
    raise exception 'Clé de gestion invalide.' using errcode = 'TLAUT';
  end if;

  select ((get_sponsoring_prices() #>> '{brief_per_day}')::integer)
    into v_price_per_day;
  v_total := v_price_per_day * v_days;

  perform public.debit_tokens(p_user := v_user, p_amount := v_total, p_type := 'sponsor_brief');

  select coalesce(max(ends_at), now()) into v_base
    from public.sponsored_briefs where request_id = p_request_id;
  v_new_end := greatest(v_base, now()) + make_interval(days => v_days);

  insert into public.sponsored_briefs (request_id, started_at, ends_at)
  values (p_request_id, now(), v_new_end)
  on conflict (request_id) do update
    set ends_at = excluded.ends_at;

  select coalesce(sum(t.amount), 0)::integer into v_balance
    from public.token_transactions t where t.developer_id = v_user;

  return jsonb_build_object('ends_at', v_new_end, 'price', v_total, 'balance', v_balance);
end;
$$;

-- ------------------------------------------------------------
-- 5) Administration — tarifs.
-- ------------------------------------------------------------
create or replace function public.admin_set_sponsoring_prices(
  p_profile_price_tokens integer,
  p_brief_price_tokens integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès administrateur requis.' using errcode = 'TLAUT';
  end if;
  if coalesce(p_profile_price_tokens, 0) < 1 or coalesce(p_brief_price_tokens, 0) < 1 then
    raise exception 'Prix invalide.' using errcode = 'TLBAD';
  end if;

  insert into public.app_settings (key, value)
  values ('sponsoring_profile_price_tokens', to_jsonb(greatest(p_profile_price_tokens, 1))),
         ('sponsoring_brief_price_tokens', to_jsonb(greatest(p_brief_price_tokens, 1)))
  on conflict (key) do update set value = excluded.value, updated_at = now();

  return public.get_sponsoring_prices();
end;
$$;

-- ------------------------------------------------------------
-- 6) Annuaire : profils sponsorisés en tête.
--     Réécriture complète de list_approved_developers (mêmes
--     paramètres). Colonnes ajoutées : is_sponsored,
--     featured_until.
-- ------------------------------------------------------------
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
  p_offset integer default 0
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
        'featured_until', sp.ends_at
      ) as jb
      from public.developers d
      left join public.developer_profiles dp on dp.developer_id = d.id
      left join auth.users du on du.id = d.id
      left join public.sponsored_profiles sp
        on sp.developer_id = d.id and sp.ends_at > now()
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

-- ------------------------------------------------------------
-- 7) Accès.
-- ------------------------------------------------------------
grant execute on function public.get_sponsoring_prices() to anon, authenticated;
grant execute on function public.sponsor_dev_profile(integer) to authenticated;
grant execute on function public.sponsor_brief(uuid, uuid, integer) to authenticated;
grant execute on function public.admin_set_sponsoring_prices(integer, integer) to authenticated;