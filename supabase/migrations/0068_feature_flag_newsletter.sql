-- ============================================================
-- 0068 : seed du drapeau "newsletter".
--
-- H1 de la refonte : la RPC is_feature_enabled (0049) existe mais
-- n'était branchée sur aucun parcours réel. La route POST /api/newsletter
-- la consulte désormais (drapeau absent = service inactif, 404).
--
-- Seed enabled = true : la newsletter livrée en section B reste active
-- par défaut ; la console admin peut l'éteindre à chaud via
-- admin_set_feature_flag('newsletter', false) sans redéploiement.
-- ============================================================

insert into public.feature_flags (key, enabled, description)
values (
  'newsletter',
  true,
  'Formulaire d''inscription à la newsletter (footer, B16) — coupe POST /api/newsletter.'
)
on conflict (key) do nothing;
