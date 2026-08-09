import type { CreativePromptManifest } from "../prompt-compiler";
import type {
    CreativeManualCreditSource,
    CreativeManualProvider,
    CreativeRenderJobKind,
    CreativeRenderProviderMode,
} from "./types";
import {
    isCreativeManualCreditSource,
    isCreativeManualProvider,
    isCreativeRenderProviderMode,
} from "./types";

export const HIGGSFIELD_MCP_SERVER_URL = "https://mcp.higgsfield.ai/mcp" as const;

export const MCP_MANUAL_OPERATOR_WARNING = [
    "Operator copy/paste instruction only.",
    "The backend must not automate the consumer Higgsfield website, MCP host, browser, cookies, sessions, or creator-account credentials.",
    "This pack contains prompts and checklist metadata only; no Higgsfield API or MCP call is made while generating it.",
].join(" ");

export interface CreativeMcpManualJobLike {
    id: string;
    workspace_id: string;
    template_id: string | null;
    project_id: string;
    brief_id?: string | null;
    prompt_id?: string | null;
    job_kind: CreativeRenderJobKind | string;
    provider_model?: string | null;
    duration_seconds?: number | null;
    provider_request?: Record<string, unknown> | null;
}

export interface CreativeMcpProductionPackInput {
    manifest: Pick<CreativePromptManifest, "provider_prompt" | "negative_prompt" | "scene_plan" | "evaluator_plan" | "prompt_hash" | "safety">;
    job: CreativeMcpManualJobLike;
    manualProvider?: CreativeManualProvider;
    providerMode?: Extract<CreativeRenderProviderMode, "mcp_manual" | "mcp_bridge_experimental">;
    manualCreditSource?: CreativeManualCreditSource;
    operatorNotes?: string | null;
}

export interface CreativeMcpProductionPack {
    schema: "creative_studio_mcp_production_pack_v1";
    providerMode: Extract<CreativeRenderProviderMode, "mcp_manual" | "mcp_bridge_experimental">;
    manualProvider: CreativeManualProvider;
    mcpServerUrl: typeof HIGGSFIELD_MCP_SERVER_URL;
    warning: string;
    scope: {
        workspaceId: string;
        templateId: string | null;
        projectId: string;
        briefId: string | null;
        promptId: string | null;
        jobId: string;
    };
    render: {
        jobKind: string;
        providerModel: string | null;
        prompt: string;
        negativePrompt: string;
        durationSeconds: number | null;
        promptHash: string;
        scenePlan: Record<string, unknown>;
    };
    operatorInstructions: {
        steps: string[];
        checklist: Record<string, boolean>;
        expectedNextStatus: "awaiting_manual_upload";
        manualCreditSource: CreativeManualCreditSource;
        notes: string | null;
    };
    review: {
        evaluatorPlan: Record<string, unknown>;
        safety: CreativePromptManifest["safety"];
    };
}

export function buildCreativeMcpCommandText(pack: CreativeMcpProductionPack): string {
    const lines = [
        "Creative Studio Higgsfield MCP Manual Fulfillment",
        `MCP server URL: ${pack.mcpServerUrl}`,
        "",
        "Guardrails:",
        "- Do not paste Higgsfield cookies, sessions, browser credentials, MCP auth tokens, or account secrets into the workspace.",
        "- Use the operator's already signed-in MCP host manually; do not automate Higgsfield, Claude, or any MCP host.",
        "- Download the generated result locally, then upload it back into the workspace for review.",
        "",
        "Job scope:",
        `- workspace_id: ${pack.scope.workspaceId}`,
        `- template_id: ${pack.scope.templateId ?? "null"}`,
        `- project_id: ${pack.scope.projectId}`,
        `- brief_id: ${pack.scope.briefId ?? "null"}`,
        `- prompt_id: ${pack.scope.promptId ?? "null"}`,
        `- job_id: ${pack.scope.jobId}`,
        "",
        "Render request:",
        `- kind: ${pack.render.jobKind}`,
        `- model: ${pack.render.providerModel ?? "operator choice"}`,
        `- duration_seconds: ${pack.render.durationSeconds ?? "operator choice"}`,
        `- prompt_hash: ${pack.render.promptHash}`,
        "",
        "Prompt:",
        pack.render.prompt,
        "",
        "Negative prompt:",
        pack.render.negativePrompt || "None provided.",
        "",
        "Scene plan JSON:",
        JSON.stringify(pack.render.scenePlan, null, 2),
    ];

    return lines.join("\n");
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string | null {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizeCreativeRenderProviderMode(value: unknown, fallback: CreativeRenderProviderMode = "api_auto"): CreativeRenderProviderMode {
    return isCreativeRenderProviderMode(value) ? value : fallback;
}

export function normalizeCreativeManualProvider(value: unknown, fallback: CreativeManualProvider = "higgsfield_mcp"): CreativeManualProvider {
    return isCreativeManualProvider(value) ? value : fallback;
}

export function normalizeCreativeManualCreditSource(value: unknown, fallback: CreativeManualCreditSource = "unknown"): CreativeManualCreditSource {
    return isCreativeManualCreditSource(value) ? value : fallback;
}

export function buildCreativeMcpProductionPack(input: CreativeMcpProductionPackInput): CreativeMcpProductionPack {
    const request = asRecord(input.job.provider_request);
    const providerMode = input.providerMode === "mcp_bridge_experimental" ? "mcp_bridge_experimental" : "mcp_manual";

    return {
        schema: "creative_studio_mcp_production_pack_v1",
        providerMode,
        manualProvider: normalizeCreativeManualProvider(input.manualProvider),
        mcpServerUrl: HIGGSFIELD_MCP_SERVER_URL,
        warning: MCP_MANUAL_OPERATOR_WARNING,
        scope: {
            workspaceId: input.job.workspace_id,
            templateId: input.job.template_id,
            projectId: input.job.project_id,
            briefId: input.job.brief_id ?? null,
            promptId: input.job.prompt_id ?? null,
            jobId: input.job.id,
        },
        render: {
            jobKind: input.job.job_kind,
            providerModel: input.job.provider_model ?? stringValue(request.providerModel),
            prompt: stringValue(request.prompt) ?? stringValue(request.providerPrompt) ?? input.manifest.provider_prompt,
            negativePrompt: stringValue(request.negativePrompt) ?? input.manifest.negative_prompt,
            durationSeconds: numberValue(request.durationSeconds) ?? input.job.duration_seconds ?? null,
            promptHash: input.manifest.prompt_hash,
            scenePlan: asRecord(input.manifest.scene_plan),
        },
        operatorInstructions: {
            steps: [
                `Open the Higgsfield MCP server in the operator-approved MCP client: ${HIGGSFIELD_MCP_SERVER_URL}`,
                "Copy the render prompt and negative prompt from this pack into the Higgsfield MCP flow manually.",
                "Use paid creator credits only from the intended operator/client account; do not paste credentials into the workspace.",
                "When Higgsfield completes, upload the downloaded result back into Creative Studio for review.",
                "Attach an external Higgsfield URL only if it is safe to share with the workspace operators.",
            ],
            checklist: {
                prompt_copied_by_operator: false,
                no_credentials_stored_in_isystem: true,
                no_backend_mcp_or_browser_automation: true,
                creator_credit_source_confirmed: input.manualCreditSource !== undefined,
                result_uploaded_for_review: false,
            },
            expectedNextStatus: "awaiting_manual_upload",
            manualCreditSource: normalizeCreativeManualCreditSource(input.manualCreditSource),
            notes: input.operatorNotes?.trim() || null,
        },
        review: {
            evaluatorPlan: asRecord(input.manifest.evaluator_plan),
            safety: input.manifest.safety,
        },
    };
}
