import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/supabase/database.types";

export type SeoSourceReference =
    | { kind: "plan"; id: string }
    | { kind: "opportunity"; id: string };

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

export function extractSeoSourceReference(metadata: unknown): SeoSourceReference | null {
    const root = asRecord(metadata);
    const generationInputs = asRecord(root.generation_inputs);
    const sourceContext = asRecord(generationInputs.source_context);
    if (sourceContext.kind === "plan" && typeof sourceContext.id === "string" && sourceContext.id) {
        return { kind: "plan", id: sourceContext.id };
    }
    if (sourceContext.kind === "opportunity" && typeof sourceContext.id === "string" && sourceContext.id) {
        return { kind: "opportunity", id: sourceContext.id };
    }

    // Compatibility with the older placeholder-draft bridge.
    const seo = asRecord(root.seo);
    if (typeof seo.planId === "string" && seo.planId) return { kind: "plan", id: seo.planId };
    if (typeof seo.opportunityId === "string" && seo.opportunityId) return { kind: "opportunity", id: seo.opportunityId };
    return null;
}

export async function markSeoSourcePublished(input: {
    supabase: SupabaseClient<Database>;
    workspaceId: string;
    contentId: string;
    metadata: unknown;
}): Promise<{ source: SeoSourceReference | null; error: string | null }> {
    const source = extractSeoSourceReference(input.metadata);
    if (!source) return { source: null, error: null };

    if (source.kind === "plan") {
        const { data, error } = await input.supabase
            .from("seo_content_plans")
            .update({ status: "done", draft_content_item_id: input.contentId })
            .eq("id", source.id)
            .eq("workspace_id", input.workspaceId)
            .select("id")
            .maybeSingle();
        return {
            source,
            error: error?.message ?? (!data ? "SEO plan lifecycle update matched no workspace-scoped row." : null),
        };
    }

    const { data, error } = await input.supabase
        .from("seo_content_opportunities")
        .update({ status: "implemented", draft_content_item_id: input.contentId })
        .eq("id", source.id)
        .eq("workspace_id", input.workspaceId)
        .select("id")
        .maybeSingle();
    return {
        source,
        error: error?.message ?? (!data ? "SEO opportunity lifecycle update matched no workspace-scoped row." : null),
    };
}
