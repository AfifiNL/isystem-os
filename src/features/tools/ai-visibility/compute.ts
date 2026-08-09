import { z } from "zod";
import type { ParsedHtmlSignals } from "../shared/html-parser";
import { toolGuardrailsSchema } from "../shared/guardrails";

export const aiVisibilityInputSchema = z.object({
    url: z.string().url().max(500),
    brandName: z.string().min(1).max(80),
    industry: z.string().min(2).max(60),
    location: z.string().max(80).optional(),
}).extend(toolGuardrailsSchema.shape);

export type AiVisibilityInput = z.infer<typeof aiVisibilityInputSchema>;

export interface VisibilityCheck {
    id: string;
    label: string;
    status: "pass" | "warn" | "fail";
    detail: string;
    impact: "high" | "medium" | "low";
}

export interface AiVisibilityResult {
    overallScore: number;
    citationReadiness: "low" | "moderate" | "high";
    prose: string;
    topFixes: string[];
    /** @deprecated Use overallScore. Kept for older result renderers/cache rows. */
    score: number;
    /** @deprecated Use citationReadiness for the public contract. */
    grade: "A" | "B" | "C" | "D";
    finalUrl: string;
    title: string | null;
    checks: VisibilityCheck[];
    /** @deprecated Kept as an educational helper in the UI. */
    samplePrompts: string[];
    /** @deprecated Use topFixes. */
    suggestedFixes: string[];
}

function toReadiness(score: number): AiVisibilityResult["citationReadiness"] {
    return score >= 75 ? "high" : score >= 50 ? "moderate" : "low";
}

function toGrade(score: number): AiVisibilityResult["grade"] {
    return score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : "D";
}

function asStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function normalizeAiVisibilityResult(raw: unknown): AiVisibilityResult {
    const value = (raw && typeof raw === "object" ? raw : {}) as Partial<AiVisibilityResult>;
    const score = typeof value.overallScore === "number"
        ? value.overallScore
        : typeof value.score === "number"
            ? value.score
            : 0;
    const checks = Array.isArray(value.checks) ? value.checks : [];
    const topFixes = asStringArray(value.topFixes).length > 0 ? asStringArray(value.topFixes) : asStringArray(value.suggestedFixes);
    const suggestedFixes = asStringArray(value.suggestedFixes).length > 0 ? asStringArray(value.suggestedFixes) : topFixes;
    const citationReadiness = value.citationReadiness ?? toReadiness(score);

    return {
        overallScore: score,
        citationReadiness,
        prose: typeof value.prose === "string" && value.prose.trim().length > 0
            ? value.prose
            : `This cached scan predates the AI prose contract. The structural score is ${score}/100 with ${citationReadiness} citation readiness. Re-run the tool after the cache expires for a fresh AI-written assessment.`,
        topFixes,
        score,
        grade: value.grade ?? toGrade(score),
        finalUrl: value.finalUrl ?? "",
        title: value.title ?? null,
        checks,
        samplePrompts: asStringArray(value.samplePrompts),
        suggestedFixes,
    };
}

function check(id: string, label: string, status: VisibilityCheck["status"], detail: string, impact: VisibilityCheck["impact"]): VisibilityCheck {
    return { id, label, status, detail, impact };
}

function scoreContribution(c: VisibilityCheck): number {
    const max = c.impact === "high" ? 20 : c.impact === "medium" ? 12 : 6;
    if (c.status === "pass") return max;
    if (c.status === "warn") return Math.round(max * 0.5);
    return 0;
}

export function evaluateAiVisibility(params: {
    input: AiVisibilityInput;
    signals: ParsedHtmlSignals;
    finalUrl: string;
}): AiVisibilityResult {
    const { input, signals, finalUrl } = params;
    const checks: VisibilityCheck[] = [];

    // Title — required.
    if (signals.title && signals.title.length >= 15 && signals.title.length <= 70) {
        checks.push(check("title", "<title> length", "pass", `Length ${signals.title.length} chars — good for SERP + AI citation.`, "high"));
    } else if (signals.title) {
        checks.push(check("title", "<title> length", "warn", `Length ${signals.title.length} chars — aim for 15–70.`, "high"));
    } else {
        checks.push(check("title", "<title> tag", "fail", "No <title> tag found. AI tools rely on titles for entity disambiguation.", "high"));
    }

    // Meta description — important for SERP snippets and AI summaries.
    if (signals.description && signals.description.length >= 70 && signals.description.length <= 170) {
        checks.push(check("meta-description", "Meta description", "pass", `Length ${signals.description.length} chars.`, "medium"));
    } else if (signals.description) {
        checks.push(check("meta-description", "Meta description", "warn", "Description exists but length is off (aim 70–170).", "medium"));
    } else {
        checks.push(check("meta-description", "Meta description", "fail", "Missing meta description.", "medium"));
    }

    // OpenGraph — used by AI tools and social previews.
    if (signals.ogTitle && signals.ogDescription) {
        checks.push(check("opengraph", "OpenGraph tags", "pass", "og:title and og:description both present.", "low"));
    } else {
        checks.push(check("opengraph", "OpenGraph tags", "warn", "Missing og:title or og:description.", "low"));
    }

    // H1 — exactly one.
    if (signals.headings.h1 === 1) {
        checks.push(check("h1", "Single H1", "pass", "Exactly one H1 — clean heading hierarchy.", "medium"));
    } else if (signals.headings.h1 === 0) {
        checks.push(check("h1", "Single H1", "fail", "No H1 found.", "medium"));
    } else {
        checks.push(check("h1", "Single H1", "warn", `${signals.headings.h1} H1s found — pick one primary topic.`, "medium"));
    }

    // Structured data — strong signal for AI search citation.
    if (signals.structuredData.length === 0) {
        checks.push(check("schema", "Structured data (JSON-LD)", "fail", "No JSON-LD detected. AI search engines lean heavily on schema for facts.", "high"));
    } else {
        const blob = signals.structuredData.join(" ").toLowerCase();
        const hasOrg = /\borganization\b|\blocalbusiness\b/.test(blob);
        const hasFaq = /\bfaqpage\b/.test(blob);
        if (hasOrg && hasFaq) {
            checks.push(check("schema", "Structured data (JSON-LD)", "pass", "Organization + FAQPage schemas detected.", "high"));
        } else if (hasOrg) {
            checks.push(check("schema", "Structured data (JSON-LD)", "warn", "Organization schema present, but no FAQPage. Add FAQs for AI citation.", "high"));
        } else {
            checks.push(check("schema", "Structured data (JSON-LD)", "warn", "Schema present but missing Organization/LocalBusiness type.", "high"));
        }
    }

    // FAQ coverage — best AI-citation lever for SMBs.
    const text = signals.rawTextSample.toLowerCase();
    const hasFaqText = /\bfrequently asked|\bfaq\b|what is|how does|why should/.test(text);
    checks.push(check("faq-text", "FAQ-style content", hasFaqText ? "pass" : "warn", hasFaqText ? "Question phrasing found in body text — AI tools love this." : "No FAQ phrasing detected. Add a Q&A section.", "high"));

    // Brand mention density — does the page actually name the brand?
    const brandMentions = signals.rawTextSample.toLowerCase().split(input.brandName.toLowerCase()).length - 1;
    if (brandMentions >= 2) {
        checks.push(check("brand-density", "Brand mention density", "pass", `Brand "${input.brandName}" mentioned ${brandMentions}× in visible content.`, "medium"));
    } else if (brandMentions === 1) {
        checks.push(check("brand-density", "Brand mention density", "warn", `Brand mentioned only once. Aim for 2–3 natural mentions.`, "medium"));
    } else {
        checks.push(check("brand-density", "Brand mention density", "fail", "Brand name not found in visible body text.", "medium"));
    }

    // Canonical — avoid duplicate-content fragmentation.
    if (signals.canonical) {
        checks.push(check("canonical", "Canonical URL", "pass", "Canonical link present.", "low"));
    } else {
        checks.push(check("canonical", "Canonical URL", "warn", "No <link rel=canonical> found.", "low"));
    }

    // Content depth.
    if (signals.bodyTextLength > 1500) {
        checks.push(check("depth", "Content depth", "pass", `~${signals.bodyTextLength} chars of visible content — enough for AI to cite.`, "medium"));
    } else if (signals.bodyTextLength > 600) {
        checks.push(check("depth", "Content depth", "warn", "Content is thin (<1500 chars). AI engines prefer authoritative pages.", "medium"));
    } else {
        checks.push(check("depth", "Content depth", "fail", "Very thin page. Hard for AI to cite.", "medium"));
    }

    const totalMax = checks.reduce((s, c) => s + (c.impact === "high" ? 20 : c.impact === "medium" ? 12 : 6), 0);
    const total = checks.reduce((s, c) => s + scoreContribution(c), 0);
    const score = Math.round((total / totalMax) * 100);
    const grade = toGrade(score);
    const citationReadiness = toReadiness(score);

    const samplePrompts = [
        `Who is the best ${input.industry} ${input.location ? `in ${input.location}` : ""}?`,
        `What are ${input.brandName}&apos;s strengths compared to competitors?`,
        `Tell me about ${input.brandName} — pricing, services, reputation.`,
        `Recommend a ${input.industry} that handles ${input.location || "Europe"}.`,
    ];

    const suggestedFixes = checks
        .filter((c) => c.status !== "pass")
        .map((c) => {
            switch (c.id) {
                case "schema":
                    return "Add an Organization (or LocalBusiness) JSON-LD block including legalName, sameAs, address, telephone, and a FAQPage block in your top 5 pages.";
                case "faq-text":
                    return "Add 5–10 H2/H3 questions with concise 60-120 word answers — phrasing them as questions is the strongest single AI-citation signal.";
                case "brand-density":
                    return "Mention the brand naturally 2–3 times in the visible body copy. Don't keyword-stuff — write for humans.";
                case "title":
                    return "Rewrite <title> to 50–60 characters, lead with the primary keyword, end with the brand name.";
                case "meta-description":
                    return "Write a 140–155 character meta description that answers \"why should an AI cite this page\" in one sentence.";
                case "h1":
                    return "Pick one primary H1 per page. Multiple H1s confuse both crawlers and AI summarizers.";
                case "depth":
                    return "Aim for 1,200–2,000 words on flagship pages with original data, examples, and named experts.";
                default:
                    return c.detail;
            }
        });

    const prose = [
        `${input.brandName} has ${citationReadiness} AI citation readiness on this URL (${score}/100). The structural scan found ${checks.filter((c) => c.status === "pass").length} passing signals out of ${checks.length}, with the strongest blockers concentrated around ${checks.filter((c) => c.status === "fail").slice(0, 2).map((c) => c.label.toLowerCase()).join(" and ") || "minor optimization gaps"}.`,
        `Treat this as an AI-search readiness snapshot, not a ranking guarantee. Fix the highest-impact warnings first, then re-test the same URL in ChatGPT, Perplexity, and Google AI Overviews using the sample prompts below.`,
    ].join("\n\n");

    return {
        overallScore: score,
        citationReadiness,
        prose,
        topFixes: suggestedFixes.slice(0, 5),
        score,
        grade,
        finalUrl,
        title: signals.title,
        checks,
        samplePrompts,
        suggestedFixes,
    };
}
