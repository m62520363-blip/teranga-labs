-- =============================================================================
-- Teranga Labs — Tests pgtap des privilèges SQL (RLS, GRANT, surface publique)
--
-- Ce fichier est un garde-fou de sécurité : il échoue dès qu'une table perd sa
-- RLS, qu'une politique d'écriture s'ouvre à un visiteur, ou qu'une fonction
-- sensible redevient exécutable par le rôle anon.
--
-- Exécution :
--   local  : supabase test db
--   CI     : job `db-tests` du workflow .github/workflows/ci.yml
--   liée   : npm run test:db
--
-- Aucun jeu de données : seul le catalogue est inspecté. BEGIN/ROLLBACK par
-- précaution (la création de l'extension est annulée avec le reste).
-- =============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

-- -----------------------------------------------------------------------------
-- 1. Intendance
-- -----------------------------------------------------------------------------
-- pgtap doit vivre dans le schéma extensions, jamais dans public : sinon ses
-- ~600 fonctions d'assertion deviennent exécutables par anon.
select ok(
  not exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('is', 'ok', 'plan', 'finish')
  ),
  'pgtap n''est pas installé dans le schéma public'
);

select ok(exists (select 1 from pg_roles where rolname = 'anon'), 'rôle anon présent');
select ok(exists (select 1 from pg_roles where rolname = 'authenticated'), 'rôle authenticated présent');
select ok(exists (select 1 from pg_roles where rolname = 'service_role'), 'rôle service_role présent');

-- -----------------------------------------------------------------------------
-- 2. RLS : aucune table publique ne doit en être dépourvue
-- -----------------------------------------------------------------------------
select is(
  (
    select coalesce(string_agg(c.relname, ', ' order by c.relname), '(aucune)')
      from pg_class c
     where c.relnamespace = 'public'::regnamespace
       and c.relkind = 'r'
       and not c.relrowsecurity
  ),
  '(aucune)',
  'toutes les tables de public ont la RLS activée'
);

-- -----------------------------------------------------------------------------
-- 3. Surface publique : surface anon figée
-- -----------------------------------------------------------------------------
-- Rappel PostgreSQL : une fonction reçoit EXECUTE via PUBLIC par défaut, donc
-- `revoke ... from anon` seul ne protège rien. Cette liste est la preuve
-- que les révocations de la migration 0031 portent bien sur PUBLIC.
--
-- Toute nouvelle fonction publique doit être revue puis ajoutée ici.
select is(
  (
    select coalesce(string_agg(fn, ', ' order by fn), '(aucune)')
      from (
        select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as fn
          from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.prokind = 'f'
           and has_function_privilege('anon', p.oid, 'execute')
      ) s
  ),
  'create_brief(p_client_name text, p_client_whatsapp text, p_client_city text, p_project_type text, p_budget integer, p_description text), get_brief_management(p_management_key uuid), get_contact_cost(), get_developer_reviews(p_developer uuid), get_directory_filters(), get_peer_display_name(p_user_id uuid), get_public_developer_profile(p_identifier text, p_viewer_role text), get_verification_price(), is_admin(), is_phone_taken(p_phone text), is_username_taken(p_username text), list_approved_developers(p_query text, p_specialty text, p_technologies text[], p_services text[], p_city text, p_min_experience integer, p_availability text, p_min_rating numeric, p_verified_only boolean, p_project_type text, p_sort text, p_limit integer, p_offset integer), mask_email(p_email text), mask_phone(p_phone text), normalize_phone(p_phone text), submit_contact_message(p_name text, p_email text, p_message text, p_subject text), submit_report(p_target_type text, p_target_id uuid, p_reason text, p_description text), submit_verification_request(p_method text), update_brief_status(p_management_key uuid, p_status text)',
  'liste des fonctions de public appelables par un visiteur : inchangée'
);

-- -----------------------------------------------------------------------------
-- 4. Fonctions à usage interne : jamais exécutables par un client
-- -----------------------------------------------------------------------------
select is(
  (
    select count(*)::int
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'notify_user', 'notify_inapp_event', 'enqueue_notification_jobs',
         'handle_new_user', 'refresh_developer_reputation',
         'tgf_review_request_done', 'tgf_reputation_on_reviews',
         'tgf_reputation_on_unlocks', 'list_developers_for_brief',
         'credit_from_payment', 'developers_protect_managed_cols',
         'check_phone_unique'
       )
       and (has_function_privilege('anon', p.oid, 'execute')
         or has_function_privilege('authenticated', p.oid, 'execute'))
  ),
  0,
  'les fonctions internes (triggers, notifications, crédits) ne sont pas exécutables par un client'
);

-- -----------------------------------------------------------------------------
-- 5. Politiques d'écriture : toujours contrôlées par auth.uid()
-- -----------------------------------------------------------------------------
select is(
  (
    select count(*)::int
      from pg_policies
     where schemaname = 'public'
       and cmd <> 'SELECT'
       and (roles = '{anon}' or roles = '{public}')
       and coalesce(with_check, qual, '') !~ 'auth\.uid\(\)'
  ),
  0,
  'aucune politique d''écriture n''est ouverte à un visiteur sans contrôle d''identité'
);

-- -----------------------------------------------------------------------------
-- 6. Fonctions SECURITY DEFINER : search_path fixé
-- -----------------------------------------------------------------------------
select is(
  (
    select count(*)::int
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
       and (p.proconfig is null
         or not exists (
           select 1 from unnest(p.proconfig) cfg where cfg like 'search\_path=%'
         ))
  ),
  0,
  'toutes les fonctions SECURITY DEFINER fixent leur search_path'
);

-- -----------------------------------------------------------------------------
-- 7. Données sensibles : aucun secret d'authentification exposé à un visiteur
-- -----------------------------------------------------------------------------
select is(
  (
    select count(*)::int
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and has_function_privilege('anon', p.oid, 'execute')
       and (p.prosrc ilike '%raw_app_meta_data%'
         or p.prosrc ~* '(encrypted_password|confirmation_token|recovery_token|phone_confirm)')
  ),
  0,
  'aucune fonction publique ne lit les secrets d''authentification'
);

select is(
  (
    select count(*)::int
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and has_function_privilege('anon', p.oid, 'execute')
       and p.prosrc ~* '\m[a-z_]+\.(email|phone)\M'
       and p.prosrc !~* 'mask_(email|phone)'
  ),
  0,
  'aucune fonction publique ne renvoie un e-mail ou un téléphone non masqué'
);

-- Verdict machine lisible : l'API Management Supabase ne renvoie que le
-- dernier jeu de résultats non vide, scripts/db-test.mjs s'appuie dessus.
select case when num_failed() = 0 then 'PASS' else 'FAIL ' || num_failed()::text end as db_test_verdict;

select * from finish();
rollback;
