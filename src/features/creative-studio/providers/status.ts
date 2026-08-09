import type { CreativeProviderRawStatus, CreativeRenderStatus } from "./types";

const STATUS_ALIASES: Record<string, CreativeRenderStatus> = {
    draft: "draft",
    prompt_ready: "prompt_ready",
    promptready: "prompt_ready",
    created: "queued",
    queued: "queued",
    pending: "queued",
    scheduled: "queued",
    running: "running",
    started: "running",
    submitted: "provider_submitted",
    provider_submitted: "provider_submitted",
    accepted: "provider_submitted",
    processing: "provider_processing",
    provider_processing: "provider_processing",
    generating: "provider_processing",
    rendering: "provider_processing",
    mcp_manual_required: "mcp_manual_required",
    manual_required: "mcp_manual_required",
    mcp_generation_in_progress: "mcp_generation_in_progress",
    manual_generation_started: "mcp_generation_in_progress",
    manual_generation_in_progress: "mcp_generation_in_progress",
    awaiting_manual_upload: "awaiting_manual_upload",
    awaiting_upload: "awaiting_manual_upload",
    uploaded_for_review: "uploaded_for_review",
    manual_upload_complete: "uploaded_for_review",
    approved: "approved",
    rejected: "rejected",
    completed: "completed",
    complete: "completed",
    succeeded: "completed",
    success: "completed",
    done: "completed",
    failed: "failed",
    error: "failed",
    errored: "failed",
    cancelled: "cancelled",
    canceled: "cancelled",
    superseded: "superseded",
    needs_manual_review: "needs_manual_review",
    manual_review: "needs_manual_review",
};

export const CREATIVE_RENDER_TERMINAL_STATUSES = [
    "approved",
    "rejected",
    "completed",
    "failed",
    "cancelled",
    "superseded",
] as const satisfies CreativeRenderStatus[];

export const CREATIVE_RENDER_PENDING_STATUSES = [
    "draft",
    "prompt_ready",
    "queued",
    "running",
    "provider_submitted",
    "provider_processing",
    "mcp_manual_required",
    "mcp_generation_in_progress",
    "awaiting_manual_upload",
    "uploaded_for_review",
    "needs_manual_review",
] as const satisfies CreativeRenderStatus[];

export function normalizeCreativeRenderStatus(rawStatus: CreativeProviderRawStatus): CreativeRenderStatus {
    const normalized = rawStatus?.trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (!normalized) return "needs_manual_review";
    return STATUS_ALIASES[normalized] ?? "needs_manual_review";
}

export function isCreativeRenderTerminalStatus(status: CreativeRenderStatus): boolean {
    return CREATIVE_RENDER_TERMINAL_STATUSES.includes(status as (typeof CREATIVE_RENDER_TERMINAL_STATUSES)[number]);
}

export function isCreativeRenderPendingStatus(status: CreativeRenderStatus): boolean {
    return CREATIVE_RENDER_PENDING_STATUSES.includes(status as (typeof CREATIVE_RENDER_PENDING_STATUSES)[number]);
}
