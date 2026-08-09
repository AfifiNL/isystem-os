import type { WorkspaceContext } from "@/shared/lib/workspace/context";

export interface ThemeAiContext {
    industry: string;
    brandVoice: string;
    targetAudience: string;
    contentPillars: string[];
    visualStyle: string;
}

function asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    return value as Record<string, unknown>;
}

function asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((item): item is string => typeof item === "string");
}

export function getThemeManifestConfig(context: WorkspaceContext | null): Record<string, unknown> {
    return asRecord(context?.activeThemeVersion?.config ?? {});
}

export function extractThemeAiContext(themeConfig: Record<string, unknown>): ThemeAiContext | null {
    const direct = asRecord(themeConfig.aiContext);
    const fallback = asRecord(themeConfig.ai_context);
    const source = Object.keys(direct).length > 0 ? direct : fallback;

    const industry = typeof source.industry === "string" ? source.industry : null;
    const brandVoice = typeof source.brandVoice === "string"
        ? source.brandVoice
        : typeof source.brand_voice === "string"
            ? source.brand_voice
            : null;
    const targetAudience = typeof source.targetAudience === "string"
        ? source.targetAudience
        : typeof source.target_audience === "string"
            ? source.target_audience
            : null;
    const contentPillars = asStringArray(source.contentPillars ?? source.content_pillars);
    const visualStyle = typeof source.visualStyle === "string"
        ? source.visualStyle
        : typeof source.visual_style === "string"
            ? source.visual_style
            : null;

    if (!industry || !brandVoice || !targetAudience || !visualStyle) {
        return null;
    }

    return {
        industry,
        brandVoice,
        targetAudience,
        contentPillars,
        visualStyle,
    };
}

export function extractThemeAiSystemContext(themeConfig: Record<string, unknown>): string {
    const rawSystem =
        typeof themeConfig.ai_system_context === "string"
            ? themeConfig.ai_system_context
            : typeof themeConfig.aiSystemContext === "string"
                ? themeConfig.aiSystemContext
                : "";

    if (rawSystem.trim().length > 0) {
        return rawSystem.trim();
    }

    const aiContext = extractThemeAiContext(themeConfig);
    if (!aiContext) {
        return "";
    }

    const pillars = aiContext.contentPillars.length > 0
        ? aiContext.contentPillars.join(", ")
        : "none specified";

    return [
        "Active Workspace Business Context:",
        `Industry: ${aiContext.industry}`,
        `Brand Voice: ${aiContext.brandVoice}`,
        `Target Audience: ${aiContext.targetAudience}`,
        `Content Pillars: ${pillars}`,
        `Visual Style: ${aiContext.visualStyle}`,
    ].join("\n");
}

