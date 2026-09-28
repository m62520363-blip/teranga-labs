-- ============================================================
-- TERANGA LABS — Migration 0003 : fonctions RPC sécurisées
-- Toutes les opérations sensibles passent par ici.
-- Aucune vérification uniquement côté frontend.
-- ============================================================

-- ------------------------------------------------------------
-- Helper : l'utilisateur courant est-il admin ?
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- ------------------------------------------------------------
-- Balance tokens du développeur courant
-- ------------------------------------------------------------
create or replace function public.get_token_balance()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(sum(amount), 0)::integer
  from public.token_transactions
  where developer_id = auth.uid();
$$;

-- ------------------------------------------------------------
-- Rôle de l'utilisateur courant
-- ------------------------------------------------------------
create or replace function public.get_my_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select role from public.user_roles where user_id = auth.uid()),
    'developer'
  )::text;
$$;

-- ------------------------------------------------------------
-- DÉBLOCAGE D'UN CONTACT — atomique et sécurisé
-- 1 Token = 1 contact. Ne débite jamais deux fois le même brief.
-- ------------------------------------------------------------
create or replace function public.unlock_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_req public.requests%rowtype;
  v_balance integer;
  v_already_unlocked boolean;
begin
  if v_user_id is null then
    raise exception 'Vous devez être connecté.' using errcode = 'TLNAU';
  end if;

  if not exists (select 1 from public.developers where id = v_user_id) then
    raise exception 'Profil développeur requis.' using errcode = 'TLNOD';
  end if;

  -- Verrou anti-course : sérialise les déblocages concurrents de ce développeur.
  perform 1 from public.developers where id = v_user_id for update;

  select * into v_req from public.requests where id = p_request_id;
  if v_req.id is null then
    raise exception 'Ce brief n''existe pas.' using errcode = 'TLNOR';
  end if;

  if v_req.status <> 'ouvert' then
    raise exception 'Ce brief n''est plus disponible.' using errcode = 'TLCLO';
  end if;

  select exists (
    select 1 from public.unlocks
    where developer_id = v_user_id and request_id = p_request_id
  ) into v_already_unlocked;

  if v_already_unlocked then
    raise exception 'Vous avez déjà débloqué ce contact.' using errcode = 'TLDUP';
  end if;

  select coalesce(sum(t.amount), 0)::integer
    into v_balance
    from public.token_transactions t
   where t.developer_id = v_user_id;

  -- verrou anti-course sur le solde côté application
  if v_balance < 1 then
    raise exception 'Tokens insuffisants. Rechargez vos Tokens.' using errcode = 'TLLOW';
  end if;

  insert into public.token_transactions (developer_id, amount, type, request_id)
  values (v_user_id, -1, 'unlock', p_request_id);

  insert into public.unlocks (developer_id, request_id)
  values (v_user_id, p_request_id);

  return jsonb_build_object(
    'request_id', v_req.id,
    'client_name', v_req.client_name,
    'client_whatsapp', v_req.client_whatsapp,
    'balance', (
      select coalesce(sum(t.amount), 0)::integer
      from public.token_transactions t
      where t.developer_id = v_user_id
    )
  );
end;
$$;

-- ------------------------------------------------------------
-- Historique des déblocages du développeur courant (avec contacts)
-- ------------------------------------------------------------
create or replace function public.get_my_unlocks()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'unlock_id', u.id,
        'request_id', r.id,
        'client_name', r.client_name,
        'client_city', r.client_city,
        'project_type', r.project_type,
        'budget', r.budget,
        'client_whatsapp', r.client_whatsapp,
        'unlocked_at', u.created_at
      )
      order by u.created_at desc
    ),
    '[]'::jsonb
  )
  from public.unlocks u
  join public.requests r on r.id = u.request_id
  where u.developer_id = auth.uid();
$$;

-- ------------------------------------------------------------
-- ADMIN : créditer des Tokens après confirmation serveur d'un
-- paiement réellement validé (Wave / PayDunya).
-- Un clic client ne crédite JAMAIS tout seul.
-- ------------------------------------------------------------
create or replace function public.credit_tokens(
  p_developer uuid,
  p_amount integer,
  p_amount_fcfa integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance integer;
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Montant de tokens invalide.' using errcode = 'TLBAD';
  end if;

  if not exists (select 1 from public.developers where id = p_developer) then
    raise exception 'Développeur introuvable.' using errcode = 'TLNOD';
  end if;

  insert into public.token_transactions (developer_id, amount, amount_fcfa, type)
  values (
    p_developer,
    p_amount,
    p_amount_fcfa,
    case when p_amount_fcfa is not null then 'purchase' else 'bonus' end
  );

  select coalesce(sum(t.amount), 0)::integer
    into v_new_balance
    from public.token_transactions t
   where t.developer_id = p_developer;

  return jsonb_build_object(
    'developer_id', p_developer,
    'credited', p_amount,
    'balance', v_new_balance
  );
end;
$$;

-- ------------------------------------------------------------
-- ADMIN : statistiques agrégées
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
      'tokens_sold', coalesce((
        select sum(amount)::integer from public.token_transactions
        where type in ('purchase', 'bonus')
      ), 0),
      'tokens_used', coalesce((
        select -sum(amount)::integer from public.token_transactions
        where type = 'unlock'
      ), 0),
      'revenue_fcfa', coalesce((
        select sum(amount_fcfa)::integer from public.token_transactions
        where type = 'purchase' and amount_fcfa is not null
      ), 0),
      'unlocks_total', (select count(*) from public.unlocks)
    )
    from public.requests
  );
end;
$$;

-- ------------------------------------------------------------
-- ADMIN : liste des briefs (avec coordonnées)
-- ------------------------------------------------------------
create or replace function public.admin_list_requests()
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
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'client_name', r.client_name,
          'client_whatsapp', r.client_whatsapp,
          'client_city', r.client_city,
          'project_type', r.project_type,
          'budget', r.budget,
          'description', r.description,
          'status', r.status,
          'hidden', r.hidden,
          'created_at', r.created_at
        )
        order by r.created_at desc
      ),
      '[]'::jsonb
    )
    from public.requests r
  );
end;
$$;

-- ------------------------------------------------------------
-- ADMIN : liste des développeurs
-- ------------------------------------------------------------
create or replace function public.admin_list_developers()
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
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'full_name', d.full_name,
          'email', du.email,
          'whatsapp', d.whatsapp,
          'skills', d.skills,
          'balance', coalesce((
            select sum(t.amount)::integer
            from public.token_transactions t
            where t.developer_id = d.id
          ), 0),
          'created_at', d.created_at
        )
        order by d.created_at desc
      ),
      '[]'::jsonb
    )
    from public.developers d
    left join auth.users du on du.id = d.id
  );
end;
$$;

-- ------------------------------------------------------------
-- ADMIN : liste des transactions de tokens
-- ------------------------------------------------------------
create or replace function public.admin_list_transactions(p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 500));
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  return (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'developer_id', t.developer_id,
          'developer_name', d.full_name,
          'amount', t.amount,
          'amount_fcfa', t.amount_fcfa,
          'type', t.type,
          'request_id', t.request_id,
          'request_name', r.client_name,
          'created_at', t.created_at
        )
        order by t.created_at desc
      ),
      '[]'::jsonb
    )
    from public.token_transactions t
    left join public.developers d on d.id = t.developer_id
    left join public.requests r on r.id = t.request_id
    limit v_limit
  );
end;
$$;

-- ------------------------------------------------------------
-- ADMIN : modérer un brief (statut / visibilité)
-- ------------------------------------------------------------
create or replace function public.admin_update_request(
  p_request_id uuid,
  p_status text default null,
  p_hidden boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  update public.requests
     set status = coalesce(p_status, status),
         hidden = coalesce(p_hidden, hidden)
   where id = p_request_id;

  if not found then
    raise exception 'Brief introuvable.' using errcode = 'TLNOR';
  end if;

  return jsonb_build_object('request_id', p_request_id, 'status', coalesce(p_status, status), 'hidden', coalesce(p_hidden, hidden));
end;
$$;