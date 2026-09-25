-- ============================================================
-- TERANGA LABS — Migration 0004 : fonctionnalités
-- 1) Validation des comptes développeurs
-- 2) Espace client « mes briefs » (lien secret de gestion)
-- 3) Commandes de Tokens (paiement à confirmer par l'admin)
-- 4) Réputation & avis développeurs
-- 5) Signalement d'abus (modération admin)
-- ============================================================

-- ------------------------------------------------------------
-- 1) developers.status : le compte doit être validé par l'admin
--    avant de pouvoir débloquer des contacts.
-- ------------------------------------------------------------
alter table public.developers
  add column if not exists status text not null default 'pending'
  check (status in ('pending', 'active', 'rejected', 'suspended'));

create index if not exists developers_status_idx on public.developers (status);

-- ------------------------------------------------------------
-- 2) requests.management_key : le client garde un lien secret
--    pour suivre son brief. Jamais sélectionnable publiquement.
-- ------------------------------------------------------------
alter table public.requests
  add column if not exists management_key uuid not null default gen_random_uuid();

create index if not exists requests_management_key_idx on public.requests (management_key);

-- ------------------------------------------------------------
-- 4) reviews : avis du client sur un développeur, lié à un brief.
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
-- 5) reports : signalements d'abus traités par l'admin.
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
-- 3) token_orders : commande de Tokens créée depuis /tokens,
--    confirmée par l'admin après encaissement réel du paiement.
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
-- create_brief : publication d'un brief (retourne l'id et la clé
-- de gestion). La clé ne passe JAMAIS par un SELECT public.
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
    raise exception 'Numéro WhatsApp manquant.' using errcode = 'TLBAD';
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
-- get_brief_management : le client pilote son brief via sa clé.
--   - Etat du brief
--   - Nombre de déblocages + liste des développeurs (nom, WhatsApp,
--     compétences) pour recontacter
--   - Note moyenne et nombre d'avis déjà laissés
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

  if p_status not in ('ouvert', 'attribué', 'terminé', 'fermé') then
    raise exception 'Statut invalide.' using errcode = 'TLBAD';
  end if;

  if v_req.status = 'fermé' and p_status <> 'fermé' then
    raise exception 'Ce brief est fermé.' using errcode = 'TLCLO';
  end if;
  if v_req.status = 'terminé' and p_status not in ('terminé', 'fermé') then
    raise exception 'Transition de statut impossible.' using errcode = 'TLBAD';
  end if;

  update public.requests set status = p_status where id = v_req.id;
  return jsonb_build_object('request_id', v_req.id, 'status', p_status);
end;
$$;

-- ------------------------------------------------------------
-- unlock_request (réécrite) : exige un compte développeur validé.
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
    raise exception 'Vous devez être connecté.' using errcode = 'TLNAU';
  end if;

  select * into v_dev from public.developers where id = v_user_id;
  if v_dev.id is null then
    raise exception 'Profil développeur requis.' using errcode = 'TLNOD';
  end if;

  if v_dev.status <> 'active' then
    if v_dev.status = 'pending' then
      raise exception 'Votre compte développeur est en attente de validation par l''équipe.' using errcode = 'TLPEN';
    end if;
    raise exception 'Votre compte développeur ne permet pas de débloquer des contacts.' using errcode = 'TLRJC';
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
-- submit_review : le client note le développeur depuis son lien
-- de gestion (authentification = possession de la clé).
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
    raise exception 'Note invalide (1 à 5).' using errcode = 'TLBAD';
  end if;

  select * into v_req from public.requests where management_key = p_management_key;
  if v_req.id is null then
    raise exception 'Lien de gestion invalide.' using errcode = 'TLNOK';
  end if;

  if not exists (
    select 1 from public.unlocks
    where request_id = v_req.id and developer_id = p_developer_id
  ) then
    raise exception 'Ce développeur ne travaille pas sur ce brief.' using errcode = 'TLNOD';
  end if;

  insert into public.reviews (developer_id, request_id, rating, comment)
  values (p_developer_id, v_req.id, p_rating, btrim(p_comment))
  on conflict (request_id, developer_id)
  do update set rating = excluded.rating, comment = excluded.comment, updated_at = now();

  return jsonb_build_object('request_id', v_req.id, 'developer_id', p_developer_id, 'rating', p_rating);
end;
$$;

-- ------------------------------------------------------------
-- get_developer_reviews : avis + moyenne d'un développeur
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
-- submit_report : signale un brief ou un développeur
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
    raise exception 'Précisez le motif du signalement.' using errcode = 'TLBAD';
  end if;

  insert into public.reports (target_type, target_id, reporter_id, reason, description)
  values (p_target_type, p_target_id, v_reporter, p_reason, p_description);

  return jsonb_build_object('ok', true);
end;
$$;

-- ------------------------------------------------------------
-- set_developer_status : admin valide / rejette un développeur
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
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  if p_status not in ('pending', 'active', 'rejected', 'suspended') then
    raise exception 'Statut invalide.' using errcode = 'TLBAD';
  end if;

  if not exists (select 1 from public.developers where id = p_developer) then
    raise exception 'Développeur introuvable.' using errcode = 'TLNOD';
  end if;

  update public.developers set status = p_status where id = p_developer;
  return jsonb_build_object('developer_id', p_developer, 'status', p_status);
end;
$$;

-- ------------------------------------------------------------
-- create_token_order : création d'une commande depuis /tokens.
-- Paiement NON automatique : l'admin confirme après encaissement.
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
    raise exception 'Profil développeur requis.' using errcode = 'TLNOD';
  end if;
  if v_dev.status <> 'active' then
    raise exception 'Votre compte développeur doit être validé avant d''acheter des Tokens.' using errcode = 'TLPEN';
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
-- get_my_orders : commandes du développeur connecté
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
-- admin_list_orders : commandes + infos développeur
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
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
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
-- admin_confirm_order : valide la commande APRÈS encaissement
-- réel, puis crédite les Tokens (transaction 'purchase' traçable).
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
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  select * into v_order from public.token_orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Commande introuvable.' using errcode = 'TLNOR';
  end if;
  if v_order.status <> 'pending' then
    raise exception 'Cette commande a déjà été traitée.' using errcode = 'TLDUP';
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
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  update public.token_orders
     set status = 'cancelled'
   where id = p_order_id and status = 'pending';

  if not found then
    raise exception 'Commande introuvable ou déjà traitée.' using errcode = 'TLNOR';
  end if;

  return jsonb_build_object('order_id', p_order_id, 'status', 'cancelled');
end;
$$;

-- ------------------------------------------------------------
-- admin_list_reports / admin_update_report : modération
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
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
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
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
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
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
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
-- Privilèges : tout passe par les RPC security definer.
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