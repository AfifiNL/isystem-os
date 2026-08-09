import { createHash } from "node:crypto";
import { tavilySearch } from "@/shared/lib/ai/tavily";
import { normalizeOutreachEmail, outreachEmailHash } from "@/features/outreach/compliance";
import { getApifyConfig, getApifyRun, listApifyDatasetItems, runApifyActor } from "@/features/outreach/discovery/apify-client";
import { mapApifyGoogleMapsItem, mapApifyWebsiteCrawlerItem, mapApifyRedditItem } from "@/features/outreach/discovery/apify-mappers";
import { extractWithScrapling } from "@/features/outreach/discovery/scrapling-client";
import {
    getLinkedinActorId,
    mapLinkedinProfileItem,
    mapLinkedinCompanyItem,
    mapLinkedinEmployeeItem,
    mapLinkedinPostItem
} from "@/features/outreach/apify/linkedin";
import type { Json } from "@/shared/lib/supabase/database.types";
import type { OutreachDiscoveryJobRow } from "@/features/outreach/types";

type SupabaseLikeResult = { data: unknown; error: { message: string; code?: string } | null };

/**
 * Chainable filter builder: `.eq()` returns itself so multiple filters can be
 * stacked, and the builder is awaitable (or terminated with `.maybeSingle()`).
 */
type SupabaseLikeFilter = Promise<SupabaseLikeResult> & {
    eq: (column: string, value: unknown) => SupabaseLikeFilter;
    maybeSingle: () => Promise<SupabaseLikeResult>;
};

type SupabaseLike = {
    from: (table: string) => {
        select: (columns: string) => SupabaseLikeFilter;
        insert: (payload: unknown) => {
            select?: (columns: string) => {
                maybeSingle: () => Promise<SupabaseLikeResult>;
            };
        } & Promise<SupabaseLikeResult>;
        update: (payload: unknown) => SupabaseLikeFilter;
        upsert: (payload: unknown, options?: { onConflict?: string }) => Promise<SupabaseLikeResult>;
    };
};

function asRecord(value: Json): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function contentHash(value: string) {
    return createHash("sha256").update(value).digest("hex");
}

function domainFromUrl(url: string) {
    try {
        return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
        return null;
    }
}

function domainFromEmail(email: string | null) {
    const domain = email?.split("@")[1]?.trim().toLowerCase();
    return domain || null;
}

function providerFromInput(input: Record<string, unknown>) {
    return typeof input.provider === "string" ? input.provider : null;
}

async function queueScoreJobs(supabase: SupabaseLike, workspaceId: string, campaignId: string | null, sourceId: string | null, accountIds: string[]) {
    if (!accountIds.length) return;
    const uniqueIds = Array.from(new Set(accountIds));
    const payload = uniqueIds.map(id => ({
        workspace_id: workspaceId,
        campaign_id: campaignId,
        source_id: sourceId,
        job_type: "score",
        priority: 130,
        input: { account_id: id },
    }));
    await supabase.from("outreach_discovery_jobs").insert(payload);
}

const NON_PROSPECT_DOMAINS = new Set([
    "chambers.com",
    "clutch.co",
    "consultancy.org",
    "cambridge.org",
    "designrush.com",
    "goodfirms.co",
    "proquest.com",
    "researchgate.net",
    "securitywall.co",
    "sortlist.com",
    "agencies.semrush.com",
    "semrush.com",
    "topseos.com",
    "scribd.com",
]);
const NON_PROSPECT_TITLE_PATTERNS = [
    /\btop\s+\d+/i,
    /\bbest\b.+\bagenc/i,
    /\brankings?\b/i,
    /\bdirectory\b/i,
    /\bguide\b/i,
    /\bhow to\b/i,
    /\blist of\b/i,
    /\bpdf\b/i,
    /\bpart\s+\d+\b/i,
    /\bstep-by-step\b/i,
    /\bwhat is\b/i,
];
const NON_PROSPECT_PATH_PATTERNS = [
    /\.pdf($|[?#])/i,
    /\.(docx?|pptx?|xlsx?)($|[?#])/i,
    /\/articles?\//i,
    /\/blog\//i,
    /\/documents?\//i,
    /\/directory\//i,
    /\/directories\//i,
    /\/insights?\//i,
    /\/news\//i,
    /\/openview\//i,
    /\/publications?\//i,
    /\/agency\/.+\/(nl|netherlands|amsterdam|rotterdam|eindhoven)/i,
    /\/agencies\//i,
];

function stringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function compactText(value: string) {
    return value.replace(/\s+/g, " ").trim();
}

function optionalText(value: unknown, max = 500) {
    return typeof value === "string" && value.trim() ? compactText(value).slice(0, max) : null;
}

function firstCsvValue(row: Record<string, unknown>, keys: string[], max = 500) {
    for (const key of keys) {
        const value = optionalText(row[key], max);
        if (value) return value;
    }
    return null;
}

function normalizeWebsite(value: string | null) {
    if (!value) return null;
    try {
        const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
        const url = new URL(withProtocol);
        return url.toString();
    } catch {
        return null;
    }
}

function numberBetween(value: string | null, min: number, max: number, fallback: number) {
    if (!value) return fallback;
    const parsed = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function contactTypeForEmail(email: string) {
    const local = email.split("@")[0] ?? "";
    if (["info", "hello", "contact", "sales", "support", "admin"].includes(local)) return "generic_business";
    if (["marketing", "operations", "office", "team"].includes(local)) return "role_mailbox";
    return "named_business";
}

function quoted(value: string) {
    const trimmed = compactText(value).replace(/"/g, "");
    return trimmed ? `"${trimmed}"` : "";
}

export function normalizeExtractedOutreachEmails(values: string[]) {
    return Array.from(new Set(values.map(normalizeOutreachEmail).filter((email): email is string => Boolean(email))));
}

export function buildOutreachSearchQueries(input: {
    brief?: string | null;
    icpDescription?: string | null;
    sectors?: string[];
    geographies?: string[];
    exclusions?: string[];
}) {
    const icp = compactText(input.icpDescription ?? input.brief ?? "").slice(0, 180);
    const sectors = (input.sectors?.length ? input.sectors : ["B2B companies"]).map((item) => compactText(item)).filter(Boolean).slice(0, 4);
    const geographies = (input.geographies?.length ? input.geographies : ["Netherlands"]).map((item) => compactText(item)).filter(Boolean).slice(0, 3);
    const exclusions = (input.exclusions ?? []).map((item) => `-${compactText(item).replace(/\s+/g, "")}`).filter((item) => item.length > 1).slice(0, 6);
    const suffix = exclusions.join(" ");
    const hygiene = "-pdf -directory -ranking -rankings -article -blog -news -guide";
    const queries = new Set<string>();

    for (const geography of geographies) {
        for (const sector of sectors) {
            queries.add([quoted(sector), quoted(geography), "company contact services", icp, hygiene, suffix].filter(Boolean).join(" "));
            queries.add([quoted(sector), quoted(geography), "firm consultancy services contact", icp, hygiene, suffix].filter(Boolean).join(" "));
        }
    }

    if (icp) {
        queries.add([icp, geographies.map(quoted).join(" OR "), "business services contact", hygiene, suffix].filter(Boolean).join(" "));
    }

    return Array.from(queries).map((query) => query.replace(/\s+/g, " ").trim().slice(0, 380)).slice(0, 8);
}

export function isLikelyOutreachProspectResult(input: { title: string; url: string }) {
    let parsed: URL;
    try {
        parsed = new URL(input.url);
    } catch {
        return false;
    }

    const domain = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (NON_PROSPECT_DOMAINS.has(domain)) return false;
    if (NON_PROSPECT_PATH_PATTERNS.some((pattern) => pattern.test(parsed.pathname))) return false;
    if (NON_PROSPECT_TITLE_PATTERNS.some((pattern) => pattern.test(input.title))) return false;

    return true;
}

async function enqueueSearchJobs(supabase: SupabaseLike, job: OutreachDiscoveryJobRow, queries: string[]) {
    let enqueued = 0;
    for (const [index, query] of queries.entries()) {
        const { error } = await supabase.from("outreach_discovery_jobs").insert({
            workspace_id: job.workspace_id,
            campaign_id: job.campaign_id,
            source_id: job.source_id,
            job_type: "search",
            priority: 100 + index,
            input: {
                query,
                generated_from_job_id: job.id,
            },
        });
        if (!error) enqueued += 1;
    }
    return enqueued;
}

function apifyGoogleMapsInput(input: Record<string, unknown>, queries: string[]) {
    const geographies = stringArray(input.geographies);
    const locationQuery = geographies.length > 0 ? geographies.join(", ") : "Netherlands";
    const config = getApifyConfig();
    return {
        searchStringsArray: queries,
        locationQuery,
        language: "en",
        maxCrawledPlacesPerSearch: config.maxItemsPerRun ?? 50,
        includeWebResults: false,
    };
}

function isDuplicateError(error: { code?: string; message?: string } | null | undefined) {
    return error?.code === "23505" || /duplicate key/i.test(error?.message ?? "");
}

function apifyRunSucceeded(status: string | null | undefined) {
    return status === "SUCCEEDED";
}

function apifyRunTerminal(status: string | null | undefined) {
    return status === "SUCCEEDED" || status === "FAILED" || status === "TIMED-OUT" || status === "ABORTED";
}

async function findExistingAccountIdByDomain(supabase: SupabaseLike, workspaceId: string, domain: string | null) {
    if (!domain) return null;
    const query = (supabase.from("outreach_prospect_accounts") as unknown as {
        select: (columns: string) => {
            eq: (column: string, value: unknown) => {
                eq: (column: string, value: unknown) => {
                    maybeSingle: () => Promise<{ data: { id?: string } | null; error: { message: string } | null }>;
                };
            };
        };
    }).select("id").eq("workspace_id", workspaceId).eq("domain", domain);
    const { data } = await query.maybeSingle();
    return data?.id ?? null;
}

async function queueApifyWebsiteCrawlerJob(supabase: SupabaseLike, job: OutreachDiscoveryJobRow, accountId: string, url: string, source: Record<string, unknown>) {
    const config = getApifyConfig();
    if (!config.enabled) return false;
    const { data: existing } = await (supabase.from("outreach_discovery_jobs") as unknown as {
        select: (columns: string) => {
            eq: (column: string, value: unknown) => {
                in: (column: string, values: unknown[]) => {
                    contains: (column: string, value: unknown) => {
                        limit: (count: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
                    };
                };
            };
        };
    }).select("id")
        .eq("campaign_id", job.campaign_id)
        .in("status", ["queued", "running", "completed"])
        .contains("input", { provider: "apify_website_crawler", account_id: accountId, url })
        .limit(1);
    if (Array.isArray(existing) && existing.length > 0) return false;

    const { error } = await supabase.from("outreach_discovery_jobs").insert({
        workspace_id: job.workspace_id,
        campaign_id: job.campaign_id,
        source_id: job.source_id,
        job_type: "extract",
        priority: 135,
        input: {
            provider: "apify_website_crawler",
            account_id: accountId,
            url,
            generated_from_job_id: job.id,
            source,
        },
    });
    return !error;
}

async function queueApifyRunPollJob(
    supabase: SupabaseLike,
    job: OutreachDiscoveryJobRow,
    input: {
        importKind: string;
        actorId: string;
        runId: string;
        datasetId?: string | null;
        query?: string | null;
        queries?: string[];
        accountId?: string | null;
        contactId?: string | null;
        url?: string | null;
        profileUrl?: string | null;
        companyUrl?: string | null;
        pollAttempts?: number;
    },
) {
    const { error } = await supabase.from("outreach_discovery_jobs").insert({
        workspace_id: job.workspace_id,
        campaign_id: job.campaign_id,
        source_id: job.source_id,
        job_type: "import",
        priority: 125,
        run_after: new Date(Date.now() + 60_000).toISOString(),
        input: {
            provider: "apify_run_poll",
            import_kind: input.importKind,
            actor_id: input.actorId,
            run_id: input.runId,
            dataset_id: input.datasetId ?? null,
            query: input.query ?? null,
            queries: input.queries ?? null,
            account_id: input.accountId ?? null,
            contact_id: input.contactId ?? null,
            url: input.url ?? null,
            profile_url: input.profileUrl ?? null,
            company_url: input.companyUrl ?? null,
            poll_attempts: input.pollAttempts ?? 0,
            generated_from_job_id: job.id,
        },
    });
    return !error;
}

async function queueApifyDatasetImportJob(
    supabase: SupabaseLike,
    job: OutreachDiscoveryJobRow,
    input: {
        importKind: string;
        actorId: string;
        runId: string | null;
        datasetId: string;
        query?: string | null;
        queries?: string[];
        accountId?: string | null;
        contactId?: string | null;
        url?: string | null;
        profileUrl?: string | null;
        companyUrl?: string | null;
    },
) {
    const { data: existing } = await (supabase.from("outreach_discovery_jobs") as unknown as {
        select: (columns: string) => {
            eq: (column: string, value: unknown) => {
                in: (column: string, values: unknown[]) => {
                    contains: (column: string, value: unknown) => {
                        limit: (count: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
                    };
                };
            };
        };
    }).select("id")
        .eq("campaign_id", job.campaign_id)
        .in("status", ["queued", "running", "completed"])
        .contains("input", { provider: "apify_dataset", import_kind: input.importKind, dataset_id: input.datasetId })
        .limit(1);
    if (Array.isArray(existing) && existing.length > 0) return false;

    const { error } = await supabase.from("outreach_discovery_jobs").insert({
        workspace_id: job.workspace_id,
        campaign_id: job.campaign_id,
        source_id: job.source_id,
        job_type: "import",
        priority: 125,
        input: {
            provider: "apify_dataset",
            import_kind: input.importKind,
            actor_id: input.actorId,
            run_id: input.runId,
            dataset_id: input.datasetId,
            query: input.query ?? null,
            queries: input.queries ?? null,
            account_id: input.accountId ?? null,
            contact_id: input.contactId ?? null,
            url: input.url ?? null,
            profile_url: input.profileUrl ?? null,
            company_url: input.companyUrl ?? null,
            offset: 0,
            generated_from_job_id: job.id,
        },
    });
    return !error;
}

async function upsertApifySourceRun(
    supabase: SupabaseLike,
    job: OutreachDiscoveryJobRow,
    provider: string,
    run: Record<string, unknown>,
    config: { actorId: string; maxItems?: number | null; maxCharge?: number | null }
) {
    if (!run.id) return;
    const runStatus = typeof run.status === "string" ? run.status : null;
    await supabase.from("outreach_source_runs").upsert({
        workspace_id: job.workspace_id,
        campaign_id: job.campaign_id,
        source_id: job.source_id,
        provider,
        actor_id: config.actorId,
        run_id: run.id,
        dataset_id: run.defaultDatasetId ?? null,
        max_total_charge_usd: config.maxCharge ?? null,
        status: apifyRunSucceeded(runStatus) ? "completed" : apifyRunTerminal(runStatus) ? "failed" : "running",
        metadata: {
            job_id: job.id,
            max_items: config.maxItems,
        },
    }, { onConflict: "run_id" });
}

async function processApifyGoogleMapsSearch(supabase: SupabaseLike, job: OutreachDiscoveryJobRow, input: Record<string, unknown>) {
    const queries = Array.isArray(input.queries) ? stringArray(input.queries) : (typeof input.query === "string" ? [input.query] : []);
    if (queries.length === 0) throw new Error("Apify Google Maps discovery job requires input.queries.");
    const config = getApifyConfig();
    const run = await runApifyActor({
        actorId: config.googleMapsActorId,
        input: apifyGoogleMapsInput(input, queries),
        memoryMb: config.googleMapsMemoryMb ?? 1024,
        webhookJobId: job.id,
        waitForFinishSeconds: 15,
    });

    let importJobs = 0;
    let pollJobs = 0;
    if (apifyRunSucceeded(run.status) && run.defaultDatasetId) {
        if (await queueApifyDatasetImportJob(supabase, job, {
            importKind: "google_maps",
            actorId: config.googleMapsActorId,
            runId: run.id,
            datasetId: run.defaultDatasetId,
            queries,
        })) importJobs = 1;
    } else if (apifyRunTerminal(run.status)) {
        throw new Error(`Apify Google Maps actor run ${run.status}${run.statusMessage ? `: ${run.statusMessage}` : ""}`);
    } else if (!apifyRunTerminal(run.status)) {
        if (await queueApifyRunPollJob(supabase, job, {
            importKind: "google_maps",
            actorId: config.googleMapsActorId,
            runId: run.id,
            datasetId: run.defaultDatasetId,
            queries,
        })) pollJobs = 1;
    }

    await supabase.from("outreach_audit_events").insert({
        workspace_id: job.workspace_id,
        campaign_id: job.campaign_id,
        event_type: "apify_run_started",
        event_summary: `Started Apify Google Maps discovery for ${queries.length} queries.`,
        metadata: {
            provider: "apify",
            actor_id: config.googleMapsActorId,
            run_id: run.id,
            dataset_id: run.defaultDatasetId ?? null,
            status: run.status,
            max_items: config.maxItemsPerRun,
            max_total_charge_usd: config.maxTotalChargeUsd,
        },
    });

    await upsertApifySourceRun(supabase, job, "apify_google_maps", run, {
        actorId: config.googleMapsActorId,
        maxItems: config.maxItemsPerRun,
        maxCharge: config.maxTotalChargeUsd,
    });

    return {
        job_type: job.job_type,
        provider: "apify_google_maps",
        queries,
        apify_actor_id: config.googleMapsActorId,
        apify_run_id: run.id,
        apify_dataset_id: run.defaultDatasetId ?? null,
        apify_status: run.status,
        import_jobs: importJobs,
        poll_jobs: pollJobs,
    };
}

async function processApifyRunPoll(supabase: SupabaseLike, job: OutreachDiscoveryJobRow, input: Record<string, unknown>) {
    const runId = typeof input.run_id === "string" ? input.run_id : null;
    const actorId = typeof input.actor_id === "string" ? input.actor_id : getApifyConfig().googleMapsActorId;
    const importKind = typeof input.import_kind === "string" ? input.import_kind : "google_maps";
    const query = typeof input.query === "string" ? input.query : null;
    const accountId = typeof input.account_id === "string" ? input.account_id : null;
    const contactId = typeof input.contact_id === "string" ? input.contact_id : null;
    const url = typeof input.url === "string" ? input.url : null;
    const profileUrl = typeof input.profile_url === "string" ? input.profile_url : null;
    const companyUrl = typeof input.company_url === "string" ? input.company_url : null;
    const pollAttempts = typeof input.poll_attempts === "number" ? input.poll_attempts : Number(input.poll_attempts ?? 0);
    if (!runId) throw new Error("Apify run poll requires input.run_id.");

    const run = await getApifyRun(runId);
    const datasetId = run.defaultDatasetId ?? (typeof input.dataset_id === "string" ? input.dataset_id : null);
    if (apifyRunSucceeded(run.status)) {
        if (!datasetId) {
            return { job_type: job.job_type, provider: "apify_run_poll", apify_run_id: runId, apify_status: run.status, skipped: true, reason: "Apify run succeeded without a default dataset." };
        }
        const queued = await queueApifyDatasetImportJob(supabase, job, {
            importKind,
            actorId,
            runId,
            datasetId,
            query,
            accountId,
            contactId,
            url,
            profileUrl,
            companyUrl,
        });
        return { job_type: job.job_type, provider: "apify_run_poll", import_kind: importKind, apify_run_id: runId, apify_status: run.status, dataset_id: datasetId, import_jobs: queued ? 1 : 0 };
    }

    if (apifyRunTerminal(run.status)) {
        throw new Error(`Apify actor run ${run.status}${run.statusMessage ? `: ${run.statusMessage}` : ""}`);
    }

    if (Number.isFinite(pollAttempts) && pollAttempts >= 10) {
        throw new Error(`Apify actor run ${runId} did not finish after ${pollAttempts} poll attempts.`);
    }

    const queued = await queueApifyRunPollJob(supabase, job, {
        importKind,
        actorId,
        runId,
        datasetId,
        query,
        accountId,
        contactId,
        url,
        profileUrl,
        companyUrl,
        pollAttempts: Number.isFinite(pollAttempts) ? pollAttempts + 1 : 1,
    });
    return { job_type: job.job_type, provider: "apify_run_poll", import_kind: importKind, apify_run_id: runId, apify_status: run.status, poll_jobs: queued ? 1 : 0, poll_attempts: Number.isFinite(pollAttempts) ? pollAttempts + 1 : 1 };
}

async function importApifyGoogleMapsDataset(supabase: SupabaseLike, job: OutreachDiscoveryJobRow, input: Record<string, unknown>) {
    const datasetId = typeof input.dataset_id === "string" ? input.dataset_id : null;
    const actorId = typeof input.actor_id === "string" ? input.actor_id : getApifyConfig().googleMapsActorId;
    const runId = typeof input.run_id === "string" ? input.run_id : null;
    const offset = typeof input.offset === "number" ? input.offset : Number(input.offset ?? 0);
    const limit = Math.min(100, getApifyConfig().maxItemsPerRun ?? 100);
    if (!datasetId) throw new Error("Apify dataset import requires input.dataset_id.");

    const page = await listApifyDatasetItems({ datasetId, offset: Number.isFinite(offset) ? offset : 0, limit });
    const maxWebsiteCrawls = getApifyConfig().maxWebsiteCrawlsPerImport;
    let insertedAccounts = 0;
    let existingAccounts = 0;
    let insertedContacts = 0;
    let queuedWebsiteCrawls = 0;
    const updatedAccountIds: string[] = [];

    for (const rawItem of page.items) {
        const mapped = mapApifyGoogleMapsItem(rawItem, { actorId, runId, datasetId });
        if (!mapped) continue;
        const insertBuilder = supabase.from("outreach_prospect_accounts").insert({
            workspace_id: job.workspace_id,
            campaign_id: job.campaign_id,
            name: mapped.name,
            domain: mapped.domain,
            website_url: mapped.website_url,
            country: mapped.country,
            sector: mapped.sector,
            stage: mapped.contacts.length > 0 ? "enriched" : "discovered",
            review_status: mapped.contacts.length > 0 ? "pending" : "rejected",
            fit_score: mapped.fit_score,
            fit_summary: mapped.fit_summary,
            metadata: {
                ...mapped.metadata,
                discovery_job_id: job.id,
            },
        });
        const { data: accountData, error } = insertBuilder.select
            ? await insertBuilder.select("id,website_url,domain").maybeSingle()
            : await insertBuilder;
        if (error && !isDuplicateError(error)) continue;

        let accountId = (accountData as { id?: string } | null)?.id ?? null;
        const isExistingAccount = Boolean(error && isDuplicateError(error));
        if (isExistingAccount) {
            existingAccounts += 1;
            accountId = await findExistingAccountIdByDomain(supabase, job.workspace_id, mapped.domain);
        } else {
            insertedAccounts += 1;
        }
        if (!accountId) continue;
        updatedAccountIds.push(accountId);

        for (const contact of mapped.contacts) {
            const { error: contactError } = await supabase.from("outreach_contacts").insert({
                workspace_id: job.workspace_id,
                account_id: accountId,
                campaign_id: job.campaign_id,
                email: contact.email,
                email_hash: contact.email_hash,
                full_name: contact.full_name,
                role_title: contact.role_title,
                contact_type: contact.contact_type,
                source_url: contact.source_url,
                lawful_basis: "unknown",
                review_status: "pending",
                metadata: {
                    ...contact.metadata,
                    discovery_job_id: job.id,
                },
            });
            if (!contactError) insertedContacts += 1;
        }

        if (!isExistingAccount && queuedWebsiteCrawls < maxWebsiteCrawls && mapped.website_url && await queueApifyWebsiteCrawlerJob(supabase, job, accountId, mapped.website_url, {
            provider: "apify",
            actor_id: actorId,
            run_id: runId,
            dataset_id: datasetId,
        })) {
            queuedWebsiteCrawls += 1;
        }
    }

    if (updatedAccountIds.length > 0) {
        await queueScoreJobs(supabase, job.workspace_id, job.campaign_id, job.source_id, updatedAccountIds);
    }

    const nextOffset = (page.offset ?? 0) + (page.count ?? page.items.length);
    if (typeof page.total === "number" && nextOffset < page.total) {
        await supabase.from("outreach_discovery_jobs").insert({
            workspace_id: job.workspace_id,
            campaign_id: job.campaign_id,
            source_id: job.source_id,
            job_type: "import",
            priority: 126,
            input: {
                ...input,
                offset: nextOffset,
                generated_from_job_id: job.id,
            },
        });
    }

    await supabase.from("outreach_audit_events").insert({
        workspace_id: job.workspace_id,
        campaign_id: job.campaign_id,
        event_type: "apify_dataset_imported",
        event_summary: `Imported ${insertedAccounts} Apify account candidates and ${insertedContacts} contacts.`,
        metadata: { provider: "apify", actor_id: actorId, run_id: runId, dataset_id: datasetId, offset: page.offset ?? offset, count: page.count ?? page.items.length },
    });

    return {
        job_type: job.job_type,
        provider: "apify_dataset",
        import_kind: "google_maps",
        inserted_accounts: insertedAccounts,
        existing_accounts: existingAccounts,
        inserted_contacts: insertedContacts,
        queued_website_crawls: queuedWebsiteCrawls,
        dataset_id: datasetId,
        next_offset: nextOffset,
        total: page.total,
    };
}

async function processApifyWebsiteCrawlerDataset(supabase: SupabaseLike, job: OutreachDiscoveryJobRow, input: Record<string, unknown>) {
    const datasetId = typeof input.dataset_id === "string" ? input.dataset_id : null;
    const accountId = typeof input.account_id === "string" ? input.account_id : null;
    const fallbackUrl = typeof input.url === "string" ? input.url : null;
    if (!datasetId || !accountId || !fallbackUrl) throw new Error("Apify website crawler import requires input.dataset_id, input.account_id, and input.url.");

    const page = await listApifyDatasetItems({ datasetId, offset: 0, limit: 10 });
    let insertedDocuments = 0;
    let insertedClaims = 0;
    for (const rawItem of page.items) {
        const mapped = mapApifyWebsiteCrawlerItem(rawItem, fallbackUrl);
        if (!mapped) continue;
        const documentInsert = supabase.from("outreach_knowledge_documents").insert({
            workspace_id: job.workspace_id,
            account_id: accountId,
            campaign_id: job.campaign_id,
            source_id: job.source_id,
            canonical_url: mapped.canonical_url,
            title: mapped.title,
            excerpt: mapped.excerpt,
            content_hash: mapped.content_hash,
            metadata: {
                ...mapped.metadata,
                discovery_job_id: job.id,
                apify_dataset_id: datasetId,
            },
        });
        const { data: documentData, error } = documentInsert.select
            ? await documentInsert.select("id").maybeSingle()
            : await documentInsert;
        if (error && !isDuplicateError(error)) continue;
        if (!error) insertedDocuments += 1;

        const documentId = (documentData as { id?: string } | null)?.id ?? null;
        if (documentId && mapped.claim_text) {
            const { error: claimError } = await supabase.from("outreach_knowledge_claims").insert({
                workspace_id: job.workspace_id,
                account_id: accountId,
                document_id: documentId,
                claim_text: mapped.claim_text,
                claim_type: "source_summary",
                confidence: 72,
                citation_url: mapped.canonical_url,
                source_excerpt: mapped.excerpt.slice(0, 500),
                metadata: { discovery_job_id: job.id, provider: "apify", apify_dataset_id: datasetId },
            });
            if (!claimError) insertedClaims += 1;
        }
    }

    if (insertedDocuments > 0) {
        await supabase.from("outreach_prospect_accounts").update({
            stage: "enriched",
            metadata: {
                discovery_job_id: job.id,
                apify_website_crawler_status: "completed",
                apify_dataset_id: datasetId,
                enriched_url: fallbackUrl,
            },
        }).eq("id", accountId);

        await queueScoreJobs(supabase, job.workspace_id, job.campaign_id, job.source_id, [accountId]);
    }

    return {
        job_type: job.job_type,
        provider: "apify_dataset",
        import_kind: "website_crawler",
        inserted_documents: insertedDocuments,
        inserted_claims: insertedClaims,
        dataset_id: datasetId,
    };
}

async function processApifyRedditDataset(supabase: SupabaseLike, job: OutreachDiscoveryJobRow, input: Record<string, unknown>) {
    const datasetId = typeof input.dataset_id === "string" ? input.dataset_id : null;
    if (!datasetId) throw new Error("Apify Reddit import requires input.dataset_id.");

    const page = await listApifyDatasetItems({ datasetId, offset: 0, limit: 100 });
    let insertedDocuments = 0;

    for (const rawItem of page.items) {
        const mapped = mapApifyRedditItem(rawItem, "");
        if (!mapped) continue;

        const { error } = await supabase.from("external_publication_research_documents").insert({
            workspace_id: job.workspace_id,
            source_kind: mapped.metadata.source_kind as string,
            canonical_url: mapped.canonical_url,
            title: mapped.title,
            trust_tier: mapped.trust_tier,
            metadata: mapped.metadata as Record<string, unknown>,
        });

        if (!error) insertedDocuments += 1;
    }

    return {
        job_type: job.job_type,
        provider: "apify_dataset",
        import_kind: "reddit_question",
        dataset_id: datasetId,
        inserted_documents: insertedDocuments,
    };
}

function getMappedValue(
    row: Record<string, unknown>,
    standardKey: string,
    mapping: Record<string, string> | undefined,
    fallbackKeys: string[],
    max = 500
) {
    if (mapping && typeof mapping[standardKey] === "string" && mapping[standardKey].trim()) {
        const key = mapping[standardKey].trim();
        const value = optionalText(row[key], max);
        if (value) return value;
    }
    return firstCsvValue(row, fallbackKeys, max);
}

async function processUploadedCsvImport(supabase: SupabaseLike, job: OutreachDiscoveryJobRow, input: Record<string, unknown>) {
    const rawRows = Array.isArray(input.rows) ? input.rows : [];
    const lawfulBasis = input.lawful_basis === "manual_warranty" ? "manual_warranty" : "unknown";
    const mapping = typeof input.column_mapping === "object" && input.column_mapping !== null ? input.column_mapping as Record<string, string> : undefined;
    let insertedAccounts = 0;
    let existingAccounts = 0;
    let insertedContacts = 0;
    let skippedRows = 0;
    const errorRows: Array<{ index: number; row: Record<string, unknown>; error: string }> = [];

    let rowIndex = 0;
    for (const rawRow of rawRows.slice(0, 500)) {
        rowIndex++;
        const row = asRecord(rawRow as Json);
        const email = normalizeOutreachEmail(getMappedValue(row, "email", mapping, ["email", "email_address", "contact_email"], 320) ?? "");
        const websiteUrl = normalizeWebsite(getMappedValue(row, "websiteUrl", mapping, ["website_url", "website", "url", "company_url", "source_url"], 500));
        const explicitDomain = getMappedValue(row, "domain", mapping, ["domain", "company_domain"], 180)?.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0]?.toLowerCase() ?? null;
        const domain = explicitDomain || (websiteUrl ? domainFromUrl(websiteUrl) : null) || domainFromEmail(email);
        const companyName = getMappedValue(row, "companyName", mapping, ["company", "company_name", "account", "account_name", "organization", "organisation", "business_name", "name"], 180)
            ?? domain
            ?? email
            ?? null;

        if (!companyName) {
            skippedRows += 1;
            errorRows.push({ index: rowIndex, row, error: "Row missing company name, domain, and email." });
            continue;
        }

        const fitScore = numberBetween(getMappedValue(row, "fitScore", mapping, ["fit_score", "score"], 20), 0, 100, email ? 55 : 35);
        const accountInsert = supabase.from("outreach_prospect_accounts").insert({
            workspace_id: job.workspace_id,
            campaign_id: job.campaign_id,
            name: companyName,
            domain,
            website_url: websiteUrl,
            country: getMappedValue(row, "country", mapping, ["country", "location"], 120),
            sector: getMappedValue(row, "sector", mapping, ["sector", "industry"], 160),
            stage: email ? "enriched" : "discovered",
            review_status: email ? "pending" : "needs_changes",
            fit_score: fitScore,
            fit_summary: getMappedValue(row, "fitSummary", mapping, ["fit_summary", "notes", "summary", "description"], 1000),
            why_now_trigger: getMappedValue(row, "whyNowTrigger", mapping, ["why_now", "why_now_trigger", "trigger"], 500),
            metadata: {
                provider: "uploaded_csv",
                discovery_job_id: job.id,
                source_id: job.source_id,
                filename: firstCsvValue(input, ["filename"], 240),
                raw_row: row,
            },
        });
        const { data: accountData, error } = accountInsert.select
            ? await accountInsert.select("id").maybeSingle()
            : await accountInsert;

        let accountId = (accountData as { id?: string } | null)?.id ?? null;
        if (error && isDuplicateError(error)) {
            existingAccounts += 1;
            accountId = await findExistingAccountIdByDomain(supabase, job.workspace_id, domain);
        } else if (error) {
            skippedRows += 1;
            errorRows.push({ index: rowIndex, row, error: `Failed to insert account: ${error.message}` });
            continue;
        } else {
            insertedAccounts += 1;
        }

        if (!accountId) {
            skippedRows += 1;
            errorRows.push({ index: rowIndex, row, error: "Unable to resolve account ID." });
            continue;
        }

        if (!email) continue;
        const { error: contactError } = await supabase.from("outreach_contacts").insert({
            workspace_id: job.workspace_id,
            account_id: accountId,
            campaign_id: job.campaign_id,
            email,
            email_hash: outreachEmailHash(email),
            full_name: getMappedValue(row, "fullName", mapping, ["contact_name", "full_name", "person", "person_name"], 180),
            role_title: getMappedValue(row, "roleTitle", mapping, ["role_title", "title", "job_title", "position"], 180),
            contact_type: contactTypeForEmail(email),
            source_url: getMappedValue(row, "sourceUrl", mapping, ["source_url", "linkedin_url", "profile_url"], 500) ?? websiteUrl,
            lawful_basis: lawfulBasis,
            lawful_basis_note: lawfulBasis === "manual_warranty" ? "Imported from operator-provided CSV." : null,
            review_status: "pending",
            metadata: {
                provider: "uploaded_csv",
                discovery_job_id: job.id,
                source_id: job.source_id,
                raw_row: row,
            },
        });
        if (!contactError) {
            insertedContacts += 1;
        } else if (!isDuplicateError(contactError)) {
            errorRows.push({ index: rowIndex, row, error: `Failed to insert contact: ${contactError.message}` });
        }
    }

    if (job.source_id) {
        await supabase.from("outreach_sources").update({
            status: "completed",
            last_checked_at: new Date().toISOString(),
            metadata: {
                provider: "uploaded_csv",
                discovery_job_id: job.id,
                inserted_accounts: insertedAccounts,
                existing_accounts: existingAccounts,
                inserted_contacts: insertedContacts,
                skipped_rows: skippedRows,
                error_rows: errorRows.slice(0, 100),
            },
        }).eq("id", job.source_id);
    }

    await supabase.from("outreach_audit_events").insert({
        workspace_id: job.workspace_id,
        campaign_id: job.campaign_id,
        event_type: "csv_import_completed",
        event_summary: `Imported ${insertedAccounts} CSV accounts and ${insertedContacts} contacts. ${skippedRows} skipped.`,
        metadata: {
            source_id: job.source_id,
            inserted_accounts: insertedAccounts,
            existing_accounts: existingAccounts,
            inserted_contacts: insertedContacts,
            skipped_rows: skippedRows,
            error_count: errorRows.length,
        },
    });

    return {
        job_type: job.job_type,
        provider: "uploaded_csv",
        import_kind: "prospects_csv",
        inserted_accounts: insertedAccounts,
        existing_accounts: existingAccounts,
        inserted_contacts: insertedContacts,
        skipped_rows: skippedRows,
        error_count: errorRows.length,
        errors: errorRows.slice(0, 50).map((er) => ({ index: er.index, error: er.error })),
    };
}

async function processApifyWebsiteCrawler(supabase: SupabaseLike, job: OutreachDiscoveryJobRow, input: Record<string, unknown>) {
    const accountId = typeof input.account_id === "string" ? input.account_id : null;
    const url = typeof input.url === "string" ? input.url : null;
    if (!accountId || !url) throw new Error("Apify website crawler job requires input.account_id and input.url.");

    const config = getApifyConfig();
    const run = await runApifyActor({
        actorId: config.websiteCrawlerActorId,
        input: {
            startUrls: [{ url }],
            maxCrawlPages: 3,
            crawlerType: "cheerio",
            saveMarkdown: true,
            removeElementsCssSelector: "nav, footer, script, style, noscript",
        },
        memoryMb: config.websiteCrawlerMemoryMb ?? 1024,
        webhookJobId: job.id,
        waitForFinishSeconds: 30,
    });

    await upsertApifySourceRun(supabase, job, "apify_website_crawler", run, {
        actorId: config.websiteCrawlerActorId,
        maxItems: config.maxItemsPerRun,
        maxCharge: config.maxTotalChargeUsd,
    });

    let importSummary = null;
    if (run.status === "SUCCEEDED" && run.defaultDatasetId) {
        importSummary = await processApifyWebsiteCrawlerDataset(supabase, job, {
            provider: "apify_dataset",
            import_kind: "website_crawler",
            dataset_id: run.defaultDatasetId,
            account_id: accountId,
            url,
        });
    } else if (apifyRunTerminal(run.status)) {
        throw new Error(`Apify website crawler actor run ${run.status}${run.statusMessage ? `: ${run.statusMessage}` : ""}`);
    } else if (!apifyRunTerminal(run.status)) {
        await queueApifyRunPollJob(supabase, job, {
            importKind: "website_crawler",
            actorId: config.websiteCrawlerActorId,
            runId: run.id,
            datasetId: run.defaultDatasetId,
            accountId,
            url,
        });
    }

    return {
        job_type: job.job_type,
        provider: "apify_website_crawler",
        apify_actor_id: config.websiteCrawlerActorId,
        apify_run_id: run.id,
        apify_dataset_id: run.defaultDatasetId ?? null,
        apify_status: run.status,
        import_summary: importSummary,
    };
}

async function processApifyLinkedinProfileDataset(supabase: SupabaseLike, job: OutreachDiscoveryJobRow, input: Record<string, unknown>) {
    const datasetId = typeof input.dataset_id === "string" ? input.dataset_id : null;
    const contactId = typeof input.contact_id === "string" ? input.contact_id : null;
    const accountId = typeof input.account_id === "string" ? input.account_id : null;
    const profileUrl = typeof input.profile_url === "string" ? input.profile_url : null;
    if (!datasetId) throw new Error("LinkedIn profile dataset import requires input.dataset_id.");

    const page = await listApifyDatasetItems({ datasetId, offset: 0, limit: 10 });
    let updatedContacts = 0;
    let insertedDocuments = 0;

    for (const rawItem of page.items) {
        const mapped = mapLinkedinProfileItem(rawItem);
        if (!mapped.fullName) continue;

        if (contactId) {
            const { error: updateError } = await supabase.from("outreach_contacts").update({
                full_name: mapped.fullName,
                role_title: mapped.roleTitle || undefined,
                source_url: mapped.profileUrl || profileUrl || undefined,
                metadata: {
                    linkedin_enriched: true,
                    linkedin_summary: mapped.summary,
                    linkedin_skills: mapped.skills,
                    linkedin_experience: mapped.experience,
                    apify_dataset_id: datasetId,
                    discovery_job_id: job.id,
                }
            }).eq("id", contactId);

            if (!updateError) {
                updatedContacts += 1;

                const summary = mapped.summary || "";
                const expText = mapped.experience.map(e => `- ${e.title} at ${e.companyName}: ${e.description || ""}`).join("\n");
                const skillsText = mapped.skills.join(", ");
                const bodyText = `LinkedIn Profile Summary:\n${summary}\n\nExperience:\n${expText}\n\nSkills:\n${skillsText}`;

                if (accountId) {
                    await supabase.from("outreach_knowledge_documents").insert({
                        workspace_id: job.workspace_id,
                        account_id: accountId,
                        campaign_id: job.campaign_id,
                        source_id: job.source_id,
                        canonical_url: mapped.profileUrl || profileUrl || "",
                        title: `LinkedIn Profile: ${mapped.fullName}`,
                        excerpt: bodyText.slice(0, 2000),
                        content_hash: contentHash(bodyText),
                        metadata: {
                            provider: "apify",
                            import_kind: "linkedin_profile",
                            apify_dataset_id: datasetId,
                            discovery_job_id: job.id,
                        }
                    });
                    insertedDocuments += 1;
                }
            }
        }
    }

    if (accountId && (updatedContacts > 0 || insertedDocuments > 0)) {
        await queueScoreJobs(supabase, job.workspace_id, job.campaign_id, job.source_id, [accountId]);
    }

    return { job_type: job.job_type, provider: "apify_dataset", import_kind: "linkedin_profile", updated_contacts: updatedContacts, inserted_documents: insertedDocuments };
}

async function processApifyLinkedinProfile(supabase: SupabaseLike, job: OutreachDiscoveryJobRow, input: Record<string, unknown>) {
    const contactId = typeof input.contact_id === "string" ? input.contact_id : null;
    const profileUrl = typeof input.profile_url === "string" ? input.profile_url : null;
    if (!profileUrl) throw new Error("Apify LinkedIn profile job requires input.profile_url.");

    const actorId = getLinkedinActorId("linkedin_profile");
    const run = await runApifyActor({
        actorId,
        input: {
            urls: [profileUrl],
            linkedinUrls: [profileUrl],
        },
        memoryMb: 1024,
        webhookJobId: job.id,
    });

    const config = getApifyConfig();
    await upsertApifySourceRun(supabase, job, "apify_linkedin_profile", run, {
        actorId,
        maxItems: config.maxItemsPerRun,
        maxCharge: config.maxTotalChargeUsd,
    });

    let importSummary = null;
    if (run.status === "SUCCEEDED" && run.defaultDatasetId) {
        importSummary = await processApifyLinkedinProfileDataset(supabase, job, {
            provider: "apify_dataset",
            import_kind: "linkedin_profile",
            dataset_id: run.defaultDatasetId,
            contact_id: contactId,
            profile_url: profileUrl,
        });
    } else if (apifyRunTerminal(run.status)) {
        throw new Error(`Apify LinkedIn profile actor run ${run.status}${run.statusMessage ? `: ${run.statusMessage}` : ""}`);
    } else if (!apifyRunTerminal(run.status)) {
        await queueApifyRunPollJob(supabase, job, {
            importKind: "linkedin_profile",
            actorId,
            runId: run.id,
            datasetId: run.defaultDatasetId,
            contactId,
            profileUrl,
        });
    }

    return {
        job_type: job.job_type,
        provider: "apify_linkedin_profile",
        apify_actor_id: actorId,
        apify_run_id: run.id,
        apify_dataset_id: run.defaultDatasetId ?? null,
        apify_status: run.status,
        import_summary: importSummary,
    };
}

async function processApifyLinkedinCompanyDataset(supabase: SupabaseLike, job: OutreachDiscoveryJobRow, input: Record<string, unknown>) {
    const datasetId = typeof input.dataset_id === "string" ? input.dataset_id : null;
    const accountId = typeof input.account_id === "string" ? input.account_id : null;
    const companyUrl = typeof input.company_url === "string" ? input.company_url : null;
    if (!datasetId || !accountId) throw new Error("LinkedIn company dataset import requires input.dataset_id and input.account_id.");

    const page = await listApifyDatasetItems({ datasetId, offset: 0, limit: 10 });
    let updatedAccounts = 0;
    let insertedDocuments = 0;

    for (const rawItem of page.items) {
        const mapped = mapLinkedinCompanyItem(rawItem);
        if (!mapped) continue;

        const { error: updateError } = await supabase.from("outreach_prospect_accounts").update({
            name: mapped.name,
            website_url: mapped.websiteUrl || undefined,
            domain: mapped.domain || undefined,
            sector: mapped.industry || undefined,
            company_size: mapped.size || undefined,
            country: mapped.country || undefined,
            fit_summary: mapped.description || undefined,
            stage: "enriched",
            metadata: {
                linkedin_enriched: true,
                apify_dataset_id: datasetId,
                discovery_job_id: job.id,
            }
        }).eq("id", accountId);

        if (!updateError) {
            updatedAccounts += 1;

            if (mapped.description) {
                await supabase.from("outreach_knowledge_documents").insert({
                    workspace_id: job.workspace_id,
                    account_id: accountId,
                    campaign_id: job.campaign_id,
                    source_id: job.source_id,
                    canonical_url: mapped.websiteUrl || companyUrl || "",
                    title: `LinkedIn Company Description: ${mapped.name}`,
                    excerpt: mapped.description.slice(0, 2000),
                    content_hash: contentHash(mapped.description),
                    metadata: {
                        provider: "apify",
                        import_kind: "linkedin_company",
                        apify_dataset_id: datasetId,
                        discovery_job_id: job.id,
                    }
                });
                insertedDocuments += 1;
            }
        }
    }

    if (updatedAccounts > 0 || insertedDocuments > 0) {
        await queueScoreJobs(supabase, job.workspace_id, job.campaign_id, job.source_id, [accountId]);
    }

    return { job_type: job.job_type, provider: "apify_dataset", import_kind: "linkedin_company", updated_accounts: updatedAccounts, inserted_documents: insertedDocuments };
}

async function processApifyLinkedinCompany(supabase: SupabaseLike, job: OutreachDiscoveryJobRow, input: Record<string, unknown>) {
    const accountId = typeof input.account_id === "string" ? input.account_id : null;
    const companyUrl = typeof input.company_url === "string" ? input.company_url : null;
    if (!accountId || !companyUrl) throw new Error("Apify LinkedIn company job requires input.account_id and input.company_url.");

    const actorId = getLinkedinActorId("linkedin_company");
    const run = await runApifyActor({
        actorId,
        input: {
            urls: [companyUrl],
            linkedinUrls: [companyUrl],
        },
        memoryMb: 1024,
        webhookJobId: job.id,
    });

    const config = getApifyConfig();
    await upsertApifySourceRun(supabase, job, "apify_linkedin_company", run, {
        actorId,
        maxItems: config.maxItemsPerRun,
        maxCharge: config.maxTotalChargeUsd,
    });

    let importSummary = null;
    if (run.status === "SUCCEEDED" && run.defaultDatasetId) {
        importSummary = await processApifyLinkedinCompanyDataset(supabase, job, {
            provider: "apify_dataset",
            import_kind: "linkedin_company",
            dataset_id: run.defaultDatasetId,
            account_id: accountId,
            company_url: companyUrl,
        });
    } else if (apifyRunTerminal(run.status)) {
        throw new Error(`Apify LinkedIn company actor run ${run.status}${run.statusMessage ? `: ${run.statusMessage}` : ""}`);
    } else if (!apifyRunTerminal(run.status)) {
        await queueApifyRunPollJob(supabase, job, {
            importKind: "linkedin_company",
            actorId,
            runId: run.id,
            datasetId: run.defaultDatasetId,
            accountId,
            companyUrl,
        });
    }

    return {
        job_type: job.job_type,
        provider: "apify_linkedin_company",
        apify_actor_id: actorId,
        apify_run_id: run.id,
        apify_dataset_id: run.defaultDatasetId ?? null,
        apify_status: run.status,
        import_summary: importSummary,
    };
}

async function processApifyLinkedinEmployeesDataset(supabase: SupabaseLike, job: OutreachDiscoveryJobRow, input: Record<string, unknown>) {
    const datasetId = typeof input.dataset_id === "string" ? input.dataset_id : null;
    const accountId = typeof input.account_id === "string" ? input.account_id : null;
    if (!datasetId || !accountId) throw new Error("LinkedIn employees dataset import requires input.dataset_id and input.account_id.");

    const page = await listApifyDatasetItems({ datasetId, offset: 0, limit: 25 });
    let insertedContacts = 0;

    for (const rawItem of page.items) {
        const mapped = mapLinkedinEmployeeItem(rawItem);
        if (!mapped) continue;

        const { error: insertError } = await supabase.from("outreach_contacts").insert({
            workspace_id: job.workspace_id,
            account_id: accountId,
            campaign_id: job.campaign_id,
            full_name: mapped.fullName,
            role_title: mapped.roleTitle || undefined,
            source_url: mapped.profileUrl || undefined,
            lawful_basis: "unknown",
            review_status: "pending",
            metadata: {
                provider: "apify",
                source: "linkedin_employees",
                apify_dataset_id: datasetId,
                discovery_job_id: job.id,
            }
        });

        if (!insertError || isDuplicateError(insertError)) {
            insertedContacts += 1;
        }
    }

    if (insertedContacts > 0) {
        await queueScoreJobs(supabase, job.workspace_id, job.campaign_id, job.source_id, [accountId]);
    }

    return { job_type: job.job_type, provider: "apify_dataset", import_kind: "linkedin_employees", inserted_contacts: insertedContacts };
}

async function processApifyLinkedinEmployees(supabase: SupabaseLike, job: OutreachDiscoveryJobRow, input: Record<string, unknown>) {
    const accountId = typeof input.account_id === "string" ? input.account_id : null;
    const companyUrl = typeof input.company_url === "string" ? input.company_url : null;
    if (!accountId || !companyUrl) throw new Error("Apify LinkedIn employees job requires input.account_id and input.company_url.");

    const actorId = getLinkedinActorId("linkedin_employees");
    const run = await runApifyActor({
        actorId,
        input: {
            urls: [companyUrl],
            linkedinUrls: [companyUrl],
            maxEmployees: 10,
        },
        memoryMb: 1024,
        webhookJobId: job.id,
    });

    const config = getApifyConfig();
    await upsertApifySourceRun(supabase, job, "apify_linkedin_employees", run, {
        actorId,
        maxItems: config.maxItemsPerRun,
        maxCharge: config.maxTotalChargeUsd,
    });

    let importSummary = null;
    if (run.status === "SUCCEEDED" && run.defaultDatasetId) {
        importSummary = await processApifyLinkedinEmployeesDataset(supabase, job, {
            provider: "apify_dataset",
            import_kind: "linkedin_employees",
            dataset_id: run.defaultDatasetId,
            account_id: accountId,
        });
    } else if (apifyRunTerminal(run.status)) {
        throw new Error(`Apify LinkedIn employees actor run ${run.status}${run.statusMessage ? `: ${run.statusMessage}` : ""}`);
    } else if (!apifyRunTerminal(run.status)) {
        await queueApifyRunPollJob(supabase, job, {
            importKind: "linkedin_employees",
            actorId,
            runId: run.id,
            datasetId: run.defaultDatasetId,
            accountId,
        });
    }

    return {
        job_type: job.job_type,
        provider: "apify_linkedin_employees",
        apify_actor_id: actorId,
        apify_run_id: run.id,
        apify_dataset_id: run.defaultDatasetId ?? null,
        apify_status: run.status,
        import_summary: importSummary,
    };
}

async function processApifyLinkedinPostsDataset(supabase: SupabaseLike, job: OutreachDiscoveryJobRow, input: Record<string, unknown>) {
    const datasetId = typeof input.dataset_id === "string" ? input.dataset_id : null;
    const accountId = typeof input.account_id === "string" ? input.account_id : null;
    const contactId = typeof input.contact_id === "string" ? input.contact_id : null;
    if (!datasetId || !accountId) throw new Error("LinkedIn posts dataset import requires input.dataset_id and input.account_id.");

    const page = await listApifyDatasetItems({ datasetId, offset: 0, limit: 10 });
    let insertedDocuments = 0;

    for (const rawItem of page.items) {
        const mapped = mapLinkedinPostItem(rawItem);
        if (!mapped) continue;

        const bodyText = mapped.text;
        const { error: insertError } = await supabase.from("outreach_knowledge_documents").insert({
            workspace_id: job.workspace_id,
            account_id: accountId,
            campaign_id: job.campaign_id,
            source_id: job.source_id,
            canonical_url: mapped.url || "",
            title: `LinkedIn Post: ${mapped.postedAt || "Recent"}`,
            excerpt: bodyText.slice(0, 2000),
            content_hash: contentHash(bodyText),
            metadata: {
                provider: "apify",
                import_kind: "linkedin_posts",
                apify_dataset_id: datasetId,
                discovery_job_id: job.id,
                contact_id: contactId,
            }
        });

        if (!insertError) {
            insertedDocuments += 1;
        }
    }

    if (insertedDocuments > 0) {
        await queueScoreJobs(supabase, job.workspace_id, job.campaign_id, job.source_id, [accountId]);
    }

    return { job_type: job.job_type, provider: "apify_dataset", import_kind: "linkedin_posts", inserted_documents: insertedDocuments };
}

async function processApifyLinkedinPosts(supabase: SupabaseLike, job: OutreachDiscoveryJobRow, input: Record<string, unknown>) {
    const accountId = typeof input.account_id === "string" ? input.account_id : null;
    const contactId = typeof input.contact_id === "string" ? input.contact_id : null;
    const profileUrl = typeof input.profile_url === "string" ? input.profile_url : null;
    const companyUrl = typeof input.company_url === "string" ? input.company_url : null;
    const targetUrl = profileUrl || companyUrl;
    if (!accountId || !targetUrl) throw new Error("Apify LinkedIn posts job requires input.account_id and a target profile/company URL.");

    const actorId = getLinkedinActorId("linkedin_posts");
    const run = await runApifyActor({
        actorId,
        input: {
            urls: [targetUrl],
            linkedinUrls: [targetUrl],
            maxPosts: 5,
        },
        memoryMb: 1024,
        webhookJobId: job.id,
    });

    const config = getApifyConfig();
    await upsertApifySourceRun(supabase, job, "apify_linkedin_posts", run, {
        actorId,
        maxItems: config.maxItemsPerRun,
        maxCharge: config.maxTotalChargeUsd,
    });

    let importSummary = null;
    if (run.status === "SUCCEEDED" && run.defaultDatasetId) {
        importSummary = await processApifyLinkedinPostsDataset(supabase, job, {
            provider: "apify_dataset",
            import_kind: "linkedin_posts",
            dataset_id: run.defaultDatasetId,
            account_id: accountId,
            contact_id: contactId,
        });
    } else if (apifyRunTerminal(run.status)) {
        throw new Error(`Apify LinkedIn posts actor run ${run.status}${run.statusMessage ? `: ${run.statusMessage}` : ""}`);
    } else if (!apifyRunTerminal(run.status)) {
        await queueApifyRunPollJob(supabase, job, {
            importKind: "linkedin_posts",
            actorId,
            runId: run.id,
            datasetId: run.defaultDatasetId,
            accountId,
            contactId,
            profileUrl,
            companyUrl,
        });
    }

    return {
        job_type: job.job_type,
        provider: "apify_linkedin_posts",
        apify_actor_id: actorId,
        apify_run_id: run.id,
        apify_dataset_id: run.defaultDatasetId ?? null,
        apify_status: run.status,
        import_summary: importSummary,
    };
}

export async function processOutreachDiscoveryJob(supabase: SupabaseLike, job: OutreachDiscoveryJobRow) {

    const input = asRecord(job.input);

    if (job.job_type === "generate_queries") {
        const queries = buildOutreachSearchQueries({
            brief: typeof input.brief === "string" ? input.brief : null,
            icpDescription: typeof input.icp_description === "string" ? input.icp_description : null,
            sectors: stringArray(input.sectors),
            geographies: stringArray(input.geographies),
            exclusions: stringArray(input.exclusions),
        });
        const enqueued = await enqueueSearchJobs(supabase, job, queries);
        return { job_type: job.job_type, generated_queries: queries, enqueued_search_jobs: enqueued };
    }

    if (job.job_type === "search") {
        if (providerFromInput(input) === "apify_google_maps") {
            return processApifyGoogleMapsSearch(supabase, job, input);
        }

        const query = typeof input.query === "string" ? input.query : null;
        if (!query) throw new Error("Search discovery job requires input.query.");

        const response = await tavilySearch({
            query,
            search_depth: "basic",
            max_results: 8,
            include_answer: false,
        });

        let inserted = 0;
        let extractionJobs = 0;
        let skippedNonProspects = 0;
        for (const result of response.results) {
            const domain = domainFromUrl(result.url);
            if (!domain) continue;
            if (!isLikelyOutreachProspectResult({ title: result.title, url: result.url })) {
                skippedNonProspects += 1;
                continue;
            }

            const insertBuilder = supabase.from("outreach_prospect_accounts").insert({
                workspace_id: job.workspace_id,
                campaign_id: job.campaign_id,
                name: result.title.slice(0, 180),
                domain,
                website_url: result.url,
                stage: "discovered",
                review_status: "needs_changes",
                fit_score: Math.max(0, Math.min(100, Math.round((result.score ?? 0) * 100))),
                fit_summary: result.content?.slice(0, 1000) ?? null,
                metadata: {
                    discovery_job_id: job.id,
                    tavily_score: result.score,
                    tavily_query: response.query,
                    email_validation_status: "pending_extraction",
                },
            });
            const { data: accountData, error } = insertBuilder.select
                ? await insertBuilder.select("id,website_url").maybeSingle()
                : await insertBuilder;

            if (!error) {
                inserted += 1;
                const account = accountData as { id?: string; website_url?: string | null } | null;
                const accountId = account?.id;
                const url = account?.website_url ?? result.url;
                if (accountId && url) {
                    const { error: extractError } = await supabase.from("outreach_discovery_jobs").insert({
                        workspace_id: job.workspace_id,
                        campaign_id: job.campaign_id,
                        source_id: job.source_id,
                        job_type: "extract",
                        priority: 130,
                        input: {
                            account_id: accountId,
                            url,
                            generated_from_job_id: job.id,
                        },
                    });
                    if (!extractError) extractionJobs += 1;
                }
            }
        }

        return { job_type: job.job_type, discovered_accounts: inserted, extraction_jobs: extractionJobs, skipped_non_prospects: skippedNonProspects, query };
    }

    if (job.job_type === "import") {
        if (providerFromInput(input) === "uploaded_csv") {
            return processUploadedCsvImport(supabase, job, input);
        }
        if (providerFromInput(input) === "apify_run_poll") {
            return processApifyRunPoll(supabase, job, input);
        }
        if (providerFromInput(input) === "apify_dataset") {
            if (input.import_kind === "website_crawler") {
                return processApifyWebsiteCrawlerDataset(supabase, job, input);
            }
            if (input.import_kind === "linkedin_profile") {
                return processApifyLinkedinProfileDataset(supabase, job, input);
            }
            if (input.import_kind === "linkedin_company") {
                return processApifyLinkedinCompanyDataset(supabase, job, input);
            }
            if (input.import_kind === "linkedin_employees") {
                return processApifyLinkedinEmployeesDataset(supabase, job, input);
            }
            if (input.import_kind === "linkedin_posts") {
                return processApifyLinkedinPostsDataset(supabase, job, input);
            }
            if (input.import_kind === "reddit_question") {
                return processApifyRedditDataset(supabase, job, input);
            }
            return importApifyGoogleMapsDataset(supabase, job, input);
        }
    }

    if (job.job_type === "score") {
        const accountId = typeof input.account_id === "string" ? input.account_id : null;
        if (!accountId) throw new Error("Score discovery job requires input.account_id.");

        const { data: accountData, error: accountError } = await supabase
            .from("outreach_prospect_accounts" as never)
            .select("id, name, domain, website_url, fit_score, metadata" as never)
            .eq("id" as never, accountId as never)
            .eq("workspace_id" as never, job.workspace_id as never)
            .maybeSingle();
        if (accountError || !accountData) throw new Error(`Account not found for scoring: ${accountId}`);
        const account = accountData as unknown as { id: string; name: string; domain: string | null; website_url: string | null; metadata: Record<string, unknown> };

        const { data: contacts } = await supabase.from("outreach_contacts" as never).select("id, email, lawful_basis, suppressed_at, metadata" as never).eq("account_id" as never, accountId as never).eq("workspace_id" as never, job.workspace_id as never);
        const contactList = (contacts as unknown as Array<{ id: string; email: string | null; lawful_basis: string; suppressed_at: string | null; metadata: Record<string, unknown> }>) ?? [];

        let score = 20; // Base score
        const breakdowns: string[] = ["+20: Baseline account discovery"];

        if (account.domain) {
            score += 15;
            breakdowns.push("+15: Domain present");
        }
        if (account.website_url) {
            score += 15;
            breakdowns.push("+15: Website URL present");
        }

        if (account.metadata?.linkedin_enriched) {
            score += 10;
            breakdowns.push("+10: LinkedIn company profile enriched");
        }

        if (contactList.length > 0) {
            score += 20;
            breakdowns.push(`+20: Has ${contactList.length} contact(s)`);

            const hasValidEmail = contactList.some(c => c.email && !c.suppressed_at);
            if (hasValidEmail) {
                score += 10;
                breakdowns.push("+10: Has valid unsuppressed email");
            }

            const hasSuppressed = contactList.some(c => c.suppressed_at);
            if (hasSuppressed) {
                score -= 10;
                breakdowns.push("-10: Contains suppressed contacts");
            }

            const hasLinkedin = contactList.some(c => c.metadata?.linkedin_enriched);
            if (hasLinkedin) {
                score += 10;
                breakdowns.push("+10: Contacts have LinkedIn profiles");
            }
        } else {
            score -= 10;
            breakdowns.push("-10: No contacts found");
        }

        const metadata = account.metadata || {};
        metadata.score_breakdowns = breakdowns;

        await supabase.from("outreach_prospect_accounts" as never).update({
            fit_score: Math.min(100, Math.max(0, score)),
            metadata,
        } as never).eq("id" as never, accountId as never).eq("workspace_id" as never, job.workspace_id as never);

        return { job_type: job.job_type, account_id: accountId, score, breakdowns };
    }

    if (job.job_type === "extract") {
        if (providerFromInput(input) === "apify_website_crawler") {
            return processApifyWebsiteCrawler(supabase, job, input);
        }
        if (providerFromInput(input) === "apify_linkedin_profile") {
            return processApifyLinkedinProfile(supabase, job, input);
        }
        if (providerFromInput(input) === "apify_linkedin_company") {
            return processApifyLinkedinCompany(supabase, job, input);
        }
        if (providerFromInput(input) === "apify_linkedin_employees") {
            return processApifyLinkedinEmployees(supabase, job, input);
        }
        if (providerFromInput(input) === "apify_linkedin_posts") {
            return processApifyLinkedinPosts(supabase, job, input);
        }


        const accountId = typeof input.account_id === "string" ? input.account_id : null;
        const url = typeof input.url === "string" ? input.url : null;
        if (!accountId || !url) throw new Error("Extract discovery job requires input.account_id and input.url.");

        const extracted = await extractWithScrapling({ url, mode: "company" });
        const excerpt = extracted.text.replace(/\s+/g, " ").slice(0, 2000);
        const documentInsert = supabase.from("outreach_knowledge_documents").insert({
            workspace_id: job.workspace_id,
            account_id: accountId,
            campaign_id: job.campaign_id,
            source_id: job.source_id,
            canonical_url: extracted.url,
            title: extracted.title ?? extracted.url,
            excerpt,
            content_hash: contentHash(extracted.text || extracted.url),
            metadata: {
                discovery_job_id: job.id,
                links: extracted.links.slice(0, 50),
                phones: extracted.phones.slice(0, 20),
            },
        });
        const { data: documentData, error: documentError } = documentInsert.select
            ? await documentInsert.select("id").maybeSingle()
            : await documentInsert;
        if (documentError) throw new Error(documentError.message);

        const documentId = (documentData as { id?: string } | null)?.id ?? null;
        const claimText = compactText(extracted.title ?? excerpt).slice(0, 280);
        if (claimText) {
            await supabase.from("outreach_knowledge_claims").insert({
                workspace_id: job.workspace_id,
                account_id: accountId,
                document_id: documentId,
                claim_text: claimText,
                claim_type: "source_summary",
                confidence: 70,
                citation_url: extracted.url,
                source_excerpt: excerpt.slice(0, 500),
                metadata: { discovery_job_id: job.id },
            });
        }

        const validEmails = normalizeExtractedOutreachEmails(extracted.emails);
        for (const email of validEmails.slice(0, 10)) {
            await supabase.from("outreach_contacts").insert({
                workspace_id: job.workspace_id,
                account_id: accountId,
                campaign_id: job.campaign_id,
                email,
                email_hash: outreachEmailHash(email),
                contact_type: email.startsWith("info@") || email.startsWith("hello@") || email.startsWith("contact@")
                    ? "generic_business"
                    : "named_business",
                source_url: extracted.url,
                lawful_basis: "unknown",
                review_status: "pending",
                metadata: { discovery_job_id: job.id },
            });
        }

        await supabase.from("outreach_prospect_accounts").update({
            stage: validEmails.length > 0 ? "enriched" : "discovered",
            review_status: validEmails.length > 0 ? "pending" : "rejected",
            metadata: {
                discovery_job_id: job.id,
                email_validation_status: validEmails.length > 0 ? "valid_email_found" : "no_valid_email",
                extracted_email_count: extracted.emails.length,
                valid_email_count: validEmails.length,
                extracted_url: extracted.url,
            },
        }).eq("id", accountId);

        return {
            job_type: job.job_type,
            extracted_url: extracted.url,
            emails_found: extracted.emails.length,
            valid_emails_found: validEmails.length,
        };
    }

    return { job_type: job.job_type, skipped: true, reason: "Job type scaffolded for a later AI-assisted pass." };
}
