-- =============================================================================
-- Teranga Labs — Tests pgtap du système d'avis & évaluations (migration 0030)
--
-- Exécution :
--   local  : supabase test db            (base locale, Docker)
--   CI     : job `db-tests` du workflow .github/workflows/ci.yml
--   liée   : npm run test:db            (projet lié, script scripts/db-test.mjs)
--
-- Le fichier est encadré par BEGIN/ROLLBACK : aucune donnée de test ne
-- subsiste, même en cas d'échec. Toutes les fixtures utilisent des UUID
-- déterministes pour être rejouables.
--
-- Note : les fonctions applicatives renvoient des SQLSTATE personnalisés
-- (TLNAU, TLFOR, TLTMP, TLBAD, TLNOK, TLAAC) que pgtap ne sait pas
-- comparer via throws_ok(). Les helpers pg_temp ci-dessous exécutent le SQL
-- et exposent le SQLSTATE réellement levé, ce qui permet une assertion is().
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
  begin
    execute p_sql;
  exception when others then
    return 'ERROR ' || sqlstate || ' : ' || sqlerrm;
  end;
  return 'NO_ERROR';
end $$;

select plan(58);

-- -----------------------------------------------------------------------------
-- 1. Fixtures
-- -----------------------------------------------------------------------------
-- Le trigger handle_new_user() crée déjà developers / client_profiles /
-- user_roles pour chaque inscription : tous les inserts ci-dessous sont des
-- upserts, et le rôle est corrigé explicitement.
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('11111111-1111-4111-8111-111111111111', 'pgtap-client@example.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role":"client","full_name":"PGTAP Client","company_name":"PGTAP SARL","contact_name":"PGTAP Client","city":"Dakar"}', 'authenticated', 'authenticated'),
  ('11111111-1111-4111-8111-111111111112', 'pgtap-client2@example.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role":"client","full_name":"PGTAP Client 2","company_name":"PGTAP 2 SARL","contact_name":"PGTAP Client 2","city":"Thiès"}', 'authenticated', 'authenticated'),
  ('22222222-2222-4222-8222-222222222222', 'pgtap-admin@example.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role":"developer","full_name":"PGTAP Admin","username":"pgtap-admin"}', 'authenticated', 'authenticated'),
  ('33333333-3333-4333-8333-333333333333', 'pgtap-dev@example.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role":"developer","full_name":"PGTAP Dev","username":"pgtap-dev","city":"Dakar"}', 'authenticated', 'authenticated');

insert into public.user_roles (user_id, role)
values
  ('11111111-1111-4111-8111-111111111111', 'client'),
  ('11111111-1111-4111-8111-111111111112', 'client'),
  ('22222222-2222-4222-8222-222222222222', 'admin'),
  ('33333333-3333-4333-8333-333333333333', 'developer')
on conflict (user_id) do update set role = excluded.role;

insert into public.developers (id, full_name, status, username, city, experience_years, reviews_count, rating_avg, reputation_score, reputation_level)
values ('33333333-3333-4333-8333-333333333333', 'PGTAP Dev', 'active', 'pgtap-dev', 'Dakar', 3, 0, 0, 50, 'standard')
on conflict (id) do update set
  full_name = excluded.full_name,
  status = excluded.status,
  city = excluded.city,
  experience_years = excluded.experience_years,
  reviews_count = 0,
  rating_avg = 0;

-- R1 : mission terminée, développeur déterminé par la conversation attribuée
-- R2 : mission terminée, développeur déterminé par selected_developer_id
-- R3 : mission encore en cours (doit refuser l'avis)
insert into public.requests (id, client_id, client_name, client_whatsapp, client_city, project_type, budget, description, status)
values
  ('44444444-4444-4444-8444-444444444441', '11111111-1111-4111-8111-111111111111', 'PGTAP Client', '+221700000001', 'Dakar', 'vitrine', 100000, 'Mission pgtap 1', 'attribué'),
  ('44444444-4444-4444-8444-444444444442', '11111111-1111-4111-8111-111111111111', 'PGTAP Client', '+221700000002', 'Dakar', 'e-commerce', 250000, 'Mission pgtap 2', 'attribué'),
  ('44444444-4444-4444-8444-444444444443', '11111111-1111-4111-8111-111111111111', 'PGTAP Client', '+221700000003', 'Dakar', 'app web', 400000, 'Mission pgtap 3', 'attribué')
on conflict (id) do nothing;

insert into public.conversations (request_id, developer_id, client_id, status)
values
  ('44444444-4444-4444-8444-444444444441', '33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'awarded'),
  ('44444444-4444-4444-8444-444444444443', '33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'awarded')
on conflict do nothing;

update public.requests set selected_developer_id = '33333333-3333-4333-8333-333333333333'
 where id = '44444444-4444-4444-8444-444444444442';

-- Passage à « terminé » : déclenche la notification client
update public.requests set status = 'terminé' where id in (
  '44444444-4444-4444-8444-444444444441',
  '44444444-4444-4444-8444-444444444442'
);

-- -----------------------------------------------------------------------------
-- 2. Notification « mission terminée → évaluez »
-- -----------------------------------------------------------------------------
select is(
  (select count(*)::int from public.notifications
    where user_id = '11111111-1111-4111-8111-111111111111'
      and type = 'review_requested'
      and entity_id = '44444444-4444-4444-8444-444444444441'),
  1,
  'notification review_requested créée pour le client de la mission terminée'
);

select is(
  (select link from public.notifications where type = 'review_requested' and entity_id = '44444444-4444-4444-8444-444444444441'),
  '/review/44444444-4444-4444-8444-444444444441',
  'la notification pointe vers la page /review/{mission}'
);

select is(
  (select count(*)::int from public.notifications where type = 'review_requested' and entity_id = '44444444-4444-4444-8444-444444444443'),
  0,
  'aucune notification pour une mission non terminée'
);

-- -----------------------------------------------------------------------------
-- 3. Garde-fous de submit_review
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '', false);

select is(
  pg_temp.expect_error($$select public.submit_review('44444444-4444-4444-8444-444444444441', 5, 'x'::text, '{}'::jsonb, '{}'::jsonb, '{}'::text[])$$),
  'TLNAU',
  'anonyme : connexion exigée (TLNAU)'
);

select is(
  pg_temp.expect_error($$with __s as (select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false))
    select public.submit_review('44444444-4444-4444-8444-444444444441', 5, 'x', '{}'::jsonb, '{}'::jsonb, '{}') from __s$$),
  'TLFOR',
  'développeur : seul le client peut déposer (TLFOR)'
);

select is(
  pg_temp.expect_error($$with __s as (select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111112',false))
    select public.submit_review('44444444-4444-4444-8444-444444444441', 5, 'x', '{}'::jsonb, '{}'::jsonb, '{}') from __s$$),
  'TLFOR',
  'autre client : avis refusé (TLFOR)'
);

select is(
  pg_temp.expect_error($$with __s as (select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false))
    select public.submit_review('44444444-4444-4444-8444-444444444443', 5, 'x', '{}'::jsonb, '{}'::jsonb, '{}') from __s$$),
  'TLTMP',
  'mission non terminée : avis refusé (TLTMP)'
);

select is(
  pg_temp.expect_error($$with __s as (select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false))
    select public.submit_review('44444444-4444-4444-8444-444444444441', 0, 'x', '{}'::jsonb, '{}'::jsonb, '{}') from __s$$),
  'TLBAD',
  'note 0 refusée (TLBAD)'
);

select is(
  pg_temp.expect_error($$with __s as (select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false))
    select public.submit_review('44444444-4444-4444-8444-444444444441', 6, 'x', '{}'::jsonb, '{}'::jsonb, '{}') from __s$$),
  'TLBAD',
  'note 6 refusée (TLBAD)'
);

select is(
  pg_temp.expect_error($$with __s as (select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false))
    select public.submit_review('44444444-4444-4444-8444-444444444441', 5, 'x', '{"bogus":5}'::jsonb, '{}'::jsonb, '{}') from __s$$),
  'TLBAD',
  'critère inconnu refusé (TLBAD)'
);

select is(
  pg_temp.expect_error($$with __s as (select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false))
    select public.submit_review('44444444-4444-4444-8444-444444444441', 5, 'x', '{"qualite":9}'::jsonb, '{}'::jsonb, '{}') from __s$$),
  'TLBAD',
  'note de critère > 5 refusée (TLBAD)'
);

select is(
  pg_temp.expect_error($$with __s as (select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false))
    select public.submit_review('44444444-4444-4444-8444-444444444441', 5, 'x', '{}'::jsonb, '{"conforme":"peut-etre"}'::jsonb, '{}') from __s$$),
  'TLBAD',
  'réponse de question invalide refusée (TLBAD)'
);

select is(
  pg_temp.expect_error($$with __s as (select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false))
    select public.submit_review('44444444-4444-4444-8444-444444444441', 5, 'x', '{}'::jsonb, '{}'::jsonb, '{"https://a.test/1.png","https://a.test/2.png","https://a.test/3.png","https://a.test/4.png"}') from __s$$),
  'TLBAD',
  'plus de 3 médias refusés (TLBAD)'
);

select is(
  pg_temp.expect_error($$with __s as (select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false))
    select public.submit_review('44444444-4444-4444-8444-444444444441', 5, 'x', '{}'::jsonb, '{}'::jsonb, '{"faux://x"}') from __s$$),
  'TLBAD',
  'média non http(s) refusé (TLBAD)'
);

-- -----------------------------------------------------------------------------
-- 4. Publication d'un avis complet
-- -----------------------------------------------------------------------------
select is(
  pg_temp.expect_ok($$with __s as (select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false))
    select public.submit_review(
      '44444444-4444-4444-8444-444444444441',
      4,
      'Excellent travail, je recommande.',
      '{"qualite":5,"delais":4,"communication":4,"comprehension":5,"interface":4,"fonctionnalites":4,"qualite_prix":4,"professionnalisme":5}'::jsonb,
      '{"conforme":"oui","reactivite":"partiellement","recommandation":"oui","retenir":"oui"}'::jsonb,
      '{"https://cdn.test/cap1.png","https://cdn.test/cap2.png"}'::text[]
    ) from __s$$),
  'NO_ERROR',
  'publication d''un avis complet acceptée'
);

select is(
  (select developer_id from public.reviews where request_id = '44444444-4444-4444-8444-444444444441'),
  '33333333-3333-4333-8333-333333333333'::uuid,
  'développeur déduit de la conversation attribuée'
);

select is(
  (select client_id from public.reviews where request_id = '44444444-4444-4444-8444-444444444441'),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'client_id rattaché à l''auteur de l''avis'
);

select is(
  (select rating from public.reviews where request_id = '44444444-4444-4444-8444-444444444441'),
  4,
  'note globale enregistrée'
);

select is(
  (select comment from public.reviews where request_id = '44444444-4444-4444-8444-444444444441'),
  'Excellent travail, je recommande.',
  'commentaire conservé'
);

select is(
  (select criteria ->> 'qualite' from public.reviews where request_id = '44444444-4444-4444-8444-444444444441'),
  '5',
  'critères enregistrés'
);

select is(
  (select questions ->> 'reactivite' from public.reviews where request_id = '44444444-4444-4444-8444-444444444441'),
  'partiellement',
  'questions enregistrées'
);

select is(
  (select array_length(assets, 1) from public.reviews where request_id = '44444444-4444-4444-8444-444444444441'),
  2,
  'médias enregistrés'
);

select is(
  (select reviews_count from public.developers where id = '33333333-3333-4333-8333-333333333333'),
  1,
  'refresh_developer_reputation : compteur d''avis mis à jour'
);

select is(
  (select rating_avg from public.developers where id = '33333333-3333-4333-8333-333333333333'),
  4::numeric,
  'refresh_developer_reputation : note moyenne recalculée'
);

-- Avis sur R2 : développeur déduit de selected_developer_id
select is(
  pg_temp.expect_ok($$with __s as (select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false))
    select public.submit_review('44444444-4444-4444-8444-444444444442', 2, 'Correct.', '{"qualite":2}'::jsonb, '{"conforme":"partiellement"}'::jsonb, '{}') from __s$$),
  'NO_ERROR',
  'avis déposé quand le développeur vient de selected_developer_id'
);

select is(
  (select developer_id from public.reviews where request_id = '44444444-4444-4444-8444-444444444442'),
  '33333333-3333-4333-8333-333333333333'::uuid,
  'selected_developer_id utilisé pour l''avis'
);

-- -----------------------------------------------------------------------------
-- 5. Unicité : un seul avis par mission, mise à jour par upsert
-- -----------------------------------------------------------------------------
select is(
  (with __s as (select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false))
   select (public.submit_review('44444444-4444-4444-8444-444444444441', 1, 'Finalement non.', '{"qualite":1}'::jsonb, '{"conforme":"non"}'::jsonb, '{}')::jsonb ->> 'review_id')
   from __s),
  (select id::text from public.reviews where request_id = '44444444-4444-4444-8444-444444444441'),
  'réécrire l''avis renvoie le même review_id (upsert)'
);

select is(
  (select count(*)::int from public.reviews where request_id = '44444444-4444-4444-8444-444444444441'),
  1,
  'toujours un seul avis par mission'
);

select is(
  (select rating from public.reviews where request_id = '44444444-4444-4444-8444-444444444441'),
  1,
  'note mise à jour lors de la réécriture'
);

-- -----------------------------------------------------------------------------
-- 6. Lectures : client, développeur, public
-- -----------------------------------------------------------------------------
select is(
  (with __s as (select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false))
   select (public.get_review_for_request('44444444-4444-4444-8444-444444444441')::jsonb -> 'review' ->> 'rating') from __s),
  '1',
  'get_review_for_request renvoie l''avis au client propriétaire'
);

select is(
  pg_temp.expect_error($$with __s as (select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111112',false))
    select public.get_review_for_request('44444444-4444-4444-8444-444444444441') from __s$$),
  'TLFOR',
  'get_review_for_request : accès refusé à un autre client (TLFOR)'
);

select is(
  (with __s as (select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false))
   select jsonb_array_length(public.get_my_request_reviews()) from __s),
  2,
  'get_my_request_reviews liste les avis du client'
);

select ok(
  (with __s as (select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false))
   select public.get_my_request_reviews()::jsonb @>
     '[{"request_id":"44444444-4444-4444-8444-444444444441"},{"request_id":"44444444-4444-4444-8444-444444444442"}]'::jsonb
   from __s),
  'get_my_request_reviews contient les deux missions évaluées'
);

select is(
  (with __s as (select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false))
   select (public.list_my_developer_reviews()::jsonb ->> 'total')::int from __s),
  2,
  'list_my_developer_reviews renvoie tous les avis du développeur'
);

select is(
  (public.get_developer_reviews('33333333-3333-4333-8333-333333333333')::jsonb ->> 'total')::int,
  2,
  'get_developer_reviews : total public correct'
);

select is(
  (public.get_developer_reviews('33333333-3333-4333-8333-333333333333')::jsonb ->> 'average')::numeric,
  1.5::numeric,
  'get_developer_reviews : moyenne publique correcte'
);

select is(
  (public.get_developer_reviews('33333333-3333-4333-8333-333333333333')::jsonb ->> 'satisfaction')::int,
  0,
  'get_developer_reviews : taux de satisfaction recalculé'
);

select ok(
  (public.get_developer_reviews('33333333-3333-4333-8333-333333333333')::jsonb -> 'average_criteria' ? 'qualite'),
  'get_developer_reviews : moyennes par critère exposées'
);

-- -----------------------------------------------------------------------------
-- 7. Réponse publique du développeur
-- -----------------------------------------------------------------------------
select is(
  pg_temp.expect_error($$with __s as (select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false))
    select public.respond_to_review((select id from public.reviews where request_id = '44444444-4444-4444-8444-444444444441'), 'x') from __s$$),
  'TLFOR',
  'le client ne peut pas répondre à l''avis (TLFOR)'
);

select is(
  pg_temp.expect_ok($$with __s as (select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false))
    select public.respond_to_review((select id from public.reviews where request_id = '44444444-4444-4444-8444-444444444441'), 'Merci pour votre retour, à bientôt !') from __s$$),
  'NO_ERROR',
  'le développeur peut répondre publiquement'
);

select is(
  (select response from public.reviews where request_id = '44444444-4444-4444-8444-444444444441'),
  'Merci pour votre retour, à bientôt !',
  'réponse enregistrée'
);

select is(
  (select rating from public.reviews where request_id = '44444444-4444-4444-8444-444444444441'),
  1,
  'la réponse ne modifie jamais la note'
);

select is(
  (select count(*)::int from public.notifications
    where user_id = '11111111-1111-4111-8111-111111111111' and type = 'review_responded'),
  1,
  'le client est notifié de la réponse publique'
);

-- -----------------------------------------------------------------------------
-- 8. Signalement d'un avis
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '', false);

select is(
  pg_temp.expect_error($$select public.submit_review_report((select id from public.reviews where request_id = '44444444-4444-4444-8444-444444444441'), 'faux_avis'::text, null::text)$$),
  'TLNAU',
  'anonyme : signalement refusé (TLNAU)'
);

select is(
  pg_temp.expect_ok($$with __s as (select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111112',false))
    select public.submit_review_report((select id from public.reviews where request_id = '44444444-4444-4444-8444-444444444441'), 'faux_avis', 'Mission jamais réalisée.') from __s$$),
  'NO_ERROR',
  'un utilisateur connecté peut signaler un avis'
);

select is(
  (select count(*)::int from public.reports where target_type = 'review' and status = 'open'),
  1,
  'signalement enregistré avec target_type = review'
);

select is(
  pg_temp.expect_ok($$with __s as (select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111112',false))
    select public.submit_review_report((select id from public.reviews where request_id = '44444444-4444-4444-8444-444444444441'), 'hors_sujet', 'Encore une fois.') from __s$$),
  'NO_ERROR',
  'un second signalement du même utilisateur est accepté sans erreur'
);

select is(
  (select count(*)::int from public.reports where target_type = 'review' and status = 'open'),
  1,
  'signalement idempotent : pas de doublon pour le même auteur'
);

-- -----------------------------------------------------------------------------
-- 9. Administration : masquage sans altérer la note
-- -----------------------------------------------------------------------------
select is(
  pg_temp.expect_error($$with __s as (select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false))
    select public.admin_get_reviews(null::text) from __s$$),
  'TLAAC',
  'client non admin : liste des avis refusée (TLAAC)'
);

select is(
  (with __s as (select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false))
   select jsonb_array_length(public.admin_get_reviews(null)) from __s),
  2,
  'admin_get_reviews renvoie tous les avis'
);

select is(
  (with __s as (select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false))
   select jsonb_array_length(public.admin_list_review_reports('open')) from __s),
  1,
  'admin_list_review_reports liste les signalements ouverts'
);

select is(
  pg_temp.expect_ok($$with __s as (select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false))
    select public.admin_set_review_status(
      (select id from public.reviews where request_id = '44444444-4444-4444-8444-444444444441'),
      true,
      'Contenu litigieux'
    ) from __s$$),
  'NO_ERROR',
  'admin_set_review_status masque un avis'
);

select is(
  (select rating from public.reviews where request_id = '44444444-4444-4444-8444-444444444441'),
  1,
  'la note reste inchangée après masquage'
);

select is(
  (public.get_developer_reviews('33333333-3333-4333-8333-333333333333')::jsonb ->> 'total')::int,
  1,
  'un avis masqué est retiré des statistiques publiques'
);

select is(
  (select reviews_count from public.developers where id = '33333333-3333-4333-8333-333333333333'),
  1,
  'la réputation est recalculée sans l''avis masqué'
);

select is(
  (with __s as (select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false))
   select jsonb_array_length(public.admin_get_reviews('hidden')) from __s),
  1,
  'admin_get_reviews(''hidden'') isole les avis masqués'
);

select is(
  pg_temp.expect_ok($$with __s as (select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false))
    select public.admin_set_review_status(
      (select id from public.reviews where request_id = '44444444-4444-4444-8444-444444444441'),
      false,
      null
    ) from __s$$),
  'NO_ERROR',
  'admin_set_review_status restaure un avis'
);

select is(
  (public.get_developer_reviews('33333333-3333-4333-8333-333333333333')::jsonb ->> 'total')::int,
  2,
  'l''avis restauré réapparaît dans les statistiques publiques'
);

-- Verdict machine lisible : l'API Management Supabase ne renvoie que le
-- dernier jeu de résultats non vide, scripts/db-test.mjs s'appuie dessus.
select case when num_failed() = 0 then 'PASS' else 'FAIL ' || num_failed()::text end as db_test_verdict;

select * from finish();
rollback;
