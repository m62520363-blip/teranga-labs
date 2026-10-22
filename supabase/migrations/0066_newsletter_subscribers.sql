-- ============================================================
-- 0066_newsletter_subscribers.sql
-- Abonnés à la newsletter (formulaire du footer).
--   - table newsletter_subscribers (email unique, opt-in) ;
--   - RLS : insert public anonyme (rate-limit côté API), select/modify
--     réservés au service_role ; pas de select pour les anon/authed
--     afin de ne pas fuzzer les emails existants ;
--   - RPC newsletter_subscribe : upert idempotent (ON CONFLICT DO
--     UPDATE pour réactiver un désabonnement), retourne le statut.
-- NON destructif, idempotent.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL,
  locale        text NOT NULL DEFAULT 'fr',
  source        text NOT NULL DEFAULT 'footer',
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT newsletter_subscribers_email_key UNIQUE (email),
  CONSTRAINT newsletter_subscribers_email_format_check
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

COMMENT ON TABLE public.newsletter_subscribers IS
  'Abonnés à la newsletter (opt-in depuis le footer). Un seul enregistrement par email.';

-- ------------------------------------------------------------
-- 2. updated_at (trigger commun du projet)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_newsletter_subscribers'
  ) THEN
    CREATE TRIGGER set_updated_at_newsletter_subscribers
      BEFORE UPDATE ON public.newsletter_subscribers
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3. Index
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_subscribed_at
  ON public.newsletter_subscribers (subscribed_at DESC);

-- ------------------------------------------------------------
-- 4. RLS
-- ------------------------------------------------------------
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Insert public (anonyme) : le formulaire est ouvert. La protection
-- anti-abus (rate-limit + validation email) est côté API route.
DROP POLICY IF EXISTS newsletter_subscribers_insert_public ON public.newsletter_subscribers;
CREATE POLICY newsletter_subscribers_insert_public
  ON public.newsletter_subscribers
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Pas de policy SELECT : anon/authed ne peuvent PAS lire la table.
-- Le service_role (service_role) contourne la RLS pour l'admin.
DROP POLICY IF EXISTS newsletter_subscribers_select_service ON public.newsletter_subscribers;
CREATE POLICY newsletter_subscribers_select_service
  ON public.newsletter_subscribers
  FOR SELECT
  TO service_role
  USING (true);

-- Update réservé au service_role (désabonnement / réabonnement).
DROP POLICY IF EXISTS newsletter_subscribers_update_service ON public.newsletter_subscribers;
CREATE POLICY newsletter_subscribers_update_service
  ON public.newsletter_subscribers
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ------------------------------------------------------------
-- 5. RPC newsletter_subscribe (upsert idempotent)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.newsletter_subscribe(
  p_email text,
  p_locale text DEFAULT 'fr',
  p_source text DEFAULT 'footer'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_locale text;
  v_row public.newsletter_subscribers%ROWTYPE;
BEGIN
  v_email := lower(trim(p_email));
  IF v_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'EMAIL_INVALID' USING ERRCODE = 'TLINV';
  END IF;
  v_locale := CASE WHEN p_locale IN ('fr','en') THEN p_locale ELSE 'fr' END;

  INSERT INTO public.newsletter_subscribers (email, locale, source, subscribed_at, unsubscribed_at)
  VALUES (v_email, v_locale, p_source, now(), NULL)
  ON CONFLICT (email) DO UPDATE
    SET locale = EXCLUDED.locale,
        source = EXCLUDED.source,
        subscribed_at = now(),
        unsubscribed_at = NULL,
        updated_at = now()
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'already_subscribed', v_row.subscribed_at IS NOT NULL,
    'subscribed_at', v_row.subscribed_at
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'EMAIL_INVALID' USING ERRCODE = 'TLINV';
  WHEN OTHERS THEN
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.newsletter_subscribe(text, text, text) IS
  'Abonne (ou réactive) un email à la newsletter. Upsert idempotent.';

-- ------------------------------------------------------------
-- 6. RPC admin : lister les abonnés actifs
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_newsletter_subscribers()
RETURNS SETOF public.newsletter_subscribers
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès administrateur requis.' USING ERRCODE = 'TLAUT';
  END IF;
  RETURN QUERY
    SELECT * FROM public.newsletter_subscribers
    WHERE unsubscribed_at IS NULL
    ORDER BY subscribed_at DESC;
END;
$$;

COMMIT;
