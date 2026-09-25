create or replace function public.get_admin_dashboard_stats(p_period text default '30d')
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  v_period text := lower(coalesce(p_period, '30d'));
  v_days integer := case v_period
                      when '7d' then 7
                      when '14d' then 14
                      when '90d' then 90
                      when '365d' then 365
                      else 30
                    end;
  v_since timestamptz := now() - (v_days || ' days')::interval;
  v_prev_start timestamptz := now() - ((2 * v_days) || ' days')::interval;
  v_interval interval := v_days || ' days';
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  return jsonb_build_object(
    'period', v_period,
    'days', v_days,
    'totals', jsonb_build_object(
      'users', (select count(*)::integer from auth.users),
      'new_users', (select count(*)::integer from auth.users where created_at >= v_since),
      'developers', (select count(*)::integer from public.developers),
      'active_developers', (select count(*)::integer from public.developers where status = 'active'),
      'pending_developers', (select count(*)::integer from public.developers where status = 'pending'),
      'clients', (select count(*)::integer from public.client_profiles),
      'requests_total', (select count(*)::integer from public.requests),
      'requests_period', (select count(*)::integer from public.requests where created_at >= v_since),
      'requests_open', (select count(*)::integer from public.requests where status = 'ouvert'),
      'requests_awarded', (select count(*)::integer from public.requests where status = 'attribué'),
      'requests_completed', (select count(*)::integer from public.requests where status = 'terminé'),
      'success_rate', (
        round(
          (select count(*)::numeric from public.requests where status in ('attribué', 'terminé'))
          / nullif((select count(*)::numeric from public.requests), 0) * 100
        )::integer
      ),
      'unlocks', (select count(*)::integer from public.unlocks),
      'unlocks_period', (select count(*)::integer from public.unlocks where created_at >= v_since),
      'conversations', (select count(*)::integer from public.conversations),
      'messages', (select count(*)::integer from public.messages),
      'offers', (select count(*)::integer from public.formal_offers),
      'offers_accepted', (select count(*)::integer from public.formal_offers where status = 'accepted'),
      'offers_rate', (
        case when (select count(*)::numeric from public.formal_offers) > 0 then
          round(
            (select count(*)::numeric from public.formal_offers where status = 'accepted')
            / (select count(*)::numeric from public.formal_offers) * 100
          )::integer
        else 0 end
      ),
      'orders', (select count(*)::integer from public.token_orders),
      'orders_pending', (select count(*)::integer from public.token_orders where status = 'pending'),
      'orders_confirmed', (select count(*)::integer from public.token_orders where status = 'confirmed'),
      'revenue_fcfa', (
        select coalesce(sum(amount_fcfa), 0)::integer
          from public.token_transactions
         where type = 'purchase' and amount_fcfa is not null
      ),
      'revenue_period_fcfa', (
        select coalesce(sum(amount_fcfa), 0)::integer
          from public.token_transactions
         where type = 'purchase' and amount_fcfa is not null and created_at >= v_since
      ),
      'revenue_prev_fcfa', (
        select coalesce(sum(amount_fcfa), 0)::integer
          from public.token_transactions
         where type = 'purchase' and amount_fcfa is not null
           and created_at >= v_prev_start and created_at < v_since
      ),
      'tokens_sold', coalesce((
        select sum(amount)::integer from public.token_transactions
         where type in ('purchase', 'bonus')
      ), 0),
      'tokens_used', coalesce((
        select -sum(amount)::integer from public.token_transactions
         where type = 'unlock'
      ), 0),
      'reviews', (select count(*)::integer from public.reviews),
      'avg_rating', (
        select round(coalesce(avg(rating), 0), 1)::numeric from public.reviews
      ),
      'reports_open', (select count(*)::integer from public.reports where status = 'open'),
      'refunds_pending', (select count(*)::integer from public.token_refund_requests where status = 'pending')
    ),
    'users_by_day', coalesce((
      select jsonb_agg(jsonb_build_object('date', s.day, 'value', coalesce(c.cnt, 0)) order by s.day)
        from generate_series(current_date - (v_days - 1), current_date, '1 day') as s(day)
        left join (
          select ((au.created_at at time zone 'utc')::date) as day, count(*) as cnt
            from auth.users au
           group by day
        ) c on c.day = s.day
    ), '[]'::jsonb),
    'revenue_by_day', coalesce((
      select jsonb_agg(jsonb_build_object('date', s.day, 'value', coalesce(c.fcfa, 0)) order by s.day)
        from generate_series(current_date - (v_days - 1), current_date, '1 day') as s(day)
        left join (
          select (created_at at time zone 'utc')::date as day, sum(amount_fcfa) as fcfa
            from public.token_transactions
           where type = 'purchase' and amount_fcfa is not null
           group by day
        ) c on c.day = s.day
    ), '[]'::jsonb),
    'unlocks_by_day', coalesce((
      select jsonb_agg(jsonb_build_object('date', s.day, 'value', coalesce(c.cnt, 0)) order by s.day)
        from generate_series(current_date - (v_days - 1), current_date, '1 day') as s(day)
        left join (
          select (created_at at time zone 'utc')::date as day, count(*) as cnt
            from public.unlocks
           group by day
        ) c on c.day = s.day
    ), '[]'::jsonb),
    'requests_by_day', coalesce((
      select jsonb_agg(jsonb_build_object('date', s.day, 'value', coalesce(c.cnt, 0)) order by s.day)
        from generate_series(current_date - (v_days - 1), current_date, '1 day') as s(day)
        left join (
          select (created_at at time zone 'utc')::date as day, count(*) as cnt
            from public.requests
           group by day
        ) c on c.day = s.day
    ), '[]'::jsonb),
    'top_developers', coalesce((
      select jsonb_agg(t)
        from (
          select
            dv.id,
            dv.username,
            dv.full_name,
            dv.city,
            dv.is_verified as verified,
            u.cnt as unlocks,
            r.cnt as reviews,
            r.avg as avg_rating
            from public.developers dv
            join (
              select developer_id, count(*) as cnt from public.unlocks group by developer_id
            ) u on u.developer_id = dv.id
            left join (
              select developer_id, count(*) as cnt, round(avg(rating), 1)::numeric as avg
                from public.reviews group by developer_id
            ) r on r.developer_id = dv.id
           where dv.status = 'active'
           order by u.cnt desc, r.cnt desc
           limit 8
        ) t
    ), '[]'::jsonb),
    'recent_unlocks', coalesce((
      select jsonb_agg(t)
        from (
          select
            ul.id,
            req.client_name,
            req.client_city,
            req.project_type,
            dv.full_name as developer_name,
            dv.city as developer_city,
            dv.username as developer_username,
            req.budget,
            ul.crm_status as status,
            ul.created_at
            from public.unlocks ul
            join public.requests req on req.id = ul.request_id
            join public.developers dv on dv.id = ul.developer_id
           order by ul.created_at desc
           limit 10
        ) t
    ), '[]'::jsonb),
    'pending_verifications', coalesce((
      select jsonb_agg(t)
        from (
          select
            dv.id,
            dv.username,
            dv.full_name,
            dv.city,
            coalesce(dv.skills, array[]::text[]) as skills,
            dv.created_at
            from public.developers dv
           where dv.status = 'pending'
           order by dv.created_at desc
           limit 8
        ) t
    ), '[]'::jsonb)
  );
end;
$$;