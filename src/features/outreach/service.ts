"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { assertWorkspaceAiEnabled, resolveWorkspaceContext } from "@/shared/lib/workspace/context";
import { normalizeOutreachEmail, evaluateContactEligibility } from "@/features/outreach/compliance";
import { generateOutreachSequenceWithGemini } from "@/features/outreach/ai/generate-sequence";
import { resolveOutreachSenderName } from "@/features/outreach/sender-identity";
import { processOutreachDispatchJobById } from "@/features/outreach/dispatch";
import { getApifyConfig } from "@/features/outreach/discovery/apify-client";
import { buildOutreachSearchQueries } from "@/features/outreach/discovery";
import { outreachCampaignSchema, outreachCsvImportSchema, outreachReviewSchema } from "@/features/outreach/schema";
import type {
    OutreachCampaignRow,
    OutreachContactRow,
    OutreachDashboardData,
    OutreachMessageRow,
    OutreachMessageStatus,
    OutreachProspectReviewItem,
    OutreachReviewStatus,
    OutreachStrategyRow,
    OutreachWorkspaceSettingsRow,
} from "@/features/outreach/types";
import type { Json } from "@/shared/lib/supabase/database.types";

export type OutreachActionState = { error: string | null; success: boolean };

function isApifyOutreachConfigured() {
    const config = getApifyConfig();
    return config.enabled && Boolean(config.token);
}

export async function isApifyOutreachEnabled() {
    return isApifyOutreachConfigured();
}

async function requireWorkspace(): Promise<
    | { workspaceId: string; userId: string; templateId: string | null }
    | { error: string }
> {
    const ctx = await resolveWorkspaceContext();
    if (!ctx?.activeWorkspace?.id || !ctx.userId) return { error: "No active workspace." } as const;
    return {
        workspaceId: ctx.activeWorkspace.id,
        userId: ctx.userId,
        templateId: ctx.activeWorkspace.legacy_template_id ?? null,
    };
}

function countRows(rows: unknown[] | null | undefined) {
    return Array.isArray(rows) ? rows.length : 0;
}

function asRecord(value: Json | null | undefined): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function sortReviewAccounts(
    campaigns: OutreachCampaignRow[],
    accounts: OutreachProspectReviewItem[],
) {
    const campaignCreatedAt = new Map(campaigns.map((campaign) => [campaign.id, new Date(campaign.created_at).getTime() || 0]));
    return [...accounts].sort((a, b) => {
        const campaignDelta = (campaignCreatedAt.get(b.campaign_id ?? "") ?? 0) - (campaignCreatedAt.get(a.campaign_id ?? "") ?? 0);
        if (campaignDelta !== 0) return campaignDelta;
        const fitDelta = b.fit_score - a.fit_score;
        if (fitDelta !== 0) return fitDelta;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
}

function reviewStatusFromFormData(formData: FormData) {
    const allowed = new Set(["approved", "rejected", "needs_changes"]);
    for (const key of ["reviewStatus", "intent", "status"]) {
        const value = formData.get(key);
        if (typeof value === "string" && allowed.has(value)) return value;
    }
    return null;
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function paragraphsToHtml(value: string) {
    return value
        .split(/\n{2,}/)
        .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
        .join("");
}

function addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function messageIdempotencyKey(messageId: string) {
    return `outreach-message-${messageId}`;
}

function shouldQueueApifyMaps(formData: FormData) {
    return formData.get("useApifyMaps") === "on" && isApifyOutreachConfigured();
}

const CSV_IMPORT_MAX_BYTES = 1_000_000;
const CSV_IMPORT_MAX_ROWS = 500;

function parseCsvLine(line: string) {
    const cells: string[] = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        const next = line[index + 1];
        if (char === "\"" && quoted && next === "\"") {
            current += "\"";
            index += 1;
            continue;
        }
        if (char === "\"") {
            quoted = !quoted;
            continue;
        }
        if (char === "," && !quoted) {
            cells.push(current.trim());
            current = "";
            continue;
        }
        current += char;
    }
    cells.push(current.trim());
    return cells;
}

function parseOutreachCsv(text: string) {
    const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = normalized.split("\n").filter((line) => line.trim().length > 0);
    if (lines.length < 2) return { headers: [] as string[], rows: [] as Record<string, string>[] };
    const headers = parseCsvLine(lines[0] ?? "").map((header) => header.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""));
    const rows = lines.slice(1, CSV_IMPORT_MAX_ROWS + 1).map((line) => {
        const cells = parseCsvLine(line);
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
            if (!header) return;
            row[header] = cells[index]?.trim() ?? "";
        });
        return row;
    }).filter((row) => Object.values(row).some(Boolean));
    return { headers, rows };
}

function buildApifyMapsJobs(input: {
    workspaceId: string;
    campaignId: string;
    queries: string[];
    brief?: string;
    icpDescription?: string;
    sectors?: string[];
    geographies?: string[];
    exclusions?: string[];
    userId?: string;
}) {
    return [{
        workspace_id: input.workspaceId,
        campaign_id: input.campaignId,
        job_type: "search",
        priority: 115,
        input: {
            provider: "apify_google_maps",
            queries: input.queries.slice(0, 8),
            brief: input.brief,
            icp_description: input.icpDescription,
            sectors: input.sectors ?? [],
            geographies: input.geographies ?? [],
            exclusions: input.exclusions ?? [],
            queued_by: input.userId,
            queued_at: new Date().toISOString(),
        },
    }];
}

function hasValidOutreachEmail(contact: Pick<OutreachContactRow, "email" | "suppressed_at">) {
    return Boolean(normalizeOutreachEmail(contact.email)) && !contact.suppressed_at;
}

export async function loadOutreachDashboard(workspaceId: string): Promise<OutreachDashboardData> {
    const supabase = await createClient();

    const [
        campaignsRes,
        accountsRes,
        contactsRes,
        documentsRes,
        messagesRes,
        discoveryJobsRes,
        dispatchJobsRes,
        eventsRes,
        suppressionsRes,
    ] = await Promise.all([
        supabase.from("outreach_campaigns" as never).select("*" as never).eq("workspace_id" as never, workspaceId as never).order("created_at" as never, { ascending: false }).limit(100),
        supabase.from("outreach_prospect_accounts" as never).select("*" as never).eq("workspace_id" as never, workspaceId as never).order("created_at" as never, { ascending: false }).limit(1500),
        supabase.from("outreach_contacts" as never).select("*" as never).eq("workspace_id" as never, workspaceId as never).limit(3000),
        supabase.from("outreach_knowledge_documents" as never).select("id,account_id,canonical_url,title,excerpt" as never).eq("workspace_id" as never, workspaceId as never).limit(3000),
        supabase.from("outreach_messages" as never).select("*" as never).eq("workspace_id" as never, workspaceId as never).order("updated_at" as never, { ascending: false }).limit(3000),
        supabase.from("outreach_discovery_jobs" as never).select("id,status" as never).eq("workspace_id" as never, workspaceId as never).in("status" as never, ["queued", "running"] as never),
        supabase.from("outreach_dispatch_jobs" as never).select("id,status,campaign_id,message_id" as never).eq("workspace_id" as never, workspaceId as never).in("status" as never, ["queued", "running"] as never),
        supabase.from("outreach_events" as never).select("*" as never).eq("workspace_id" as never, workspaceId as never).order("occurred_at" as never, { ascending: false }).limit(30),
        supabase.from("outreach_suppressions" as never).select("id" as never).eq("workspace_id" as never, workspaceId as never).limit(1000),
    ]);

    const firstError = [campaignsRes, accountsRes, contactsRes, documentsRes, messagesRes, discoveryJobsRes, dispatchJobsRes, eventsRes, suppressionsRes]
        .find((res) => res.error)?.error;
    if (firstError) {
        return {
            workspaceId,
            campaigns: [],
            pendingAccounts: [],
            approvedAccounts: [],
            pendingMessages: [],
            recentEvents: [],
            stats: {
                campaigns: 0,
                activeCampaigns: 0,
                accounts: 0,
                contacts: 0,
                eligibleContacts: 0,
                queuedDiscoveryJobs: 0,
                queuedDispatchJobs: 0,
                sentMessages: 0,
                bouncedMessages: 0,
                complainedMessages: 0,
                suppressions: 0,
            },
            error: firstError.message,
        };
    }

    const campaigns = (campaignsRes.data ?? []) as unknown as OutreachCampaignRow[];
    const accounts = ((accountsRes.data ?? []) as unknown) as Array<{
        id: string;
        campaign_id: string | null;
        name: string;
        domain: string | null;
        website_url: string | null;
        stage: OutreachProspectReviewItem["stage"];
        review_status: OutreachReviewStatus;
        fit_score: number;
        fit_summary: string | null;
        why_now_trigger: string | null;
        metadata: Json;
        updated_at: string;
    }>;
    const contacts = ((contactsRes.data ?? []) as unknown) as OutreachContactRow[];
    const documents = ((documentsRes.data ?? []) as unknown) as Array<{ id: string; account_id: string | null; canonical_url: string; title: string; excerpt: string | null }>;
    let messages = ((messagesRes.data ?? []) as unknown) as OutreachMessageRow[];
    const activeDispatchJobs = ((dispatchJobsRes.data ?? []) as unknown) as Array<{ id: string; status: string; campaign_id?: string | null; message_id?: string | null }>;
    const messageAccountIds = new Set(messages.map((message) => message.account_id));
    const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
    const contactsByAccountId = new Map<string, OutreachContactRow[]>();
    const docsByAccountId = new Map<string, KnowledgeDoc[]>();
    for (const contact of contacts) {
        const accountId = contact.account_id;
        if (!accountId) continue;
        contactsByAccountId.set(accountId, [...(contactsByAccountId.get(accountId) ?? []), contact]);
    }
    for (const document of documents) {
        const accountId = document.account_id;
        if (!accountId) continue;
        docsByAccountId.set(accountId, [...(docsByAccountId.get(accountId) ?? []), document]);
    }
    const selectedWithoutDrafts = accounts.filter((account) => (
        account.review_status === "approved"
        && account.campaign_id
        && !messageAccountIds.has(account.id)
        && (contactsByAccountId.get(account.id) ?? []).some(hasValidOutreachEmail)
    ));
    if (selectedWithoutDrafts.length > 0) {
        const generatedAt = new Date().toISOString();
        for (const account of selectedWithoutDrafts.slice(0, 10)) {
            const campaign = account.campaign_id ? campaignById.get(account.campaign_id) : null;
            if (!campaign || !account.campaign_id) continue;
            await ensureStrategySequenceAndDrafts({
                supabase,
                workspaceId,
                userId: "system",
                account: { ...account, campaign_id: account.campaign_id },
                campaign,
                docs: docsByAccountId.get(account.id) ?? [],
                contacts: contactsByAccountId.get(account.id) ?? [],
                reviewedAt: generatedAt,
            }).catch(() => null);
        }
        const { data: refreshedMessages } = await supabase
            .from("outreach_messages" as never)
            .select("*" as never)
            .eq("workspace_id" as never, workspaceId as never)
            .order("updated_at" as never, { ascending: false })
            .limit(3000);
        messages = ((refreshedMessages ?? messages) as unknown) as OutreachMessageRow[];
    }
    const campaignName = new Map(campaigns.map((campaign) => [campaign.id, campaign.name]));
    const accountName = new Map(accounts.map((account) => [account.id, account.name]));
    const contactEmail = new Map(contacts.map((contact) => [contact.id, contact.email]));
    const contactCount = new Map<string, number>();
    const documentCount = new Map<string, number>();
    const draftMessageCount = new Map<string, number>();
    const scheduledMessageCount = new Map<string, number>();
    const sentMessageCount = new Map<string, number>();
    for (const contact of contacts) {
        if (contact.account_id && hasValidOutreachEmail(contact)) {
            contactCount.set(contact.account_id, (contactCount.get(contact.account_id) ?? 0) + 1);
        }
    }
    for (const document of documents) {
        if (document.account_id) documentCount.set(document.account_id, (documentCount.get(document.account_id) ?? 0) + 1);
    }
    for (const message of messages) {
        if (message.status === "draft" || message.status === "approved") {
            draftMessageCount.set(message.account_id, (draftMessageCount.get(message.account_id) ?? 0) + 1);
        }
        if (message.status === "scheduled") {
            scheduledMessageCount.set(message.account_id, (scheduledMessageCount.get(message.account_id) ?? 0) + 1);
        }
        if (["sent", "delivered", "opened", "clicked", "replied"].includes(message.status)) {
            sentMessageCount.set(message.account_id, (sentMessageCount.get(message.account_id) ?? 0) + 1);
        }
    }
    const reviewAccounts: OutreachProspectReviewItem[] = accounts.map((account) => ({
        id: account.id,
        campaign_id: account.campaign_id,
        campaign_name: account.campaign_id ? campaignName.get(account.campaign_id) ?? null : null,
        name: account.name,
        domain: account.domain,
        website_url: account.website_url,
        stage: account.stage,
        review_status: account.review_status,
        fit_score: account.fit_score,
        fit_summary: account.fit_summary,
        why_now_trigger: account.why_now_trigger,
        contactCount: contactCount.get(account.id) ?? 0,
        documentCount: documentCount.get(account.id) ?? 0,
        draftMessageCount: draftMessageCount.get(account.id) ?? 0,
        scheduledMessageCount: scheduledMessageCount.get(account.id) ?? 0,
        sentMessageCount: sentMessageCount.get(account.id) ?? 0,
        updated_at: account.updated_at,
    }));

    return {
        workspaceId,
        campaigns: campaigns.map((campaign) => ({
            ...campaign,
            accountCount: accounts.filter((account) => account.campaign_id === campaign.id).length,
            contactCount: contacts.filter((contact) => contact.campaign_id === campaign.id && hasValidOutreachEmail(contact)).length,
            approvedMessageCount: messages.filter((message) => message.campaign_id === campaign.id && ["approved", "scheduled"].includes(message.status)).length,
            scheduledMessageCount: messages.filter((message) => message.campaign_id === campaign.id && message.status === "scheduled").length,
            queuedDispatchJobCount: activeDispatchJobs.filter((job) => job.campaign_id === campaign.id && job.status === "queued").length,
            sentMessageCount: messages.filter((message) => message.campaign_id === campaign.id && ["sent", "delivered", "opened", "clicked", "replied"].includes(message.status)).length,
        })),
        pendingAccounts: sortReviewAccounts(campaigns, reviewAccounts.filter((account) => account.review_status === "pending" && account.contactCount > 0)).slice(0, 1500),
        approvedAccounts: sortReviewAccounts(campaigns, reviewAccounts.filter((account) => account.review_status === "approved")).slice(0, 1500),
        pendingMessages: messages
            .filter((message) => message.status === "draft" || message.status === "approved" || message.status === "scheduled")
            .slice(0, 1500)
            .map((message) => ({
                id: message.id,
                campaign_id: message.campaign_id,
                account_id: message.account_id,
                contact_id: message.contact_id,
                status: message.status,
                subject: message.subject,
                body_html: message.body_html,
                scheduled_for: message.scheduled_for,
                risk_score: message.risk_score,
                updated_at: message.updated_at,
                account_name: accountName.get(message.account_id) ?? null,
                contact_email: contactEmail.get(message.contact_id) ?? null,
            })),
        recentEvents: ((eventsRes.data ?? []) as unknown) as OutreachDashboardData["recentEvents"],
        stats: {
            campaigns: campaigns.length,
            activeCampaigns: campaigns.filter((campaign) => campaign.status === "active" || campaign.status === "scheduled").length,
            accounts: accounts.length,
            contacts: contacts.filter(hasValidOutreachEmail).length,
            eligibleContacts: contacts.filter((contact) => hasValidOutreachEmail(contact) && contact.review_status === "approved" && !["unknown", "blocked"].includes(contact.lawful_basis)).length,
            queuedDiscoveryJobs: countRows(discoveryJobsRes.data),
            queuedDispatchJobs: countRows(dispatchJobsRes.data),
            sentMessages: messages.filter((message) => ["sent", "delivered", "opened", "clicked", "replied"].includes(message.status)).length,
            bouncedMessages: messages.filter((message) => message.status === "bounced").length,
            complainedMessages: messages.filter((message) => message.status === "complained").length,
            suppressions: countRows(suppressionsRes.data),
        },
        error: null,
    };
}

export async function createOutreachCampaignAction(_prev: OutreachActionState, formData: FormData): Promise<OutreachActionState> {
    const workspace = await requireWorkspace();
    if ("error" in workspace) return { error: workspace.error, success: false };
    const parsed = outreachCampaignSchema.safeParse({
        name: formData.get("name"),
        brief: formData.get("brief"),
        icpDescription: formData.get("icpDescription"),
        sectors: formData.get("sectors"),
        geographies: formData.get("geographies"),
        exclusions: formData.get("exclusions"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid campaign input.", success: false };

    const supabase = await createClient();
    const { data, error } = await supabase.from("outreach_campaigns" as never).insert({
        workspace_id: workspace.workspaceId,
        template_id: workspace.templateId,
        name: parsed.data.name,
        brief: parsed.data.brief,
        icp_description: parsed.data.icpDescription,
        target_sectors: parsed.data.sectors,
        target_geographies: parsed.data.geographies,
        source_types: shouldQueueApifyMaps(formData)
            ? ["tavily_query", "website", "apify_google_maps", "apify_website_crawler"]
            : ["tavily_query", "website"],
        exclusions: parsed.data.exclusions,
        status: "discovering",
        review_status: "pending",
        owner_profile_id: workspace.userId,
    } as never).select("id" as never).single();
    if (error) return { error: error.message, success: false };

    const campaignId = (data as unknown as { id: string }).id;
    const queries = buildOutreachSearchQueries({
        brief: parsed.data.brief,
        icpDescription: parsed.data.icpDescription,
        sectors: parsed.data.sectors,
        geographies: parsed.data.geographies,
        exclusions: parsed.data.exclusions,
    });
    const jobs: Array<Record<string, unknown>> = queries.map((query, index) => ({
        workspace_id: workspace.workspaceId,
        campaign_id: campaignId,
        job_type: "search",
        priority: 100 + index,
        input: {
            query,
            brief: parsed.data.brief,
            icp_description: parsed.data.icpDescription,
            sectors: parsed.data.sectors,
            geographies: parsed.data.geographies,
            exclusions: parsed.data.exclusions,
        },
    }));
    if (shouldQueueApifyMaps(formData)) {
        jobs.push(...buildApifyMapsJobs({
            workspaceId: workspace.workspaceId,
            campaignId,
            queries,
            brief: parsed.data.brief,
            icpDescription: parsed.data.icpDescription,
            sectors: parsed.data.sectors,
            geographies: parsed.data.geographies,
            exclusions: parsed.data.exclusions,
            userId: workspace.userId,
        }));
    }
    const { error: jobError } = await supabase.from("outreach_discovery_jobs" as never).insert(jobs as never);
    if (jobError) return { error: jobError.message, success: false };

    await supabase.from("outreach_audit_events" as never).insert({
        workspace_id: workspace.workspaceId,
        campaign_id: campaignId,
        actor_profile_id: workspace.userId,
        event_type: "campaign_created",
        event_summary: `Created campaign brief and queued ${jobs.length} discovery search jobs.`,
        metadata: { queries, apify_maps_enabled: shouldQueueApifyMaps(formData) },
    } as never);
    revalidatePath("/dashboard/outreach");
    return { error: null, success: true };
}

export async function importOutreachCsvAction(_prev: OutreachActionState, formData: FormData): Promise<OutreachActionState> {
    const workspace = await requireWorkspace();
    if ("error" in workspace) return { error: workspace.error, success: false };

    const parsed = outreachCsvImportSchema.safeParse({
        campaignId: formData.get("campaignId"),
        lawfulBasis: formData.get("manualWarranty") === "on" ? "manual_warranty" : "unknown",
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid CSV import.", success: false };

    const file = formData.get("csvFile");
    if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file to import.", success: false };
    if (file.size > CSV_IMPORT_MAX_BYTES) return { error: "CSV file is too large. Keep imports under 1 MB for this pass.", success: false };

    const text = await file.text();
    const { headers, rows } = parseOutreachCsv(text);
    if (rows.length === 0) return { error: "CSV has no importable rows.", success: false };

    const columnMappingRaw = formData.get("columnMapping");
    let columnMapping: Record<string, string> | undefined;
    if (typeof columnMappingRaw === "string" && columnMappingRaw.trim()) {
        try {
            columnMapping = JSON.parse(columnMappingRaw);
        } catch (e) {
            console.warn("[importOutreachCsvAction] Failed to parse columnMapping:", e);
        }
    }

    const supabase = await createClient();
    const { data: campaign, error: campaignError } = await supabase
        .from("outreach_campaigns" as never)
        .select("id,name" as never)
        .eq("workspace_id" as never, workspace.workspaceId as never)
        .eq("id" as never, parsed.data.campaignId as never)
        .maybeSingle();
    if (campaignError || !campaign) return { error: campaignError?.message ?? "Campaign not found.", success: false };

    const filename = file.name || "outreach-import.csv";
    const { data: source, error: sourceError } = await supabase
        .from("outreach_sources" as never)
        .insert({
            workspace_id: workspace.workspaceId,
            campaign_id: parsed.data.campaignId,
            source_type: "uploaded_csv",
            label: filename.slice(0, 180),
            query: `uploaded_csv:${filename.slice(0, 120)}`,
            status: "queued",
            metadata: {
                filename,
                size_bytes: file.size,
                headers,
                rows_detected: rows.length,
                rows_truncated: rows.length >= CSV_IMPORT_MAX_ROWS,
                lawful_basis: parsed.data.lawfulBasis,
                column_mapping: columnMapping,
            },
            created_by: workspace.userId,
        } as never)
        .select("id" as never)
        .single();
    if (sourceError || !source) return { error: sourceError?.message ?? "Could not create CSV source.", success: false };

    const sourceId = (source as unknown as { id: string }).id;
    const { error: jobError } = await supabase.from("outreach_discovery_jobs" as never).insert({
        workspace_id: workspace.workspaceId,
        campaign_id: parsed.data.campaignId,
        source_id: sourceId,
        job_type: "import",
        priority: 140,
        input: {
            provider: "uploaded_csv",
            import_kind: "prospects_csv",
            filename,
            rows,
            lawful_basis: parsed.data.lawfulBasis,
            uploaded_by: workspace.userId,
            queued_at: new Date().toISOString(),
            column_mapping: columnMapping,
        },
    } as never);
    if (jobError) return { error: jobError.message, success: false };

    await supabase.from("outreach_audit_events" as never).insert({
        workspace_id: workspace.workspaceId,
        campaign_id: parsed.data.campaignId,
        actor_profile_id: workspace.userId,
        event_type: "csv_import_queued",
        event_summary: `Queued ${rows.length} CSV prospect rows for import.`,
        metadata: { source_id: sourceId, filename, rows: rows.length, column_mapping: columnMapping },
    } as never);

    revalidatePath("/dashboard/outreach");
    return { error: null, success: true };
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type StrategyAccount = {
    id: string;
    campaign_id: string;
    name: string;
    domain: string | null;
    website_url: string | null;
    fit_score: number;
    fit_summary: string | null;
    why_now_trigger: string | null;
    metadata: Json;
};
type StrategyCampaign = { id: string; name?: string; brief: string; icp_description: string };
type KnowledgeDoc = { canonical_url: string; title: string; excerpt: string | null };
type SequenceDraft = { delayDays: number; objective: string; subject: string; bodyText: string };

function primaryContact(contacts: OutreachContactRow[]) {
    return contacts.find((contact) => hasValidOutreachEmail(contact) && ["named_business", "generic_business", "role_mailbox"].includes(contact.contact_type))
        ?? contacts.find(hasValidOutreachEmail)
        ?? null;
}

function buildSequenceDrafts(input: {
    account: StrategyAccount;
    campaign: StrategyCampaign;
    docs: KnowledgeDoc[];
    senderName: string;
}): SequenceDraft[] {
    const accountName = input.account.name;
    const domain = input.account.domain ?? "your team";
    const summary = input.account.fit_summary?.replace(/\s+/g, " ").slice(0, 220)
        ?? input.account.why_now_trigger?.replace(/\s+/g, " ").slice(0, 220)
        ?? input.campaign.icp_description.replace(/\s+/g, " ").slice(0, 220);
    const proof = input.docs[0]?.title ? `I noticed ${input.docs[0].title.replace(/\s+/g, " ").slice(0, 120)}.` : `I was looking at ${domain}.`;
    const angle = input.campaign.brief.replace(/\s+/g, " ").slice(0, 260);
    const senderName = input.senderName;

    return [
        {
            delayDays: 0,
            objective: "Open a relevant conversation with a short, evidence-based observation.",
            subject: `Quick idea for ${accountName}`,
            bodyText: [
                `Hi there,`,
                `${proof}`,
                `The reason I am reaching out: ${angle}`,
                `${summary}`,
                `Would it be useful if I sent over a concise view of where an AI-first workflow could remove manual coordination without adding another tool to manage?`,
                `Best,\n${senderName}`,
            ].join("\n\n"),
        },
        {
            delayDays: 3,
            objective: "Follow up with a concrete operational angle.",
            subject: `Re: ${accountName}`,
            bodyText: [
                `Hi there,`,
                `Following up with a more concrete angle for ${accountName}.`,
                `For teams like yours, the gap is often not one missing app. It is the handoff between intake, context gathering, client updates, and internal follow-through.`,
                `Our team helps turn those handoffs into governed workflows with visibility, approvals, and a clear audit trail.`,
                `Open to a quick 15-minute check on whether this is relevant?`,
                `Best,\n${senderName}`,
            ].join("\n\n"),
        },
        {
            delayDays: 7,
            objective: "Close the loop respectfully and preserve deliverability.",
            subject: `Should I close the loop?`,
            bodyText: [
                `Hi there,`,
                `I do not want to crowd your inbox, so I will close the loop after this.`,
                `If improving operational throughput without adding more disconnected tools is on the roadmap, I can share a short teardown of where ${accountName} might benefit from governed AI workflows.`,
                `Worth sending, or should I leave it here?`,
                `Best,\n${senderName}`,
            ].join("\n\n"),
        },
    ];
}

async function ensureStrategySequenceAndDrafts(input: {
    supabase: SupabaseServerClient;
    workspaceId: string;
    userId: string;
    account: StrategyAccount;
    campaign: StrategyCampaign;
    docs: KnowledgeDoc[];
    contacts: OutreachContactRow[];
    reviewedAt: string;
}) {
    const { supabase, workspaceId, userId, account, campaign, docs, contacts, reviewedAt } = input;
    const citations = docs.map((doc) => ({
        url: doc.canonical_url,
        title: doc.title,
        excerpt: doc.excerpt?.slice(0, 240) ?? null,
    }));

    const { data: existingStrategyData, error: strategyLookupError } = await supabase
        .from("outreach_strategies" as never)
        .select("*" as never)
        .eq("account_id" as never, account.id as never)
        .eq("workspace_id" as never, workspaceId as never)
        .maybeSingle();
    if (strategyLookupError) throw new Error(strategyLookupError.message);

    let strategy = existingStrategyData as unknown as OutreachStrategyRow | null;
    if (!strategy) {
        const { data: insertedStrategy, error: strategyError } = await supabase.from("outreach_strategies" as never).insert({
            workspace_id: workspaceId,
            campaign_id: account.campaign_id,
            account_id: account.id,
            review_status: "pending",
            account_summary: account.fit_summary ?? account.why_now_trigger ?? `${account.name}${account.domain ? ` (${account.domain})` : ""}`,
            fit_reasons: [account.fit_summary ?? campaign.icp_description].filter(Boolean).slice(0, 3),
            trigger_event: account.why_now_trigger,
            offer_angle: campaign.brief.slice(0, 1000),
            risk_flags: ["Contacts and lawful basis still require review before dispatch."],
            citations,
            generated_by: "operator_review",
            metadata: {
                approved_account_at: reviewedAt,
                approved_by_profile_id: userId,
                website_url: account.website_url,
                fit_score: account.fit_score,
            },
        } as never).select("*" as never).single();
        if (strategyError) throw new Error(strategyError.message);
        strategy = insertedStrategy as unknown as OutreachStrategyRow;
    }

    const contact = primaryContact(contacts);
    const contactEmail = normalizeOutreachEmail(contact?.email);
    if (!contact?.id || !contactEmail) {
        return { strategyId: strategy.id, sequenceId: null, draftCount: 0, warning: "No email contact is available for this selected prospect." };
    }

    const { data: senderSettingsData, error: senderSettingsError } = await supabase
        .from("outreach_workspace_settings" as never)
        .select("from_name" as never)
        .eq("workspace_id" as never, workspaceId as never)
        .maybeSingle();
    if (senderSettingsError) throw new Error(senderSettingsError.message);
    const senderName = resolveOutreachSenderName(
        (senderSettingsData as unknown as Pick<OutreachWorkspaceSettingsRow, "from_name"> | null)?.from_name,
        process.env.OUTREACH_FROM_NAME,
    );
    if (!senderName) {
        return {
            strategyId: strategy.id,
            sequenceId: null,
            draftCount: 0,
            warning: "Configure the workspace outreach sender name before generating message drafts.",
        };
    }

    const { data: existingSequenceData, error: sequenceLookupError } = await supabase
        .from("outreach_sequences" as never)
        .select("id" as never)
        .eq("strategy_id" as never, strategy.id as never)
        .eq("workspace_id" as never, workspaceId as never)
        .maybeSingle();
    if (sequenceLookupError) throw new Error(sequenceLookupError.message);

    const existingSequence = existingSequenceData as unknown as { id: string } | null;
    let sequence = existingSequence;
    if (existingSequence) {
        const { data: existingMessages } = await supabase
            .from("outreach_messages" as never)
            .select("id" as never)
            .eq("sequence_id" as never, existingSequence.id as never)
            .eq("workspace_id" as never, workspaceId as never);
        const existingDraftCount = ((existingMessages ?? []) as unknown[]).length;
        if (existingDraftCount > 0) {
            return { strategyId: strategy.id, sequenceId: existingSequence.id, draftCount: existingDraftCount, warning: null };
        }
    }

    if (!sequence) {
        const { data: sequenceData, error: sequenceError } = await supabase.from("outreach_sequences" as never).insert({
            workspace_id: workspaceId,
            campaign_id: account.campaign_id,
            strategy_id: strategy.id,
            name: `${account.name} - 3 touch intro`,
            status: "pending",
            metadata: {
                account_id: account.id,
                generated_by: "operator_review",
                generated_at: reviewedAt,
            },
        } as never).select("id" as never).single();
        if (sequenceError) throw new Error(sequenceError.message);
        sequence = sequenceData as unknown as { id: string };
    }

    // Attempt Gemini-driven sequence generation first if AI is enabled
    let drafts: Array<{ delayDays: number; objective: string; subject: string; bodyText: string; complianceFlags?: string[] }> | null = null;
    try {
        await assertWorkspaceAiEnabled();
        const aiResult = await generateOutreachSequenceWithGemini({
            workspaceId,
            userId,
            senderName,
            account: {
                id: account.id,
                campaign_id: account.campaign_id,
                name: account.name,
                domain: account.domain,
                website_url: account.website_url,
                fit_score: account.fit_score,
                fit_summary: account.fit_summary,
                why_now_trigger: account.why_now_trigger,
            },
            campaign,
            docs,
            contacts,
        });

        if (aiResult.data && aiResult.data.steps) {
            drafts = aiResult.data.steps.map((step) => ({
                delayDays: step.delayDays,
                objective: step.objective,
                subject: step.subject,
                bodyText: step.bodyText,
                complianceFlags: step.complianceFlags,
            }));
            console.info(`[outreach-ai] Gemini-driven sequence successfully generated for ${account.name}.`);
        } else if (aiResult.error) {
            console.warn(`[outreach-ai] Gemini sequence generation returned error: ${aiResult.error}. Falling back to deterministic templates.`);
        }
    } catch (err) {
        console.info(`[outreach-ai] AI not enabled or failed: ${err instanceof Error ? err.message : String(err)}. Using deterministic templates.`);
    }

    if (!drafts) {
        drafts = buildSequenceDrafts({ account, campaign, docs, senderName });
    }

    let draftCount = 0;
    for (const [index, draft] of drafts.entries()) {
        const position = index + 1;
        const { data: existingStepData, error: existingStepError } = await supabase
            .from("outreach_sequence_steps" as never)
            .select("id" as never)
            .eq("sequence_id" as never, sequence.id as never)
            .eq("position" as never, position as never)
            .maybeSingle();
        if (existingStepError) throw new Error(existingStepError.message);
        let step = existingStepData as unknown as { id: string } | null;
        if (!step) {
            const { data: stepData, error: stepError } = await supabase.from("outreach_sequence_steps" as never).insert({
                workspace_id: workspaceId,
                sequence_id: sequence.id,
                position,
                delay_days: draft.delayDays,
                objective: draft.objective,
                subject_template: draft.subject,
                body_template: draft.bodyText,
                metadata: { generated_by: "operator_review" },
            } as never).select("id" as never).single();
            if (stepError) throw new Error(stepError.message);
            step = stepData as unknown as { id: string };
        }
        const { error: messageError } = await supabase.from("outreach_messages" as never).insert({
            workspace_id: workspaceId,
            campaign_id: account.campaign_id,
            account_id: account.id,
            contact_id: contact.id,
            sequence_id: sequence.id,
            step_id: step.id,
            status: "draft",
            subject: draft.subject,
            preview_text: draft.bodyText.split("\n").find(Boolean)?.slice(0, 140) ?? null,
            body_text: draft.bodyText,
            body_html: paragraphsToHtml(draft.bodyText),
            personalization_basis: [account.fit_summary, docs[0]?.canonical_url].filter(Boolean).join("\n"),
            risk_score: 20 + (position * 5),
            metadata: {
                generated_by: "operator_review",
                generated_at: reviewedAt,
                delay_days: draft.delayDays,
                contact_email: contactEmail,
                compliance_flags: draft.complianceFlags ?? [],
            },
        } as never);
        if (messageError) throw new Error(messageError.message);
        draftCount += 1;
    }

    return { strategyId: strategy.id, sequenceId: sequence.id, draftCount, warning: null };
}

export async function reviewOutreachAccountAction(_prev: OutreachActionState, formData: FormData): Promise<OutreachActionState> {
    const workspace = await requireWorkspace();
    if ("error" in workspace) return { error: workspace.error, success: false };
    const parsed = outreachReviewSchema.safeParse({
        id: formData.get("id"),
        status: reviewStatusFromFormData(formData),
        note: formData.get("note"),
    });
    if (!parsed.success) return { error: "Choose Approve, Reject, or Needs work before saving this prospect.", success: false };
    const supabase = await createClient();

    const { data: accountData, error: accountError } = await supabase
        .from("outreach_prospect_accounts" as never)
        .select("id,campaign_id,name,domain,website_url,fit_score,fit_summary,why_now_trigger,metadata" as never)
        .eq("id" as never, parsed.data.id as never)
        .eq("workspace_id" as never, workspace.workspaceId as never)
        .maybeSingle();

    if (accountError) return { error: accountError.message, success: false };
    const account = accountData as unknown as {
        id: string;
        campaign_id: string | null;
        name: string;
        domain: string | null;
        website_url: string | null;
        fit_score: number;
        fit_summary: string | null;
        why_now_trigger: string | null;
        metadata: Json;
    } | null;
    if (!account) return { error: "Prospect was not found in the active workspace.", success: false };
    if (!account.campaign_id) return { error: "Prospect is not linked to a campaign.", success: false };

    if (parsed.data.status === "approved") {
        const { data: approvalContactsData, error: approvalContactsError } = await supabase
            .from("outreach_contacts" as never)
            .select("email,suppressed_at" as never)
            .eq("account_id" as never, account.id as never)
            .eq("workspace_id" as never, workspace.workspaceId as never)
            .limit(10);
        if (approvalContactsError) return { error: approvalContactsError.message, success: false };
        const approvalContacts = ((approvalContactsData ?? []) as unknown) as Array<Pick<OutreachContactRow, "email" | "suppressed_at">>;
        if (!approvalContacts.some(hasValidOutreachEmail)) {
            return { error: "This prospect cannot be selected until discovery finds a valid, unsuppressed email address.", success: false };
        }
    }

    const reviewNote = parsed.data.note || null;
    const reviewedAt = new Date().toISOString();
    const metadata = {
        ...asRecord(account.metadata),
        review_note: reviewNote,
        reviewed_at: reviewedAt,
        reviewed_by: workspace.userId,
    };

    const { data: updatedData, error } = await supabase.from("outreach_prospect_accounts" as never).update({
        review_status: parsed.data.status,
        stage: parsed.data.status === "approved" ? "selected" : "discovered",
        approved_by_profile_id: parsed.data.status === "approved" ? workspace.userId : null,
        approved_at: parsed.data.status === "approved" ? reviewedAt : null,
        metadata,
    } as never)
        .eq("id" as never, parsed.data.id as never)
        .eq("workspace_id" as never, workspace.workspaceId as never)
        .select("id" as never)
        .maybeSingle();
    if (error) return { error: error.message, success: false };
    if (!updatedData) return { error: "Prospect review did not update a row.", success: false };

    if (parsed.data.status === "approved") {
        const [{ data: campaignData }, { data: docsData }, { data: contactsData }] = await Promise.all([
            supabase
                .from("outreach_campaigns" as never)
                .select("id,name,brief,icp_description" as never)
                .eq("id" as never, account.campaign_id as never)
                .eq("workspace_id" as never, workspace.workspaceId as never)
                .maybeSingle(),
            supabase
                .from("outreach_knowledge_documents" as never)
                .select("canonical_url,title,excerpt" as never)
                .eq("account_id" as never, account.id as never)
                .eq("workspace_id" as never, workspace.workspaceId as never)
                .limit(5),
            supabase
                .from("outreach_contacts" as never)
                .select("*" as never)
                .eq("account_id" as never, account.id as never)
                .eq("workspace_id" as never, workspace.workspaceId as never)
                .is("suppressed_at" as never, null)
                .limit(10),
        ]);

        const campaign = campaignData as unknown as StrategyCampaign | null;
        const docs = ((docsData ?? []) as unknown) as Array<{ canonical_url: string; title: string; excerpt: string | null }>;
        const contacts = ((contactsData ?? []) as unknown) as OutreachContactRow[];
        if (!campaign) return { error: "Campaign was not found for this selected prospect.", success: false };

        try {
            await ensureStrategySequenceAndDrafts({
                supabase,
                workspaceId: workspace.workspaceId,
                userId: workspace.userId,
                account: { ...account, campaign_id: account.campaign_id },
                campaign,
                docs,
                contacts,
                reviewedAt,
            });
        } catch (generationError) {
            return { error: generationError instanceof Error ? generationError.message : String(generationError), success: false };
        }

        await supabase.from("outreach_campaigns" as never).update({
            status: "strategy",
        } as never)
            .eq("id" as never, account.campaign_id as never)
            .eq("workspace_id" as never, workspace.workspaceId as never)
            .in("status" as never, ["draft", "discovering", "reviewing"] as never);
    }

    await supabase.from("outreach_audit_events" as never).insert({
        workspace_id: workspace.workspaceId,
        campaign_id: account.campaign_id,
        account_id: account.id,
        actor_profile_id: workspace.userId,
        event_type: "account_reviewed",
        event_summary: `${parsed.data.status === "approved" ? "Approved" : parsed.data.status === "rejected" ? "Rejected" : "Marked for changes"} prospect ${account.name}.`,
        metadata: { status: parsed.data.status, note: reviewNote },
    } as never);

    revalidatePath("/dashboard/outreach");
    return { error: null, success: true };
}

export async function executeOutreachAccountSequenceAction(_prev: OutreachActionState, formData: FormData): Promise<OutreachActionState> {
    const workspace = await requireWorkspace();
    if ("error" in workspace) return { error: workspace.error, success: false };

    const accountId = String(formData.get("accountId") ?? "");
    const certifyManualWarranty = formData.get("certifyManualWarranty") === "true";
    if (!/^[0-9a-f-]{36}$/i.test(accountId)) return { error: "Selected prospect is invalid.", success: false };

    const supabase = await createClient();
    const { data: accountData, error: accountError } = await supabase
        .from("outreach_prospect_accounts" as never)
        .select("id,campaign_id,name,review_status" as never)
        .eq("id" as never, accountId as never)
        .eq("workspace_id" as never, workspace.workspaceId as never)
        .maybeSingle();

    if (accountError) return { error: accountError.message, success: false };
    const account = accountData as unknown as { id: string; campaign_id: string | null; name: string; review_status: OutreachReviewStatus } | null;
    if (!account) return { error: "Selected prospect was not found.", success: false };
    if (account.review_status !== "approved") return { error: "Prospect must be selected before execution.", success: false };
    if (!account.campaign_id) return { error: "Selected prospect is not linked to a campaign.", success: false };

    const { data: messagesData, error: messagesError } = await supabase
        .from("outreach_messages" as never)
        .select("id,campaign_id,account_id,contact_id,sequence_id,step_id,status,subject" as never)
        .eq("workspace_id" as never, workspace.workspaceId as never)
        .eq("account_id" as never, account.id as never)
        .in("status" as never, ["draft", "approved", "scheduled"] as never);
    if (messagesError) return { error: messagesError.message, success: false };

    const messages = ((messagesData ?? []) as unknown) as Array<Pick<OutreachMessageRow, "id" | "campaign_id" | "account_id" | "contact_id" | "sequence_id" | "step_id" | "status" | "subject">>;
    if (messages.length === 0) return { error: "No draft email sequence exists for this selected prospect yet.", success: false };
    if (messages.some((message) => message.status === "scheduled")) return { error: "This prospect already has scheduled messages.", success: false };

    const stepIds = Array.from(new Set(messages.map((message) => message.step_id).filter((value): value is string => Boolean(value))));
    const { data: stepsData, error: stepsError } = stepIds.length
        ? await supabase.from("outreach_sequence_steps" as never).select("id,delay_days" as never).in("id" as never, stepIds as never)
        : { data: [], error: null };
    if (stepsError) return { error: stepsError.message, success: false };
    const stepDelayDays = new Map((((stepsData ?? []) as unknown) as Array<{ id: string; delay_days: number }>).map((step) => [step.id, step.delay_days]));
    const sequenceIds = Array.from(new Set(messages.map((message) => message.sequence_id).filter((value): value is string => Boolean(value))));
    const contactIds = Array.from(new Set(messages.map((message) => message.contact_id)));
    const { data: executionContactsData, error: executionContactsError } = contactIds.length
        ? await supabase
            .from("outreach_contacts" as never)
            .select("id,email,lawful_basis,suppressed_at" as never)
            .eq("workspace_id" as never, workspace.workspaceId as never)
            .in("id" as never, contactIds as never)
        : { data: [], error: null };
    if (executionContactsError) return { error: executionContactsError.message, success: false };
    const executionContacts = ((executionContactsData ?? []) as unknown) as Array<Pick<OutreachContactRow, "id" | "email" | "lawful_basis" | "suppressed_at">>;
    const executionContactById = new Map(executionContacts.map((contact) => [contact.id, contact]));
    const invalidContact = contactIds.find((contactId) => !hasValidOutreachEmail(executionContactById.get(contactId) ?? { email: null, suppressed_at: null }));
    if (invalidContact) {
        return { error: "This sequence cannot be executed because at least one message is missing a valid, unsuppressed email contact.", success: false };
    }

    const { data: settingsData } = await supabase.from("outreach_workspace_settings" as never).select("allowed_lawful_bases" as never).eq("workspace_id" as never, workspace.workspaceId as never).maybeSingle();
    const settings = (settingsData as unknown) as Pick<OutreachWorkspaceSettingsRow, "allowed_lawful_bases"> | null;

    const contactsToUpdateToManualWarranty: string[] = [];
    const contactsToSimplyApprove: string[] = [];

    const now = new Date();
    const nowIso = now.toISOString();

    for (const contact of executionContacts) {
        const eligibility = evaluateContactEligibility({ contact: { ...contact, review_status: "approved" }, settings });
        if (eligibility.allowed) {
            contactsToSimplyApprove.push(contact.id);
        } else if (certifyManualWarranty) {
            contactsToUpdateToManualWarranty.push(contact.id);
        } else {
            return { error: `Contact ${contact.email} lacks a valid lawful basis and manual warranty was not certified.`, success: false };
        }
    }

    if (contactsToSimplyApprove.length > 0) {
        const { error: contactsError } = await supabase.from("outreach_contacts" as never).update({
            review_status: "approved",
        } as never)
            .eq("workspace_id" as never, workspace.workspaceId as never)
            .in("id" as never, contactsToSimplyApprove as never);
        if (contactsError) return { error: contactsError.message, success: false };
    }

    if (contactsToUpdateToManualWarranty.length > 0) {
        const { error: contactsError } = await supabase.from("outreach_contacts" as never).update({
            review_status: "approved",
            lawful_basis: "manual_warranty",
            lawful_basis_note: "Operator pressed Execute for the selected outreach sequence.",
            lawful_basis_approved_by: workspace.userId,
            lawful_basis_approved_at: nowIso,
        } as never)
            .eq("workspace_id" as never, workspace.workspaceId as never)
            .in("id" as never, contactsToUpdateToManualWarranty as never);
        if (contactsError) return { error: contactsError.message, success: false };
    }

    await supabase.from("outreach_strategies" as never).update({
        review_status: "approved",
        approved_by_profile_id: workspace.userId,
        approved_at: nowIso,
    } as never)
        .eq("workspace_id" as never, workspace.workspaceId as never)
        .eq("account_id" as never, account.id as never);

    if (sequenceIds.length > 0) {
        await supabase.from("outreach_sequences" as never).update({
            status: "approved",
        } as never)
            .eq("workspace_id" as never, workspace.workspaceId as never)
            .in("id" as never, sequenceIds as never);
    }

    let scheduled = 0;
    let immediateDispatchJobId: string | null = null;
    for (const message of messages) {
        const delayDays = message.step_id ? stepDelayDays.get(message.step_id) ?? 0 : 0;
        const scheduledFor = addDays(now, delayDays).toISOString();
        const idempotencyKey = messageIdempotencyKey(message.id);
        const { error: messageError } = await supabase.from("outreach_messages" as never).update({
            status: "scheduled" satisfies OutreachMessageStatus,
            approved_by_profile_id: workspace.userId,
            approved_at: nowIso,
            scheduled_for: scheduledFor,
            idempotency_key: idempotencyKey,
            metadata: {
                scheduled_by_profile_id: workspace.userId,
                scheduled_at: nowIso,
                execute_action: "selected_prospect_sequence",
            },
        } as never).eq("id" as never, message.id as never).eq("workspace_id" as never, workspace.workspaceId as never);
        if (messageError) return { error: messageError.message, success: false };

        const { data: dispatchData, error: dispatchError } = await supabase.from("outreach_dispatch_jobs" as never).insert({
            workspace_id: workspace.workspaceId,
            campaign_id: account.campaign_id,
            message_id: message.id,
            status: "queued",
            priority: 100,
            run_after: scheduledFor,
            idempotency_key: idempotencyKey,
        } as never).select("id" as never).maybeSingle();
        if (dispatchError && !dispatchError.message.toLowerCase().includes("duplicate")) {
            return { error: dispatchError.message, success: false };
        }
        if (delayDays === 0 && !immediateDispatchJobId) {
            immediateDispatchJobId = ((dispatchData as unknown) as { id?: string } | null)?.id ?? null;
            if (!immediateDispatchJobId) {
                const { data: existingDispatchData } = await supabase
                    .from("outreach_dispatch_jobs" as never)
                    .select("id" as never)
                    .eq("message_id" as never, message.id as never)
                    .eq("status" as never, "queued" as never)
                    .maybeSingle();
                immediateDispatchJobId = ((existingDispatchData as unknown) as { id?: string } | null)?.id ?? null;
            }
        }
        scheduled += 1;
    }

    await supabase.from("outreach_campaigns" as never).update({
        status: "scheduled",
    } as never).eq("id" as never, account.campaign_id as never).eq("workspace_id" as never, workspace.workspaceId as never);

    let immediateDispatchResult: Awaited<ReturnType<typeof processOutreachDispatchJobById>> | null = null;
    if (immediateDispatchJobId) {
        immediateDispatchResult = await processOutreachDispatchJobById(
            immediateDispatchJobId,
            `outreach-execute-${workspace.userId}-${Date.now()}`,
        );
        if (!immediateDispatchResult.success) {
            return { error: `Sequence scheduled, but the first email was not sent: ${immediateDispatchResult.message}`, success: false };
        }
    }

    await supabase.from("outreach_audit_events" as never).insert({
        workspace_id: workspace.workspaceId,
        campaign_id: account.campaign_id,
        account_id: account.id,
        actor_profile_id: workspace.userId,
        event_type: "sequence_executed",
        event_summary: immediateDispatchResult?.success
            ? `Sent the first email and scheduled ${Math.max(0, scheduled - 1)} follow-up messages for ${account.name}.`
            : `Scheduled ${scheduled} outreach messages for ${account.name}.`,
        metadata: {
            scheduled_messages: scheduled,
            executed_at: nowIso,
            immediate_dispatch_job_id: immediateDispatchJobId,
            immediate_dispatch_result: immediateDispatchResult,
        },
    } as never);

    revalidatePath("/dashboard/outreach");
    return { error: null, success: true };
}

async function cancelQueuedDispatchJobs(input: {
    supabase: SupabaseServerClient;
    workspaceId: string;
    userId: string;
    campaignId: string;
    accountId?: string | null;
    scopeLabel: string;
}) {
    const { supabase, workspaceId, userId, campaignId, accountId, scopeLabel } = input;
    const nowIso = new Date().toISOString();

    let messageIds: string[] | null = null;
    if (accountId) {
        const { data: accountMessagesData, error: accountMessagesError } = await supabase
            .from("outreach_messages" as never)
            .select("id" as never)
            .eq("workspace_id" as never, workspaceId as never)
            .eq("campaign_id" as never, campaignId as never)
            .eq("account_id" as never, accountId as never)
            .in("status" as never, ["approved", "scheduled"] as never);
        if (accountMessagesError) throw new Error(accountMessagesError.message);
        messageIds = (((accountMessagesData ?? []) as unknown) as Array<{ id: string }>).map((message) => message.id);
        if (messageIds.length === 0) return { cancelledJobs: 0, stoppedMessages: 0 };
    }

    let jobsQuery = supabase
        .from("outreach_dispatch_jobs" as never)
        .select("id,message_id" as never)
        .eq("workspace_id" as never, workspaceId as never)
        .eq("campaign_id" as never, campaignId as never)
        .eq("status" as never, "queued" as never);
    if (messageIds) {
        jobsQuery = jobsQuery.in("message_id" as never, messageIds as never);
    }
    const { data: jobsData, error: jobsError } = await jobsQuery;
    if (jobsError) throw new Error(jobsError.message);

    const jobs = ((jobsData ?? []) as unknown) as Array<{ id: string; message_id: string }>;
    const jobIds = jobs.map((job) => job.id);
    const stoppedMessageIds = Array.from(new Set(jobs.map((job) => job.message_id).filter(Boolean)));
    if (jobIds.length === 0) return { cancelledJobs: 0, stoppedMessages: 0 };

    const { error: cancelJobsError } = await supabase.from("outreach_dispatch_jobs" as never).update({
        status: "cancelled",
        completed_at: nowIso,
        error_message: `Cancelled by operator from Outreach dashboard (${scopeLabel}).`,
        result_summary: {
            cancelled_by_profile_id: userId,
            cancelled_at: nowIso,
            cancellation_scope: accountId ? "account" : "campaign",
        },
    } as never).in("id" as never, jobIds as never).eq("workspace_id" as never, workspaceId as never);
    if (cancelJobsError) throw new Error(cancelJobsError.message);

    const { error: stopMessagesError } = await supabase.from("outreach_messages" as never).update({
        status: "stopped" satisfies OutreachMessageStatus,
        last_event_at: nowIso,
    } as never).in("id" as never, stoppedMessageIds as never).eq("workspace_id" as never, workspaceId as never);
    if (stopMessagesError) throw new Error(stopMessagesError.message);

    await supabase.from("outreach_audit_events" as never).insert({
        workspace_id: workspaceId,
        campaign_id: campaignId,
        account_id: accountId ?? null,
        actor_profile_id: userId,
        event_type: accountId ? "account_schedule_cancelled" : "campaign_schedule_cancelled",
        event_summary: `Cancelled ${jobIds.length} queued outreach dispatch job${jobIds.length === 1 ? "" : "s"} for ${scopeLabel}.`,
        metadata: {
            cancelled_job_ids: jobIds,
            stopped_message_ids: stoppedMessageIds,
            cancelled_at: nowIso,
        },
    } as never);

    return { cancelledJobs: jobIds.length, stoppedMessages: stoppedMessageIds.length };
}

export async function cancelOutreachCampaignScheduleAction(_prev: OutreachActionState, formData: FormData): Promise<OutreachActionState> {
    const workspace = await requireWorkspace();
    if ("error" in workspace) return { error: workspace.error, success: false };

    const campaignId = String(formData.get("campaignId") ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(campaignId)) return { error: "Campaign selection is invalid.", success: false };

    const supabase = await createClient();
    const { data: campaignData, error: campaignError } = await supabase
        .from("outreach_campaigns" as never)
        .select("id,name,status" as never)
        .eq("id" as never, campaignId as never)
        .eq("workspace_id" as never, workspace.workspaceId as never)
        .maybeSingle();
    if (campaignError) return { error: campaignError.message, success: false };
    const campaign = campaignData as unknown as { id: string; name: string; status: OutreachCampaignRow["status"] } | null;
    if (!campaign) return { error: "Campaign not found.", success: false };

    try {
        const result = await cancelQueuedDispatchJobs({
            supabase,
            workspaceId: workspace.workspaceId,
            userId: workspace.userId,
            campaignId,
            scopeLabel: campaign.name,
        });
        await supabase.from("outreach_campaigns" as never).update({
            status: "paused",
            paused_reason: result.cancelledJobs > 0
                ? `Operator cancelled ${result.cancelledJobs} queued outreach dispatch job${result.cancelledJobs === 1 ? "" : "s"}.`
                : "Operator checked cancellation; no queued dispatch jobs were pending.",
        } as never).eq("id" as never, campaignId as never).eq("workspace_id" as never, workspace.workspaceId as never);
    } catch (error) {
        return { error: error instanceof Error ? error.message : String(error), success: false };
    }

    revalidatePath("/dashboard/outreach");
    return { error: null, success: true };
}

export async function cancelOutreachAccountScheduleAction(_prev: OutreachActionState, formData: FormData): Promise<OutreachActionState> {
    const workspace = await requireWorkspace();
    if ("error" in workspace) return { error: workspace.error, success: false };

    const accountId = String(formData.get("accountId") ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(accountId)) return { error: "Selected prospect is invalid.", success: false };

    const supabase = await createClient();
    const { data: accountData, error: accountError } = await supabase
        .from("outreach_prospect_accounts" as never)
        .select("id,campaign_id,name" as never)
        .eq("id" as never, accountId as never)
        .eq("workspace_id" as never, workspace.workspaceId as never)
        .maybeSingle();
    if (accountError) return { error: accountError.message, success: false };
    const account = accountData as unknown as { id: string; campaign_id: string | null; name: string } | null;
    if (!account?.campaign_id) return { error: "Selected prospect was not found or is not linked to a campaign.", success: false };

    try {
        await cancelQueuedDispatchJobs({
            supabase,
            workspaceId: workspace.workspaceId,
            userId: workspace.userId,
            campaignId: account.campaign_id,
            accountId: account.id,
            scopeLabel: account.name,
        });
    } catch (error) {
        return { error: error instanceof Error ? error.message : String(error), success: false };
    }

    revalidatePath("/dashboard/outreach");
    return { error: null, success: true };
}

export async function queueOutreachCampaignDiscoveryAction(_prev: OutreachActionState, formData: FormData): Promise<OutreachActionState> {
    const workspace = await requireWorkspace();
    if ("error" in workspace) return { error: workspace.error, success: false };

    const campaignId = String(formData.get("campaignId") ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(campaignId)) {
        return { error: "Campaign selection is invalid.", success: false };
    }

    const supabase = await createClient();
    const { data: campaignData, error: campaignError } = await supabase
        .from("outreach_campaigns" as never)
        .select("id,brief,icp_description,target_sectors,target_geographies,exclusions" as never)
        .eq("id" as never, campaignId as never)
        .eq("workspace_id" as never, workspace.workspaceId as never)
        .maybeSingle();

    if (campaignError) return { error: campaignError.message, success: false };
    const campaign = campaignData as unknown as {
        id: string;
        brief: string;
        icp_description: string;
        target_sectors: string[];
        target_geographies: string[];
        exclusions: string[];
    } | null;
    if (!campaign) return { error: "Campaign not found.", success: false };

    const queries = buildOutreachSearchQueries({
        brief: campaign.brief,
        icpDescription: campaign.icp_description,
        sectors: campaign.target_sectors,
        geographies: campaign.target_geographies,
        exclusions: campaign.exclusions,
    });
    const jobs: Array<Record<string, unknown>> = queries.map((query, index) => ({
        workspace_id: workspace.workspaceId,
        campaign_id: campaign.id,
        job_type: "search",
        priority: 100 + index,
        input: {
            query,
            requeued_by: workspace.userId,
            requeued_at: new Date().toISOString(),
        },
    }));
    if (shouldQueueApifyMaps(formData)) {
        jobs.push(...buildApifyMapsJobs({
            workspaceId: workspace.workspaceId,
            campaignId: campaign.id,
            queries,
            brief: campaign.brief,
            icpDescription: campaign.icp_description,
            sectors: campaign.target_sectors,
            geographies: campaign.target_geographies,
            exclusions: campaign.exclusions,
            userId: workspace.userId,
        }));
    }

    const { error: jobError } = await supabase.from("outreach_discovery_jobs" as never).insert(jobs as never);
    if (jobError) return { error: jobError.message, success: false };

    await supabase.from("outreach_campaigns" as never).update({
        status: "discovering",
    } as never).eq("id" as never, campaign.id as never).eq("workspace_id" as never, workspace.workspaceId as never);

    await supabase.from("outreach_audit_events" as never).insert({
        workspace_id: workspace.workspaceId,
        campaign_id: campaign.id,
        actor_profile_id: workspace.userId,
        event_type: "discovery_queued",
        event_summary: `Queued ${jobs.length} discovery search jobs from existing campaign brief.`,
        metadata: { queries, apify_maps_enabled: shouldQueueApifyMaps(formData) },
    } as never);

    revalidatePath("/dashboard/outreach");
    return { error: null, success: true };
}

export async function generateAiOutreachSequenceAction(_prev: OutreachActionState, formData: FormData): Promise<OutreachActionState> {
    const workspace = await requireWorkspace();
    if ("error" in workspace) return { error: workspace.error, success: false };

    const accountId = String(formData.get("accountId") ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(accountId)) return { error: "Selected prospect is invalid.", success: false };

    const supabase = await createClient();
    const { data: accountData, error: accountError } = await supabase
        .from("outreach_prospect_accounts" as never)
        .select("id,campaign_id,name,domain,website_url,fit_score,fit_summary,why_now_trigger,metadata" as never)
        .eq("id" as never, accountId as never)
        .eq("workspace_id" as never, workspace.workspaceId as never)
        .maybeSingle();

    if (accountError) return { error: accountError.message, success: false };
    const account = accountData as unknown as StrategyAccount | null;
    if (!account) return { error: "Selected prospect was not found.", success: false };
    if (!account.campaign_id) return { error: "Selected prospect is not linked to a campaign.", success: false };

    const [{ data: campaignData }, { data: docsData }, { data: contactsData }] = await Promise.all([
        supabase
            .from("outreach_campaigns" as never)
            .select("id,name,brief,icp_description" as never)
            .eq("id" as never, account.campaign_id as never)
            .eq("workspace_id" as never, workspace.workspaceId as never)
            .maybeSingle(),
        supabase
            .from("outreach_knowledge_documents" as never)
            .select("canonical_url,title,excerpt" as never)
            .eq("account_id" as never, account.id as never)
            .eq("workspace_id" as never, workspace.workspaceId as never)
            .limit(5),
        supabase
            .from("outreach_contacts" as never)
            .select("*" as never)
            .eq("account_id" as never, account.id as never)
            .eq("workspace_id" as never, workspace.workspaceId as never)
            .is("suppressed_at" as never, null)
            .limit(10),
    ]);

    const campaign = campaignData as unknown as StrategyCampaign | null;
    const docs = ((docsData ?? []) as unknown) as KnowledgeDoc[];
    const contacts = ((contactsData ?? []) as unknown) as OutreachContactRow[];
    if (!campaign) return { error: "Campaign was not found for this selected prospect.", success: false };

    try {
        const result = await ensureStrategySequenceAndDrafts({
            supabase,
            workspaceId: workspace.workspaceId,
            userId: workspace.userId,
            account,
            campaign,
            docs,
            contacts,
            reviewedAt: new Date().toISOString(),
        });

        if (result.warning) {
            return { error: result.warning, success: false };
        }

        revalidatePath("/dashboard/outreach");
        return { error: null, success: true };
    } catch (generationError) {
        return { error: generationError instanceof Error ? generationError.message : String(generationError), success: false };
    }
}

export async function queueLinkedinEnrichmentAction(_prev: OutreachActionState, formData: FormData): Promise<OutreachActionState> {
    const workspace = await requireWorkspace();
    if ("error" in workspace) return { error: workspace.error, success: false };
    if (!isApifyOutreachConfigured()) return { error: "Apify is not configured for outreach enrichment.", success: false };

    const campaignId = String(formData.get("campaignId") ?? "");
    const accountId = String(formData.get("accountId") ?? "");
    const contactId = String(formData.get("contactId") ?? "");
    const enrichmentKind = String(formData.get("enrichmentKind") ?? ""); // "profile" | "company" | "employees" | "posts"
    const targetUrl = String(formData.get("targetUrl") ?? "").trim();

    if (!/^[0-9a-f-]{36}$/i.test(campaignId)) return { error: "Campaign ID is invalid.", success: false };
    if (!/^[0-9a-f-]{36}$/i.test(accountId)) return { error: "Account ID is invalid.", success: false };
    if (contactId && !/^[0-9a-f-]{36}$/i.test(contactId)) return { error: "Contact ID is invalid.", success: false };
    if (!["profile", "company", "employees", "posts"].includes(enrichmentKind)) {
        return { error: "Invalid enrichment type.", success: false };
    }
    if (!targetUrl) return { error: "LinkedIn profile or company URL is required.", success: false };
    let normalizedTargetUrl: string;
    try {
        const parsedUrl = new URL(targetUrl);
        const host = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
        if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) {
            return { error: "Only LinkedIn URLs are accepted for LinkedIn enrichment.", success: false };
        }
        normalizedTargetUrl = parsedUrl.toString();
    } catch {
        return { error: "LinkedIn URL is invalid.", success: false };
    }

    const supabase = await createClient();
    const { data: accountData, error: accountError } = await supabase
        .from("outreach_prospect_accounts" as never)
        .select("id,campaign_id,review_status" as never)
        .eq("workspace_id" as never, workspace.workspaceId as never)
        .eq("id" as never, accountId as never)
        .maybeSingle();
    if (accountError) return { error: accountError.message, success: false };
    const account = accountData as unknown as { id: string; campaign_id: string | null; review_status: string | null } | null;
    if (!account || account.campaign_id !== campaignId) return { error: "Prospect account does not belong to the selected campaign.", success: false };
    if (!["approved", "pending", "needs_changes"].includes(account.review_status ?? "")) {
        return { error: "Prospect account is not eligible for enrichment.", success: false };
    }
    if (contactId) {
        const { data: contactData, error: contactError } = await supabase
            .from("outreach_contacts" as never)
            .select("id" as never)
            .eq("workspace_id" as never, workspace.workspaceId as never)
            .eq("account_id" as never, accountId as never)
            .eq("id" as never, contactId as never)
            .maybeSingle();
        if (contactError) return { error: contactError.message, success: false };
        if (!contactData) return { error: "Selected contact does not belong to the prospect account.", success: false };
    }

    let provider = "apify_linkedin_company";
    let inputPayload: Record<string, unknown> = {
        account_id: accountId,
        company_url: normalizedTargetUrl,
        provider,
    };

    if (enrichmentKind === "profile") {
        provider = "apify_linkedin_profile";
        inputPayload = {
            account_id: accountId,
            contact_id: contactId || null,
            profile_url: normalizedTargetUrl,
            provider,
        };
    } else if (enrichmentKind === "employees") {
        provider = "apify_linkedin_employees";
        inputPayload = {
            account_id: accountId,
            company_url: normalizedTargetUrl,
            provider,
        };
    } else if (enrichmentKind === "posts") {
        provider = "apify_linkedin_posts";
        inputPayload = {
            account_id: accountId,
            contact_id: contactId || null,
            profile_url: contactId ? normalizedTargetUrl : null,
            company_url: !contactId ? normalizedTargetUrl : null,
            provider,
        };
    }

    const { error: jobError } = await supabase.from("outreach_discovery_jobs" as never).insert({
        workspace_id: workspace.workspaceId,
        campaign_id: campaignId,
        job_type: "extract",
        priority: 140,
        input: inputPayload,
    } as never);

    if (jobError) return { error: jobError.message, success: false };

    await supabase.from("outreach_audit_events" as never).insert({
        workspace_id: workspace.workspaceId,
        campaign_id: campaignId,
        actor_profile_id: workspace.userId,
        event_type: "linkedin_enrichment_queued",
        event_summary: `Queued Apify LinkedIn ${enrichmentKind} enrichment for ${normalizedTargetUrl}.`,
        metadata: { enrichment_kind: enrichmentKind, target_url: normalizedTargetUrl },
    } as never);

    revalidatePath("/dashboard/outreach");
    return { error: null, success: true };
}

export async function bulkQueueLinkedinEnrichmentAction(_prev: OutreachActionState, formData: FormData): Promise<OutreachActionState> {
    const workspace = await requireWorkspace();
    if ("error" in workspace) return { error: workspace.error, success: false };
    if (!isApifyOutreachConfigured()) return { error: "Apify is not configured for outreach enrichment.", success: false };

    const campaignId = String(formData.get("campaignId") ?? "");
    const enrichmentKind = String(formData.get("enrichmentKind") ?? "");
    const rawAccountIds = String(formData.get("accountIds") ?? "[]");

    if (!["profile", "company", "employees", "posts"].includes(enrichmentKind)) {
        return { error: "Invalid enrichment type.", success: false };
    }

    let accountIds: string[];
    try {
        accountIds = JSON.parse(rawAccountIds);
        if (!Array.isArray(accountIds)) throw new Error("accountIds must be an array.");
    } catch {
        return { error: "Invalid accountIds payload.", success: false };
    }

    if (accountIds.length === 0) return { error: "No accounts provided.", success: false };
    if (accountIds.length > 50) return { error: "Batch size limit exceeded (max 50).", success: false };

    const supabase = await createClient();
    const { data: validAccounts } = await supabase
        .from("outreach_prospect_accounts" as never)
        .select("id, campaign_id, website_url, domain, metadata" as never)
        .eq("workspace_id" as never, workspace.workspaceId as never)
        .in("id" as never, accountIds as never);

    if (!validAccounts || validAccounts.length === 0) return { error: "No valid accounts found.", success: false };

    const jobsToInsert: Array<Record<string, unknown>> = [];

    for (const account of validAccounts as unknown as Array<{ id: string; campaign_id: string | null; website_url: string | null; domain: string | null; metadata: unknown }>) {
        let normalizedTargetUrl = "";
        try {
            const meta = account.metadata as Record<string, unknown>;
            const rawUrl = (meta?.linkedin_url as string | undefined) || account.website_url || (account.domain ? `https://${account.domain}` : "");
            if (!rawUrl) continue;

            const parsedUrl = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
            if (enrichmentKind !== "company" && !parsedUrl.hostname.includes("linkedin.com")) continue;
            normalizedTargetUrl = parsedUrl.toString();
        } catch {
            continue;
        }

        let provider = "apify_linkedin_company";
        let inputPayload: Record<string, unknown> = {
            account_id: account.id,
            company_url: normalizedTargetUrl,
            provider,
        };

        if (enrichmentKind === "profile") {
            provider = "apify_linkedin_profile";
            inputPayload = {
                account_id: account.id,
                contact_id: null,
                profile_url: normalizedTargetUrl,
                provider,
            };
        } else if (enrichmentKind === "employees") {
            provider = "apify_linkedin_employees";
            inputPayload = {
                account_id: account.id,
                company_url: normalizedTargetUrl,
                provider,
            };
        } else if (enrichmentKind === "posts") {
            provider = "apify_linkedin_posts";
            inputPayload = {
                account_id: account.id,
                contact_id: null,
                profile_url: null,
                company_url: normalizedTargetUrl,
                provider,
            };
        }

        jobsToInsert.push({
            workspace_id: workspace.workspaceId,
            campaign_id: account.campaign_id || campaignId || null,
            job_type: "extract",
            priority: 140,
            input: inputPayload,
        });
    }

    if (jobsToInsert.length === 0) return { error: "No valid targets to enqueue.", success: false };

    const { error: jobError } = await supabase.from("outreach_discovery_jobs" as never).insert(jobsToInsert as never);
    if (jobError) return { error: jobError.message, success: false };

    await supabase.from("outreach_audit_events" as never).insert({
        workspace_id: workspace.workspaceId,
        campaign_id: campaignId,
        actor_profile_id: workspace.userId,
        event_type: "linkedin_enrichment_queued",
        event_summary: `Queued Apify LinkedIn bulk ${enrichmentKind} enrichment for ${jobsToInsert.length} targets.`,
        metadata: { enrichment_kind: enrichmentKind, count: jobsToInsert.length },
    } as never);

    revalidatePath("/dashboard/outreach");
    return { error: null, success: true };
}

export async function getContactsForAccountAction(accountId: string): Promise<Array<{
    id: string;
    full_name: string | null;
    email: string | null;
    role_title: string | null;
    source_url: string | null;
}>> {
    const workspace = await requireWorkspace();
    if ("error" in workspace) return [];
    const supabase = await createClient();
    const { data } = await supabase
        .from("outreach_contacts" as never)
        .select("id,full_name,email,role_title,source_url" as never)
        .eq("account_id" as never, accountId as never)
        .eq("workspace_id" as never, workspace.workspaceId as never);
    return (data || []) as unknown as Array<{
        id: string;
        full_name: string | null;
        email: string | null;
        role_title: string | null;
        source_url: string | null;
    }>;
}

export async function bulkApproveOutreachAccountsAction(_prev: OutreachActionState, formData: FormData): Promise<OutreachActionState> {
    const rawIds = String(formData.get("accountIds") ?? "[]");
    let accountIds: string[];
    try {
        accountIds = JSON.parse(rawIds);
    } catch {
        return { error: "Invalid account IDs payload.", success: false };
    }

    if (!Array.isArray(accountIds) || accountIds.length === 0) return { error: "No accounts provided.", success: false };
    if (accountIds.length > 50) return { error: "Batch size limit exceeded (max 50).", success: false };

    const workspace = await requireWorkspace();
    if ("error" in workspace) return { error: workspace.error, success: false };

    let successCount = 0;
    let lastError = null;

    for (const id of accountIds) {
        const singleFormData = new FormData();
        singleFormData.append("id", id);
        singleFormData.append("status", "approved");
        singleFormData.append("note", "Bulk approved via bulk action");
        const result = await reviewOutreachAccountAction({ error: null, success: false }, singleFormData);
        if (result.success) {
            successCount++;
        } else {
            lastError = result.error;
        }
    }

    revalidatePath("/dashboard/outreach");
    return { error: successCount === 0 ? lastError : null, success: successCount > 0 };
}

export async function bulkGenerateSequencesAction(_prev: OutreachActionState, formData: FormData): Promise<OutreachActionState> {
    const rawIds = String(formData.get("accountIds") ?? "[]");
    let accountIds: string[];
    try {
        accountIds = JSON.parse(rawIds);
    } catch {
        return { error: "Invalid account IDs payload.", success: false };
    }

    if (!Array.isArray(accountIds) || accountIds.length === 0) return { error: "No accounts provided.", success: false };
    if (accountIds.length > 50) return { error: "Batch size limit exceeded (max 50).", success: false };

    const workspace = await requireWorkspace();
    if ("error" in workspace) return { error: workspace.error, success: false };

    let successCount = 0;
    let lastError = null;
    for (const id of accountIds) {
        const singleFormData = new FormData();
        singleFormData.append("accountId", id);
        const result = await generateAiOutreachSequenceAction({ error: null, success: false }, singleFormData);
        if (result.success) {
            successCount++;
        } else {
            lastError = result.error;
        }
    }

    revalidatePath("/dashboard/outreach");
    return { error: successCount === 0 ? lastError : null, success: successCount > 0 };
}

export async function bulkScheduleMessagesAction(_prev: OutreachActionState, formData: FormData): Promise<OutreachActionState & { preview?: { eligible: number, blocked: number } }> {
    const rawIds = String(formData.get("accountIds") ?? "[]");
    const isDryRun = formData.get("dryRun") === "true";
    let accountIds: string[];
    try {
        accountIds = JSON.parse(rawIds);
    } catch {
        return { error: "Invalid account IDs payload.", success: false };
    }

    if (!Array.isArray(accountIds) || accountIds.length === 0) return { error: "No accounts provided.", success: false };
    if (accountIds.length > 50) return { error: "Batch size limit exceeded (max 50).", success: false };

    if (isDryRun) {
        const workspace = await requireWorkspace();
        if ("error" in workspace) return { error: workspace.error, success: false };
        const supabase = await createClient();
        const { data: contactsData } = await supabase.from("outreach_contacts" as never).select("id, email, lawful_basis, review_status, suppressed_at" as never).in("account_id" as never, accountIds as never);
        const { data: settingsData } = await supabase.from("outreach_workspace_settings" as never).select("allowed_lawful_bases" as never).eq("workspace_id" as never, workspace.workspaceId as never).maybeSingle();

        const contacts = ((contactsData ?? []) as unknown) as Pick<OutreachContactRow, "email" | "lawful_basis" | "review_status" | "suppressed_at">[];
        const settings = (settingsData as unknown) as Pick<OutreachWorkspaceSettingsRow, "allowed_lawful_bases"> | null;

        let eligible = 0;
        let blocked = 0;
        for (const contact of contacts) {
            const eligibility = evaluateContactEligibility({ contact, settings });
            if (eligibility.allowed) eligible++;
            else blocked++;
        }
        return { error: null, success: true, preview: { eligible, blocked } };
    }

    const certifyManualWarranty = formData.get("certifyManualWarranty") === "true";

    let successCount = 0;
    let lastError = null;
    for (const id of accountIds) {
        const f = new FormData();
        f.append("accountId", id);
        if (certifyManualWarranty) f.append("certifyManualWarranty", "true");
        const res = await executeOutreachAccountSequenceAction({ error: null, success: false }, f);
        if (res.success) {
            successCount++;
        } else {
            lastError = res.error;
        }
    }
    revalidatePath("/dashboard/outreach");
    return { error: successCount === 0 ? lastError : null, success: successCount > 0 };
}
