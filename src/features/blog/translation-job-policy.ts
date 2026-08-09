const BASE_RETRY_DELAY_MS = 60_000;
const MAX_RETRY_DELAY_MS = 30 * 60_000;

export function shouldRetryContentTranslation(input: {
    attempts: number;
    maxAttempts: number;
}): boolean {
    return input.attempts < input.maxAttempts;
}

export function contentTranslationRetryDelayMs(attempts: number): number {
    const exponent = Math.max(0, Math.floor(attempts) - 1);
    return Math.min(MAX_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * 2 ** exponent);
}
