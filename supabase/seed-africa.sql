-- Seed : briefs de démonstration couvrant l'Afrique entière (54 pays).
-- À appliquer via le dashboard Supabase (SQL Editor) ou psql.
-- Les briefs sont marqués demo = true (badge « Exemple », déblocage gratuit).

insert into public.requests
  (client_name, client_whatsapp, client_city, project_type, budget, description, status, hidden, demo, created_at)
values
  ('Boutique Kaloum Style', '+224620000001', 'Conakry', 'e_commerce', 130000, 'Boutique de prêt-à-porter à Conakry. Catalogue en ligne, commandes et livraisons.', 'ouvert', false, true, now() - interval '19 days'),
  ('École Les Savanes', '+22790000001', 'Niamey', 'vitrine', 150000, 'École primaire et collège à Niamey. Site institutionnel, inscription en ligne.', 'ouvert', false, true, now() - interval '19 days'),
  ('Boutique Petcha', '+24590000001', 'Bissau', 'e_commerce', 100000, 'Boutique de vêtements traditionnels à Bissau. Catalogue et commandes WhatsApp.', 'ouvert', false, true, now() - interval '19 days'),
  ('Ébénisterie Sotuba', '+22370000001', 'Bamako', 'landing', 90000, 'Atelier d''ébénisterie à Bamako. Landing page avec réalisations et devis WhatsApp.', 'ouvert', false, true, now() - interval '40 days'),
  ('Quincaillerie Ouaga Centre', '+22670000001', 'Ouagadougou', 'vitrine', 70000, 'Quincaillerie à Ouagadougou. Catalogue produits et formulaire de devis.', 'ouvert', false, true, now() - interval '40 days'),
  ('Ivorian Fashion', '+22507000001', 'Abidjan', 'e_commerce', 180000, 'Marque de prêt-à-porter à Abidjan. Boutique en ligne, tailles, livraison.', 'ouvert', false, true, now() - interval '40 days'),
  ('Resto Les Almadies', '+22177000001', 'Dakar', 'vitrine', 80000, 'Restaurant aux Almadies. Site vitrine, menu, photos, contact mobile.', 'ouvert', false, true, now() - interval '40 days'),
  ('TechHub Nairobi', '+254700000001', 'Nairobi', 'app_web', 350000, 'Startup tech à Nairobi. Plateforme SaaS avec tableau de bord et API.', 'ouvert', false, true, now() - interval '12 days'),
  ('Cairo Design Studio', '+201000000001', 'Le Caire', 'design', 200000, 'Studio design au Caire. Portfolio, services et prise de rendez-vous.', 'ouvert', false, true, now() - interval '8 days'),
  ('Lagos Market Place', '+234800000001', 'Lagos', 'e_commerce', 400000, 'Marketplace e-commerce à Lagos. Vendeurs, paiements et livraisons.', 'ouvert', false, true, now() - interval '5 days'),
  ('Cape Town Digital', '+27820000001', 'Le Cap', 'vitrine', 250000, 'Agence digitale au Cap. Site vitrine, services et blog.', 'ouvert', false, true, now() - interval '3 days'),
  ('Casablanca Web', '+212600000001', 'Casablanca', 'app_web', 300000, 'Application web à Casablanca. Gestion de stock et commandes.', 'ouvert', false, true, now() - interval '2 days'),
  ('Accra Startup', '+233200000001', 'Accra', 'landing', 120000, 'Landing page pour startup à Accra. Conversion et leads.', 'ouvert', false, true, now() - interval '1 day'),
  ('Addis Tech', '+251900000001', 'Addis-Abeba', 'app_web', 280000, 'Plateforme tech à Addis-Abeba. Mobile money et e-commerce.', 'ouvert', false, true, now() - interval '6 hours'),
  ('Tunis Creative', '+21620000001', 'Tunis', 'design', 160000, 'Agence créative à Tunis. Branding et design web.', 'ouvert', false, true, now() - interval '4 hours')
on conflict do nothing;