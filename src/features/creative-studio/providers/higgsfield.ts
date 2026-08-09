import { getCreativeRenderProviderConfig, getHiggsfieldDisabledReason } from "./config";
import type {
    CreativeRenderDownloadResult,
    CreativeRenderProvider,
    CreativeRenderStatusResult,
    CreativeRenderSubmitResult,
    CreativeRenderWebhookResult,
} from "./types";
import { CreativeRenderProviderError } from "./types";

/**
 * Higgsfield adapter scaffold.
 *
 * Missing official API details to verify before implementing live transport:
 * - Stable API base URL and versioned render submit/status endpoints.
 * - Authentication header format and account/workspace scoping model.
 * - Request schema for images, videos, reference images, aspect ratio, duration, seed, and model IDs.
 * - Provider status strings, retryable failure codes, cancellation semantics, and idempotency support.
 * - Webhook signature algorithm, timestamp/replay headers, event IDs, and payload schema.
 * - Output URL lifecycle, allowed hostnames, MIME guarantees, max sizes, and pricing metadata.
 */
export class HiggsfieldCreativeRenderProvider implements CreativeRenderProvider {
    readonly id = "higgsfield" as const;

    private assertEnabled(): never {
        const config = getCreativeRenderProviderConfig().higgsfield;
        const reason = getHiggsfieldDisabledReason(config) ?? "Higgsfield official API contract is not implemented yet.";
        throw new CreativeRenderProviderError(reason, "higgsfield_disabled", this.id, false);
    }

    async submit(): Promise<CreativeRenderSubmitResult> {
        this.assertEnabled();
    }

    async getStatus(): Promise<CreativeRenderStatusResult> {
        this.assertEnabled();
    }

    async normalizeWebhook(): Promise<CreativeRenderWebhookResult> {
        this.assertEnabled();
    }

    async downloadResult(): Promise<CreativeRenderDownloadResult> {
        this.assertEnabled();
    }
}

export function createHiggsfieldCreativeRenderProvider(): CreativeRenderProvider {
    return new HiggsfieldCreativeRenderProvider();
}
