-- ============================================================
-- TERANGA LABS — Migration 0002 : RLS et privilèges
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
-- token_transactions : chaque développeur voit les siennes
-- ------------------------------------------------------------
alter table public.token_transactions enable row level security;

create policy "transactions_select_own"
  on public.token_transactions for select
  to authenticated
  using (developer_id = auth.uid());

-- pas d'insert / update / delete par le client : tout passe
-- par les fonctions RPC sécurisées (unlock_request, credit_tokens).

-- ------------------------------------------------------------
-- unlocks : chaque développeur voit ses déblocages
-- ------------------------------------------------------------
alter table public.unlocks enable row level security;

create policy "unlocks_select_own"
  on public.unlocks for select
  to authenticated
  using (developer_id = auth.uid());

-- ------------------------------------------------------------
-- user_roles : lecture de son propre rôle
-- ------------------------------------------------------------
alter table public.user_roles enable row level security;

create policy "user_roles_select_own"
  on public.user_roles for select
  to authenticated
  using (user_id = auth.uid());