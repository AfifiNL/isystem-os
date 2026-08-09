import type { ClientConfig } from "./schema";
import type { Json } from "../supabase/database.types";

export interface WorkspaceSettingsSeed {
    workspace_id: string;
    site_name: string;
    site_description: string;
    site_domain: string;
    contact_email: string;
    contact_phone: string | null;
    locale_override: ClientConfig["defaultLocale"];
    template_override: ClientConfig["template"];
    metadata: Json;
}

export function buildWorkspaceSettingsSeed(
    config: ClientConfig,
    workspaceId: string,
): WorkspaceSettingsSeed {
    return {
        workspace_id: workspaceId,
        site_name: config.site.name,
        site_description: config.site.description,
        site_domain: config.site.domain,
        contact_email: config.site.contactEmail,
        contact_phone: config.site.contactPhone ?? null,
        locale_override: config.defaultLocale,
        template_override: config.template,
        metadata: {
            public_config: {
                brand: config.brand,
                modules: config.modules,
                supportedLocales: config.supportedLocales,
            },
        },
    };
}
