import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { dispatchBookingEmails, recoverPendingBookingEmailOutbox } from "@/features/booking/lib/booking-emails";
import {
    bookingEmailCronStatus,
    mergeBookingEmailDeliveryOutcomes,
} from "@/features/booking/lib/booking-email-delivery-outcome";
import { expireUnpaidBookingReservationsByPaymentWindow } from "@/features/booking/lib/payment-expiry";
import { getPayPalOrder, type PayPalCaptureResult } from "@/features/booking/lib/paypal";
import { reconcileVerifiedBookingCommercialArtifacts } from "@/features/booking/lib/commercial-reconciliation";
import { retryPendingPayPalCheckout, verifyBookingPaymentAndMaybeConfirm } from "@/features/booking/actions";
import { recordBookingBusinessEvent } from "@/features/business-spine/service";
import { recordPaymentBusinessEvent } from "@/features/business-spine/recorders";
import { resolveBookingFollowupOutcome } from "@/features/booking/lib/booking-followup-outcome";
import type { Database, Json, Tables, TablesUpdate } from "@/shared/lib/supabase/database.types";

const HOUR_MS = 60 * 60 * 1000;
const REMINDER_WINDOWS = [
    { windowId: "deadline_6h", startsWithinMs: 6 * HOUR_MS, reason: "Payment deadline is within 6 hours." },
    { windowId: "deadline_1h", startsWithinMs: HOUR_MS, reason: "Payment deadline is within 1 hour." },
] as const;
const APPOINTMENT_WINDOWS = [
    { windowId: "appointment_24h", startsWithinMs: 24 * HOUR_MS, reason: "Appointment starts within 24 hours." },
    { windowId: "appointment_1h", startsWithinMs: HOUR_MS, reason: "Appointment starts within 1 hour." },
] as const;
const MAX_DELIVERY_ATTEMPTS = 5;
const MAX_PAYPAL_ORDER_RETRIES = 5;
const PENDING_CAPTURE_MARKERS = [
    "CAPTURE_PENDING_RECONCILIATION",
    "CAPTURE_COMPLETED_PENDING_RECONCILIATION",
] as const;
const OPEN_PAYPAL_ORDER_STATUSES = new Set(["CREATED", "PAYER_ACTION_REQUIRED", "APPROVED"]);
const TERMINAL_PAYPAL_ORDER_STATUSES = new Set([
    "VOIDED",
    "CANCELLED",
    "EXPIRED",
    "DENIED",
    "DECLINED",
    "FAILED",
]);
const TERMINAL_PAYPAL_CAPTURE_STATUSES = new Set([
    "DENIED",
    "DECLINED",
    "FAILED",
    "REVERSED",
    "REFUNDED",
    "CANCELLED",
    "VOIDED",
]);

function dueWindow<T extends { startsWithinMs: number }>(windows: readonly T[], remainingMs: number): T | null {
    return [...windows]
        .sort((left, right) => left.startsWithinMs - right.startsWithinMs)
        .find((window) => remainingMs <= window.startsWithinMs) ?? null;
}

function getAcceptedSecrets(): string[] {
    return [process.env.BOOKING_PAYMENT_FOLLOWUP_SECRET, process.env.CRON_SECRET]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value));
}

function authorize(req: NextRequest): boolean {
    const header = req.headers.get("authorization");
    if (!header?.startsWith("Bearer ")) return false;
    const candidate = header.slice("Bearer ".length).trim();
    const cBuf = Buffer.from(candidate);
    return getAcceptedSecrets().some((secret) => {
        const sBuf = Buffer.from(secret);
        if (cBuf.length !== sBuf.length) return false;
        return timingSafeEqual(cBuf, sBuf);
    });
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

async function deliveryAttemptState(params: {
    supabase: ReturnType<typeof getServiceRoleClient>;
    workspaceId: string;
    reservationId: string;
    eventType: Database["public"]["Enums"]["booking_notification_event_type"];
    reminderWindow?: string;
    recipientRole?: "customer" | "manager";
    eventInstanceKey?: string;
}) {
    let query = params.supabase
        .from("booking_notification_events")
        .select("id,delivery_status")
        .eq("workspace_id", params.workspaceId)
        .eq("reservation_id", params.reservationId)
        .eq("event_type", params.eventType)
        .eq("channel", "email")
        .contains("payload_json", { recipientRole: params.recipientRole ?? "customer" })
        .limit(MAX_DELIVERY_ATTEMPTS);

    if (params.reminderWindow) {
        query = query.contains("payload_json", { reminderWindow: params.reminderWindow });
    }
    if (params.eventInstanceKey) {
        query = query.contains("payload_json", { eventInstanceKey: params.eventInstanceKey });
    }

    const { data, error } = await query;
    if (error) return { succeeded: false, exhausted: false, queryFailed: true };
    return {
        succeeded: (data ?? []).some((row) => row.delivery_status === "sent" || row.delivery_status === "delivered"),
        exhausted: (data?.length ?? 0) >= MAX_DELIVERY_ATTEMPTS,
        queryFailed: false,
    };
}

function recordFromJson(value: Json | null | undefined): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function rawPath(root: unknown, path: Array<string | number>): unknown {
    let current: unknown = root;
    for (const segment of path) {
        if (typeof segment === "number") {
            if (!Array.isArray(current)) return undefined;
            current = current[segment];
        } else {
            if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
            current = (current as Record<string, unknown>)[segment];
        }
    }
    return current;
}

function rawString(value: unknown): string | null {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function validateReconciledCapture(
    payment: Tables<"booking_payments">,
    capture: PayPalCaptureResult,
) {
    if (capture.orderId !== payment.paypal_order_id) {
        throw new Error("PayPal reconciliation order does not match the local payment.");
    }
    if (capture.captureStatus !== "COMPLETED" || capture.orderStatus !== "COMPLETED") {
        throw new Error("PayPal order is not captured yet.");
    }
    if (capture.amountCents !== payment.amount_cents) {
        throw new Error("PayPal reconciliation amount does not match the local payment.");
    }
    if ((capture.currency ?? "").toUpperCase() !== payment.currency.toUpperCase()) {
        throw new Error("PayPal reconciliation currency does not match the local payment.");
    }

    const purchaseUnit = rawPath(capture.raw, ["purchase_units", 0]);
    const customId = rawString(rawPath(purchaseUnit, ["custom_id"]));
    const referenceId = rawString(rawPath(purchaseUnit, ["reference_id"]));
    const invoiceId = rawString(rawPath(purchaseUnit, ["invoice_id"]));
    if (customId && customId !== payment.id) throw new Error("PayPal reconciliation custom ID does not match the local payment.");
    if (referenceId && referenceId !== payment.payment_reference) throw new Error("PayPal reconciliation reference does not match the booking.");
    if (invoiceId && invoiceId !== payment.payment_reference) throw new Error("PayPal reconciliation invoice does not match the booking.");
}

function isAssociationMismatch(error: unknown): boolean {
    return error instanceof Error && /does not match/i.test(error.message);
}

async function quarantineReconciliationFailure(params: {
    supabase: ReturnType<typeof getServiceRoleClient>;
    payment: Tables<"booking_payments">;
    order: Awaited<ReturnType<typeof getPayPalOrder>>;
    reason: string;
}): Promise<void> {
    const now = new Date();
    const nowIso = now.toISOString();
    const metadata = {
        ...recordFromJson(params.payment.metadata),
        capturePendingReconciliation: false,
        paypalReconciliationTerminal: true,
        paypalReconciliationLastError: params.reason.slice(0, 500),
        paypalReconciliationLastCheckedAt: nowIso,
        paypalReconciliationRaw: params.order.raw,
    } as Json;
    const { data: failedPayment, error: updateError } = await params.supabase
        .from("booking_payments")
        .update({
            status: "failed",
            paypal_status: "PAYPAL_CAPTURE_DENIED",
            payment_url: null,
            failure_reason: `PayPal reconciliation stopped: ${params.reason}`.slice(0, 500),
            provider_event_type: "PAYPAL_RECONCILIATION_FAILURE",
            provider_synced_at: nowIso,
            metadata,
            updated_at: nowIso,
        })
        .eq("id", params.payment.id)
        .eq("workspace_id", params.payment.workspace_id)
        .eq("status", "requested")
        .in("paypal_status", [...PENDING_CAPTURE_MARKERS])
        .select("id")
        .maybeSingle();
    if (updateError) throw new Error(updateError.message);
    if (!failedPayment) return;

    // A validation mismatch is not safe to retry forever: release the local
    // hold, preserve the provider evidence, and put an explicit operator
    // reconciliation item in the Business Spine. The expiry helper is also
    // the crash-recovery fence if this process stops between these writes.
    await params.supabase
        .from("workspace_work_items" as never)
        .upsert({
            workspace_id: params.payment.workspace_id,
            customer_id: null,
            title: "Review PayPal reconciliation failure",
            description: params.reason.slice(0, 1000),
            kind: "payment_reconciliation",
            status: "open",
            priority: "urgent",
            source_module: "payments",
            source_entity_type: "booking_payment",
            source_entity_id: params.payment.id,
            idempotency_key: `work:payment-reconciliation:${params.payment.id}`,
            metadata: {
                paymentId: params.payment.id,
                reservationId: params.payment.reservation_id,
                paypalOrderId: params.payment.paypal_order_id,
                reason: params.reason,
            } as Json,
        } as never, { onConflict: "workspace_id,idempotency_key" } as never);
    await recordPaymentBusinessEvent({
        supabase: params.supabase,
        workspaceId: params.payment.workspace_id,
        eventType: "failed",
        paymentId: params.payment.id,
        bookingId: params.payment.reservation_id,
        amountCents: params.payment.amount_cents,
        currency: params.payment.currency,
        providerEventId: params.payment.paypal_order_id,
        netAmountCents: params.payment.net_amount_cents,
        vatAmountCents: params.payment.vat_amount_cents,
        vatRateBasisPoints: params.payment.vat_rate_basis_points,
        grossAmountCents: params.payment.gross_amount_cents,
        payload: {
            source: "paypal_reconciliation",
            reconciliationRequired: true,
            reason: params.reason,
        },
    });
    const recovery = await expireUnpaidBookingReservationsByPaymentWindow({
        supabase: params.supabase,
        workspaceId: params.payment.workspace_id,
        now,
        limit: 100,
    });
    if (recovery.error) throw new Error(recovery.error);
}

async function reconcilePendingPayPalCaptures(
    supabase: ReturnType<typeof getServiceRoleClient>,
): Promise<{ reconciled: number; restored: number; errors: number }> {
    const { data: pendingPayments, error } = await supabase
        .from("booking_payments")
        .select("*")
        .eq("provider", "paypal_checkout")
        .eq("status", "requested")
        .in("paypal_status", [...PENDING_CAPTURE_MARKERS])
        .not("paypal_order_id", "is", null)
        .order("updated_at", { ascending: true })
        .limit(100);
    if (error) {
        console.error(`[paypal-reconciliation] failed to query pending captures: ${error.message}`);
        return { reconciled: 0, restored: 0, errors: 1 };
    }

    let reconciled = 0;
    let restored = 0;
    let errors = 0;
    const processPayment = async (payment: Tables<"booking_payments">) => {
        if (!payment.paypal_order_id) return;
        try {
            const order = await getPayPalOrder(payment.paypal_order_id);
            if (order.capture) {
                const providerCaptureStatus = order.capture.captureStatus?.toUpperCase() ?? null;
                if (providerCaptureStatus && TERMINAL_PAYPAL_CAPTURE_STATUSES.has(providerCaptureStatus)) {
                    await quarantineReconciliationFailure({
                        supabase,
                        payment,
                        order,
                        reason: `PayPal capture reached terminal status ${providerCaptureStatus}.`,
                    });
                    return;
                }
                try {
                    validateReconciledCapture(payment, order.capture);
                } catch (validationError) {
                    if (!isAssociationMismatch(validationError)) throw validationError;
                    await quarantineReconciliationFailure({
                        supabase,
                        payment,
                        order,
                        reason: validationError instanceof Error ? validationError.message : "PayPal reconciliation association failed.",
                    });
                    return;
                }
                const capture = order.capture;
                const existingCaptureHistory = recordFromJson(payment.metadata).paypalCaptureHistory;
                const captureHistory = Array.isArray(existingCaptureHistory)
                    ? existingCaptureHistory.filter((id: unknown): id is string => typeof id === "string")
                    : [];
                const paymentUpdate: TablesUpdate<"booking_payments"> = {
                    paypal_capture_id: capture.captureId,
                    paypal_payer_id: capture.payerId,
                    paypal_payer_email: capture.payerEmail,
                    paypal_status: capture.captureStatus,
                    paypal_fee_cents: capture.paypalFeeCents,
                    paypal_net_cents: capture.paypalNetCents,
                    provider_event_id: capture.captureId,
                    provider_event_type: "PAYPAL_RECONCILIATION_CAPTURE",
                    provider_synced_at: new Date().toISOString(),
                    metadata: {
                        ...recordFromJson(payment.metadata),
                        paypalCaptureHistory: Array.from(new Set([
                            ...captureHistory,
                            capture.captureId,
                        ])).slice(-20),
                        paypalReconciliationRaw: capture.raw,
                        capturePendingReconciliation: false,
                    } as Json,
                };
                await verifyBookingPaymentAndMaybeConfirm({
                    supabase,
                    workspaceId: payment.workspace_id,
                    reservationId: payment.reservation_id,
                    paymentId: payment.id,
                    actorId: null,
                    actorType: "system",
                    triggerSource: "system",
                    note: "PayPal capture reconciled after an interrupted checkout callback.",
                    autoConfirm: true,
                    verificationSource: "paypal_webhook",
                    expectedPaypalOrderId: payment.paypal_order_id,
                    paymentUpdate,
                    metadata: {
                        providerEventId: capture.captureId,
                        providerEventType: "PAYPAL_RECONCILIATION_CAPTURE",
                        paypalOrderId: capture.orderId,
                        paypalCaptureId: capture.captureId,
                    },
                });
                await recordPaymentBusinessEvent({
                    supabase,
                    workspaceId: payment.workspace_id,
                    eventType: "captured",
                    paymentId: payment.id,
                    bookingId: payment.reservation_id,
                    amountCents: payment.amount_cents,
                    currency: payment.currency,
                    providerEventId: capture.captureId,
                    netAmountCents: payment.net_amount_cents,
                    vatAmountCents: payment.vat_amount_cents,
                    vatRateBasisPoints: payment.vat_rate_basis_points,
                    grossAmountCents: payment.gross_amount_cents,
                    payload: { source: "paypal_reconciliation", orderId: capture.orderId, captureId: capture.captureId },
                });
                reconciled += 1;
                return;
            }

            // The provider says the order is still open. Clear only the
            // interrupted-capture marker so the ordinary expiry/reminder
            // worker can safely handle the hold again.
            const providerOrderStatus = order.status?.toUpperCase() ?? null;
            if (providerOrderStatus && OPEN_PAYPAL_ORDER_STATUSES.has(providerOrderStatus)) {
                const { error: restoreError } = await supabase
                    .from("booking_payments")
                    .update({
                        paypal_status: order.status,
                        provider_synced_at: new Date().toISOString(),
                        metadata: {
                            ...recordFromJson(payment.metadata),
                            capturePendingReconciliation: false,
                            paypalReconciliationLastCheckedAt: new Date().toISOString(),
                            paypalReconciliationRaw: order.raw,
                        } as Json,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", payment.id)
                    .eq("workspace_id", payment.workspace_id)
                    .eq("status", "requested")
                    .in("paypal_status", [...PENDING_CAPTURE_MARKERS]);
                if (restoreError) throw new Error(restoreError.message);
                restored += 1;
            } else if (providerOrderStatus && TERMINAL_PAYPAL_ORDER_STATUSES.has(providerOrderStatus)) {
                await quarantineReconciliationFailure({
                    supabase,
                    payment,
                    order,
                    reason: `PayPal order reached terminal status ${providerOrderStatus} without a completed capture.`,
                });
                restored += 1;
            } else if (providerOrderStatus === "COMPLETED") {
                // A completed order without a capture payload is not a safe
                // state to keep retrying: quarantine it for manual provider
                // reconciliation instead of holding the booking forever.
                await quarantineReconciliationFailure({
                    supabase,
                    payment,
                    order,
                    reason: "PayPal order is completed but contains no completed capture payload.",
                });
                restored += 1;
            }
        } catch (reconciliationError) {
            errors += 1;
            const message = reconciliationError instanceof Error ? reconciliationError.message : "PayPal reconciliation failed.";
            console.warn(`[paypal-reconciliation] payment ${payment.id}: ${message}`);
            await supabase
                .from("booking_payments")
                .update({
                    metadata: {
                        ...recordFromJson(payment.metadata),
                        capturePendingReconciliation: true,
                        paypalReconciliationLastError: message.slice(0, 500),
                        paypalReconciliationLastCheckedAt: new Date().toISOString(),
                    } as Json,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", payment.id)
                .eq("workspace_id", payment.workspace_id)
                .eq("status", "requested")
                .in("paypal_status", [...PENDING_CAPTURE_MARKERS]);
        }
    };

    // Provider calls are bounded individually, but a sequential batch of 100
    // orders could still monopolize the hourly worker for 25 minutes. Keep a
    // small fixed concurrency so retries finish within one cron interval
    // without creating an outbound request burst.
    const queue = (pendingPayments ?? []) as Tables<"booking_payments">[];
    let nextIndex = 0;
    const worker = async () => {
        while (true) {
            const index = nextIndex++;
            if (index >= queue.length) return;
            await processPayment(queue[index]);
        }
    };
    await Promise.all(Array.from({ length: Math.min(5, queue.length) }, () => worker()));
    return { reconciled, restored, errors };
}

async function retryMissingPayPalCheckouts(
    supabase: ReturnType<typeof getServiceRoleClient>,
): Promise<{ retried: number; exhausted: number; errors: number }> {
    const { data: payments, error } = await supabase
        .from("booking_payments")
        .select("id,workspace_id,reservation_id,payment_url,paypal_order_id,metadata,booking_reservations!booking_payments_workspace_reservation_fk!inner(status)")
        .eq("provider", "paypal_checkout")
        .eq("status", "requested")
        .eq("booking_reservations.status", "pending_confirmation")
        .or("paypal_order_id.is.null,payment_url.is.null")
        .order("updated_at", { ascending: true })
        .limit(100);
    if (error) {
        console.error(`[paypal-retry] failed to query missing checkout orders: ${error.message}`);
        return { retried: 0, exhausted: 0, errors: 1 };
    }

    let retried = 0;
    let exhausted = 0;
    let errors = 0;
    for (const payment of payments ?? []) {
        const metadata = recordFromJson(payment.metadata);
        const retryCount = typeof metadata.paypalRetryCount === "number" && Number.isInteger(metadata.paypalRetryCount)
            ? metadata.paypalRetryCount
            : 0;
        const retryNextAt = typeof metadata.paypalRetryNextAt === "string"
            ? Date.parse(metadata.paypalRetryNextAt)
            : Number.NaN;
        if (retryCount >= MAX_PAYPAL_ORDER_RETRIES) {
            exhausted += 1;
            continue;
        }
        if (Number.isFinite(retryNextAt) && retryNextAt > Date.now()) continue;
        if (await retryPendingPayPalCheckout({
            supabase,
            workspaceId: payment.workspace_id,
            reservationId: payment.reservation_id,
        })) {
            retried += 1;
        } else {
            errors += 1;
        }
    }
    return { retried, exhausted, errors };
}

export async function POST(req: NextRequest) {
    if (getAcceptedSecrets().length === 0) {
        return NextResponse.json(
            { ok: false, error: "Booking payment follow-up endpoint is not configured." },
            { status: 503 },
        );
    }

    if (!authorize(req)) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
        const supabase = getServiceRoleClient();
        const now = new Date();
        const paypalRetry = await retryMissingPayPalCheckouts(supabase);
        const paypalReconciliation = await reconcilePendingPayPalCaptures(supabase);
        const paymentWindowExpiry = await expireUnpaidBookingReservationsByPaymentWindow({ supabase, now });

        if (paymentWindowExpiry.error) {
            return NextResponse.json({ ok: false, error: paymentWindowExpiry.error }, { status: 500 });
        }
        let bookingEmailDelivery = await recoverPendingBookingEmailOutbox({
            supabase,
            since: new Date(now.getTime() - 30 * 24 * HOUR_MS),
            limit: 200,
        });
        let deliveryQueryFailures = 0;
        let exhaustedDeliveries = 0;
        const bookingEmailOutboxRecovered = bookingEmailDelivery.sent;
        const commercialReconciliation = await reconcileVerifiedBookingCommercialArtifacts(
            supabase as unknown as import("@supabase/supabase-js").SupabaseClient,
        );

        const maxReminderDeadline = new Date(now.getTime() + Math.max(...REMINDER_WINDOWS.map((window) => window.startsWithinMs))).toISOString();

        const { data: pendingPayments, error: pendingError } = await supabase
            .from("booking_payments")
            .select("id,workspace_id,reservation_id,deadline_at,booking_reservations!booking_payments_workspace_reservation_fk!inner(id,status)")
            .eq("status", "requested")
            // Cancel returns keep the requested row for auditability; they are
            // not active holds and must not receive payment reminders. A
            // browser capture failure is expiry-retryable, but it is not an
            // approval state that should receive another payment nudge.
            .or("paypal_status.is.null,paypal_status.in.(CREATED,PAYER_ACTION_REQUIRED,APPROVED)")
            .eq("booking_reservations.status", "pending_confirmation")
            .not("payment_url", "is", null)
            .not("deadline_at", "is", null)
            .gt("deadline_at", now.toISOString())
            .lte("deadline_at", maxReminderDeadline)
            .limit(500);

        if (pendingError) {
            return NextResponse.json({ ok: false, error: pendingError.message }, { status: 500 });
        }

        let remindersSent = 0;
        for (const payment of pendingPayments ?? []) {
            if (!payment.deadline_at) continue;
            const msUntilDeadline = new Date(payment.deadline_at).getTime() - now.getTime();
            const window = dueWindow(REMINDER_WINDOWS, msUntilDeadline);
            if (window) {
                const delivery = await deliveryAttemptState({
                    supabase,
                    workspaceId: payment.workspace_id,
                    reservationId: payment.reservation_id,
                    eventType: "payment_reminder",
                    reminderWindow: window.windowId,
                });
                if (delivery.queryFailed) { deliveryQueryFailures += 1; continue; }
                if (delivery.exhausted) { exhaustedDeliveries += 1; continue; }
                if (delivery.succeeded) continue;

                const deliveryOutcome = await dispatchBookingEmails({
                    supabase,
                    workspaceId: payment.workspace_id,
                    reservationId: payment.reservation_id,
                    eventType: "payment_reminder",
                    reason: window.reason,
                    reminderWindow: window.windowId,
                });
                bookingEmailDelivery = mergeBookingEmailDeliveryOutcomes(bookingEmailDelivery, deliveryOutcome);
                remindersSent += deliveryOutcome.sent;
            }
        }

        const { data: expiredCount, error: expireError } = await supabase.rpc("booking_expire_unpaid_reservations", {});
        if (expireError) {
            return NextResponse.json({ ok: false, error: expireError.message }, { status: 500 });
        }

        // Detect stuck payments: status mismatches, failed captures, or requested past deadlines
        const { data: paymentsForDetection, error: detectionError } = await supabase
            .from("booking_payments")
            .select("id, status, provider, deadline_at, created_at, paypal_order_id, paypal_status, booking_reservations!booking_payments_workspace_reservation_fk!inner(id, public_reference, customer_full_name, status)")
            .in("status", ["requested", "failed", "verified"])
            // Detect only states that can still represent a live or
            // reconciliation-required checkout. Completed/expired/cancelled
            // provider markers are terminal and should not be reported as
            // stuck payment attempts.
            .or("paypal_status.is.null,paypal_status.in.(CREATED,PAYER_ACTION_REQUIRED,APPROVED,RETURN_CAPTURE_FAILED,CAPTURE_PENDING_RECONCILIATION,CAPTURE_COMPLETED_PENDING_RECONCILIATION)")
            .in("booking_reservations.status", ["pending_confirmation", "confirmed"]);

        if (detectionError) {
            console.error(`[stuck-payments-detection] failed to query payments: ${detectionError.message}`);
        }

        const stuckPayments = (paymentsForDetection ?? []).filter((payment) => {
            const reservation = Array.isArray(payment.booking_reservations)
                ? payment.booking_reservations[0]
                : payment.booking_reservations;
            if (!reservation) return false;

            const isMismatch1 = payment.status === 'verified' && reservation.status === 'pending_confirmation';
            const isMismatch2 = payment.status !== 'verified' && reservation.status === 'confirmed';
            const isStuckPaypal = payment.provider === 'paypal_checkout' &&
                                  payment.status === 'requested' &&
                                  payment.paypal_order_id &&
                                  new Date(payment.created_at).getTime() < now.getTime() - 30 * 60 * 1000;
            const isDeadlinePassed = payment.status === 'requested' &&
                                     payment.deadline_at &&
                                     new Date(payment.deadline_at).getTime() < now.getTime();
            const isFailed = payment.status === 'failed';

            return isMismatch1 || isMismatch2 || isStuckPaypal || isDeadlinePassed || isFailed;
        });

        const { data: expiredReservations, error: expiredLookupError } = await supabase
            .from("booking_reservations")
            .select("id,workspace_id,updated_at,booking_payments!booking_payments_workspace_reservation_fk!inner(id,status)")
            .eq("status", "expired")
            .eq("booking_payments.status", "expired")
            .limit(500);

        if (expiredLookupError) {
            return NextResponse.json({ ok: false, error: expiredLookupError.message }, { status: 500 });
        }

        // Reconcile Business Spine facts for both the TypeScript expiry path
        // and the SQL fallback sweep. Recorder idempotency keys make this
        // safe when the same expired row is observed on later cron runs.
        for (const reservation of expiredReservations ?? []) {
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
                    payload: { source: "payment_followups_expiry_sweep" },
                });
            }
        }

        let expiryEmailsSent = 0;
        for (const reservation of expiredReservations ?? []) {
            const delivery = await deliveryAttemptState({
                supabase,
                workspaceId: reservation.workspace_id,
                reservationId: reservation.id,
                eventType: "payment_expired",
            });
            if (delivery.queryFailed) { deliveryQueryFailures += 1; continue; }
            if (delivery.exhausted) { exhaustedDeliveries += 1; continue; }
            if (delivery.succeeded) continue;

            const deliveryOutcome = await dispatchBookingEmails({
                supabase,
                workspaceId: reservation.workspace_id,
                reservationId: reservation.id,
                eventType: "payment_expired",
                reason: "Payment deadline passed without verification.",
            });
            bookingEmailDelivery = mergeBookingEmailDeliveryOutcomes(bookingEmailDelivery, deliveryOutcome);
            expiryEmailsSent += deliveryOutcome.sent;
        }

        const appointmentDeadline = new Date(
            now.getTime() + Math.max(...APPOINTMENT_WINDOWS.map((window) => window.startsWithinMs)),
        ).toISOString();
        const { data: upcomingReservations, error: appointmentError } = await supabase
            .from("booking_reservations")
            .select("id,workspace_id,scheduled_start")
            .eq("status", "confirmed")
            .gt("scheduled_start", now.toISOString())
            .lte("scheduled_start", appointmentDeadline)
            .limit(500);

        if (appointmentError) {
            return NextResponse.json({ ok: false, error: appointmentError.message }, { status: 500 });
        }

        let appointmentRemindersSent = 0;
        for (const reservation of upcomingReservations ?? []) {
            const msUntilStart = new Date(reservation.scheduled_start).getTime() - now.getTime();
            const window = dueWindow(APPOINTMENT_WINDOWS, msUntilStart);
            if (window) {
                const delivery = await deliveryAttemptState({
                    supabase,
                    workspaceId: reservation.workspace_id,
                    reservationId: reservation.id,
                    eventType: "appointment_reminder",
                    reminderWindow: window.windowId,
                });
                if (delivery.queryFailed) { deliveryQueryFailures += 1; continue; }
                if (delivery.exhausted) { exhaustedDeliveries += 1; continue; }
                if (delivery.succeeded) continue;

                const deliveryOutcome = await dispatchBookingEmails({
                    supabase,
                    workspaceId: reservation.workspace_id,
                    reservationId: reservation.id,
                    eventType: "appointment_reminder",
                    reason: window.reason,
                    reminderWindow: window.windowId,
                });
                bookingEmailDelivery = mergeBookingEmailDeliveryOutcomes(bookingEmailDelivery, deliveryOutcome);
                appointmentRemindersSent += deliveryOutcome.sent;
            }
        }

        const { data: failedNotifications, error: failedNotificationsError } = await supabase
            .from("booking_notification_events")
            .select("workspace_id,reservation_id,event_type,payload_json,created_at,delivery_status,claim_expires_at")
            .eq("channel", "email")
            .in("delivery_status", ["failed", "skipped", "pending"])
            .gte("created_at", new Date(now.getTime() - 30 * 24 * HOUR_MS).toISOString())
            .order("created_at", { ascending: true })
            .limit(200);
        if (failedNotificationsError) {
            return NextResponse.json({ ok: false, error: failedNotificationsError.message }, { status: 500 });
        }

        const retryKeys = new Set<string>();
        let failedDeliveriesRetried = 0;
        for (const failed of failedNotifications ?? []) {
            const pendingClaimExpired = failed.delivery_status === "pending"
                && (!failed.claim_expires_at || new Date(failed.claim_expires_at).getTime() <= now.getTime());
            if (failed.delivery_status === "pending" && !pendingClaimExpired) continue;
            const payload = failed.payload_json && typeof failed.payload_json === "object" && !Array.isArray(failed.payload_json)
                ? failed.payload_json as Record<string, unknown>
                : {};
            const reminderWindow = typeof payload.reminderWindow === "string" ? payload.reminderWindow : undefined;
            const eventInstanceKey = typeof payload.eventInstanceKey === "string" ? payload.eventInstanceKey : undefined;
            const recipientRole = payload.recipientRole === "manager" ? "manager" : "customer";
            const retryKey = `${failed.reservation_id}:${failed.event_type}:${reminderWindow ?? ""}:${eventInstanceKey ?? ""}:${recipientRole}`;
            if (retryKeys.has(retryKey)) continue;
            retryKeys.add(retryKey);

            const delivery = await deliveryAttemptState({
                supabase,
                workspaceId: failed.workspace_id,
                reservationId: failed.reservation_id,
                eventType: failed.event_type,
                reminderWindow,
                recipientRole,
                eventInstanceKey,
            });
            if (delivery.queryFailed) { deliveryQueryFailures += 1; continue; }
            if (delivery.exhausted) { exhaustedDeliveries += 1; continue; }
            if (delivery.succeeded) continue;
            const deliveryOutcome = await dispatchBookingEmails({
                supabase,
                workspaceId: failed.workspace_id,
                reservationId: failed.reservation_id,
                eventType: failed.event_type,
                reason: typeof payload.reason === "string" ? payload.reason : "Automatic delivery retry.",
                reminderWindow,
                eventInstanceKey,
            });
            bookingEmailDelivery = mergeBookingEmailDeliveryOutcomes(bookingEmailDelivery, deliveryOutcome);
            failedDeliveriesRetried += deliveryOutcome.sent;
        }

        const { data: completedReservations, error: completedError } = await supabase
            .from("booking_reservations")
            .select("id,workspace_id,updated_at")
            .eq("status", "completed")
            .gte("updated_at", new Date(now.getTime() - 30 * 24 * HOUR_MS).toISOString())
            .lte("updated_at", new Date(now.getTime() - HOUR_MS).toISOString())
            .limit(500);
        if (completedError) {
            return NextResponse.json({ ok: false, error: completedError.message }, { status: 500 });
        }

        let postSessionFollowupsSent = 0;
        for (const reservation of completedReservations ?? []) {
            const delivery = await deliveryAttemptState({
                supabase,
                workspaceId: reservation.workspace_id,
                reservationId: reservation.id,
                eventType: "post_session_followup",
            });
            if (delivery.queryFailed) { deliveryQueryFailures += 1; continue; }
            if (delivery.exhausted) { exhaustedDeliveries += 1; continue; }
            if (delivery.succeeded) continue;
            const deliveryOutcome = await dispatchBookingEmails({
                supabase,
                workspaceId: reservation.workspace_id,
                reservationId: reservation.id,
                eventType: "post_session_followup",
                reason: "Automatic post-session feedback and follow-up invitation.",
            });
            bookingEmailDelivery = mergeBookingEmailDeliveryOutcomes(bookingEmailDelivery, deliveryOutcome);
            postSessionFollowupsSent += deliveryOutcome.sent;
        }

        const emailDeliveryStatus = bookingEmailCronStatus(bookingEmailDelivery);
        const failures = bookingEmailDelivery.failed + bookingEmailDelivery.skipped
            + bookingEmailDelivery.persistence_degraded + deliveryQueryFailures + exhaustedDeliveries
            + paypalReconciliation.errors + paypalRetry.errors + paypalRetry.exhausted
            + commercialReconciliation.errors.length;
        const attempted = failures + bookingEmailDelivery.sent + paypalReconciliation.reconciled
            + paypalRetry.retried + commercialReconciliation.reconciled;
        const overall = resolveBookingFollowupOutcome({ attempted, failures });
        return NextResponse.json({
            ok: overall.ok,
            health: overall.health,
            emailDeliveryStatus,
            emailDelivery: bookingEmailDelivery,
            remindersSent,
            expiredCount: (expiredCount ?? 0) + paymentWindowExpiry.expiredCount,
            expiryEmailsSent,
            appointmentRemindersSent,
            failedDeliveriesRetried,
            bookingEmailOutboxRecovered,
            commercialArtifactsReconciled: commercialReconciliation.reconciled,
            commercialBookingsConfirmed: commercialReconciliation.confirmed,
            commercialArtifactErrors: commercialReconciliation.errors,
            postSessionFollowupsSent,
            paypalReconciled: paypalReconciliation.reconciled,
            paypalMarkersRestored: paypalReconciliation.restored,
            paypalReconciliationErrors: paypalReconciliation.errors,
            paypalCheckoutRetries: paypalRetry.retried,
            paypalCheckoutRetryExhausted: paypalRetry.exhausted,
            paypalCheckoutRetryErrors: paypalRetry.errors,
            deliveryQueryFailures,
            exhaustedDeliveries,
            stuckPaymentsCount: stuckPayments.length,
            stuckPayments: stuckPayments.map(p => ({
                id: p.id,
                provider: p.provider,
                status: p.status,
                reservationId: (Array.isArray(p.booking_reservations) ? p.booking_reservations[0]?.id : p.booking_reservations?.id) ?? null,
                reference: (Array.isArray(p.booking_reservations) ? p.booking_reservations[0]?.public_reference : p.booking_reservations?.public_reference) ?? null,
            })),
        }, {
            status: overall.status,
        });
    } catch (error) {
        return NextResponse.json(
            { ok: false, error: error instanceof Error ? error.message : "Booking payment follow-up failed." },
            { status: 500 },
        );
    }
}

export const GET = POST;
