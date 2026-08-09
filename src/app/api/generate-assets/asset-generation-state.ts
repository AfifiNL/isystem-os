export type AssetGenerationStatus = "succeeded" | "partial" | "failed" | "skipped";

export type AssetGenerationFailureStage =
    | "prompt"
    | "image_generation"
    | "optimization"
    | "upload"
    | "fallback_generation"
    | "fallback_upload"
    | "metadata_update";

export interface AssetGenerationFailure {
    key: string;
    stage: AssetGenerationFailureStage;
    message: string;
    category?: string;
    provider?: string;
    model_alias?: string;
    model_id?: string;
    region?: string;
    retryable?: boolean;
}

export interface AssetGenerationFallback {
    key: string;
    status: "succeeded" | "failed";
    source: "deterministic_svg";
    reason: string;
    url?: string | null;
    message?: string;
}

export interface AssetGenerationState {
    status: AssetGenerationStatus;
    requested_images: boolean;
    requested_keys: string[];
    generated_keys: string[];
    failed_keys: string[];
    failures: AssetGenerationFailure[];
    fallbacks: AssetGenerationFallback[];
    featured_image_url: string | null;
    recoverable: boolean;
    updated_at: string;
}

export function buildAssetGenerationState(args: {
    requestedImages: boolean;
    requestedKeys: string[];
    generatedKeys: string[];
    failures: AssetGenerationFailure[];
    fallbacks?: AssetGenerationFallback[];
    featuredImageUrl?: string | null;
    generatedAt?: string;
}): AssetGenerationState {
    const generatedKeys = Array.from(new Set(args.generatedKeys));
    const explicitFailedKeys = args.failures
        .map((failure) => failure.key)
        .filter((key) => Boolean(key) && !generatedKeys.includes(key));
    const missingKeys = args.requestedKeys.filter((key) => !generatedKeys.includes(key));
    const failedKeys = Array.from(new Set([...explicitFailedKeys, ...missingKeys]));
    const hasRequestedWork = args.requestedImages && args.requestedKeys.length > 0;

    let status: AssetGenerationStatus = "skipped";
    if (hasRequestedWork) {
        if (generatedKeys.length === args.requestedKeys.length && failedKeys.length === 0) {
            status = "succeeded";
        } else if (generatedKeys.length > 0) {
            status = "partial";
        } else {
            status = "failed";
        }
    }

    return {
        status,
        requested_images: args.requestedImages,
        requested_keys: args.requestedKeys,
        generated_keys: generatedKeys,
        failed_keys: failedKeys,
        failures: args.failures,
        fallbacks: args.fallbacks ?? [],
        featured_image_url: args.featuredImageUrl ?? null,
        recoverable: status === "failed" || status === "partial",
        updated_at: args.generatedAt ?? new Date().toISOString(),
    };
}
