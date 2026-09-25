-- ============================================================
-- 0001_initial_schema.sql
-- ============================================================
-- ============================================================
-- TERANGA LABS â€” Migration 0001 : schÃ©ma initial
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- briefs clients (requests)
-- ------------------------------------------------------------
create table public.requests (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  client_whatsapp text not null,
  client_city text not null,
  project_type text not null check (
    project_type in ('vitrine', 'e-commerce', 'landing page', 'app web')
  ),
  budget integer not null,
  description text not null,
  status text not null default 'ouvert' check (
    status in ('ouvert', 'attribuÃ©', 'terminÃ©', 'fermÃ©')
  ),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index requests_status_idx on public.requests (status);
create index requests_created_at_idx on public.requests (created_at desc);

-- ------------------------------------------------------------
-- dÃ©veloppeurs (developers)
-- ------------------------------------------------------------
create table public.developers (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  whatsapp text,
  skills text[],
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- packs de tokens
-- ------------------------------------------------------------
create table public.token_packages (
  id text primary key,
  name text not null,
  tokens integer not null,
  price_fcfa integer not null,
  popular boolean not null default false
);

-- ------------------------------------------------------------
-- transactions de tokens
-- ------------------------------------------------------------
create table public.token_transactions (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid references public.developers(id) on delete cascade not null,
  amount integer not null,
  amount_fcfa integer,
  type text not null check (type in ('purchase', 'unlock', 'bonus')),
  request_id uuid references public.requests(id),
  created_at timestamptz not null default now()
);

create index token_transactions_developer_idx on public.token_transactions (developer_id);
create index token_transactions_created_at_idx on public.token_transactions (created_at desc);

-- ------------------------------------------------------------
-- dÃ©blocages de contacts
-- ------------------------------------------------------------
create table public.unlocks (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid references public.developers(id) on delete cascade not null,
  request_id uuid references public.requests(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  unique (developer_id, request_id)
);

create index unlocks_developer_idx on public.unlocks (developer_id);

-- ------------------------------------------------------------
-- rÃ´les utilisateurs (RBAC admin/moderateur/dÃ©veloppeur)
-- ------------------------------------------------------------
create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'developer' check (role in ('developer', 'moderator', 'admin')),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- packs par dÃ©faut
-- ------------------------------------------------------------
insert into public.token_packages (id, name, tokens, price_fcfa, popular) values
  ('discovery', 'DÃ©couverte', 1, 2500, false),
  ('starter', 'Starter', 3, 6500, false),
  ('pro', 'Pro', 10, 20000, true),
  ('agence', 'Agence', 25, 45000, false);

-- ------------------------------------------------------------
-- trigger : crÃ©er automatiquement dÃ©veloppeur + rÃ´le Ã  l'inscription
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.developers (id, full_name, whatsapp, skills)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'whatsapp', ''),
    case
      when jsonb_typeof(new.raw_user_meta_data -> 'skills') = 'array'
        then jsonb_array_to_text_array(new.raw_user_meta_data -> 'skills')
      when new.raw_user_meta_data ? 'skills'
        then array[new.raw_user_meta_data ->> 'skills']
      else null
    end
  );

  insert into public.user_roles (user_id, role)
  values (new.id, 'developer');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 0002_rls.sql
-- ============================================================
-- ============================================================
-- TERANGA LABS â€” Migration 0002 : RLS et privilÃ¨ges
-- ============================================================

-- ------------------------------------------------------------
-- requests : le WhatsApp n'est JAMAIS lisible par SELECT public
-- ------------------------------------------------------------
revoke all on public.requests from anon, authenticated;

grant select (id, client_name, client_city, project_type, budget, description, status, hidden, created_at)
  on public.requests to anon, authenticated;

grant insert (client_name, client_whatsapp, client_city, project_type, budget, description)
  on public.requests to anon, authenticated;

alter table public.requests enable row level security;

create policy "requests_public_read"
  on public.requests for select
  to anon, authenticated
  using (status = 'ouvert' and hidden = false);

create policy "requests_public_create"
  on public.requests for insert
  to anon, authenticated
  with check (true);

-- ------------------------------------------------------------
-- developers : chacun sur son propre profil
-- ------------------------------------------------------------
alter table public.developers enable row level security;

create policy "developers_select_own"
  on public.developers for select
  to authenticated
  using (id = auth.uid());

create policy "developers_update_own"
  on public.developers for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ------------------------------------------------------------
-- token_packages : lecture publique uniquement
-- ------------------------------------------------------------
alter table public.token_packages enable row level security;

create policy "packages_public_read"
  on public.token_packages for select
  to anon, authenticated
  using (true);

-- ------------------------------------------------------------
-- token_transactions : chaque dÃ©veloppeur voit les siennes
-- ------------------------------------------------------------
alter table public.token_transactions enable row level security;

create policy "transactions_select_own"
  on public.token_transactions for select
  to authenticated
  using (developer_id = auth.uid());

-- pas d'insert / update / delete par le client : tout passe
-- par les fonctions RPC sÃ©curisÃ©es (unlock_request, credit_tokens).

-- ------------------------------------------------------------
-- unlocks : chaque dÃ©veloppeur voit ses dÃ©blocages
-- ------------------------------------------------------------
alter table public.unlocks enable row level security;

create policy "unlocks_select_own"
  on public.unlocks for select
  to authenticated
  using (developer_id = auth.uid());

-- ------------------------------------------------------------
-- user_roles : lecture de son propre rÃ´le
-- ------------------------------------------------------------
alter table public.user_roles enable row level security;

create policy "user_roles_select_own"
  on public.user_roles for select
  to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- 0003_rpc.sql
-- ============================================================
-- ============================================================
-- TERANGA LABS â€” Migration 0003 : fonctions RPC sÃ©curisÃ©es
-- Toutes les opÃ©rations sensibles passent par ici.
-- Aucune vÃ©rification uniquement cÃ´tÃ© frontend.
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
-- Balance tokens du dÃ©veloppeur courant
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
-- RÃ´le de l'utilisateur courant
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
-- DÃ‰BLOCAGE D'UN CONTACT â€” atomique et sÃ©curisÃ©
-- 1 Token = 1 contact. Ne dÃ©bite jamais deux fois le mÃªme brief.
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
    raise exception 'Vous devez Ãªtre connectÃ©.' using errcode = 'TLNAU';
  end if;

  if not exists (select 1 from public.developers where id = v_user_id) then
    raise exception 'Profil dÃ©veloppeur requis.' using errcode = 'TLNOD';
  end if;

  -- Verrou anti-course : sÃ©rialise les dÃ©blocages concurrents de ce dÃ©veloppeur.
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
    raise exception 'Vous avez dÃ©jÃ  dÃ©bloquÃ© ce contact.' using errcode = 'TLDUP';
  end if;

  select coalesce(sum(t.amount), 0)::integer
    into v_balance
    from public.token_transactions t
   where t.developer_id = v_user_id;

  -- verrou anti-course sur le solde cÃ´tÃ© application
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
-- Historique des dÃ©blocages du dÃ©veloppeur courant (avec contacts)
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
-- ADMIN : crÃ©diter des Tokens aprÃ¨s confirmation serveur d'un
-- paiement rÃ©ellement validÃ© (Wave / Orange Money / PayDunya).
-- Un clic client ne crÃ©dite JAMAIS tout seul.
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
    raise exception 'AccÃ¨s rÃ©servÃ© Ã  l''administration.' using errcode = 'TLAAC';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Montant de tokens invalide.' using errcode = 'TLBAD';
  end if;

  if not exists (select 1 from public.developers where id = p_developer) then
    raise exception 'DÃ©veloppeur introuvable.' using errcode = 'TLNOD';
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
-- ADMIN : statistiques agrÃ©gÃ©es
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
    raise exception 'AccÃ¨s rÃ©servÃ© Ã  l''administration.' using errcode = 'TLAAC';
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
-- ADMIN : liste des briefs (avec coordonnÃ©es)
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
    raise exception 'AccÃ¨s rÃ©servÃ© Ã  l''administration.' using errcode = 'TLAAC';
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
-- ADMIN : liste des dÃ©veloppeurs
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
    raise exception 'AccÃ¨s rÃ©servÃ© Ã  l''administration.' using errcode = 'TLAAC';
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
    raise exception 'AccÃ¨s rÃ©servÃ© Ã  l''administration.' using errcode = 'TLAAC';
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
-- ADMIN : modÃ©rer un brief (statut / visibilitÃ©)
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
    raise exception 'AccÃ¨s rÃ©servÃ© Ã  l''administration.' using errcode = 'TLAAC';
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

-- ============================================================
-- 0004_features.sql
-- ============================================================
-- ============================================================
-- TERANGA LABS â€” Migration 0004 : fonctionnalitÃ©s
-- 1) Validation des comptes dÃ©veloppeurs
-- 2) Espace client Â« mes briefs Â» (lien secret de gestion)
-- 3) Commandes de Tokens (paiement Ã  confirmer par l'admin)
-- 4) RÃ©putation & avis dÃ©veloppeurs
-- 5) Signalement d'abus (modÃ©ration admin)
-- ============================================================

-- ------------------------------------------------------------
-- 1) developers.status : le compte doit Ãªtre validÃ© par l'admin
--    avant de pouvoir dÃ©bloquer des contacts.
-- ------------------------------------------------------------
alter table public.developers
  add column if not exists status text not null default 'pending'
  check (status in ('pending', 'active', 'rejected', 'suspended'));

create index if not exists developers_status_idx on public.developers (status);

-- ------------------------------------------------------------
-- 2) requests.management_key : le client garde un lien secret
--    pour suivre son brief. Jamais sÃ©lectionnable publiquement.
-- ------------------------------------------------------------
alter table public.requests
  add column if not exists management_key uuid not null default gen_random_uuid();

create index if not exists requests_management_key_idx on public.requests (management_key);

-- ------------------------------------------------------------
-- 4) reviews : avis du client sur un dÃ©veloppeur, liÃ© Ã  un brief.
-- ------------------------------------------------------------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid references public.developers(id) on delete cascade not null,
  request_id uuid references public.requests(id) on delete cascade not null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, developer_id)
);

create index if not exists reviews_developer_idx on public.reviews (developer_id);

alter table public.reviews enable row level security;

create policy "reviews_select_own_developer"
  on public.reviews for select
  to authenticated
  using (developer_id = auth.uid());

-- ------------------------------------------------------------
-- 5) reports : signalements d'abus traitÃ©s par l'admin.
-- ------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('brief', 'developer')),
  target_id uuid not null,
  reporter_id uuid references auth.users(id) on delete set null,
  reason text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists reports_status_idx on public.reports (status);
create index if not exists reports_target_idx on public.reports (target_type, target_id);

alter table public.reports enable row level security;

-- ------------------------------------------------------------
-- 3) token_orders : commande de Tokens crÃ©Ã©e depuis /tokens,
--    confirmÃ©e par l'admin aprÃ¨s encaissement rÃ©el du paiement.
-- ------------------------------------------------------------
create table if not exists public.token_orders (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid references public.developers(id) on delete cascade not null,
  package_id text not null,
  package_name text not null,
  tokens integer not null check (tokens > 0),
  price_fcfa integer not null check (price_fcfa > 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  notes text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists token_orders_status_idx on public.token_orders (status);
create index if not exists token_orders_developer_idx on public.token_orders (developer_id);

alter table public.token_orders enable row level security;

-- ============================================================
-- RPC
-- ============================================================

-- ------------------------------------------------------------
-- create_brief : publication d'un brief (retourne l'id et la clÃ©
-- de gestion). La clÃ© ne passe JAMAIS par un SELECT public.
-- ------------------------------------------------------------
create or replace function public.create_brief(
  p_client_name text,
  p_client_whatsapp text,
  p_client_city text,
  p_project_type text,
  p_budget integer,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.requests%rowtype;
begin
  if p_client_name is null or length(btrim(p_client_name)) < 2 then
    raise exception 'Nom du client manquant.' using errcode = 'TLBAD';
  end if;
  if p_client_whatsapp is null or p_client_whatsapp = '' then
    raise exception 'NumÃ©ro WhatsApp manquant.' using errcode = 'TLBAD';
  end if;
  if p_budget is null or p_budget < 10000 then
    raise exception 'Budget invalide (minimum 10000 F).' using errcode = 'TLBAD';
  end if;
  if p_project_type not in ('vitrine', 'e-commerce', 'landing page', 'app web') then
    raise exception 'Type de projet invalide.' using errcode = 'TLBAD';
  end if;

  insert into public.requests (
    client_name, client_whatsapp, client_city, project_type, budget, description
  ) values (
    p_client_name,
    p_client_whatsapp,
    p_client_city,
    p_project_type,
    p_budget,
    p_description
  )
  returning * into v_req;

  return jsonb_build_object(
    'id', v_req.id,
    'management_key', v_req.management_key
  );
end;
$$;

-- ------------------------------------------------------------
-- get_brief_management : le client pilote son brief via sa clÃ©.
--   - Etat du brief
--   - Nombre de dÃ©blocages + liste des dÃ©veloppeurs (nom, WhatsApp,
--     compÃ©tences) pour recontacter
--   - Note moyenne et nombre d'avis dÃ©jÃ  laissÃ©s
-- ------------------------------------------------------------
create or replace function public.get_brief_management(p_management_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_req public.requests%rowtype;
begin
  select * into v_req from public.requests where management_key = p_management_key;
  if v_req.id is null then
    raise exception 'Lien de gestion invalide.' using errcode = 'TLNOK';
  end if;

  return jsonb_build_object(
    'id', v_req.id,
    'client_name', v_req.client_name,
    'client_whatsapp', v_req.client_whatsapp,
    'client_city', v_req.client_city,
    'project_type', v_req.project_type,
    'budget', v_req.budget,
    'description', v_req.description,
    'status', v_req.status,
    'hidden', v_req.hidden,
    'created_at', v_req.created_at,
    'unlocks_count', (select count(*)::integer from public.unlocks where request_id = v_req.id),
    'unlocks', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'developer_id', d.id,
          'full_name', d.full_name,
          'whatsapp', d.whatsapp,
          'skills', d.skills,
          'unlocked_at', u.created_at,
          'rating', (
            select rv.rating from public.reviews rv
            where rv.request_id = v_req.id and rv.developer_id = d.id
          )
        )
        order by u.created_at asc
      )
      from public.unlocks u
      join public.developers d on d.id = u.developer_id
      where u.request_id = v_req.id
    ), '[]'::jsonb)
  );
end;
$$;

-- ------------------------------------------------------------
-- update_brief_status : le client change le statut de son brief
-- ------------------------------------------------------------
create or replace function public.update_brief_status(
  p_management_key uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.requests%rowtype;
begin
  select * into v_req from public.requests where management_key = p_management_key;
  if v_req.id is null then
    raise exception 'Lien de gestion invalide.' using errcode = 'TLNOK';
  end if;

  if p_status not in ('ouvert', 'attribuÃ©', 'terminÃ©', 'fermÃ©') then
    raise exception 'Statut invalide.' using errcode = 'TLBAD';
  end if;

  if v_req.status = 'fermÃ©' and p_status <> 'fermÃ©' then
    raise exception 'Ce brief est fermÃ©.' using errcode = 'TLCLO';
  end if;
  if v_req.status = 'terminÃ©' and p_status not in ('terminÃ©', 'fermÃ©') then
    raise exception 'Transition de statut impossible.' using errcode = 'TLBAD';
  end if;

  update public.requests set status = p_status where id = v_req.id;
  return jsonb_build_object('request_id', v_req.id, 'status', p_status);
end;
$$;

-- ------------------------------------------------------------
-- unlock_request (rÃ©Ã©crite) : exige un compte dÃ©veloppeur validÃ©.
-- ------------------------------------------------------------
create or replace function public.unlock_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_dev public.developers%rowtype;
  v_req public.requests%rowtype;
  v_balance integer;
  v_already_unlocked boolean;
begin
  if v_user_id is null then
    raise exception 'Vous devez Ãªtre connectÃ©.' using errcode = 'TLNAU';
  end if;

  select * into v_dev from public.developers where id = v_user_id;
  if v_dev.id is null then
    raise exception 'Profil dÃ©veloppeur requis.' using errcode = 'TLNOD';
  end if;

  if v_dev.status <> 'active' then
    if v_dev.status = 'pending' then
      raise exception 'Votre compte dÃ©veloppeur est en attente de validation par l''Ã©quipe.' using errcode = 'TLPEN';
    end if;
    raise exception 'Votre compte dÃ©veloppeur ne permet pas de dÃ©bloquer des contacts.' using errcode = 'TLRJC';
  end if;

  -- Verrou anti-course : sÃ©rialise les dÃ©blocages concurrents de ce dÃ©veloppeur.
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
    raise exception 'Vous avez dÃ©jÃ  dÃ©bloquÃ© ce contact.' using errcode = 'TLDUP';
  end if;

  select coalesce(sum(t.amount), 0)::integer
    into v_balance
    from public.token_transactions t
   where t.developer_id = v_user_id;

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
-- submit_review : le client note le dÃ©veloppeur depuis son lien
-- de gestion (authentification = possession de la clÃ©).
-- ------------------------------------------------------------
create or replace function public.submit_review(
  p_management_key uuid,
  p_developer_id uuid,
  p_rating integer,
  p_comment text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.requests%rowtype;
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Note invalide (1 Ã  5).' using errcode = 'TLBAD';
  end if;

  select * into v_req from public.requests where management_key = p_management_key;
  if v_req.id is null then
    raise exception 'Lien de gestion invalide.' using errcode = 'TLNOK';
  end if;

  if not exists (
    select 1 from public.unlocks
    where request_id = v_req.id and developer_id = p_developer_id
  ) then
    raise exception 'Ce dÃ©veloppeur ne travaille pas sur ce brief.' using errcode = 'TLNOD';
  end if;

  insert into public.reviews (developer_id, request_id, rating, comment)
  values (p_developer_id, v_req.id, p_rating, btrim(p_comment))
  on conflict (request_id, developer_id)
  do update set rating = excluded.rating, comment = excluded.comment, updated_at = now();

  return jsonb_build_object('request_id', v_req.id, 'developer_id', p_developer_id, 'rating', p_rating);
end;
$$;

-- ------------------------------------------------------------
-- get_developer_reviews : avis + moyenne d'un dÃ©veloppeur
-- ------------------------------------------------------------
create or replace function public.get_developer_reviews(p_developer uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'total', count(*)::integer,
    'average', round(coalesce(avg(rating), 0), 1)::numeric,
    'reviews', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'rating', r.rating,
          'comment', r.comment,
          'request_name', req.client_name,
          'created_at', r.created_at
        )
        order by r.created_at desc
      ),
      '[]'::jsonb
    )
  )
  from public.reviews r
  left join public.requests req on req.id = r.request_id
  where r.developer_id = p_developer;
$$;

-- ------------------------------------------------------------
-- submit_report : signale un brief ou un dÃ©veloppeur
-- ------------------------------------------------------------
create or replace function public.submit_report(
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reporter uuid := auth.uid();
begin
  if v_reporter is null then
    raise exception 'Connectez-vous pour signaler.' using errcode = 'TLNAU';
  end if;
  if p_target_type not in ('brief', 'developer') then
    raise exception 'Cible invalide.' using errcode = 'TLBAD';
  end if;
  if p_reason is null or p_reason = '' then
    raise exception 'PrÃ©cisez le motif du signalement.' using errcode = 'TLBAD';
  end if;

  insert into public.reports (target_type, target_id, reporter_id, reason, description)
  values (p_target_type, p_target_id, v_reporter, p_reason, p_description);

  return jsonb_build_object('ok', true);
end;
$$;

-- ------------------------------------------------------------
-- set_developer_status : admin valide / rejette un dÃ©veloppeur
-- ------------------------------------------------------------
create or replace function public.set_developer_status(
  p_developer uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'AccÃ¨s rÃ©servÃ© Ã  l''administration.' using errcode = 'TLAAC';
  end if;

  if p_status not in ('pending', 'active', 'rejected', 'suspended') then
    raise exception 'Statut invalide.' using errcode = 'TLBAD';
  end if;

  if not exists (select 1 from public.developers where id = p_developer) then
    raise exception 'DÃ©veloppeur introuvable.' using errcode = 'TLNOD';
  end if;

  update public.developers set status = p_status where id = p_developer;
  return jsonb_build_object('developer_id', p_developer, 'status', p_status);
end;
$$;

-- ------------------------------------------------------------
-- create_token_order : crÃ©ation d'une commande depuis /tokens.
-- Paiement NON automatique : l'admin confirme aprÃ¨s encaissement.
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
  v_pkg public.token_packages%rowtype;
  v_order public.token_orders%rowtype;
begin
  if v_user is null then
    raise exception 'Connectez-vous pour commander.' using errcode = 'TLNAU';
  end if;

  select * into v_dev from public.developers where id = v_user;
  if v_dev.id is null then
    raise exception 'Profil dÃ©veloppeur requis.' using errcode = 'TLNOD';
  end if;
  if v_dev.status <> 'active' then
    raise exception 'Votre compte dÃ©veloppeur doit Ãªtre validÃ© avant d''acheter des Tokens.' using errcode = 'TLPEN';
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

-- ------------------------------------------------------------
-- get_my_orders : commandes du dÃ©veloppeur connectÃ©
-- ------------------------------------------------------------
create or replace function public.get_my_orders()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'package_name', o.package_name,
        'tokens', o.tokens,
        'price_fcfa', o.price_fcfa,
        'status', o.status,
        'created_at', o.created_at
      )
      order by o.created_at desc
    ),
    '[]'::jsonb
  )
  from public.token_orders o
  where o.developer_id = auth.uid();
$$;

-- ------------------------------------------------------------
-- admin_list_orders : commandes + infos dÃ©veloppeur
-- ------------------------------------------------------------
create or replace function public.admin_list_orders(p_status text default 'pending')
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'AccÃ¨s rÃ©servÃ© Ã  l''administration.' using errcode = 'TLAAC';
  end if;

  if p_status not in ('pending', 'confirmed', 'cancelled') then
    raise exception 'Statut invalide.' using errcode = 'TLBAD';
  end if;

  return (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'developer_id', o.developer_id,
          'developer_name', d.full_name,
          'developer_whatsapp', d.whatsapp,
          'package_name', o.package_name,
          'tokens', o.tokens,
          'price_fcfa', o.price_fcfa,
          'status', o.status,
          'created_at', o.created_at,
          'confirmed_at', o.confirmed_at
        )
        order by o.created_at desc
      ),
      '[]'::jsonb
    )
    from public.token_orders o
    left join public.developers d on d.id = o.developer_id
    where o.status = p_status
  );
end;
$$;

-- ------------------------------------------------------------
-- admin_confirm_order : valide la commande APRÃˆS encaissement
-- rÃ©el, puis crÃ©dite les Tokens (transaction 'purchase' traÃ§able).
-- ------------------------------------------------------------
create or replace function public.admin_confirm_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.token_orders%rowtype;
  v_new_balance integer;
begin
  if not public.is_admin() then
    raise exception 'AccÃ¨s rÃ©servÃ© Ã  l''administration.' using errcode = 'TLAAC';
  end if;

  select * into v_order from public.token_orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Commande introuvable.' using errcode = 'TLNOR';
  end if;
  if v_order.status <> 'pending' then
    raise exception 'Cette commande a dÃ©jÃ  Ã©tÃ© traitÃ©e.' using errcode = 'TLDUP';
  end if;

  update public.token_orders
     set status = 'confirmed', confirmed_at = now()
   where id = p_order_id;

  insert into public.token_transactions (developer_id, amount, amount_fcfa, type)
  values (v_order.developer_id, v_order.tokens, v_order.price_fcfa, 'purchase');

  select coalesce(sum(t.amount), 0)::integer
    into v_new_balance
    from public.token_transactions t
   where t.developer_id = v_order.developer_id;

  return jsonb_build_object(
    'order_id', v_order.id,
    'credited', v_order.tokens,
    'balance', v_new_balance
  );
end;
$$;

-- ------------------------------------------------------------
-- admin_cancel_order : annule une commande en attente
-- ------------------------------------------------------------
create or replace function public.admin_cancel_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'AccÃ¨s rÃ©servÃ© Ã  l''administration.' using errcode = 'TLAAC';
  end if;

  update public.token_orders
     set status = 'cancelled'
   where id = p_order_id and status = 'pending';

  if not found then
    raise exception 'Commande introuvable ou dÃ©jÃ  traitÃ©e.' using errcode = 'TLNOR';
  end if;

  return jsonb_build_object('order_id', p_order_id, 'status', 'cancelled');
end;
$$;

-- ------------------------------------------------------------
-- admin_list_reports / admin_update_report : modÃ©ration
-- ------------------------------------------------------------
create or replace function public.admin_list_reports(p_status text default 'open')
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'AccÃ¨s rÃ©servÃ© Ã  l''administration.' using errcode = 'TLAAC';
  end if;

  if p_status not in ('open', 'resolved', 'dismissed') then
    raise exception 'Statut invalide.' using errcode = 'TLBAD';
  end if;

  return (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'target_type', r.target_type,
          'target_id', r.target_id,
          'reporter_email', u.email,
          'reason', r.reason,
          'description', r.description,
          'status', r.status,
          'created_at', r.created_at
        )
        order by r.created_at desc
      ),
      '[]'::jsonb
    )
    from public.reports r
    left join auth.users u on u.id = r.reporter_id
    where r.status = p_status
  );
end;
$$;

create or replace function public.admin_update_report(p_report_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'AccÃ¨s rÃ©servÃ© Ã  l''administration.' using errcode = 'TLAAC';
  end if;

  if p_status not in ('open', 'resolved', 'dismissed') then
    raise exception 'Statut invalide.' using errcode = 'TLBAD';
  end if;

  update public.reports
     set status = p_status, resolved_at = now()
   where id = p_report_id;

  if not found then
    raise exception 'Signalement introuvable.' using errcode = 'TLNOR';
  end if;

  return jsonb_build_object('report_id', p_report_id, 'status', p_status);
end;
$$;

-- ------------------------------------------------------------
-- admin_list_developers : ajoute le statut de validation.
-- get_admin_stats : ajoute le nombre de comptes en attente.
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
    raise exception 'AccÃ¨s rÃ©servÃ© Ã  l''administration.' using errcode = 'TLAAC';
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
          'status', d.status,
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

create or replace function public.get_admin_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'AccÃ¨s rÃ©servÃ© Ã  l''administration.' using errcode = 'TLAAC';
  end if;

  return (
    select jsonb_build_object(
      'requests_total', count(*),
      'requests_open', count(*) filter (where status = 'ouvert'),
      'developers_total', (select count(*) from public.developers),
      'developers_pending', (select count(*) from public.developers where status = 'pending'),
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
      'unlocks_total', (select count(*) from public.unlocks),
      'orders_pending', (select count(*) from public.token_orders where status = 'pending'),
      'reports_open', (select count(*) from public.reports where status = 'open')
    )
    from public.requests
  );
end;
$$;

-- ------------------------------------------------------------
-- PrivilÃ¨ges : tout passe par les RPC security definer.
-- ------------------------------------------------------------
grant execute on function public.create_brief(text, text, text, text, integer, text) to anon, authenticated;
grant execute on function public.get_brief_management(uuid) to anon, authenticated;
grant execute on function public.update_brief_status(uuid, text) to anon, authenticated;
grant execute on function public.submit_review(uuid, uuid, integer, text) to anon, authenticated;
grant execute on function public.get_developer_reviews(uuid) to anon, authenticated;
grant execute on function public.submit_report(text, uuid, text, text) to authenticated;
grant execute on function public.unlock_request(uuid) to authenticated;
grant execute on function public.set_developer_status(uuid, text) to authenticated;
grant execute on function public.create_token_order(text) to authenticated;
grant execute on function public.get_my_orders() to authenticated;
grant execute on function public.admin_list_orders(text) to authenticated;
grant execute on function public.admin_confirm_order(uuid) to authenticated;
grant execute on function public.admin_cancel_order(uuid) to authenticated;
grant execute on function public.admin_list_reports(text) to authenticated;
grant execute on function public.admin_update_report(uuid, text) to authenticated;
grant execute on function public.get_admin_stats() to authenticated;
grant execute on function public.admin_list_developers() to authenticated;
grant execute on function public.admin_list_transactions(integer) to authenticated;
grant execute on function public.credit_tokens(uuid, integer, integer) to authenticated;
grant execute on function public.get_my_role() to anon, authenticated;
grant execute on function public.get_token_balance() to authenticated;
grant execute on function public.get_my_unlocks() to authenticated;

-- ============================================================
-- 0005_payments.sql
-- ============================================================
-- ============================================================
-- TERANGA LABS â€” Migration 0005 : paiement en ligne
-- Checkout Wave (Business API) : session de paiement, puis
-- webhook sÃ©curisÃ© qui crÃ©dite les Tokens.
--
-- Principe de sÃ©curitÃ© :
--   * Aucun crÃ©dit n'est possible par un simple clic client.
--   * credit_from_payment n'est exÃ©cutable QUE via le
--     service_role (clÃ© serveur) : il est rÃ©voquÃ© de
--     public/anon/authenticated.
--   * Idempotent : une intention payÃ©e n'est crÃ©ditÃ©e qu'une fois.
-- ============================================================

-- ------------------------------------------------------------
-- payment_intents : allocation de montant crÃ©Ã©e Ã  l'initiation
-- du paiement. C'est l'unique source de vÃ©ritÃ© antÃ©rieurement
-- au webhook.
-- ------------------------------------------------------------
create table if not exists public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid references public.developers(id) on delete cascade not null,
  package_id text not null,
  package_name text not null,
  tokens integer not null check (tokens > 0),
  amount_fcfa integer not null check (amount_fcfa > 0),
  currency text not null default 'XOF' check (currency = 'XOF'),
  provider text not null default 'wave',
  provider_session_id text,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  credited_at timestamptz,
  unique (provider, provider_session_id)
);

create index if not exists payment_intents_developer_idx on public.payment_intents (developer_id);
create index if not exists payment_intents_status_idx on public.payment_intents (status);

alter table public.payment_intents enable row level security;

-- Un dÃ©veloppeur voit UNIQUEMENT ses propres intentions de paiement.
create policy "payment_intents_select_own"
  on public.payment_intents for select
  to authenticated
  using (developer_id = auth.uid());

-- La route serveur de checkout crÃ©e l'intention pour l'utilisateur connectÃ©.
create policy "payment_intents_insert_own"
  on public.payment_intents for insert
  to authenticated
  with check (developer_id = auth.uid());

-- Aucun update/delete public : seuls le RPC (service_role) et le
-- serveur (service_role) modifient ces lignes.

-- ------------------------------------------------------------
-- credit_from_payment : crÃ©dite les Tokens APRÃˆS vÃ©rification
-- par le webhook (signature Wave valide + montant conforme).
-- ExÃ©cutable uniquement par le service_role.
--   * Idempotent et atomique : ne crÃ©dite qu'un intent 'pending'.
-- ------------------------------------------------------------
create or replace function public.credit_from_payment(p_intent_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent public.payment_intents%rowtype;
  v_updated integer;
  v_new_balance integer;
begin
  -- Seul le service_role peut crÃ©diter : les GRANT (fin de fichier) le
  -- garantissent cÃ´tÃ© PostgREST. Ce garde-fou renforce : toute exÃ©cution
  -- sans claim service_role est rejetÃ©e, mÃªme en contexte utilisateur.
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception 'AccÃ¨s interdit.' using errcode = 'TLAAC';
  end if;

  select * into v_intent from public.payment_intents where id = p_intent_id;
  if not found then
    raise exception 'Intention de paiement introuvable.' using errcode = 'TLNOR';
  end if;

  if v_intent.status = 'paid' then
    -- RÃ©-envoi du webhook (retry Wave) : rien Ã  recrÃ©diter.
    return jsonb_build_object(
      'credited', false,
      'intent_id', v_intent.id,
      'reason', 'already_credited'
    );
  end if;

  if v_intent.status <> 'pending' then
    raise exception 'Cette intention de paiement n''est pas payable.'
      using errcode = 'TLDUP';
  end if;

  -- Verrou atomique : un seul crÃ©dit possible.
  update public.payment_intents
     set status = 'paid', credited_at = now()
   where id = p_intent_id and status = 'pending';

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return jsonb_build_object(
      'credited', false,
      'intent_id', v_intent.id,
      'reason', 'already_credited'
    );
  end if;

  insert into public.token_transactions (developer_id, amount, amount_fcfa, type)
  values (v_intent.developer_id, v_intent.tokens, v_intent.amount_fcfa, 'purchase');

  select coalesce(sum(t.amount), 0)::integer
    into v_new_balance
    from public.token_transactions t
   where t.developer_id = v_intent.developer_id;

  return jsonb_build_object(
    'credited', true,
    'intent_id', v_intent.id,
    'tokens', v_intent.tokens,
    'balance', v_new_balance
  );
end;
$$;

-- RÃ©voquer l'exÃ©cution pour le public et les rÃ´les utilisateurs.
revoke execute on function public.credit_from_payment(uuid) from public;
revoke execute on function public.credit_from_payment(uuid) from anon;
revoke execute on function public.credit_from_payment(uuid) from authenticated;

-- Seul le service_role (clÃ© serveur) peut crÃ©diter depuis un webhook.
grant execute on function public.credit_from_payment(uuid) to service_role;

-- ============================================================
-- 0006_notifications.sql
-- ============================================================
-- ============================================================
-- TERANGA LABS â€” Migration 0006 : notifications & modÃ©ration
-- 1) Ciblage dÃ©veloppeurs selon la ville + compÃ©tences
--    (developers.city, developers.notifications_enabled)
-- 2) Badge Â« Budget vÃ©rifiÃ© Â» validÃ© par l'admin
--    (requests.budget_verified)
-- 3) File de notifications en base (notification_jobs) :
--    un trigger enfile la confirmation client + le ciblage
--    dÃ©veloppeurs Ã  la publication d'un brief, puis un
--    dispatcher serveur les envoie en tÃ¢che de fond.
--
-- Principe d'honnÃªtetÃ© : l'envoi rÃ©el dÃ©pend des canaux
-- configurÃ©s (webhook Make/n8n, WhatsApp Green-API/Twilio, ou
-- email). Sans canal configurÃ©, aucun message n'est simulÃ© :
-- le job est marquÃ© failed avec un message explicite.
-- ============================================================

-- ------------------------------------------------------------
-- 1) developers : ville + consentement aux notifications
-- ------------------------------------------------------------
alter table public.developers
  add column if not exists city text,
  add column if not exists notifications_enabled boolean not null default true;

-- ------------------------------------------------------------
-- 2) requests.budget_verified : badge affichÃ© publiquement,
--    mis Ã  true UNIQUEMENT par l'admin (jamais par le client).
-- ------------------------------------------------------------
alter table public.requests
  add column if not exists budget_verified boolean not null default false;

-- Le badge est lisible publiquement : on Ã©tend le grant SELECT.
grant select (id, client_name, client_city, project_type, budget, description, status, hidden, created_at, budget_verified)
  on public.requests to anon, authenticated;

-- ------------------------------------------------------------
-- 3) notification_jobs : file de messages Ã  envoyer
--    En lecture/Ã©criture UNIQUEMENT cÃ´tÃ© serveur (service_role) :
--    aucun droit accordÃ© Ã  anon/authenticated.
-- ------------------------------------------------------------
create table if not exists public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('client_confirmation', 'developer_matches')),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists notification_jobs_status_idx on public.notification_jobs (status, created_at);

alter table public.notification_jobs enable row level security;
-- Aucune policy : la table reste inaccessible au public.
-- Seul le service_role (clÃ© serveur) la lit/la met Ã  jour.

-- ------------------------------------------------------------
-- Trigger : enfile les notifications Ã  la crÃ©ation d'un brief
-- ouvert et visible. Jamais bloquant : en cas d'erreur, le
-- brief est publiÃ© quand mÃªme.
-- ------------------------------------------------------------
create or replace function public.enqueue_notification_jobs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_payload jsonb;
  v_dev_payload jsonb;
begin
  if new.status = 'ouvert' and new.hidden = false then
    v_client_payload := jsonb_build_object(
      'request_id', new.id,
      'client_name', new.client_name,
      'client_whatsapp', new.client_whatsapp,
      'client_city', new.client_city,
      'project_type', new.project_type,
      'budget', new.budget,
      'management_key', new.management_key
    );
    v_dev_payload := jsonb_build_object(
      'request_id', new.id,
      'client_name', new.client_name,
      'client_city', new.client_city,
      'project_type', new.project_type,
      'budget', new.budget
    );
    begin
      insert into public.notification_jobs (type, payload) values
        ('client_confirmation', v_client_payload),
        ('developer_matches', v_dev_payload);
    exception when others then
      -- Ne jamais bloquer la publication du brief.
      null;
    end;
  end if;
  return new;
end;
$$;

create trigger requests_notify_trigger
  after insert on public.requests
  for each row execute function public.enqueue_notification_jobs();

-- ------------------------------------------------------------
-- RPC : liste des dÃ©veloppeurs Ã  notifier pour un brief.
-- Cible = comptes actifs ayant acceptÃ© les notifications et
-- un WhatsApp, dont la ville OU les compÃ©tences correspondent.
-- ------------------------------------------------------------
create or replace function public.list_developers_for_brief(
  p_city text,
  p_keywords text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_city text := coalesce(nullif(btrim(p_city), ''), null);
  v_keywords text[] := coalesce(p_keywords, '{}'::text[]);
  v_rows jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'full_name', d.full_name,
        'whatsapp', d.whatsapp,
        'city', d.city,
        'skills', d.skills,
        'email', du.email
      )
      order by d.created_at asc
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.developers d
  left join auth.users du on du.id = d.id
  where d.status = 'active'
    and d.notifications_enabled = true
    and d.whatsapp is not null
    and (
      (v_city is not null and d.city is not null and d.city = v_city)
      or (cardinality(v_keywords) > 0 and d.skills && v_keywords)
    );

  return v_rows;
end;
$$;

-- ------------------------------------------------------------
-- RPC admin : valider / dÃ©valider le budget d'un brief.
-- ------------------------------------------------------------
create or replace function public.admin_set_budget_verified(
  p_request_id uuid,
  p_verified boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'AccÃ¨s rÃ©servÃ© Ã  l''administration.' using errcode = 'TLAAC';
  end if;

  if p_verified is null then
    raise exception 'Valeur invalide.' using errcode = 'TLBAD';
  end if;

  update public.requests set budget_verified = p_verified where id = p_request_id;

  if not found then
    raise exception 'Brief introuvable.' using errcode = 'TLNOR';
  end if;

  return jsonb_build_object('request_id', p_request_id, 'budget_verified', p_verified);
end;
$$;

-- ------------------------------------------------------------
-- admin_list_requests : expose budget_verified Ã  l'admin.
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
    raise exception 'AccÃ¨s rÃ©servÃ© Ã  l''administration.' using errcode = 'TLAAC';
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
          'budget_verified', r.budget_verified,
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
-- admin_list_developers : expose ville + consentement.
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
    raise exception 'AccÃ¨s rÃ©servÃ© Ã  l''administration.' using errcode = 'TLAAC';
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
          'city', d.city,
          'notifications_enabled', d.notifications_enabled,
          'status', d.status,
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
-- PrivilÃ¨ges
-- ------------------------------------------------------------
grant execute on function public.list_developers_for_brief(text, text[]) to service_role, authenticated;
grant execute on function public.admin_set_budget_verified(uuid, boolean) to authenticated;
grant execute on function public.admin_list_requests() to authenticated;
grant execute on function public.admin_list_developers() to authenticated;

-- ============================================================
-- 0007_publish_tokens.sql
-- ============================================================
-- ============================================================
-- 0007 : La publication d'un brief coÃ»te dÃ©sormais 1 Token.
--   - La RPC create_brief (anonyme) est rÃ©voquÃ©e.
--   - publish_brief : auteur connectÃ© + solde >= 1 + dÃ©bit -1.
-- ExÃ©cuter aprÃ¨s 0006 (ordre numÃ©rique = ordre d'exÃ©cution).
-- ============================================================

-- Autoriser le type 'publish' dans les transactions de tokens.
alter table public.token_transactions
  drop constraint if exists token_transactions_type_check;

alter table public.token_transactions
  add constraint token_transactions_type_check
  check (type in ('purchase', 'unlock', 'bonus', 'publish'));

-- ------------------------------------------------------------
-- publish_brief : publication payante (1 Token), idempotente par
-- appel, atomicitÃ© dans la mÃªme transaction que le dÃ©bit.
-- ------------------------------------------------------------
create or replace function public.publish_brief(
  p_client_name text,
  p_client_whatsapp text,
  p_client_city text,
  p_project_type text,
  p_budget integer,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance integer;
  v_req public.requests%rowtype;
begin
  if v_user_id is null then
    raise exception 'Connectez-vous pour publier un brief.' using errcode = 'TLAUTH';
  end if;

  if p_client_name is null or length(btrim(p_client_name)) < 2 then
    raise exception 'Nom du client manquant.' using errcode = 'TLBAD';
  end if;
  if p_client_whatsapp is null or p_client_whatsapp = '' then
    raise exception 'NumÃ©ro WhatsApp manquant.' using errcode = 'TLBAD';
  end if;
  if p_budget is null or p_budget < 10000 then
    raise exception 'Budget invalide (minimum 10000 F).' using errcode = 'TLBAD';
  end if;
  if p_project_type not in ('vitrine', 'e-commerce', 'landing page', 'app web') then
    raise exception 'Type de projet invalide.' using errcode = 'TLBAD';
  end if;

  select coalesce(sum(t.amount), 0)::integer into v_balance
    from public.token_transactions t
    where t.developer_id = v_user_id;

  if v_balance < 1 then
    raise exception 'Tokens insuffisants. Rechargez vos Tokens pour publier un brief (1 Token).' using errcode = 'TLLOW';
  end if;

  -- Verrou anti-concours : deux publications simultanÃ©es ne peuvent pas
  -- toutes les deux dÃ©penser le dernier token.
  perform 1 from public.developers where id = v_user_id for update;

  insert into public.requests (
    client_name, client_whatsapp, client_city, project_type, budget, description
  ) values (
    p_client_name,
    p_client_whatsapp,
    p_client_city,
    p_project_type,
    p_budget,
    p_description
  )
  returning * into v_req;

  insert into public.token_transactions (developer_id, amount, type, request_id)
  values (v_user_id, -1, 'publish', v_req.id);

  return jsonb_build_object(
    'id', v_req.id,
    'management_key', v_req.management_key
  );
end;
$$;

-- Revoke de l'ancienne publication anonyme (contournement impossible).
revoke execute on function public.create_brief(text, text, text, text, integer, text) from anon, authenticated;

-- La nouvelle publication exige une session.
grant execute on function public.publish_brief(text, text, text, text, integer, text) to authenticated;

-- ============================================================
-- 0008_fix_handle_new_user.sql
-- ============================================================
-- ============================================================
-- TERANGA LABS â€” Migration 0008 : correctif handle_new_user
-- jsonb_array_to_text_array() n'existe pas en Postgres standard :
-- toute inscription avec un tableau de compÃ©tences Ã©chouait.
-- RemplacÃ© par jsonb_array_elements_text() + array_agg().
-- create or replace â†’ idempotent.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.developers (id, full_name, whatsapp, skills)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'whatsapp', ''),
    case
      when jsonb_typeof(new.raw_user_meta_data -> 'skills') = 'array'
        then (
          select coalesce(array_agg(v), '{}'::text[])
          from jsonb_array_elements_text(new.raw_user_meta_data -> 'skills') as v
        )
      when new.raw_user_meta_data ? 'skills'
        then array[nullif(new.raw_user_meta_data ->> 'skills', '')]
      else null
    end
  );

  insert into public.user_roles (user_id, role)
  values (new.id, 'developer');

  return new;
end;
$$;

-- ============================================================
-- 0009_developer_profile_crm.sql
-- ============================================================
-- ============================================================
-- TERANGA LABS â€” Migration 0009 : Compte DÃ©veloppeur Pro
-- Carte de visite digitale (/dev/[username]), mini-CRM, garantie Token.
-- NB : la numÃ©rotation 0005 demandÃ©e Ã©tait dÃ©jÃ  utilisÃ©e par
-- 0005_payments.sql, d'oÃ¹ 0009 (fin de la chaÃ®ne 0001 â†’ 0008).
-- ============================================================

-- ------------------------------------------------------------
-- 1. developers : fiche publique extensible
-- ------------------------------------------------------------
alter table public.developers
  add column username text,
  add column bio text,
  add column avatar_url text,
  add column portfolio_links jsonb not null default '[]'::jsonb,
  add column is_verified boolean not null default false,
  add column experience_years integer not null default 1;

-- username : unique, nullable (rÃ©trocompatibilitÃ©), format SEO sÃ»r.
create unique index developers_username_uidx on public.developers (username)
  where username is not null;

alter table public.developers
  add constraint developers_username_format
  check (
    username is null
    or username ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  );

alter table public.developers
  add constraint developers_experience_range
  check (experience_years between 0 and 100);

-- ProtÃ¨ge les colonnes gÃ©rÃ©es par la modÃ©ration : un dÃ©veloppeur ne peut
-- JAMAIS s'auto-valider (status) ni s'octroyer le badge (is_verified).
create function public.developers_protect_managed_cols()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_role text := coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role', '');
begin
  if v_role <> 'service_role' and not public.is_admin() then
    new.status := old.status;
    new.is_verified := old.is_verified;
  end if;
  return new;
end;
$$;

create trigger developers_protect_managed_cols_trigger
  before update on public.developers
  for each row
  execute function public.developers_protect_managed_cols();

-- ------------------------------------------------------------
-- 2. unlocks : mini-CRM personnel du dÃ©veloppeur
-- ------------------------------------------------------------
alter table public.unlocks
  add column crm_status text not null default 'a_contacter',
  add column notes text;

alter table public.unlocks
  add constraint unlocks_crm_status_check
  check (crm_status in ('a_contacter', 'en_discussion', 'gagne', 'perdu'));

-- ------------------------------------------------------------
-- 3. token_refund_requests : garantie Token (remboursement 1 clic)
-- ------------------------------------------------------------
create table public.token_refund_requests (
  id uuid primary key default gen_random_uuid(),
  unlock_id uuid not null references public.unlocks(id) on delete cascade,
  developer_id uuid not null references public.developers(id) on delete cascade,
  reason text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint token_refund_requests_status_check
    check (status in ('pending', 'approved', 'rejected'))
);

-- Une seule demande en attente par dÃ©blocage.
create unique index token_refund_requests_pending_uidx
  on public.token_refund_requests (unlock_id)
  where status = 'pending';

-- ------------------------------------------------------------
-- 4. RPC sÃ©curisÃ©es (SECURITY DEFINER)
-- ------------------------------------------------------------

-- update_unlock_crm : le dÃ©veloppeur pilote ses contacts dÃ©bloquÃ©s.
create or replace function public.update_unlock_crm(
  p_unlock_id uuid,
  p_status text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_unlock public.unlocks%rowtype;
  v_notes text;
begin
  if v_user_id is null then
    raise exception 'Connectez-vous pour modifier vos contacts.' using errcode = 'TLNAU';
  end if;

  if p_status is null or p_status not in ('a_contacter', 'en_discussion', 'gagne', 'perdu') then
    raise exception 'Statut CRM invalide.' using errcode = 'TLBAD';
  end if;

  v_notes := nullif(btrim(coalesce(p_notes, '')), '');

  select * into v_unlock from public.unlocks where id = p_unlock_id;
  if v_unlock.id is null or v_unlock.developer_id <> v_user_id then
    raise exception 'DÃ©blocage introuvable.' using errcode = 'TLNOU';
  end if;

  update public.unlocks
     set crm_status = p_status,
         notes = v_notes
   where id = p_unlock_id;

  return jsonb_build_object(
    'unlock_id', p_unlock_id,
    'crm_status', p_status,
    'notes', v_notes
  );
end;
$$;

-- request_token_refund : garantie Token, 1 clic, sans doublon en attente.
create or replace function public.request_token_refund(
  p_unlock_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_unlock public.unlocks%rowtype;
  v_reason text;
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'Connectez-vous pour contester un dÃ©blocage.' using errcode = 'TLNAU';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null then
    raise exception 'PrÃ©cisez le motif de la demande (ex : faux numÃ©ro WhatsApp).' using errcode = 'TLBAD';
  end if;
  if length(v_reason) > 1000 then
    raise exception 'Motif trop long (1000 caractÃ¨res maximum).' using errcode = 'TLBAD';
  end if;

  select * into v_unlock from public.unlocks where id = p_unlock_id;
  if v_unlock.id is null or v_unlock.developer_id <> v_user_id then
    raise exception 'DÃ©blocage introuvable.' using errcode = 'TLNOU';
  end if;

  if exists (
    select 1 from public.token_refund_requests
    where unlock_id = p_unlock_id and status = 'pending'
  ) then
    raise exception 'Une demande de remboursement est dÃ©jÃ  en cours pour ce contact.' using errcode = 'TLDUP';
  end if;

  insert into public.token_refund_requests (unlock_id, developer_id, reason)
  values (p_unlock_id, v_user_id, v_reason)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'unlock_id', p_unlock_id, 'status', 'pending');
end;
$$;

-- get_public_developer_profile : carte de visite publique. Accepte un
-- username OU un uuid (couvre /dev/moussa et /dev/[id]).
create or replace function public.get_public_developer_profile(
  p_identifier text
)
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

  return jsonb_build_object(
    'id', v_dev.id,
    'username', v_dev.username,
    'full_name', v_dev.full_name,
    'bio', v_dev.bio,
    'avatar_url', v_dev.avatar_url,
    'city', v_dev.city,
    'whatsapp', v_dev.whatsapp,
    'skills', coalesce(v_dev.skills::jsonb, '[]'::jsonb),
    'experience_years', v_dev.experience_years,
    'is_verified', v_dev.is_verified,
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
$$;

-- ------------------------------------------------------------
-- get_my_unlocks Ã©tendu : expose le CRM + le statut de garantie.
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
        'unlocked_at', u.created_at,
        'crm_status', u.crm_status,
        'notes', u.notes,
        'refund_status', tr.status
      )
      order by u.created_at desc
    ),
    '[]'::jsonb
  )
  from public.unlocks u
  join public.requests r on r.id = u.request_id
  left join public.token_refund_requests tr
    on tr.unlock_id = u.id
   and tr.status = 'pending'
  where u.developer_id = auth.uid();
$$;

-- ------------------------------------------------------------
-- PrivilÃ¨ges : uniquement via les RPC (jamais de table directe).
-- ------------------------------------------------------------
grant execute on function public.update_unlock_crm(uuid, text, text) to authenticated;
grant execute on function public.request_token_refund(uuid, text) to authenticated;
grant execute on function public.get_public_developer_profile(text) to anon, authenticated;
grant execute on function public.get_my_unlocks() to authenticated;

-- ============================================================
-- 0010_fix_public_profile.sql
-- ============================================================
-- ============================================================
-- TERANGA LABS â€” Migration 0010 : correctif get_public_developer_profile
-- skills est de type text[] et ne se caste pas en jsonb
-- (to_jsonb(text[]) produit bien un tableau JSON de chaÃ®nes).
-- ============================================================

create or replace function public.get_public_developer_profile(
  p_identifier text
)
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
$$;

grant execute on function public.get_public_developer_profile(text) to anon, authenticated;

-- ============================================================
-- 0011_revoke_rpc_public.sql
-- ============================================================
-- ============================================================
-- TERANGA LABS â€” Migration 0011 : restreindre l'exÃ©cution des
-- RPC d'Ã©criture du CRM / de la garantie Token Ã  authenticated.
-- Par dÃ©faut Postgres octroie EXECUTE Ã  PUBLIC sur les fonctions ;
-- ces RPC ne doivent Ãªtre appelables que par un utilisateur connectÃ©.
-- ============================================================

revoke execute on function public.update_unlock_crm(uuid, text, text) from public;
revoke execute on function public.request_token_refund(uuid, text) from public;

grant execute on function public.update_unlock_crm(uuid, text, text) to authenticated;
grant execute on function public.request_token_refund(uuid, text) to authenticated;

-- ============================================================
-- 0012_revoke_rpc_anon.sql
-- ============================================================
-- ============================================================
-- TERANGA LABS â€” Migration 0012 : retirer l'exÃ©cution aux rÃ´les
-- non connectÃ©s (anon). Le PUBLIC a Ã©tÃ© rÃ©voquÃ© en 0011 mais
-- le rÃ´le anon est explicitement octroyÃ© par les privilÃ¨ges par
-- dÃ©faut de la plateforme Ã  la crÃ©ation des fonctions.
-- ============================================================

revoke execute on function public.update_unlock_crm(uuid, text, text) from anon;
revoke execute on function public.request_token_refund(uuid, text) from anon;

grant execute on function public.update_unlock_crm(uuid, text, text) to authenticated;
grant execute on function public.request_token_refund(uuid, text) to authenticated;

-- ============================================================
-- 0013_master_architecture.sql
-- ============================================================
-- ============================================================
-- TERANGA LABS â€” Migration 0013 : Architecture Master 3 univers
-- (Messagerie interne temps rÃ©el, flux Client, devis formels).
-- NB : la numÃ©rotation 0005 Ã©tait dÃ©jÃ  utilisÃ©e ; on est en fin de
-- chaÃ®ne (0001 â†’ 0012 dÃ©jÃ  poussÃ©s).
-- ============================================================

-- ------------------------------------------------------------
-- A.1 â€” user_roles : rÃ´le 'client' ajoutÃ© au CHECK (pas un enum).
-- ------------------------------------------------------------
alter table public.user_roles
  drop constraint if exists user_roles_role_check;

alter table public.user_roles
  add constraint user_roles_role_check
  check (role in ('client', 'developer', 'moderator', 'admin'));

-- ------------------------------------------------------------
-- A.2 â€” client_profiles : fiche privÃ©e du client (tÃ©lÃ©phone jamais
-- exposÃ©). La ligne developers reste crÃ©Ã©e pour le compteur de
-- tokens (publier = 1 Token) mais reste invisible (status 'suspended').
-- ------------------------------------------------------------
create table public.client_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_name text,
  contact_name text,
  phone text,
  city text,
  created_at timestamptz not null default now()
);

alter table public.client_profiles enable row level security;

create policy "client_profiles_select_own"
  on public.client_profiles for select
  to authenticated
  using (id = auth.uid());

create policy "client_profiles_update_own"
  on public.client_profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

grant select, update on public.client_profiles to authenticated;

-- ------------------------------------------------------------
-- A.3 â€” developers : indicateurs de la vitrine publique.
-- ------------------------------------------------------------
alter table public.developers
  add column if not exists rating_avg numeric(3, 2) not null default 5.0,
  add column if not exists completed_projects_count integer not null default 0;

-- ------------------------------------------------------------
-- A.4 â€” handle_new_user v3 : branchement sur le rÃ´le choisi au
-- signup (metadata 'role' ; dÃ©faut 'developer' pour rÃ©trocompat).
--   - developer : ligne developers 'pending' + user_roles 'developer'
--   - client    : ligne developers 'suspended' (invisible, compteur
--                 de tokens pour payer la publication) + client_profiles
--                 + user_roles 'client'
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(new.raw_user_meta_data ->> 'role', 'developer');
begin
  if v_role = 'client' then
    insert into public.developers (id, full_name, whatsapp, status)
    values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'whatsapp', ''), 'suspended');

    insert into public.client_profiles (id, company_name, contact_name, phone, city)
    values (
      new.id,
      nullif(new.raw_user_meta_data ->> 'company_name', ''),
      coalesce(
        nullif(new.raw_user_meta_data ->> 'contact_name', ''),
        nullif(new.raw_user_meta_data ->> 'full_name', '')
      ),
      nullif(new.raw_user_meta_data ->> 'whatsapp', ''),
      nullif(new.raw_user_meta_data ->> 'city', '')
    );

    insert into public.user_roles (user_id, role)
    values (new.id, 'client');
  else
    insert into public.developers (id, full_name, whatsapp, skills)
    values (
      new.id,
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'whatsapp', ''),
      case
        when jsonb_typeof(new.raw_user_meta_data -> 'skills') = 'array'
          then (
            select coalesce(array_agg(v), '{}'::text[])
            from jsonb_array_elements_text(new.raw_user_meta_data -> 'skills') as v
          )
        when new.raw_user_meta_data ? 'skills'
          then array[nullif(new.raw_user_meta_data ->> 'skills', '')]
        else null
      end
    );

    insert into public.user_roles (user_id, role)
    values (new.id, 'developer');
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- B â€” requests : colonnes du flux Client + concurrence.
-- ------------------------------------------------------------
alter table public.requests
  add column if not exists client_id uuid references auth.users(id) on delete set null,
  add column if not exists max_unlocks integer not null default 4,
  add column if not exists current_unlocks_count integer not null default 0,
  add column if not exists selected_developer_id uuid references auth.users(id) on delete set null,
  add column if not exists features jsonb not null default '[]'::jsonb,
  add column if not exists deadline text;

alter table public.requests
  drop constraint if exists requests_max_unlocks_check;

alter table public.requests
  add constraint requests_max_unlocks_check check (max_unlocks >= 1);

-- Nouveau type Â« refonte Â» pour l'assistant client.
alter table public.requests
  drop constraint if exists requests_project_type_check;

alter table public.requests
  add constraint requests_project_type_check
  check (project_type in ('vitrine', 'e-commerce', 'landing page', 'app web', 'refonte'));

create index if not exists requests_client_idx on public.requests (client_id);

-- Colonnes publiques (la jauge de concurrence est publique).
grant select (id, client_name, client_city, project_type, budget, description, status, hidden, created_at, max_unlocks, current_unlocks_count, features, deadline)
  on public.requests to anon, authenticated;

-- ------------------------------------------------------------
-- C â€” Messagerie interne temps rÃ©el.
-- ------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.requests(id) on delete cascade not null,
  developer_id uuid references auth.users(id) on delete cascade,
  client_id uuid references auth.users(id) on delete cascade,
  status text not null default 'active' check (
    status in ('active', 'awarded', 'archived')
  ),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (request_id, developer_id)
);

create index conversations_developer_idx on public.conversations (developer_id);
create index conversations_client_idx on public.conversations (client_id);
create index conversations_request_idx on public.conversations (request_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references auth.users(id) on delete cascade,
  content text not null,
  message_type text not null default 'text' check (
    message_type in ('text', 'offer', 'system')
  ),
  metadata jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- RÃ©plication complÃ¨te + Realtime pour le chat en direct.
alter table public.conversations replica identity full;
alter table public.messages replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- RLS : seuls les participants d'une conversation y ont accÃ¨s.
alter table public.conversations enable row level security;

create policy "conversations_select_participant"
  on public.conversations for select
  to authenticated
  using (developer_id = auth.uid() or client_id = auth.uid());

create policy "conversations_update_participant"
  on public.conversations for update
  to authenticated
  using (developer_id = auth.uid() or client_id = auth.uid())
  with check (developer_id = auth.uid() or client_id = auth.uid());

alter table public.messages enable row level security;

create policy "messages_select_participant"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.developer_id = auth.uid() or c.client_id = auth.uid())
    )
  );

create policy "messages_insert_sender_participant"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.developer_id = auth.uid() or c.client_id = auth.uid())
        and c.status = 'active'
    )
  );

create policy "messages_update_read_participant"
  on public.messages for update
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.developer_id = auth.uid() or c.client_id = auth.uid())
    )
  );

grant select, insert, update on public.messages to authenticated;
grant select, update on public.conversations to authenticated;

-- ------------------------------------------------------------
-- D â€” Devis formels + Ã©valuations (reviews Ã©tendues).
-- ------------------------------------------------------------
create table public.formal_offers (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  developer_id uuid references auth.users(id) on delete cascade,
  total_price_fcfa integer not null check (total_price_fcfa >= 1),
  deposit_fcfa integer check (deposit_fcfa >= 0),
  delivery_days integer not null check (delivery_days >= 1),
  description text,
  status text not null default 'pending' check (
    status in ('pending', 'accepted', 'rejected')
  ),
  created_at timestamptz not null default now()
);

create index formal_offers_conversation_idx on public.formal_offers (conversation_id);

alter table public.formal_offers enable row level security;

create policy "formal_offers_select_participant"
  on public.formal_offers for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = formal_offers.conversation_id
        and (c.developer_id = auth.uid() or c.client_id = auth.uid())
    )
  );

create policy "formal_offers_insert_developer"
  on public.formal_offers for insert
  to authenticated
  with check (
    developer_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = formal_offers.conversation_id
        and c.developer_id = auth.uid()
        and c.status <> 'awarded'
    )
  );

create policy "formal_offers_update_client"
  on public.formal_offers for update
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = formal_offers.conversation_id
        and c.client_id = auth.uid()
    )
  );

grant select, insert, update on public.formal_offers to authenticated;

-- reviews : client_id + notation 3 critÃ¨res (extension, pas remplacement).
alter table public.reviews
  add column if not exists client_id uuid references auth.users(id) on delete set null,
  add column if not exists rating_quality integer check (rating_quality between 1 and 5),
  add column if not exists rating_deadline integer check (rating_deadline between 1 and 5),
  add column if not exists rating_communication integer check (rating_communication between 1 and 5);

-- ------------------------------------------------------------
-- E â€” RPC : publish_brief enrichi (client_id + features + deadline)
-- ------------------------------------------------------------
drop function if exists public.publish_brief(text, text, text, text, integer, text);

create or replace function public.publish_brief(
  p_client_name text,
  p_client_whatsapp text,
  p_client_city text,
  p_project_type text,
  p_budget integer,
  p_description text,
  p_features jsonb default '[]'::jsonb,
  p_deadline text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance integer;
  v_req public.requests%rowtype;
begin
  if v_user_id is null then
    raise exception 'Connectez-vous pour publier un brief.' using errcode = 'TLAUTH';
  end if;

  if p_client_name is null or length(btrim(p_client_name)) < 2 then
    raise exception 'Nom du client manquant.' using errcode = 'TLBAD';
  end if;
  if p_client_whatsapp is null or p_client_whatsapp = '' then
    raise exception 'NumÃ©ro WhatsApp manquant.' using errcode = 'TLBAD';
  end if;
  if p_budget is null or p_budget < 10000 then
    raise exception 'Budget invalide (minimum 10000 F).' using errcode = 'TLBAD';
  end if;
  if p_project_type not in ('vitrine', 'e-commerce', 'landing page', 'app web', 'refonte') then
    raise exception 'Type de projet invalide.' using errcode = 'TLBAD';
  end if;

  select coalesce(sum(t.amount), 0)::integer into v_balance
    from public.token_transactions t
    where t.developer_id = v_user_id;

  if v_balance < 1 then
    raise exception 'Tokens insuffisants. Rechargez vos Tokens pour publier un brief (1 Token).' using errcode = 'TLLOW';
  end if;

  perform 1 from public.developers where id = v_user_id for update;

  insert into public.requests (
    client_name, client_whatsapp, client_city, project_type, budget, description,
    client_id, features, deadline
  ) values (
    p_client_name,
    p_client_whatsapp,
    p_client_city,
    p_project_type,
    p_budget,
    p_description,
    v_user_id,
    coalesce(p_features, '[]'::jsonb),
    p_deadline
  )
  returning * into v_req;

  insert into public.token_transactions (developer_id, amount, type, request_id)
  values (v_user_id, -1, 'publish', v_req.id);

  return jsonb_build_object(
    'id', v_req.id,
    'management_key', v_req.management_key
  );
end;
$$;

grant execute on function public.publish_brief(text, text, text, text, integer, text, jsonb, text) to authenticated;

-- ------------------------------------------------------------
-- E â€” RPC : unlock_and_start_chat (dÃ©bloque + ouvre le chat).
-- Idempotent : re-appel sans second dÃ©bit, conversation partagÃ©e.
-- ------------------------------------------------------------
create or replace function public.unlock_and_start_chat(
  p_request_id uuid,
  p_initial_message text,
  p_estimated_price integer,
  p_estimated_days integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_dev public.developers%rowtype;
  v_req public.requests%rowtype;
  v_balance integer;
  v_conv uuid;
  v_first boolean := false;
begin
  if v_user_id is null then
    raise exception 'Connectez-vous pour dÃ©bloquer un contact.' using errcode = 'TLNAU';
  end if;

  select * into v_dev from public.developers where id = v_user_id;
  if v_dev.id is null then
    raise exception 'Profil dÃ©veloppeur requis.' using errcode = 'TLNOD';
  end if;
  if v_dev.status <> 'active' then
    if v_dev.status = 'pending' then
      raise exception 'Votre compte dÃ©veloppeur est en attente de validation.' using errcode = 'TLPEN';
    end if;
    raise exception 'Votre compte dÃ©veloppeur ne permet pas de dÃ©bloquer des contacts.' using errcode = 'TLRJC';
  end if;

  -- SÃ©rialise les dÃ©blocages/ouvertures concurrents pour cette annonce.
  select * into v_req from public.requests where id = p_request_id for update;
  if v_req.id is null then
    raise exception 'Ce brief n''existe pas.' using errcode = 'TLNOR';
  end if;
  if v_req.status <> 'ouvert' then
    raise exception 'Ce brief n''est plus disponible.' using errcode = 'TLCLO';
  end if;

  select c.id into v_conv
    from public.conversations c
   where c.request_id = p_request_id and c.developer_id = v_user_id;

  if v_conv is null then
    if v_req.current_unlocks_count >= v_req.max_unlocks then
      raise exception 'Ce brief a dÃ©jÃ  atteint le nombre maximal de dÃ©veloppeurs en contact.' using errcode = 'TLLIM';
    end if;

    if exists (
      select 1 from public.unlocks
      where developer_id = v_user_id and request_id = p_request_id
    ) then
      -- DÃ©blocage antÃ©rieur (API legacy) sans conversation : on ouvre le
      -- chat sans redÃ©biter.
      null;
    else
      select coalesce(sum(t.amount), 0)::integer into v_balance
        from public.token_transactions t
        where t.developer_id = v_user_id;

      if v_balance < 1 then
        raise exception 'Tokens insuffisants. Rechargez vos Tokens.' using errcode = 'TLLOW';
      end if;

      perform 1 from public.developers where id = v_user_id for update;

      insert into public.token_transactions (developer_id, amount, type, request_id)
      values (v_user_id, -1, 'unlock', p_request_id);

      insert into public.unlocks (developer_id, request_id)
      values (v_user_id, p_request_id);

      update public.requests
         set current_unlocks_count = current_unlocks_count + 1
       where id = p_request_id;

      v_first := true;
    end if;

    insert into public.conversations (request_id, developer_id, client_id)
    values (p_request_id, v_user_id, v_req.client_id)
    on conflict (request_id, developer_id) do nothing
    returning id into v_conv;

    if v_conv is null then
      select c.id into v_conv
        from public.conversations c
       where c.request_id = p_request_id and c.developer_id = v_user_id;
    end if;
  end if;

  if nullif(btrim(coalesce(p_initial_message, '')), '') is not null then
    insert into public.messages (
      conversation_id, sender_id, content, message_type, metadata
    ) values (
      v_conv,
      v_user_id,
      btrim(p_initial_message),
      'text',
      jsonb_build_object(
        'kind', 'initial_proposal',
        'estimated_price_fcfa', nullif(p_estimated_price, 0),
        'estimated_days', nullif(p_estimated_days, 0)
      )
    );

    update public.conversations
       set last_message_at = now()
     where id = v_conv;
  end if;

  return jsonb_build_object(
    'conversation_id', v_conv,
    'first_unlock', v_first,
    'balance', (
      select coalesce(sum(t.amount), 0)::integer
      from public.token_transactions t
      where t.developer_id = v_user_id
    )
  );
end;
$$;

grant execute on function public.unlock_and_start_chat(uuid, text, integer, integer) to authenticated;

-- ------------------------------------------------------------
-- E â€” RPC : accept_formal_offer (sÃ©lection 1 clic).
-- ------------------------------------------------------------
create or replace function public.accept_formal_offer(p_offer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_offer public.formal_offers%rowtype;
  v_conv public.conversations%rowtype;
begin
  if v_user_id is null then
    raise exception 'Connectez-vous pour sÃ©lectionner un dÃ©veloppeur.' using errcode = 'TLNAU';
  end if;

  select * into v_offer from public.formal_offers where id = p_offer_id;
  if v_offer.id is null then
    raise exception 'Devis introuvable.' using errcode = 'TLNOF';
  end if;

  select * into v_conv from public.conversations where id = v_offer.conversation_id;
  if v_conv.id is null or v_conv.client_id <> v_user_id then
    raise exception 'Devis introuvable pour votre compte.' using errcode = 'TLNOF';
  end if;

  if v_offer.status <> 'pending' then
    raise exception 'Ce devis n''est plus en attente.' using errcode = 'TLOFR';
  end if;

  update public.formal_offers
     set status = 'accepted'
   where id = p_offer_id;

  update public.requests
     set selected_developer_id = v_conv.developer_id,
         status = 'attribuÃ©'
   where id = v_conv.request_id;

  update public.conversations
     set status = 'awarded',
         last_message_at = now()
   where id = v_conv.id;

  -- ClÃ´ture : les autres candidats sont archivÃ©s, leurs devis rejetÃ©s.
  update public.conversations
     set status = 'archived'
   where request_id = v_conv.request_id
     and id <> v_conv.id;

  update public.formal_offers
     set status = 'rejected'
   where conversation_id in (
     select id from public.conversations
     where request_id = v_conv.request_id and id <> v_conv.id
   )
   and status = 'pending';

  insert into public.messages (conversation_id, sender_id, content, message_type)
  values (v_conv.id, v_user_id, 'Devis acceptÃ©. Le projet dÃ©marre, bienvenue Ã  bord !', 'system');

  return jsonb_build_object(
    'conversation_id', v_conv.id,
    'request_id', v_conv.request_id,
    'developer_id', v_conv.developer_id,
    'offer_id', p_offer_id
  );
end;
$$;

grant execute on function public.accept_formal_offer(uuid) to authenticated;

-- ------------------------------------------------------------
-- PrivilÃ¨ges : les fonctions de la messagerie sont rÃ©servÃ©es aux
-- sessions authentifiÃ©es (jamais public/anon).
-- ------------------------------------------------------------
revoke execute on function public.unlock_and_start_chat(uuid, text, integer, integer) from public;
revoke execute on function public.accept_formal_offer(uuid) from public;
revoke execute on function public.publish_brief(text, text, text, text, integer, text, jsonb, text) from public;

-- ============================================================
-- 0014_revoke_rpc_anon_master.sql
-- ============================================================
-- ============================================================
-- TERANGA LABS â€” Migration 0014 : retirer l'exÃ©cution aux rÃ´les
-- non connectÃ©s (anon) pour les fonctions de l'architecture
-- maÃ®tre (crÃ©Ã©es en 0013). Le PUBLIC a Ã©tÃ© rÃ©voquÃ© en 0013 mais
-- le rÃ´le anon est explicitement octroyÃ© par les privilÃ¨ges par
-- dÃ©faut de la plateforme Ã  la crÃ©ation des fonctions.
-- ============================================================

revoke execute on function public.publish_brief(text, text, text, text, integer, text, jsonb, text) from anon;
revoke execute on function public.unlock_and_start_chat(uuid, text, integer, integer) from anon;
revoke execute on function public.accept_formal_offer(uuid) from anon;

grant execute on function public.publish_brief(text, text, text, text, integer, text, jsonb, text) to authenticated;
grant execute on function public.unlock_and_start_chat(uuid, text, integer, integer) to authenticated;
grant execute on function public.accept_formal_offer(uuid) to authenticated;

-- ============================================================
-- 0015_get_my_requests.sql
-- ============================================================
-- ------------------------------------------------------------
-- 0015 â€” get_my_requests : le client liste ses propres briefs.
-- La table requests ne gratifie pas client_id (public restreint) ;
-- cette RPC security definer expose UNIQUEMENT les briefs du
-- propriÃ©taire connectÃ©, avec les colonnes publiques + compteurs.
-- ------------------------------------------------------------
create or replace function public.get_my_requests()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_items jsonb;
begin
  if v_user_id is null then
    return null;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'client_name', r.client_name,
      'client_city', r.client_city,
      'project_type', r.project_type,
      'budget', r.budget,
      'description', r.description,
      'status', r.status,
      'features', r.features,
      'deadline', r.deadline,
      'management_key', r.management_key,
      'created_at', r.created_at,
      'max_unlocks', r.max_unlocks,
      'current_unlocks_count', r.current_unlocks_count
    )
    order by r.created_at desc
  ), '[]'::jsonb) into v_items
  from public.requests r
  where r.client_id = v_user_id;

  return v_items;
end;
$$;

revoke execute on function public.get_my_requests() from public;
revoke execute on function public.get_my_requests() from anon;
grant execute on function public.get_my_requests() to authenticated;

