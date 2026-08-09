export type IndexingProcessingStatus = "submitted" | "indexed" | "not_indexed" | "failed";

export interface IndexingProcessingOutcome {
    success: boolean;
    status: IndexingProcessingStatus;
    terminalFailure: boolean;
    message: string;
}

export function buildIndexingRequeueState(now: string) {
    return {
        status: "queued" as const,
        attempt_count: 0,
        next_attempt_at: now,
        last_attempt_at: null,
        last_error: null,
        last_inspection: null,
    };
}

export function buildIndexingProcessingOutcome(input: {
    indexed: boolean;
    hasInspection: boolean;
    errors: readonly string[];
    attemptCount: number;
}): IndexingProcessingOutcome {
    if (input.indexed) {
        return {
            success: true,
            status: "indexed",
            terminalFailure: false,
            message: "URL inspection reports indexed.",
        };
    }

    const terminalFailure = input.errors.length > 0 && input.attemptCount >= 4;
    if (terminalFailure) {
        return {
            success: false,
            status: "failed",
            terminalFailure: true,
            message: `Indexing providers failed after ${input.attemptCount} attempts: ${input.errors.join("; ")}`,
        };
    }

    return {
        success: true,
        status: input.hasInspection ? "not_indexed" : "submitted",
        terminalFailure: false,
        message: "Indexing providers processed; URL is submitted or pending inspection.",
    };
}
