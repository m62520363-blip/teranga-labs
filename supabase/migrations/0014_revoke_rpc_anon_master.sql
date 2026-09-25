-- ============================================================
-- TERANGA LABS — Migration 0014 : retirer l'exécution aux rôles
-- non connectés (anon) pour les fonctions de l'architecture
-- maître (créées en 0013). Le PUBLIC a été révoqué en 0013 mais
-- le rôle anon est explicitement octroyé par les privilèges par
-- défaut de la plateforme à la création des fonctions.
-- ============================================================

revoke execute on function public.publish_brief(text, text, text, text, integer, text, jsonb, text) from anon;
revoke execute on function public.unlock_and_start_chat(uuid, text, integer, integer) from anon;
revoke execute on function public.accept_formal_offer(uuid) from anon;

grant execute on function public.publish_brief(text, text, text, text, integer, text, jsonb, text) to authenticated;
grant execute on function public.unlock_and_start_chat(uuid, text, integer, integer) to authenticated;
grant execute on function public.accept_formal_offer(uuid) to authenticated;