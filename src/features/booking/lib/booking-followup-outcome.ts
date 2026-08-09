export function resolveBookingFollowupOutcome(input: { attempted: number; failures: number }): {
    ok: boolean;
    health: "healthy" | "degraded" | "failing";
    status: 200 | 207 | 502;
} {
    if (input.failures <= 0) return { ok: true, health: "healthy", status: 200 };
    if (input.attempted > 0 && input.failures >= input.attempted) {
        return { ok: false, health: "failing", status: 502 };
    }
    return { ok: true, health: "degraded", status: 207 };
}
