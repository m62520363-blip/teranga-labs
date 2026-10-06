-- ============================================================
-- 0040_favorites.sql
-- P1 — Favoris des briefs (§25). Base réelle : chaque ligne est un
-- marque-page posé par un utilisateur connecté. NON destructif.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Table favorites
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, request_id)
);

CREATE INDEX IF NOT EXISTS favorites_user_idx ON public.favorites (user_id, created_at DESC);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='favorites' AND policyname='favorites_select_own') THEN
    CREATE POLICY "favorites_select_own"
      ON public.favorites FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='favorites' AND policyname='favorites_delete_own') THEN
    CREATE POLICY "favorites_delete_own"
      ON public.favorites FOR DELETE
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. RPC toggle_favorite : bascule atomique (insert retourne
--    favorited=true, delete=false). Contrôle l'existence du brief.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.toggle_favorite(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_exists BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLNAU';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.requests WHERE id = p_request_id
  ) INTO v_exists;

  IF NOT v_exists THEN
    RAISE EXCEPTION 'Brief introuvable.' USING ERRCODE = 'TLNOR';
  END IF;

  IF EXISTS (SELECT 1 FROM public.favorites WHERE user_id = v_user_id AND request_id = p_request_id) THEN
    DELETE FROM public.favorites WHERE user_id = v_user_id AND request_id = p_request_id;
    RETURN JSONB_BUILD_OBJECT('favorited', FALSE, 'request_id', p_request_id);
  END IF;

  INSERT INTO public.favorites (user_id, request_id) VALUES (v_user_id, p_request_id);
  RETURN JSONB_BUILD_OBJECT('favorited', TRUE, 'request_id', p_request_id);
END;
$$;

-- ------------------------------------------------------------
-- 3. RPC is_favorited : lecture légère pour préremplir le cœur.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_favorited(p_request_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.favorites WHERE user_id = auth.uid() AND request_id = p_request_id
  );
$$;

REVOKE ALL ON FUNCTION public.toggle_favorite(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_favorite(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.is_favorited(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_favorited(UUID) TO authenticated;

COMMIT;