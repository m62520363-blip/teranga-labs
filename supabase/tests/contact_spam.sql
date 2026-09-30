-- =============================================================================
-- Teranga Labs — Tests pgtap de la surface d'écriture visiteurs (0032)
--
-- Exécution :
--   local  : supabase test db            (base locale, Docker)
--   CI     : job `db-tests` du workflow .github/workflows/ci.yml
--   liée   : npm run test:db            (projet lié, script scripts/db-test.mjs)
--
-- Le fichier est encadré par BEGIN/ROLLBACK : aucune donnée de test ne
-- subsiste, même en cas d'échec.
--
-- Objectifs :
--   1. Plus aucune politique d'écriture (INSERT/UPDATE/DELETE) n'autorise
--      un visiteur (rôle anon) sur public.requests ni public.contact_messages.
--   2. anon et authenticated n'ont plus de privilège INSERT direct sur ces
--      deux tables : toute création passe par une RPC validante.
--   3. submit_contact_message refuse le 4e message d'une même adresse email
--      sur 24 h (errcode TLLIM), sans bloquer une adresse différente.
--
-- Les helpers pg_temp exécutent le SQL et exposent le SQLSTATE levé.
-- =============================================================================

begin;

create extension if not exists pgtap with schema extensions;

create or replace function pg_temp.expect_error(p_sql text)
returns text
language plpgsql
as $$
begin
  begin
    execute p_sql;
  exception when others then
    return sqlstate;
  end;
  return 'NO_ERROR';
end $$;

create or replace function pg_temp.expect_ok(p_sql text)
returns text
language plpgsql
as $$
begin
  execute p_sql;
  return 'NO_ERROR';
end $$;

select plan(12);

-- ---------------------------------------------------------------------------
-- 1. Surface d'écriture : zéro politique anon sur les deux tables
--    (l'opérateur && détecte aussi les politiques posées sur
--    {anon, authenticated}, que l'égalité ne voyait pas).
-- ---------------------------------------------------------------------------
select is(
  (
    select count(*)::int
      from pg_policies
     where schemaname = 'public'
       and tablename = 'contact_messages'
       and cmd <> 'SELECT'
       and roles && array['anon']::name[]
  ),
  0,
  'contact_messages : aucune politique d''écriture ouverte à un visiteur'
);

select is(
  (
    select count(*)::int
      from pg_policies
     where schemaname = 'public'
       and tablename = 'requests'
       and cmd <> 'SELECT'
       and roles && array['anon']::name[]
  ),
  0,
  'requests : aucune politique d''écriture ouverte à un visiteur'
);

-- ---------------------------------------------------------------------------
-- 2. Privilèges : plus d'INSERT direct pour anon ni authenticated.
-- ---------------------------------------------------------------------------
select is(
  has_table_privilege('anon', 'public.contact_messages', 'insert'),
  false,
  'anon n''a pas INSERT sur contact_messages'
);

select is(
  has_table_privilege('authenticated', 'public.contact_messages', 'insert'),
  false,
  'authenticated n''a pas INSERT sur contact_messages'
);

select is(
  has_table_privilege('anon', 'public.requests', 'insert'),
  false,
  'anon n''a pas INSERT sur requests'
);

select is(
  has_table_privilege('authenticated', 'public.requests', 'insert'),
  false,
  'authenticated n''a pas INSERT sur requests'
);

-- ---------------------------------------------------------------------------
-- 3. Anti-spam submit_contact_message : 3 max par email sur 24 h.
-- ---------------------------------------------------------------------------
truncate public.contact_messages;

select is(
  pg_temp.expect_ok($$select public.submit_contact_message(
    'Jean Test', 'pgtap-rl@example.com',
    'Premier message assez long pour passer toutes les validations', 'Sujet A'
  )$$),
  'NO_ERROR',
  '1er message de l''adresse accepté'
);

select is(
  pg_temp.expect_ok($$select public.submit_contact_message(
    'Jean Test', 'pgtap-rl@example.com',
    'Deuxième message assez long pour passer toutes les validations', 'Sujet B'
  )$$),
  'NO_ERROR',
  '2e message de l''adresse accepté'
);

select is(
  pg_temp.expect_ok($$select public.submit_contact_message(
    'Jean Test', 'pgtap-rl@example.com',
    'Troisième message assez long pour passer toutes les validations', 'Sujet C'
  )$$),
  'NO_ERROR',
  '3e message de l''adresse accepté (dernier dans la fenêtre)'
);

select is(
  pg_temp.expect_error($$select public.submit_contact_message(
    'Jean Test', 'pgtap-rl@example.com',
    'Quatrième message assez long pour être rejeté par le limiteur', 'Sujet D'
  )$$),
  'TLLIM',
  '4e message de la même adresse refusé (TLLIM)'
);

select is(
  (
    select count(*)::int from public.contact_messages
    where email = 'pgtap-rl@example.com'
  ),
  3,
  'seuls 3 messages ont été persistés pour l''adresse limitée'
);

select is(
  pg_temp.expect_ok($$select public.submit_contact_message(
    'Autre Test', 'pgtap-other@example.com',
    'Message d''une adresse différente accepté normalement', 'Sujet E'
  )$$),
  'NO_ERROR',
  'une adresse différente n''est pas impactée par la limite'
);

-- Verdict machine lisible : l'API Management Supabase ne renvoie que le
-- dernier jeu de résultats non vide, scripts/db-test.mjs s'appuie dessus.
select case when num_failed() = 0 then 'PASS' else 'FAIL ' || num_failed()::text end as db_test_verdict;

select * from finish();
rollback;