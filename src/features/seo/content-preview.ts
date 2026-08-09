import type { SeoExecutionPreview } from "@/features/seo/types";
import { isPublicBuilderData } from "@/features/builder/puck.config";
import { mutateBuilderInternalLink, mutateMarkdownByStrategy } from "@/features/seo/content-mutation";
import { resolveBuilderSignals } from "@/features/seo/lib/analysis";
import type { SeoAutomationMode } from "@/features/seo/lib/automation-mode";
import { getPlatformCopyContext } from "@/features/seo/lib/platform-copy-context";
import { createSeoSemanticTargetContext } from "@/features/seo/lib/semantic-anchors";
import { assessSeoMutationSupport, type SeoMutableContentRecord } from "@/features/seo/validation";

/**
 * Markdown-direct preview for content pages stored in `content_markdown` (no builder
 * visual_layout). Tries one of the markdown mutation strategies on the content body
 * and produces a preview whose apply step writes back to `content_markdown`.
 */
export async function buildMarkdownDirectPreview(input: {
    recommendationId: string;
    sourceContentId: string;
    sourceTitle: string;
    sourceSlug: string | null;
    contentMarkdown: string;
    target: { id: string; title: string; slug: string | null };
    targetTitle: string;
    anchorText: string;
    workspaceLocale?: string | null;
    pageIntent?: string | null;
    conversionGoal?: string | null;
}): Promise<SeoExecutionPreview> {
    const semanticContext = createSeoSemanticTargetContext({
        targetSlug: input.target.slug,
        targetTitle: input.target.title,
        anchorText: input.anchorText,
    });
    const platformCopyContext = getPlatformCopyContext(null);
    const pageContext = {
        sourceTitle: input.sourceTitle,
        sourceSlug: input.sourceSlug,
        pageIntent: input.pageIntent ?? null,
        conversionGoal: input.conversionGoal ?? null,
        platformCopyContext,
        locale: input.workspaceLocale ?? null,
    };

    // Try exact replacement first (lowest editorial risk), then AI rephrase.
    const strategies = ["builder_structured_markdown_link", "builder_structured_markdown_rephrase_link"] as const;
    let chosen: Awaited<ReturnType<typeof mutateMarkdownByStrategy>> | null = null;
    let lastFailure: Awaited<ReturnType<typeof mutateMarkdownByStrategy>> | null = null;
    for (const strategy of strategies) {
        const result = await mutateMarkdownByStrategy({
            content: input.contentMarkdown,
            anchorText: input.anchorText,
            targetSlug: input.target.slug,
            targetTitle: input.target.title,
            strategy,
            blockType: "MarkdownPage",
            fieldPath: "content_markdown",
            pageContext,
            semanticContext,
            allowSoftenedRephrase: true,
        });
        if (result.ok) {
            chosen = result;
            break;
        }
        lastFailure = result;
    }

    const supported = Boolean(chosen?.ok && chosen.updatedValue);
    return {
        recommendationId: input.recommendationId,
        sourceContentId: input.sourceContentId,
        targetContentId: input.target.id,
        sourceTitle: input.sourceTitle,
        targetTitle: input.targetTitle,
        sourceSlug: input.sourceSlug,
        targetSlug: input.target.slug,
        anchorText: input.anchorText,
        supported,
        automationTier: supported ? "native" : "manual_review",
        blockId: null,
        blockType: "MarkdownPage",
        fieldPath: "content_markdown",
        locale: input.workspaceLocale ?? null,
        contentFormat: "builder_markdown",
        renderer: "builder_markdown_renderer",
        mutationStrategy: chosen?.mutationStrategy ?? "manual_review",
        mutationStep: chosen?.mutationStep ?? "manual_review",
        targetReason: "Markdown-direct mutation: source page renders from content_markdown only.",
        strategyReason: chosen?.strategyReason ?? lastFailure?.strategyReason ?? "Markdown mutation strategies were exhausted.",
        locationRationale: chosen?.locationRationale ?? "",
        rendererCompatibility: chosen?.rendererCompatibility ?? "Markdown renderer accepts inline link syntax.",
        beforeSnippet: chosen?.beforeSnippet ?? "",
        afterSnippet: chosen?.afterSnippet ?? "",
        originalValue: input.contentMarkdown,
        updatedValue: chosen?.updatedValue ?? null,
        originalContent: input.contentMarkdown,
        updatedContent: chosen?.updatedValue ?? null,
        manualReviewReason: supported ? null : (lastFailure?.manualReviewReason ?? "No markdown paragraph supported a safe link insertion."),
        skippedFallbacks: chosen?.skippedFallbacks ?? lastFailure?.skippedFallbacks ?? [],
        candidateDiagnostics: [],
        riskChecks: chosen?.riskChecks ?? lastFailure?.riskChecks ?? [],
        contentField: "content_markdown",
    };
}

export async function buildSeoExecutionPreview(input: {
    recommendationId: string;
    source: SeoMutableContentRecord & { updated_at?: string | null };
    target: { id: string; title: string; slug: string | null };
    sourceTitle: string;
    targetTitle: string;
    anchorText: string;
    /** Workspace default locale used for the public href. Defaults to "en". */
    workspaceLocale?: string | null;
    /** Workspace automation aggressiveness. Defaults to "standard". */
    automationMode?: SeoAutomationMode;
}): Promise<SeoExecutionPreview> {
    const visualLayout = isPublicBuilderData(input.source.visual_layout)
        ? input.source.visual_layout
        : input.source.visual_layout;

    const source = {
        ...input.source,
        visual_layout: visualLayout,
    };

    const automationMode = input.automationMode ?? "standard";
    const support = assessSeoMutationSupport(source, { aggressiveMode: automationMode === "aggressive" });
    const effectiveTargets = support.targets;
    const originalContent = JSON.stringify(source.visual_layout ?? null);
    const signals = resolveBuilderSignals(input.source.metadata ?? null);
    const mutation = await mutateBuilderInternalLink({
        visualLayout: source.visual_layout ?? null,
        anchorText: input.anchorText,
        targetSlug: input.target.slug,
        targetTitle: input.target.title,
        targets: effectiveTargets,
        inheritedRiskChecks: support.riskChecks,
        pageContext: {
            sourceTitle: input.sourceTitle,
            sourceSlug: source.slug,
            pageIntent: signals.pageIntent,
            conversionGoal: signals.conversionGoal,
            platformCopyContext: getPlatformCopyContext(null),
            locale: input.workspaceLocale ?? null,
        },
    });

    const selectedTarget = effectiveTargets.find((target) => target.blockId === mutation.blockId && target.fieldPath === mutation.fieldPath) ?? effectiveTargets[0] ?? null;
    const fallbackNote = !support.supported && selectedTarget
        ? `Automatic apply is blocked, but the best manual-review patch candidate was generated for ${selectedTarget.blockType}.${selectedTarget.fieldPath}.`
        : !support.supported
            ? "Automatic apply is blocked before field-level mutation because no compatible builder narrative field exists."
            : null;

    return {
        recommendationId: input.recommendationId,
        sourceContentId: source.id,
        targetContentId: input.target.id,
        sourceTitle: input.sourceTitle,
        targetTitle: input.targetTitle,
        sourceSlug: source.slug,
        targetSlug: input.target.slug,
        anchorText: input.anchorText,
        supported: mutation.ok,
        automationTier: mutation.ok ? mutation.automationTier : "manual_review",
        blockId: mutation.blockId ?? selectedTarget?.blockId ?? null,
        blockType: mutation.blockType ?? selectedTarget?.blockType ?? null,
        fieldPath: mutation.fieldPath ?? selectedTarget?.fieldPath ?? null,
        locale: mutation.locale ?? selectedTarget?.locale ?? null,
        contentFormat: mutation.blockId ? selectedTarget?.contentFormat ?? support.contentFormat : support.contentFormat,
        renderer: selectedTarget?.renderer ?? support.renderer,
        mutationStrategy: mutation.mutationStrategy ?? support.mutationStrategy,
        mutationStep: mutation.mutationStep,
        targetReason: selectedTarget
            ? `${selectedTarget.reason} ${selectedTarget.rankingBreakdown.join(" · ")}`
            : "No safe builder registry target was available.",
        strategyReason: fallbackNote ? `${mutation.strategyReason} ${fallbackNote}` : mutation.strategyReason,
        locationRationale: mutation.locationRationale || "Automatic mutation was blocked before preview generation.",
        rendererCompatibility: selectedTarget
            ? `${selectedTarget.compatibilityNote} ${mutation.rendererCompatibility}`
            : mutation.rendererCompatibility || "Manual review is required because this content is not safe for automatic mutation.",
        beforeSnippet: mutation.beforeSnippet || selectedTarget?.currentValue.slice(0, 220) || "",
        afterSnippet: mutation.afterSnippet || (mutation.ok ? mutation.updatedValue ?? "" : "Manual-review patch suggested only; automatic apply remains blocked."),
        originalValue: mutation.originalValue || selectedTarget?.currentValue || "",
        updatedValue: mutation.updatedValue,
        originalContent,
        updatedContent: mutation.updatedContent,
        manualReviewReason: mutation.ok ? null : (mutation.manualReviewReason ?? support.manualReviewReason),
        skippedFallbacks: mutation.skippedFallbacks,
        candidateDiagnostics: mutation.candidateDiagnostics,
        riskChecks: mutation.riskChecks.length > 0 ? mutation.riskChecks : support.riskChecks,
        contentField: "visual_layout",
    };
}
