-- ============================================================
-- TERANGA LABS — Migration 0001 : schéma initial
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
    status in ('ouvert', 'attribué', 'terminé', 'fermé')
  ),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index requests_status_idx on public.requests (status);
create index requests_created_at_idx on public.requests (created_at desc);

-- ------------------------------------------------------------
-- développeurs (developers)
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
-- déblocages de contacts
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
-- rôles utilisateurs (RBAC admin/moderateur/développeur)
-- ------------------------------------------------------------
create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'developer' check (role in ('developer', 'moderator', 'admin')),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- packs par défaut
-- ------------------------------------------------------------
insert into public.token_packages (id, name, tokens, price_fcfa, popular) values
  ('discovery', 'Découverte', 1, 2500, false),
  ('starter', 'Starter', 3, 6500, false),
  ('pro', 'Pro', 10, 20000, true),
  ('agence', 'Agence', 25, 45000, false);

-- ------------------------------------------------------------
-- trigger : créer automatiquement développeur + rôle à l'inscription
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