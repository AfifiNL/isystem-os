// Shared token-overlap utilities for SEO scorers.
//
// Used by both Loop C (claim-coverage → find the paragraph that best matches
// a claim) and Loop A Wave 1 (internal-link ranker → find inventory items
// that are topically on-theme with the current article). Keeping both on the
// same tokenization rules prevents subtle drift where "the same text would
// score differently depending on which scorer sees it."
//
// The scorer is deliberately cheap: filtered word tokens + Jaccard. This
// is not an embedding. It catches topical overlap well enough to beat pure
// substring matching against random inventory items.

// Minimum overlap for a candidate to be considered on-topic against an
// article. Keep conservative — a lower value lets too many off-topic pages
// slip through; a higher value drops near-misses that are still valid links.
export const MIN_TOPIC_JACCARD = 0.02;

type SupportedLocale = "en" | "nl" | "ar";

// English stopwords — high-frequency function words that pollute Jaccard.
const STOPWORDS_EN = new Set([
    "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "at",
    "for", "with", "by", "is", "are", "was", "were", "be", "been", "being",
    "it", "its", "this", "that", "these", "those", "as", "from", "has",
    "have", "had", "will", "would", "can", "could", "should", "may", "might",
    "not", "no", "so", "also", "than", "then", "when", "while",
]);

// Dutch stopwords. Without these, NL articles score artificially high on
// every other NL article because every paragraph repeats "de/het/een/van".
const STOPWORDS_NL = new Set([
    "de", "het", "een", "en", "van", "voor", "met", "dat", "die", "deze",
    "dit", "wij", "ons", "onze", "jullie", "hun", "hen", "zij", "hij", "zij",
    "haar", "zijn", "is", "was", "waren", "ben", "bent", "wordt", "worden",
    "werd", "werden", "kan", "kunnen", "kon", "konden", "moet", "moeten",
    "moest", "moesten", "mag", "mogen", "mocht", "mochten", "wil", "willen",
    "wou", "wilde", "wilden", "zou", "zouden", "zal", "zullen", "heeft",
    "hebben", "had", "hadden", "doet", "doen", "deed", "deden", "ook", "maar",
    "dan", "als", "dus", "want", "omdat", "terwijl", "tijdens", "naar", "bij",
    "uit", "tot", "over", "onder", "boven", "achter", "voor", "tegen", "door",
    "tussen", "binnen", "buiten", "om", "te", "er", "niet", "geen", "wel",
    "nog", "al", "alle", "alles", "iets", "niets", "andere", "anders", "zelf",
    "veel", "weinig", "meer", "minder", "meest", "minst", "zo", "heel", "erg",
    "echt", "alleen", "samen", "ook", "vaak", "altijd", "soms", "nooit",
    "nu", "toen", "straks", "later", "morgen", "gisteren", "vandaag",
]);

// Arabic stopwords — high-frequency particles, prepositions, and pronouns
// from Modern Standard Arabic. Includes alif-lam definite article variants.
const STOPWORDS_AR = new Set([
    "في", "من", "إلى", "على", "عن", "مع", "هذا", "هذه", "ذلك", "تلك",
    "هؤلاء", "أولئك", "هو", "هي", "هم", "هن", "أنت", "أنتم", "أنتن", "أنا",
    "نحن", "كان", "كانت", "كانوا", "يكون", "تكون", "كل", "بعض", "أي", "أين",
    "كيف", "متى", "لماذا", "ماذا", "ما", "لا", "لم", "لن", "ليس", "ليست",
    "إن", "أن", "إذا", "إذ", "حيث", "حين", "بين", "تحت", "فوق", "أمام", "خلف",
    "قد", "قبل", "بعد", "أيضا", "أيضًا", "كذلك", "لكن", "لكنه", "لكنها", "بل",
    "أو", "ثم", "حتى", "لقد", "لدي", "لديه", "لديها", "عند", "عندما", "ضد",
    "إلى أن", "كما", "مثل", "نفس", "نفسه", "نفسها", "كي", "لكي", "لـ", "بـ",
    "وفي", "ومن", "وعن", "وعلى", "وإلى", "ومع", "وقد", "ولا", "ولم", "ولن",
    "والتي", "الذي", "التي", "الذين", "اللاتي", "اللواتي",
]);

const STOPWORDS_BY_LOCALE: Record<SupportedLocale, Set<string>> = {
    en: STOPWORDS_EN,
    nl: STOPWORDS_NL,
    ar: STOPWORDS_AR,
};

// Token regex: any letter (any script) followed by letters/digits/marks.
// Unicode property escapes (\p{L}, \p{N}, \p{M}) match Latin-with-diacritics
// (Dutch ë/ï), Arabic letters and harakat, CJK, etc. The `u` flag is required.
//
// Length policy: Latin scripts use a 3-character minimum (legacy behaviour
// kept stopwords like "to/an" out cleanly); Arabic and CJK get a 2-character
// minimum because meaningful Arabic words are routinely 2 letters (e.g. "ذكاء"
// is 4 but "نمو" is 3 — and many MSA roots are exactly 3 characters but the
// regex's `+` already handles that). The split keeps Arabic content scorable
// without flooding the Latin path with two-letter noise like "to/of".
const TOKEN_REGEX = /\p{L}[\p{L}\p{N}\p{M}]+/gu;

function isArabicScriptToken(token: string): boolean {
    // U+0600..U+06FF is the Arabic block; U+0750..U+077F is Arabic Supplement;
    // U+08A0..U+08FF is Arabic Extended-A. Cheap inclusion check on the first
    // character is sufficient — tokens are single-script in practice.
    const code = token.charCodeAt(0);
    return (code >= 0x0600 && code <= 0x06FF)
        || (code >= 0x0750 && code <= 0x077F)
        || (code >= 0x08A0 && code <= 0x08FF);
}

/**
 * Lowercase, strip punctuation, drop short tokens and locale-appropriate
 * stopwords. Returns a Set so downstream scorers can intersect cheaply.
 *
 * `locale` selects which stopword list to apply. When omitted, both the
 * English and the Dutch lists are unioned — safe default for mixed content
 * but slightly less precise than passing the actual locale.
 */
export function tokenizeForOverlap(text: string, locale?: SupportedLocale | string | null): Set<string> {
    const normalized = text.toLocaleLowerCase();
    const matches = normalized.match(TOKEN_REGEX) ?? [];

    const stopwords = pickStopwords(locale);

    const out = new Set<string>();
    for (const token of matches) {
        const minLen = isArabicScriptToken(token) ? 2 : 3;
        if (token.length < minLen) continue;
        if (stopwords.has(token)) continue;
        out.add(token);
    }
    return out;
}

function pickStopwords(locale?: SupportedLocale | string | null): Set<string> {
    if (locale === "en" || locale === "nl" || locale === "ar") {
        return STOPWORDS_BY_LOCALE[locale];
    }
    // Default: union of EN+NL so mixed/unknown content still filters common
    // function words from either side without accidentally over-pruning AR.
    const merged = new Set<string>();
    for (const w of STOPWORDS_EN) merged.add(w);
    for (const w of STOPWORDS_NL) merged.add(w);
    return merged;
}

/**
 * Jaccard similarity over two pre-tokenized sets. Returns a value in [0, 1].
 * Accepts Set<string> rather than raw text so callers can tokenize the
 * article body once and reuse it across many candidates.
 */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0;
    let intersection = 0;
    // Iterate over the smaller set for the cheapest intersection walk.
    const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
    for (const token of smaller) {
        if (larger.has(token)) intersection += 1;
    }
    const union = a.size + b.size - intersection;
    return union > 0 ? intersection / union : 0;
}
