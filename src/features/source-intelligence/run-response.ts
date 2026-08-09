import type { SourceIntelligenceRunResult } from "./run";

export function buildSourceIntelligenceRunResponse(
    result: SourceIntelligenceRunResult,
    timestamp = new Date().toISOString(),
) {
    const degraded = result.failed > 0;

    return {
        ok: result.workerFailed === 0,
        degraded,
        timestamp,
        requestedAt: result.requestedAt,
        trigger: result.trigger,
        reason: result.reason,
        runId: result.runId,
        enqueued: result.enqueued,
        processed: result.processed,
        failed: result.failed,
        sourceFailed: result.sourceFailed,
        workerFailed: result.workerFailed,
        skipped: result.skipped,
        existingQueued: result.existingQueued,
        existingRunning: result.existingRunning,
        queuedJobsWaiting: result.enqueued + result.existingQueued > 0,
        workerLikelyIdle: result.enqueued + result.existingQueued > 0 && result.existingRunning === 0,
        results: result.results,
    };
}
