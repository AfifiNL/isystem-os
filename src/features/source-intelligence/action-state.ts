export type SourceIntelligenceRunActionState = {
    success: boolean;
    error: string | null;
    runId: string | null;
    enqueued: number;
    processed: number;
    failed: number;
    skipped: number;
    existingQueued: number;
    existingRunning: number;
    timestamp: string | null;
    summary: string;
};

export const initialSourceIntelligenceRunActionState: SourceIntelligenceRunActionState = {
    success: false,
    error: null,
    runId: null,
    enqueued: 0,
    processed: 0,
    failed: 0,
    skipped: 0,
    existingQueued: 0,
    existingRunning: 0,
    timestamp: null,
    summary: "No manual refresh has run in this view yet.",
};
