import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/supabase/database.types";

export interface PublicGdprFlags {
    consentRequired: boolean;
    /** banner | essential_only | preferences_panel | none */
    consentMode: string;
    privacyUrl: string | null;
    termsUrl: string | null;
}

const DEFAULT_FLAGS: PublicGdprFlags = {
    consentRequired: false,
    consentMode: "none",
    privacyUrl: null,
    termsUrl: null,
};

/**
 * Reads consent flags for the active workspace using the service role so the
 * banner can render to unauthenticated visitors. RLS on
 * workspace_gdpr_settings restricts reads to workspace members; the public
 * banner needs only four non-sensitive fields, so a narrow service-role read
 * here is acceptable.
 */
export async function getPublicGdprFlags(workspaceId: string | null): Promise<PublicGdprFlags> {
    if (!workspaceId) return DEFAULT_FLAGS;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return DEFAULT_FLAGS;

    const supabase = createServiceClient<Database>(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
        .from("workspace_gdpr_settings")
        .select("consent_required, cookie_consent_mode, privacy_policy_url, terms_url")
        .eq("workspace_id", workspaceId)
        .maybeSingle();

    if (error || !data) return DEFAULT_FLAGS;

    return {
        consentRequired: Boolean(data.consent_required),
        consentMode: typeof data.cookie_consent_mode === "string" ? data.cookie_consent_mode : "banner",
        privacyUrl: typeof data.privacy_policy_url === "string" ? data.privacy_policy_url : null,
        termsUrl: typeof data.terms_url === "string" ? data.terms_url : null,
    };
}
