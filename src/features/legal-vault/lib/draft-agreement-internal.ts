import "server-only";

import { createAdminClient } from "@/shared/lib/supabase/admin";
import { renderTemplate, type TemplateContext } from "@/features/legal-vault/lib/render-template";
import { recordLegalAuditEvent } from "@/features/legal-vault/lib/audit";
import type { ActionResult, LegalAgreement } from "@/features/legal-vault/types";
import type { Json } from "@/shared/lib/supabase/database.types";
import { resolveCanonicalBusinessCustomerId } from "@/features/business-spine/service";
import { linkBookingToAgreement } from "@/features/business-spine/quote-to-cash";

/**
 * Internal confirmation-path DVO drafting for PayPal/webhook/worker calls.
 * This module is server-only rather than a `use server` action module: the
 * explicit workspace argument is trusted only by internal server callers and
 * cannot be invoked as a public Server Action from a browser.
 */
export async function draftAgreementFromBookingInternal(params: {
    bookingId: string;
    workspaceId: string;
}): Promise<ActionResult<LegalAgreement>> {
    try {
        const supabase = createAdminClient();
        const existingResult = await supabase
            .from("legal_agreements")
            .select("*")
            .eq("workspace_id", params.workspaceId)
            .eq("booking_id", params.bookingId)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
        if (existingResult.error) return { success: false, error: existingResult.error.message };
        if (existingResult.data) {
            await linkBookingAgreementBestEffort({
                supabase,
                workspaceId: params.workspaceId,
                bookingId: params.bookingId,
                agreementId: existingResult.data.id,
                portalClientId: existingResult.data.client_id,
                email: existingResult.data.party_email,
                source: "existing_agreement",
            });
            return { success: true, data: mapIntegrationAgreementRow(existingResult.data) };
        }

        const { data: reservation, error: reservationError } = await supabase
            .from("booking_reservations")
            .select("id, customer_full_name, customer_email, scheduled_start, metadata, booking_services(title, price_amount_cents)")
            .eq("id", params.bookingId)
            .eq("workspace_id", params.workspaceId)
            .maybeSingle();
        if (reservationError) return { success: false, error: reservationError.message };
        if (!reservation) return { success: false, error: "Booking not found." };

        const { data: templateRows, error: templateError } = await supabase
            .from("legal_agreement_templates")
            .select("*")
            .eq("is_active", true)
            .eq("category", "dvo")
            .or(`workspace_id.is.null,workspace_id.eq.${params.workspaceId}`)
            .order("workspace_id", { ascending: false, nullsFirst: false })
            .order("name", { ascending: true });
        if (templateError) return { success: false, error: templateError.message };
        const template = (templateRows ?? []).find((row) => row.slug === "dvo-nl-zzp-standaard") ?? templateRows?.[0];
        if (!template) return { success: false, error: "No DVO template available." };

        const customerName = reservation.customer_full_name ?? "Onbekende klant";
        const customerEmail = reservation.customer_email ?? "";
        if (!customerEmail) return { success: false, error: "Customer email is required to draft an agreement." };

        const profileResult = await supabase
            .from("legal_invoice_profiles" as never)
            .select("*" as never)
            .eq("workspace_id" as never, params.workspaceId as never)
            .maybeSingle() as unknown as {
                data: {
                    kvk_number: string | null;
                    btw_id: string | null;
                    default_payment_terms_days: number | null;
                    legal_name: string | null;
                    city: string | null;
                } | null;
                error: { message: string } | null;
            };
        const { data: profile, error: profileError } = profileResult;
        if (profileError) return { success: false, error: profileError.message };
        if (!profile || !profile.kvk_number || profile.kvk_number.trim() === "TBD" || !profile.btw_id || profile.btw_id.trim() === "TBD") {
            return {
                success: false,
                error: "Please configure your Legal Invoice Profile (including KvK and VAT/BTW numbers) in bookkeeping settings before drafting agreements.",
            };
        }

        const serviceValue = reservation.booking_services as unknown as Array<{ title: string; price_amount_cents?: number | null }> | { title: string; price_amount_cents?: number | null } | null;
        const serviceName = Array.isArray(serviceValue)
            ? serviceValue[0]?.title ?? "Adviesopdracht"
            : serviceValue?.title ?? "Adviesopdracht";
        const reservationMetadata = reservation.metadata && typeof reservation.metadata === "object" && !Array.isArray(reservation.metadata)
            ? reservation.metadata as Record<string, unknown>
            : {};
        const metadataAmount = reservationMetadata.paymentNetAmountCents ?? reservationMetadata.paymentAmountCents;
        const totalCents = typeof metadataAmount === "number" && Number.isFinite(metadataAmount)
            ? metadataAmount
            : Array.isArray(serviceValue)
                ? Number(serviceValue[0]?.price_amount_cents ?? 0)
                : Number(serviceValue?.price_amount_cents ?? 0);
        const startAt = reservation.scheduled_start ?? new Date().toISOString();
        const variables: Record<string, string | number> = {
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
        };
        const renderedHtml = renderTemplate(template.body_mdx, variables as TemplateContext);
        const { data: agreement, error: agreementError } = await supabase
            .from("legal_agreements")
            .insert({
                workspace_id: params.workspaceId,
                template_id: template.id,
                client_id: null,
                booking_id: params.bookingId,
                status: "draft",
                title: `${template.name} — ${customerName}`,
                party_name: customerName,
                party_email: customerEmail,
                effective_date: startAt.slice(0, 10),
                expires_at: null,
                payload: {
                    variables,
                    template_slug: template.slug,
                    template_version: template.version,
                    rendered_html: renderedHtml,
                    locale: template.locale,
                    jurisdiction: template.jurisdiction,
                } as Json,
                created_by: null,
            })
            .select("*")
            .single();

        if (agreementError || !agreement) {
            if (agreementError?.code === "23505") {
                const { data: winner } = await supabase
                    .from("legal_agreements")
                    .select("*")
                    .eq("workspace_id", params.workspaceId)
                    .eq("booking_id", params.bookingId)
                    .order("created_at", { ascending: true })
                    .limit(1)
                    .maybeSingle();
                if (winner) {
                    await linkBookingAgreementBestEffort({
                        supabase,
                        workspaceId: params.workspaceId,
                        bookingId: params.bookingId,
                        agreementId: winner.id,
                        portalClientId: winner.client_id,
                        email: winner.party_email,
                        source: "existing_agreement",
                    });
                    return { success: true, data: mapIntegrationAgreementRow(winner) };
                }
            }
            return { success: false, error: agreementError?.message ?? "Failed to create agreement." };
        }

        await recordLegalAuditEvent({
            workspaceId: params.workspaceId,
            actorUserId: null,
            event: "agreement.created",
            resourceType: "agreement",
            resourceId: agreement.id,
            metadata: {
                templateSlug: template.slug,
                templateVersion: template.version,
                status: "draft",
                partyEmail: customerEmail,
                source: "booking_confirmation",
            },
        });
        await linkBookingAgreementBestEffort({
            supabase,
            workspaceId: params.workspaceId,
            bookingId: params.bookingId,
            agreementId: agreement.id,
            portalClientId: agreement.client_id,
            email: agreement.party_email,
            source: "draft_agreement",
        });
        return { success: true, data: mapIntegrationAgreementRow(agreement) };
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : "Unexpected error." };
    }
}

function mapIntegrationAgreementRow(row: {
    id: string;
    workspace_id: string;
    template_id: string | null;
    document_id: string | null;
    client_id: string | null;
    booking_id: string | null;
    status: LegalAgreement["status"];
    title: string;
    party_name: string;
    party_email: string;
    effective_date: string | null;
    expires_at: string | null;
    signed_at: string | null;
    signed_sha256: string | null;
    payload: Json;
    public_token: string;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}): LegalAgreement {
    return {
        id: row.id,
        workspaceId: row.workspace_id,
        templateId: row.template_id,
        documentId: row.document_id,
        clientId: row.client_id,
        bookingId: row.booking_id,
        status: row.status,
        title: row.title,
        partyName: row.party_name,
        partyEmail: row.party_email,
        effectiveDate: row.effective_date,
        expiresAt: row.expires_at,
        signedAt: row.signed_at,
        signedSha256: row.signed_sha256,
        payload: row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
            ? row.payload as Record<string, unknown>
            : {},
        publicToken: row.public_token,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

async function linkBookingAgreementBestEffort(input: {
    supabase?: ReturnType<typeof createAdminClient>;
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
        if (!result.success) console.warn("[legal-vault] booking agreement commercial link failed", result.error);
    } catch (error) {
        console.warn("[legal-vault] booking agreement commercial link failed", error instanceof Error ? error.message : error);
    }
}
