export type FreshnessRisk = "evergreen" | "recent" | "breaking";

const AI_VENDORS = [
    "openai", "anthropic", "google", "meta", "xai", "mistral", "deepseek",
    "cohere", "nvidia", "microsoft", "apple", "amazon", "huggingface",
];

const FRESHNESS_TRIGGER_PATTERNS = [
    /\b(gpt|claude|gemini|llama|mistral|grok|deepseek|qwen|phi|falcon|bloom)\b/i,
    /\b(o1|o3|o4|o\d[\w-]*)\b/,
    /\bv\d+(\.\d+)*\b/,
    /\b(release|launch|launched|released|announced|announcement|unveil|debut)\b/i,
    /\b(new|latest|upcoming|update|upgrade|next.gen|next.generation)\b/i,
    /\b(benchmark|leaderboard|mmlu|humaneval|arena|elo)\b/i,
    /\b(2024|2025|2026)\b/,
    /\b(preview|beta|early access|ga|general availability)\b/i,
    /\b(model|api|sdk|framework)\s+v?\d/i,
];

const BREAKING_TRIGGER_PATTERNS = [
    /\bjust\s+(released|launched|announced|dropped)\b/i,
    /\bbreaking\b/i,
    /\btoday\b/i,
    /\bthis\s+(week|month)\b/i,
];

export function classifyTopicFreshnessRisk(title: string, keywords: string[]): FreshnessRisk {
    const haystack = [title, ...keywords].join(" ").toLowerCase();

    const isBreaking = BREAKING_TRIGGER_PATTERNS.some(p => p.test(haystack));
    if (isBreaking) return "breaking";

    const hasVendor = AI_VENDORS.some(v => haystack.includes(v));
    const hasFreshnessTrigger = FRESHNESS_TRIGGER_PATTERNS.some(p => p.test(haystack));

    if (hasVendor || hasFreshnessTrigger) return "recent";

    return "evergreen";
}
