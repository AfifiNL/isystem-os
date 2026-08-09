BEGIN;

LOCK TABLE public.workspace_semantic_nodes IN SHARE ROW EXCLUSIVE MODE;

WITH ranked_nodes AS (
    SELECT
        id,
        row_number() OVER (
            PARTITION BY workspace_id, entity_type, entity_id
            ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
        ) AS duplicate_rank
    FROM public.workspace_semantic_nodes
)
DELETE FROM public.workspace_semantic_nodes AS nodes
USING ranked_nodes
WHERE nodes.id = ranked_nodes.id
  AND ranked_nodes.duplicate_rank > 1;

ALTER TABLE public.workspace_semantic_nodes
    DROP CONSTRAINT IF EXISTS workspace_semantic_nodes_entity_unique;

DROP INDEX IF EXISTS public.workspace_semantic_nodes_entity_unique;

CREATE UNIQUE INDEX workspace_semantic_nodes_entity_unique
    ON public.workspace_semantic_nodes (workspace_id, entity_type, entity_id);

COMMIT;
