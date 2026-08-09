import type { TemplateConfig } from "./types";

/**
 * Public template consumers need design, navigation, and page copy. AI prompt
 * context and dashboard actions belong to authenticated authoring surfaces and
 * must never be serialized into public React payloads.
 */
export function buildPublicTemplateConfig(config: TemplateConfig): TemplateConfig {
    const publicConfig: Partial<TemplateConfig> = { ...config };
    delete publicConfig.renderers;
    delete publicConfig.aiContext;
    delete publicConfig.dashboard;
    delete publicConfig.ai_system_context;
    delete publicConfig.aiSystemContext;

    return publicConfig as TemplateConfig;
}
