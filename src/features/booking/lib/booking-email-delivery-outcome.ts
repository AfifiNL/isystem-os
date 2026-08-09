export type BookingEmailDeliveryStatus = "sent" | "skipped" | "failed" | "suppressed" | "persistence_degraded";

export type BookingEmailDeliveryOutcome = Record<BookingEmailDeliveryStatus, number>;

export function emptyBookingEmailDeliveryOutcome(): BookingEmailDeliveryOutcome {
    return { sent: 0, skipped: 0, failed: 0, suppressed: 0, persistence_degraded: 0 };
}

export function addBookingEmailDeliveryOutcome(
    outcome: BookingEmailDeliveryOutcome,
    status: BookingEmailDeliveryStatus,
): BookingEmailDeliveryOutcome {
    return { ...outcome, [status]: outcome[status] + 1 };
}

export function mergeBookingEmailDeliveryOutcomes(
    left: BookingEmailDeliveryOutcome,
    right: BookingEmailDeliveryOutcome,
): BookingEmailDeliveryOutcome {
    return {
        sent: left.sent + right.sent,
        skipped: left.skipped + right.skipped,
        failed: left.failed + right.failed,
        suppressed: left.suppressed + right.suppressed,
        persistence_degraded: left.persistence_degraded + right.persistence_degraded,
    };
}

export function bookingEmailCronStatus(
    outcome: BookingEmailDeliveryOutcome,
): "healthy" | "degraded" | "failed" {
    const unsuccessful = outcome.failed + outcome.skipped + outcome.persistence_degraded;
    if (unsuccessful === 0) return "healthy";
    return outcome.sent > 0 ? "degraded" : "failed";
}
