-- ============================================================
-- TERANGA LABS — Migration 0028 : annuaire des développeurs
-- + contact direct 1 Token (client → développeur).
--
--  1. token_transactions : types 'contact'/'adjust' + cible du contact
--  2. conversations : conversations directes (request_id nullable)
--     + unicité partielle (client_id, developer_id)
--  3. coût du contact configurable (app_settings.contact_cost_tokens)
--  4. helpers de masquage serveur des coordonnées (jamais de PII brute)
--  5. RPC :
--     - get_contact_cost
--     - contact_developer  (atomique, idempotent, anti-double-dépense)
--     - list_approved_developers  (annuaire + filtres + tri, PII masquée)
--     - get_my_token_history  (solde avant/après par transaction)
--     - get_peer_display_name (nom de l'interlocuteur d'un contact direct)
--     - admin_list_packages / admin_update_package
--     - admin_list_balances / admin_adjust_tokens
--     - admin_set_contact_cost / admin_list_contacts
--  6. Renforcements PII : get_public_developer_profile masque le
--     téléphone ; list_developers_for_brief retiré aux 'authenticated'.
-- ============================================================

-- ------------------------------------------------------------
-- 0. app_settings : coût du contact direct (défaut 1 Token).
-- ------------------------------------------------------------
insert into public.app_settings (key, value)
values ('contact_cost_tokens', '1'::jsonb)
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- 1. token_transactions : types étendus + cible du contact.
-- ------------------------------------------------------------
alter table public.token_transactions
  drop constraint if exists token_transactions_type_check;

alter table public.token_transactions
  add constraint token_transactions_type_check
  check (type in ('purchase', 'unlock', 'bonus', 'publish', 'contact', 'adjust'));

alter table public.token_transactions
  add column if not exists target_developer_id uuid references public.developers(id) on delete cascade;

create index if not exists token_transactions_target_dev_idx
  on public.token_transactions (target_developer_id);

-- ------------------------------------------------------------
-- 2. conversations directes (sans brief).
-- ------------------------------------------------------------
alter table public.conversations
  alter column request_id drop not null;

-- Une seule conversation directe par paire (client, développeur).
create unique index if not exists conversations_direct_uidx
  on public.conversations (client_id, developer_id)
  where request_id is null;

-- ------------------------------------------------------------
-- 3. Helpers de masquage (SQL, invariants côté serveur).
--    +221 77 802 80 25  ->  +221 77 ** ** ** 25
--    admin@gmail.com    ->  a*****@gmail.com
-- ------------------------------------------------------------
create or replace function public.mask_phone(p_phone text)
returns text
language sql
immutable
as $$
  select case
    when p_phone is null or btrim(p_phone) = '' then null
    else (
      with n as (
        select regexp_replace(btrim(p_phone), '\D', '', 'g') as d
      )
      select case
        when length(n.d) >= 9 and left(n.d, 3) = '221' then
          '+221 ' || substring(n.d, 4, 2) || ' ** ** ** ' || right(n.d, 2)
        when length(n.d) >= 6 then
          left(n.d, 2) || ' ** ** ' || right(n.d, 2)
        else left(n.d, 2) || repeat('*', greatest(0, length(n.d) - 4)) || right(n.d, 2)
      end from n
    )
  end;
$$;

create or replace function public.mask_email(p_email text)
returns text
language sql
immutable
as $$
  select case
    when p_email is null or btrim(p_email) = '' or position('@' in btrim(p_email)) = 0 then null
    else left(btrim(p_email), 1) || '*****' || substring(btrim(p_email) from position('@' in btrim(p_email)))
  end;
$$;

-- ------------------------------------------------------------
-- 4. get_contact_cost : coût d'un contact direct (configurable).
-- ------------------------------------------------------------
create or replace function public.get_contact_cost()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0, coalesce(
    (select (value #>> '{}')::integer from public.app_settings where key = 'contact_cost_tokens'),
    1
  ));
$$;

-- ------------------------------------------------------------
-- 5. contact_developer : dépense atomique + conversation directe.
--    - vérifie le solde, débite, crée la conversation, prévient le dev.
--    - idempotent : 1 conversation directe = 1 seule dépense.
--    - verrou sur la ligne client (anti-course, pas de double dépense).
-- ------------------------------------------------------------
create or replace function public.contact_developer(
  p_developer_id uuid,
  p_initial_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_dev public.developers%rowtype;
  v_cost integer;
  v_balance integer;
  v_conv uuid;
  v_msg text := nullif(btrim(coalesce(p_initial_message, '')), '');
begin
  if v_user_id is null then
    raise exception 'Connectez-vous pour contacter un développeur.' using errcode = 'TLNAU';
  end if;

  select role into v_role from public.user_roles where user_id = v_user_id;
  if v_role is distinct from 'client' then
    raise exception 'Le contact direct est réservé aux clients.' using errcode = 'TLRJC';
  end if;

  select * into v_dev from public.developers where id = p_developer_id;
  if v_dev.id is null then
    raise exception 'Développeur introuvable.' using errcode = 'TLNOD';
  end if;
  if v_dev.status not in ('active', 'verified') then
    raise exception 'Ce profil n''est pas disponible au contact.' using errcode = 'TLRJC';
  end if;
  if v_dev.id = v_user_id then
    raise exception 'Action impossible.' using errcode = 'TLBAD';
  end if;

  -- Discussion directe déjà ouverte ? Aucune nouvelle dépense.
  select c.id into v_conv
    from public.conversations c
   where c.client_id = v_user_id
     and c.developer_id = p_developer_id
     and c.request_id is null;

  if v_conv is not null then
    return jsonb_build_object(
      'conversation_id', v_conv,
      'first_contact', false,
      'cost', 0,
      'balance', (
        select coalesce(sum(t.amount), 0)::integer
          from public.token_transactions t
         where t.developer_id = v_user_id
      )
    );
  end if;

  -- Verrou anti-course : sérialise les dépenses de ce client.
  perform 1 from public.developers where id = v_user_id for update;

  v_cost := greatest(1, public.get_contact_cost());

  select coalesce(sum(t.amount), 0)::integer into v_balance
    from public.token_transactions t
   where t.developer_id = v_user_id;

  if v_balance < v_cost then
    raise exception 'Tokens insuffisants. Rechargez vos Tokens.' using errcode = 'TLLOW';
  end if;

  insert into public.token_transactions (developer_id, amount, type, target_developer_id)
  values (v_user_id, -v_cost, 'contact', p_developer_id);

  insert into public.conversations (request_id, developer_id, client_id, status)
  values (null, p_developer_id, v_user_id, 'active')
  on conflict (client_id, developer_id) where (request_id is null) do nothing
  returning id into v_conv;

  if v_conv is null then
    select c.id into v_conv
      from public.conversations c
     where c.client_id = v_user_id
       and c.developer_id = p_developer_id
       and c.request_id is null;
  end if;

  if v_msg is not null then
    insert into public.messages (conversation_id, sender_id, content, message_type, metadata)
    values (v_conv, v_user_id, v_msg, 'text', jsonb_build_object('kind', 'direct_contact'));

    update public.conversations set last_message_at = now() where id = v_conv;
  end if;

  -- Prévenir le développeur (la notification de message fait doublon
  -- quand un premier message est envoyé : on ne notifie alors que lui).
  if v_msg is null then
    perform public.notify_user(
      p_developer_id,
      'new_contact',
      'Nouveau contact client',
      'Un client souhaite discuter de votre profil.',
      '/conversations/' || v_conv::text,
      'conversation',
      v_conv
    );
  end if;

  select coalesce(sum(t.amount), 0)::integer into v_balance
    from public.token_transactions t
   where t.developer_id = v_user_id;

  return jsonb_build_object(
    'conversation_id', v_conv,
    'first_contact', true,
    'cost', v_cost,
    'balance', v_balance
  );
end;
$$;

-- ------------------------------------------------------------
-- 6. Annuaire : développeurs approuvés (active/verified), PII masquée,
--    filtres + tri + pagination. Accessible aux visiteurs (SEO).
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
        'email_masked', public.mask_email(du.email)
      ) as jb
      from public.developers d
      left join public.developer_profiles dp on dp.developer_id = d.id
      left join auth.users du on du.id = d.id
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
-- 6b. get_directory_filters : valeurs possibles des filtres
--     (alimente les listes déroulantes de l'annuaire).
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
        from (select distinct main_specialty as x from public.developer_profiles where main_specialty is not null) u
    ), '[]'::jsonb),
    'cities', coalesce((
      select jsonb_agg(x order by x)
        from (select distinct city as x from public.developers d where d.status in ('active', 'verified') and d.city is not null) u
    ), '[]'::jsonb),
    'services', coalesce((
      select jsonb_agg(x order by x)
        from (select distinct service as x from public.developer_services) u
    ), '[]'::jsonb),
    'project_types', coalesce((
      select jsonb_agg(x order by x)
        from (select distinct project_type as x from public.developer_projects where project_type is not null) u
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.get_directory_filters() to anon, authenticated;

-- ------------------------------------------------------------
-- 7. get_my_token_history : historique personnel du portefeuille
--    avec solde avant / après chaque opération.
-- ------------------------------------------------------------
create or replace function public.get_my_token_history(p_limit integer default 200)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(j), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', t.id,
      'amount', t.amount,
      'amount_fcfa', t.amount_fcfa,
      'type', t.type,
      'label', case t.type
        when 'purchase' then 'Achat de Tokens'
        when 'bonus' then 'Bonus'
        when 'unlock' then 'Contact — ' || coalesce(r.client_name, 'brief')
        when 'publish' then 'Publication d''un brief'
        when 'contact' then 'Contact — ' || coalesce(td.full_name, 'développeur')
        when 'adjust' then 'Ajustement de l''administration'
        else t.type
      end,
      'balance_before', t.balance_after - t.amount,
      'balance_after', t.balance_after,
      'created_at', t.created_at
    ) as j
    from (
      select t.*,
        sum(t.amount) over (
          order by t.created_at, t.id
          rows between unbounded preceding and current row
        ) as balance_after
      from public.token_transactions t
      where t.developer_id = auth.uid()
    ) t
    left join public.developers td on td.id = t.target_developer_id
    left join public.requests r on r.id = t.request_id
    order by t.created_at desc, t.id desc
    limit greatest(0, least(coalesce(p_limit, 200), 500))
  ) x;
$$;

-- ------------------------------------------------------------
-- 8. get_peer_display_name : identité légère d'un interlocuteur
--    (utilisé par la messagerie pour les conversations directes).
-- ------------------------------------------------------------
create or replace function public.get_peer_display_name(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'full_name', d.full_name,
    'username', d.username,
    'avatar_url', d.avatar_url,
    'professional_title', dp.professional_title,
    'main_specialty', dp.main_specialty,
    'company_name', cp.company_name,
    'city', coalesce(d.city, cp.city),
    'country', d.country
  )
  from public.developers d
  left join public.developer_profiles dp on dp.developer_id = d.id
  left join public.client_profiles cp on cp.id = d.id
  where d.id = p_user_id;
$$;

-- ------------------------------------------------------------
-- 9. Renforcements PII.
--  a) get_public_developer_profile ne renvoie plus le téléphone brut.
--  b) list_developers_for_brief (coordonnées brutes) retiré aux
--     utilisateurs connectés : réservé au service serveur.
-- ------------------------------------------------------------
create or replace function public.get_public_developer_profile(p_identifier text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_identifier text := nullif(btrim(p_identifier), '');
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

revoke execute on function public.list_developers_for_brief(text, text[]) from authenticated, anon;

-- ------------------------------------------------------------
-- 10. Admin Tokens.
-- ------------------------------------------------------------
create or replace function public.admin_list_packages()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'tokens', p.tokens,
        'price_fcfa', p.price_fcfa,
        'popular', p.popular
      )
      order by p.price_fcfa asc
    )
    from public.token_packages p
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_update_package(
  p_id text,
  p_name text,
  p_tokens integer,
  p_price_fcfa integer,
  p_popular boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := nullif(btrim(coalesce(p_id, '')), '');
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;
  if v_id is null or v_name is null then
    raise exception 'Informations du pack invalides.' using errcode = 'TLBAD';
  end if;
  if p_tokens is null or p_tokens <= 0 or p_tokens > 1000000 then
    raise exception 'Nombre de Tokens invalide.' using errcode = 'TLBAD';
  end if;
  if p_price_fcfa is null or p_price_fcfa < 0 or p_price_fcfa > 100000000 then
    raise exception 'Prix invalide.' using errcode = 'TLBAD';
  end if;

  insert into public.token_packages (id, name, tokens, price_fcfa, popular)
  values (v_id, v_name, p_tokens, p_price_fcfa, coalesce(p_popular, false))
  on conflict (id) do update
  set name = excluded.name,
      tokens = excluded.tokens,
      price_fcfa = excluded.price_fcfa,
      popular = excluded.popular;

  insert into public.admin_actions (admin_id, entity_type, entity_id, action, message)
  values (auth.uid(), 'token_packages', null, 'update_package',
    ('Pack ' || v_id || ' : ' || p_tokens || ' Tokens à ' || p_price_fcfa || ' FCFA'));

  return jsonb_build_object(
    'id', v_id,
    'name', v_name,
    'tokens', p_tokens,
    'price_fcfa', p_price_fcfa,
    'popular', coalesce(p_popular, false)
  );
end;
$$;

create or replace function public.admin_list_balances(
  p_query text default null,
  p_limit integer default 200
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
  v_limit integer := greatest(1, least(coalesce(p_limit, 200), 500));
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  return coalesce((
    select jsonb_agg(j)
    from (
      select jsonb_build_object(
        'id', d.id,
        'full_name', d.full_name,
        'email', du.email,
        'role', coalesce(ur.role, 'developer'),
        'status', d.status,
        'is_verified', d.is_verified,
        'company_name', cp.company_name,
        'balance', coalesce(b.balance, 0),
        'created_at', d.created_at
      ) as j
      from public.developers d
      left join auth.users du on du.id = d.id
      left join public.user_roles ur on ur.user_id = d.id
      left join public.client_profiles cp on cp.id = d.id
      left join (
        select developer_id, sum(amount)::integer as balance
          from public.token_transactions
         group by developer_id
      ) b on b.developer_id = d.id
      where d.status <> 'suspended'
         or ur.role = 'client'
      order by coalesce(b.balance, 0) desc, d.created_at asc
      limit v_limit
    ) s
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_adjust_tokens(
  p_developer uuid,
  p_amount integer,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_balance integer;
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;
  if p_developer is null or p_amount is null or p_amount = 0 then
    raise exception 'Ajustement invalide.' using errcode = 'TLBAD';
  end if;
  if p_amount < 0 and v_reason = '' then
    raise exception 'Un motif est requis pour un retrait de Tokens.' using errcode = 'TLBAD';
  end if;
  if p_amount > 1000000 or p_amount < -1000000 then
    raise exception 'Ajustement trop important.' using errcode = 'TLBAD';
  end if;
  if not exists (select 1 from public.developers where id = p_developer) then
    raise exception 'Utilisateur introuvable.' using errcode = 'TLNOD';
  end if;

  insert into public.token_transactions (developer_id, amount, type)
  values (p_developer, p_amount, 'adjust');

  insert into public.admin_actions (admin_id, entity_type, entity_id, action, message)
  values (auth.uid(), 'tokens', p_developer, 'adjust_tokens',
    ('Ajustement de ' || p_amount || ' Tokens' || case when v_reason = '' then '' else ' — ' || v_reason end));

  select coalesce(sum(t.amount), 0)::integer into v_balance
    from public.token_transactions t
   where t.developer_id = p_developer;

  return jsonb_build_object(
    'developer_id', p_developer,
    'adjusted', p_amount,
    'reason', nullif(v_reason, ''),
    'balance', v_balance
  );
end;
$$;

create or replace function public.admin_set_contact_cost(p_tokens integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;
  if p_tokens is null or p_tokens < 0 or p_tokens > 1000 then
    raise exception 'Coût invalide.' using errcode = 'TLBAD';
  end if;

  insert into public.app_settings (key, value, updated_at)
  values ('contact_cost_tokens', to_jsonb(p_tokens), now())
  on conflict (key) do update
  set value = excluded.value, updated_at = now();

  insert into public.admin_actions (admin_id, entity_type, entity_id, action, message)
  values (auth.uid(), 'settings', null, 'set_contact_cost',
    ('Coût du contact : ' || p_tokens || ' Token(s)'));

  return jsonb_build_object('cost_tokens', p_tokens);
end;
$$;

create or replace function public.admin_list_contacts(p_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 500));
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  return coalesce((
    select jsonb_agg(j)
    from (
      select jsonb_build_object(
        'id', c.id,
        'client_id', c.client_id,
        'client_name', cd.full_name,
        'developer_id', c.developer_id,
        'developer_name', dv.full_name,
        'status', c.status,
        'last_message_at', c.last_message_at,
        'created_at', c.created_at
      ) as j
      from public.conversations c
      join public.developers cd on cd.id = c.client_id
      join public.developers dv on dv.id = c.developer_id
      where c.request_id is null
      order by c.created_at desc
      limit v_limit
    ) s
  ), '[]'::jsonb);
end;
$$;

-- ------------------------------------------------------------
-- 11. admin_list_transactions enrichi (cible + libellé admin).
-- ------------------------------------------------------------
create or replace function public.admin_list_transactions(p_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 500));
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  return coalesce((
    select jsonb_agg(j)
    from (
      select jsonb_build_object(
        'id', t.id,
        'developer_id', t.developer_id,
        'developer_name', d.full_name,
        'amount', t.amount,
        'amount_fcfa', t.amount_fcfa,
        'type', t.type,
        'label', case t.type
          when 'purchase' then 'Achat'
          when 'bonus' then 'Bonus'
          when 'unlock' then 'Contact brief'
          when 'publish' then 'Publication'
          when 'contact' then 'Contact direct'
          when 'adjust' then 'Ajustement admin'
          else t.type
        end,
        'request_id', t.request_id,
        'request_name', r.client_name,
        'target_developer_id', t.target_developer_id,
        'target_developer_name', td.full_name,
        'created_at', t.created_at
      ) as j
      from public.token_transactions t
      left join public.developers d on d.id = t.developer_id
      left join public.developers td on td.id = t.target_developer_id
      left join public.requests r on r.id = t.request_id
      order by t.created_at desc
      limit v_limit
    ) s
  ), '[]'::jsonb);
end;
$$;

-- ------------------------------------------------------------
-- 12. Stats : tokens_used comptabilise TOUTES les dépenses ;
--     compteurs de contacts directs.
-- ------------------------------------------------------------
create or replace function public.get_admin_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  return (
    select jsonb_build_object(
      'requests_total', count(*),
      'requests_open', count(*) filter (where status = 'ouvert'),
      'developers_total', (select count(*) from public.developers),
      'approved_developers', (select count(*) from public.developers where status in ('active', 'verified')),
      'tokens_sold', coalesce((
        select sum(amount)::integer from public.token_transactions
        where type in ('purchase', 'bonus')
      ), 0),
      'tokens_used', coalesce((
        select -sum(amount)::integer from public.token_transactions
        where amount < 0
      ), 0),
      'tokens_contacts', coalesce((
        select -sum(amount)::integer from public.token_transactions
        where type = 'contact'
      ), 0),
      'revenue_fcfa', coalesce((
        select sum(amount_fcfa)::integer from public.token_transactions
        where type = 'purchase' and amount_fcfa is not null
      ), 0),
      'unlocks_total', (select count(*) from public.unlocks),
      'contacts_total', (select count(*) from public.conversations where request_id is null)
    )
    from public.requests
  );
end;
$$;

create or replace function public.admin_alerts()
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  return jsonb_build_object(
    'pending_applications', (
      select count(*)::integer from public.developers where status = 'pending'
    ),
    'changes_requested', (
      select count(*)::integer from public.developers where status = 'changes_requested'
    ),
    'pending_verifications', (
      select count(*)::integer from public.verification_requests
      where payment_status = 'confirmed' and verification_status = 'pending'
    ),
    'pending_payments', (
      select count(*)::integer from public.verification_requests
      where payment_status = 'pending'
    ),
    'verification_price_fcfa', public.get_verification_price(),
    'contact_cost_tokens', public.get_contact_cost()
  );
end;
$$;

-- ------------------------------------------------------------
-- 13. Privilèges.
-- ------------------------------------------------------------
grant execute on function public.get_contact_cost() to anon, authenticated;
grant execute on function public.list_approved_developers(
  text, text, text[], text[], text, integer, text, numeric, boolean, text, text, integer, integer
) to anon, authenticated;
grant execute on function public.contact_developer(uuid, text) to authenticated;
grant execute on function public.get_my_token_history(integer) to authenticated;
grant execute on function public.get_peer_display_name(uuid) to authenticated;

grant execute on function public.admin_list_packages() to authenticated;
grant execute on function public.admin_update_package(text, text, integer, integer, boolean) to authenticated;
grant execute on function public.admin_list_balances(text, integer) to authenticated;
grant execute on function public.admin_adjust_tokens(uuid, integer, text) to authenticated;
grant execute on function public.admin_set_contact_cost(integer) to authenticated;
grant execute on function public.admin_list_contacts(integer) to authenticated;

-- ------------------------------------------------------------
-- 14. create_token_order : ouvre l'achat de Tokens aux clients.
--     (les comptes clients disposent d'une ligne developers avec
--      status='suspended' ; seuls active/verified et 'client' passent)
-- ------------------------------------------------------------
create or replace function public.create_token_order(p_package_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_dev public.developers%rowtype;
  v_role text;
  v_pkg public.token_packages%rowtype;
  v_order public.token_orders%rowtype;
begin
  if v_user is null then
    raise exception 'Connectez-vous pour commander.' using errcode = 'TLNAU';
  end if;

  select * into v_dev from public.developers where id = v_user;
  if v_dev.id is null then
    raise exception 'Profil requis.' using errcode = 'TLNOD';
  end if;

  select role into v_role from public.user_roles where user_id = v_user;

  if v_dev.status not in ('active', 'verified') and v_role <> 'client' then
    if v_dev.status in ('pending', 'verification_pending') then
      raise exception 'Votre compte développeur est en attente de validation.' using errcode = 'TLPEN';
    end if;
    raise exception 'Votre compte ne permet pas d''acheter des Tokens.' using errcode = 'TLRJC';
  end if;

  select * into v_pkg from public.token_packages where id = p_package_id;
  if v_pkg.id is null then
    raise exception 'Pack introuvable.' using errcode = 'TLNOP';
  end if;

  insert into public.token_orders (developer_id, package_id, package_name, tokens, price_fcfa)
  values (v_user, v_pkg.id, v_pkg.name, v_pkg.tokens, v_pkg.price_fcfa)
  returning * into v_order;

  return jsonb_build_object(
    'order_id', v_order.id,
    'package_name', v_order.package_name,
    'tokens', v_order.tokens,
    'price_fcfa', v_order.price_fcfa,
    'status', v_order.status,
    'created_at', v_order.created_at
  );
end;
$$;

grant execute on function public.create_token_order(text) to authenticated;

-- Recharge du cache PostgREST.
notify pgrst, 'reload schema';