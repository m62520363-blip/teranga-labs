-- ============================================================
-- 0049_feature_flags_availability.sql
-- P4 — Clôture audit C11/§45 + C2/§12 : feature flags serveur et
-- disponibilités hebdomadaires des développeurs. NON destructif.
--
-- feature_flags : aucun flag n'est pré-inventé (aucune seed) — un
-- flag n'existe que s'il est posé par la console admin. Lecture
-- publique : les clés et l'état on/off ne sont pas des secrets,
-- la valeur par défaut est "désactivé".
--
-- developer_availability : 7 lignes par développeur (lundi 0 …
-- dimanche 6), lecture publique pour l'annuaire, écriture via RPC
-- (propriétaire uniquement).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Table feature_flags
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='feature_flags' AND policyname='feature_flags_select_public') THEN
    CREATE POLICY "feature_flags_select_public"
      ON public.feature_flags FOR SELECT
      USING (TRUE);
  END IF;
END $$;

-- Écriture : console admin (service_role) ou RPC admin_set_feature_flag.

-- ------------------------------------------------------------
-- 2. RPC is_feature_enabled : lecture stable, défaut FALSE si le
--    flag n'existe pas.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_feature_enabled(p_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT ff.enabled FROM public.feature_flags ff WHERE ff.key = p_key),
    FALSE
  );
$$;

REVOKE ALL ON FUNCTION public.is_feature_enabled(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_feature_enabled(TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 3. RPC admin_set_feature_flag : création/bascule (admin only).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_feature_flag(
  p_key TEXT,
  p_enabled BOOLEAN,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT := NULLIF(TRIM(COALESCE(p_key, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès administrateur requis.' USING ERRCODE = 'TLAUT';
  END IF;
  IF v_key IS NULL OR v_key !~ '^[a-z0-9_]{2,64}$' THEN
    RAISE EXCEPTION 'Nom de flag invalide (a-z, 0-9, _).' USING ERRCODE = 'TLBAD';
  END IF;

  INSERT INTO public.feature_flags (key, enabled, description, updated_by, updated_at)
  VALUES (v_key, COALESCE(p_enabled, FALSE), p_description, auth.uid(), NOW())
  ON CONFLICT (key) DO UPDATE
    SET enabled = EXCLUDED.enabled,
        description = COALESCE(EXCLUDED.description, feature_flags.description),
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW();

  RETURN JSONB_BUILD_OBJECT('key', v_key, 'enabled', COALESCE(p_enabled, FALSE));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_feature_flag(TEXT, BOOLEAN, TEXT) FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.admin_set_feature_flag(TEXT, BOOLEAN, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- 4. Table developer_availability
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.developer_availability (
  developer_id UUID NOT NULL REFERENCES public.developers(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  available BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (developer_id, weekday)
);

ALTER TABLE public.developer_availability ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='developer_availability' AND policyname='availability_select_public') THEN
    CREATE POLICY "availability_select_public"
      ON public.developer_availability FOR SELECT
      USING (TRUE);
  END IF;
END $$;

-- Écriture uniquement via set_my_availability (propriétaire).

-- ------------------------------------------------------------
-- 5. RPC set_my_availability : remplace les 7 jours d'un coup.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_my_availability(
  p_available BOOLEAN,
  p_weekdays INT[] DEFAULT '{0,1,2,3,4,5,6}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_days INT[];
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.developers WHERE id = v_user) THEN
    RAISE EXCEPTION 'Profil développeur requis.' USING ERRCODE = 'TLNOD';
  END IF;

  v_days := COALESCE(
    (SELECT ARRAY_AGG(DISTINCT d) FROM UNNEST(COALESCE(p_weekdays, '{}')) AS d WHERE d BETWEEN 0 AND 6),
    '{}'
  );

  DELETE FROM public.developer_availability WHERE developer_id = v_user;

  IF COALESCE(p_available, FALSE) THEN
    INSERT INTO public.developer_availability (developer_id, weekday, available)
    SELECT v_user, d, TRUE FROM UNNEST(v_days) AS d;
  END IF;

  RETURN JSONB_BUILD_OBJECT(
    'available', COALESCE(p_available, FALSE),
    'weekdays', TO_JSONB(v_days)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_availability(BOOLEAN, INT[]) FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.set_my_availability(BOOLEAN, INT[]) TO authenticated;

COMMIT;