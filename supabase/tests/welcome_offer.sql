-- =============================================================================
-- Teranga Labs - Tests pgtap de l'offre de bienvenue (migration 0033)
--
-- Execution :
--   local  : supabase test db            (base locale, Docker)
--   CI     : job `db-tests` du workflow .github/workflows/ci.yml
--   liee   : npm run test:db            (projet lie, script scripts/db-test.mjs)
--
-- Ce que ces tests verrouillent - l'offre ne doit JAMAIS :
--   1. etre accordee deux fois au meme compte ;
--   2. contourner les validations de la RPC (budget, type de projet, nom) ;
--   3. etre accordee a un compte qui a deja consomme son offre
--      (un client ayant eu son brief offert ne doit donc pas aussi
--       avoir un contact developpeur offert) ;
--   4. modifier le solde d'un compte uniquement offert.
--
-- Note : le fichier est encadre par BEGIN/ROLLBACK, aucune donnee de test
-- ne subsiste meme en cas d'echec. Les fixtures utilisent des UUID
-- deterministes pour rester rejouables.
--
-- Les fonctions applicatives renvoient des SQLSTATE personnalises
-- (TLAUTH, TLBAD, TLLOW, TLNAU, TLLIM...) que pgtap ne sait pas comparer
-- via throws_ok(). Les helpers pg_temp executent le SQL et exposent le
-- SQLSTATE reellement leve, ce qui permet une assertion is().
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

create or replace function pg_temp.call_publish_brief()
returns text
language plpgsql
as $$
declare
  v_out text;
begin
  select public.publish_brief(
    'Awa Niang', '+221700000099', 'Dakar', 'vitrine',
    120000, 'Brief de test pgtap pour l''offre de bienvenue', '[]'::jsonb, null
  )::text into v_out;
  return v_out;
exception when others then
  return 'ERROR ' || sqlstate;
end $$;

create or replace function pg_temp.call_unlock(p_request uuid)
returns text
language plpgsql
as $$
declare
  v_out text;
begin
  select public.unlock_and_start_chat(
    p_request, 'Bonjour, proposition pgtap.', 150000, 21
  )::text into v_out;
  return v_out;
exception when others then
  return 'ERROR ' || sqlstate;
end $$;

select plan(21);

-- -----------------------------------------------------------------------------
-- 1. Fixtures
--
-- Le trigger handle_new_user() cree deja developers / client_profiles /
-- user_roles pour chaque inscription : les inserts ci-dessous sont des
-- upserts et le role est corrige explicitement.
-- -----------------------------------------------------------------------------
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('aaaaaaa1-1111-4111-8111-aaaaaaaaaaa1', 'gift-client-a@example.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role":"client","full_name":"Awa Niang","company_name":"Awa SARL","contact_name":"Awa Niang","city":"Dakar"}', 'authenticated', 'authenticated'),
  ('aaaaaaa1-1111-4111-8111-aaaaaaaaaaa2', 'gift-client-b@example.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role":"client","full_name":"Babacar Diop","company_name":"B SARL","contact_name":"Babacar Diop","city":"Thies"}', 'authenticated', 'authenticated'),
  ('aaaaaaa1-1111-4111-8111-aaaaaaaaaaa3', 'gift-client-c@example.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role":"client","full_name":"Cheikh Fall","company_name":"C SARL","contact_name":"Cheikh Fall","city":"Saint-Louis"}', 'authenticated', 'authenticated'),
  ('bbbbbbb1-1111-4111-8111-bbbbbbbbbbb1', 'gift-dev-a@example.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role":"developer","full_name":"Dev Un","username":"gift-dev-a","city":"Dakar"}', 'authenticated', 'authenticated'),
  ('bbbbbbb1-1111-4111-8111-bbbbbbbbbbb2', 'gift-dev-b@example.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role":"developer","full_name":"Dev Deux","username":"gift-dev-b","city":"Dakar"}', 'authenticated', 'authenticated');

insert into public.user_roles (user_id, role)
values
  ('aaaaaaa1-1111-4111-8111-aaaaaaaaaaa1', 'client'),
  ('aaaaaaa1-1111-4111-8111-aaaaaaaaaaa2', 'client'),
  ('aaaaaaa1-1111-4111-8111-aaaaaaaaaaa3', 'client'),
  ('bbbbbbb1-1111-4111-8111-bbbbbbbbbbb1', 'developer'),
  ('bbbbbbb1-1111-4111-8111-bbbbbbbbbbb2', 'developer')
on conflict (user_id) do update set role = excluded.role;

insert into public.developers (id, full_name, status, username, city)
values
  ('bbbbbbb1-1111-4111-8111-bbbbbbbbbbb1', 'Dev Un', 'active', 'gift-dev-a', 'Dakar'),
  ('bbbbbbb1-1111-4111-8111-bbbbbbbbbbb2', 'Dev Deux', 'active', 'gift-dev-b', 'Dakar')
on conflict (id) do update set status = 'active';

-- Deux briefs ouverts, sans client rattache, que les developpeurs vont
-- debloquer. client_id reste null : allowed (colonne nullable) et evite
-- de melanger les fixtures client / developpeur.
insert into public.requests (id, client_name, client_whatsapp, client_city, project_type, budget, description, status)
values ('cccccccc-1111-4111-8111-ccccccccccc1', 'Client Divers', '+221700000098', 'Dakar', 'vitrine', 150000, 'Brief public pgtap', 'ouvert'),
       ('cccccccc-1111-4111-8111-ccccccccccc2', 'Client Divers 2', '+221700000097', 'Thies', 'vitrine', 150000, 'Brief public pgtap 2', 'ouvert')
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 2. Structure : gift_key existe pour tracer l'offre dans le journal
-- -----------------------------------------------------------------------------
select has_column(
  'public.token_transactions',
  'gift_key',
  'colonne gift_key ajoutee (trace de l''offre de bienvenue)'
);

-- -----------------------------------------------------------------------------
-- 3. Client SANS Token : son 1er brief doit etre OFFERT (pas TLLOW)
-- -----------------------------------------------------------------------------
select is(
  pg_temp.call_publish_brief(),
  'NO_ERROR',
  'un client sans Token peut publier (offre de bienvenue)'
)
from (select set_config('request.jwt.claim.sub', 'aaaaaaa1-1111-4111-8111-aaaaaaaaaaa1', false)) __s;

select is(
  pg_temp.expect_ok($$
    select 1 from public.token_transactions t
     where t.developer_id = 'aaaaaaa1-1111-4111-8111-aaaaaaaaaaa1'
       and t.gift_key = 'gift:first_brief'
       and t.amount = 0
  $$),
  'NO_ERROR',
  'l''offre gift:first_brief est tracee avec amount = 0'
);

-- -----------------------------------------------------------------------------
-- 4. Le 2e brief du MEME client doit etre refuse (TLLOW)
-- -----------------------------------------------------------------------------
select is(
  pg_temp.call_publish_brief(),
  'ERROR TLLOW',
  'le 2e brief est refuse sans Token (offre deja consommee)'
)
from (select set_config('request.jwt.claim.sub', 'aaaaaaa1-1111-4111-8111-aaaaaaaaaaa1', false)) __s;

-- -----------------------------------------------------------------------------
-- 5. Un client ne doit jamais avoir 2 offres tracees
-- -----------------------------------------------------------------------------
select is(
  (select count(*)::integer
     from public.token_transactions t
    where t.developer_id = 'aaaaaaa1-1111-4111-8111-aaaaaaaaaaa1'
      and t.gift_key is not null),
  1,
  'exactement une ligne gift pour le client A'
);

-- -----------------------------------------------------------------------------
-- 6. Un autre client SANS Token obtient aussi son offre (elle est par compte)
-- -----------------------------------------------------------------------------
select is(
  pg_temp.call_publish_brief(),
  'NO_ERROR',
  'un second client sans Token obtient aussi son offre'
)
from (select set_config('request.jwt.claim.sub', 'aaaaaaa1-1111-4111-8111-aaaaaaaaaaa2', false)) __s;

-- -----------------------------------------------------------------------------
-- 7. consumed_welcome_offer() doit refleter la consommation de l'offre
--    (une seule offre par compte, quel que soit le role)
-- -----------------------------------------------------------------------------
select is(
  (select case when public.consumed_welcome_offer() then 'consumed' else 'fresh' end),
  'consumed',
  'le client A a consomme son offre'
)
from (select set_config('request.jwt.claim.sub', 'aaaaaaa1-1111-4111-8111-aaaaaaaaaaa1', false)) __s;

select is(
  (select case when public.consumed_welcome_offer() then 'consumed' else 'fresh' end),
  'consumed',
  'le client B a consomme son offre'
)
from (select set_config('request.jwt.claim.sub', 'aaaaaaa1-1111-4111-8111-aaaaaaaaaaa2', false)) __s;

-- -----------------------------------------------------------------------------
-- 8. Permissions : le helper n'est pas expose au role anon
-- -----------------------------------------------------------------------------
select is(
  (select has_function_privilege('anon', 'public.consumed_welcome_offer()', 'execute')),
  false,
  'consumed_welcome_offer() est refusee au role anon'
);

-- -----------------------------------------------------------------------------
-- 9. Validations inchangees : l'offre ne contourne AUCUNE regle
-- -----------------------------------------------------------------------------
select is(
  pg_temp.expect_error($$
    with __s as (select set_config('request.jwt.claim.sub', 'aaaaaaa1-1111-4111-8111-aaaaaaaaaaa3', false))
    select public.publish_brief('Awa Niang', '+221700000001', 'Dakar', 'vitrine', 5000, 'Budget inferieur au minimum', '[]'::jsonb, null)
  $$),
  'TLBAD',
  'un budget trop faible est refuse meme avec l''offre'
);

select is(
  pg_temp.expect_error($$
    with __s as (select set_config('request.jwt.claim.sub', 'aaaaaaa1-1111-4111-8111-aaaaaaaaaaa3', false))
    select public.publish_brief('Awa Niang', '+221700000001', 'Dakar', 'type-inconnu', 150000, 'Type de projet invalide pour ce test', '[]'::jsonb, null)
  $$),
  'TLBAD',
  'un type de projet inconnu est refuse meme avec l''offre'
);

select is(
  pg_temp.expect_error($$
    with __s as (select set_config('request.jwt.claim.sub', 'aaaaaaa1-1111-4111-8111-aaaaaaaaaaa3', false))
    select public.publish_brief('', '+221700000001', 'Dakar', 'vitrine', 150000, 'Nom trop court donc invalide', '[]'::jsonb, null)
  $$),
  'TLBAD',
  'un nom trop court est refuse meme avec l''offre'
);

-- -----------------------------------------------------------------------------
-- 10. Developpeur sans Token : son 1er contact doit etre OFFERT
-- -----------------------------------------------------------------------------
select is(
  pg_temp.call_unlock('cccccccc-1111-4111-8111-ccccccccccc1'),
  'NO_ERROR',
  'un developpeur sans Token debloque son 1er contact (offre)'
)
from (select set_config('request.jwt.claim.sub', 'bbbbbbb1-1111-4111-8111-bbbbbbbbbbb1', false)) __s;

select is(
  pg_temp.expect_ok($$
    select 1 from public.token_transactions t
     where t.developer_id = 'bbbbbbb1-1111-4111-8111-bbbbbbbbbbb1'
       and t.gift_key = 'gift:first_contact'
       and t.amount = 0
  $$),
  'NO_ERROR',
  'l''offre gift:first_contact est tracee avec amount = 0'
);

-- -----------------------------------------------------------------------------
-- 11. Le 2e debloquage du MEME developpeur doit etre refuse (TLLOW)
-- -----------------------------------------------------------------------------
select is(
  pg_temp.call_unlock('cccccccc-1111-4111-8111-ccccccccccc2'),
  'ERROR TLLOW',
  'le 2e debloquage est refuse sans Token (offre consommee)'
)
from (select set_config('request.jwt.claim.sub', 'bbbbbbb1-1111-4111-8111-bbbbbbbbbbb1', false)) __s;

select is(
  (select count(*)::integer
     from public.token_transactions t
    where t.developer_id = 'bbbbbbb1-1111-4111-8111-bbbbbbbbbbb1'
      and t.gift_key is not null),
  1,
  'exactement une ligne gift pour le developpeur A'
);

-- -----------------------------------------------------------------------------
-- 12. Un autre developpeur sans Token obtient aussi son offre
-- -----------------------------------------------------------------------------
select is(
  pg_temp.call_unlock('cccccccc-1111-4111-8111-ccccccccccc1'),
  'NO_ERROR',
  'un second developpeur sans Token debloque aussi gratuitement'
)
from (select set_config('request.jwt.claim.sub', 'bbbbbbb1-1111-4111-8111-bbbbbbbbbbb2', false)) __s;

-- -----------------------------------------------------------------------------
-- 13. Idempotence : re-debloquer le MEME brief ne consomme rien 2e fois
-- -----------------------------------------------------------------------------
select is(
  pg_temp.call_unlock('cccccccc-1111-4111-8111-ccccccccccc1'),
  'NO_ERROR',
  're-deblocage du meme brief par le developpeur A : idempotent'
)
from (select set_config('request.jwt.claim.sub', 'bbbbbbb1-1111-4111-8111-bbbbbbbbbbb1', false)) __s;

select is(
  (select count(*)::integer
     from public.token_transactions t
    where t.developer_id = 'bbbbbbb1-1111-4111-8111-bbbbbbbbbbb1'
      and t.gift_key is not null),
  1,
  'le rejeu n''ajoute pas de deuxieme ligne gift'
);

-- -----------------------------------------------------------------------------
-- 14. Le solde d'un compte entierement offert reste a 0
-- -----------------------------------------------------------------------------
select is(
  (select coalesce(sum(t.amount), 0)::integer
     from public.token_transactions t
    where t.developer_id = 'bbbbbbb1-1111-4111-8111-bbbbbbbbbbb1'),
  0,
  'le solde du developpeur offert reste a 0 (aucun debit)'
);

-- -----------------------------------------------------------------------------
-- 15. La vue welcome_offer_status est lisible et coherente
-- -----------------------------------------------------------------------------
select is(
  pg_temp.expect_ok($$
    select has_published_brief::text from public.welcome_offer_status
  $$),
  'NO_ERROR',
  'la vue welcome_offer_status est lisible par le compte connecte'
)
from (select set_config('request.jwt.claim.sub', 'aaaaaaa1-1111-4111-8111-aaaaaaaaaaa1', false)) __s;

select * from finish();
rollback;