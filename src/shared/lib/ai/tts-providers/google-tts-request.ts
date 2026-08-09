import { resolveGoogleTtsRetryDelayMs } from "./google-tts-contract";
import { resolveProviderAttemptTimeoutMs } from "@/shared/lib/ai/provider-timeout";

const GOOGLE_TTS_MAX_ATTEMPTS = 3;
const GOOGLE_TTS_MAX_ATTEMPT_MS = 75_000;

function isProviderTimeout(error: unknown): boolean {
    return error instanceof Error && error.name === "TimeoutError";
}

interface GoogleTtsRequestDependencies {
    deadlineAt?: number;
    fetchImpl?: typeof fetch;
    now?: () => number;
    sleep?: (delayMs: number) => Promise<void>;
}

/**
 * Execute one byte-bounded Cloud TTS request with status- and exception-aware
 * retries. Kept injectable so network failures can be verified without making
 * a billable provider call.
 */
export async function requestGoogleTtsAudioWithRetry(
    url: string,
    headers: Record<string, string>,
    requestBody: Record<string, unknown>,
    logPrefix: string,
    dependencies: GoogleTtsRequestDependencies = {},
): Promise<Uint8Array | null> {
    const fetchImpl = dependencies.fetchImpl ?? fetch;
    const now = dependencies.now ?? Date.now;
    const sleep = dependencies.sleep ?? ((delayMs) => new Promise<void>((resolve) => setTimeout(resolve, delayMs)));
    const deadlineAt = dependencies.deadlineAt ?? now() + (GOOGLE_TTS_MAX_ATTEMPT_MS * GOOGLE_TTS_MAX_ATTEMPTS);

    for (let attempt = 1; attempt <= GOOGLE_TTS_MAX_ATTEMPTS; attempt += 1) {
        const attemptTimeoutMs = resolveProviderAttemptTimeoutMs(deadlineAt, {
            maxAttemptMs: GOOGLE_TTS_MAX_ATTEMPT_MS,
            nowMs: now(),
        });
        if (attemptTimeoutMs === null) return null;

        try {
            const res = await fetchImpl(url, {
                method: "POST",
                headers,
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(attemptTimeoutMs),
            });

            if (res.ok) {
                const data = await res.json();
                if (typeof data.audioContent !== "string" || !data.audioContent) {
                    throw new Error("Google Cloud TTS response missing audioContent.");
                }
                return Uint8Array.from(atob(data.audioContent), (c) => c.charCodeAt(0));
            }

            const errorText = await res.text();
            const retryDelayMs = resolveGoogleTtsRetryDelayMs(
                res.status,
                res.headers.get("retry-after"),
                attempt,
            );
            console.error(`${logPrefix} Google Cloud TTS API error (${res.status}):`, errorText);
            if (retryDelayMs === null || attempt === GOOGLE_TTS_MAX_ATTEMPTS) return null;
            if (retryDelayMs >= deadlineAt - now() - 1_000) return null;

            console.warn(
                `${logPrefix} retrying Google Cloud TTS in ${retryDelayMs}ms after status ${res.status} (${attempt}/${GOOGLE_TTS_MAX_ATTEMPTS}).`,
            );
            await sleep(retryDelayMs);
        } catch (err) {
            console.error(`${logPrefix} Google Cloud TTS request failed (${attempt}/${GOOGLE_TTS_MAX_ATTEMPTS}):`, err);
            if (isProviderTimeout(err)) {
                console.warn(`${logPrefix} Google Cloud TTS synthesis timed out; skipping an identical retry.`);
                return null;
            }
            if (attempt === GOOGLE_TTS_MAX_ATTEMPTS) return null;

            const retryDelayMs = resolveGoogleTtsRetryDelayMs(503, null, attempt) ?? 500;
            if (retryDelayMs >= deadlineAt - now() - 1_000) return null;
            console.warn(`${logPrefix} retrying Google Cloud TTS in ${retryDelayMs}ms after a transient request failure.`);
            await sleep(retryDelayMs);
        }
    }
    return null;
}
