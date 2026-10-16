-- =============================================================================
-- 0047_revoke_privilege_public.sql
--
-- Correction d'un trou de privilèges (§32) : PostgreSQL accorde
-- EXECUTE à PUBLIC sur toute fonction créée. Les migrations 0044 → 0046 ont
-- accordé leurs RPC à `authenticated` (voire `anon`) mais n'ont pas révoqué
-- PUBLIC : sponsorisation, PRO, agences (et surtout `debit_tokens`) restaient
-- donc invocables par n'importe qui via le rôle anon / n'importe quel compte.
--
-- `debit_tokens` ne vérifiant pas `auth.uid() = p_user`, tout utilisateur
-- connecté pouvait débiter le solde d'un AUTRE développeur : corrigé ici.
--
-- IMPORTANT : `REVOKE ... FROM public` ne suffit pas — le rôle `anon`
-- possède un grant EXECUTE explicite qui survit au revoke PUBLIC (constaté
-- en prod). On révoque donc explicitement de `public` ET `anon` pour chaque
-- RPC privée. `authenticated` garde ses grants (les gardes `auth.uid()` /
-- `is_admin()` dans le corps filtrent).
--
-- Les fonctions sont ré-exécutables (REVOKE est idempotent).
-- =============================================================================

-- RPC privées de l'agence : sessions connectées uniquement.
revoke all on function public.create_agency(text, text, text, text, text, text, text) from public, anon;
revoke all on function public.get_agency_by_invite(uuid) from public, anon;
revoke all on function public.join_agency(uuid, uuid) from public, anon;
revoke all on function public.rotate_agency_invite(uuid) from public, anon;
revoke all on function public.remove_agency_member(uuid) from public, anon;
revoke all on function public.leave_agency() from public, anon;
revoke all on function public.set_agency_status(uuid, text) from public, anon;
revoke all on function public.my_agency() from public, anon;
revoke all on function public.agency_role(uuid, uuid) from public, anon;

-- RPC de sponsoring : débitent des Tokens, sessions connectées uniquement.
revoke all on function public.sponsor_dev_profile(integer) from public, anon;
revoke all on function public.sponsor_brief(uuid, uuid, integer) from public, anon;
revoke all on function public.admin_set_sponsoring_prices(integer, integer) from public, anon;

-- RPC PRO : débitent des Tokens, sessions connectées uniquement.
revoke all on function public.subscribe_pro() from public, anon;
revoke all on function public.admin_set_pro_prices(integer, integer) from public, anon;

-- Cœur du problème : le débit lui-même doit rester hors de portée de TOUS les
-- rôles navigateur. Son seul usage légitime est l'invocation interne des RPC
-- sponsor/PRO (security definer, owner postgres) : aucun grant n'est nécessaire.
revoke all on function public.debit_tokens(uuid, integer, text, uuid) from public;
revoke all on function public.debit_tokens(uuid, integer, text, uuid) from anon;
revoke all on function public.debit_tokens(uuid, integer, text, uuid) from authenticated;
