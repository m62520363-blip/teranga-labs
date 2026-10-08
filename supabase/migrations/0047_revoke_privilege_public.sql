-- =============================================================================
-- 0047_revoke_privilege_public.sql
--
-- Correction d'un trou de privilèges (§32) : morale PostgreSQL accorde
-- EXECUTE à PUBLIC sur toute fonction créée. Les migrations 0044 → 0046 ont
-- accordé leurs RPC à `authenticated` (voire `anon`) mais n'ont pas révoqué
-- PUBLIC : sponsorisation, PRO, agences (et surtout `debit_tokens`) restaient
-- donc invocables par n'importe qui via le rôle anon / n'importe quel compte.
--
-- `debit_tokens` ne vérifiant pas `auth.uid() = p_user`, tout utilisateur
-- connecté pouvait débiter le solde d'un AUTRE développeur : corrigé ici.
--
-- Les fonctions sont ré-exécutables (REVOKE est idempotent).
-- =============================================================================

-- RPC privées de l'agence : propriétaires et invocation interne seulement.
revoke all on function public.create_agency(text, text, text, text, text, text, text) from public;
revoke all on function public.get_agency_by_invite(uuid) from public;
revoke all on function public.join_agency(uuid, uuid) from public;
revoke all on function public.rotate_agency_invite(uuid) from public;
revoke all on function public.remove_agency_member(uuid) from public;
revoke all on function public.leave_agency() from public;
revoke all on function public.set_agency_status(uuid, text) from public;
revoke all on function public.my_agency() from public;
revoke all on function public.agency_role(uuid, uuid) from public;

-- RPC de sponsoring : débitent des Tokens, sessions connectées uniquement.
revoke all on function public.sponsor_dev_profile(integer) from public;
revoke all on function public.sponsor_brief(uuid, uuid, integer) from public;
revoke all on function public.admin_set_sponsoring_prices(integer, integer) from public;

-- RPC PRO : débitent des Tokens, sessions connectées uniquement.
revoke all on function public.subscribe_pro() from public;
revoke all on function public.admin_set_pro_prices(integer, integer) from public;

-- Cœur du problème : le débit lui-même doit rester hors de portée des rôles
-- navigateur. Son seul usage légitime est l'invocation interne des RPC
-- sponsor/PRO (security definer) : aucun grant ne lui est nécessaire.
revoke all on function public.debit_tokens(uuid, integer, text, uuid) from public;
revoke all on function public.debit_tokens(uuid, integer, text, uuid) from anon;
revoke all on function public.debit_tokens(uuid, integer, text, uuid) from authenticated;