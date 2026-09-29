-- ============================================================
-- TERANGA LABS — Migration 0031 : durcissement de la surface
-- d'attaque SQL (RLS + privilèges d'exécution)
--
-- Constats issus de l'audit du catalogue (30 migrations) :
--
--  1. public.token_refund_requests n'avait AUCUNE RLS alors que la
--     plateforme accorde select/insert/update/delete à anon et
--     authenticated sur toutes les tables : n'importe quel visiteur
--     pouvait lire, insérer et modifier des demandes de remboursement.
--     Table vide et non référencée par le code → on la verrouille
--     (RLS + révocation). Une suppression reste possible plus tard.
--
--  2. public.notify_user() (SECURITY DEFINER, sans contrôle d'identité)
--     était exécutable par un visiteur : celui-ci pouvait injecter des
--     notifications arbitraires dans la boîte de réception de n'importe
--     quel utilisateur.
--
--  3. public.list_developers_for_brief() (SECURITY DEFINER) renvoyait les
--     e-mails et numéros WhatsApp de tous les développeurs actifs à un
--     visiteur non connecté.
--
--  4. 60 fonctions exigeant une session (admin_*, get_my_*, mark_*,
--     unlock_request, delete_account…) étaient exécutables par anon. Elles
--     restent protégées en interne (is_admin(), auth.uid()), mais chaque
--     surface inutile est une surface d'attaque.
--
--  5. Les fonctions utilitaires de trigger (notify_inapp_event,
--     enqueue_notification_jobs, tgf_*, handle_new_user,
--     developers_protect_managed_cols, check_phone_unique) ne doivent jamais
--     être appelées directement.
--
-- POINT CRITIQUE : en PostgreSQL, une fonction reçoit EXECUTE pour PUBLIC par
-- défaut. `revoke ... from anon` seul ne suffit donc pas — un visiteur reste
-- exécutable via PUBLIC. Chaque révocation ci-dessous porte sur PUBLIC, et
-- service_role est ré-accordé explicitement pour ne rien casser côté Edge
-- Functions (0030 et 0013 avaient déjà ce réflexe, 0011/0012/0014 non).
--
-- Surface publique maintenue (autorisée pour un visiteur non connecté) :
--   create_brief, get_brief_management, update_brief_status,
--   submit_contact_message, submit_report, submit_verification_request,
--   get_public_developer_profile, list_approved_developers,
--   get_directory_filters, get_developer_reviews, get_peer_display_name,
--   is_username_taken, is_phone_taken, normalize_phone, mask_email,
--   mask_phone, get_verification_price, get_contact_cost
--
-- Ce périmètre est figé par supabase/tests/permissions.sql : toute nouvelle
-- fonction publique doit être revue puis ajoutée à la liste.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Table token_refund_requests : RLS + révocation complète
-- ------------------------------------------------------------
revoke all on table public.token_refund_requests from anon, authenticated;

alter table public.token_refund_requests enable row level security;

comment on table public.token_refund_requests is
  'Demandes de remboursement de jetons. Aucun accès direct client : toute '
  'lecture/écriture doit passer par une fonction SECURITY DEFINER. RLS '
  'activée par défaut (fail-closed) — voir migration 0031.';

-- ------------------------------------------------------------
-- 2. Fonctions internes : plus d'exécution directe par un client
-- ------------------------------------------------------------
revoke execute on function public.notify_user(uuid, text, text, text, text, text, uuid) from anon, authenticated, public;
grant execute on function public.notify_user(uuid, text, text, text, text, text, uuid) to service_role;

revoke execute on function public.list_developers_for_brief(text, text[]) from anon, authenticated, public;
grant execute on function public.list_developers_for_brief(text, text[]) to service_role;

revoke execute on function public.refresh_developer_reputation(uuid) from anon, authenticated, public;
grant execute on function public.refresh_developer_reputation(uuid) to service_role;

-- Fonctions de trigger : appelables uniquement par PostgreSQL.
revoke execute on function public.notify_inapp_event() from anon, authenticated, public;
revoke execute on function public.enqueue_notification_jobs() from anon, authenticated, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.developers_protect_managed_cols() from anon, authenticated, public;
revoke execute on function public.check_phone_unique() from anon, authenticated, public;
revoke execute on function public.tgf_review_request_done() from anon, authenticated, public;
revoke execute on function public.tgf_reputation_on_reviews() from anon, authenticated, public;
revoke execute on function public.tgf_reputation_on_unlocks() from anon, authenticated, public;

-- ------------------------------------------------------------
-- 3. Fonctions exigeant une session : refusées aux visiteurs
--    (les contrôles internes restent en place, en profondeur)
-- ------------------------------------------------------------
do $$
declare
  v_fn text;
  v_session_only text[] := array[
    -- administration
    'admin_adjust_tokens(uuid, integer, text)',
    'admin_alerts()',
    'admin_cancel_order(uuid)',
    'admin_confirm_order(uuid)',
    'admin_confirm_verification_payment(uuid)',
    'admin_get_developer_application(uuid)',
    'admin_list_admin_actions(integer)',
    'admin_list_balances(text, integer)',
    'admin_list_contact_messages(text)',
    'admin_list_contacts(integer)',
    'admin_list_developer_applications()',
    'admin_list_developer_missions(text, integer)',
    'admin_list_developers()',
    'admin_list_orders(text)',
    'admin_list_packages()',
    'admin_list_reports(text)',
    'admin_list_requests()',
    'admin_list_transactions(integer)',
    'admin_list_verifications()',
    'admin_resolve_report(uuid, text, text, integer, boolean)',
    'admin_review_developer(uuid, text, text)',
    'admin_review_developer_mission(uuid, text, text)',
    'admin_review_verification(uuid, boolean, text)',
    'admin_set_budget_verified(uuid, boolean)',
    'admin_set_contact_cost(integer)',
    'admin_set_developer_mission_hidden(uuid, boolean)',
    'admin_set_verification_price(integer)',
    'admin_update_contact_message(uuid, text)',
    'admin_update_package(text, text, integer, integer, boolean)',
    'admin_update_report(uuid, text)',
    'admin_update_request(uuid, text, boolean)',
    'get_admin_dashboard_stats(text)',
    'get_admin_stats()',
    -- espace personnel
    'client_archive_conversation(uuid)',
    'contact_developer(uuid, text)',
    'create_token_order(text)',
    'credit_tokens(uuid, integer, integer)',
    'delete_account(text)',
    'delete_developer_mission(uuid)',
    'get_my_developer_application()',
    'get_my_orders()',
    'get_my_role()',
    'get_my_token_history(integer)',
    'get_my_unlocks()',
    'get_my_verification_status()',
    'get_token_balance()',
    'list_my_missions()',
    'mark_all_notifications_read()',
    'mark_entity_notifications_read(text, uuid)',
    'mark_notifications_read(jsonb)',
    'my_notifications(integer)',
    'notifications_unread_count()',
    'set_developer_mission(jsonb, uuid)',
    'set_developer_status(uuid, text)',
    'set_monthly_goal(integer)',
    'submit_developer_application(jsonb)',
    'unlock_request(uuid)',
    'update_unlock_crm(uuid, text, text, timestamp with time zone)'
  ];
begin
  foreach v_fn in array v_session_only loop
    execute format('revoke execute on function public.%s from anon, public', v_fn);
    execute format('grant execute on function public.%s to service_role', v_fn);
  end loop;
end $$;
