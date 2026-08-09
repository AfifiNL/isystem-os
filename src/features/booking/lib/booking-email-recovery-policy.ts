const PRE_CONFIRMATION_EVENTS = new Set([
    "reservation_created",
    "reservation_pending_review",
]);

/**
 * Collapse a durable pre-confirmation signal onto the reservation's current
 * state before replaying email. This closes the crash window where an inline
 * confirmation succeeds after the earlier dashboard signal was recorded.
 */
export function resolveRecoveredBookingEmailEvent(eventType: string, currentStatus: string): string {
    if (!PRE_CONFIRMATION_EVENTS.has(eventType)) return eventType;

    if (currentStatus === "confirmed") return "reservation_confirmed";
    if (currentStatus === "completed") return "reservation_completed";
    if (currentStatus === "no_show") return "reservation_no_show";
    if (
        currentStatus === "cancelled_by_customer"
        || currentStatus === "cancelled_by_workspace"
        || currentStatus === "expired"
    ) {
        return "reservation_cancelled";
    }

    return eventType;
}
