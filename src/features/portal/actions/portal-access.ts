"use server";

import { createClient } from "@/shared/lib/supabase/server";
import type { Locale, TemplateId } from "@/features/templates/types";

const KNOWN_TEMPLATE_IDS: readonly TemplateId[] = [
    "personal-brand",
    "facility-services",
    "creative-agency",
    "isystem-agency",
    "saas-product",
    "restaurant",
    "ecommerce",
    "nonprofit",
] as const;

function coerceTemplateId(value: string | null | undefined): TemplateId {
    if (value && (KNOWN_TEMPLATE_IDS as readonly string[]).includes(value)) {
        return value as TemplateId;
    }
    return "personal-brand";
}

function coerceLocale(value: string | null | undefined): Locale {
    return value === "nl" ? "nl" : "en";
}

function coerceTier(value: string | null | undefined): "basic" | "pro" {
    return value === "basic" ? "basic" : "pro";
}

export interface PartnerPortalWorkspace {
    id: string;
    name: string;
    templateId: TemplateId;
    tier: "basic" | "pro";
    locale: Locale;
    companyName: string | null;
}

export interface PartnerPortalAccess {
    profileId: string;
    membershipId: string;
    workspace: PartnerPortalWorkspace;
}

export async function getPartnerPortalAccess(): Promise<PartnerPortalAccess | null> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return null;
    }

    const { data: membership } = await supabase
        .from("client_portal_users")
        .select("id, workspace_id, company_name")
        .eq("profile_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

    if (!membership?.workspace_id) {
        return null;
    }

    const { data: workspace } = await supabase
        .from("workspaces")
        .select("id, name, legacy_template_id, workspace_tier, default_locale, is_active")
        .eq("id", membership.workspace_id)
        .eq("is_active", true)
        .maybeSingle();

    if (!workspace) {
        return null;
    }

    return {
        profileId: user.id,
        membershipId: membership.id,
        workspace: {
            id: workspace.id,
            name: workspace.name,
            templateId: coerceTemplateId(workspace.legacy_template_id),
            tier: coerceTier(workspace.workspace_tier),
            locale: coerceLocale(workspace.default_locale),
            companyName: membership.company_name ?? null,
        },
    };
}
