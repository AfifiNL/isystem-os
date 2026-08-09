import { NextRequest, NextResponse } from "next/server";
import { generateText, type LanguageModel } from "ai";
import { createClient } from "@/shared/lib/supabase/server";
import {
    assertWorkspaceAdminOrManager,
    assertWorkspaceAiEnabled,
} from "@/shared/lib/workspace/context";
import {
    extractThemeAiSystemContext,
    getThemeManifestConfig,
} from "@/shared/lib/workspace/theme-manifest";
import {
    assertSufficientAiBalance,
    checkAiRateLimitPg,
    InsufficientAiBalanceError,
    meterAndCharge,
} from "@/shared/lib/ai/metering";
import { HUMAN_VOICE_RULES, humanize } from "@/shared/lib/ai/human-voice";
import {
    GeneratedOutputSafetyError,
    assertSafeGeneratedOutput,
} from "@/shared/lib/ai/output-safety";
import { applyAntiTemplateTransforms } from "@/shared/lib/ai/anti-template";
import {
    buildHumanizeRewritePrompt,
    detectAiFingerprints,
    type FingerprintHit,
} from "@/shared/lib/ai/ai-detection-rewrite";
import { buildLocaleSystemPrompt, resolveGenerationLocale } from "@/shared/lib/ai/locale";
import { normalizeAiProviderError } from "@/shared/lib/ai/errors";
import {
    buildAiRequestMetadata,
    getAiModel,
    getModelMetadata,
    runWithWorkspaceAiConfig,
    type AiModelAlias,
} from "@/shared/lib/ai/provider";

export const runtime = "nodejs";
export const maxDuration = 300;

const ROUTE_NAME = "humanize-blog";
const MODEL_ALIAS: AiModelAlias = "text.writer";
const MODEL_METADATA = getModelMetadata(MODEL_ALIAS);

interface RouteContext {
    params: Promise<{ id: string }>;
}

interface HumanizeRequestBody {
    /**
     * Optional. When provided, scope the humanize pass to the single section
     * whose H2/H3/H4/H5/H6 heading text equals this string (whitespace-
     * normalized). The rest of the article is left untouched. Section mode
     * is the recommended path — the rewrite stays bounded, the H2-preservation
     * check is trivial, and a failure on one section doesn't block the rest.
     */
    sectionHeading?: string;
}

// Sanity-check the rewrite preserves structural invariants — heading list and
// shortcode set — before we let the operator apply it. These mirror the
// guards inside critiqueAndReviseBlogContent in generate-draft and protect
// against silent loss of CMS structure.
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

/**
 * The LLM and post-processors occasionally cause validator-only drift:
 * heading preambles ("Here is..."), H2 text glued to the first paragraph, or
 * anti-template transforms stripping/tagline-editing headings that must remain
 * stable in saved markdown. This repair is intentionally structural: it never
 * rewrites body prose. It only restores the original heading lines when the
 * revised draft still has the same heading count/order/levels or can be
 * unambiguously repaired by reinserting missing heading lines before the next
 * preserved heading.
 */
function repairArticleRewriteStructure(original: string, revised: string): string {
    const expected = extractHeadings(original);
    if (expected.length === 0) return revised.trim();

    let lines = revised.replace(/^\s+/, "").replace(/\s+$/, "").split("\n");

    // Drop accidental LLM wrappers before the first markdown heading. This is
    // safe because the prompt requires output to start at the article.
    const firstHeadingIndex = lines.findIndex((line) => /^#{1,6}\s+/.test(line.trim()));
    if (firstHeadingIndex > 0) {
        lines = lines.slice(firstHeadingIndex);
    }

    // Repair "## Heading body starts here" by splitting after the expected
    // heading prefix. This mirrors the section-mode repair, but applies across
    // every expected article heading.
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

        // Same heading shape count: restore original heading lines verbatim.
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

    // If post-processing removed headings (for example a "Conclusion" H2),
    // reinsert each missing heading immediately before the next heading that
    // still matches the expected sequence. Avoid guessing when headings were
    // added, duplicated, or reordered.
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

function extractVisualShortcodes(markdown: string): string[] {
    return markdown.match(/\[(?:Visual|Chart|Image|Embed|Asset):[^\]]+\]/gi) ?? [];
}

/**
 * Find a section by its H2-H6 heading text. Returns the section span
 * (heading line + body until the next H1-H6) plus its character offsets so
 * the caller can string-replace the rewritten section back into the full
 * article. Returns null if no section matches.
 *
 * Section boundary rule: a section ends at the next heading of the SAME or
 * HIGHER level. This means an H3 nested under an H2 is still part of that
 * H2's section, which matches how the markdown-section-editor groups them.
 */
function extractNamedSection(
    fullMarkdown: string,
    targetHeading: string,
): { start: number; end: number; markdown: string; headingLine: string; level: number } | null {
    const normalizedTarget = targetHeading.trim();
    if (!normalizedTarget) return null;

    const headingLineRegex = /^(#{2,6})\s+(.+?)\s*$/gm;
    let match: RegExpExecArray | null;
    let startIndex = -1;
    let startLevel = 0;
    let headingLineText = "";
    while ((match = headingLineRegex.exec(fullMarkdown)) !== null) {
        const candidateLevel = match[1].length;
        const candidateText = match[2].trim();
        if (candidateText === normalizedTarget) {
            startIndex = match.index;
            startLevel = candidateLevel;
            headingLineText = match[0];
            break;
        }
    }
    if (startIndex === -1) return null;

    // Walk forward to the next heading of the same or higher level.
    const afterStart = startIndex + headingLineText.length;
    const tail = fullMarkdown.slice(afterStart);
    const nextBoundaryRegex = /^(#{1,6})\s+/gm;
    let nextBoundaryOffset = tail.length;
    while ((match = nextBoundaryRegex.exec(tail)) !== null) {
        const level = match[1].length;
        if (level <= startLevel) {
            nextBoundaryOffset = match.index;
            break;
        }
    }

    const endIndex = afterStart + nextBoundaryOffset;
    return {
        start: startIndex,
        end: endIndex,
        markdown: fullMarkdown.slice(startIndex, endIndex),
        headingLine: headingLineText,
        level: startLevel,
    };
}

/**
 * Repair a common Gemini failure mode: the model returns the heading line
 * immediately followed by the first paragraph on the same line (no newline
 * separator). The heading TEXT is preserved, but our line-by-line validator
 * sees one long line and rejects the rewrite.
 *
 * Conservative rules:
 *   - The revised text must start with the expected heading line as a prefix.
 *   - Trim leading/trailing whitespace first (model also sometimes wraps the
 *     reply in a stray newline).
 *   - If the heading prefix is followed by anything other than whitespace,
 *     insert `\n\n` between them so the validator and downstream markdown
 *     renderers both see a proper heading block.
 *
 * If the prefix doesn't match the expected heading at all, we don't touch
 * the text — the validator should still flag a real heading change.
 */
function repairSectionRewrite(revisedSection: string, expectedHeadingLine: string): string {
    const trimmed = revisedSection.replace(/^\s+/, "").replace(/\s+$/, "");
    const expected = expectedHeadingLine.trim();
    if (!trimmed.startsWith(expected)) {
        return trimmed;
    }
    const after = trimmed.slice(expected.length);
    // Already separated by a newline (one or many) — nothing to fix.
    if (after.length === 0 || after.startsWith("\n")) {
        return trimmed;
    }
    // Heading is glued to the next character. Drop any leading inline
    // whitespace ("## Heading   first sentence") and reinsert a paragraph
    // break before the body.
    const body = after.replace(/^[ \t]+/, "");
    return `${expected}\n\n${body}`;
}

/**
 * Section-mode validator. Looser than the full-article check because the
 * scope is one section: we just need the heading line preserved verbatim
 * and the length within range. Shortcodes inside the section are still
 * sanity-checked.
 */
function validateSectionRewrite(
    originalSection: string,
    revisedSection: string,
    expectedHeadingLine: string,
): RewriteFailureReason | null {
    const ratio = revisedSection.length / Math.max(originalSection.length, 1);
    if (ratio < 0.8 || ratio > 1.3) {
        return {
            code: "length_drift",
            message: `Revised section is ${Math.round(ratio * 100)}% of the original — outside the 80-130% safety window.`,
        };
    }
    const firstLine = revisedSection.split("\n", 1)[0]?.trim() ?? "";
    if (firstLine !== expectedHeadingLine.trim()) {
        return {
            code: "headings_changed",
            message: `Revised section first line was "${firstLine.slice(0, 80)}" but should have been "${expectedHeadingLine.trim().slice(0, 80)}".`,
        };
    }
    const originalShortcodes = extractVisualShortcodes(originalSection).sort().join("|");
    const revisedShortcodes = extractVisualShortcodes(revisedSection).sort().join("|");
    if (originalShortcodes !== revisedShortcodes) {
        return {
            code: "shortcodes_changed",
            message: "Revised section modified or removed embedded visual shortcodes.",
        };
    }
    return null;
}

interface RewriteFailureReason {
    code: "length_drift" | "headings_changed" | "shortcodes_changed";
    message: string;
}

function validateRewrite(original: string, revised: string): RewriteFailureReason | null {
    const ratio = revised.length / Math.max(original.length, 1);
    if (ratio < 0.85 || ratio > 1.2) {
        return {
            code: "length_drift",
            message: `Revised draft is ${Math.round(ratio * 100)}% of the original size — outside the 85-120% safety window.`,
        };
    }
    const originalHeadings = extractHeadings(original).map((heading) => heading.line).join("\n");
    const revisedHeadings = extractHeadings(revised).map((heading) => heading.line).join("\n");
    if (originalHeadings !== revisedHeadings) {
        return {
            code: "headings_changed",
            message: "Revised draft modified or reordered the article headings.",
        };
    }
    const originalShortcodes = extractVisualShortcodes(original).sort().join("|");
    const revisedShortcodes = extractVisualShortcodes(revised).sort().join("|");
    if (originalShortcodes !== revisedShortcodes) {
        return {
            code: "shortcodes_changed",
            message: "Revised draft modified or removed embedded visual shortcodes.",
        };
    }
    return null;
}

interface HumanizeResponse {
    contentId: string;
    /** "article" = the whole post was rewritten; "section" = only one H2/H3 span. */
    scope: "article" | "section";
    /** Heading text when scope === "section". */
    sectionHeading?: string;
    fingerprints: FingerprintHit[];
    /** Length stats refer to the rewritten span, not the full article. */
    originalLength: number;
    revisedLength: number;
    /**
     * The rewritten span itself (the section or the whole article). For
     * section scope the heading line is the first line.
     */
    revisedMarkdown: string;
    /**
     * For section scope: the full article with the section swapped in. Used
     * by apply to write back the article and by the preview UI to show the
     * exact final state if needed.
     */
    revisedFullMarkdown?: string;
    /** Set when apply: the post was saved. */
    applied: boolean;
}

// Single endpoint, mode selected by query param:
//   POST /api/humanize-blog/{id}            → preview only
//   POST /api/humanize-blog/{id}?apply=true → preview + write back to content_items
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

        // Body is optional — full-article requests can omit it entirely. We
        // parse defensively so a malformed body doesn't crash the route.
        let body: HumanizeRequestBody = {};
        try {
            const text = await request.text();
            if (text.trim().length > 0) {
                body = JSON.parse(text) as HumanizeRequestBody;
            }
        } catch {
            body = {};
        }
        const sectionHeading = typeof body.sectionHeading === "string"
            ? body.sectionHeading.trim()
            : "";

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
            // Load the article. Tenant scope: confirm it belongs to the active
            // workspace before we touch it — content_items has RLS but we belt
            // and brace because this route mutates on apply.
            const { data: item, error: itemError } = await supabase
                .from("content_items")
                .select("id, workspace_id, content_markdown, locale, metadata")
                .eq("id", id)
                .maybeSingle();

            if (itemError) {
                return NextResponse.json({ error: itemError.message }, { status: 500 });
            }
            if (!item || item.workspace_id !== workspaceId) {
                return NextResponse.json({ error: "Article not found in this workspace." }, { status: 404 });
            }
            const fullArticle = (item.content_markdown ?? "").trim();
            if (fullArticle.length < 200) {
                return NextResponse.json(
                    { error: "Article is too short to humanize meaningfully (minimum 200 characters)." },
                    { status: 422 },
                );
            }

            // Resolve scope: section if a heading was supplied (and found), else
            // full article. Section mode is the recommended path because the
            // heading-preservation validator is trivial — the H2 line is the
            // first line of the rewritten span by construction.
            let scope: "article" | "section" = "article";
            let rewriteInput = fullArticle;
            let resolvedHeadingLine = "";
            let resolvedSectionStart = -1;
            let resolvedSectionEnd = -1;
            if (sectionHeading) {
                const located = extractNamedSection(fullArticle, sectionHeading);
                if (!located) {
                    return NextResponse.json(
                        { error: `Section heading "${sectionHeading}" was not found in the article.` },
                        { status: 404 },
                    );
                }
                if (located.markdown.length < 120) {
                    return NextResponse.json(
                        { error: "Section is too short to humanize meaningfully (minimum 120 characters)." },
                        { status: 422 },
                    );
                }
                scope = "section";
                rewriteInput = located.markdown;
                resolvedHeadingLine = located.headingLine;
                resolvedSectionStart = located.start;
                resolvedSectionEnd = located.end;
            }

            // 1. Static fingerprint scan — surface concrete evidence to the model
            //    so it edits the actual passages, not a generic abstraction.
            //    Scoped to the section in section mode.
            const fingerprints = detectAiFingerprints(rewriteInput);

            const generationLocale = resolveGenerationLocale({
                requested: item.locale,
                workspaceDefault: workspaceContext.activeWorkspace.default_locale,
            });
            const localePrompt = buildLocaleSystemPrompt(generationLocale);

            const themeConfig = getThemeManifestConfig(workspaceContext);
            const aiSystemContext = extractThemeAiSystemContext(themeConfig) || "Active Workspace Business Context: unavailable.";

            // 2. Build the rewrite prompt grounded in the fingerprints found.
            //    In section mode we tell the model explicitly that it's editing
            //    one section and must preserve the heading line verbatim — the
            //    most common failure mode last time was the model rewriting H2s.
            const sectionScopingHint = scope === "section"
                ? `\n\nIMPORTANT — SECTION SCOPE:
- You are rewriting ONLY ONE SECTION of the article.
- The FIRST LINE of the input is a heading. Copy that heading line to the FIRST LINE of your output, EXACTLY as written (same #s, same words, same punctuation, same case). Do not edit the heading.
- After the heading line, output a SINGLE BLANK LINE, then the rewritten body paragraphs. Do NOT continue the body on the same line as the heading.
- Do not add a new heading. Do not change the heading level (H${resolvedHeadingLine.split(/\s/)[0].length}).`
                : "";
            const { system, prompt } = buildHumanizeRewritePrompt(rewriteInput, fingerprints, {
                localePrompt,
                workspaceContext: aiSystemContext,
                extraVoiceRules: `${HUMAN_VOICE_RULES}${sectionScopingHint}`,
            });
            const aiRequestMetadata = buildAiRequestMetadata({
                alias: MODEL_ALIAS,
                workspaceId,
                routeName: ROUTE_NAME,
                operation: scope === "section" ? "section_rewrite" : "article_rewrite",
            });

            // 3. LLM rewrite pass.
            const { text: rawRewritten, usage } = await generateText({
                model: getAiModel(MODEL_ALIAS) as LanguageModel,
                system,
                prompt,
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
                    scope,
                    sectionHeading: scope === "section" ? sectionHeading : null,
                    fingerprintCount: fingerprints.length,
                    applyOnSuccess: apply,
                    ai: aiRequestMetadata,
                },
            });

            // 4. Existing post-processors. They are idempotent so running them on
            //    an already-cleaned draft is safe; they catch model regressions.
            //    Section mode also runs a small heading-separator repair: Gemini
            //    occasionally returns "## Heading text first paragraph…" on one
            //    line. The repair re-splits them so the validator (and downstream
            //    markdown renderers) see a proper heading block.
            let cleaned = applyAntiTemplateTransforms(humanize(rawRewritten));
            if (scope === "section") {
                cleaned = repairSectionRewrite(cleaned, resolvedHeadingLine);
            } else {
                cleaned = repairArticleRewriteStructure(fullArticle, cleaned);
            }

            // 5. Validate structural invariants — branch by scope.
            const failure = scope === "section"
                ? validateSectionRewrite(rewriteInput, cleaned, resolvedHeadingLine)
                : validateRewrite(fullArticle, cleaned);
            if (failure) {
                return NextResponse.json(
                    {
                        error: `Rewrite rejected by structural validator: ${failure.message}`,
                        code: failure.code,
                        fingerprints,
                        scope,
                    },
                    { status: 422 },
                );
            }

            // For section scope: splice the rewritten section back into the full
            // article. For article scope: the cleaned output IS the new article.
            const nextFullMarkdown = scope === "section"
                ? fullArticle.slice(0, resolvedSectionStart) + cleaned + fullArticle.slice(resolvedSectionEnd)
                : cleaned;
            assertSafeGeneratedOutput({
                revisedMarkdown: cleaned,
                revisedFullMarkdown: nextFullMarkdown,
            });

            let applied = false;
            if (apply) {
                // Record the run in metadata.provenance.humanize_runs so operators
                // can see the article has been through the layer and how many tells
                // were addressed. Append-only — we never clear prior runs.
                const provenance = (item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
                    ? item.metadata
                    : {}) as Record<string, unknown>;
                const existingProvenance = (provenance.provenance && typeof provenance.provenance === "object" && !Array.isArray(provenance.provenance)
                    ? provenance.provenance
                    : {}) as Record<string, unknown>;
                const existingRuns = Array.isArray(existingProvenance.humanize_runs)
                    ? existingProvenance.humanize_runs
                    : [];

                const nextMetadata = {
                    ...provenance,
                    provenance: {
                        ...existingProvenance,
                        humanize_runs: [
                            ...existingRuns,
                            {
                                ran_at: new Date().toISOString(),
                                ran_by: user.id,
                                scope,
                                section_heading: scope === "section" ? sectionHeading : null,
                                fingerprint_count: fingerprints.length,
                                fingerprints: fingerprints.map((f) => ({ id: f.id, count: f.count })),
                                original_length: rewriteInput.length,
                                revised_length: cleaned.length,
                            },
                        ],
                    },
                };

                const { error: updateError } = await supabase
                    .from("content_items")
                    .update({
                        content_markdown: nextFullMarkdown,
                        metadata: nextMetadata,
                    })
                    .eq("id", id)
                    .eq("workspace_id", workspaceId);

                if (updateError) {
                    return NextResponse.json({ error: updateError.message }, { status: 500 });
                }
                applied = true;
            }

            const response: HumanizeResponse = {
                contentId: id,
                scope,
                sectionHeading: scope === "section" ? sectionHeading : undefined,
                fingerprints,
                originalLength: rewriteInput.length,
                revisedLength: cleaned.length,
                revisedMarkdown: cleaned,
                revisedFullMarkdown: scope === "section" ? nextFullMarkdown : undefined,
                applied,
            };
            return NextResponse.json(response);
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
        console.error("[humanize-blog] AI provider error:", providerError.toJSON());
        return NextResponse.json(
            { error: "Failed to humanize the article. Please try again." },
            { status: 500 },
        );
    }
}
