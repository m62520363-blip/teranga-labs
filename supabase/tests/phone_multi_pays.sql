-- =============================================================================
-- Teranga Labs — Tests pgtap de la normalisation multi-pays (migration 0052)
--
-- Exécution : local `supabase test db` / CI job `db-tests` / `npm run test:db`.
--
-- Ce que ces tests verrouillent — normalize_phone ne doit JAMAIS :
--   1. tronquer à 9 chiffres (la règle de 0024, correcte pour le Sénégal
--      seulement) : un numéro ivoirien complet doit être conservé tel quel ;
--   2. traiter différemment « 00221… » et « +221… » (mêmes chiffres) ;
--   3. renvoyer autre chose que NULL pour un numéro absent ;
--   4. re-créer la collision ivoirienne que 0024 introduisait : deux numéros
--      nationaux distincts (+225, 10 chiffres) convergèrent autrefois vers la
--      même clé tronquée, et le second était rejeté à tort (« numéro déjà
--      associé ») ;
--   5. laisser les colonnes générées / index uniques de 0024 en place
--      (whatsapp_key, phone_key doivent être régénérés et reindexés).
--
-- Aucun jeu de données persistant : les fixtures éventuelles sont annulées par
-- le BEGIN/ROLLBACK qui encadre le fichier.
-- =============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

-- -----------------------------------------------------------------------------
-- 1. L'international est conservé : pas de troncature à 9 chiffres
-- -----------------------------------------------------------------------------
-- Numéro ivoirien complet : +225 07 08 09 10 11 → 13 chiffres. Sous l'ancienne
-- règle right(…,9), la clé « 708091011 » écrasait le numéro d'un autre client.
select is(
  public.normalize_phone('+225 07 08 09 10 11'),
  '2250708091011',
  'normalize_phone conserve le préfixe pays et les 10 chiffres nationaux'
);

-- -----------------------------------------------------------------------------
-- 2. « 00… » et « +… » convergent : mêmes chiffres, même clé
-- -----------------------------------------------------------------------------
select is(
  public.normalize_phone('00221 77 123 45 67'),
  public.normalize_phone('+221 77 123 45 67'),
  'normalize_phone équivalent pour 00221… et +221…'
);

select is(
  public.normalize_phone('00221 77 123 45 67'),
  '221771234567',
  'normalize_phone retire le 00 et tous les séparateurs'
);

-- -----------------------------------------------------------------------------
-- 3. Absence de numéro → NULL (jamais '' ni une clé vide)
-- -----------------------------------------------------------------------------
select is(
  (public.normalize_phone(null), public.normalize_phone('   ')),
  (null::text, null::text),
  'normalize_phone renvoie NULL pour un numéro absent ou vide'
);

-- -----------------------------------------------------------------------------
-- 4. Anti-collision : deux numéros ivoiriens distincts → deux clés distinctes
-- -----------------------------------------------------------------------------
-- Mêmes 9 derniers chiffres (0708091011 vs 1708091011 tronqués à l'identique
-- par right(…,9)) : sous 0024, le second rejetait « numéro déjà associé ».
select is(
  public.normalize_phone('+225 07 08 09 10 11')
    <> public.normalize_phone('+225 17 08 09 10 11'),
  true,
  'deux numéros ivoiriens distincts produisent deux clés distinctes'
);

-- -----------------------------------------------------------------------------
-- 5. Colonnes générées régénérées (0052 : DROP + ADD, stockées)
-- -----------------------------------------------------------------------------
select is(
  (
    select count(*)::int
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and a.attgenerated = 's'
       and (c.relname, a.attname) in (
             ('developers', 'whatsapp_key'),
             ('client_profiles', 'phone_key')
           )
  ),
  2,
  'whatsapp_key et phone_key sont des colonnes générées stockées'
);

-- -----------------------------------------------------------------------------
-- 6. Index uniques recréés sur la nouvelle clé
-- -----------------------------------------------------------------------------
select is(
  (
    select count(*)::int
      from pg_index i
      join pg_class c on c.oid = i.indexrelid
      join pg_class t on t.oid = i.indrelid
      join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public'
       and i.indisunique
       and (t.relname, c.relname) in (
             ('developers', 'developers_whatsapp_key_idx'),
             ('client_profiles', 'client_profiles_phone_key_idx')
           )
  ),
  2,
  'les index uniques de clé téléphone sont en place'
);

-- Verdict machine lisible (scripts/db-test.mjs).
select case when num_failed() = 0 then 'PASS' else 'FAIL ' || num_failed()::text end as db_test_verdict;

select * from finish();
rollback;
