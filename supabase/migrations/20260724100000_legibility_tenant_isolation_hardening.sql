BEGIN;

-- Legibility Hub semantic retrieval is an internal server operation. The
-- calling server action verifies the authenticated active workspace, then uses
-- the service role to invoke this narrowly scoped RPC. Browser roles must never
-- execute this SECURITY DEFINER function directly.
CREATE OR REPLACE FUNCTION public.search_semantic_nodes(
    p_workspace_id uuid,
    p_query_embedding public.vector,
    p_match_threshold double precision,
    p_match_count integer,
    p_entity_types text[] DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    entity_type text,
    entity_id uuid,
    title text,
    content text,
    metadata jsonb,
    similarity double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Forbidden';
    END IF;

    IF p_workspace_id IS NULL THEN
        RAISE EXCEPTION 'Workspace scope is required.';
    END IF;

    IF p_match_count < 1 OR p_match_count > 100 THEN
        RAISE EXCEPTION 'Match count must be between 1 and 100.';
    END IF;

    IF p_match_threshold < -1 OR p_match_threshold > 1 THEN
        RAISE EXCEPTION 'Match threshold must be between -1 and 1.';
    END IF;

    RETURN QUERY
    SELECT
        wsn.id,
        wsn.entity_type,
        wsn.entity_id,
        wsn.title,
        wsn.content,
        wsn.metadata,
        (1 - (wsn.embedding <=> p_query_embedding))::double precision AS similarity
    FROM public.workspace_semantic_nodes AS wsn
    WHERE wsn.workspace_id = p_workspace_id
      AND (p_entity_types IS NULL OR wsn.entity_type = ANY(p_entity_types))
      AND wsn.embedding IS NOT NULL
      AND (1 - (wsn.embedding <=> p_query_embedding)) > p_match_threshold
    ORDER BY wsn.embedding <=> p_query_embedding
    LIMIT p_match_count;
END;
$$;

REVOKE ALL ON FUNCTION public.search_semantic_nodes(uuid, public.vector, double precision, integer, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_semantic_nodes(uuid, public.vector, double precision, integer, text[]) TO service_role;

COMMIT;
