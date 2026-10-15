-- 0052 : normalize_phone multi-pays (fin de la troncature à 9 chiffres).
--
-- Problème : 0024 normalisait via right(chiffres, 9). Correct pour le
-- Sénégal (numéro national à 9 chiffres, le 221 part), mais faux pour les
-- 8 autres pays : deux numéros ivoiriens distincts (+225, national à 10
-- chiffres) pouvaient réduire à la même clé et l'un était rejeté à tort
-- (« numéro déjà associé »).
--
-- Correctif : on conserve les chiffres internationaux complets (E.164 sans
-- « + », préfixe « 00 » retiré). La clé est donc plus spécifique : elle ne
-- peut plus créer de collision entre pays. La recréation de l'index unique
-- est sans risque — voir la note en fin de fichier.

create or replace function public.normalize_phone(p_phone text)
returns text
language sql
immutable
parallel safe
as $$
  select case
    when p_phone is null or btrim(p_phone) = '' then null
    -- « 00221… » et « +221… » convergent ; « + » et séparateurs sont retirés
    -- par le filtre à la fin.
    else regexp_replace(regexp_replace(btrim(p_phone), '^00', ''), '\D', '', 'g')
  end
$$;

-- ------------------------------------------------------------
-- Recalcul des colonnes générées : un DROP + ADD force Postgres à
-- réévaluer normalize_phone sur chaque ligne existante.
-- ------------------------------------------------------------

alter table public.developers
  drop column if exists whatsapp_key;

alter table public.developers
  add column whatsapp_key text
  generated always as (public.normalize_phone(whatsapp)) stored;

alter table public.client_profiles
  drop column if exists phone_key;

alter table public.client_profiles
  add column phone_key text
  generated always as (public.normalize_phone(phone)) stored;

-- ------------------------------------------------------------
-- Index uniques recréés sur la nouvelle clé.
--
-- Garantie sans risque de collision : la nouvelle normalisation est STRICTE
--MENT plus fine que l'ancienne (elle garde plus de chiffres). Si deux lignes
--avaient des clés distinctes sous right(…,9), elles le sont a fortiori en
--chiffres complets. Donc la création de l'index ne peut pas échouer.
-- ------------------------------------------------------------

drop index if exists developers_whatsapp_key_idx;
create unique index developers_whatsapp_key_idx
  on public.developers (whatsapp_key)
  where whatsapp_key is not null;

drop index if exists client_profiles_phone_key_idx;
create unique index client_profiles_phone_key_idx
  on public.client_profiles (phone_key)
  where phone_key is not null;

-- is_phone_taken et le trigger check_phone_unique appellent normalize_phone
-- des deux côtés : ils suivent automatiquement la nouvelle définition.
-- Aucune autre fonction à recréer.

notify pgrst, 'reload schema';
