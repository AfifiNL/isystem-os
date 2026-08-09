import { getTemplateById } from "@/features/templates/registry";
import type { TemplateConfig, TemplateId } from "@/features/templates/types";
import type { WorkspaceContext } from "@/shared/lib/workspace/context";

interface LegacyTemplateResolution {
    templateId: TemplateId;
    config: TemplateConfig;
    source: "workspace.legacy_template_id" | "theme.config" | "site_settings";
}

interface FallbackDiagnostic {
    reason:
    | "missing_workspace_context"
    | "missing_workspace_template"
    | "invalid_workspace_template"
    | "missing_theme_template"
    | "invalid_theme_template"
    | "invalid_site_settings_template";
    workspaceId: string | null;
    fallbackTemplateId: string;
    workspaceTemplateCandidate: string | null;
    themeTemplateCandidate: string | null;
}

function emitFallbackDiagnostic(diagnostic: FallbackDiagnostic) {
    if (diagnostic.reason === "missing_workspace_context") {
        return;
    }

    console.warn("[templates] Falling back to site settings template resolution", diagnostic);
}

function isTemplateId(value: string): value is TemplateId {
    const resolved = getTemplateById(value);
    return resolved.id === value;
}

function extractTemplateCandidateFromThemeConfig(config: Record<string, unknown>): string | null {
    const keys = ["legacy_template_id", "legacyTemplateId", "template_id"] as const;

    for (const key of keys) {
        const value = config[key];
        if (typeof value === "string" && value.trim().length > 0) {
            return value.trim();
        }
    }

    return null;
}

export async function resolveLegacyTemplateForWorkspaceContext(
    context: WorkspaceContext | null,
    fallbackTemplateId: string,
): Promise<LegacyTemplateResolution> {
    const workspaceId = context?.activeWorkspace?.id ?? null;
    const fromWorkspace = context?.activeWorkspace?.legacy_template_id;
    if (fromWorkspace && isTemplateId(fromWorkspace)) {
        return {
            templateId: fromWorkspace,
            config: getTemplateById(fromWorkspace),
            source: "workspace.legacy_template_id",
        };
    }

    const themeConfig = context?.activeThemeVersion?.config ?? {};
    const fromTheme = extractTemplateCandidateFromThemeConfig(themeConfig);

    if (fromTheme && isTemplateId(fromTheme)) {
        return {
            templateId: fromTheme,
            config: getTemplateById(fromTheme),
            source: "theme.config",
        };
    }

    let reason: FallbackDiagnostic["reason"] = "missing_workspace_context";

    if (context?.activeWorkspace) {
        if (!fromWorkspace) {
            reason = fromTheme ? "invalid_theme_template" : "missing_workspace_template";
        } else if (!isTemplateId(fromWorkspace)) {
            reason = "invalid_workspace_template";
        } else if (!fromTheme) {
            reason = "missing_theme_template";
        } else if (!isTemplateId(fromTheme)) {
            reason = "invalid_theme_template";
        }
    }

    const fallbackConfig = getTemplateById(fallbackTemplateId);
    if (fallbackConfig.id !== fallbackTemplateId) {
        reason = "invalid_site_settings_template";
    }

    emitFallbackDiagnostic({
        reason,
        workspaceId,
        fallbackTemplateId,
        workspaceTemplateCandidate: fromWorkspace ?? null,
        themeTemplateCandidate: fromTheme,
    });

    return {
        templateId: fallbackConfig.id,
        config: fallbackConfig,
        source: "site_settings",
    };
}
