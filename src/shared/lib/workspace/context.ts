import { createClient } from "@/shared/lib/supabase/server";
import type { Locale } from "@/features/templates/types";
import { cookies } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const ACTIVE_WORKSPACE_COOKIE = "active_workspace_id";

export type ProfileRole = "admin" | "manager" | "user";
export type WorkspaceTier = "basic" | "pro";

export interface WorkspaceProductFeatures {
    aiGeneration: boolean;
    bookingEngine: boolean;
    bookingAnalytics: boolean;
    bookingTemplatesPremium: boolean;
}

export interface WorkspaceSummary {
    id: string;
    slug: string;
    name: string;
    workspace_tier: WorkspaceTier;
    compute_credits: number;
    default_locale: Locale;
    owner_profile_id: string | null;
    legacy_template_id: string;
    is_active: boolean;
    wallpaper_url: string | null;
    metadata: Record<string, unknown>;
}

export interface ThemeVersionSummary {
    id: string;
    theme_id: string;
    theme_key: string;
    theme_name: string;
    version: string;
    status: string;
    config: Record<string, unknown>;
}

export interface WorkspaceContext {
    userId: string;
    role: ProfileRole;
    accessibleWorkspaces: WorkspaceSummary[];
    activeWorkspace: WorkspaceSummary | null;
    activeThemeVersion: ThemeVersionSummary | null;
    effectiveCapabilities: string[];
    productFeatures: WorkspaceProductFeatures;
}

export interface ResolveWorkspaceContextOptions {
    workspaceId?: string;
    templateId?: string;
}

export interface AuthorizedContentAccess {
    context: WorkspaceContext & { activeWorkspace: WorkspaceSummary };
    content: {
        id: string;
        title: string;
        slug: string | null;
        workspace_id: string | null;
        template_id: string | null;
        author_id: string | null;
        type: string | null;
        status: string | null;
        content_markdown: string | null;
        metadata: Record<string, unknown>;
        locale: string | null;
    };
}

function coerceRole(value: string | null | undefined): ProfileRole {
    if (value === "admin" || value === "manager") {
        return value;
    }

    return "user";
}

function coerceLocale(value: string | null | undefined): Locale {
    if (value === "nl" || value === "ar" || value === "en") {
        return value;
    }

    return "en";
}

function coerceTemplateId(value: string | null | undefined): string {
    const candidate = value?.trim();
    if (candidate) {
        return candidate;
    }

    return "personal-brand";
}

function coerceWorkspaceTier(value: string | null | undefined): WorkspaceTier {
    return value === "basic" ? "basic" : "pro";
}

function getWorkspaceProductFeatures(workspace: WorkspaceSummary | null): WorkspaceProductFeatures {
    const isProWorkspace = workspace?.workspace_tier === "pro";

    return {
        aiGeneration: isProWorkspace,
        bookingEngine: isProWorkspace,
        bookingAnalytics: isProWorkspace,
        bookingTemplatesPremium: isProWorkspace,
    };
}

function asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    return value as Record<string, unknown>;
}

function getSupabaseServiceRoleClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (!url || !serviceRoleKey) {
        return null;
    }

    return createSupabaseClient(url, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

async function getAdminAccessibleWorkspaces(): Promise<WorkspaceSummary[]> {
    const supabase = getSupabaseServiceRoleClient();

    if (!supabase) {
        return getAccessibleWorkspaces();
    }

    const { data, error } = await supabase
        .from("workspaces")
        .select("id, slug, name, workspace_tier, compute_credits, default_locale, owner_profile_id, legacy_template_id, is_active, wallpaper_url, metadata")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

    if (error || !data) {
        return [];
    }

    return data.map((workspace) => ({
        id: workspace.id,
        slug: workspace.slug,
        name: workspace.name,
        workspace_tier: coerceWorkspaceTier(workspace.workspace_tier),
        compute_credits: typeof workspace.compute_credits === "number" ? workspace.compute_credits : 0,
        default_locale: coerceLocale(workspace.default_locale),
        owner_profile_id: workspace.owner_profile_id,
        legacy_template_id: coerceTemplateId(workspace.legacy_template_id),
        is_active: workspace.is_active,
        wallpaper_url: typeof workspace.wallpaper_url === "string" ? workspace.wallpaper_url : null,
        metadata: asRecord(workspace.metadata),
    }));
}

async function getAdminActiveThemeVersion(workspaceId: string): Promise<ThemeVersionSummary | null> {
    if (!workspaceId) {
        return null;
    }

    const supabase = getSupabaseServiceRoleClient();

    if (!supabase) {
        return getActiveThemeVersion(workspaceId);
    }

    const { data, error } = await supabase
        .from("workspace_theme_bindings")
        .select(`
            theme_version_id,
            theme_versions!inner(
                id,
                theme_id,
                version,
                status,
                config,
                theme_catalog!inner(
                    theme_key,
                    name
                )
            )
        `)
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .is("effective_to", null)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error || !data?.theme_versions) {
        return null;
    }

    const version = Array.isArray(data.theme_versions)
        ? data.theme_versions[0]
        : data.theme_versions;

    if (!version) {
        return null;
    }

    const catalog = Array.isArray(version.theme_catalog)
        ? version.theme_catalog[0]
        : version.theme_catalog;

    return {
        id: version.id,
        theme_id: version.theme_id,
        theme_key: catalog?.theme_key ?? "",
        theme_name: catalog?.name ?? "",
        version: version.version,
        status: version.status,
        config: asRecord(version.config),
    };
}

async function getAdminEffectiveCapabilities(): Promise<string[]> {
    const supabase = getSupabaseServiceRoleClient();

    if (!supabase) {
        return [];
    }

    const { data, error } = await supabase
        .from("capabilities")
        .select("capability_key")
        .eq("is_active", true);

    if (error || !data) {
        return [];
    }

    return data
        .map((capability) => capability.capability_key)
        .filter((capability): capability is string => typeof capability === "string");
}

export async function getCurrentUserRole(): Promise<{ userId: string; role: ProfileRole } | null> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return null;
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

    return {
        userId: user.id,
        role: coerceRole(profile?.role),
    };
}

export async function getAccessibleWorkspaces(): Promise<WorkspaceSummary[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("workspaces")
        .select("id, slug, name, workspace_tier, compute_credits, default_locale, owner_profile_id, legacy_template_id, is_active, wallpaper_url, metadata")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

    if (error || !data) {
        return [];
    }

    return data.map((workspace) => ({
        id: workspace.id,
        slug: workspace.slug,
        name: workspace.name,
        workspace_tier: coerceWorkspaceTier(workspace.workspace_tier),
        compute_credits: typeof workspace.compute_credits === "number" ? workspace.compute_credits : 0,
        default_locale: coerceLocale(workspace.default_locale),
        owner_profile_id: workspace.owner_profile_id,
        legacy_template_id: coerceTemplateId(workspace.legacy_template_id),
        is_active: workspace.is_active,
        wallpaper_url: typeof workspace.wallpaper_url === "string" ? workspace.wallpaper_url : null,
        metadata: asRecord(workspace.metadata),
    }));
}

export async function resolveWorkspaceIdFromTemplate(templateId: string): Promise<string | null> {
    const candidateTemplateId = templateId?.trim();
    if (!candidateTemplateId) {
        return null;
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("resolve_workspace_id_from_template", {
        p_template_id: candidateTemplateId,
    });

    if (error) {
        return null;
    }

    return typeof data === "string" ? data : null;
}

export async function getActiveThemeVersion(workspaceId: string): Promise<ThemeVersionSummary | null> {
    if (!workspaceId) {
        return null;
    }

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("workspace_theme_bindings")
        .select(`
            theme_version_id,
            theme_versions!inner(
                id,
                theme_id,
                version,
                status,
                config,
                theme_catalog!inner(
                    theme_key,
                    name
                )
            )
        `)
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .is("effective_to", null)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error || !data?.theme_versions) {
        return null;
    }

    const version = Array.isArray(data.theme_versions)
        ? data.theme_versions[0]
        : data.theme_versions;

    if (!version) {
        return null;
    }

    const catalog = Array.isArray(version.theme_catalog)
        ? version.theme_catalog[0]
        : version.theme_catalog;

    return {
        id: version.id,
        theme_id: version.theme_id,
        theme_key: catalog?.theme_key ?? "",
        theme_name: catalog?.name ?? "",
        version: version.version,
        status: version.status,
        config: asRecord(version.config),
    };
}

export async function getEffectiveCapabilities(workspaceId: string): Promise<string[]> {
    if (!workspaceId) {
        return [];
    }

    const supabase = await createClient();
    const { data: capabilities, error } = await supabase
        .from("capabilities")
        .select("capability_key")
        .eq("is_active", true);

    if (error || !capabilities?.length) {
        return [];
    }

    const checks = await Promise.all(
        capabilities.map(async ({ capability_key }) => {
            const { data: allowed } = await supabase.rpc("has_workspace_capability", {
                p_workspace_id: workspaceId,
                p_capability_key: capability_key,
            });

            return {
                key: capability_key,
                allowed: Boolean(allowed),
            };
        }),
    );

    return checks.filter((item) => item.allowed).map((item) => item.key);
}

export async function resolveWorkspaceContext(
    options: ResolveWorkspaceContextOptions = {},
): Promise<WorkspaceContext | null> {
    const userRole = await getCurrentUserRole();
    if (!userRole) {
        return null;
    }

    const isAdmin = userRole.role === "admin";
    const workspaces = isAdmin
        ? await getAdminAccessibleWorkspaces()
        : await getAccessibleWorkspaces();
    let activeWorkspace: WorkspaceSummary | null = null;
    const cookieStore = await cookies();
    const workspaceFromCookie = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value ?? null;

    if (options.workspaceId) {
        activeWorkspace = workspaces.find((workspace) => workspace.id === options.workspaceId) ?? null;
    }

    if (!activeWorkspace && workspaceFromCookie) {
        activeWorkspace = workspaces.find((workspace) => workspace.id === workspaceFromCookie) ?? null;
    }

    if (!activeWorkspace && options.templateId) {
        const workspaceId = await resolveWorkspaceIdFromTemplate(options.templateId);
        activeWorkspace = workspaces.find((workspace) => workspace.id === workspaceId) ?? null;
    }

    if (!activeWorkspace) {
        activeWorkspace = workspaces[0] ?? null;
    }

    const activeThemeVersion = activeWorkspace
        ? await (isAdmin ? getAdminActiveThemeVersion(activeWorkspace.id) : getActiveThemeVersion(activeWorkspace.id))
        : null;

    const effectiveCapabilities = activeWorkspace
        ? await (isAdmin ? getAdminEffectiveCapabilities() : getEffectiveCapabilities(activeWorkspace.id))
        : [];

    const productFeatures = getWorkspaceProductFeatures(activeWorkspace);

    return {
        userId: userRole.userId,
        role: userRole.role,
        accessibleWorkspaces: workspaces,
        activeWorkspace,
        activeThemeVersion,
        effectiveCapabilities,
        productFeatures,
    };
}

export async function assertWorkspaceOwnerAdmin(workspaceId: string) {
    const context = await resolveWorkspaceContext({ workspaceId });

    if (!context) {
        throw new Error("Unauthorized");
    }

    if (context.role !== "admin") {
        throw new Error("Forbidden: admin role required");
    }

    if (!context.activeWorkspace || context.activeWorkspace.owner_profile_id !== context.userId) {
        throw new Error("Forbidden: admin must own workspace");
    }

    return context;
}

export async function assertWorkspaceAiEnabled(): Promise<WorkspaceContext & { activeWorkspace: WorkspaceSummary }> {
    const context = await resolveWorkspaceContext();

    if (!context || !context.activeWorkspace) {
        throw new Error("Unauthorized: No active workspace session found.");
    }

    if (!context.productFeatures.aiGeneration) {
        throw new Error("AI generation is only available on Pro workspaces.");
    }

    return {
        ...context,
        activeWorkspace: context.activeWorkspace,
    };
}

/**
 * Gate writes to workspace-scoped admin resources (music library, podcast shows,
 * podcast episodes). Owners on the active workspace AND globally-scoped admin /
 * manager profiles both pass. The DB also enforces this via the
 * `is_workspace_admin_or_manager(workspace_id)` RLS helper, so this is the
 * UX-side check — the source of truth lives in Postgres.
 */
export async function assertWorkspaceAdminOrManager(): Promise<WorkspaceContext & { activeWorkspace: WorkspaceSummary }> {
    const context = await resolveWorkspaceContext();

    if (!context || !context.activeWorkspace) {
        throw new Error("Unauthorized: No active workspace session found.");
    }

    const isProfileAdminOrManager = context.role === "admin" || context.role === "manager";
    const isOwner = context.activeWorkspace.owner_profile_id === context.userId;

    if (!isProfileAdminOrManager && !isOwner) {
        throw new Error("Forbidden: admin or manager role required.");
    }

    return {
        ...context,
        activeWorkspace: context.activeWorkspace,
    };
}

export async function assertWorkspaceBookingEnabled(): Promise<WorkspaceContext & { activeWorkspace: WorkspaceSummary }> {
    const context = await resolveWorkspaceContext();

    if (!context || !context.activeWorkspace) {
        throw new Error("Unauthorized: No active workspace session found.");
    }

    if (!context.productFeatures.bookingEngine) {
        throw new Error("The premium booking system is only available on Pro workspaces.");
    }

    return {
        ...context,
        activeWorkspace: context.activeWorkspace,
    };
}

export async function assertAuthorizedContentAccess(
    contentId: string,
    options: {
        requireAiEnabled?: boolean;
    } = {},
): Promise<AuthorizedContentAccess> {
    const context = options.requireAiEnabled
        ? await assertWorkspaceAiEnabled()
        : await resolveWorkspaceContext();

    if (!context || !context.activeWorkspace) {
        throw new Error("Unauthorized: No active workspace session found.");
    }

    const supabase = await createClient();
    const { data: content, error } = await supabase
        .from("content_items")
        .select("id, title, slug, workspace_id, template_id, author_id, type, status, content_markdown, metadata, locale")
        .eq("id", contentId)
        .maybeSingle();

    if (error) {
        throw new Error("Failed to verify content access.");
    }

    if (!content) {
        throw new Error("Content item not found.");
    }

    const activeWorkspace = context.activeWorkspace;
    const matchesWorkspace = content.workspace_id === activeWorkspace.id;
    const matchesTemplate = !content.workspace_id && content.template_id === activeWorkspace.legacy_template_id;

    if (!matchesWorkspace && !matchesTemplate) {
        throw new Error("Forbidden: content is outside the active workspace scope.");
    }

    return {
        context: {
            ...context,
            activeWorkspace,
        },
        content: {
            ...content,
            metadata: asRecord(content.metadata),
        },
    };
}
