import type { BookingMeetingProvider } from "./meeting-policy";

export type MeetingConfirmationStatus = "pending" | "ready" | "failed" | "cancelled" | "not_configured" | null;

export function stageReservationStatusForMeeting<Status extends string>(
    status: Status,
    provider: BookingMeetingProvider,
): Status | "pending_review" {
    if (status === "confirmed" && provider !== "none") return "pending_review";
    return status;
}

function isCustomerSafeJoinUrl(value: string | null): boolean {
    if (!value) return false;
    try {
        const url = new URL(value);
        return url.protocol === "https:" && Boolean(url.hostname);
    } catch {
        return false;
    }
}

export function canConfirmReservationWithMeeting(input: {
    provider: BookingMeetingProvider;
    meetingStatus: MeetingConfirmationStatus;
    joinUrl: string | null;
}): { allowed: true } | { allowed: false; reason: string } {
    if (input.provider === "none") return { allowed: true };
    if (input.meetingStatus !== "ready" || !isCustomerSafeJoinUrl(input.joinUrl)) {
        return {
            allowed: false,
            reason: "The remote meeting must be ready with a customer-safe join URL before this reservation can be confirmed.",
        };
    }
    return { allowed: true };
}
