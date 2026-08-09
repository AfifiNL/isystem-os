import type { Database } from "@/shared/lib/supabase/database.types";

type BookingReservationStatus = Database["public"]["Enums"]["booking_reservation_status"];

const CUSTOMER_MANAGEABLE_STATUSES = new Set<BookingReservationStatus>([
    "pending_review",
    "pending_confirmation",
    "confirmed",
]);

const TERMINAL_STATUSES = new Set<BookingReservationStatus>([
    "completed",
    "cancelled_by_customer",
    "cancelled_by_workspace",
    "no_show",
    "expired",
]);

export function getCustomerBookingManagementPolicy(input: {
    status: BookingReservationStatus;
    scheduledStart: string;
    now?: Date;
}) {
    const now = input.now ?? new Date();
    const isTerminal = TERMINAL_STATUSES.has(input.status);
    const isFuture = Number.isFinite(Date.parse(input.scheduledStart))
        && Date.parse(input.scheduledStart) > now.getTime();
    const canManage = CUSTOMER_MANAGEABLE_STATUSES.has(input.status) && isFuture;

    return {
        canCancel: canManage,
        canReschedule: canManage,
        isTerminal,
        reason: canManage
            ? null
            : isTerminal
                ? "This booking is already closed."
                : !isFuture
                    ? "This appointment has already started."
                    : "This booking cannot be changed in its current state.",
    };
}

export function getPostSessionCommercialFollowUpPlan(input: {
    reservationId: string;
    customerName: string;
    completedAt: string;
}) {
    return {
        title: `Review completed session with ${input.customerName}`,
        kind: "booking_commercial_follow_up" as const,
        priority: "high" as const,
        dueAt: new Date(Date.parse(input.completedAt) + 24 * 60 * 60 * 1000).toISOString(),
        idempotencyKey: `work:booking-commercial-follow-up:${input.reservationId}`,
        requiresHumanApproval: true as const,
    };
}
