import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/shared/lib/supabase/database.types";

export type PublicWorkspace = {
    id: string;
    name: string;
    templateId: string;
    siteDomain: string;
};

export type PublicWorkspaceResolutionCode = "invalid_host" | "workspace_not_found" | "workspace_mismatch" | "template_mismatch";

export class PublicWorkspaceResolutionError extends Error {
    constructor(public readonly code: PublicWorkspaceResolutionCode, message: string) {
        super(message);
        this.name = "PublicWorkspaceResolutionError";
    }
}

export function normalizePublicRequestHost(value: string | null | undefined): string | null {
    const candidate = value?.split(",", 1)[0]?.trim();
    if (!candidate) return null;
    try {
        const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
        if (url.protocol !== "http:" && url.protocol !== "https:") return null;
        return url.hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "") || null;
    } catch {
        return null;
    }
}

export async function lookupActivePublicWorkspaceByDomain(
    serviceClient: SupabaseClient<Database>,
    domain: string,
): Promise<PublicWorkspace | null> {
    const { data: settingsRows, error: settingsError } = await serviceClient
        .from("workspace_settings")
        .select("workspace_id,site_domain")
        .in("site_domain", [domain, `www.${domain}`])
        .limit(2);
    if (settingsError) throw new Error(settingsError.message);
    if (!settingsRows || settingsRows.length !== 1) return null;

    const { data, error } = await serviceClient
        .from("workspaces")
        .select("id,name,legacy_template_id")
        .eq("id", settingsRows[0].workspace_id)
        .eq("is_active", true)
        .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data?.legacy_template_id) return null;
    return { id: data.id, name: data.name, templateId: data.legacy_template_id, siteDomain: domain };
}

export async function resolvePublicWorkspace(input: {
    requestHost: string | null | undefined;
    expectedWorkspaceId?: string | null;
    expectedTemplateId?: string | null;
    lookupByDomain: (domain: string) => Promise<PublicWorkspace | null>;
}): Promise<PublicWorkspace> {
    const domain = normalizePublicRequestHost(input.requestHost);
    if (!domain) throw new PublicWorkspaceResolutionError("invalid_host", "Public request host is invalid.");
    const workspace = await input.lookupByDomain(domain);
    if (!workspace) throw new PublicWorkspaceResolutionError("workspace_not_found", "No active workspace matches this host.");
    if (input.expectedWorkspaceId && workspace.id !== input.expectedWorkspaceId) {
        throw new PublicWorkspaceResolutionError("workspace_mismatch", "Requested workspace does not match this host.");
    }
    if (input.expectedTemplateId && workspace.templateId !== input.expectedTemplateId) {
        throw new PublicWorkspaceResolutionError("template_mismatch", "Requested template does not match this host.");
    }
    return workspace;
}
