import "server-only";

import { createHash } from "node:crypto";
import type { Json } from "@/shared/lib/supabase/database.types";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { AI_SERVICE_DEFAULT_MODELS, AI_SERVICE_OPTIONS } from "@/shared/lib/ai/models";

type InternalLinkJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled" | "superseded";

export interface EnqueueInternalLinkJobInput {
    workspaceId: string | null | undefined;
    templateId: string | null | undefined;
    contentId: string | null | undefined;
    locale: string | null | undefined;
    title?: string | null;
    slug?: string | null;
    contentMarkdown?: string | null;
    visualLayout?: Json | null;
    metadata?: Json | null;
    forceRequeue?: boolean;
}

export interface EnqueueInternalLinkJobResult {
    status: "queued" | "already_queued" | "already_completed" | "reactivated" | "skipped";
    jobId?: string;
    contentHash?: string;
    error?: string;
}

function stableStringify(value: unknown): string {
    if (typeof value === "undefined") {
        return "undefined";
    }

    if (value === null || typeof value !== "object") {
        return JSON.stringify(value) ?? "null";
    }

    if (Array.isArray(value)) {
        return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
    }

    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
        .join(",")}}`;
}

function buildContentHash(input: EnqueueInternalLinkJobInput): string {
    const bodySnapshot = {
        contentMarkdown: input.contentMarkdown ?? "",
        locale: input.locale ?? "en",
        metadata: input.metadata ?? null,
        slug: input.slug ?? null,
        title: input.title ?? "",
        visualLayout: input.visualLayout ?? null,
    };

    return createHash("sha256").update(stableStringify(bodySnapshot)).digest("hex");
}

function parseWorkspaceModelConfigs(value: Json | null | undefined): Record<string, string> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};

    return Object.fromEntries(
        Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
}

async function buildSeoModelConfigSnapshot(workspaceId: string): Promise<Json> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("workspaces")
        .select("ai_model_configs")
        .eq("id", workspaceId)
        .maybeSingle();

    if (error) {
        console.warn("[seo-internal-link-jobs] Failed to snapshot workspace AI model config:", error.message);
    }

    const configs = parseWorkspaceModelConfigs(data?.ai_model_configs);
    const selectedOptionId = configs.seo_automation ?? AI_SERVICE_DEFAULT_MODELS.seo_automation;
    const selectedOption = AI_SERVICE_OPTIONS.seo_automation.find((option) => option.id === selectedOptionId)
        ?? AI_SERVICE_OPTIONS.seo_automation[0];

    return {
        service: "seo_automation",
        selected_option_id: selectedOptionId,
        provider: selectedOption.provider,
        transport: selectedOption.transport,
        model_id: selectedOption.modelId,
        source: configs.seo_automation ? "workspace" : "default",
    } as Json;
}

export async function enqueueInternalLinkJobForPublishedContent(
    input: EnqueueInternalLinkJobInput,
): Promise<EnqueueInternalLinkJobResult> {
    const workspaceId = input.workspaceId?.trim();
    const templateId = input.templateId?.trim();
    const contentId = input.contentId?.trim();
    const locale = input.locale?.trim() || "en";

    if (!workspaceId || !templateId || !contentId) {
        return { status: "skipped", error: "Missing workspace_id, template_id, or content_id." };
    }

    const contentHash = buildContentHash({ ...input, workspaceId, templateId, contentId, locale });

    try {
        const supabase = createAdminClient();
        const modelConfigSnapshot = await buildSeoModelConfigSnapshot(workspaceId);

        const { data: existing, error: existingError } = await supabase
            .from("seo_internal_link_jobs")
            .select("id,status")
            .eq("workspace_id", workspaceId)
            .eq("template_id", templateId)
            .eq("content_id", contentId)
            .eq("locale", locale)
            .eq("content_hash", contentHash)
            .maybeSingle();

        if (existingError) {
            return { status: "skipped", contentHash, error: existingError.message };
        }

        if (existing) {
            const existingStatus = existing.status as InternalLinkJobStatus;

            if (existingStatus === "queued" || existingStatus === "running") {
                return { status: "already_queued", jobId: existing.id, contentHash };
            }

            if (existingStatus === "completed" && !input.forceRequeue) {
                return { status: "already_completed", jobId: existing.id, contentHash };
            }

            const { error: updateError } = await supabase
                .from("seo_internal_link_jobs")
                .update({
                    status: "queued",
                    attempts: 0,
                    run_after: new Date().toISOString(),
                    locked_at: null,
                    model_config_snapshot: modelConfigSnapshot,
                    cost_summary_millicents: 0,
                    summary: {},
                    error_message: null,
                    completed_at: null,
                })
                .eq("id", existing.id);

            if (updateError) {
                return { status: "skipped", jobId: existing.id, contentHash, error: updateError.message };
            }

            return { status: "reactivated", jobId: existing.id, contentHash };
        }

        // Supersede any older queued or failed jobs for the same content and locale
        const { error: supersedeError } = await supabase
            .from("seo_internal_link_jobs")
            .update({ status: "superseded" })
            .eq("workspace_id", workspaceId)
            .eq("template_id", templateId)
            .eq("content_id", contentId)
            .eq("locale", locale)
            .in("status", ["queued", "failed"]);

        if (supersedeError) {
            console.warn("[seo-internal-link-jobs] Failed to supersede older jobs:", supersedeError.message);
        }

        const { data: inserted, error: insertError } = await supabase
            .from("seo_internal_link_jobs")
            .insert({
                workspace_id: workspaceId,
                template_id: templateId,
                content_id: contentId,
                locale,
                status: "queued",
                content_hash: contentHash,
                model_config_snapshot: modelConfigSnapshot,
            })
            .select("id")
            .single();

        if (insertError) {
            return { status: "skipped", contentHash, error: insertError.message };
        }

        return { status: "queued", jobId: inserted.id, contentHash };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error while enqueuing internal-link job.";
        return { status: "skipped", contentHash, error: message };
    }
}
