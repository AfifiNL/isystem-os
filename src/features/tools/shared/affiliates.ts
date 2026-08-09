import type { ToolSlug } from "./types";

export interface AffiliateLink {
    id: string;
    label: string;
    description: string;
    url: string;
    category:
        | "automation"
        | "crm"
        | "support"
        | "scheduling"
        | "seo"
        | "compliance"
        | "hosting"
        | "marketing";
}

/**
 * Affiliate / partner links are kept in a single typed registry so the link
 * surface is auditable and rel="sponsored nofollow" can be enforced at render
 * time. URLs default to public marketing pages until the affiliate program
 * IDs are configured via env (`AFFILIATE_*_ID`).
 */

function affiliate(id: string, defaultUrl: string, envVar?: string): string {
    if (envVar) {
        const refId = process.env[envVar];
        if (refId) {
            const url = new URL(defaultUrl);
            url.searchParams.set("ref", refId);
            return url.toString();
        }
    }
    return defaultUrl;
}

export const AFFILIATES: Record<string, AffiliateLink> = {
    n8n: {
        id: "n8n",
        label: "n8n Cloud",
        description: "Self-hostable workflow automation. Free starter tier.",
        url: affiliate("n8n", "https://n8n.io/", "AFFILIATE_N8N_ID"),
        category: "automation",
    },
    zapier: {
        id: "zapier",
        label: "Zapier",
        description: "Connect 6,000+ apps without code.",
        url: affiliate("zapier", "https://zapier.com/", "AFFILIATE_ZAPIER_ID"),
        category: "automation",
    },
    make: {
        id: "make",
        label: "Make.com",
        description: "Visual automation platform with generous free tier.",
        url: affiliate("make", "https://www.make.com/en", "AFFILIATE_MAKE_ID"),
        category: "automation",
    },
    pipedrive: {
        id: "pipedrive",
        label: "Pipedrive CRM",
        description: "Sales-first CRM small teams actually use.",
        url: affiliate("pipedrive", "https://www.pipedrive.com/", "AFFILIATE_PIPEDRIVE_ID"),
        category: "crm",
    },
    hubspot: {
        id: "hubspot",
        label: "HubSpot",
        description: "Free CRM with optional marketing/sales hubs.",
        url: affiliate("hubspot", "https://www.hubspot.com/", "AFFILIATE_HUBSPOT_ID"),
        category: "crm",
    },
    tidio: {
        id: "tidio",
        label: "Tidio",
        description: "AI chatbot + live chat for SME operators.",
        url: affiliate("tidio", "https://www.tidio.com/", "AFFILIATE_TIDIO_ID"),
        category: "support",
    },
    crisp: {
        id: "crisp",
        label: "Crisp",
        description: "Customer messaging + shared inbox + chatbot.",
        url: affiliate("crisp", "https://crisp.chat/en/", "AFFILIATE_CRISP_ID"),
        category: "support",
    },
    calendly: {
        id: "calendly",
        label: "Calendly",
        description: "Self-serve appointment booking.",
        url: affiliate("calendly", "https://calendly.com/", "AFFILIATE_CALENDLY_ID"),
        category: "scheduling",
    },
    cookieyes: {
        id: "cookieyes",
        label: "CookieYes",
        description: "GDPR cookie banner + consent management.",
        url: affiliate("cookieyes", "https://www.cookieyes.com/", "AFFILIATE_COOKIEYES_ID"),
        category: "compliance",
    },
    termly: {
        id: "termly",
        label: "Termly",
        description: "Privacy policy + cookie consent generator.",
        url: affiliate("termly", "https://termly.io/", "AFFILIATE_TERMLY_ID"),
        category: "compliance",
    },
    semrush: {
        id: "semrush",
        label: "Semrush",
        description: "All-in-one SEO + AI Overviews tracking.",
        url: affiliate("semrush", "https://www.semrush.com/", "AFFILIATE_SEMRUSH_ID"),
        category: "seo",
    },
    ahrefs: {
        id: "ahrefs",
        label: "Ahrefs",
        description: "SEO + AI search visibility analysis.",
        url: affiliate("ahrefs", "https://ahrefs.com/", "AFFILIATE_AHREFS_ID"),
        category: "seo",
    },
    hetzner: {
        id: "hetzner",
        label: "Hetzner Cloud",
        description: "Affordable EU-based VPS hosting (Falkenstein/Helsinki/Ashburn).",
        url: affiliate("hetzner", "https://www.hetzner.com/cloud", "AFFILIATE_HETZNER_ID"),
        category: "hosting",
    },
    cloudflare: {
        id: "cloudflare",
        label: "Cloudflare",
        description: "CDN, WAF, and free SSL.",
        url: affiliate("cloudflare", "https://www.cloudflare.com/", "AFFILIATE_CLOUDFLARE_ID"),
        category: "hosting",
    },
    notion: {
        id: "notion",
        label: "Notion",
        description: "Wiki + project management + AI assistant.",
        url: affiliate("notion", "https://www.notion.so/", "AFFILIATE_NOTION_ID"),
        category: "marketing",
    },
};

export type AffiliateId = keyof typeof AFFILIATES;

export const TOOL_AFFILIATE_GROUPS: Record<ToolSlug, AffiliateId[]> = {
    "automation-scanner": ["n8n", "zapier", "make", "hubspot", "calendly"],
    "automation-roi-calculator": ["n8n", "zapier", "make", "hubspot"],
    "ai-stack-recommender": ["hubspot", "notion", "tidio", "calendly", "n8n", "semrush"],
    "ai-visibility-checker": ["semrush", "ahrefs"],
    "support-automation-readiness": ["tidio", "crisp", "hubspot"],
    "review-response-generator": ["semrush", "hubspot"],
    "gdpr-cookie-scanner": ["cookieyes", "termly", "cloudflare"],
    "conversion-audit": ["semrush", "hubspot", "calendly", "tidio"],
    "nl-zzp-agreement-generator": ["calendly", "notion"],
};

export function getAffiliatesForTool(slug: ToolSlug): AffiliateLink[] {
    return (TOOL_AFFILIATE_GROUPS[slug] ?? []).map((id) => AFFILIATES[id]);
}

export function getAffiliateCta(): string {
    return "Visit partner";
}
