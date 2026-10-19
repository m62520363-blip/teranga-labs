-- ============================================================
-- TERANGA LABS — Migration 0055 : types de transactions Tokens
--
-- Correctif d'une anomalie relevée lors de l'audit : la contrainte
-- CHECK de token_transactions (dernière définition : 0041) n'accepte
-- que 8 types, alors que les RPC de débit insèrent aussi :
--   * 'sponsor'       (sponsoring de profil, 0045)
--   * 'sponsor_brief' (sponsoring de brief,  0045)
--   * 'pro'           (abonnement PRO,       0046)
-- Tout paiement de sponsoring ou d'abonnement PRO échouait donc
-- sur token_transactions_type_check.
--
-- À appliquer via SQL Editor (après 0054).
-- ============================================================

alter table public.token_transactions
  drop constraint if exists token_transactions_type_check;

alter table public.token_transactions
  add constraint token_transactions_type_check
  check (type in (
    'purchase',   -- achat de pack (Pulse Chariow / admin)
    'unlock',     -- déblocage d'un contact
    'bonus',      -- bonus divers
    'publish',    -- publication d'un brief
    'contact',    -- contact direct payant
    'adjust',     -- ajustement administrateur
    'gift',       -- offre de bienvenue / cadeau
    'reward',     -- récompense de classement
    'sponsor',    -- sponsoring de profil
    'sponsor_brief', -- sponsoring de brief
    'pro'         -- abonnement PRO
  ));
