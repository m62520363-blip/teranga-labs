-- 0087_developer_specialties.sql
-- Ajout du champ specialties (tableau de spécialités professionnelles).

alter table public.developers
  add column if not exists specialties text[] default '{}';

-- Mettre à jour le type dans la base
comment on column public.developers.specialties is 'Spécialités professionnelles sélectionnées par le développeur.';
