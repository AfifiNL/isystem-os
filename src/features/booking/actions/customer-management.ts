"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
    fenceBookingPaymentForCancellation,
    getBookingAvailabilityPreview,
    restoreBookingPaymentFenceAfterTransitionRace,
} from "@/features/booking/actions";
import { dispatchBookingEmails } from "@/features/booking/lib/booking-emails";
import { provisionAndConfirmReservation } from "@/features/booking/lib/meeting-confirmation-orchestrator";
import { ensureBookingMeeting, cancelBookingMeeting } from "@/features/booking/lib/meeting-provider";
import { getCustomerBookingManagementPolicy } from "@/features/booking/lib/customer-management-policy";
import { verifyBookingManagementToken } from "@/features/booking/lib/customer-management-token";
import { calendarDateInTimezone } from "@/features/booking/lib/timezone";
import { recordBookingBusinessEvent } from "@/features/business-spine/service";
import { normalizeEmailLocale, type SupportedEmailLocale } from "@/features/communications/email-lifecycle";
import { resolveLocalizedJson } from "@/shared/lib/i18n/resolve";
import type { Database, Json } from "@/shared/lib/supabase/database.types";

type ReservationStatus = Database["public"]["Enums"]["booking_reservation_status"];
type PaymentStatus = Database["public"]["Enums"]["booking_payment_status"];

const manageActionSchema = z.discriminatedUnion("operation", [
    z.object({
        operation: z.literal("cancel"),
        token: z.string().min(1).max(2048),
    }),
    z.object({
        operation: z.literal("reschedule"),
        token: z.string().min(1).max(2048),
        scheduledStart: z.string().datetime({ offset: true }),
    }),
]);

interface ReservationManagementRow {
    id: string;
    workspace_id: string;
    service_id: string;
    resource_id: string | null;
    location_id: string | null;
    portal_client_id: string | null;
    status: ReservationStatus;
    public_reference: string;
    customer_full_name: string;
    customer_email: string;
    customer_phone: string | null;
    party_size: number;
    scheduled_start: string;
    scheduled_end: string;
    reservation_timezone: string;
    attribution_json: Json;
    metadata: Json;
    booking_services: {
        title: string;
        max_advance_days: number;
        location_mode: string;
    } | null;
    booking_locations: Array<{
        name: string;
        instructions: string | null;
        copy_i18n: Json;
        location_type: string;
    }> | {
        name: string;
        instructions: string | null;
        copy_i18n: Json;
        location_type: string;
    } | null;
    booking_meetings: Array<{
        provider: string;
        join_url: string | null;
        status: string;
    }> | {
        provider: string;
        join_url: string | null;
        status: string;
    } | null;
    booking_payments: Array<{
        id: string;
        status: PaymentStatus;
        provider: string;
        paypal_status: string | null;
        payment_url: string | null;
        metadata: Json;
    }> | {
        id: string;
        status: PaymentStatus;
        provider: string;
        paypal_status: string | null;
        payment_url: string | null;
        metadata: Json;
    } | null;
}

export interface CustomerBookingManagementView {
    publicReference: string;
    customerName: string;
    maskedEmail: string;
    serviceTitle: string;
    status: ReservationStatus;
    scheduledStart: string;
    scheduledEnd: string;
    timezone: string;
    locale: SupportedEmailLocale;
    paymentStatus: PaymentStatus | null;
    locationMode: string;
    locationName: string | null;
    locationInstructions: string | null;
    meetingProvider: string | null;
    joinUrl: string | null;
    canCancel: boolean;
    canReschedule: boolean;
    policyReason: string | null;
    availableSlots: Array<{
        start: string;
        end: string;
        requiresReview: boolean;
    }>;
}

export interface CustomerBookingManagementActionState {
    success: boolean;
    outcome: "idle" | "cancelled" | "rescheduled" | "reschedule_pending" | "error";
    message: string | null;
}

function getServiceRoleClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Missing Supabase service-role configuration.");
    }

    return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}

function jsonRecord(value: Json): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function localeFromAttribution(value: Json): SupportedEmailLocale {
    const locale = jsonRecord(value).locale;
    return normalizeEmailLocale(typeof locale === "string" ? locale : null);
}

function localize(locale: SupportedEmailLocale, en: string, nl: string, ar: string): string {
    return locale === "nl" ? nl : locale === "ar" ? ar : en;
}

function maskEmail(email: string): string {
    const [localPart, domain] = email.split("@");
    if (!localPart || !domain) return "••••";
    return `${localPart.slice(0, 1)}${"•".repeat(Math.min(Math.max(localPart.length - 1, 2), 8))}@${domain}`;
}

function paymentStatus(row: ReservationManagementRow): PaymentStatus | null {
    const payment = Array.isArray(row.booking_payments)
        ? row.booking_payments[0] ?? null
        : row.booking_payments;
    return payment?.status ?? null;
}

async function loadReservationForCapability(token: string): Promise<{
    capability: NonNullable<ReturnType<typeof verifyBookingManagementToken>>;
    reservation: ReservationManagementRow;
} | null> {
    const capability = verifyBookingManagementToken(token);
    if (!capability) return null;

    const supabase = getServiceRoleClient();
    const { data, error } = await supabase
        .from("booking_reservations")
        .select(`
            id,
            workspace_id,
            service_id,
            resource_id,
            location_id,
            portal_client_id,
            status,
            public_reference,
            customer_full_name,
            customer_email,
            customer_phone,
            party_size,
            scheduled_start,
            scheduled_end,
            reservation_timezone,
            attribution_json,
            metadata,
            booking_services!booking_reservations_workspace_service_fk ( title, max_advance_days, location_mode ),
            booking_locations!booking_reservations_workspace_location_fk ( name, instructions, copy_i18n, location_type ),
            booking_payments!booking_payments_workspace_reservation_fk ( id, status, provider, paypal_status, payment_url, metadata ),
            booking_meetings!booking_meetings_workspace_reservation_fk ( provider, join_url, status )
        `)
        .eq("id", capability.reservationId)
        .eq("workspace_id", capability.workspaceId)
        .maybeSingle();

    if (error || !data) return null;
    return {
        capability,
        reservation: data as unknown as ReservationManagementRow,
    };
}

async function loadAvailableSlots(reservation: ReservationManagementRow) {
    const now = new Date();
    const horizonDays = Math.min(Math.max(reservation.booking_services?.max_advance_days ?? 60, 1), 90);
    const horizon = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);

    try {
        const availability = await getBookingAvailabilityPreview({
            serviceId: reservation.service_id,
            resourceId: reservation.resource_id,
            locationId: reservation.location_id,
            dateRange: {
                start: calendarDateInTimezone(now, reservation.reservation_timezone),
                end: calendarDateInTimezone(horizon, reservation.reservation_timezone),
            },
            timezone: reservation.reservation_timezone,
            partySize: reservation.party_size,
        });
        if (availability.bookingState !== "active") return [];

        return availability.dateSlots
            .filter((slot) => (
                (slot.status === "available" || slot.status === "manual_review")
                && slot.start !== reservation.scheduled_start
            ))
            .slice(0, 200)
            .map((slot) => ({
                start: slot.start,
                end: slot.end,
                requiresReview: slot.status === "manual_review",
            }));
    } catch (error) {
        console.warn(
            "[booking-management] availability lookup failed",
            error instanceof Error ? error.message : error,
        );
        return [];
    }
}

export async function getCustomerBookingManagementView(
    token: string,
): Promise<CustomerBookingManagementView | null> {
    const loaded = await loadReservationForCapability(token);
    if (!loaded) return null;

    const { reservation } = loaded;
    const locale = localeFromAttribution(reservation.attribution_json);
    const policy = getCustomerBookingManagementPolicy({
        status: reservation.status,
        scheduledStart: reservation.scheduled_start,
    });
    const paymentAwaitingCompletion = reservation.status === "pending_confirmation"
        && paymentStatus(reservation) === "requested";
    const location = Array.isArray(reservation.booking_locations)
        ? reservation.booking_locations[0] ?? null
        : reservation.booking_locations;
    const meeting = Array.isArray(reservation.booking_meetings)
        ? reservation.booking_meetings[0] ?? null
        : reservation.booking_meetings;
    const locationName = location
        ? resolveLocalizedJson(location.copy_i18n, locale, "name") ?? location.name
        : null;
    const locationInstructions = location
        ? resolveLocalizedJson(location.copy_i18n, locale, "instructions") ?? location.instructions
        : null;

    return {
        publicReference: reservation.public_reference,
        customerName: reservation.customer_full_name,
        maskedEmail: maskEmail(reservation.customer_email),
        serviceTitle: reservation.booking_services?.title ?? localize(locale, "Appointment", "Afspraak", "موعد"),
        status: reservation.status,
        scheduledStart: reservation.scheduled_start,
        scheduledEnd: reservation.scheduled_end,
        timezone: reservation.reservation_timezone,
        locale,
        paymentStatus: paymentStatus(reservation),
        locationMode: reservation.booking_services?.location_mode ?? location?.location_type ?? "remote",
        locationName,
        locationInstructions,
        meetingProvider: meeting?.provider ?? null,
        joinUrl: meeting?.status === "ready" ? meeting.join_url : null,
        canCancel: policy.canCancel,
        canReschedule: policy.canReschedule && !paymentAwaitingCompletion,
        policyReason: paymentAwaitingCompletion
            ? localize(
                locale,
                "Complete or cancel the payment before rescheduling this booking.",
                "Voltooi of annuleer de betaling voordat u deze boeking verplaatst.",
                "أكمل الدفع أو ألغِه قبل تغيير موعد هذا الحجز.",
            )
            : policy.reason,
        availableSlots: policy.canReschedule && !paymentAwaitingCompletion ? await loadAvailableSlots(reservation) : [],
    };
}

function actionError(message: string): CustomerBookingManagementActionState {
    return { success: false, outcome: "error", message };
}

function revalidateManagementPaths() {
    revalidatePath("/booking/manage");
    revalidatePath("/en/booking/manage");
    revalidatePath("/nl/booking/manage");
    revalidatePath("/ar/booking/manage");
    revalidatePath("/dashboard/booking");
}

async function recordCustomerBusinessEvent(
    reservation: ReservationManagementRow,
    status: ReservationStatus,
    scheduledStart: string,
) {
    try {
        await recordBookingBusinessEvent({
            supabase: getServiceRoleClient(),
            workspaceId: reservation.workspace_id,
            reservationId: reservation.id,
            status,
            customerName: reservation.customer_full_name,
            customerEmail: reservation.customer_email,
            customerPhone: reservation.customer_phone,
            portalClientId: reservation.portal_client_id,
            scheduledStart,
            // Customer self-service completion does not prove that
            // implementation/delivery has started.
            engagementStarted: false,
            source: "public_flow",
        });
    } catch (error) {
        console.warn(
            "[booking-management] business spine event failed",
            error instanceof Error ? error.message : error,
        );
    }
}

async function cancelCustomerReservation(
    reservation: ReservationManagementRow,
    locale: SupportedEmailLocale,
): Promise<CustomerBookingManagementActionState> {
    const supabase = getServiceRoleClient();
    const now = new Date().toISOString();
    const historyReason = "Cancelled by customer through a signed booking-management link.";
    let paymentFence: Awaited<ReturnType<typeof fenceBookingPaymentForCancellation>> | null = null;
    try {
        paymentFence = await fenceBookingPaymentForCancellation({
            supabase,
            workspaceId: reservation.workspace_id,
            reservationId: reservation.id,
            source: "customer",
            reason: historyReason,
        });
    } catch {
        return actionError(localize(
            locale,
            "We could not safely cancel the payment attempt. Refresh and try again.",
            "We konden de betaalpoging niet veilig annuleren. Vernieuw en probeer opnieuw.",
            "تعذر إلغاء محاولة الدفع بأمان. حدّث الصفحة وحاول مرة أخرى.",
        ));
    }
    const metadata = {
        ...jsonRecord(reservation.metadata),
        customerCancellation: {
            cancelledAt: now,
            source: "signed_booking_management",
            paymentStatus: paymentStatus(reservation),
            refundAutomatic: false,
        },
    };
    const { data, error } = await supabase
        .from("booking_reservations")
        .update({
            status: "cancelled_by_customer",
            metadata: metadata as Json,
            updated_at: now,
        })
        .eq("id", reservation.id)
        .eq("workspace_id", reservation.workspace_id)
        .eq("status", reservation.status)
        .eq("scheduled_start", reservation.scheduled_start)
        .select("id")
        .maybeSingle();

    if (error || !data) {
        if (paymentFence) {
            await restoreBookingPaymentFenceAfterTransitionRace({
                supabase,
                workspaceId: reservation.workspace_id,
                reservationId: reservation.id,
                fence: paymentFence,
            });
        }
        return actionError(localize(
            locale,
            "This booking changed before cancellation completed. Refresh and try again.",
            "Deze boeking is gewijzigd voordat de annulering was voltooid. Vernieuw en probeer opnieuw.",
            "تغيّر هذا الحجز قبل اكتمال الإلغاء. حدّث الصفحة وحاول مرة أخرى.",
        ));
    }

    await supabase.from("booking_status_history").insert({
        workspace_id: reservation.workspace_id,
        reservation_id: reservation.id,
        from_status: reservation.status,
        to_status: "cancelled_by_customer",
        trigger_source: "customer",
        actor_type: "customer",
        actor_id: null,
        reason: historyReason,
        payload_json: {
            source: "signed_booking_management",
            paymentStatus: paymentStatus(reservation),
            refundAutomatic: false,
        } as Json,
    });

    try {
        await cancelBookingMeeting(supabase, reservation.id);
    } catch (error) {
        console.warn("[booking-management] meeting cancellation failed", error instanceof Error ? error.message : error);
    }

    await dispatchBookingEmails({
        supabase,
        workspaceId: reservation.workspace_id,
        reservationId: reservation.id,
        eventType: "reservation_cancelled",
    });

    let calendarCleanupError: string | null = null;
    try {
        const { deleteReservationFromGoogleCalendar } = await import("@/features/booking/lib/google-calendar");
        const cleanup = await deleteReservationFromGoogleCalendar(supabase, reservation.id);
        if (!cleanup.success) calendarCleanupError = cleanup.error ?? "Google Calendar cleanup needs a retry.";
    } catch (error) {
        calendarCleanupError = error instanceof Error ? error.message : "Google Calendar cleanup needs a retry.";
        console.warn(
            "[booking-management] calendar cancellation failed",
            error instanceof Error ? error.message : error,
        );
    }

    if (calendarCleanupError) {
        await supabase
            .from("booking_reservations")
            .update({
                metadata: {
                    ...metadata,
                    calendarCleanupRequired: true,
                    calendarCleanupError: calendarCleanupError.slice(0, 500),
                    calendarCleanupUpdatedAt: new Date().toISOString(),
                } as Json,
                updated_at: new Date().toISOString(),
            })
            .eq("id", reservation.id)
            .eq("workspace_id", reservation.workspace_id)
            .eq("status", "cancelled_by_customer");
    }

    await recordCustomerBusinessEvent(reservation, "cancelled_by_customer", reservation.scheduled_start);
    revalidateManagementPaths();

    return {
        success: true,
        outcome: "cancelled",
        message: localize(
            locale,
            calendarCleanupError
                ? "Your booking is cancelled. The calendar provider is unavailable; the workspace has a retryable cleanup task."
                : "Your booking is cancelled. If payment was verified, the team will review any refund separately.",
            calendarCleanupError
                ? "Uw boeking is geannuleerd. De agenda-aanbieder is niet beschikbaar; de workspace heeft een opruimtaak die opnieuw kan worden uitgevoerd."
                : "Uw boeking is geannuleerd. Als de betaling was geverifieerd, beoordeelt het team een eventuele terugbetaling afzonderlijk.",
            calendarCleanupError
                ? "تم إلغاء حجزك. مزود التقويم غير متاح؛ لدى فريق العمل مهمة تنظيف قابلة لإعادة المحاولة."
                : "تم إلغاء حجزك. إذا تم التحقق من الدفع، فسيراجع الفريق أي استرداد بشكل منفصل.",
        ),
    };
}

async function rescheduleCustomerReservation(
    reservation: ReservationManagementRow,
    scheduledStart: string,
    locale: SupportedEmailLocale,
): Promise<CustomerBookingManagementActionState> {
    const pendingPayment = paymentStatus(reservation) === "requested";
    // A pending paid hold can be captured by a racing PayPal return/webhook.
    // Disallowing self-service movement until payment is verified keeps that
    // provider callback tied to the original, payment-window-validated slot.
    if (reservation.status === "pending_confirmation" && pendingPayment) {
        return actionError(localize(
            locale,
            "Please complete or cancel the payment before rescheduling this booking.",
            "Voltooi of annuleer de betaling voordat u deze boeking verplaatst.",
            "يرجى إكمال الدفع أو إلغاؤه قبل تغيير موعد هذا الحجز.",
        ));
    }
    const requestedDate = new Date(scheduledStart);
    const availability = await getBookingAvailabilityPreview({
        serviceId: reservation.service_id,
        resourceId: reservation.resource_id,
        locationId: reservation.location_id,
        dateRange: {
            start: calendarDateInTimezone(requestedDate, reservation.reservation_timezone),
            end: calendarDateInTimezone(requestedDate, reservation.reservation_timezone),
        },
        timezone: reservation.reservation_timezone,
        partySize: reservation.party_size,
    });
    if (availability.bookingState !== "active") {
        return actionError(localize(
            locale,
            "This booking service is not currently accepting schedule changes.",
            "Deze boekingsdienst accepteert momenteel geen wijzigingen.",
            "خدمة الحجز هذه لا تقبل تغييرات المواعيد حاليًا.",
        ));
    }
    const matchingSlot = availability.dateSlots.find((slot) => slot.start === requestedDate.toISOString());

    if (!matchingSlot || !["available", "manual_review"].includes(matchingSlot.status)) {
        return actionError(localize(
            locale,
            "That time is no longer available. Refresh to choose another slot.",
            "Dat moment is niet meer beschikbaar. Vernieuw om een ander tijdslot te kiezen.",
            "لم يعد هذا الموعد متاحًا. حدّث الصفحة لاختيار موعد آخر.",
        ));
    }

    const requiresReview = matchingSlot.status === "manual_review";
    const nextStatus: ReservationStatus = requiresReview && ["confirmed", "pending_confirmation"].includes(reservation.status)
        ? "pending_review"
        : reservation.status;
    const directConfirmedReschedule = !requiresReview && reservation.status === "confirmed";
    const stagedStatus: ReservationStatus = directConfirmedReschedule ? "pending_review" : nextStatus;
    const now = new Date().toISOString();
    const managementMetadata = {
        previousStart: reservation.scheduled_start,
        previousEnd: reservation.scheduled_end,
        requestedStart: matchingSlot.start,
        requestedEnd: matchingSlot.end,
        requestedAt: now,
        requiresReview,
        state: requiresReview || directConfirmedReschedule ? "pending_review" : "confirmed",
        previousStatus: reservation.status,
        source: "signed_booking_management",
    };
    const { data, error } = await getServiceRoleClient()
        .from("booking_reservations")
        .update({
            scheduled_start: matchingSlot.start,
            scheduled_end: matchingSlot.end,
            status: stagedStatus,
            requires_manual_review: requiresReview || directConfirmedReschedule,
            manual_review_reason: requiresReview
                ? "Customer requested a new time that requires workspace review."
                : directConfirmedReschedule
                    ? "Customer meeting update must complete before the rescheduled booking is reconfirmed."
                    : null,
            metadata: {
                ...jsonRecord(reservation.metadata),
                automaticConfirmationPending: directConfirmedReschedule,
                selfServiceReschedule: managementMetadata,
            } as Json,
            updated_at: now,
        })
        .eq("id", reservation.id)
        .eq("workspace_id", reservation.workspace_id)
        .eq("status", reservation.status)
        .eq("scheduled_start", reservation.scheduled_start)
        .select("id")
        .maybeSingle();

    if (error || !data) {
        return actionError(localize(
            locale,
            "This booking changed before rescheduling completed. Refresh and try again.",
            "Deze boeking is gewijzigd voordat het verplaatsen was voltooid. Vernieuw en probeer opnieuw.",
            "تغيّر هذا الحجز قبل اكتمال تغيير الموعد. حدّث الصفحة وحاول مرة أخرى.",
        ));
    }

    const supabase = getServiceRoleClient();
    let resultingStatus = stagedStatus;
    let meetingProvisioningError: string | null = null;

    if (directConfirmedReschedule) {
        const reservationMetadata = jsonRecord(reservation.metadata);
        const meetingProvider = reservationMetadata.meetingProvider === "zoom"
            || reservationMetadata.meetingProvider === "google_meet"
            || reservationMetadata.meetingProvider === "none"
            ? reservationMetadata.meetingProvider
            : "google_meet";
        const confirmation = await provisionAndConfirmReservation({
            provider: meetingProvider,
            provisionMeeting: () => ensureBookingMeeting(supabase, reservation.id),
            commitConfirmation: async () => {
                const { data: confirmed, error: confirmationError } = await supabase
                    .from("booking_reservations")
                    .update({
                        status: "confirmed",
                        requires_manual_review: false,
                        manual_review_reason: null,
                        metadata: {
                            ...reservationMetadata,
                            automaticConfirmationPending: false,
                            selfServiceReschedule: {
                                ...managementMetadata,
                                state: "confirmed",
                                confirmedAt: new Date().toISOString(),
                            },
                        } as Json,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", reservation.id)
                    .eq("workspace_id", reservation.workspace_id)
                    .eq("status", "pending_review")
                    .eq("scheduled_start", matchingSlot.start)
                    .select("id")
                    .maybeSingle();
                if (confirmationError) throw new Error(confirmationError.message);
                return Boolean(confirmed);
            },
        });
        if (confirmation.confirmed) {
            resultingStatus = "confirmed";
        } else {
            meetingProvisioningError = confirmation.reason ?? "Meeting update is pending.";
        }
    } else {
        try {
            if (requiresReview) {
                await cancelBookingMeeting(supabase, reservation.id);
            } else if (nextStatus === "completed") {
                await ensureBookingMeeting(supabase, reservation.id);
            }
        } catch (error) {
            meetingProvisioningError = error instanceof Error ? error.message : "Meeting update is pending.";
            console.warn("[booking-management] meeting reschedule failed", meetingProvisioningError);
        }
    }

    const eventType = resultingStatus === "confirmed"
        ? "reservation_rescheduled" as const
        : "reservation_reschedule_requested" as const;

    if (meetingProvisioningError) {
        await supabase
            .from("booking_reservations")
            .update({
                metadata: {
                    ...jsonRecord(reservation.metadata),
                    automaticConfirmationPending: directConfirmedReschedule,
                    selfServiceReschedule: managementMetadata,
                    meetingProvisioningError: meetingProvisioningError.slice(0, 500),
                    meetingProvisioningUpdatedAt: new Date().toISOString(),
                } as Json,
                updated_at: new Date().toISOString(),
            })
            .eq("id", reservation.id)
            .eq("workspace_id", reservation.workspace_id)
            .eq("status", resultingStatus);
    }

    await Promise.all([
        supabase.from("booking_status_history").insert({
            workspace_id: reservation.workspace_id,
            reservation_id: reservation.id,
            from_status: reservation.status,
            to_status: resultingStatus,
            trigger_source: "customer",
            actor_type: "customer",
            actor_id: null,
            reason: resultingStatus !== "confirmed"
                ? "Customer requested a new time; workspace confirmation is required."
                : "Customer selected an available new time through a signed booking-management link.",
            payload_json: {
                ...managementMetadata,
                emailDispatchRequired: true,
            } as Json,
        }),
        supabase.from("booking_notification_events").insert({
            workspace_id: reservation.workspace_id,
            reservation_id: reservation.id,
            event_type: eventType,
            channel: "internal_dashboard",
            delivery_status: "pending",
            payload_json: {
                ...managementMetadata,
                emailDispatchRequired: true,
            } as Json,
        }),
    ]);

    await dispatchBookingEmails({
        supabase,
        workspaceId: reservation.workspace_id,
        reservationId: reservation.id,
        eventType,
    });

    let calendarCleanupError: string | null = null;
    try {
        const calendar = await import("@/features/booking/lib/google-calendar");
        if (requiresReview) {
            const cleanup = await calendar.deleteReservationFromGoogleCalendar(supabase, reservation.id);
            if (!cleanup.success) calendarCleanupError = cleanup.error ?? "Google Calendar cleanup needs a retry.";
        }
    } catch (error) {
        calendarCleanupError = error instanceof Error ? error.message : "Google Calendar cleanup needs a retry.";
        console.warn(
            "[booking-management] calendar reschedule failed",
            error instanceof Error ? error.message : error,
        );
    }

    if (calendarCleanupError) {
        await supabase
            .from("booking_reservations")
            .update({
                metadata: {
                    ...jsonRecord(reservation.metadata),
                    selfServiceReschedule: managementMetadata,
                    calendarCleanupRequired: true,
                    calendarCleanupError: calendarCleanupError.slice(0, 500),
                    calendarCleanupUpdatedAt: new Date().toISOString(),
                } as Json,
                updated_at: new Date().toISOString(),
            })
            .eq("id", reservation.id)
            .eq("workspace_id", reservation.workspace_id)
            .eq("status", resultingStatus);
    }

    await recordCustomerBusinessEvent(
        reservation,
        resultingStatus,
        matchingSlot.start,
    );
    revalidateManagementPaths();

    return {
        success: true,
        outcome: resultingStatus === "confirmed" ? "rescheduled" : "reschedule_pending",
        message: resultingStatus !== "confirmed"
            ? localize(
                locale,
                meetingProvisioningError
                    ? "Your new time is saved but awaits confirmation while the meeting provider retries. You will receive the updated room only after it is ready."
                    : calendarCleanupError
                    ? "Your new time is awaiting confirmation. Calendar cleanup is pending and the workspace will retry it."
                    : "Your new time is awaiting confirmation. We removed the old calendar hold and will email you after review.",
                meetingProvisioningError
                    ? "Uw nieuwe moment is opgeslagen, maar wacht op bevestiging terwijl de vergaderprovider opnieuw probeert. U ontvangt de bijgewerkte ruimte pas wanneer deze klaar is."
                    : calendarCleanupError
                    ? "Uw nieuwe moment wacht op bevestiging. Agenda-opruiming is in behandeling en de workspace probeert opnieuw."
                    : "Uw nieuwe moment wacht op bevestiging. We hebben de oude agendareservering verwijderd en mailen u na beoordeling.",
                meetingProvisioningError
                    ? "تم حفظ موعدك الجديد لكنه ينتظر التأكيد أثناء إعادة محاولة مزود الاجتماع. لن تتلقى رابط الغرفة المحدّث إلا بعد أن يصبح جاهزًا."
                    : calendarCleanupError
                    ? "موعدك الجديد بانتظار التأكيد. تنظيف التقويم قيد الانتظار وسيعيد فريق العمل المحاولة."
                    : "موعدك الجديد بانتظار التأكيد. أزلنا حجز التقويم القديم وسنرسل لك رسالة بعد المراجعة.",
            )
            : localize(
                locale,
                "Your booking has been moved and a confirmation email is on its way.",
                "Uw boeking is verplaatst en de bevestigingsmail is onderweg.",
                "تم تغيير موعد حجزك ورسالة التأكيد في طريقها إليك.",
            ),
    };
}

export async function manageCustomerBookingAction(
    _previousState: CustomerBookingManagementActionState,
    formData: FormData,
): Promise<CustomerBookingManagementActionState> {
    const parsed = manageActionSchema.safeParse({
        operation: formData.get("operation"),
        token: formData.get("token"),
        scheduledStart: formData.get("scheduledStart"),
    });
    if (!parsed.success) return actionError("The booking-management request is invalid.");

    const loaded = await loadReservationForCapability(parsed.data.token);
    if (!loaded) return actionError("This booking-management link is invalid or expired.");

    const { reservation } = loaded;
    const locale = localeFromAttribution(reservation.attribution_json);
    const policy = getCustomerBookingManagementPolicy({
        status: reservation.status,
        scheduledStart: reservation.scheduled_start,
    });

    if (parsed.data.operation === "cancel") {
        if (!policy.canCancel) return actionError(policy.reason ?? "This booking cannot be cancelled.");
        return cancelCustomerReservation(reservation, locale);
    }

    if (!policy.canReschedule) return actionError(policy.reason ?? "This booking cannot be rescheduled.");

    try {
        return await rescheduleCustomerReservation(reservation, parsed.data.scheduledStart, locale);
    } catch (error) {
        console.error(
            "[booking-management] reschedule failed",
            error instanceof Error ? error.message : error,
        );
        return actionError(localize(
            locale,
            "We could not change the booking right now. Please refresh and try again.",
            "We konden de boeking nu niet wijzigen. Vernieuw en probeer opnieuw.",
            "تعذر تغيير الحجز الآن. حدّث الصفحة وحاول مرة أخرى.",
        ));
    }
}
