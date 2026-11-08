-- 0080_leaderboard_settle_server.sql
-- RPC dédiée aux appels serveur (service_role) pour le règlement du classement.
-- Les versions `settle_leaderboard` / `leaderboard_settle_month` vérifient
-- current_setting('request.jwt.claim.role') qui n'est pas toujours 'service_role'
-- selon le contexte PostgREST. Cette RPC appelle directement _leaderboard_settle
-- sans vérification de rôle (la protection est assurée par la route cron,
-- protégée par CRON_SECRET).

CREATE OR REPLACE FUNCTION public.leaderboard_settle_month_server(p_year integer, p_month integer)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF p_month < 1 OR p_month > 12 THEN
    RAISE EXCEPTION 'Mois invalide.' USING ERRCODE = 'TLEVL';
  END IF;

  IF p_year < 2000 OR p_year > 2100 THEN
    RAISE EXCEPTION 'Année invalide.' USING ERRCODE = 'TLEVL';
  END IF;

  v_result := public._leaderboard_settle(p_year, p_month);

  RETURN jsonb_build_object(
    'ok', true,
    'year', p_year,
    'month', p_month,
    'credited', coalesce((v_result->>'credited')::int, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.leaderboard_settle_month_server(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leaderboard_settle_month_server(integer, integer) TO service_role;