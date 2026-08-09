import { NextRequest, NextResponse } from "next/server";

import {
    buildPayPalWebhookEventLedgerInsert,
    getPayPalWebhookResource,
    paypalDecimalToCents,
    verifyPayPalWebhook,
} from "@/features/booking/lib/paypal";
import { verifyBookingPaymentAndMaybeConfirm } from "@/features/booking/actions";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import type { Json, Tables, TablesUpdate } from "@/shared/lib/supabase/database.types";
import { recordPaymentBusinessEvent } from "@/features/business-spine/recorders";
import { dispatchBookingEmails } from "@/features/booking/lib/booking-emails";
import { extractAntiAbuseRequestContext } from "@/shared/lib/anti-abuse/server";

export const runtime = "nodejs";

const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;
const WEBHOOK_RATE_WINDOW_MS = 60_000;
const WEBHOOK_RATE_LIMIT = 120;
const WEBHOOK_PROCESSING_LEASE_MS = 10 * 60_000;
const webhookRateBuckets = new Map<string, { windowStartedAt: number; count: number }>();

type PaymentRow = Tables<"booking_payments">;
type WebhookEventRow = Tables<"payment_webhook_events">;

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string | null {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readPath(root: unknown, path: Array<string | number>): unknown {
    let current: unknown = root;
    for (const segment of path) {
        if (typeof segment === "number") {
            if (!Array.isArray(current)) return undefined;
            current = current[segment];
            continue;
        }
        if (!isRecord(current)) return undefined;
        current = current[segment];
    }
    return current;
}

function requestFingerprint(req: NextRequest): string {
    // NextRequest.ip is populated by the trusted edge/runtime adapter. The
    // configured proxy header is accepted only through the shared helper;
    // arbitrary forwarding headers remain untrusted in production.
    const trustedIp = (req as NextRequest & { ip?: string }).ip?.trim();
    if (trustedIp && trustedIp.length <= 128) return trustedIp;
    return extractAntiAbuseRequestContext(req.headers).ipAddress ?? "unknown";
}

function allowLocalWebhookRequest(key: string): boolean {
    const now = Date.now();
    const current = webhookRateBuckets.get(key);
    if (!current || now - current.windowStartedAt >= WEBHOOK_RATE_WINDOW_MS) {
        webhookRateBuckets.set(key, { windowStartedAt: now, count: 1 });
        // Keep the process-local guard bounded on long-lived Node workers.
        for (const [bucketKey, bucket] of webhookRateBuckets) {
            if (now - bucket.windowStartedAt >= WEBHOOK_RATE_WINDOW_MS) webhookRateBuckets.delete(bucketKey);
        }
        return true;
    }
    const limit = key === "unknown" ? WEBHOOK_RATE_LIMIT * 5 : WEBHOOK_RATE_LIMIT;
    if (current.count >= limit) return false;
    current.count += 1;
    return true;
}

async function allowWebhookRequest(
    req: NextRequest,
    supabase: ReturnType<typeof createAdminClient>,
): Promise<boolean> {
    // Keep a cheap per-worker guard for bursts, then use the database-backed
    // buckets for a global fence across Node instances. If the migration has
    // not been applied yet, retain the local guard rather than taking the
    // payment webhook down during a rolling deploy.
    const key = requestFingerprint(req);
    const hasTrustedFingerprint = key !== "unknown";
    if (!allowLocalWebhookRequest(key)) return false;
    // A self-hosted Next runtime may not expose a peer address. Do not put
    // every such request into one shared database bucket: an attacker could
    // exhaust that bucket with unsigned bodies and starve real PayPal
    // deliveries. The bounded per-worker unknown bucket remains a cheap
    // backstop until signature verification, while trusted proxy addresses
    // use the global cross-instance limiter below.
    if (!hasTrustedFingerprint) return true;
    const [globalResult, clientResult] = await Promise.all([
        supabase.rpc("allow_payment_webhook_request" as never, {
            p_bucket_key: "paypal:global",
            p_limit: WEBHOOK_RATE_LIMIT * 5,
            p_window_seconds: WEBHOOK_RATE_WINDOW_MS / 1000,
        } as never),
        hasTrustedFingerprint
            ? supabase.rpc("allow_payment_webhook_request" as never, {
                p_bucket_key: `paypal:${key}`,
                p_limit: WEBHOOK_RATE_LIMIT,
                p_window_seconds: WEBHOOK_RATE_WINDOW_MS / 1000,
            } as never)
            : Promise.resolve({ data: true as boolean, error: null }),
    ]);
    if (globalResult.error || clientResult.error) {
        console.warn("[paypal] global webhook rate limiter unavailable; using local guard", globalResult.error?.message ?? clientResult.error?.message);
        return true;
    }
    return globalResult.data === true && clientResult.data === true;
}

function linkedCaptureIdFromRefund(resource: Record<string, unknown>): string | null {
    const direct = readString(readPath(resource, ["supplementary_data", "related_ids", "capture_id"]));
    if (direct) return direct;
    const links = Array.isArray(resource.links) ? resource.links : [];
    for (const link of links) {
        if (!isRecord(link) || readString(link.rel)?.toLowerCase() !== "up") continue;
        const href = readString(link.href);
        const match = href?.match(/\/captures\/([^/?#]+)/i);
        if (match?.[1]) {
            try {
                return decodeURIComponent(match[1]);
            } catch {
                return match[1];
            }
        }
    }
    return null;
}

function extractCaptureResourceDetails(resource: Record<string, unknown>, eventType?: string) {
    const isRefundResource = eventType === "PAYMENT.CAPTURE.REFUNDED";
    const captureId = isRefundResource
        ? linkedCaptureIdFromRefund(resource)
        : readString(resource.id);
    return {
        captureId,
        providerResourceId: readString(resource.id),
        captureStatus: readString(resource.status),
        orderId: readString(readPath(resource, ["supplementary_data", "related_ids", "order_id"])),
        customId: readString(resource.custom_id),
        invoiceId: readString(resource.invoice_id),
        amountCents: paypalDecimalToCents(readString(readPath(resource, ["amount", "value"]))),
        currency: readString(readPath(resource, ["amount", "currency_code"])),
        payerEmail: readString(readPath(resource, ["payer", "email_address"])),
        paypalFeeCents: paypalDecimalToCents(readString(readPath(resource, ["seller_receivable_breakdown", "paypal_fee", "value"]))),
        paypalNetCents: paypalDecimalToCents(readString(readPath(resource, ["seller_receivable_breakdown", "net_amount", "value"]))),
    };
}

function paymentHasReplacementPayPalOrder(payment: PaymentRow): boolean {
    const metadata = isRecord(payment.metadata) ? payment.metadata : {};
    const retryCount = typeof metadata.paypalRetryCount === "number"
        ? metadata.paypalRetryCount
        : 0;
    const orderHistory = Array.isArray(metadata.paypalOrderHistory)
        ? metadata.paypalOrderHistory.filter((entry) => isRecord(entry))
        : [];
    return retryCount > 0 || orderHistory.length > 1;
}

function paypalCaptureHistory(metadata: Json | null | undefined, captureId: string | null): string[] {
    const record = isRecord(metadata) ? metadata : {};
    const existing = Array.isArray(record.paypalCaptureHistory)
        ? record.paypalCaptureHistory.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
        : [];
    return captureId
        ? Array.from(new Set([...existing, captureId])).slice(-20)
        : existing.slice(-20);
}

function paypalRefundHistory(metadata: Json | null | undefined): Array<{ id: string; amountCents: number }> {
    const record = isRecord(metadata) ? metadata : {};
    return Array.isArray(record.paypalRefundHistory)
        ? record.paypalRefundHistory.filter((entry): entry is { id: string; amountCents: number } => (
            isRecord(entry)
            && typeof entry.id === "string"
            && entry.id.length > 0
            && typeof entry.amountCents === "number"
            && Number.isInteger(entry.amountCents)
            && entry.amountCents > 0
        )).slice(-50)
        : [];
}

async function recordPayPalAssociationReview(params: {
    supabase: ReturnType<typeof createAdminClient>;
    payment: PaymentRow;
    resource: Record<string, unknown>;
    eventId: string;
    eventType: string;
    reason: string;
    captureId?: string | null;
    orderId?: string | null;
}): Promise<void> {
    const now = new Date().toISOString();
    const metadata = isRecord(params.payment.metadata) ? params.payment.metadata : {};
    const { error } = await params.supabase
        .from("booking_payments")
        .update({
            metadata: {
                ...metadata,
                paypalAssociationReview: {
                    reason: params.reason,
                    eventId: params.eventId,
                    eventType: params.eventType,
                    captureId: params.captureId ?? null,
                    orderId: params.orderId ?? null,
                    observedAt: now,
                },
                paypalAssociationReviewRaw: params.resource,
            } as Json,
            updated_at: now,
        })
        .eq("id", params.payment.id)
        .eq("workspace_id", params.payment.workspace_id);
    if (error) throw new Error(error.message);
}

async function releaseReservationAfterPayPalFailure(params: {
    supabase: ReturnType<typeof createAdminClient>;
    payment: PaymentRow;
    eventId: string;
}): Promise<void> {
    const { data: reservation, error: lookupError } = await params.supabase
        .from("booking_reservations")
        .select("id,status,metadata,extension_state_json")
        .eq("id", params.payment.reservation_id)
        .eq("workspace_id", params.payment.workspace_id)
        .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    if (!reservation || reservation.status !== "pending_confirmation") return;

    const { data: currentPayment, error: paymentLookupError } = await params.supabase
        .from("booking_payments")
        .select("status,paypal_status")
        .eq("id", params.payment.id)
        .eq("workspace_id", params.payment.workspace_id)
        .maybeSingle();
    if (paymentLookupError) throw new Error(paymentLookupError.message);
    if (!currentPayment
        || currentPayment.status !== "failed"
        || !currentPayment.paypal_status
        || ["CUSTOMER_CANCELLED", "COMPLETED", "EXPIRED"].includes(currentPayment.paypal_status)) {
        return;
    }

    const now = new Date().toISOString();
    const { data: released, error: releaseError } = await params.supabase
        .from("booking_reservations")
        .update({
            status: "expired",
            updated_at: now,
            metadata: {
                ...(isRecord(reservation.metadata) ? reservation.metadata : {}),
                paymentExtensionState: "failed",
                paymentFailedAt: now,
                paymentFailureEventId: params.eventId,
            } as Json,
            extension_state_json: {
                ...(isRecord(reservation.extension_state_json) ? reservation.extension_state_json : {}),
                payment: "failed",
            } as Json,
        })
        .eq("id", reservation.id)
        .eq("workspace_id", params.payment.workspace_id)
        .eq("status", "pending_confirmation")
        .select("id")
        .maybeSingle();
    if (releaseError) throw new Error(releaseError.message);
    if (!released) {
        const { data: latest, error: latestError } = await params.supabase
            .from("booking_reservations")
            .select("status")
            .eq("id", reservation.id)
            .eq("workspace_id", params.payment.workspace_id)
            .maybeSingle();
        if (latestError) throw new Error(latestError.message);
        if (latest?.status === "pending_confirmation") {
            throw new Error("PayPal failure could not release the booking hold yet.");
        }
        return;
    }

    await params.supabase.from("booking_status_history").insert({
        workspace_id: params.payment.workspace_id,
        reservation_id: reservation.id,
        from_status: "pending_confirmation",
        to_status: "expired",
        trigger_source: "system",
        actor_type: "system",
        actor_id: null,
        reason: "PayPal capture was denied; the temporary booking hold was released.",
        payload_json: {
            source: "paypal_webhook",
            eventId: params.eventId,
            paymentId: params.payment.id,
        } as Json,
    });
}

async function findPaymentForResource(
    supabase: ReturnType<typeof createAdminClient>,
    resource: Record<string, unknown>,
    eventType?: string,
): Promise<PaymentRow | null> {
    const details = extractCaptureResourceDetails(resource, eventType);
    const orderId = details.orderId
        ?? (eventType === "CHECKOUT.ORDER.APPROVED" ? readString(resource.id) : null);

    if (details.captureId) {
        const { data } = await supabase
            .from("booking_payments")
            .select("*")
            .eq("paypal_capture_id", details.captureId)
            .in("provider", ["paypal_checkout", "paypal"])
            .maybeSingle();
        if (data) return data;

        // Refund resources identify the parent capture through a link, while
        // the local row may already point at a replacement capture. Keep old
        // capture IDs in metadata so those provider events remain linkable.
        const { data: historical } = await supabase
            .from("booking_payments")
            .select("*")
            .contains("metadata", { paypalCaptureHistory: [details.captureId] })
            .in("provider", ["paypal_checkout", "paypal"])
            .limit(1)
            .maybeSingle();
        if (historical) return historical;
    }

    if (details.customId) {
        const { data } = await supabase
            .from("booking_payments")
            .select("*")
            .eq("id", details.customId)
            .in("provider", ["paypal_checkout", "paypal"])
            .maybeSingle();
        if (data) return data;
    }

    if (orderId) {
        const { data } = await supabase
            .from("booking_payments")
            .select("*")
            .eq("paypal_order_id", orderId)
            .in("provider", ["paypal_checkout", "paypal"])
            .maybeSingle();
        if (data) return data;
    }

    return null;
}

function validateCapture(payment: PaymentRow, resource: Record<string, unknown>) {
    const details = extractCaptureResourceDetails(resource);

    if (!details.captureId) {
        throw new Error("PayPal capture webhook is missing capture ID.");
    }

    if (details.captureStatus !== "COMPLETED") {
        throw new Error(`PayPal capture is not completed (${details.captureStatus ?? "unknown"}).`);
    }

    if (details.orderId && payment.paypal_order_id && details.orderId !== payment.paypal_order_id) {
        throw new Error("PayPal capture order ID does not match local payment order ID.");
    }

    if (details.customId && details.customId !== payment.id) {
        throw new Error("PayPal capture custom ID does not match local payment ID.");
    }

    if (details.invoiceId && details.invoiceId !== payment.payment_reference) {
        throw new Error("PayPal capture invoice ID does not match booking reference.");
    }

    if (details.amountCents !== payment.amount_cents) {
        throw new Error("PayPal capture amount does not match booking payment amount.");
    }

    if ((details.currency ?? "").toUpperCase() !== payment.currency.toUpperCase()) {
        throw new Error("PayPal capture currency does not match booking payment currency.");
    }

    return details;
}

async function markLedgerProcessed(
    supabase: ReturnType<typeof createAdminClient>,
    ledgerId: string,
    status: WebhookEventRow["processing_status"],
    error: string | null = null,
) {
    await supabase
        .from("payment_webhook_events")
        .update({
            processing_status: status,
            processed_at: new Date().toISOString(),
            processing_error: error,
        })
        .eq("id", ledgerId);
}

async function recordDeliveryAttempt(params: {
    supabase: ReturnType<typeof createAdminClient>;
    verification: ReturnType<typeof verifyPayPalWebhook> extends Promise<infer T> ? T : never;
    resource: Record<string, unknown> | null;
    payment: PaymentRow | null;
}) {
    try {
        await params.supabase
            .from("payment_webhook_delivery_attempts" as never)
            .insert({
                workspace_id: params.payment?.workspace_id ?? null,
                booking_payment_id: params.payment?.id ?? null,
                reservation_id: params.payment?.reservation_id ?? null,
                provider: "paypal",
                provider_event_id: params.verification.providerEventId,
                provider_event_type: params.verification.providerEventType,
                verification_status: params.verification.verified ? "verified" : "failed",
                verification_mode: params.verification.mode,
                raw_body_sha256: params.verification.rawBodySha256,
                headers_json: (params.verification.headers ?? {}) as Json,
                payload_json: (params.verification.payload ?? {}) as Json,
                resource_json: (params.resource ?? {}) as Json,
                metadata: { source: "paypal_webhook" } as Json,
            } as never);
    } catch (error) {
        // The canonical webhook ledger remains the compatibility path during
        // a rolling migration. Do not reject a provider delivery solely when
        // the optional attempt archive is unavailable on an old instance.
        console.warn("[paypal] delivery attempt archive unavailable", error instanceof Error ? error.message : error);
    }
}

async function handleCaptureCompleted(params: {
    supabase: ReturnType<typeof createAdminClient>;
    payment: PaymentRow;
    resource: Record<string, unknown>;
    eventId: string;
    eventType: string;
}): Promise<"processed" | "ignored"> {
    const rawDetails = extractCaptureResourceDetails(params.resource, params.eventType);
    // A previously verified payment may receive an exact duplicate webhook.
    // Suppress only that exact capture; a different capture or reissued order
    // is evidence of a possible second charge and must enter reconciliation.
    if (params.payment.status === "verified"
        && rawDetails.captureId === params.payment.paypal_capture_id
        && (!rawDetails.orderId || !params.payment.paypal_order_id || rawDetails.orderId === params.payment.paypal_order_id)) {
        return "ignored";
    }
    if (!rawDetails.orderId && paymentHasReplacementPayPalOrder(params.payment)) {
        await recordPayPalAssociationReview({
            supabase: params.supabase,
            payment: params.payment,
            resource: params.resource,
            eventId: params.eventId,
            eventType: params.eventType,
            reason: "capture_missing_order_id_after_checkout_reissue",
            captureId: rawDetails.captureId,
        });
        await recordPaymentBusinessEvent({
            supabase: params.supabase,
            workspaceId: params.payment.workspace_id,
            eventType: "captured_after_terminal",
            paymentId: params.payment.id,
            bookingId: params.payment.reservation_id,
            amountCents: rawDetails.amountCents ?? params.payment.amount_cents,
            currency: rawDetails.currency ?? params.payment.currency,
            providerEventId: params.eventId,
            netAmountCents: params.payment.net_amount_cents,
            vatAmountCents: params.payment.vat_amount_cents,
            vatRateBasisPoints: params.payment.vat_rate_basis_points,
            grossAmountCents: params.payment.gross_amount_cents,
            payload: {
                source: "paypal_webhook",
                eventType: params.eventType,
                captureId: rawDetails.captureId,
                reconciliationRequired: true,
                reason: "capture_missing_order_id_after_checkout_reissue",
            },
        });
        return "ignored";
    }
    if (rawDetails.orderId && params.payment.paypal_order_id && rawDetails.orderId !== params.payment.paypal_order_id) {
        const now = new Date().toISOString();
        const { error: mismatchError } = await params.supabase
            .from("booking_payments")
            .update({
                metadata: {
                    ...(isRecord(params.payment.metadata) ? params.payment.metadata : {}),
                    lateCaptureNeedsReview: true,
                    paypalMismatchedOrderId: rawDetails.orderId,
                    paypalMismatchedCaptureId: rawDetails.captureId,
                    paypalWebhookMismatchedCaptureRaw: params.resource,
                } as Json,
                updated_at: now,
            })
            .eq("id", params.payment.id)
            .eq("workspace_id", params.payment.workspace_id);
        if (mismatchError) throw new Error(mismatchError.message);
        await recordPaymentBusinessEvent({
            supabase: params.supabase,
            workspaceId: params.payment.workspace_id,
            eventType: "captured_after_terminal",
            paymentId: params.payment.id,
            bookingId: params.payment.reservation_id,
            amountCents: rawDetails.amountCents ?? params.payment.amount_cents,
            currency: rawDetails.currency ?? params.payment.currency,
            providerEventId: params.eventId,
            netAmountCents: params.payment.net_amount_cents,
            vatAmountCents: params.payment.vat_amount_cents,
            vatRateBasisPoints: params.payment.vat_rate_basis_points,
            grossAmountCents: params.payment.gross_amount_cents,
            payload: {
                source: "paypal_webhook",
                eventType: params.eventType,
                captureId: rawDetails.captureId,
                orderId: rawDetails.orderId,
                reconciliationRequired: true,
                reason: "provider_order_mismatch_after_checkout_reissue",
            },
        });
        return "ignored";
    }

    const details = validateCapture(params.payment, params.resource);

    // A cancelled or otherwise terminal local payment must not be verified by
    // a late capture webhook. Persist the provider capture evidence and emit a
    // reconciliation signal instead of retrying an impossible transition.
    if (
        params.payment.status !== "requested"
        || params.payment.paypal_status === "CUSTOMER_CANCELLED"
        || params.payment.paypal_status === "EXPIRED"
        || params.payment.paypal_status === "RETURN_CAPTURE_FAILED"
    ) {
        const now = new Date().toISOString();
        const { data: reconciledPayment, error: reconciliationError } = await params.supabase
            .from("booking_payments")
            .update({
                paypal_capture_id: details.captureId,
                paypal_payer_email: details.payerEmail,
                paypal_fee_cents: details.paypalFeeCents,
                paypal_net_cents: details.paypalNetCents,
                provider_event_id: params.eventId,
                provider_event_type: params.eventType,
                provider_synced_at: now,
                metadata: {
                    ...(isRecord(params.payment.metadata) ? params.payment.metadata : {}),
                    lateCaptureNeedsReview: true,
                    paypalWebhookLateCaptureRaw: params.resource,
                } as Json,
                updated_at: now,
            })
            .eq("id", params.payment.id)
            .eq("workspace_id", params.payment.workspace_id)
            .select("id")
            .maybeSingle();
        if (reconciliationError) throw new Error(reconciliationError.message);
        if (reconciledPayment) {
            await recordPaymentBusinessEvent({
                supabase: params.supabase,
                workspaceId: params.payment.workspace_id,
                eventType: "captured_after_terminal",
                paymentId: params.payment.id,
                bookingId: params.payment.reservation_id,
                amountCents: params.payment.amount_cents,
                currency: params.payment.currency,
                providerEventId: params.eventId,
                netAmountCents: params.payment.net_amount_cents,
                vatAmountCents: params.payment.vat_amount_cents,
                vatRateBasisPoints: params.payment.vat_rate_basis_points,
                grossAmountCents: params.payment.gross_amount_cents,
                payload: {
                    source: "paypal_webhook",
                    eventType: params.eventType,
                    captureId: details.captureId,
                    reconciliationRequired: true,
                    localPaymentStatus: params.payment.status,
                    localPayPalStatus: params.payment.paypal_status,
                },
            });
        }
        return "ignored";
    }

    const paymentUpdate: TablesUpdate<"booking_payments"> = {
        ...(details.orderId ? { paypal_order_id: details.orderId } : {}),
        paypal_capture_id: details.captureId,
        paypal_status: details.captureStatus,
        paypal_payer_email: details.payerEmail,
        paypal_fee_cents: details.paypalFeeCents,
        paypal_net_cents: details.paypalNetCents,
        provider_event_id: params.eventId,
        provider_event_type: params.eventType,
        provider_synced_at: new Date().toISOString(),
        metadata: {
            ...(isRecord(params.payment.metadata) ? params.payment.metadata : {}),
            paypalCaptureHistory: paypalCaptureHistory(params.payment.metadata, details.captureId),
            paypalWebhookCaptureRaw: params.resource,
        } as Json,
    };

    await verifyBookingPaymentAndMaybeConfirm({
        supabase: params.supabase,
        workspaceId: params.payment.workspace_id,
        reservationId: params.payment.reservation_id,
        paymentId: params.payment.id,
        actorId: null,
        actorType: "system",
        triggerSource: "system",
        note: "PayPal capture completed via webhook.",
        autoConfirm: true,
        verificationSource: "paypal_webhook",
        expectedPaypalOrderId: params.payment.paypal_order_id,
        paymentUpdate,
        metadata: {
            providerEventId: params.eventId,
            providerEventType: params.eventType,
            paypalOrderId: details.orderId,
            paypalCaptureId: details.captureId,
        },
    });

    await recordPaymentBusinessEvent({
        supabase: params.supabase,
        workspaceId: params.payment.workspace_id,
        eventType: "captured",
        paymentId: params.payment.id,
        bookingId: params.payment.reservation_id,
        amountCents: params.payment.amount_cents,
        currency: params.payment.currency,
        providerEventId: params.eventId,
        payload: { source: "paypal_webhook", eventType: params.eventType, captureId: details.captureId },
    });

    return "processed";
}

async function handleNegativeCaptureEvent(params: {
    supabase: ReturnType<typeof createAdminClient>;
    payment: PaymentRow;
    resource: Record<string, unknown>;
    eventId: string;
    eventType: string;
    attempt?: number;
}): Promise<"processed" | "ignored"> {
    const details = extractCaptureResourceDetails(params.resource, params.eventType);
    const isRefund = params.eventType === "PAYMENT.CAPTURE.REFUNDED" || params.eventType === "PAYMENT.CAPTURE.REVERSED";
    const now = new Date().toISOString();

    // A payment can receive a fresh PayPal order after a customer cancellation
    // or capture failure. Do not let a denial/refund for the old order mutate
    // the replacement checkout; the immutable webhook ledger retains the
    // provider evidence for reconciliation. When PayPal omits related_ids,
    // fail closed after a reissue because custom_id is intentionally stable
    // across the checkout attempts.
    if (!details.orderId && paymentHasReplacementPayPalOrder(params.payment)) {
        await recordPayPalAssociationReview({
            supabase: params.supabase,
            payment: params.payment,
            resource: params.resource,
            eventId: params.eventId,
            eventType: params.eventType,
            reason: "negative_capture_missing_order_id_after_checkout_reissue",
            captureId: details.captureId,
        });
        return "ignored";
    }
    if (details.orderId && params.payment.paypal_order_id && details.orderId !== params.payment.paypal_order_id) {
        await recordPayPalAssociationReview({
            supabase: params.supabase,
            payment: params.payment,
            resource: params.resource,
            eventId: params.eventId,
            eventType: params.eventType,
            reason: "negative_capture_order_id_mismatch",
            captureId: details.captureId,
            orderId: details.orderId,
        });
        return "ignored";
    }

    if (isRefund) {
        if (!details.captureId || (params.payment.paypal_capture_id && details.captureId !== params.payment.paypal_capture_id)) {
            await recordPayPalAssociationReview({
                supabase: params.supabase,
                payment: params.payment,
                resource: params.resource,
                eventId: params.eventId,
                eventType: params.eventType,
                reason: "refund_capture_id_mismatch",
                captureId: details.captureId,
                orderId: details.orderId,
            });
            return "ignored";
        }
        if (!details.amountCents || details.amountCents <= 0 || details.amountCents > params.payment.amount_cents) {
            throw new Error("PayPal refund amount does not match the booking payment.");
        }
        const refundId = details.providerResourceId;
        if (!refundId) {
            await recordPayPalAssociationReview({
                supabase: params.supabase,
                payment: params.payment,
                resource: params.resource,
                eventId: params.eventId,
                eventType: params.eventType,
                reason: "refund_missing_provider_refund_id",
                captureId: details.captureId,
                orderId: details.orderId,
            });
            return "ignored";
        }
        const existingRefunds = paypalRefundHistory(params.payment.metadata);
        if (existingRefunds.some((refund) => refund.id === refundId)) return "ignored";
        const metadataRecord = isRecord(params.payment.metadata) ? params.payment.metadata : {};
        const storedRefundTotal = typeof metadataRecord.paypalRefundTotalCents === "number"
            && Number.isInteger(metadataRecord.paypalRefundTotalCents)
            && metadataRecord.paypalRefundTotalCents >= 0
            ? metadataRecord.paypalRefundTotalCents
            : existingRefunds.reduce((total, refund) => total + refund.amountCents, 0);
        const refundedTotalCents = storedRefundTotal;
        if (refundedTotalCents + details.amountCents > params.payment.amount_cents) {
            await recordPayPalAssociationReview({
                supabase: params.supabase,
                payment: params.payment,
                resource: params.resource,
                eventId: params.eventId,
                eventType: params.eventType,
                reason: "refund_total_exceeds_captured_amount",
                captureId: details.captureId,
                orderId: details.orderId,
            });
            return "ignored";
        }
        if ((details.currency ?? "").toUpperCase() !== params.payment.currency.toUpperCase()) {
            throw new Error("PayPal refund currency does not match the booking payment currency.");
        }
        if (details.customId && details.customId !== params.payment.id) {
            throw new Error("PayPal refund custom ID does not match local payment ID.");
        }
        if (details.invoiceId && details.invoiceId !== params.payment.payment_reference) {
            throw new Error("PayPal refund invoice ID does not match booking reference.");
        }
    }

    // Capture denials can arrive after a browser return has already verified
    // the payment, while refunds/reversals are valid only after a capture.
    // Keep the local payment lifecycle monotonic instead of allowing an
    // out-of-order provider event to downgrade a verified payment.
    const allowedStatuses: Array<PaymentRow["status"]> = isRefund ? ["verified", "refunded"] : ["requested"];
    const refundId = isRefund ? details.providerResourceId : null;
    const existingRefundTotal = isRefund
        ? (() => {
            const metadataRecord = isRecord(params.payment.metadata) ? params.payment.metadata : {};
            return typeof metadataRecord.paypalRefundTotalCents === "number"
                && Number.isInteger(metadataRecord.paypalRefundTotalCents)
                && metadataRecord.paypalRefundTotalCents >= 0
                ? metadataRecord.paypalRefundTotalCents
                : paypalRefundHistory(params.payment.metadata).reduce((total, refund) => total + refund.amountCents, 0);
        })()
        : 0;
    const nextRefundHistory = isRefund && refundId && details.amountCents
        ? [...paypalRefundHistory(params.payment.metadata), { id: refundId, amountCents: details.amountCents }].slice(-50)
        : null;
    const nextRefundTotalCents = isRefund && details.amountCents
        ? existingRefundTotal + details.amountCents
        : null;
    let negativeQuery = params.supabase
        .from("booking_payments")
        .update({
            status: isRefund ? "refunded" : "failed",
            ...(isRefund ? {} : { payment_url: null }),
            paypal_capture_id: details.captureId ?? params.payment.paypal_capture_id,
            // Keep one local marker for every denied capture shape; PayPal
            // sends resource.status as DENIED/DECLINED on some events and an
            // event-type-only payload on others. The recovery sweep relies on
            // this stable marker if the process crashes before releasing the
            // reservation hold.
            paypal_status: isRefund ? (details.captureStatus ?? params.eventType) : "PAYPAL_CAPTURE_DENIED",
            refund_amount_cents: isRefund ? nextRefundTotalCents : params.payment.refund_amount_cents,
            refunded_at: isRefund ? now : params.payment.refunded_at,
            failure_reason: isRefund ? null : `PayPal capture denied (${params.eventId}).`,
            provider_event_id: params.eventId,
            provider_event_type: params.eventType,
            provider_synced_at: now,
            updated_at: now,
            metadata: {
                ...(isRecord(params.payment.metadata) ? params.payment.metadata : {}),
                paypalWebhookNegativeEventRaw: params.resource,
                ...(nextRefundHistory ? {
                    paypalRefundHistory: nextRefundHistory,
                    paypalRefundTotalCents: nextRefundTotalCents,
                } : {}),
            } as Json,
        })
        .eq("id", params.payment.id)
        .eq("workspace_id", params.payment.workspace_id)
        .in("status", allowedStatuses);
    if (!isRefund) {
        negativeQuery = negativeQuery.or(
            "paypal_status.is.null,paypal_status.eq.CREATED,paypal_status.eq.PAYER_ACTION_REQUIRED,paypal_status.eq.APPROVED,paypal_status.eq.CAPTURE_PENDING_RECONCILIATION,paypal_status.eq.CAPTURE_COMPLETED_PENDING_RECONCILIATION",
        );
    } else {
        // Two distinct refund webhooks can arrive concurrently with the same
        // stale payment snapshot. Require the metadata version we read so a
        // lost update is retried against the latest refund history instead of
        // overwriting a prior refund audit/total.
        negativeQuery = negativeQuery.eq("metadata", params.payment.metadata as never);
    }
    const { data: updatedPayment, error: updateError } = await negativeQuery
        .select("id")
        .maybeSingle();

    if (updateError) throw new Error(updateError.message);
    if (!updatedPayment) {
        if (isRefund && (params.attempt ?? 0) < 3) {
            const { data: latestPayment, error: latestPaymentError } = await params.supabase
                .from("booking_payments")
                .select("*")
                .eq("id", params.payment.id)
                .eq("workspace_id", params.payment.workspace_id)
                .maybeSingle();
            if (latestPaymentError) throw new Error(latestPaymentError.message);
            if (latestPayment) {
                return handleNegativeCaptureEvent({
                    ...params,
                    payment: latestPayment as PaymentRow,
                    attempt: (params.attempt ?? 0) + 1,
                });
            }
        }
        return "ignored";
    }

    if (!isRefund) {
        // Claim the payment first, then release the reservation. All other
        // payment paths use this order, which avoids deadlocks and prevents a
        // stale cancellation callback from expiring a newer customer hold.
        await releaseReservationAfterPayPalFailure({
            supabase: params.supabase,
            payment: params.payment,
            eventId: params.eventId,
        });
    }

    await recordPaymentBusinessEvent({
        supabase: params.supabase,
        workspaceId: params.payment.workspace_id,
        eventType: isRefund ? "refunded" : "failed",
        paymentId: params.payment.id,
        bookingId: params.payment.reservation_id,
        amountCents: details.amountCents ?? params.payment.amount_cents,
        currency: details.currency ?? params.payment.currency,
        providerEventId: params.eventId,
        payload: { source: "paypal_webhook", eventType: params.eventType, captureId: details.captureId },
    });

    await dispatchBookingEmails({
        supabase: params.supabase,
        workspaceId: params.payment.workspace_id,
        reservationId: params.payment.reservation_id,
        eventType: isRefund ? "payment_refunded" : "payment_failed",
        reason: isRefund
            ? "PayPal reported that the captured payment was refunded or reversed."
            : "PayPal denied or failed the capture.",
    });
    return "processed";
}

async function handleOrderApproved(params: {
    supabase: ReturnType<typeof createAdminClient>;
    payment: PaymentRow;
    resource: Record<string, unknown>;
    eventId: string;
    eventType: string;
}): Promise<"processed" | "ignored"> {
    // Order-approved is informational and may race a browser cancellation or
    // a completed capture. Only an outstanding requested payment may advance
    // to APPROVED; a cancellation marker and terminal local status are both
    // immutable fences against stale PayPal callbacks.
    const details = extractCaptureResourceDetails(params.resource);
    const approvedOrderId = details.orderId ?? readString(params.resource.id);
    if (!approvedOrderId && paymentHasReplacementPayPalOrder(params.payment)) {
        await recordPayPalAssociationReview({
            supabase: params.supabase,
            payment: params.payment,
            resource: params.resource,
            eventId: params.eventId,
            eventType: params.eventType,
            reason: "order_approved_missing_order_id_after_checkout_reissue",
        });
        return "ignored";
    }
    if (approvedOrderId && params.payment.paypal_order_id && approvedOrderId !== params.payment.paypal_order_id) {
        await recordPayPalAssociationReview({
            supabase: params.supabase,
            payment: params.payment,
            resource: params.resource,
            eventId: params.eventId,
            eventType: params.eventType,
            reason: "order_approved_order_id_mismatch",
            orderId: approvedOrderId,
        });
        return "ignored";
    }

    let approvalUpdateQuery = params.supabase
        .from("booking_payments")
        .update({
            ...(approvedOrderId ? { paypal_order_id: approvedOrderId } : {}),
            paypal_status: readString(params.resource.status) ?? "APPROVED",
            provider_event_id: params.eventId,
            provider_event_type: params.eventType,
            provider_synced_at: new Date().toISOString(),
            metadata: {
                ...(isRecord(params.payment.metadata) ? params.payment.metadata : {}),
                paypalWebhookOrderApprovedRaw: params.resource,
            } as Json,
        })
        .eq("id", params.payment.id)
        .eq("workspace_id", params.payment.workspace_id)
        .eq("status", "requested")
        .or("paypal_status.is.null,paypal_status.eq.CREATED,paypal_status.eq.PAYER_ACTION_REQUIRED,paypal_status.eq.APPROVED");
    if (params.payment.paypal_order_id) {
        approvalUpdateQuery = approvalUpdateQuery.eq("paypal_order_id", params.payment.paypal_order_id);
    } else {
        approvalUpdateQuery = approvalUpdateQuery.is("paypal_order_id", null);
    }
    const { data: updatedPayment, error: updateError } = await approvalUpdateQuery
        .select("id")
        .maybeSingle();

    if (updateError) throw new Error(updateError.message);
    if (!updatedPayment) return "ignored";

    await recordPaymentBusinessEvent({
        supabase: params.supabase,
        workspaceId: params.payment.workspace_id,
        eventType: "approved",
        paymentId: params.payment.id,
        bookingId: params.payment.reservation_id,
        amountCents: params.payment.amount_cents,
        currency: params.payment.currency,
        providerEventId: params.eventId,
        payload: { source: "paypal_webhook", eventType: params.eventType },
    });
    return "processed";
}

export async function POST(req: NextRequest) {
    const contentLength = Number(req.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_WEBHOOK_BODY_BYTES) {
        return NextResponse.json({ ok: false, error: "PayPal webhook payload is too large." }, { status: 413 });
    }
    const rawBody = await req.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BODY_BYTES) {
        return NextResponse.json({ ok: false, error: "PayPal webhook payload is too large." }, { status: 413 });
    }
    const supabase = createAdminClient();
    if (!await allowWebhookRequest(req, supabase)) {
        return NextResponse.json({ ok: false, error: "Too many PayPal webhook requests." }, { status: 429, headers: { "Retry-After": "60" } });
    }
    const verification = await verifyPayPalWebhook({ headers: req.headers, rawBody });

    if (!verification.providerEventId || !verification.providerEventType) {
        return NextResponse.json({ ok: false, error: verification.error ?? "Invalid PayPal webhook payload." }, { status: 400 });
    }

    const resource = verification.payload ? getPayPalWebhookResource(verification.payload) : null;
    const payment = resource ? await findPaymentForResource(supabase, resource, verification.providerEventType) : null;
    await recordDeliveryAttempt({ supabase, verification, resource, payment });
    const ledgerInsert = buildPayPalWebhookEventLedgerInsert({
        verification,
        workspaceId: payment?.workspace_id ?? null,
        bookingPaymentId: payment?.id ?? null,
        reservationId: payment?.reservation_id ?? null,
        processingStatus: verification.verified ? "processing" : "failed",
        processingError: verification.verified ? null : verification.error,
    });

    let ledger: { id: string; processing_status: WebhookEventRow["processing_status"] } | null = null;
    const { data: insertedLedger, error: ledgerError } = await supabase
        .from("payment_webhook_events")
        .insert(ledgerInsert)
        .select("id,processing_status")
        .single();

    if (!ledgerError) {
        ledger = insertedLedger;
    } else if (ledgerError.code === "23505") {
        // Any failed delivery is retryable once the current request verifies
        // successfully. This includes a first attempt that failed PayPal
        // postback verification; otherwise the unique ledger row would make a
        // later valid retry an eternal 200 duplicate.
            const { data: existingLedger, error: existingLedgerError } = await supabase
                .from("payment_webhook_events")
            .select("id,processing_status,verification_status,updated_at")
            .eq("provider", "paypal")
            .eq("provider_event_id", verification.providerEventId)
            .maybeSingle();
        if (existingLedgerError) {
            return NextResponse.json({ ok: false, error: existingLedgerError.message }, { status: 500 });
        }
        const staleProcessing = existingLedger?.processing_status === "processing"
            && Date.parse(existingLedger.updated_at) < Date.now() - WEBHOOK_PROCESSING_LEASE_MS;
        const reclaimable = existingLedger
            && (existingLedger.processing_status === "failed" || staleProcessing);
        if (!reclaimable) {
            return NextResponse.json({ ok: true, duplicate: true });
        }
        if (!verification.verified) {
            return NextResponse.json({ ok: false, error: verification.error ?? "PayPal webhook verification failed." }, { status: 401 });
        }

        const { data: reclaimedLedger, error: reclaimError } = await supabase
            .from("payment_webhook_events")
            .update({
                processing_status: "processing",
                processing_error: null,
                processed_at: null,
                updated_at: new Date().toISOString(),
            })
            .eq("id", existingLedger.id)
            .eq("processing_status", existingLedger.processing_status)
            .select("id,processing_status")
            .maybeSingle();
        if (reclaimError) {
            return NextResponse.json({ ok: false, error: reclaimError.message }, { status: 500 });
        }
        ledger = reclaimedLedger;
        if (!ledger) return NextResponse.json({ ok: true, duplicate: true });
    } else {
        return NextResponse.json({ ok: false, error: ledgerError.message }, { status: 500 });
    }

    if (!verification.verified) {
        return NextResponse.json({ ok: false, error: verification.error ?? "Webhook verification failed." }, { status: 401 });
    }

    if (!resource) {
        await markLedgerProcessed(supabase, ledger.id, "ignored", "PayPal webhook resource is missing.");
        return NextResponse.json({ ok: true, ignored: true });
    }

    const eventId = verification.providerEventId;
    const eventType = verification.providerEventType;

    try {
        if (!payment) {
            await markLedgerProcessed(supabase, ledger.id, "ignored", "No local booking payment matched this PayPal event.");
            return NextResponse.json({ ok: true, ignored: true });
        }

        if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
            const result = await handleCaptureCompleted({ supabase, payment, resource, eventId, eventType });
            await markLedgerProcessed(
                supabase,
                ledger.id,
                result === "processed" ? "processed" : "ignored",
                result === "ignored" ? "Payment state already advanced; capture event was retained for audit." : null,
            );
            return NextResponse.json({ ok: true, ignored: result === "ignored" });
        }

        if (
            eventType === "PAYMENT.CAPTURE.DENIED"
            || eventType === "PAYMENT.CAPTURE.REFUNDED"
            || eventType === "PAYMENT.CAPTURE.REVERSED"
        ) {
            const result = await handleNegativeCaptureEvent({ supabase, payment, resource, eventId, eventType });
            await markLedgerProcessed(supabase, ledger.id, result === "processed" ? "processed" : "ignored", result === "ignored" ? "Payment state already advanced; negative capture event was ignored." : null);
            return NextResponse.json({ ok: true, ignored: result === "ignored" });
        }

        if (eventType === "CHECKOUT.ORDER.APPROVED") {
            const result = await handleOrderApproved({ supabase, payment, resource, eventId, eventType });
            await markLedgerProcessed(
                supabase,
                ledger.id,
                result === "processed" ? "processed" : "ignored",
                result === "ignored" ? "Payment state already advanced; order-approved event was ignored." : null,
            );
            return NextResponse.json({ ok: true, informational: true, ignored: result === "ignored" });
        }

        await markLedgerProcessed(supabase, ledger.id, "ignored");
        return NextResponse.json({ ok: true, ignored: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : "PayPal webhook processing failed.";
        console.error("[paypal] webhook processing failed", message);
        await markLedgerProcessed(supabase, ledger.id, "failed", message);
        return NextResponse.json({ ok: false, error: "PayPal webhook processing failed." }, { status: 500 });
    }
}
