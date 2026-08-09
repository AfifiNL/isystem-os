"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { assertLegalVaultAccess } from "@/features/legal-vault/lib/access";
import { legalAgreementCreateSchema } from "@/features/legal-vault/schema";
import { renderTemplate, type TemplateContext } from "@/features/legal-vault/lib/render-template";
import { getLegalTemplate } from "@/features/legal-vault/actions/templates";
import { recordLegalAuditEvent } from "@/features/legal-vault/lib/audit";
import type {
    ActionResult,
    LegalAgreement,
    LegalAgreementStatus,
    LegalAgreementTemplate,
} from "@/features/legal-vault/types";

interface DbAgreementRow {
    id: string;
    workspace_id: string;
    template_id: string | null;
    document_id: string | null;
    client_id: string | null;
    booking_id: string | null;
    status: LegalAgreementStatus;
    title: string;
    party_name: string;
    party_email: string;
    effective_date: string | null;
    expires_at: string | null;
    signed_at: string | null;
    signed_sha256: string | null;
    payload: Record<string, unknown> | null;
    public_token: string;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export async function listLegalAgreements(options: {
    status?: LegalAgreementStatus;
    limit?: number;
} = {}): Promise<ActionResult<LegalAgreement[]>> {
    try {
        const { activeWorkspace } = await assertLegalVaultAccess();
        const supabase = await createClient();

        let query = supabase
            .from("legal_agreements")
            .select("*")
            .eq("workspace_id", activeWorkspace.id)
            .order("created_at", { ascending: false })
            .limit(options.limit ?? 100);

        if (options.status) query = query.eq("status", options.status);

        const { data, error } = await query;
        if (error) return { success: false, error: error.message };
        return { success: true, data: (data ?? []).map(mapAgreementRow) };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function getLegalAgreement(id: string): Promise<ActionResult<LegalAgreement>> {
    try {
        const { activeWorkspace } = await assertLegalVaultAccess();
        const supabase = await createClient();
        const { data, error } = await supabase
            .from("legal_agreements")
            .select("*")
            .eq("id", id)
            .eq("workspace_id", activeWorkspace.id)
            .maybeSingle();
        if (error) return { success: false, error: error.message };
        if (!data) return { success: false, error: "Agreement not found." };
        return { success: true, data: mapAgreementRow(data) };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error) };
    }
}

interface CreateAgreementInput {
    templateId: string;
    clientId?: string | null;
    bookingId?: string | null;
    partyName: string;
    partyEmail: string;
    effectiveDate?: string;
    expiresAt?: string;
    variables: Record<string, string | number>;
}

export async function createLegalAgreement(
    input: CreateAgreementInput,
): Promise<ActionResult<LegalAgreement>> {
    try {
        const parsed = legalAgreementCreateSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
        }

        const { activeWorkspace, userId } = await assertLegalVaultAccess();
        const tplResult = await getLegalTemplate(parsed.data.templateId);
        if (!tplResult.success) return tplResult;
        const template = tplResult.data;

        const missing = validateRequiredVariables(template, parsed.data.variables);
        if (missing.length > 0) {
            return {
                success: false,
                error: `Missing required variables: ${missing.join(", ")}`,
            };
        }

        const renderedHtml = renderTemplate(template.bodyMdx, parsed.data.variables as TemplateContext);

        const supabase = await createClient();
        const title = deriveTitle(template, parsed.data.variables, parsed.data.partyName);

        const { data: row, error } = await supabase
            .from("legal_agreements")
            .insert({
                workspace_id: activeWorkspace.id,
                template_id: template.id,
                client_id: parsed.data.clientId ?? null,
                booking_id: parsed.data.bookingId ?? null,
                status: "draft",
                title,
                party_name: parsed.data.partyName,
                party_email: parsed.data.partyEmail,
                effective_date: parsed.data.effectiveDate ?? null,
                expires_at: parsed.data.expiresAt ?? null,
                payload: {
                    variables: parsed.data.variables,
                    template_slug: template.slug,
                    template_version: template.version,
                    rendered_html: renderedHtml,
                    locale: template.locale,
                    jurisdiction: template.jurisdiction,
                },
                created_by: userId,
            })
            .select("*")
            .single();

        if (error || !row) {
            return { success: false, error: error?.message ?? "Failed to create agreement." };
        }

        revalidatePath("/dashboard/legal-vault");
        revalidatePath("/dashboard/legal-vault/agreements");
        await recordLegalAuditEvent({
            workspaceId: activeWorkspace.id,
            actorUserId: userId,
            event: "agreement.created",
            resourceType: "agreement",
            resourceId: row.id,
            metadata: {
                templateSlug: template.slug,
                templateVersion: template.version,
                status: "draft",
                partyEmail: parsed.data.partyEmail,
            },
        });
        return { success: true, data: mapAgreementRow(row) };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function voidLegalAgreement(id: string): Promise<ActionResult<{ id: string }>> {
    try {
        const { activeWorkspace, userId } = await assertLegalVaultAccess();
        const supabase = await createClient();
        const { error } = await supabase
            .from("legal_agreements")
            .update({ status: "void" })
            .eq("id", id)
            .eq("workspace_id", activeWorkspace.id)
            .in("status", ["draft", "sent", "viewed"]);
        if (error) return { success: false, error: error.message };
        revalidatePath("/dashboard/legal-vault/agreements");
        await recordLegalAuditEvent({
            workspaceId: activeWorkspace.id,
            actorUserId: userId,
            event: "agreement.voided",
            resourceType: "agreement",
            resourceId: id,
        });
        return { success: true, data: { id } };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error) };
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateRequiredVariables(
    template: LegalAgreementTemplate,
    values: Record<string, string | number>,
): string[] {
    const missing: string[] = [];
    for (const variable of template.variables) {
        if (!variable.required) continue;
        const value = values[variable.key];
        if (value === undefined || value === null || (typeof value === "string" && value.trim().length === 0)) {
            missing.push(variable.key);
        }
    }
    return missing;
}

function deriveTitle(
    template: LegalAgreementTemplate,
    values: Record<string, string | number>,
    partyName: string,
): string {
    const counterparty = String(values.client_name ?? values.party_b ?? values.controller_name ?? partyName ?? "");
    return counterparty ? `${template.name} — ${counterparty}` : template.name;
}

function mapAgreementRow(row: DbAgreementRow): LegalAgreement {
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
        payload: row.payload ?? {},
        publicToken: row.public_token,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Unexpected error.";
}
