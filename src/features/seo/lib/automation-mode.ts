import type { SeoBuilderMutationTarget } from "@/features/seo/types";

export type SeoAutomationMode = "conservative" | "standard" | "aggressive";

/**
 * Read seo_automation_mode from workspace metadata. Stored at metadata.seo_automation_mode
 * to avoid a schema migration. Defaults to "standard" so the engine takes advantage of
 * Phase 1 tuning (anchor retry, lower confidence floor) without unlocking conversion-
 * sensitive surfaces.
 *
 * - conservative: legacy behavior — Hero/CTA/Contact/QuoteRequest stay manual-review only.
 * - standard:     same policy locks as conservative, but auto-apply is allowed when preview
 *                 succeeds (no manager approval required).
 * - aggressive:   policy locks on narrative renderer-compatible surfaces are unlocked, and
 *                 auto-apply runs on success. Plain-text literal fields stay locked.
 */
export function getSeoAutomationMode(workspaceMetadata: Record<string, unknown> | null | undefined): SeoAutomationMode {
    const raw = workspaceMetadata?.["seo_automation_mode"];
    if (raw === "conservative" || raw === "aggressive" || raw === "standard") return raw;
    if (raw !== undefined && raw !== null) {
        // Surface typos/migrations rather than silently falling back to "standard".
        console.warn(`[seo:automation-mode] Unrecognized seo_automation_mode value "${String(raw)}"; using "standard". Valid: conservative | standard | aggressive.`);
    }
    return "standard";
}

export function shouldAutoApplyOnPreviewSuccess(mode: SeoAutomationMode): boolean {
    return mode === "standard" || mode === "aggressive";
}

/**
 * Read seo_auto_apply_min_age_seconds from workspace metadata. Defaults to 0.
 * Used to give operators a window to inspect freshly-generated recommendations
 * before they auto-apply to production. Recommendation rows newer than this
 * threshold are skipped by the auto-apply step but still get auto-previewed.
 */
export function getSeoAutoApplyMinAgeSeconds(
    workspaceMetadata: Record<string, unknown> | null | undefined,
): number {
    const raw = workspaceMetadata?.["seo_auto_apply_min_age_seconds"];
    if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return Math.floor(raw);
    return 0;
}

/**
 * In aggressive mode, unlock policy-locked narrative surfaces so auto-linking can land
 * on Hero/CTA/Contact/QuoteRequest copy. Plain-text literal renderers remain locked
 * because anchor markup would leak as raw HTML in the published page.
 */
export function applyAutomationModeToTargets(
    targets: SeoBuilderMutationTarget[],
    mode: SeoAutomationMode,
): SeoBuilderMutationTarget[] {
    if (mode !== "aggressive") return targets;
    return targets.map((target) => {
        if (target.compatibilityStatus === "safe_automatic_linking") return target;
        if (target.renderer === "builder_plain_text_literal") return target;
        return {
            ...target,
            compatibilityStatus: "safe_automatic_linking",
            automationTier: target.automationTier === "manual_review" ? "native" : target.automationTier,
            compatibilityNote: `${target.compatibilityNote} (Aggressive automation mode unlocked this policy-locked surface for auto-linking.)`,
        } satisfies SeoBuilderMutationTarget;
    });
}
