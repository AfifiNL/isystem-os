import type { StructuredHubDateWindow, StructuredHubQueryResult } from "./structured-query-types";

export interface SemanticMetadataFilters {
    clientId?: string;
    projectId?: string;
    entityTypes?: string[];
    dateWindow?: StructuredHubDateWindow;
}

const ALLOWED_ENTITY_TYPES = new Set(["client", "project", "sla_task", "voice_memo", "content", "booking", "opportunity", "note"]);

function readString(row: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
        const value = row[key];
        if (typeof value === "string" && value.length > 0) return value;
    }
    return undefined;
}

export function deriveSemanticFiltersFromStructuredResult(result: StructuredHubQueryResult): SemanticMetadataFilters | null {
    const firstRow = result.rows?.[0];
    if (!firstRow) {
        return null;
    }

    const clientId = readString(firstRow, ["client_id", "clientId", "portal_client_id"]);
    const projectId = readString(firstRow, ["project_id", "projectId"]);
    const entityType = typeof firstRow.entity_type === "string" && ALLOWED_ENTITY_TYPES.has(firstRow.entity_type)
        ? firstRow.entity_type
        : undefined;

    const filters: SemanticMetadataFilters = {
        clientId,
        projectId,
        entityTypes: entityType ? [entityType] : undefined,
    };

    return filters.clientId || filters.projectId || filters.entityTypes?.length ? filters : null;
}

export function filterSemanticNodeByMetadata(metadata: Record<string, unknown>, filters?: SemanticMetadataFilters | null) {
    if (!filters) return true;

    if (filters.clientId) {
        const value = metadata.client_id ?? metadata.clientId ?? metadata.portal_client_id;
        if (value !== filters.clientId) return false;
    }

    if (filters.projectId) {
        const value = metadata.project_id ?? metadata.projectId;
        if (value !== filters.projectId) return false;
    }

    return true;
}

export function describeSemanticFilters(filters?: SemanticMetadataFilters | null) {
    if (!filters) return null;
    return {
        client_id: filters.clientId ?? null,
        project_id: filters.projectId ?? null,
        entity_types: filters.entityTypes ?? null,
        date_window: filters.dateWindow ?? null,
        filter_mode: "typescript_post_filter_after_search_semantic_nodes_rpc",
    };
}
