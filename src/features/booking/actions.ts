"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { createHash, randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/shared/lib/supabase/server";
import type { Database, Tables, TablesInsert, TablesUpdate, Json } from "@/shared/lib/supabase/database.types";
import {
    applyAutomaticCooldownRule,
    assessAntiAbuseSubmission,
    extractAntiAbuseRequestContext,
    persistAntiAbuseEvent,
} from "@/shared/lib/anti-abuse/server";
import { sanitizeAnalyticsMetadataForExport } from "@/features/analytics/privacy";
import type { AnalyticsEventType } from "@/features/analytics/taxonomy";
import { assertWorkspaceBookingEnabled } from "@/shared/lib/workspace/context";
import {
    bookingAvailabilityPreviewSchema,
    bookingAvailabilityRuleUpsertSchema,
    bookingBlackoutWindowUpsertSchema,
    bookingDeliveryStartSchema,
    bookingFormDefinitionUpsertSchema,
    bookingLocationUpsertSchema,
    bookingMarkPaymentVerifiedSchema,
    bookingReservationFiltersSchema,
    bookingReservationStatusTransitionSchema,
    bookingReservationSubmissionSchema,
    bookingResourceUpsertSchema,
    bookingRuleDefinitionUpsertSchema,
    bookingServiceLocationLinkSchema,
    bookingServiceResourceLinkSchema,
    bookingServiceUpsertSchema,
    bookingStaffProfileUpsertSchema,
    bookingTemplateProfileUpsertSchema,
    type BookingAvailabilityPreviewInput,
    type BookingDeliveryStartInput,
    type BookingMarkPaymentVerifiedInput,
    type BookingReservationFiltersInput,
    type BookingReservationStatusTransitionInput,
    type BookingReservationSubmissionInput,
} from "@/features/booking/schema";
import {
    BOOKING_TEMPLATE_ADAPTERS,
    asJson,
    normalizeJsonRecord,
    type BookingAvailabilityResponse,
    type BookingDashboardSummary,
    type BookingPaymentDirective,
    type BookingPaymentProvider,
    type BookingPublicCatalog,
    type BookingSubmissionResult,
    type BookingTemplateKey,
} from "@/features/booking/types";
import { calculateBookingPrice } from "@/features/booking/lib/pricing";
import { evaluateMeetingProviderSetup, resolveBookingMeetingProvider } from "@/features/booking/lib/meeting-policy";
import { stageReservationStatusForMeeting } from "@/features/booking/lib/meeting-confirmation-policy";
import { provisionAndConfirmReservation } from "@/features/booking/lib/meeting-confirmation-orchestrator";
import { isZoomConfigured, verifyZoomMeetingProvisioning } from "@/features/booking/lib/zoom";
import { dateRangeToUtc, isValidIanaTimezone } from "@/features/booking/lib/timezone";
import { ensureBookingMeeting, cancelBookingMeeting } from "@/features/booking/lib/meeting-provider";
import { allowBookingAvailabilityRequest } from "@/features/booking/lib/availability-rate-limit";
import { decryptToken, deleteGoogleCalendarConnectionEvents, deleteReservationFromGoogleCalendar, getValidConnectionToken, verifyGoogleMeetingProvisioning } from "@/features/booking/lib/google-calendar";
import { getSiteSettings } from "@/features/templates/actions";
import { dispatchBookingEmails } from "@/features/booking/lib/booking-emails";
import {
    BOOKING_MINIMUM_LEAD_TIME_MINUTES,
    BOOKING_PAYMENT_COMPLETION_WINDOW_MINUTES,
    getBookingPaymentDeadlineAt,
    getEffectiveBookingLeadTimeMinutes,
    hasFullPaymentWindowBeforeAppointment,
} from "@/features/booking/lib/booking-policies";
import { expireUnpaidBookingReservationsByPaymentWindow } from "@/features/booking/lib/payment-expiry";
import { draftAgreementFromBooking } from "@/features/legal-vault/actions/integrations";
import { draftAgreementFromBookingInternal } from "@/features/legal-vault/lib/draft-agreement-internal";
import { ensureInvoiceFromBookingPayment } from "@/features/legal-vault/lib/invoice-from-booking-internal";
import { recordBookingBusinessEvent } from "@/features/business-spine/service";
import { recordPaymentBusinessEvent } from "@/features/business-spine/recorders";
import { createPayPalOrder } from "@/features/booking/lib/paypal";
import { subscribeNewsletterContact } from "@/features/newsletter/service";
import { buildSiteUrl } from "@/shared/lib/auth/redirect-url";
import { enqueueTransactionalEmail } from "@/features/communications/transactional-email";
import { getPortalActivationPlan, normalizeEmailLocale } from "@/features/communications/email-lifecycle";
import { localizeHref } from "@/shared/lib/i18n/routing";
import { normalizePrivacyPolicyUrl, normalizePublicHttpUrl } from "@/features/booking/lib/privacy";

type BookingServiceRow = Tables<"booking_services">;
type BookingReservationRow = Tables<"booking_reservations">;
type BookingSupabaseClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof getServiceRoleClient>;

interface BookingProvisionedClientLink {
    portalClientId: string;
    profileId: string;
    createdAuthUser: boolean;
    createdPortalClient: boolean;
    activationUrl: string | null;
}

export interface BookingPaymentCancellationFence {
    paymentId: string | null;
    provider: string | null;
    changed: boolean;
    fenceToken?: string | null;
    terminalProviderStatus?: string | null;
    previousStatus?: Tables<"booking_payments">["status"] | null;
    previousPaypalStatus?: string | null;
    previousPaymentUrl?: string | null;
}

const ACTIVE_RESERVATION_STATUSES: Array<BookingReservationRow["status"]> = [
    "pending_review",
    "pending_confirmation",
    "confirmed",
];

// The tenant-hardening migration replaces the legacy service_id-only foreign key with
// a tenant-bound (workspace_id, service_id) relationship. PostgREST therefore
// needs the composite constraint name as the embedding hint.
const BOOKING_RESERVATION_AVAILABILITY_SELECT = "id,service_id,resource_id,location_id,scheduled_start,scheduled_end,status,party_size,capacity_mode_snapshot,capacity_value_snapshot,booking_services!booking_reservations_workspace_service_fk(buffer_before_minutes,buffer_after_minutes)";

/**
 * Buffers from the `booking_services` embed on the availability select.
 *
 * The composite FK this embed resolves through
 * (`booking_reservations_workspace_service_fk`) is created in migration
 * 20260804120000 but is not represented in the generated database types, so
 * the embed arrives typed as a SelectQueryError. It is narrowed here rather
 * than at each call site. PostgREST returns either a single object or a
 * one-element array depending on how it infers cardinality, so both are
 * handled.
 */
function reservationServiceBuffers(embed: unknown): { before: number | null; after: number | null } {
    const row = Array.isArray(embed) ? embed[0] : embed;
    const service = (row ?? null) as { buffer_before_minutes?: number | null; buffer_after_minutes?: number | null } | null;
    return {
        before: service?.buffer_before_minutes ?? null,
        after: service?.buffer_after_minutes ?? null,
    };
}

const PAYMENT_FENCED_RESERVATION_STATUSES: Array<BookingReservationRow["status"]> = [
    "cancelled_by_customer",
    "cancelled_by_workspace",
    "expired",
    "no_show",
];

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

async function requireBookingManagementContext(requiredCapability?: string) {
    const context = await assertWorkspaceBookingEnabled();

    if (context.role !== "admin" && context.role !== "manager") {
        throw new Error("Unauthorized: booking management is restricted to admins and managers.");
    }

    if (requiredCapability && !context.effectiveCapabilities.includes(requiredCapability)) {
        throw new Error(`Forbidden: missing ${requiredCapability} capability.`);
    }

    return context;
}

function normalizeSlug(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
}

function revalidateBookingPaths() {
    revalidatePath("/(admin)/dashboard", "layout");
    revalidatePath("/(admin)/dashboard/booking", "layout");
    revalidatePath("/dashboard", "layout");
    revalidatePath("/booking", "page");
    revalidatePath("/(public)/booking", "page");
}

function getBookingTemplateAdapter(templateKey: string) {
    return BOOKING_TEMPLATE_ADAPTERS[(templateKey in BOOKING_TEMPLATE_ADAPTERS ? templateKey : "custom") as BookingTemplateKey];
}

function mapBookingStatusToAnalyticsEvent(status: BookingReservationRow["status"]): AnalyticsEventType | null {
    if (status === "confirmed") return "booking_confirmed";
    if (status === "completed") return "booking_completed";
    if (status === "cancelled_by_customer" || status === "cancelled_by_workspace") return "booking_cancelled";
    return null;
}

function buildBookingAnalyticsMetadata(input: {
    reservationId: string;
    serviceId: string | null;
    templateKey?: string | null;
    sourceChannel?: string | null;
    sourceCampaign?: string | null;
    sourceReferrer?: string | null;
    selectedSlot?: string | null;
    locale?: string | null;
    attribution?: Record<string, unknown> | null;
    extra?: Record<string, unknown>;
}) {
    return sanitizeAnalyticsMetadataForExport({
        reservationId: input.reservationId,
        bookingId: input.reservationId,
        serviceId: input.serviceId,
        templateKey: input.templateKey ?? null,
        sourceChannel: input.sourceChannel ?? null,
        sourceCampaign: input.sourceCampaign ?? null,
        source: input.sourceReferrer ? "public_booking_referral" : "booking_flow",
        selectedSlot: input.selectedSlot ?? null,
        locale: input.locale ?? null,
        ...(input.attribution ?? {}),
        ...(input.extra ?? {}),
    });
}

async function recordBookingAnalyticsEvent(input: {
    supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof getServiceRoleClient>;
    workspaceId: string;
    eventType: AnalyticsEventType;
    eventName?: string;
    reservationId: string;
    serviceId: string | null;
    templateKey?: string | null;
    sourceChannel?: string | null;
    sourceCampaign?: string | null;
    sourceReferrer?: string | null;
    selectedSlot?: string | null;
    locale?: string | null;
    attribution?: Record<string, unknown> | null;
    extra?: Record<string, unknown>;
}) {
    const analyticsClient = input.supabase as unknown as {
        from: (table: string) => {
            insert: (payload: Record<string, unknown>) => Promise<unknown>;
        };
    };

    await analyticsClient.from("analytics_events").insert({
        workspace_id: input.workspaceId,
        page_slug: "booking",
        event_type: input.eventType,
        event_name: input.eventName ?? input.eventType,
        referrer: input.sourceReferrer ?? null,
        path: "/booking",
        metadata: asJson(buildBookingAnalyticsMetadata(input)),
    });
}

function normalizePublicSiteDomain(siteDomain: string | null | undefined) {
    if (!siteDomain) {
        return null;
    }

    return siteDomain
        .trim()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/:\d+$/, "")
        .replace(/\/.*$/, "")
        .toLowerCase() || null;
}

function allowLegacyPublicWorkspaceFallback(host: string | null): boolean {
    if (process.env.NODE_ENV !== "production") return true;
    if (process.env.BOOKING_ALLOW_LEGACY_DOMAIN_FALLBACK === "true") return true;
    const configuredHost = normalizePublicSiteDomain(process.env.NEXT_PUBLIC_SITE_URL);
    return Boolean(host && configuredHost && host === configuredHost);
}

async function getRequestPublicWorkspaceId(supabase: ReturnType<typeof getServiceRoleClient>): Promise<string | null> {
    const host = normalizePublicSiteDomain((await headers()).get("host"));
    if (host) {
        const { data } = await supabase
            .from("workspace_settings")
            .select("workspace_id")
            .eq("site_domain", host)
            .maybeSingle();
        if (data?.workspace_id) return data.workspace_id;
    }

    // Match the public catalog's fallback only for local previews or the
    // explicitly configured canonical site. An unknown production Host must
    // never select an arbitrary first active tenant.
    if (!allowLegacyPublicWorkspaceFallback(host)) return null;
    const siteSettings = await getSiteSettings();
    const { data: fallbackWorkspace } = await supabase
        .from("workspaces")
        .select("id")
        .eq("legacy_template_id", siteSettings.activeTemplate)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
    return fallbackWorkspace?.id ?? null;
}

function normalizeWorkspaceTier(value: string): "basic" | "pro" {
    return value === "pro" ? "pro" : "basic";
}

const PUBLIC_BOOKING_PROFILE_SETTING_KEYS = new Set([
    "hero_heading",
    "hero_heading_nl",
    "hero_heading_ar",
    "hero_body",
    "hero_body_nl",
    "hero_body_ar",
    "cta_microcopy",
    "cta_microcopy_nl",
    "cta_microcopy_ar",
]);

function projectPublicBookingProfileSettings(value: Json | null | undefined): Record<string, unknown> {
    const source = normalizeJsonRecord(value);
    return Object.fromEntries(
        Object.entries(source)
            .filter(([key, candidate]) => PUBLIC_BOOKING_PROFILE_SETTING_KEYS.has(key) && typeof candidate === "string")
            .map(([key, candidate]) => [key, String(candidate).slice(0, 2_000)]),
    );
}

function getBookingStateForWorkspace(workspaceTier: string, hasActiveProfile: boolean): BookingAvailabilityResponse["bookingState"] {
    if (workspaceTier !== "pro") {
        return "gated";
    }

    return hasActiveProfile ? "active" : "unavailable";
}

function deriveInitialReservationStatus(service: BookingServiceRow, templateKey: string): BookingReservationRow["status"] {
    const adapter = getBookingTemplateAdapter(templateKey);
    const requiresManualReview = Boolean(service.requires_manual_review);

    if (requiresManualReview || adapter.templateKey === "real_estate") {
        return "pending_review";
    }

    // Paid services hold the slot in pending_confirmation until an operator
    // manually verifies the off-platform Revolut Pro payment.
    if (service.payment_required) {
        return "pending_confirmation";
    }

    if (adapter.templateKey === "horeca" && service.capacity_mode !== "single") {
        return "pending_confirmation";
    }

    return "confirmed";
}

function buildPaymentInstructions(
    customerInstructions: string | null | undefined,
    reference: string,
): string {
    const base = (customerInstructions ?? "").trim();
    const referenceLine = `Please include the booking reference "${reference}" in the Revolut payment note so we can match the payment to your booking quickly.`;
    return base.length > 0 ? `${base}\n\n${referenceLine}` : referenceLine;
}

function normalizeBookingPaymentProvider(value: string | null | undefined): BookingPaymentProvider {
    if (value === "paypal_checkout" || value === "paypal") {
        return "paypal_checkout";
    }

    return "manual_revolut_pro";
}

function mergeJsonRecord(value: Json | null | undefined, patch: Record<string, unknown>): Json {
    const base = value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};

    return asJson({ ...base, ...patch });
}

/**
 * Keep a compact, provider-neutral audit trail when a PayPal checkout is
 * reissued. PayPal capture webhooks normally include the related order ID,
 * but retaining every locally observed order ID lets webhook reconciliation
 * fail closed when a provider payload omits that relation.
 */
function appendPayPalOrderHistory(
    value: Json | null | undefined,
    orderId: string,
    requestId: string,
): Json {
    const base = normalizeJsonRecord(value);
    const existing = Array.isArray(base.paypalOrderHistory)
        ? base.paypalOrderHistory.filter((entry): entry is Record<string, unknown> => (
            Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)
        ))
        : [];
    const history = existing.some((entry) => entry.id === orderId)
        ? existing
        : [
            ...existing,
            {
                id: orderId,
                requestId,
                linkedAt: new Date().toISOString(),
            },
        ];

    return asJson({
        ...base,
        paypalCurrentOrderId: orderId,
        paypalOrderHistory: history.slice(-20),
    });
}

function deriveNextStepsKind(
    status: BookingReservationRow["status"],
    payment: BookingPaymentDirective | null,
): import("@/features/booking/types").BookingSubmissionNextStepsKind {
    if (status === "pending_review") return "pending_review";
    if (status === "pending_confirmation" && payment) return "pending_confirmation_payment";
    if (status === "pending_confirmation") return "pending_confirmation";
    return "captured";
}

interface VerifyBookingPaymentParams {
    supabase: BookingSupabaseClient;
    workspaceId: string;
    reservationId?: string;
    paymentId?: string;
    actorId?: string | null;
    actorType?: "system" | "workspace_manager";
    triggerSource?: "system" | "operator";
    note?: string | null;
    autoConfirm?: boolean;
    verificationSource: "manual" | "paypal_return" | "paypal_webhook";
    /** Provider order identity observed with this capture; null is an
     * intentional fence when the local order-link write has not committed. */
    expectedPaypalOrderId?: string | null;
    paymentUpdate?: TablesUpdate<"booking_payments">;
    metadata?: Record<string, unknown>;
}

/**
 * Fences an unpaid payment before a reservation is cancelled or expired.
 * PayPal cancellation keeps the requested row and records CUSTOMER_CANCELLED
 * for auditability; expiry moves every provider to the local expired state.
 * The compare-and-set prevents a stale browser return or webhook from
 * capturing after the cancellation wins.
 */
export async function fenceBookingPaymentForCancellation(params: {
    supabase: ReturnType<typeof getServiceRoleClient>;
    workspaceId: string;
    reservationId: string;
    source: "customer" | "operator" | "system";
    reason?: string | null;
    terminalProviderStatus?: "CUSTOMER_CANCELLED" | "EXPIRED";
}): Promise<BookingPaymentCancellationFence> {
    const { data: payment, error: paymentLookupError } = await params.supabase
        .from("booking_payments")
        .select("id,status,provider,paypal_order_id,paypal_status,payment_url,metadata")
        .eq("workspace_id", params.workspaceId)
        .eq("reservation_id", params.reservationId)
        .maybeSingle();

    if (paymentLookupError) {
        throw new Error(paymentLookupError.message);
    }
    if (!payment) {
        return { paymentId: null, provider: null, changed: false };
    }

    const isPayPalProvider = payment.provider === "paypal_checkout" || payment.provider === "paypal";
    // An interrupted capture is intentionally left requested until a provider
    // GET/webhook proves whether money moved. Do not cancel or expire the
    // reservation underneath that reconciliation window: a late capture must
    // never be attached to a customer-cancelled/expired booking.
    if (isPayPalProvider && [
        "COMPLETED",
        "CAPTURE_PENDING_RECONCILIATION",
        "CAPTURE_COMPLETED_PENDING_RECONCILIATION",
    ].includes(payment.paypal_status ?? "")) {
        throw new Error("PayPal capture reconciliation is still in progress. Retry after the provider status is resolved.");
    }
    const terminalProviderStatus = params.terminalProviderStatus ?? "CUSTOMER_CANCELLED";
    const isExpiryFence = terminalProviderStatus === "EXPIRED";
    const now = new Date().toISOString();
    const fenceToken = randomUUID();
    const paymentMetadata = {
        ...normalizeJsonRecord(payment.metadata),
        paymentCancellation: {
            cancelledAt: now,
            source: params.source,
            reason: params.reason ?? null,
            fenceToken,
            terminalProviderStatus,
            // Keep the exact pre-fence state so a reservation CAS failure can
            // compensate even after the browser retries the PayPal cancel
            // return and only the provider marker remains visible.
            previousStatus: payment.status,
            previousPaypalStatus: payment.paypal_status,
            previousPaymentUrl: payment.payment_url,
        },
    } as Json;

    if (payment.status !== "requested") {
        // A terminal payment should not expose a stale approval URL in a
        // cancellation email, but it must otherwise remain unchanged.
        if (payment.payment_url) {
            const { error: clearUrlError } = await params.supabase
                .from("booking_payments")
                .update({ payment_url: null, updated_at: now })
                .eq("id", payment.id)
                .eq("workspace_id", params.workspaceId);
            if (clearUrlError) {
                console.warn("[booking] cancelled payment URL could not be cleared", clearUrlError.message);
            }
        }
        return { paymentId: payment.id, provider: payment.provider, changed: false };
    }

    const paymentUpdate: TablesUpdate<"booking_payments"> = {
        payment_url: null,
        metadata: paymentMetadata,
        updated_at: now,
        ...(isPayPalProvider
            ? {
                paypal_status: terminalProviderStatus,
                provider_synced_at: now,
                ...(isExpiryFence
                    ? {
                        status: "expired",
                        failure_reason: params.reason ?? "Booking payment expired before completion.",
                    }
                    : {}),
            }
            : {
                status: isExpiryFence ? "expired" : "failed",
                failure_reason: params.reason ?? (isExpiryFence
                    ? "Booking payment expired before completion."
                    : "Booking was cancelled before payment completed."),
            }),
    };

    let cancellationQuery = params.supabase
        .from("booking_payments")
        .update(paymentUpdate)
        .eq("id", payment.id)
        .eq("workspace_id", params.workspaceId)
        .eq("status", "requested");

    if (isPayPalProvider) {
        cancellationQuery = cancellationQuery.or(
            // Only an order still eligible for capture may be fenced. A
            // completed, expired, failed, or refunded provider state must be
            // reconciled separately and never overwritten by cancellation.
            "paypal_status.is.null,paypal_status.eq.CREATED,paypal_status.eq.PAYER_ACTION_REQUIRED,paypal_status.eq.APPROVED",
        );
    }

    const { data: updatedPayment, error: paymentUpdateError } = await cancellationQuery
        .select("id")
        .maybeSingle();

    if (paymentUpdateError) {
        throw new Error(paymentUpdateError.message);
    }

    if (!updatedPayment) {
        // The provider may already have reached a terminal state while the
        // reservation was being cancelled. Clear only the customer-facing URL;
        // capture/refund reconciliation remains owned by the provider event.
        const { data: latestPayment } = await params.supabase
            .from("booking_payments")
            .select("status,paypal_status,paypal_order_id,metadata")
            .eq("id", payment.id)
            .eq("workspace_id", params.workspaceId)
            .maybeSingle();
        if (isPayPalProvider && latestPayment?.status === "requested" && latestPayment.paypal_status === "COMPLETED") {
            const latestMetadata = normalizeJsonRecord(latestPayment.metadata);
            await params.supabase
                .from("booking_payments")
                .update({
                    metadata: asJson({
                        ...latestMetadata,
                        lateCaptureNeedsReview: true,
                        lateCaptureObservedAt: now,
                        lateCaptureSource: "booking_cancellation_race",
                    }),
                    payment_url: null,
                    updated_at: now,
                })
                .eq("id", payment.id)
                .eq("workspace_id", params.workspaceId)
                .eq("status", "requested")
                .eq("paypal_status", "COMPLETED");
            try {
                await recordPaymentBusinessEvent({
                    supabase: params.supabase,
                    workspaceId: params.workspaceId,
                    eventType: "captured_after_terminal",
                    paymentId: payment.id,
                    bookingId: params.reservationId,
                    providerEventId: latestPayment.paypal_order_id ?? payment.paypal_order_id,
                    payload: { source: "booking_cancellation_race", reason: params.reason ?? null },
                });
            } catch (error) {
                console.warn("[booking] late PayPal capture reconciliation event failed", error);
            }
        }
        if (payment.payment_url) {
            const { error: clearUrlError } = await params.supabase
                .from("booking_payments")
                .update({ payment_url: null, updated_at: now })
                .eq("id", payment.id)
                .eq("workspace_id", params.workspaceId)
                .eq("status", "requested");
            if (clearUrlError) {
                console.warn("[booking] cancelled payment URL could not be cleared", clearUrlError.message);
            }
        }
        return { paymentId: payment.id, provider: payment.provider, changed: false };
    }

    if (isPayPalProvider) {
        try {
            await recordPaymentBusinessEvent({
                supabase: params.supabase,
                workspaceId: params.workspaceId,
                eventType: terminalProviderStatus === "EXPIRED" ? "failed" : "cancelled",
                paymentId: payment.id,
                bookingId: params.reservationId,
                providerEventId: `booking-cancellation:${params.reservationId}`,
                payload: { source: params.source, reason: params.reason ?? null },
            });
        } catch (error) {
            console.warn("[booking] payment cancellation lifecycle recorder failed", error);
        }
    }

    return {
        paymentId: payment.id,
        provider: payment.provider,
        changed: true,
        fenceToken,
        terminalProviderStatus,
        previousStatus: payment.status,
        previousPaypalStatus: payment.paypal_status,
        previousPaymentUrl: payment.payment_url,
    };
}

/**
 * If a cancellation CAS loses to a concurrent confirmation/reschedule, undo
 * only the exact payment fence created by that cancellation. The fence token
 * and provider marker make this compensation safe against a later webhook or
 * a second cancellation attempt.
 */
export async function restoreBookingPaymentFenceAfterTransitionRace(params: {
    supabase: ReturnType<typeof getServiceRoleClient>;
    workspaceId: string;
    reservationId: string;
    fence: BookingPaymentCancellationFence;
}): Promise<void> {
    if (!params.fence.changed || !params.fence.paymentId || !params.fence.fenceToken) return;

    const { data: reservation } = await params.supabase
        .from("booking_reservations")
        .select("status")
        .eq("id", params.reservationId)
        .eq("workspace_id", params.workspaceId)
        .maybeSingle();
    if (!reservation || PAYMENT_FENCED_RESERVATION_STATUSES.includes(reservation.status)) return;

    const { data: payment } = await params.supabase
        .from("booking_payments")
        .select("id,status,provider,paypal_status,payment_url,metadata")
        .eq("id", params.fence.paymentId)
        .eq("workspace_id", params.workspaceId)
        .maybeSingle();
    if (!payment) return;

    const currentMetadata = normalizeJsonRecord(payment.metadata);
    const currentCancellation = normalizeJsonRecord(currentMetadata.paymentCancellation as Json);
    if (currentCancellation.fenceToken !== params.fence.fenceToken) return;

    const restoredMetadata = { ...currentMetadata };
    delete restoredMetadata.paymentCancellation;
    let restoreQuery = params.supabase
        .from("booking_payments")
        .update({
            status: params.fence.previousStatus ?? "requested",
            payment_url: params.fence.previousPaymentUrl ?? null,
            metadata: asJson(restoredMetadata),
            failure_reason: null,
            ...(payment.provider === "paypal_checkout" || payment.provider === "paypal"
                ? {
                    paypal_status: params.fence.previousPaypalStatus ?? null,
                    provider_synced_at: new Date().toISOString(),
                }
                : {}),
            updated_at: new Date().toISOString(),
        } satisfies TablesUpdate<"booking_payments">)
        .eq("id", payment.id)
        .eq("workspace_id", params.workspaceId)
        .eq("metadata->paymentCancellation->>fenceToken", params.fence.fenceToken);

    const fencedStatus = params.fence.terminalProviderStatus === "EXPIRED" ? "expired" : "requested";
    if (payment.provider === "paypal_checkout" || payment.provider === "paypal") {
        restoreQuery = restoreQuery
            .eq("status", fencedStatus)
            .eq("paypal_status", params.fence.terminalProviderStatus ?? "CUSTOMER_CANCELLED");
    } else {
        restoreQuery = restoreQuery.eq("status", fencedStatus === "expired" ? "expired" : "failed");
    }

    const { error } = await restoreQuery;
    if (error) {
        console.warn("[booking] payment fence compensation failed", error.message);
    }
}

export interface VerifyBookingPaymentResult {
    reservationStatus: BookingReservationRow["status"];
    paymentStatus: "verified";
    alreadyVerified: boolean;
}

export async function verifyBookingPaymentAndMaybeConfirm(params: VerifyBookingPaymentParams): Promise<VerifyBookingPaymentResult> {
    const { workspaceId } = params;
    const supabase = params.supabase as ReturnType<typeof getServiceRoleClient>;
    const autoConfirm = params.autoConfirm ?? true;
    const now = new Date().toISOString();

    let paymentQuery = supabase
        .from("booking_payments")
        .select("*")
        .eq("workspace_id", workspaceId);

    if (params.paymentId) {
        paymentQuery = paymentQuery.eq("id", params.paymentId);
    } else if (params.reservationId) {
        paymentQuery = paymentQuery.eq("reservation_id", params.reservationId);
    } else {
        throw new Error("Payment ID or reservation ID is required.");
    }

    const { data: payment, error: paymentLookupError } = await paymentQuery.maybeSingle();

    if (paymentLookupError || !payment) {
        throw new Error("Payment record not found for this reservation.");
    }

    if (params.verificationSource === "manual" && payment.provider !== "manual_revolut_pro") {
        throw new Error("PayPal payments can only be verified after PayPal confirms the capture.");
    }

    const { data: reservation, error: reservationError } = await supabase
        .from("booking_reservations")
        .select("id,status,public_reference,workspace_id,service_id,template_profile_id,source_channel,source_campaign,source_referrer,scheduled_start,reservation_timezone,attribution_json,metadata,customer_full_name,customer_email,customer_phone,portal_client_id")
        .eq("id", payment.reservation_id)
        .eq("workspace_id", workspaceId)
        .maybeSingle();

    if (reservationError || !reservation) {
        throw new Error("Reservation not found.");
    }

    if (params.reservationId && reservation.id !== params.reservationId) {
        throw new Error("Payment does not belong to the requested reservation.");
    }

    if (payment.status === "verified") {
        return { reservationStatus: reservation.status, paymentStatus: "verified", alreadyVerified: true };
    }

    if (payment.status === "refunded" || payment.status === "expired" || payment.status === "failed") {
        throw new Error(`Cannot verify a ${payment.status} payment. Create a fresh booking instead.`);
    }

    const paymentUpdate: TablesUpdate<"booking_payments"> = {
        ...(params.paymentUpdate ?? {}),
        status: "verified",
        verified_at: now,
        verified_by: params.actorId ?? null,
        verified_note: params.note ?? null,
        failure_reason: null,
        updated_at: now,
    };

    let paymentClaimQuery = supabase
        .from("booking_payments")
        .update(paymentUpdate)
        .eq("id", payment.id)
        .eq("workspace_id", workspaceId)
        .eq("status", "requested");
    if (payment.provider === "paypal_checkout" || payment.provider === "paypal") {
        // PayPal may deliver an order-approved webhook while the browser
        // return is capturing the same order. Provider status is therefore
        // allowed to advance independently; explicit cancellation/expiry
        // markers must fence off a stale capture callback.
        // A manual operator verification is never provider evidence. Pending
        // reconciliation markers are admitted only when this call is driven
        // by a verified PayPal webhook that carries the capture association.
        const paypalStatusFilter = params.verificationSource === "paypal_webhook"
            ? "paypal_status.is.null,paypal_status.eq.CREATED,paypal_status.eq.PAYER_ACTION_REQUIRED,paypal_status.eq.APPROVED,paypal_status.eq.COMPLETED,paypal_status.eq.CAPTURE_COMPLETED_PENDING_RECONCILIATION,paypal_status.eq.CAPTURE_PENDING_RECONCILIATION"
            : "paypal_status.is.null,paypal_status.eq.CREATED,paypal_status.eq.PAYER_ACTION_REQUIRED,paypal_status.eq.APPROVED,paypal_status.eq.COMPLETED";
        paymentClaimQuery = paymentClaimQuery.or(
            paypalStatusFilter,
        );
        if (params.expectedPaypalOrderId) {
            paymentClaimQuery = paymentClaimQuery.eq("paypal_order_id", params.expectedPaypalOrderId);
        } else if (params.expectedPaypalOrderId === null) {
            paymentClaimQuery = paymentClaimQuery.is("paypal_order_id", null);
        }
    }
    const { data: claimedPayment, error: paymentUpdateError } = await paymentClaimQuery
        .select("id")
        .maybeSingle();

    if (paymentUpdateError) {
        throw new Error(paymentUpdateError.message);
    }
    if (!claimedPayment) {
        const { data: latestPayment } = await supabase
            .from("booking_payments")
            .select("status")
            .eq("id", payment.id)
            .eq("workspace_id", workspaceId)
            .maybeSingle();
        if (latestPayment?.status === "verified") {
            return { reservationStatus: reservation.status, paymentStatus: "verified", alreadyVerified: true };
        }
        throw new Error("Payment was changed before verification completed. Refresh and retry with the current payment state.");
    }

    let resultingReservationStatus = reservation.status;
    const actorType = params.actorType ?? "workspace_manager";
    const triggerSource = params.triggerSource ?? (actorType === "system" ? "system" : "operator");
    const reason = params.note
        ?? (params.verificationSource === "manual" ? "Payment verified by workspace operator." : "Payment verified by PayPal capture.");
    const historyPayload = asJson({
        paymentId: payment.id,
        provider: payment.provider,
        verificationSource: params.verificationSource,
        note: params.note ?? null,
        ...(params.metadata ?? {}),
    });

    if (autoConfirm && reservation.status === "pending_confirmation") {
        const reservationMetadata = normalizeJsonRecord(reservation.metadata);
        const selfServiceReschedule = normalizeJsonRecord(reservationMetadata.selfServiceReschedule as Json);
        const confirmingReviewedReschedule = (
            selfServiceReschedule.requiresReview === true
            && selfServiceReschedule.state === "pending_review"
        );
        const confirmationEvent = confirmingReviewedReschedule
            ? "reservation_rescheduled" as const
            : "reservation_confirmed" as const;
        const confirmedMetadata = confirmingReviewedReschedule
            ? {
                ...reservationMetadata,
                selfServiceReschedule: {
                    ...selfServiceReschedule,
                    state: "confirmed",
                    confirmedAt: now,
                    confirmedBy: params.actorId ?? null,
                    confirmationSource: params.verificationSource,
                },
            }
            : reservationMetadata;
        const meetingProvider = reservationMetadata.meetingProvider === "zoom"
            || reservationMetadata.meetingProvider === "google_meet"
            || reservationMetadata.meetingProvider === "none"
            ? reservationMetadata.meetingProvider
            : "google_meet";
        const confirmation = await provisionAndConfirmReservation({
            provider: meetingProvider,
            provisionMeeting: () => ensureBookingMeeting(supabase, reservation.id),
            commitConfirmation: async () => {
                const { data: confirmedReservation, error: reservationUpdateError } = await supabase
                    .from("booking_reservations")
                    .update({
                        status: "confirmed",
                        metadata: confirmedMetadata as Json,
                        requires_manual_review: false,
                        manual_review_reason: null,
                        updated_at: now,
                    })
                    .eq("id", reservation.id)
                    .eq("workspace_id", workspaceId)
                    .eq("status", "pending_confirmation")
                    .select("id")
                    .maybeSingle();
                if (reservationUpdateError) throw new Error(reservationUpdateError.message);
                return Boolean(confirmedReservation);
            },
        });

        if (!confirmation.confirmed && confirmation.meetingStatus !== "ready") {
            const pendingReason = `Payment verified; confirmation is waiting for meeting provisioning. ${confirmation.reason ?? ""}`.trim();
            await Promise.all([
                supabase.from("booking_status_history").insert({
                    workspace_id: workspaceId,
                    reservation_id: reservation.id,
                    from_status: "pending_confirmation",
                    to_status: "pending_confirmation",
                    trigger_source: triggerSource,
                    actor_type: actorType,
                    actor_id: params.actorId ?? null,
                    reason: pendingReason,
                    payload_json: historyPayload,
                }),
                supabase.from("booking_notification_events").insert({
                    workspace_id: workspaceId,
                    reservation_id: reservation.id,
                    event_type: "reservation_pending_review",
                    channel: "internal_dashboard",
                    delivery_status: "pending",
                    payload_json: asJson({
                        reason: pendingReason,
                        paymentReference: reservation.public_reference,
                        verificationSource: params.verificationSource,
                        meetingProvider,
                        emailDispatchRequired: true,
                    }),
                }),
            ]);
            await dispatchBookingEmails({
                supabase,
                workspaceId,
                reservationId: reservation.id,
                eventType: "reservation_pending_review",
                reason: pendingReason,
            });
            try {
                await recordBookingBusinessEvent({
                    supabase,
                    workspaceId,
                    reservationId: reservation.id,
                    status: "pending_confirmation",
                    customerName: reservation.customer_full_name,
                    customerEmail: reservation.customer_email,
                    customerPhone: reservation.customer_phone,
                    portalClientId: reservation.portal_client_id,
                    scheduledStart: reservation.scheduled_start,
                    paymentStatus: "verified",
                    engagementStarted: false,
                    source: "payment",
                });
            } catch (error) {
                console.warn("[booking] pending meeting lifecycle recorder failed", error instanceof Error ? error.message : error);
            }
            revalidateBookingPaths();
            return { reservationStatus: "pending_confirmation", paymentStatus: "verified", alreadyVerified: false };
        }

        if (!confirmation.confirmed) {
            // Another callback/operator may have moved the reservation after
            // we read it. Report the committed status instead of claiming a
            // confirmation that may have been replaced by cancellation.
            const { data: latestReservation } = await supabase
                .from("booking_reservations")
                .select("status")
                .eq("id", reservation.id)
                .eq("workspace_id", workspaceId)
                .maybeSingle();
            if (latestReservation && PAYMENT_FENCED_RESERVATION_STATUSES.includes(latestReservation.status)) {
                const reconciliationMetadata = {
                    ...normalizeJsonRecord((params.paymentUpdate?.metadata as Json | undefined) ?? payment.metadata),
                    lateCaptureNeedsReview: true,
                    paymentVerificationReservationStatus: latestReservation.status,
                };
                await supabase
                    .from("booking_payments")
                    .update({
                        metadata: asJson(reconciliationMetadata),
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", payment.id)
                    .eq("workspace_id", workspaceId)
                    .eq("status", "verified");
                try {
                    await recordPaymentBusinessEvent({
                        supabase,
                        workspaceId,
                        eventType: "captured_after_terminal",
                        paymentId: payment.id,
                        bookingId: reservation.id,
                        amountCents: payment.amount_cents,
                        currency: payment.currency,
                        providerEventId: typeof params.metadata?.providerEventId === "string"
                            ? params.metadata.providerEventId
                            : null,
                        netAmountCents: payment.net_amount_cents,
                        vatAmountCents: payment.vat_amount_cents,
                        vatRateBasisPoints: payment.vat_rate_basis_points,
                        grossAmountCents: payment.gross_amount_cents,
                        payload: {
                            source: params.verificationSource,
                            reservationStatus: latestReservation.status,
                            reconciliationRequired: true,
                        },
                    });
                } catch (error) {
                    console.warn("[booking] late capture reconciliation recorder failed", error);
                }
            }
            return {
                reservationStatus: latestReservation?.status ?? reservation.status,
                paymentStatus: "verified",
                alreadyVerified: true,
            };
        }

        resultingReservationStatus = "confirmed";

        await recordBookingAnalyticsEvent({
            supabase,
            workspaceId,
            eventType: "booking_confirmed",
            reservationId: reservation.id,
            serviceId: reservation.service_id,
            templateKey: typeof (reservation.metadata as Record<string, unknown> | null)?.templateKey === "string"
                ? (reservation.metadata as Record<string, unknown>).templateKey as string
                : null,
            sourceChannel: reservation.source_channel,
            sourceCampaign: reservation.source_campaign,
            sourceReferrer: reservation.source_referrer,
            selectedSlot: reservation.scheduled_start,
            locale: typeof (reservation.attribution_json as Record<string, unknown> | null)?.locale === "string"
                ? (reservation.attribution_json as Record<string, unknown>).locale as string
                : null,
            attribution: normalizeJsonRecord(reservation.attribution_json),
            extra: {
                paymentId: payment.id,
                paymentReference: reservation.public_reference,
                reservationTimezone: reservation.reservation_timezone,
                verificationSource: params.verificationSource,
                ...(params.metadata ?? {}),
            },
        });

        await Promise.all([
            supabase.from("booking_status_history").insert({
                workspace_id: workspaceId,
                reservation_id: reservation.id,
                from_status: "pending_confirmation",
                to_status: "confirmed",
                trigger_source: triggerSource,
                actor_type: actorType,
                actor_id: params.actorId ?? null,
                reason,
                payload_json: historyPayload,
            }),
            supabase.from("booking_notification_events").insert({
                workspace_id: workspaceId,
                reservation_id: reservation.id,
                event_type: confirmationEvent,
                channel: "internal_dashboard",
                delivery_status: "pending",
                payload_json: asJson({
                    reason,
                    paymentReference: reservation.public_reference,
                    verificationSource: params.verificationSource,
                    emailDispatchRequired: true,
                }),
            }),
        ]);

        await dispatchBookingEmails({
            supabase,
            workspaceId,
            reservationId: reservation.id,
            eventType: confirmationEvent,
            reason,
        });

        try {
            await draftAgreementFromBookingInternal({
                bookingId: reservation.id,
                workspaceId,
            });
        } catch (error: unknown) {
            console.warn(
                "[booking] draftAgreementFromBooking failed",
                error instanceof Error ? error.message : error,
            );
        }
        const invoiceResult = await ensureInvoiceFromBookingPayment({
            workspaceId,
            paymentId: payment.id,
            supabase,
        });
        if (!invoiceResult.success) {
            console.warn("[booking] booking invoice draft deferred", invoiceResult.error);
        }
    } else {
        await supabase.from("booking_status_history").insert({
            workspace_id: workspaceId,
            reservation_id: reservation.id,
            from_status: reservation.status,
            to_status: reservation.status,
            trigger_source: triggerSource,
            actor_type: actorType,
            actor_id: params.actorId ?? null,
            reason: autoConfirm ? "Payment verified; reservation status did not require confirmation." : "Payment marked verified (manual confirmation pending).",
            payload_json: historyPayload,
        });
    }

    try {
        await recordBookingBusinessEvent({
            supabase,
            workspaceId,
            reservationId: reservation.id,
            status: resultingReservationStatus,
            customerName: reservation.customer_full_name,
            customerEmail: reservation.customer_email,
            customerPhone: reservation.customer_phone,
            portalClientId: reservation.portal_client_id,
            scheduledStart: reservation.scheduled_start,
            paymentStatus: "verified",
            // A completed session is still a qualification milestone. Active
            // lifecycle requires an explicit implementation/delivery-start
            // signal, never an inferred booking status.
            engagementStarted: false,
            source: "payment",
        });
    } catch (error) {
        console.warn("[booking] payment lifecycle recorder failed", error instanceof Error ? error.message : error);
    }

    revalidateBookingPaths();
    return { reservationStatus: resultingReservationStatus, paymentStatus: "verified", alreadyVerified: false };
}

function buildNextStepsFallback(
    kind: import("@/features/booking/types").BookingSubmissionNextStepsKind,
    payment: BookingPaymentDirective | null,
): string[] {
    if (kind === "pending_review") {
        return [
            "Your request is waiting for workspace review.",
            "A workspace operator will confirm the final slot details.",
        ];
    }
    if (kind === "pending_confirmation_payment" && payment) {
        if (payment.provider === "paypal_checkout") {
            return [
                "Your slot is temporarily reserved.",
                "Pay securely with PayPal. You will be redirected to PayPal to complete payment.",
                "Your booking is confirmed automatically after payment is captured.",
            ];
        }

        return [
            "Your slot is temporarily reserved.",
            `Complete the secure payment through Revolut to confirm your booking — include reference "${payment.paymentReference}" in the payment note.`,
            "We confirm the booking once we verify the payment in our system.",
        ];
    }
    if (kind === "pending_confirmation") {
        return [
            "Your reservation is pending confirmation.",
            "You will receive a follow-up message once seating is reviewed.",
        ];
    }
    return [
        "Your reservation has been captured.",
        "You will receive confirmation details from the workspace shortly.",
    ];
}

function deriveBookingSubmissionFingerprint(payload: BookingReservationSubmissionInput): string {
    // The provider/browser may serialize the same instant with different
    // offsets. Canonicalize it before deriving the idempotency fence so a
    // retry such as 10:00+02:00 and 08:00Z cannot create another booking.
    const scheduledStart = new Date(payload.scheduledStart);
    const canonicalScheduledStart = Number.isNaN(scheduledStart.getTime())
        ? payload.scheduledStart
        : scheduledStart.toISOString();

    // Deliberately exclude anti-abuse timestamps and marketing metadata so a
    // transport retry describes the same logical booking intent. This is the
    // server-owned fence; a caller-provided random key must not weaken it.
    return JSON.stringify({
        serviceId: payload.serviceId,
        resourceId: payload.resourceId ?? null,
        locationId: payload.locationId ?? null,
        scheduledStart: canonicalScheduledStart,
        partySize: payload.partySize,
        customerEmail: payload.customer.email.trim().toLowerCase(),
    });
}

function deriveBookingSubmissionIdempotencyKey(payload: BookingReservationSubmissionInput): string {
    const fingerprint = deriveBookingSubmissionFingerprint(payload);
    return `derived-${createHash("sha256").update(fingerprint).digest("hex")}`;
}

async function loadIdempotentBookingSubmission(params: {
    supabase: ReturnType<typeof getServiceRoleClient>;
    workspaceId: string;
    serviceId: string;
    idempotencyKey: string;
    submissionFingerprint: string;
    paymentExpected: boolean;
    expected: {
        customerEmail: string;
        scheduledStart: string;
        resourceId: string | null;
        locationId: string | null;
        partySize: number;
    };
}): Promise<{ found: false } | { found: true; reservationId: string; result: BookingSubmissionResult | null; paymentPending?: boolean; paymentMissing?: boolean }> {
    const reservationSelect = "id,service_id,public_reference,status,metadata,created_at,updated_at,submission_lease_id,submission_lease_expires_at,customer_email,scheduled_start,resource_id,location_id,party_size";
    const { data: keyedReservation, error: reservationError } = await params.supabase
        .from("booking_reservations")
        .select(reservationSelect)
        .eq("workspace_id", params.workspaceId)
        .eq("idempotency_key", params.idempotencyKey)
        .in("status", ACTIVE_RESERVATION_STATUSES)
        .maybeSingle();
    if (reservationError) throw new Error(reservationError.message);
    let reservation = keyedReservation;

    // Older browser versions generated a random key. Fall back to the
    // canonical booking intent so a reload/new tab cannot duplicate one of
    // those already-created reservations during the rollout.
    if (!reservation) {
        const { data: fingerprintReservation, error: fingerprintError } = await params.supabase
            .from("booking_reservations")
            .select(reservationSelect)
            .eq("workspace_id", params.workspaceId)
            .eq("submission_fingerprint", params.submissionFingerprint)
            .in("status", ACTIVE_RESERVATION_STATUSES)
            .maybeSingle();
        if (fingerprintError) throw new Error(fingerprintError.message);
        reservation = fingerprintReservation;
    }
    if (!reservation) {
        const { data: candidates, error: legacyFingerprintError } = await params.supabase
            .from("booking_reservations")
            .select(reservationSelect)
            .eq("workspace_id", params.workspaceId)
            .eq("service_id", params.serviceId)
            .eq("customer_email", params.expected.customerEmail)
            .eq("scheduled_start", new Date(params.expected.scheduledStart).toISOString())
            .in("status", ACTIVE_RESERVATION_STATUSES)
            .limit(25);
        if (legacyFingerprintError) throw new Error(legacyFingerprintError.message);
        reservation = (candidates ?? []).find((candidate) =>
            candidate.resource_id === params.expected.resourceId
            && candidate.location_id === params.expected.locationId
            && candidate.party_size === params.expected.partySize,
        ) ?? null;
    }
    if (!reservation) return { found: false };
    if (reservation.service_id !== params.serviceId
        || reservation.customer_email !== params.expected.customerEmail
        || reservation.scheduled_start !== new Date(params.expected.scheduledStart).toISOString()
        || reservation.resource_id !== params.expected.resourceId
        || reservation.location_id !== params.expected.locationId
        || reservation.party_size !== params.expected.partySize) {
        throw new Error("This booking request key has already been used.");
    }

    const [{ data: payment, error: paymentError }, { data: meeting, error: meetingError }] = await Promise.all([
        params.supabase
            .from("booking_payments")
            .select("*")
            .eq("workspace_id", params.workspaceId)
            .eq("reservation_id", reservation.id)
            .maybeSingle(),
        params.supabase
            .from("booking_meetings")
            .select("status")
            .eq("workspace_id", params.workspaceId)
            .eq("reservation_id", reservation.id)
            .maybeSingle(),
    ]);
    if (paymentError) throw new Error(paymentError.message);
    if (meetingError) throw new Error(meetingError.message);

    // A concurrent first request may have inserted the reservation but not yet
    // its payment row or PayPal approval URL. Let the original request finish
    // instead of returning a success-shaped response with no way to pay.
    if (params.paymentExpected && !payment) {
        return { found: true, result: null, reservationId: reservation.id, paymentMissing: true };
    }
    if (params.paymentExpected && reservation.status === "pending_confirmation" && payment?.provider === "paypal_checkout" && payment.status === "requested" && !payment.payment_url) {
        return { found: true, result: null, reservationId: reservation.id, paymentPending: true };
    }

    const paymentDirective: BookingPaymentDirective | null = payment && payment.status === "requested"
        ? {
            provider: payment.provider === "paypal" || payment.provider === "paypal_checkout" ? "paypal_checkout" : "manual_revolut_pro",
            amountCents: payment.amount_cents,
            netAmountCents: payment.net_amount_cents ?? payment.amount_cents,
            vatRateBasisPoints: payment.vat_rate_basis_points ?? 0,
            vatAmountCents: payment.vat_amount_cents ?? 0,
            grossAmountCents: payment.gross_amount_cents ?? payment.amount_cents,
            pricingVersion: payment.pricing_version ?? "legacy-pre-vat-v1",
            currency: payment.currency,
            paymentUrl: payment.payment_url ?? "",
            paymentReference: payment.payment_reference,
            customerInstructions: payment.customer_instructions,
            deadlineAt: payment.deadline_at ?? "",
        }
        : null;
    const nextStepsKind = deriveNextStepsKind(reservation.status, paymentDirective);
    const metadata = normalizeJsonRecord(reservation.metadata);
    const notificationEventType = paymentDirective
        ? "payment_requested"
        : reservation.status === "pending_review"
            ? "reservation_pending_review"
            : reservation.status === "confirmed"
                ? "reservation_confirmed"
                : "reservation_created";

    return {
        found: true,
        reservationId: reservation.id,
        result: {
            reservationId: reservation.id,
            publicReference: reservation.public_reference,
            status: reservation.status,
            nextSteps: buildNextStepsFallback(nextStepsKind, paymentDirective),
            nextStepsKind,
            consultationAccountProvisioned: typeof metadata.provisionedPortalClientId === "string"
                && metadata.provisionedPortalClientId.length > 0,
            notificationState: { queued: true, eventType: notificationEventType },
            calendarExtensionState: meeting?.status === "ready" || meeting?.status === "pending" || meeting?.status === "failed"
                ? meeting.status
                : "not_configured",
            paymentExtensionState: paymentDirective ? "payment_requested" : "not_configured",
            payment: paymentDirective,
        },
    };
}

/**
 * Replays a PayPal order creation for an idempotent reservation whose first
 * request may have timed out after PayPal accepted the order. PayPal's stable
 * request ID (`booking-order-${payment.id}`) makes this converge on the
 * original provider order rather than creating a second checkout.
 */
export async function retryPendingPayPalCheckout(params: {
    supabase: ReturnType<typeof getServiceRoleClient>;
    workspaceId: string;
    reservationId: string;
}): Promise<boolean> {
    const [{ data: payment }, { data: reservation }] = await Promise.all([
        params.supabase
            .from("booking_payments")
            .select("*")
            .eq("workspace_id", params.workspaceId)
            .eq("reservation_id", params.reservationId)
            .maybeSingle(),
        params.supabase
            .from("booking_reservations")
            .select("id,workspace_id,public_reference,attribution_json,service_id,status")
            .eq("workspace_id", params.workspaceId)
            .eq("id", params.reservationId)
            .maybeSingle(),
    ]);
    if (!payment || payment.provider !== "paypal_checkout" || payment.status !== "requested" || payment.payment_url || !reservation || reservation.status !== "pending_confirmation") {
        return false;
    }

    const [{ data: service }, { data: workspace }] = await Promise.all([
        params.supabase
            .from("booking_services")
            .select("title")
            .eq("workspace_id", params.workspaceId)
            .eq("id", reservation.service_id)
            .maybeSingle(),
        params.supabase
            .from("workspaces")
            .select("name")
            .eq("id", params.workspaceId)
            .maybeSingle(),
    ]);
    if (!service || !workspace) return false;

    const attribution = normalizeJsonRecord(reservation.attribution_json);
    const locale = normalizeEmailLocale(typeof attribution.locale === "string" ? attribution.locale : null);
    const netAmountCents = payment.net_amount_cents ?? payment.amount_cents;
    const vatAmountCents = payment.vat_amount_cents ?? 0;
    const grossAmountCents = payment.gross_amount_cents ?? payment.amount_cents;
    const paymentMetadata = normalizeJsonRecord(payment.metadata);
    const retryCount = typeof paymentMetadata.paypalRetryCount === "number" && Number.isInteger(paymentMetadata.paypalRetryCount)
        ? Number(paymentMetadata.paypalRetryCount)
        : 0;
    const retryNextAt = typeof paymentMetadata.paypalRetryNextAt === "string"
        ? Date.parse(paymentMetadata.paypalRetryNextAt)
        : Number.NaN;
    const maxRetryCount = 5;
    if (retryCount >= maxRetryCount || (Number.isFinite(retryNextAt) && retryNextAt > Date.now())) {
        return false;
    }
    // A failed/cancelled PayPal attempt releases the reservation and is not
    // silently reopened by an idempotent replay. A new checkout must start
    // from a new reservation/payment record so the old provider order remains
    // auditable and cannot capture into a terminal booking.
    const requestId = `booking-order-${payment.id}`;
    try {
        const order = await createPayPalOrder({
            amountCents: grossAmountCents,
            netAmountCents,
            vatAmountCents,
            vatRateBasisPoints: payment.vat_rate_basis_points ?? 0,
            grossAmountCents,
            pricingVersion: payment.pricing_version ?? "legacy-pre-vat-v1",
            currency: payment.currency,
            paymentReference: payment.payment_reference,
            returnUrl: buildSiteUrl(`/api/payments/paypal/return?payment_id=${encodeURIComponent(payment.id)}&locale=${encodeURIComponent(locale)}`),
            cancelUrl: buildSiteUrl(`/api/payments/paypal/cancel?payment_id=${encodeURIComponent(payment.id)}&locale=${encodeURIComponent(locale)}`),
            description: service.title,
            brandName: workspace.name,
            requestId,
            customId: payment.id,
            invoiceId: payment.payment_reference,
        });
        const { data: currentPayment, error: currentPaymentError } = await params.supabase
            .from("booking_payments")
            .select("status,paypal_status,paypal_order_id,payment_url,metadata")
            .eq("id", payment.id)
            .eq("workspace_id", params.workspaceId)
            .eq("reservation_id", params.reservationId)
            .maybeSingle();
        if (currentPaymentError) throw new Error(currentPaymentError.message);
        if (!currentPayment
            || currentPayment.status !== payment.status
            || currentPayment.paypal_status !== payment.paypal_status
            || currentPayment.paypal_order_id !== payment.paypal_order_id
            || (currentPayment.paypal_order_id && currentPayment.paypal_status !== "RETURN_CAPTURE_FAILED")) {
            throw new Error("PayPal payment state changed before the retry could be linked.");
        }
        const retryMetadata = appendPayPalOrderHistory(currentPayment.metadata, order.id, requestId);
        const retryMetadataRecord = normalizeJsonRecord(retryMetadata);
        let linkQuery = params.supabase
            .from("booking_payments")
            .update({
                payment_url: order.approvalUrl,
                paypal_order_id: order.id,
                paypal_status: order.status,
                provider_synced_at: new Date().toISOString(),
                metadata: asJson({
                    ...retryMetadataRecord,
                    paypalOrderStatus: order.status,
                    paypalCreateRaw: order.raw,
                paypalRetryReconciled: true,
                paypalRetryCount: retryCount + 1,
                paypalRetryRequestId: requestId,
                paypalRetryPending: false,
                paypalRetryNextAt: null,
                paypalRetryLastError: null,
            }),
            })
            .eq("id", payment.id)
            .eq("workspace_id", params.workspaceId)
            .eq("reservation_id", params.reservationId)
            .eq("status", payment.status);
        linkQuery = payment.paypal_order_id
            ? linkQuery.eq("paypal_order_id", payment.paypal_order_id)
            : linkQuery.is("paypal_order_id", null);
        linkQuery = payment.paypal_status
            ? linkQuery.eq("paypal_status", payment.paypal_status)
            : linkQuery.is("paypal_status", null);
        const { data: linkedPayment, error } = await linkQuery
            .select("id")
            .maybeSingle();
        if (error || !linkedPayment) throw new Error(error?.message ?? "PayPal payment state changed before the retry could be linked.");
        return true;
    } catch (error) {
        console.warn("[booking] PayPal idempotent checkout retry failed", error instanceof Error ? error.message : error);
        const retryError = error instanceof Error ? error.message : "PayPal checkout retry failed.";
        const nextRetryCount = retryCount + 1;
        const backoffMs = Math.min(60 * 60_000, 5 * 60_000 * (2 ** Math.max(0, nextRetryCount - 1)));
        // Re-read before writing retry metadata. An order-approved/capture
        // webhook may have advanced the provider markers while the create
        // request was in flight; never overwrite that evidence with the
        // stale snapshot used to start this retry.
        const { data: currentPayment } = await params.supabase
            .from("booking_payments")
            .select("status,paypal_status,paypal_order_id,metadata")
            .eq("id", payment.id)
            .eq("workspace_id", params.workspaceId)
            .eq("reservation_id", params.reservationId)
            .maybeSingle();
        if (!currentPayment
            || currentPayment.status !== payment.status
            || currentPayment.paypal_status !== payment.paypal_status
            || currentPayment.paypal_order_id !== payment.paypal_order_id) {
            return false;
        }
        let retryUpdateQuery = params.supabase
            .from("booking_payments")
            .update({
                metadata: asJson({
                    ...normalizeJsonRecord(currentPayment.metadata),
                    paypalRetryCount: nextRetryCount,
                    paypalRetryPending: nextRetryCount < maxRetryCount,
                    paypalRetryNextAt: nextRetryCount < maxRetryCount
                        ? new Date(Date.now() + backoffMs).toISOString()
                        : null,
                    paypalRetryLastError: retryError.slice(0, 500),
                }),
                updated_at: new Date().toISOString(),
            })
            .eq("id", payment.id)
            .eq("workspace_id", params.workspaceId)
            .eq("reservation_id", params.reservationId)
            .eq("status", payment.status);
        retryUpdateQuery = payment.paypal_order_id
            ? retryUpdateQuery.eq("paypal_order_id", payment.paypal_order_id)
            : retryUpdateQuery.is("paypal_order_id", null);
        retryUpdateQuery = payment.paypal_status
            ? retryUpdateQuery.eq("paypal_status", payment.paypal_status)
            : retryUpdateQuery.is("paypal_status", null);
        await retryUpdateQuery;
        return false;
    }
}

async function recoverStaleIdempotentReservationWithoutPayment(params: {
    supabase: ReturnType<typeof getServiceRoleClient>;
    workspaceId: string;
    reservationId: string;
}): Promise<boolean> {
    const { data: reservation } = await params.supabase
        .from("booking_reservations")
        .select("id,status,updated_at,submission_lease_id,submission_lease_expires_at")
        .eq("workspace_id", params.workspaceId)
        .eq("id", params.reservationId)
        .maybeSingle();
    if (!reservation || reservation.status !== "pending_confirmation") return false;
    const leaseExpiryMs = reservation.submission_lease_expires_at
        ? Date.parse(reservation.submission_lease_expires_at)
        : Number.NaN;
    const leaseExpired = Number.isFinite(leaseExpiryMs) && leaseExpiryMs <= Date.now();
    const legacyLeaseExpired = !reservation.submission_lease_id
        && Number.isFinite(Date.parse(reservation.updated_at))
        && Date.parse(reservation.updated_at) <= Date.now() - 10 * 60_000;
    if (!leaseExpired && !legacyLeaseExpired) {
        return false;
    }

    const { data: payment } = await params.supabase
        .from("booking_payments")
        .select("id")
        .eq("workspace_id", params.workspaceId)
        .eq("reservation_id", params.reservationId)
        .maybeSingle();
    if (payment) return false;

    let deleteQuery = params.supabase
        .from("booking_reservations")
        .delete()
        .eq("workspace_id", params.workspaceId)
        .eq("id", params.reservationId)
        .eq("status", "pending_confirmation");
    if (reservation.submission_lease_id) {
        deleteQuery = deleteQuery.eq("submission_lease_id", reservation.submission_lease_id);
    }
    const { data: deleted, error } = await deleteQuery
        .select("id")
        .maybeSingle();
    if (error) {
        console.warn("[booking] stale idempotent reservation cleanup failed", error.message);
        return false;
    }
    return Boolean(deleted);
}

function normalizeCustomerEmail(email: string) {
    return email.trim().toLowerCase();
}

function toNonEmptyString(value: unknown) {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function derivePortalClientLabel(customer: BookingReservationSubmissionInput["customer"], intakePayload: Record<string, unknown>) {
    const candidateKeys = [
        "companyName",
        "company",
        "businessName",
        "organization",
        "organisation",
        "firmName",
        "practiceName",
    ];

    for (const key of candidateKeys) {
        const candidate = toNonEmptyString(intakePayload[key]);
        if (candidate) {
            return candidate;
        }
    }

    return customer.fullName.trim() || normalizeCustomerEmail(customer.email);
}

async function findAuthUserByEmail(
    supabaseAdmin: ReturnType<typeof createSupabaseClient<Database>>,
    normalizedEmail: string,
) {
    // Supabase's admin API exposes pagination rather than an exact-email
    // lookup. Walk every page so an existing account beyond the first 1,000
    // users is still linked instead of attempting a duplicate invite.
    const perPage = 1000;
    for (let page = 1; ; page += 1) {
        const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
            page,
            perPage,
        });

        if (usersError) {
            throw new Error(usersError.message);
        }

        const match = usersData.users.find((candidate) => candidate.email?.trim().toLowerCase() === normalizedEmail);
        if (match) return match;
        if (usersData.users.length < perPage) return null;
    }
}

async function provisionConsultationPortalClient(params: {
    supabaseAdmin: ReturnType<typeof createSupabaseClient<Database>>;
    workspaceId: string;
    customer: BookingReservationSubmissionInput["customer"];
    intakePayload: Record<string, unknown>;
}) : Promise<BookingProvisionedClientLink> {
    const normalizedEmail = normalizeCustomerEmail(params.customer.email);
    const normalizedFullName = params.customer.fullName.trim();

    const { data: existingProfile, error: existingProfileError } = await params.supabaseAdmin
        .from("profiles")
        .select("id, email, role")
        .eq("email", normalizedEmail)
        .maybeSingle();

    if (existingProfileError) {
        throw new Error(existingProfileError.message);
    }

    let profileId = existingProfile?.id ?? null;
    let createdAuthUser = false;
    let activationUrl: string | null = null;

    if (!profileId) {
        let authUser = await findAuthUserByEmail(params.supabaseAdmin, normalizedEmail);

        if (!authUser) {
            const { data, error } = await params.supabaseAdmin.auth.admin.generateLink({
                type: "invite",
                email: normalizedEmail,
                options: {
                    redirectTo: buildSiteUrl(`/api/auth/confirm?next=${encodeURIComponent("/portal")}`),
                    data: {
                        full_name: normalizedFullName || null,
                        booking_account_provisioned: true,
                        provisioning_source: "consultation_booking",
                    },
                },
            });

            if (error) {
                const alreadyRegistered = /already|exists|registered/i.test(error.message);
                if (!alreadyRegistered) {
                    throw new Error(error.message);
                }

                authUser = await findAuthUserByEmail(params.supabaseAdmin, normalizedEmail);
            } else {
                authUser = data.user;
                createdAuthUser = true;
                activationUrl = data.properties?.action_link ?? null;
            }
        }

        if (!authUser) {
            throw new Error("Failed to provision consultation account.");
        }

        const { error: profileError } = await params.supabaseAdmin.from("profiles").upsert({
            id: authUser.id,
            email: normalizedEmail,
            role: "user",
        });

        if (profileError) {
            throw new Error(profileError.message);
        }

        profileId = authUser.id;
    }

    const { data: existingPortalClient, error: existingPortalClientError } = await params.supabaseAdmin
        .from("client_portal_users")
        .select("id, company_name")
        .eq("workspace_id", params.workspaceId)
        .eq("profile_id", profileId)
        .maybeSingle();

    if (existingPortalClientError) {
        throw new Error(existingPortalClientError.message);
    }

    const companyName = derivePortalClientLabel(params.customer, params.intakePayload);

    if (existingPortalClient) {
        if (!existingPortalClient.company_name && companyName) {
            const { error: updatePortalClientError } = await params.supabaseAdmin
                .from("client_portal_users")
                .update({ company_name: companyName })
                .eq("id", existingPortalClient.id)
                .eq("workspace_id", params.workspaceId);

            if (updatePortalClientError) {
                throw new Error(updatePortalClientError.message);
            }
        }

        return {
            portalClientId: existingPortalClient.id,
            profileId,
            createdAuthUser,
            createdPortalClient: false,
            activationUrl,
        };
    }

    const { data: portalClient, error: portalClientError } = await params.supabaseAdmin
        .from("client_portal_users")
        .insert({
            workspace_id: params.workspaceId,
            profile_id: profileId,
            company_name: companyName,
        })
        .select("id")
        .single();

    if (portalClientError || !portalClient) {
        throw new Error(portalClientError?.message ?? "Failed to link consultation account into the client portal.");
    }

    return {
        portalClientId: portalClient.id,
        profileId,
        createdAuthUser,
        createdPortalClient: true,
        activationUrl,
    };
}

async function getAuthenticatedUserId() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    return user?.id ?? null;
}

export async function getBookingTemplateAdapters() {
    return Object.values(BOOKING_TEMPLATE_ADAPTERS);
}

export async function getPublicBookingCatalog(input?: {
    siteDomain?: string | null;
    locale?: import("@/features/templates/types").Locale | null;
}): Promise<BookingPublicCatalog> {
    const requestedLocale = input?.locale ?? "en";
    const supabase = getServiceRoleClient();

    const resolvedDomain = normalizePublicSiteDomain(input?.siteDomain);
    let workspaceId: string | null = null;

    if (resolvedDomain) {
        const { data: workspaceSettings } = await supabase
            .from("workspace_settings")
            .select("workspace_id, site_domain")
            .eq("site_domain", resolvedDomain)
            .maybeSingle();

        workspaceId = workspaceSettings?.workspace_id ?? null;
    }

    if (!workspaceId && allowLegacyPublicWorkspaceFallback(resolvedDomain)) {
        const siteSettings = await getSiteSettings();
        const { data: fallbackWorkspace } = await supabase
            .from("workspaces")
            .select("id")
            .eq("legacy_template_id", siteSettings.activeTemplate)
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();

        workspaceId = fallbackWorkspace?.id ?? null;
    }

    if (!workspaceId) {
        return {
            bookingState: "unavailable",
            workspace: null,
            templateKey: "custom",
            profile: null,
            services: [],
            resources: [],
            locations: [],
            formDefinitions: [],
            message: "Booking is not configured for this site yet.",
        };
    }

    const [workspaceResponse, profileResponse] = await Promise.all([
        supabase.from("workspaces").select("id,name,slug,workspace_tier").eq("id", workspaceId).maybeSingle(),
        supabase
            .from("booking_template_profiles")
            .select("id,profile_key,status,template_key,settings_json")
            .eq("workspace_id", workspaceId)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
    ]);

    const workspace = workspaceResponse.data;
    const profile = profileResponse.data;

    if (!workspace) {
        return {
            bookingState: "unavailable",
            workspace: null,
            templateKey: "custom",
            profile: null,
            services: [],
            resources: [],
            locations: [],
            formDefinitions: [],
            message: "Booking workspace could not be resolved.",
        };
    }

    if (workspace.workspace_tier !== "pro") {
        return {
            bookingState: "gated",
            workspace: {
                id: workspace.id,
                name: workspace.name,
                slug: workspace.slug,
                tier: normalizeWorkspaceTier(workspace.workspace_tier),
            },
            templateKey: (profile?.template_key ?? "custom") as BookingTemplateKey,
            profile: profile ? { id: profile.id, profileKey: profile.profile_key, status: profile.status, settingsJson: projectPublicBookingProfileSettings(profile.settings_json) } : null,
            services: [],
            resources: [],
            locations: [],
            formDefinitions: [],
            message: "This workspace needs Pro to publish the premium booking journey.",
        };
    }

    if (!profile || profile.status !== "active") {
        return {
            bookingState: "unavailable",
            workspace: {
                id: workspace.id,
                name: workspace.name,
                slug: workspace.slug,
                tier: normalizeWorkspaceTier(workspace.workspace_tier),
            },
            templateKey: (profile?.template_key ?? "custom") as BookingTemplateKey,
            profile: profile ? { id: profile.id, profileKey: profile.profile_key, status: profile.status, settingsJson: projectPublicBookingProfileSettings(profile.settings_json) } : null,
            services: [],
            resources: [],
            locations: [],
            formDefinitions: [],
            message: "Booking has not been published for this workspace yet.",
        };
    }

    const [servicesResponse, resourcesResponse, locationsResponse, formsResponse, calendarConnectionsResponse, serviceResourceLinksResponse, serviceLocationLinksResponse] = await Promise.all([
        supabase
            .from("booking_services")
            .select("id,service_key,title,subtitle,description,copy_i18n,duration_minutes,capacity_mode,location_mode,requires_manual_review,payment_required,price_amount_cents,price_currency,payment_provider,payment_url,payment_instructions,payment_deadline_minutes,vat_rate_basis_points,virtual_meeting_provider,auto_create_virtual_meeting")
            .eq("workspace_id", workspaceId)
            .eq("template_profile_id", profile.id)
            .eq("visibility_status", "published")
            .order("updated_at", { ascending: false })
            .limit(200),
        supabase
            .from("booking_resources")
            .select("id,name,resource_type")
            .eq("workspace_id", workspaceId)
            .eq("is_active", true)
            .order("updated_at", { ascending: false })
            .limit(200),
        supabase
            .from("booking_locations")
            .select("id,name,location_type,instructions,copy_i18n")
            .eq("workspace_id", workspaceId)
            .eq("is_active", true)
            .order("updated_at", { ascending: false })
            .limit(200),
        supabase
            .from("booking_form_definitions")
            .select("id,title,form_key,schema_json,copy_i18n")
            .eq("workspace_id", workspaceId)
            .eq("template_profile_id", profile.id)
            .eq("is_active", true)
            .order("updated_at", { ascending: false })
            .limit(200),
        supabase
            .from("workspace_calendar_connections" as never)
            .select("id" as never)
            .eq("workspace_id" as never, workspaceId as never)
            .eq("provider" as never, "google" as never)
            .eq("sync_enabled" as never, true as never)
            .limit(1) as never,
        supabase
            .from("booking_service_resources")
            .select("service_id,resource_id")
            .eq("workspace_id", workspaceId),
        supabase
            .from("booking_service_locations")
            .select("service_id,location_id")
            .eq("workspace_id", workspaceId),
    ]);

    const googleCalendarAvailable = Boolean((calendarConnectionsResponse as unknown as { data: Array<{ id: string }> | null }).data?.length);
    const catalogQueryErrors = [
        servicesResponse.error,
        resourcesResponse.error,
        locationsResponse.error,
        formsResponse.error,
        (calendarConnectionsResponse as unknown as { error: { message: string } | null }).error,
        serviceResourceLinksResponse.error,
        serviceLocationLinksResponse.error,
    ].filter(Boolean);
    if (catalogQueryErrors.length > 0) {
        return {
            bookingState: "unavailable",
            workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug, tier: normalizeWorkspaceTier(workspace.workspace_tier) },
            templateKey: profile.template_key as BookingTemplateKey,
            profile: { id: profile.id, profileKey: profile.profile_key, status: profile.status, settingsJson: projectPublicBookingProfileSettings(profile.settings_json) },
            services: [],
            resources: [],
            locations: [],
            formDefinitions: [],
            message: "Booking catalog and meeting configuration could not be verified.",
        };
    }
    const serviceResourceLinks = serviceResourceLinksResponse.data ?? [];
    const serviceLocationLinks = serviceLocationLinksResponse.data ?? [];

    // Read precedence helper: copy_i18n[locale][field] → copy_i18n.en[field] → plain.
    const { resolveLocalizedJson } = await import("@/shared/lib/i18n/resolve");

    return {
        bookingState: (servicesResponse.data ?? []).length > 0 ? "active" : "unavailable",
        workspace: {
            id: workspace.id,
            name: workspace.name,
            slug: workspace.slug,
            tier: normalizeWorkspaceTier(workspace.workspace_tier),
        },
        templateKey: profile.template_key as BookingTemplateKey,
        profile: {
            id: profile.id,
            profileKey: profile.profile_key,
            status: profile.status,
            settingsJson: projectPublicBookingProfileSettings(profile.settings_json),
        },
        services: (servicesResponse.data ?? []).map((service) => {
            const vatRateBasisPoints = service.vat_rate_basis_points ?? 0;
            const publicNetAmountCents = service.price_amount_cents;
            const priceSnapshot = publicNetAmountCents != null
                ? calculateBookingPrice({ amountCents: publicNetAmountCents, vatRateBasisPoints })
                : null;
            return {
            id: service.id,
            serviceKey: service.service_key,
            title: resolveLocalizedJson(service.copy_i18n, requestedLocale, "title") ?? service.title,
            subtitle: resolveLocalizedJson(service.copy_i18n, requestedLocale, "subtitle") ?? service.subtitle,
            description: resolveLocalizedJson(service.copy_i18n, requestedLocale, "description") ?? service.description,
            durationMinutes: service.duration_minutes,
            capacityMode: service.capacity_mode,
            locationMode: service.location_mode,
            requiresManualReview: service.requires_manual_review,
            paymentRequired: Boolean(service.payment_required),
            priceAmountCents: service.price_amount_cents ?? null,
            priceCurrency: service.price_currency ?? "EUR",
            paymentProvider: normalizeBookingPaymentProvider(service.payment_provider),
            paymentUrl: normalizePublicHttpUrl(service.payment_url),
            paymentInstructions: service.payment_instructions ?? null,
            paymentDeadlineMinutes: service.payment_deadline_minutes ?? 1440,
            implementationCreditDays: null,
            vatRatePercent: vatRateBasisPoints / 100,
            vatRateBasisPoints,
            netAmountCents: priceSnapshot?.netAmountCents ?? null,
            vatAmountCents: priceSnapshot?.vatAmountCents ?? null,
            grossAmountCents: priceSnapshot?.grossAmountCents ?? null,
            virtualMeetingProvider: resolveBookingMeetingProvider(service.virtual_meeting_provider),
            autoCreateVirtualMeeting: service.auto_create_virtual_meeting ?? true,
            meetingAvailability: (() => {
                const provider = resolveBookingMeetingProvider(service.virtual_meeting_provider);
                const autoCreate = service.auto_create_virtual_meeting !== false;
                return evaluateMeetingProviderSetup({
                    provider,
                    durationMinutes: service.duration_minutes,
                    autoCreate,
                    googleCalendarConnected: googleCalendarAvailable,
                    zoomConfigured: isZoomConfigured(),
                }).availability;
            })(),
            resourceIds: serviceResourceLinks.filter((row) => row.service_id === service.id).map((row) => row.resource_id),
            locationIds: serviceLocationLinks.filter((row) => row.service_id === service.id).map((row) => row.location_id),
        };}),
        // Keep the public resource/location inventory complete.  The selected
        // service's resourceIds/locationIds are the authoritative graph and
        // the booking UI filters these lists per service; globally filtering
        // by the union of links hides active resources that belong to a
        // service with no explicit links (meaning "all resources").
        resources: (resourcesResponse.data ?? []).map((resource) => ({
            id: resource.id,
            name: resource.name,
            resourceType: resource.resource_type,
        })),
        locations: (locationsResponse.data ?? []).map((location) => ({
            id: location.id,
            name: resolveLocalizedJson(location.copy_i18n, requestedLocale, "name") ?? location.name,
            locationType: location.location_type,
            instructions: resolveLocalizedJson(location.copy_i18n, requestedLocale, "instructions") ?? location.instructions,
        })),
        formDefinitions: (formsResponse.data ?? []).map((form) => ({
            id: form.id,
            title: resolveLocalizedJson(form.copy_i18n, requestedLocale, "title") ?? form.title,
            formKey: form.form_key,
            schemaJson: form.schema_json,
        })),
        message: (servicesResponse.data ?? []).length > 0
            ? null
            : "No published booking services are available yet.",
    };
}

export async function getBookingDashboardSummary(): Promise<BookingDashboardSummary> {
    const context = await requireBookingManagementContext("booking.manage");
    const supabase = await createClient();
    const workspaceId = context.activeWorkspace.id;
    const now = new Date().toISOString();

    const [profiles, services, reservations, pendingReview, confirmed, completed, cancelled, upcoming, sourceRows] = await Promise.all([
        supabase.from("booking_template_profiles").select("id,status", { count: "exact", head: true }).eq("workspace_id", workspaceId),
        supabase.from("booking_services").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
        supabase.from("booking_reservations").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
        supabase.from("booking_reservations").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "pending_review"),
        supabase.from("booking_reservations").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "confirmed"),
        supabase.from("booking_reservations").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "completed"),
        supabase.from("booking_reservations").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).in("status", ["cancelled_by_customer", "cancelled_by_workspace"]),
        supabase.from("booking_reservations").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).gte("scheduled_start", now),
        supabase.from("booking_reservations").select("source_channel").eq("workspace_id", workspaceId),
    ]);

    const { count: publishedProfilesCount } = await supabase
        .from("booking_template_profiles")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("status", "active");

    const topSourceChannel = (() => {
        const counts = new Map<string, number>();

        for (const row of sourceRows.data ?? []) {
            if (!row.source_channel) continue;
            counts.set(row.source_channel, (counts.get(row.source_channel) ?? 0) + 1);
        }

        let winner: string | null = null;
        let winnerCount = -1;

        for (const [channel, count] of counts.entries()) {
            if (count > winnerCount) {
                winner = channel;
                winnerCount = count;
            }
        }

        return winner;
    })();

    return {
        workspaceId,
        templateProfiles: profiles.count ?? 0,
        publishedProfiles: publishedProfilesCount ?? 0,
        services: services.count ?? 0,
        reservations: reservations.count ?? 0,
        pendingReviewReservations: pendingReview.count ?? 0,
        confirmedReservations: confirmed.count ?? 0,
        completedReservations: completed.count ?? 0,
        cancelledReservations: cancelled.count ?? 0,
        upcomingReservations: upcoming.count ?? 0,
        topSourceChannel,
    };
}

export async function getBookingTemplateProfiles() {
    const context = await requireBookingManagementContext();
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("booking_template_profiles")
        .select("*")
        .eq("workspace_id", context.activeWorkspace.id)
        .order("updated_at", { ascending: false })
        .limit(500);

    if (error) {
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

export async function upsertBookingTemplateProfile(input: unknown) {
    const parsed = bookingTemplateProfileUpsertSchema.safeParse(input);

    if (!parsed.success) {
        return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid booking template profile payload." };
    }

    const context = await requireBookingManagementContext();
    const supabase = await createClient();
    const adapter = getBookingTemplateAdapter(parsed.data.templateKey);
    const workspaceId = context.activeWorkspace.id;
    const normalizedProfileKey = parsed.data.profileKey.trim();

    const { data: existingProfile, error: existingProfileError } = await supabase
        .from("booking_template_profiles")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("profile_key", normalizedProfileKey)
        .maybeSingle();

    if (existingProfileError) {
        return { data: null, error: existingProfileError.message };
    }

    const resolvedProfileId = parsed.data.id ?? existingProfile?.id ?? undefined;

    if (parsed.data.id && existingProfile?.id && existingProfile.id !== parsed.data.id) {
        return { data: null, error: "Another booking template profile already uses this profile key in the active workspace." };
    }

    const payload: TablesInsert<"booking_template_profiles"> = {
        id: resolvedProfileId,
        workspace_id: workspaceId,
        profile_key: normalizedProfileKey,
        template_key: parsed.data.templateKey,
        status: parsed.data.status,
        entity_mode: parsed.data.entityMode ?? adapter.entityMode,
        slot_strategy: parsed.data.slotStrategy ?? adapter.slotStrategy,
        settings_json: asJson(parsed.data.settingsJson),
        branding_json: asJson(parsed.data.brandingJson),
        analytics_json: asJson(parsed.data.analyticsJson),
        placement_config_json: asJson(parsed.data.placementConfigJson),
        published_at: parsed.data.publishedAt ?? null,
    };

    const { data, error } = await supabase
        .from("booking_template_profiles")
        .upsert(payload, { onConflict: "workspace_id,profile_key" })
        .select("*")
        .single();

    if (error) {
        return { data: null, error: error.message };
    }

    revalidateBookingPaths();
    return { data, error: null };
}

export async function deleteBookingTemplateProfile(id: string) {
    const context = await requireBookingManagementContext();
    const supabase = await createClient();

    const { error } = await supabase
        .from("booking_template_profiles")
        .delete()
        .eq("id", id)
        .eq("workspace_id", context.activeWorkspace.id);

    if (error) {
        return { success: false, error: error.message };
    }

    revalidateBookingPaths();
    return { success: true, error: null };
}

export async function getBookingServices() {
    const context = await requireBookingManagementContext();
    const supabase = await createClient();
    const workspaceId = context.activeWorkspace.id;

    const { data, error } = await supabase
        .from("booking_services")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false })
        .limit(500);

    if (error) {
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

export async function getBookingCalendarConnections() {
    const context = await requireBookingManagementContext();
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("workspace_calendar_connections" as never)
        .select("id,provider,account_email,calendar_id,sync_enabled,token_expires_at,last_sync_at,last_error,created_at,updated_at" as never)
        .eq("workspace_id" as never, context.activeWorkspace.id as never)
        .order("created_at" as never, { ascending: false } as never) as unknown as { data: Array<Record<string, unknown>> | null; error: { message: string } | null };
    return { data: data ?? [], error: error?.message ?? null };
}

export async function setBookingCalendarConnectionEnabled(connectionId: string, enabled: boolean) {
    const context = await requireBookingManagementContext("booking.manage");
    const supabase = await createClient();
    const { error } = await supabase
        .from("workspace_calendar_connections" as never)
        .update({ sync_enabled: enabled, last_error: null } as never)
        .eq("id" as never, connectionId as never)
        .eq("workspace_id" as never, context.activeWorkspace.id as never);
    if (error) return { success: false, error: error.message };
    revalidateBookingPaths();
    return { success: true, error: null };
}

export async function disconnectBookingCalendarConnection(connectionId: string) {
    const context = await requireBookingManagementContext("booking.manage");
    const supabase = getServiceRoleClient();
    const { data: connection } = await supabase
        .from("workspace_calendar_connections" as never)
        .select("id,access_token" as never)
        .eq("id" as never, connectionId as never)
        .eq("workspace_id" as never, context.activeWorkspace.id as never)
        .maybeSingle() as unknown as { data: { id: string; access_token: string } | null };
    if (!connection) return { success: false, error: "Calendar connection not found." };
    const invalidateMeetingMappings = async (reservationIds: string[]) => {
        if (reservationIds.length === 0) return;
        const { error: invalidateMeetingError } = await supabase
            .from("booking_meetings" as never)
            .update({
                calendar_event_id: null,
                calendar_connection_id: null,
                status: "pending",
                last_error: "Google Calendar connection changed; reconnect or retry cleanup to remap this meeting.",
                updated_at: new Date().toISOString(),
            } as never)
            .eq("workspace_id" as never, context.activeWorkspace.id as never)
            .eq("provider" as never, "google_meet" as never)
            .eq("calendar_connection_id" as never, connectionId as never)
            .in("reservation_id" as never, reservationIds as never)
            .in("status" as never, ["pending", "ready"] as never)
            .not("calendar_event_id" as never, "is" as never, null as never);
        if (invalidateMeetingError) {
            console.warn("[booking] Google meeting mappings could not be invalidated", invalidateMeetingError.message);
        }
    };
    // Remove remote events before revoking/deleting the connection. If a
    // provider call fails, keep the mapping and connection intact so an admin
    // can retry instead of orphaning customer-visible calendar events.
    const cleanup = await deleteGoogleCalendarConnectionEvents(supabase, connectionId);
    if (!cleanup.success) {
        const message = cleanup.error ?? "Google Calendar events could not be removed.";
        // Some events may have been deleted before another mapping failed.
        // Invalidate all affected local meetings even though the connection
        // remains for retry; otherwise a ready row could skip remapping a
        // successfully deleted external event.
        await invalidateMeetingMappings(cleanup.reservationIds);
        await supabase
            .from("workspace_calendar_connections" as never)
            .update({ last_error: message.slice(0, 500) } as never)
            .eq("id" as never, connectionId as never)
            .eq("workspace_id" as never, context.activeWorkspace.id as never);
        return { success: false, error: message };
    }
    // The remote events/mappings are gone at this point. Invalidate local
    // meeting rows before deleting the connection so a later DB delete error
    // cannot strand a ready row pointing at an event that no longer exists.
    await invalidateMeetingMappings(cleanup.reservationIds);
    try {
        const token = decryptToken(connection.access_token);
        await fetch("https://oauth2.googleapis.com/revoke", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ token }),
            cache: "no-store",
            signal: AbortSignal.timeout(15_000),
        });
    } catch (error) {
        console.warn("[booking] Google token revoke failed", error);
    }
    const { error } = await supabase
        .from("workspace_calendar_connections" as never)
        .delete()
        .eq("id" as never, connectionId as never)
        .eq("workspace_id" as never, context.activeWorkspace.id as never);
    if (error) return { success: false, error: error.message };

    // Keep the customer-safe Meet URL, but invalidate only the provider-
    // neutral meetings that were mapped to this connection. Other connected
    // Google calendars must remain ready and must not be duplicated.
    revalidateBookingPaths();
    return { success: true, error: null };
}

export async function testBookingCalendarConnection(connectionId: string) {
    const context = await requireBookingManagementContext("booking.manage");
    const supabase = getServiceRoleClient();
    const { data: connection } = await supabase
        .from("workspace_calendar_connections" as never)
        .select("*" as never)
        .eq("id" as never, connectionId as never)
        .eq("workspace_id" as never, context.activeWorkspace.id as never)
        .maybeSingle() as unknown as { data: Parameters<typeof getValidConnectionToken>[1] | null };
    if (!connection) return { success: false, error: "Calendar connection not found." };
    try {
        const accessToken = await getValidConnectionToken(supabase, connection);
        await verifyGoogleMeetingProvisioning(accessToken, connection.calendar_id ?? "primary");
        await supabase
            .from("workspace_calendar_connections" as never)
            .update({ last_sync_at: new Date().toISOString(), last_error: null } as never)
            .eq("id" as never, connectionId as never);
        revalidateBookingPaths();
        return { success: true, error: null };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Calendar connection test failed.";
        await supabase
            .from("workspace_calendar_connections" as never)
            .update({ last_error: message.slice(0, 500) } as never)
            .eq("id" as never, connectionId as never);
        return { success: false, error: message };
    }
}

export async function testBookingZoomConnection() {
    await requireBookingManagementContext("booking.manage");
    if (!isZoomConfigured()) {
        return { success: false, error: "Zoom Server-to-Server OAuth credentials are not configured." };
    }
    try {
        await verifyZoomMeetingProvisioning();
        return { success: true, error: null };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Zoom provisioning test failed.",
        };
    }
}

// Build the copy_i18n payload from plain-text + locale overrides. The DB
// trigger always recomputes copy_i18n.en from plain-text columns, so we only
// need to populate nl/ar slots here. Empty values are stripped so the JSON
// stays clean.
function buildServiceCopyI18n(
    nl?: { title?: string; subtitle?: string; description?: string },
    ar?: { title?: string; subtitle?: string; description?: string },
) {
    const out: Record<string, Record<string, string>> = {};
    for (const [locale, values] of [["nl", nl], ["ar", ar]] as const) {
        if (!values) continue;
        const block: Record<string, string> = {};
        for (const field of ["title", "subtitle", "description"] as const) {
            const v = values[field]?.trim();
            if (v && v.length > 0) block[field] = v;
        }
        if (Object.keys(block).length > 0) out[locale] = block;
    }
    return out;
}

export async function upsertBookingService(input: unknown) {
    const parsed = bookingServiceUpsertSchema.safeParse(input);

    if (!parsed.success) {
        return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid booking service payload." };
    }

    const context = await requireBookingManagementContext();
    const supabase = await createClient();
    const workspaceId = context.activeWorkspace.id;
    const normalizedServiceKey = normalizeSlug(parsed.data.serviceKey);

    if (!normalizedServiceKey) {
        return { data: null, error: "Service key must contain at least one letter or number." };
    }

    const { data: existingService, error: existingServiceError } = await supabase
        .from("booking_services")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("service_key", normalizedServiceKey)
        .maybeSingle();

    if (existingServiceError) {
        return { data: null, error: existingServiceError.message };
    }

    if (parsed.data.id && existingService?.id && existingService.id !== parsed.data.id) {
        return { data: null, error: "Another booking service already uses this service key in the active workspace. Choose a unique service key or edit the existing service." };
    }

    const { data: templateProfile, error: templateProfileError } = await supabase
        .from("booking_template_profiles")
        .select("id")
        .eq("id", parsed.data.templateProfileId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
    if (templateProfileError) return { data: null, error: templateProfileError.message };
    if (!templateProfile) return { data: null, error: "The booking template profile must belong to the active workspace." };

    const resolvedServiceId = parsed.data.id ?? existingService?.id ?? undefined;
    const copyI18n = buildServiceCopyI18n(parsed.data.localeOverrides?.nl, parsed.data.localeOverrides?.ar);
    const safePaymentUrl = normalizePublicHttpUrl(parsed.data.paymentUrl);
    if (parsed.data.paymentProvider === "manual_revolut_pro" && !safePaymentUrl) {
        return { data: null, error: "Manual payment services require a valid http(s) payment URL." };
    }
    const payload: TablesInsert<"booking_services"> = {
        id: resolvedServiceId,
        workspace_id: workspaceId,
        template_profile_id: parsed.data.templateProfileId,
        service_key: normalizedServiceKey,
        service_type: parsed.data.serviceType,
        title: parsed.data.title,
        subtitle: parsed.data.subtitle ?? null,
        description: parsed.data.description ?? null,
        duration_minutes: parsed.data.durationMinutes,
        buffer_before_minutes: parsed.data.bufferBeforeMinutes,
        buffer_after_minutes: parsed.data.bufferAfterMinutes,
        lead_time_minutes: getEffectiveBookingLeadTimeMinutes(parsed.data.leadTimeMinutes),
        max_advance_days: parsed.data.maxAdvanceDays,
        capacity_mode: parsed.data.capacityMode,
        capacity_value: parsed.data.capacityValue,
        location_mode: parsed.data.locationMode,
        visibility_status: parsed.data.visibilityStatus,
        requires_manual_review: parsed.data.requiresManualReview,
        payment_required: parsed.data.paymentRequired,
        price_amount_cents: parsed.data.priceAmountCents ?? null,
        price_currency: parsed.data.priceCurrency,
        payment_provider: parsed.data.paymentProvider,
        payment_url: safePaymentUrl,
        payment_instructions: parsed.data.paymentInstructions ?? null,
        payment_deadline_minutes: BOOKING_PAYMENT_COMPLETION_WINDOW_MINUTES,
        vat_rate_basis_points: parsed.data.vatRateBasisPoints,
        virtual_meeting_provider: parsed.data.virtualMeetingProvider,
        auto_create_virtual_meeting: parsed.data.autoCreateVirtualMeeting,
        metadata: asJson(parsed.data.metadata),
        // The trigger always rewrites copy_i18n.en from plain text; nl/ar
        // here are preserved (jsonb_set on the {en} key only).
        copy_i18n: asJson(copyI18n),
    };

    const { data, error } = await supabase
        .from("booking_services")
        .upsert(payload, { onConflict: "workspace_id,service_key" })
        .select("*")
        .single();

    if (error) {
        return { data: null, error: error.message };
    }

    // Auto-seed a default Mon–Fri 09:00–17:00 recurring availability rule
    // when this service has no rule that would apply to it. A rule applies
    // when scope_type='workspace' (service_id IS NULL) OR scope_type='service'
    // with service_id = this service. Without this, the public picker
    // reports "No availability rules configured" and operators don't
    // realize a separate step is required — most common when a workspace
    // has per-service rules for older services but no workspace fallback,
    // and a new service is added expecting "it just works".
    const { count: applicableRulesCount } = await supabase
        .from("booking_availability_rules")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .or(`service_id.is.null,service_id.eq.${data.id}`);

    if ((applicableRulesCount ?? 0) === 0) {
        // Workspaces don't carry a timezone column today, so use the
        // env-configurable default and then the platform's neutral default.
        // Operators can override it from the Availability tab on first edit.
        const seedTimezone = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE?.trim()
            || "Europe/Amsterdam";
        const { error: seedError } = await supabase
            .from("booking_availability_rules")
            .insert({
                workspace_id: workspaceId,
                template_profile_id: parsed.data.templateProfileId,
                service_id: null,
                resource_id: null,
                location_id: null,
                scope_type: "workspace",
                rule_type: "recurring",
                timezone: seedTimezone,
                weekday_json: [1, 2, 3, 4, 5],
                date_json: {},
                time_windows_json: [{ start: "09:00", end: "17:00" }],
                priority: 100,
                is_active: true,
                metadata: { seeded_by: "upsertBookingService", seeded_at: new Date().toISOString() },
            });
        if (seedError) {
            // Don't fail the service upsert — surface in logs only. Operators
            // will still see the "no rules configured" notice and can add one.
            console.warn("[booking] Default availability rule seed failed:", seedError.message);
        }
    }

    revalidateBookingPaths();
    return { data, error: null };
}

export async function deleteBookingService(id: string) {
    const context = await requireBookingManagementContext();
    const supabase = await createClient();
    const workspaceId = context.activeWorkspace.id;

    // booking_reservations.service_id is ON DELETE RESTRICT to protect
    // historical bookings and analytics. If any reservation references this
    // service, soft-delete by archiving instead of hard-deleting — archived
    // services drop out of the public catalog (visibility_status filter on
    // "published") and the admin can still surface them via a future filter.
    const { count: reservationCount, error: reservationCountError } = await supabase
        .from("booking_reservations")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("service_id", id);

    if (reservationCountError) {
        return { success: false, error: reservationCountError.message, archived: false };
    }

    if ((reservationCount ?? 0) > 0) {
        const { error: archiveError } = await supabase
            .from("booking_services")
            .update({ visibility_status: "archived", updated_at: new Date().toISOString() })
            .eq("id", id)
            .eq("workspace_id", workspaceId);

        if (archiveError) {
            return { success: false, error: archiveError.message, archived: false };
        }

        revalidateBookingPaths();
        return {
            success: true,
            archived: true,
            error: null,
            message: `Service has ${reservationCount} historical reservation(s) and was archived instead of deleted. It will no longer appear in the public booking catalog.`,
        };
    }

    const { error } = await supabase
        .from("booking_services")
        .delete()
        .eq("id", id)
        .eq("workspace_id", workspaceId);

    if (error) {
        return { success: false, error: error.message, archived: false };
    }

    revalidateBookingPaths();
    return { success: true, archived: false, error: null };
}

export async function setBookingServiceResources(input: { serviceId: string; links: unknown[] }) {
    const context = await requireBookingManagementContext();
    const parsedLinks = input.links.map((link) => bookingServiceResourceLinkSchema.safeParse(link));

    if (parsedLinks.some((result) => !result.success)) {
        return { data: null, error: "Invalid service-resource mapping payload." };
    }

    const supabase = await createClient();
    const validLinks = Array.from(new Map(
        parsedLinks
            .map((result) => (result.success ? result.data : null))
            .filter((value): value is NonNullable<typeof value> => Boolean(value))
            .map((link) => [link.resourceId, link] as const),
    ).values());

    if (validLinks.some((link) => link.serviceId !== input.serviceId)) {
        return { data: null, error: "Every resource mapping must target the selected service." };
    }
    const { data: service } = await supabase
        .from("booking_services")
        .select("id")
        .eq("id", input.serviceId)
        .eq("workspace_id", context.activeWorkspace.id)
        .maybeSingle();
    if (!service) return { data: null, error: "Booking service not found." };
    if (validLinks.length > 0) {
        const resourceIds = Array.from(new Set(validLinks.map((link) => link.resourceId)));
        const { data: resources, error: resourceError } = await supabase
            .from("booking_resources")
            .select("id")
            .eq("workspace_id", context.activeWorkspace.id)
            .in("id", resourceIds);
        if (resourceError) return { data: null, error: resourceError.message };
        if ((resources ?? []).length !== resourceIds.length) {
            return { data: null, error: "Every mapped resource must belong to the active workspace." };
        }
    }

    if (validLinks.length === 0) {
        const { error: deleteError } = await supabase
            .from("booking_service_resources")
            .delete()
            .eq("workspace_id", context.activeWorkspace.id)
            .eq("service_id", input.serviceId);
        if (deleteError) return { data: null, error: deleteError.message };
        revalidateBookingPaths();
        return { data: [], error: null };
    }

    // Upsert the desired set before pruning stale rows. A malformed insert
    // can therefore never leave a service with zero mappings.
    const { data, error } = await supabase
        .from("booking_service_resources")
        .upsert(validLinks.map((link) => ({
            workspace_id: context.activeWorkspace.id,
            service_id: input.serviceId,
            resource_id: link.resourceId,
            assignment_mode: link.assignmentMode,
            metadata: asJson(link.metadata),
        })), { onConflict: "service_id,resource_id" })
        .select("*");
    if (error) return { data: null, error: error.message };

    const selectedResourceIds = validLinks.map((link) => link.resourceId);
    const { error: deleteError } = await supabase
        .from("booking_service_resources")
        .delete()
        .eq("workspace_id", context.activeWorkspace.id)
        .eq("service_id", input.serviceId)
        .not("resource_id", "in", `(${selectedResourceIds.join(",")})`);

    if (deleteError) {
        return { data: null, error: deleteError.message };
    }

    revalidateBookingPaths();
    return { data, error: null };
}

export async function setBookingServiceLocations(input: { serviceId: string; links: unknown[] }) {
    const context = await requireBookingManagementContext();
    const parsedLinks = input.links.map((link) => bookingServiceLocationLinkSchema.safeParse(link));

    if (parsedLinks.some((result) => !result.success)) {
        return { data: null, error: "Invalid service-location mapping payload." };
    }

    const supabase = await createClient();
    const validLinks = Array.from(new Map(
        parsedLinks
            .map((result) => (result.success ? result.data : null))
            .filter((value): value is NonNullable<typeof value> => Boolean(value))
            .map((link) => [link.locationId, link] as const),
    ).values());

    if (validLinks.some((link) => link.serviceId !== input.serviceId)) {
        return { data: null, error: "Every location mapping must target the selected service." };
    }
    const { data: service } = await supabase
        .from("booking_services")
        .select("id")
        .eq("id", input.serviceId)
        .eq("workspace_id", context.activeWorkspace.id)
        .maybeSingle();
    if (!service) return { data: null, error: "Booking service not found." };
    if (validLinks.length > 0) {
        const locationIds = Array.from(new Set(validLinks.map((link) => link.locationId)));
        const { data: locations, error: locationError } = await supabase
            .from("booking_locations")
            .select("id")
            .eq("workspace_id", context.activeWorkspace.id)
            .in("id", locationIds);
        if (locationError) return { data: null, error: locationError.message };
        if ((locations ?? []).length !== locationIds.length) {
            return { data: null, error: "Every mapped location must belong to the active workspace." };
        }
    }

    if (validLinks.length === 0) {
        const { error: deleteError } = await supabase
            .from("booking_service_locations")
            .delete()
            .eq("workspace_id", context.activeWorkspace.id)
            .eq("service_id", input.serviceId);
        if (deleteError) return { data: null, error: deleteError.message };
        revalidateBookingPaths();
        return { data: [], error: null };
    }

    const { data, error } = await supabase
        .from("booking_service_locations")
        .upsert(validLinks.map((link) => ({
            workspace_id: context.activeWorkspace.id,
            service_id: input.serviceId,
            location_id: link.locationId,
            is_default: link.isDefault,
            metadata: asJson(link.metadata),
        })), { onConflict: "service_id,location_id" })
        .select("*");
    if (error) return { data: null, error: error.message };

    const selectedLocationIds = validLinks.map((link) => link.locationId);
    const { error: deleteError } = await supabase
        .from("booking_service_locations")
        .delete()
        .eq("workspace_id", context.activeWorkspace.id)
        .eq("service_id", input.serviceId)
        .not("location_id", "in", `(${selectedLocationIds.join(",")})`);

    if (deleteError) {
        return { data: null, error: deleteError.message };
    }

    revalidateBookingPaths();
    return { data, error: null };
}

export async function getBookingResources() {
    const context = await requireBookingManagementContext();
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("booking_resources")
        .select("*")
        .eq("workspace_id", context.activeWorkspace.id)
        .order("updated_at", { ascending: false })
        .limit(500);

    if (error) {
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

export async function upsertBookingResource(input: unknown) {
    const parsed = bookingResourceUpsertSchema.safeParse(input);

    if (!parsed.success) {
        return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid booking resource payload." };
    }

    const context = await requireBookingManagementContext();
    const supabase = await createClient();
    const payload: TablesInsert<"booking_resources"> = {
        id: parsed.data.id,
        workspace_id: context.activeWorkspace.id,
        resource_type: parsed.data.resourceType,
        name: parsed.data.name,
        slug: normalizeSlug(parsed.data.slug),
        is_active: parsed.data.isActive,
        capacity_value: parsed.data.capacityValue,
        attributes_json: asJson(parsed.data.attributesJson),
        metadata: asJson(parsed.data.metadata),
    };

    const { data, error } = await supabase
        .from("booking_resources")
        .upsert(payload, { onConflict: "id" })
        .select("*")
        .single();

    if (error) {
        return { data: null, error: error.message };
    }

    revalidateBookingPaths();
    return { data, error: null };
}

export async function deleteBookingResource(id: string) {
    const context = await requireBookingManagementContext();
    const supabase = await createClient();

    const { error } = await supabase
        .from("booking_resources")
        .delete()
        .eq("id", id)
        .eq("workspace_id", context.activeWorkspace.id);

    if (error) {
        return { success: false, error: error.message };
    }

    revalidateBookingPaths();
    return { success: true, error: null };
}

export async function getBookingStaffProfiles() {
    const context = await requireBookingManagementContext();
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("booking_staff_profiles")
        .select("*")
        .eq("workspace_id", context.activeWorkspace.id)
        .order("updated_at", { ascending: false })
        .limit(500);

    if (error) {
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

export async function upsertBookingStaffProfile(input: unknown) {
    const parsed = bookingStaffProfileUpsertSchema.safeParse(input);

    if (!parsed.success) {
        return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid booking staff profile payload." };
    }

    const context = await requireBookingManagementContext();
    const supabase = await createClient();
    const payload: TablesInsert<"booking_staff_profiles"> = {
        id: parsed.data.id,
        workspace_id: context.activeWorkspace.id,
        resource_id: parsed.data.resourceId,
        display_name: parsed.data.displayName,
        role_label: parsed.data.roleLabel ?? null,
        bio: parsed.data.bio ?? null,
        avatar_asset_url: parsed.data.avatarAssetUrl ?? null,
        languages_json: asJson(parsed.data.languagesJson),
        specialties_json: asJson(parsed.data.specialtiesJson),
        contact_rules_json: asJson(parsed.data.contactRulesJson),
        is_bookable: parsed.data.isBookable,
        metadata: asJson(parsed.data.metadata),
    };

    const { data, error } = await supabase
        .from("booking_staff_profiles")
        .upsert(payload, { onConflict: "id" })
        .select("*")
        .single();

    if (error) {
        return { data: null, error: error.message };
    }

    revalidateBookingPaths();
    return { data, error: null };
}

export async function deleteBookingStaffProfile(id: string) {
    const context = await requireBookingManagementContext();
    const supabase = await createClient();

    const { error } = await supabase
        .from("booking_staff_profiles")
        .delete()
        .eq("id", id)
        .eq("workspace_id", context.activeWorkspace.id);

    if (error) {
        return { success: false, error: error.message };
    }

    revalidateBookingPaths();
    return { success: true, error: null };
}

export async function getBookingLocations() {
    const context = await requireBookingManagementContext();
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("booking_locations")
        .select("*")
        .eq("workspace_id", context.activeWorkspace.id)
        .order("updated_at", { ascending: false })
        .limit(500);

    if (error) {
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

function buildLocationCopyI18n(
    nl?: { name?: string; instructions?: string },
    ar?: { name?: string; instructions?: string },
) {
    const out: Record<string, Record<string, string>> = {};
    for (const [locale, values] of [["nl", nl], ["ar", ar]] as const) {
        if (!values) continue;
        const block: Record<string, string> = {};
        for (const field of ["name", "instructions"] as const) {
            const v = values[field]?.trim();
            if (v && v.length > 0) block[field] = v;
        }
        if (Object.keys(block).length > 0) out[locale] = block;
    }
    return out;
}

export async function upsertBookingLocation(input: unknown) {
    const parsed = bookingLocationUpsertSchema.safeParse(input);

    if (!parsed.success) {
        return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid booking location payload." };
    }

    const context = await requireBookingManagementContext();
    const supabase = await createClient();
    const copyI18n = buildLocationCopyI18n(parsed.data.localeOverrides?.nl, parsed.data.localeOverrides?.ar);
    const payload: TablesInsert<"booking_locations"> = {
        id: parsed.data.id,
        workspace_id: context.activeWorkspace.id,
        location_type: parsed.data.locationType,
        name: parsed.data.name,
        slug: normalizeSlug(parsed.data.slug),
        address_json: asJson(parsed.data.addressJson),
        geo_json: asJson(parsed.data.geoJson),
        capacity_value: parsed.data.capacityValue ?? null,
        instructions: parsed.data.instructions ?? null,
        is_active: parsed.data.isActive,
        metadata: asJson(parsed.data.metadata),
        copy_i18n: asJson(copyI18n),
    };

    const { data, error } = await supabase
        .from("booking_locations")
        .upsert(payload, { onConflict: "id" })
        .select("*")
        .single();

    if (error) {
        return { data: null, error: error.message };
    }

    revalidateBookingPaths();
    return { data, error: null };
}

export async function deleteBookingLocation(id: string) {
    const context = await requireBookingManagementContext();
    const supabase = await createClient();

    const { error } = await supabase
        .from("booking_locations")
        .delete()
        .eq("id", id)
        .eq("workspace_id", context.activeWorkspace.id);

    if (error) {
        return { success: false, error: error.message };
    }

    revalidateBookingPaths();
    return { success: true, error: null };
}

export async function getBookingAvailabilityRules() {
    const context = await requireBookingManagementContext();
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("booking_availability_rules")
        .select("*")
        .eq("workspace_id", context.activeWorkspace.id)
        .order("priority", { ascending: true })
        .limit(500);

    if (error) {
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

export async function upsertBookingAvailabilityRule(input: unknown) {
    const parsed = bookingAvailabilityRuleUpsertSchema.safeParse(input);

    if (!parsed.success) {
        return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid availability rule payload." };
    }

    const context = await requireBookingManagementContext();
    const supabase = await createClient();
    const payload: TablesInsert<"booking_availability_rules"> = {
        id: parsed.data.id,
        workspace_id: context.activeWorkspace.id,
        template_profile_id: parsed.data.templateProfileId ?? null,
        service_id: parsed.data.serviceId ?? null,
        resource_id: parsed.data.resourceId ?? null,
        location_id: parsed.data.locationId ?? null,
        scope_type: parsed.data.scopeType,
        rule_type: parsed.data.ruleType,
        timezone: parsed.data.timezone,
        weekday_json: asJson(parsed.data.weekdayJson),
        starts_on: parsed.data.startsOn ?? null,
        ends_on: parsed.data.endsOn ?? null,
        date_json: asJson(parsed.data.dateJson),
        time_windows_json: asJson(parsed.data.timeWindowsJson),
        priority: parsed.data.priority,
        is_active: parsed.data.isActive,
        metadata: asJson(parsed.data.metadata),
    };

    const { data, error } = await supabase
        .from("booking_availability_rules")
        .upsert(payload, { onConflict: "id" })
        .select("*")
        .single();

    if (error) {
        return { data: null, error: error.message };
    }

    revalidateBookingPaths();
    return { data, error: null };
}

export async function deleteBookingAvailabilityRule(id: string) {
    const context = await requireBookingManagementContext();
    const supabase = await createClient();

    const { error } = await supabase
        .from("booking_availability_rules")
        .delete()
        .eq("id", id)
        .eq("workspace_id", context.activeWorkspace.id);

    if (error) {
        return { success: false, error: error.message };
    }

    revalidateBookingPaths();
    return { success: true, error: null };
}

export async function getBookingBlackoutWindows() {
    const context = await requireBookingManagementContext();
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("booking_blackout_windows")
        .select("*")
        .eq("workspace_id", context.activeWorkspace.id)
        .order("starts_at", { ascending: true })
        .limit(500);

    if (error) {
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

export async function upsertBookingBlackoutWindow(input: unknown) {
    const parsed = bookingBlackoutWindowUpsertSchema.safeParse(input);

    if (!parsed.success) {
        return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid blackout window payload." };
    }

    const context = await requireBookingManagementContext();
    const supabase = await createClient();
    const payload: TablesInsert<"booking_blackout_windows"> = {
        id: parsed.data.id,
        workspace_id: context.activeWorkspace.id,
        service_id: parsed.data.serviceId ?? null,
        resource_id: parsed.data.resourceId ?? null,
        location_id: parsed.data.locationId ?? null,
        timezone: parsed.data.timezone,
        starts_at: parsed.data.startsAt,
        ends_at: parsed.data.endsAt,
        reason: parsed.data.reason ?? null,
        source: parsed.data.source ?? null,
        is_active: parsed.data.isActive,
        metadata: asJson(parsed.data.metadata),
    };

    const { data, error } = await supabase
        .from("booking_blackout_windows")
        .upsert(payload, { onConflict: "id" })
        .select("*")
        .single();

    if (error) {
        return { data: null, error: error.message };
    }

    revalidateBookingPaths();
    return { data, error: null };
}

export async function deleteBookingBlackoutWindow(id: string) {
    const context = await requireBookingManagementContext();
    const supabase = await createClient();

    const { error } = await supabase
        .from("booking_blackout_windows")
        .delete()
        .eq("id", id)
        .eq("workspace_id", context.activeWorkspace.id);

    if (error) {
        return { success: false, error: error.message };
    }

    revalidateBookingPaths();
    return { success: true, error: null };
}

export async function getBookingRuleDefinitions() {
    const context = await requireBookingManagementContext();
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("booking_rule_definitions")
        .select("*")
        .eq("workspace_id", context.activeWorkspace.id)
        .order("priority", { ascending: true })
        .limit(500);

    if (error) {
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

export async function upsertBookingRuleDefinition(input: unknown) {
    const parsed = bookingRuleDefinitionUpsertSchema.safeParse(input);

    if (!parsed.success) {
        return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid booking rule payload." };
    }

    const context = await requireBookingManagementContext();
    const supabase = await createClient();
    const payload: TablesInsert<"booking_rule_definitions"> = {
        id: parsed.data.id,
        workspace_id: context.activeWorkspace.id,
        service_id: parsed.data.serviceId ?? null,
        rule_key: parsed.data.ruleKey,
        rule_type: parsed.data.ruleType,
        rule_value_json: asJson(parsed.data.ruleValueJson),
        priority: parsed.data.priority,
        is_active: parsed.data.isActive,
        metadata: asJson(parsed.data.metadata),
    };

    const { data, error } = await supabase
        .from("booking_rule_definitions")
        .upsert(payload, { onConflict: "id" })
        .select("*")
        .single();

    if (error) {
        return { data: null, error: error.message };
    }

    revalidateBookingPaths();
    return { data, error: null };
}

export async function deleteBookingRuleDefinition(id: string) {
    const context = await requireBookingManagementContext();
    const supabase = await createClient();

    const { error } = await supabase
        .from("booking_rule_definitions")
        .delete()
        .eq("id", id)
        .eq("workspace_id", context.activeWorkspace.id);

    if (error) {
        return { success: false, error: error.message };
    }

    revalidateBookingPaths();
    return { success: true, error: null };
}

export async function getBookingFormDefinitions() {
    const context = await requireBookingManagementContext();
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("booking_form_definitions")
        .select("*")
        .eq("workspace_id", context.activeWorkspace.id)
        .order("updated_at", { ascending: false })
        .limit(500);

    if (error) {
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

function buildFormCopyI18n(nl?: { title?: string }, ar?: { title?: string }) {
    const out: Record<string, Record<string, string>> = {};
    for (const [locale, values] of [["nl", nl], ["ar", ar]] as const) {
        if (!values) continue;
        const v = values.title?.trim();
        if (v && v.length > 0) out[locale] = { title: v };
    }
    return out;
}

export async function upsertBookingFormDefinition(input: unknown) {
    const parsed = bookingFormDefinitionUpsertSchema.safeParse(input);

    if (!parsed.success) {
        return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid booking form definition payload." };
    }

    const context = await requireBookingManagementContext();
    const supabase = await createClient();
    const copyI18n = buildFormCopyI18n(parsed.data.localeOverrides?.nl, parsed.data.localeOverrides?.ar);
    const payload: TablesInsert<"booking_form_definitions"> = {
        id: parsed.data.id,
        workspace_id: context.activeWorkspace.id,
        template_profile_id: parsed.data.templateProfileId,
        form_key: parsed.data.formKey,
        title: parsed.data.title,
        schema_json: asJson(parsed.data.schemaJson),
        ui_schema_json: asJson(parsed.data.uiSchemaJson),
        completion_rules_json: asJson(parsed.data.completionRulesJson),
        version: parsed.data.version,
        is_active: parsed.data.isActive,
        metadata: asJson(parsed.data.metadata),
        copy_i18n: asJson(copyI18n),
    };

    const { data, error } = await supabase
        .from("booking_form_definitions")
        .upsert(payload, { onConflict: "id" })
        .select("*")
        .single();

    if (error) {
        return { data: null, error: error.message };
    }

    revalidateBookingPaths();
    return { data, error: null };
}

export async function deleteBookingFormDefinition(id: string) {
    const context = await requireBookingManagementContext();
    const supabase = await createClient();

    const { error } = await supabase
        .from("booking_form_definitions")
        .delete()
        .eq("id", id)
        .eq("workspace_id", context.activeWorkspace.id);

    if (error) {
        return { success: false, error: error.message };
    }

    revalidateBookingPaths();
    return { success: true, error: null };
}

export async function getBookingAvailabilityPreview(input: BookingAvailabilityPreviewInput): Promise<BookingAvailabilityResponse> {
    const parsed = bookingAvailabilityPreviewSchema.safeParse(input);

    if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid availability preview payload.");
    }

    const supabase = getServiceRoleClient();
    const { data: service, error: serviceError } = await supabase
        .from("booking_services")
        .select("*")
        .eq("id", parsed.data.serviceId)
        .maybeSingle();

    if (serviceError || !service) {
        throw new Error("Booking service not found.");
    }
    const requestWorkspaceId = await getRequestPublicWorkspaceId(supabase);
    if (!requestWorkspaceId || service.workspace_id !== requestWorkspaceId) {
        throw new Error("Booking service not found.");
    }
    if (service.visibility_status !== "published") {
        throw new Error("Booking service is not currently published.");
    }
    if (!await allowBookingAvailabilityRequest({
        supabase,
        workspaceId: service.workspace_id,
        headers: await headers(),
    })) {
        throw new Error("Availability is temporarily rate limited. Please try again shortly.");
    }

    // The tenant-owned service row is the public catalog source of truth.
    const effectiveDurationMinutes = service.duration_minutes;
    const effectiveMeetingProvider = resolveBookingMeetingProvider(service.virtual_meeting_provider);
    const effectiveAutoCreateMeeting = service.auto_create_virtual_meeting ?? true;

    const { data: profile, error: profileError } = await supabase
        .from("booking_template_profiles")
        .select("*")
        .eq("id", service.template_profile_id)
        .eq("workspace_id", service.workspace_id)
        .maybeSingle();

    const { data: workspace, error: workspaceError } = await supabase
        .from("workspaces")
        .select("id, workspace_tier")
        .eq("id", service.workspace_id)
        .maybeSingle();

    const { data: googleCalendarConnections, error: googleCalendarError } = await supabase
        .from("workspace_calendar_connections" as never)
        .select("id" as never)
        .eq("workspace_id" as never, service.workspace_id as never)
        .eq("provider" as never, "google" as never)
        .eq("sync_enabled" as never, true as never)
        .limit(1) as unknown as { data: Array<{ id: string }> | null; error: { message: string } | null };

    if (profileError || workspaceError || googleCalendarError) {
        throw new Error("Booking workspace and meeting configuration could not be verified.");
    }

    const bookingState = getBookingStateForWorkspace(
        workspace?.workspace_tier ?? "basic",
        profile?.status === "active",
    );
    if (bookingState !== "active") {
        return {
            bookingState,
            serviceSummary: null,
            resourceOptions: [],
            locationOptions: [],
            dateSlots: [],
            rulesNotices: [],
            businessTimezone: null,
        };
    }

    const range = dateRangeToUtc({
        start: parsed.data.dateRange.start,
        end: parsed.data.dateRange.end,
        timezone: parsed.data.timezone,
    });
    const rangeStart = range.start;
    const rangeEnd = range.end;

    const MAX_AVAILABILITY_QUERY_ROWS = 5_000;
    const MAX_AVAILABILITY_SLOTS = 2_000;
    const [resourceRows, locationRows, blackoutRows, reservationRows, ruleRows, serviceResourceLinksResponse, serviceLocationLinksResponse] = await Promise.all([
        supabase.from("booking_resources").select("id,name,resource_type").eq("workspace_id", service.workspace_id).eq("is_active", true).limit(MAX_AVAILABILITY_QUERY_ROWS + 1),
        supabase.from("booking_locations").select("id,name,location_type").eq("workspace_id", service.workspace_id).eq("is_active", true).limit(MAX_AVAILABILITY_QUERY_ROWS + 1),
        supabase
            .from("booking_blackout_windows")
            .select("id,service_id,resource_id,location_id,starts_at,ends_at,reason")
            .eq("workspace_id", service.workspace_id)
            .eq("is_active", true)
            .lt("starts_at", rangeEnd)
            .gt("ends_at", rangeStart)
            .limit(MAX_AVAILABILITY_QUERY_ROWS + 1),
        supabase
            .from("booking_reservations")
            .select(BOOKING_RESERVATION_AVAILABILITY_SELECT)
            .eq("workspace_id", service.workspace_id)
            .in("status", ACTIVE_RESERVATION_STATUSES)
            .lt("scheduled_start", new Date(new Date(rangeEnd).getTime() + 24 * 60 * 60 * 1000).toISOString())
            .gt("scheduled_end", new Date(new Date(rangeStart).getTime() - 24 * 60 * 60 * 1000).toISOString())
            .limit(MAX_AVAILABILITY_QUERY_ROWS + 1),
        supabase
            .from("booking_availability_rules")
            .select("id,rule_type,timezone,weekday_json,starts_on,ends_on,date_json,time_windows_json,priority,service_id,resource_id,location_id")
            .eq("workspace_id", service.workspace_id)
            .eq("is_active", true)
            .order("priority", { ascending: false })
            .limit(MAX_AVAILABILITY_QUERY_ROWS + 1),
        supabase
            .from("booking_service_resources")
            .select("resource_id")
            .eq("workspace_id", service.workspace_id)
            .eq("service_id", service.id)
            .limit(MAX_AVAILABILITY_QUERY_ROWS + 1),
        supabase
            .from("booking_service_locations")
            .select("location_id")
            .eq("workspace_id", service.workspace_id)
            .eq("service_id", service.id)
            .limit(MAX_AVAILABILITY_QUERY_ROWS + 1),
    ]);

    if (
        resourceRows.error
        || locationRows.error
        || blackoutRows.error
        || reservationRows.error
        || ruleRows.error
        || serviceResourceLinksResponse.error
        || serviceLocationLinksResponse.error
    ) {
        throw new Error("Booking availability and configuration could not be verified.");
    }
    if ([resourceRows.data, locationRows.data, blackoutRows.data, reservationRows.data, ruleRows.data, serviceResourceLinksResponse.data, serviceLocationLinksResponse.data]
        .some((rows) => (rows?.length ?? 0) > MAX_AVAILABILITY_QUERY_ROWS)) {
        throw new Error("Availability configuration is too large to preview safely. Narrow the request or reduce active rules.");
    }
    const linkedResourceIds = new Set((serviceResourceLinksResponse.data ?? []).map((row) => row.resource_id));
    const linkedLocationIds = new Set((serviceLocationLinksResponse.data ?? []).map((row) => row.location_id));
    const scopedResourceRows = (resourceRows.data ?? []).filter((row) => linkedResourceIds.size === 0 || linkedResourceIds.has(row.id));
    const scopedLocationRows = (locationRows.data ?? []).filter((row) => linkedLocationIds.size === 0 || linkedLocationIds.has(row.id));
    if (parsed.data.resourceId && linkedResourceIds.size > 0 && !linkedResourceIds.has(parsed.data.resourceId)) {
        throw new Error("The selected resource is not available for this service.");
    }
    if (parsed.data.resourceId && !(resourceRows.data ?? []).some((row) => row.id === parsed.data.resourceId)) {
        throw new Error("The selected resource is not active or does not exist.");
    }
    if (parsed.data.locationId && linkedLocationIds.size > 0 && !linkedLocationIds.has(parsed.data.locationId)) {
        throw new Error("The selected location is not available for this service.");
    }
    if (parsed.data.locationId && !(locationRows.data ?? []).some((row) => row.id === parsed.data.locationId)) {
        throw new Error("The selected location is not active or does not exist.");
    }

    const { walkAvailabilitySlots } = await import("./lib/slot-walker");
    const walkerResult = walkAvailabilitySlots({
        service: {
            id: service.id,
            duration_minutes: effectiveDurationMinutes,
            buffer_before_minutes: service.buffer_before_minutes,
            buffer_after_minutes: service.buffer_after_minutes,
            lead_time_minutes: getEffectiveBookingLeadTimeMinutes(service.lead_time_minutes),
            max_advance_days: service.max_advance_days,
            capacity_mode: service.capacity_mode as "single" | "shared" | "isolated" | "group" | "pooled" | "capacity",
            capacity_value: service.capacity_value,
            requires_manual_review: service.requires_manual_review,
        },
        rules: (ruleRows.data ?? []).map((row) => ({
            id: row.id,
            rule_type: row.rule_type as "recurring" | "date_override" | "seasonal",
            timezone: row.timezone,
            weekday_json: Array.isArray(row.weekday_json) ? (row.weekday_json as number[]) : [],
            starts_on: row.starts_on,
            ends_on: row.ends_on,
            date_json: (row.date_json && typeof row.date_json === "object" && !Array.isArray(row.date_json)
                ? (row.date_json as Record<string, unknown>)
                : {}),
            time_windows_json: Array.isArray(row.time_windows_json)
                ? (row.time_windows_json as Array<{ start: string; end: string; slotMinutes?: number | null }>)
                : [],
            priority: row.priority,
            service_id: row.service_id,
            resource_id: row.resource_id,
            location_id: row.location_id,
        })),
        blackouts: (blackoutRows.data ?? []).map((row) => ({
            starts_at: row.starts_at,
            ends_at: row.ends_at,
            service_id: row.service_id,
            resource_id: row.resource_id,
            location_id: row.location_id,
            reason: row.reason,
        })),
        reservations: (reservationRows.data ?? []).map((row) => ({
            service_id: row.service_id,
            scheduled_start: row.scheduled_start,
            scheduled_end: row.scheduled_end,
            resource_id: row.resource_id,
            location_id: row.location_id,
            party_size: row.party_size,
            capacity_mode_snapshot: row.capacity_mode_snapshot as "single" | "group" | "pooled" | "capacity" | null,
            capacity_value_snapshot: row.capacity_value_snapshot,
            buffer_before_minutes: reservationServiceBuffers(row.booking_services).before,
            buffer_after_minutes: reservationServiceBuffers(row.booking_services).after,
        })),
        rangeStartIso: rangeStart,
        rangeEndIso: rangeEnd,
        selectedResourceId: parsed.data.resourceId ?? null,
        selectedLocationId: parsed.data.locationId ?? null,
        requestedPartySize: parsed.data.partySize ?? 1,
        nowMs: Date.now(),
        // Stride defaults to the service duration (back-to-back). Operators
        // who want overlapping starts must add a slot_interval rule via
        // booking_rule_definitions in a future iteration; the schema today has
        // no per-window stride field, so we standardize on duration.
        defaultStrideMinutes: effectiveDurationMinutes,
        maxSlots: MAX_AVAILABILITY_SLOTS,
    });

    if (walkerResult.truncated) {
        throw new Error("This availability range contains too many slots. Narrow the date range and try again.");
    }

    try {
        const { fetchBusySlots } = await import("./lib/google-calendar");
        const busySlots = await fetchBusySlots(supabase, service.workspace_id, rangeStart, rangeEnd);
        if (busySlots.length > 0) {
            for (const slot of walkerResult.slots) {
                if (slot.status === "available" || slot.status === "manual_review") {
                    const start = new Date(slot.start).getTime();
                    const end = new Date(slot.end).getTime();
                    const isOverlap = busySlots.some((busy) => {
                        const bStart = new Date(busy.start).getTime();
                        const bEnd = new Date(busy.end).getTime();
                        return start < bEnd && end > bStart;
                    });
                    if (isOverlap) {
                        slot.status = "blocked";
                        slot.reason = "Blocked by external calendar event.";
                    }
                }
            }
        }
    } catch (calErr) {
        console.error("[booking] Google Calendar busy slot check failed:", calErr);
        for (const slot of walkerResult.slots) {
            if (slot.status === "available" || slot.status === "manual_review") {
                slot.status = "blocked";
                slot.reason = "Calendar availability could not be verified. Please try again later.";
            }
        }
    }

    const rulesNotices: string[] = [...walkerResult.notices];
    if (service.requires_manual_review) {
        rulesNotices.push("This service requires manual review before confirmation.");
    }

    const meetingAvailability = evaluateMeetingProviderSetup({
        provider: effectiveMeetingProvider,
        durationMinutes: effectiveDurationMinutes,
        autoCreate: effectiveAutoCreateMeeting,
        googleCalendarConnected: Boolean(googleCalendarConnections?.length),
        zoomConfigured: isZoomConfigured(),
    }).availability;

    return {
        bookingState,
        serviceSummary: {
            id: service.id,
            title: service.title,
            durationMinutes: effectiveDurationMinutes,
            templateKey: (profile?.template_key ?? "custom") as BookingTemplateKey,
            virtualMeetingProvider: effectiveMeetingProvider,
            autoCreateVirtualMeeting: effectiveAutoCreateMeeting,
            meetingAvailability,
        },
        resourceOptions: scopedResourceRows.map((row) => ({ id: row.id, name: row.name, resourceType: row.resource_type })),
        locationOptions: scopedLocationRows.map((row) => ({ id: row.id, name: row.name, locationType: row.location_type })),
        dateSlots: walkerResult.slots,
        rulesNotices,
        businessTimezone: walkerResult.businessTimezone,
    };
}

export async function getBookingReservations(filters?: BookingReservationFiltersInput) {
    const parsed = bookingReservationFiltersSchema.safeParse(filters ?? {});

    if (!parsed.success) {
        return {
            data: null,
            error: parsed.error.issues[0]?.message ?? "Invalid booking reservation filters.",
            total: 0,
            page: 1,
            pageSize: 25,
            statusCounts: {} as Record<string, number>,
        };
    }

    const context = await requireBookingManagementContext();
    const supabase = await createClient();

    const page = parsed.data.page;
    const pageSize = parsed.data.pageSize;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = (supabase.from("booking_reservations") as unknown as {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        select: (c: string, opts: { count: "exact" }) => any;
    })
        .select("*", { count: "exact" })
        .eq("workspace_id", context.activeWorkspace.id);

    if (parsed.data.statuses && parsed.data.statuses.length > 0) {
        query = query.in("status", parsed.data.statuses);
    } else if (parsed.data.status) {
        query = query.eq("status", parsed.data.status);
    }

    if (parsed.data.serviceId) {
        query = query.eq("service_id", parsed.data.serviceId);
    }

    if (parsed.data.from) {
        query = query.gte("scheduled_start", parsed.data.from);
    }

    if (parsed.data.to) {
        query = query.lte("scheduled_start", parsed.data.to);
    }

    if (parsed.data.search && parsed.data.search.trim()) {
        const term = parsed.data.search.trim().replace(/[%_]/g, "\\$&");
        query = query.or(
            `customer_name.ilike.%${term}%,customer_email.ilike.%${term}%,notes.ilike.%${term}%`,
        );
    }

    const STATUS_VALUES = [
        "pending_review",
        "confirmed",
        "completed",
        "cancelled_by_customer",
        "cancelled_by_workspace",
        "no_show",
    ] as const;

    const countByStatus = async (status: string) => {
        const res = await (supabase.from("booking_reservations") as unknown as {
            select: (c: string, opts: { count: "exact"; head: true }) => {
                eq: (c: string, v: string) => {
                    eq: (c: string, v: string) => Promise<{ count: number | null }>;
                };
            };
        })
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", context.activeWorkspace.id)
            .eq("status", status);
        return { status, count: res.count ?? 0 };
    };

    const [listRes, ...statusCountResults] = await Promise.all([
        query.order("scheduled_start", { ascending: true }).range(from, to),
        ...STATUS_VALUES.map(countByStatus),
    ]);

    if (listRes.error) {
        return {
            data: null,
            error: listRes.error.message,
            total: 0,
            page,
            pageSize,
            statusCounts: {} as Record<string, number>,
        };
    }

    const statusCounts: Record<string, number> = {};
    for (const r of statusCountResults) {
        statusCounts[r.status] = r.count;
    }

    return {
        data: listRes.data ?? [],
        error: null,
        total: listRes.count ?? 0,
        page,
        pageSize,
        statusCounts,
    };
}

function sanitizeIds(ids: readonly string[]): string[] {
    return Array.from(new Set(ids.filter((id) => typeof id === "string" && id.length > 0)));
}

export async function deleteBookingReservations(
    ids: readonly string[],
): Promise<{ error: string | null; deleted: number }> {
    const cleaned = sanitizeIds(ids);
    if (cleaned.length === 0) return { error: null, deleted: 0 };
    const context = await requireBookingManagementContext("booking.manage");
    const supabase = await createClient();
    const serviceRole = getServiceRoleClient();
    const { data: targetReservations, error: reservationsLookupError } = await serviceRole
        .from("booking_reservations")
        .select("id")
        .eq("workspace_id", context.activeWorkspace.id)
        .in("id", cleaned);
    if (reservationsLookupError) return { error: reservationsLookupError.message, deleted: 0 };
    const targetIds = (targetReservations ?? []).map((reservation) => reservation.id);
    if (targetIds.length === 0) return { error: null, deleted: 0 };

    const { data: linkedPayments, error: linkedPaymentsError } = await serviceRole
        .from("booking_payments")
        .select("id,reservation_id,status")
        .eq("workspace_id", context.activeWorkspace.id)
        .in("reservation_id", targetIds);
    if (linkedPaymentsError) return { error: linkedPaymentsError.message, deleted: 0 };
    if ((linkedPayments ?? []).length > 0) {
        return {
            error: "Reservations with payment records cannot be deleted. Cancel or reconcile the booking so its commercial history is preserved.",
            deleted: 0,
        };
    }

    // A reservation delete cascades the local meeting and calendar-mapping
    // rows. Clean up their external provider artifacts first, otherwise a
    // confirmed paymentless booking (for example a Fit Call) can leave a
    // live Zoom room or Google Calendar event that is no longer addressable
    // from this workspace. A failed cleanup deliberately blocks deletion so
    // an operator can retry instead of losing the provider identifiers.
    for (const reservationId of targetIds) {
        try {
            await cancelBookingMeeting(serviceRole, reservationId);
            const calendarCleanup = await deleteReservationFromGoogleCalendar(serviceRole, reservationId);
            if (!calendarCleanup.success) {
                return {
                    error: calendarCleanup.error ?? "Could not remove the external calendar event. Retry after the provider is available.",
                    deleted: 0,
                };
            }
        } catch (cleanupError) {
            return {
                error: cleanupError instanceof Error
                    ? cleanupError.message
                    : "Could not remove the external meeting. Retry after the provider is available.",
                deleted: 0,
            };
        }
    }

    const { error, count } = await (supabase as unknown as {
        from: (t: string) => {
            delete: (opts: { count: "exact" }) => {
                in: (c: string, v: string[]) => {
                    eq: (c: string, v: string) => Promise<{ error: { message: string } | null; count: number | null }>;
                };
            };
        };
    })
        .from("booking_reservations")
        .delete({ count: "exact" })
        .in("id", targetIds)
        .eq("workspace_id", context.activeWorkspace.id);
    if (error) return { error: error.message, deleted: 0 };
    return { error: null, deleted: count ?? 0 };
}

export async function bulkTransitionBookingReservationStatus(
    ids: readonly string[],
    nextStatus: string,
): Promise<{ error: string | null; updated: number }> {
    const cleaned = sanitizeIds(ids);
    if (cleaned.length === 0) return { error: null, updated: 0 };
    const parsedStatus = bookingReservationStatusTransitionSchema.safeParse({
        reservationId: cleaned[0],
        nextStatus,
        reason: "Bulk status transition by workspace operator.",
    });
    if (!parsedStatus.success) {
        return { error: parsedStatus.error.issues[0]?.message ?? "Invalid reservation status.", updated: 0 };
    }

    // Apply the same per-reservation CAS, payment fence compensation, audit,
    // meeting, and Business Spine orchestration as the single-row action. A
    // broad UPDATE after pre-fencing could otherwise leave a payment fenced
    // when a reservation changed or the bulk write lost its race.
    let updated = 0;
    let firstError: string | null = null;
    for (const reservationId of cleaned) {
        const result = await transitionBookingReservationStatus({
            reservationId,
            nextStatus: parsedStatus.data.nextStatus,
            reason: parsedStatus.data.reason,
        });
        if (result.error) {
            firstError ??= result.error;
        } else {
            updated += 1;
        }
    }
    return { error: firstError, updated };
}

export async function transitionBookingReservationStatus(input: BookingReservationStatusTransitionInput) {
    const parsed = bookingReservationStatusTransitionSchema.safeParse(input);

    if (!parsed.success) {
        return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid reservation status transition payload." };
    }

    const context = await requireBookingManagementContext();
    const supabase = await createClient();
    const userId = await getAuthenticatedUserId();
    const { data: reservation, error: reservationError } = await supabase
        .from("booking_reservations")
        .select("id,status,workspace_id,service_id,template_profile_id,source_channel,source_campaign,source_referrer,scheduled_start,reservation_timezone,attribution_json,metadata,customer_full_name,customer_email,customer_phone,portal_client_id")
        .eq("id", parsed.data.reservationId)
        .eq("workspace_id", context.activeWorkspace.id)
        .maybeSingle();

    if (reservationError || !reservation) {
        return { data: null, error: "Reservation not found." };
    }

    const allowedTransitions: Record<BookingReservationRow["status"], BookingReservationRow["status"][]> = {
        draft: ["pending_review", "pending_confirmation", "cancelled_by_customer", "cancelled_by_workspace"],
        pending_review: ["pending_confirmation", "confirmed", "cancelled_by_customer", "cancelled_by_workspace", "expired"],
        pending_confirmation: ["confirmed", "cancelled_by_customer", "cancelled_by_workspace", "expired"],
        confirmed: ["completed", "cancelled_by_customer", "cancelled_by_workspace", "no_show"],
        completed: ["no_show"],
        cancelled_by_customer: [],
        cancelled_by_workspace: [],
        no_show: [],
        expired: [],
    };
    const currentReservationStatus = reservation.status as BookingReservationRow["status"];
    if (!allowedTransitions[currentReservationStatus].includes(parsed.data.nextStatus)) {
        return { data: null, error: `Reservation cannot transition from ${reservation.status} to ${parsed.data.nextStatus}.` };
    }

    if (parsed.data.nextStatus === "confirmed") {
        const [{ data: serviceConfig, error: serviceConfigError }, { data: payment, error: paymentError }] = await Promise.all([
            supabase.from("booking_services").select("payment_required").eq("id", reservation.service_id).eq("workspace_id", context.activeWorkspace.id).maybeSingle(),
            supabase.from("booking_payments").select("status").eq("reservation_id", reservation.id).eq("workspace_id", context.activeWorkspace.id).maybeSingle(),
        ]);
        if (serviceConfigError || paymentError) {
            return { data: null, error: "Could not verify the payment state before confirmation." };
        }
        const paymentRequired = Boolean(serviceConfig?.payment_required);
        if (paymentRequired && payment?.status !== "verified") {
            return { data: null, error: "Cannot confirm a paid reservation until its payment is verified." };
        }
        if (payment && payment.status !== "verified") {
            return { data: null, error: "Cannot confirm: payment is not verified yet." };
        }
    }

    // Anti-abuse/manual-review requests create a durable payment row but do
    // not start checkout until an operator approves the request. Reset the
    // payment window at that milestone so a long review cannot consume the
    // customer's entire hold before PayPal is even offered.
    let paymentDeadlineReset: { paymentId: string; previousDeadlineAt: string | null; deadlineAt: string } | null = null;
    if (parsed.data.nextStatus === "pending_confirmation" && reservation.status === "pending_review") {
        const [{ data: serviceConfig, error: serviceConfigError }, { data: pendingPayment, error: pendingPaymentError }] = await Promise.all([
            supabase
                .from("booking_services")
                .select("payment_required")
                .eq("id", reservation.service_id)
                .eq("workspace_id", context.activeWorkspace.id)
                .maybeSingle(),
            supabase
                .from("booking_payments")
                .select("id,status,deadline_at")
                .eq("reservation_id", reservation.id)
                .eq("workspace_id", context.activeWorkspace.id)
                .maybeSingle(),
        ]);
        if (serviceConfigError || pendingPaymentError) {
            return { data: null, error: "Could not verify the payment state before approving this request." };
        }
        const paymentRequired = Boolean(serviceConfig?.payment_required);
        if (paymentRequired && (!pendingPayment || !["requested", "verified"].includes(pendingPayment.status))) {
            return { data: null, error: "This paid request has no active payment hold to approve. Create a fresh booking instead." };
        }
        if (pendingPayment?.status === "requested") {
            const deadlineAt = getBookingPaymentDeadlineAt(new Date()).toISOString();
            const { data: resetPayment, error: resetError } = await supabase
                .from("booking_payments")
                .update({
                    deadline_at: deadlineAt,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", pendingPayment.id)
                .eq("workspace_id", context.activeWorkspace.id)
                .eq("status", "requested")
                .select("id")
                .maybeSingle();
            if (resetError || !resetPayment) {
                return { data: null, error: resetError?.message ?? "The payment hold changed before approval completed." };
            }
            paymentDeadlineReset = {
                paymentId: pendingPayment.id,
                previousDeadlineAt: pendingPayment.deadline_at,
                deadlineAt,
            };
        }
    }

    let paymentFence: BookingPaymentCancellationFence | null = null;
    if (PAYMENT_FENCED_RESERVATION_STATUSES.includes(parsed.data.nextStatus)) {
        try {
            paymentFence = await fenceBookingPaymentForCancellation({
                supabase: getServiceRoleClient(),
                workspaceId: context.activeWorkspace.id,
                reservationId: parsed.data.reservationId,
                source: "operator",
                reason: parsed.data.reason ?? "Reservation was cancelled by a workspace operator.",
                terminalProviderStatus: parsed.data.nextStatus === "expired" ? "EXPIRED" : "CUSTOMER_CANCELLED",
            });
        } catch (error) {
            return {
                data: null,
                error: error instanceof Error ? error.message : "Could not fence the booking payment before cancellation.",
            };
        }
    }

    const reservationMetadata = normalizeJsonRecord(reservation.metadata);
    const selfServiceReschedule = normalizeJsonRecord(reservationMetadata.selfServiceReschedule as Json);
    const confirmingReviewedReschedule = (
        parsed.data.nextStatus === "confirmed"
        && (reservation.status === "pending_review" || reservation.status === "pending_confirmation")
        && selfServiceReschedule.requiresReview === true
        && selfServiceReschedule.state === "pending_review"
    );
    const nextMetadata = confirmingReviewedReschedule
        ? {
            ...reservationMetadata,
            selfServiceReschedule: {
                ...selfServiceReschedule,
                state: "confirmed",
                confirmedAt: new Date().toISOString(),
                confirmedBy: userId,
            },
        }
        : reservationMetadata;

    const reservationUpdate: TablesUpdate<"booking_reservations"> = {
        status: parsed.data.nextStatus,
        metadata: nextMetadata as Json,
        updated_at: new Date().toISOString(),
        ...(paymentDeadlineReset ? { payment_deadline_at: paymentDeadlineReset.deadlineAt } : {}),
    };
    let data: BookingReservationRow | null = null;
    let error: { message: string } | null = null;
    if (parsed.data.nextStatus === "confirmed") {
        const meetingProvider = reservationMetadata.meetingProvider === "zoom"
            || reservationMetadata.meetingProvider === "google_meet"
            || reservationMetadata.meetingProvider === "none"
            ? reservationMetadata.meetingProvider
            : "google_meet";
        const confirmation = await provisionAndConfirmReservation({
            provider: meetingProvider,
            provisionMeeting: () => ensureBookingMeeting(supabase, parsed.data.reservationId),
            commitConfirmation: async () => {
                const result = await supabase
                    .from("booking_reservations")
                    .update(reservationUpdate)
                    .eq("id", parsed.data.reservationId)
                    .eq("workspace_id", context.activeWorkspace.id)
                    .eq("status", reservation.status)
                    .select("*")
                    .maybeSingle();
                if (result.error) throw new Error(result.error.message);
                data = result.data;
                return Boolean(result.data);
            },
        });
        if (!confirmation.confirmed) {
            return {
                data: null,
                error: confirmation.reason ?? "A customer meeting link must be ready before confirmation.",
            };
        }
    } else {
        const result = await supabase
            .from("booking_reservations")
            .update(reservationUpdate)
            .eq("id", parsed.data.reservationId)
            .eq("workspace_id", context.activeWorkspace.id)
            .eq("status", reservation.status)
            .select("*")
            .single();
        data = result.data;
        error = result.error;
    }

    if (error) {
        if (paymentDeadlineReset) {
            await supabase
                .from("booking_payments")
                .update({
                    deadline_at: paymentDeadlineReset.previousDeadlineAt,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", paymentDeadlineReset.paymentId)
                .eq("workspace_id", context.activeWorkspace.id)
                .eq("status", "requested");
        }
        if (paymentFence) {
            await restoreBookingPaymentFenceAfterTransitionRace({
                supabase: getServiceRoleClient(),
                workspaceId: context.activeWorkspace.id,
                reservationId: parsed.data.reservationId,
                fence: paymentFence,
            });
        }
        return { data: null, error: error.message };
    }

    if (!data && paymentFence) {
        await restoreBookingPaymentFenceAfterTransitionRace({
            supabase: getServiceRoleClient(),
            workspaceId: context.activeWorkspace.id,
            reservationId: parsed.data.reservationId,
            fence: paymentFence,
        });
    }
    if (!data && paymentDeadlineReset) {
        await supabase
            .from("booking_payments")
            .update({
                deadline_at: paymentDeadlineReset.previousDeadlineAt,
                updated_at: new Date().toISOString(),
            })
            .eq("id", paymentDeadlineReset.paymentId)
            .eq("workspace_id", context.activeWorkspace.id)
            .eq("status", "requested");
    }

    const analyticsEventType = mapBookingStatusToAnalyticsEvent(parsed.data.nextStatus);
    if (analyticsEventType) {
        await recordBookingAnalyticsEvent({
            supabase,
            workspaceId: context.activeWorkspace.id,
            eventType: analyticsEventType,
            reservationId: parsed.data.reservationId,
            serviceId: reservation.service_id,
            templateKey: typeof (reservation.metadata as Record<string, unknown> | null)?.templateKey === "string"
                ? (reservation.metadata as Record<string, unknown>).templateKey as string
                : null,
            sourceChannel: reservation.source_channel,
            sourceCampaign: reservation.source_campaign,
            sourceReferrer: reservation.source_referrer,
            selectedSlot: reservation.scheduled_start,
            locale: typeof (reservation.attribution_json as Record<string, unknown> | null)?.locale === "string"
                ? (reservation.attribution_json as Record<string, unknown>).locale as string
                : null,
            attribution: normalizeJsonRecord(reservation.attribution_json),
            extra: {
                previousStatus: reservation.status,
                nextStatus: parsed.data.nextStatus,
                reservationTimezone: reservation.reservation_timezone,
            },
        });
    }

    let pendingConfirmationHasPayment = false;
    if (parsed.data.nextStatus === "pending_confirmation") {
        const { data: pendingPayment } = await supabase
            .from("booking_payments")
            .select("provider,payment_url")
            .eq("reservation_id", parsed.data.reservationId)
            .eq("workspace_id", context.activeWorkspace.id)
            .eq("status", "requested")
            .maybeSingle();
        pendingConfirmationHasPayment = Boolean(pendingPayment);
        if (pendingPayment?.provider === "paypal_checkout" && !pendingPayment.payment_url) {
            await retryPendingPayPalCheckout({
                supabase: getServiceRoleClient(),
                workspaceId: context.activeWorkspace.id,
                reservationId: parsed.data.reservationId,
            });
        }
    }

    const transitionEmailEvent = parsed.data.nextStatus === "confirmed"
        ? confirmingReviewedReschedule
            ? "reservation_rescheduled"
            : "reservation_confirmed"
        : parsed.data.nextStatus === "pending_confirmation" && pendingConfirmationHasPayment
            ? "payment_requested"
        : parsed.data.nextStatus === "completed"
            ? "reservation_completed"
            : parsed.data.nextStatus === "no_show"
                ? "reservation_no_show"
                : "reservation_cancelled";

    await Promise.all([
        supabase.from("booking_status_history").insert({
            workspace_id: context.activeWorkspace.id,
            reservation_id: parsed.data.reservationId,
            from_status: reservation.status,
            to_status: parsed.data.nextStatus,
            trigger_source: "operator",
            actor_type: "workspace_manager",
            actor_id: userId,
            reason: parsed.data.reason ?? null,
            payload_json: asJson({
                source: "server_action",
                confirmingReviewedReschedule,
            }),
        }),
        supabase.from("booking_notification_events").insert({
            workspace_id: context.activeWorkspace.id,
            reservation_id: parsed.data.reservationId,
            event_type: transitionEmailEvent,
            channel: "internal_dashboard",
            delivery_status: "pending",
            payload_json: asJson({
                reason: parsed.data.reason ?? null,
                nextStatus: parsed.data.nextStatus,
                emailDispatchRequired: true,
            }),
        }),
    ]);

    const integrationCleanupErrors: string[] = [];
    if (["cancelled_by_customer", "cancelled_by_workspace", "expired", "no_show"].includes(parsed.data.nextStatus)) {
        try {
            await cancelBookingMeeting(supabase, parsed.data.reservationId);
        } catch (meetingError) {
            console.warn("[booking] meeting cancellation failed", meetingError);
            integrationCleanupErrors.push(meetingError instanceof Error ? meetingError.message : "Meeting provider cleanup failed.");
        }
        try {
            const { deleteReservationFromGoogleCalendar } = await import("./lib/google-calendar");
            const calendarCleanup = await deleteReservationFromGoogleCalendar(supabase, parsed.data.reservationId);
            if (!calendarCleanup.success) {
                integrationCleanupErrors.push(calendarCleanup.error ?? "Google Calendar cleanup failed.");
            }
        } catch (calErr) {
            console.error("[booking] Google Calendar delete failed on transition:", calErr);
            integrationCleanupErrors.push(calErr instanceof Error ? calErr.message : "Google Calendar cleanup failed.");
        }
    }

    await dispatchBookingEmails({
        supabase,
        workspaceId: context.activeWorkspace.id,
        reservationId: parsed.data.reservationId,
        eventType: transitionEmailEvent,
        reason: parsed.data.reason ?? null,
    });

    try {
        await recordBookingBusinessEvent({
            supabase: getServiceRoleClient(),
            workspaceId: context.activeWorkspace.id,
            reservationId: parsed.data.reservationId,
            status: parsed.data.nextStatus,
            customerName: reservation.customer_full_name,
            customerEmail: reservation.customer_email,
            customerPhone: reservation.customer_phone,
            portalClientId: reservation.portal_client_id,
            scheduledStart: reservation.scheduled_start,
            // Completion of a Fit Call is qualification, not delivery start.
            // Keep the active milestone opt-in and explicit.
            engagementStarted: false,
            source: "operator",
        });
    } catch (error) {
        console.warn("[booking] business spine event failed", error instanceof Error ? error.message : error);
    }

    // Auto-draft a DVO in the Legal Vault on confirmation. Idempotent on
    // (workspace, booking_id), so re-confirmation never duplicates. Best-
    // effort: failures here must not block the booking transition itself.
    if (parsed.data.nextStatus === "confirmed") {
        try {
            await draftAgreementFromBooking(parsed.data.reservationId);
        } catch (error: unknown) {
            console.warn(
                "[booking] draftAgreementFromBooking failed",
                error instanceof Error ? error.message : error,
            );
        }
    }

    revalidateBookingPaths();
    return {
        data,
        error: integrationCleanupErrors.length > 0
            ? `Reservation transitioned, but external meeting cleanup needs a retry: ${integrationCleanupErrors.join(" ")}`
            : null,
    };
}

/**
 * Records the governed implementation/delivery-start milestone. A signed
 * Legal Vault agreement tied to this reservation is required so a completed
 * consultation or captured Blueprint payment cannot silently become active.
 */
export async function markBookingDeliveryStarted(input: BookingDeliveryStartInput) {
    const parsed = bookingDeliveryStartSchema.safeParse(input);
    if (!parsed.success) {
        return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid delivery-start payload." };
    }

    const context = await requireBookingManagementContext("booking.manage");
    const supabase = await createClient();
    const { data: reservation, error: reservationError } = await supabase
        .from("booking_reservations")
        .select("id,status,workspace_id,service_id,scheduled_start,customer_full_name,customer_email,customer_phone,portal_client_id,metadata")
        .eq("id", parsed.data.reservationId)
        .eq("workspace_id", context.activeWorkspace.id)
        .maybeSingle();

    if (reservationError || !reservation) {
        return { data: null, error: "Reservation not found." };
    }
    if (reservation.status !== "confirmed" && reservation.status !== "completed") {
        return { data: null, error: "Delivery can only start after the booking is confirmed or completed." };
    }

    const serviceRole = getServiceRoleClient();
    let agreementQuery = serviceRole
        .from("legal_agreements")
        .select("id,status,signed_at,booking_id")
        .eq("workspace_id", context.activeWorkspace.id)
        .eq("booking_id", parsed.data.reservationId)
        .eq("status", "signed")
        .limit(1);
    if (parsed.data.signedAgreementId) {
        agreementQuery = agreementQuery.eq("id", parsed.data.signedAgreementId);
    }
    const { data: agreement, error: agreementError } = await agreementQuery.maybeSingle();
    if (agreementError) {
        return { data: null, error: agreementError.message };
    }
    if (!agreement) {
        return { data: null, error: "A signed implementation agreement linked to this booking is required before delivery can start." };
    }

    const now = new Date().toISOString();
    const reservationMetadata = normalizeJsonRecord(reservation.metadata);
    const existingSignal = normalizeJsonRecord(reservationMetadata.businessSpine as Json);
    if (existingSignal.engagementStarted === true) {
        return {
            data: { reservationId: reservation.id, agreementId: agreement.id, startedAt: existingSignal.engagementStartedAt ?? null },
            error: null,
        };
    }

    const nextMetadata = {
        ...reservationMetadata,
        businessSpine: {
            ...existingSignal,
            engagementStarted: true,
            engagementStartedAt: now,
            engagementStartedBy: await getAuthenticatedUserId(),
            signedAgreementId: agreement.id,
            reason: parsed.data.reason ?? null,
        },
    } as Json;
    const { data: updatedReservation, error: updateError } = await supabase
        .from("booking_reservations")
        .update({ metadata: nextMetadata, updated_at: now })
        .eq("id", reservation.id)
        .eq("workspace_id", context.activeWorkspace.id)
        .eq("status", reservation.status)
        .select("id")
        .maybeSingle();
    if (updateError || !updatedReservation) {
        return { data: null, error: updateError?.message ?? "The booking changed before delivery could be started." };
    }

    try {
        const serviceKey = reservation.service_id
            ? (await serviceRole.from("booking_services").select("service_key").eq("id", reservation.service_id).eq("workspace_id", context.activeWorkspace.id).maybeSingle()).data?.service_key ?? null
            : null;
        await recordBookingBusinessEvent({
            supabase: serviceRole,
            workspaceId: context.activeWorkspace.id,
            reservationId: reservation.id,
            status: "implementation_started",
            customerName: reservation.customer_full_name,
            customerEmail: reservation.customer_email,
            customerPhone: reservation.customer_phone,
            portalClientId: reservation.portal_client_id,
            scheduledStart: reservation.scheduled_start,
            serviceKey,
            engagementStarted: true,
            source: "operator",
        });
    } catch (error) {
        console.warn("[booking] delivery-start Business Spine event failed", error instanceof Error ? error.message : error);
    }

    revalidateBookingPaths();
    return { data: { reservationId: reservation.id, agreementId: agreement.id, startedAt: now }, error: null };
}

export async function submitBookingReservation(input: BookingReservationSubmissionInput): Promise<{ data: BookingSubmissionResult | null; error: string | null }> {
    const parsed = bookingReservationSubmissionSchema.safeParse(input);

    if (!parsed.success) {
        return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid booking reservation payload." };
    }

    const supabase = getServiceRoleClient();
    const payload = parsed.data;
    const submissionFingerprint = deriveBookingSubmissionFingerprint(payload);
    const idempotencyKey = deriveBookingSubmissionIdempotencyKey(payload);

    const { data: service, error: serviceError } = await supabase
        .from("booking_services")
        .select("*")
        .eq("id", payload.serviceId)
        .maybeSingle();

    if (serviceError || !service) {
        return { data: null, error: "Booking service not found." };
    }
    const requestWorkspaceId = await getRequestPublicWorkspaceId(supabase);
    if (!requestWorkspaceId || service.workspace_id !== requestWorkspaceId) {
        return { data: null, error: "Booking service not found." };
    }
    if (service.visibility_status !== "published") {
        return { data: null, error: "Booking service is not currently published." };
    }

    // Keep availability, checkout, and provisioning on the same tenant-owned
    // service contract presented in the public catalog.
    const effectiveDurationMinutes = service.duration_minutes;
    const effectivePaymentRequired = Boolean(service.payment_required);
    const effectivePaymentProvider = normalizeBookingPaymentProvider(service.payment_provider);
    const effectivePaymentCurrency = service.price_currency ?? "EUR";

    const [profileResponse, workspaceResponse, resourceResponse, locationResponse, formResponse, blackoutResponse, availabilityRulesResponse, rulesResponse, overlappingReservationsResponse, serviceResourceLinksResponse, serviceLocationLinksResponse] = await Promise.all([
        supabase.from("booking_template_profiles").select("*").eq("id", service.template_profile_id).eq("workspace_id", service.workspace_id).maybeSingle(),
        supabase.from("workspaces").select("id,name,slug,workspace_tier").eq("id", service.workspace_id).maybeSingle(),
        payload.resourceId ? supabase.from("booking_resources").select("*").eq("id", payload.resourceId).maybeSingle() : Promise.resolve({ data: null, error: null }),
        payload.locationId ? supabase.from("booking_locations").select("*").eq("id", payload.locationId).maybeSingle() : Promise.resolve({ data: null, error: null }),
        supabase.from("booking_form_definitions").select("*").eq("workspace_id", service.workspace_id).eq("template_profile_id", service.template_profile_id).eq("is_active", true).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
        supabase
            .from("booking_blackout_windows")
            .select("id,service_id,resource_id,location_id,starts_at,ends_at,reason")
            .eq("workspace_id", service.workspace_id)
            .eq("is_active", true)
            .lt("starts_at", new Date(new Date(payload.scheduledStart).getTime() + effectiveDurationMinutes * 60_000).toISOString())
            .gt("ends_at", payload.scheduledStart),
        supabase
            .from("booking_availability_rules")
            .select("id,rule_type,timezone,weekday_json,starts_on,ends_on,date_json,time_windows_json,priority,service_id,resource_id,location_id")
            .eq("workspace_id", service.workspace_id)
            .eq("is_active", true)
            .order("priority", { ascending: false }),
        supabase.from("booking_rule_definitions").select("*").eq("workspace_id", service.workspace_id).eq("is_active", true),
        supabase
            .from("booking_reservations")
            .select(BOOKING_RESERVATION_AVAILABILITY_SELECT)
            .eq("workspace_id", service.workspace_id)
            .in("status", ACTIVE_RESERVATION_STATUSES)
            .lt("scheduled_start", new Date(new Date(payload.scheduledStart).getTime() + (effectiveDurationMinutes + 24 * 60) * 60_000).toISOString())
            .gt("scheduled_end", new Date(new Date(payload.scheduledStart).getTime() - 24 * 60 * 60_000).toISOString()),
        supabase
            .from("booking_service_resources")
            .select("resource_id")
            .eq("workspace_id", service.workspace_id)
            .eq("service_id", service.id),
        supabase
            .from("booking_service_locations")
            .select("location_id")
            .eq("workspace_id", service.workspace_id)
            .eq("service_id", service.id),
    ]);

    const profile = profileResponse.data;
    const workspace = workspaceResponse.data;
    const resource = resourceResponse.data;
    const location = locationResponse.data;
    const formDefinition = formResponse.data;
    const blackoutRows = blackoutResponse.data ?? [];
    const availabilityRuleRows = availabilityRulesResponse.data ?? [];
    const ruleRows = rulesResponse.data ?? [];
    const overlappingReservations = overlappingReservationsResponse.data ?? [];
    if (
        profileResponse.error
        || workspaceResponse.error
        || resourceResponse.error
        || locationResponse.error
        || formResponse.error
        || blackoutResponse.error
        || availabilityRulesResponse.error
        || rulesResponse.error
        || overlappingReservationsResponse.error
        || serviceResourceLinksResponse.error
        || serviceLocationLinksResponse.error
    ) {
        return { data: null, error: "Booking availability and configuration could not be verified. Please try again." };
    }
    const linkedResourceIds = new Set((serviceResourceLinksResponse.data ?? []).map((row) => row.resource_id));
    const linkedLocationIds = new Set((serviceLocationLinksResponse.data ?? []).map((row) => row.location_id));
    const normalizedCustomerEmail = normalizeCustomerEmail(payload.customer.email);
    const businessTimezone = availabilityRuleRows
        .filter((row) => (!row.service_id || row.service_id === service.id)
            && (!payload.resourceId || !row.resource_id || row.resource_id === payload.resourceId)
            && (!payload.locationId || !row.location_id || row.location_id === payload.locationId))
        .map((row) => row.timezone)
        .find((timezone): timezone is string => typeof timezone === "string" && isValidIanaTimezone(timezone))
        ?? (isValidIanaTimezone(process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE?.trim() ?? "")
            ? process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE!.trim()
            : payload.reservationTimezone);
    const isConsultationBooking = profile?.template_key === "consultation";
    const requestHeaders = await headers();
    const antiAbuseInput = {
        surface: "booking_submission" as const,
        sourcePath: payload.antiAbuse.pagePath?.trim() || "/booking",
        workspaceId: service.workspace_id,
        email: normalizedCustomerEmail,
        honeypotValue: payload.antiAbuse.honeypot,
        formStartedAt: payload.antiAbuse.formStartedAt ?? null,
        contentSummary: [payload.customer.fullName, payload.customer.email, JSON.stringify(payload.intakePayload)].join(" "),
        metadata: {
            serviceId: service.id,
            templateKey: profile?.template_key ?? null,
            consultationBooking: isConsultationBooking,
        },
        context: extractAntiAbuseRequestContext(requestHeaders),
    };
    const antiAbuse = await assessAntiAbuseSubmission({
        supabaseAdmin: supabase,
        input: antiAbuseInput,
    });

    if (!profile || !workspace) {
        return { data: null, error: "Booking configuration is incomplete for this service." };
    }

    const { data: gdprSettings } = await supabase
        .from("workspace_gdpr_settings")
        .select("privacy_policy_url")
        .eq("workspace_id", service.workspace_id)
        .maybeSingle();
    const bookingLocale = normalizeEmailLocale(
        typeof payload.attribution.metadata.locale === "string" ? payload.attribution.metadata.locale : null,
    );
    const configuredPrivacyPolicyUrl = gdprSettings?.privacy_policy_url?.trim() || null;
    const localizedConfiguredPrivacyPolicyUrl = configuredPrivacyPolicyUrl?.startsWith("/") && !configuredPrivacyPolicyUrl.startsWith("//")
        ? localizeHref(bookingLocale, configuredPrivacyPolicyUrl)
        : configuredPrivacyPolicyUrl;
    const normalizedPrivacyPolicyUrl = normalizePrivacyPolicyUrl(
        localizedConfiguredPrivacyPolicyUrl,
        localizeHref(bookingLocale, "/privacy"),
    );
    const privacyPolicyUrl = /^https?:\/\//i.test(normalizedPrivacyPolicyUrl)
        ? normalizedPrivacyPolicyUrl
        : buildSiteUrl(normalizedPrivacyPolicyUrl);
    const privacyConsentSnapshot = {
        acceptedAt: new Date().toISOString(),
        policyUrl: privacyPolicyUrl,
        policyVersion: "booking-privacy-v1",
        locale: bookingLocale,
        source: "public_booking_form",
    } as const;

    if (workspace.workspace_tier !== "pro") {
        return { data: null, error: "This workspace is not entitled to live booking." };
    }

    if (profile.status !== "active") {
        return { data: null, error: "The selected booking profile is not active." };
    }

    if (payload.resourceId && !resource) {
        return { data: null, error: "Selected resource is not active or does not exist." };
    }
    if (resource && resource.workspace_id !== service.workspace_id) {
        return { data: null, error: "Selected resource is outside the service workspace." };
    }
    if (resource && resource.is_active === false) {
        return { data: null, error: "Selected resource is not active." };
    }

    if (payload.resourceId && linkedResourceIds.size > 0 && !linkedResourceIds.has(payload.resourceId)) {
        return { data: null, error: "The selected resource is not available for this service." };
    }

    if (payload.locationId && !location) {
        return { data: null, error: "Selected location is not active or does not exist." };
    }
    if (location && location.workspace_id !== service.workspace_id) {
        return { data: null, error: "Selected location is outside the service workspace." };
    }
    if (location && location.is_active === false) {
        return { data: null, error: "Selected location is not active." };
    }

    if (payload.locationId && linkedLocationIds.size > 0 && !linkedLocationIds.has(payload.locationId)) {
        return { data: null, error: "The selected location is not available for this service." };
    }

    const scheduledStart = new Date(payload.scheduledStart);
    const scheduledEnd = new Date(scheduledStart.getTime() + effectiveDurationMinutes * 60_000);
    const nowMs = Date.now();
    const effectiveLeadTimeMinutes = getEffectiveBookingLeadTimeMinutes(service.lead_time_minutes);
    const minimumAllowedStart = new Date(nowMs + effectiveLeadTimeMinutes * 60_000);
    const maximumAllowedStart = service.max_advance_days > 0
        ? new Date(nowMs + service.max_advance_days * 24 * 60 * 60 * 1000)
        : null;

    if (scheduledStart.getTime() < minimumAllowedStart.getTime()) {
        return { data: null, error: `This slot is too soon. Bookings require at least ${BOOKING_MINIMUM_LEAD_TIME_MINUTES / 60} hours of notice.` };
    }

    if (maximumAllowedStart && scheduledStart.getTime() > maximumAllowedStart.getTime()) {
        return { data: null, error: "This slot is beyond the current booking horizon." };
    }

    const matchingBlackout = blackoutRows.find((row) => {
        const appliesToService = !row.service_id || row.service_id === service.id;
        const appliesToResource = !payload.resourceId || !row.resource_id || row.resource_id === payload.resourceId;
        const appliesToLocation = !payload.locationId || !row.location_id || row.location_id === payload.locationId;
        return appliesToService && appliesToResource && appliesToLocation;
    });

    if (matchingBlackout) {
        return { data: null, error: matchingBlackout.reason ?? "This slot falls inside a blackout window." };
    }

    const { walkAvailabilitySlots } = await import("./lib/slot-walker");
    const availabilityCheck = walkAvailabilitySlots({
        service: {
            id: service.id,
            duration_minutes: effectiveDurationMinutes,
            buffer_before_minutes: service.buffer_before_minutes,
            buffer_after_minutes: service.buffer_after_minutes,
            lead_time_minutes: effectiveLeadTimeMinutes,
            max_advance_days: service.max_advance_days,
            capacity_mode: service.capacity_mode as "single" | "shared" | "isolated" | "group" | "pooled" | "capacity",
            capacity_value: service.capacity_value,
            requires_manual_review: service.requires_manual_review,
        },
        rules: availabilityRuleRows.map((row) => ({
            id: row.id,
            rule_type: row.rule_type as "recurring" | "date_override" | "seasonal",
            timezone: row.timezone,
            weekday_json: Array.isArray(row.weekday_json) ? (row.weekday_json as number[]) : [],
            starts_on: row.starts_on,
            ends_on: row.ends_on,
            date_json: (row.date_json && typeof row.date_json === "object" && !Array.isArray(row.date_json)
                ? (row.date_json as Record<string, unknown>)
                : {}),
            time_windows_json: Array.isArray(row.time_windows_json)
                ? (row.time_windows_json as Array<{ start: string; end: string; slotMinutes?: number | null }>)
                : [],
            priority: row.priority,
            service_id: row.service_id,
            resource_id: row.resource_id,
            location_id: row.location_id,
        })),
        blackouts: blackoutRows.map((row) => ({
            starts_at: row.starts_at,
            ends_at: row.ends_at,
            service_id: row.service_id,
            resource_id: row.resource_id,
            location_id: row.location_id,
            reason: row.reason,
        })),
        reservations: overlappingReservations.map((row) => ({
            service_id: row.service_id,
            scheduled_start: row.scheduled_start,
            scheduled_end: row.scheduled_end,
            resource_id: row.resource_id,
            location_id: row.location_id,
            party_size: row.party_size,
            capacity_mode_snapshot: row.capacity_mode_snapshot as "single" | "group" | "pooled" | "capacity" | null,
            capacity_value_snapshot: row.capacity_value_snapshot,
            buffer_before_minutes: reservationServiceBuffers(row.booking_services).before,
            buffer_after_minutes: reservationServiceBuffers(row.booking_services).after,
        })),
        rangeStartIso: new Date(scheduledStart.getTime() - 60_000).toISOString(),
        rangeEndIso: new Date(scheduledEnd.getTime() + 60_000).toISOString(),
        selectedResourceId: payload.resourceId ?? null,
        selectedLocationId: payload.locationId ?? null,
        requestedPartySize: payload.partySize,
        nowMs,
        defaultStrideMinutes: effectiveDurationMinutes,
    });
    const matchingSlot = availabilityCheck.slots.find((slot) =>
        slot.start === scheduledStart.toISOString() && slot.end === scheduledEnd.toISOString(),
    );
    if (!matchingSlot || matchingSlot.status !== "available") {
        return { data: null, error: matchingSlot?.reason ?? "This slot is no longer available under the current availability rules." };
    }

    try {
        const { fetchBusySlots } = await import("./lib/google-calendar");
        const checkRangeStart = new Date(scheduledStart.getTime() - 60_000).toISOString();
        const checkRangeEnd = new Date(scheduledEnd.getTime() + 60_000).toISOString();
        const busySlots = await fetchBusySlots(supabase, service.workspace_id, checkRangeStart, checkRangeEnd);
        if (busySlots.length > 0) {
            const start = scheduledStart.getTime();
            const end = scheduledEnd.getTime();
            const isOverlap = busySlots.some((busy) => {
                const bStart = new Date(busy.start).getTime();
                const bEnd = new Date(busy.end).getTime();
                return start < bEnd && end > bStart;
            });
            if (isOverlap) {
                return { data: null, error: "This slot is blocked by an external calendar event." };
            }
        }
    } catch (calErr) {
        console.error("[booking] Google Calendar busy slot validation failed:", calErr);
        return { data: null, error: "Calendar availability could not be verified. Please try again later." };
    }

    if (antiAbuse.triggerCooldown) {
        await applyAutomaticCooldownRule({
            supabaseAdmin: supabase,
            assessment: antiAbuse,
            input: antiAbuseInput,
        });
    }

    if (antiAbuse.decision === "block") {
        await persistAntiAbuseEvent({
            supabaseAdmin: supabase,
            assessment: antiAbuse,
            input: antiAbuseInput,
        });

        return { data: null, error: "We could not finalize this reservation request. Please try again shortly." };
    }

    if (antiAbuse.decision === "throttle") {
        await persistAntiAbuseEvent({
            supabaseAdmin: supabase,
            assessment: antiAbuse,
            input: antiAbuseInput,
        });

        return { data: null, error: "Too many booking attempts were detected. Please wait a bit before trying again." };
    }

    const maxPartySizeRule = ruleRows.find((row) => row.rule_key === "max_party_size" && (!row.service_id || row.service_id === service.id));
    if (maxPartySizeRule) {
        const maxPartySize = Number(normalizeJsonRecord(maxPartySizeRule.rule_value_json).value ?? payload.partySize);
        if (payload.partySize > maxPartySize) {
            return { data: null, error: `Party size exceeds the configured limit of ${maxPartySize}.` };
        }
    }

    const antiAbuseForcesReview = antiAbuse.decision === "review";
    const baseInitialStatus = antiAbuseForcesReview
        ? "pending_review"
        : deriveInitialReservationStatus({ ...service, payment_required: effectivePaymentRequired }, profile.template_key);
    // A reviewed paid request still needs a durable payment row so an
    // operator can move it to pending_confirmation and issue checkout after
    // review. It simply does not expose/create the provider order until then.
    const paymentRequired = effectivePaymentRequired;

    // Resolve idempotent replays before consultation account provisioning or
    // any other irreversible side effect. The stored booking fingerprint is
    // checked by the helper so a reused key cannot alter the original intent.
    try {
        const replay = await loadIdempotentBookingSubmission({
            supabase,
            workspaceId: service.workspace_id,
            serviceId: service.id,
            idempotencyKey,
            submissionFingerprint,
            paymentExpected: paymentRequired,
            expected: {
                customerEmail: normalizedCustomerEmail,
                scheduledStart: payload.scheduledStart,
                resourceId: payload.resourceId ?? null,
                locationId: payload.locationId ?? null,
                partySize: payload.partySize,
            },
        });
        if (replay.found) {
            if (replay.result) return { data: replay.result, error: null };
            if (replay.paymentPending) {
                await retryPendingPayPalCheckout({
                    supabase,
                    workspaceId: service.workspace_id,
                    reservationId: replay.reservationId,
                });
                const retried = await loadIdempotentBookingSubmission({
                    supabase,
                    workspaceId: service.workspace_id,
                    serviceId: service.id,
                    idempotencyKey,
                    submissionFingerprint,
                    paymentExpected: paymentRequired,
                    expected: {
                        customerEmail: normalizedCustomerEmail,
                        scheduledStart: payload.scheduledStart,
                        resourceId: payload.resourceId ?? null,
                        locationId: payload.locationId ?? null,
                        partySize: payload.partySize,
                    },
                });
                if (retried.found && retried.result) return { data: retried.result, error: null };
                return { data: null, error: "This reservation request is still being processed. Please try again shortly." };
            } else if (replay.paymentMissing && await recoverStaleIdempotentReservationWithoutPayment({
                supabase,
                workspaceId: service.workspace_id,
                reservationId: replay.reservationId,
            })) {
                // Continue after a crashed, stale reservation was reclaimed.
            } else {
                return { data: null, error: "This reservation request is still being processed. Please try again shortly." };
            }
        }
    } catch (replayError) {
        console.error("[booking] idempotency lookup failed", replayError);
        return { data: null, error: "Could not verify the reservation request. Please try again." };
    }

    // Apply the optional business rule only after an idempotent replay has
    // been returned. Otherwise a retry of the same active reservation would
    // be rejected as a duplicate before it could recover its payment URL.
    const duplicateReservationRule = ruleRows.find((row) => row.rule_key === "single_active_reservation_per_email" && (!row.service_id || row.service_id === service.id));
    if (duplicateReservationRule) {
        const { data: existingReservations } = await supabase
            .from("booking_reservations")
            .select("id")
            .eq("workspace_id", service.workspace_id)
            .eq("service_id", service.id)
            .eq("customer_email", payload.customer.email.toLowerCase())
            .in("status", ACTIVE_RESERVATION_STATUSES)
            .limit(1);

        if ((existingReservations ?? []).length > 0) {
            return { data: null, error: "An active reservation already exists for this email and service." };
        }
    }

    // Account provisioning is deliberately deferred until after every
    // deterministic booking/payment/provider check and a reservation row has
    // been claimed. A malformed request must never create an invite or portal
    // client that is not attached to a booking.
    let provisionedClientLink: BookingProvisionedClientLink | null = null;

    const paymentProvider = effectivePaymentProvider;
    const netAmountCents = service.price_amount_cents ?? 0;
    const vatRateBasisPoints = service.vat_rate_basis_points ?? 0;
    const priceSnapshot = calculateBookingPrice({ amountCents: netAmountCents, vatRateBasisPoints });
    const meetingProvider = resolveBookingMeetingProvider(service.virtual_meeting_provider);
    const meetingAutoCreate = service.auto_create_virtual_meeting !== false;
    const { data: activeGoogleConnections, error: googleConnectionError } = meetingProvider === "google_meet"
        ? await getServiceRoleClient()
            .from("workspace_calendar_connections" as never)
            .select("id" as never)
            .eq("workspace_id" as never, service.workspace_id as never)
            .eq("provider" as never, "google" as never)
            .eq("sync_enabled" as never, true as never)
            .limit(1) as unknown as { data: Array<{ id: string }> | null; error: { message: string } | null }
        : { data: null, error: null };
    if (googleConnectionError) {
        return { data: null, error: "Meeting-provider readiness could not be verified. Please try again later." };
    }
    const meetingSetup = evaluateMeetingProviderSetup({
        provider: meetingProvider,
        durationMinutes: effectiveDurationMinutes,
        autoCreate: meetingAutoCreate,
        googleCalendarConnected: Boolean(activeGoogleConnections?.length),
        zoomConfigured: isZoomConfigured(),
    });
    if (!meetingSetup.bookingAllowed) {
        return { data: null, error: meetingSetup.error ?? "This meeting provider cannot support the selected service." };
    }
    const shouldProvisionBeforeAutoConfirmation = baseInitialStatus === "confirmed"
        && meetingProvider !== "none"
        && meetingAutoCreate;
    const initialStatus = stageReservationStatusForMeeting(baseInitialStatus, meetingProvider) as BookingReservationRow["status"];
    if (paymentRequired) {
        if (!hasFullPaymentWindowBeforeAppointment(scheduledStart, nowMs)) {
            return { data: null, error: `This slot is too soon for the required ${BOOKING_PAYMENT_COMPLETION_WINDOW_MINUTES / 60}-hour payment window. Please choose a later slot.` };
        }
        if (!netAmountCents || netAmountCents <= 0) {
            return { data: null, error: "This service is marked as paid but has no price configured." };
        }
        if (paymentProvider === "manual_revolut_pro" && !normalizePublicHttpUrl(service.payment_url)) {
            return { data: null, error: "This service is marked as paid but has no payment link configured." };
        }
    }

    const paymentDeadlineAt = paymentRequired ? getBookingPaymentDeadlineAt(nowMs) : null;
    const submissionLeaseId = randomUUID();
    const submissionLeaseExpiresAt = new Date(nowMs + 10 * 60_000).toISOString();

    const reservationPayload: TablesInsert<"booking_reservations"> = {
        // Empty string triggers the set_booking_public_reference_trigger to
        // generate the human-facing reference via booking_build_public_reference().
        public_reference: "",
        idempotency_key: idempotencyKey,
        submission_fingerprint: submissionFingerprint,
        submission_lease_id: submissionLeaseId,
        submission_lease_expires_at: submissionLeaseExpiresAt,
        workspace_id: service.workspace_id,
        template_profile_id: service.template_profile_id,
        service_id: service.id,
        resource_id: payload.resourceId ?? null,
        location_id: payload.locationId ?? null,
        form_definition_id: formDefinition?.id ?? null,
        portal_client_id: null,
        customer_full_name: payload.customer.fullName,
        customer_email: normalizedCustomerEmail,
        customer_phone: payload.customer.phone ?? null,
        party_size: payload.partySize,
        capacity_mode_snapshot: service.capacity_mode,
        capacity_value_snapshot: Math.max(1, service.capacity_value ?? 1),
        reservation_timezone: payload.reservationTimezone,
        business_timezone: businessTimezone,
        scheduled_start: scheduledStart.toISOString(),
        scheduled_end: scheduledEnd.toISOString(),
        status: initialStatus,
        source_channel: payload.attribution.sourceChannel ?? getBookingTemplateAdapter(profile.template_key).analyticsMapping.defaultSourceChannel,
        source_campaign: payload.attribution.sourceCampaign ?? null,
        source_referrer: payload.attribution.sourceReferrer ?? null,
        attribution_json: asJson({
            ...payload.attribution.metadata,
            // Persist only the server-normalized locale. Payment return and
            // cancel handlers use this trusted reservation attribution rather
            // than allowing a later query-string value to change the route.
            locale: bookingLocale,
            customerEmail: normalizedCustomerEmail,
        }),
        notes_internal: null,
        notes_customer: typeof payload.intakePayload.notes === "string" ? payload.intakePayload.notes : null,
        requires_manual_review: initialStatus === "pending_review",
        manual_review_reason: initialStatus === "pending_review"
            ? antiAbuseForcesReview
                ? `Anti-abuse review required: ${antiAbuse.reasons.join(", ")}.`
                : shouldProvisionBeforeAutoConfirmation
                    ? meetingSetup.autoConfirmationAllowed
                        ? "Automatic confirmation is waiting for a ready customer meeting link."
                        : "Meeting provider setup is incomplete; operator confirmation is required."
                    : "Manual review required by booking rules or template policy."
            : null,
        metadata: asJson({
            templateKey: profile.template_key,
            workspaceSlug: workspace.slug,
            accountCreationConsentGranted: payload.consents.accountCreationApproved === true,
            provisionedProfileId: null,
            provisionedPortalClientId: null,
            antiAbuse: {
                decision: antiAbuse.decision,
                riskLevel: antiAbuse.riskLevel,
                riskScore: antiAbuse.riskScore,
                reasons: antiAbuse.reasons,
                dwellTimeMs: antiAbuse.dwellTimeMs,
            },
            paymentExtensionState: paymentRequired ? "payment_requested" : "not_configured",
            calendarExtensionState: "not_configured",
            paymentProvider: paymentRequired ? paymentProvider : null,
            paymentAmountCents: paymentRequired ? priceSnapshot.grossAmountCents : null,
            paymentNetAmountCents: paymentRequired ? priceSnapshot.netAmountCents : null,
            paymentVatAmountCents: paymentRequired ? priceSnapshot.vatAmountCents : null,
            paymentVatRateBasisPoints: paymentRequired ? priceSnapshot.vatRateBasisPoints : null,
            meetingProvider,
            automaticConfirmationPending: shouldProvisionBeforeAutoConfirmation
                && meetingSetup.autoConfirmationAllowed
                && !antiAbuseForcesReview,
            paymentCurrency: paymentRequired ? effectivePaymentCurrency : null,
            // Keep the trusted privacy acknowledgement on the reservation
            // itself as well as in the intake row. This preserves the legal
            // acceptance snapshot if an auxiliary intake write is retried.
            privacyConsent: privacyConsentSnapshot,
        }),
        extension_state_json: asJson({
            payment: paymentRequired ? "payment_requested" : "not_configured",
            calendar: "not_configured",
        }),
        payment_deadline_at: paymentDeadlineAt ? paymentDeadlineAt.toISOString() : null,
    };

    const { data: reservation, error: reservationError } = await supabase
        .from("booking_reservations")
        .insert(reservationPayload)
        .select("id, public_reference, status")
        .single();

    if (reservationError || !reservation) {
        if (reservationError?.code === "23505") {
            try {
                const replay = await loadIdempotentBookingSubmission({
                    supabase,
                    workspaceId: service.workspace_id,
                    serviceId: service.id,
                    idempotencyKey,
                    submissionFingerprint,
                    paymentExpected: paymentRequired,
                    expected: {
                        customerEmail: normalizedCustomerEmail,
                        scheduledStart: payload.scheduledStart,
                        resourceId: payload.resourceId ?? null,
                        locationId: payload.locationId ?? null,
                        partySize: payload.partySize,
                    },
                });
                if (replay.found) {
                    if (replay.result) return { data: replay.result, error: null };
                    if (replay.paymentPending) {
                        await retryPendingPayPalCheckout({
                            supabase,
                            workspaceId: service.workspace_id,
                            reservationId: replay.reservationId,
                        });
                        const retried = await loadIdempotentBookingSubmission({
                            supabase,
                            workspaceId: service.workspace_id,
                            serviceId: service.id,
                            idempotencyKey,
                            submissionFingerprint,
                            paymentExpected: paymentRequired,
                            expected: {
                                customerEmail: normalizedCustomerEmail,
                                scheduledStart: payload.scheduledStart,
                                resourceId: payload.resourceId ?? null,
                                locationId: payload.locationId ?? null,
                                partySize: payload.partySize,
                            },
                        });
                        if (retried.found && retried.result) return { data: retried.result, error: null };
                    }
                    return { data: null, error: "This reservation request is still being processed. Please try again shortly." };
                }
            } catch (replayError) {
                console.error("[booking] idempotency replay lookup failed", replayError);
            }
        }
        if (reservationError?.code === "23P01") {
            return { data: null, error: "This slot is no longer available. Please choose another time." };
        }
        console.error("[booking] reservation insert failed", reservationError);
        return { data: null, error: "Could not create the reservation. Please try again." };
    }

    try {
        await recordBookingBusinessEvent({
            supabase: getServiceRoleClient(),
            workspaceId: service.workspace_id,
            reservationId: reservation.id,
            status: reservation.status,
            customerName: payload.customer.fullName,
            customerEmail: normalizedCustomerEmail,
            customerPhone: payload.customer.phone ?? null,
            portalClientId: null,
            scheduledStart: scheduledStart.toISOString(),
            source: "public_flow",
        });
    } catch (error) {
        console.warn("[booking] business spine event failed", error instanceof Error ? error.message : error);
    }

    const analyticsMetadata = {
        templateKey: profile.template_key,
        serviceKey: service.service_key,
        serviceId: service.id,
        resourceType: resource?.resource_type ?? null,
        locationType: location?.location_type ?? null,
        sourceChannel: payload.attribution.sourceChannel ?? null,
        sourceCampaign: payload.attribution.sourceCampaign ?? null,
        selectedSlot: scheduledStart.toISOString(),
        locale: typeof payload.attribution.metadata.locale === "string" ? payload.attribution.metadata.locale : null,
        accountCreationApproved: payload.consents.accountCreationApproved === true,
        profileId: null,
        portalClientId: null,
    };

    await Promise.all([
        supabase.from("booking_reservation_intake").insert({
            workspace_id: service.workspace_id,
            reservation_id: reservation.id,
            form_definition_id: formDefinition?.id ?? null,
            submitted_payload_json: asJson(payload.intakePayload),
            normalized_payload_json: asJson(payload.intakePayload),
            consent_flags_json: asJson({
                ...payload.consents,
                privacy: privacyConsentSnapshot,
            }),
        }),
        supabase.from("booking_status_history").insert({
            workspace_id: service.workspace_id,
            reservation_id: reservation.id,
            from_status: null,
            to_status: reservation.status,
            trigger_source: "public_flow",
            actor_type: "anonymous",
            actor_id: null,
            reason: "Reservation submitted via public booking flow.",
            payload_json: asJson(analyticsMetadata),
        }),
        supabase.from("booking_notification_events").insert({
            workspace_id: service.workspace_id,
            reservation_id: reservation.id,
            event_type: initialStatus === "pending_review" ? "reservation_pending_review" : "reservation_created",
            // No email dispatcher is wired yet; until then every event is an
            // internal-dashboard signal so the audit trail stays consistent
            // with transitionBookingReservationStatus / markBookingPaymentVerified.
            // When email sending is added, insert an additional 'email' row
            // alongside the dashboard signal rather than overloading this one.
            channel: "internal_dashboard",
            delivery_status: "pending",
            payload_json: asJson({
                ...analyticsMetadata,
                customerEmail: normalizedCustomerEmail,
                emailDispatchRequired: true,
            }),
        }),
        recordBookingAnalyticsEvent({
            supabase,
            workspaceId: service.workspace_id,
            eventType: "booking_reserved",
            reservationId: reservation.id,
            serviceId: service.id,
            templateKey: profile.template_key,
            sourceChannel: payload.attribution.sourceChannel ?? getBookingTemplateAdapter(profile.template_key).analyticsMapping.defaultSourceChannel,
            sourceCampaign: payload.attribution.sourceCampaign ?? null,
            sourceReferrer: payload.attribution.sourceReferrer ?? null,
            selectedSlot: scheduledStart.toISOString(),
            locale: typeof payload.attribution.metadata.locale === "string" ? payload.attribution.metadata.locale : null,
            attribution: normalizeJsonRecord(payload.attribution.metadata),
            extra: {
                publicReference: reservation.public_reference,
                initialStatus: reservation.status,
                reservationTimezone: payload.reservationTimezone,
            },
        }),
        persistAntiAbuseEvent({
            supabaseAdmin: supabase,
            assessment: antiAbuse,
            input: antiAbuseInput,
            bookingReservationId: reservation.id,
            portalClientId: null,
        }),
    ]);

    if (payload.consents.marketing === true) {
        try {
            await subscribeNewsletterContact({
                email: normalizedCustomerEmail,
                workspaceId: service.workspace_id,
                source: "booking_public_flow",
                firstName: payload.customer.fullName.split(/\s+/)[0] ?? null,
                metadata: {
                    sourceSurface: "booking",
                    reservationId: reservation.id,
                    publicReference: reservation.public_reference,
                    serviceId: service.id,
                    serviceKey: service.service_key,
                    sourceChannel: payload.attribution.sourceChannel ?? null,
                    sourceCampaign: payload.attribution.sourceCampaign ?? null,
                    sourceReferrer: payload.attribution.sourceReferrer ?? null,
                    ...normalizeJsonRecord(payload.attribution.metadata),
                },
            });
        } catch (newsletterError) {
            console.error("[booking] Newsletter nurture enrollment failed:", newsletterError);
        }
    }

    let paymentDirective: BookingPaymentDirective | null = null;
    let meetingState: "not_configured" | "pending" | "ready" | "failed" = "not_configured";
    let finalReservationStatus = reservation.status;

    if (paymentRequired && paymentDeadlineAt && netAmountCents) {
        const customerInstructions = paymentProvider === "manual_revolut_pro"
            ? buildPaymentInstructions(service.payment_instructions, reservation.public_reference)
            : (service.payment_instructions ?? "Complete payment through PayPal checkout to confirm your booking.");
        const paymentUrl = paymentProvider === "manual_revolut_pro" ? normalizePublicHttpUrl(service.payment_url) : null;

        const { data: payment, error: paymentInsertError } = await supabase
            .from("booking_payments")
            .insert({
                workspace_id: service.workspace_id,
                reservation_id: reservation.id,
                provider: paymentProvider,
                status: "requested",
                amount_cents: priceSnapshot.grossAmountCents,
                net_amount_cents: priceSnapshot.netAmountCents,
                vat_rate_basis_points: priceSnapshot.vatRateBasisPoints,
                vat_amount_cents: priceSnapshot.vatAmountCents,
                gross_amount_cents: priceSnapshot.grossAmountCents,
                pricing_version: priceSnapshot.pricingVersion,
                currency: effectivePaymentCurrency,
                payment_url: paymentUrl,
                payment_reference: reservation.public_reference,
                customer_instructions: customerInstructions,
                deadline_at: paymentDeadlineAt.toISOString(),
                metadata: asJson({
                    serviceId: service.id,
                    serviceTitle: service.title,
                    customerEmail: normalizedCustomerEmail,
                    provider: paymentProvider,
                    locale: bookingLocale,
                    pricingSnapshot: priceSnapshot,
                }),
            })
            .select("id, metadata")
            .single();

        if (paymentInsertError || !payment) {
            // Roll back the held slot so the customer is not stuck mid-flow with
            // an unrecorded payment requirement.
            await supabase
                .from("booking_reservations")
                .delete()
                .eq("id", reservation.id)
                .eq("workspace_id", service.workspace_id);
            return { data: null, error: "Could not initialize the payment record. Please try again." };
        }

        let finalPaymentUrl = paymentUrl;

        if (paymentProvider === "paypal_checkout" && initialStatus !== "pending_review") {
            let paypalOrder: Awaited<ReturnType<typeof createPayPalOrder>> | null = null;
            const linkPayPalOrder = async (order: Awaited<ReturnType<typeof createPayPalOrder>>, retry: boolean) => {
                const { data: currentPayment, error: currentPaymentError } = await supabase
                    .from("booking_payments")
                    .select("status,paypal_status,paypal_order_id,payment_url,metadata")
                    .eq("id", payment.id)
                    .eq("workspace_id", service.workspace_id)
                    .eq("reservation_id", reservation.id)
                    .maybeSingle();
                if (currentPaymentError) throw new Error(currentPaymentError.message);
                const activeProviderStatuses = ["CREATED", "PAYER_ACTION_REQUIRED", "APPROVED", "RETURN_CAPTURE_FAILED"];
                if (!currentPayment
                    || currentPayment.status !== "requested"
                    || (currentPayment.paypal_order_id && currentPayment.paypal_order_id !== order.id)
                    || (currentPayment.paypal_status && !activeProviderStatuses.includes(currentPayment.paypal_status))) {
                    return false;
                }

                const resultingProviderStatus = currentPayment.paypal_status ?? order.status;
                const resultingPaymentUrl = currentPayment.payment_url ?? order.approvalUrl;
                const linkedMetadata = normalizeJsonRecord(appendPayPalOrderHistory(currentPayment.metadata, order.id, `booking-order-${payment.id}`));
                const metadata = {
                    ...linkedMetadata,
                    paypalOrderStatus: resultingProviderStatus,
                    paypalCreateRaw: order.raw,
                    ...(retry ? {
                        paypalLinkRetry: true,
                        paypalRetryReconciled: true,
                        paypalRetryPending: false,
                        paypalRetryNextAt: null,
                        paypalRetryLastError: null,
                    } : {}),
                };
                let linkQuery = supabase
                    .from("booking_payments")
                    .update({
                        payment_url: resultingPaymentUrl,
                        paypal_order_id: order.id,
                        paypal_status: resultingProviderStatus,
                        provider_synced_at: new Date().toISOString(),
                        metadata: asJson(metadata),
                    })
                    .eq("id", payment.id)
                    .eq("workspace_id", service.workspace_id)
                    .eq("reservation_id", reservation.id)
                    .eq("status", "requested");
                linkQuery = currentPayment.paypal_order_id
                    ? linkQuery.eq("paypal_order_id", currentPayment.paypal_order_id)
                    : linkQuery.is("paypal_order_id", null);
                linkQuery = currentPayment.paypal_status
                    ? linkQuery.eq("paypal_status", currentPayment.paypal_status)
                    : linkQuery.is("paypal_status", null);
                const { data: linkedPayment, error: paymentUpdateError } = await linkQuery
                    .select("id")
                    .maybeSingle();
                if (paymentUpdateError) throw new Error(paymentUpdateError.message);
                return Boolean(linkedPayment);
            };
            try {
                const localeQuery = `&locale=${encodeURIComponent(bookingLocale)}`;
                const returnUrl = buildSiteUrl(`/api/payments/paypal/return?payment_id=${encodeURIComponent(payment.id)}${localeQuery}`);
                const cancelUrl = buildSiteUrl(`/api/payments/paypal/cancel?payment_id=${encodeURIComponent(payment.id)}${localeQuery}`);
                paypalOrder = await createPayPalOrder({
                    amountCents: priceSnapshot.grossAmountCents,
                    netAmountCents: priceSnapshot.netAmountCents,
                    vatAmountCents: priceSnapshot.vatAmountCents,
                    vatRateBasisPoints: priceSnapshot.vatRateBasisPoints,
                    grossAmountCents: priceSnapshot.grossAmountCents,
                    pricingVersion: priceSnapshot.pricingVersion,
                    currency: effectivePaymentCurrency,
                    paymentReference: reservation.public_reference,
                    returnUrl,
                    cancelUrl,
                    description: service.title,
                    brandName: workspace.name,
                    requestId: `booking-order-${payment.id}`,
                    customId: payment.id,
                    invoiceId: reservation.public_reference,
                });

                finalPaymentUrl = paypalOrder.approvalUrl;
                if (!await linkPayPalOrder(paypalOrder, false)) {
                    throw new Error("PayPal payment state changed before the provider order could be linked.");
                }
            } catch (error) {
                // PayPal has no reliable pre-capture cancel operation for an
                // unapproved order. Never delete the local payment/reservation
                // after a provider order may have been created: the webhook
                // can still identify it by custom_id=payment.id and reconcile
                // the capture instead of leaving an untracked charge.
                if (paypalOrder) {
                    try {
                        const relinked = await linkPayPalOrder(paypalOrder, true);
                        if (!relinked) console.error("[booking] PayPal order created but could not be linked locally");
                    } catch (relinkError) {
                        console.error("[booking] PayPal order created but could not be linked locally", relinkError);
                    }
                } else {
                    console.error("[booking] PayPal order initialization failed before local linkage", error);
                }
                return {
                    data: null,
                    error: "PayPal checkout could not be initialized. Your reservation is being held safely; please try again shortly or contact support.",
                };
            }
        }

        if (initialStatus !== "pending_review") {
            paymentDirective = {
                provider: paymentProvider,
                amountCents: priceSnapshot.grossAmountCents,
                netAmountCents: priceSnapshot.netAmountCents,
                vatRateBasisPoints: priceSnapshot.vatRateBasisPoints,
                vatAmountCents: priceSnapshot.vatAmountCents,
                grossAmountCents: priceSnapshot.grossAmountCents,
                pricingVersion: priceSnapshot.pricingVersion,
                currency: effectivePaymentCurrency,
                paymentUrl: finalPaymentUrl ?? "",
                paymentReference: reservation.public_reference,
                customerInstructions,
                deadlineAt: paymentDeadlineAt.toISOString(),
            };
        }
    }

    if (isConsultationBooking && payload.consents.accountCreationApproved === true) {
        try {
            const serviceRole = getServiceRoleClient();
            provisionedClientLink = await provisionConsultationPortalClient({
                supabaseAdmin: serviceRole,
                workspaceId: service.workspace_id,
                customer: payload.customer,
                intakePayload: normalizeJsonRecord(payload.intakePayload),
            });
            const provisionedMetadata = {
                ...normalizeJsonRecord(reservationPayload.metadata),
                provisionedProfileId: provisionedClientLink.profileId,
                provisionedPortalClientId: provisionedClientLink.portalClientId,
                provisioningPending: false,
                provisioningError: null,
            } as Json;
            const { error: linkError } = await serviceRole
                .from("booking_reservations")
                .update({
                    portal_client_id: provisionedClientLink.portalClientId,
                    metadata: provisionedMetadata,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", reservation.id)
                .eq("workspace_id", service.workspace_id);
            if (linkError) {
                console.error("[booking] consultation portal link could not be persisted", linkError);
                provisionedClientLink = null;
                await serviceRole
                    .from("booking_reservations")
                    .update({
                        metadata: asJson({
                            ...normalizeJsonRecord(reservationPayload.metadata),
                            provisioningPending: true,
                            provisioningError: linkError.message.slice(0, 500),
                        }),
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", reservation.id)
                    .eq("workspace_id", service.workspace_id);
            }
        } catch (error) {
            // The booking remains valid; account creation is an explicitly
            // consented convenience and can be retried by an operator without
            // losing the commercial reservation.
            const message = error instanceof Error ? error.message : "Consultation account provisioning failed.";
            await getServiceRoleClient()
                .from("booking_reservations")
                .update({
                    metadata: asJson({
                        ...normalizeJsonRecord(reservationPayload.metadata),
                        provisioningPending: true,
                        provisioningError: message.slice(0, 500),
                    }),
                    updated_at: new Date().toISOString(),
                })
                .eq("id", reservation.id)
                .eq("workspace_id", service.workspace_id);
            console.warn("[booking] consultation account provisioning deferred", message);
        }
    }

    // Release the submission lease only after the one-payment row (and any
    // PayPal provider linkage) is durable. If the process dies before this
    // point, a later same-key request can safely reclaim the expired lease.
    await supabase
        .from("booking_reservations")
        .update({ submission_lease_id: null, submission_lease_expires_at: null, updated_at: new Date().toISOString() })
        .eq("id", reservation.id)
        .eq("workspace_id", service.workspace_id)
        .eq("submission_lease_id", submissionLeaseId);

    if (shouldProvisionBeforeAutoConfirmation) {
        const serviceRole = getServiceRoleClient();
        const confirmation = await provisionAndConfirmReservation({
            provider: meetingProvider,
            provisionMeeting: () => ensureBookingMeeting(serviceRole, reservation.id),
            commitConfirmation: async () => {
                const { data: confirmedReservation, error: confirmationError } = await serviceRole
                    .from("booking_reservations")
                    .update({
                        status: "confirmed",
                        requires_manual_review: false,
                        manual_review_reason: null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", reservation.id)
                    .eq("workspace_id", service.workspace_id)
                    .eq("status", "pending_review")
                    .select("id")
                    .maybeSingle();
                if (confirmationError) throw new Error(confirmationError.message);
                return Boolean(confirmedReservation);
            },
        });
        meetingState = confirmation.meetingStatus === "ready"
            || confirmation.meetingStatus === "pending"
            || confirmation.meetingStatus === "failed"
            ? confirmation.meetingStatus
            : "not_configured";
        if (confirmation.confirmed) {
            finalReservationStatus = "confirmed";
            const confirmedAt = new Date().toISOString();
            await Promise.all([
                serviceRole.from("booking_status_history").insert({
                    workspace_id: service.workspace_id,
                    reservation_id: reservation.id,
                    from_status: "pending_review",
                    to_status: "confirmed",
                    trigger_source: "system",
                    actor_type: "system",
                    actor_id: null,
                    reason: "Meeting provider created a customer-safe room before automatic confirmation.",
                    payload_json: asJson({ provider: meetingProvider, joinUrlReady: true }),
                }),
                serviceRole.from("booking_notification_events").insert({
                    workspace_id: service.workspace_id,
                    reservation_id: reservation.id,
                    event_type: "reservation_confirmed",
                    channel: "internal_dashboard",
                    delivery_status: "pending",
                    payload_json: asJson({
                        provider: meetingProvider,
                        confirmedAt,
                        emailDispatchRequired: true,
                    }),
                }),
                recordBookingAnalyticsEvent({
                    supabase: serviceRole,
                    workspaceId: service.workspace_id,
                    eventType: "booking_confirmed",
                    reservationId: reservation.id,
                    serviceId: service.id,
                    templateKey: profile.template_key,
                    sourceChannel: payload.attribution.sourceChannel ?? getBookingTemplateAdapter(profile.template_key).analyticsMapping.defaultSourceChannel,
                    sourceCampaign: payload.attribution.sourceCampaign ?? null,
                    sourceReferrer: payload.attribution.sourceReferrer ?? null,
                    selectedSlot: scheduledStart.toISOString(),
                    locale: bookingLocale,
                    attribution: normalizeJsonRecord(payload.attribution.metadata),
                    extra: { provider: meetingProvider, confirmationPrerequisite: "meeting_ready" },
                }),
            ]);
            try {
                await recordBookingBusinessEvent({
                    supabase: serviceRole,
                    workspaceId: service.workspace_id,
                    reservationId: reservation.id,
                    status: "confirmed",
                    customerName: payload.customer.fullName,
                    customerEmail: normalizedCustomerEmail,
                    customerPhone: payload.customer.phone ?? null,
                    portalClientId: provisionedClientLink?.portalClientId ?? null,
                    scheduledStart: scheduledStart.toISOString(),
                    source: "public_flow",
                });
            } catch (error) {
                console.warn("[booking] confirmed meeting lifecycle event failed", error instanceof Error ? error.message : error);
            }
        } else {
            console.warn("[booking] reservation remains pending until meeting provisioning succeeds", confirmation.reason);
        }
    }

    if (provisionedClientLink?.createdPortalClient) {
        revalidatePath("/dashboard/clients");
        revalidatePath("/dashboard/slas");
    }

    // Fire booking emails best-effort. For paid services, this must happen
    // AFTER the booking_payments row exists so the first customer email is a
    // payment request, not a confirmation-shaped reservation_created message.
    const bookingEmailEvent = paymentDirective
        ? "payment_requested" as const
        : finalReservationStatus === "pending_review"
            ? "reservation_pending_review" as const
            : finalReservationStatus === "confirmed"
                ? "reservation_confirmed" as const
                : "reservation_created" as const;
    await dispatchBookingEmails({
        supabase,
        workspaceId: service.workspace_id,
        reservationId: reservation.id,
        eventType: bookingEmailEvent,
    });

    const consultationAccountProvisioned = Boolean(isConsultationBooking && provisionedClientLink);
    if (consultationAccountProvisioned && provisionedClientLink) {
        const attributionMetadata = normalizeJsonRecord(payload.attribution.metadata);
        const locale = normalizeEmailLocale(
            typeof attributionMetadata.locale === "string" ? attributionMetadata.locale : null,
        );
        const portalPlan = getPortalActivationPlan({
            authUserCreated: provisionedClientLink.createdAuthUser,
            locale,
        });
        const portalUrl = provisionedClientLink.activationUrl || buildSiteUrl("/portal");
        const portalLabel = locale === "nl"
            ? (portalPlan.requiresOneTimeLink ? "Activeer uw portaalaccount" : "Open uw klantportaal")
            : locale === "ar"
                ? (portalPlan.requiresOneTimeLink ? "فعّل حساب البوابة" : "افتح بوابة العميل")
                : (portalPlan.requiresOneTimeLink ? "Activate your portal account" : "Open your client portal");
        const portalSubject = locale === "nl"
            ? "Uw klantportaal is klaar"
            : locale === "ar"
                ? "بوابة العميل جاهزة"
                : "Your client portal is ready";
        const portalBody = locale === "nl"
            ? (portalPlan.requiresOneTimeLink
                ? "Gebruik deze veilige eenmalige link om uw wachtwoord te kiezen en toegang te krijgen tot uw consultatiewerkruimte."
                : "Uw boeking is gekoppeld aan uw bestaande account.")
            : locale === "ar"
                ? (portalPlan.requiresOneTimeLink
                    ? "استخدم هذا الرابط الآمن لمرة واحدة لاختيار كلمة المرور والوصول إلى مساحة الاستشارة."
                    : "تم ربط حجزك بحسابك الحالي.")
                : (portalPlan.requiresOneTimeLink
                    ? "Use this secure one-time link to choose your password and access your consultation workspace."
                    : "Your booking is linked to your existing account.");
        const fromEmail = process.env.BOOKING_FROM_EMAIL?.trim()
            || process.env.NEWSLETTER_FROM_EMAIL?.trim();
        if (!fromEmail) {
            throw new Error("Booking email sender is not configured.");
        }
        await enqueueTransactionalEmail({
            workspaceId: service.workspace_id,
            aggregateType: "booking_reservation",
            aggregateId: reservation.id,
            eventType: portalPlan.event,
            recipientRole: "user",
            recipientEmail: input.customer.email,
            locale,
            fromEmail,
            replyToEmail: process.env.BOOKING_REPLY_TO_EMAIL?.trim() || process.env.NEWSLETTER_REPLY_TO_EMAIL?.trim(),
            subject: portalSubject,
            html: `<!doctype html><html lang="${locale}"><body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;"><table role="presentation" width="560" align="center" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;"><tr><td style="padding:28px;" dir="${locale === "ar" ? "rtl" : "ltr"}"><h1 style="margin:0 0 16px;font-size:22px;">${portalSubject}</h1><p style="margin:0 0 20px;line-height:1.6;color:#334155;">${portalBody}</p><a href="${portalUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}" style="display:inline-block;padding:11px 18px;border-radius:10px;background:#0f172a;color:#fff;text-decoration:none;font-weight:700;">${portalLabel}</a></td></tr></table></body></html>`,
            idempotencyKey: `booking:${reservation.id}:${portalPlan.event}`,
            payload: { portalClientId: provisionedClientLink.portalClientId },
        });
    }

    const nextStepsKind = deriveNextStepsKind(finalReservationStatus, paymentDirective);
    const nextSteps = buildNextStepsFallback(nextStepsKind, paymentDirective);
    if (consultationAccountProvisioned) {
        nextSteps.push("A client account has been linked to this email so the workspace can continue consultation follow-up through client management workflows.");
    }

    return {
        data: {
            reservationId: reservation.id,
            publicReference: reservation.public_reference,
            status: finalReservationStatus,
            nextSteps,
            nextStepsKind,
            consultationAccountProvisioned,
            notificationState: {
                queued: true,
                eventType: bookingEmailEvent,
            },
            calendarExtensionState: meetingState,
            paymentExtensionState: paymentDirective ? "payment_requested" : "not_configured",
            payment: paymentDirective,
        },
        error: null,
    };
}

/** Retry a consented consultation's portal-account linkage after a transient
 * auth/portal/database failure. Provisioning is idempotent by email/profile/
 * portal membership, so this repair cannot create a duplicate invite or
 * customer record.
 */
export async function retryConsultationPortalProvisioning(reservationId: string) {
    const parsed = z.string().uuid().safeParse(reservationId);
    if (!parsed.success) return { data: null, error: "Invalid reservation ID." };
    const context = await requireBookingManagementContext("booking.manage");
    const supabase = getServiceRoleClient();
    const { data: reservation, error: reservationError } = await supabase
        .from("booking_reservations")
        .select("id,workspace_id,customer_full_name,customer_email,metadata")
        .eq("id", parsed.data)
        .eq("workspace_id", context.activeWorkspace.id)
        .maybeSingle();
    if (reservationError || !reservation) return { data: null, error: reservationError?.message ?? "Reservation not found." };

    const reservationMetadata = normalizeJsonRecord(reservation.metadata);
    if (reservationMetadata.accountCreationConsentGranted !== true) {
        return { data: null, error: "This consultation does not have explicit account-creation consent." };
    }
    if (typeof reservationMetadata.provisionedPortalClientId === "string" && reservationMetadata.provisionedPortalClientId.length > 0) {
        return { data: { portalClientId: reservationMetadata.provisionedPortalClientId, alreadyProvisioned: true }, error: null };
    }

    const { data: intake } = await supabase
        .from("booking_reservation_intake")
        .select("submitted_payload_json")
        .eq("workspace_id", reservation.workspace_id)
        .eq("reservation_id", reservation.id)
        .maybeSingle();
    try {
        const provisioned = await provisionConsultationPortalClient({
            supabaseAdmin: supabase,
            workspaceId: reservation.workspace_id,
            customer: { fullName: reservation.customer_full_name, email: reservation.customer_email },
            intakePayload: normalizeJsonRecord(intake?.submitted_payload_json),
        });
        const { error: updateError } = await supabase
            .from("booking_reservations")
            .update({
                portal_client_id: provisioned.portalClientId,
                metadata: asJson({
                    ...reservationMetadata,
                    provisionedProfileId: provisioned.profileId,
                    provisionedPortalClientId: provisioned.portalClientId,
                    provisioningPending: false,
                    provisioningError: null,
                    provisioningRetriedAt: new Date().toISOString(),
                }),
                updated_at: new Date().toISOString(),
            })
            .eq("id", reservation.id)
            .eq("workspace_id", reservation.workspace_id);
        if (updateError) return { data: null, error: updateError.message };
        revalidateBookingPaths();
        return { data: { portalClientId: provisioned.portalClientId, alreadyProvisioned: false }, error: null };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Consultation account provisioning failed.";
        await supabase
            .from("booking_reservations")
            .update({
                metadata: asJson({
                    ...reservationMetadata,
                    provisioningPending: true,
                    provisioningError: message.slice(0, 500),
                    provisioningRetriedAt: new Date().toISOString(),
                }),
                updated_at: new Date().toISOString(),
            })
            .eq("id", reservation.id)
            .eq("workspace_id", reservation.workspace_id);
        return { data: null, error: message };
    }
}

export async function getBookingPaymentsForReservation(reservationId: string) {
    const context = await requireBookingManagementContext();
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("booking_payments")
        .select("*")
        .eq("workspace_id", context.activeWorkspace.id)
        .eq("reservation_id", reservationId)
        .maybeSingle();

    if (error) {
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

export async function getBookingPaymentsOverview(filters?: { status?: "requested" | "verified" | "failed" | "expired" | "refunded"; limit?: number }) {
    const context = await requireBookingManagementContext();
    const supabase = await createClient();

    let query = supabase
        .from("booking_payments")
        .select("id,reservation_id,provider,status,amount_cents,currency,net_amount_cents,vat_rate_basis_points,vat_amount_cents,gross_amount_cents,pricing_version,payment_url,payment_reference,deadline_at,verified_at,verified_by,verified_note,created_at,updated_at,paypal_order_id,paypal_status")
        .eq("workspace_id", context.activeWorkspace.id)
        .order("created_at", { ascending: false })
        .limit(Math.min(Math.max(filters?.limit ?? 100, 1), 500));

    if (filters?.status) {
        query = query.eq("status", filters.status);
    }

    const { data, error } = await query;

    if (error) {
        return { data: null, error: error.message };
    }

    return { data: data ?? [], error: null };
}

export async function markBookingPaymentVerified(input: BookingMarkPaymentVerifiedInput) {
    const parsed = bookingMarkPaymentVerifiedSchema.safeParse(input);

    if (!parsed.success) {
        return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid payment verification payload." };
    }

    const context = await requireBookingManagementContext();
    const supabase = await createClient();
    const userId = await getAuthenticatedUserId();
    const workspaceId = context.activeWorkspace.id;

    try {
        const result = await verifyBookingPaymentAndMaybeConfirm({
            supabase,
            workspaceId,
            reservationId: parsed.data.reservationId,
            actorId: userId,
            actorType: "workspace_manager",
            triggerSource: "operator",
            note: parsed.data.note ?? null,
            autoConfirm: parsed.data.autoConfirm,
            verificationSource: "manual",
        });

        return { data: { reservationStatus: result.reservationStatus, paymentStatus: result.paymentStatus }, error: null };
    } catch (error) {
        return { data: null, error: error instanceof Error ? error.message : "Payment verification failed." };
    }
}

export async function confirmPaidBookingReservation(reservationId: string) {
    const context = await requireBookingManagementContext();
    const supabase = await createClient();
    const workspaceId = context.activeWorkspace.id;

    const { data: reservation, error: reservationError } = await supabase
        .from("booking_reservations")
        .select("id,status")
        .eq("id", reservationId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();

    if (reservationError || !reservation) {
        return { data: null, error: "Reservation not found." };
    }

    const { data: payment, error: paymentError } = await supabase
        .from("booking_payments")
        .select("status")
        .eq("reservation_id", reservation.id)
        .eq("workspace_id", workspaceId)
        .maybeSingle();

    if (paymentError) {
        return { data: null, error: paymentError.message };
    }

    if (payment && payment.status !== "verified") {
        return { data: null, error: "Cannot confirm: payment is not verified yet." };
    }

    return transitionBookingReservationStatus({
        reservationId,
        nextStatus: "confirmed",
        reason: payment ? "Payment verified; reservation confirmed." : "Reservation confirmed by operator.",
    });
}

export async function expireUnpaidBookingReservations(scope?: { workspaceScoped?: boolean }) {
    const context = await requireBookingManagementContext("booking.manage");
    const supabase = getServiceRoleClient();
    const workspaceScoped = scope?.workspaceScoped ?? true;
    if (!workspaceScoped && context.role !== "admin") {
        return { data: null, error: "Only an admin may run an unscoped booking expiry sweep." };
    }

    const sweepStartedAt = new Date().toISOString();
    const tsExpiryResult = await expireUnpaidBookingReservationsByPaymentWindow({
        supabase,
        workspaceId: workspaceScoped ? context.activeWorkspace.id : null,
    });

    if (tsExpiryResult.error) {
        return { data: null, error: tsExpiryResult.error };
    }

    const { data, error } = await supabase
        .rpc(
            "booking_expire_unpaid_reservations",
            workspaceScoped ? { p_workspace_id: context.activeWorkspace.id } : {},
        );

    if (error) {
        return { data: null, error: error.message };
    }

    // The SQL fallback intentionally owns only the reservation/payment CAS;
    // Business Spine writes live in application code. Re-read rows touched by
    // this sweep and feed them through the same idempotent recorder used by
    // interactive expiry, so an RPC-only expiry still emits one cancellation
    // timeline event and keeps lifecycle/payment linkage truthful.
    let recentExpiryQuery = supabase
        .from("booking_reservations")
        .select("id,workspace_id,booking_payments!booking_payments_workspace_reservation_fk ( id, status )")
        .eq("status", "expired")
        .gte("updated_at", sweepStartedAt)
        .limit(500);
    if (workspaceScoped) recentExpiryQuery = recentExpiryQuery.eq("workspace_id", context.activeWorkspace.id);
    const { data: recentlyExpired } = await recentExpiryQuery;
    for (const reservation of (recentlyExpired ?? []) as unknown as Array<{
        id: string;
        workspace_id: string;
        booking_payments: Array<{ id: string; status: string }> | { id: string; status: string } | null;
    }>) {
        const paymentRows = Array.isArray(reservation.booking_payments)
            ? reservation.booking_payments
            : reservation.booking_payments ? [reservation.booking_payments] : [];
        const payment = paymentRows[0] ?? null;
        await recordBookingBusinessEvent({
            supabase,
            workspaceId: reservation.workspace_id,
            reservationId: reservation.id,
            status: "expired",
            source: "payment",
            paymentStatus: payment?.status ?? "expired",
        });
        if (payment) {
            await recordPaymentBusinessEvent({
                supabase,
                workspaceId: reservation.workspace_id,
                paymentId: payment.id,
                bookingId: reservation.id,
                eventType: "failed",
                payload: { source: "booking_expire_unpaid_reservations_rpc" },
            });
        }
    }

    revalidateBookingPaths();
    return { data: { expiredCount: (data ?? 0) + tsExpiryResult.expiredCount }, error: null };
}

export async function expireBookingHoldManual(reservationId: string) {
    const context = await requireBookingManagementContext("booking.manage");
    const supabase = getServiceRoleClient();
    const workspaceId = context.activeWorkspace.id;
    const userId = await getAuthenticatedUserId();

    const { data: reservation, error: reservationError } = await supabase
        .from("booking_reservations")
        .select("id,status,metadata,extension_state_json")
        .eq("id", reservationId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();

    if (reservationError || !reservation) {
        return { data: null, error: "Reservation not found." };
    }

    if (reservation.status !== "pending_confirmation") {
        return { data: null, error: `Only holds in 'pending_confirmation' status can be expired. Current status is '${reservation.status}'.` };
    }

    const { data: payment, error: paymentError } = await supabase
        .from("booking_payments")
        .select("id, status, provider, paypal_status")
        .eq("reservation_id", reservationId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();

    if (paymentError) {
        return { data: null, error: paymentError.message };
    }
    if (payment && (payment.paypal_status === "COMPLETED"
        || payment.paypal_status === "CAPTURE_PENDING_RECONCILIATION"
        || payment.paypal_status === "CAPTURE_COMPLETED_PENDING_RECONCILIATION")) {
        return { data: null, error: "PayPal capture reconciliation is still in progress. Resolve the provider status before expiring this hold." };
    }
    if (payment && payment.status !== "requested") {
        return { data: null, error: "This hold already has a terminal payment state and cannot be expired." };
    }

    const nowIso = new Date().toISOString();
    const reason = "Hold manually expired by operator.";

    let paymentFence: BookingPaymentCancellationFence | null = null;
    try {
        paymentFence = await fenceBookingPaymentForCancellation({
            supabase: getServiceRoleClient(),
            workspaceId,
            reservationId,
            source: "operator",
            reason,
            terminalProviderStatus: "EXPIRED",
        });
    } catch (error) {
        return { data: null, error: error instanceof Error ? error.message : "Could not fence the payment before expiry." };
    }

    const { data: updatedReservation, error: updateError } = await supabase
        .from("booking_reservations")
        .update({
            status: "expired",
            updated_at: nowIso,
            metadata: mergeJsonRecord(reservation.metadata, {
                paymentExtensionState: "expired",
                paymentExpiredAt: nowIso,
                paymentExpiryReason: reason,
                manuallyExpiredBy: userId,
            }),
            extension_state_json: mergeJsonRecord(reservation.extension_state_json, {
                payment: "expired",
            }),
        })
        .eq("id", reservationId)
        .eq("workspace_id", workspaceId)
        .eq("status", "pending_confirmation")
        .select("id")
        .maybeSingle();

    if (updateError || !updatedReservation) {
        if (paymentFence) {
            await restoreBookingPaymentFenceAfterTransitionRace({
                supabase: getServiceRoleClient(),
                workspaceId,
                reservationId,
                fence: paymentFence,
            });
        }
        return { data: null, error: updateError?.message ?? "Failed to expire reservation." };
    }

    if (payment && payment.status === "requested") {
        const { data: expiredPayment } = await supabase
            .from("booking_payments")
            .update({
                status: "expired",
                payment_url: null,
                failure_reason: reason,
                updated_at: nowIso,
            })
            .eq("id", payment.id)
            .eq("workspace_id", workspaceId)
            .eq("status", "requested")
            .select("id")
            .maybeSingle();

        // If a provider capture won between the reservation CAS and the
        // payment CAS, leave the verified payment untouched and mark the
        // terminal-booking reconciliation explicitly for operators.
        if (!expiredPayment && (payment.provider === "paypal_checkout" || payment.provider === "paypal")) {
            const { data: latestPayment } = await supabase
                .from("booking_payments")
                .select("status,metadata")
                .eq("id", payment.id)
                .eq("workspace_id", workspaceId)
                .maybeSingle();
            if (latestPayment?.status === "verified") {
                await supabase
                    .from("booking_payments")
                    .update({
                        metadata: asJson({
                            ...normalizeJsonRecord(latestPayment.metadata),
                            lateCaptureNeedsReview: true,
                            paymentVerificationReservationStatus: "expired",
                        }),
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", payment.id)
                    .eq("workspace_id", workspaceId)
                    .eq("status", "verified");
                try {
                    await recordPaymentBusinessEvent({
                        supabase,
                        workspaceId,
                        eventType: "captured_after_terminal",
                        paymentId: payment.id,
                        bookingId: reservationId,
                        providerEventId: null,
                        payload: {
                            source: "manual_hold_expiry",
                            reservationStatus: "expired",
                            reconciliationRequired: true,
                        },
                    });
                } catch (error) {
                    console.warn("[booking] manual expiry reconciliation recorder failed", error);
                }
            }
        }
    }

    await supabase.from("booking_status_history").insert({
        workspace_id: workspaceId,
        reservation_id: reservationId,
        from_status: "pending_confirmation",
        to_status: "expired",
        trigger_source: "operator",
        actor_type: "workspace_manager",
        actor_id: userId,
        reason,
        payload_json: {
            source: "manual_hold_expiry",
            paymentId: payment?.id ?? null,
            actorId: userId,
        } as Json,
    });

    revalidateBookingPaths();
    return { data: { success: true }, error: null };
}

export async function updateBookingCustomerEmail(input: { reservationId: string; email: string }) {
    const emailSchema = z.string().email();
    const idSchema = z.string().uuid();

    const parsedId = idSchema.safeParse(input.reservationId);
    const parsedEmail = emailSchema.safeParse(input.email);

    if (!parsedId.success || !parsedEmail.success) {
        return { data: null, error: "Invalid reservation ID or email format." };
    }

    const context = await requireBookingManagementContext();
    const supabase = await createClient();
    const userId = await getAuthenticatedUserId();
    const workspaceId = context.activeWorkspace.id;
    const normalizedEmail = input.email.trim().toLowerCase();

    // 1. Fetch reservation
    const { data: reservation, error: fetchError } = await supabase
        .from("booking_reservations")
        .select("id, customer_email, status, metadata")
        .eq("id", parsedId.data)
        .eq("workspace_id", workspaceId)
        .maybeSingle();

    if (fetchError || !reservation) {
        return { data: null, error: "Reservation not found." };
    }

    const oldEmail = reservation.customer_email;
    if (oldEmail === normalizedEmail) {
        return { data: { success: true }, error: null };
    }

    const now = new Date().toISOString();

    // 2. Prepare metadata update
    const existingMetadata = (reservation.metadata && typeof reservation.metadata === "object" && !Array.isArray(reservation.metadata))
        ? (reservation.metadata as Record<string, unknown>)
        : {};

    const correctionHistory = Array.isArray(existingMetadata.emailCorrectionHistory)
        ? [...existingMetadata.emailCorrectionHistory]
        : [];
    correctionHistory.push({
        emailCorrectedFrom: oldEmail,
        emailCorrectedTo: normalizedEmail,
        emailCorrectedAt: now,
        emailCorrectedBy: userId,
    });

    const emailDelivery = existingMetadata.emailDelivery && typeof existingMetadata.emailDelivery === "object" && !Array.isArray(existingMetadata.emailDelivery)
        ? (existingMetadata.emailDelivery as Record<string, unknown>)
        : {};
    const customerDelivery = emailDelivery.customer && typeof emailDelivery.customer === "object" && !Array.isArray(emailDelivery.customer)
        ? (emailDelivery.customer as Record<string, unknown>)
        : {};

    const updatedMetadata = {
        ...existingMetadata,
        emailCorrectionHistory: correctionHistory,
        emailDelivery: {
            ...emailDelivery,
            customer: {
                ...customerDelivery,
                requiresEmailCorrection: false, // Reset correction required flag
            },
        },
    };

    // 3. Update reservation email and metadata
    const { error: updateError } = await supabase
        .from("booking_reservations")
        .update({
            customer_email: normalizedEmail,
            metadata: updatedMetadata as unknown as Json,
            updated_at: now,
        })
        .eq("id", reservation.id)
        .eq("workspace_id", workspaceId);

    if (updateError) {
        return { data: null, error: updateError.message };
    }

    // 4. Record entry in booking_status_history
    await supabase.from("booking_status_history").insert({
        workspace_id: workspaceId,
        reservation_id: reservation.id,
        from_status: reservation.status,
        to_status: reservation.status,
        trigger_source: "operator",
        actor_type: "workspace_manager",
        actor_id: userId,
        reason: "Customer email address corrected by operator.",
        payload_json: asJson({
            emailCorrectedFrom: oldEmail,
            emailCorrectedTo: normalizedEmail,
            emailCorrectedAt: now,
            emailCorrectedBy: userId,
        }),
    });

    revalidateBookingPaths();
    return { data: { success: true, email: normalizedEmail }, error: null };
}

export async function resendBookingNotification(input: { reservationId: string; eventType: string }) {
    const idSchema = z.string().uuid();
    const eventTypeSchema = z.enum([
        "reservation_created",
        "reservation_pending_review",
        "reservation_confirmed",
        "reservation_cancelled",
        "reservation_completed",
        "meeting_ready",
    ]);

    const parsedId = idSchema.safeParse(input.reservationId);
    const parsedEventType = eventTypeSchema.safeParse(input.eventType);

    if (!parsedId.success || !parsedEventType.success) {
        return { data: null, error: "Invalid reservation ID or notification event type." };
    }

    const context = await requireBookingManagementContext();
    const supabase = await createClient();
    const workspaceId = context.activeWorkspace.id;

    // Verify reservation exists and belongs to this workspace
    const { data: reservation, error: fetchError } = await supabase
        .from("booking_reservations")
        .select("id")
        .eq("id", parsedId.data)
        .eq("workspace_id", workspaceId)
        .maybeSingle();

    if (fetchError) {
        return { data: null, error: fetchError.message };
    }
    if (!reservation) {
        return { data: null, error: "Reservation not found." };
    }

    // Trigger email dispatch
    await dispatchBookingEmails({
        supabase,
        workspaceId,
        reservationId: parsedId.data,
        eventType: parsedEventType.data,
        reason: "Manually triggered resend by operator.",
    });

    return { data: { success: true }, error: null };
}

export async function retryBookingMeeting(reservationId: string) {
    const parsed = z.string().uuid().safeParse(reservationId);
    if (!parsed.success) return { data: null, error: "Invalid reservation ID." };

    const context = await requireBookingManagementContext("booking.manage");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: reservation, error } = await supabase
        .from("booking_reservations")
        .select("id,status,metadata")
        .eq("id", parsed.data)
        .eq("workspace_id", context.activeWorkspace.id)
        .in("status", ["pending_review", "pending_confirmation", "confirmed", "completed"])
        .maybeSingle();
    if (error || !reservation) return { data: null, error: error?.message ?? "Reservation not found." };

    const metadata = normalizeJsonRecord(reservation.metadata);
    const meetingProvider = metadata.meetingProvider === "zoom"
        || metadata.meetingProvider === "google_meet"
        || metadata.meetingProvider === "none"
        ? metadata.meetingProvider
        : "google_meet";
    const { data: payment } = await supabase
        .from("booking_payments")
        .select("id,status")
        .eq("reservation_id", reservation.id)
        .eq("workspace_id", context.activeWorkspace.id)
        .maybeSingle();
    const mayAutoConfirm = reservation.status === "pending_review"
        ? metadata.automaticConfirmationPending === true
        : reservation.status === "pending_confirmation"
            ? payment?.status === "verified"
            : false;

    if (mayAutoConfirm) {
        const fromStatus = reservation.status as "pending_review" | "pending_confirmation";
        const confirmation = await provisionAndConfirmReservation({
            provider: meetingProvider,
            provisionMeeting: () => ensureBookingMeeting(supabase, reservation.id),
            commitConfirmation: async () => {
                const confirmedMetadata = { ...metadata, automaticConfirmationPending: false };
                const { data: confirmed, error: confirmationError } = await supabase
                    .from("booking_reservations")
                    .update({
                        status: "confirmed",
                        metadata: asJson(confirmedMetadata),
                        requires_manual_review: false,
                        manual_review_reason: null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", reservation.id)
                    .eq("workspace_id", context.activeWorkspace.id)
                    .eq("status", fromStatus)
                    .select("id")
                    .maybeSingle();
                if (confirmationError) throw new Error(confirmationError.message);
                return Boolean(confirmed);
            },
        });
        if (!confirmation.confirmed) {
            revalidateBookingPaths();
            return {
                data: { status: confirmation.meetingStatus, joinUrl: confirmation.joinUrl },
                error: confirmation.reason ?? "Meeting creation failed.",
            };
        }

        const reason = fromStatus === "pending_confirmation"
            ? "Verified payment and customer meeting are ready; reservation confirmed after retry."
            : "Customer meeting is ready; reservation confirmed after retry.";
        await Promise.all([
            supabase.from("booking_status_history").insert({
                workspace_id: context.activeWorkspace.id,
                reservation_id: reservation.id,
                from_status: fromStatus,
                to_status: "confirmed",
                trigger_source: "operator",
                actor_type: "workspace_manager",
                actor_id: user?.id ?? null,
                reason,
                payload_json: asJson({
                    provider: meetingProvider,
                    paymentStatus: payment?.status ?? null,
                    confirmationPrerequisite: "meeting_ready",
                }),
            }),
            supabase.from("booking_notification_events").insert({
                workspace_id: context.activeWorkspace.id,
                reservation_id: reservation.id,
                event_type: "reservation_confirmed",
                channel: "internal_dashboard",
                delivery_status: "pending",
                payload_json: asJson({ reason, emailDispatchRequired: true }),
            }),
        ]);
        await dispatchBookingEmails({
            supabase,
            workspaceId: context.activeWorkspace.id,
            reservationId: reservation.id,
            eventType: "reservation_confirmed",
            reason,
        });
        if (payment?.status === "verified") {
            try {
                await draftAgreementFromBookingInternal({
                    bookingId: reservation.id,
                    workspaceId: context.activeWorkspace.id,
                });
            } catch (agreementError) {
                console.warn("[booking] agreement draft retry failed", agreementError);
            }
        }
        revalidateBookingPaths();
        return { data: { status: "ready", joinUrl: confirmation.joinUrl }, error: null };
    }

    let meeting: Awaited<ReturnType<typeof ensureBookingMeeting>>;
    try {
        meeting = await ensureBookingMeeting(supabase, reservation.id);
    } catch (meetingError) {
        return { data: null, error: meetingError instanceof Error ? meetingError.message : "Meeting creation failed." };
    }
    if (meeting.status === "ready" && (reservation.status === "confirmed" || reservation.status === "completed")) {
        await dispatchBookingEmails({
            supabase,
            workspaceId: context.activeWorkspace.id,
            reservationId: reservation.id,
            eventType: "meeting_ready",
        });
    }
    revalidateBookingPaths();
    return {
        data: { status: meeting.status, joinUrl: meeting.joinUrl },
        error: meeting.status === "failed" ? meeting.error ?? "Meeting creation failed." : null,
    };
}

/** Retry provider/calendar cleanup after a cancellation or expiry. */
export async function retryBookingMeetingCleanup(reservationId: string) {
    const parsed = z.string().uuid().safeParse(reservationId);
    if (!parsed.success) return { data: null, error: "Invalid reservation ID." };

    const context = await requireBookingManagementContext("booking.manage");
    const supabase = getServiceRoleClient();
    const { data: reservation, error } = await supabase
        .from("booking_reservations")
        .select("id,status")
        .eq("id", parsed.data)
        .eq("workspace_id", context.activeWorkspace.id)
        .maybeSingle();
    if (error || !reservation) return { data: null, error: error?.message ?? "Reservation not found." };
    if (!["cancelled_by_customer", "cancelled_by_workspace", "expired", "no_show"].includes(reservation.status)) {
        return { data: null, error: "Meeting cleanup is available only for terminal bookings." };
    }

    const errors: string[] = [];
    try {
        await cancelBookingMeeting(supabase, reservation.id);
    } catch (meetingError) {
        errors.push(meetingError instanceof Error ? meetingError.message : "Meeting provider cleanup failed.");
    }
    try {
        const calendarResult = await deleteReservationFromGoogleCalendar(supabase, reservation.id);
        if (!calendarResult.success) errors.push(calendarResult.error ?? "Google Calendar cleanup failed.");
    } catch (calendarError) {
        errors.push(calendarError instanceof Error ? calendarError.message : "Google Calendar cleanup failed.");
    }

    revalidateBookingPaths();
    return {
        data: { success: errors.length === 0 },
        error: errors.length > 0 ? errors.join(" ") : null,
    };
}
