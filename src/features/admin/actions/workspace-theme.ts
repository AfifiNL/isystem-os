"use server";

import { createClient } from "@/shared/lib/supabase/server";
import {
    assertWorkspaceOwnerAdmin,
    getEffectiveCapabilities,
    resolveWorkspaceContext,
} from "@/shared/lib/workspace/context";

interface SetActiveWorkspaceThemeInput {
    workspaceId: string;
    themeVersionId: string;
    effectiveFrom?: string;
}

const REQUIRED_THEME_ORDER = [
    "personal-brand",
    "ecommerce",
    "nonprofit",
    "creative-agency",
    "isystem-agency",
    "restaurant",
    "saas-product",
    "facility-services",
] as const;

const REQUIRED_THEME_LABELS: Record<(typeof REQUIRED_THEME_ORDER)[number], string> = {
    "personal-brand": "Personal Brand",
    ecommerce: "E-Commerce",
    nonprofit: "Nonprofit",
    "creative-agency": "Creative Agency",
    "isystem-agency": "iSystem.ai — Digital Operating System",
    restaurant: "Restaurant",
    "saas-product": "SaaS Product",
    "facility-services": "Facility Services",
};

export async function getWorkspaceThemeVersions(workspaceId: string) {
    try {
        await assertWorkspaceOwnerAdmin(workspaceId);
        const supabase = await createClient();

        const { data, error } = await supabase
            .from("theme_versions")
            .select(`
                id,
                theme_id,
                version,
                status,
                is_default,
                released_at,
                config,
                theme_catalog!inner(theme_key, name)
            `)
            .order("released_at", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false });

        if (error) {
            return { data: null, error: error.message };
        }

        const serialized = (data ?? []).map((row) => {
            const catalog = Array.isArray(row.theme_catalog)
                ? row.theme_catalog[0]
                : row.theme_catalog;

            const themeKey = catalog?.theme_key ?? "";
            const knownLabel = REQUIRED_THEME_LABELS[themeKey as keyof typeof REQUIRED_THEME_LABELS];

            return {
                id: row.id,
                themeId: row.theme_id,
                version: row.version,
                status: row.status,
                isDefault: Boolean(row.is_default),
                releasedAt: row.released_at,
                themeKey,
                themeName: catalog?.name ?? knownLabel ?? themeKey,
                config: row.config,
            };
        });

        const orderIndex = new Map(REQUIRED_THEME_ORDER.map((key, index) => [key, index]));

        serialized.sort((a, b) => {
            const aIndex = orderIndex.get(a.themeKey);
            const bIndex = orderIndex.get(b.themeKey);

            if (aIndex !== undefined && bIndex !== undefined && aIndex !== bIndex) {
                return aIndex - bIndex;
            }
            if (aIndex !== undefined && bIndex === undefined) {
                return -1;
            }
            if (aIndex === undefined && bIndex !== undefined) {
                return 1;
            }

            return a.themeName.localeCompare(b.themeName);
        });

        return { data: serialized, error: null };
    } catch (err) {
        return {
            data: null,
            error: err instanceof Error ? err.message : "Failed to fetch workspace theme versions",
        };
    }
}

export async function setActiveWorkspaceThemeVersion(input: SetActiveWorkspaceThemeInput) {
    try {
        const context = await assertWorkspaceOwnerAdmin(input.workspaceId);
        const supabase = await createClient();

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user || user.id !== context.userId) {
            return { data: null, error: "Unauthorized" };
        }

        const nowIso = new Date().toISOString();

        await supabase
            .from("workspace_theme_bindings")
            .update({
                is_active: false,
                effective_to: nowIso,
            })
            .eq("workspace_id", input.workspaceId)
            .eq("is_active", true)
            .is("effective_to", null);

        const { data, error } = await supabase
            .from("workspace_theme_bindings")
            .insert({
                workspace_id: input.workspaceId,
                theme_version_id: input.themeVersionId,
                is_active: true,
                effective_from: input.effectiveFrom ?? nowIso,
                effective_to: null,
                bound_by_profile_id: context.userId,
            })
            .select("id, workspace_id, theme_version_id, is_active, effective_from, effective_to, created_at")
            .single();

        if (error) {
            return { data: null, error: error.message };
        }

        return { data, error: null };
    } catch (err) {
        return {
            data: null,
            error: err instanceof Error ? err.message : "Failed to set workspace theme version",
        };
    }
}

export async function getWorkspaceThemeManifest(workspaceId?: string) {
    const context = await resolveWorkspaceContext({ workspaceId });

    if (!context || !context.activeWorkspace) {
        return { data: null, error: "Unauthorized or no active workspace" };
    }

    const capabilities = await getEffectiveCapabilities(context.activeWorkspace.id);
    const themeConfig = context.activeThemeVersion?.config ?? {};
    const themeConfigRecord = themeConfig && typeof themeConfig === "object" && !Array.isArray(themeConfig)
        ? (themeConfig as Record<string, unknown>)
        : {};
    const dashboardConfig = themeConfig && typeof themeConfig === "object" && !Array.isArray(themeConfig)
        ? (themeConfigRecord.dashboard as Record<string, unknown> | undefined)
        : undefined;
    const rawModules: unknown[] = Array.isArray(dashboardConfig?.modules)
        ? (dashboardConfig.modules as unknown[])
        : Array.isArray(themeConfigRecord.modules)
            ? (themeConfigRecord.modules as unknown[])
            : [];
    const modules = rawModules.filter((module): module is string => typeof module === "string");

    return {
        data: {
            workspace: {
                id: context.activeWorkspace.id,
                slug: context.activeWorkspace.slug,
                name: context.activeWorkspace.name,
                workspaceTier: context.activeWorkspace.workspace_tier,
            },
            role: context.role,
            theme: context.activeThemeVersion
                ? {
                      id: context.activeThemeVersion.id,
                      themeId: context.activeThemeVersion.theme_id,
                      themeKey: context.activeThemeVersion.theme_key,
                      themeName: context.activeThemeVersion.theme_name,
                      version: context.activeThemeVersion.version,
                      status: context.activeThemeVersion.status,
                  }
                : null,
            modules,
            capabilities,
            productFeatures: context.productFeatures,
        },
        error: null,
    };
}
