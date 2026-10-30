-- ============================================================
-- 0072 — PROGRAMME DE PARRAINAGE DEVELOPPEUR
-- ------------------------------------------------------------
-- Reproduction du mécanisme « Programme de parrainage » observé
-- dans l'espace développeur de référence (copier un lien, suivre
-- le nombre de filleuls et leur conversion).
--
-- AUCUNE table ni fonction existante n'est modifiée : tout est
-- créatif ici. Les compteurs sont CALCULES à la lecture depuis
-- referral_signups, jamais stockés en double, afin qu'une double
-- attribution ou une suppression ne puisse pas désynchroniser un
-- champ.
--
-- La récompense est exprimée en points de parrainage (colonne
-- parrainage_points). Elle est volontairement SÉPARÉE de
-- developers.reputation_score : on ne modifie pas un score qui
-- pilote déjà le classement et la réputation.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Codes de parrainage : un par développeur, généré à la demande
-- ------------------------------------------------------------
create table if not exists public.referral_codes (
  developer_id  uuid primary key references public.developers(id) on delete cascade,
  code          text not null unique
                  check (code ~ '^[A-Z0-9]{6,16}$'),
  created_at    timestamptz not null default now()
);

comment on table public.referral_codes is
  'Code de parrainage personnel de chaque développeur (un seul par compte).';

-- RLS activé + droits révoqués : ces tables ne sont lisibles QUE par
-- les fonctions SECURITY DEFINER ci-dessous. On n'ajoute donc PAS de
-- politique SELECT, qui serait du code mort (un rôle sans privilège ne
-- peut pas atteindre la politique).
alter table public.referral_codes enable row level security;
revoke all on public.referral_codes from anon, authenticated;

-- ------------------------------------------------------------
-- 2. Signatures attribuées à un parrain
-- ------------------------------------------------------------
create table if not exists public.referral_signups (
  id             uuid primary key default gen_random_uuid(),
  code           text not null references public.referral_codes(code) on delete cascade,
  referred_id    uuid references public.developers(id) on delete set null,
  -- "pending"  : inscription attribuée, pas encore de preuve d'activité
  -- "converted": le filleul est devenu un développeur actif
  status         text not null default 'pending'
                   check (status in ('pending', 'converted')),
  created_at     timestamptz not null default now(),
  converted_at   timestamptz
);

create index if not exists referral_signups_code_idx
  on public.referral_signups (code);

-- Un seul compte parrainé peut porter la même signature. Sans cette
-- contrainte, le contrôle « déjà attribué » plus bas ne serait pas
-- sécurisé contre la simultanéité de deux requêtes.
create unique index if not exists referral_signups_referred_uidx
  on public.referral_signups (referred_id);

comment on table public.referral_signups is
  'Signatures attribuées à un code de parrainage.';

-- RLS activé + droits révoqués : lecture exclusivement via les
-- fonctions SECURITY DEFINER (pas de politique SELECT, qui serait
-- du code mort faute de privilège).
alter table public.referral_signups enable row level security;
revoke all on public.referral_signups from anon, authenticated;

-- ------------------------------------------------------------
-- 3. RPC — obtenir ou créer son code + son résumé
-- ------------------------------------------------------------
create or replace function public.get_my_referral_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_code text;
  v_total bigint;
  v_converted bigint;
begin
  if v_uid is null then
    raise exception 'Authentification requise.' using errcode = 'TLAUT';
  end if;

  -- Si le compte n'a pas encore de ligne dans public.developers, on renvoie
  -- un résumé vide plutôt que de provoquer une erreur de clé étrangère.
  if not exists (select 1 from public.developers where id = v_uid) then
    return jsonb_build_object(
      'code',                  null,
      'total_signups',         0,
      'converted',             0,
      'points',                0,
      'points_per_conversion', 50
    );
  end if;

  -- Le code est créé à la première consultation (idempotent).
  -- On utilise gen_random_uuid() (pg_catalog natif) et non gen_random_bytes()
  -- qui dépend du schéma extensions absent de search_path = public.
  insert into public.referral_codes (developer_id, code)
  values (v_uid, upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)))
  on conflict (developer_id) do nothing;

  select rc.code into v_code
  from public.referral_codes rc
  where rc.developer_id = v_uid;

  select count(*), count(*) filter (where rs.status = 'converted')
    into v_total, v_converted
  from public.referral_signups rs
  where rs.code = v_code;

  return jsonb_build_object(
    'code',         v_code,
    'total_signups', v_total,
    'converted',     v_converted,
    -- Récompense : 50 points par filleul converti. Règle unique,
    -- portée ici pour rester modifiable sans migration.
    'points',       v_converted * 50,
    'points_per_conversion', 50
  );
end;
$$;

comment on function public.get_my_referral_summary() is
  'Retourne le code de parrainage du développeur (créé si absent) et ses compteurs réels.';

grant execute on function public.get_my_referral_summary() to authenticated;

-- ------------------------------------------------------------
-- 4. RPC — attribuer une signature à un code
-- ------------------------------------------------------------
create or replace function public.attribute_referral(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_code text;
begin
  if v_uid is null then
    raise exception 'Authentification requise.' using errcode = 'TLAUT';
  end if;

  if not exists (select 1 from public.developers where id = v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'no_developer_profile');
  end if;

  v_code := upper(btrim(coalesce(p_code, '')));
  if v_code = '' then
    raise exception 'Code de parrainage vide.' using errcode = 'TLBAD';
  end if;

  -- Le code doit exister.
  if not exists (select 1 from public.referral_codes where code = v_code) then
    raise exception 'Code de parrainage inconnu.' using errcode = 'TLBAD';
  end if;

  -- On ne peut pas se parrainer soi-même.
  if exists (
    select 1 from public.referral_codes
    where code = v_code and developer_id = v_uid
  ) then
    raise exception 'Impossible de se parrainer soi-même.' using errcode = 'TLBAD';
  end if;

  -- Une seule attribution par compte parrainé (idempotent).
  if exists (
    select 1 from public.referral_signups
    where referred_id = v_uid
  ) then
    return jsonb_build_object('ok', true, 'already_attributed', true);
  end if;

  insert into public.referral_signups (code, referred_id, status)
  values (v_code, v_uid, 'pending')
  on conflict do nothing;

  return jsonb_build_object('ok', true, 'already_attributed', false);
end;
$$;

comment on function public.attribute_referral(text) is
  'Attribue la signature du développeur courant à un code de parrainage. Anti-auto-parrainage et anti-double-attribution.';

grant execute on function public.attribute_referral(text) to authenticated;

-- ------------------------------------------------------------
-- 5. RPC — marquer un filleul comme converti
-- ------------------------------------------------------------
create or replace function public.mark_referral_converted(p_referred uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Réservé au service role (appelé par le flux d'activation),
  -- ou à un administrateur.
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role'
     and not public.is_admin() then
    raise exception 'Accès administrateur requis.' using errcode = 'TLAUT';
  end if;

  update public.referral_signups
     set status = 'converted',
         converted_at = coalesce(converted_at, now())
   where referred_id = p_referred
     and status = 'pending';
end;
$$;

comment on function public.mark_referral_converted(uuid) is
  'Passe une signature parrainée de pending à converted (service role ou admin uniquement).';

grant execute on function public.mark_referral_converted(uuid) to service_role;
