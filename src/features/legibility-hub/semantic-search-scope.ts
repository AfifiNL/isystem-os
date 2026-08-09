const DEFAULT_MATCH_THRESHOLD = 0.3;
const DEFAULT_MATCH_COUNT = 20;
const MAX_MATCH_COUNT = 100;
const MAX_ENTITY_TYPES = 25;

interface WorkspaceScopedSemanticSearchInput {
    workspaceId: string;
    queryEmbedding: number[];
    threshold?: number;
    limit?: number;
    entityTypes?: string[] | null;
}

export interface WorkspaceScopedSemanticSearchRpcArgs {
    p_workspace_id: string;
    p_query_embedding: number[];
    p_match_threshold: number;
    p_match_count: number;
    p_entity_types: string[] | null;
}

function requireWorkspaceId(value: string) {
    const workspaceId = value.trim();
    if (!workspaceId) {
        throw new Error("Legibility Hub requires an active workspace.");
    }

    return workspaceId;
}

function normalizeThreshold(value: number | undefined) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return DEFAULT_MATCH_THRESHOLD;
    }

    return Math.min(1, Math.max(-1, value));
}

function normalizeLimit(value: number | undefined) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return DEFAULT_MATCH_COUNT;
    }

    return Math.min(MAX_MATCH_COUNT, Math.max(1, Math.trunc(value)));
}

function normalizeEntityTypes(value: string[] | null | undefined) {
    if (!value?.length) {
        return null;
    }

    const normalized = Array.from(new Set(
        value
            .map((entityType) => entityType.trim())
            .filter(Boolean),
    )).slice(0, MAX_ENTITY_TYPES);

    return normalized.length > 0 ? normalized : null;
}

/**
 * Builds the only RPC shape the Legibility Hub is allowed to send.
 *
 * Workspace identity is supplied by the authenticated server context, never by
 * query text or a browser-selectable global-scope flag.
 */
export function buildWorkspaceScopedSemanticSearchRpcArgs(
    input: WorkspaceScopedSemanticSearchInput,
): WorkspaceScopedSemanticSearchRpcArgs {
    return {
        p_workspace_id: requireWorkspaceId(input.workspaceId),
        p_query_embedding: input.queryEmbedding,
        p_match_threshold: normalizeThreshold(input.threshold),
        p_match_count: normalizeLimit(input.limit),
        p_entity_types: normalizeEntityTypes(input.entityTypes),
    };
}
