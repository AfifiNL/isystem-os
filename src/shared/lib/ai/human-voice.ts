/**
 * Central voice module for every LLM-backed content path in the app.
 *
 * Two exports:
 *   - HUMAN_VOICE_RULES  — a string block to paste into every prompt that
 *     produces user-facing prose. Keep it terse; long lists start to feel like
 *     "AI slop about avoiding AI slop" and the model ignores them.
 *   - humanize(text)     — post-processor that strips the residue the model
 *     still emits after the prompt (em dashes, ellipsis glyphs, opener
 *     clichés, hedging phrases, smart quotes inside code spans, etc.).
 *
 * The rule of thumb: the prompt asks for human voice; the humanizer is a
 * safety net for the 10% of the time the model slides back into house style.
 */

export const HUMAN_VOICE_RULES = `
Voice rules — follow all of them:
- Write like a human operator, not a marketing bot. Have an actual point of view.
- Vary sentence rhythm aggressively. Mix 6-word punches with 25-30 word sentences in the SAME paragraph. NEVER write three or more sentences in a row that are all roughly the same length (a tell of AI writing). NEVER write three sentences in a row that all open with the same part of speech (subject-verb-subject-verb-subject-verb is a tell).
- Avoid the "X is Y. This can be Z. Many leaders struggle with W." cadence — uniform short choppy declaratives stacked next to each other read as machine-generated. Combine related ideas into one longer sentence with a comma or "and"; let one or two paragraphs run long; let others stay sharp.
- Concrete examples beat abstract claims. If you can't name the specific company, metric, year, or scenario, cut the claim or replace it with a specific one.
- Use plain hyphens and separate sentences. Never use the em dash "—" or the en dash "–". If you need a break, start a new sentence or use a comma.
- Never use ellipses "…" or three dots ". . ." — finish the thought.
- Ban these words and phrases outright: delve, dive into, unlock, unleash, tapestry, testament, navigate the landscape, in today's fast-paced world, it's important to note, it's worth noting, in conclusion, in summary, moreover, furthermore, thus, henceforth, hence, therefore, embark, journey, game-changer, game changer, revolutionize, revolutionise, leverage, synergy, paradigm, holistic, robust solution, cutting-edge, state-of-the-art, seamless, harness, empower, elevate, curate, deep dive, at the end of the day, needless to say, rest assured, silent threat, dangerous blend, ticking liability, false economy, new frontier, blind spot to, ticking time bomb, double-edged sword, north star, slippery slope, perfect storm, sea change, stark contrast, in stark contrast, walled garden, data silo, ring-fenced, ring fencing, ad-hoc, ChatGPT wrapper, thin wrapper, operational intelligence, system-first, digital backbone, competitive edge, unique selling proposition, comprehensive governance, data-driven process, commercial imperative.
- Do NOT open paragraphs by naming the audience ("For founders and operations leads…", "For CFOs and operators…", "For SME leaders…"). It is a templated set-up the model uses to feign relevance. Lead with the claim itself; the audience can figure out the article is for them from the substance.
- The phrase "system-first" is overused by this model. Avoid it entirely; if you need to describe a posture, name what it actually does ("logged at the gateway", "enforced in the database", "built into the request path") instead of using the abstract label.
- BAN the explicit "Conclusion" / "Final Thoughts" / "Wrapping Up" / "Key Takeaways" / "Summary" / "In Closing" H2 section at the end of the article. It is a hallmark of academic / templated structure. End the article with a substantive final paragraph that makes the closing argument; do NOT label that paragraph with a heading.
- Ban these opener patterns: "Excited to share", "I'm thrilled to", "In this post we will", "Have you ever wondered", "Let's explore", "Picture this", "Imagine a world where".
- Vary paragraph openers across the article: do not start more than two consecutive paragraphs with the same word, and do not start more than 30% of paragraphs with "The", "This", or a participial phrase ("Building on…", "Looking at…"). Mix declarative leads, scene-setting clauses, and direct claims.
- No hedging filler: avoid "arguably", "perhaps", "it could be said", "one might argue", "some would say".
- No rhetorical questions stacked at the top. One opener max, and only if it earns its place.
- Contractions are fine. Casual is fine. Write the way you'd actually type a Slack message to a smart peer.
- BAN the "not X, it's Y" reflex. Phrasings like "isn't just X, it's Y", "is no longer X, it's Y", "isn't merely X, it's Y", "more than X, it's Y" are the #1 AI-detection giveaway. If you catch yourself reaching for it, write the second half as a direct claim and delete the first half. Maximum ONE instance in an entire article, and only if the contrast is genuine.
- BAN tricolon stacking. Do not list three parallel adjectives ("predictable, trustworthy, and scalable") or three parallel noun phrases ("robust guardrails, clear policies, and stringent protocols") in a row. Two is fine; three reads as machine cadence. If you have three ideas, write a sentence per idea or pick the strongest two.
- BAN templated scaffolding in prose. Do not write "Pillar 1 / Pillar 2 / Pillar 3", "Step 1 / Step 2 / Step 3", "First... Second... Third...", or "Three pillars / Four pillars" introductions. If structure is needed, use a markdown list once; do not narrate the list with header-like callouts.
- Statistics must be concrete and load-bearing. Never include a round-number stat ("50%", "80%", "30%") unless you cite the named primary source AND the figure is essential to the argument. If you only have one secondary source, drop the number and describe the trend qualitatively or with a specific example. One generic stat is worse than zero.
- Cap clichéd metaphors at one per article. Words like "lifeblood", "Wild West", "regulatory gauntlet", "ticking liability", "put the genie back in the bottle", "double-edged sword", "north star" are fine in isolation, fatal when stacked.
- Open the article with a concrete observation, named scenario, or specific fact — not a sweeping civilizational claim ("AI is no longer X; it's an inescapable Y"). The first sentence should be something only someone working in the space would write.
- Never wrap the output in commentary like "Here is your content:" or "Sure, here you go". Output only the requested content.
`.trim();

// ────────────────────────────────────────────────────────────────────────────────
// Post-processor
// ────────────────────────────────────────────────────────────────────────────────

interface HumanizeOptions {
    /** Preserve line breaks (markdown bodies). Default true. */
    preserveNewlines?: boolean;
    /** Skip substitution for banned words — useful for highly structured fields
     *  where swapping a word would break formatting (e.g. a plan's `slug`). */
    vocabOnly?: boolean;
}

/**
 * Punctuation substitutions. Applied in order. Tuned so replacements don't
 * stack badly: the em-dash replacement uses `, ` which is safe in prose but
 * does not introduce a new em-dash.
 */
const PUNCTUATION_REPLACEMENTS: Array<[RegExp, string]> = [
    // Em dash surrounded by optional whitespace → period + space (ends thought)
    // but only at end-of-clause; inside a clause we use comma.
    [/\s*—\s*/g, ", "],
    [/\s*–\s*/g, ", "],
    // Horizontal bar / figure dash occasionally leak through.
    [/\s*―\s*/g, ", "],
    [/\s*‒\s*/g, ", "],
    // Three-dot ellipsis glyph or spaced dots → single period.
    [/…/g, "."],
    [/\s*\.\s*\.\s*\.\s*/g, ". "],
    // Curly quotes → straight quotes (they read as AI-polished).
    [/[\u2018\u2019\u201A\u201B]/g, "'"],
    [/[\u201C\u201D\u201E\u201F]/g, '"'],
    // Non-breaking spaces and thin spaces → normal space.
    [/[\u00A0\u2009\u202F]/g, " "],
];

/**
 * Words/phrases to strip entirely or rewrite. Case-insensitive. Order matters
 * — more specific phrases first so the generic single-word rules don't
 * half-delete a longer idiom.
 */
const PHRASE_REWRITES: Array<[RegExp, string]> = [
    // Opener clichés — wipe the whole lead-in.
    [/^\s*excited to share[^.!?\n]*[.!?\n]?/i, ""],
    [/^\s*i['']m thrilled to[^.!?\n]*[.!?\n]?/i, ""],
    [/^\s*in this (?:post|article|guide)[, ]+we['']?ll?\s+[^.!?\n]*[.!?\n]?/i, ""],
    [/^\s*have you ever wondered[^.?\n]*\??/i, ""],
    [/^\s*let['']s (?:explore|dive|delve)[^.!?\n]*[.!?\n]?/i, ""],
    [/^\s*picture this[.:]?/i, ""],
    [/^\s*imagine a world where[^.!?\n]*[.!?\n]?/i, ""],

    // Hedging filler — drop the word, keep the sentence.
    [/\barguably\b[,\s]*/gi, ""],
    [/\bperhaps\b[,\s]*/gi, ""],
    [/\bit (?:could|might) be said that\b/gi, ""],
    [/\bone might argue that\b/gi, ""],
    [/\bsome would say that\b/gi, ""],

    // Connector clichés — downgrade to simpler equivalents.
    [/\bmoreover[, ]?/gi, "Also "],
    [/\bfurthermore[, ]?/gi, "Also "],
    [/\bhenceforth[, ]?/gi, ""],
    [/\bhence[, ]?/gi, "So "],
    [/\bthus[, ]?/gi, "So "],
    [/\btherefore[, ]?/gi, "So "],

    // Filler summaries.
    [/\bin conclusion[, ]?/gi, ""],
    [/\bin summary[, ]?/gi, ""],
    [/\bto summarize[, ]?/gi, ""],
    [/\bneedless to say[, ]?/gi, ""],
    [/\bat the end of the day[, ]?/gi, ""],
    [/\bit['']s (?:important|worth) (?:to )?not(?:e|ing) that\b/gi, ""],
    [/\brest assured[, ]?/gi, ""],

    // Jargon swaps.
    [/\bdelve into\b/gi, "dig into"],
    [/\bdive into\b/gi, "dig into"],
    [/\bdeep[- ]dive\b/gi, "digs"],
    [/\bunlock\b/gi, "use"],
    [/\bunleash\b/gi, "use"],
    [/\bharness\b/gi, "use"],
    [/\bleverage\b/gi, "use"],
    [/\bempower\b/gi, "help"],
    [/\belevate\b/gi, "improve"],
    [/\bcurate\b/gi, "pick"],
    [/\bembark on (?:a|the)\b/gi, "start a"],
    [/\bjourney\b/gi, "path"],
    [/\bgame[- ]changer\b/gi, "big shift"],
    [/\brevolutioni[sz]e\b/gi, "reshape"],
    [/\bseamless\b/gi, "smooth"],
    [/\bcutting[- ]edge\b/gi, "modern"],
    [/\bstate[- ]of[- ]the[- ]art\b/gi, "modern"],
    [/\brobust solution\b/gi, "solution"],
    [/\bsynerg(?:y|ies)\b/gi, "overlap"],
    [/\bparadigm\b/gi, "model"],
    [/\bholistic\b/gi, "end-to-end"],
    [/\btapestry of\b/gi, "mix of"],
    [/\ba testament to\b/gi, "proof of"],
    [/\bnavigat(?:e|ing) the landscape of\b/gi, "working with"],
    [/\bin today['']s fast[- ]paced world[, ]?/gi, ""],
    // Reviewer-flagged stock phrases that prompt rules don't reliably suppress.
    [/\bin stark contrast[, ]?/gi, ""],
    [/\bstark contrast\b/gi, "difference"],
    [/\bwalled gardens?\b/gi, "private environment"],
    [/\bdata silos?\b/gi, "isolated stores"],
    [/\bring[- ]fenced\b/gi, "isolated"],
    [/\bring[- ]fencing\b/gi, "isolation"],
    // Scare-quote-resistant: catches "thin wrappers" AND "'thin' wrappers" AND
    // even "'thin' variety/version" (where the model substitutes the head
    // noun after the banned adjective to evade direct phrase matches).
    // The leading optional quote is OUTSIDE the word boundary so the whole
    // scare-quote-wrapped token is consumed by the match (otherwise the
    // opening `'` is left orphaned in the output).
    [/(?:["'\u2018\u2019\u201C\u201D]thin["'\u2018\u2019\u201C\u201D]|\bthin\b)\s+(wrappers?|variety|version|solutions?|tools?)\b/gi, "$1"],
    [/(?:["'\u2018\u2019\u201C\u201D]ChatGPT["'\u2018\u2019\u201C\u201D]|\bChatGPT\b)\s+(wrappers?|tools?|clones?|knockoffs?)\b/gi, "$1"],
    [/\boperational intelligence\b/gi, "operations data"],
    [/\bsystem[- ]first\b/gi, ""],
    [/\bdigital backbone\b/gi, "core"],
    [/\bcompetitive edge\b/gi, "advantage"],
    [/\bunique selling proposition\b/gi, ""],
    [/\bcomprehensive governance\b/gi, "governance"],
    [/\bdata[- ]driven process\b/gi, "measurable process"],
    [/\bcommercial imperative\b/gi, ""],
];

/**
 * The "not X, it's Y" reflex. Detect the most common surface forms and
 * collapse them to the direct claim. We deliberately keep these conservative:
 * each pattern matches one full clause so we never half-rewrite a sentence.
 *
 * Subject re-introducer matches both contracted ("it's", "they're") and
 * uncontracted ("it is", "they are") forms. The previous version split
 * "(?:it |they |...)?" from "(?:is|are|'s|...)" which broke against the
 * common contracted form ("it's") — "it " required a trailing space and
 * "'s" was never adjacent to a captured subject. One alternation now.
 *
 * The model still wins occasionally — these rules are a safety net for the
 * 10% that slip past HUMAN_VOICE_RULES.
 */
// Subject re-introducer matches after a "not X;" clause. Covers both the
// contracted/uncontracted "be" forms (it's, it is, has become) AND the
// generic "it + verb" forms ("it shapes", "they reshape", "this changes").
// The third-person-verb branch requires the verb to be 3-12 lowercase
// letters and word-bounded so it doesn't false-positive on prepositions
// or new sentence starts.
const SUBJECT_INTRO = "(?:it[\u2019']s|they[\u2019']re|that[\u2019']s|this is|that is|it is|they are|it has become|they have become|is|are|has become|have become|it [a-z]{3,12}s\\b|they [a-z]{3,12}\\b|this [a-z]{3,12}s\\b|that [a-z]{3,12}s\\b)";

const NOT_X_BUT_Y_REWRITES: Array<[RegExp, string]> = [
    // "X is no longer/not just A; it's B." → "X is B."
    [new RegExp(`\\b(is|are|was|were) (?:no longer|not just|not merely|not only) (?:a |an |the )?[^.;:!?\\n]{3,80}[;.,] ${SUBJECT_INTRO} `, "gi"), "$1 "],
    // Bare "X is not A; it is B." (no "just/merely/only" modifier — caught
    // a live failure: "is not a trend; it is a fundamental shift"). Only
    // when the second clause re-introduces with "it is/it's/this is/that
    // is" do we collapse — that's the unambiguous contrast cadence. Bare
    // "X is not Y, Z, and W" (a list) does not match this pattern.
    [new RegExp(`\\b(is|are|was|were) not (?:a |an |the )?[^.;:!?\\n]{3,80}[;.] (?:it[\u2019']s|this is|that is|it is|they are) `, "gi"), "$1 "],
    // "X isn't just A; it's B." → "X is B."
    [new RegExp(`\\b(?:isn[\u2019']t|aren[\u2019']t|wasn[\u2019']t|weren[\u2019']t) (?:just |merely |only |simply )?[^.;:!?\\n]{3,80}[;.,] ${SUBJECT_INTRO} `, "gi"), "is "],
    // "more than (just) A; it's B." → "is B."
    [new RegExp(`\\bmore than (?:just )?(?:a |an |the )?[^.;:!?\\n]{3,80}[;.,] ${SUBJECT_INTRO} `, "gi"), "is "],
    // "X is not (just|merely) about A. It's about B." (period variant) → "X is about B."
    [new RegExp(`\\b(is|are|was|were) (?:no longer|not just|not merely|not only)( about | only about )?[^.;:!?\\n]{3,80}\\. ${SUBJECT_INTRO} `, "gi"), "$1$2"],
    // Bare "not (just|merely) about A; (it's|this is) about B." with no leading "is/are" → keep the
    // direct claim. Covers sentences that open with the negation ("Not just a
    // checklist; this is governance.").
    [new RegExp(`\\bnot (?:just|merely|only|simply) (?:a |an |the )?[^.;:!?\\n]{3,80}[;.,] ${SUBJECT_INTRO} `, "gi"), ""],
    // Trailing negation: "It is about automating workflows, not just providing
    // a chat interface." → "It is about automating workflows." Drop the
    // trailing comma + negated clause. Variants: "not just", "not merely",
    // "not only", "rather than just", "instead of just", "as opposed to".
    [/, (?:not just|not merely|not only|rather than just|instead of just|as opposed to(?: just)?) [^.;!?\n]{3,120}([.;!?])/gi, "$1"],
    // Same trailing negation but with an em-dash already normalized by
    // PUNCTUATION_REPLACEMENTS into ", " — covered by the rule above.
];

/**
 * Strip Unicode "mathematical bold/italic" glyphs that LLMs copy out of
 * styled LinkedIn/X posts (e.g. `𝟳𝟰%`, `𝗶𝗦𝘆𝘀𝘁𝗲𝗺`). Reads as raw garbage in
 * a published article and is an obvious tell of unfiltered scraped content.
 * Maps each styled codepoint back to its ASCII equivalent.
 */
function normalizeUnicodeStyledGlyphs(text: string): string {
    let out = text;

    // Mathematical Alphanumeric Symbols block (U+1D400-U+1D7FF) covers
    // bold, italic, bold-italic, script, fraktur, double-struck, sans-serif
    // (bold/italic/bold-italic), and monospace letters + digits.
    out = out.replace(/[\u{1D400}-\u{1D7FF}]/gu, (ch) => {
        const cp = ch.codePointAt(0)!;
        // Digits 0-9 in each styled range. Each digit subblock is 10 chars.
        const digitBases = [0x1D7CE, 0x1D7D8, 0x1D7E2, 0x1D7EC, 0x1D7F6];
        for (const base of digitBases) {
            if (cp >= base && cp <= base + 9) return String.fromCharCode(0x30 + (cp - base));
        }
        // Uppercase A-Z in each styled range (start codepoint = base, 26 chars).
        const upperBases = [0x1D400, 0x1D434, 0x1D468, 0x1D49C, 0x1D4D0, 0x1D504, 0x1D538, 0x1D56C, 0x1D5A0, 0x1D5D4, 0x1D608, 0x1D63C, 0x1D670];
        for (const base of upperBases) {
            if (cp >= base && cp <= base + 25) return String.fromCharCode(0x41 + (cp - base));
        }
        // Lowercase a-z in each styled range (start codepoint = base + 26).
        const lowerBases = upperBases.map((b) => b + 26);
        for (const base of lowerBases) {
            if (cp >= base && cp <= base + 25) return String.fromCharCode(0x61 + (cp - base));
        }
        return ch;
    });

    return out;
}

function applyReplacements(text: string, rules: Array<[RegExp, string]>): string {
    let out = text;
    for (const [re, replacement] of rules) {
        out = out.replace(re, replacement);
    }
    return out;
}

/**
 * Tighten up whitespace after removing phrases:
 *   - collapse doubled spaces,
 *   - drop space before punctuation,
 *   - capitalize the first letter of any sentence that started with a dropped
 *     connector ("So…", "Also…" are already capitalized above, but cleanups
 *     may leave "so " mid-sentence).
 */
function normalizeWhitespace(text: string, preserveNewlines: boolean): string {
    let out = text;
    out = out.replace(/ {2,}/g, " ");
    out = out.replace(/[ \t]+([,.;:!?])/g, "$1");
    out = out.replace(/([,.;:!?])[ \t]{2,}/g, "$1 ");
    if (!preserveNewlines) {
        out = out.replace(/\n{3,}/g, "\n\n");
    } else {
        out = out.replace(/[ \t]+\n/g, "\n");
        out = out.replace(/\n{3,}/g, "\n\n");
    }
    // Capitalize the first non-whitespace character.
    out = out.replace(/^(\s*)([a-z])/, (_m, ws, c) => `${ws}${c.toUpperCase()}`);
    return out.trim();
}

/**
 * Run the humanization filter over `text`. Idempotent — safe to call twice.
 */
export function humanize(text: unknown, options: HumanizeOptions = {}): string {
    if (typeof text !== "string") return "";
    if (!text) return "";
    const { preserveNewlines = true, vocabOnly = false } = options;

    let out = text;
    out = normalizeUnicodeStyledGlyphs(out);
    out = applyReplacements(out, PUNCTUATION_REPLACEMENTS);
    if (!vocabOnly) {
        out = applyReplacements(out, PHRASE_REWRITES);
        out = applyReplacements(out, NOT_X_BUT_Y_REWRITES);
    }
    out = normalizeWhitespace(out, preserveNewlines);
    return out;
}

/**
 * Deep-humanize every string leaf in a JSON-like tree. Does NOT touch object
 * keys. Use this on a structured-output payload (e.g. a Gemini generateObject
 * result) before persistence so the rules hit every prose field.
 *
 * `skipKeys` is consulted by leaf key name OR full dot-path. Bare names like
 * `"funnelStage"` skip every occurrence regardless of nesting; full paths like
 * `"clusters[0].funnelStage"` skip only that specific location. This protects
 * slugs, ids, and enum-like strings from prose post-processing (which would
 * otherwise capitalize "top" → "Top" and break Postgres enum inserts).
 */
export function humanizeDeep<T>(value: T, skipKeys: readonly string[] = []): T {
    const skip = new Set(skipKeys);
    const seen = new WeakSet<object>();

    const leafKey = (path: string): string => {
        const lastDot = path.lastIndexOf(".");
        const tail = lastDot >= 0 ? path.slice(lastDot + 1) : path;
        // Strip a trailing array index so `clusters[0]` and `funnelStage[2]`
        // both reduce to the underlying field name.
        return tail.replace(/\[\d+\]$/, "");
    };

    const walk = (node: unknown, keyPath: string): unknown => {
        if (typeof node === "string") {
            if (skip.has(keyPath) || skip.has(leafKey(keyPath))) return node;
            return humanize(node);
        }
        if (node == null || typeof node !== "object") return node;
        if (seen.has(node as object)) return node;
        seen.add(node as object);
        if (Array.isArray(node)) {
            return node.map((child, i) => walk(child, `${keyPath}[${i}]`));
        }
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
            out[k] = walk(v, keyPath ? `${keyPath}.${k}` : k);
        }
        return out;
    };

    return walk(value, "") as T;
}
