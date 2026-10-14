-- =============================================================================
-- Teranga Labs — Tests pgtap de la forte RLS des entités critiques.
--
-- Couvre les tables et fonctions ajoutées après l'audit P0/P1/P2/P4 (missions,
-- OTP, favoris, agences, sponsoring, PRO analytics, litiges, risque, flags,
-- disponibilités, support) : la RLS doit être activée partout, aucune
-- écriture ne doit être ouverte à un visiteur, et les RPC sensibles
-- (sponsoring, PRO, agences, OTP, débit de Tokens, litiges, tickets)
-- ne doivent jamais être exécutables par le rôle anon.
--
-- Exécution : local `supabase test db` / CI job `db-tests` / `npm run test:db`.
-- Aucun jeu de données : seul le catalogue est inspecté.
-- =============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

-- -----------------------------------------------------------------------------
-- 1. RLS activée sur toutes les entités critiques récentes
-- -----------------------------------------------------------------------------
select is(
  (
    select count(*)::int
      from pg_class c
     where c.relnamespace = 'public'::regnamespace
       and c.relkind = 'r'
       and c.relname in (
         'otp_verifications', 'missions', 'mission_events',
         'analytic_events', 'favorites',
         'agencies', 'agency_members',
         'sponsored_profiles', 'sponsored_briefs', 'subscriptions',
         'disputes', 'risk_events', 'feature_flags',
         'developer_availability', 'support_tickets', 'support_messages'
       )
       and not c.relrowsecurity
  ),
  0,
  'RLS activée sur les entités critiques récentes'
);

-- -----------------------------------------------------------------------------
-- 2. Aucune écriture ouverte à un visiteur sur ces tables
-- -----------------------------------------------------------------------------
select is(
  (
    select count(*)::int
      from pg_policies
     where schemaname = 'public'
       and cmd <> 'SELECT'
       and (roles && array['anon', 'public']::name[])
       and (coalesce(with_check, qual, '') !~ 'auth\.uid\(\)')
       and tablename in (
         'otp_verifications', 'missions', 'mission_events',
         'analytic_events', 'favorites',
         'agencies', 'agency_members',
         'sponsored_profiles', 'sponsored_briefs', 'subscriptions',
         'disputes', 'risk_events', 'feature_flags',
         'developer_availability', 'support_tickets', 'support_messages'
       )
  ),
  0,
  'aucune politique d''écriture ouverte à un visiteur sur les entités critiques'
);

-- -----------------------------------------------------------------------------
-- 3. RPC sensibles jamais exécutables par anon
-- -----------------------------------------------------------------------------
-- Chaque fonction ci-dessous débite des Tokens, expose une donnée privée
-- ou mut le compte : un visiteur ne doit pas pouvoir les invoquer.
select is(
  (
    select count(*)::int
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and has_function_privilege('anon', p.oid, 'execute')
       and (
         p.proname in (
           'debit_tokens', 'sponsor_dev_profile', 'sponsor_brief',
           'subscribe_pro', 'request_otp', 'verify_otp',
           'create_agency', 'join_agency', 'rotate_agency_invite',
           'remove_agency_member', 'leave_agency', 'set_agency_status',
           'my_agency', 'agency_role', 'admin_set_sponsoring_prices',
           'admin_set_pro_prices', 'get_agency_by_invite',
           'open_dispute', 'list_my_disputes', 'set_dispute_status',
           'log_risk_event', 'create_support_ticket', 'reply_support_ticket',
           'list_my_tickets', 'close_support_ticket',
           'set_my_availability', 'admin_set_feature_flag'
         )
       )
  ),
  0,
  'les RPC sensibles ne sont pas exécutables par un visiteur'
);

-- -----------------------------------------------------------------------------
-- 4. debit_tokens : même les clients connectés ne l'invoquent jamais
-- -----------------------------------------------------------------------------
-- RPC privée, réservée au service : aucun rôle navigateur ne doit pouvoir
-- débiter un solde arbitrairement (seuls sponsor_dev_profile / sponsor_brief
-- le font, sous contrôle de leurs propres RLS internes).
select is(
  (
    select count(*)::int
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'debit_tokens'
       and has_function_privilege('authenticated', p.oid, 'execute')
  ),
  0,
  'debit_tokens n''est pas exécutable par le rôle authenticated'
);

-- -----------------------------------------------------------------------------
-- 5. Lecture publique : les RPC de découverte restent ouvertes à anon
-- -----------------------------------------------------------------------------
select is(
  (
    select count(*)::int
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and (
         p.proname = 'list_agencies' and p.pronargs = 2
         or p.proname = 'get_agency' and p.pronargs = 1
         or p.proname = 'get_sponsoring_prices' and p.pronargs = 0
         or p.proname = 'get_pro_prices' and p.pronargs = 0
         or p.proname = 'get_pro_status' and p.pronargs = 1
         or p.proname = 'is_feature_enabled' and p.pronargs = 1
       )
       and not has_function_privilege('anon', p.oid, 'execute')
  ),
  0,
  'les RPC de découverte publique (agences, prix, flags) restent appelables par anon'
);

-- -----------------------------------------------------------------------------
-- 6. has_role : jamais public, accessible aux sessions authentifiées
-- -----------------------------------------------------------------------------
select ok(
  exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'has_role'
  ),
  'la garde serveur has_role existe'
);

select is(
  (
    select count(*)::int
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'has_role'
       and has_function_privilege('public', p.oid, 'execute')
  ),
  0,
  'has_role n''est pas exécutable via PUBLIC'
);

select ok(
  exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'has_role'
       and has_function_privilege('authenticated', p.oid, 'execute')
  ),
  'has_role est exécutable par authenticated'
);

-- -----------------------------------------------------------------------------
-- 7. Le paiement en ligne reste le seul chemin vers un débit : verification
--    et sponsorisation ne s'invoquent pas sans rôle déclaré
-- -----------------------------------------------------------------------------
select is(
  (
    select count(*)::int
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('sponsor_dev_profile', 'subscribe_pro', 'join_agency')
       and not has_function_privilege('authenticated', p.oid, 'execute')
  ),
  0,
  'les RPC sponsor/PRO/agence sont exécutables par les sessions authentifiées'
);

-- Verdict machine lisible (scripts/db-test.mjs).
select case when num_failed() = 0 then 'PASS' else 'FAIL ' || num_failed()::text end as db_test_verdict;

select * from finish();
rollback;