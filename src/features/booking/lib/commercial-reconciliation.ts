import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { recordPaymentBusinessEvent } from "@/features/business-spine/recorders";
import { recordBookingBusinessEvent } from "@/features/business-spine/service";
import { dispatchBookingEmails } from "@/features/booking/lib/booking-emails";
import { provisionAndConfirmReservation } from "@/features/booking/lib/meeting-confirmation-orchestrator";
import { ensureBookingMeeting } from "@/features/booking/lib/meeting-provider";
import { draftAgreementFromBookingInternal } from "@/features/legal-vault/lib/draft-agreement-internal";
import { ensureInvoiceFromBookingPayment } from "@/features/legal-vault/lib/invoice-from-booking-internal";

function record(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

/** Replays idempotent post-capture work so transient provider/database errors
 * cannot permanently strand a paid booking between subsystems. */
export async function reconcileVerifiedBookingCommercialArtifacts(
    supabase: SupabaseClient,
): Promise<{ reconciled: number; confirmed: number; errors: Array<{ paymentId: string; error: string }> }> {
    const { data: payments, error } = await supabase
        .from("booking_payments")
        .select("id,workspace_id,reservation_id,status,amount_cents,currency,net_amount_cents,vat_amount_cents,vat_rate_basis_points,gross_amount_cents")
        .eq("status", "verified")
        .is("commercial_artifacts_reconciled_at", null)
        .order("commercial_reconciliation_attempted_at", { ascending: true, nullsFirst: true })
        .order("verified_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(500);
    if (error) return { reconciled: 0, confirmed: 0, errors: [{ paymentId: "query", error: error.message }] };

    let reconciled = 0;
    let confirmed = 0;
    const errors: Array<{ paymentId: string; error: string }> = [];
    for (const payment of payments ?? []) {
        const attemptedAt = new Date().toISOString();
        const attemptResult = await supabase
            .from("booking_payments")
            .update({ commercial_reconciliation_attempted_at: attemptedAt })
            .eq("id", payment.id)
            .eq("workspace_id", payment.workspace_id)
            .eq("status", "verified");
        if (attemptResult.error) {
            errors.push({ paymentId: payment.id, error: `Queue: ${attemptResult.error.message}` });
            continue;
        }

        const { data: reservation, error: reservationError } = await supabase
            .from("booking_reservations")
            .select("id,status,metadata,customer_full_name,customer_email,customer_phone,portal_client_id,scheduled_start")
            .eq("id", payment.reservation_id)
            .eq("workspace_id", payment.workspace_id)
            .maybeSingle();
        if (reservationError || !reservation) {
            errors.push({ paymentId: payment.id, error: reservationError?.message ?? "Booking not found." });
            continue;
        }

        let status = reservation.status as string;
        if (status === "pending_confirmation") {
            const metadata = record(reservation.metadata);
            const meetingProvider = metadata.meetingProvider === "zoom"
                || metadata.meetingProvider === "google_meet"
                || metadata.meetingProvider === "none"
                ? metadata.meetingProvider
                : "google_meet";
            const confirmation = await provisionAndConfirmReservation({
                provider: meetingProvider,
                provisionMeeting: () => ensureBookingMeeting(supabase, reservation.id),
                commitConfirmation: async () => {
                    const result = await supabase
                        .from("booking_reservations")
                        .update({
                            status: "confirmed",
                            requires_manual_review: false,
                            manual_review_reason: null,
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", reservation.id)
                        .eq("workspace_id", payment.workspace_id)
                        .eq("status", "pending_confirmation")
                        .select("id")
                        .maybeSingle();
                    if (result.error) throw new Error(result.error.message);
                    return Boolean(result.data);
                },
            });
            if (!confirmation.confirmed) {
                errors.push({ paymentId: payment.id, error: confirmation.reason ?? "Meeting provisioning is pending." });
                continue;
            }
            status = "confirmed";
            confirmed += 1;
            const reason = "Verified payment and customer meeting reconciled by the booking follow-up worker.";
            await Promise.all([
                supabase.from("booking_status_history").insert({
                    workspace_id: payment.workspace_id,
                    reservation_id: reservation.id,
                    from_status: "pending_confirmation",
                    to_status: "confirmed",
                    trigger_source: "system",
                    actor_type: "system",
                    actor_id: null,
                    reason,
                    payload_json: { paymentId: payment.id, meetingProvider, source: "commercial_reconciliation" },
                }),
                supabase.from("booking_notification_events").insert({
                    workspace_id: payment.workspace_id,
                    reservation_id: reservation.id,
                    event_type: "reservation_confirmed",
                    channel: "internal_dashboard",
                    delivery_status: "pending",
                    payload_json: { paymentId: payment.id, reason, emailDispatchRequired: true },
                }),
            ]);
            await dispatchBookingEmails({
                supabase,
                workspaceId: payment.workspace_id,
                reservationId: reservation.id,
                eventType: "reservation_confirmed",
                reason,
            });
        }

        if (status !== "confirmed" && status !== "completed") continue;
        const agreement = await draftAgreementFromBookingInternal({
            bookingId: reservation.id,
            workspaceId: payment.workspace_id,
        });
        if (!agreement.success) {
            errors.push({ paymentId: payment.id, error: `Agreement: ${agreement.error}` });
        }
        const invoice = await ensureInvoiceFromBookingPayment({
            supabase,
            workspaceId: payment.workspace_id,
            paymentId: payment.id,
        });
        if (!invoice.success) {
            errors.push({ paymentId: payment.id, error: `Invoice: ${invoice.error}` });
        }

        await Promise.all([
            recordPaymentBusinessEvent({
                supabase,
                workspaceId: payment.workspace_id,
                eventType: "captured",
                paymentId: payment.id,
                bookingId: reservation.id,
                customer: {
                    name: reservation.customer_full_name,
                    email: reservation.customer_email,
                    phone: reservation.customer_phone,
                    portalClientId: reservation.portal_client_id,
                },
                amountCents: payment.amount_cents,
                currency: payment.currency,
                netAmountCents: payment.net_amount_cents,
                vatAmountCents: payment.vat_amount_cents,
                vatRateBasisPoints: payment.vat_rate_basis_points,
                grossAmountCents: payment.gross_amount_cents,
                payload: { source: "commercial_reconciliation" },
            }),
            recordBookingBusinessEvent({
                supabase,
                workspaceId: payment.workspace_id,
                reservationId: reservation.id,
                status: status as "confirmed" | "completed",
                customerName: reservation.customer_full_name,
                customerEmail: reservation.customer_email,
                customerPhone: reservation.customer_phone,
                portalClientId: reservation.portal_client_id,
                scheduledStart: reservation.scheduled_start,
                paymentStatus: "verified",
                engagementStarted: false,
                source: "payment",
            }),
        ]);
        if (agreement.success && invoice.success) {
            const completionResult = await supabase
                .from("booking_payments")
                .update({ commercial_artifacts_reconciled_at: new Date().toISOString() })
                .eq("id", payment.id)
                .eq("workspace_id", payment.workspace_id)
                .eq("status", "verified")
                .is("commercial_artifacts_reconciled_at", null);
            if (completionResult.error) {
                errors.push({ paymentId: payment.id, error: `Queue completion: ${completionResult.error.message}` });
            } else {
                reconciled += 1;
            }
        }
    }

    return { reconciled, confirmed, errors };
}
