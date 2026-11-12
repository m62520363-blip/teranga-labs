-- 0086_leaderboard_include_all_devs.sql
-- Modifie le classement pour inclure tous les développeurs actifs/vérifiés,
-- pas seulement ceux avec 2+ missions terminées.
-- Les développeurs sans missions terminées apparaissent avec 0 projet et 0 points.

-- Note: Cette migration modifie _leaderboard_standings pour inclure
-- tous les développeurs actifs, même sans missions terminées.

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
      d.id AS developer_id,
      COALESCE(mm.cnt, 0) AS cnt,
      COALESCE(NULLIF(trim(d.full_name), ''), d.username, d.id::text) AS full_name,
      d.username,
      d.city,
      d.avatar_url,
      COALESCE(trim(d.country), '') AS country
    FROM public.developers d
    LEFT JOIN (
      SELECT m.developer_id, COUNT(*)::INT AS cnt
        FROM public.missions m
       WHERE m.status = 'completed'
         AND m.completed_at IS NOT NULL
         AND m.completed_at >= v_start
         AND m.completed_at <  v_end
       GROUP BY m.developer_id
    ) mm ON mm.developer_id = d.id
    WHERE d.status IN ('active', 'verified')
      AND d.is_public = true
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
      'completed_projects', cnt,
      'points', (cnt * 50)::INT
    ) AS jb
    FROM scored
  ) s;

  -- Pays : classement par pays (mêmes données, groupées par pays)
  WITH scored AS (
    SELECT
      d.id AS developer_id,
      COALESCE(mm.cnt, 0) AS cnt,
      COALESCE(NULLIF(trim(d.full_name), ''), d.username, d.id::text) AS full_name,
      d.username,
      d.city,
      d.avatar_url,
      COALESCE(trim(d.country), '') AS country
    FROM public.developers d
    LEFT JOIN (
      SELECT m.developer_id, COUNT(*)::INT AS cnt
        FROM public.missions m
       WHERE m.status = 'completed'
         AND m.completed_at IS NOT NULL
         AND m.completed_at >= v_start
         AND m.completed_at <  v_end
       GROUP BY m.developer_id
    ) mm ON mm.developer_id = d.id
    WHERE d.status IN ('active', 'verified')
      AND d.is_public = true
      AND COALESCE(trim(d.country), '') <> ''
  )
  SELECT COALESCE(jsonb_agg(jb), '[]'::jsonb)
  INTO v_countries
  FROM (
    SELECT jsonb_build_object(
      'country', country,
      'rows', (
        SELECT COALESCE(jsonb_agg(jb2 ORDER BY (jb2->>'rank')::INT ASC), '[]'::jsonb)
        FROM (
          SELECT jsonb_build_object(
            'rank', row_number() OVER (ORDER BY cnt DESC, developer_id ASC),
            'developer_id', developer_id,
            'username', username,
            'full_name', full_name,
            'city', city,
            'avatar_url', avatar_url,
            'completed_projects', cnt,
            'points', (cnt * 50)::INT
          ) AS jb2
          FROM scored s2
          WHERE s2.country = scored.country
        ) inner_s
      )
    ) AS jb
    FROM (SELECT DISTINCT country FROM scored) scored
  ) s;

  RETURN jsonb_build_object(
    'regional', COALESCE(v_regional, '[]'::jsonb),
    'countries', COALESCE(v_countries, '[]'::jsonb)
  );
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION public._leaderboard_standings(INT, INT) TO anon, authenticated, service_role;
