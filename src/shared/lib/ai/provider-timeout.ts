/**
 * Bound provider SDK calls that do not expose an AbortSignal. The provider
 * promise may finish later, but callers regain control and can fail cleanly.
 */
export async function settleProviderPromiseWithin<T, TFallback>(
    providerPromise: Promise<T>,
    timeoutMs: number,
    fallback: TFallback,
): Promise<T | TFallback> {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
        return await Promise.race([
            providerPromise,
            new Promise<TFallback>((resolve) => {
                timeout = setTimeout(() => resolve(fallback), timeoutMs);
            }),
        ]);
    } finally {
        if (timeout) clearTimeout(timeout);
    }
}

export function resolveProviderAttemptTimeoutMs(
    deadlineAt: number,
    options: {
        maxAttemptMs: number;
        nowMs?: number;
        reserveMs?: number;
    },
): number | null {
    const reserveMs = options.reserveMs ?? 1_000;
    const remainingMs = deadlineAt - (options.nowMs ?? Date.now()) - reserveMs;
    if (remainingMs <= 0) return null;
    return Math.min(options.maxAttemptMs, remainingMs);
}
