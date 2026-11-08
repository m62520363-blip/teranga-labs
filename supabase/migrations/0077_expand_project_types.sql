-- 0077_expand_project_types.sql
-- Élargir le check constraint requests_project_type_check pour inclure
-- les nouveaux types de projet (design, marketing, seo, ia, mobile, saas,
-- api, automatisation, autre) en plus des 5 types existants.

alter table public.requests
  drop constraint if exists requests_project_type_check;

alter table public.requests
  add constraint requests_project_type_check
  check (project_type in (
    'vitrine', 'e-commerce', 'landing page', 'app web', 'refonte',
    'design', 'marketing', 'seo', 'ia', 'mobile', 'saas', 'api',
    'automatisation', 'autre'
  ));