-- ============================================================
-- TERANGA LABS — Migration 0046 : Abonnement PRO.
--
-- Abonnement payé en Tokens (pas de carte récurrente pour le
-- moment : le paiement passe par le portefeuille déjà en place).
-- Une période "PRO" de duration_days jours est achetée au prix
-- app_settings.pro_price_tokens puis prolonge la fin d'abonnement
-- existante. Badge PRO affiché (annuaire + fiche) tant que la
-- période est active.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Table.
-- ------------------------------------------------------------
create table if not exists public.subscriptions (
  developer_id uuid primary key references public.developers(id) on delete cascade,
  plan text not null default 'pro' check (plan in ('pro')),
  started_at timestamptz not null default now(),
  ends_at timestamptz not null
);

create index if not exists subscriptions_ends_at_idx on public.subscriptions (ends_at);

alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions
  for select using (true);

-- Écriture uniquement via subscribe_pro (SECURITY DEFINER).

-- ------------------------------------------------------------
-- 2) Tarifs.
-- ------------------------------------------------------------
create or replace function public.get_pro_prices()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'price_tokens', (select greatest(1, coalesce(
      (select (value #>> '{}')::integer from public.app_settings where key = 'pro_price_tokens'),
      15))),
    'duration_days', (select greatest(1, coalesce(
      (select (value #>> '{}')::integer from public.app_settings where key = 'pro_duration_days'),
      30)))
  );
$$;

-- ------------------------------------------------------------
-- 3) Souscription.
-- ------------------------------------------------------------
create or replace function public.subscribe_pro()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_price integer;
  v_duration integer;
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

  v_price := (public.get_pro_prices() #>> '{price_tokens}')::integer;
  v_duration := (public.get_pro_prices() #>> '{duration_days}')::integer;

  perform public.debit_tokens(p_user := v_user, p_amount := v_price, p_type := 'pro');

  select coalesce(max(ends_at), now()) into v_base
    from public.subscriptions where developer_id = v_user;
  v_new_end := greatest(v_base, now()) + make_interval(days => v_duration);

  insert into public.subscriptions (developer_id, plan, started_at, ends_at)
  values (v_user, 'pro', now(), v_new_end)
  on conflict (developer_id) do update
    set ends_at = excluded.ends_at;

  select coalesce(sum(t.amount), 0)::integer into v_balance
    from public.token_transactions t where t.developer_id = v_user;

  return jsonb_build_object('ends_at', v_new_end, 'price', v_price, 'duration_days', v_duration, 'balance', v_balance);
end;
$$;

-- ------------------------------------------------------------
-- 4) Statut du badge PRO (self par défaut, ou dev public).
-- ------------------------------------------------------------
create or replace function public.get_pro_status(p_developer_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_target uuid := coalesce(p_developer_id, auth.uid());
  v_sub public.subscriptions%rowtype;
begin
  if v_target is null then
    return jsonb_build_object('active', false, 'ends_at', null, 'plan', null);
  end if;
  select * into v_sub from public.subscriptions
   where developer_id = v_target and ends_at > now();
  if v_sub.developer_id is null then
    return jsonb_build_object('active', false, 'ends_at', null, 'plan', null);
  end if;
  return jsonb_build_object('active', true, 'ends_at', v_sub.ends_at, 'plan', v_sub.plan);
end;
$$;

-- ------------------------------------------------------------
-- 5) Administration — tarifs / durée.
-- ------------------------------------------------------------
create or replace function public.admin_set_pro_prices(p_price_tokens integer, p_duration_days integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès administrateur requis.' using errcode = 'TLAUT';
  end if;
  if coalesce(p_price_tokens, 0) < 1 or coalesce(p_duration_days, 0) < 1 then
    raise exception 'Valeur invalide.' using errcode = 'TLBAD';
  end if;

  insert into public.app_settings (key, value)
  values ('pro_price_tokens', to_jsonb(p_price_tokens)),
         ('pro_duration_days', to_jsonb(p_duration_days))
  on conflict (key) do update set value = excluded.value, updated_at = now();

  return public.get_pro_prices();
end;
$$;

-- ------------------------------------------------------------
-- 6) Annuaire : badge PRO (et sponsorisés en tête, inchangé).
--     Réécriture v3 de list_approved_developers avec is_pro /
--     pro_until.
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
grant execute on function public.get_pro_prices() to anon, authenticated;
grant execute on function public.subscribe_pro() to authenticated;
grant execute on function public.get_pro_status(uuid) to anon, authenticated;
grant execute on function public.admin_set_pro_prices(integer, integer) to authenticated;