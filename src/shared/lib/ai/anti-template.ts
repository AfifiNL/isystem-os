/**
 * Anti-template markdown post-processor.
 *
 * Three structural tells that prompt rules alone do not reliably suppress:
 *
 *   1. Colon-style section headers ("The X Strategy: Frictionless Logging").
 *      Five of nine headings in a single LLM-generated article followed the
 *      same `Concept: Tagline` template — a recognizable AI cadence.
 *
 *   2. Tricolon stacks ("recorded, traced, and understood" / "Integrated,
 *      Compliant, Optimized"). The model defaults to three parallel items
 *      where two would do.
 *
 *   3. Bold-label list cards (`**Term:** description.`). Used in moderation
 *      they are fine; stacked five or six in a row they read as a template.
 *
 * Each transform is conservative: the goal is to break the rhythm enough
 * that a human reader stops clocking the cadence, not to rewrite the
 * article. False positives are preferable to false negatives here — the
 * reader is the AI-detection oracle, not a structural correctness checker.
 */

// ────────────────────────────────────────────────────────────────────────
// 1. Colon-style section headers
// ────────────────────────────────────────────────────────────────────────

/**
 * Detect H1/H2/H3 lines matching `# Concept: Tagline` where both halves
 * look title-cased. Drop the tagline. Plain "# Title with a colon: detail"
 * (lowercase right-hand side) stays untouched.
 */
function stripColonTaglineHeadings(markdown: string): string {
    return markdown.replace(
        /^(#{1,3})[ \t]+([A-Z][^:\n]{2,60}):[ \t]+([A-Z][^\n]+)$/gm,
        (full, hashes, left, right) => {
            const rightWords = String(right).trim().split(/\s+/);
            // Tagline pattern: 2-6 words, every "real" word capitalized.
            if (rightWords.length < 2 || rightWords.length > 6) return full;
            const allCapitalized = rightWords.every((w) =>
                /^[A-Z]/.test(w) || /^(?:a|an|the|of|for|to|in|on|at|by|with|and|or|nor)$/i.test(w),
            );
            if (!allCapitalized) return full;
            // Keep the concept; drop the tagline.
            return `${hashes} ${String(left).trim()}`;
        },
    );
}

// ────────────────────────────────────────────────────────────────────────
// 2. Tricolon stacks
// ────────────────────────────────────────────────────────────────────────

/**
 * Collapse three-item parallel structures to two items. Two passes:
 *   (1) Single-word triples ("recorded, traced, and understood").
 *   (2) Short multi-word phrase triples where every item is 1-4 words and
 *       the items have comparable shape ("higher accuracy, reduced
 *       hallucinations, and full compliance"). Skips bulleted/numbered
 *       lines, skips proper-noun-heavy enumerations (real lists).
 */
function collapseTricolons(markdown: string): string {
    const ITEM = "[A-Za-z][A-Za-z-]{3,14}";
    const PHRASE = "(?:[A-Za-z][A-Za-z-]*(?: [A-Za-z][A-Za-z-]*){0,3})";

    function processLine(line: string): string {
        if (/^\s*[-*+]\s/.test(line) || /^\s*\d+\.\s/.test(line) || /^\s*#/.test(line)) {
            return line;
        }

        // Pass 1: single-word triple (with and without Oxford comma).
        // "X, Y, and Z" → "X and Z"   AND
        // "X, Y and Z"  → "X and Z"   (the non-Oxford variant caught a live
        //                              failure: "security, compliance and cost
        //                              management" was unbroken until we
        //                              dropped the requirement for the second
        //                              comma).
        let out = line.replace(
            new RegExp(`\\b(${ITEM}), (${ITEM}),? (?:and|or) (${ITEM})\\b`, "g"),
            (full, a, _b, c) => {
                const lineUpperHeads = [a, _b, c].filter((w) => /^[A-Z]/.test(w)).length;
                if (lineUpperHeads >= 2) return full;
                return `${a} and ${c}`;
            },
        );

        // Pass 2: short multi-word phrase triple. Each item 1-4 words,
        // total phrase length 4-40 chars. Only match when at least one
        // item is multi-word (otherwise pass 1 already handled it).
        out = out.replace(
            new RegExp(`\\b(${PHRASE}), (${PHRASE}),? (?:and|or) (${PHRASE})(?=[\\s.,;:!?]|$)`, "g"),
            (full, a, b, c) => {
                const items = [a, b, c] as string[];
                // Length sanity: each item between 4 and 40 chars.
                if (items.some((s) => s.length < 4 || s.length > 40)) return full;
                // Proper-noun list safety: keep if 2+ items are
                // capitalized (real enumerations like "GDPR, HIPAA,
                // and the EU AI Act").
                const upperHeads = items.filter((s) => /^[A-Z]/.test(s)).length;
                if (upperHeads >= 2) return full;
                // Require at least one multi-word item — otherwise this
                // overlaps pass 1.
                const multiWordCount = items.filter((s) => s.includes(" ")).length;
                if (multiWordCount === 0) return full;
                // Drop the middle item. Preserve any trailing
                // punctuation/whitespace that followed the match by relying
                // on the lookahead boundary.
                return `${a} and ${c}`;
            },
        );

        return out;
    }

    return markdown.split("\n").map(processLine).join("\n");
}

/**
 * Unwrap inline numbered step scaffolding written as prose. The model often
 * emits a single paragraph like:
 *
 *   1. Audit Your Landscape: Begin by ... 2. Define Your Needs: Next, ...
 *   3. Architect a Solution: Finally, ...
 *
 * The title-cased "Step" labels mid-paragraph read as templated
 * sub-headings and the formula is an AI-detection tell. Drop the numbered
 * title-cased prefix; keep the explanatory sentence.
 */
function unwrapInlineNumberedSteps(markdown: string): string {
    // Match `<digit>. Title Case Phrase: <Capital>` where the title-cased
    // phrase is 2-6 words, every word starts uppercase. Require at least
    // three such occurrences in the same paragraph before unwrapping —
    // a single "1. Foo: bar" is probably real.
    return markdown.split(/\n{2,}/).map((paragraph) => {
        // Title-case phrase: leading uppercase word + 1-7 follow-up words
        // where each follow-up is either another capitalized word OR a short
        // lowercase connector. "Architect a System-First Solution" needs
        // the lowercase "a" allowance.
        const stepRe = /\b(\d+)\.\s+((?:[A-Z][A-Za-z]*(?:[- ]+(?:[A-Z][A-Za-z]*|a|an|the|of|to|for|in|on|and|or)){1,7})):\s+(?=[A-Z])/g;
        const matches = paragraph.match(stepRe) ?? [];
        if (matches.length < 2) return paragraph;
        return paragraph.replace(stepRe, "");
    }).join("\n\n");
}

/**
 * After we banned `1. Title:` numbered step scaffolding, the model adapted
 * to bare `Title Cased Action Phrase: Description.` repeated 3+ times in
 * the same paragraph. Same templated structure, no digits. This catches the
 * adapted form: when a paragraph contains 3+ title-cased label-colons, drop
 * the labels.
 *
 * Threshold of 3 is the false-positive floor. A paragraph with one or two
 * "Concept: definition" patterns is almost always legitimate prose; three
 * in close proximity is the templated step list.
 */
function unwrapMidProseTitleCardLabels(markdown: string): string {
    return markdown.split(/\n{2,}/).map((paragraph) => {
        if (/^\s*[-*+]\s/.test(paragraph) || /^\s*\d+\.\s/.test(paragraph) || /^#/.test(paragraph)) {
            return paragraph;
        }
        // Title-cased phrase: 2-6 word tokens. Each token is a capitalized
        // word OR a short lowercase connector (mid-phrase only). The phrase
        // must START with an uppercase word and be followed by `: ` and a
        // capital letter (sentence start).
        const cardRe = /\b([A-Z][A-Za-z]+(?:[ -](?:[A-Z][A-Za-z]+|a|an|the|of|to|for|in|on|and|or|by)){1,5}): (?=[A-Z])/g;
        const matches = paragraph.match(cardRe) ?? [];
        if (matches.length < 3) return paragraph;
        return paragraph.replace(cardRe, "");
    }).join("\n\n");
}

// ────────────────────────────────────────────────────────────────────────
// 3. Bold-label list-card cap
// ────────────────────────────────────────────────────────────────────────

/**
 * When a run of consecutive list items all start with `**Term:**` it reads
 * as templated card scaffolding. Convert excess cards in a run to plain
 * prose (drop the bold framing). We keep the first two so structure-heavy
 * sections still skim well; everything past that gets unwrapped.
 */
function unwrapStackedBoldCards(markdown: string): string {
    const lines = markdown.split("\n");
    const out: string[] = [];
    let cardRun = 0; // how many bold-label cards we've kept in the current run
    const BOLD_CARD = /^(\s*[-*+]\s+)\*\*([^*\n]{2,60}?):\*\*\s+(.+)$/;

    for (const line of lines) {
        const m = line.match(BOLD_CARD);
        if (m) {
            const [, marker, term, body] = m;
            if (cardRun < 2) {
                out.push(line);
                cardRun += 1;
            } else {
                // Unwrap into plain prose: drop the bullet + bold framing,
                // keep the concept inline. Lowercase the term unless it's
                // already a proper noun (first char uppercase + has lower).
                const isProperNoun = /^[A-Z][a-z]/.test(term);
                const inlineTerm = isProperNoun ? term : term.charAt(0).toLowerCase() + term.slice(1);
                const indent = marker.match(/^(\s*)/)?.[1] ?? "";
                out.push(`${indent}${inlineTerm}: ${body}`);
            }
        } else {
            // Reset run on any non-card line (blank, prose, heading).
            if (line.trim() !== "" || cardRun === 0) {
                cardRun = 0;
            }
            out.push(line);
        }
    }

    return out.join("\n");
}

// ────────────────────────────────────────────────────────────────────────
// Composed pipeline
// ────────────────────────────────────────────────────────────────────────

/**
 * Apply every structural anti-template transform in order. Idempotent —
 * calling twice returns the same result. Safe to run before or after
 * `humanize()`.
 */
/**
 * Strip explicit closing-section H2 labels at the end of the article.
 * Targets headings like `## Conclusion`, `## Final Thoughts`, `## Key
 * Takeaways`, `## Wrapping Up`, `## Summary`, `## In Closing`. The body
 * below the heading is kept — only the heading line is removed so the
 * article ends with a substantive paragraph that doesn't announce itself
 * as a summary. Academic structure is one of the AI-detection tells.
 */
function stripClosingSectionHeadings(markdown: string): string {
    return markdown.replace(
        /^#{1,3}\s+(?:Conclusion|Final Thoughts?|Wrapping Up|Key Takeaways?|Summary|In Closing|Closing Thoughts?|Final Words?|Takeaway|To Conclude)\s*:?\s*[^\n]*$/gim,
        "",
    );
}

/**
 * Drop paragraphs whose only purpose is to narrate an embedded visual —
 * "This flowchart illustrates...", "The diagram below shows...", "Next:
 * Provides Data..." Captions like these leak into prose when the
 * generator prompt asks for visual placeholders, and they are the most
 * obvious AI tell to a human reader. We delete only the entire scaffolding
 * paragraph; if the writer needed contextual setup it would be inside a
 * regular paragraph and untouched.
 *
 * Visual shortcodes themselves ([Visual: ...]) are NOT removed — only the
 * surrounding caption-style paragraph that narrates them.
 */
function stripVisualDescriptionScaffolding(markdown: string): string {
    const NARRATE = /^(?:this|the)\s+(?:flowchart|diagram|chart|graph|infographic|visual|illustration|image)\s+(?:above|below|here)?\s*(?:illustrates|shows|depicts|demonstrates|highlights|outlines|maps|visualizes|presents)\b/i;
    const SIDE_REF = /^(?:as (?:you can see|shown) in the (?:flowchart|diagram|chart|graph|visual|image))/i;
    const STEP_FRAGMENT = /^(?:next|then|finally|step\s+\d+)\s*:/i;

    return markdown
        .split(/\n{2,}/)
        .filter((para) => {
            const trimmed = para.trim();
            if (!trimmed) return true;
            if (NARRATE.test(trimmed) || SIDE_REF.test(trimmed)) return false;
            // Only drop "Next: X" / "Step 1: X" lines if the paragraph is
            // short prose (one or two lines) — preserve actual numbered
            // lists where every line uses the same scaffolding.
            if (STEP_FRAGMENT.test(trimmed) && trimmed.split(/\n/).length <= 2) return false;
            return true;
        })
        .join("\n\n");
}

function demoteBodyH1Headings(markdown: string): string {
    const lines = markdown.split(/\r?\n/);
    let inFence = false;
    const processed = lines.map((line) => {
        if (/^\s*(```|~~~)/.test(line)) {
            inFence = !inFence;
            return line;
        }
        if (inFence) return line;

        // If it starts with "# " (H1 heading), demote to "## " (H2 heading)
        if (/^#\s+(.+)$/.test(line)) {
            return "## " + line.substring(2);
        }
        return line;
    });
    return processed.join("\n");
}

export function applyAntiTemplateTransforms(markdown: string): string {
    if (!markdown || typeof markdown !== "string") return markdown;
    let out = markdown;
    out = demoteBodyH1Headings(out);
    out = stripColonTaglineHeadings(out);
    out = stripClosingSectionHeadings(out);
    out = stripVisualDescriptionScaffolding(out);
    out = collapseTricolons(out);
    out = unwrapStackedBoldCards(out);
    out = unwrapInlineNumberedSteps(out);
    out = unwrapMidProseTitleCardLabels(out);
    return out;
}
