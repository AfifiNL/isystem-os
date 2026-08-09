export type AiProviderErrorCode =
    | "auth_config_missing"
    | "permission_denied"
    | "quota_rate_limit"
    | "model_region_unavailable"
    | "safety_blocked"
    | "schema_mismatch"
    | "timeout"
    | "empty_output"
    | "provider_unavailable";

export interface AiProviderErrorDetails {
    code: AiProviderErrorCode;
    message: string;
    provider?: string;
    modelAlias?: string;
    modelId?: string;
    region?: string;
    status?: number;
    retryable: boolean;
    cause?: unknown;
}

export class AiProviderError extends Error {
    readonly code: AiProviderErrorCode;
    readonly provider?: string;
    readonly modelAlias?: string;
    readonly modelId?: string;
    readonly region?: string;
    readonly status?: number;
    readonly retryable: boolean;
    readonly cause?: unknown;

    constructor(details: AiProviderErrorDetails) {
        super(details.message);
        this.name = "AiProviderError";
        this.code = details.code;
        this.provider = details.provider;
        this.modelAlias = details.modelAlias;
        this.modelId = details.modelId;
        this.region = details.region;
        this.status = details.status;
        this.retryable = details.retryable;
        this.cause = details.cause;
    }

    toJSON(): Omit<AiProviderErrorDetails, "cause"> {
        return {
            code: this.code,
            message: this.message,
            provider: this.provider,
            modelAlias: this.modelAlias,
            modelId: this.modelId,
            region: this.region,
            status: this.status,
            retryable: this.retryable,
        };
    }
}

export interface NormalizeAiProviderErrorContext {
    provider?: string;
    modelAlias?: string;
    modelId?: string;
    region?: string;
}

export type AiProviderErrorTelemetry = Pick<
    AiProviderErrorDetails,
    "code" | "provider" | "modelAlias" | "modelId" | "region" | "status" | "retryable"
>;

function errorStatus(error: unknown): number | undefined {
    if (!error || typeof error !== "object") return undefined;
    const maybe = error as { status?: unknown; statusCode?: unknown; code?: unknown };
    if (typeof maybe.status === "number") return maybe.status;
    if (typeof maybe.statusCode === "number") return maybe.statusCode;
    if (typeof maybe.code === "number") return maybe.code;
    return undefined;
}

function errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    try {
        return JSON.stringify(error);
    } catch {
        return "Unknown AI provider error.";
    }
}

function classifyProviderError(message: string, status?: number): Pick<AiProviderErrorDetails, "code" | "retryable"> {
    const lower = message.toLowerCase();

    if (status === 401 || /credential|authentication|unauthenticated|api key|adc|application default/i.test(message)) {
        return { code: "auth_config_missing", retryable: false };
    }
    if (status === 403 || /permission|forbidden|iam|access denied/i.test(message)) {
        return { code: "permission_denied", retryable: false };
    }
    if (status === 429 || /quota|rate limit|resource exhausted|too many requests/i.test(message)) {
        return { code: "quota_rate_limit", retryable: true };
    }
    if (status === 404 || /not found|not available|unsupported|region|location|model.*unavailable/i.test(message)) {
        return { code: "model_region_unavailable", retryable: false };
    }
    if (/safety|blocked|harm|content filter|finishreason.*safety/i.test(message)) {
        return { code: "safety_blocked", retryable: false };
    }
    if (/schema|json|structured|validation|zod|no object generated/i.test(message)) {
        return { code: "schema_mismatch", retryable: false };
    }
    if (status === 408 || /timeout|timed out|deadline|aborterror|aborted/i.test(message)) {
        return { code: "timeout", retryable: true };
    }
    if (/empty|no output|no text|no image|no transcript|no speech|no audio/i.test(lower)) {
        return { code: "empty_output", retryable: true };
    }
    return { code: "provider_unavailable", retryable: status === undefined || status >= 500 };
}

export function normalizeAiProviderError(
    error: unknown,
    context: NormalizeAiProviderErrorContext = {},
): AiProviderError {
    if (error instanceof AiProviderError) return error;

    const status = errorStatus(error);
    const message = errorMessage(error);
    const classified = classifyProviderError(message, status);

    return new AiProviderError({
        ...classified,
        message,
        provider: context.provider,
        modelAlias: context.modelAlias,
        modelId: context.modelId,
        region: context.region,
        status,
        cause: error,
    });
}

/**
 * Returns the provider diagnostics that are safe to persist or emit to shared
 * logs. Raw provider messages can contain generated text or excerpts from a
 * customer prompt, so they stay out of audit and metering metadata.
 */
export function getAiProviderErrorTelemetry(
    error: unknown,
    context: NormalizeAiProviderErrorContext = {},
): AiProviderErrorTelemetry {
    const normalized = normalizeAiProviderError(error, context);
    return {
        code: normalized.code,
        provider: normalized.provider,
        modelAlias: normalized.modelAlias,
        modelId: normalized.modelId,
        region: normalized.region,
        status: normalized.status,
        retryable: normalized.retryable,
    };
}

export function createAiProviderConfigError(message: string, context: NormalizeAiProviderErrorContext = {}): AiProviderError {
    return new AiProviderError({
        code: "auth_config_missing",
        message,
        provider: context.provider,
        modelAlias: context.modelAlias,
        modelId: context.modelId,
        region: context.region,
        retryable: false,
    });
}
