import { z } from "zod";
import type { ParsedHtmlSignals } from "../shared/html-parser";
import { toolGuardrailsSchema } from "../shared/guardrails";

export const conversionInputSchema = z.object({
    url: z.string().url().max(500),
}).extend(toolGuardrailsSchema.shape);
export type ConversionInput = z.infer<typeof conversionInputSchema>;

export interface ConversionCheck {
    id: string;
    label: string;
    status: "pass" | "warn" | "fail";
    detail: string;
    weight: number;
}

export interface ConversionResult {
    score: number;
    grade: "A" | "B" | "C" | "D" | "F";
    finalUrl: string;
    title: string | null;
    detectedLeadMagnets: string[];
    ctaStrength: "none" | "weak" | "moderate" | "strong";
    trustSignalCount: number;
    checks: ConversionCheck[];
    recommendations: string[];
}

export function normalizeConversionResult(raw: unknown): ConversionResult {
    const value = (raw && typeof raw === "object" ? raw : {}) as Partial<ConversionResult>;
    const score = typeof value.score === "number" ? value.score : 0;
    const grade: ConversionResult["grade"] = value.grade ?? (score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "F");
    const checks = Array.isArray(value.checks) ? value.checks : [];
    return {
        score,
        grade,
        finalUrl: value.finalUrl ?? "",
        title: value.title ?? null,
        detectedLeadMagnets: Array.isArray(value.detectedLeadMagnets) ? value.detectedLeadMagnets : [],
        ctaStrength: value.ctaStrength ?? (checks.some((check) => check.id === "cta" && check.status === "pass") ? "weak" : "none"),
        trustSignalCount: typeof value.trustSignalCount === "number"
            ? value.trustSignalCount
            : checks.some((check) => check.id === "trust" && check.status === "pass")
                ? 3
                : checks.some((check) => check.id === "trust" && check.status === "warn")
                    ? 1
                    : 0,
        checks,
        recommendations: Array.isArray(value.recommendations) ? value.recommendations : [],
    };
}

function checkIt(id: string, label: string, status: ConversionCheck["status"], detail: string, weight: number): ConversionCheck {
    return { id, label, status, detail, weight };
}

const CTA_PATTERNS = [
    /\bbook\b/i, /\bschedule\b/i, /\bget\s+started\b/i, /\bsign\s+up\b/i, /\bstart\s+free\b/i, /\bcontact\s+us\b/i,
    /\bbuy\b/i, /\bshop\s+now\b/i, /\brequest\s+a\s+demo\b/i, /\bbook\s+a\s+call\b/i, /\btry\b/i, /\bdownload\b/i,
];

const TRUST_PATTERNS = [
    /\btestimonials?\b/i, /\breviews?\b/i, /\bcase\s+study\b/i, /\b5[ .]?stars?\b/i, /trustpilot/i, /\bg2\b/i,
    /\biso\s*270\d{2}\b/i, /\bgdpr\b/i, /\bsoc\s*2\b/i, /\bguarantee\b/i, /\bbacked\s+by\b/i,
];

const LEAD_MAGNET_PATTERNS = [
    /\bfree\s+(ebook|guide|template|checklist|toolkit|kit|trial|consultation|audit)\b/i,
    /\bdownload\s+the\b/i, /\bwhitepaper\b/i, /\bcheat\s*sheet\b/i,
];

export function evaluateConversion(params: { rawHtml: string; signals: ParsedHtmlSignals; finalUrl: string }): ConversionResult {
    const { rawHtml, signals, finalUrl } = params;
    const checks: ConversionCheck[] = [];
    const text = `${signals.title ?? ""} ${signals.description ?? ""} ${signals.rawTextSample}`;

    // Headline (H1) — required for conversion-oriented pages.
    if (signals.headings.h1 === 1) {
        checks.push(checkIt("h1", "Clear primary headline", "pass", "Exactly one H1 — strong focal point.", 12));
    } else if (signals.headings.h1 === 0) {
        checks.push(checkIt("h1", "Clear primary headline", "fail", "No H1 found — visitors don't know what the page is about above the fold.", 12));
    } else {
        checks.push(checkIt("h1", "Clear primary headline", "warn", `${signals.headings.h1} H1s — pick one promise.`, 12));
    }

    // CTA copy.
    const ctaHits = CTA_PATTERNS.filter((p) => p.test(rawHtml));
    const ctaHit = ctaHits[0];
    const ctaStrength: ConversionResult["ctaStrength"] = ctaHits.length >= 3 ? "strong" : ctaHits.length === 2 ? "moderate" : ctaHits.length === 1 ? "weak" : "none";
    if (ctaHit) {
        checks.push(checkIt("cta", "Action-oriented CTA copy", "pass", `Detected CTA-style verbs ("${ctaHit.source.replace(/\\b|\\s\+/g, "")}").`, 15));
    } else {
        checks.push(checkIt("cta", "Action-oriented CTA copy", "fail", "No common CTA verbs detected (Book, Schedule, Sign up, Get started…).", 15));
    }

    // Contact options.
    const hasEmail = /(mailto:|@[\w.-]+\.[a-z]{2,})/i.test(rawHtml);
    const hasPhone = /(tel:|\+?\d[\d\s().-]{6,})/.test(rawHtml);
    const hasForm = signals.forms > 0;
    if (hasForm || hasEmail || hasPhone) {
        const channels = [hasForm && "form", hasEmail && "email", hasPhone && "phone"].filter(Boolean).join(", ");
        checks.push(checkIt("contact", "Contact options", "pass", `Detected: ${channels}.`, 10));
    } else {
        checks.push(checkIt("contact", "Contact options", "fail", "No form, email, or phone detected. Visitors can't convert.", 10));
    }

    // Trust signals.
    const trustHits = TRUST_PATTERNS.filter((p) => p.test(text)).length;
    if (trustHits >= 3) {
        checks.push(checkIt("trust", "Trust signals", "pass", `${trustHits} trust signal(s) detected (testimonials, reviews, certifications).`, 10));
    } else if (trustHits >= 1) {
        checks.push(checkIt("trust", "Trust signals", "warn", `Only ${trustHits} trust signal(s). Add testimonials or named customers.`, 10));
    } else {
        checks.push(checkIt("trust", "Trust signals", "fail", "No testimonials, reviews, or certifications detected.", 10));
    }

    // Lead magnet.
    const detectedLeadMagnets = LEAD_MAGNET_PATTERNS
        .filter((p) => p.test(text))
        .map((p) => p.source.replace(/\\b|\\s\+/g, " ").replace(/[()|?]/g, "").trim())
        .slice(0, 5);
    if (detectedLeadMagnets.length > 0) {
        checks.push(checkIt("lead-magnet", "Lead magnet present", "pass", "Free resource / lead magnet language detected.", 10));
    } else {
        checks.push(checkIt("lead-magnet", "Lead magnet present", "warn", "No lead magnet detected. Visitors who aren't ready to convert leave empty-handed.", 10));
    }

    // Mobile viewport.
    if (signals.hasViewport) {
        checks.push(checkIt("viewport", "Mobile-friendly meta viewport", "pass", "Viewport meta tag detected.", 6));
    } else {
        checks.push(checkIt("viewport", "Mobile-friendly meta viewport", "fail", "Missing viewport meta — page will look broken on mobile.", 6));
    }

    // Title + meta description for SERP click-through.
    if (signals.title && signals.title.length >= 15) {
        checks.push(checkIt("title", "Page title length", "pass", `${signals.title.length} chars — good for SERP CTR.`, 8));
    } else {
        checks.push(checkIt("title", "Page title length", "warn", "Title missing or too short.", 8));
    }

    if (signals.description) {
        checks.push(checkIt("meta-desc", "Meta description", "pass", "Meta description present.", 6));
    } else {
        checks.push(checkIt("meta-desc", "Meta description", "warn", "No meta description — Google may auto-generate one.", 6));
    }

    // Schema (Local SEO + AI search hook).
    if (signals.structuredData.length > 0) {
        checks.push(checkIt("schema", "Structured data", "pass", `${signals.structuredData.length} JSON-LD block(s) detected.`, 8));
    } else {
        checks.push(checkIt("schema", "Structured data", "warn", "No JSON-LD found. Add Organization + relevant schema for local SEO + AI search.", 8));
    }

    // Total
    const maxScore = checks.reduce((s, c) => s + c.weight, 0);
    const earned = checks.reduce((s, c) => s + (c.status === "pass" ? c.weight : c.status === "warn" ? c.weight * 0.5 : 0), 0);
    const score = Math.round((earned / maxScore) * 100);
    const grade: ConversionResult["grade"] = score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "F";

    const recommendations = checks
        .filter((c) => c.status !== "pass")
        .map((c) => {
            switch (c.id) {
                case "cta":
                    return "Add an action-led CTA above the fold. Use verbs your audience actually says — 'Book a call', 'Start free trial', 'Get the audit'.";
                case "contact":
                    return "Surface at least one contact method on every conversion page. A 30-second scheduling link beats a generic contact form.";
                case "trust":
                    return "Add 2–3 named-customer testimonials with photos or logos. Anonymous quotes don't move conversion.";
                case "lead-magnet":
                    return "Offer one piece of value (template, checklist, audit) in exchange for an email. 60% of visitors aren't ready to convert yet — capture them.";
                case "viewport":
                    return "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> to the head.";
                case "schema":
                    return "Add Organization and (if applicable) LocalBusiness + Service JSON-LD. This is the #1 lever for being cited by AI search.";
                case "h1":
                    return "Pick one H1 that promises a specific outcome for one specific audience. Generic H1s lose to specific ones every time.";
                default:
                    return c.detail;
            }
        });

    return { score, grade, finalUrl, title: signals.title, detectedLeadMagnets, ctaStrength, trustSignalCount: trustHits, checks, recommendations };
}
