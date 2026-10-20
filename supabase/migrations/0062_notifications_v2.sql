-- ============================================================
-- 0062_notifications_v2.sql
-- Notifications réelles : triggers sur toutes les tables métier
-- pour que chaque événement important notifie l'utilisateur
-- concerné. Remplace le swallow silencieux par un log d'erreur.
-- NON destructif, idempotent.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Remplace notify_user silencieux par version loguée
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_link TEXT DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nid UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link, entity_type, entity_id)
  VALUES (p_user_id, p_type, p_title, p_body, p_link, p_entity_type, p_entity_id)
  RETURNING id INTO v_nid;

  RETURN v_nid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- ------------------------------------------------------------
-- 2. Trigger missions : notifications à chaque changement de statut
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_mission_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    -- Le développeur reçoit une notification pour chaque changement.
    IF NEW.developer_id IS NOT NULL THEN
      PERFORM public.notify_user(
        NEW.developer_id,
        'mission_status_change',
        'Mission : ' || NEW.status,
        'Statut de la mission mis à jour en « ' || NEW.status || ' ».',
        '/missions',
        'mission',
        NEW.id
      );
    END IF;
    -- Le client aussi.
    IF NEW.client_id IS NOT NULL THEN
      PERFORM public.notify_user(
        NEW.client_id,
        'mission_status_change',
        'Mission : ' || NEW.status,
        'Statut de la mission mis à jour en « ' || NEW.status || ' ».',
        '/missions',
        'mission',
        NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_mission_status ON public.missions;
CREATE TRIGGER trg_notify_mission_status
  AFTER UPDATE ON public.missions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_mission_status_change();

-- ------------------------------------------------------------
-- 3. Trigger token_transactions : notification d'achat/solde
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_token_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_user(
    NEW.developer_id,
    'token_' || NEW.type,
    CASE
      WHEN NEW.type = 'purchase' THEN 'Tokens achetés'
      WHEN NEW.type = 'spend' THEN 'Tokens utilisés'
      WHEN NEW.type = 'bonus' THEN 'Bonus reçu'
      ELSE 'Solde tokens mis à jour'
    END,
    'Solde de tokens : ' || (SELECT COALESCE(SUM(amount), 0) FROM public.token_transactions WHERE developer_id = NEW.developer_id) || ' tokens.',
    '/wallet',
    'token_transaction',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_token_transaction ON public.token_transactions;
CREATE TRIGGER trg_notify_token_transaction
  AFTER INSERT ON public.token_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_token_transaction();

-- ------------------------------------------------------------
-- 4. Trigger earnings_ledger : notification fonds disponibles
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_earnings_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.kind = 'available' THEN
    PERFORM public.notify_user(
      NEW.developer_id,
      'earnings_available',
      'Fonds disponibles',
      NEW.amount_fcfa || ' FCFA sont disponibles au retrait.',
      '/wallet',
      'earnings_ledger',
      NEW.id
    );
  ELSIF NEW.kind = 'withdrawal_paid' THEN
    PERFORM public.notify_user(
      NEW.developer_id,
      'withdrawal_paid',
      'Retrait effectué',
      'Un retrait de ' || ABS(NEW.amount_fcfa) || ' FCFA a été versé.',
      '/wallet',
      'withdrawal',
      NEW.withdrawal_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_earnings_ledger ON public.earnings_ledger;
CREATE TRIGGER trg_notify_earnings_ledger
  AFTER INSERT ON public.earnings_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_earnings_ledger();

-- ------------------------------------------------------------
-- 5. Trigger withdrawals : notification changement de statut
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_withdrawal_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_user(
      NEW.developer_id,
      'withdrawal_' || NEW.status,
      'Retrait : ' || NEW.status,
      'Votre retrait de ' || NEW.amount_fcfa || ' FCFA est maintenant « ' || NEW.status || ' ».',
      '/wallet',
      'withdrawal',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_withdrawal_status ON public.withdrawals;
CREATE TRIGGER trg_notify_withdrawal_status
  AFTER UPDATE ON public.withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_withdrawal_status();

-- ------------------------------------------------------------
-- 6. Trigger subscriptions : notification changement d'abonnement
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_subscription_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.ends_at IS DISTINCT FROM OLD.ends_at THEN
    PERFORM public.notify_user(
      NEW.developer_id,
      'subscription_updated',
      'Abonnement mis à jour',
      'Votre abonnement Pro se termine le ' || NEW.ends_at::date || '.',
      '/dashboard/billing',
      'subscription',
      NEW.developer_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_subscription_change ON public.subscriptions;
CREATE TRIGGER trg_notify_subscription_change
  AFTER UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_subscription_change();

-- Insertion (nouvel abonnement).
CREATE OR REPLACE FUNCTION public.notify_subscription_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_user(
    NEW.developer_id,
    'subscription_created',
    'Abonnement Pro activé',
    'Votre abonnement Pro est actif jusqu''au ' || NEW.ends_at::date || '.',
    '/dashboard/billing',
    'subscription',
    NEW.developer_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_subscription_created ON public.subscriptions;
CREATE TRIGGER trg_notify_subscription_created
  AFTER INSERT ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_subscription_created();

-- ------------------------------------------------------------
-- 8. Trigger payment_intents : notification paiement confirmé
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_payment_intent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'paid' THEN
    PERFORM public.notify_user(
      NEW.developer_id,
      'payment_completed',
      'Paiement confirmé',
      'Votre paiement de ' || NEW.amount_fcfa || ' FCFA a été confirmé.',
      '/dashboard/billing',
      'payment_intent',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_payment_intent ON public.payment_intents;
CREATE TRIGGER trg_notify_payment_intent
  AFTER UPDATE ON public.payment_intents
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_payment_intent();

COMMIT;
