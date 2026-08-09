"use server";

import { createClient } from "@/shared/lib/supabase/server";
import { assertLegalVaultAccess } from "@/features/legal-vault/lib/access";
import type {
    ActionResult,
    LegalAgreementTemplate,
    LegalTemplateCategory,
    TemplateVariable,
} from "@/features/legal-vault/types";

interface DbTemplateRow {
    id: string;
    workspace_id: string | null;
    slug: string;
    name: string;
    locale: string;
    jurisdiction: string;
    category: LegalTemplateCategory;
    body_mdx: string;
    variables: TemplateVariable[] | null;
    is_active: boolean;
    version: number;
    created_at: string;
    updated_at: string;
}

export async function listLegalTemplates(
    options: { category?: LegalTemplateCategory } = {},
): Promise<ActionResult<LegalAgreementTemplate[]>> {
    try {
        const { activeWorkspace } = await assertLegalVaultAccess();
        const supabase = await createClient();

        let query = supabase
            .from("legal_agreement_templates")
            .select("*")
            .eq("is_active", true)
            .or(`workspace_id.is.null,workspace_id.eq.${activeWorkspace.id}`)
            .order("category", { ascending: true })
            .order("name", { ascending: true });

        if (options.category) {
            query = query.eq("category", options.category);
        }

        const { data, error } = await query;
        if (error) return { success: false, error: error.message };

        return { success: true, data: (data ?? []).map(mapTemplateRow) };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function getLegalTemplate(
    id: string,
): Promise<ActionResult<LegalAgreementTemplate>> {
    try {
        const { activeWorkspace } = await assertLegalVaultAccess();
        const supabase = await createClient();

        const { data, error } = await supabase
            .from("legal_agreement_templates")
            .select("*")
            .eq("id", id)
            .or(`workspace_id.is.null,workspace_id.eq.${activeWorkspace.id}`)
            .maybeSingle();

        if (error) return { success: false, error: error.message };
        if (!data) return { success: false, error: "Template not found." };
        return { success: true, data: mapTemplateRow(data) };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error) };
    }
}

function mapTemplateRow(row: DbTemplateRow): LegalAgreementTemplate {
    return {
        id: row.id,
        workspaceId: row.workspace_id,
        slug: row.slug,
        name: row.name,
        locale: row.locale,
        jurisdiction: row.jurisdiction,
        category: row.category,
        bodyMdx: row.body_mdx,
        variables: Array.isArray(row.variables) ? row.variables : [],
        isActive: row.is_active,
        version: row.version,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Unexpected error.";
}
