import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { generateText, type LanguageModel } from "ai";
import { createClient } from "@/shared/lib/supabase/server";
import {
    assertWorkspaceAdminOrManager,
    assertWorkspaceAiEnabled,
} from "@/shared/lib/workspace/context";
import {
    assertSufficientAiBalance,
    checkAiRateLimitPg,
    InsufficientAiBalanceError,
    meterAndCharge,
} from "@/shared/lib/ai/metering";
import { buildLocaleSystemPrompt, resolveGenerationLocale } from "@/shared/lib/ai/locale";
import { normalizeAiProviderError } from "@/shared/lib/ai/errors";
import {
    GeneratedOutputSafetyError,
    assertSafeGeneratedOutput,
} from "@/shared/lib/ai/output-safety";
import {
    buildAiRequestMetadata,
    getAiModel,
    getModelMetadata,
    runWithWorkspaceAiConfig,
    type AiModelAlias,
} from "@/shared/lib/ai/provider";
import { formatValidationIssuesForPrompt, resolveEffectivePrimaryKeyword, validateGeneratedBlogDraft, type EditorialValidationIssue } from "@/features/content-engine/lib/blog-editorial-validation";
import {
    assessBlogEditorialPublicationReadiness,
    getBlogEditorialPublicPolicy,
    getBlogEditorialRepairTargets,
} from "@/features/content-engine/lib/blog-editorial-policy";
import {
    asRecord,
    buildEditorialRepairValidationInput,
    buildRepairedBlogMetadata,
    extractRepairSeoData,
    repairAdjacentHeadingDiagnostics,
    repairDeterministicGrammarDiagnostics,
    repairInvalidInternalLinks,
    repairVisualShortcodeDiagnostics,
    repairVisualEvidenceDiagnostics,
    validateRepairRewrite,
    type RepairSeoData,
} from "@/features/content-engine/lib/editorial-repair";
import { revalidatePublicContent } from "@/features/content-engine/revalidate-public";

export const runtime = "nodejs";
export const maxDuration = 300;

const ROUTE_NAME = "repair-editorial";
const MODEL_ALIAS: AiModelAlias = "text.writer";
const MODEL_METADATA = getModelMetadata(MODEL_ALIAS);
const MAX_REPAIR_ATTEMPTS = 3;

interface RouteContext {
    params: Promise<{ id: string }>;
}

// -- Helpers adapted from humanize-blog --

interface MarkdownHeading {
    level: number;
    text: string;
    line: string;
}

function normalizeHeadingText(text: string): string {
    return text
        .replace(/\s+/g, " ")
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .trim();
}

function extractHeadings(markdown: string, maxLevel = 6): MarkdownHeading[] {
    const headings: MarkdownHeading[] = [];
    const headingRegex = /^(#{1,6})\s+(.+?)\s*$/gm;
    let match: RegExpExecArray | null;
    while ((match = headingRegex.exec(markdown)) !== null) {
        const level = match[1].length;
        if (level > maxLevel) continue;
        const text = normalizeHeadingText(match[2]);
        headings.push({
            level,
            text,
            line: `${"#".repeat(level)} ${text}`,
        });
    }
    return headings;
}

function sameHeadingShape(a: MarkdownHeading, b: MarkdownHeading): boolean {
    return a.level === b.level && a.text === b.text;
}

function spliceByLineRange(markdown: string, start: number, end: number, replacementLines: string[]): string {
    const lines = markdown.split("\n");
    return [
        ...lines.slice(0, start),
        ...replacementLines,
        ...lines.slice(end),
    ].join("\n");
}

function repairArticleRewriteStructure(original: string, revised: string, options: { allowHeadingTextChanges?: boolean } = {}): string {
    const expected = extractHeadings(original);
    if (expected.length === 0) return revised.trim();

    let lines = revised.replace(/^\s+/, "").replace(/\s+$/, "").split("\n");

    const firstHeadingIndex = lines.findIndex((line) => /^#{1,6}\s+/.test(line.trim()));
    if (firstHeadingIndex > 0) {
        lines = lines.slice(firstHeadingIndex);
    }

    for (const heading of expected) {
        const prefix = `${"#".repeat(heading.level)} ${heading.text}`;
        lines = lines.flatMap((line) => {
            const trimmedLine = line.trim();
            if (!trimmedLine.startsWith(prefix)) return [line];
            const after = trimmedLine.slice(prefix.length);
            if (after.length === 0) return [prefix];
            if (!/^\s+\S/.test(after)) return [line];
            return [prefix, "", after.trimStart()];
        });
    }

    let repaired = lines.join("\n");
    const revisedHeadings = extractHeadings(repaired);

    if (revisedHeadings.length === expected.length) {
        if (!revisedHeadings.every((heading, index) => heading.level === expected[index].level)) {
            return repaired.trim();
        }
        if (options.allowHeadingTextChanges) {
            return repaired.trim();
        }
        const repairedLines = repaired.split("\n");
        let expectedIndex = 0;
        repaired = repairedLines
            .map((line) => {
                if (!/^#{1,6}\s+/.test(line.trim())) return line;
                const replacement = expected[expectedIndex]?.line;
                expectedIndex += 1;
                return replacement ?? line;
            })
            .join("\n");
        return repaired.trim();
    }

    if (revisedHeadings.length < expected.length) {
        let current = repaired;
        let expectedIndex = 0;
        let revisedIndex = 0;

        while (expectedIndex < expected.length) {
            const currentLines = current.split("\n");
            const headingLineInfos = currentLines
                .map((line, index) => {
                    const match = line.trim().match(/^(#{1,6})\s+(.+?)\s*$/);
                    if (!match) return null;
                    return {
                        index,
                        heading: {
                            level: match[1].length,
                            text: normalizeHeadingText(match[2]),
                            line: `${"#".repeat(match[1].length)} ${normalizeHeadingText(match[2])}`,
                        } satisfies MarkdownHeading,
                    };
                })
                .filter((info): info is { index: number; heading: MarkdownHeading } => info !== null);
            const nextRevised = headingLineInfos[revisedIndex];

            if (!nextRevised) {
                const prefix = current.endsWith("\n") ? "" : "\n\n";
                current = `${current}${prefix}${expected.slice(expectedIndex).map((heading) => heading.line).join("\n\n")}`;
                break;
            }

            const expectedHeading = expected[expectedIndex];
            if (sameHeadingShape(nextRevised.heading, expectedHeading)) {
                currentLines[nextRevised.index] = expectedHeading.line;
                current = currentLines.join("\n");
                expectedIndex += 1;
                revisedIndex += 1;
                continue;
            }

            const lookaheadIndex = expected.findIndex((heading, index) => index > expectedIndex && sameHeadingShape(nextRevised.heading, heading));
            if (lookaheadIndex === -1) return repaired.trim();

            const missing = expected.slice(expectedIndex, lookaheadIndex).map((heading) => heading.line);
            current = spliceByLineRange(current, nextRevised.index, nextRevised.index, [...missing, ""]);
            expectedIndex = lookaheadIndex;
            revisedIndex += missing.length;
        }

        return current.trim();
    }

    return repaired.trim();
}

function canRepairHeadingText(issues: readonly EditorialValidationIssue[]): boolean {
    return issues.some((issue) => (
        issue.code === "adjacent_h2_pattern_repetition"
        || issue.code === "banned_generic_heading"
        || issue.code === "primary_keyword_missing_from_h2s"
        || issue.code === "body_h1_present"
        || issue.code === "heading_starts_below_h2"
        || issue.code === "skipped_heading_level"
        || issue.code === "h2_count_below_tier_minimum"
        || issue.code === "h3_count_below_tier_expectation"
        || issue.code === "long_h2_section_requires_h3"
    ));
}

function canRepairHeadingStructure(issues: readonly EditorialValidationIssue[]): boolean {
    return issues.some((issue) => [
        "body_h1_present",
        "heading_starts_below_h2",
        "skipped_heading_level",
        "h2_count_below_tier_minimum",
        "h3_count_below_tier_expectation",
        "long_h2_section_requires_h3",
        "h2_missing_substantive_paragraph",
    ].includes(issue.code));
}

function canRepairLinks(issues: readonly EditorialValidationIssue[]): boolean {
    return issues.some((issue) => issue.code === "invalid_internal_link");
}

function buildRepairPrompt(markdown: string, issues: EditorialValidationIssue[], localePrompt: string, seoData: RepairSeoData, options: { allowHeadingTextChanges: boolean; allowInternalLinkChanges: boolean; allowedInternalLinks: readonly string[]; externalCitations: readonly string[]; internalLinks: readonly string[] }) {
    const formattedIssues = formatValidationIssuesForPrompt(issues, { maxIssues: 20, includeInfo: true });
    const primaryKeyword = resolveEffectivePrimaryKeyword(seoData.keywords?.[0] ?? "");
    const headingRule = options.allowHeadingTextChanges
        ? "You MAY revise heading text and add/promote/demote headings only when required by heading diagnostics, while preserving the article thesis and avoiding a full rewrite."
        : "DO NOT change, add, or remove any markdown headings (lines starting with #).";
    const linkRule = options.allowInternalLinkChanges
        ? "You MAY replace invalid internal-link URLs only with one of the allowed internal links listed below. Do not change external URLs."
        : "DO NOT change any URLs or markdown links.";
    const system = `You are an expert editorial assistant for a high-quality publishing platform.
Your task is to repair the provided Markdown article and SEO fields to address specific editorial diagnostics flagged by a deterministic validation system.

${localePrompt}

CRITICAL CONSTRAINTS:
1. ONLY fix the specific issues flagged below. Preserve the rest of the prose, tone, and formatting exactly as provided.
2. ${headingRule}
3. DO NOT remove or modify any visual shortcodes (e.g. {{visual:chart_123}}).
4. ${linkRule}
5. Do not invent source URLs, statistics, client results, or factual evidence.
6. Use only the available citation URLs listed in the prompt when adding citation links.
7. Return only the requested XML tags. No commentary, no markdown fences.`;

    const prompt = `Here are the specific editorial issues that must be fixed:
${formattedIssues}

Current SEO title:
${seoData.title ?? ""}

Current SEO description:
${seoData.description ?? ""}

Primary keyword:
${primaryKeyword || "not provided"}

Allowed internal links:
${options.allowedInternalLinks.length > 0 ? options.allowedInternalLinks.map((href) => `- ${href}`).join("\n") : "- /blog\n- /contact\n- /"}

Available citation URLs:
${options.externalCitations.length > 0 ? options.externalCitations.map((href) => `- ${href}`).join("\n") : "- none"}

Internal link suggestions:
${options.internalLinks.length > 0 ? options.internalLinks.map((href) => `- ${href}`).join("\n") : "- none"}

Please repair the article and SEO fields to address all of the above issues.
If the intro keyword diagnostic is present, include the primary keyword naturally in the opening 120 words.
If adjacent H2 pattern repetition is present, rewrite only the repeated H2 heading text so adjacent sections have distinct reader jobs or claims.
If invalid_internal_link is present, replace the invalid URL with an allowed internal link that best fits the anchor text.
If citation diagnostics are present, add natural markdown links using only Available citation URLs.

<ARTICLE>
${markdown}
</ARTICLE>`;

    return { system, prompt };
}

interface RepairResponse {
    contentId: string;
    originalLength: number;
    revisedLength: number;
    applied: boolean;
    issuesAddressed: number;
    remainingIssues: EditorialValidationIssue[];
    remainingBlockingIssues: EditorialValidationIssue[];
    issueCount: number;
    errorCount: number;
    warningCount: number;
    scorecard: unknown;
    fullyRepaired: boolean;
    publicationReady: boolean;
    savedProgress: boolean;
    irreparableIssues?: EditorialValidationIssue[];
}

function extractTaggedText(tag: string, text: string): string {
    const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
    return text.match(re)?.[1]?.trim() ?? "";
}

function cleanMarkdownOutput(raw: string): string {
    return raw
        .replace(/^```(?:markdown)?\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
}

function normalizeIssues(value: unknown): EditorialValidationIssue[] {
    return Array.isArray(value)
        ? value.filter((issue): issue is EditorialValidationIssue => {
            const record = asRecord(issue);
            return Boolean(record?.code && record?.severity && record?.message);
        })
        : [];
}

function validationLinks(value: unknown): string[] {
    return Array.isArray(value)
        ? Array.from(new Set(value
            .map((item) => typeof item === "string" ? item : asRecord(item)?.url)
            .filter((url): url is string => typeof url === "string" && url.trim().length > 0)))
        : [];
}

function isSourceDependentIssue(issue: EditorialValidationIssue): boolean {
    return [
        "insufficient_research_citations",
        "named_source_claim_without_link",
        "quantified_claim_without_source_or_caveat",
        "visual_numeric_chart_missing_source_url",
        "visual_external_evidence_missing_source_url",
        "visual_quantitative_weak_source_hierarchy",
        "visual_quantitative_social_source",
    ].includes(issue.code);
}

export async function POST(request: NextRequest, context: RouteContext) {
    try {
        const workspaceContext = await assertWorkspaceAiEnabled();
        await assertWorkspaceAdminOrManager();
        const workspaceId = workspaceContext.activeWorkspace.id;

        const { id } = await context.params;
        if (!id) {
            return NextResponse.json({ error: "Content id required" }, { status: 400 });
        }

        const apply = request.nextUrl.searchParams.get("apply") === "true";

        const limit = await checkAiRateLimitPg(workspaceId, ROUTE_NAME, { maxPerWindow: 10 });
        if (!limit.allowed) {
            return NextResponse.json(
                { error: "Rate limit exceeded. Please try again shortly." },
                { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
            );
        }

        await assertSufficientAiBalance(workspaceId);

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        return runWithWorkspaceAiConfig(workspaceId, async () => {
            const { data: item, error: itemError } = await supabase
                .from("content_items")
                .select("id, workspace_id, content_markdown, locale, metadata, title, status, slug, type, template_id")
                .eq("id", id)
                .maybeSingle();

            if (itemError) {
                return NextResponse.json({ error: itemError.message }, { status: 500 });
            }
            if (!item || item.workspace_id !== workspaceId) {
                return NextResponse.json({ error: "Article not found in this workspace." }, { status: 404 });
            }
            if (item.type !== "blog") {
                return NextResponse.json({ error: "Editorial repair is only available for blog posts." }, { status: 400 });
            }
            const fullArticle = (item.content_markdown ?? "").trim();
            if (fullArticle.length < 200) {
                return NextResponse.json(
                    { error: "Article is too short to repair meaningfully (minimum 200 characters)." },
                    { status: 422 },
                );
            }

            let currentMetadata = asRecord(item.metadata) ?? {};
            const enrichment = asRecord(currentMetadata.enrichment) ?? {};
            const storedValidation = asRecord(enrichment.editorial_validation) ?? {};
            let currentSeoData = extractRepairSeoData(currentMetadata, item.title);
            let currentMarkdown = fullArticle;
            const publicPolicy = getBlogEditorialPublicPolicy(item.template_id);
            const readinessOptions = { locale: item.locale };
            const validateCurrentDraft = (
                markdown: string,
                metadata: Record<string, unknown>,
                seoData: RepairSeoData,
            ) => validateGeneratedBlogDraft(buildEditorialRepairValidationInput({
                markdown,
                title: item.title,
                metadata,
                seoData,
                forbiddenPublicTerms: publicPolicy.forbiddenPublicTerms,
            }));
            let currentValidation = validateCurrentDraft(
                currentMarkdown,
                currentMetadata,
                currentSeoData,
            );
            const initialIssueCount = currentValidation.issues.length;
            const initialReadiness = assessBlogEditorialPublicationReadiness(
                currentValidation,
                readinessOptions,
            );

            if (initialReadiness.ready) {
                return NextResponse.json({
                    contentId: id,
                    originalLength: fullArticle.length,
                    revisedLength: fullArticle.length,
                    applied: false,
                    issuesAddressed: 0,
                    remainingIssues: normalizeIssues(currentValidation.issues),
                    remainingBlockingIssues: [],
                    issueCount: currentValidation.issues.length,
                    errorCount: currentValidation.issues.filter((issue) => issue.severity === "error").length,
                    warningCount: currentValidation.issues.filter((issue) => issue.severity === "warning").length,
                    scorecard: currentValidation.scorecard,
                    fullyRepaired: currentValidation.issues.length === 0,
                    publicationReady: true,
                    savedProgress: false,
                });
            }

            const generationLocale = resolveGenerationLocale({
                requested: item.locale,
                workspaceDefault: workspaceContext.activeWorkspace.default_locale,
            });
            const localePrompt = buildLocaleSystemPrompt(generationLocale);

            let repairAttempts = 0;
            let structuralFailure: { code: string; message: string } | null = null;
            const aiRequestMetadata = buildAiRequestMetadata({
                alias: MODEL_ALIAS,
                workspaceId,
                routeName: ROUTE_NAME,
                operation: "article_repair",
            });

            for (let attempt = 1; attempt <= MAX_REPAIR_ATTEMPTS; attempt += 1) {
                let repairTargets = getBlogEditorialRepairTargets(
                    currentValidation,
                    readinessOptions,
                );
                if (repairTargets.length === 0) break;
                repairAttempts = attempt;
                const visualEvidenceRepair = repairVisualEvidenceDiagnostics(currentMetadata, repairTargets);
                if (visualEvidenceRepair.repaired) {
                    currentMetadata = visualEvidenceRepair.metadata;
                    currentValidation = validateCurrentDraft(
                        currentMarkdown,
                        currentMetadata,
                        currentSeoData,
                    );
                    repairTargets = getBlogEditorialRepairTargets(
                        currentValidation,
                        readinessOptions,
                    );
                    if (repairTargets.length === 0) break;
                }
                const allowHeadingTextChanges = canRepairHeadingText(repairTargets);
                const allowHeadingStructureChanges = canRepairHeadingStructure(repairTargets);
                const validationInput = buildEditorialRepairValidationInput({
                    markdown: currentMarkdown,
                    title: item.title,
                    metadata: currentMetadata,
                    seoData: currentSeoData,
                    forbiddenPublicTerms: publicPolicy.forbiddenPublicTerms,
                });
                const allowInternalLinkChanges = canRepairLinks(repairTargets);
                let deterministicMarkdown = repairDeterministicGrammarDiagnostics(
                    currentMarkdown,
                    repairTargets,
                );
                deterministicMarkdown = repairAdjacentHeadingDiagnostics(deterministicMarkdown, repairTargets);
                deterministicMarkdown = repairInvalidInternalLinks(deterministicMarkdown, repairTargets, validationInput.allowedInternalLinks ?? []);
                deterministicMarkdown = repairVisualShortcodeDiagnostics(deterministicMarkdown, repairTargets, validationInput.visualBlocks ?? []);
                if (deterministicMarkdown !== currentMarkdown) {
                    const grammarHeadingRepair = repairTargets.some((issue) => (
                        issue.code === "subject_verb_agreement_these_is"
                        || issue.code === "subject_verb_agreement_plural_is"
                    ));
                    const deterministicFailure = validateRepairRewrite(currentMarkdown, deterministicMarkdown, {
                        allowHeadingTextChanges: allowHeadingTextChanges || grammarHeadingRepair,
                        allowHeadingStructureChanges,
                    });
                    if (deterministicFailure) {
                        structuralFailure = deterministicFailure;
                        break;
                    }
                    currentMarkdown = deterministicMarkdown;
                    currentValidation = validateCurrentDraft(
                        currentMarkdown,
                        currentMetadata,
                        currentSeoData,
                    );
                    repairTargets = getBlogEditorialRepairTargets(
                        currentValidation,
                        readinessOptions,
                    );
                    if (repairTargets.length === 0) break;
                }

                const { system, prompt } = buildRepairPrompt(currentMarkdown, repairTargets, localePrompt, currentSeoData, {
                    allowHeadingTextChanges,
                    allowInternalLinkChanges,
                    allowedInternalLinks: validationInput.allowedInternalLinks ?? [],
                    externalCitations: validationLinks(validationInput.externalCitations),
                    internalLinks: validationLinks(validationInput.internalLinkSuggestions),
                });

                const { text, usage } = await generateText({
                    model: getAiModel(MODEL_ALIAS) as LanguageModel,
                    system,
                    prompt: `${prompt}

Return exactly:
<CONTENT_MARKDOWN>complete repaired markdown only</CONTENT_MARKDOWN>
<SEO_TITLE>repaired SEO title, or the current SEO title if unchanged</SEO_TITLE>
<SEO_DESCRIPTION>repaired SEO description, or the current SEO description if unchanged</SEO_DESCRIPTION>`,
                });

                await meterAndCharge({
                    workspaceId,
                    profileId: user.id,
                    route: ROUTE_NAME,
                    usage: {
                        unitType: "tokens",
                        model: MODEL_METADATA.modelId,
                        tokensIn: usage.inputTokens ?? 0,
                        tokensOut: usage.outputTokens ?? 0,
                    },
                    metadata: {
                        issuesCount: currentValidation.issues.length,
                        applyOnSuccess: apply,
                        attempt,
                        ai: aiRequestMetadata,
                    },
                });

                const rawMarkdown = extractTaggedText("CONTENT_MARKDOWN", text) || text;
                let cleaned = allowHeadingStructureChanges
                    ? cleanMarkdownOutput(rawMarkdown)
                    : repairArticleRewriteStructure(currentMarkdown, cleanMarkdownOutput(rawMarkdown), { allowHeadingTextChanges });
                cleaned = repairDeterministicGrammarDiagnostics(cleaned, repairTargets);
                cleaned = repairAdjacentHeadingDiagnostics(cleaned, repairTargets);
                cleaned = repairInvalidInternalLinks(cleaned, repairTargets, validationInput.allowedInternalLinks ?? []);
                cleaned = repairVisualShortcodeDiagnostics(cleaned, repairTargets, validationInput.visualBlocks ?? []);

                const failure = validateRepairRewrite(currentMarkdown, cleaned, { allowHeadingTextChanges, allowHeadingStructureChanges });
                if (failure) {
                    structuralFailure = failure;
                    break;
                }

                const nextSeoData: RepairSeoData = {
                    ...currentSeoData,
                    ...(extractTaggedText("SEO_TITLE", text) ? { title: extractTaggedText("SEO_TITLE", text) } : {}),
                    ...(extractTaggedText("SEO_DESCRIPTION", text) ? { description: extractTaggedText("SEO_DESCRIPTION", text) } : {}),
                };
                assertSafeGeneratedOutput({
                    contentMarkdown: cleaned,
                    seo: nextSeoData,
                });
                const nextValidation = validateCurrentDraft(
                    cleaned,
                    currentMetadata,
                    nextSeoData,
                );

                currentMarkdown = cleaned;
                currentSeoData = nextSeoData;
                currentValidation = nextValidation;
            }

            if (structuralFailure) {
                return NextResponse.json(
                    {
                        error: `Repair was not saved because the rewrite failed a safety check: ${structuralFailure.message}`,
                        code: structuralFailure.code,
                        applied: false,
                        remainingIssues: currentValidation.issues,
                    },
                    { status: 422 },
                );
            }

            const finalReadiness = assessBlogEditorialPublicationReadiness(
                currentValidation,
                readinessOptions,
            );
            const remainingRepairTargets = getBlogEditorialRepairTargets(
                currentValidation,
                readinessOptions,
            );
            let savedProgress = false;
            const remainingSourceDependentIssues = remainingRepairTargets.filter(isSourceDependentIssue);
            const canSaveProgress = apply
                && currentValidation.issues.length < initialIssueCount
                && remainingRepairTargets.length > 0
                && remainingSourceDependentIssues.length === remainingRepairTargets.length;

            if (!finalReadiness.ready && !canSaveProgress) {
                return NextResponse.json(
                    {
                        error: `Repair was not saved because ${remainingRepairTargets.length} publication-blocking editorial diagnostic${remainingRepairTargets.length === 1 ? "" : "s"} remained.`,
                        applied: false,
                        fullyRepaired: false,
                        publicationReady: false,
                        savedProgress: false,
                        remainingIssues: currentValidation.issues,
                        remainingBlockingIssues: remainingRepairTargets,
                        irreparableIssues: remainingSourceDependentIssues,
                    },
                    { status: 422 },
                );
            }

            let applied = false;
            if (apply && (finalReadiness.ready || canSaveProgress)) {
                const previousAttempts = typeof storedValidation.repair_attempts === "number" ? storedValidation.repair_attempts : 0;
                const nextMetadata = buildRepairedBlogMetadata({
                    metadata: currentMetadata,
                    seoData: currentSeoData,
                    validation: currentValidation,
                    repairAttempts: previousAttempts + repairAttempts,
                    repaired: finalReadiness.ready,
                    fallbackReason: finalReadiness.ready ? null : "source_context_required",
                });

                const { error: updateError } = await supabase
                    .from("content_items")
                    .update({
                        content_markdown: currentMarkdown,
                        metadata: nextMetadata,
                    })
                    .eq("id", id)
                    .eq("workspace_id", workspaceId);

                if (updateError) {
                    return NextResponse.json({ error: updateError.message }, { status: 500 });
                }
                revalidatePath("/dashboard/content");
                revalidatePath(`/dashboard/content/${id}`);
                if (item.status === "published") {
                    await revalidatePublicContent({ type: "blog", slug: item.slug });
                }
                applied = true;
                savedProgress = canSaveProgress;
            }

            const response: RepairResponse = {
                contentId: id,
                originalLength: fullArticle.length,
                revisedLength: currentMarkdown.length,
                applied,
                issuesAddressed: Math.max(0, initialIssueCount - currentValidation.issues.length),
                remainingIssues: normalizeIssues(currentValidation.issues),
                remainingBlockingIssues: normalizeIssues(remainingRepairTargets),
                issueCount: currentValidation.issues.length,
                errorCount: currentValidation.issues.filter((issue) => issue.severity === "error").length,
                warningCount: currentValidation.issues.filter((issue) => issue.severity === "warning").length,
                scorecard: currentValidation.scorecard,
                fullyRepaired: currentValidation.issues.length === 0,
                publicationReady: finalReadiness.ready,
                savedProgress,
                ...(remainingSourceDependentIssues.length > 0 ? { irreparableIssues: normalizeIssues(remainingSourceDependentIssues) } : {}),
            };
            return NextResponse.json(response, { status: finalReadiness.ready ? 200 : 422 });
        });
    } catch (error: unknown) {
        if (error instanceof GeneratedOutputSafetyError) {
            return NextResponse.json({ error: error.message }, { status: 422 });
        }
        if (error instanceof InsufficientAiBalanceError) {
            return NextResponse.json({ error: error.message }, { status: 402 });
        }
        if (error instanceof Error && error.message === "AI generation is only available on Pro workspaces.") {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (error instanceof Error && error.message.startsWith("Unauthorized")) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }
        const providerError = normalizeAiProviderError(error, {
            provider: MODEL_METADATA.provider,
            modelAlias: MODEL_ALIAS,
            modelId: MODEL_METADATA.modelId,
        });
        console.error("[repair-editorial] AI provider error:", providerError.toJSON());
        return NextResponse.json(
            { error: "Failed to repair the article. Please try again." },
            { status: 500 },
        );
    }
}
