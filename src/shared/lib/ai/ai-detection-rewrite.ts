/**
 * AI-detection rewrite layer.
 *
 * Sits on top of the existing pipeline:
 *
 *   1. HUMAN_VOICE_RULES  (prompt-time guidance)
 *   2. critiqueAndReviseBlogContent  (second LLM pass during generation)
 *   3. humanize()  (post-processor — punctuation, opener clichés, etc.)
 *   4. applyAntiTemplateTransforms  (structural transforms — colon-tag headers,
 *      tricolon collapse, bold-card stacks, closing H2)
 *
 * This module provides a fifth, on-demand layer triggered manually by an
 * admin/manager from the blog editor. It targets the second-order tells that
 * generic AI-detectors latch onto — perfect rhythm, uniform sentence-length
 * distributions, "It is X that Y" hedging, parallel paragraph openers,
 * symmetrical contrast pairs — and asks the model to deliberately break
 * them with a fingerprint list pulled from the actual draft.
 *
 * Two surfaces:
 *   - detectAiFingerprints(markdown) — diagnostic scan; returns the patterns
 *     present in the draft so the UI can show "we found 7 tells" and the
 *     rewrite prompt can ground its instructions in concrete evidence
 *     ("you wrote 6 sentences in a row of 18-22 words — break this up").
 *   - buildHumanizeRewritePrompt(markdown, fingerprints, options) — the
 *     prompt sent to the rewriter. Built to be safe: it forbids the
 *     model from changing facts, headings, links, or shortcodes, and
 *     mandates byte-length-similar output (no aggressive shortening).
 */

export type FingerprintId =
    | "uniform_sentence_length"
    | "parallel_paragraph_openers"
    | "expletive_construction"
    | "balanced_contrast_pair"
    | "round_decade_statistics"
    | "low_contraction_density"
    | "absence_of_first_person"
    | "perfect_paragraph_lengths"
    | "stacked_rhetorical_questions"
    | "title_cased_concept_coinage"
    | "corporate_buzzword_vocabulary"
    | "visual_description_leak"
    | "formulaic_stat_intro"
    | "not_just_but_template"
    | "subject_verb_agreement_slip";

export interface FingerprintHit {
    id: FingerprintId;
    label: string;
    /** Count of distinct occurrences — useful for severity. */
    count: number;
    /** Concrete excerpts the rewriter should target. Capped at 4 to keep
     *  the prompt compact; severity is conveyed by `count`. */
    examples: string[];
    /** Why this matters to AI detectors — surfaced in the UI. */
    rationale: string;
}

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

const PROSE_SPLIT = /\n{2,}/;
const SENTENCE_SPLIT = /(?<=[.!?])\s+(?=[A-Z"'(])/;
const WORD_COUNT_RE = /\S+/g;

function isStructuralBlock(paragraph: string): boolean {
    const trimmed = paragraph.trim();
    return (
        trimmed.startsWith("#") ||
        trimmed.startsWith(">") ||
        trimmed.startsWith("- ") ||
        trimmed.startsWith("* ") ||
        trimmed.startsWith("```") ||
        /^\d+\.\s/.test(trimmed) ||
        /^\[\w+/.test(trimmed)
    );
}

function paragraphs(markdown: string): string[] {
    return markdown.split(PROSE_SPLIT);
}

function proseParagraphs(markdown: string): string[] {
    return paragraphs(markdown).filter((p) => p.trim().length > 0 && !isStructuralBlock(p));
}

function sentences(paragraph: string): string[] {
    return paragraph
        .split(SENTENCE_SPLIT)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}

function wordCount(text: string): number {
    return (text.match(WORD_COUNT_RE) ?? []).length;
}

function firstWord(text: string): string {
    const match = text.trim().match(/^[A-Za-z']+/);
    return match ? match[0] : "";
}

// ────────────────────────────────────────────────────────────────────────
// Individual fingerprint detectors
// ────────────────────────────────────────────────────────────────────────

/**
 * Three or more consecutive sentences within ±15% of each other in word
 * count. The single strongest perplexity/burstiness signal AI detectors
 * latch onto. We surface the paragraph excerpt so the rewriter can vary
 * its rhythm specifically there, not abstractly.
 */
function detectUniformSentenceLength(markdown: string): FingerprintHit | null {
    const examples: string[] = [];
    let count = 0;
    for (const para of proseParagraphs(markdown)) {
        const lengths = sentences(para).map(wordCount);
        if (lengths.length < 3) continue;
        for (let i = 0; i + 2 < lengths.length; i++) {
            const window = [lengths[i], lengths[i + 1], lengths[i + 2]];
            const avg = (window[0] + window[1] + window[2]) / 3;
            if (avg < 8) continue;
            const within = window.every((n) => Math.abs(n - avg) / avg <= 0.15);
            if (within) {
                count += 1;
                if (examples.length < 4) examples.push(para.slice(0, 200));
                break;
            }
        }
    }
    if (count === 0) return null;
    return {
        id: "uniform_sentence_length",
        label: "Uniform sentence length",
        count,
        examples,
        rationale:
            "Three+ consecutive sentences within 15% of the same word count produces a metronome rhythm — the dominant signal AI-detection classifiers train on.",
    };
}

/**
 * Two or more consecutive paragraphs starting with the same opening word.
 * "The ... The ..." and "This ... This ..." are the most common offenders.
 */
function detectParallelParagraphOpeners(markdown: string): FingerprintHit | null {
    const paras = proseParagraphs(markdown);
    const examples: string[] = [];
    let count = 0;
    for (let i = 1; i < paras.length; i++) {
        const prev = firstWord(paras[i - 1]).toLowerCase();
        const curr = firstWord(paras[i]).toLowerCase();
        if (prev && curr && prev === curr) {
            count += 1;
            if (examples.length < 4) {
                examples.push(
                    `…${paras[i - 1].slice(0, 80)}…\n…${paras[i].slice(0, 80)}…`,
                );
            }
        }
    }
    if (count === 0) return null;
    return {
        id: "parallel_paragraph_openers",
        label: "Parallel paragraph openers",
        count,
        examples,
        rationale:
            "Consecutive paragraphs that open with the same word (especially 'The' or 'This') signal a templated structure rather than a thinking writer.",
    };
}

/**
 * Expletive constructions like "There is", "There are", "It is X that Y".
 * Heavy in AI prose because they pad out a sentence without committing to a
 * subject; trivially removable.
 */
function detectExpletiveConstruction(markdown: string): FingerprintHit | null {
    const pattern = /\b(?:there (?:is|are|was|were)|it (?:is|was)) [a-z]/gi;
    const examples: string[] = [];
    let count = 0;
    for (const para of proseParagraphs(markdown)) {
        for (const sent of sentences(para)) {
            const matches = sent.match(pattern);
            if (matches) {
                count += matches.length;
                if (examples.length < 4) examples.push(sent.slice(0, 200));
            }
        }
    }
    if (count < 3) return null;
    return {
        id: "expletive_construction",
        label: "Expletive openings (There is / It is)",
        count,
        examples,
        rationale:
            "Three or more 'There is / It is X that Y' constructions in one article is an LLM tell — they hedge ownership of the claim and dilute perplexity.",
    };
}

/**
 * Symmetric contrast pairs not already caught by the existing "not X, it's Y"
 * humanizer rule: "Less X, more Y", "From X to Y", "Beyond X lies Y" templates.
 */
function detectBalancedContrastPair(markdown: string): FingerprintHit | null {
    const patterns = [
        /\b(?:less|fewer)\s+\w+(?:\s+\w+){0,4},?\s+more\s+\w+/gi,
        /\bfrom\s+\w+(?:\s+\w+){0,4}\s+to\s+\w+(?:\s+\w+){0,4}\b/gi,
        /\bbeyond\s+\w+(?:\s+\w+){0,4}\s+lies?\s+\w+/gi,
    ];
    const examples: string[] = [];
    let count = 0;
    for (const para of proseParagraphs(markdown)) {
        for (const re of patterns) {
            const matches = para.match(re);
            if (matches) {
                count += matches.length;
                for (const m of matches) {
                    if (examples.length < 4) examples.push(m);
                }
            }
        }
    }
    if (count === 0) return null;
    return {
        id: "balanced_contrast_pair",
        label: "Symmetric contrast templates",
        count,
        examples,
        rationale:
            "Phrases like 'less X, more Y' / 'from X to Y' / 'beyond X lies Y' are templated symmetry the model defaults to under length pressure.",
    };
}

/**
 * Round-decade statistics ("80%", "30%", "50%", "10x"). Allowed once; flagged
 * if three or more appear in the article, since detectors weight suspiciously
 * round numbers as a synthetic-content tell.
 */
function detectRoundDecadeStatistics(markdown: string): FingerprintHit | null {
    const pattern = /\b(?:10|20|30|40|50|60|70|80|90|100)%|\b(?:2|3|5|10)x\b/gi;
    const matches = markdown.match(pattern) ?? [];
    if (matches.length < 3) return null;
    return {
        id: "round_decade_statistics",
        label: "Round-decade statistics",
        count: matches.length,
        examples: matches.slice(0, 4),
        rationale:
            "Three or more round-decade percentages or 'NX' multipliers without named primary sources read as fabricated quantification — a known AI tell.",
    };
}

/**
 * Contraction density below 1.5% of word count. Native writers contract
 * frequently; LLM defaults produce uncontracted prose that reads stiff.
 */
function detectLowContractionDensity(markdown: string): FingerprintHit | null {
    const words = markdown.match(WORD_COUNT_RE) ?? [];
    const totalWords = words.length;
    if (totalWords < 300) return null;
    const contractions = markdown.match(/\b\w+'(?:s|re|ve|ll|d|m|t)\b/gi) ?? [];
    const density = (contractions.length / totalWords) * 100;
    if (density >= 1.5) return null;
    return {
        id: "low_contraction_density",
        label: "Low contraction density",
        count: Math.round(density * 100) / 100,
        examples: [`${contractions.length} contractions across ${totalWords} words (${density.toFixed(2)}%).`],
        rationale:
            "Native English writers contract at roughly 2-4% of words. Sub-1.5% density across a long article reads as deliberately formal — i.e. machine-default.",
    };
}

/**
 * Article makes a personal claim without ever using first-person pronouns.
 * AI tends to write in an authoritative third-person voice across the whole
 * piece even when the topic is opinion-driven. Personal pronouns inject
 * legitimate variance.
 */
function detectAbsenceOfFirstPerson(markdown: string): FingerprintHit | null {
    const wordTotal = (markdown.match(WORD_COUNT_RE) ?? []).length;
    if (wordTotal < 400) return null;
    const firstPersonMatches = markdown.match(/\b(?:I|I'm|I've|I'll|we|we're|we've|our|my|us)\b/gi) ?? [];
    if (firstPersonMatches.length >= 3) return null;
    return {
        id: "absence_of_first_person",
        label: "No first-person voice",
        count: firstPersonMatches.length,
        examples: [`Only ${firstPersonMatches.length} first-person pronouns in a ${wordTotal}-word article.`],
        rationale:
            "Long-form posts written without 'I', 'we', or 'our' read as omniscient narrator — a stylistic default of base models. A real operator's voice surfaces here.",
    };
}

/**
 * Five or more consecutive paragraphs within ±15% of the same word count.
 * Mirrors the sentence-length detector at paragraph granularity.
 */
function detectPerfectParagraphLengths(markdown: string): FingerprintHit | null {
    const lengths = proseParagraphs(markdown).map((p) => wordCount(p));
    if (lengths.length < 5) return null;
    let count = 0;
    const examples: string[] = [];
    for (let i = 0; i + 4 < lengths.length; i++) {
        const window = lengths.slice(i, i + 5);
        const avg = window.reduce((a, b) => a + b, 0) / window.length;
        if (avg < 30) continue;
        const within = window.every((n) => Math.abs(n - avg) / avg <= 0.15);
        if (within) {
            count += 1;
            if (examples.length < 2) {
                examples.push(`5 consecutive paragraphs of ~${Math.round(avg)} words each.`);
            }
        }
    }
    if (count === 0) return null;
    return {
        id: "perfect_paragraph_lengths",
        label: "Uniform paragraph lengths",
        count,
        examples,
        rationale:
            "Five+ paragraphs in a row of near-identical length is a chunked-generation signature. Real writers vary paragraph length deliberately — one-liner punches between longer passages.",
    };
}

/**
 * Title-cased coined concepts the article keeps capitalizing as proper nouns
 * ("System of Action", "Strategic Imperative", "Operational Excellence",
 * "Stealth CTO"). LLMs invent these to give the appearance of a defined
 * framework; real operators rarely capitalize their own concepts repeatedly
 * unless it's a branded product name.
 *
 * Heuristic: 2-5 consecutive words where every "real" word is capitalized,
 * appearing 3+ times in the article, ignoring the article title (H1) and
 * any heading lines.
 */
function detectTitleCasedConceptCoinage(markdown: string): FingerprintHit | null {
    // Strip headings so we don't false-positive on legitimate section titles.
    const body = markdown.replace(/^#{1,6}\s+.*$/gm, "");
    const phraseRegex = /\b([A-Z][a-z]+(?:\s+(?:of|the|for|a|an|to|in|on|by|with|and|or|nor)\s+|\s+)){1,4}[A-Z][a-z]+\b/g;
    const stopwordOnly = /^(?:[A-Z][a-z]+)$/;
    const counts = new Map<string, number>();
    let match: RegExpExecArray | null;
    while ((match = phraseRegex.exec(body)) !== null) {
        const phrase = match[0].trim();
        if (stopwordOnly.test(phrase)) continue;
        const words = phrase.split(/\s+/);
        if (words.length < 2 || words.length > 5) continue;
        // Skip common proper-noun runs (places, people, organizations) where
        // every word is capitalized but the phrase is real: e.g. "New York",
        // "United States". Cheap filter: skip if any word is a known geo /
        // org token. False negatives are OK; we'd rather miss a real coinage
        // than flag "European Union".
        const KNOWN_PROPER = /\b(?:New|United|North|South|East|West|Saint|Mount|Lake|Gulf|Bay)\b/;
        if (KNOWN_PROPER.test(phrase)) continue;
        counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
    }
    const offenders = Array.from(counts.entries())
        .filter(([, count]) => count >= 3)
        .sort((a, b) => b[1] - a[1]);
    if (offenders.length === 0) return null;
    return {
        id: "title_cased_concept_coinage",
        label: "Title-cased coined concepts",
        count: offenders.reduce((sum, [, c]) => sum + c, 0),
        examples: offenders.slice(0, 4).map(([phrase, c]) => `"${phrase}" appears ${c} times`),
        rationale:
            "Phrases like 'System of Action' or 'Strategic Imperative' capitalized as proper nouns 3+ times signal an LLM constructing a faux-framework. Lowercase them or rename to concrete actions the reader can take.",
    };
}

const CORPORATE_BUZZWORDS: ReadonlyArray<{ word: string; reason: string }> = [
    { word: "imperative", reason: "AI fills this slot when it needs a noun that sounds important" },
    { word: "tangible", reason: "near-meaningless filler adjective" },
    { word: "democratiz(?:e|ed|ing|ation)", reason: "tech-marketing cliché" },
    { word: "actionable", reason: "buzzword for 'usable'; replace with the actual action" },
    { word: "holistic", reason: "consultancy filler" },
    { word: "synerg(?:y|ies|istic)", reason: "buzzword bingo entry" },
    { word: "leverage(?:s|d|ing)?", reason: "use 'use' or name the actual mechanism" },
    { word: "paradigm", reason: "academic-sounding filler" },
    { word: "robust", reason: "LLM default for 'works'" },
    { word: "scalable", reason: "rarely true at the time of writing" },
    { word: "intersection of", reason: "cliché framing for combining two things" },
    { word: "ecosystem", reason: "tech-marketing cliché" },
    { word: "operational excellence", reason: "consultancy boilerplate" },
    { word: "operational imperative", reason: "consultancy boilerplate" },
    { word: "strategic imperative", reason: "consultancy boilerplate" },
    { word: "competitive advantage", reason: "MBA boilerplate; specify how the advantage is realized" },
    { word: "best-in-class", reason: "marketing copy default" },
    { word: "next-generation", reason: "marketing copy default" },
    { word: "transformative", reason: "vague hyperbole" },
    { word: "groundbreaking", reason: "vague hyperbole" },
];

function detectCorporateBuzzwordVocabulary(markdown: string): FingerprintHit | null {
    const body = markdown.replace(/^#{1,6}\s+.*$/gm, "");
    const hits: Array<{ word: string; reason: string; count: number }> = [];
    for (const { word, reason } of CORPORATE_BUZZWORDS) {
        const re = new RegExp(`\\b${word}\\b`, "gi");
        const matches = body.match(re);
        if (matches && matches.length > 0) {
            hits.push({ word: word.replace(/[\\()?:|]+/g, "").replace(/[-_]/g, "-"), reason, count: matches.length });
        }
    }
    if (hits.length === 0) return null;
    const total = hits.reduce((sum, h) => sum + h.count, 0);
    if (total < 3) return null;
    hits.sort((a, b) => b.count - a.count);
    return {
        id: "corporate_buzzword_vocabulary",
        label: "Corporate buzzword vocabulary",
        count: total,
        examples: hits.slice(0, 5).map((h) => `${h.word} (×${h.count})`),
        rationale:
            "Three or more matches across the corporate-buzzword set (imperative, tangible, democratized, actionable, holistic, synergy, robust, scalable, ecosystem, intersection of, transformative…) is the most reliable AI-content tell to a human reader. Replace each with a concrete claim.",
    };
}

/**
 * Detect paragraphs whose entire purpose is to narrate an embedded visual —
 * "This flowchart illustrates...", "The diagram below shows...", "As you can
 * see in the chart...". This pattern is a dead giveaway when an LLM is
 * asked to include visual placeholders and writes around them.
 */
function detectVisualDescriptionLeak(markdown: string): FingerprintHit | null {
    const pattern = /^(?:this|the)\s+(?:flowchart|diagram|chart|graph|infographic|visual|illustration|image)\s+(?:above|below|here)?\s*(?:illustrates|shows|depicts|demonstrates|highlights|outlines|maps|visualizes|presents)/i;
    const sideRef = /^(?:as (?:you can see|shown) in the (?:flowchart|diagram|chart|graph|visual|image))/i;
    const fragmentTransitions = /^(?:next:|then:|finally:|step \d+:)/i;
    const examples: string[] = [];
    let count = 0;
    for (const para of proseParagraphs(markdown)) {
        const trimmed = para.trim();
        if (pattern.test(trimmed) || sideRef.test(trimmed) || fragmentTransitions.test(trimmed)) {
            count += 1;
            if (examples.length < 4) examples.push(trimmed.slice(0, 200));
        }
    }
    if (count === 0) return null;
    return {
        id: "visual_description_leak",
        label: "Visual description scaffolding",
        count,
        examples,
        rationale:
            "Paragraphs that narrate an embedded visual ('This flowchart illustrates...', 'Next: Provides Data...') are scaffolding artifacts from the generator prompt. Real writers let the visual speak; if context is needed, it's woven into the surrounding prose, not stated as a caption.",
    };
}

/**
 * Formulaic stat introductions: "According to [Firm]", "Research from [Firm]",
 * "A study by [Firm] indicates", "[Firm] research shows". LLMs reach for
 * these constructions when synthesizing third-party data. Human writers
 * usually weave the source into the claim itself.
 */
function detectFormulaicStatIntro(markdown: string): FingerprintHit | null {
    const patterns = [
        /\baccording to (?:gartner|mckinsey|bain|forrester|deloitte|pwc|kpmg|accenture|zapier|harvard|mit|stanford|forbes|the world economic forum|wef)\b/gi,
        /\b(?:research|a study|findings) (?:from|by) (?:gartner|mckinsey|bain|forrester|deloitte|pwc|kpmg|accenture|zapier|harvard|mit|stanford|forbes)\b/gi,
        /\bseveral (?:converging |emerging )?trends (?:make|suggest|indicate|point to)\b/gi,
        /\ba recent (?:report|study|survey) (?:from|by)\b/gi,
    ];
    const examples: string[] = [];
    let count = 0;
    for (const re of patterns) {
        let match: RegExpExecArray | null;
        while ((match = re.exec(markdown)) !== null) {
            count += 1;
            if (examples.length < 4) examples.push(match[0]);
        }
    }
    if (count === 0) return null;
    return {
        id: "formulaic_stat_intro",
        label: "Formulaic stat introductions",
        count,
        examples,
        rationale:
            "Phrases like 'According to Gartner…' and 'Several converging trends make…' are LLM scaffolding for synthesized research. Weave the source into the claim itself ('Gartner's 2024 forecast pegs X at Y') or drop the citation and use a specific scenario instead.",
    };
}

/**
 * "Not just X, but Y" / "Not only X, but also Y" templates. The existing
 * humanize rule covers "not X, it's Y"; this catches the affirmative
 * variant the model uses when trying to sound balanced.
 */
function detectNotJustButTemplate(markdown: string): FingerprintHit | null {
    const patterns = [
        /\bnot just\s+\w+(?:\s+\w+){0,6},\s*but\s+(?:also\s+)?\w+/gi,
        /\bnot only\s+\w+(?:\s+\w+){0,6},\s*but\s+(?:also\s+)?\w+/gi,
        /\bnot merely\s+\w+(?:\s+\w+){0,6},\s*but\s+\w+/gi,
    ];
    const examples: string[] = [];
    let count = 0;
    for (const re of patterns) {
        let match: RegExpExecArray | null;
        while ((match = re.exec(markdown)) !== null) {
            count += 1;
            if (examples.length < 4) examples.push(match[0]);
        }
    }
    if (count === 0) return null;
    return {
        id: "not_just_but_template",
        label: "'Not just X, but Y' template",
        count,
        examples,
        rationale:
            "'Not just X, but Y' / 'Not only X, but also Y' is sibling boilerplate to 'isn't X, it's Y'. Pick the stronger claim and lead with it directly; cut the contrast frame.",
    };
}

/**
 * Common subject-verb agreement slips that AI generation introduces under
 * length pressure (the reviewer flagged "businesses today is drowning"
 * exactly). High-precision heuristic — only catches plural collective nouns
 * paired with singular verbs across short distances.
 */
function detectSubjectVerbAgreementSlip(markdown: string): FingerprintHit | null {
    const PLURAL_NOUNS = "(?:businesses|companies|teams|operators|leaders|founders|organizations|firms|enterprises|customers|users|clients|partners|employees|managers|practitioners|stakeholders|systems|processes|workflows|tools|platforms|industries|markets|sectors)";
    const SINGULAR_VERBS = "(?:is|was|has been|requires|needs|expects|wants|delivers|ships)";
    const re = new RegExp(`\\b${PLURAL_NOUNS}\\s+(?:today|now|currently)?\\s*${SINGULAR_VERBS}\\b`, "gi");
    const examples: string[] = [];
    let count = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(markdown)) !== null) {
        count += 1;
        if (examples.length < 4) examples.push(match[0]);
    }
    if (count === 0) return null;
    return {
        id: "subject_verb_agreement_slip",
        label: "Subject-verb agreement slip",
        count,
        examples,
        rationale:
            "Plural collective noun paired with a singular verb ('businesses today is drowning'). AI generation drops agreement under length pressure; human readers and grammar checkers both flag this.",
    };
}

/**
 * Two or more rhetorical questions stacked in the same paragraph or two
 * consecutive paragraphs. Common opening trick in AI writing.
 */
function detectStackedRhetoricalQuestions(markdown: string): FingerprintHit | null {
    const paras = proseParagraphs(markdown);
    const examples: string[] = [];
    let count = 0;
    for (let i = 0; i < paras.length; i++) {
        const here = (paras[i].match(/\?/g) ?? []).length;
        const next = i + 1 < paras.length ? (paras[i + 1].match(/\?/g) ?? []).length : 0;
        if (here >= 2 || (here >= 1 && next >= 1)) {
            count += 1;
            if (examples.length < 2) examples.push(paras[i].slice(0, 200));
        }
    }
    if (count === 0) return null;
    return {
        id: "stacked_rhetorical_questions",
        label: "Stacked rhetorical questions",
        count,
        examples,
        rationale:
            "Multiple rhetorical questions in the same passage signal a manufactured engagement hook. Real prose asks one question at most, then commits to an answer.",
    };
}

// ────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────

export function detectAiFingerprints(markdown: string): FingerprintHit[] {
    if (!markdown || typeof markdown !== "string") return [];
    const detectors = [
        detectUniformSentenceLength,
        detectParallelParagraphOpeners,
        detectExpletiveConstruction,
        detectBalancedContrastPair,
        detectRoundDecadeStatistics,
        detectLowContractionDensity,
        detectAbsenceOfFirstPerson,
        detectPerfectParagraphLengths,
        detectStackedRhetoricalQuestions,
        detectTitleCasedConceptCoinage,
        detectCorporateBuzzwordVocabulary,
        detectVisualDescriptionLeak,
        detectFormulaicStatIntro,
        detectNotJustButTemplate,
        detectSubjectVerbAgreementSlip,
    ];
    return detectors
        .map((d) => d(markdown))
        .filter((hit): hit is FingerprintHit => hit !== null)
        .sort((a, b) => b.count - a.count);
}

export interface BuildPromptOptions {
    /** Locale-aware system instructions block to prepend. */
    localePrompt: string;
    /** Active workspace business context. */
    workspaceContext: string;
    /** Per-workspace rules block (HUMAN_VOICE_RULES is appended downstream). */
    extraVoiceRules?: string;
}

export function buildHumanizeRewritePrompt(
    markdown: string,
    fingerprints: FingerprintHit[],
    options: BuildPromptOptions,
): { system: string; prompt: string } {
    const fingerprintBlock = fingerprints.length === 0
        ? "No specific fingerprints flagged by the static scan — focus on rhythm and voice variance generally."
        : fingerprints
            .map((hit, idx) => {
                const exampleList = hit.examples
                    .map((ex, j) => `      ${j + 1}. ${ex.replace(/\s+/g, " ").trim()}`)
                    .join("\n");
                return `${idx + 1}. ${hit.label} (severity: ${hit.count} occurrence${hit.count === 1 ? "" : "s"})
   Why detectors flag this: ${hit.rationale}
   Examples from the draft:
${exampleList}`;
            })
            .join("\n\n");

    const system = `${options.workspaceContext}

${options.localePrompt}

You are a senior editor doing a targeted humanization pass on an already-drafted blog article. Your goal is to make the prose unmistakably human-written without changing what it says.

HARD CONSTRAINTS — VIOLATIONS WILL CAUSE THE EDIT TO BE REJECTED:
- Preserve every markdown heading (H1/H2/H3) verbatim, including exact wording and hierarchy.
- Preserve every link target (URL inside parentheses) verbatim.
- Preserve every bullet/numbered list structure (you may rewrite the prose inside a bullet, but do not add or remove bullets).
- Preserve every fenced code block verbatim.
- Preserve every visual shortcode of the form [Visual: ...], [Chart: ...], [Image: ...], or similar bracketed directives — do not edit, move, or remove them.
- Preserve every named fact, number, year, quote, person, and organization. Do not invent new ones. Do not delete any.
- Preserve the article's argument and conclusions. You are editing voice and rhythm only.
- Output length must be within 90-110% of the input length. Do not aggressively shorten.

OUTPUT FORMAT:
- Return ONLY the rewritten markdown. No preamble, no commentary, no "Here is your revised article". Start at the first character of the article.
${options.extraVoiceRules ? `\n${options.extraVoiceRules}` : ""}`;

    const prompt = `STATIC SCAN OF THE DRAFT FOUND THESE AI-DETECTION FINGERPRINTS:

${fingerprintBlock}

REWRITE INSTRUCTIONS — REPLACE THE PATTERNS ABOVE, NOT THE FACTS:

Rhythm & structure
- Break uniform sentence rhythm. In any passage with three+ sentences of similar word count, recast one as a 4-7 word punch and merge two others into a longer comma-spliced sentence. Variance, not perfection.
- Where consecutive paragraphs share an opening word, rewrite at least one to lead with a different part of speech (an action, a direct claim, a named subject, a scene-setting clause).
- Vary paragraph length deliberately: at least one paragraph under 25 words and at least one over 80 words.

Voice
- Inject contractions where the prose is stilted: it's, you're, we're, that's, don't, won't, can't, didn't, isn't. Aim for roughly one contraction every 40-60 words on average.
- If the article is opinion-shaped but written in pure third person, add 2-3 first-person interjections where the writer would naturally show their hand ("In my experience", "We've found", "I'd argue", "Our read is").

Template surgery
- Replace expletive constructions ("There is X that…", "It is Y that…") with a direct subject-verb form. "There are three things that drive…" → "Three things drive…".
- Rewrite symmetric contrast templates ("less X, more Y", "from X to Y", "beyond X lies Y") into asymmetric claims that take a position.
- BAN "not just X, but Y", "not only X, but also Y", "not merely X, but Y". Lead with the stronger half as a direct claim and cut the contrast frame.
- If multiple rhetorical questions are stacked, keep the strongest one and convert the others into direct claims.

Vocabulary purge (do not preserve these phrasings)
- Replace these corporate buzzwords with concrete operator language wherever they appear: operational imperative, strategic imperative, competitive advantage, transformative, groundbreaking, robust, scalable, holistic, actionable, paradigm, leverage, synergy, ecosystem, intersection of, tangible, democratize / democratization, best-in-class, next-generation, operational excellence. Rule of thumb: if a word could appear in a McKinsey deck, replace it with what the team would actually say in Slack.
- Do NOT capitalize coined concepts as proper nouns ("System of Action", "Strategic Imperative", "Operational Excellence"). Either lowercase them, or rename to the concrete behavior they describe ("the dispatch routing layer", "the audit log we ship with every deploy").

Stat hygiene
- If round-decade statistics ("80%", "30%", "3x") appear without a named primary source, either delete the number and describe the trend qualitatively, or anchor it with a specific scenario.
- BAN formulaic stat introductions like "According to Gartner…", "Research from McKinsey shows…", "Several converging trends make…". Weave the source into the claim itself ("Gartner's 2024 forecast pegs invoice errors at 14% of AP volume — which is roughly what we see in the wild") OR drop the citation and describe what you have actually observed.

Visual / diagram references
- DELETE paragraphs whose only purpose is to narrate an embedded visual ("This flowchart illustrates…", "The diagram below shows…", "Next: Provides Data…", "Step 1:…"). Visual shortcodes like [Visual: …] are preserved verbatim, but any caption-style prose surrounding them must be cut. If contextual setup is genuinely needed, weave one sentence into the surrounding argument.

Grammar
- Fix subject-verb agreement when a plural collective noun is paired with a singular verb ("businesses today is drowning" → "businesses today are drowning"). Make agreement match across the whole sentence.

DRAFT TO REWRITE:

---
${markdown}
---`;

    return { system, prompt };
}
