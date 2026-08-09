import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { recordLegalInvoiceBusinessEvent } from "@/features/business-spine/recorders";
import { upsertCommercialLink } from "@/features/business-spine/quote-to-cash";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import type { Json } from "@/shared/lib/supabase/database.types";

type Result =
    | { success: true; invoiceId: string; existing: boolean }
    | { success: false; error: string };

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
    return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringValue(record: JsonRecord, ...keys: string[]): string | null {
    for (const key of keys) {
        const value = record[key];
        if (typeof value === "string" && value.trim()) return value.trim();
    }
    return null;
}

function dueDate(issueDate: string, days: number): string {
    const value = new Date(`${issueDate}T12:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
}

/**
 * Creates or repairs the draft VAT invoice owned by one verified booking
 * payment. It never finalizes or sends the invoice: missing customer billing
 * details remain an explicit operator completion item in invoice metadata.
 */
export async function ensureInvoiceFromBookingPayment(params: {
    workspaceId: string;
    paymentId: string;
    supabase?: SupabaseClient;
}): Promise<Result> {
    const supabase = params.supabase ?? createAdminClient() as unknown as SupabaseClient;
    try {
        const { data: payment, error: paymentError } = await supabase
            .from("booking_payments")
            .select("id,workspace_id,reservation_id,status,verified_at,currency,net_amount_cents,vat_amount_cents,vat_rate_basis_points,gross_amount_cents")
            .eq("id", params.paymentId)
            .eq("workspace_id", params.workspaceId)
            .maybeSingle();
        if (paymentError || !payment) return { success: false, error: paymentError?.message ?? "Booking payment not found." };
        if (payment.status !== "verified") return { success: false, error: "Only verified booking payments can create an invoice draft." };
        if (payment.net_amount_cents == null || payment.vat_amount_cents == null || payment.gross_amount_cents == null || payment.vat_rate_basis_points == null) {
            return { success: false, error: "The verified payment is missing its immutable VAT pricing snapshot." };
        }

        const [{ data: reservation, error: reservationError }, { data: profile, error: profileError }] = await Promise.all([
            supabase
                .from("booking_reservations")
                .select("id,portal_client_id,service_id,customer_full_name,customer_email,scheduled_start,metadata")
                .eq("id", payment.reservation_id)
                .eq("workspace_id", params.workspaceId)
                .maybeSingle(),
            supabase
                .from("legal_invoice_profiles")
                .select("id,legal_name,address_line1,postal_code,city,country_code,kvk_number,btw_id,kor_enabled,default_payment_terms_days")
                .eq("workspace_id", params.workspaceId)
                .maybeSingle(),
        ]);
        if (reservationError || !reservation) return { success: false, error: reservationError?.message ?? "Booking not found." };
        if (profileError || !profile) return { success: false, error: profileError?.message ?? "Legal invoice profile is not configured." };
        if (!/^\d{8}$/.test(profile.kvk_number) || (!profile.kor_enabled && !profile.btw_id?.trim())) {
            return { success: false, error: "Legal invoice profile requires a valid KvK number and BTW ID before booking invoices can be drafted." };
        }

        const [{ data: service }, { data: intake }, { data: agreement }] = await Promise.all([
            supabase.from("booking_services").select("title").eq("id", reservation.service_id).eq("workspace_id", params.workspaceId).maybeSingle(),
            supabase.from("booking_reservation_intake").select("normalized_payload_json").eq("reservation_id", reservation.id).eq("workspace_id", params.workspaceId).maybeSingle(),
            supabase.from("legal_agreements").select("id").eq("booking_id", reservation.id).eq("workspace_id", params.workspaceId).order("created_at", { ascending: true }).limit(1).maybeSingle(),
        ]);
        const intakeValues = asRecord(intake?.normalized_payload_json);
        const clientAddress = stringValue(intakeValues, "billing_address", "billingAddress", "address");
        const clientCountry = stringValue(intakeValues, "billing_country", "billingCountry", "country_code") ?? "NL";
        const clientBtwId = stringValue(intakeValues, "btw_id", "btwId", "vat_id", "vatId");
        const issueDate = (payment.verified_at ?? new Date().toISOString()).slice(0, 10);
        const invoiceMetadata = {
            source: "verified_booking_payment",
            paymentPricingSnapshot: {
                netAmountCents: Number(payment.net_amount_cents),
                vatAmountCents: Number(payment.vat_amount_cents),
                vatRateBasisPoints: Number(payment.vat_rate_basis_points),
                grossAmountCents: Number(payment.gross_amount_cents),
            },
            customerBillingDetailsComplete: Boolean(clientAddress),
            operatorCompletionRequired: !clientAddress,
            operatorCompletionReason: clientAddress ? null : "Customer billing address is required before finalizing the VAT invoice.",
        };

        let { data: invoice, error: invoiceError } = await supabase
            .from("legal_invoices")
            .select("id")
            .eq("workspace_id", params.workspaceId)
            .eq("booking_payment_id", payment.id)
            .maybeSingle();
        const existing = Boolean(invoice);
        if (!invoice && !invoiceError) {
            const inserted = await supabase
                .from("legal_invoices")
                .insert({
                    workspace_id: params.workspaceId,
                    profile_id: profile.id,
                    booking_id: reservation.id,
                    booking_payment_id: payment.id,
                    status: "draft",
                    issue_date: issueDate,
                    supply_date: reservation.scheduled_start.slice(0, 10),
                    due_date: dueDate(issueDate, profile.default_payment_terms_days ?? 14),
                    client_id: reservation.portal_client_id,
                    client_name: reservation.customer_full_name,
                    client_address: clientAddress,
                    client_country_code: clientCountry,
                    client_btw_id: clientBtwId,
                    currency: payment.currency,
                    kor_enabled: profile.kor_enabled,
                    subtotal_cents: payment.net_amount_cents,
                    btw_total_cents: payment.vat_amount_cents,
                    total_cents: payment.gross_amount_cents,
                    related_agreement_id: agreement?.id ?? null,
                    metadata: invoiceMetadata as Json,
                    created_by: null,
                })
                .select("id")
                .single();
            invoice = inserted.data;
            invoiceError = inserted.error;
            if (invoiceError?.code === "23505") {
                const winner = await supabase
                    .from("legal_invoices")
                    .select("id")
                    .eq("workspace_id", params.workspaceId)
                    .eq("booking_payment_id", payment.id)
                    .maybeSingle();
                invoice = winner.data;
                invoiceError = winner.error;
            }
        }
        if (invoiceError || !invoice) return { success: false, error: invoiceError?.message ?? "Could not create the booking invoice draft." };

        const lineSubtotal = Number(payment.net_amount_cents);
        const lineBtw = Number(payment.vat_amount_cents);
        const lineTotal = Number(payment.gross_amount_cents);
        const lineResult = await supabase
            .from("legal_invoice_lines")
            .upsert({
                workspace_id: params.workspaceId,
                invoice_id: invoice.id,
                description: service?.title ?? "Booking service",
                quantity: 1,
                unit_price_cents: lineSubtotal,
                discount_cents: 0,
                btw_rate_bp: Number(payment.vat_rate_basis_points),
                btw_reason_code: null,
                line_subtotal_cents: lineSubtotal,
                line_btw_cents: lineBtw,
                line_total_cents: lineTotal,
                sort_order: 0,
            }, { onConflict: "workspace_id,invoice_id,sort_order" });
        if (lineResult.error) return { success: false, error: lineResult.error.message };

        await recordLegalInvoiceBusinessEvent({
            supabase,
            workspaceId: params.workspaceId,
            invoiceId: invoice.id,
            eventType: "draft",
            customer: {
                name: reservation.customer_full_name,
                email: reservation.customer_email,
                portalClientId: reservation.portal_client_id,
            },
            clientName: reservation.customer_full_name,
            relatedAgreementId: agreement?.id ?? null,
            totalCents: lineTotal,
            currency: payment.currency,
            dueDate: dueDate(issueDate, profile.default_payment_terms_days ?? 14),
            payload: { bookingId: reservation.id, paymentId: payment.id, ...invoiceMetadata },
        });
        await upsertCommercialLink({
            supabase,
            workspaceId: params.workspaceId,
            linkType: "invoice_payment",
            linkedRecordType: "booking_payment",
            linkedRecordId: payment.id,
            linkedRecordRef: invoice.id,
            metadata: { invoiceId: invoice.id, bookingId: reservation.id, paymentId: payment.id },
        });
        return { success: true, invoiceId: invoice.id, existing };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Unexpected invoice reconciliation failure." };
    }
}
