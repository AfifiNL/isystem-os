export type SupportedEmailLocale = "en" | "nl" | "ar";

export type DeliveryStatus =
    | "pending"
    | "running"
    | "sent"
    | "delivered"
    | "failed"
    | "skipped"
    | "bounced"
    | "complained";

export type TransactionalEmailWebhookStatus = Extract<
    DeliveryStatus,
    "sent" | "delivered" | "failed" | "bounced" | "complained"
>;

const TRANSACTIONAL_WEBHOOK_SOURCE_STATUSES: Record<
    TransactionalEmailWebhookStatus,
    readonly DeliveryStatus[]
> = {
    sent: ["pending", "running", "failed", "skipped", "sent"],
    delivered: ["pending", "running", "sent", "failed", "skipped", "delivered"],
    failed: ["pending", "running", "sent", "failed", "skipped"],
    bounced: ["pending", "running", "sent", "delivered", "failed", "skipped", "bounced"],
    complained: ["pending", "running", "sent", "delivered", "failed", "skipped", "bounced", "complained"],
};

export function getTransactionalWebhookSourceStatuses(status: TransactionalEmailWebhookStatus) {
    return TRANSACTIONAL_WEBHOOK_SOURCE_STATUSES[status];
}

export type BookingEmailEvent =
    | "reservation_created"
    | "reservation_pending_review"
    | "reservation_reschedule_requested"
    | "reservation_confirmed"
    | "reservation_rescheduled"
    | "meeting_ready"
    | "reservation_cancelled"
    | "reservation_completed"
    | "reservation_no_show"
    | "payment_requested"
    | "payment_reminder"
    | "payment_reminder_6h"
    | "payment_reminder_1h"
    | "payment_failed"
    | "payment_expired"
    | "payment_refunded"
    | "appointment_reminder_24h"
    | "appointment_reminder_1h"
    | "appointment_reminder"
    | "post_session_followup";

const CUSTOMER_ONLY_BOOKING_EVENTS = new Set<BookingEmailEvent>([
    "payment_reminder_6h",
    "payment_reminder_1h",
    "payment_reminder",
    "appointment_reminder_24h",
    "appointment_reminder_1h",
    "appointment_reminder",
    "meeting_ready",
    "post_session_followup",
]);

export function normalizeEmailLocale(locale: string | null | undefined): SupportedEmailLocale {
    return locale === "nl" || locale === "ar" ? locale : "en";
}

export function getInquiryEmailPlan(input: {
    marketingConsent: boolean;
    locale?: string | null;
}) {
    return {
        customer: {
            event: "inquiry_received" as const,
            locale: normalizeEmailLocale(input.locale),
        },
        manager: {
            event: "inquiry_received" as const,
            locale: "en" as const,
        },
        subscribeToNewsletter: input.marketingConsent === true,
    };
}

export function selectAutomationRecipients<
    T extends { id: string; status: string },
>(contacts: readonly T[], targetContactId: string | null | undefined): T[] {
    if (!targetContactId) {
        return [];
    }

    const target = contacts.find(
        (contact) => contact.id === targetContactId && contact.status === "subscribed",
    );

    return target ? [target] : [];
}

export function getBookingEmailPlan(event: BookingEmailEvent, locale?: string | null) {
    const recipients: ReadonlyArray<"customer" | "manager"> = CUSTOMER_ONLY_BOOKING_EVENTS.has(event)
        ? ["customer"]
        : ["customer", "manager"];
    return {
        recipients,
        customerLocale: normalizeEmailLocale(locale),
        managerLocale: "en" as const,
    };
}

export function isRetryableDelivery(input: {
    status: DeliveryStatus;
    attempts: number;
    maxAttempts: number;
}) {
    if (input.attempts >= input.maxAttempts) {
        return false;
    }

    return (
        input.status === "pending" ||
        input.status === "failed" ||
        input.status === "skipped"
    );
}

const DELIVERY_CLAIM_LEASE_MS = 15 * 60 * 1000;

export function isClaimableDelivery(input: {
    status: DeliveryStatus;
    attempts: number;
    maxAttempts: number;
    updatedAt: string;
    now?: Date;
}) {
    if (
        isRetryableDelivery({
            status: input.status,
            attempts: input.attempts,
            maxAttempts: input.maxAttempts,
        })
    ) {
        return true;
    }

    if (input.status !== "running" || input.attempts >= input.maxAttempts) {
        return false;
    }

    const updatedAt = Date.parse(input.updatedAt);
    if (!Number.isFinite(updatedAt)) {
        return false;
    }

    return (input.now ?? new Date()).getTime() - updatedAt >= DELIVERY_CLAIM_LEASE_MS;
}

export function getPortalActivationPlan(input: {
    authUserCreated: boolean;
    locale?: string | null;
}) {
    return {
        event: input.authUserCreated
            ? ("portal_activation" as const)
            : ("portal_access_granted" as const),
        locale: normalizeEmailLocale(input.locale),
        requiresOneTimeLink: input.authUserCreated,
    };
}
