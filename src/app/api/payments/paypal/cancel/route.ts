import { NextRequest, NextResponse } from "next/server";

import { buildSiteUrl } from "@/shared/lib/auth/redirect-url";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import type { Json } from "@/shared/lib/supabase/database.types";
import { dispatchBookingEmails } from "@/features/booking/lib/booking-emails";
import { allowPayPalCallbackRequest } from "@/features/booking/lib/paypal-callback-rate-limit";
import { recordBookingBusinessEvent } from "@/features/business-spine/service";
import { recordPaymentBusinessEvent } from "@/features/business-spine/recorders";
import { fenceBookingPaymentForCancellation, restoreBookingPaymentFenceAfterTransitionRace } from "@/features/booking/actions";
import { isSupportedLocale, localizeHref } from "@/shared/lib/i18n/routing";
import type { Locale } from "@/features/templates/types";

export const runtime = "nodejs";

const PAYMENT_RECEIVED_PATH = "/booking/payment-received";
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

function buildPaymentResultRedirect(params: { paymentId: string; reference?: string | null; locale?: Locale }) {
    return buildRedirect(PAYMENT_RECEIVED_PATH, {
        status: "cancelled",
        payment_id: params.paymentId,
        ...(params.reference ? { reference: params.reference } : {}),
    }, params.locale ?? "en");
}

function buildPaymentSuccessRedirect(params: { paymentId: string; reference?: string | null; locale?: Locale }) {
    return buildRedirect(PAYMENT_RECEIVED_PATH, {
        status: "success",
        payment_id: params.paymentId,
        ...(params.reference ? { reference: params.reference } : {}),
    }, params.locale ?? "en");
}

function buildPaymentFailedRedirect(params: { paymentId: string; reference?: string | null; locale?: Locale; reason?: string }) {
    return buildRedirect(PAYMENT_RECEIVED_PATH, {
        status: "failed",
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

export async function GET(req: NextRequest) {
    const token = req.nextUrl.searchParams.get("token")?.trim();
    const paymentId = req.nextUrl.searchParams.get("payment_id")?.trim();
    const requestedLocale = parseLocale(req.nextUrl.searchParams.get("locale"));
    if (!paymentId || !token || !PAYMENT_ID_PATTERN.test(paymentId) || !PAYPAL_TOKEN_PATTERN.test(token)) {
        return NextResponse.redirect(buildPaymentLookupFailedRedirect("paypal_cancel_missing_payment", requestedLocale));
    }

    const supabase = createAdminClient();
    if (!await allowPayPalCallbackRequest({ req, supabase, kind: "cancel" })) {
        return NextResponse.redirect(buildPaymentLookupFailedRedirect("paypal_rate_limited", requestedLocale), {
            status: 303,
            headers: { "Retry-After": "60" },
        });
    }
    const { data: payment, error } = await supabase
        .from("booking_payments")
        .select("id,workspace_id,reservation_id,provider,status,payment_reference,paypal_order_id,paypal_status,payment_url,metadata")
        .eq("id", paymentId)
        .maybeSingle();

    if (error || !payment) {
        return NextResponse.redirect(buildPaymentLookupFailedRedirect("paypal_cancel_not_found", requestedLocale));
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

    // PayPal appends the order token to the configured cancel URL. Requiring
    // that token to match the server-owned order ID prevents a leaked payment
    // UUID, browser prefetch, or CSRF request from cancelling an active hold.
    if (!token || !payment.paypal_order_id || token !== payment.paypal_order_id) {
        return NextResponse.redirect(buildPaymentFailedRedirect({
            paymentId: payment.id,
            reference: payment.payment_reference,
            reason: "paypal_order_mismatch",
            locale: paymentLocale,
        }));
    }

    // Resolve the customer-facing locale from the server-owned reservation
    // attribution before any replay/terminal-status shortcut. The query
    // string is only a best-effort fallback for malformed or already-deleted
    // records; it must never override a trusted booking locale.
    const { data: reservation } = await supabase
        .from("booking_reservations")
        .select("id,status,metadata,attribution_json,public_reference")
        .eq("id", payment.reservation_id)
        .eq("workspace_id", payment.workspace_id)
        .maybeSingle();
    const locale = parseLocale(
        reservation && isRecord(reservation.attribution_json) && typeof reservation.attribution_json.locale === "string"
            ? reservation.attribution_json.locale
            : paymentLocale,
    );
    const reference = reservation?.public_reference ?? payment.payment_reference;

    const now = new Date().toISOString();

    const releaseCancelledReservation = async (options?: {
        terminalStatus?: "cancelled_by_customer" | "expired";
        reason?: string;
    }): Promise<{ released: boolean; alreadyCancelled: boolean }> => {
        const terminalStatus = options?.terminalStatus ?? "cancelled_by_customer";
        const releaseReason = options?.reason ?? "PayPal checkout was cancelled before payment was completed.";
        const expectedPaypalStatus = terminalStatus === "expired"
            ? "RETURN_CAPTURE_FAILED"
            : "CUSTOMER_CANCELLED";
        // Release the paid hold immediately. The payment row remains
        // `requested` for auditability and is fenced by CUSTOMER_CANCELLED,
        // while the reservation becomes terminal so availability, expiry, and
        // reminder workers do not treat a cancelled checkout as an active slot
        // hold. This helper is also called by replayed cancel returns so a
        // transient reservation update failure can be retried safely.
        if (!reservation) return { released: false, alreadyCancelled: false };
        if (reservation.status !== "pending_confirmation") {
            return { released: false, alreadyCancelled: reservation.status === terminalStatus };
        }

        // Re-read the provider fence immediately before releasing the hold.
        // A stale browser callback must not turn a newer cancellation into an
        // expiry (or vice versa), and a process crash between the two writes
        // is recoverable by the payment-followup sweep.
        const { data: currentPayment } = await supabase
            .from("booking_payments")
            .select("status,paypal_status")
            .eq("id", payment.id)
            .eq("workspace_id", payment.workspace_id)
            .maybeSingle();
        if (!currentPayment || currentPayment.paypal_status !== expectedPaypalStatus) {
            return { released: false, alreadyCancelled: false };
        }
        if (terminalStatus === "expired"
            ? currentPayment.status !== "failed" && currentPayment.status !== "requested"
            : currentPayment.status !== "requested") {
            return { released: false, alreadyCancelled: false };
        }

        const reservationMetadata = isRecord(reservation.metadata) ? reservation.metadata : {};
        const { data: reservationUpdate, error: reservationUpdateError } = await supabase
            .from("booking_reservations")
            .update({
                status: terminalStatus,
                metadata: {
                    ...reservationMetadata,
                    paymentExtensionState: terminalStatus === "expired" ? "failed" : "cancelled",
                    ...(terminalStatus === "expired"
                        ? { paypalFailureAt: now }
                        : { paypalCancellationAt: now }),
                } as Json,
                updated_at: now,
            })
            .eq("id", reservation.id)
            .eq("workspace_id", payment.workspace_id)
            .eq("status", "pending_confirmation")
            .select("id")
            .maybeSingle();
        if (reservationUpdateError) {
            console.warn("[paypal] cancelled payment hold could not be released", reservationUpdateError.message);
            return { released: false, alreadyCancelled: false };
        }
        if (!reservationUpdate) return { released: false, alreadyCancelled: false };

        await supabase.from("booking_status_history").insert({
            workspace_id: payment.workspace_id,
            reservation_id: reservationUpdate.id,
            from_status: "pending_confirmation",
            to_status: terminalStatus,
            trigger_source: "system",
            actor_type: "anonymous",
            actor_id: null,
            reason: releaseReason,
            payload_json: { source: "paypal_cancel_return", paymentId: payment.id, emailDispatchRequired: true } as Json,
        });
        await supabase.from("booking_notification_events").insert({
            workspace_id: payment.workspace_id,
            reservation_id: reservationUpdate.id,
            event_type: terminalStatus === "expired" ? "payment_failed" : "reservation_cancelled",
            channel: "internal_dashboard",
            delivery_status: "pending",
            payload_json: { source: "paypal_cancel_return", paymentId: payment.id, emailDispatchRequired: true } as Json,
        });
        try {
            await recordBookingBusinessEvent({
                supabase,
                workspaceId: payment.workspace_id,
                reservationId: reservationUpdate.id,
                status: terminalStatus,
                source: "payment",
            });
            await recordPaymentBusinessEvent({
                supabase,
                workspaceId: payment.workspace_id,
                paymentId: payment.id,
                bookingId: reservationUpdate.id,
                eventType: "cancelled",
                payload: { source: "paypal_cancel_return", paypalStatus: expectedPaypalStatus },
            });
        } catch (bookingEventError) {
            console.warn("[paypal] cancellation lifecycle recorder failed", bookingEventError);
        }
        return { released: true, alreadyCancelled: false };
    };

    // The local status remains `requested` until the payment-window expiry
    // sweep, so the provider marker is the replay fence for cancel returns.
    if (payment.paypal_status === "CUSTOMER_CANCELLED") {
        if (payment.payment_url) {
            const { error: clearPaymentUrlError } = await supabase
                .from("booking_payments")
                .update({ payment_url: null, updated_at: now })
                .eq("id", payment.id)
                .eq("workspace_id", payment.workspace_id)
                .eq("paypal_status", "CUSTOMER_CANCELLED");
            if (clearPaymentUrlError) {
                console.warn("[paypal] cancelled payment approval URL could not be cleared", clearPaymentUrlError.message);
            }
        }
        const replayRelease = await releaseCancelledReservation();
        if (!replayRelease.released && !replayRelease.alreadyCancelled) {
            const { data: latestReservation } = await supabase
                .from("booking_reservations")
                .select("status")
                .eq("id", payment.reservation_id)
                .eq("workspace_id", payment.workspace_id)
                .maybeSingle();
            if (latestReservation?.status === "confirmed" || latestReservation?.status === "completed") {
                return NextResponse.redirect(buildPaymentSuccessRedirect({
                    paymentId: payment.id,
                    reference,
                    locale,
                }));
            }
            if (latestReservation?.status === "pending_confirmation") {
                // The first cancel return may have fenced the payment before
                // the reservation CAS failed. Restore that exact fence while
                // the hold is still active so a retry (or expiry worker) can
                // make progress instead of leaving CUSTOMER_CANCELLED in a
                // permanently requested payment row.
                const cancellationMetadata = isRecord(payment.metadata)
                    ? payment.metadata.paymentCancellation
                    : null;
                const cancellation = isRecord(cancellationMetadata) ? cancellationMetadata : null;
                if (cancellation && typeof cancellation.fenceToken === "string") {
                    await restoreBookingPaymentFenceAfterTransitionRace({
                        supabase,
                        workspaceId: payment.workspace_id,
                        reservationId: payment.reservation_id,
                        fence: {
                            paymentId: payment.id,
                            provider: payment.provider,
                            changed: true,
                            fenceToken: cancellation.fenceToken,
                            terminalProviderStatus: "CUSTOMER_CANCELLED",
                            previousStatus: cancellation.previousStatus === "requested" ? "requested" : null,
                            previousPaypalStatus: typeof cancellation.previousPaypalStatus === "string"
                                ? cancellation.previousPaypalStatus
                                : null,
                            previousPaymentUrl: typeof cancellation.previousPaymentUrl === "string"
                                ? cancellation.previousPaymentUrl
                                : null,
                        },
                    });
                }
                return NextResponse.redirect(buildPaymentFailedRedirect({
                    paymentId: payment.id,
                    reference,
                    locale,
                    reason: "paypal_cancel_reservation_race",
                }));
            }
        }
        return NextResponse.redirect(buildPaymentResultRedirect({
            paymentId: payment.id,
            reference,
            locale,
        }));
    }

    // A stale cancel URL must never overwrite a provider state that proves a
    // capture (or a terminal failure/refund) has already happened. Approval
    // is still cancellable because the browser return may race the webhook
    // before capture; completed/failed/refunded states are not.
    const cancellableProviderStatuses = new Set(["CREATED", "PAYER_ACTION_REQUIRED", "APPROVED"]);
    if (payment.paypal_status === "RETURN_CAPTURE_FAILED" && payment.status === "requested") {
        const releaseResult = await releaseCancelledReservation({
            terminalStatus: "expired",
            reason: "PayPal capture failed; the temporary booking hold was released.",
        });
        if (releaseResult.released || releaseResult.alreadyCancelled) {
            await supabase
                .from("booking_payments")
                .update({
                    status: "failed",
                    payment_url: null,
                    failure_reason: "PayPal capture failed before the booking was confirmed.",
                    updated_at: now,
                })
                .eq("id", payment.id)
                .eq("workspace_id", payment.workspace_id)
                .eq("status", "requested")
                .eq("paypal_status", "RETURN_CAPTURE_FAILED");
            if (releaseResult.released) {
                await dispatchBookingEmails({
                    supabase,
                    workspaceId: payment.workspace_id,
                    reservationId: payment.reservation_id,
                    eventType: "payment_failed",
                    reason: "PayPal capture failed before the booking was confirmed.",
                });
            }
        }
        return NextResponse.redirect(buildPaymentFailedRedirect({
            paymentId: payment.id,
            reference,
            locale,
            reason: "paypal_capture_failed",
        }));
    }
    if (payment.paypal_status && !cancellableProviderStatuses.has(payment.paypal_status)) {
        return NextResponse.redirect(payment.status === "verified"
            ? buildPaymentSuccessRedirect({ paymentId: payment.id, reference, locale })
            : buildPaymentFailedRedirect({ paymentId: payment.id, reference, locale, reason: "paypal_payment_not_cancellable" }));
    }

    let cancellationFence: Awaited<ReturnType<typeof fenceBookingPaymentForCancellation>>;
    try {
        cancellationFence = await fenceBookingPaymentForCancellation({
            supabase,
            workspaceId: payment.workspace_id,
            reservationId: payment.reservation_id,
            source: "customer",
            reason: "PayPal checkout was cancelled before payment was completed.",
            terminalProviderStatus: "CUSTOMER_CANCELLED",
        });
    } catch (cancellationError) {
        console.error("[paypal] cancellation fence failed", cancellationError);
        return NextResponse.redirect(buildPaymentLookupFailedRedirect(
            "paypal_cancel_update_failed",
            locale,
        ));
    }

    // PayPal can replay the cancel return, and a user can open an old cancel
    // URL after a concurrent return/webhook already verified the payment. Only
    // emit cancellation side effects when the provider fence and reservation
    // transition are both consistent.
    if (!cancellationFence.changed && payment.paypal_status !== "CUSTOMER_CANCELLED") {
        const { data: latestPayment } = await supabase
            .from("booking_payments")
            .select("status,paypal_status")
            .eq("id", payment.id)
            .eq("workspace_id", payment.workspace_id)
            .maybeSingle();
        if (latestPayment?.status === "verified") {
            return NextResponse.redirect(buildPaymentSuccessRedirect({
                paymentId: payment.id,
                reference,
                locale,
            }));
        }
        const observedProviderStatus = payment.paypal_status ?? null;
        const latestProviderStatus = latestPayment?.paypal_status ?? null;
        if (latestProviderStatus !== observedProviderStatus
            || (latestProviderStatus && !cancellableProviderStatuses.has(latestProviderStatus))) {
            return NextResponse.redirect(buildPaymentFailedRedirect({
                paymentId: payment.id,
                reference,
                locale,
                reason: "paypal_cancel_race",
            }));
        }
        return NextResponse.redirect(buildPaymentResultRedirect({
            paymentId: payment.id,
            reference,
            locale,
        }));
    }

    const releaseResult = await releaseCancelledReservation();
    if (!releaseResult.released && !releaseResult.alreadyCancelled) {
        const [{ data: latestReservation }, { data: latestPayment }] = await Promise.all([
            supabase
                .from("booking_reservations")
                .select("status")
                .eq("id", payment.reservation_id)
                .eq("workspace_id", payment.workspace_id)
                .maybeSingle(),
            supabase
                .from("booking_payments")
                .select("status,paypal_status")
                .eq("id", payment.id)
                .eq("workspace_id", payment.workspace_id)
                .maybeSingle(),
        ]);
        if (latestPayment?.status === "verified" || latestReservation?.status === "confirmed" || latestReservation?.status === "completed") {
            if (cancellationFence.changed) {
                await restoreBookingPaymentFenceAfterTransitionRace({
                    supabase,
                    workspaceId: payment.workspace_id,
                    reservationId: payment.reservation_id,
                    fence: cancellationFence,
                });
            }
            return NextResponse.redirect(buildPaymentSuccessRedirect({
                paymentId: payment.id,
                reference,
                locale,
            }));
        }
        if (cancellationFence.changed) {
            await restoreBookingPaymentFenceAfterTransitionRace({
                supabase,
                workspaceId: payment.workspace_id,
                reservationId: payment.reservation_id,
                fence: cancellationFence,
            });
        }
        return NextResponse.redirect(buildPaymentFailedRedirect({
            paymentId: payment.id,
            reference,
            locale,
            reason: "paypal_cancel_reservation_race",
        }));
    }

    if (releaseResult.released) {
        await dispatchBookingEmails({
            supabase,
            workspaceId: payment.workspace_id,
            reservationId: payment.reservation_id,
            eventType: "payment_failed",
            reason: "PayPal checkout was cancelled before payment was completed. The booking is not confirmed.",
        });
    }

    return NextResponse.redirect(buildPaymentResultRedirect({
        paymentId: payment.id,
        reference,
        locale,
    }));
}
