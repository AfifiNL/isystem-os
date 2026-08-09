import { createHash } from "node:crypto";

import { normalizeCreativeRenderStatus } from "./status";
import type {
    CreativeRenderDownloadInput,
    CreativeRenderDownloadResult,
    CreativeRenderProvider,
    CreativeRenderProviderId,
    CreativeRenderStatusInput,
    CreativeRenderStatusResult,
    CreativeRenderSubmitInput,
    CreativeRenderSubmitResult,
    CreativeRenderWebhookInput,
    CreativeRenderWebhookResult,
} from "./types";

const FAKE_PROVIDER_ID: CreativeRenderProviderId = "fake";

function deterministicProviderJobId(input: Pick<CreativeRenderSubmitInput, "workspaceId" | "templateId" | "jobId" | "idempotencyKey">): string {
    const hash = createHash("sha256")
        .update(input.workspaceId)
        .update(input.templateId ?? "")
        .update(input.jobId)
        .update(input.idempotencyKey)
        .digest("hex")
        .slice(0, 24);
    return `fake_${hash}`;
}

function buildFakeBytes(input: CreativeRenderDownloadInput): Uint8Array {
    const payload = JSON.stringify({
        provider: FAKE_PROVIDER_ID,
        providerJobId: input.providerJobId,
        workspaceId: input.workspaceId,
        templateId: input.templateId,
        jobId: input.jobId,
        generatedAt: "deterministic-fake-render",
    }, null, 2);
    return new TextEncoder().encode(payload);
}

export const fakeCreativeRenderProvider: CreativeRenderProvider = {
    id: FAKE_PROVIDER_ID,

    async submit(input: CreativeRenderSubmitInput): Promise<CreativeRenderSubmitResult> {
        return {
            provider: FAKE_PROVIDER_ID,
            providerJobId: deterministicProviderJobId(input),
            status: "provider_submitted",
            submittedAt: new Date().toISOString(),
            estimatedCostMillicents: 0,
            metadata: {
                provider: FAKE_PROVIDER_ID,
                model: input.providerModel,
                requestId: input.idempotencyKey,
                raw: {
                    jobKind: input.jobKind,
                    aspectRatio: input.aspectRatio ?? null,
                    durationSeconds: input.durationSeconds ?? null,
                    promptHash: createHash("sha256").update(input.prompt).digest("hex"),
                },
            },
        };
    },

    async getStatus(input: CreativeRenderStatusInput): Promise<CreativeRenderStatusResult> {
        return {
            provider: FAKE_PROVIDER_ID,
            providerJobId: input.providerJobId,
            status: normalizeCreativeRenderStatus("completed"),
            rawStatus: "completed",
            progressPercent: 100,
            resultUrls: [`fake://creative-render/${encodeURIComponent(input.providerJobId)}`],
            metadata: {
                provider: FAKE_PROVIDER_ID,
                model: "fake-render-v1",
                raw: { jobId: input.jobId, workspaceId: input.workspaceId, templateId: input.templateId },
            },
        };
    },

    async normalizeWebhook(input: CreativeRenderWebhookInput): Promise<CreativeRenderWebhookResult> {
        const payload = input.rawBody.trim() ? JSON.parse(input.rawBody) as Record<string, unknown> : {};
        const rawStatus = typeof payload.status === "string" ? payload.status : "completed";
        return {
            provider: FAKE_PROVIDER_ID,
            providerEventId: typeof payload.eventId === "string" ? payload.eventId : null,
            providerJobId: typeof payload.providerJobId === "string" ? payload.providerJobId : null,
            status: normalizeCreativeRenderStatus(rawStatus),
            rawStatus,
            signatureValid: true,
            idempotencyKey: typeof payload.idempotencyKey === "string" ? payload.idempotencyKey : null,
            payload: { ...payload, receivedAt: input.receivedAt },
        };
    },

    async downloadResult(input: CreativeRenderDownloadInput): Promise<CreativeRenderDownloadResult> {
        const bytes = buildFakeBytes(input);
        return {
            provider: FAKE_PROVIDER_ID,
            providerJobId: input.providerJobId,
            bytes,
            mimeType: "application/json",
            fileName: `${input.providerJobId}.json`,
            checksumSha256: createHash("sha256").update(bytes).digest("hex"),
            metadata: {
                provider: FAKE_PROVIDER_ID,
                model: "fake-render-v1",
                raw: { resultUrl: input.resultUrl ?? null },
            },
        };
    },
};

export function createFakeCreativeRenderProvider(): CreativeRenderProvider {
    return fakeCreativeRenderProvider;
}
