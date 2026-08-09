export type GscSyncDateResult = {
    status: string;
    rowsSynced: number;
    rowsFetched?: number;
    rowsRetained?: number;
    rowsPersisted?: number;
    error?: string;
};

export type GscSyncOutcome = {
    ok: boolean;
    status: 200 | 207 | 502;
    health: "healthy" | "degraded" | "failing";
    succeeded: number;
    failed: number;
};

export function resolveGscSyncOutcome(
    results: Record<string, GscSyncDateResult>,
): GscSyncOutcome {
    const values = Object.values(results);
    const failed = values.filter((result) => result.status.startsWith("failed")).length;
    const succeeded = values.length - failed;

    if (failed > 0 && succeeded === 0) {
        return { ok: false, status: 502, health: "failing", succeeded, failed };
    }
    if (failed > 0) {
        return { ok: true, status: 207, health: "degraded", succeeded, failed };
    }
    return { ok: true, status: 200, health: "healthy", succeeded, failed };
}

export function assertGscSyncRunUpdated(error: { message: string } | null): void {
    if (error) {
        throw new Error(`Failed to update GSC sync run: ${error.message}`);
    }
}
