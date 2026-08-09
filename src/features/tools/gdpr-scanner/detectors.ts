import type { ParsedHtmlSignals } from "../shared/html-parser";

export interface DetectedTracker {
    id: string;
    name: string;
    category: "analytics" | "ads" | "session-replay" | "ab-testing" | "social" | "tag-manager" | "chat" | "marketing-automation" | "payments" | "other";
    requiresConsent: boolean;
    evidence: string;
}

const TRACKER_RULES: Array<{
    id: string;
    name: string;
    category: DetectedTracker["category"];
    requiresConsent: boolean;
    patterns: RegExp[];
}> = [
    { id: "ga4", name: "Google Analytics 4 (gtag)", category: "analytics", requiresConsent: true, patterns: [/googletagmanager\.com\/gtag\/js/i, /\bgtag\b\(.*'G-[A-Z0-9]+/i] },
    { id: "gtm", name: "Google Tag Manager", category: "tag-manager", requiresConsent: true, patterns: [/googletagmanager\.com\/gtm\.js/i, /\bGTM-[A-Z0-9]+\b/] },
    { id: "ua", name: "Universal Analytics (legacy)", category: "analytics", requiresConsent: true, patterns: [/google-analytics\.com\/analytics\.js/i, /\bua-\d+-\d+\b/i] },
    { id: "facebook-pixel", name: "Meta Pixel (Facebook)", category: "ads", requiresConsent: true, patterns: [/connect\.facebook\.net\/.*\/fbevents\.js/i, /\bfbq\(/] },
    { id: "linkedin", name: "LinkedIn Insight Tag", category: "ads", requiresConsent: true, patterns: [/snap\.licdn\.com\/li\.lms-analytics/i] },
    { id: "tiktok", name: "TikTok Pixel", category: "ads", requiresConsent: true, patterns: [/analytics\.tiktok\.com/i] },
    { id: "google-ads", name: "Google Ads (conversion)", category: "ads", requiresConsent: true, patterns: [/googleadservices\.com/i, /AW-\d+\/[A-Za-z0-9_-]+/] },
    { id: "hotjar", name: "Hotjar", category: "session-replay", requiresConsent: true, patterns: [/static\.hotjar\.com/i, /hjid:\s*\d+/i] },
    { id: "clarity", name: "Microsoft Clarity", category: "session-replay", requiresConsent: true, patterns: [/clarity\.ms/i] },
    { id: "mixpanel", name: "Mixpanel", category: "analytics", requiresConsent: true, patterns: [/cdn\.mxpnl\.com/i, /\bmixpanel\.init\(/i] },
    { id: "intercom", name: "Intercom", category: "chat", requiresConsent: true, patterns: [/widget\.intercom\.io/i, /\bIntercom\(/i] },
    { id: "drift", name: "Drift", category: "chat", requiresConsent: true, patterns: [/js\.driftt\.com/i] },
    { id: "tidio", name: "Tidio chat", category: "chat", requiresConsent: true, patterns: [/code\.tidio\.co/i] },
    { id: "crisp", name: "Crisp", category: "chat", requiresConsent: true, patterns: [/client\.crisp\.chat/i] },
    { id: "hubspot", name: "HubSpot tracking", category: "marketing-automation", requiresConsent: true, patterns: [/js\.hs-analytics\.net/i, /js\.hsforms\.net/i, /js\.hs-scripts\.com/i] },
    { id: "twitter", name: "X / Twitter Pixel", category: "ads", requiresConsent: true, patterns: [/static\.ads-twitter\.com/i] },
    { id: "youtube-embed", name: "YouTube embed (cookie iframe)", category: "social", requiresConsent: true, patterns: [/youtube\.com\/embed/i, /youtube-nocookie\.com\/embed/i] },
    { id: "vimeo-embed", name: "Vimeo embed", category: "social", requiresConsent: true, patterns: [/player\.vimeo\.com/i] },
    { id: "stripe-js", name: "Stripe.js", category: "payments", requiresConsent: false, patterns: [/js\.stripe\.com/i] },
    { id: "plausible", name: "Plausible Analytics", category: "analytics", requiresConsent: false, patterns: [/plausible\.io\/js/i, /data-domain\b[^>]+plausible/i] },
    { id: "fathom", name: "Fathom Analytics", category: "analytics", requiresConsent: false, patterns: [/cdn\.usefathom\.com/i] },
];

export interface CookieBannerDetection {
    detected: boolean;
    vendor: string | null;
    evidence: string | null;
}

const BANNER_RULES: Array<{ vendor: string; patterns: RegExp[] }> = [
    { vendor: "Cookiebot", patterns: [/consent\.cookiebot\.com/i, /CookieConsent\b/] },
    { vendor: "OneTrust", patterns: [/cdn\.cookielaw\.org/i, /OptanonConsent\b/] },
    { vendor: "CookieYes", patterns: [/cookieyes\.com\/web/i] },
    { vendor: "Termly", patterns: [/app\.termly\.io/i] },
    { vendor: "iubenda", patterns: [/cdn\.iubenda\.com/i] },
    { vendor: "Osano", patterns: [/cmp\.osano\.com/i] },
    { vendor: "Quantcast Choice", patterns: [/quantcast\.mgr\.consensu\.org/i] },
    { vendor: "Custom (CookieConsent script)", patterns: [/cookie-?consent/i, /cookieconsent/i] },
];

export function detectTrackers(html: string, signals: ParsedHtmlSignals): DetectedTracker[] {
    const found: DetectedTracker[] = [];
    const seen = new Set<string>();
    const haystack = `${html}\n${signals.scripts.join("\n")}\n${signals.links.join("\n")}`;
    for (const rule of TRACKER_RULES) {
        const match = rule.patterns.find((p) => p.test(haystack));
        if (match && !seen.has(rule.id)) {
            seen.add(rule.id);
            found.push({
                id: rule.id,
                name: rule.name,
                category: rule.category,
                requiresConsent: rule.requiresConsent,
                evidence: `Matched ${match.source}`,
            });
        }
    }
    return found;
}

export function detectCookieBanner(html: string): CookieBannerDetection {
    for (const rule of BANNER_RULES) {
        for (const p of rule.patterns) {
            if (p.test(html)) {
                return { detected: true, vendor: rule.vendor, evidence: p.source };
            }
        }
    }
    return { detected: false, vendor: null, evidence: null };
}

export interface PolicyLinkDetection {
    hasPrivacyPolicy: boolean;
    hasCookiePolicy: boolean;
    hasTerms: boolean;
}

export function detectPolicyLinks(html: string): PolicyLinkDetection {
    const lower = html.toLowerCase();
    return {
        hasPrivacyPolicy: /privacy[ -]?(policy|notice|statement)|privacybeleid|سياسة الخصوصية/i.test(lower),
        hasCookiePolicy: /cookie[ -]?(policy|notice|preferences|settings)|cookiebeleid|سياسة الكوكيز/i.test(lower),
        hasTerms: /terms[ -]?(of service|of use|conditions)|algemene voorwaarden|الشروط والأحكام/i.test(lower),
    };
}
