BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users' AND column_name='country'
  ) THEN
    ALTER TABLE public.users ADD COLUMN country TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users' AND column_name='region'
  ) THEN
    ALTER TABLE public.users ADD COLUMN region TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='briefs' AND column_name='country'
  ) THEN
    ALTER TABLE public.briefs ADD COLUMN country TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='briefs' AND column_name='region'
  ) THEN
    ALTER TABLE public.briefs ADD COLUMN region TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_country ON public.users(country);
CREATE INDEX IF NOT EXISTS idx_users_region ON public.users(region);
CREATE INDEX IF NOT EXISTS idx_briefs_country ON public.briefs(country);
CREATE INDEX IF NOT EXISTS idx_briefs_region ON public.briefs(region);

CREATE TABLE IF NOT EXISTS public.leaderboard_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  scope TEXT NOT NULL CHECK (scope IN ('regional','country')),
  scope_key TEXT NOT NULL,
  rank INT NOT NULL CHECK (rank >= 1),
  developer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  completed_projects INT NOT NULL DEFAULT 0,
  tokens_awarded INT NOT NULL DEFAULT 0,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (year, month, scope, scope_key, rank),
  UNIQUE (year, month, scope, scope_key, developer_id)
);

CREATE TABLE IF NOT EXISTS public.leaderboard_monthly_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  scope TEXT NOT NULL CHECK (scope IN ('regional','country')),
  scope_key TEXT NOT NULL,
  rank INT NOT NULL CHECK (rank >= 1),
  developer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  completed_projects INT NOT NULL DEFAULT 0,
  tokens_awarded INT NOT NULL DEFAULT 0,
  snapshot_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (year, month, scope, scope_key, rank),
  UNIQUE (year, month, scope, scope_key, developer_id)
);

CREATE TABLE IF NOT EXISTS public.developer_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL CHECK (badge_type IN ('top1_regional','top2_regional','top1_country','top2_country','podium','hall_of_fame')),
  year INT,
  month INT CHECK (month IS NULL OR (month BETWEEN 1 AND 12)),
  scope TEXT CHECK (scope IS NULL OR scope IN ('regional','country')),
  scope_key TEXT,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  awarded_by UUID REFERENCES public.users(id),
  metadata JSONB DEFAULT '{}'::JSONB
);

CREATE TABLE IF NOT EXISTS public.project_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, reviewer_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_project_reviews_updated_at'
  ) THEN
    CREATE TRIGGER update_project_reviews_updated_at
      BEFORE UPDATE ON public.project_reviews
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
EXCEPTION WHEN undefined_function THEN
  NULL;
END $$;

ALTER TABLE public.leaderboard_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_monthly_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developer_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_reviews ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='leaderboard_monthly' AND policyname='Allow read leaderboard_monthly') THEN
    CREATE POLICY "Allow read leaderboard_monthly" ON public.leaderboard_monthly FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='leaderboard_monthly_history' AND policyname='Allow read leaderboard_monthly_history') THEN
    CREATE POLICY "Allow read leaderboard_monthly_history" ON public.leaderboard_monthly_history FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='developer_badges' AND policyname='Allow read developer_badges') THEN
    CREATE POLICY "Allow read developer_badges" ON public.developer_badges FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_reviews' AND policyname='Allow read project_reviews') THEN
    CREATE POLICY "Allow read project_reviews" ON public.project_reviews FOR SELECT USING (true);
  END IF;
END $$;

COMMIT;

