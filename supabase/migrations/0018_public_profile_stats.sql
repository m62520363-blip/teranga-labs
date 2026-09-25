CREATE OR REPLACE FUNCTION public.get_public_developer_profile(p_identifier text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_identifier text := nullif(btrim(p_identifier), '');
  v_dev public.developers%rowtype;
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
       and status = 'active';
  else
    select * into v_dev
      from public.developers
     where username = lower(v_identifier)
       and status = 'active';
  end if;

  if v_dev.id is null then
    raise exception 'Profil introuvable.' using errcode = 'TLNOK';
  end if;

  -- Temps de réponse moyen (en minutes) : pour chaque message envoyé par le
  -- client dans une discussion, écart avec la première réponse du développeur.
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

  -- Taux de réponse : discussions où le développeur a répondu au moins une
  -- fois, parmi les discussions où le client a écrit.
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
    'whatsapp', v_dev.whatsapp,
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
    'review_count', (
      select count(*)::integer from public.reviews r
       where r.developer_id = v_dev.id
    ),
    'review_average', (
      select round(coalesce(avg(r.rating), 0), 1)::numeric
        from public.reviews r
       where r.developer_id = v_dev.id
    ),
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
        and r.rating >= 3
    ), '[]'::jsonb)
  );
end;
$function$