-- ============================================================
-- 0073 — REFONTE DU MODÈLE ÉCONOMIQUE : ABONNEMENTS & QUOTAS
-- ------------------------------------------------------------
-- Remplace l'ancien système de monnaie virtuelle par :
--   1. Quatre formules d'abonnement développeur (Gratuit, Pro,
--      Pro Max, Agence) mensuelles et annuelles, configurables
--      depuis l'administration.
--   2. Un moteur de quotas de contacts de projets mensuels
--      (80 / 200 / 400 projets distincts par mois), contrôlé
--      côté serveur avec notifications à 80 %, 90 % et 100 %.
--   3. La gratuité intégrale pour les clients (publication de
--      briefs et prise de contact directe avec les développeurs).
--   4. Préservation totale des revenus financiers réels des
--      développeurs (missions, escrow, retraits) et de
--      l'historique existant.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Catalogue des formules d'abonnement (configurable Admin)
-- ------------------------------------------------------------
create table if not exists public.subscription_plans (
  id                         text primary key,
  name_fr                    text not null,
  name_en                    text not null,
  description_fr             text not null default '',
  description_en             text not null default '',
  price_monthly_fcfa         integer not null default 0 check (price_monthly_fcfa >= 0),
  price_annual_fcfa          integer not null default 0 check (price_annual_fcfa >= 0),
  annual_discount_pct        integer not null default 20 check (annual_discount_pct between 0 and 90),
  monthly_contacts_quota     integer not null default 0 check (monthly_contacts_quota >= 0),
  badge_label                text,
  ranking_stars              integer not null default 0 check (ranking_stars between 0 and 5),
  client_coordinates_access  boolean not null default false,
  premium_email_alerts       boolean not null default false,
  enhanced_visibility        boolean not null default false,
  suggested_profile          boolean not null default false,
  team_management            boolean not null default false,
  recommended                boolean not null default false,
  is_active                  boolean not null default true,
  sort_order                 integer not null default 0,
  features_fr                jsonb not null default '[]'::jsonb,
  features_en                jsonb not null default '[]'::jsonb,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

alter table public.subscription_plans enable row level security;

drop policy if exists subscription_plans_select_all on public.subscription_plans;
create policy subscription_plans_select_all
  on public.subscription_plans for select
  using (true);

insert into public.subscription_plans (
  id, name_fr, name_en, description_fr, description_en,
  price_monthly_fcfa, price_annual_fcfa, annual_discount_pct,
  monthly_contacts_quota, badge_label, ranking_stars,
  client_coordinates_access, premium_email_alerts, enhanced_visibility,
  suggested_profile, team_management, recommended, is_active, sort_order,
  features_fr, features_en
) values
  (
    'free',
    'Découverte',
    'Starter Free',
    'Pour créer votre profil public, présenter votre portfolio et découvrir les briefs ouverts.',
    'Build your public profile, showcase your portfolio and browse open projects.',
    0, 0, 0,
    1, null, 0,
    false, false, false,
    false, false, false, true, 1,
    '["Profil public complet et portfolio","Présence dans l’annuaire des développeurs","1 contact de projet d’essai offert","Réception des demandes directes des clients"]'::jsonb,
    '["Complete public profile and portfolio","Listed in the developer directory","1 trial project contact included","Receive direct client inquiries"]'::jsonb
  ),
  (
    'pro',
    'Pro',
    'Pro',
    'Pour les développeurs freelances réguliers qui souhaitent répondre aux projets chaque semaine.',
    'For regular freelance developers responding to projects every week.',
    2500, 24000, 20,
    80, 'Pro', 1,
    false, false, false,
    false, false, false, true, 2,
    '["80 contacts de projets mensuels","Badge Pro sur le profil et dans l’annuaire","1 étoile de classement","Messagerie directe et envoi de devis","Sans engagement, résiliable à tout moment"]'::jsonb,
    '["80 monthly project contacts","Pro badge on profile and directory","1 ranking star","Direct messaging and quote submission","No commitment, cancel anytime"]'::jsonb
  ),
  (
    'pro_max',
    'Pro Max',
    'Pro Max',
    'La formule recommandée pour décrocher un maximum de missions avec une visibilité prioritaire.',
    'Our recommended plan to win more missions with priority visibility.',
    7000, 67200, 20,
    200, 'Pro+', 2,
    true, true, true,
    false, false, true, true, 3,
    '["200 contacts de projets mensuels","Badge Pro+ distinctif","2 étoiles de classement","Coordonnées clients accessibles selon les paramètres de partage","Alertes email premium en temps réel","Visibilité améliorée dans l’annuaire"]'::jsonb,
    '["200 monthly project contacts","Distinctive Pro+ badge","2 ranking stars","Client contact details accessible per sharing settings","Real-time premium email alerts","Enhanced visibility in the directory"]'::jsonb
  ),
  (
    'agency',
    'Agence',
    'Agency',
    'Conçu pour les studios, collectifs et agences digitales à fort volume de projets.',
    'Built for studios, collectives and digital agencies handling high project volume.',
    15000, 144000, 20,
    400, 'Pro++', 3,
    true, true, true,
    true, true, false, true, 4,
    '["400 contacts de projets mensuels","Badge Pro++ Agence","3 étoiles de classement","Coordonnées clients accessibles selon les paramètres de partage","Alertes email premium prioritaires","Profil suggéré auprès des clients","Gestion des collaborateurs et espace agence"]'::jsonb,
    '["400 monthly project contacts","Pro++ Agency badge","3 ranking stars","Client contact details accessible per sharing settings","Priority premium email alerts","Suggested profile to clients","Team & collaborator management"]'::jsonb
  )
on conflict (id) do update set
  name_fr                   = excluded.name_fr,
  name_en                   = excluded.name_en,
  description_fr            = excluded.description_fr,
  description_en            = excluded.description_en,
  price_monthly_fcfa        = excluded.price_monthly_fcfa,
  price_annual_fcfa         = excluded.price_annual_fcfa,
  annual_discount_pct       = excluded.annual_discount_pct,
  monthly_contacts_quota    = excluded.monthly_contacts_quota,
  badge_label               = excluded.badge_label,
  ranking_stars             = excluded.ranking_stars,
  client_coordinates_access = excluded.client_coordinates_access,
  premium_email_alerts      = excluded.premium_email_alerts,
  enhanced_visibility       = excluded.enhanced_visibility,
  suggested_profile         = excluded.suggested_profile,
  team_management           = excluded.team_management,
  recommended               = excluded.recommended,
  sort_order                = excluded.sort_order,
  features_fr               = excluded.features_fr,
  features_en               = excluded.features_en,
  updated_at                = now();

-- ------------------------------------------------------------
-- 2. Évolution non destructive de public.subscriptions
-- ------------------------------------------------------------
alter table public.subscriptions
  drop constraint if exists subscriptions_plan_check;

alter table public.subscriptions
  add column if not exists billing_cycle text not null default 'monthly'
    check (billing_cycle in ('monthly', 'annual')),
  add column if not exists status text not null default 'active'
    check (status in ('active', 'past_due', 'grace_period', 'cancelled', 'expired')),
  add column if not exists current_period_start timestamptz not null default now(),
  add column if not exists current_period_end timestamptz not null default (now() + interval '30 days'),
  add column if not exists quota_reset_at timestamptz not null default (now() + interval '30 days'),
  add column if not exists quota_limit integer not null default 80,
  add column if not exists quota_used integer not null default 0,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists cancelled_at timestamptz,
  add column if not exists grace_until timestamptz,
  add column if not exists auto_renew boolean not null default true,
  add column if not exists last_notified_threshold integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

-- ------------------------------------------------------------
-- 3. Paiements d'abonnements (factures & historique)
-- ------------------------------------------------------------
create table if not exists public.subscription_payments (
  id                uuid primary key default gen_random_uuid(),
  developer_id      uuid not null references public.developers(id) on delete cascade,
  plan_id           text not null references public.subscription_plans(id),
  billing_cycle     text not null default 'monthly'
                      check (billing_cycle in ('monthly', 'annual')),
  amount_fcfa       integer not null check (amount_fcfa >= 0),
  status            text not null default 'pending'
                      check (status in ('pending', 'confirmed', 'failed', 'refunded')),
  provider          text not null default 'chariow',
  provider_sale_id  text,
  invoice_number    text not null unique,
  period_start      timestamptz,
  period_end        timestamptz,
  confirmed_at      timestamptz,
  refunded_at       timestamptz,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

create index if not exists subscription_payments_dev_idx
  on public.subscription_payments (developer_id, created_at desc);

alter table public.subscription_payments enable row level security;

drop policy if exists subscription_payments_select_own on public.subscription_payments;
create policy subscription_payments_select_own
  on public.subscription_payments for select
  using (developer_id = (select auth.uid()) or public.is_admin());

revoke insert, update, delete on public.subscription_payments from anon, authenticated;

-- ------------------------------------------------------------
-- 4. Suivi de consommation des quotas (1 projet distinct = 1 contact)
-- ------------------------------------------------------------
create table if not exists public.subscription_quota_usage (
  id            uuid primary key default gen_random_uuid(),
  developer_id  uuid not null references public.developers(id) on delete cascade,
  request_id    uuid not null references public.requests(id) on delete cascade,
  period_start  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  unique (developer_id, request_id)
);

create index if not exists subscription_quota_usage_dev_idx
  on public.subscription_quota_usage (developer_id, created_at desc);

alter table public.subscription_quota_usage enable row level security;

drop policy if exists subscription_quota_usage_select_own on public.subscription_quota_usage;
create policy subscription_quota_usage_select_own
  on public.subscription_quota_usage for select
  using (developer_id = (select auth.uid()) or public.is_admin());

revoke insert, update, delete on public.subscription_quota_usage from anon, authenticated;

-- ------------------------------------------------------------
-- 4b. Contacts bonus (récompenses de classement, ex-Tokens)
--     Le règlement mensuel du classement crédite désormais des
--     contacts bonus applicables au quota du mois en cours, au lieu
--     de Tokens (monnaie virtuelle retirée de l'interface).
--     Idempotence : unique (developer_id, year, month) — une même
--     période ne crédite jamais deux fois le même développeur.
-- ------------------------------------------------------------
create table if not exists public.contact_bonuses (
  id           uuid primary key default gen_random_uuid(),
  developer_id uuid not null references public.developers(id) on delete cascade,
  year         integer not null check (year between 2000 and 2100),
  month        integer not null check (month between 1 and 12),
  contacts     integer not null check (contacts > 0),
  credited_at  timestamptz not null default now(),
  unique (developer_id, year, month)
);

create index if not exists contact_bonuses_dev_idx
  on public.contact_bonuses (developer_id, credited_at desc);

alter table public.contact_bonuses enable row level security;

drop policy if exists contact_bonuses_select_own on public.contact_bonuses;
create policy contact_bonuses_select_own
  on public.contact_bonuses for select
  using (developer_id = (select auth.uid()) or public.is_admin());

revoke insert, update, delete on public.contact_bonuses from anon, authenticated;

-- ------------------------------------------------------------
-- 5. RPC publiques & développeurs — Catalogue et statut
-- ------------------------------------------------------------
create or replace function public.list_subscription_plans(
  p_include_inactive boolean default false
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',                        sp.id,
        'name_fr',                   sp.name_fr,
        'name_en',                   sp.name_en,
        'description_fr',            sp.description_fr,
        'description_en',            sp.description_en,
        'price_monthly_fcfa',        sp.price_monthly_fcfa,
        'price_annual_fcfa',         sp.price_annual_fcfa,
        'annual_discount_pct',       sp.annual_discount_pct,
        'monthly_contacts_quota',    sp.monthly_contacts_quota,
        'badge_label',               sp.badge_label,
        'ranking_stars',             sp.ranking_stars,
        'client_coordinates_access', sp.client_coordinates_access,
        'premium_email_alerts',      sp.premium_email_alerts,
        'enhanced_visibility',       sp.enhanced_visibility,
        'suggested_profile',         sp.suggested_profile,
        'team_management',           sp.team_management,
        'recommended',               sp.recommended,
        'is_active',                 sp.is_active,
        'sort_order',                sp.sort_order,
        'features_fr',               sp.features_fr,
        'features_en',               sp.features_en
      )
      order by sp.sort_order asc, sp.price_monthly_fcfa asc
    ),
    '[]'::jsonb
  )
  from public.subscription_plans sp
  where p_include_inactive = true or sp.is_active = true;
$$;

grant execute on function public.list_subscription_plans(boolean) to anon, authenticated;

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
  v_plan public.subscription_plans%rowtype;
  v_active boolean := false;
begin
  if v_target is null then
    return jsonb_build_object(
      'active', false,
      'ends_at', null,
      'plan', null,
      'badge_label', null,
      'ranking_stars', 0,
      'enhanced_visibility', false,
      'suggested_profile', false
    );
  end if;

  select * into v_sub
  from public.subscriptions
  where developer_id = v_target;

  if v_sub.developer_id is not null then
    v_active := (v_sub.ends_at > now() or (v_sub.grace_until is not null and v_sub.grace_until > now()))
                and v_sub.plan <> 'free'
                and v_sub.status in ('active', 'grace_period', 'cancelled');
  end if;

  if not v_active then
    return jsonb_build_object(
      'active', false,
      'ends_at', v_sub.ends_at,
      'plan', null,
      'badge_label', null,
      'ranking_stars', 0,
      'enhanced_visibility', false,
      'suggested_profile', false
    );
  end if;

  select * into v_plan
  from public.subscription_plans
  where id = v_sub.plan;

  return jsonb_build_object(
    'active',                    true,
    'ends_at',                   v_sub.ends_at,
    'plan',                      v_sub.plan,
    'billing_cycle',             v_sub.billing_cycle,
    'badge_label',               coalesce(v_plan.badge_label, 'Pro'),
    'ranking_stars',             coalesce(v_plan.ranking_stars, 1),
    'enhanced_visibility',       coalesce(v_plan.enhanced_visibility, false),
    'suggested_profile',         coalesce(v_plan.suggested_profile, false),
    'client_coordinates_access', coalesce(v_plan.client_coordinates_access, false),
    'premium_email_alerts',      coalesce(v_plan.premium_email_alerts, false),
    'team_management',           coalesce(v_plan.team_management, false),
    'quota_limit',               v_sub.quota_limit,
    'quota_used',                v_sub.quota_used,
    'quota_remaining',           greatest(0, v_sub.quota_limit - v_sub.quota_used)
  );
end;
$$;

grant execute on function public.get_pro_status(uuid) to anon, authenticated;

-- Maintient la compatibilité avec les appels existants à get_pro_prices()
create or replace function public.get_pro_prices()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'price_fcfa',    coalesce((select price_monthly_fcfa from public.subscription_plans where id = 'pro'), 2500),
    'duration_days', 30,
    'plans',         public.list_subscription_plans(false)
  );
$$;

grant execute on function public.get_pro_prices() to anon, authenticated;

-- ------------------------------------------------------------
-- 6. RPC — État complet de l'abonnement et du quota du développeur
-- ------------------------------------------------------------
create or replace function public.get_my_subscription()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_sub public.subscriptions%rowtype;
  v_plan public.subscription_plans%rowtype;
  v_free public.subscription_plans%rowtype;
  v_active boolean := false;
  v_limit integer := 1;
  v_used integer := 0;
  v_bonus integer := 0;
  v_GraceDays integer := 3;
begin
  if v_uid is null then
    raise exception 'Authentification requise.' using errcode = 'TLAUT';
  end if;

  select * into v_free from public.subscription_plans where id = 'free';
  select * into v_sub from public.subscriptions where developer_id = v_uid;

  if v_sub.developer_id is not null then
    -- Réinitialisation mensuelle automatique du quota pour un abonnement annuel actif
    if v_sub.ends_at > now() and v_sub.quota_reset_at <= now() then
      select * into v_plan from public.subscription_plans where id = v_sub.plan;
      update public.subscriptions
         set quota_used = 0,
             quota_limit = coalesce(v_plan.monthly_contacts_quota, v_sub.quota_limit),
             quota_reset_at = now() + interval '30 days',
             last_notified_threshold = 0,
             updated_at = now()
       where developer_id = v_uid
       returning * into v_sub;
    end if;

    -- Passage en période de grâce ou expiration si la date de fin est dépassée
    if v_sub.ends_at <= now() and v_sub.status in ('active', 'cancelled') then
      if v_sub.grace_until is null and not v_sub.cancel_at_period_end then
        update public.subscriptions
           set status = 'grace_period',
               grace_until = v_sub.ends_at + make_interval(days => v_GraceDays),
               updated_at = now()
         where developer_id = v_uid
         returning * into v_sub;
      elsif v_sub.grace_until is not null and v_sub.grace_until <= now() then
        update public.subscriptions
           set status = 'expired',
               updated_at = now()
         where developer_id = v_uid
         returning * into v_sub;
      else
        update public.subscriptions
           set status = 'expired',
               updated_at = now()
         where developer_id = v_uid
         returning * into v_sub;
      end if;
    end if;

    v_active := (v_sub.ends_at > now() or (v_sub.grace_until is not null and v_sub.grace_until > now()))
                and v_sub.plan <> 'free'
                and v_sub.status in ('active', 'grace_period', 'cancelled');
  end if;

  if v_active then
    select * into v_plan from public.subscription_plans where id = v_sub.plan;
    v_limit := coalesce(v_sub.quota_limit, v_plan.monthly_contacts_quota, 80);
    v_used := coalesce(v_sub.quota_used, 0);
  else
    v_plan := v_free;
    v_limit := coalesce(v_free.monthly_contacts_quota, 1);
    select count(*)::integer into v_used
      from public.unlocks u
     where u.developer_id = v_uid;
  end if;

  -- Contacts bonus attribués par le classement (section 4b), valables
  -- pendant le mois de leur crédit.
  select coalesce(sum(contacts), 0)::integer into v_bonus
    from public.contact_bonuses
   where developer_id = v_uid
     and credited_at >= date_trunc('month', now());

  v_limit := v_limit + v_bonus;

  return jsonb_build_object(
    'active',                v_active,
    'status',                coalesce(v_sub.status, 'free'),
    'plan_id',               case when v_active then v_sub.plan else 'free' end,
    'plan_name_fr',          coalesce(v_plan.name_fr, 'Découverte'),
    'plan_name_en',          coalesce(v_plan.name_en, 'Starter Free'),
    'badge_label',           case when v_active then v_plan.badge_label else null end,
    'ranking_stars',         case when v_active then coalesce(v_plan.ranking_stars, 0) else 0 end,
    'billing_cycle',         coalesce(v_sub.billing_cycle, 'monthly'),
    'started_at',            v_sub.started_at,
    'ends_at',               v_sub.ends_at,
    'grace_until',           v_sub.grace_until,
    'cancel_at_period_end',  coalesce(v_sub.cancel_at_period_end, false),
    'quota_limit',           v_limit,
    'quota_used',            least(v_used, v_limit),
    'quota_remaining',       greatest(0, v_limit - v_used),
    'bonus_contacts',        v_bonus,
    'quota_pct',             case when v_limit > 0 then least(100, round((v_used::numeric / v_limit::numeric) * 100)::integer) else 100 end,
    'quota_reset_at',        v_sub.quota_reset_at,
    'invoices',              coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',             sp.id,
          'invoice_number', sp.invoice_number,
          'plan_id',        sp.plan_id,
          'billing_cycle',  sp.billing_cycle,
          'amount_fcfa',    sp.amount_fcfa,
          'status',         sp.status,
          'period_start',   sp.period_start,
          'period_end',     sp.period_end,
          'created_at',     sp.created_at,
          'confirmed_at',   sp.confirmed_at
        )
        order by sp.created_at desc
      )
      from public.subscription_payments sp
      where sp.developer_id = v_uid
    ), '[]'::jsonb),
    'usage_history',         coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',           u.id,
          'request_id',   u.request_id,
          'created_at',   u.created_at,
          'client_name',  r.client_name,
          'client_city',  r.client_city,
          'project_type', r.project_type,
          'budget',       r.budget
        )
        order by u.created_at desc
      )
      from (
        select id, request_id, created_at
        from public.subscription_quota_usage
        where developer_id = v_uid
        order by created_at desc
        limit 25
      ) u
      left join public.requests r on r.id = u.request_id
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_my_subscription() to authenticated;

-- ------------------------------------------------------------
-- 7. RPC — Création d'une intention d'abonnement & confirmation serveur
-- ------------------------------------------------------------
create or replace function public.create_subscription_checkout(
  p_plan_id text,
  p_billing_cycle text default 'monthly'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_plan public.subscription_plans%rowtype;
  v_cycle text := case when lower(coalesce(p_billing_cycle, 'monthly')) = 'annual' then 'annual' else 'monthly' end;
  v_amount integer;
  v_invoice text;
  v_payment_id uuid;
begin
  if v_uid is null then
    raise exception 'Connectez-vous pour souscrire un abonnement.' using errcode = 'TLAUT';
  end if;

  if not exists (select 1 from public.developers where id = v_uid) then
    raise exception 'Complétez d’abord votre profil développeur pour vous abonner.' using errcode = 'TLNOD';
  end if;

  select * into v_plan
  from public.subscription_plans
  where id = btrim(coalesce(p_plan_id, '')) and is_active = true;

  if v_plan.id is null or v_plan.id = 'free' then
    raise exception 'Formule d’abonnement invalide ou indisponible.' using errcode = 'TLBAD';
  end if;

  v_amount := case
    when v_cycle = 'annual' then v_plan.price_annual_fcfa
    else v_plan.price_monthly_fcfa
  end;

  v_invoice := 'INV-' || to_char(now(), 'YYYYMM') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.subscription_payments (
    developer_id, plan_id, billing_cycle, amount_fcfa, status, invoice_number
  ) values (
    v_uid, v_plan.id, v_cycle, v_amount, 'pending', v_invoice
  )
  returning id into v_payment_id;

  return jsonb_build_object(
    'payment_id',     v_payment_id,
    'invoice_number', v_invoice,
    'plan_id',        v_plan.id,
    'plan_name_fr',   v_plan.name_fr,
    'plan_name_en',   v_plan.name_en,
    'billing_cycle',  v_cycle,
    'amount_fcfa',    v_amount,
    'quota',          v_plan.monthly_contacts_quota
  );
end;
$$;

grant execute on function public.create_subscription_checkout(text, text) to authenticated;

create or replace function public.confirm_subscription_payment(
  p_payment_id uuid,
  p_provider_sale_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay public.subscription_payments%rowtype;
  v_plan public.subscription_plans%rowtype;
  v_sub public.subscriptions%rowtype;
  v_base timestamptz;
  v_new_end timestamptz;
  v_duration interval;
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role'
     and not public.is_admin() then
    raise exception 'Confirmation réservée au serveur de paiement ou à un administrateur.' using errcode = 'TLAUT';
  end if;

  select * into v_pay
  from public.subscription_payments
  where id = p_payment_id
  for update;

  if v_pay.id is null then
    raise exception 'Paiement d’abonnement introuvable.' using errcode = 'TLNOR';
  end if;

  if v_pay.status = 'confirmed' then
    return jsonb_build_object('ok', true, 'already_confirmed', true, 'payment_id', v_pay.id);
  end if;

  select * into v_plan from public.subscription_plans where id = v_pay.plan_id;
  if v_plan.id is null then
    raise exception 'Formule introuvable.' using errcode = 'TLBAD';
  end if;

  v_duration := case
    when v_pay.billing_cycle = 'annual' then interval '365 days'
    else interval '30 days'
  end;

  select * into v_sub from public.subscriptions where developer_id = v_pay.developer_id;

  -- Si le développeur renouvelle la même formule active, on prolonge sa date de fin.
  if v_sub.developer_id is not null and v_sub.ends_at > now() and v_sub.plan = v_plan.id then
    v_base := v_sub.ends_at;
  else
    v_base := now();
  end if;

  v_new_end := v_base + v_duration;

  insert into public.subscriptions (
    developer_id, plan, billing_cycle, status,
    started_at, ends_at, current_period_start, current_period_end,
    quota_reset_at, quota_limit, quota_used,
    cancel_at_period_end, cancelled_at, grace_until,
    last_notified_threshold, updated_at
  ) values (
    v_pay.developer_id, v_plan.id, v_pay.billing_cycle, 'active',
    now(), v_new_end, now(), v_new_end,
    now() + interval '30 days', v_plan.monthly_contacts_quota, 0,
    false, null, null,
    0, now()
  )
  on conflict (developer_id) do update set
    plan                    = excluded.plan,
    billing_cycle           = excluded.billing_cycle,
    status                  = 'active',
    ends_at                 = excluded.ends_at,
    current_period_start    = now(),
    current_period_end      = excluded.ends_at,
    quota_reset_at          = now() + interval '30 days',
    quota_limit             = excluded.quota_limit,
    quota_used              = 0,
    cancel_at_period_end    = false,
    cancelled_at            = null,
    grace_until             = null,
    last_notified_threshold = 0,
    updated_at              = now();

  update public.subscription_payments
     set status           = 'confirmed',
         provider_sale_id = coalesce(p_provider_sale_id, provider_sale_id),
         period_start     = now(),
         period_end       = v_new_end,
         confirmed_at     = now()
   where id = v_pay.id;

  insert into public.notifications (user_id, type, title, body, link)
  values (
    v_pay.developer_id,
    'subscription_activated',
    'Abonnement ' || v_plan.name_fr || ' activé',
    'Votre formule ' || v_plan.name_fr || ' (' || v_plan.monthly_contacts_quota || ' contacts mensuels) est active jusqu’au ' || to_char(v_new_end, 'DD/MM/YYYY') || '.',
    '/abonnement'
  );

  return jsonb_build_object(
    'ok',          true,
    'payment_id',  v_pay.id,
    'plan_id',     v_plan.id,
    'ends_at',     v_new_end,
    'quota_limit', v_plan.monthly_contacts_quota
  );
end;
$$;

grant execute on function public.confirm_subscription_payment(uuid, text) to authenticated, service_role;

-- Résiliation sans frais (à échéance ou immédiate)
create or replace function public.cancel_my_subscription(
  p_immediate boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_sub public.subscriptions%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentification requise.' using errcode = 'TLAUT';
  end if;

  select * into v_sub from public.subscriptions where developer_id = v_uid for update;
  if v_sub.developer_id is null then
    raise exception 'Aucun abonnement actif à résilier.' using errcode = 'TLNOR';
  end if;

  if coalesce(p_immediate, false) then
    update public.subscriptions
       set status               = 'cancelled',
           cancel_at_period_end = true,
           cancelled_at         = now(),
           ends_at              = now(),
           auto_renew           = false,
           updated_at           = now()
     where developer_id = v_uid
     returning * into v_sub;
  else
    update public.subscriptions
       set cancel_at_period_end = true,
           cancelled_at         = now(),
           auto_renew           = false,
           updated_at           = now()
     where developer_id = v_uid
     returning * into v_sub;
  end if;

  insert into public.notifications (user_id, type, title, body, link)
  values (
    v_uid,
    'subscription_cancelled',
    'Résiliation enregistrée',
    case
      when coalesce(p_immediate, false) then 'Votre abonnement a été résilié immédiatement.'
      else 'Votre abonnement ne sera pas renouvelé et restera actif jusqu’au ' || to_char(v_sub.ends_at, 'DD/MM/YYYY') || '.'
    end,
    '/abonnement'
  );

  return public.get_my_subscription();
end;
$$;

grant execute on function public.cancel_my_subscription(boolean) to authenticated;

-- ------------------------------------------------------------
-- 8. RPC — Envoi d'une proposition sur un projet avec contrôle
--          serveur du quota d'abonnement (zéro monnaie virtuelle)
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
  v_user_id uuid := (select auth.uid());
  v_dev public.developers%rowtype;
  v_req public.requests%rowtype;
  v_sub public.subscriptions%rowtype;
  v_plan public.subscription_plans%rowtype;
  v_conv uuid;
  v_first boolean := false;
  v_demo boolean := false;
  v_sub_active boolean := false;
  v_limit integer := 1;
  v_used integer := 0;
  v_bonus integer := 0;
  v_pct integer := 0;
  v_threshold integer := 0;
begin
  if v_user_id is null then
    raise exception 'Connectez-vous pour envoyer une proposition.' using errcode = 'TLNAU';
  end if;

  select * into v_dev from public.developers where id = v_user_id for update;
  if v_dev.id is null then
    raise exception 'Profil développeur requis.' using errcode = 'TLNOD';
  end if;
  if v_dev.status not in ('active', 'verified') then
    if v_dev.status = 'pending' then
      raise exception 'Votre compte développeur est en attente de validation.' using errcode = 'TLPEN';
    end if;
    raise exception 'Votre compte développeur ne permet pas de contacter des projets.' using errcode = 'TLRJC';
  end if;

  select * into v_req from public.requests where id = p_request_id for update;
  if v_req.id is null then
    raise exception 'Ce projet n’existe pas.' using errcode = 'TLNOR';
  end if;
  if v_req.status <> 'ouvert' then
    raise exception 'Ce projet n’est plus ouvert aux propositions.' using errcode = 'TLCLO';
  end if;

  v_demo := coalesce(v_req.demo, false);

  select c.id into v_conv
    from public.conversations c
   where c.request_id = p_request_id and c.developer_id = v_user_id;

  if v_conv is null then
    if v_req.current_unlocks_count >= v_req.max_unlocks then
      raise exception 'Ce projet a déjà atteint le nombre maximal de propositions.' using errcode = 'TLLIM';
    end if;

    -- Une même proposition sur un même projet n'est JAMAIS comptabilisée deux fois.
    if not exists (
      select 1 from public.unlocks
      where developer_id = v_user_id and request_id = p_request_id
    ) then
      if not v_demo then
        select * into v_sub from public.subscriptions where developer_id = v_user_id for update;

        -- Réinitialisation mensuelle automatique si un nouveau mois d'abonnement commence
        if v_sub.developer_id is not null and v_sub.ends_at > now() and v_sub.quota_reset_at <= now() then
          select * into v_plan from public.subscription_plans where id = v_sub.plan;
          update public.subscriptions
             set quota_used = 0,
                 quota_limit = coalesce(v_plan.monthly_contacts_quota, v_sub.quota_limit),
                 quota_reset_at = now() + interval '30 days',
                 last_notified_threshold = 0,
                 updated_at = now()
           where developer_id = v_user_id
           returning * into v_sub;
        end if;

        if v_sub.developer_id is not null then
          v_sub_active := (v_sub.ends_at > now() or (v_sub.grace_until is not null and v_sub.grace_until > now()))
                          and v_sub.plan <> 'free'
                          and v_sub.status in ('active', 'grace_period', 'cancelled');
        end if;

        if v_sub_active then
          v_limit := greatest(1, coalesce(v_sub.quota_limit, 80));
          v_used := coalesce(v_sub.quota_used, 0);
        else
          select coalesce(monthly_contacts_quota, 1) into v_limit
            from public.subscription_plans where id = 'free';
          select count(*)::integer into v_used
            from public.unlocks where developer_id = v_user_id;
        end if;

        -- Contacts bonus attribués par le classement ce mois-ci
        -- (section 4b) : ils s'ajoutent à la limite mensuelle.
        select coalesce(sum(contacts), 0)::integer into v_bonus
          from public.contact_bonuses
         where developer_id = v_user_id
           and credited_at >= date_trunc('month', now());

        v_limit := v_limit + v_bonus;

        if v_used >= v_limit then
          raise exception 'Vous avez atteint votre limite mensuelle de propositions (% / %). Passez à une formule supérieure (Pro, Pro Max ou Agence) pour contacter davantage de clients.', v_used, v_limit
            using errcode = 'TLQUO';
        end if;

        insert into public.subscription_quota_usage (developer_id, request_id, period_start)
        values (v_user_id, p_request_id, coalesce(v_sub.current_period_start, now()))
        on conflict (developer_id, request_id) do nothing;

        if v_sub_active then
          v_used := v_used + 1;
          v_pct := round((v_used::numeric / v_limit::numeric) * 100)::integer;
          v_threshold := case
            when v_pct >= 100 then 100
            when v_pct >= 90  then 90
            when v_pct >= 80  then 80
            else 0
          end;

          update public.subscriptions
             set quota_used = v_used,
                 last_notified_threshold = greatest(coalesce(last_notified_threshold, 0), v_threshold),
                 updated_at = now()
           where developer_id = v_user_id;

          if v_threshold > coalesce(v_sub.last_notified_threshold, 0) then
            insert into public.notifications (user_id, type, title, body, link)
            values (
              v_user_id,
              'quota_threshold',
              'Quota de propositions à ' || v_threshold || ' %',
              'Vous avez utilisé ' || v_used || ' sur ' || v_limit || ' contacts de projets ce mois-ci. Vous pouvez passer à une formule supérieure à tout moment.',
              '/abonnement'
            );
          end if;
        else
          v_used := v_used + 1;
        end if;
      end if;

      insert into public.unlocks (developer_id, request_id)
      values (v_user_id, p_request_id)
      on conflict do nothing;

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
    'first_unlock',    v_first,
    'demo',            v_demo,
    'quota_used',      v_used,
    'quota_limit',     v_limit,
    'quota_remaining', greatest(0, v_limit - v_used)
  );
end;
$$;

grant execute on function public.unlock_and_start_chat(uuid, text, integer, integer) to authenticated;

-- ------------------------------------------------------------
-- 9. RPC — Contact direct client -> développeur 100 % GRATUIT
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
  v_user_id uuid := (select auth.uid());
  v_role text;
  v_dev public.developers%rowtype;
  v_conv uuid;
  v_first boolean := false;
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
    raise exception 'Ce profil n’est pas disponible au contact.' using errcode = 'TLRJC';
  end if;
  if v_dev.id = v_user_id then
    raise exception 'Action impossible.' using errcode = 'TLBAD';
  end if;

  select c.id into v_conv
    from public.conversations c
   where c.client_id = v_user_id
     and c.developer_id = p_developer_id
     and c.request_id is null;

  if v_conv is null then
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
    v_first := true;
  end if;

  if v_msg is not null then
    insert into public.messages (conversation_id, sender_id, content, message_type, metadata)
    values (v_conv, v_user_id, v_msg, 'text', jsonb_build_object('kind', 'direct_contact'));

    update public.conversations set last_message_at = now() where id = v_conv;
  end if;

  return jsonb_build_object(
    'conversation_id', v_conv,
    'first_contact',   v_first,
    'cost',            0
  );
end;
$$;

grant execute on function public.contact_developer(uuid, text) to authenticated;

-- Le coût de contact client est désormais 0 (gratuit pour tous les clients)
create or replace function public.get_contact_cost()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select 0;
$$;

grant execute on function public.get_contact_cost() to anon, authenticated;

-- ------------------------------------------------------------
-- 10. RPC — Administration commerciale des abonnements (Section G)
-- ------------------------------------------------------------
create or replace function public.admin_upsert_subscription_plan(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := lower(btrim(coalesce(p_payload ->> 'id', '')));
  v_monthly integer := greatest(0, coalesce((p_payload ->> 'price_monthly_fcfa')::integer, 0));
  v_discount integer := least(90, greatest(0, coalesce((p_payload ->> 'annual_discount_pct')::integer, 20)));
  v_annual integer := coalesce(
    (p_payload ->> 'price_annual_fcfa')::integer,
    round((v_monthly * 12) * ((100 - v_discount)::numeric / 100.0))::integer
  );
begin
  if not public.is_admin() then
    raise exception 'Accès administrateur requis.' using errcode = 'TLAUT';
  end if;
  if v_id = '' then
    raise exception 'Identifiant de formule requis.' using errcode = 'TLBAD';
  end if;

  insert into public.subscription_plans (
    id, name_fr, name_en, description_fr, description_en,
    price_monthly_fcfa, price_annual_fcfa, annual_discount_pct,
    monthly_contacts_quota, badge_label, ranking_stars,
    client_coordinates_access, premium_email_alerts, enhanced_visibility,
    suggested_profile, team_management, recommended, is_active, sort_order,
    features_fr, features_en, updated_at
  ) values (
    v_id,
    coalesce(nullif(btrim(p_payload ->> 'name_fr'), ''), v_id),
    coalesce(nullif(btrim(p_payload ->> 'name_en'), ''), v_id),
    coalesce(p_payload ->> 'description_fr', ''),
    coalesce(p_payload ->> 'description_en', ''),
    v_monthly,
    greatest(0, v_annual),
    v_discount,
    greatest(0, coalesce((p_payload ->> 'monthly_contacts_quota')::integer, 80)),
    nullif(btrim(coalesce(p_payload ->> 'badge_label', '')), ''),
    least(5, greatest(0, coalesce((p_payload ->> 'ranking_stars')::integer, 1))),
    coalesce((p_payload ->> 'client_coordinates_access')::boolean, false),
    coalesce((p_payload ->> 'premium_email_alerts')::boolean, false),
    coalesce((p_payload ->> 'enhanced_visibility')::boolean, false),
    coalesce((p_payload ->> 'suggested_profile')::boolean, false),
    coalesce((p_payload ->> 'team_management')::boolean, false),
    coalesce((p_payload ->> 'recommended')::boolean, false),
    coalesce((p_payload ->> 'is_active')::boolean, true),
    coalesce((p_payload ->> 'sort_order')::integer, 10),
    coalesce(p_payload -> 'features_fr', '[]'::jsonb),
    coalesce(p_payload -> 'features_en', '[]'::jsonb),
    now()
  )
  on conflict (id) do update set
    name_fr                   = excluded.name_fr,
    name_en                   = excluded.name_en,
    description_fr            = excluded.description_fr,
    description_en            = excluded.description_en,
    price_monthly_fcfa        = excluded.price_monthly_fcfa,
    price_annual_fcfa         = excluded.price_annual_fcfa,
    annual_discount_pct       = excluded.annual_discount_pct,
    monthly_contacts_quota    = excluded.monthly_contacts_quota,
    badge_label               = excluded.badge_label,
    ranking_stars             = excluded.ranking_stars,
    client_coordinates_access = excluded.client_coordinates_access,
    premium_email_alerts      = excluded.premium_email_alerts,
    enhanced_visibility       = excluded.enhanced_visibility,
    suggested_profile         = excluded.suggested_profile,
    team_management           = excluded.team_management,
    recommended               = excluded.recommended,
    is_active                 = excluded.is_active,
    sort_order                = excluded.sort_order,
    features_fr               = excluded.features_fr,
    features_en               = excluded.features_en,
    updated_at                = now();

  return public.list_subscription_plans(true);
end;
$$;

grant execute on function public.admin_upsert_subscription_plan(jsonb) to authenticated;

create or replace function public.admin_grant_subscription(
  p_developer_id uuid,
  p_plan_id text,
  p_billing_cycle text default 'monthly',
  p_duration_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.subscription_plans%rowtype;
  v_end timestamptz := now() + make_interval(days => greatest(1, coalesce(p_duration_days, 30)));
begin
  if not public.is_admin() then
    raise exception 'Accès administrateur requis.' using errcode = 'TLAUT';
  end if;

  select * into v_plan from public.subscription_plans where id = p_plan_id;
  if v_plan.id is null then
    raise exception 'Formule introuvable.' using errcode = 'TLBAD';
  end if;

  insert into public.subscriptions (
    developer_id, plan, billing_cycle, status,
    started_at, ends_at, current_period_start, current_period_end,
    quota_reset_at, quota_limit, quota_used, cancel_at_period_end, updated_at
  ) values (
    p_developer_id, v_plan.id,
    case when p_billing_cycle = 'annual' then 'annual' else 'monthly' end,
    'active', now(), v_end, now(), v_end,
    now() + interval '30 days', v_plan.monthly_contacts_quota, 0, false, now()
  )
  on conflict (developer_id) do update set
    plan                 = excluded.plan,
    billing_cycle        = excluded.billing_cycle,
    status               = 'active',
    ends_at              = excluded.ends_at,
    current_period_start = now(),
    current_period_end   = excluded.ends_at,
    quota_reset_at       = now() + interval '30 days',
    quota_limit          = excluded.quota_limit,
    quota_used           = 0,
    cancel_at_period_end = false,
    updated_at           = now();

  return jsonb_build_object('ok', true, 'developer_id', p_developer_id, 'plan', v_plan.id, 'ends_at', v_end);
end;
$$;

grant execute on function public.admin_grant_subscription(uuid, text, text, integer) to authenticated;

create or replace function public.admin_refund_subscription_payment(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay public.subscription_payments%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Accès administrateur requis.' using errcode = 'TLAUT';
  end if;

  select * into v_pay from public.subscription_payments where id = p_payment_id for update;
  if v_pay.id is null then
    raise exception 'Paiement introuvable.' using errcode = 'TLNOR';
  end if;

  update public.subscription_payments
     set status      = 'refunded',
         refunded_at = now()
   where id = p_payment_id;

  update public.subscriptions
     set status     = 'cancelled',
         ends_at    = now(),
         updated_at = now()
   where developer_id = v_pay.developer_id;

  return jsonb_build_object('ok', true, 'payment_id', p_payment_id, 'status', 'refunded');
end;
$$;

grant execute on function public.admin_refund_subscription_payment(uuid) to authenticated;

create or replace function public.admin_get_subscription_analytics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_mrr bigint := 0;
  v_arr bigint := 0;
  v_total_revenue bigint := 0;
  v_active_count bigint := 0;
  v_cancelled_count bigint := 0;
  v_expired_count bigint := 0;
begin
  if not public.is_admin() then
    raise exception 'Accès administrateur requis.' using errcode = 'TLAUT';
  end if;

  select
    count(*) filter (where s.ends_at > now() and s.status = 'active'),
    count(*) filter (where s.cancel_at_period_end = true or s.status = 'cancelled'),
    count(*) filter (where s.ends_at <= now() or s.status = 'expired'),
    coalesce(sum(
      case
        when s.ends_at > now() and s.status = 'active' then
          case when s.billing_cycle = 'annual' then round(sp.price_annual_fcfa / 12.0)::bigint else sp.price_monthly_fcfa end
        else 0
      end
    ), 0)
  into v_active_count, v_cancelled_count, v_expired_count, v_mrr
  from public.subscriptions s
  left join public.subscription_plans sp on sp.id = s.plan;

  v_arr := v_mrr * 12;

  select coalesce(sum(amount_fcfa), 0)
    into v_total_revenue
    from public.subscription_payments
   where status = 'confirmed';

  return jsonb_build_object(
    'active_subscribers',    v_active_count,
    'cancelled_subscribers', v_cancelled_count,
    'expired_subscribers',   v_expired_count,
    'mrr_fcfa',              v_mrr,
    'arr_fcfa',              v_arr,
    'total_revenue_fcfa',    v_total_revenue,
    'churn_rate_pct',        case when (v_active_count + v_cancelled_count) > 0
                               then round((v_cancelled_count::numeric / (v_active_count + v_cancelled_count)::numeric) * 100, 1)
                               else 0 end,
    'renewal_rate_pct',      case when (v_active_count + v_cancelled_count) > 0
                               then round((v_active_count::numeric / (v_active_count + v_cancelled_count)::numeric) * 100, 1)
                               else 100 end,
    'by_plan',               coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'plan_id',     sp.id,
          'name_fr',     sp.name_fr,
          'subscribers', (
            select count(*) from public.subscriptions s
            where s.plan = sp.id and s.ends_at > now()
          )
        )
        order by sp.sort_order asc
      )
      from public.subscription_plans sp
    ), '[]'::jsonb),
    'recent_payments',       coalesce((
      select jsonb_agg(row_to_json(t))
      from (
        select
          p.id, p.invoice_number, p.developer_id, d.full_name, d.username,
          p.plan_id, p.billing_cycle, p.amount_fcfa, p.status,
          p.created_at, p.confirmed_at, p.refunded_at
        from public.subscription_payments p
        left join public.developers d on d.id = p.developer_id
        order by p.created_at desc
        limit 50
      ) t
    ), '[]'::jsonb),
    'subscribers',           coalesce((
      select jsonb_agg(row_to_json(s_row))
      from (
        select
          s.developer_id, d.full_name, d.username,
          s.plan, s.billing_cycle, s.status,
          s.started_at, s.ends_at, s.quota_used, s.quota_limit,
          s.cancel_at_period_end
        from public.subscriptions s
        left join public.developers d on d.id = s.developer_id
        order by s.ends_at desc
        limit 100
      ) s_row
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.admin_get_subscription_analytics() to authenticated;

-- ------------------------------------------------------------
-- 11. ESPACE CLIENT : MISE EN AVANT PAYANTE D'UN BRIEF (FCFA)
--     La publication d'un brief est 100 % gratuite (0 FCFA) et
--     l'espace client n'a aucun abonnement. Le client peut
--     optionnellement payer une somme fixe en FCFA pour placer
--     son brief en tête du marketplace (public.sponsored_briefs).
-- ------------------------------------------------------------
create table if not exists public.brief_boost_payments (
  id                uuid primary key default gen_random_uuid(),
  request_id        uuid not null references public.requests(id) on delete cascade,
  payer_id          uuid references auth.users(id) on delete set null,
  days              integer not null check (days in (7, 14, 30)),
  amount_fcfa       integer not null check (amount_fcfa > 0),
  status            text not null default 'pending'
                      check (status in ('pending', 'confirmed', 'failed', 'refunded')),
  provider          text not null default 'chariow',
  provider_sale_id  text,
  invoice_number    text not null unique,
  confirmed_at      timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists brief_boost_payments_req_idx
  on public.brief_boost_payments (request_id, created_at desc);

alter table public.brief_boost_payments enable row level security;

drop policy if exists brief_boost_payments_select_own on public.brief_boost_payments;
create policy brief_boost_payments_select_own
  on public.brief_boost_payments for select
  using (payer_id = (select auth.uid()) or public.is_admin());

revoke insert, update, delete on public.brief_boost_payments from anon, authenticated;

create or replace function public.get_brief_boost_prices()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_array(
    jsonb_build_object('days', 7,  'price_fcfa', 2500, 'label_fr', '7 jours en tête de liste',  'label_en', '7 days featured at the top'),
    jsonb_build_object('days', 14, 'price_fcfa', 4500, 'label_fr', '14 jours en tête de liste', 'label_en', '14 days featured at the top', 'popular', true),
    jsonb_build_object('days', 30, 'price_fcfa', 8000, 'label_fr', '30 jours en tête de liste', 'label_en', '30 days featured at the top')
  );
$$;

grant execute on function public.get_brief_boost_prices() to anon, authenticated;

create or replace function public.create_brief_boost_checkout(
  p_request_id uuid,
  p_days integer default 7,
  p_management_key uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_req public.requests%rowtype;
  v_days integer := case when p_days in (7, 14, 30) then p_days else 7 end;
  v_amount integer;
  v_invoice text;
  v_payment_id uuid;
begin
  select * into v_req from public.requests where id = p_request_id;
  if v_req.id is null then
    raise exception 'Ce projet n’existe pas.' using errcode = 'TLNOR';
  end if;

  if (v_uid is null or v_req.client_id is distinct from v_uid)
     and (p_management_key is null or v_req.management_key is distinct from p_management_key)
     and not public.is_admin() then
    raise exception 'Vous n’êtes pas autorisé à modifier ce projet.' using errcode = 'TLAUT';
  end if;

  v_amount := case
    when v_days = 30 then 8000
    when v_days = 14 then 4500
    else 2500
  end;

  v_invoice := 'BOOST-' || to_char(now(), 'YYYYMM') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.brief_boost_payments (
    request_id, payer_id, days, amount_fcfa, status, invoice_number
  ) values (
    v_req.id, coalesce(v_uid, v_req.client_id), v_days, v_amount, 'pending', v_invoice
  )
  returning id into v_payment_id;

  return jsonb_build_object(
    'payment_id',     v_payment_id,
    'invoice_number', v_invoice,
    'request_id',     v_req.id,
    'days',           v_days,
    'amount_fcfa',    v_amount
  );
end;
$$;

grant execute on function public.create_brief_boost_checkout(uuid, integer, uuid) to anon, authenticated;

create or replace function public.confirm_brief_boost_payment(
  p_payment_id uuid,
  p_provider_sale_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay public.brief_boost_payments%rowtype;
  v_base timestamptz;
  v_new_end timestamptz;
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role'
     and not public.is_admin() then
    raise exception 'Confirmation réservée au serveur de paiement ou à un administrateur.' using errcode = 'TLAUT';
  end if;

  select * into v_pay from public.brief_boost_payments where id = p_payment_id for update;
  if v_pay.id is null then
    raise exception 'Paiement de mise en avant introuvable.' using errcode = 'TLNOR';
  end if;

  if v_pay.status = 'confirmed' then
    return jsonb_build_object('ok', true, 'already_confirmed', true, 'payment_id', v_pay.id);
  end if;

  select greatest(coalesce(max(ends_at), now()), now())
    into v_base
    from public.sponsored_briefs
   where request_id = v_pay.request_id;

  v_new_end := v_base + make_interval(days => v_pay.days);

  insert into public.sponsored_briefs (request_id, started_at, ends_at)
  values (v_pay.request_id, now(), v_new_end)
  on conflict (request_id) do update
    set ends_at = excluded.ends_at;

  update public.brief_boost_payments
     set status           = 'confirmed',
         provider_sale_id = coalesce(p_provider_sale_id, provider_sale_id),
         confirmed_at     = now()
   where id = v_pay.id;

  if v_pay.payer_id is not null then
    insert into public.notifications (user_id, type, title, body, link)
    values (
      v_pay.payer_id,
      'brief_boosted',
      'Votre projet est mis en avant',
      'Votre projet apparaît en tête du marketplace jusqu’au ' || to_char(v_new_end, 'DD/MM/YYYY') || '.',
      '/client/briefs'
    );
  end if;

  return jsonb_build_object(
    'ok',         true,
    'payment_id', v_pay.id,
    'request_id', v_pay.request_id,
    'ends_at',    v_new_end
  );
end;
$$;

grant execute on function public.confirm_brief_boost_payment(uuid, text) to authenticated, service_role;

-- ------------------------------------------------------------
-- 12. RÉCOMPENSES DE CLASSEMENT : CONTACTS BONUS (ET NON TOKENS)
--     Reprend la définition de 0056 sans détruire l'historique :
--     le podium régional (10 / 7 / 4) est crédité en contacts
--     bonus sur public.contact_bonuses (section 4b) au lieu de
--     token_transactions. Les contacts bonus s'ajoutent au quota
--     mensuel dans get_my_subscription et unlock_and_start_chat.
--     La colonne historique leaderboard_monthly.tokens_awarded est
--     conservée : elle porte désormais le nombre de contacts bonus.
--     Les badges top 1/2/3 régional restent attribués à l'identique.
-- ------------------------------------------------------------
create or replace function public._leaderboard_settle(p_year int, p_month int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_standings jsonb;
  v_row jsonb;
  v_scope_key text;
  v_rows jsonb;
  v_rank int;
  v_developer uuid;
  v_cnt int;
  v_bonus int;
  v_credited int := 0;
  v_r1 int := 10;
  v_r2 int := 7;
  v_r3 int := 4;
begin
  perform pg_advisory_xact_lock(hashtext('leaderboard_settle'), p_year * 100 + p_month);

  v_standings := public._leaderboard_standings(p_year, p_month);

  for v_row in select * from jsonb_array_elements(v_standings->'regional') loop
    v_rank := (v_row->>'rank')::int;
    v_developer := (v_row->>'developer_id')::uuid;
    v_cnt := (v_row->>'completed_projects')::int;
    v_bonus := case v_rank when 1 then v_r1 when 2 then v_r2 when 3 then v_r3 else 0 end;

    insert into public.leaderboard_monthly
      (year, month, scope, scope_key, rank, developer_id, completed_projects, tokens_awarded)
    values
      (p_year, p_month, 'regional', 'aof', v_rank, v_developer, v_cnt, 0)
    on conflict (year, month, scope, scope_key, developer_id)
      do update set rank = excluded.rank,
                    completed_projects = excluded.completed_projects,
                    snapshot_at = now();

    -- Un crédit par (développeur, période) : contact_bonuses porte la
    -- contrainte unique qui rend le règlement idempotent.
    if v_bonus > 0 and not exists (
      select 1 from public.contact_bonuses cb
       where cb.developer_id = v_developer
         and cb.year = p_year
         and cb.month = p_month
    ) then
      insert into public.contact_bonuses (developer_id, year, month, contacts)
      values (v_developer, p_year, p_month, v_bonus);
      v_credited := v_credited + v_bonus;
      update public.leaderboard_monthly
         set tokens_awarded = v_bonus
       where year = p_year and month = p_month and scope = 'regional'
         and scope_key = 'aof' and developer_id = v_developer;
    end if;

    if v_bonus > 0 then
      insert into public.developer_badges (developer_id, badge_type, year, month, scope, scope_key, awarded_at)
      values (
        v_developer,
        case v_rank when 1 then 'top1_regional' when 2 then 'top2_regional' else 'top3_regional' end,
        p_year, p_month, 'regional', 'aof', now()
      )
      on conflict do nothing;
    end if;
  end loop;

  -- Pays : classement affiché uniquement, sans double récompense.
  for v_row in select * from jsonb_array_elements(v_standings->'countries') loop
    v_scope_key := v_row->>'key';
    v_rows := v_row->'rows';
    for v_row in select * from jsonb_array_elements(v_rows) loop
      v_rank := (v_row->>'rank')::int;
      v_developer := (v_row->>'developer_id')::uuid;
      v_cnt := (v_row->>'completed_projects')::int;

      insert into public.leaderboard_monthly
        (year, month, scope, scope_key, rank, developer_id, completed_projects, tokens_awarded)
      values
        (p_year, p_month, 'country', v_scope_key, v_rank, v_developer, v_cnt, 0)
      on conflict (year, month, scope, scope_key, developer_id)
        do update set rank = excluded.rank,
                      completed_projects = excluded.completed_projects,
                      snapshot_at = now();
    end loop;
  end loop;

  insert into public.leaderboard_monthly_history
    (year, month, scope, scope_key, rank, developer_id, completed_projects, tokens_awarded, snapshot_at)
  select year, month, scope, scope_key, rank, developer_id, completed_projects, tokens_awarded, snapshot_at
    from public.leaderboard_monthly
   where year = p_year and month = p_month
  on conflict (year, month, scope, scope_key, rank) do nothing;

  return jsonb_build_object(
    'ok', true,
    'period', jsonb_build_object('year', p_year, 'month', p_month),
    'credited', v_credited,
    'unit', 'contact_bonus'
  );
end;
$$;
