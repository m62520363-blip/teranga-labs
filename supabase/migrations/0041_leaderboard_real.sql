-- ============================================================
-- 0041_leaderboard_real.sql
-- P1 â€” Classement RÃ‰EL (remplace le placeholder Â« bientÃ´t Â»).
-- Source de vÃ©ritÃ© : les missions TERMINÃ‰ES (Â§22, missions.status =
-- 'completed' avec completed_at dans le mois). Aucun chiffre inventÃ©.
--
--   * get_leaderboard(annee, mois) :
--       - mois en cours â†’ classement LIVE (recalcul Ã  chaque lecture) ;
--       - mois clos     â†’ dÃ©lÃ¨gue au snapshot idempotent (recalcul +
--                         attribution des Tokens + badges une seule fois).
--   * settle_leaderboard(annee, mois) : dÃ©clenchement manuel (admin ou
--     cron), service_role/admin uniquement.
--
-- RÃ©compenses (config unique en base, = lib/leaderboard-config.ts) :
--   1er rÃ©gional 5 Tokens, 2e 2 ; idem par pays. min 2 missions/mois.
--
-- NON destructif. Idempotent (UNIQUE sur leaderboard_monthly).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Nouveau type 'reward' dans les transactions de tokens
--    ('gift' est dÃ©jÃ  utilisÃ© par 0033 cÃ´tÃ© prod : on le conserve).
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'token_transactions_type_check'
  ) THEN
    ALTER TABLE public.token_transactions
      DROP CONSTRAINT IF EXISTS token_transactions_type_check;
    ALTER TABLE public.token_transactions
      ADD CONSTRAINT token_transactions_type_check
      CHECK (type IN ('purchase', 'unlock', 'bonus', 'publish', 'contact', 'adjust', 'gift', 'reward'));
  ELSE
    ALTER TABLE public.token_transactions
      DROP CONSTRAINT token_transactions_type_check;
    ALTER TABLE public.token_transactions
      ADD CONSTRAINT token_transactions_type_check
      CHECK (type IN ('purchase', 'unlock', 'bonus', 'publish', 'contact', 'adjust', 'gift', 'reward'));
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. CÅ“ur de calcul : standings d'un mois (missions terminÃ©es).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._leaderboard_standings(p_year INT, p_month INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_start TIMESTAMPTZ := date_trunc('month', make_date(p_year, p_month, 1));
  v_end   TIMESTAMPTZ := date_trunc('month', make_date(p_year, p_month, 1) + INTERVAL '1 month');
  v_regional JSONB;
  v_countries JSONB;
BEGIN
  WITH scored AS (
    SELECT
      mm.developer_id,
      mm.cnt,
      COALESCE(NULLIF(trim(d.full_name), ''), d.username, d.id::text) AS full_name,
      d.username,
      d.city,
      d.avatar_url,
      COALESCE(trim(d.country), '') AS country
    FROM (
      SELECT m.developer_id, COUNT(*)::INT AS cnt
        FROM public.missions m
       WHERE m.status = 'completed'
         AND m.completed_at IS NOT NULL
         AND m.completed_at >= v_start
         AND m.completed_at <  v_end
       GROUP BY m.developer_id
    ) mm
    JOIN public.developers d ON d.id = mm.developer_id
    WHERE mm.cnt >= 2 -- leaderboard-config.minProjectsToAppear
  )
  SELECT COALESCE(jsonb_agg(jb ORDER BY (jb->>'rank')::INT ASC), '[]'::jsonb)
  INTO v_regional
  FROM (
    SELECT jsonb_build_object(
      'rank', row_number() OVER (ORDER BY cnt DESC, developer_id ASC),
      'developer_id', developer_id,
      'username', username,
      'full_name', full_name,
      'city', city,
      'country', country,
      'avatar_url', avatar_url,
      'completed_projects', cnt
    ) AS jb
    FROM scored
  ) s;

  SELECT COALESCE(jsonb_agg(grp ORDER BY grp->>'key' ASC), '[]'::jsonb)
  INTO v_countries
  FROM (
    SELECT jsonb_build_object(
      'key', s.country,
      'rows', (
        SELECT COALESCE(jsonb_agg(jb ORDER BY (jb->>'rank')::INT ASC), '[]'::jsonb)
        FROM (
          SELECT jsonb_build_object(
            'rank', row_number() OVER (ORDER BY cnt DESC, developer_id ASC),
            'developer_id', developer_id,
            'username', username,
            'full_name', full_name,
            'city', city,
            'country', country,
            'avatar_url', avatar_url,
            'completed_projects', cnt
          ) AS jb
          FROM scored s2
          WHERE s2.country = s.country
        ) inner_rows
      )
    ) AS jb FROM (
      SELECT DISTINCT country FROM scored WHERE country <> ''
    ) s
  ) grp;

  RETURN jsonb_build_object(
    'regional', v_regional,
    'countries', v_countries
  );
END;
$$;

-- ------------------------------------------------------------
-- 3. Settlement idempotent d'un mois clos :
--      - upsert leaderboard_monthly (+ archive),
--      - crÃ©dit des Tokens (une seule fois, type 'reward'),
--      - badges top 1 et 2 (rÃ©gional + pays).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._leaderboard_settle(p_year INT, p_month INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_standings JSONB;
  v_regional JSONB;
  v_countries JSONB;
  v_row JSONB;
  v_scope_key TEXT;
  v_rows JSONB;
  v_rank INT;
  v_developer UUID;
  v_cnt INT;
  v_tokens INT;
  v_reward_regional_1 INT := 5;
  v_reward_regional_2 INT := 2;
  v_reward_country_1 INT := 5;
  v_reward_country_2 INT := 2;
  v_credited INT := 0;
BEGIN
  v_standings := public._leaderboard_standings(p_year, p_month);
  v_regional := v_standings->'regional';
  v_countries := v_standings->'countries';

  -- RÃ©gional : insertion + crÃ©dit.
  FOR v_row IN SELECT * FROM jsonb_array_elements(v_regional) LOOP
    v_rank := (v_row->>'rank')::INT;
    v_developer := (v_row->>'developer_id')::UUID;
    v_cnt := (v_row->>'completed_projects')::INT;
    v_tokens := CASE v_rank WHEN 1 THEN v_reward_regional_1 WHEN 2 THEN v_reward_regional_2 ELSE 0 END;

    INSERT INTO public.leaderboard_monthly
      (year, month, scope, scope_key, rank, developer_id, completed_projects, tokens_awarded)
    VALUES
      (p_year, p_month, 'regional', 'aof', v_rank, v_developer, v_cnt, v_tokens)
    ON CONFLICT (year, month, scope, scope_key, developer_id)
      DO UPDATE SET rank = EXCLUDED.rank,
                    completed_projects = EXCLUDED.completed_projects,
                    snapshot_at = NOW();

    -- CrÃ©dit UNIQUEMENT Ã  la crÃ©ation (tokens_awarded 0 â†’ v_tokens), jamais en rejeu.
    IF v_tokens > 0 AND NOT EXISTS (
      SELECT 1 FROM public.leaderboard_monthly
       WHERE year = p_year AND month = p_month AND scope = 'regional'
         AND scope_key = 'aof' AND developer_id = v_developer AND tokens_awarded > 0
    ) THEN
      INSERT INTO public.token_transactions (developer_id, amount, type)
      VALUES (v_developer, v_tokens, 'reward');
      v_credited := v_credited + v_tokens;
      UPDATE public.leaderboard_monthly
         SET tokens_awarded = v_tokens
       WHERE year = p_year AND month = p_month AND scope = 'regional'
         AND scope_key = 'aof' AND developer_id = v_developer;
    END IF;

    IF v_tokens > 0 THEN
      INSERT INTO public.developer_badges (developer_id, badge_type, year, month, scope, scope_key, awarded_at)
      VALUES (
        v_developer,
        CASE WHEN v_rank = 1 THEN 'top1_regional' ELSE 'top2_regional' END,
        p_year, p_month, 'regional', 'aof', NOW()
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- Pays : mÃªme logique par scope_key.
  FOR v_row IN SELECT * FROM jsonb_array_elements(v_countries) LOOP
    v_scope_key := v_row->>'key';
    v_rows := v_row->'rows';
    FOR v_row IN SELECT * FROM jsonb_array_elements(v_rows) LOOP
      v_rank := (v_row->>'rank')::INT;
      v_developer := (v_row->>'developer_id')::UUID;
      v_cnt := (v_row->>'completed_projects')::INT;
      v_tokens := CASE v_rank WHEN 1 THEN v_reward_country_1 WHEN 2 THEN v_reward_country_2 ELSE 0 END;

      INSERT INTO public.leaderboard_monthly
        (year, month, scope, scope_key, rank, developer_id, completed_projects, tokens_awarded)
      VALUES
        (p_year, p_month, 'country', v_scope_key, v_rank, v_developer, v_cnt, v_tokens)
      ON CONFLICT (year, month, scope, scope_key, developer_id)
        DO UPDATE SET rank = EXCLUDED.rank,
                      completed_projects = EXCLUDED.completed_projects,
                      snapshot_at = NOW();

      IF v_tokens > 0 AND NOT EXISTS (
        SELECT 1 FROM public.leaderboard_monthly
         WHERE year = p_year AND month = p_month AND scope = 'country'
           AND scope_key = v_scope_key AND developer_id = v_developer AND tokens_awarded > 0
      ) THEN
        INSERT INTO public.token_transactions (developer_id, amount, type)
        VALUES (v_developer, v_tokens, 'reward');
        v_credited := v_credited + v_tokens;
        UPDATE public.leaderboard_monthly
           SET tokens_awarded = v_tokens
         WHERE year = p_year AND month = p_month AND scope = 'country'
           AND scope_key = v_scope_key AND developer_id = v_developer;
      END IF;

      IF v_tokens > 0 THEN
        INSERT INTO public.developer_badges (developer_id, badge_type, year, month, scope, scope_key, awarded_at)
        VALUES (
          v_developer,
          CASE WHEN v_rank = 1 THEN 'top1_country' ELSE 'top2_country' END,
          p_year, p_month, 'country', v_scope_key, NOW()
        )
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;

  -- Archive lisible pour le palmarÃ¨s.
  INSERT INTO public.leaderboard_monthly_history
    (year, month, scope, scope_key, rank, developer_id, completed_projects, tokens_awarded, snapshot_at)
  SELECT year, month, scope, scope_key, rank, developer_id, completed_projects, tokens_awarded, snapshot_at
    FROM public.leaderboard_monthly
   WHERE year = p_year AND month = p_month
  ON CONFLICT (year, month, scope, scope_key, rank) DO NOTHING;

  RETURN jsonb_build_object(
    'ok', true,
    'period', jsonb_build_object('year', p_year, 'month', p_month),
    'credited', v_credited
  );
END;
$$;

-- ------------------------------------------------------------
-- 4. get_leaderboard : lecture publique (anon/authenticated).
--    Mois clos â†’ settlement auto (idempotent).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_leaderboard(p_year INT DEFAULT NULL, p_month INT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_year INT := COALESCE(p_year, date_part('year', NOW())::INT);
  v_month INT := COALESCE(p_month, date_part('month', NOW())::INT);
  v_now TIMESTAMPTZ := NOW();
  v_current BOOLEAN;
  v_standings JSONB;
  v_regional JSONB;
  v_countries JSONB;
  v_rank INT;
  v_developer UUID;
  v_tokens INT;
  v_row JSONB;
  v_rows JSONB;
  v_scope_key TEXT;
  v_is_settled BOOLEAN;
BEGIN
  IF v_month < 1 OR v_month > 12 THEN
    RAISE EXCEPTION 'Mois invalide.' USING ERRCODE = 'TLEVL';
  END IF;

  v_current := (v_year = date_part('year', v_now)::INT AND v_month = date_part('month', v_now)::INT);

  IF v_current THEN
    v_standings := public._leaderboard_standings(v_year, v_month);
    v_regional := v_standings->'regional';
    v_countries := v_standings->'countries';
    v_is_settled := false;
  ELSE
    -- Recalcul + attribution (idempotent), puis relecture en base.
    PERFORM public._leaderboard_settle(v_year, v_month);
    v_is_settled := true;

    SELECT jsonb_object_agg(scope_key, rows ORDER BY scope_key)
    INTO v_countries
    FROM (
      SELECT scope_key,
             COALESCE(jsonb_agg(jb ORDER BY rank),
                      '[]'::jsonb) AS rows
      FROM (
        SELECT
          scope_key, rank, developer_id, completed_projects, tokens_awarded,
          jsonb_build_object(
            'rank', rank,
            'developer_id', developer_id,
            'username', d.username,
            'full_name', COALESCE(NULLIF(trim(d.full_name), ''), d.username, developer_id::text),
            'city', d.city,
            'country', COALESCE(trim(d.country), ''),
            'avatar_url', d.avatar_url,
            'completed_projects', completed_projects,
            'tokens_awarded', tokens_awarded
          ) AS jb
        FROM public.leaderboard_monthly lbm
        LEFT JOIN public.developers d ON d.id = lbm.developer_id
        WHERE lbm.year = v_year AND lbm.month = v_month AND lbm.scope = 'country'
      ) t
      GROUP BY scope_key
    ) country_agg;

    SELECT jsonb_agg(jb ORDER BY rank)
    INTO v_regional
    FROM (
      SELECT jsonb_build_object(
        'rank', rank,
        'developer_id', developer_id,
        'username', d.username,
        'full_name', COALESCE(NULLIF(trim(d.full_name), ''), d.username, developer_id::text),
        'city', d.city,
        'country', COALESCE(trim(d.country), ''),
        'avatar_url', d.avatar_url,
        'completed_projects', completed_projects,
        'tokens_awarded', tokens_awarded
      ) AS jb
      FROM public.leaderboard_monthly lbm
      LEFT JOIN public.developers d ON d.id = lbm.developer_id
      WHERE lbm.year = v_year AND lbm.month = v_month AND lbm.scope = 'regional'
    ) regional_rows;
  END IF;

  RETURN jsonb_build_object(
    'period', jsonb_build_object('year', v_year, 'month', v_month),
    'status', CASE WHEN v_is_settled THEN 'settled' ELSE 'live' END,
    'config', jsonb_build_object(
      'enabled', true,
      'min_projects', 2,
      'rewards', jsonb_build_object(
        'regional', jsonb_build_object('1', 5, '2', 2),
        'country', jsonb_build_object('1', 5, '2', 2)
      )
    ),
    'regional', v_regional,
    'countries', v_countries
  );
END;
$$;

-- ------------------------------------------------------------
-- 5. settle_leaderboard : dÃ©clenchement manuel (admin ou service_role).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.settle_leaderboard(p_year INT, p_month INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
     AND NOT public.has_role(ARRAY['admin']) THEN
    RAISE EXCEPTION 'AccÃ¨s interdit.' USING ERRCODE = 'TLAAC';
  END IF;
  IF p_month < 1 OR p_month > 12 THEN
    RAISE EXCEPTION 'Mois invalide.' USING ERRCODE = 'TLEVL';
  END IF;
  RETURN public._leaderboard_settle(p_year, p_month);
END;
$$;

-- ------------------------------------------------------------
-- 6. Grants
-- ------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_leaderboard(INT, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_leaderboard(INT, INT) TO service_role;

REVOKE ALL ON FUNCTION public._leaderboard_standings(INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._leaderboard_settle(INT, INT) FROM PUBLIC;

COMMIT;
