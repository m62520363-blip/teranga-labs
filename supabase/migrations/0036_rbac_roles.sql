-- ============================================================
-- 0036_rbac_roles.sql
-- M1 — Périmètre P0 : rôles complets (§33) + garde serveur.
--
-- Ajoute les rôles manquants à user_roles : agency, support.
-- (client, developer, moderator, admin existent déjà.)
-- NON destructif. Préserve toutes les lignes existantes.
-- ============================================================

-- ------------------------------------------------------------
-- 1. user_roles : CHECK complet des 7 rôles (§33).
--    agency et support sont ajoutés ; les valeurs existantes
--    (client, developer, moderator, admin) restent valides.
-- ------------------------------------------------------------
alter table public.user_roles
  drop constraint if exists user_roles_role_check;

alter table public.user_roles
  add constraint user_roles_role_check
  check (role in ('client', 'developer', 'agency', 'moderator', 'support', 'admin'));

-- ------------------------------------------------------------
-- 2. RPC has_role : garde serveur centralisée.
--    Utilisée par les Server Components et les routes API
--    (requireRole côté app) et par les policies RLS.
--    security definer : résout user_roles même si la policy
--    de l'appelant ne le permettrait pas directement.
-- ------------------------------------------------------------
create or replace function public.has_role(p_roles text[])
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    return false;
  end if;
  return exists (
    select 1
      from public.user_roles
     where user_id = v_user_id
       and role = any(p_roles)
  );
end;
$$;

-- Les anonymes ne doivent jamais invoquer has_role : résultat toujours
-- false pour eux, le RPC pendant une session client reste permis.
revoke all on function public.has_role(text[]) from public;
grant execute on function public.has_role(text[]) to authenticated;

-- ------------------------------------------------------------
-- 3. get_my_role : le défaut « developer » ne doit pas écraser
--    un rôle réellement enregistré — aucun changement. On rend
--    simplement explicite que 'client' est un rôle réel garanti
--    par l'unique source user_roles (trigger handle_new_user).
--    (réécriture sans changement sémantique)
-- ------------------------------------------------------------
create or replace function public.get_my_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select role from public.user_roles where user_id = auth.uid()),
    'developer'
  )::text;
$$;