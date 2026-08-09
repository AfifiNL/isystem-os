import type { SeoMutationStrategy, SeoTargetPageType } from "@/features/seo/types";

const GENERIC_TOPIC_STOPWORDS = new Set([
    "page",
    "pages",
    "home",
    "homepage",
    "contact",
    "about",
    "blog",
    "news",
    "project",
    "projects",
    "service",
    "services",
    "the",
    "and",
    "for",
]);

export interface SeoSemanticTargetContext {
    pageType: SeoTargetPageType;
    targetSlug: string | null;
    targetTitle: string | null;
    targetLabel: string;
    topicPhrase: string | null;
    preferredAnchors: string[];
    discouragedLiteralAnchor: boolean;
}

export interface SeoAnchorResolution {
    ok: boolean;
    anchorText: string | null;
    reason: string;
    semanticFit: "safe" | "degraded" | "rejected";
    consideredAnchors: string[];
}

function normalizeText(value: string) {
    return value.toLowerCase().replace(/<[^>]+>/g, " ").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function toTitleCase(value: string) {
    return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function uniq(values: Array<string | null | undefined>) {
    const seen = new Set<string>();
    const output: string[] = [];
    for (const value of values) {
        const trimmed = value?.trim();
        if (!trimmed) continue;
        const key = trimmed.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        output.push(trimmed);
    }
    return output;
}

function extractTopicPhrase(targetSlug: string | null, targetTitle: string | null) {
    const raw = [targetTitle ?? "", targetSlug?.replace(/^\/+|\/+$/g, "").replace(/[\/_-]+/g, " ") ?? ""]
        .join(" ")
        .trim();
    const tokens = normalizeText(raw)
        .split(/\s+/)
        .filter((token) => token.length >= 3 && !GENERIC_TOPIC_STOPWORDS.has(token));

    if (tokens.length === 0) return null;
    return toTitleCase(tokens.slice(0, 4).join(" "));
}

function isCtaPhrase(value: string) {
    return /(contact us|get in touch|request|consultation|quote|book|reach out|talk to|speak with|call us|email us)/i.test(value);
}

function isNarrativeSentence(value: string) {
    return /(provide|services?|support|solutions?|operations?|facilit|logistics|restaurant|hotel|commercial|spaces?|teams?|deliver|manage|workflow|process|maintenance|staffing|cleaning)/i.test(value);
}

function isNavigationSentence(value: string) {
    return /(website|site|homepage|home page|learn more|explore|discover|visit|browse|read more)/i.test(value);
}

function classifyPageType(targetSlug: string | null, targetTitle: string | null): SeoTargetPageType {
    const combined = normalizeText([targetSlug ?? "", targetTitle ?? ""].join(" "));
    if (!combined || combined === "index") return "generic";
    if (/(^|\s)contact(\s|$)|get in touch/.test(combined)) return "contact";
    if (/(^|\s)(home|homepage)(\s|$)/.test(combined) || targetSlug === "/" || targetSlug === "") return "home";
    if (/(^|\s)(service|services)(\s|$)/.test(combined)) return "service";
    if (/(^|\s)about(\s|$)/.test(combined)) return "about";
    if (/(^|\s)(project|projects|case studies)(\s|$)/.test(combined)) return "projects";
    if (/(^|\s)(blog|article|insights|news)(\s|$)/.test(combined)) return "blog";
    if (/(^|\s)(newsletter|subscribe)(\s|$)/.test(combined)) return "newsletter";
    return "generic";
}

export function createSeoSemanticTargetContext(input: {
    targetSlug: string | null;
    targetTitle: string | null;
    anchorText: string;
}): SeoSemanticTargetContext {
    const pageType = classifyPageType(input.targetSlug, input.targetTitle);
    const targetLabel = (input.targetTitle?.trim() || input.anchorText.trim() || input.targetSlug?.replace(/^\/+|\/+$/g, "").replace(/[\/_-]+/g, " ") || "this page").trim();
    const topicPhrase = extractTopicPhrase(input.targetSlug, input.targetTitle);

    const preferredAnchors = pageType === "contact"
        ? uniq([isCtaPhrase(input.anchorText) ? input.anchorText : null, "contact us", "get in touch", "request a consultation", "request a quote"])
        : pageType === "home"
            ? uniq([/(homepage|home page|our website)/i.test(input.anchorText) ? input.anchorText : null, "our homepage", "our website"])
            : pageType === "service"
                ? uniq([input.anchorText, topicPhrase, topicPhrase ? `${topicPhrase} services` : null])
                : pageType === "projects"
                    ? uniq([input.anchorText, "our projects", "recent projects"])
                    : pageType === "about"
                        ? uniq([input.anchorText, "about our team", "about our company"])
                        : pageType === "blog"
                            ? uniq([input.anchorText, "related insights", topicPhrase])
                            : pageType === "newsletter"
                                ? uniq([input.anchorText, "subscribe for updates", "join our newsletter"])
                                : uniq([input.anchorText, topicPhrase, targetLabel]);

    return {
        pageType,
        targetSlug: input.targetSlug,
        targetTitle: input.targetTitle,
        targetLabel,
        topicPhrase,
        preferredAnchors,
        discouragedLiteralAnchor: ["contact", "home", "homepage"].includes(normalizeText(targetLabel)),
    };
}

export function isStrategyPreferredForTarget(
    strategy: SeoMutationStrategy,
    context: SeoSemanticTargetContext,
    options?: { allowSoftenedRephrase?: boolean },
) {
    const isRephrase = strategy.endsWith("rephrase_link");
    if (!isRephrase) {
        return {
            passed: true,
            reason: "Strategy remains eligible for semantic anchor evaluation.",
        };
    }

    if (context.pageType === "contact" && !options?.allowSoftenedRephrase) {
        return {
            passed: false,
            reason: "Controlled rephrase is blocked for contact targets because navigational labels and CTAs should not be forced into descriptive narrative sentences.",
        };
    }

    if (context.pageType === "home" && !options?.allowSoftenedRephrase) {
        return {
            passed: false,
            reason: "Controlled rephrase is blocked for home-page targets because homepage navigation phrases rarely read naturally inside descriptive narrative copy.",
        };
    }

    return {
        passed: true,
        reason: "Controlled rephrase remains eligible for semantic anchor evaluation.",
    };
}

export function resolveSemanticAnchorForSentence(input: {
    sentence: string;
    requestedAnchor: string;
    strategy: SeoMutationStrategy;
    context: SeoSemanticTargetContext;
    requireVerbatimAnchor?: boolean;
    allowSoftenedRephrase?: boolean;
}): SeoAnchorResolution {
    const sentence = input.sentence.trim();
    const candidates = input.requireVerbatimAnchor
        ? uniq([input.requestedAnchor])
        : input.context.preferredAnchors;
    const narrative = isNarrativeSentence(sentence);
    const navigation = isNavigationSentence(sentence);
    const sentenceWords = new Set(normalizeText(sentence).split(/\s+/).filter((word) => word.length >= 3));
    const topicWords = new Set(normalizeText(input.context.topicPhrase ?? input.context.targetLabel).split(/\s+/).filter((word) => word.length >= 3));

    let bestRejectedReason = "No candidate anchor passed semantic suitability checks for this sentence.";

    for (const candidate of candidates) {
        const normalizedCandidate = normalizeText(candidate);
        const candidateWords = normalizedCandidate.split(/\s+/).filter((word) => word.length >= 2);
        const literalLabel = normalizedCandidate === normalizeText(input.context.targetLabel) || normalizedCandidate === normalizeText(input.requestedAnchor);
        const topicOverlap = candidateWords.filter((word) => topicWords.has(word)).length;
        const sentenceOverlap = candidateWords.filter((word) => sentenceWords.has(word)).length;
        const cta = isCtaPhrase(candidate);

        if (input.context.pageType === "contact") {
            if (!cta) {
                bestRejectedReason = `Rejected anchor \"${candidate}\" because contact targets must use CTA-style phrasing such as contact us or request a consultation.`;
                continue;
            }
            if (input.strategy.endsWith("rephrase_link") && !input.allowSoftenedRephrase) {
                bestRejectedReason = "Rejected because rephrase strategies are disabled for contact targets; the engine must use a better field, a CTA append, or manual review instead.";
                continue;
            }
            return {
                ok: true,
                anchorText: candidate,
                reason: `Selected CTA-style anchor \"${candidate}\" for contact target suitability.`,
                semanticFit: navigation ? "safe" : "degraded",
                consideredAnchors: candidates,
            };
        }

        if (input.context.pageType === "home") {
            if (!/(homepage|home page|website)/i.test(candidate)) {
                bestRejectedReason = `Rejected anchor \"${candidate}\" because home-page targets should be introduced with homepage-style navigation phrasing, not as topic nouns.`;
                continue;
            }
            if (input.strategy.endsWith("rephrase_link") && narrative && !input.allowSoftenedRephrase) {
                bestRejectedReason = "Rejected because homepage references would read as awkward noun insertions inside a descriptive narrative sentence.";
                continue;
            }
            return {
                ok: true,
                anchorText: candidate,
                reason: `Selected navigation-style anchor \"${candidate}\" for home-page suitability.`,
                semanticFit: navigation ? "safe" : "degraded",
                consideredAnchors: candidates,
            };
        }

        if (input.context.pageType === "service") {
            if (topicOverlap === 0 && sentenceOverlap === 0) {
                bestRejectedReason = `Rejected anchor \"${candidate}\" because service targets must be linked through service/topic phrases that overlap the destination topic or the sentence context.`;
                continue;
            }
            return {
                ok: true,
                anchorText: candidate,
                reason: `Selected topical anchor \"${candidate}\" after matching the service topic to the sentence context.`,
                semanticFit: topicOverlap > 0 ? "safe" : "degraded",
                consideredAnchors: candidates,
            };
        }

        if (narrative && literalLabel && input.context.discouragedLiteralAnchor) {
            bestRejectedReason = `Rejected literal page label \"${candidate}\" because it reads like navigation chrome rather than a natural noun phrase inside the current narrative sentence.`;
            continue;
        }

        if (literalLabel && candidateWords.length <= 1 && narrative) {
            bestRejectedReason = `Rejected anchor \"${candidate}\" because a single-word destination label is too brittle for narrative rephrasing in this sentence.`;
            continue;
        }

        return {
            ok: true,
            anchorText: candidate,
            reason: `Selected semantically compatible anchor \"${candidate}\" for this sentence.`,
            semanticFit: narrative && !navigation ? "degraded" : "safe",
            consideredAnchors: candidates,
        };
    }

    return {
        ok: false,
        anchorText: null,
        reason: bestRejectedReason,
        semanticFit: "rejected",
        consideredAnchors: candidates,
    };
}
