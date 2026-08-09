"use server";

import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { InsufficientAiBalanceError } from "@/shared/lib/ai/metering";
import { WorkspaceAiRateLimitError } from "@/shared/lib/ai/workspace-execution";
import {
    assertWorkspaceAiEnabled,
    resolveWorkspaceContext,
    type WorkspaceContext,
    type WorkspaceSummary,
} from "@/shared/lib/workspace/context";
import { getCreativeRenderProviderConfig, getHiggsfieldDisabledReason } from "@/features/creative-studio/providers/config";
import {
    generateCreativeStrategyWithVertex,
} from "@/features/creative-studio/strategy";
import {
    buildCreativeMcpCommandText,
    buildCreativeMcpProductionPack,
    HIGGSFIELD_MCP_SERVER_URL,
    normalizeCreativeManualCreditSource,
    normalizeCreativeManualProvider,
} from "@/features/creative-studio/providers/mcp-manual";
import type { CreativeManualCreditSource } from "@/features/creative-studio/providers/types";

type CreativeStudioContext = WorkspaceContext & { activeWorkspace: WorkspaceSummary };

export type CreativeProjectStatus = "draft" | "strategy_ready" | "needs_review" | "approved" | "archived";
export type CreativeBriefStatus = "draft" | "strategy_requested" | "strategy_ready" | "render_ready" | "archived";
export type CreativeRenderStatus =
    | "draft"
    | "prompt_ready"
    | "queued"
    | "running"
    | "provider_submitted"
    | "provider_processing"
    | "mcp_manual_required"
    | "mcp_generation_in_progress"
    | "awaiting_manual_upload"
    | "uploaded_for_review"
    | "approved"
    | "rejected"
    | "completed"
    | "failed"
    | "cancelled"
    | "superseded"
    | "needs_manual_review";
export type CreativeAssetStatus = "draft" | "needs_review" | "approved" | "rejected" | "exported" | "archived";

export interface CreativeStudioProjectSummary {
    id: string;
    workspace_id: string;
    template_id: string | null;
    locale: string;
    name: string;
    objective: string;
    target_audience: string | null;
    target_channel: string | null;
    status: CreativeProjectStatus;
    created_at: string;
    updated_at: string;
}

export interface CreativeStudioBriefSummary {
    id: string;
    workspace_id: string;
    template_id: string | null;
    project_id: string;
    source_module: string;
    source_entity_type: string | null;
    title: string;
    brief_markdown: string;
    target_url: string | null;
    status: CreativeBriefStatus;
    created_at: string;
    updated_at: string;
}

export interface CreativeStudioPromptSummary {
    id: string;
    workspace_id: string;
    template_id: string | null;
    project_id: string;
    brief_id: string | null;
    source_model: string | null;
    strategy_prompt: string;
    provider_prompt: string;
    negative_prompt: string;
    scene_plan: Record<string, unknown>;
    evaluator_plan: Record<string, unknown>;
    prompt_hash: string;
    safety: Record<string, unknown>;
    created_at: string;
}

export interface CreativeStudioRenderJobSummary {
    id: string;
    workspace_id: string;
    template_id: string | null;
    project_id: string;
    brief_id: string | null;
    prompt_id: string | null;
    provider: string;
    provider_model: string;
    provider_mode: string;
    manual_provider: string | null;
    manual_credit_source: CreativeManualCreditSource | null;
    manual_external_url: string | null;
    manual_instructions: Record<string, unknown>;
    manual_checklist: Record<string, unknown>;
    manual_notes: string | null;
    job_kind: string;
    status: CreativeRenderStatus;
    provider_request: Record<string, unknown>;
    duration_seconds: number | null;
    result_asset_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreativeStudioAssetSummary {
    id: string;
    workspace_id: string;
    template_id: string | null;
    project_id: string;
    brief_id: string | null;
    prompt_id: string | null;
    provider_job_id: string | null;
    asset_type: string;
    status: CreativeAssetStatus;
    storage_bucket: string;
    storage_path: string;
    mime_type: string;
    rights_status: string;
    safety_status: string;
    metadata: Record<string, unknown>;
    created_at: string;
}

export interface CreativeMcpManualFulfillmentSummary {
    job: CreativeStudioRenderJobSummary;
    prompt: CreativeStudioPromptSummary | null;
    asset: CreativeStudioAssetSummary | null;
    commandText: string | null;
    nextAction: "copy_mcp_command" | "upload_result" | "review_asset" | "complete";
}

export interface CreativeStudioDashboardData {
    workspace: {
        id: string;
        name: string;
        tier: "basic" | "pro";
        templateId: string | null;
        locale: string;
    };
    projects: CreativeStudioProjectSummary[];
    briefs: CreativeStudioBriefSummary[];
    prompts: CreativeStudioPromptSummary[];
    renderJobs: CreativeStudioRenderJobSummary[];
    assets: CreativeStudioAssetSummary[];
    mcpManual: CreativeMcpManualFulfillmentSummary[];
    stats: {
        projects: number;
        briefs: number;
        queuedJobs: number;
        failures: number;
        assets: number;
        approvals: number;
        exports: number;
        auditEvents: number;
        spendMillicents: number;
    };
    providerStatus: {
        fakeProviderEnabled: boolean;
        higgsfieldEnabled: boolean;
        higgsfieldReady: boolean;
        higgsfieldDisabledReason: string | null;
        mcpManualAvailable: boolean;
        mcpManualStatusLabel: string;
        mcpManualStatusDetail: string;
        workerDrainLimit: number;
        maxPendingJobsPerWorkspace: number;
        dailyRenderLimitPerWorkspace: number;
    };
}

export type CreativeStudioDashboardResult =
    | { ok: true; data: CreativeStudioDashboardData }
    | { ok: false; code: "unauthorized" | "pro_required" | "load_failed"; error: string };

export interface CreativeStudioActionState {
    ok: boolean;
    error: string | null;
}


type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value: FormDataEntryValue | null, maxLength = 4000): string {
    return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function nullableText(value: FormDataEntryValue | null, maxLength = 1000): string | null {
    const normalized = normalizeText(value, maxLength);
    return normalized.length > 0 ? normalized : null;
}

function normalizeLocale(value: FormDataEntryValue | null, fallback: string): string {
    const candidate = normalizeText(value, 10).toLowerCase();
    if (candidate === "en" || candidate === "nl" || candidate === "ar") return candidate;
    return fallback === "nl" || fallback === "ar" ? fallback : "en";
}

function normalizeUrl(value: FormDataEntryValue | null): string | null {
    const candidate = nullableText(value, 2048);
    if (!candidate) return null;

    try {
        const parsed = new URL(candidate);
        return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
    } catch {
        return null;
    }
}

function templateMatches(recordTemplateId: string | null, activeTemplateId: string | null): boolean {
    return (recordTemplateId ?? null) === (activeTemplateId ?? null);
}

function jsonRecord(value: unknown): Record<string, unknown> {
    return isRecord(value) ? value : {};
}

function jsonRecordArray<T>(rows: unknown): T[] {
    return Array.isArray(rows) ? rows.filter(isRecord).map((row) => row as unknown as T) : [];
}

function normalizeJobKindForAsset(jobKind: string): "rendered_video" | "storyboard" | "social_cutdown" | "thumbnail" {
    if (jobKind === "storyboard") return "storyboard";
    if (jobKind === "social_cutdown") return "social_cutdown";
    if (jobKind === "image") return "thumbnail";
    return "rendered_video";
}

function checkboxAcknowledged(value: FormDataEntryValue | null): boolean {
    return value === "on" || value === "true" || value === "1";
}

function sha256Hex(bytes: Buffer | string): string {
    return createHash("sha256").update(bytes).digest("hex");
}

async function getCreativeStudioContext(): Promise<CreativeStudioContext | null> {
    try {
        return await assertWorkspaceAiEnabled();
    } catch {
        return null;
    }
}

async function countRows(
    supabase: SupabaseServerClient,
    table: string,
    workspaceId: string,
    templateId: string | null,
    configure?: (query: ReturnType<SupabaseServerClient["from"]>) => ReturnType<SupabaseServerClient["from"]>,
): Promise<number> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from(table as never) as any)
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId);

    query = templateId ? query.eq("template_id", templateId) : query.is("template_id", null);

    const { count } = await (configure ? configure(query) : query);
    return count ?? 0;
}

export async function loadCreativeStudioDashboard(): Promise<CreativeStudioDashboardResult> {
    const rawContext = await resolveWorkspaceContext();

    if (!rawContext?.activeWorkspace) {
        return { ok: false, code: "unauthorized", error: "No active workspace session found." };
    }

    if (!rawContext.productFeatures.aiGeneration) {
        return {
            ok: false,
            code: "pro_required",
            error: "Creative Studio is available on Pro workspaces only.",
        };
    }

    const context = rawContext as CreativeStudioContext;
    const workspaceId = context.activeWorkspace.id;
    const templateId = context.activeWorkspace.legacy_template_id || null;

    try {
        const supabase = await createClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const projectQuery = (supabase.from("creative_projects" as never) as any)
            .select("id,workspace_id,template_id,locale,name,objective,target_audience,target_channel,status,created_at,updated_at")
            .eq("workspace_id", workspaceId)
            .order("updated_at", { ascending: false })
            .limit(10);
        const { data: rawProjects, error: projectsError } = await (templateId
            ? projectQuery.eq("template_id", templateId)
            : projectQuery.is("template_id", null));

        if (projectsError) {
            return { ok: false, code: "load_failed", error: projectsError.message };
        }

        const projects = (rawProjects ?? [])
            .filter((project: CreativeStudioProjectSummary) => templateMatches(project.template_id, templateId))
            .map((project: CreativeStudioProjectSummary) => project);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const briefQuery = (supabase.from("creative_briefs" as never) as any)
            .select("id,workspace_id,template_id,project_id,source_module,source_entity_type,title,brief_markdown,target_url,status,created_at,updated_at")
            .eq("workspace_id", workspaceId)
            .order("updated_at", { ascending: false })
            .limit(10);
        const { data: rawBriefs, error: briefsError } = await (templateId
            ? briefQuery.eq("template_id", templateId)
            : briefQuery.is("template_id", null));

        if (briefsError) {
            return { ok: false, code: "load_failed", error: briefsError.message };
        }

        const briefs = (rawBriefs ?? [])
            .filter((brief: CreativeStudioBriefSummary) => templateMatches(brief.template_id, templateId))
            .map((brief: CreativeStudioBriefSummary) => brief);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const promptQuery = (supabase.from("creative_prompts" as never) as any)
            .select("id,workspace_id,template_id,project_id,brief_id,source_model,strategy_prompt,provider_prompt,negative_prompt,scene_plan,evaluator_plan,prompt_hash,safety,created_at")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false })
            .limit(10);
        const { data: rawPrompts, error: promptsError } = await (templateId
            ? promptQuery.eq("template_id", templateId)
            : promptQuery.is("template_id", null));

        if (promptsError) {
            return { ok: false, code: "load_failed", error: promptsError.message };
        }

        const prompts = jsonRecordArray<CreativeStudioPromptSummary>(rawPrompts)
            .filter((prompt) => templateMatches(prompt.template_id, templateId))
            .map((prompt) => ({
                ...prompt,
                scene_plan: jsonRecord(prompt.scene_plan),
                evaluator_plan: jsonRecord(prompt.evaluator_plan),
                safety: jsonRecord(prompt.safety),
            }));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const jobQuery = (supabase.from("creative_render_jobs" as never) as any)
            .select("id,workspace_id,template_id,project_id,brief_id,prompt_id,provider,provider_model,provider_mode,manual_provider,manual_credit_source,manual_external_url,manual_instructions,manual_checklist,manual_notes,job_kind,status,provider_request,duration_seconds,result_asset_id,created_at,updated_at")
            .eq("workspace_id", workspaceId)
            .order("updated_at", { ascending: false })
            .limit(12);
        const { data: rawJobs, error: jobsError } = await (templateId
            ? jobQuery.eq("template_id", templateId)
            : jobQuery.is("template_id", null));

        if (jobsError) {
            return { ok: false, code: "load_failed", error: jobsError.message };
        }

        const renderJobs = jsonRecordArray<CreativeStudioRenderJobSummary>(rawJobs)
            .filter((job) => templateMatches(job.template_id, templateId))
            .map((job) => ({
                ...job,
                manual_instructions: jsonRecord(job.manual_instructions),
                manual_checklist: jsonRecord(job.manual_checklist),
                provider_request: jsonRecord(job.provider_request),
                manual_credit_source: normalizeCreativeManualCreditSource(job.manual_credit_source, "unknown"),
            }));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const assetQuery = (supabase.from("creative_assets" as never) as any)
            .select("id,workspace_id,template_id,project_id,brief_id,prompt_id,provider_job_id,asset_type,status,storage_bucket,storage_path,mime_type,rights_status,safety_status,metadata,created_at")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false })
            .limit(12);
        const { data: rawAssets, error: assetsError } = await (templateId
            ? assetQuery.eq("template_id", templateId)
            : assetQuery.is("template_id", null));

        if (assetsError) {
            return { ok: false, code: "load_failed", error: assetsError.message };
        }

        const assets = jsonRecordArray<CreativeStudioAssetSummary>(rawAssets)
            .filter((asset) => templateMatches(asset.template_id, templateId))
            .map((asset) => ({ ...asset, metadata: jsonRecord(asset.metadata) }));

        const promptById = new Map(prompts.map((prompt) => [prompt.id, prompt]));
        const assetById = new Map(assets.map((asset) => [asset.id, asset]));
        const mcpManual = renderJobs
            .filter((job) => job.provider_mode === "mcp_manual" || job.provider_mode === "mcp_bridge_experimental")
            .map((job) => {
                const prompt = job.prompt_id ? promptById.get(job.prompt_id) ?? null : null;
                const asset = job.result_asset_id ? assetById.get(job.result_asset_id) ?? null : null;
                const pack = prompt ? buildCreativeMcpProductionPack({
                    manifest: {
                        provider_prompt: prompt.provider_prompt,
                        negative_prompt: prompt.negative_prompt,
                        scene_plan: prompt.scene_plan,
                        evaluator_plan: prompt.evaluator_plan,
                        prompt_hash: prompt.prompt_hash,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        safety: prompt.safety as any,
                    },
                    job,
                    providerMode: job.provider_mode === "mcp_bridge_experimental" ? "mcp_bridge_experimental" : "mcp_manual",
                    manualProvider: normalizeCreativeManualProvider(job.manual_provider),
                    manualCreditSource: normalizeCreativeManualCreditSource(job.manual_credit_source),
                    operatorNotes: job.manual_notes,
                }) : null;
                const nextAction = asset
                    ? (asset.status === "needs_review" ? "review_asset" : "complete")
                    : job.status === "mcp_manual_required"
                        ? "copy_mcp_command"
                        : job.status === "mcp_generation_in_progress" || job.status === "awaiting_manual_upload" || job.status === "uploaded_for_review"
                            ? "upload_result"
                            : "copy_mcp_command";

                return {
                    job,
                    prompt,
                    asset,
                    commandText: pack ? buildCreativeMcpCommandText(pack) : null,
                    nextAction,
                } satisfies CreativeMcpManualFulfillmentSummary;
            });

        const [projectCount, briefCount, queuedJobs, failures, assetCount, approvals, exports, auditEvents] = await Promise.all([
            countRows(supabase, "creative_projects", workspaceId, templateId),
            countRows(supabase, "creative_briefs", workspaceId, templateId),
            countRows(supabase, "creative_render_jobs", workspaceId, templateId, (query) =>
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (query as any).in("status", ["queued", "running", "provider_submitted", "provider_processing", "needs_manual_review"]),
            ),
            countRows(supabase, "creative_render_jobs", workspaceId, templateId, (query) =>
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (query as any).eq("status", "failed"),
            ),
            countRows(supabase, "creative_assets", workspaceId, templateId),
            countRows(supabase, "creative_assets", workspaceId, templateId, (query) =>
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (query as any).eq("status", "approved"),
            ),
            countRows(supabase, "creative_channel_links", workspaceId, templateId),
            countRows(supabase, "creative_review_events", workspaceId, templateId),
        ]);

        let spendMillicents = 0;
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let spendQuery = (supabase.from("creative_render_jobs" as never) as any)
                .select("final_cost_millicents")
                .eq("workspace_id", workspaceId)
                .not("final_cost_millicents", "is", null);
            spendQuery = templateId ? spendQuery.eq("template_id", templateId) : spendQuery.is("template_id", null);
            const { data: spendData } = await spendQuery;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spendMillicents = (spendData ?? []).reduce((sum: number, row: any) => sum + (Number(row.final_cost_millicents) || 0), 0);
        } catch {
            // ignore
        }

        const providerConfig = getCreativeRenderProviderConfig();
        const higgsfieldDisabledReason = getHiggsfieldDisabledReason(providerConfig.higgsfield);

        return {
            ok: true,
            data: {
                workspace: {
                    id: workspaceId,
                    name: context.activeWorkspace.name,
                    tier: context.activeWorkspace.workspace_tier,
                    templateId,
                    locale: context.activeWorkspace.default_locale,
                },
                projects,
                briefs,
                prompts,
                renderJobs,
                assets,
                mcpManual,
                stats: {
                    projects: projectCount,
                    briefs: briefCount,
                    queuedJobs,
                    failures,
                    assets: assetCount,
                    approvals,
                    exports,
                    auditEvents,
                    spendMillicents,
                },
                providerStatus: {
                    fakeProviderEnabled: providerConfig.fakeProviderEnabled,
                    higgsfieldEnabled: providerConfig.higgsfield.enabled,
                    higgsfieldReady: providerConfig.higgsfield.enabled && !higgsfieldDisabledReason,
                    higgsfieldDisabledReason,
                    mcpManualAvailable: true,
                    mcpManualStatusLabel: "Available · manual only",
                    mcpManualStatusDetail: "Operator-managed Higgsfield MCP fulfillment is available as a copy/paste, download, upload, and review workflow. The workspace does not call MCP, automate hosts, or store Higgsfield credentials.",
                    workerDrainLimit: providerConfig.workerDrainLimit,
                    maxPendingJobsPerWorkspace: providerConfig.higgsfield.maxPendingJobsPerWorkspace,
                    dailyRenderLimitPerWorkspace: providerConfig.higgsfield.dailyRenderLimitPerWorkspace,
                },
            },
        };
    } catch (error) {
        return {
            ok: false,
            code: "load_failed",
            error: error instanceof Error ? error.message : "Failed to load Creative Studio.",
        };
    }
}

async function loadScopedPrompt(
    supabase: SupabaseServerClient,
    promptId: string,
    workspaceId: string,
    templateId: string | null,
): Promise<{ prompt: CreativeStudioPromptSummary | null; error: string | null }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("creative_prompts" as never) as any)
        .select("id,workspace_id,template_id,project_id,brief_id,source_model,strategy_prompt,provider_prompt,negative_prompt,scene_plan,evaluator_plan,prompt_hash,safety,created_at")
        .eq("id", promptId)
        .eq("workspace_id", workspaceId)
        .limit(1)
        .maybeSingle();
    if (error) return { prompt: null, error: error.message };
    if (!data || !isRecord(data) || !templateMatches(data.template_id as string | null, templateId)) {
        return { prompt: null, error: "Prompt manifest is outside the active workspace/template scope." };
    }
    return {
        prompt: {
            ...(data as unknown as CreativeStudioPromptSummary),
            scene_plan: jsonRecord(data.scene_plan),
            evaluator_plan: jsonRecord(data.evaluator_plan),
            safety: jsonRecord(data.safety),
        },
        error: null,
    };
}

async function loadScopedMcpJob(
    supabase: SupabaseServerClient,
    jobId: string,
    workspaceId: string,
    templateId: string | null,
): Promise<{ job: CreativeStudioRenderJobSummary | null; error: string | null }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("creative_render_jobs" as never) as any)
        .select("id,workspace_id,template_id,project_id,brief_id,prompt_id,provider,provider_model,provider_mode,manual_provider,manual_credit_source,manual_external_url,manual_instructions,manual_checklist,manual_notes,job_kind,status,provider_request,duration_seconds,result_asset_id,created_at,updated_at")
        .eq("id", jobId)
        .eq("workspace_id", workspaceId)
        .limit(1)
        .maybeSingle();
    if (error) return { job: null, error: error.message };
    if (!data || !isRecord(data) || !templateMatches(data.template_id as string | null, templateId)) {
        return { job: null, error: "Manual render job is outside the active workspace/template scope." };
    }
    const providerMode = String(data.provider_mode ?? "api_auto");
    if (providerMode !== "mcp_manual" && providerMode !== "mcp_bridge_experimental") {
        return { job: null, error: "Render job is not configured for MCP Manual Mode." };
    }
    return {
        job: {
            ...(data as unknown as CreativeStudioRenderJobSummary),
            provider_request: jsonRecord(data.provider_request),
            manual_instructions: jsonRecord(data.manual_instructions),
            manual_checklist: jsonRecord(data.manual_checklist),
            manual_credit_source: normalizeCreativeManualCreditSource(data.manual_credit_source, "unknown"),
        },
        error: null,
    };
}

async function recordMcpFulfillmentEvent(
    supabase: SupabaseServerClient,
    input: {
        workspaceId: string;
        templateId: string | null;
        jobId: string;
        projectId?: string | null;
        assetId?: string | null;
        actorProfileId: string;
        eventType: "mcp_command_copied" | "mcp_generation_started_manually" | "mcp_result_uploaded" | "mcp_external_url_attached" | "mcp_result_rejected" | "mcp_result_approved";
        notes?: string | null;
        payload?: Record<string, unknown>;
    },
): Promise<string | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("creative_manual_fulfillment_events" as never) as any).insert({
        workspace_id: input.workspaceId,
        template_id: input.templateId,
        job_id: input.jobId,
        asset_id: input.assetId ?? null,
        event_type: input.eventType,
        actor_profile_id: input.actorProfileId,
        notes: input.notes ?? null,
        payload: input.payload ?? {},
    });
    if (error) return error.message;

    if (input.projectId) {
        const reviewEventType = input.eventType === "mcp_result_approved"
            ? "render_approved"
            : input.eventType === "mcp_result_rejected"
                ? "render_rejected"
                : input.eventType === "mcp_result_uploaded"
                    ? "evaluator_passed"
                    : "provider_submitted";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("creative_review_events" as never) as any).insert({
            workspace_id: input.workspaceId,
            template_id: input.templateId,
            project_id: input.projectId,
            asset_id: input.assetId ?? null,
            job_id: input.jobId,
            event_type: reviewEventType,
            actor_profile_id: input.actorProfileId,
            notes: input.notes ?? input.eventType,
            payload: { ...input.payload, manual_event_type: input.eventType, provider_mode: "mcp_manual" },
        });
    }

    return null;
}

export async function createMcpManualRenderJobAction(
    _prevState: CreativeStudioActionState,
    formData: FormData,
): Promise<CreativeStudioActionState> {
    const context = await getCreativeStudioContext();
    if (!context) return { ok: false, error: "Creative Studio is available on Pro workspaces only." };

    const promptId = normalizeText(formData.get("prompt_id"), 80);
    if (!promptId) return { ok: false, error: "Approved prompt manifest is required." };

    const workspace = context.activeWorkspace;
    const workspaceId = workspace.id;
    const templateId = workspace.legacy_template_id || null;
    const supabase = await createClient();

    try {
        const { prompt, error: promptError } = await loadScopedPrompt(supabase, promptId, workspaceId, templateId);
        if (promptError || !prompt) return { ok: false, error: promptError ?? "Prompt manifest not found." };

        const safety = jsonRecord(prompt.safety);
        if (safety.status === "blocked") return { ok: false, error: "Blocked prompt manifests cannot create MCP manual jobs." };

        const manualCreditSource = normalizeCreativeManualCreditSource(formData.get("manual_credit_source"), "operator_creator_credits");
        const operatorNotes = nullableText(formData.get("operator_notes"), 1000);
        const durationSecondsRaw = Number.parseInt(normalizeText(formData.get("duration_seconds"), 8), 10);
        const durationSeconds = Number.isFinite(durationSecondsRaw) && durationSecondsRaw > 0 ? durationSecondsRaw : null;
        const jobKind = normalizeText(formData.get("job_kind"), 40) || "video";
        const providerModel = normalizeText(formData.get("provider_model"), 120) || "higgsfield-operator-choice";
        const jobId = randomUUID();
        const jobLike = {
            id: jobId,
            workspace_id: workspaceId,
            template_id: templateId,
            project_id: prompt.project_id,
            brief_id: prompt.brief_id,
            prompt_id: prompt.id,
            job_kind: jobKind,
            provider_model: providerModel,
            duration_seconds: durationSeconds,
            provider_request: {
                prompt: prompt.provider_prompt,
                negativePrompt: prompt.negative_prompt,
                providerPrompt: prompt.provider_prompt,
                durationSeconds,
                providerModel,
            },
        };
        const pack = buildCreativeMcpProductionPack({
            manifest: {
                provider_prompt: prompt.provider_prompt,
                negative_prompt: prompt.negative_prompt,
                scene_plan: prompt.scene_plan,
                evaluator_plan: prompt.evaluator_plan,
                prompt_hash: prompt.prompt_hash,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                safety: prompt.safety as any,
            },
            job: jobLike,
            manualProvider: "higgsfield_mcp",
            providerMode: "mcp_manual",
            manualCreditSource,
            operatorNotes,
        });
        const commandText = buildCreativeMcpCommandText(pack);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from("creative_render_jobs" as never) as any).insert({
            id: jobId,
            workspace_id: workspaceId,
            template_id: templateId,
            project_id: prompt.project_id,
            brief_id: prompt.brief_id,
            prompt_id: prompt.id,
            provider: "higgsfield",
            provider_model: providerModel,
            job_kind: jobKind,
            status: "mcp_manual_required",
            priority: 100,
            idempotency_key: `creative:mcp-manual:${prompt.id}:${prompt.prompt_hash}:${Date.now()}`,
            provider_request: jobLike.provider_request,
            duration_seconds: durationSeconds,
            provider_mode: "mcp_manual",
            manual_provider: "higgsfield_mcp",
            manual_credit_source: manualCreditSource,
            manual_instructions: { pack, command_text: commandText, mcp_server_url: HIGGSFIELD_MCP_SERVER_URL },
            manual_checklist: pack.operatorInstructions.checklist,
            manual_notes: operatorNotes,
        });
        if (error) return { ok: false, error: error.message };

        const eventError = await recordMcpFulfillmentEvent(supabase, {
            workspaceId,
            templateId,
            jobId,
            projectId: prompt.project_id,
            actorProfileId: context.userId,
            eventType: "mcp_command_copied",
            notes: "MCP Manual Mode job created; command pack is ready for operator copy.",
            payload: { prompt_id: prompt.id, prompt_hash: prompt.prompt_hash, command_hash: sha256Hex(commandText) },
        });
        if (eventError) return { ok: false, error: eventError };

        revalidatePath("/dashboard/creative-studio");
        return { ok: true, error: null };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Failed to create MCP manual render job." };
    }
}

export async function recordMcpCommandCopiedAction(
    _prevState: CreativeStudioActionState,
    formData: FormData,
): Promise<CreativeStudioActionState> {
    const context = await getCreativeStudioContext();
    if (!context) return { ok: false, error: "Creative Studio is available on Pro workspaces only." };

    const jobId = normalizeText(formData.get("job_id"), 80);
    if (!jobId) return { ok: false, error: "Manual render job is required." };

    const workspaceId = context.activeWorkspace.id;
    const templateId = context.activeWorkspace.legacy_template_id || null;
    const supabase = await createClient();
    const { job, error } = await loadScopedMcpJob(supabase, jobId, workspaceId, templateId);
    if (error || !job) return { ok: false, error: error ?? "Manual render job not found." };

    const commandText = normalizeText(formData.get("command_text"), 20000);
    const eventError = await recordMcpFulfillmentEvent(supabase, {
        workspaceId,
        templateId,
        jobId,
        projectId: job.project_id,
        actorProfileId: context.userId,
        eventType: "mcp_command_copied",
        notes: "Operator copied the MCP manual command text.",
        payload: { command_hash: commandText ? sha256Hex(commandText) : null, mcp_server_url: HIGGSFIELD_MCP_SERVER_URL },
    });
    if (eventError) return { ok: false, error: eventError };

    revalidatePath("/dashboard/creative-studio");
    return { ok: true, error: null };
}

export async function markMcpGenerationStartedManuallyAction(
    _prevState: CreativeStudioActionState,
    formData: FormData,
): Promise<CreativeStudioActionState> {
    const context = await getCreativeStudioContext();
    if (!context) return { ok: false, error: "Creative Studio is available on Pro workspaces only." };

    const jobId = normalizeText(formData.get("job_id"), 80);
    if (!jobId) return { ok: false, error: "Manual render job is required." };

    const workspaceId = context.activeWorkspace.id;
    const templateId = context.activeWorkspace.legacy_template_id || null;
    const supabase = await createClient();
    const { job, error: jobError } = await loadScopedMcpJob(supabase, jobId, workspaceId, templateId);
    if (jobError || !job) return { ok: false, error: jobError ?? "Manual render job not found." };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("creative_render_jobs" as never) as any)
        .update({
            status: "mcp_generation_in_progress",
            submitted_at: new Date().toISOString(),
            manual_checklist: { ...job.manual_checklist, prompt_copied_by_operator: true, manual_generation_started: true },
        })
        .eq("id", jobId)
        .eq("workspace_id", workspaceId)
        .in("status", ["mcp_manual_required", "awaiting_manual_upload"]);
    if (error) return { ok: false, error: error.message };

    const eventError = await recordMcpFulfillmentEvent(supabase, {
        workspaceId,
        templateId,
        jobId,
        projectId: job.project_id,
        actorProfileId: context.userId,
        eventType: "mcp_generation_started_manually",
        notes: "Operator started generation manually in an MCP host. No backend MCP call was made.",
        payload: { no_backend_mcp_or_browser_automation: true },
    });
    if (eventError) return { ok: false, error: eventError };

    revalidatePath("/dashboard/creative-studio");
    return { ok: true, error: null };
}

export async function attachMcpManualExternalUrlAction(
    _prevState: CreativeStudioActionState,
    formData: FormData,
): Promise<CreativeStudioActionState> {
    const context = await getCreativeStudioContext();
    if (!context) return { ok: false, error: "Creative Studio is available on Pro workspaces only." };

    const jobId = normalizeText(formData.get("job_id"), 80);
    const externalUrl = normalizeUrl(formData.get("manual_external_url"));
    if (!jobId) return { ok: false, error: "Manual render job is required." };
    if (!externalUrl) return { ok: false, error: "A valid HTTPS/HTTP external URL is required." };
    if (!checkboxAcknowledged(formData.get("rights_ack")) || !checkboxAcknowledged(formData.get("safety_ack"))) {
        return { ok: false, error: "Rights and safety checklist acknowledgement is required before attaching an external URL." };
    }

    const workspaceId = context.activeWorkspace.id;
    const templateId = context.activeWorkspace.legacy_template_id || null;
    const supabase = await createClient();
    const { job, error: jobError } = await loadScopedMcpJob(supabase, jobId, workspaceId, templateId);
    if (jobError || !job) return { ok: false, error: jobError ?? "Manual render job not found." };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("creative_render_jobs" as never) as any)
        .update({
            manual_external_url: externalUrl,
            manual_checklist: { ...job.manual_checklist, external_url_rights_safety_acknowledged: true },
            status: job.status === "mcp_generation_in_progress" ? "awaiting_manual_upload" : job.status,
        })
        .eq("id", jobId)
        .eq("workspace_id", workspaceId);
    if (error) return { ok: false, error: error.message };

    const eventError = await recordMcpFulfillmentEvent(supabase, {
        workspaceId,
        templateId,
        jobId,
        projectId: job.project_id,
        actorProfileId: context.userId,
        eventType: "mcp_external_url_attached",
        notes: "Operator attached a manually reviewed external Higgsfield result URL.",
        payload: { external_url: externalUrl, rights_ack: true, safety_ack: true },
    });
    if (eventError) return { ok: false, error: eventError };

    revalidatePath("/dashboard/creative-studio");
    return { ok: true, error: null };
}

export async function uploadMcpManualResultAction(
    _prevState: CreativeStudioActionState,
    formData: FormData,
): Promise<CreativeStudioActionState> {
    const context = await getCreativeStudioContext();
    if (!context) return { ok: false, error: "Creative Studio is available on Pro workspaces only." };

    const jobId = normalizeText(formData.get("job_id"), 80);
    const file = formData.get("result_file");
    if (!jobId) return { ok: false, error: "Manual render job is required." };
    if (!(file instanceof File) || file.size <= 0) return { ok: false, error: "A downloaded Higgsfield result file is required." };
    if (!checkboxAcknowledged(formData.get("rights_ack")) || !checkboxAcknowledged(formData.get("safety_ack"))) {
        return { ok: false, error: "Rights and safety checklist acknowledgement is required before upload." };
    }

    const workspaceId = context.activeWorkspace.id;
    const templateId = context.activeWorkspace.legacy_template_id || null;
    const supabase = await createClient();
    const { job, error: jobError } = await loadScopedMcpJob(supabase, jobId, workspaceId, templateId);
    if (jobError || !job) return { ok: false, error: jobError ?? "Manual render job not found." };

    try {
        const assetId = randomUUID();
        const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || (file.type.includes("image") ? "png" : "mp4");
        const storagePath = `workspaces/${workspaceId}/projects/${job.project_id}/jobs/${job.id}/${assetId}.${extension}`;
        const buffer = Buffer.from(await file.arrayBuffer());
        const checksum = sha256Hex(buffer);
        const mimeType = file.type || "application/octet-stream";

        const { error: uploadError } = await supabase.storage
            .from("creative-renders")
            .upload(storagePath, buffer, { contentType: mimeType, upsert: false });
        if (uploadError) return { ok: false, error: uploadError.message };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: insertError } = await (supabase.from("creative_assets" as never) as any).insert({
            id: assetId,
            workspace_id: workspaceId,
            template_id: templateId,
            project_id: job.project_id,
            brief_id: job.brief_id,
            prompt_id: job.prompt_id,
            provider_job_id: job.id,
            asset_type: normalizeJobKindForAsset(job.job_kind),
            status: "needs_review",
            storage_bucket: "creative-renders",
            storage_path: storagePath,
            mime_type: mimeType,
            checksum,
            rights_status: "needs_review",
            safety_status: "needs_review",
            metadata: {
                provider_mode: "mcp_manual",
                manual_provider: job.manual_provider,
                original_filename: file.name,
                upload_acknowledgements: { rights_ack: true, safety_ack: true },
                no_public_url_faked: true,
            },
        });
        if (insertError) {
            await supabase.storage.from("creative-renders").remove([storagePath]);
            return { ok: false, error: insertError.message };
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: jobUpdateError } = await (supabase.from("creative_render_jobs" as never) as any)
            .update({
                status: "uploaded_for_review",
                result_asset_id: assetId,
                manual_uploaded_by: context.userId,
                manual_uploaded_at: new Date().toISOString(),
                manual_checklist: { ...job.manual_checklist, result_uploaded_for_review: true, rights_ack: true, safety_ack: true },
                result_summary: { asset_id: assetId, storage_bucket: "creative-renders", storage_path: storagePath, checksum },
            })
            .eq("id", job.id)
            .eq("workspace_id", workspaceId);
        if (jobUpdateError) return { ok: false, error: jobUpdateError.message };

        const eventError = await recordMcpFulfillmentEvent(supabase, {
            workspaceId,
            templateId,
            jobId: job.id,
            projectId: job.project_id,
            assetId,
            actorProfileId: context.userId,
            eventType: "mcp_result_uploaded",
            notes: "Operator uploaded a manually produced Higgsfield result for workspace review.",
            payload: { storage_bucket: "creative-renders", storage_path: storagePath, checksum, mime_type: mimeType },
        });
        if (eventError) return { ok: false, error: eventError };

        revalidatePath("/dashboard/creative-studio");
        return { ok: true, error: null };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Failed to upload manual result." };
    }
}

export async function approveMcpManualResultAction(
    _prevState: CreativeStudioActionState,
    formData: FormData,
): Promise<CreativeStudioActionState> {
    const context = await getCreativeStudioContext();
    if (!context) return { ok: false, error: "Creative Studio is available on Pro workspaces only." };

    const jobId = normalizeText(formData.get("job_id"), 80);
    const assetId = normalizeText(formData.get("asset_id"), 80);
    if (!jobId || !assetId) return { ok: false, error: "Manual render job and asset are required." };
    if (!checkboxAcknowledged(formData.get("rights_ack")) || !checkboxAcknowledged(formData.get("safety_ack"))) {
        return { ok: false, error: "Rights and safety acknowledgement is required before approval." };
    }

    const workspaceId = context.activeWorkspace.id;
    const templateId = context.activeWorkspace.legacy_template_id || null;
    const supabase = await createClient();
    const { job, error: jobError } = await loadScopedMcpJob(supabase, jobId, workspaceId, templateId);
    if (jobError || !job) return { ok: false, error: jobError ?? "Manual render job not found." };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: assetError } = await (supabase.from("creative_assets" as never) as any)
        .update({
            status: "approved",
            rights_status: "approved",
            safety_status: "approved",
            approved_by_profile_id: context.userId,
            approved_at: new Date().toISOString(),
        })
        .eq("id", assetId)
        .eq("workspace_id", workspaceId)
        .eq("provider_job_id", jobId)
        .eq("status", "needs_review");
    if (assetError) return { ok: false, error: assetError.message };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: jobUpdateError } = await (supabase.from("creative_render_jobs" as never) as any)
        .update({ status: "approved", completed_at: new Date().toISOString(), result_asset_id: assetId })
        .eq("id", jobId)
        .eq("workspace_id", workspaceId);
    if (jobUpdateError) return { ok: false, error: jobUpdateError.message };

    const eventError = await recordMcpFulfillmentEvent(supabase, {
        workspaceId,
        templateId,
        jobId,
        projectId: job.project_id,
        assetId,
        actorProfileId: context.userId,
        eventType: "mcp_result_approved",
        notes: "Operator approved manually fulfilled Higgsfield result.",
        payload: { rights_ack: true, safety_ack: true },
    });
    if (eventError) return { ok: false, error: eventError };

    revalidatePath("/dashboard/creative-studio");
    return { ok: true, error: null };
}

export async function rejectMcpManualResultAction(
    _prevState: CreativeStudioActionState,
    formData: FormData,
): Promise<CreativeStudioActionState> {
    const context = await getCreativeStudioContext();
    if (!context) return { ok: false, error: "Creative Studio is available on Pro workspaces only." };

    const jobId = normalizeText(formData.get("job_id"), 80);
    const assetId = normalizeText(formData.get("asset_id"), 80);
    const notes = normalizeText(formData.get("notes"), 1000);
    if (!jobId || !assetId) return { ok: false, error: "Manual render job and asset are required." };

    const workspaceId = context.activeWorkspace.id;
    const templateId = context.activeWorkspace.legacy_template_id || null;
    const supabase = await createClient();
    const { job, error: jobError } = await loadScopedMcpJob(supabase, jobId, workspaceId, templateId);
    if (jobError || !job) return { ok: false, error: jobError ?? "Manual render job not found." };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: assetError } = await (supabase.from("creative_assets" as never) as any)
        .update({ status: "rejected" })
        .eq("id", assetId)
        .eq("workspace_id", workspaceId)
        .eq("provider_job_id", jobId)
        .eq("status", "needs_review");
    if (assetError) return { ok: false, error: assetError.message };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: jobUpdateError } = await (supabase.from("creative_render_jobs" as never) as any)
        .update({ status: "rejected" })
        .eq("id", jobId)
        .eq("workspace_id", workspaceId);
    if (jobUpdateError) return { ok: false, error: jobUpdateError.message };

    const eventError = await recordMcpFulfillmentEvent(supabase, {
        workspaceId,
        templateId,
        jobId,
        projectId: job.project_id,
        assetId,
        actorProfileId: context.userId,
        eventType: "mcp_result_rejected",
        notes: notes || "Operator rejected manually fulfilled Higgsfield result.",
        payload: { rejection_notes_present: Boolean(notes) },
    });
    if (eventError) return { ok: false, error: eventError };

    revalidatePath("/dashboard/creative-studio");
    return { ok: true, error: null };
}

export async function createCreativeProjectAction(
    _prevState: CreativeStudioActionState,
    formData: FormData,
): Promise<CreativeStudioActionState> {
    const context = await getCreativeStudioContext();
    if (!context) return { ok: false, error: "Creative Studio is available on Pro workspaces only." };

    const name = normalizeText(formData.get("name"), 160);
    const objective = normalizeText(formData.get("objective"), 2000);
    if (!name || !objective) return { ok: false, error: "Project name and objective are required." };

    try {
        const workspace = context.activeWorkspace;
        const supabase = await createClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from("creative_projects" as never) as any).insert({
            workspace_id: workspace.id,
            template_id: workspace.legacy_template_id || null,
            locale: normalizeLocale(formData.get("locale"), workspace.default_locale),
            name,
            objective,
            target_audience: nullableText(formData.get("target_audience"), 1000),
            target_channel: nullableText(formData.get("target_channel"), 120),
            status: "draft",
            created_by_profile_id: context.userId,
            metadata: { phase: "dashboard_shell" },
        });

        if (error) return { ok: false, error: error.message };
        revalidatePath("/dashboard/creative-studio");
        return { ok: true, error: null };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Failed to create project." };
    }
}

export async function createCreativeBriefAction(
    _prevState: CreativeStudioActionState,
    formData: FormData,
): Promise<CreativeStudioActionState> {
    const context = await getCreativeStudioContext();
    if (!context) return { ok: false, error: "Creative Studio is available on Pro workspaces only." };

    const projectId = normalizeText(formData.get("project_id"), 80);
    const title = normalizeText(formData.get("title"), 180);
    const briefMarkdown = normalizeText(formData.get("brief_markdown"), 8000);
    if (!projectId || !title || !briefMarkdown) {
        return { ok: false, error: "Project, title, and brief are required." };
    }

    try {
        const workspace = context.activeWorkspace;
        const templateId = workspace.legacy_template_id || null;
        const supabase = await createClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const projectQuery = (supabase.from("creative_projects" as never) as any)
            .select("id,workspace_id,template_id")
            .eq("id", projectId)
            .eq("workspace_id", workspace.id)
            .limit(1)
            .maybeSingle();
        const { data: project, error: projectError } = await projectQuery;

        if (projectError) return { ok: false, error: projectError.message };
        if (!project || !isRecord(project) || !templateMatches(project.template_id as string | null, templateId)) {
            return { ok: false, error: "Project is outside the active workspace/template scope." };
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from("creative_briefs" as never) as any).insert({
            workspace_id: workspace.id,
            template_id: templateId,
            project_id: projectId,
            source_module: nullableText(formData.get("source_module"), 80) ?? "creative_studio",
            source_entity_type: nullableText(formData.get("source_entity_type"), 80),
            title,
            brief_markdown: briefMarkdown,
            target_url: normalizeUrl(formData.get("target_url")),
            brand_rules: {},
            source_evidence_pack: {},
            utm: {},
            rights_requirements: {},
            status: "draft",
            metadata: { phase: "dashboard_shell" },
        });

        if (error) return { ok: false, error: error.message };
        revalidatePath("/dashboard/creative-studio");
        return { ok: true, error: null };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Failed to create brief." };
    }
}

export async function generateCreativeStrategyAction(
    _prevState: CreativeStudioActionState,
    formData: FormData,
): Promise<CreativeStudioActionState> {
    const context = await getCreativeStudioContext();
    if (!context) return { ok: false, error: "Creative Studio is available on Pro workspaces only." };

    const briefId = normalizeText(formData.get("brief_id"), 80);
    if (!briefId) return { ok: false, error: "Brief is required." };

    const workspace = context.activeWorkspace;
    const workspaceId = workspace.id;
    const templateId = workspace.legacy_template_id || null;
    const supabase = await createClient();

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: brief, error: briefError } = await (supabase.from("creative_briefs" as never) as any)
            .select("id,workspace_id,template_id,project_id,title,brief_markdown,brand_rules,source_evidence_pack,target_url,rights_requirements,creative_projects!inner(id,locale,target_audience,target_channel)")
            .eq("id", briefId)
            .eq("workspace_id", workspaceId)
            .limit(1)
            .maybeSingle();

        if (briefError) return { ok: false, error: briefError.message };
        if (!brief || !isRecord(brief) || !templateMatches(brief.template_id as string | null, templateId)) {
            return { ok: false, error: "Brief is outside the active workspace/template scope." };
        }

        const project = Array.isArray(brief.creative_projects) ? brief.creative_projects[0] : brief.creative_projects;
        const projectRecord = jsonRecord(project);
        const generation = await generateCreativeStrategyWithVertex({
            brief: {
                id: String(brief.id),
                workspaceId,
                templateId,
                projectId: String(brief.project_id),
                locale: typeof projectRecord.locale === "string" ? projectRecord.locale : workspace.default_locale,
                title: String(brief.title ?? "Untitled creative brief"),
                briefMarkdown: String(brief.brief_markdown ?? ""),
                targetUrl: typeof brief.target_url === "string" ? brief.target_url : null,
                targetChannel: typeof projectRecord.target_channel === "string" ? projectRecord.target_channel : null,
                targetAudience: typeof projectRecord.target_audience === "string" ? projectRecord.target_audience : null,
                brandRules: jsonRecord(brief.brand_rules),
                rightsRequirements: jsonRecord(brief.rights_requirements),
            },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: promptError } = await (supabase.from("creative_prompts" as never) as any).insert({
            workspace_id: workspaceId,
            template_id: templateId,
            project_id: String(brief.project_id),
            brief_id: briefId,
            source_model: generation.sourceModel,
            strategy_prompt: generation.manifest.strategy_prompt,
            provider_prompt: generation.manifest.provider_prompt,
            negative_prompt: generation.manifest.negative_prompt,
            scene_plan: generation.manifest.scene_plan,
            evaluator_plan: generation.manifest.evaluator_plan,
            prompt_hash: generation.manifest.prompt_hash,
            safety: generation.manifest.safety,
            evidence_pack: generation.manifest.evidence_pack,
            created_by_profile_id: context.userId,
        });
        if (promptError) return { ok: false, error: promptError.message };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("creative_briefs" as never) as any)
            .update({
                status: "strategy_ready",
                source_evidence_pack: generation.manifest.evidence_pack,
                metadata: {
                    strategy_phase: "phase_5",
                    latest_prompt_hash: generation.manifest.prompt_hash,
                    safety_status: generation.manifest.safety.status,
                    render_queueing: "blocked_until_human_approval",
                },
            })
            .eq("id", briefId)
            .eq("workspace_id", workspaceId);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("creative_review_events" as never) as any).insert({
            workspace_id: workspaceId,
            template_id: templateId,
            project_id: String(brief.project_id),
            event_type: generation.manifest.safety.status === "blocked" ? "safety_flagged" : "strategy_generated",
            actor_profile_id: context.userId,
            notes: "Creative strategy prompt manifest generated. No render job was queued.",
            payload: {
                prompt_hash: generation.manifest.prompt_hash,
                safety: generation.manifest.safety,
                source_model: generation.sourceModel,
                no_render_queueing: true,
            },
        });

        revalidatePath("/dashboard/creative-studio");
        return { ok: true, error: null };
    } catch (error) {
        if (error instanceof InsufficientAiBalanceError) return { ok: false, error: error.message };
        if (error instanceof WorkspaceAiRateLimitError) return { ok: false, error: error.message };
        return { ok: false, error: error instanceof Error ? error.message : "Failed to generate creative strategy." };
    }
}

export async function approveCreativeStrategyAction(
    _prevState: CreativeStudioActionState,
    formData: FormData,
): Promise<CreativeStudioActionState> {
    const context = await getCreativeStudioContext();
    if (!context) return { ok: false, error: "Creative Studio is available on Pro workspaces only." };

    const promptId = normalizeText(formData.get("prompt_id"), 80);
    if (!promptId) return { ok: false, error: "Prompt manifest is required." };

    const workspace = context.activeWorkspace;
    const workspaceId = workspace.id;
    const templateId = workspace.legacy_template_id || null;

    try {
        const supabase = await createClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: prompt, error: promptError } = await (supabase.from("creative_prompts" as never) as any)
            .select("id,workspace_id,template_id,project_id,brief_id,prompt_hash,safety")
            .eq("id", promptId)
            .eq("workspace_id", workspaceId)
            .limit(1)
            .maybeSingle();

        if (promptError) return { ok: false, error: promptError.message };
        if (!prompt || !isRecord(prompt) || !templateMatches(prompt.template_id as string | null, templateId)) {
            return { ok: false, error: "Prompt manifest is outside the active workspace/template scope." };
        }

        const safety = jsonRecord(prompt.safety);
        if (safety.status === "blocked") {
            return { ok: false, error: "Blocked prompt manifests require revision before approval." };
        }

        // This action records human strategy approval only. It intentionally does
        // not insert creative_render_jobs; render submission lands in a later phase.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("creative_briefs" as never) as any)
            .update({ status: "render_ready" })
            .eq("id", String(prompt.brief_id))
            .eq("workspace_id", workspaceId);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: eventError } = await (supabase.from("creative_review_events" as never) as any).insert({
            workspace_id: workspaceId,
            template_id: templateId,
            project_id: String(prompt.project_id),
            event_type: "strategy_generated",
            actor_profile_id: context.userId,
            notes: "Operator approved strategy prompt manifest. No render job was queued.",
            payload: {
                prompt_id: promptId,
                brief_id: String(prompt.brief_id),
                prompt_hash: String(prompt.prompt_hash),
                approval_type: "strategy_manifest_human_approval",
                no_render_queueing: true,
            },
        });

        if (eventError) return { ok: false, error: eventError.message };
        revalidatePath("/dashboard/creative-studio");
        return { ok: true, error: null };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Failed to approve creative strategy." };
    }
}
// --- Phase 8: Cross-module handoffs and asset approvals ---

export async function approveCreativeRenderAction(
    _prevState: CreativeStudioActionState,
    formData: FormData,
): Promise<CreativeStudioActionState> {
    const context = await getCreativeStudioContext();
    if (!context) return { ok: false, error: "Creative Studio is available on Pro workspaces only." };

    const jobId = normalizeText(formData.get("job_id"), 80);
    if (!jobId) return { ok: false, error: "Job is required." };

    try {
        const supabase = await createClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from("creative_render_jobs" as never) as any)
            .update({ status: "queued", priority: 100, run_after: new Date().toISOString() })
            .eq("id", jobId)
            .eq("workspace_id", context.activeWorkspace.id)
            .in("status", ["draft", "needs_manual_review"]);

        if (error) return { ok: false, error: error.message };
        revalidatePath("/dashboard/creative-studio");
        return { ok: true, error: null };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Failed to approve render." };
    }
}

export async function cancelCreativeRenderJobAction(
    _prevState: CreativeStudioActionState,
    formData: FormData,
): Promise<CreativeStudioActionState> {
    const context = await getCreativeStudioContext();
    if (!context) return { ok: false, error: "Creative Studio is available on Pro workspaces only." };

    const jobId = normalizeText(formData.get("job_id"), 80);
    if (!jobId) return { ok: false, error: "Job is required." };

    try {
        const supabase = await createClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from("creative_render_jobs" as never) as any)
            .update({ status: "cancelled" })
            .eq("id", jobId)
            .eq("workspace_id", context.activeWorkspace.id)
            .in("status", ["queued", "running", "provider_processing", "needs_manual_review"]);

        if (error) return { ok: false, error: error.message };
        revalidatePath("/dashboard/creative-studio");
        return { ok: true, error: null };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Failed to cancel render." };
    }
}

export async function approveCreativeAssetAction(
    _prevState: CreativeStudioActionState,
    formData: FormData,
): Promise<CreativeStudioActionState> {
    const context = await getCreativeStudioContext();
    if (!context) return { ok: false, error: "Creative Studio is available on Pro workspaces only." };

    const assetId = normalizeText(formData.get("asset_id"), 80);
    if (!assetId) return { ok: false, error: "Asset is required." };

    try {
        const supabase = await createClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from("creative_assets" as never) as any)
            .update({
                status: "approved",
                rights_status: "approved",
                safety_status: "approved",
                approved_by_profile_id: context.userId,
                approved_at: new Date().toISOString()
            })
            .eq("id", assetId)
            .eq("workspace_id", context.activeWorkspace.id)
            .eq("status", "needs_review");

        if (error) return { ok: false, error: error.message };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("creative_review_events" as never) as any).insert({
            workspace_id: context.activeWorkspace.id,
            template_id: context.activeWorkspace.legacy_template_id || null,
            asset_id: assetId,
            event_type: "render_approved",
            actor_profile_id: context.userId,
            notes: "Operator approved final creative asset."
        });

        revalidatePath("/dashboard/creative-studio");
        return { ok: true, error: null };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Failed to approve asset." };
    }
}

export async function rejectCreativeAssetAction(
    _prevState: CreativeStudioActionState,
    formData: FormData,
): Promise<CreativeStudioActionState> {
    const context = await getCreativeStudioContext();
    if (!context) return { ok: false, error: "Creative Studio is available on Pro workspaces only." };

    const assetId = normalizeText(formData.get("asset_id"), 80);
    const notes = normalizeText(formData.get("notes"), 1000);
    if (!assetId) return { ok: false, error: "Asset is required." };

    try {
        const supabase = await createClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from("creative_assets" as never) as any)
            .update({ status: "rejected" })
            .eq("id", assetId)
            .eq("workspace_id", context.activeWorkspace.id)
            .eq("status", "needs_review");

        if (error) return { ok: false, error: error.message };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("creative_review_events" as never) as any).insert({
            workspace_id: context.activeWorkspace.id,
            template_id: context.activeWorkspace.legacy_template_id || null,
            asset_id: assetId,
            event_type: "render_rejected",
            actor_profile_id: context.userId,
            notes: notes || "Operator rejected creative asset."
        });

        revalidatePath("/dashboard/creative-studio");
        return { ok: true, error: null };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Failed to reject asset." };
    }
}

async function createHandoffLink(
    formData: FormData,
    targetModule: string,
    targetEntityType?: string | null,
    targetEntityId?: string | null,
    targetUrl?: string | null
): Promise<CreativeStudioActionState> {
    const context = await getCreativeStudioContext();
    if (!context) return { ok: false, error: "Creative Studio is available on Pro workspaces only." };

    const assetId = normalizeText(formData.get("asset_id"), 80);
    if (!assetId) return { ok: false, error: "Asset is required." };

    try {
        const supabase = await createClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: asset, error: assetError } = await (supabase.from("creative_assets" as never) as any)
            .select("id, status")
            .eq("id", assetId)
            .eq("workspace_id", context.activeWorkspace.id)
            .maybeSingle();

        if (assetError) return { ok: false, error: assetError.message };
        if (!asset || asset.status !== "approved") return { ok: false, error: "Asset must be approved before handoff." };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from("creative_channel_links" as never) as any).insert({
            workspace_id: context.activeWorkspace.id,
            template_id: context.activeWorkspace.legacy_template_id || null,
            asset_id: assetId,
            target_module: targetModule,
            target_entity_type: targetEntityType || null,
            target_entity_id: targetEntityId || null,
            target_url: targetUrl || null,
            status: "suggested",
            metadata: { phase: "handoff_created", handoff_by: context.userId }
        });

        if (error) return { ok: false, error: error.message };
        revalidatePath("/dashboard/creative-studio");
        return { ok: true, error: null };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Failed to create handoff link." };
    }
}

export async function attachCreativeAssetToContentAction(_prevState: CreativeStudioActionState, formData: FormData) {
    return createHandoffLink(formData, "content", "content_item", normalizeText(formData.get("content_id"), 80));
}

export async function createNewsletterCampaignFromCreativeAssetAction(_prevState: CreativeStudioActionState, formData: FormData) {
    return createHandoffLink(formData, "newsletter", "draft_campaign");
}

export async function createExternalPublishingAssetFromCreativeAssetAction(_prevState: CreativeStudioActionState, formData: FormData) {
    return createHandoffLink(formData, "external_publishing", "draft_package");
}

export async function createOutreachAssetAttachmentAction(_prevState: CreativeStudioActionState, formData: FormData) {
    return createHandoffLink(formData, "outreach", "attachment_suggestion");
}

export async function createPopupCreativeVariantAction(_prevState: CreativeStudioActionState, formData: FormData) {
    return createHandoffLink(formData, "popup", "draft_variant");
}

export async function markCreativeAssetManuallyPublishedAction(_prevState: CreativeStudioActionState, formData: FormData) {
    const url = normalizeUrl(formData.get("target_url"));
    if (!url) return { ok: false, error: "Valid target URL is required for manual publish record." };
    return createHandoffLink(formData, "manual_export", undefined, undefined, url);
}
