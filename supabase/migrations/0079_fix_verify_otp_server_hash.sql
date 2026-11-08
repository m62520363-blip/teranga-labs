-- 0079_fix_verify_otp_server_hash.sql
-- Corrige verify_otp_server : utilise SHA256 (comme request_otp / request_otp_server)
-- au lieu de crypt() qui ne correspondait jamais au hash stocké.

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

  v_attempts := COALESCE(v_rec.attempts, 0) + 1;
  UPDATE public.otp_verifications
     SET attempts = v_attempts
   WHERE id = v_rec.id;

  -- Comparaison SHA256 (même hash que request_otp / request_otp_server).
  IF ENCODE(SHA256(p_code::BYTEA), 'hex') <> v_rec.code_hash THEN
    IF v_attempts >= 5 THEN
      UPDATE public.otp_verifications SET consumed_at = NOW() WHERE id = v_rec.id;
      RETURN JSONB_BUILD_OBJECT('verified', FALSE, 'reason', 'too_many_attempts');
    END IF;
    RETURN JSONB_BUILD_OBJECT('verified', FALSE, 'reason', 'code_mismatch');
  END IF;

  -- Code valide : marquer comme consommé.
  UPDATE public.otp_verifications
     SET consumed_at = NOW()
   WHERE id = v_rec.id;

  RETURN JSONB_BUILD_OBJECT('verified', TRUE, 'reason', 'ok');
END;
$$;

REVOKE ALL ON FUNCTION public.verify_otp_server(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_otp_server(TEXT, TEXT, TEXT, TEXT) TO service_role;