import { createHash } from "node:crypto";

const MAX_SAFE_ERROR_LENGTH = 500;
const MAX_RETRY_DELAY_MINUTES = 60;

export function calculateVoiceMemoRetryAt(attemptCount: number, from: Date = new Date()): string {
    const normalizedAttempts = Number.isFinite(attemptCount) ? Math.max(1, Math.floor(attemptCount)) : 1;
    const delayMinutes = Math.min(MAX_RETRY_DELAY_MINUTES, 2 ** (normalizedAttempts - 1));
    return new Date(from.getTime() + delayMinutes * 60 * 1000).toISOString();
}

export function toSafeVoiceMemoProcessingError(error: unknown): string {
    const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "Voice memo processing failed.";
    const normalized = raw.replace(/\s+/g, " ").trim() || "Voice memo processing failed.";
    return normalized.slice(0, MAX_SAFE_ERROR_LENGTH);
}

export function buildVoiceMemoCommitmentFingerprint(commitment: { title: string; description?: string | null; priority?: string | null }): string {
    const source = [
        commitment.title.trim().toLowerCase(),
        commitment.description?.trim().toLowerCase() ?? "",
        commitment.priority?.trim().toLowerCase() ?? "",
    ].join("|");

    return createHash("sha256").update(source).digest("hex");
}
