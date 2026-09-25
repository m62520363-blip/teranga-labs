-- ============================================================
-- TERANGA LABS — Migration 0012 : retirer l'exécution aux rôles
-- non connectés (anon). Le PUBLIC a été révoqué en 0011 mais
-- le rôle anon est explicitement octroyé par les privilèges par
-- défaut de la plateforme à la création des fonctions.
-- ============================================================

revoke execute on function public.update_unlock_crm(uuid, text, text) from anon;
revoke execute on function public.request_token_refund(uuid, text) from anon;

grant execute on function public.update_unlock_crm(uuid, text, text) to authenticated;
grant execute on function public.request_token_refund(uuid, text) to authenticated;