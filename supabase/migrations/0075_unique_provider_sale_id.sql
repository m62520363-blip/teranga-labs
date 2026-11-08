-- 0075_unique_provider_sale_id.sql
-- Contrainte d'unicité sur provider_sale_id pour empêcher qu'une même
-- vente finance deux intentions (défense en profondeur, audit H3).
-- S'applique aux tables de paiement qui portent un provider_sale_id.

-- subscription_payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscription_payments_provider_sale_id_unique'
  ) THEN
    ALTER TABLE public.subscription_payments
      ADD CONSTRAINT subscription_payments_provider_sale_id_unique
      UNIQUE (provider_sale_id);
  END IF;
END $$;

-- payment_intents (tokens)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_intents_provider_sale_id_unique'
  ) THEN
    -- Seulement si la colonne existe.
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'payment_intents' AND column_name = 'provider_sale_id'
    ) THEN
      ALTER TABLE public.payment_intents
        ADD CONSTRAINT payment_intents_provider_sale_id_unique
        UNIQUE (provider_sale_id);
    END IF;
  END IF;
END $$;

-- brief_boost_payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'brief_boost_payments_provider_sale_id_unique'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'brief_boost_payments' AND column_name = 'provider_sale_id'
    ) THEN
      ALTER TABLE public.brief_boost_payments
        ADD CONSTRAINT brief_boost_payments_provider_sale_id_unique
        UNIQUE (provider_sale_id);
    END IF;
  END IF;
END $$;