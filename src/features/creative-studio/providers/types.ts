export type CreativeRenderProviderId = "fake" | "higgsfield";

export const CREATIVE_RENDER_PROVIDER_MODES = [
    "api_auto",
    "mcp_manual",
    "mcp_bridge_experimental",
    "fake",
] as const;

export type CreativeRenderProviderMode = (typeof CREATIVE_RENDER_PROVIDER_MODES)[number];

export const CREATIVE_MANUAL_PROVIDERS = ["higgsfield_mcp"] as const;

export type CreativeManualProvider = (typeof CREATIVE_MANUAL_PROVIDERS)[number];

export const CREATIVE_MANUAL_CREDIT_SOURCES = ["operator_creator_credits", "client_creator_credits", "unknown"] as const;

export type CreativeManualCreditSource = (typeof CREATIVE_MANUAL_CREDIT_SOURCES)[number];

export type CreativeRenderJobKind = "image" | "video" | "storyboard" | "social_cutdown";

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

export type CreativeProviderRawStatus = string | null | undefined;

export interface CreativeRenderScope {
    workspaceId: string;
    /** Keep nullable because current content/template records allow null template_id. */
    templateId: string | null;
    projectId?: string | null;
    briefId?: string | null;
    promptId?: string | null;
}

export interface CreativeRenderProviderMetadata {
    provider: CreativeRenderProviderId;
    providerMode?: CreativeRenderProviderMode;
    manualProvider?: CreativeManualProvider;
    model: string;
    requestId?: string;
    raw?: unknown;
}

export function isCreativeRenderProviderMode(value: unknown): value is CreativeRenderProviderMode {
    return typeof value === "string" && CREATIVE_RENDER_PROVIDER_MODES.includes(value as CreativeRenderProviderMode);
}

export function isCreativeManualProvider(value: unknown): value is CreativeManualProvider {
    return typeof value === "string" && CREATIVE_MANUAL_PROVIDERS.includes(value as CreativeManualProvider);
}

export function isCreativeManualCreditSource(value: unknown): value is CreativeManualCreditSource {
    return typeof value === "string" && CREATIVE_MANUAL_CREDIT_SOURCES.includes(value as CreativeManualCreditSource);
}

export interface CreativeRenderSubmitInput extends CreativeRenderScope {
    jobId: string;
    idempotencyKey: string;
    jobKind: CreativeRenderJobKind;
    providerModel: string;
    prompt: string;
    negativePrompt?: string | null;
    aspectRatio?: string | null;
    durationSeconds?: number | null;
    seed?: number | null;
    /** Approved, provider-specific options assembled by server/worker code only. */
    providerOptions?: Record<string, unknown>;
}

export interface CreativeRenderSubmitResult {
    provider: CreativeRenderProviderId;
    providerJobId: string;
    status: CreativeRenderStatus;
    submittedAt: string;
    estimatedCostMillicents?: number | null;
    metadata?: CreativeRenderProviderMetadata;
}

export interface CreativeRenderStatusInput extends CreativeRenderScope {
    jobId: string;
    providerJobId: string;
}

export interface CreativeRenderStatusResult {
    provider: CreativeRenderProviderId;
    providerJobId: string;
    status: CreativeRenderStatus;
    rawStatus?: CreativeProviderRawStatus;
    progressPercent?: number | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    resultUrls?: string[];
    metadata?: CreativeRenderProviderMetadata;
}

export interface CreativeRenderWebhookInput {
    headers: Headers;
    rawBody: string;
    receivedAt: string;
}

export interface CreativeRenderWebhookResult {
    provider: CreativeRenderProviderId;
    providerEventId?: string | null;
    providerJobId?: string | null;
    status?: CreativeRenderStatus;
    rawStatus?: CreativeProviderRawStatus;
    signatureValid: boolean;
    idempotencyKey?: string | null;
    payload: unknown;
}

export interface CreativeRenderDownloadInput extends CreativeRenderScope {
    jobId: string;
    providerJobId: string;
    /** Provider-owned URL selected from a trusted provider response, never client input. */
    resultUrl?: string;
}

export interface CreativeRenderDownloadResult {
    provider: CreativeRenderProviderId;
    providerJobId: string;
    bytes: Uint8Array;
    mimeType: string;
    fileName: string;
    checksumSha256?: string;
    metadata?: CreativeRenderProviderMetadata;
}

export interface CreativeRenderProvider {
    readonly id: CreativeRenderProviderId;
    submit(input: CreativeRenderSubmitInput): Promise<CreativeRenderSubmitResult>;
    getStatus(input: CreativeRenderStatusInput): Promise<CreativeRenderStatusResult>;
    normalizeWebhook(input: CreativeRenderWebhookInput): Promise<CreativeRenderWebhookResult>;
    downloadResult(input: CreativeRenderDownloadInput): Promise<CreativeRenderDownloadResult>;
}

export class CreativeRenderProviderError extends Error {
    constructor(
        message: string,
        readonly code: string,
        readonly provider: CreativeRenderProviderId,
        readonly retryable = false,
    ) {
        super(message);
        this.name = "CreativeRenderProviderError";
    }
}
