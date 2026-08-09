BEGIN;

-- Adds a parallel vector slot for the Gemini Embedding 2 migration. The active
-- Legibility Hub query path continues to use `embedding` until every row has a
-- validated `embedding_v2`, recall@k has been benchmarked, and the search RPC is
-- explicitly promoted in a later migration.

ALTER TABLE public.workspace_semantic_nodes
    ADD COLUMN IF NOT EXISTS embedding_v2 public.vector(768),
    ADD COLUMN IF NOT EXISTS embedding_v2_model text,
    ADD COLUMN IF NOT EXISTS embedding_v2_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS workspace_semantic_nodes_embedding_v2_idx
    ON public.workspace_semantic_nodes USING ivfflat (embedding_v2 vector_cosine_ops)
    WITH (lists = 100);

COMMENT ON COLUMN public.workspace_semantic_nodes.embedding IS
    'Active semantic search vector. Currently Gemini Embedding 001 reduced to 768 dimensions.';

COMMENT ON COLUMN public.workspace_semantic_nodes.embedding_v2 IS
    'Parallel migration vector for Gemini Embedding 2. Do not query until a full backfill and recall benchmark have completed.';

COMMENT ON COLUMN public.workspace_semantic_nodes.embedding_v2_model IS
    'Model ID used to generate embedding_v2, e.g. gemini-embedding-2.';

COMMENT ON COLUMN public.workspace_semantic_nodes.embedding_v2_updated_at IS
    'Timestamp when embedding_v2 was last generated.';

COMMIT;
