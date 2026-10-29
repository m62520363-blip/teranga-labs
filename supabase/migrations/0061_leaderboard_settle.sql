-- ============================================================
-- 0061_leaderboard_settle.sql
-- Finalisation du classement mensuel : cron + route API +
-- récompenses 10/7/4 déjà en 0056. Configuration + messages.
-- NON destructif, idempotent.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Route API pour le settle (appelée par Vercel Cron)
--    Cette fonction est appelée via l'API route /api/cron/leaderboard-settle
--    qui vérifie le CRON_SECRET avant d'appeler cette fonction.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.leaderboard_settle_month(p_year integer, p_month integer)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settled integer;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès administrateur requis.' USING ERRCODE = 'TLAUT';
  END IF;

  v_start := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'UTC');
  v_end := v_start + interval '1 month';

  PERFORM public._leaderboard_settle(v_start, v_end);

  GET DIAGNOSTICS v_settled = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'year', p_year,
    'month', p_month,
    'settled', v_settled
  );
END;
$$;

REVOKE ALL ON FUNCTION public.leaderboard_settle_month(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leaderboard_settle_month(integer, integer) TO authenticated;

-- ------------------------------------------------------------
-- 2. Configuration du classement (messages FR par défaut)
-- ------------------------------------------------------------
INSERT INTO public.app_settings (key, value) VALUES
  ('leaderboard_rewards', '10'::jsonb),
  ('leaderboard_rewards_silver', '7'::jsonb),
  ('leaderboard_rewards_bronze', '4'::jsonb),
  ('leaderboard_min_missions', '2'::jsonb),
  ('leaderboard_settlement_day', '1'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------
-- 3. S'assurer que les récompenses existent dans app_settings
-- ------------------------------------------------------------
UPDATE public.app_settings
   SET value = '10'::jsonb
 WHERE key = 'leaderboard_reward_gold' OR (key = 'leaderboard_rewards' AND (value #>> '{}')::integer <> 10);

INSERT INTO public.app_settings (key, value)
VALUES ('leaderboard_reward_gold', '10'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value)
VALUES ('leaderboard_reward_silver', '7'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- `value` doit etre qualifie : dans ON CONFLICT ... DO UPDATE, la table
-- virtuelle `excluded` porte les memes colonnes que la cible, donc un nom
-- nu y est ambigu (erreur 42702 "column reference is ambiguous").
INSERT INTO public.app_settings (key, value)
VALUES ('leaderboard_reward_bronze', '4'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
WHERE (app_settings.value #>> '{}')::integer <> 4;

COMMIT;
