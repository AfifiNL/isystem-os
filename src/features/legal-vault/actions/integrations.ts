"use server";

import { createClient } from "@/shared/lib/supabase/server";
import { assertLegalVaultAccess } from "@/features/legal-vault/lib/access";
import { listLegalTemplates } from "@/features/legal-vault/actions/templates";
import { createLegalAgreement } from "@/features/legal-vault/actions/agreements";
import type {
    ActionResult,
    LegalAgreement,
} from "@/features/legal-vault/types";
import { resolveCanonicalBusinessCustomerId } from "@/features/business-spine/service";
import { linkBookingToAgreement } from "@/features/business-spine/quote-to-cash";
import type { SupabaseClient } from "@supabase/supabase-js";

// Used by the Booking module (and any future caller) to spawn a draft DVO
// when a reservation is confirmed. Idempotent on (workspace, booking_id):
// returns the existing agreement if one already exists for the booking.
export async function draftAgreementFromBooking(
    bookingId: string,
): Promise<ActionResult<LegalAgreement>> {
    try {
        const { activeWorkspace } = await assertLegalVaultAccess();
        const supabase = await createClient();

        const { data: existing } = await supabase
            .from("legal_agreements")
            .select("*")
            .eq("workspace_id", activeWorkspace.id)
            .eq("booking_id", bookingId)
            .maybeSingle();
        if (existing) {
            await linkBookingAgreementBestEffort({
                workspaceId: activeWorkspace.id,
                bookingId,
                agreementId: existing.id as string,
                portalClientId: (existing.client_id as string | null) ?? null,
                email: (existing.party_email as string | null) ?? null,
                source: "existing_agreement",
            });
            return {
                success: true,
                data: {
                    id: existing.id as string,
                    workspaceId: existing.workspace_id as string,
                    templateId: (existing.template_id as string | null) ?? null,
                    documentId: (existing.document_id as string | null) ?? null,
                    clientId: (existing.client_id as string | null) ?? null,
                    bookingId: (existing.booking_id as string | null) ?? null,
                    status: existing.status as LegalAgreement["status"],
                    title: existing.title as string,
                    partyName: existing.party_name as string,
                    partyEmail: existing.party_email as string,
                    effectiveDate: (existing.effective_date as string | null) ?? null,
                    expiresAt: (existing.expires_at as string | null) ?? null,
                    signedAt: (existing.signed_at as string | null) ?? null,
                    signedSha256: (existing.signed_sha256 as string | null) ?? null,
                    payload: (existing.payload as Record<string, unknown>) ?? {},
                    publicToken: existing.public_token as string,
                    createdBy: (existing.created_by as string | null) ?? null,
                    createdAt: existing.created_at as string,
                    updatedAt: existing.updated_at as string,
                },
            };
        }

        const { data: reservation, error: resError } = await supabase
            .from("booking_reservations")
            .select("id, customer_full_name, customer_email, scheduled_start, metadata, booking_services(title, price_amount_cents)")
            .eq("id", bookingId)
            .eq("workspace_id", activeWorkspace.id)
            .maybeSingle();
        if (resError) return { success: false, error: resError.message };
        if (!reservation) return { success: false, error: "Booking not found." };

        const templates = await listLegalTemplates({ category: "dvo" });
        if (!templates.success) return templates;
        const template = templates.data.find((t) => t.slug === "dvo-nl-zzp-standaard") ?? templates.data[0];
        if (!template) return { success: false, error: "No DVO template available." };

        const customerName = (reservation.customer_full_name as string | null) ?? "Onbekende klant";
        const customerEmail = (reservation.customer_email as string | null) ?? "";
        if (!customerEmail) {
            return { success: false, error: "Customer email is required to draft an agreement." };
        }

        // Fetch Legal Invoice Profile details for the workspace
        const { data: profile, error: profileError } = await supabase
            .from("legal_invoice_profiles")
            .select("*")
            .eq("workspace_id", activeWorkspace.id)
            .maybeSingle();

        if (profileError) return { success: false, error: profileError.message };
        if (!profile || !profile.kvk_number || profile.kvk_number.trim() === "TBD" || !profile.btw_id || profile.btw_id.trim() === "TBD") {
            return {
                success: false,
                error: "Please configure your Legal Invoice Profile (including KvK and VAT/BTW numbers) in bookkeeping settings before drafting agreements."
            };
        }

        const serviceName = (() => {
            const services = reservation.booking_services as unknown as Array<{ title: string; price_amount_cents?: number | null }> | { title: string; price_amount_cents?: number | null } | null;
            if (!services) return "Adviesopdracht";
            if (Array.isArray(services)) return services[0]?.title ?? "Adviesopdracht";
            return services.title ?? "Adviesopdracht";
        })();
        const totalCents = (() => {
            const metadata = reservation.metadata as Record<string, unknown> | null;
            const metadataAmount = metadata?.paymentNetAmountCents ?? metadata?.paymentAmountCents;
            if (typeof metadataAmount === "number" && Number.isFinite(metadataAmount)) return metadataAmount;
            const services = reservation.booking_services as unknown as Array<{ price_amount_cents?: number | null }> | { price_amount_cents?: number | null } | null;
            if (Array.isArray(services)) return Number(services[0]?.price_amount_cents ?? 0);
            return Number(services?.price_amount_cents ?? 0);
        })();
        const startAt = (reservation.scheduled_start as string | null) ?? new Date().toISOString();

        const agreementResult = await createLegalAgreement({
            templateId: template.id,
            bookingId,
            partyName: customerName,
            partyEmail: customerEmail,
            effectiveDate: startAt.slice(0, 10),
            variables: {
                client_name: customerName,
                client_city: "n.t.b.",
                scope: serviceName,
                effective_date: startAt.slice(0, 10),
                expires_at: "",
                notice_period_days: 30,
                rate_amount: (totalCents / 100).toFixed(2),
                rate_basis: "per opdracht",
                payment_term_days: profile.default_payment_terms_days || 14,
                provider_name: profile.legal_name || "Service Provider",
                provider_city: profile.city || "Breda",
                provider_kvk: profile.kvk_number,
                provider_vat: profile.btw_id,
                client_kvk: "",
            },
        });
        if (agreementResult.success) {
            await linkBookingAgreementBestEffort({
                workspaceId: activeWorkspace.id,
                bookingId,
                agreementId: agreementResult.data.id,
                portalClientId: agreementResult.data.clientId,
                email: agreementResult.data.partyEmail,
                source: "draft_agreement",
            });
        }
        return agreementResult;
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : "Unexpected error." };
    }
}

async function linkBookingAgreementBestEffort(input: {
    supabase?: SupabaseClient;
    workspaceId: string;
    bookingId: string;
    agreementId: string;
    portalClientId?: string | null;
    email?: string | null;
    source: "existing_agreement" | "draft_agreement";
}) {
    try {
        const customerId = await resolveCanonicalBusinessCustomerId({
            supabase: input.supabase,
            workspaceId: input.workspaceId,
            portalClientId: input.portalClientId,
            email: input.email,
            bookingId: input.bookingId,
            legalAgreementId: input.agreementId,
        });
        const result = await linkBookingToAgreement({
            supabase: input.supabase,
            workspaceId: input.workspaceId,
            bookingId: input.bookingId,
            agreementId: input.agreementId,
            customerId,
            metadata: {
                source: input.source,
                customerResolution: customerId ? "resolved" : "not_found",
            },
        });
        if (!result.success) {
            console.warn("[legal-vault] booking agreement commercial link failed", result.error);
        }
    } catch (error) {
        console.warn("[legal-vault] booking agreement commercial link failed", error instanceof Error ? error.message : error);
    }
}

// Count of agreements per client (for the Client Management badge).
export async function getClientAgreementSummary(clientId: string): Promise<ActionResult<{
    total: number;
    signed: number;
    draft: number;
    sent: number;
}>> {
    try {
        const { activeWorkspace } = await assertLegalVaultAccess();
        const supabase = await createClient();
        const { data, error } = await supabase
            .from("legal_agreements")
            .select("status")
            .eq("workspace_id", activeWorkspace.id)
            .eq("client_id", clientId);
        if (error) return { success: false, error: error.message };
        const rows = (data ?? []) as Array<{ status: LegalAgreement["status"] }>;
        const summary = {
            total: rows.length,
            signed: rows.filter((r) => r.status === "signed").length,
            draft: rows.filter((r) => r.status === "draft").length,
            sent: rows.filter((r) => r.status === "sent" || r.status === "viewed").length,
        };
        return { success: true, data: summary };
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : "Unexpected error." };
    }
}
