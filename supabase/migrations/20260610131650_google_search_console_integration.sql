-- Migration: Google Search Console Integration

-- Table: gsc_sync_runs
CREATE TABLE IF NOT EXISTS public.gsc_sync_runs (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    status text NOT NULL CHECK (status IN ('in_progress', 'success', 'failed_403', 'failed_429', 'failed_other')),
    error_details text,
    target_date date NOT NULL,
    rows_synced integer DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

-- Table: gsc_search_analytics_rows
CREATE TABLE IF NOT EXISTS public.gsc_search_analytics_rows (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    site_url text NOT NULL,
    date date NOT NULL,
    page_url text NOT NULL,
    page_slug text NOT NULL,
    query text NOT NULL,
    country text NOT NULL,
    device text NOT NULL,
    search_type text NOT NULL DEFAULT 'web',
    clicks integer NOT NULL DEFAULT 0,
    impressions integer NOT NULL DEFAULT 0,
    ctr numeric NOT NULL DEFAULT 0,
    position numeric NOT NULL DEFAULT 0,
    pulled_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

-- Unique constraint to allow upserts for idempotency
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'gsc_search_analytics_rows_unique_row'
          AND conrelid = 'public.gsc_search_analytics_rows'::regclass
    ) THEN
        ALTER TABLE public.gsc_search_analytics_rows
          ADD CONSTRAINT gsc_search_analytics_rows_unique_row
          UNIQUE (workspace_id, site_url, date, page_url, query, country, device, search_type);
    END IF;
END $$;

-- Table: gsc_page_query_summary
CREATE TABLE IF NOT EXISTS public.gsc_page_query_summary (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    site_url text NOT NULL,
    page_slug text NOT NULL,
    query text NOT NULL,
    min_date date NOT NULL,
    max_date date NOT NULL,
    total_impressions integer NOT NULL DEFAULT 0,
    total_clicks integer NOT NULL DEFAULT 0,
    avg_ctr numeric NOT NULL DEFAULT 0,
    avg_position numeric NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'gsc_page_query_summary_unique'
          AND conrelid = 'public.gsc_page_query_summary'::regclass
    ) THEN
        ALTER TABLE public.gsc_page_query_summary
          ADD CONSTRAINT gsc_page_query_summary_unique
          UNIQUE (workspace_id, site_url, page_slug, query);
    END IF;
END $$;

-- Table: gsc_page_daily_summary
CREATE TABLE IF NOT EXISTS public.gsc_page_daily_summary (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    site_url text NOT NULL,
    page_slug text NOT NULL,
    date date NOT NULL,
    total_impressions integer NOT NULL DEFAULT 0,
    total_clicks integer NOT NULL DEFAULT 0,
    avg_ctr numeric NOT NULL DEFAULT 0,
    avg_position numeric NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'gsc_page_daily_summary_unique'
          AND conrelid = 'public.gsc_page_daily_summary'::regclass
    ) THEN
        ALTER TABLE public.gsc_page_daily_summary
          ADD CONSTRAINT gsc_page_daily_summary_unique
          UNIQUE (workspace_id, site_url, page_slug, date);
    END IF;
END $$;


-- RLS Policies
ALTER TABLE public.gsc_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsc_search_analytics_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsc_page_query_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsc_page_daily_summary ENABLE ROW LEVEL SECURITY;

-- Read policies (Admin/Manager can read their workspace's analytics)
DROP POLICY IF EXISTS "Managers can read gsc_sync_runs" ON public.gsc_sync_runs;
CREATE POLICY "Managers can read gsc_sync_runs" ON public.gsc_sync_runs FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));

DROP POLICY IF EXISTS "Managers can read gsc_search_analytics_rows" ON public.gsc_search_analytics_rows;
CREATE POLICY "Managers can read gsc_search_analytics_rows" ON public.gsc_search_analytics_rows FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));

DROP POLICY IF EXISTS "Managers can read gsc_page_query_summary" ON public.gsc_page_query_summary;
CREATE POLICY "Managers can read gsc_page_query_summary" ON public.gsc_page_query_summary FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));

DROP POLICY IF EXISTS "Managers can read gsc_page_daily_summary" ON public.gsc_page_daily_summary;
CREATE POLICY "Managers can read gsc_page_daily_summary" ON public.gsc_page_daily_summary FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gsc_search_analytics_rows_workspace_date ON public.gsc_search_analytics_rows(workspace_id, date);
CREATE INDEX IF NOT EXISTS idx_gsc_search_analytics_rows_workspace_page_slug ON public.gsc_search_analytics_rows(workspace_id, page_slug);
CREATE INDEX IF NOT EXISTS idx_gsc_search_analytics_rows_workspace_query ON public.gsc_search_analytics_rows(workspace_id, query);
CREATE INDEX IF NOT EXISTS idx_gsc_search_analytics_rows_workspace_impressions ON public.gsc_search_analytics_rows(workspace_id, impressions DESC);
CREATE INDEX IF NOT EXISTS idx_gsc_search_analytics_rows_workspace_position ON public.gsc_search_analytics_rows(workspace_id, position);

CREATE INDEX IF NOT EXISTS idx_gsc_page_query_summary_workspace_page ON public.gsc_page_query_summary(workspace_id, page_slug);
CREATE INDEX IF NOT EXISTS idx_gsc_page_daily_summary_workspace_page ON public.gsc_page_daily_summary(workspace_id, page_slug);
