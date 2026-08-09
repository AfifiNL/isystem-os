export type BookingMeetingProvider = "none" | "google_meet" | "zoom";
export type BookingMeetingAvailability = "automatic" | "manual" | "unavailable";

export type BookingMeetingProviderSetup = {
    availability: BookingMeetingAvailability;
    bookingAllowed: boolean;
    /**
     * A reservation request may be accepted while a provider is temporarily
     * unavailable, but it must not be presented as confirmed until the
     * automatic provider can create a customer-safe room.
     */
    autoConfirmationAllowed: boolean;
    error?: string;
};

export function resolveBookingMeetingProvider(value: string | null | undefined): BookingMeetingProvider {
    return value === "google_meet" || value === "zoom" ? value : "none";
}

export function validateMeetingProvider(provider: BookingMeetingProvider, durationMinutes: number): { ok: true } | { ok: false; error: string } {
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1) {
        return { ok: false, error: "Meeting duration must be a positive number of minutes." };
    }
    if (provider === "zoom" && durationMinutes > 40) {
        return { ok: false, error: "Free Zoom meetings are limited to 40 minutes." };
    }
    return { ok: true };
}

/**
 * Provider credentials and workspace OAuth connections are operational
 * dependencies, not prerequisites for accepting a reservation. A missing
 * connection is surfaced as unavailable so operators can repair and retry
 * meeting provisioning after confirmation without losing the booking.
 */
export function evaluateMeetingProviderSetup(input: {
    provider: BookingMeetingProvider;
    durationMinutes: number;
    autoCreate: boolean;
    googleCalendarConnected: boolean;
    zoomConfigured: boolean;
}): BookingMeetingProviderSetup {
    const policy = validateMeetingProvider(input.provider, input.durationMinutes);
    if (!policy.ok) {
        return {
            availability: "unavailable",
            bookingAllowed: false,
            autoConfirmationAllowed: false,
            error: policy.error,
        };
    }
    if (input.provider === "none") {
        return { availability: "unavailable", bookingAllowed: true, autoConfirmationAllowed: true };
    }
    if (!input.autoCreate) {
        return { availability: "manual", bookingAllowed: true, autoConfirmationAllowed: false };
    }
    if (input.provider === "google_meet") {
        const ready = input.googleCalendarConnected;
        return {
            availability: ready ? "automatic" : "unavailable",
            bookingAllowed: true,
            autoConfirmationAllowed: ready,
        };
    }
    const ready = input.zoomConfigured;
    return {
        availability: ready ? "automatic" : "unavailable",
        bookingAllowed: true,
        autoConfirmationAllowed: ready,
    };
}
