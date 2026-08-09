export const BOOKING_MINIMUM_LEAD_TIME_HOURS = 72;
export const BOOKING_PAYMENT_COMPLETION_WINDOW_HOURS = 24;

export const BOOKING_MINIMUM_LEAD_TIME_MINUTES = BOOKING_MINIMUM_LEAD_TIME_HOURS * 60;
export const BOOKING_PAYMENT_COMPLETION_WINDOW_MINUTES = BOOKING_PAYMENT_COMPLETION_WINDOW_HOURS * 60;

const MINUTE_MS = 60 * 1000;

export function getEffectiveBookingLeadTimeMinutes(configuredLeadTimeMinutes: number | null | undefined): number {
    return Math.max(configuredLeadTimeMinutes ?? 0, BOOKING_MINIMUM_LEAD_TIME_MINUTES);
}

export function getBookingPaymentDeadlineAt(createdAt: Date | number = new Date()): Date {
    const createdAtMs = createdAt instanceof Date ? createdAt.getTime() : createdAt;
    return new Date(createdAtMs + BOOKING_PAYMENT_COMPLETION_WINDOW_MINUTES * MINUTE_MS);
}

export function hasFullPaymentWindowBeforeAppointment(appointmentStart: Date, createdAt: Date | number = new Date()): boolean {
    return getBookingPaymentDeadlineAt(createdAt).getTime() <= appointmentStart.getTime();
}
