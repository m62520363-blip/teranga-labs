-- ============================================================
-- TERANGA LABS — Synchronisation des briefs de démonstration
-- À coller UNE FOIS dans le SQL Editor (production).
--
-- Reprend les 6 briefs de démonstration du seed
-- (WhatsApp +2217710001xx) pour couvrir les 9 pays du
-- périmètre Afrique de l'Ouest francophone. Idempotent :
-- les UPDATEs ciblent les anciens numéros, les INSERTs
-- vérifient l'absence du numéro avant d'insérer.
-- Les ids existants sont conservés (déblocages déjà
-- effectués par des développeurs de démo restent liés).
-- ============================================================

-- ------------------------------------------------------------
-- 1) Reprendre les 6 briefs existants (un par nouvelle région)
-- ------------------------------------------------------------

update public.requests
   set client_name = 'Resto Les Almadies',
       client_city = 'Dakar',
       project_type = 'vitrine',
       budget = 80000,
       description = 'Restaurant aux Almadies (Sénégal). Nous cherchons un site vitrine élégant : menu du jour, photos du cadre, contacts et localisation. Un accès facile sur mobile est essentiel.',
       demo = true
 where client_whatsapp = '+221771000101';

update public.requests
   set client_name = 'Boutique Casamance',
       client_city = 'Ziguinchor',
       project_type = 'e-commerce',
       budget = 120000,
       description = 'Boutique de pagnes et bazin à Ziguinchor. Nous voulons vendre en ligne : catalogue par catégorie, panier, paiement à la livraison et gestion des commandes WhatsApp.',
       demo = true
 where client_whatsapp = '+221771000102';

update public.requests
   set client_name = 'Ivorian Fashion',
       client_city = 'Abidjan',
       project_type = 'e-commerce',
       budget = 180000,
       description = 'Marque de prêt-à-porter wax et haut de gamme à Abidjan. Boutique en ligne avec collections, tailles, livraison Abidjan et commandes reçues sur WhatsApp.',
       demo = true
 where client_whatsapp = '+221771000103';

update public.requests
   set client_name = 'Ébénisterie Sotuba',
       client_city = 'Bamako',
       project_type = 'landing page',
       budget = 90000,
       description = 'Atelier d''ébénisterie à Bamako. Landing page percutante avec nos réalisations en photos, nos services et un bouton WhatsApp pour recevoir les demandes de devis.',
       demo = true
 where client_whatsapp = '+221771000104';

update public.requests
   set client_name = 'Quincaillerie Ouaga Centre',
       client_city = 'Centre',
       project_type = 'vitrine',
       budget = 70000,
       description = 'Quincaillerie à Ouagadougou. Nous voulons un site vitrine avec notre catalogue de produits, les prix et un formulaire de devis rapide sur WhatsApp.',
       demo = true
 where client_whatsapp = '+221771000105';

update public.requests
   set client_name = 'Restaurant Le Palmier',
       client_city = 'Maritime',
       project_type = 'vitrine',
       budget = 85000,
       description = 'Restaurant de poisson braisé à Lomé. Site vitrine avec menu, photos de la terrasse, horaires et contact WhatsApp pour les réservations.',
       demo = true
 where client_whatsapp = '+221771000106';

-- ------------------------------------------------------------
-- 2) Ajouter les briefs manquants (Niamey, Conakry, Bissau)
-- ------------------------------------------------------------

insert into public.requests (
  client_name, client_whatsapp, client_city, project_type, budget, description, demo
)
select
  'École Les Savanes', '+221771000107', 'Niamey', 'vitrine', 150000,
  'École primaire et collège à Niamey. Site institutionnel présentant nos programmes, l''équipe pédagogique, l''inscription en ligne et les résultats aux examens.',
  true
where not exists (
  select 1 from public.requests where client_whatsapp = '+221771000107'
);

insert into public.requests (
  client_name, client_whatsapp, client_city, project_type, budget, description, demo
)
select
  'Boutique Kaloum Style', '+221771000108', 'Conakry', 'e-commerce', 130000,
  'Boutique de prêt-à-porter à Conakry. Nous voulons présenter nos collections en ligne, accepter les commandes et gérer simplement nos produits et livraisons.',
  true
where not exists (
  select 1 from public.requests where client_whatsapp = '+221771000108'
);

insert into public.requests (
  client_name, client_whatsapp, client_city, project_type, budget, description, demo
)
select
  'Immo Cotonou Prestige', '+221771000109', 'Littoral', 'vitrine', 250000,
  'Agence immobilière à Cotonou. Nous vendons et louons des villas et appartements. Nous voulons un site vitrine premium avec galerie des biens, filtres ville/budget et formulaire de contact.',
  true
where not exists (
  select 1 from public.requests where client_whatsapp = '+221771000109'
);

insert into public.requests (
  client_name, client_whatsapp, client_city, project_type, budget, description, demo
)
select
  'Maison Petcha', '+221771000110', 'Bissau', 'e-commerce', 100000,
  'Boutique de vêtements en petcha (pagne traditionnel) à Bissau. Catalogue en ligne, commandes WhatsApp et livraisons en ville.',
  true
where not exists (
  select 1 from public.requests where client_whatsapp = '+221771000110'
);

-- ------------------------------------------------------------
-- 3) Vérification attendue : 10 briefs démo, 9 pays couverts
--    SELECT client_city, count(*) FROM public.requests
--     WHERE client_whatsapp LIKE '+2217710001%' GROUP BY 1;
-- ------------------------------------------------------------
