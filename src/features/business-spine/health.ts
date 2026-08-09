export type BusinessIntegrationStatus = "unknown" | "healthy" | "degraded" | "failing" | "disabled";

export type BusinessIntegrationConfigStatus = "configured" | "action_required" | "disabled";

export interface BusinessIntegrationSurface {
    provider: string;
    integrationKey: string;
    label: string;
    purpose: string;
    owner: string;
    href: string;
    category: "provider" | "ai" | "worker" | "cron" | "ops";
    requiredEnv?: readonly string[];
    anyRequiredEnv?: readonly (readonly string[])[];
    optional?: boolean;
    disabledWhen?: (env: NodeJS.ProcessEnv) => boolean;
}

export interface BusinessIntegrationConfigEvaluation {
    status: BusinessIntegrationConfigStatus;
    configured: boolean;
    missingEnv: string[];
}

export interface BusinessIntegrationHealthRollup {
    status: BusinessIntegrationStatus;
    healthy: number;
    degraded: number;
    failing: number;
    unknown: number;
    disabled: number;
    total: number;
}

function envPresent(env: NodeJS.ProcessEnv, name: string) {
    return Boolean(env[name]?.trim());
}

function missingRequiredEnv(surface: BusinessIntegrationSurface, env: NodeJS.ProcessEnv) {
    const missing = new Set<string>();

    for (const name of surface.requiredEnv ?? []) {
        if (!envPresent(env, name)) missing.add(name);
    }

    for (const group of surface.anyRequiredEnv ?? []) {
        if (!group.some((name) => envPresent(env, name))) {
            missing.add(group.join(" or "));
        }
    }

    return Array.from(missing);
}

export function evaluateBusinessIntegrationConfig(
    surface: BusinessIntegrationSurface,
    env: NodeJS.ProcessEnv = process.env,
): BusinessIntegrationConfigEvaluation {
    if (surface.disabledWhen?.(env)) {
        return { status: "disabled", configured: false, missingEnv: [] };
    }

    const missingEnv = missingRequiredEnv(surface, env);
    if (missingEnv.length === 0) {
        return { status: "configured", configured: true, missingEnv };
    }

    return {
        status: surface.optional ? "disabled" : "action_required",
        configured: false,
        missingEnv,
    };
}

export function deriveBusinessIntegrationStatusFromConfig(
    evaluation: BusinessIntegrationConfigEvaluation,
): BusinessIntegrationStatus {
    if (evaluation.status === "disabled") return "disabled";
    if (evaluation.status === "action_required") return "degraded";
    return "unknown";
}

export function aggregateBusinessIntegrationStatuses(statuses: readonly BusinessIntegrationStatus[]): BusinessIntegrationHealthRollup {
    const rollup: BusinessIntegrationHealthRollup = {
        status: "unknown",
        healthy: 0,
        degraded: 0,
        failing: 0,
        unknown: 0,
        disabled: 0,
        total: statuses.length,
    };

    for (const status of statuses) {
        rollup[status] += 1;
    }

    if (rollup.failing > 0) rollup.status = "failing";
    else if (rollup.degraded > 0) rollup.status = "degraded";
    else if (rollup.unknown > 0) rollup.status = "unknown";
    else if (rollup.healthy > 0) rollup.status = "healthy";
    else rollup.status = "disabled";

    return rollup;
}

export const BUSINESS_INTEGRATION_SURFACES: readonly BusinessIntegrationSurface[] = [
    {
        provider: "self-hosted-supabase",
        integrationKey: "db-restore",
        label: "DB restore evidence",
        purpose: "Operator evidence that production restore reconciliation was completed after self-hosted cutover.",
        owner: "Platform",
        href: "/dashboard/health",
        category: "ops",
    },
    {
        provider: "self-hosted-supabase",
        integrationKey: "extensions-rls",
        label: "Extensions and RLS evidence",
        purpose: "Operator evidence that required Postgres extensions and workspace RLS posture were verified.",
        owner: "Platform",
        href: "/dashboard/health",
        category: "ops",
    },
    {
        provider: "self-hosted-supabase",
        integrationKey: "storage",
        label: "Storage copy evidence",
        purpose: "Operator evidence that Supabase storage objects, volumes, and file permissions were checked.",
        owner: "Platform",
        href: "/dashboard/health",
        category: "ops",
    },
    {
        provider: "self-hosted-supabase",
        integrationKey: "backups",
        label: "Off-host backup evidence",
        purpose: "Operator evidence that off-host backup jobs and restore points were verified.",
        owner: "Platform",
        href: "/dashboard/health",
        category: "ops",
    },
    {
        provider: "resend",
        integrationKey: "email-delivery",
        label: "Resend",
        purpose: "Newsletter, booking, outreach, and legal email delivery.",
        owner: "Growth",
        href: "/dashboard/newsletter",
        category: "provider",
        requiredEnv: ["RESEND_API_KEY"],
        anyRequiredEnv: [["RESEND_WEBHOOK_SECRET", "OUTREACH_WEBHOOK_SECRET"]],
    },
    {
        provider: "paypal",
        integrationKey: "booking-checkout",
        label: "PayPal",
        purpose: "Booking checkout, payment capture, and webhook verification.",
        owner: "Operations",
        href: "/dashboard/booking",
        category: "provider",
        requiredEnv: ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_WEBHOOK_ID"],
    },
    {
        provider: "apify",
        integrationKey: "outreach-discovery",
        label: "Apify",
        purpose: "Governed outreach discovery and public company research runs.",
        owner: "Growth",
        href: "/dashboard/outreach",
        category: "provider",
        requiredEnv: ["APIFY_API_TOKEN"],
        optional: true,
        disabledWhen: (env) => env.APIFY_ENABLED?.trim() !== "1",
    },
    {
        provider: "scrapling",
        integrationKey: "web-research",
        label: "Scrapling",
        purpose: "Public web extraction fallback for source and outreach research.",
        owner: "Growth",
        href: "/dashboard/outreach",
        category: "provider",
        requiredEnv: ["SCRAPLING_BASE_URL", "SCRAPLING_API_KEY"],
        optional: true,
    },
    {
        provider: "tavily",
        integrationKey: "research-search",
        label: "Tavily",
        purpose: "Search enrichment for drafts, SEO evidence, and market monitoring.",
        owner: "Insights",
        href: "/dashboard/market-monitor",
        category: "provider",
        requiredEnv: ["TAVILY_API_KEY"],
        optional: true,
    },
    {
        provider: "vertex-ai",
        integrationKey: "primary-llm",
        label: "Vertex AI",
        purpose: "Primary Gemini generation provider for metered AI workloads.",
        owner: "Platform",
        href: "/dashboard/settings",
        category: "ai",
        requiredEnv: ["GOOGLE_CLOUD_PROJECT", "GOOGLE_CLOUD_LOCATION"],
        anyRequiredEnv: [["GOOGLE_APPLICATION_CREDENTIALS_JSON", "GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64"]],
        disabledWhen: (env) => env.AI_PROVIDER?.trim().toLowerCase() === "openai",
    },
    {
        provider: "openai",
        integrationKey: "fallback-llm",
        label: "OpenAI",
        purpose: "Optional fallback LLM provider when configured.",
        owner: "Platform",
        href: "/dashboard/settings",
        category: "ai",
        requiredEnv: ["OPENAI_API_KEY"],
        optional: true,
    },
    {
        provider: "source-intelligence",
        integrationKey: "worker",
        label: "Source worker",
        purpose: "Source ingestion queue worker and registry health auditing.",
        owner: "Insights",
        href: "/dashboard/source-intelligence",
        category: "worker",
    },
    {
        provider: "content-translation",
        integrationKey: "worker",
        label: "Content translation worker",
        purpose: "Queued multilingual content translation and localization jobs.",
        owner: "Production",
        href: "/dashboard/content",
        category: "worker",
    },
    {
        provider: "outreach",
        integrationKey: "discovery-worker",
        label: "Outreach discovery worker",
        purpose: "Prospect discovery, research import, and Apify polling jobs.",
        owner: "Growth",
        href: "/dashboard/outreach",
        category: "worker",
    },
    {
        provider: "outreach",
        integrationKey: "dispatch-worker",
        label: "Outreach dispatch worker",
        purpose: "Approved outreach send queue and delivery follow-up jobs.",
        owner: "Growth",
        href: "/dashboard/outreach",
        category: "worker",
        anyRequiredEnv: [["OUTREACH_DISPATCH_SECRET", "CRON_SECRET"]],
    },
    {
        provider: "seo",
        integrationKey: "internal-links-worker",
        label: "SEO worker",
        purpose: "Internal-link recommendations and SEO automation jobs.",
        owner: "Production",
        href: "/dashboard/seo",
        category: "worker",
    },
    {
        provider: "workflow",
        integrationKey: "worker",
        label: "Workflow worker",
        purpose: "Business OS automation run processor and action executor.",
        owner: "Operations",
        href: "/dashboard/automations",
        category: "worker",
    },
    {
        provider: "cron",
        integrationKey: "source-intelligence-run",
        label: "Source cron route",
        purpose: "Protected route for scheduled Source Intelligence ingestion.",
        owner: "Insights",
        href: "/dashboard/source-intelligence",
        category: "cron",
        anyRequiredEnv: [["SOURCE_INTELLIGENCE_CRON_SECRET", "CRON_SECRET"]],
    },
    {
        provider: "cron",
        integrationKey: "newsletter-dispatch",
        label: "Newsletter cron route",
        purpose: "Protected route for scheduled newsletter dispatch.",
        owner: "Growth",
        href: "/dashboard/newsletter",
        category: "cron",
        anyRequiredEnv: [["NEWSLETTER_DISPATCH_SECRET", "CRON_SECRET"]],
    },
    {
        provider: "cron",
        integrationKey: "outreach-dispatch",
        label: "Outreach cron route",
        purpose: "Protected route for scheduled outreach dispatch.",
        owner: "Growth",
        href: "/dashboard/outreach",
        category: "cron",
        anyRequiredEnv: [["OUTREACH_DISPATCH_SECRET", "CRON_SECRET"]],
    },
    {
        provider: "cron",
        integrationKey: "gsc-sync",
        label: "GSC sync cron route",
        purpose: "Protected route for Google Search Console sync and growth signal refreshes.",
        owner: "Insights",
        href: "/dashboard/seo",
        category: "cron",
        anyRequiredEnv: [["GSC_SYNC_SECRET", "CRON_SECRET"]],
        requiredEnv: ["GOOGLE_SEARCH_CONSOLE_SITE_URL"],
    },
    {
        provider: "cron",
        integrationKey: "seo-indexing-drain",
        label: "SEO indexing cron route",
        purpose: "Protected route for canonical blog indexing follow-up, sitemap submission, URL inspection, and optional Google Indexing API notification attempts.",
        owner: "Insights",
        href: "/dashboard/seo",
        category: "cron",
        anyRequiredEnv: [["SEO_INDEXING_SECRET", "CRON_SECRET"]],
        requiredEnv: ["NEXT_PUBLIC_SITE_URL", "GOOGLE_SEARCH_CONSOLE_SITE_URL"],
    },
    {
        provider: "cron",
        integrationKey: "voice-memo-processing",
        label: "Voice memo processing cron route",
        purpose: "Protected route for queued voice memo transcription and content-draft processing.",
        owner: "Production",
        href: "/dashboard/recorder",
        category: "cron",
        anyRequiredEnv: [["VOICE_MEMO_PROCESSING_SECRET", "CRON_SECRET"]],
    },
    {
        provider: "cron",
        integrationKey: "market-monitor-run",
        label: "Market monitor cron route",
        purpose: "Protected route for competitor and authority signal refreshes.",
        owner: "Insights",
        href: "/dashboard/market-monitor",
        category: "cron",
        anyRequiredEnv: [["MARKET_MONITOR_CRON_SECRET", "CRON_SECRET"]],
        requiredEnv: ["TAVILY_API_KEY"],
    },
    {
        provider: "cron",
        integrationKey: "booking-payment-followups",
        label: "Booking payment cron route",
        purpose: "Protected route for booking payment follow-up automation.",
        owner: "Operations",
        href: "/dashboard/booking",
        category: "cron",
        anyRequiredEnv: [["BOOKING_PAYMENT_FOLLOWUP_SECRET", "CRON_SECRET"]],
    },
    {
        provider: "cron",
        integrationKey: "stale-content-scanner",
        label: "Content freshness cron route",
        purpose: "Protected route for scheduled post-publish content freshness scanning.",
        owner: "Production",
        href: "/dashboard/content",
        category: "cron",
        anyRequiredEnv: [["CONTENT_FRESHNESS_CRON_SECRET", "CRON_SECRET"]],
    },
    {
        provider: "higgsfield",
        integrationKey: "creative-render",
        label: "Higgsfield API Auto",
        purpose: "Fail-closed automated Creative Studio rendering backend. Configuration-only health surface; no Higgsfield or MCP network calls are made by this check.",
        owner: "Production",
        href: "/dashboard/creative-studio",
        category: "provider",
        requiredEnv: ["HIGGSFIELD_API_BASE_URL", "HIGGSFIELD_API_KEY"],
        anyRequiredEnv: [["HIGGSFIELD_WEBHOOK_SECRET"]],
        optional: true,
        disabledWhen: (env) => env.HIGGSFIELD_ENABLED?.trim() !== "true",
    },
    {
        provider: "higgsfield-mcp",
        integrationKey: "manual-fulfillment",
        label: "Higgsfield MCP Manual Mode",
        purpose: "Operator-managed Creative Studio fulfillment via https://mcp.higgsfield.ai/mcp. Manual/checklist status only; no backend automation, webhook guarantee, credential storage, or network health check.",
        owner: "Production",
        href: "/dashboard/creative-studio",
        category: "ops",
        optional: true,
    },
    {
        provider: "creative-studio",
        integrationKey: "render-worker",
        label: "Creative render worker",
        purpose: "Queue worker for processing fake/API Auto creative render jobs. MCP Manual jobs are operator-managed and are not dispatched by this worker.",
        owner: "Production",
        href: "/dashboard/creative-studio",
        category: "worker",
        anyRequiredEnv: [["CREATIVE_RENDER_CRON_SECRET", "CRON_SECRET"]],
    },
];
