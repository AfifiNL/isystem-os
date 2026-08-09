import { z } from "zod";
import type { ParsedHtmlSignals } from "../shared/html-parser";
import { toolGuardrailsSchema } from "../shared/guardrails";
import { detectCookieBanner, detectPolicyLinks, detectTrackers, type DetectedTracker } from "./detectors";

export const gdprInputSchema = z.object({
    url: z.string().url().max(500),
}).extend(toolGuardrailsSchema.shape);

export type GdprInput = z.infer<typeof gdprInputSchema>;

export interface GdprFinding {
    id: string;
    label: string;
    severity: "info" | "warn" | "high";
    detail: string;
    fix: string | null;
}

export interface GdprResult {
    overallRisk: "low" | "moderate" | "high" | "critical";
    riskScore: number; // 0-100, higher = riskier
    /** @deprecated Use overallRisk. */
    riskLevel: "low" | "moderate" | "high" | "critical";
    finalUrl: string;
    trackers: DetectedTracker[];
    cookieBanner: { detected: boolean; vendor: string | null };
    policies: { privacy: boolean; cookies: boolean; terms: boolean };
    findings: GdprFinding[];
}

export function normalizeGdprResult(raw: unknown): GdprResult {
    const value = (raw && typeof raw === "object" ? raw : {}) as Omit<Partial<GdprResult>, "riskLevel"> & { riskLevel?: "low" | "medium" | "moderate" | "high" | "critical" };
    const riskScore = typeof value.riskScore === "number" ? value.riskScore : 0;
    const legacyRisk = value.riskLevel === "medium" ? "moderate" : value.riskLevel;
    const overallRisk: GdprResult["overallRisk"] = value.overallRisk ?? legacyRisk ?? (riskScore >= 85 ? "critical" : riskScore >= 60 ? "high" : riskScore >= 30 ? "moderate" : "low");
    return {
        overallRisk,
        riskScore,
        riskLevel: overallRisk,
        finalUrl: value.finalUrl ?? "",
        trackers: Array.isArray(value.trackers) ? value.trackers : [],
        cookieBanner: value.cookieBanner ?? { detected: false, vendor: null },
        policies: value.policies ?? { privacy: false, cookies: false, terms: false },
        findings: Array.isArray(value.findings) ? value.findings : [],
    };
}

export function evaluateGdpr(params: {
    rawHtml: string;
    signals: ParsedHtmlSignals;
    finalUrl: string;
}): GdprResult {
    const { rawHtml, signals, finalUrl } = params;
    const trackers = detectTrackers(rawHtml, signals);
    const cookieBanner = detectCookieBanner(rawHtml);
    const policies = detectPolicyLinks(rawHtml);

    const findings: GdprFinding[] = [];

    const consentTrackers = trackers.filter((t) => t.requiresConsent);
    const adTrackers = trackers.filter((t) => t.category === "ads");
    const replayTrackers = trackers.filter((t) => t.category === "session-replay");

    if (consentTrackers.length > 0 && !cookieBanner.detected) {
        findings.push({
            id: "no-banner-with-trackers",
            label: "Trackers found but no consent banner detected",
            severity: "high",
            detail: `${consentTrackers.length} tracker(s) require consent under GDPR but no consent banner was detected on this page.`,
            fix: "Install a consent management platform (CookieYes, Cookiebot, OneTrust) and gate non-essential scripts behind consent.",
        });
    }

    if (!policies.hasPrivacyPolicy) {
        findings.push({
            id: "missing-privacy-policy",
            label: "No privacy policy link found",
            severity: "high",
            detail: "No 'Privacy Policy' link detected. GDPR Article 13 requires you to inform data subjects.",
            fix: "Publish a privacy policy page and link to it from the footer of every page.",
        });
    }

    if (consentTrackers.length > 0 && !policies.hasCookiePolicy) {
        findings.push({
            id: "missing-cookie-policy",
            label: "No cookie policy link found",
            severity: "warn",
            detail: "Trackers are in use but no specific cookie policy link is visible.",
            fix: "Add a dedicated cookie policy or include cookie-specific disclosures in your privacy policy.",
        });
    }

    if (adTrackers.length > 0) {
        findings.push({
            id: "advertising-trackers",
            label: "Advertising trackers detected",
            severity: "warn",
            detail: `Found: ${adTrackers.map((t) => t.name).join(", ")}. These require explicit opt-in consent in the EU.`,
            fix: "Ensure ad pixels do not fire before user consent. Use Consent Mode v2 with Google ad tags.",
        });
    }

    if (replayTrackers.length > 0) {
        findings.push({
            id: "session-replay-trackers",
            label: "Session replay trackers detected",
            severity: "warn",
            detail: `Found: ${replayTrackers.map((t) => t.name).join(", ")}. These can capture detailed user behaviour and should be consent-gated in the EU.`,
            fix: "Gate session replay behind explicit opt-in consent and mask personal data fields by default.",
        });
    }

    if (cookieBanner.detected && consentTrackers.length === 0) {
        findings.push({
            id: "banner-without-trackers",
            label: "Consent banner present but no trackers detected",
            severity: "info",
            detail: "Your banner may still trigger essential cookies, but no third-party trackers were found.",
            fix: null,
        });
    }

    if (!signals.canonical) {
        findings.push({
            id: "no-canonical",
            label: "No canonical URL",
            severity: "info",
            detail: "Missing rel=canonical. Not a GDPR issue but reduces SEO/AI signal quality.",
            fix: "Add <link rel=\"canonical\" href=\"…\"> in <head>.",
        });
    }

    // Risk score: weighted by severity counts and tracker breadth.
    const trackerWeight = consentTrackers.length * 6 + adTrackers.length * 4;
    const policyWeight = (!policies.hasPrivacyPolicy ? 25 : 0) + (consentTrackers.length > 0 && !policies.hasCookiePolicy ? 12 : 0);
    const bannerWeight = consentTrackers.length > 0 && !cookieBanner.detected ? 30 : 0;
    const findingsWeight = findings.reduce((s, f) => s + (f.severity === "high" ? 10 : f.severity === "warn" ? 5 : 0), 0);
    const raw = trackerWeight + policyWeight + bannerWeight + findingsWeight;
    const riskScore = Math.max(0, Math.min(100, raw));
    const overallRisk: GdprResult["overallRisk"] = riskScore >= 85 ? "critical" : riskScore >= 60 ? "high" : riskScore >= 30 ? "moderate" : "low";

    return {
        overallRisk,
        riskScore,
        riskLevel: overallRisk,
        finalUrl,
        trackers,
        cookieBanner: { detected: cookieBanner.detected, vendor: cookieBanner.vendor },
        policies: { privacy: policies.hasPrivacyPolicy, cookies: policies.hasCookiePolicy, terms: policies.hasTerms },
        findings,
    };
}
