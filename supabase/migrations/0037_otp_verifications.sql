-- ============================================================
-- 0037_otp_verifications.sql
-- M2 — Vérification téléphone/email par OTP (§9).
-- NON destructif. Couvre : code à usage unique, haché (sha256),
-- expiration, tentatives bornées, anti-spam (5/15 min par cible).
-- L'envoi (WhatsApp Twilio/GreenAPI, SMS, email Resend) reste fait
-- côté app, qui ne stocke jamais le code en clair.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Table otp_verifications
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email')),
  target TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'verification',
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS otp_verifications_target_idx
  ON public.otp_verifications (target, created_at DESC);
CREATE INDEX IF NOT EXISTS otp_verifications_user_idx
  ON public.otp_verifications (user_id);

ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

-- Lecture et consommation gérées par les RPC ci-dessous ; on n'expose
-- jamais les codes (hash) au client : pas de policy SELECT publique.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='otp_verifications' AND policyname='otp_own_select') THEN
    CREATE POLICY "otp_own_select"
      ON public.otp_verifications FOR SELECT
      TO authenticated
      USING (
        user_id = auth.uid()
        AND NOT EXISTS (SELECT 1 FROM public.otp_verifications o WHERE o.id = otp_verifications.id AND o.consumed_at IS NOT NULL)
      );
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. Colonne phone_verified (déclarative, sans supposition de
--    broadcast) sur developers et client_profiles si absente.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='developers')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='developers' AND column_name='phone_verified') THEN
    ALTER TABLE public.developers ADD COLUMN phone_verified BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='client_profiles')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='client_profiles' AND column_name='phone_verified') THEN
    ALTER TABLE public.client_profiles ADD COLUMN phone_verified BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3. RPC request_otp : émet un code (ne l'envoie pas).
--    Anti-abuse : 5 demandes max par cible et par fenêtre de 15 min.
--    Code haché avec sha256 (builtin PG15). Le code n'est jamais
--    retourné par l'API : l'app l'envoie via le provider externe.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_otp(
  p_channel TEXT,
  p_target TEXT DEFAULT NULL,
  p_purpose TEXT DEFAULT 'verification',
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := COALESCE(p_user_id, auth.uid());
  v_target TEXT;
  v_code TEXT;
  v_expires TIMESTAMPTZ;
  v_recent INTEGER;
BEGIN
  IF p_channel NOT IN ('whatsapp', 'sms', 'email') THEN
    RAISE EXCEPTION 'Canal invalide.' USING ERRCODE = 'TLOCH';
  END IF;

  -- L'app sert l'OTP en contexte service_role ; l'uid devient explicite.
  v_target := COALESCE(NULLIF(TRIM(p_target), ''), v_user_id::TEXT);
  IF NULLIF(TRIM(p_target), '') IS NULL AND v_user_id IS NULL THEN
    RAISE EXCEPTION 'Cible manquante.' USING ERRCODE = 'TLOTA';
  END IF;

  -- Anti-abus : borné à 5 codes non consommés récents par cible.
  SELECT COUNT(*) INTO v_recent
    FROM public.otp_verifications
   WHERE target = v_target
     AND created_at > NOW() - INTERVAL '15 minutes';

  IF v_recent >= 5 THEN
    RAISE EXCEPTION 'Trop de demandes récentes, réessayez plus tard.' USING ERRCODE = 'TLOTS';
  END IF;

  v_code := LPAD(CAST(FLOOR(RANDOM() * 1000000) AS INT)::TEXT, 6, '0');
  v_expires := NOW() + INTERVAL '10 minutes';

  INSERT INTO public.otp_verifications (user_id, channel, target, purpose, code_hash, expires_at)
  VALUES (
    CASE WHEN v_user_id IS NOT NULL THEN v_user_id END,
    p_channel,
    v_target,
    p_purpose,
    ENCODE(SHA256(v_code::BYTEA), 'hex'),
    v_expires
  );

  -- Le code n'est JAMAIS retourné à un client : seul le service_role
  -- (app serveur, qui envoie via le provider externe) le récupère.
  -- Même garde-fou que credit_from_payment : contexte PostgREST.
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN JSONB_BUILD_OBJECT(
      'ok', TRUE,
      'channel', p_channel,
      'purpose', p_purpose,
      'code', v_code,
      'expires_in_seconds', 600,
      'resend_in_seconds', 30
    );
  END IF;

  RETURN JSONB_BUILD_OBJECT(
    'ok', TRUE,
    'channel', p_channel,
    'purpose', p_purpose,
    'expires_in_seconds', 600,
    'resend_in_seconds', 30
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_otp(
  p_channel TEXT,
  p_target TEXT,
  p_code TEXT,
  p_purpose TEXT DEFAULT 'verification'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_rec public.otp_verifications%ROWTYPE;
BEGIN
  SELECT * INTO v_rec
    FROM public.otp_verifications
   WHERE channel = p_channel
     AND target = p_target
     AND purpose = p_purpose
     AND consumed_at IS NULL
     AND expires_at > NOW()
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF v_rec.id IS NULL THEN
    RETURN JSONB_BUILD_OBJECT('verified', FALSE, 'reason', 'code_expired_or_missing');
  END IF;

  IF v_rec.attempts >= 5 THEN
    UPDATE public.otp_verifications SET consumed_at = NOW() WHERE id = v_rec.id;
    RETURN JSONB_BUILD_OBJECT('verified', FALSE, 'reason', 'too_many_attempts');
  END IF;

  IF ENCODE(SHA256(p_code::BYTEA), 'hex') <> v_rec.code_hash THEN
    UPDATE public.otp_verifications SET attempts = attempts + 1 WHERE id = v_rec.id;
    IF v_rec.attempts + 1 >= 5 THEN
      UPDATE public.otp_verifications SET consumed_at = NOW() WHERE id = v_rec.id;
      RETURN JSONB_BUILD_OBJECT('verified', FALSE, 'reason', 'too_many_attempts');
    END IF;
    RETURN JSONB_BUILD_OBJECT('verified', FALSE, 'reason', 'invalid_code');
  END IF;

  UPDATE public.otp_verifications
     SET consumed_at = NOW()
   WHERE id = v_rec.id;

  -- Verrouillent le téléphone quand la cible correspond au profil :
  -- un seul point de vérité (phone_verified).
  IF p_channel IN ('whatsapp', 'sms') AND v_user_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='developers' AND column_name='phone_verified') THEN
      UPDATE public.developers
         SET phone_verified = TRUE
       WHERE id = v_user_id
         AND NULLIF(whatsapp, '') = NULLIF(p_target, '');
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='client_profiles' AND column_name='phone_verified') THEN
      UPDATE public.client_profiles
         SET phone_verified = TRUE
       WHERE id = v_user_id
         AND NULLIF(phone, '') = NULLIF(p_target, '');
    END IF;
  END IF;

  RETURN JSONB_BUILD_OBJECT('verified', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.request_otp(TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_otp(TEXT, TEXT, TEXT, UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.verify_otp(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_otp(TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMIT;