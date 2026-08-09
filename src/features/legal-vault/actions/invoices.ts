"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { assertLegalVaultAccess } from "@/features/legal-vault/lib/access";
import { recordLegalAuditEvent } from "@/features/legal-vault/lib/audit";
import {
    calculateInvoiceTotals,
    validateDutchInvoice,
    type InvoiceLineInput,
    type InvoiceValidationInput,
} from "@/features/legal-vault/lib/invoice-validation";
import { renderMinimalUblInvoice } from "@/features/legal-vault/lib/ubl";
import { recordLegalInvoiceBusinessEvent } from "@/features/business-spine/recorders";
import { resolveCanonicalBusinessCustomerId } from "@/features/business-spine/service";
import type { ActionResult } from "@/features/legal-vault/types";

export interface InvoiceDraftInput {
    profileId: string;
    clientId?: string | null;
    clientName: string;
    clientAddress?: string | null;
    clientCountryCode?: string;
    clientBtwId?: string | null;
    reverseCharge?: boolean;
    reverseChargeReason?: string | null;
    purchaseOrderReference?: string | null;
    oin?: string | null;
    issueDate?: string;
    dueDate?: string | null;
    lines: InvoiceLineInput[];
}

interface InvoiceProfileRow {
    id: string;
    workspace_id: string;
    legal_name: string;
    address_line1: string;
    postal_code: string;
    city: string;
    country_code: string;
    kvk_number: string;
    btw_id: string | null;
    kor_enabled: boolean;
    default_payment_terms_days: number;
}

export async function validateInvoiceDraft(input: InvoiceDraftInput): Promise<ActionResult<{ errors: string[] }>> {
    try {
        const { activeWorkspace } = await assertLegalVaultAccess();
        const supabase = await createClient();
        const profile = await getInvoiceProfile(supabase, activeWorkspace.id, input.profileId);
        if (!profile.success) return profile;
        const errors = validateDutchInvoice(toValidationInput(profile.data, input));
        return { success: true, data: { errors } };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function createInvoiceDraft(input: InvoiceDraftInput): Promise<ActionResult<{ id: string; totals: { subtotalCents: number; btwTotalCents: number; totalCents: number } }>> {
    try {
        const { activeWorkspace, userId } = await assertLegalVaultAccess();
        const supabase = await createClient();
        const profile = await getInvoiceProfile(supabase, activeWorkspace.id, input.profileId);
        if (!profile.success) return profile;

        const errors = validateDutchInvoice(toValidationInput(profile.data, input));
        if (errors.length > 0) return { success: false, error: errors[0] };

        const totals = calculateInvoiceTotals(input.lines);
        const { data: invoice, error } = await supabase
            .from("legal_invoices")
            .insert({
                workspace_id: activeWorkspace.id,
                profile_id: profile.data.id,
                status: "draft",
                issue_date: input.issueDate ?? new Date().toISOString().slice(0, 10),
                due_date: input.dueDate ?? defaultDueDate(profile.data.default_payment_terms_days),
                client_id: input.clientId ?? null,
                client_name: input.clientName,
                client_address: input.clientAddress ?? null,
                client_country_code: input.clientCountryCode ?? "NL",
                client_btw_id: input.clientBtwId ?? null,
                purchase_order_reference: input.purchaseOrderReference ?? null,
                oin: input.oin ?? null,
                kor_enabled: profile.data.kor_enabled,
                reverse_charge: input.reverseCharge ?? false,
                reverse_charge_reason: input.reverseChargeReason ?? null,
                subtotal_cents: totals.subtotalCents,
                btw_total_cents: totals.btwTotalCents,
                total_cents: totals.totalCents,
                created_by: userId,
            })
            .select("id")
            .single();
        if (error || !invoice) return { success: false, error: error?.message ?? "Failed to create invoice." };

        const lines = input.lines.map((line, index) => {
            const lineTotals = calculateInvoiceTotals([line]);
            return {
                workspace_id: activeWorkspace.id,
                invoice_id: invoice.id,
                description: line.description,
                quantity: line.quantity,
                unit_price_cents: line.unitPriceCents,
                discount_cents: line.discountCents ?? 0,
                btw_rate_bp: line.btwRateBp,
                btw_reason_code: line.btwReasonCode ?? null,
                line_subtotal_cents: lineTotals.subtotalCents,
                line_btw_cents: lineTotals.btwTotalCents,
                line_total_cents: lineTotals.totalCents,
                sort_order: index,
            };
        });
        const lineInsert = await supabase.from("legal_invoice_lines").insert(lines);
        if (lineInsert.error) return { success: false, error: lineInsert.error.message };

        await recordLegalAuditEvent({
            workspaceId: activeWorkspace.id,
            actorUserId: userId,
            event: "invoice.draft_created",
            resourceType: "accounting_entry",
            resourceId: invoice.id,
            metadata: { ...totals },
        });
        const customerId = input.clientId
            ? await resolveCanonicalBusinessCustomerId({
                supabase,
                workspaceId: activeWorkspace.id,
                portalClientId: input.clientId,
            }).catch(() => null)
            : null;
        await recordLegalInvoiceBusinessEvent({
            supabase,
            workspaceId: activeWorkspace.id,
            invoiceId: invoice.id,
            eventType: "draft",
            customerId,
            customer: input.clientId ? { name: input.clientName, portalClientId: input.clientId } : undefined,
            clientName: input.clientName,
            totalCents: totals.totalCents,
            currency: "EUR",
            dueDate: input.dueDate ?? defaultDueDate(profile.data.default_payment_terms_days),
            payload: {
                subtotalCents: totals.subtotalCents,
                btwTotalCents: totals.btwTotalCents,
                totalCents: totals.totalCents,
            },
        });
        revalidatePath("/dashboard/legal-vault/bookkeeping");
        return { success: true, data: { id: invoice.id, totals } };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function renderInvoiceUbl(invoiceId: string): Promise<ActionResult<{ xml: string }>> {
    try {
        const { activeWorkspace } = await assertLegalVaultAccess();
        const supabase = await createClient();
        const { data: invoice, error } = await supabase
            .from("legal_invoices")
            .select("*, legal_invoice_profiles(*)")
            .eq("id", invoiceId)
            .eq("workspace_id", activeWorkspace.id)
            .maybeSingle();
        if (error || !invoice) return { success: false, error: error?.message ?? "Invoice not found." };
        const { data: lines, error: linesError } = await supabase
            .from("legal_invoice_lines")
            .select("*")
            .eq("invoice_id", invoiceId)
            .eq("workspace_id", activeWorkspace.id)
            .order("sort_order", { ascending: true });
        if (linesError) return { success: false, error: linesError.message };
        const profile = invoice.legal_invoice_profiles as InvoiceProfileRow;
        const xml = renderMinimalUblInvoice({
            invoiceNumber: (invoice.invoice_number as string | null) ?? `DRAFT-${invoice.id}`,
            issueDate: invoice.issue_date as string,
            dueDate: (invoice.due_date as string | null) ?? null,
            currency: invoice.currency as string,
            supplier: {
                legalName: profile.legal_name,
                kvkNumber: profile.kvk_number,
                btwId: profile.btw_id,
                addressLine1: profile.address_line1,
                postalCode: profile.postal_code,
                city: profile.city,
                countryCode: profile.country_code,
            },
            client: {
                name: invoice.client_name as string,
                btwId: (invoice.client_btw_id as string | null) ?? null,
                address: (invoice.client_address as string | null) ?? null,
                countryCode: invoice.client_country_code as string,
            },
            reverseCharge: invoice.reverse_charge as boolean,
            korEnabled: invoice.kor_enabled as boolean,
            totals: {
                subtotalCents: Number(invoice.subtotal_cents),
                btwTotalCents: Number(invoice.btw_total_cents),
                totalCents: Number(invoice.total_cents),
            },
            lines: (lines ?? []).map((line) => ({
                description: line.description as string,
                quantity: Number(line.quantity),
                unitPriceCents: Number(line.unit_price_cents),
                discountCents: Number(line.discount_cents),
                btwRateBp: line.btw_rate_bp as number,
                btwReasonCode: (line.btw_reason_code as string | null) ?? null,
            })),
        });
        return { success: true, data: { xml } };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error) };
    }
}

function toValidationInput(profile: InvoiceProfileRow, input: InvoiceDraftInput): InvoiceValidationInput {
    return {
        supplier: {
            legalName: profile.legal_name,
            addressLine1: profile.address_line1,
            postalCode: profile.postal_code,
            city: profile.city,
            countryCode: profile.country_code,
            kvkNumber: profile.kvk_number,
            btwId: profile.btw_id,
            korEnabled: profile.kor_enabled,
        },
        client: {
            name: input.clientName,
            address: input.clientAddress,
            countryCode: input.clientCountryCode ?? "NL",
            btwId: input.clientBtwId,
        },
        reverseCharge: input.reverseCharge,
        lines: input.lines,
    };
}

async function getInvoiceProfile(supabase: Awaited<ReturnType<typeof createClient>>, workspaceId: string, profileId: string): Promise<ActionResult<InvoiceProfileRow>> {
    const { data, error } = await supabase
        .from("legal_invoice_profiles")
        .select("*")
        .eq("id", profileId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
    if (error || !data) return { success: false, error: error?.message ?? "Invoice profile not found." };
    return { success: true, data: data as InvoiceProfileRow };
}

function defaultDueDate(days: number): string {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Unexpected error.";
}
