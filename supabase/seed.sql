-- ============================================================
-- TERANGA LABS — Seed de démonstration
-- Coordonnées fictives réservées à la démonstration.
-- Périmètre : Afrique de l'Ouest francophone (9 pays).
-- `client_city` doit être une région du référentiel
-- (lib/countries.ts) pour alimenter les pages /pays et les
-- filtres pays/région.
-- Le préfixe WhatsApp +2217710001xx marque les briefs « démo »
-- (migration 0023 : badge « Exemple » + déblocage gratuit).
-- ============================================================

insert into public.requests (
  client_name, client_whatsapp, client_city, project_type, budget, description, demo
) values
(
  'Resto Les Almadies',
  '+221771000101',
  'Dakar',
  'vitrine',
  80000,
  'Restaurant aux Almadies (Sénégal). Nous cherchons un site vitrine élégant : menu du jour, photos du cadre, contacts et localisation. Un accès facile sur mobile est essentiel.',
  true
),
(
  'Boutique Casamance',
  '+221771000102',
  'Ziguinchor',
  'e-commerce',
  120000,
  'Boutique de pagnes et bazin à Ziguinchor. Nous voulons vendre en ligne : catalogue par catégorie, panier, paiement à la livraison et gestion des commandes WhatsApp.',
  true
),
(
  'Ivorian Fashion',
  '+221771000103',
  'Abidjan',
  'e-commerce',
  180000,
  'Marque de prêt-à-porter wax et haut de gamme à Abidjan. Boutique en ligne avec collections, tailles, livraison Abidjan et commandes reçues sur WhatsApp.',
  true
),
(
  'Ébénisterie Sotuba',
  '+221771000104',
  'Bamako',
  'landing page',
  90000,
  'Atelier d''ébénisterie à Bamako. Landing page percutante avec nos réalisations en photos, nos services et un bouton WhatsApp pour recevoir les demandes de devis.',
  true
),
(
  'Quincaillerie Ouaga Centre',
  '+221771000105',
  'Centre',
  'vitrine',
  70000,
  'Quincaillerie à Ouagadougou. Nous voulons un site vitrine avec notre catalogue de produits, les prix et un formulaire de devis rapide sur WhatsApp.',
  true
),
(
  'Restaurant Le Palmier',
  '+221771000106',
  'Maritime',
  'vitrine',
  85000,
  'Restaurant de poisson braisé à Lomé. Site vitrine avec menu, photos de la terrasse, horaires et contact WhatsApp pour les réservations.',
  true
),
(
  'École Les Savanes',
  '+221771000107',
  'Niamey',
  'vitrine',
  150000,
  'École primaire et collège à Niamey. Site institutionnel présentant nos programmes, l''équipe pédagogique, l''inscription en ligne et les résultats aux examens.',
  true
),
(
  'Boutique Kaloum Style',
  '+221771000108',
  'Conakry',
  'e-commerce',
  130000,
  'Boutique de prêt-à-porter à Conakry. Nous voulons présenter nos collections en ligne, accepter les commandes et gérer simplement nos produits et livraisons.',
  true
),
(
  'Immo Cotonou Prestige',
  '+221771000109',
  'Littoral',
  'vitrine',
  250000,
  'Agence immobilière à Cotonou. Nous vendons et louons des villas et appartements. Nous voulons un site vitrine premium avec galerie des biens, filtres ville/budget et formulaire de contact.',
  true
),
(
  'Maison Petcha',
  '+221771000110',
  'Bissau',
  'e-commerce',
  100000,
  'Boutique de vêtements en petcha (pagne traditionnel) à Bissau. Catalogue en ligne, commandes WhatsApp et livraisons en ville.',
  true
);
