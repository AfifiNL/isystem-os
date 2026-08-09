import { createClient } from "@/shared/lib/supabase/server";
import { EMBEDDING_MODEL_ALIAS, EMBEDDING_V2_MODEL_ID, generateEmbedding, generateEmbeddingV2ForMigration } from "@/shared/lib/ai/embeddings";
import { buildAiRequestMetadata } from "@/shared/lib/ai/provider";

export const SEMANTIC_ENTITY_TYPES = [
    "note",
    "voice_memo",
    "sla_task",
    "client_portal_user",
    "content_item",
] as const;

export type SemanticEntityType = typeof SEMANTIC_ENTITY_TYPES[number];

const SEMANTIC_EMBEDDING_ROUTE = "semantic_hub_sync";
const SEMANTIC_EMBEDDING_DUAL_WRITE_ENABLED = process.env.SEMANTIC_EMBEDDING_DUAL_WRITE === "1";

interface SyncSemanticNodeParams {
    workspaceId: string;
    entityType: SemanticEntityType;
    entityId: string;
    title: string | null;
    content: string;
    metadata?: Record<string, unknown>;
}

type SemanticSupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Generates an embedding and upserts a semantic node for searchability in the Legibility Hub.
 */
export async function syncSemanticNode({
    workspaceId,
    entityType,
    entityId,
    title,
    content,
    metadata = {},
}: SyncSemanticNodeParams): Promise<{ success: boolean; error: string | null }> {
    try {
        if (!content.trim()) {
            // Delete node if there's no content to index
            await deleteSemanticNode(entityType, entityId);
            return { success: true, error: null };
        }

        // 1. Generate active text embedding. Optional v2 dual-write stores a
        // parallel migration vector but the query RPC still uses `embedding`.
        const embedding = await generateEmbedding(content);
        const embeddingV2 = SEMANTIC_EMBEDDING_DUAL_WRITE_ENABLED
            ? await generateEmbeddingV2ForMigration(content)
            : null;
        const updatedAt = new Date().toISOString();

        // 2. Instantiate Supabase Client
        const supabase = await createClient();

        // 3. Upsert semantic node
        const { error } = await supabase
            .from("workspace_semantic_nodes")
            .upsert(
                {
                    workspace_id: workspaceId,
                    entity_type: entityType,
                    entity_id: entityId,
                    title,
                    content,
                    metadata: {
                        ...metadata,
                        ai_embedding: buildAiRequestMetadata({
                            alias: EMBEDDING_MODEL_ALIAS,
                            provider: "vertex",
                            workspaceId,
                            routeName: SEMANTIC_EMBEDDING_ROUTE,
                            operation: "semantic_node_embedding",
                        }),
                    },
                    embedding,
                    ...(embeddingV2
                        ? {
                            embedding_v2: embeddingV2,
                            embedding_v2_model: EMBEDDING_V2_MODEL_ID,
                            embedding_v2_updated_at: updatedAt,
                        }
                        : {}),
                    updated_at: updatedAt,
                },
                {
                    onConflict: "workspace_id,entity_type,entity_id",
                }
            );

        if (error) {
            console.error(`[semantic-hub] failed to upsert node for ${entityType}:${entityId}:`, error.message);
            return { success: false, error: error.message };
        }

        return { success: true, error: null };
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown sync error";
        console.error(`[semantic-hub] unexpected error sync-ing node for ${entityType}:${entityId}:`, msg);
        return { success: false, error: msg };
    }
}

/**
 * Service-role variant for authenticated cron/worker contexts that do not carry
 * a browser session cookie. Keep browser/session callers on `syncSemanticNode`.
 */
export async function syncSemanticNodeWithClient(params: SyncSemanticNodeParams & { supabase: SemanticSupabaseClient }): Promise<{ success: boolean; error: string | null }> {
    try {
        if (!params.content.trim()) {
            const { error } = await params.supabase
                .from("workspace_semantic_nodes")
                .delete()
                .eq("entity_type", params.entityType)
                .eq("entity_id", params.entityId);
            return { success: !error, error: error?.message ?? null };
        }

        const embedding = await generateEmbedding(params.content);
        const embeddingV2 = SEMANTIC_EMBEDDING_DUAL_WRITE_ENABLED
            ? await generateEmbeddingV2ForMigration(params.content)
            : null;
        const updatedAt = new Date().toISOString();

        const { error } = await params.supabase
            .from("workspace_semantic_nodes")
            .upsert(
                {
                    workspace_id: params.workspaceId,
                    entity_type: params.entityType,
                    entity_id: params.entityId,
                    title: params.title,
                    content: params.content,
                    metadata: {
                        ...(params.metadata ?? {}),
                        ai_embedding: buildAiRequestMetadata({
                            alias: EMBEDDING_MODEL_ALIAS,
                            provider: "vertex",
                            workspaceId: params.workspaceId,
                            routeName: SEMANTIC_EMBEDDING_ROUTE,
                            operation: "semantic_node_embedding",
                        }),
                    },
                    embedding,
                    ...(embeddingV2
                        ? {
                            embedding_v2: embeddingV2,
                            embedding_v2_model: EMBEDDING_V2_MODEL_ID,
                            embedding_v2_updated_at: updatedAt,
                        }
                        : {}),
                    updated_at: updatedAt,
                },
                { onConflict: "workspace_id,entity_type,entity_id" },
            );

        if (error) {
            console.error(`[semantic-hub] failed to upsert node for ${params.entityType}:${params.entityId}:`, error.message);
            return { success: false, error: error.message };
        }

        return { success: true, error: null };
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown sync error";
        console.error(`[semantic-hub] unexpected error sync-ing node for ${params.entityType}:${params.entityId}:`, msg);
        return { success: false, error: msg };
    }
}

/**
 * Removes a semantic node from the hub (e.g. when the original entity is deleted).
 */
export async function deleteSemanticNode(entityType: SemanticEntityType, entityId: string): Promise<{ success: boolean; error: string | null }> {
    try {
        const supabase = await createClient();
        const { error } = await supabase
            .from("workspace_semantic_nodes")
            .delete()
            .eq("entity_type", entityType)
            .eq("entity_id", entityId);

        if (error) {
            console.error(`[semantic-hub] failed to delete node for ${entityType}:${entityId}:`, error.message);
            return { success: false, error: error.message };
        }

        return { success: true, error: null };
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown delete error";
        console.error(`[semantic-hub] unexpected error deleting node for ${entityType}:${entityId}:`, msg);
        return { success: false, error: msg };
    }
}
