import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

import type { Database, Json } from "@/shared/lib/supabase/database.types";
import { BOOKING_PAYMENT_COMPLETION_WINDOW_MINUTES } from "@/features/booking/lib/booking-policies";
import { normalizeJsonRecord } from "@/features/booking/types";
import { dispatchBookingEmails } from "@/features/booking/lib/booking-emails";
import { recordBookingBusinessEvent } from "@/features/business-spine/service";
import { recordPaymentBusinessEvent } from "@/features/business-spine/recorders";

type SupabaseAny = SupabaseClient<Database> | SupabaseClient<Database, "public">;

interface ExpireUnpaidBookingReservationsParams {
    supabase: SupabaseAny;
    workspaceId?: string | null;
    now?: Date;
    limit?: number;
}

function mergeJsonRecord(value: Json | null | undefined, patch: Record<string, unknown>): Json {
    const base = value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};

    return { ...base, ...patch } as Json;
}

export async function expireUnpaidBookingReservationsByPaymentWindow({
    supabase,
    workspaceId,
    now = new Date(),
    limit = 500,
}: ExpireUnpaidBookingReservationsParams): Promise<{ expiredCount: number; recoveredCancelledCount: number; error: string | null }> {
    const nowIso = now.toISOString();
    const paymentWindowCutoffIso = new Date(now.getTime() - BOOKING_PAYMENT_COMPLETION_WINDOW_MINUTES * 60_000).toISOString();

    // Cancellation fences intentionally keep the PayPal payment row in
    // `requested/CUSTOMER_CANCELLED` for auditability. Recover any process
    // crash between that fence and the reservation transition before looking
    // at ordinary payment expiry; otherwise the orphaned pending hold would
    // remain in the availability pool forever.
    let cancelledRecoveryQuery = supabase
        .from("booking_payments")
        .select(`
            id,
            workspace_id,
            reservation_id,
            status,
            paypal_status,
            booking_reservations!booking_payments_workspace_reservation_fk!inner(id,status,metadata,extension_state_json)
        `)
        .eq("booking_reservations.status", "pending_confirmation")
        .or("and(status.eq.requested,paypal_status.eq.CUSTOMER_CANCELLED),and(status.eq.failed,paypal_status.eq.RETURN_CAPTURE_FAILED),and(status.eq.failed,paypal_status.eq.PAYPAL_CAPTURE_DENIED)")
        .limit(limit);
    if (workspaceId) cancelledRecoveryQuery = cancelledRecoveryQuery.eq("workspace_id", workspaceId);

    const { data: cancelledRows, error: cancelledLookupError } = await cancelledRecoveryQuery;
    if (cancelledLookupError) {
        return { expiredCount: 0, recoveredCancelledCount: 0, error: cancelledLookupError.message };
    }
    let recoveredCancelledCount = 0;
    for (const row of cancelledRows ?? []) {
        const payment = row as unknown as {
            workspace_id: string;
            reservation_id: string;
            status: string;
            paypal_status: string | null;
            booking_reservations: Array<{ id: string; status: string; metadata: Json; extension_state_json: Json }> | { id: string; status: string; metadata: Json; extension_state_json: Json } | null;
        };
        const reservation = Array.isArray(payment.booking_reservations)
            ? payment.booking_reservations[0] ?? null
            : payment.booking_reservations;
        if (!reservation || reservation.status !== "pending_confirmation") continue;

        const recoveryKind = payment.paypal_status === "CUSTOMER_CANCELLED" ? "cancelled" : "failed";
        const terminalStatus = recoveryKind === "cancelled" ? "cancelled_by_customer" : "expired";
        const { data: released, error: releaseError } = await supabase
            .from("booking_reservations")
            .update({
                status: terminalStatus,
                updated_at: nowIso,
                metadata: mergeJsonRecord(reservation.metadata, {
                    paymentExtensionState: recoveryKind,
                    ...(recoveryKind === "cancelled"
                        ? { paypalCancellationRecoveredAt: nowIso }
                        : { paypalFailureRecoveredAt: nowIso }),
                }),
                extension_state_json: mergeJsonRecord(reservation.extension_state_json, { payment: recoveryKind }),
            })
            .eq("id", payment.reservation_id)
            .eq("workspace_id", payment.workspace_id)
            .eq("status", "pending_confirmation")
            .select("id")
            .maybeSingle();
        if (releaseError) return { expiredCount: 0, recoveredCancelledCount, error: releaseError.message };
        if (!released) continue;

        await supabase.from("booking_status_history").insert({
            workspace_id: payment.workspace_id,
            reservation_id: payment.reservation_id,
            from_status: "pending_confirmation",
            to_status: terminalStatus,
            trigger_source: "system",
            actor_type: "system",
            actor_id: null,
            reason: recoveryKind === "cancelled"
                ? "Recovered a PayPal cancellation fence after an interrupted checkout callback."
                : "Recovered a PayPal capture-failure fence after an interrupted checkout callback.",
            payload_json: { source: "payment_window_recovery", paymentId: row.id, emailDispatchRequired: true } as Json,
        });
        await supabase.from("booking_notification_events").insert({
            workspace_id: payment.workspace_id,
            reservation_id: payment.reservation_id,
            event_type: recoveryKind === "cancelled" ? "reservation_cancelled" : "payment_failed",
            channel: "internal_dashboard",
            delivery_status: "pending",
            payload_json: { source: "payment_window_recovery", paymentId: row.id, emailDispatchRequired: true } as Json,
        });
        await recordBookingBusinessEvent({
            supabase,
            workspaceId: payment.workspace_id,
            reservationId: payment.reservation_id,
            status: terminalStatus,
            source: "payment",
            paymentStatus: payment.status,
        });
        await recordPaymentBusinessEvent({
            supabase,
            workspaceId: payment.workspace_id,
            paymentId: row.id,
            bookingId: payment.reservation_id,
            eventType: recoveryKind === "cancelled" ? "cancelled" : "failed",
            payload: { source: "payment_window_recovery", paypalStatus: payment.paypal_status },
        });
        await dispatchBookingEmails({
            supabase,
            workspaceId: payment.workspace_id,
            reservationId: payment.reservation_id,
            eventType: recoveryKind === "cancelled" ? "reservation_cancelled" : "payment_failed",
            reason: recoveryKind === "cancelled"
                ? "PayPal checkout was cancelled before payment was completed."
                : "PayPal capture failed before the booking was confirmed.",
        });
        recoveredCancelledCount += 1;
    }

    // A worker can die after the payment CAS below but before the reservation
    // transition. The payment expiry token is an explicit claim marker for
    // that narrow window; recover only marked expired payments whose hold is
    // still pending, and use the reservation status as the recovery CAS so
    // concurrent sweeps emit one transition and one audit trail.
    let expiredPaymentRecoveryQuery = supabase
        .from("booking_payments")
        .select(`
            id,
            workspace_id,
            reservation_id,
            status,
            provider,
            paypal_status,
            failure_reason,
            metadata,
            booking_reservations!booking_payments_workspace_reservation_fk!inner(id,status,metadata,extension_state_json)
        `)
        .eq("status", "expired")
        .eq("booking_reservations.status", "pending_confirmation")
        .limit(limit);
    if (workspaceId) expiredPaymentRecoveryQuery = expiredPaymentRecoveryQuery.eq("workspace_id", workspaceId);

    const { data: expiredPaymentRows, error: expiredPaymentLookupError } = await expiredPaymentRecoveryQuery;
    if (expiredPaymentLookupError) {
        return { expiredCount: 0, recoveredCancelledCount, error: expiredPaymentLookupError.message };
    }

    let recoveredExpiredCount = 0;
    for (const row of expiredPaymentRows ?? []) {
        const payment = row as unknown as {
            id: string;
            workspace_id: string;
            reservation_id: string;
            status: string;
            provider: string;
            paypal_status: string | null;
            failure_reason: string | null;
            metadata: Json;
            booking_reservations: Array<{
                id: string;
                status: string;
                metadata: Json;
                extension_state_json: Json;
            }> | {
                id: string;
                status: string;
                metadata: Json;
                extension_state_json: Json;
            } | null;
        };
        const reservation = Array.isArray(payment.booking_reservations)
            ? payment.booking_reservations[0] ?? null
            : payment.booking_reservations;
        const paymentMetadata = normalizeJsonRecord(payment.metadata);
        const expiryToken = typeof paymentMetadata.paymentExpiryToken === "string"
            ? paymentMetadata.paymentExpiryToken
            : null;

        if (!reservation || reservation.status !== "pending_confirmation" || !expiryToken) continue;

        const reason = payment.failure_reason || "Payment deadline passed without verification.";
        const { data: recoveredReservation, error: recoveryError } = await supabase
            .from("booking_reservations")
            .update({
                status: "expired",
                updated_at: nowIso,
                metadata: mergeJsonRecord(reservation.metadata, {
                    paymentExtensionState: "expired",
                    paymentExpiredAt: normalizeJsonRecord(reservation.metadata).paymentExpiredAt ?? nowIso,
                    paymentExpiryRecoveryAt: nowIso,
                    paymentExpiryRecovery: "reservation_transition",
                }),
                extension_state_json: mergeJsonRecord(reservation.extension_state_json, {
                    payment: "expired",
                }),
            })
            .eq("id", payment.reservation_id)
            .eq("workspace_id", payment.workspace_id)
            .eq("status", "pending_confirmation")
            .select("id")
            .maybeSingle();

        if (recoveryError) {
            return { expiredCount: recoveredExpiredCount, recoveredCancelledCount, error: recoveryError.message };
        }
        if (!recoveredReservation) continue;

        await supabase.from("booking_status_history").insert({
            workspace_id: payment.workspace_id,
            reservation_id: payment.reservation_id,
            from_status: "pending_confirmation",
            to_status: "expired",
            trigger_source: "system",
            actor_type: "system",
            actor_id: null,
            reason: "Recovered a payment expiry after an interrupted reservation transition.",
            payload_json: {
                source: "payment_window_expiry_recovery",
                paymentId: payment.id,
                paymentExpiryMarkerPresent: true,
                provider: payment.provider,
                paypalStatus: payment.paypal_status,
                reason,
            } as Json,
        });
        await supabase.from("booking_notification_events").insert({
            workspace_id: payment.workspace_id,
            reservation_id: payment.reservation_id,
            event_type: "payment_expired",
            channel: "internal_dashboard",
            delivery_status: "pending",
            payload_json: {
                source: "payment_window_expiry_recovery",
                paymentId: payment.id,
                emailDispatchRequired: true,
            } as Json,
        });
        await recordBookingBusinessEvent({
            supabase,
            workspaceId: payment.workspace_id,
            reservationId: payment.reservation_id,
            status: "expired",
            source: "payment",
            paymentStatus: "expired",
        });
        await recordPaymentBusinessEvent({
            supabase,
            workspaceId: payment.workspace_id,
            paymentId: payment.id,
            bookingId: payment.reservation_id,
            eventType: "failed",
            payload: {
                source: "payment_window_expiry_recovery",
                reason,
            },
        });
        try {
            await dispatchBookingEmails({
                supabase,
                workspaceId: payment.workspace_id,
                reservationId: payment.reservation_id,
                eventType: "payment_expired",
                reason,
            });
        } catch (error) {
            console.warn("[booking] payment expiry recovery email dispatch failed", error);
        }
        recoveredExpiredCount += 1;
    }

    // Cancellation/expiry fencing uses a separate marker because it can run
    // for manual payments as well as PayPal. If the worker dies after that
    // payment CAS but before the reservation CAS, recover the pending hold
    // from the terminal payment row. The reservation status predicate is the
    // idempotent compare-and-set for concurrent sweep workers.
    let fencedTerminalRecoveryQuery = supabase
        .from("booking_payments")
        .select(`
            id,
            workspace_id,
            reservation_id,
            status,
            provider,
            paypal_status,
            failure_reason,
            metadata,
            booking_reservations!booking_payments_workspace_reservation_fk!inner(id,status,metadata,extension_state_json)
        `)
        .in("status", ["failed", "expired"])
        .eq("booking_reservations.status", "pending_confirmation")
        .limit(limit);
    if (workspaceId) fencedTerminalRecoveryQuery = fencedTerminalRecoveryQuery.eq("workspace_id", workspaceId);

    const { data: fencedTerminalRows, error: fencedTerminalLookupError } = await fencedTerminalRecoveryQuery;
    if (fencedTerminalLookupError) {
        return { expiredCount: recoveredExpiredCount, recoveredCancelledCount, error: fencedTerminalLookupError.message };
    }

    for (const row of fencedTerminalRows ?? []) {
        const payment = row as unknown as {
            id: string;
            workspace_id: string;
            reservation_id: string;
            status: string;
            provider: string;
            paypal_status: string | null;
            failure_reason: string | null;
            metadata: Json;
            booking_reservations: Array<{
                id: string;
                status: string;
                metadata: Json;
                extension_state_json: Json;
            }> | {
                id: string;
                status: string;
                metadata: Json;
                extension_state_json: Json;
            } | null;
        };
        const reservation = Array.isArray(payment.booking_reservations)
            ? payment.booking_reservations[0] ?? null
            : payment.booking_reservations;
        const paymentMetadata = normalizeJsonRecord(payment.metadata);
        const cancellationMarker = normalizeJsonRecord(paymentMetadata.paymentCancellation as Json);
        const fenceToken = typeof cancellationMarker.fenceToken === "string"
            ? cancellationMarker.fenceToken
            : null;
        const terminalProviderStatus = cancellationMarker.terminalProviderStatus === "EXPIRED"
            ? "EXPIRED"
            : cancellationMarker.terminalProviderStatus === "CUSTOMER_CANCELLED"
                ? "CUSTOMER_CANCELLED"
                : null;
        const source = cancellationMarker.source === "customer"
            ? "customer"
            : cancellationMarker.source === "operator" || cancellationMarker.source === "system"
                ? cancellationMarker.source
                : null;

        if (!reservation || reservation.status !== "pending_confirmation" || !fenceToken || !terminalProviderStatus || !source) continue;
        if (terminalProviderStatus === "EXPIRED" && payment.status !== "expired") continue;
        if (terminalProviderStatus === "CUSTOMER_CANCELLED" && payment.status !== "failed") continue;

        const nextStatus = terminalProviderStatus === "EXPIRED"
            ? "expired"
            : source === "customer"
                ? "cancelled_by_customer"
                : "cancelled_by_workspace";
        const paymentExtensionState = nextStatus === "expired" ? "expired" : "cancelled";
        const reason = payment.failure_reason
            || (nextStatus === "expired"
                ? "Booking payment expired before completion."
                : "Booking was cancelled before payment completed.");
        const { data: recoveredReservation, error: recoveryError } = await supabase
            .from("booking_reservations")
            .update({
                status: nextStatus,
                updated_at: nowIso,
                metadata: mergeJsonRecord(reservation.metadata, {
                    paymentExtensionState,
                    paymentCancellationRecoveredAt: nowIso,
                    paymentCancellationRecovery: "reservation_transition",
                }),
                extension_state_json: mergeJsonRecord(reservation.extension_state_json, {
                    payment: paymentExtensionState,
                }),
            })
            .eq("id", payment.reservation_id)
            .eq("workspace_id", payment.workspace_id)
            .eq("status", "pending_confirmation")
            .select("id")
            .maybeSingle();

        if (recoveryError) {
            return { expiredCount: recoveredExpiredCount, recoveredCancelledCount, error: recoveryError.message };
        }
        if (!recoveredReservation) continue;

        await supabase.from("booking_status_history").insert({
            workspace_id: payment.workspace_id,
            reservation_id: payment.reservation_id,
            from_status: "pending_confirmation",
            to_status: nextStatus,
            trigger_source: "system",
            actor_type: "system",
            actor_id: null,
            reason: "Recovered a payment cancellation fence after an interrupted reservation transition.",
            payload_json: {
                source: "payment_cancellation_fence_recovery",
                paymentId: payment.id,
                paymentCancellationMarkerPresent: true,
                provider: payment.provider,
                paypalStatus: payment.paypal_status,
                terminalProviderStatus,
                fenceSource: source,
                reason,
            } as Json,
        });
        const notificationEventType = nextStatus === "expired" ? "payment_expired" : "reservation_cancelled";
        await supabase.from("booking_notification_events").insert({
            workspace_id: payment.workspace_id,
            reservation_id: payment.reservation_id,
            event_type: notificationEventType,
            channel: "internal_dashboard",
            delivery_status: "pending",
            payload_json: {
                source: "payment_cancellation_fence_recovery",
                paymentId: payment.id,
                emailDispatchRequired: true,
            } as Json,
        });
        await recordBookingBusinessEvent({
            supabase,
            workspaceId: payment.workspace_id,
            reservationId: payment.reservation_id,
            status: nextStatus,
            source: "payment",
            paymentStatus: payment.status,
        });
        await recordPaymentBusinessEvent({
            supabase,
            workspaceId: payment.workspace_id,
            paymentId: payment.id,
            bookingId: payment.reservation_id,
            eventType: nextStatus === "expired" ? "failed" : "cancelled",
            payload: {
                source: "payment_cancellation_fence_recovery",
                terminalProviderStatus,
                fenceSource: source,
                reason,
            },
        });
        try {
            await dispatchBookingEmails({
                supabase,
                workspaceId: payment.workspace_id,
                reservationId: payment.reservation_id,
                eventType: notificationEventType,
                reason,
            });
        } catch (error) {
            console.warn("[booking] payment fence recovery email dispatch failed", error);
        }

        if (nextStatus === "expired") recoveredExpiredCount += 1;
        else recoveredCancelledCount += 1;
    }

    let query = supabase
        .from("booking_payments")
        .select(`
            id,
            workspace_id,
            reservation_id,
            provider,
            paypal_status,
            deadline_at,
            created_at,
            payment_url,
            metadata,
            booking_reservations!booking_payments_workspace_reservation_fk!inner(id,status,metadata,extension_state_json)
        `)
        .eq("status", "requested")
        // Only an active order (or a failed browser capture whose local hold
        // still needs cleanup) may be expired. PayPal cancel and capture
        // callbacks can update paypal_status between this read and the CAS
        // below, so the same provider fence is applied on the write.
        .or("paypal_status.is.null,paypal_status.eq.CREATED,paypal_status.eq.PAYER_ACTION_REQUIRED,paypal_status.eq.APPROVED,paypal_status.eq.RETURN_CAPTURE_FAILED")
        .eq("booking_reservations.status", "pending_confirmation")
        .or(`deadline_at.lte.${nowIso},created_at.lte.${paymentWindowCutoffIso}`)
        .limit(limit);

    if (workspaceId) {
        query = query.eq("workspace_id", workspaceId);
    }

    const { data: rows, error } = await query;

    if (error) {
        return { expiredCount: 0, recoveredCancelledCount, error: error.message };
    }

    let expiredCount = recoveredExpiredCount;

    for (const row of rows ?? []) {
        const payment = row as unknown as {
            id: string;
            workspace_id: string;
            reservation_id: string;
            provider: string;
            paypal_status: string | null;
            deadline_at: string | null;
            created_at: string;
            payment_url: string | null;
            metadata: Json;
            booking_reservations: Array<{
                id: string;
                status: string;
                metadata: Json;
                extension_state_json: Json;
            }> | {
                id: string;
                status: string;
                metadata: Json;
                extension_state_json: Json;
            } | null;
        };
        const reservation = Array.isArray(payment.booking_reservations)
            ? payment.booking_reservations[0] ?? null
            : payment.booking_reservations;

        if (!reservation || reservation.status !== "pending_confirmation") {
            continue;
        }

        const deadlineExpired = payment.deadline_at
            ? new Date(payment.deadline_at).getTime() <= now.getTime()
            : false;
        const reason = deadlineExpired
            ? "Payment deadline passed without verification."
            : `Payment was not completed within ${BOOKING_PAYMENT_COMPLETION_WINDOW_MINUTES / 60} hours.`;

        const expiryToken = randomUUID();
        const paymentMetadata = mergeJsonRecord(payment.metadata, { paymentExpiryToken: expiryToken });
        const { data: expiredPayment, error: paymentError } = await supabase
            .from("booking_payments")
            .update({
                status: "expired",
                payment_url: null,
                failure_reason: reason,
                ...(payment.provider === "paypal" || payment.provider === "paypal_checkout"
                    ? { paypal_status: "EXPIRED", provider_synced_at: nowIso }
                    : {}),
                metadata: paymentMetadata,
                updated_at: nowIso,
            })
            .eq("id", payment.id)
            .eq("workspace_id", payment.workspace_id)
            .eq("status", "requested")
            .or("paypal_status.is.null,paypal_status.eq.CREATED,paypal_status.eq.PAYER_ACTION_REQUIRED,paypal_status.eq.APPROVED,paypal_status.eq.RETURN_CAPTURE_FAILED")
            .select("id")
            .maybeSingle();

        if (paymentError || !expiredPayment) {
            // A concurrent return/webhook may have claimed the payment. Do
            // not expire the reservation when the payment CAS loses.
            continue;
        }

        const { data: updatedReservation, error: reservationError } = await supabase
            .from("booking_reservations")
            .update({
                status: "expired",
                updated_at: nowIso,
                metadata: mergeJsonRecord(reservation.metadata, {
                    paymentExtensionState: "expired",
                    paymentExpiredAt: nowIso,
                    paymentExpiryReason: reason,
                }),
                extension_state_json: mergeJsonRecord(reservation.extension_state_json, {
                    payment: "expired",
                }),
            })
            .eq("id", payment.reservation_id)
            .eq("workspace_id", payment.workspace_id)
            .eq("status", "pending_confirmation")
            .select("id")
            .maybeSingle();

        if (reservationError || !updatedReservation) {
            // The reservation may have been confirmed/rescheduled after the
            // payment claim. Restore the exact expiry fence only while the
            // reservation is still non-terminal and the token is untouched.
            const { data: latestReservation } = await supabase
                .from("booking_reservations")
                .select("status")
                .eq("id", payment.reservation_id)
                .eq("workspace_id", payment.workspace_id)
                .maybeSingle();
            const terminalReservation = latestReservation?.status === "cancelled_by_customer"
                || latestReservation?.status === "cancelled_by_workspace"
                || latestReservation?.status === "expired"
                || latestReservation?.status === "no_show";
            if (!terminalReservation) {
                const restoredMetadata = { ...normalizeJsonRecord(paymentMetadata) };
                delete restoredMetadata.paymentExpiryToken;
                    const restoreQuery = supabase
                    .from("booking_payments")
                    .update({
                        status: "requested",
                        payment_url: payment.payment_url,
                        failure_reason: null,
                        ...(payment.provider === "paypal" || payment.provider === "paypal_checkout"
                            ? { paypal_status: payment.paypal_status, provider_synced_at: new Date().toISOString() }
                            : {}),
                        metadata: restoredMetadata as Json,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", payment.id)
                    .eq("workspace_id", payment.workspace_id)
                    .eq("status", "expired")
                    .eq("metadata->>paymentExpiryToken", expiryToken)
                    .or("paypal_status.is.null,paypal_status.eq.CREATED,paypal_status.eq.PAYER_ACTION_REQUIRED,paypal_status.eq.APPROVED,paypal_status.eq.RETURN_CAPTURE_FAILED");
                await restoreQuery;
            }
            continue;
        }

        await supabase.from("booking_status_history").insert({
            workspace_id: payment.workspace_id,
            reservation_id: payment.reservation_id,
            from_status: "pending_confirmation",
            to_status: "expired",
            trigger_source: "system",
            actor_type: "system",
            actor_id: null,
            reason,
            payload_json: {
                source: "payment_window_expiry",
                paymentId: payment.id,
                paymentCreatedAt: payment.created_at,
                paymentDeadlineAt: payment.deadline_at,
                enforcedPaymentWindowMinutes: BOOKING_PAYMENT_COMPLETION_WINDOW_MINUTES,
            } as Json,
        });
        await supabase.from("booking_notification_events").insert({
            workspace_id: payment.workspace_id,
            reservation_id: payment.reservation_id,
            event_type: "payment_expired",
            channel: "internal_dashboard",
            delivery_status: "pending",
            payload_json: {
                source: "payment_window_expiry",
                paymentId: payment.id,
                emailDispatchRequired: true,
            } as Json,
        });
        await recordBookingBusinessEvent({
            supabase,
            workspaceId: payment.workspace_id,
            reservationId: payment.reservation_id,
            status: "expired",
            source: "payment",
            paymentStatus: "expired",
        });
        await recordPaymentBusinessEvent({
            supabase,
            workspaceId: payment.workspace_id,
            paymentId: payment.id,
            bookingId: payment.reservation_id,
            eventType: "failed",
            payload: { source: "payment_window_expiry", reason },
        });

        await dispatchBookingEmails({
            supabase,
            workspaceId: payment.workspace_id,
            reservationId: payment.reservation_id,
            eventType: "payment_expired",
            reason,
        });

        expiredCount += 1;
    }

    return { expiredCount, recoveredCancelledCount, error: null };
}
