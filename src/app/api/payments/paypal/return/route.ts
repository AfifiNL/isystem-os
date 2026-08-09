import { NextRequest, NextResponse } from "next/server";

import { capturePayPalOrder, PayPalApiError, type PayPalCaptureResult } from "@/features/booking/lib/paypal";
import { verifyBookingPaymentAndMaybeConfirm } from "@/features/booking/actions";
import { buildSiteUrl } from "@/shared/lib/auth/redirect-url";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import type { Json, TablesUpdate } from "@/shared/lib/supabase/database.types";
import { recordPaymentBusinessEvent } from "@/features/business-spine/recorders";
import { dispatchBookingEmails } from "@/features/booking/lib/booking-emails";
import { allowPayPalCallbackRequest } from "@/features/booking/lib/paypal-callback-rate-limit";
import { isSupportedLocale, localizeHref } from "@/shared/lib/i18n/routing";
import type { Locale } from "@/features/templates/types";

export const runtime = "nodejs";

const PAYMENT_RECEIVED_PATH = "/booking/payment-received";
const CAPTURABLE_PAYPAL_STATUSES = new Set([
    "CREATED",
    "PAYER_ACTION_REQUIRED",
    "APPROVED",
]);
const PAYMENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAYPAL_TOKEN_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function parseLocale(value: string | null | undefined): Locale {
    return isSupportedLocale(value) ? value : "en";
}

function buildRedirect(path: string, params: Record<string, string>, locale: Locale = "en") {
    const url = new URL(buildSiteUrl(localizeHref(locale, path)));
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
    }
    return url;
}

function buildPaymentResultRedirect(
    outcome: "success" | "pending" | "failed",
    params: { paymentId: string; reference?: string | null; reason?: string; locale?: Locale },
) {
    return buildRedirect(PAYMENT_RECEIVED_PATH, {
        status: outcome,
        payment_id: params.paymentId,
        ...(params.reference ? { reference: params.reference } : {}),
        ...(params.reason ? { reason: params.reason } : {}),
    }, params.locale ?? "en");
}

function buildPaymentLookupFailedRedirect(reason: string, locale: Locale = "en") {
    return buildRedirect(PAYMENT_RECEIVED_PATH, {
        status: "not_found",
        reason,
    }, locale);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function validateCaptureAssociation(capture: PayPalCaptureResult, payment: { id: string; payment_reference: string }) {
    const raw = capture.raw;
    const purchaseUnit = readPath(raw, ["purchase_units", 0]);
    const customId = readPath(purchaseUnit, ["custom_id"]);
    const referenceId = readPath(purchaseUnit, ["reference_id"]);
    const invoiceId = readPath(purchaseUnit, ["invoice_id"]);

    if (typeof customId === "string" && customId !== payment.id) {
        throw new Error("PayPal capture custom ID does not match the local payment.");
    }

    if (typeof referenceId === "string" && referenceId !== payment.payment_reference) {
        throw new Error("PayPal capture reference does not match the booking reference.");
    }

    if (typeof invoiceId === "string" && invoiceId !== payment.payment_reference) {
        throw new Error("PayPal capture invoice does not match the booking reference.");
    }
}

function isUnknownCaptureOutcome(error: unknown): boolean {
    if (!(error instanceof PayPalApiError)) return true;
    return error.status === 408 || error.status === 429 || error.status >= 500;
}

async function releaseReservationAfterCaptureFailure(params: {
    supabase: ReturnType<typeof createAdminClient>;
    workspaceId: string;
    reservationId: string;
    paymentId: string;
    reason: string;
}): Promise<boolean> {
    const now = new Date().toISOString();
    const { data: reservation, error: lookupError } = await params.supabase
        .from("booking_reservations")
        .select("id,status,metadata,extension_state_json")
        .eq("id", params.reservationId)
        .eq("workspace_id", params.workspaceId)
        .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    if (!reservation || reservation.status !== "pending_confirmation") return false;

    // The payment compare-and-set is the release fence. Re-read it here so a
    // concurrent customer cancellation cannot be overwritten by this stale
    // capture-failure callback.
    const { data: currentPayment, error: paymentLookupError } = await params.supabase
        .from("booking_payments")
        .select("status,paypal_status")
        .eq("id", params.paymentId)
        .eq("workspace_id", params.workspaceId)
        .maybeSingle();
    if (paymentLookupError) throw new Error(paymentLookupError.message);
    if (!currentPayment
        || currentPayment.paypal_status !== "RETURN_CAPTURE_FAILED"
        || (currentPayment.status !== "failed" && currentPayment.status !== "requested")) {
        return false;
    }

    const { data: released, error: releaseError } = await params.supabase
        .from("booking_reservations")
        .update({
            status: "expired",
            updated_at: now,
            metadata: {
                ...(isRecord(reservation.metadata) ? reservation.metadata : {}),
                paymentExtensionState: "failed",
                paymentFailedAt: now,
                paymentFailureReason: params.reason,
            } as Json,
            extension_state_json: {
                ...(isRecord(reservation.extension_state_json) ? reservation.extension_state_json : {}),
                payment: "failed",
            } as Json,
        })
        .eq("id", reservation.id)
        .eq("workspace_id", params.workspaceId)
        .eq("status", "pending_confirmation")
        .select("id")
        .maybeSingle();
    if (releaseError) throw new Error(releaseError.message);
    if (!released) return false;

    await params.supabase.from("booking_status_history").insert({
        workspace_id: params.workspaceId,
        reservation_id: params.reservationId,
        from_status: "pending_confirmation",
        to_status: "expired",
        trigger_source: "system",
        actor_type: "system",
        actor_id: null,
        reason: params.reason,
        payload_json: {
            source: "paypal_return",
            paymentId: params.paymentId,
        } as Json,
    });
    return true;
}

export async function GET(req: NextRequest) {
    const token = req.nextUrl.searchParams.get("token")?.trim();
    const paymentId = req.nextUrl.searchParams.get("payment_id")?.trim();
    const requestedLocale = parseLocale(req.nextUrl.searchParams.get("locale"));

    if (!token || !paymentId || !PAYMENT_ID_PATTERN.test(paymentId) || !PAYPAL_TOKEN_PATTERN.test(token)) {
        return NextResponse.redirect(buildPaymentLookupFailedRedirect("paypal_missing_parameters", requestedLocale));
    }

    const supabase = createAdminClient();
    if (!await allowPayPalCallbackRequest({ req, supabase, kind: "return" })) {
        return NextResponse.redirect(buildPaymentLookupFailedRedirect("paypal_rate_limited", requestedLocale), {
            status: 303,
            headers: { "Retry-After": "60" },
        });
    }

    const { data: payment, error: paymentError } = await supabase
        .from("booking_payments")
        .select("*")
        .eq("id", paymentId)
        .maybeSingle();

    if (paymentError || !payment) {
        return NextResponse.redirect(buildPaymentLookupFailedRedirect("paypal_not_found", requestedLocale));
    }

    const provider = payment.provider === "paypal" ? "paypal_checkout" : payment.provider;
    if (provider !== "paypal_checkout") {
        return NextResponse.redirect(buildPaymentLookupFailedRedirect("paypal_provider_mismatch", requestedLocale));
    }

    const paymentLocale = parseLocale(
        isRecord(payment.metadata) && typeof payment.metadata.locale === "string"
            ? payment.metadata.locale
            : requestedLocale,
    );

    if (payment.paypal_order_id !== token) {
        return NextResponse.redirect(buildPaymentResultRedirect("failed", {
            paymentId: payment.id,
            reference: payment.payment_reference,
            reason: "paypal_order_mismatch",
            locale: paymentLocale,
        }));
    }

    const { data: reservation } = await supabase
        .from("booking_reservations")
        .select("id,public_reference,status,workspace_id,attribution_json")
        .eq("id", payment.reservation_id)
        .eq("workspace_id", payment.workspace_id)
        .maybeSingle();

    const reference = reservation?.public_reference ?? payment.payment_reference;
    const locale = parseLocale(
        reservation && isRecord(reservation.attribution_json) && typeof reservation.attribution_json.locale === "string"
            ? reservation.attribution_json.locale
            : paymentLocale,
    );

    if (payment.status === "verified") {
        return NextResponse.redirect(buildPaymentResultRedirect("success", {
            paymentId: payment.id,
            reference,
            locale,
        }));
    }

    // Never capture an order from a terminal local payment row. A customer
    // can reopen an old PayPal return URL after expiry, failure, or refund;
    // attempting capture here could charge a stale order and then be rejected
    // by verifyBookingPaymentAndMaybeConfirm, leaving funds uncoupled from the
    // booking. Fresh checkout must create a new requested payment snapshot.
    if (payment.status !== "requested") {
        return NextResponse.redirect(buildPaymentResultRedirect("failed", {
            paymentId: payment.id,
            reference,
            reason: "paypal_payment_not_capturable",
            locale,
        }));
    }

    // A customer-management or operator cancellation can win just before an
    // old browser return is opened. Never capture a still-requested order for
    // a reservation that is no longer the active payment hold.
    if (!reservation || reservation.status !== "pending_confirmation") {
        return NextResponse.redirect(buildPaymentResultRedirect("failed", {
            paymentId: payment.id,
            reference,
            reason: "paypal_reservation_not_pending",
            locale,
        }));
    }

    // Provider callbacks can mark a requested local row with a terminal
    // failure (for example RETURN_CAPTURE_FAILED) while its local status is
    // still requested for expiry/audit purposes. Only the provider states
    // that PayPal permits capture may reach the capture API; otherwise an old
    // return URL could retry a failed or completed order.
    if (payment.paypal_status && !CAPTURABLE_PAYPAL_STATUSES.has(payment.paypal_status)) {
        if (payment.paypal_status === "CAPTURE_COMPLETED_PENDING_RECONCILIATION"
            || payment.paypal_status === "CAPTURE_PENDING_RECONCILIATION") {
            return NextResponse.redirect(buildPaymentResultRedirect("pending", {
                paymentId: payment.id,
                reference,
                reason: "paypal_capture_pending_reconciliation",
                locale,
            }));
        }
        return NextResponse.redirect(buildPaymentResultRedirect("failed", {
            paymentId: payment.id,
            reference,
            reason: payment.paypal_status === "CUSTOMER_CANCELLED"
                ? "paypal_checkout_cancelled"
                : "paypal_payment_not_capturable",
            locale,
        }));
    }

    if (payment.deadline_at && new Date(payment.deadline_at).getTime() <= Date.now()) {
        return NextResponse.redirect(buildPaymentResultRedirect("failed", {
            paymentId: payment.id,
            reference,
            reason: "paypal_payment_expired",
            locale,
        }));
    }

    let providerCaptureCompleted = false;
    let completedCapture: PayPalCaptureResult | null = null;
    try {
        const capture = await capturePayPalOrder({
            orderId: token,
            requestId: `booking-capture-${payment.id}`,
        });

        if (capture.orderId !== payment.paypal_order_id) {
            throw new Error("Captured PayPal order does not match the local payment order.");
        }

        if (capture.captureStatus !== "COMPLETED") {
            throw new Error(`PayPal capture is not completed (${capture.captureStatus ?? "unknown"}).`);
        }
        providerCaptureCompleted = true;
        completedCapture = capture;

        if (capture.amountCents !== payment.amount_cents) {
            throw new Error("Captured PayPal amount does not match the booking payment amount.");
        }

        if ((capture.currency ?? "").toUpperCase() !== payment.currency.toUpperCase()) {
            throw new Error("Captured PayPal currency does not match the booking payment currency.");
        }

        validateCaptureAssociation(capture, payment);

        const paymentUpdate: TablesUpdate<"booking_payments"> = {
            ...(capture.orderId ? { paypal_order_id: capture.orderId } : {}),
            paypal_capture_id: capture.captureId,
            paypal_payer_id: capture.payerId,
            paypal_payer_email: capture.payerEmail,
            paypal_status: capture.captureStatus,
            paypal_fee_cents: capture.paypalFeeCents,
            paypal_net_cents: capture.paypalNetCents,
            provider_event_id: capture.captureId,
            provider_event_type: "PAYPAL_RETURN_CAPTURE",
            provider_synced_at: new Date().toISOString(),
            metadata: {
                ...(isRecord(payment.metadata) ? payment.metadata : {}),
                paypalCaptureHistory: paypalCaptureHistory(payment.metadata, capture.captureId),
                paypalReturnCaptureRaw: capture.raw,
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
            note: "PayPal capture completed.",
            autoConfirm: true,
            verificationSource: "paypal_return",
            expectedPaypalOrderId: payment.paypal_order_id,
            paymentUpdate,
            metadata: {
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
            payload: { source: "paypal_return", orderId: capture.orderId, captureId: capture.captureId },
        });

        return NextResponse.redirect(buildPaymentResultRedirect("success", {
            paymentId: payment.id,
            reference,
            locale,
        }));
    } catch (error) {
        const message = error instanceof Error ? error.message : "PayPal capture failed.";
        // PayPal may have completed the capture while a local confirmation
        // write (or association validation) failed. Keep the payment row
        // requested and surface a pending result so the webhook/reconciliation
        // path can attach the real capture; never expire a booking after a
        // provider-confirmed charge.
        if (providerCaptureCompleted && completedCapture) {
            const pendingMetadata = {
                ...(isRecord(payment.metadata) ? payment.metadata : {}),
                paypalReturnCaptureRaw: completedCapture.raw,
                capturePendingReconciliation: true,
                capturePendingReconciliationReason: message,
                capturePendingReconciliationAt: new Date().toISOString(),
            } as Json;
            let pendingPaymentQuery = supabase
                .from("booking_payments")
                .update({
                    paypal_capture_id: completedCapture.captureId,
                    paypal_payer_id: completedCapture.payerId,
                    paypal_payer_email: completedCapture.payerEmail,
                    paypal_status: "CAPTURE_COMPLETED_PENDING_RECONCILIATION",
                    paypal_fee_cents: completedCapture.paypalFeeCents,
                    paypal_net_cents: completedCapture.paypalNetCents,
                    provider_event_id: completedCapture.captureId,
                    provider_event_type: "PAYPAL_RETURN_CAPTURE_PENDING",
                    provider_synced_at: new Date().toISOString(),
                    metadata: pendingMetadata,
                })
                .eq("id", payment.id)
                .eq("workspace_id", payment.workspace_id)
                .eq("status", "requested");
            pendingPaymentQuery = payment.paypal_status
                ? pendingPaymentQuery.eq("paypal_status", payment.paypal_status)
                : pendingPaymentQuery.is("paypal_status", null);
            pendingPaymentQuery = payment.paypal_order_id
                ? pendingPaymentQuery.eq("paypal_order_id", payment.paypal_order_id)
                : pendingPaymentQuery.is("paypal_order_id", null);
            const { data: pendingPayment, error: pendingUpdateError } = await pendingPaymentQuery
                .select("id")
                .maybeSingle();
            if (!pendingUpdateError && pendingPayment) {
                try {
                    await recordPaymentBusinessEvent({
                        supabase,
                        workspaceId: payment.workspace_id,
                        eventType: "captured_after_terminal",
                        paymentId: payment.id,
                        bookingId: payment.reservation_id,
                        amountCents: payment.amount_cents,
                        currency: payment.currency,
                        providerEventId: completedCapture.captureId,
                        netAmountCents: payment.net_amount_cents,
                        vatAmountCents: payment.vat_amount_cents,
                        vatRateBasisPoints: payment.vat_rate_basis_points,
                        grossAmountCents: payment.gross_amount_cents,
                        payload: { source: "paypal_return", reconciliationRequired: true, error: message },
                    });
                } catch (eventError) {
                    console.warn("[paypal] pending capture reconciliation event failed", eventError);
                }
                return NextResponse.redirect(buildPaymentResultRedirect("pending", {
                    paymentId: payment.id,
                    reference,
                    reason: "paypal_capture_pending_reconciliation",
                    locale,
                }));
            }
            console.warn("[paypal] provider capture completed but pending marker failed", pendingUpdateError?.message ?? "payment state changed before reconciliation marker");
            // The provider has already charged the payer. Do not enter the
            // ordinary failure/expiry branch when the local marker loses a
            // race; a webhook or operator reconciliation must finish it.
            return NextResponse.redirect(buildPaymentResultRedirect("pending", {
                paymentId: payment.id,
                reference,
                reason: "paypal_capture_pending_reconciliation",
                locale,
            }));
        }
        if (isUnknownCaptureOutcome(error)) {
            const pendingMetadata = {
                ...(isRecord(payment.metadata) ? payment.metadata : {}),
                capturePendingReconciliation: true,
                capturePendingReconciliationReason: message,
                capturePendingReconciliationAt: new Date().toISOString(),
            } as Json;
            let pendingPaymentQuery = supabase
                .from("booking_payments")
                .update({
                    paypal_status: "CAPTURE_PENDING_RECONCILIATION",
                    provider_event_type: "PAYPAL_RETURN_CAPTURE_UNKNOWN",
                    provider_synced_at: new Date().toISOString(),
                    metadata: pendingMetadata,
                })
                .eq("id", payment.id)
                .eq("workspace_id", payment.workspace_id)
                .eq("status", "requested");
            pendingPaymentQuery = payment.paypal_status
                ? pendingPaymentQuery.eq("paypal_status", payment.paypal_status)
                : pendingPaymentQuery.is("paypal_status", null);
            pendingPaymentQuery = payment.paypal_order_id
                ? pendingPaymentQuery.eq("paypal_order_id", payment.paypal_order_id)
                : pendingPaymentQuery.is("paypal_order_id", null);
            const { data: pendingPayment, error: pendingUpdateError } = await pendingPaymentQuery
                .select("id")
                .maybeSingle();
            if (pendingUpdateError || !pendingPayment) {
                console.warn("[paypal] unknown capture outcome could not be fenced", pendingUpdateError?.message ?? "payment state changed before reconciliation marker");
            }
            return NextResponse.redirect(buildPaymentResultRedirect("pending", {
                paymentId: payment.id,
                reference,
                reason: "paypal_capture_pending_reconciliation",
                locale,
            }));
        }
        const { data: latestPayment } = await supabase
            .from("booking_payments")
            .select("status,paypal_status")
            .eq("id", payment.id)
            .eq("workspace_id", payment.workspace_id)
            .maybeSingle();
        if (latestPayment?.status === "verified") {
            return NextResponse.redirect(buildPaymentResultRedirect("success", {
                paymentId: payment.id,
                reference,
                locale,
            }));
        }
        // A cancel return may win the provider-status compare-and-set while
        // this capture request is in flight. Do not turn that stale callback
        // into a second payment_failed event or overwrite its cancellation
        // marker.
        if (latestPayment?.paypal_status === "CUSTOMER_CANCELLED") {
            return NextResponse.redirect(buildPaymentResultRedirect("failed", {
                paymentId: payment.id,
                reference,
                reason: "paypal_checkout_cancelled",
                locale,
            }));
        }
        let failureQuery = supabase
            .from("booking_payments")
            .update({
                status: "failed",
                failure_reason: message,
                // A failed browser capture is terminal for this local
                // payment attempt, even if the provider row was previously
                // CREATED/APPROVED. Mark it distinctly so a later stale
                // cancel URL cannot claim the same requested payment.
                paypal_status: "RETURN_CAPTURE_FAILED",
                payment_url: null,
                provider_synced_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("id", payment.id)
            .eq("workspace_id", payment.workspace_id)
            .eq("status", "requested");
        failureQuery = payment.paypal_status
            ? failureQuery.eq("paypal_status", payment.paypal_status)
            : failureQuery.is("paypal_status", null);
        const { data: failedPayment, error: failureUpdateError } = await failureQuery
            .select("status,paypal_status")
            .maybeSingle();

        if (failureUpdateError) {
            console.warn("[paypal] failed to claim return-capture failure", failureUpdateError.message);
        }

        if (failedPayment) {
            try {
                await releaseReservationAfterCaptureFailure({
                    supabase,
                    workspaceId: payment.workspace_id,
                    reservationId: payment.reservation_id,
                    paymentId: payment.id,
                    reason: "PayPal capture failed before the booking was confirmed.",
                });
            } catch (releaseError) {
                // The payment CAS remains the audit fence. A subsequent
                // webhook/follow-up can retry this cleanup without risking a
                // second capture.
                console.warn("[paypal] failed return could not release booking hold", releaseError);
            }
        }

        // A webhook/cancel callback may have won between the latest read and
        // this update. Only the CAS winner emits the failed timeline/email;
        // losing callbacks return the committed state without overwriting it.
        if (!failedPayment) {
            const { data: committedPayment } = await supabase
                .from("booking_payments")
                .select("status,paypal_status")
                .eq("id", payment.id)
                .eq("workspace_id", payment.workspace_id)
                .maybeSingle();
            if (committedPayment?.status === "verified") {
                return NextResponse.redirect(buildPaymentResultRedirect("success", {
                    paymentId: payment.id,
                    reference,
                    locale,
                }));
            }
            if (committedPayment?.paypal_status === "CUSTOMER_CANCELLED") {
                return NextResponse.redirect(buildPaymentResultRedirect("failed", {
                    paymentId: payment.id,
                    reference,
                    reason: "paypal_checkout_cancelled",
                    locale,
                }));
            }
            return NextResponse.redirect(buildPaymentResultRedirect("failed", {
                paymentId: payment.id,
                reference,
                reason: "paypal_capture_race",
                locale,
            }));
        }

        await recordPaymentBusinessEvent({
            supabase,
            workspaceId: payment.workspace_id,
            eventType: "failed",
            paymentId: payment.id,
            bookingId: payment.reservation_id,
            amountCents: payment.amount_cents,
            currency: payment.currency,
            providerEventId: payment.provider_event_id ?? payment.paypal_order_id,
            netAmountCents: payment.net_amount_cents,
            vatAmountCents: payment.vat_amount_cents,
            vatRateBasisPoints: payment.vat_rate_basis_points,
            grossAmountCents: payment.gross_amount_cents,
            payload: { source: "paypal_return", error: message },
        });

        await dispatchBookingEmails({
            supabase,
            workspaceId: payment.workspace_id,
            reservationId: payment.reservation_id,
            eventType: "payment_failed",
            reason: "We could not verify this PayPal payment. Please retry checkout or reply for help.",
        });

        return NextResponse.redirect(buildPaymentResultRedirect("failed", {
            paymentId: payment.id,
            reference,
            reason: "paypal_capture_failed",
            locale,
        }));
    }
}
