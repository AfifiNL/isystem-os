export const PODCAST_ROUTE_TIMEOUT_MS = 280_000;
export const PODCAST_FINALIZATION_RESERVE_MS = 45_000;
export const PODCAST_TTS_RESERVE_MS = 150_000;

export function resolvePodcastPhaseTimeoutMs(input: {
    deadlineAt: number;
    maxPhaseMs: number;
    reserveMs: number;
    nowMs?: number;
}): number | null {
    const availableMs = input.deadlineAt - (input.nowMs ?? Date.now()) - input.reserveMs;
    if (availableMs < 1_000) return null;
    return Math.min(input.maxPhaseMs, availableMs);
}
