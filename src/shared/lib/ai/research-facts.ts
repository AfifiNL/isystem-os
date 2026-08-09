import { tavilyCountryForLocale, tavilySearch, tavilyExtract, TavilySearchResult } from "@/shared/lib/ai/tavily";
import { FreshnessRisk } from "@/shared/lib/ai/freshness";

export type TopicStatus = "released" | "announced" | "preview" | "rumored" | "deprecated" | "unclear";

export interface CanonicalFactSheet {
    topic: string;
    checked_at: string;
    freshness_risk: FreshnessRisk;
    status: TopicStatus;
    release_date: string | null;
    official_source_url: string | null;
    secondary_sources: string[];
    key_claims: string[];
    uncertainties: string[];
    forbidden_phrases: string[];
    verification_notes: string;
    query_rewrites: string[];
    retrieval_mode: "tavily" | "none";
    sources: RankedSource[];
}

export interface RankedSource {
    url: string;
    title: string;
    snippet: string;
    score: number;
    trust_tier: number;
    published_date?: string;
}

const LOWER_AUTHORITY_DOMAINS = [
    "medium.com",
    "substack.com",
    "towardsdatascience.com",
    "dev.to",
    "hashnode.dev",
    "wikipedia.org",
    "linkedin.com",
    "youtube.com",
    "reddit.com",
    "quora.com",
];

function normalizeHost(value: string): string {
    try {
        return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
        return value.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
    }
}

function hostMatchesDomain(host: string, domain: string): boolean {
    const normalizedDomain = normalizeHost(domain);
    return host === normalizedDomain || host.endsWith(`.${normalizedDomain}`);
}

// ── Source trust scoring ────────────────────────────────────────────────────

const OFFICIAL_DOCS_DOMAINS = [
    "docs.anthropic.com", "platform.openai.com", "ai.google.dev",
    "docs.mistral.ai", "docs.cohere.com", "deepseek.com/docs",
    "digital-strategy.ec.europa.eu", "commission.europa.eu", "europa.eu",
    "cisco.com", "newsroom.cisco.com", "nist.gov", "oecd.org", "eurostat.ec.europa.eu",
];
const VENDOR_BLOG_DOMAINS = [
    "openai.com/blog", "openai.com/index",
    "anthropic.com/news", "anthropic.com/research",
    "blog.google", "deepmind.google",
    "ai.meta.com", "llama.meta.com",
    "mistral.ai/news", "mistral.ai/blog",
    "deepseek.ai", "deepseek.com",
    "x.ai", "grok.com",
    "nvidia.com/blog",
    "research.microsoft.com",
    "ibm.com", "microsoft.com", "gartner.com/en/newsroom", "mckinsey.com/capabilities",
];
const REPUTABLE_TECH_DOMAINS = [
    "techcrunch.com", "theverge.com", "wired.com", "arstechnica.com",
    "venturebeat.com", "zdnet.com", "towardsdatascience.com", "huggingface.co",
    "semafor.com", "reuters.com", "bloomberg.com",
    "infosecurity-magazine.com", "hbr.org", "mitsloan.mit.edu",
];
const BENCHMARK_DOMAINS = ["lmsys.org", "paperswithcode.com", "arxiv.org", "scale.com", "gartner.com", "mckinsey.com", "forrester.com"];

function sourceTrustTier(url: string): number {
    const host = normalizeHost(url);
    if (OFFICIAL_DOCS_DOMAINS.some(d => hostMatchesDomain(host, d))) return 5;
    if (VENDOR_BLOG_DOMAINS.some(d => url.includes(d))) return 4;
    if (REPUTABLE_TECH_DOMAINS.some(d => hostMatchesDomain(host, d))) return 3;
    if (BENCHMARK_DOMAINS.some(d => hostMatchesDomain(host, d))) return 2;
    if (LOWER_AUTHORITY_DOMAINS.some(d => hostMatchesDomain(host, d))) return 0;
    return 1;
}

// ── Entity → official domains map ─────────────────────────────────────────

const ENTITY_DOMAINS: Record<string, string[]> = {
    openai: ["openai.com"],
    chatgpt: ["openai.com"],
    "gpt-4": ["openai.com"],
    "gpt-5": ["openai.com"],
    "o1": ["openai.com"],
    "o3": ["openai.com"],
    "o4": ["openai.com"],
    anthropic: ["anthropic.com"],
    claude: ["anthropic.com"],
    google: ["blog.google", "ai.google.dev", "deepmind.google"],
    gemini: ["blog.google", "ai.google.dev"],
    deepmind: ["deepmind.google"],
    meta: ["ai.meta.com", "llama.meta.com"],
    llama: ["ai.meta.com", "llama.meta.com"],
    mistral: ["mistral.ai"],
    deepseek: ["deepseek.com", "deepseek.ai"],
    xai: ["x.ai"],
    grok: ["x.ai", "grok.com"],
    nvidia: ["nvidia.com"],
    microsoft: ["microsoft.com", "azure.microsoft.com"],
    cohere: ["cohere.com"],
    huggingface: ["huggingface.co"],
    cisco: ["cisco.com", "newsroom.cisco.com"],
    gartner: ["gartner.com"],
    mckinsey: ["mckinsey.com"],
    ibm: ["ibm.com"],
    "eu ai act": ["digital-strategy.ec.europa.eu", "commission.europa.eu"],
    "ai act": ["digital-strategy.ec.europa.eu", "commission.europa.eu"],
};

function detectOfficialDomains(title: string, keywords: string[]): string[] {
    const haystack = [title, ...keywords].join(" ").toLowerCase();
    const domains = new Set<string>();

    for (const [entity, entityDomains] of Object.entries(ENTITY_DOMAINS)) {
        if (haystack.includes(entity)) {
            entityDomains.forEach(d => domains.add(d));
        }
    }

    return Array.from(domains);
}

// ── Query rewriting ─────────────────────────────────────────────────────────

export function rewriteResearchQueries(title: string, keywords: string[]): string[] {
    const base = [title, ...keywords].join(" ").trim();
    return [
        base,
        `${title} primary source official report`,
        `${title} site:europa.eu OR site:cisco.com OR site:mckinsey.com OR site:gartner.com OR site:ibm.com`,
        `${title} official release announcement`,
        `${title} release date documentation`,
        `${keywords[0] ?? title} launch confirmed`,
    ];
}

// ── Hybrid evidence ranking ─────────────────────────────────────────────────

export function rankEvidenceHybrid(results: TavilySearchResult[], topic: string): RankedSource[] {
    const topicLower = topic.toLowerCase();
    const strongestTier = Math.max(0, ...results.map((result) => sourceTrustTier(result.url)));

    return results
        .map(r => {
            const tier = sourceTrustTier(r.url);
            const primarySourcePenalty = strongestTier >= 4 && tier <= 2 ? 1.25 : 0;
            const entityMatch = topicLower.split(" ").filter(w => w.length > 3).some(w =>
                r.title.toLowerCase().includes(w) || r.content.toLowerCase().includes(w)
            ) ? 1 : 0;

            let recencyBoost = 0;
            if (r.published_date) {
                const daysAgo = (Date.now() - new Date(r.published_date).getTime()) / 86_400_000;
                recencyBoost = daysAgo < 30 ? 0.3 : daysAgo < 90 ? 0.15 : 0;
            }

            const compositeScore = tier * 0.58 + r.score * 0.22 + entityMatch * 0.15 + recencyBoost * 0.05 - primarySourcePenalty;

            return {
                url: r.url,
                title: r.title,
                snippet: r.content.substring(0, 400),
                score: compositeScore,
                trust_tier: tier,
                published_date: r.published_date,
            };
        })
        .sort((a, b) => b.score - a.score);
}

// ── Status detection ────────────────────────────────────────────────────────

function inferTopicStatus(snippets: string[]): { status: TopicStatus; release_date: string | null } {
    const text = snippets.join(" ").toLowerCase();

    const releasedPatterns = [
        /is\s+(now\s+)?available/,
        /has\s+(been\s+)?released/,
        /launched\s+(on|in|today)/,
        /released\s+(on|in|today)/,
        /now\s+(available|live|out)/,
        /generally\s+available/,
        /\bga\b/,
    ];
    const announcedPatterns = [/announced|announcing|will\s+(be\s+)?available|coming\s+(soon|in|to)/];
    const previewPatterns = [/preview|beta|early\s+access|limited\s+access/];

    if (releasedPatterns.some(p => p.test(text))) {
        const dateMatch = text.match(/(?:released?|launched?|available)\s+(?:on\s+)?([a-z]+ \d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/i);
        return { status: "released", release_date: dateMatch?.[1] ?? null };
    }
    if (previewPatterns.some(p => p.test(text))) return { status: "preview", release_date: null };
    if (announcedPatterns.some(p => p.test(text))) return { status: "announced", release_date: null };

    return { status: "unclear", release_date: null };
}

// ── Canonical fact extraction ───────────────────────────────────────────────

function extractCanonicalFacts(sources: RankedSource[], topic: string, freshness_risk: FreshnessRisk): Omit<CanonicalFactSheet, "topic" | "checked_at" | "freshness_risk" | "query_rewrites" | "retrieval_mode" | "sources"> {
    void freshness_risk;
    const topSnippets = sources.slice(0, 5).map(s => s.snippet);
    const { status, release_date } = inferTopicStatus(topSnippets);

    const official = sources.find(s => s.trust_tier >= 4);
    const minSecondaryTier = official ? 3 : 2;
    const secondary = sources.filter(s => s !== official && s.trust_tier >= minSecondaryTier).slice(0, 3).map(s => s.url);

    const forbidden_phrases = status === "released"
        ? [
            "highly anticipated",
            "expected to launch",
            "upcoming release",
            "rumored to arrive",
            "set to launch",
            "will be released",
            "yet to be released",
            "eagerly awaited",
            "slated for release",
        ]
        : [];

    const key_claims = sources
        .slice(0, 3)
        .map(s => s.snippet.split(". ").find(sent => sent.toLowerCase().includes(topic.toLowerCase().split(" ")[0])) ?? "")
        .filter(Boolean);

    const uncertainties = status === "unclear" ? ["Release status could not be verified from available sources."] : [];

    const verification_notes = [
        `Status determined from ${sources.length} sources.`,
        official ? `Primary source: ${official.url}` : "No official source found.",
        status === "released" && release_date ? `Release date: ${release_date}` : "",
    ].filter(Boolean).join(" ");

    return {
        status,
        release_date,
        official_source_url: official?.url ?? null,
        secondary_sources: secondary,
        key_claims,
        uncertainties,
        forbidden_phrases,
        verification_notes,
    };
}

// ── Main pipeline entry ─────────────────────────────────────────────────────

export async function buildFactSheet(
    title: string,
    keywords: string[],
    freshness_risk: FreshnessRisk,
    locale?: string | null,
): Promise<CanonicalFactSheet> {
    const queries = rewriteResearchQueries(title, keywords);
    const officialDomains = detectOfficialDomains(title, keywords);
    // Country bias by content locale. The official-domain pass intentionally
    // skips it — official vendor domains (anthropic.com, openai.com, etc.)
    // are global and forcing a country bias would knock them out of the result
    // set. The news + fallback passes do bias by country so non-EN draft
    // research surfaces native-language coverage instead of US-press-only.
    const country = tavilyCountryForLocale(locale);

    // Authority-first: run official-source search and news search in parallel.
    // Official domains are biased toward tier-4/5 sources; news fills the gap.
    const [authorityPass, newsPass] = await Promise.all([
        tavilySearch({
            query: `${title} official release announcement documentation`,
            search_depth: "basic",
            topic: "general",
            ...(officialDomains.length > 0 ? { include_domains: officialDomains } : {}),
            max_results: 6,
        }),
        tavilySearch({
            query: queries[0],
            search_depth: "basic",
            topic: "news",
            time_range: "month",
            max_results: 6,
            country,
        }),
    ]);

    const allResults: TavilySearchResult[] = [...authorityPass.results, ...newsPass.results];

    // If no authoritative sources surfaced, do a targeted fallback with the release-focused query
    const topTier = allResults.filter(r => sourceTrustTier(r.url) >= 3);
    if (topTier.length < 2 && queries[1]) {
        const fallback = await tavilySearch({
            query: queries[1],
            search_depth: "advanced",
            topic: "general",
            max_results: 5,
            country,
        });
        allResults.push(...fallback.results);
    }

    const deduped = Array.from(new Map(allResults.map(r => [r.url, r])).values());
    let ranked = rankEvidenceHybrid(deduped, title);

    // Deep extraction pass: run when no official/vendor source landed, or topic is breaking.
    // Replaces short search snippets with full page content for more reliable status inference.
    const hasOfficialSource = ranked.some(s => s.trust_tier >= 4);
    const needsDeepExtract = !hasOfficialSource || freshness_risk === "breaking";

    if (needsDeepExtract) {
        const extractTargets = ranked.slice(0, 3).map(s => s.url);
        try {
            const extracted = await tavilyExtract({
                urls: extractTargets,
                extract_depth: "basic",
                format: "markdown",
                topic: `${title} release status`,
            });

            const rawByUrl = new Map<string, string>(
                extracted.results.map(item => [item.url, item.raw_content.substring(0, 3000)])
            );

            ranked = ranked.map(s => {
                const deeper = rawByUrl.get(s.url);
                return deeper ? { ...s, snippet: deeper } : s;
            });
        } catch (err) {
            console.warn("[research-facts] tavilyExtract failed, using snippets only:", err);
        }
    }

    const facts = extractCanonicalFacts(ranked, title, freshness_risk);

    return {
        topic: title,
        checked_at: new Date().toISOString(),
        freshness_risk,
        query_rewrites: queries,
        retrieval_mode: "tavily",
        sources: ranked,
        ...facts,
    };
}

// ── Fact sheet → prompt injection ──────────────────────────────────────────

export function formatFactSheetForPrompt(fs: CanonicalFactSheet): string {
    const lines: string[] = [
        `## Verified Fact Sheet (checked ${fs.checked_at})`,
        `**Topic status**: ${fs.status}${fs.release_date ? ` (released: ${fs.release_date})` : ""}`,
        `**Freshness risk**: ${fs.freshness_risk}`,
    ];

    if (fs.official_source_url) lines.push(`**Official source**: ${fs.official_source_url}`);
    if (fs.key_claims.length) lines.push(`\n**Key verified claims**:\n${fs.key_claims.map(c => `- ${c}`).join("\n")}`);
    if (fs.uncertainties.length) lines.push(`\n**Uncertainties**: ${fs.uncertainties.join("; ")}`);
    if (fs.forbidden_phrases.length) {
        lines.push(`\n**BANNED PHRASES** (do not use any of these — this topic is already ${fs.status}):\n${fs.forbidden_phrases.map(p => `- "${p}"`).join("\n")}`);
    }
    if (fs.verification_notes) lines.push(`\n**Notes**: ${fs.verification_notes}`);

    if (fs.sources.length) {
        lines.push(`\n**Top sources consulted**:`);
        fs.sources.slice(0, 5).forEach(s => lines.push(`- [${s.title}](${s.url})`));
    }

    return lines.join("\n");
}
