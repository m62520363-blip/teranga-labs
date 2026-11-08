-- 0078_request_otp_server.sql
-- RPC dédiée aux appels serveur (service_role) pour l'émission OTP.
-- La version `request_otp` ne retourne le code que si
-- current_setting('request.jwt.claim.role') = 'service_role', ce qui n'est
-- pas toujours le cas selon le contexte PostgREST. Cette RPC retourne
-- toujours le code (exécutée uniquement par service_role).

CREATE OR REPLACE FUNCTION public.request_otp_server(
  p_channel TEXT,
  p_target TEXT,
  p_purpose TEXT DEFAULT 'verification',
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := p_user_id;
  v_target TEXT;
  v_code TEXT;
  v_expires TIMESTAMPTZ;
  v_recent INTEGER;
BEGIN
  IF p_channel NOT IN ('whatsapp', 'sms', 'email') THEN
    RAISE EXCEPTION 'Canal invalide.' USING ERRCODE = 'TLOCH';
  END IF;

  v_target := COALESCE(NULLIF(TRIM(p_target), ''), v_user_id::TEXT);
  IF NULLIF(TRIM(p_target), '') IS NULL AND v_user_id IS NULL THEN
    RAISE EXCEPTION 'Cible manquante.' USING ERRCODE = 'TLOTA';
  END IF;

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

  -- Toujours retourner le code (cette RPC est réservée à service_role).
  RETURN JSONB_BUILD_OBJECT(
    'ok', TRUE,
    'channel', p_channel,
    'purpose', p_purpose,
    'code', v_code,
    'expires_in_seconds', 600,
    'resend_in_seconds', 30
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_otp_server(TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_otp_server(TEXT, TEXT, TEXT, UUID) TO service_role;