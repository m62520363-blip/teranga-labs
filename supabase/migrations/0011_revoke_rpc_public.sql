-- ============================================================
-- TERANGA LABS — Migration 0011 : restreindre l'exécution des
-- RPC d'écriture du CRM / de la garantie Token à authenticated.
-- Par défaut Postgres octroie EXECUTE à PUBLIC sur les fonctions ;
-- ces RPC ne doivent être appelables que par un utilisateur connecté.
-- ============================================================

revoke execute on function public.update_unlock_crm(uuid, text, text) from public;
revoke execute on function public.request_token_refund(uuid, text) from public;

grant execute on function public.update_unlock_crm(uuid, text, text) to authenticated;
grant execute on function public.request_token_refund(uuid, text) to authenticated;