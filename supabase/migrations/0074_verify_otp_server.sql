-- 0074_verify_otp_server.sql
-- RPC dédiée aux appels serveur (service_role) pour la vérification OTP.
-- La version `verify_otp` exige auth.uid() non nul (sécurité pour les
-- utilisateurs connectés). Les routes /api/auth/reset-password et
-- /api/auth/phone-otp/verify utilisent service_role sans session, donc
-- auth.uid() y est nul → verify_otp renvoyait 'not_authenticated'.
-- Cette RPC vérifie par cible (email/téléphone) au lieu de user_id.

CREATE OR REPLACE FUNCTION public.verify_otp_server(
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
  v_rec public.otp_verifications%ROWTYPE;
  v_attempts INTEGER;
BEGIN
  -- Recherche du code OTP actif pour cette cible.
  SELECT * INTO v_rec
    FROM public.otp_verifications
   WHERE channel = p_channel
     AND target = p_target
     AND purpose = p_purpose
     AND consumed_at IS NULL
     AND expires_at > NOW()
   ORDER BY created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN JSONB_BUILD_OBJECT('verified', FALSE, 'reason', 'code_expired_or_missing');
  END IF;

  -- Incrémenter les tentatives.
  v_attempts := COALESCE(v_rec.attempts, 0) + 1;
  UPDATE public.otp_verifications
     SET attempts = v_attempts
   WHERE id = v_rec.id;

  -- Vérification du code (comparaison en temps constant via pgcrypto).
  IF v_rec.code_hash IS NOT NULL THEN
    IF NOT (v_rec.code_hash = crypt(p_code, v_rec.code_hash)) THEN
      IF v_attempts >= 5 THEN
        -- Invalider après 5 tentatives.
        UPDATE public.otp_verifications SET consumed_at = NOW() WHERE id = v_rec.id;
        RETURN JSONB_BUILD_OBJECT('verified', FALSE, 'reason', 'too_many_attempts');
      END IF;
      RETURN JSONB_BUILD_OBJECT('verified', FALSE, 'reason', 'code_mismatch');
    END IF;
  ELSE
    -- Fallback : comparaison directe (anciens enregistrements sans hash).
    IF v_rec.code <> p_code THEN
      IF v_attempts >= 5 THEN
        UPDATE public.otp_verifications SET consumed_at = NOW() WHERE id = v_rec.id;
        RETURN JSONB_BUILD_OBJECT('verified', FALSE, 'reason', 'too_many_attempts');
      END IF;
      RETURN JSONB_BUILD_OBJECT('verified', FALSE, 'reason', 'code_mismatch');
    END IF;
  END IF;

  -- Code valide : marquer comme consommé.
  UPDATE public.otp_verifications
     SET consumed_at = NOW()
   WHERE id = v_rec.id;

  RETURN JSONB_BUILD_OBJECT('verified', TRUE, 'reason', 'ok');
END;
$$;

-- Accorder l'exécution uniquement à service_role.
REVOKE ALL ON FUNCTION public.verify_otp_server(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_otp_server(TEXT, TEXT, TEXT, TEXT) TO service_role;