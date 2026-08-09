import { createClient } from "@/shared/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/shared/lib/supabase/database.types";
import { getSiteUrl } from "@/shared/lib/site-url";
import { sendEmail, sendEmailBatch } from "@/shared/lib/resend/send-email";
import {
    NEWSLETTER_ADDRESS_PLACEHOLDER,
    NEWSLETTER_DEFAULT_ACCENT,
    buildDefaultNewsletterSettings,
    newsletterAudienceSchema,
    newsletterAutomationSchema,
    newsletterAutomationStepSchema,
    newsletterCampaignSchema,
    newsletterSettingsSchema,
    newsletterTemplateSchema,
    type NewsletterAudienceInput,
    type NewsletterAutomationInput,
    type NewsletterAutomationStepInput,
    type NewsletterCampaignInput,
    type NewsletterSettingsInput,
    type NewsletterTemplateInput,
} from "@/features/newsletter/schema";
import { recordNewsletterBusinessEvent } from "@/features/business-spine/recorders";
import { recordBusinessIntegrationHealthCheck } from "@/features/business-spine/integrations";
import { selectAutomationRecipients } from "@/features/communications/email-lifecycle";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type ServiceClient = ReturnType<typeof createServiceClient<Database>>;

type NewsletterSettings = NewsletterSettingsInput;

type ContentSourceRecord = Pick<Database["public"]["Tables"]["content_items"]["Row"], "id" | "title" | "slug" | "content_markdown" | "metadata">;

export interface NewsletterListQuery {
    audiencesPage?: number;
    audiencesPageSize?: number;
    audiencesSearch?: string;
    templatesPage?: number;
    templatesPageSize?: number;
    templatesSearch?: string;
    campaignsPage?: number;
    campaignsPageSize?: number;
    campaignsSearch?: string;
    campaignsStatuses?: string[];
    automationsPage?: number;
    automationsPageSize?: number;
    automationsSearch?: string;
    contactsPage?: number;
    contactsPageSize?: number;
    contactsSearch?: string;
    contactsStatuses?: string[];
}

// Allowed values match the CHECK constraint on newsletter_contacts.status.
export const CONTACT_STATUS_VALUES = [
    "pending",
    "subscribed",
    "unsubscribed",
    "bounced",
    "complained",
] as const;
export type ContactStatus = (typeof CONTACT_STATUS_VALUES)[number];

export type NewsletterControlCenterData = {
    settings: NewsletterSettings;
    stats: {
        contacts: number;
        audiences: number;
        templates: number;
        campaigns: number;
        sentCampaigns: number;
        automations: number;
        activeAutomations: number;
        pendingJobs: number;
        opens: number;
        clicks: number;
    };
    audiences: Database["public"]["Tables"]["newsletter_audiences"]["Row"][];
    audiencesPage: { page: number; pageSize: number; total: number };
    templates: Database["public"]["Tables"]["newsletter_campaign_templates"]["Row"][];
    templatesPage: { page: number; pageSize: number; total: number };
    campaigns: Database["public"]["Tables"]["newsletter_campaigns"]["Row"][];
    campaignsPage: { page: number; pageSize: number; total: number };
    campaignStatusCounts: Record<string, number>;
    automations: Database["public"]["Tables"]["newsletter_automations"]["Row"][];
    automationsPage: { page: number; pageSize: number; total: number };
    contacts: Database["public"]["Tables"]["newsletter_contacts"]["Row"][];
    contactsPage: { page: number; pageSize: number; total: number };
    contactStatusCounts: Record<string, number>;
    sourceContent: ContentSourceRecord[];
    recentRecipients: Database["public"]["Tables"]["newsletter_campaign_recipients"]["Row"][];
};

function slugify(value: string): string {
    return value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
}

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

function addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + Math.max(0, minutes) * 60_000);
}

function getStringValue(record: Record<string, unknown>, key: string): string | null {
    const value = record[key];
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function toJsonRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeAttributionMetadata(params: {
    source?: string;
    metadata?: Record<string, unknown> | null;
}): Record<string, unknown> | null {
    const incoming = toJsonRecord(params.metadata);
    const source = params.source?.trim() || null;
    const popupFromSource = source?.startsWith("popup_") ? source.slice("popup_".length) : null;
    const popupId = getStringValue(incoming, "popupId")
        ?? getStringValue(incoming, "popup_id")
        ?? popupFromSource;
    const leadMagnet = getStringValue(incoming, "leadMagnet")
        ?? getStringValue(incoming, "lead_magnet");
    const sourceSurface = getStringValue(incoming, "sourceSurface")
        ?? getStringValue(incoming, "source_surface")
        ?? (popupId ? "popup" : source);
    const utm = toJsonRecord(incoming.utm);
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const) {
        const value = getStringValue(incoming, key);
        if (value) utm[key.replace("utm_", "")] = value;
    }

    const normalized = {
        ...incoming,
        ...(source ? { source } : {}),
        ...(popupId ? { popupId } : {}),
        ...(leadMagnet ? { leadMagnet } : {}),
        ...(Object.keys(utm).length > 0 ? { utm } : {}),
        ...(sourceSurface ? { sourceSurface } : {}),
    };

    return Object.keys(normalized).length > 0 ? normalized : null;
}

function extractNewsletterProvenance(contentMetadata: Record<string, unknown>) {
    const generatedFormats = toJsonRecord(contentMetadata.generated_formats);
    const newsletterIssueFull = toJsonRecord(generatedFormats.newsletter_issue_full);
    const evidencePack = newsletterIssueFull.evidence_pack
        ?? contentMetadata.source_intelligence_evidence_pack
        ?? toJsonRecord(contentMetadata.provenance).source_intelligence_evidence_pack
        ?? null;
    if (!evidencePack) return null;
    return {
        source: "source_intelligence",
        review_only: true,
        public_rendering: "deferred",
        evidence_pack: evidencePack,
    };
}

function buildContentCampaignProvenance(input: {
    content: Pick<ContentSourceRecord, "id" | "title" | "slug">;
    createdVia: "content_studio" | "automation";
    existing?: Record<string, unknown> | null;
}) {
    const link = {
        source_module: "content-engine",
        source_entity_type: "content_item",
        source_entity_id: input.content.id,
        source_title: input.content.title,
        source_slug: input.content.slug,
        target_module: "newsletter",
        target_entity_type: "newsletter_campaign",
        relation: "content_item_to_newsletter_campaign",
        created_via: input.createdVia,
        linked_at: new Date().toISOString(),
    };
    return {
        ...(input.existing ?? {}),
        content_to_campaign: link,
        source_content: {
            id: input.content.id,
            title: input.content.title,
            slug: input.content.slug,
        },
    };
}

async function enqueueAutomationStepJob(params: {
    supabase: SupabaseClient | ServiceClient;
    workspaceId: string;
    enrollmentId: string;
    automationId: string;
    runAt: string;
    contactId?: string | null;
    sourceContentId?: string | null;
    nextStepPosition?: number | null;
}) {
    const metadata = {
        automation_id: params.automationId,
        enrollment_id: params.enrollmentId,
        ...(params.contactId ? { contact_id: params.contactId } : {}),
        ...(params.sourceContentId ? { source_content_id: params.sourceContentId } : {}),
        ...(params.nextStepPosition ? { next_step_position: params.nextStepPosition } : {}),
    };
    const supabase = params.supabase as unknown as SupabaseClient;

    const { data: existingJobs } = await supabase
        .from("newsletter_dispatch_jobs")
        .select("id")
        .eq("job_type", "automation_step")
        .eq("automation_enrollment_id", params.enrollmentId)
        .in("status", ["pending", "running"])
        .limit(1);

    const existingJob = existingJobs?.[0];
    if (existingJob) {
        await supabase
            .from("newsletter_dispatch_jobs")
            .update({
                run_at: params.runAt,
                metadata: metadata as unknown as Json,
                updated_at: new Date().toISOString(),
            })
            .eq("id", existingJob.id);
        return;
    }

    await supabase
        .from("newsletter_dispatch_jobs")
        .insert({
            workspace_id: params.workspaceId,
            job_type: "automation_step",
            automation_enrollment_id: params.enrollmentId,
            status: "pending",
            run_at: params.runAt,
            metadata: metadata as unknown as Json,
            updated_at: new Date().toISOString(),
        });
}

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

// Re-exported for any future caller that wants raw email-safe HTML without
// the campaign-template chrome. See markdown-to-email-html.ts for what is
// and isn't supported (it's a deliberate subset of CommonMark, not the full
// spec; inline-styled for cross-client email rendering).
import { markdownToEmailHtml } from "@/features/newsletter/lib/markdown-to-email-html";

function renderMarkdownToHtml(markdown: string, articleUrl?: string): string {
    return markdownToEmailHtml(markdown, { articleUrl });
}

function formatFromAddress(fromName: string, fromEmail: string): string {
    return `${fromName} <${fromEmail}>`;
}

function interpolateTemplate(template: string, values: Record<string, string | null | undefined>): string {
    return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => values[key] ?? "");
}

function getSiteBaseUrl(): string {
    return getSiteUrl();
}

export function buildUnsubscribeUrl(token: string): string {
    return `${getSiteBaseUrl()}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
}

function buildCampaignHtml(params: {
    subjectLine: string;
    preheader: string;
    bodyMarkdown: string;
    settings: NewsletterSettings;
    ctaLabel?: string | null;
    ctaUrl?: string | null;
    unsubscribeUrl?: string | null;
    /** Public URL of the source article — used to resolve {{visual:slug}}
     * placeholders into anchored links instead of stripping them silently. */
    articleUrl?: string | null;
}): string {
    const { subjectLine, preheader, bodyMarkdown, settings, ctaLabel, ctaUrl, unsubscribeUrl, articleUrl } = params;
    const accent = settings.brandAccent || NEWSLETTER_DEFAULT_ACCENT;
    const body = renderMarkdownToHtml(bodyMarkdown, articleUrl ?? ctaUrl ?? undefined);
    const cta = ctaLabel && ctaUrl
        ? `<div style="margin-top:24px;"><a href="${ctaUrl}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:700;">${escapeHtml(ctaLabel)}</a></div>`
        : "";
    // Inline unsubscribe link is REQUIRED by CAN-SPAM. The List-Unsubscribe
    // header (added at send-time in runCampaignJobs) is REQUIRED by Gmail /
    // Yahoo bulk-sender policy. Both must be present.
    const unsubscribeFooter = unsubscribeUrl
        ? `<br /><br /><a href="${unsubscribeUrl}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>`
        : "";

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(subjectLine)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f7fb;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #dbe4f0;box-shadow:0 20px 60px rgba(15,23,42,0.1);">
            <tr>
              <td style="background:linear-gradient(135deg,#071226 0%,${accent} 100%);padding:32px 36px;color:#ffffff;">
                <div style="font-size:11px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;opacity:0.72;">${escapeHtml(settings.companyName)}</div>
                <h1 style="margin:12px 0 10px;font-size:28px;line-height:1.2;font-weight:800;">${escapeHtml(subjectLine)}</h1>
                ${preheader ? `<p style="margin:0;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.82);">${escapeHtml(preheader)}</p>` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding:32px 36px;">${body}${cta}<div style="margin-top:32px;padding-top:20px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.8;color:#94a3b8;">${escapeHtml(settings.footerText)}<br />${escapeHtml(settings.companyAddress)}${unsubscribeFooter}</div></td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildListUnsubscribeHeaders(unsubscribeUrl: string): Record<string, string> {
    return {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
}

export function buildNewsletterWelcomeEmail(params: {
    siteUrl: string;
    settings: NewsletterSettings;
}): string {
    const { siteUrl, settings } = params;
    return buildCampaignHtml({
        subjectLine: settings.welcomeSubject,
        preheader: settings.welcomeHeading,
        bodyMarkdown: settings.welcomeBody,
        settings,
        ctaLabel: "Visit workspace",
        ctaUrl: `${siteUrl}/newsletter`,
    });
}

function getServiceClient(): ServiceClient {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (!url || !key) {
        throw new Error("Missing Supabase service credentials.");
    }

    return createServiceClient<Database>(url, key, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}

function isValidEmail(value: string | undefined | null): value is string {
    if (!value) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function getDefaultNewsletterSettings(workspaceName: string): NewsletterSettings {
    const fromEnv = process.env.NEWSLETTER_FROM_EMAIL?.trim()?.replace(/^.*<([^>]+)>.*$/, "$1");
    const replyEnv = process.env.NEWSLETTER_REPLY_TO_EMAIL?.trim();
    const base = buildDefaultNewsletterSettings(workspaceName);
    return {
        ...base,
        // Reject obviously broken env values rather than silently sending
        // them to Resend (which would 403 with "domain not verified" for
        // every recipient). A fall-back default is preferable to a malformed
        // address landing in the From header.
        fromEmail: isValidEmail(fromEnv) ? fromEnv : base.fromEmail,
        replyToEmail: isValidEmail(replyEnv) ? replyEnv : base.replyToEmail,
    };
}

/**
 * Throws when the email send subsystem is not safe to use. Call before
 * triggering a campaign so the operator sees the config error up front
 * instead of seeing every recipient row flip to 'failed'.
 */
export function assertEmailSubsystemReady(): void {
    if (!process.env.RESEND_API_KEY?.trim()) {
        throw new Error("Email send is not configured: RESEND_API_KEY is missing.");
    }
    const fromEnv = process.env.NEWSLETTER_FROM_EMAIL?.trim()?.replace(/^.*<([^>]+)>.*$/, "$1");
    if (fromEnv && !isValidEmail(fromEnv)) {
        throw new Error("NEWSLETTER_FROM_EMAIL is set but not a valid email address.");
    }
}

export async function getNewsletterSettingsForWorkspace(workspaceId: string, workspaceName: string): Promise<NewsletterSettings> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("workspace_settings")
        .select("metadata")
        .eq("workspace_id", workspaceId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    const rawSettings = data?.metadata && typeof data.metadata === "object"
        ? (data.metadata as { newsletter?: unknown }).newsletter
        : null;

    const parsed = newsletterSettingsSchema.safeParse(rawSettings ?? getDefaultNewsletterSettings(workspaceName));
    if (!parsed.success) {
        return getDefaultNewsletterSettings(workspaceName);
    }

    return parsed.data;
}

export async function updateNewsletterSettingsForWorkspace(workspaceId: string, input: NewsletterSettingsInput) {
    const supabase = await createClient();
    const parsed = newsletterSettingsSchema.safeParse(input);
    if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? "Invalid newsletter settings." };
    }

    const { data: existing, error: readError } = await supabase
        .from("workspace_settings")
        .select("metadata")
        .eq("workspace_id", workspaceId)
        .maybeSingle();

    if (readError) {
        return { error: readError.message };
    }

    const metadata = existing?.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
        ? { ...(existing.metadata as Record<string, Json>) }
        : {};

    metadata.newsletter = parsed.data as unknown as Json;

    const { error } = await supabase
        .from("workspace_settings")
        .upsert({
            workspace_id: workspaceId,
            metadata,
            updated_at: new Date().toISOString(),
        }, { onConflict: "workspace_id" });

    if (error) {
        return { error: error.message };
    }

    return { error: null };
}

async function ensureDefaultAudienceWithClient(clientInput: SupabaseClient | ServiceClient, workspaceId: string, workspaceName: string) {
    const client = clientInput as SupabaseClient;

    // 1) Fast path: a row already flagged as the default for this workspace.
    const { data: existingDefault } = await client
        .from("newsletter_audiences")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("is_default", true)
        .maybeSingle();

    if (existingDefault) return existingDefault;

    // 2) Older workspaces have a non-default audience under the same slug we
    //    would otherwise insert (e.g. created via the manager UI before the
    //    is_default flag existed). Adopt that row and promote it to default,
    //    rather than colliding on the (workspace_id, slug) unique key.
    const defaultSettings = getDefaultNewsletterSettings(workspaceName);
    const defaultSlug = slugify(defaultSettings.defaultAudienceName);

    const { data: existingBySlug } = await client
        .from("newsletter_audiences")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("slug", defaultSlug)
        .maybeSingle();

    if (existingBySlug) {
        if (!existingBySlug.is_default) {
            const { data: promoted, error: promoteError } = await client
                .from("newsletter_audiences")
                .update({ is_default: true })
                .eq("id", existingBySlug.id)
                .select("*")
                .single();
            if (promoteError) throw new Error(promoteError.message);
            return promoted;
        }
        return existingBySlug;
    }

    // 3) No existing audience anywhere → upsert. onConflict on the unique
    //    (workspace_id, slug) makes the insert idempotent under races (two
    //    concurrent requests from the same workspace would otherwise hit the
    //    same duplicate-key error this fix is closing).
    const { data, error } = await client
        .from("newsletter_audiences")
        .upsert({
            workspace_id: workspaceId,
            name: defaultSettings.defaultAudienceName,
            slug: defaultSlug,
            description: "Primary audience for workspace newsletter subscribers.",
            is_default: true,
        }, { onConflict: "workspace_id,slug" })
        .select("*")
        .single();

    if (error) throw new Error(error.message);
    return data;
}

async function ensureSeedTemplates(clientInput: SupabaseClient | ServiceClient, workspaceId: string) {
    const client = clientInput as SupabaseClient;
    const { count } = await client
        .from("newsletter_campaign_templates")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId);

    if ((count ?? 0) > 0) {
        return;
    }

    const templates: Database["public"]["Tables"]["newsletter_campaign_templates"]["Insert"][] = [
        {
            workspace_id: workspaceId,
            name: "Blog repurpose",
            slug: "blog-repurpose",
            workflow_type: "broadcast",
            subject_template: "{{title}}",
            preheader_template: "A concise briefing from your workspace.",
            body_markdown_template: "{{excerpt}}\n\n{{body}}",
            cta_label: "Read more",
            cta_url: "{{url}}",
            is_system: true,
        },
        {
            workspace_id: workspaceId,
            name: "Welcome series",
            slug: "welcome-series",
            workflow_type: "welcome_series",
            subject_template: "Welcome to the system",
            preheader_template: "Your onboarding sequence starts here.",
            body_markdown_template: "Thanks for joining. Here is how to get the most from the workspace.",
            cta_label: "Open newsletter",
            cta_url: `${getSiteUrl()}/newsletter`,
            is_system: true,
        },
        {
            workspace_id: workspaceId,
            name: "Re-engagement",
            slug: "re-engagement",
            workflow_type: "reengagement",
            subject_template: "Still interested in what we’re shipping?",
            preheader_template: "A quick reset and the latest thinking.",
            body_markdown_template: "We haven’t seen you in a while, so here is the sharpest recent work from the workspace.",
            cta_label: "See the latest",
            cta_url: `${getSiteUrl()}/newsletter`,
            is_system: true,
        },
    ];

    await client.from("newsletter_campaign_templates").insert(templates);
}

export async function subscribeNewsletterContact(params: {
    email: string;
    workspaceId?: string | null;
    templateId?: string | null;
    source?: string;
    locale?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    // Arbitrary structured payload merged into newsletter_contacts.metadata so
    // an operator can review the lead's submitted context (e.g. calculator
    // inputs and computed outputs) before a follow-up consultation.
    metadata?: Record<string, unknown> | null;
}) {
    const serviceClient = getServiceClient();
    const normalizedEmail = normalizeEmail(params.email);
    const templateId = params.templateId?.trim() || null;

    let workspaceId: string | null = null;
    let workspaceName = "Workspace";

    if (params.workspaceId) {
        const { data: workspace } = await serviceClient
            .from("workspaces")
            .select("id,name")
            .eq("id", params.workspaceId)
            .eq("is_active", true)
            .maybeSingle();

        workspaceId = workspace?.id ?? null;
        workspaceName = workspace?.name ?? workspaceName;
    }

    if (!workspaceId && templateId) {
        const { data: workspace } = await serviceClient
            .from("workspaces")
            .select("id,name")
            .eq("legacy_template_id", templateId)
            .eq("is_active", true)
            .maybeSingle();

        workspaceId = workspace?.id ?? null;
        workspaceName = workspace?.name ?? workspaceName;
    }

    if (!workspaceId) {
        throw new Error("An explicit active workspace is required for newsletter subscription.");
    }

    const audience = await ensureDefaultAudienceWithClient(serviceClient, workspaceId, workspaceName);
    await ensureSeedTemplates(serviceClient, workspaceId);

    // Check if this email is already verified — re-subscribing a known
    // confirmed contact should NOT send another confirmation email. Anything
    // else (new email, previously unsubscribed, previously pending) goes
    // through the double-opt-in path.
    const { data: existing } = await serviceClient
        .from("newsletter_contacts")
        .select("id, status, verified_at")
        .eq("workspace_id", workspaceId)
        .eq("email_normalized", normalizedEmail)
        .maybeSingle();

    const alreadyConfirmed = Boolean(existing?.verified_at) && existing?.status === "subscribed";
    const verificationToken = alreadyConfirmed
        ? null
        : (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));

    // Only include optional fields when provided so we don't overwrite
    // existing values (e.g. a previously captured first_name) with null on
    // re-subscribes from a form that doesn't collect that field.
    const normalizedMetadata = normalizeAttributionMetadata({ source: params.source, metadata: params.metadata });

    const upsertPayload = {
        workspace_id: workspaceId,
        email: normalizedEmail,
        email_normalized: normalizedEmail,
        locale: params.locale ?? null,
        source: params.source ?? "public_form",
        status: alreadyConfirmed ? "subscribed" : "pending",
        // Don't backdate subscribed_at; it gets set at confirmation time.
        ...(alreadyConfirmed ? {} : { verification_token: verificationToken }),
        unsubscribed_at: null,
        ...(params.firstName !== undefined ? { first_name: params.firstName } : {}),
        ...(params.lastName !== undefined ? { last_name: params.lastName } : {}),
        // Cast through unknown into Json — caller-supplied metadata is
        // structurally Json (the Zod schemas that build it only emit
        // primitives, objects, and arrays) but TS can't prove it from
        // Record<string, unknown> alone.
        ...(normalizedMetadata ? { metadata: normalizedMetadata as unknown as Json } : {}),
    };

    const { data: contact, error: contactError } = await serviceClient
        .from("newsletter_contacts")
        .upsert(upsertPayload, { onConflict: "workspace_id,email_normalized" })
        .select("*")
        .single();

    if (contactError || !contact) {
        throw new Error(contactError?.message ?? "Failed to save newsletter contact.");
    }

    await serviceClient
        .from("newsletter_audience_members")
        .upsert({
            audience_id: audience.id,
            contact_id: contact.id,
        }, { onConflict: "audience_id,contact_id" });

    const settings = await getNewsletterSettingsForWorkspace(workspaceId, workspaceName);

    // Confirmation step: confirmed contacts immediately fire the
    // contact_subscribed automations; pending contacts get a confirmation
    // email and wait for the user to click before automations fire.
    if (alreadyConfirmed) {
        await fireContactSubscribedAutomations(serviceClient, workspaceId, contact.id);
        await serviceClient
            .from("newsletter_subscribers")
            .upsert({
                email: normalizedEmail,
                subscribed_at: new Date().toISOString(),
            }, { onConflict: "email" });
    } else if (verificationToken) {
        try {
            await sendEmail({
                from: formatFromAddress(settings.fromName, settings.fromEmail),
                to: normalizedEmail,
                subject: `Confirm your subscription to ${settings.companyName}`,
                html: buildConfirmationEmailHtml(settings, verificationToken),
                replyTo: settings.replyToEmail || undefined,
            });
        } catch (err) {
            // Don't fail the user-facing submit just because the confirm
            // email didn't go out — the contact row exists, and a follow-up
            // resend mechanism can recover. Log for operator visibility.
            console.error("[newsletter] confirmation email send failed:", err);
        }
    }

    return {
        workspaceId,
        workspaceName,
        audience,
        contact,
        settings,
        requiresConfirmation: !alreadyConfirmed,
    };
}

async function fireContactSubscribedAutomations(
    serviceClient: ServiceClient,
    workspaceId: string,
    contactId: string,
) {
    let enqueued = 0;
    const { data: subscribeAutomations } = await serviceClient
        .from("newsletter_automations")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("trigger_type", "contact_subscribed")
        .eq("status", "active");

    for (const automation of subscribeAutomations ?? []) {
        const { data: firstStep } = await serviceClient
            .from("newsletter_automation_steps")
            .select("position,delay_minutes")
            .eq("automation_id", automation.id)
            .order("position", { ascending: true })
            .limit(1)
            .maybeSingle();
        if (!firstStep) continue;

        const nextRunAt = addMinutes(new Date(), firstStep.delay_minutes).toISOString();
        const { data: existingEnrollment } = await serviceClient
            .from("newsletter_automation_enrollments")
            .select("id,status")
            .eq("automation_id", automation.id)
            .eq("contact_id", contactId)
            .maybeSingle();

        if (existingEnrollment && !["pending", "active"].includes(existingEnrollment.status)) {
            continue;
        }

        const enrollmentResult = existingEnrollment
            ? await serviceClient
                .from("newsletter_automation_enrollments")
                .update({
                    status: "active",
                    next_run_at: nextRunAt,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", existingEnrollment.id)
                .select("id")
                .single()
            : await serviceClient
                .from("newsletter_automation_enrollments")
                .insert({
                    automation_id: automation.id,
                    workspace_id: workspaceId,
                    contact_id: contactId,
                    status: "active",
                    current_step_position: 0,
                    next_run_at: nextRunAt,
                    metadata: {
                        trigger_type: "contact_subscribed",
                        first_step_position: firstStep.position,
                    } as unknown as Json,
                })
                .select("id")
                .single();

        const { data: enrollment, error: enrollmentError } = enrollmentResult;

        if (enrollmentError || !enrollment) continue;
        await enqueueAutomationStepJob({
            supabase: serviceClient,
            workspaceId,
            enrollmentId: enrollment.id,
            automationId: automation.id,
            contactId,
            nextStepPosition: firstStep.position,
            runAt: nextRunAt,
        });
        enqueued += 1;
    }

    return enqueued;
}

function buildConfirmationEmailHtml(settings: NewsletterSettings, token: string): string {
    const url = `${getSiteBaseUrl()}/api/newsletter/confirm?token=${encodeURIComponent(token)}`;
    const accent = settings.brandAccent || NEWSLETTER_DEFAULT_ACCENT;
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><title>Confirm your subscription</title></head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
  <table width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:24px;border:1px solid #dbe4f0;padding:36px;">
        <tr><td>
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">Confirm your subscription</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475569;">
            Tap the button below to confirm you want to receive ${escapeHtml(settings.companyName)} emails. If you didn't request this, you can ignore this message.
          </p>
          <p><a href="${url}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:700;">Confirm subscription</a></p>
          <p style="margin-top:32px;font-size:12px;color:#94a3b8;">If the button doesn't work, paste this URL into your browser:<br/>${url}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * Flip a pending contact to subscribed once the user clicks the confirmation
 * link. Idempotent — repeated calls with the same token are no-ops.
 */
export async function confirmNewsletterSubscription(token: string): Promise<{ ok: boolean; error?: string }> {
    if (!token) return { ok: false, error: "Missing token." };
    const serviceClient = getServiceClient();
    const { data: contact, error } = await serviceClient
        .from("newsletter_contacts")
        .select("id, workspace_id, status, verified_at, email")
        .eq("verification_token", token)
        .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!contact) return { ok: false, error: "Invalid or expired confirmation link." };

    if (contact.status === "subscribed" && contact.verified_at) {
        return { ok: true };
    }

    const now = new Date().toISOString();
    const { error: updateError } = await serviceClient
        .from("newsletter_contacts")
        .update({
            status: "subscribed",
            subscribed_at: now,
            verified_at: now,
            verification_token: null,
        })
        .eq("id", contact.id);
    if (updateError) return { ok: false, error: updateError.message };

    if (contact.workspace_id) {
        const automationCount = await fireContactSubscribedAutomations(serviceClient, contact.workspace_id, contact.id);
        if (automationCount === 0) try {
            const { data: workspace } = await serviceClient
                .from("workspaces")
                .select("name")
                .eq("id", contact.workspace_id)
                .maybeSingle();
            const settings = await getNewsletterSettingsForWorkspace(contact.workspace_id, workspace?.name ?? "Workspace");
            const fromEmail = process.env.NEWSLETTER_FROM_EMAIL?.trim() || "Newsletter <noreply@example.invalid>";
            await sendEmail({
                from: fromEmail,
                to: contact.email,
                subject: settings.welcomeSubject,
                html: buildNewsletterWelcomeEmail({ siteUrl: getSiteBaseUrl(), settings }),
                replyTo: settings.replyToEmail || undefined,
            });
        } catch (emailError) {
            console.error("[newsletter] Welcome email on confirm failed:", emailError);
        }
    }
    return { ok: true };
}

export async function createNewsletterAudience(workspaceId: string, input: NewsletterAudienceInput) {
    const supabase = await createClient();
    const parsed = newsletterAudienceSchema.safeParse(input);
    if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? "Invalid audience." };
    }

    if (parsed.data.isDefault) {
        await supabase.from("newsletter_audiences").update({ is_default: false }).eq("workspace_id", workspaceId);
    }

    const { error } = await supabase.from("newsletter_audiences").insert({
        workspace_id: workspaceId,
        name: parsed.data.name,
        slug: slugify(parsed.data.name),
        description: parsed.data.description || null,
        is_default: parsed.data.isDefault,
    });

    return { error: error?.message ?? null };
}

export async function createNewsletterTemplate(workspaceId: string, input: NewsletterTemplateInput) {
    const supabase = await createClient();
    const parsed = newsletterTemplateSchema.safeParse(input);
    if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? "Invalid template." };
    }

    const { error } = await supabase.from("newsletter_campaign_templates").insert({
        workspace_id: workspaceId,
        name: parsed.data.name,
        slug: slugify(parsed.data.name),
        workflow_type: parsed.data.workflowType,
        subject_template: parsed.data.subjectTemplate,
        preheader_template: parsed.data.preheaderTemplate || null,
        body_markdown_template: parsed.data.bodyMarkdownTemplate,
        cta_label: parsed.data.ctaLabel || null,
        cta_url: parsed.data.ctaUrl || null,
        is_system: false,
    });

    return { error: error?.message ?? null };
}

export async function createNewsletterCampaign(workspaceId: string, input: NewsletterCampaignInput) {
    const supabase = await createClient();
    const parsed = newsletterCampaignSchema.safeParse(input);
    if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? "Invalid campaign." };
    }

    const { data: workspace } = await supabase.from("workspaces").select("name").eq("id", workspaceId).single();
    const settings = await getNewsletterSettingsForWorkspace(workspaceId, workspace?.name ?? "Workspace");

    const provenance = {
        ...(parsed.data.provenance ?? {}),
        ...(parsed.data.sourceContentId && !parsed.data.provenance?.content_to_campaign
            ? {
                content_to_campaign: {
                    source_module: "content-engine",
                    source_entity_type: "content_item",
                    source_entity_id: parsed.data.sourceContentId,
                    target_module: "newsletter",
                    target_entity_type: "newsletter_campaign",
                    relation: "content_item_to_newsletter_campaign",
                    created_via: "campaign_form",
                    linked_at: new Date().toISOString(),
                },
            }
            : {}),
    };

    const { error } = await supabase.from("newsletter_campaigns").insert({
        workspace_id: workspaceId,
        source_content_id: parsed.data.sourceContentId || null,
        template_id: parsed.data.templateId || null,
        audience_id: parsed.data.audienceId,
        title: parsed.data.title,
        workflow_type: parsed.data.workflowType,
        status: parsed.data.scheduledFor ? "scheduled" : "draft",
        subject_line: parsed.data.subjectLine,
        preheader: parsed.data.preheader || null,
        body_markdown: parsed.data.bodyMarkdown,
        html_body: buildCampaignHtml({
            subjectLine: parsed.data.subjectLine,
            preheader: parsed.data.preheader || "",
            bodyMarkdown: parsed.data.bodyMarkdown,
            settings,
            articleUrl: parsed.data.articleUrl,
            ctaLabel: parsed.data.articleUrl ? "Read the full piece" : null,
            ctaUrl: parsed.data.articleUrl ?? null,
        }),
        from_name: settings.fromName,
        from_email: settings.fromEmail,
        reply_to_email: settings.replyToEmail || null,
        scheduled_for: parsed.data.scheduledFor || null,
        metadata: {
            cta: parsed.data.articleUrl
                ? { label: "Read the full piece", url: parsed.data.articleUrl }
                : null,
            derived_from_article: parsed.data.derivedFromArticle ?? false,
            ...(Object.keys(provenance).length > 0 ? { provenance } : {}),
        },
    });

    return { error: error?.message ?? null };
}

/**
 * Convenience wrapper that resolves (and provisions, if absent) the
 * workspace's default audience, then delegates to `createCampaignFromContentItem`.
 * Used by the Content Studio's one-click "Create campaign in Newsletter" button
 * so operators don't need to pre-pick an audience there.
 */
export async function createCampaignFromContentWithDefaultAudience(
    workspaceId: string,
    workspaceName: string,
    contentItemId: string,
) {
    const supabase = await createClient();
    const audience = await ensureDefaultAudienceWithClient(supabase, workspaceId, workspaceName);
    if (!audience?.id) {
        return { error: "Could not resolve a default audience for this workspace." };
    }
    return createCampaignFromContentItem(workspaceId, contentItemId, audience.id);
}

export async function createCampaignFromContentItem(workspaceId: string, contentItemId: string, audienceId: string) {
    const supabase = await createClient();
    const { data: content, error } = await supabase
        .from("content_items")
        .select("id,title,slug,content_markdown,metadata")
        .eq("id", contentItemId)
        .eq("workspace_id", workspaceId)
        .single();

    if (error || !content) {
        return { error: error?.message ?? "Content not found." };
    }

    const metadata = (content.metadata ?? {}) as Record<string, unknown>;
    const generatedFormats = (metadata.generated_formats ?? {}) as Record<string, unknown>;
    const hasGeneratedIssue = typeof generatedFormats.newsletter_issue === "string" && generatedFormats.newsletter_issue.trim().length > 0;
    const subjectVariants = Array.isArray(generatedFormats.newsletter_subject_lines)
        ? generatedFormats.newsletter_subject_lines.filter((value): value is string => typeof value === "string")
        : [];
    const excerpt = typeof metadata.excerpt === "string" ? metadata.excerpt : "";
    const provenance = buildContentCampaignProvenance({
        content,
        createdVia: "content_studio",
        existing: extractNewsletterProvenance(metadata),
    });

    // Clamp every field to the cap enforced by newsletterCampaignSchema so we
    // don't propagate a Zod "Too big" error back to the caller — the source
    // content can legitimately carry an excerpt longer than 180 chars (the
    // editor enforces 200) or a title longer than 160 chars.
    const clamp = (value: string, max: number): string => {
        const cleaned = value.replace(/\s+/g, " ").trim();
        return cleaned.length > max ? cleaned.slice(0, max - 1).trimEnd() + "…" : cleaned;
    };

    // Newsletter body resolution. Three cases, in order:
    //
    // 1. The orchestrator produced a tailored `newsletter_issue` — use it.
    //    This is the "right" path; tone, length, and scannability are
    //    appropriate for inbox reading.
    // 2. No newsletter_issue but we have an excerpt and a full article —
    //    derive a short "preview + read more" body. This is what mature
    //    blog-to-newsletter tools (Mailchimp RSS, Substack share-to-email)
    //    actually do: a one-screen teaser plus a CTA back to the article.
    //    Beats shipping a 5000-word article body verbatim.
    // 3. Neither available — return an error so the operator knows the
    //    campaign cannot be created from this content yet (previously this
    //    case silently emitted the raw article body, which is the bug the
    //    user reported).
    const siteBase = getSiteBaseUrl();
    const articlePath = content.slug ? `/blog/${content.slug}` : null;
    const articleUrl = articlePath ? `${siteBase}${articlePath}` : null;
    const rawArticle = (content.content_markdown ?? "").trim();
    let newsletterIssue: string;
    let derivedFromArticle = false;

    if (hasGeneratedIssue) {
        newsletterIssue = (generatedFormats.newsletter_issue as string);
    } else if (rawArticle) {
        derivedFromArticle = true;
        const teaserSource = excerpt.trim() || rawArticle.split(/\n{2,}/).slice(0, 2).join("\n\n");
        const teaser = teaserSource.length > 600 ? teaserSource.slice(0, 600).trimEnd() + "…" : teaserSource;
        const readMoreLine = articleUrl
            ? `\n\n**[Read the full piece →](${articleUrl})**`
            : "";
        newsletterIssue = `${teaser}${readMoreLine}`;
        console.warn(`[newsletter] No newsletter_issue for content ${contentItemId}; derived a short teaser from excerpt + article (set metadata.generated_formats.newsletter_issue to override).`);
    } else {
        return { error: "Content has no newsletter body. Generate a newsletter format first." };
    }

    return createNewsletterCampaign(workspaceId, {
        title: clamp(`${content.title} newsletter`, 160),
        workflowType: "broadcast",
        subjectLine: clamp(subjectVariants[0] ?? content.title, 160),
        preheader: clamp(excerpt, 180),
        bodyMarkdown: newsletterIssue.length > 20000 ? newsletterIssue.slice(0, 20000) : newsletterIssue,
        audienceId,
        sourceContentId: content.id,
        templateId: "",
        scheduledFor: "",
        // Threaded through so buildCampaignHtml can resolve {{visual:slug}}
        // placeholders into article anchor links instead of leaking them
        // as raw text.
        articleUrl: articleUrl ?? undefined,
        derivedFromArticle,
        provenance,
    });
}

export async function scheduleNewsletterCampaign(workspaceId: string, campaignId: string, scheduledFor: string | null) {
    if (scheduledFor && new Date(scheduledFor).getTime() < Date.now() - 60_000) {
        return { error: "Scheduled send time cannot be in the past." };
    }

    const supabase = await createClient();

    // Block scheduling when the workspace's newsletter settings still carry
    // the placeholder postal address. Catching it here (instead of only at
    // dispatch) means the operator gets a clear error before the campaign
    // ever queues, so they don't have to fish through dispatch_jobs to find
    // out why nothing sent.
    const { data: workspaceRow } = await supabase
        .from("workspaces")
        .select("name")
        .eq("id", workspaceId)
        .maybeSingle();
    const settings = await getNewsletterSettingsForWorkspace(workspaceId, workspaceRow?.name ?? "Workspace");
    if (
        !settings.companyAddress ||
        settings.companyAddress.trim() === NEWSLETTER_ADDRESS_PLACEHOLDER ||
        settings.companyAddress.trim().length < 5
    ) {
        return { error: "Set a real postal address in Settings → Newsletter before sending. Required by CAN-SPAM and Gmail bulk-sender rules." };
    }

    const nextRunAt = scheduledFor ? new Date(scheduledFor).toISOString() : new Date().toISOString();

    const { error: updateError } = await supabase
        .from("newsletter_campaigns")
        .update({
            status: scheduledFor ? "scheduled" : "sending",
            scheduled_for: scheduledFor,
            updated_at: new Date().toISOString(),
        })
        .eq("id", campaignId)
        .eq("workspace_id", workspaceId);

    if (updateError) {
        return { error: updateError.message };
    }

    const { error } = await supabase.from("newsletter_dispatch_jobs").insert({
        workspace_id: workspaceId,
        job_type: "campaign_send",
        campaign_id: campaignId,
        status: "pending",
        run_at: nextRunAt,
    });

    return { error: error?.message ?? null };
}

export async function createNewsletterAutomation(workspaceId: string, input: NewsletterAutomationInput) {
    const supabase = await createClient();
    const parsed = newsletterAutomationSchema.safeParse(input);
    if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? "Invalid automation." };
    }

    const { error } = await supabase.from("newsletter_automations").insert({
        workspace_id: workspaceId,
        name: parsed.data.name,
        slug: slugify(parsed.data.name),
        trigger_type: parsed.data.triggerType,
        status: "active",
        audience_id: parsed.data.audienceId || null,
    });

    return { error: error?.message ?? null };
}

export async function createNewsletterAutomationStep(workspaceId: string, input: NewsletterAutomationStepInput) {
    const supabase = await createClient();
    const parsed = newsletterAutomationStepSchema.safeParse(input);
    if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? "Invalid automation step." };
    }

    const { data: automation, error: automationError } = await supabase
        .from("newsletter_automations")
        .select("workspace_id")
        .eq("id", parsed.data.automationId)
        .single();

    if (automationError || !automation || automation.workspace_id !== workspaceId) {
        return { error: "Automation not found in active workspace." };
    }

    const { error } = await supabase.from("newsletter_automation_steps").insert({
        automation_id: parsed.data.automationId,
        position: parsed.data.position,
        step_type: "send_campaign",
        template_id: parsed.data.templateId,
        delay_minutes: parsed.data.delayMinutes,
        subject_line_override: parsed.data.subjectLineOverride || null,
        preheader_override: parsed.data.preheaderOverride || null,
        body_markdown_override: parsed.data.bodyMarkdownOverride || null,
    });

    return { error: error?.message ?? null };
}

export async function deleteNewsletterAudience(workspaceId: string, audienceId: string) {
    if (!audienceId) {
        return { error: "Audience id is required." };
    }
    const supabase = await createClient();
    const { error } = await supabase
        .from("newsletter_audiences")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("id", audienceId);
    return { error: error?.message ?? null };
}

export async function deleteNewsletterTemplate(workspaceId: string, templateId: string) {
    if (!templateId) {
        return { error: "Template id is required." };
    }
    const supabase = await createClient();
    const { error } = await supabase
        .from("newsletter_campaign_templates")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("id", templateId)
        .eq("is_system", false);
    return { error: error?.message ?? null };
}

export async function deleteNewsletterCampaign(workspaceId: string, campaignId: string) {
    if (!campaignId) {
        return { error: "Campaign id is required." };
    }
    const supabase = await createClient();
    const { error } = await supabase
        .from("newsletter_campaigns")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("id", campaignId);
    return { error: error?.message ?? null };
}

export async function deleteNewsletterAutomation(workspaceId: string, automationId: string) {
    if (!automationId) {
        return { error: "Automation id is required." };
    }
    const supabase = await createClient();
    const { error } = await supabase
        .from("newsletter_automations")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("id", automationId);
    return { error: error?.message ?? null };
}

export async function deleteNewsletterAutomationStep(workspaceId: string, stepId: string) {
    if (!stepId) {
        return { error: "Automation step id is required." };
    }
    const supabase = await createClient();
    const { data: step, error: stepError } = await supabase
        .from("newsletter_automation_steps")
        .select("id, automation_id")
        .eq("id", stepId)
        .single();
    if (stepError || !step) {
        return { error: stepError?.message ?? "Automation step not found." };
    }
    const { data: automation, error: automationError } = await supabase
        .from("newsletter_automations")
        .select("id, workspace_id")
        .eq("id", step.automation_id)
        .single();
    if (automationError || !automation || automation.workspace_id !== workspaceId) {
        return { error: "Forbidden: step is outside the active workspace scope." };
    }
    const { error } = await supabase
        .from("newsletter_automation_steps")
        .delete()
        .eq("id", stepId);
    return { error: error?.message ?? null };
}

const CAMPAIGN_STATUS_VALUES = ["draft", "scheduled", "sending", "sent", "cancelled", "failed"];

function clampPage(page: number | undefined): number {
    return Math.max(1, page ?? 1);
}
function clampPageSize(pageSize: number | undefined, fallback = 20): number {
    return Math.min(100, Math.max(5, pageSize ?? fallback));
}

export async function getNewsletterControlCenterData(
    workspaceId: string,
    workspaceName: string,
    query: NewsletterListQuery = {},
): Promise<NewsletterControlCenterData> {
    const supabase = await createClient();
    const settings = await getNewsletterSettingsForWorkspace(workspaceId, workspaceName);
    await ensureDefaultAudienceWithClient(supabase, workspaceId, workspaceName);
    await ensureSeedTemplates(supabase, workspaceId);

    const aPage = clampPage(query.audiencesPage);
    const aSize = clampPageSize(query.audiencesPageSize);
    const tPage = clampPage(query.templatesPage);
    const tSize = clampPageSize(query.templatesPageSize);
    const cPage = clampPage(query.campaignsPage);
    const cSize = clampPageSize(query.campaignsPageSize);
    const autoPage = clampPage(query.automationsPage);
    const autoSize = clampPageSize(query.automationsPageSize);
    const ctPage = clampPage(query.contactsPage);
    const ctSize = clampPageSize(query.contactsPageSize);

    const applyTextFilter = <T extends { or?: (clause: string) => T }>(
        builder: T,
        term: string | undefined,
        columns: string[],
    ): T => {
        if (!term || !term.trim() || !builder.or) return builder;
        const safe = term.trim().replace(/[%_]/g, "\\$&");
        const clause = columns.map((c) => `${c}.ilike.%${safe}%`).join(",");
        return builder.or(clause) as T;
    };

    const audiencesBuilderBase = (supabase.from("newsletter_audiences") as unknown as {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        select: (c: string, opts: { count: "exact" }) => any;
    })
        .select("*", { count: "exact" })
        .eq("workspace_id", workspaceId);
    const audiencesBuilder = applyTextFilter(audiencesBuilderBase, query.audiencesSearch, ["name", "slug", "description"]);

    const templatesBuilderBase = (supabase.from("newsletter_campaign_templates") as unknown as {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        select: (c: string, opts: { count: "exact" }) => any;
    })
        .select("*", { count: "exact" })
        .eq("workspace_id", workspaceId);
    const templatesBuilder = applyTextFilter(templatesBuilderBase, query.templatesSearch, ["name", "workflow_type"]);

    let campaignsBuilder = (supabase.from("newsletter_campaigns") as unknown as {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        select: (c: string, opts: { count: "exact" }) => any;
    })
        .select("*", { count: "exact" })
        .eq("workspace_id", workspaceId);
    if (query.campaignsStatuses && query.campaignsStatuses.length > 0) {
        campaignsBuilder = campaignsBuilder.in("status", query.campaignsStatuses);
    }
    campaignsBuilder = applyTextFilter(campaignsBuilder, query.campaignsSearch, ["title", "subject_line"]);

    const automationsBuilderBase = (supabase.from("newsletter_automations") as unknown as {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        select: (c: string, opts: { count: "exact" }) => any;
    })
        .select("*", { count: "exact" })
        .eq("workspace_id", workspaceId);
    const automationsBuilder = applyTextFilter(automationsBuilderBase, query.automationsSearch, ["name", "trigger_type"]);

    let contactsBuilder = (supabase.from("newsletter_contacts") as unknown as {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        select: (c: string, opts: { count: "exact" }) => any;
    })
        .select("*", { count: "exact" })
        .eq("workspace_id", workspaceId);
    if (query.contactsStatuses && query.contactsStatuses.length > 0) {
        contactsBuilder = contactsBuilder.in("status", query.contactsStatuses);
    }
    contactsBuilder = applyTextFilter(contactsBuilder, query.contactsSearch, [
        "email_normalized",
        "first_name",
        "last_name",
    ]);

    const countContactsByStatus = async (status: string) => {
        const res = await (supabase.from("newsletter_contacts") as unknown as {
            select: (c: string, opts: { count: "exact"; head: true }) => {
                eq: (c: string, v: string) => {
                    eq: (c: string, v: string) => Promise<{ count: number | null }>;
                };
            };
        })
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .eq("status", status);
        return { status, count: res.count ?? 0 };
    };

    const countCampaignsByStatus = async (status: string) => {
        const res = await (supabase.from("newsletter_campaigns") as unknown as {
            select: (c: string, opts: { count: "exact"; head: true }) => {
                eq: (c: string, v: string) => {
                    eq: (c: string, v: string) => Promise<{ count: number | null }>;
                };
            };
        })
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .eq("status", status);
        return { status, count: res.count ?? 0 };
    };

    const [
        audiencesResult,
        templatesResult,
        campaignsResult,
        automationsResult,
        contactsResult,
        contactsTotalResult,
        jobsResult,
        contentResult,
        activeAutomationsResult,
        sentCampaignsResult,
        ...allStatusCounts
    ] = await Promise.all([
        audiencesBuilder.order("created_at", { ascending: false }).range((aPage - 1) * aSize, aPage * aSize - 1),
        templatesBuilder.order("created_at", { ascending: false }).range((tPage - 1) * tSize, tPage * tSize - 1),
        campaignsBuilder.order("created_at", { ascending: false }).range((cPage - 1) * cSize, cPage * cSize - 1),
        automationsBuilder.order("created_at", { ascending: false }).range((autoPage - 1) * autoSize, autoPage * autoSize - 1),
        contactsBuilder.order("created_at", { ascending: false }).range((ctPage - 1) * ctSize, ctPage * ctSize - 1),
        supabase.from("newsletter_contacts").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
        supabase.from("newsletter_dispatch_jobs").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "pending"),
        supabase.from("content_items").select("id,title,slug,content_markdown,metadata").eq("workspace_id", workspaceId).in("type", ["blog", "newsletter_issue"]).order("created_at", { ascending: false }).limit(12),
        supabase.from("newsletter_automations").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "active"),
        supabase.from("newsletter_campaigns").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "sent"),
        ...CAMPAIGN_STATUS_VALUES.map(countCampaignsByStatus),
        ...CONTACT_STATUS_VALUES.map(countContactsByStatus),
    ]);

    const statusCountResults = allStatusCounts.slice(0, CAMPAIGN_STATUS_VALUES.length);
    const contactStatusResults = allStatusCounts.slice(CAMPAIGN_STATUS_VALUES.length);

    const latestRecipientsResult = await supabase
        .from("newsletter_campaign_recipients")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(12);

    const recipients = (latestRecipientsResult.data ?? []) as Database["public"]["Tables"]["newsletter_campaign_recipients"]["Row"][];
    const opens = recipients.reduce((sum, recipient) => sum + recipient.open_count, 0);
    const clicks = recipients.reduce((sum, recipient) => sum + recipient.click_count, 0);

    const campaignStatusCounts: Record<string, number> = {};
    for (const r of statusCountResults) {
        campaignStatusCounts[r.status] = r.count;
    }
    const contactStatusCounts: Record<string, number> = {};
    for (const r of contactStatusResults) {
        contactStatusCounts[r.status] = r.count;
    }

    return {
        settings,
        stats: {
            contacts: contactsTotalResult.count ?? 0,
            audiences: audiencesResult.count ?? 0,
            templates: templatesResult.count ?? 0,
            campaigns: campaignsResult.count ?? 0,
            sentCampaigns: sentCampaignsResult.count ?? 0,
            automations: automationsResult.count ?? 0,
            activeAutomations: activeAutomationsResult.count ?? 0,
            pendingJobs: jobsResult.count ?? 0,
            opens,
            clicks,
        },
        audiences: audiencesResult.data ?? [],
        audiencesPage: { page: aPage, pageSize: aSize, total: audiencesResult.count ?? 0 },
        templates: templatesResult.data ?? [],
        templatesPage: { page: tPage, pageSize: tSize, total: templatesResult.count ?? 0 },
        campaigns: campaignsResult.data ?? [],
        campaignsPage: { page: cPage, pageSize: cSize, total: campaignsResult.count ?? 0 },
        campaignStatusCounts,
        automations: automationsResult.data ?? [],
        automationsPage: { page: autoPage, pageSize: autoSize, total: automationsResult.count ?? 0 },
        contacts: contactsResult.data ?? [],
        contactsPage: { page: ctPage, pageSize: ctSize, total: contactsResult.count ?? 0 },
        contactStatusCounts,
        sourceContent: (contentResult.data ?? []) as ContentSourceRecord[],
        recentRecipients: recipients,
    };
}

// =============================================================================
// Contact view/edit (dashboard)
// =============================================================================
// `bounced` and `complained` rows are read-only — re-subscribing a known-bad
// address tanks sender reputation and bypasses the suppression that protects
// our domain. Only `pending → subscribed`, `subscribed → unsubscribed`, and
// `unsubscribed → subscribed` are operator-driven. Anything else returns an
// explicit error string so the UI can surface it.
const ALLOWED_STATUS_TRANSITIONS: Record<ContactStatus, ContactStatus[]> = {
    pending: ["pending", "subscribed", "unsubscribed"],
    subscribed: ["subscribed", "unsubscribed"],
    unsubscribed: ["unsubscribed", "subscribed"],
    bounced: ["bounced"],
    complained: ["complained"],
};

function isContactStatus(value: unknown): value is ContactStatus {
    return typeof value === "string" && (CONTACT_STATUS_VALUES as readonly string[]).includes(value);
}

export async function updateNewsletterContact(
    workspaceId: string,
    contactId: string,
    input: {
        firstName?: string | null;
        lastName?: string | null;
        locale?: string | null;
        status?: ContactStatus;
    },
): Promise<{ error: string | null }> {
    if (!contactId) return { error: "Contact id required." };
    const supabase = await createClient();

    const { data: existing, error: fetchError } = await supabase
        .from("newsletter_contacts")
        .select("id, status")
        .eq("id", contactId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
    if (fetchError) return { error: fetchError.message };
    if (!existing) return { error: "Contact not found." };

    const patch: Record<string, unknown> = {};
    if (input.firstName !== undefined) patch.first_name = input.firstName ?? null;
    if (input.lastName !== undefined) patch.last_name = input.lastName ?? null;
    if (input.locale !== undefined) patch.locale = input.locale ?? null;

    if (input.status !== undefined) {
        if (!isContactStatus(existing.status)) {
            return { error: "Contact has an unknown status; cannot transition." };
        }
        const allowed = ALLOWED_STATUS_TRANSITIONS[existing.status];
        if (!allowed.includes(input.status)) {
            return {
                error: `Cannot change status from ${existing.status} to ${input.status}. Bounced and complained addresses must stay suppressed to protect sender reputation.`,
            };
        }
        patch.status = input.status;
        const now = new Date().toISOString();
        if (input.status === "subscribed" && existing.status !== "subscribed") {
            patch.subscribed_at = now;
            patch.unsubscribed_at = null;
            patch.verified_at = now;
            patch.verification_token = null;
        }
        if (input.status === "unsubscribed") {
            patch.unsubscribed_at = now;
        }
    }

    if (Object.keys(patch).length === 0) return { error: null };

    const { error } = await supabase
        .from("newsletter_contacts")
        .update(patch)
        .eq("id", contactId)
        .eq("workspace_id", workspaceId);

    return { error: error?.message ?? null };
}

export async function unsubscribeNewsletterContact(
    workspaceId: string,
    contactId: string,
): Promise<{ error: string | null }> {
    return updateNewsletterContact(workspaceId, contactId, { status: "unsubscribed" });
}

function extractTemplateValues(content: ContentSourceRecord) {
    const metadata = (content.metadata ?? {}) as Record<string, unknown>;
    const excerpt = typeof metadata.excerpt === "string" ? metadata.excerpt : "";
    const body = content.content_markdown ?? "";
    const url = content.slug ? `${getSiteUrl()}/blog/${content.slug}` : `${getSiteUrl()}/dashboard/content/${content.id}`;

    return {
        title: content.title,
        excerpt,
        body,
        url,
    };
}

async function createCampaignFromTemplate(params: {
    supabase: SupabaseClient;
    workspaceId: string;
    automationId: string;
    audienceId: string | null;
    template: Database["public"]["Tables"]["newsletter_campaign_templates"]["Row"];
    sourceContent: ContentSourceRecord | null;
    settings: NewsletterSettings;
    subjectOverride?: string | null;
    preheaderOverride?: string | null;
    bodyOverride?: string | null;
}) {
    const values = params.sourceContent ? extractTemplateValues(params.sourceContent) : {
        title: params.template.name,
        excerpt: "",
        body: params.template.body_markdown_template,
        url: `${getSiteUrl()}/newsletter`,
    };

    const subjectLine = params.subjectOverride || interpolateTemplate(params.template.subject_template, values);
    const preheader = params.preheaderOverride || interpolateTemplate(params.template.preheader_template ?? "", values);
    const bodyMarkdown = params.bodyOverride || interpolateTemplate(params.template.body_markdown_template, values);
    const htmlBody = buildCampaignHtml({
        subjectLine,
        preheader,
        bodyMarkdown,
        settings: params.settings,
        ctaLabel: params.template.cta_label,
        ctaUrl: params.template.cta_url ? interpolateTemplate(params.template.cta_url, values) : null,
    });

    const sourceMetadata = params.sourceContent ? toJsonRecord(params.sourceContent.metadata) : {};
    const provenance = params.sourceContent
        ? buildContentCampaignProvenance({
            content: params.sourceContent,
            createdVia: "automation",
            existing: extractNewsletterProvenance(sourceMetadata),
        })
        : null;
    const { data, error } = await params.supabase.from("newsletter_campaigns").insert({
        workspace_id: params.workspaceId,
        source_content_id: params.sourceContent?.id ?? null,
        template_id: params.template.id,
        automation_id: params.automationId,
        audience_id: params.audienceId,
        title: `${params.template.name} • ${values.title}`,
        workflow_type: params.template.workflow_type,
        status: "draft",
        subject_line: subjectLine,
        preheader,
        body_markdown: bodyMarkdown,
        html_body: htmlBody,
        from_name: params.settings.fromName,
        from_email: params.settings.fromEmail,
        reply_to_email: params.settings.replyToEmail || null,
        metadata: {
            source: "automation",
            cta_label: params.template.cta_label,
            cta_url: params.template.cta_url ? interpolateTemplate(params.template.cta_url, values) : null,
            ...(provenance ? { provenance } : {}),
        },
    }).select("*").single();

    if (error || !data) {
        throw new Error(error?.message ?? "Failed to create automation campaign.");
    }

    return data;
}

export async function enqueueContentPublishedAutomations(contentId: string) {
    const supabase = await createClient();
    const { data: content, error } = await supabase
        .from("content_items")
        .select("id,workspace_id,title,slug,content_markdown,metadata")
        .eq("id", contentId)
        .single();

    if (error || !content?.workspace_id) {
        return;
    }

    const { data: automations } = await supabase
        .from("newsletter_automations")
        .select("*")
        .eq("workspace_id", content.workspace_id)
        .eq("trigger_type", "content_published")
        .eq("status", "active");

    if (!automations?.length) {
        return;
    }

    for (const automation of automations) {
        const { data: firstStep } = await supabase
            .from("newsletter_automation_steps")
            .select("position,delay_minutes")
            .eq("automation_id", automation.id)
            .order("position", { ascending: true })
            .limit(1)
            .maybeSingle();
        if (!firstStep) continue;

        const nextRunAt = addMinutes(new Date(), firstStep.delay_minutes).toISOString();
        const { data: existingEnrollment } = await supabase
            .from("newsletter_automation_enrollments")
            .select("id,status")
            .eq("automation_id", automation.id)
            .eq("source_content_id", content.id)
            .maybeSingle();

        if (existingEnrollment && !["pending", "active"].includes(existingEnrollment.status)) {
            continue;
        }

        const enrollmentResult = existingEnrollment
            ? await supabase
                .from("newsletter_automation_enrollments")
                .update({
                    status: "active",
                    next_run_at: nextRunAt,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", existingEnrollment.id)
                .select("id")
                .single()
            : await supabase
                .from("newsletter_automation_enrollments")
                .insert({
                    automation_id: automation.id,
                    workspace_id: content.workspace_id,
                    source_content_id: content.id,
                    status: "active",
                    current_step_position: 0,
                    next_run_at: nextRunAt,
                    metadata: {
                        trigger_type: "content_published",
                        first_step_position: firstStep.position,
                    } as unknown as Json,
                })
                .select("id")
                .single();

        const { data: enrollment, error: enrollmentError } = enrollmentResult;

        if (!enrollmentError && enrollment) {
            await enqueueAutomationStepJob({
                supabase,
                workspaceId: content.workspace_id,
                enrollmentId: enrollment.id,
                automationId: automation.id,
                sourceContentId: content.id,
                nextStepPosition: firstStep.position,
                runAt: nextRunAt,
            });
        }
    }
}

async function runAutomationJobs(supabase: SupabaseClient) {
    const { data: jobs } = await supabase
        .from("newsletter_dispatch_jobs")
        .select("*")
        .eq("job_type", "automation_step")
        .eq("status", "pending")
        .lte("run_at", new Date().toISOString())
        .order("run_at", { ascending: true })
        .limit(20);

    let processed = 0;

    for (const job of jobs ?? []) {
        const metadata = (job.metadata ?? {}) as Record<string, unknown>;
        const enrollmentId = job.automation_enrollment_id ?? (typeof metadata.enrollment_id === "string" ? metadata.enrollment_id : null);

        if (!enrollmentId) {
            await supabase.from("newsletter_dispatch_jobs").update({ status: "failed", last_error: "Missing automation enrollment id", attempts: job.attempts + 1 }).eq("id", job.id);
            continue;
        }

        await supabase.from("newsletter_dispatch_jobs").update({ status: "running", attempts: job.attempts + 1, updated_at: new Date().toISOString() }).eq("id", job.id);

        const { data: enrollment } = await supabase
            .from("newsletter_automation_enrollments")
            .select("*")
            .eq("id", enrollmentId)
            .maybeSingle();

        if (!enrollment || !["pending", "active"].includes(enrollment.status)) {
            await supabase.from("newsletter_dispatch_jobs").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", job.id);
            continue;
        }

        const automationId = enrollment.automation_id;
        const sourceContentId = enrollment.source_content_id;
        const contactId = enrollment.contact_id;

        const [{ data: automation }, { data: steps }, { data: workspace }, { data: sourceContent }, { data: contact }] = await Promise.all([
            supabase.from("newsletter_automations").select("*").eq("id", automationId).maybeSingle(),
            supabase.from("newsletter_automation_steps").select("*").eq("automation_id", automationId).order("position", { ascending: true }),
            supabase.from("workspaces").select("name").eq("id", job.workspace_id).maybeSingle(),
            sourceContentId
                ? supabase.from("content_items").select("id,title,slug,content_markdown,metadata").eq("id", sourceContentId).maybeSingle()
                : Promise.resolve({ data: null }),
            contactId
                ? supabase.from("newsletter_contacts").select("id,email,metadata,status").eq("id", contactId).maybeSingle()
                : Promise.resolve({ data: null }),
        ]);

        if (!automation || !steps?.length || automation.status !== "active") {
            await supabase.from("newsletter_dispatch_jobs").update({ status: "failed", last_error: "Automation steps missing or inactive", updated_at: new Date().toISOString() }).eq("id", job.id);
            await supabase.from("newsletter_automation_enrollments").update({ status: "failed", last_error: "Automation steps missing or inactive", updated_at: new Date().toISOString() }).eq("id", enrollmentId);
            continue;
        }

        if (contact && contact.status !== "subscribed") {
            await supabase.from("newsletter_dispatch_jobs").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", job.id);
            await supabase.from("newsletter_automation_enrollments").update({ status: "stopped", last_error: "Contact is no longer subscribed", updated_at: new Date().toISOString() }).eq("id", enrollmentId);
            continue;
        }

        const nextStep = steps.find((step) => step.position > enrollment.current_step_position);
        if (!nextStep) {
            await supabase.from("newsletter_dispatch_jobs").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", job.id);
            await supabase.from("newsletter_automation_enrollments").update({ status: "completed", next_run_at: null, updated_at: new Date().toISOString() }).eq("id", enrollmentId);
            continue;
        }

        const settings = await getNewsletterSettingsForWorkspace(job.workspace_id, workspace?.name ?? "Workspace");
        if (nextStep.step_type === "send_campaign" && nextStep.template_id) {
            const { data: existingCampaign } = await supabase
                .from("newsletter_campaigns")
                .select("id")
                .eq("automation_id", automation.id)
                .contains("metadata", { enrollment_id: enrollmentId, automation_step_position: nextStep.position })
                .maybeSingle();

            if (!existingCampaign) {
                const { data: template } = await supabase
                    .from("newsletter_campaign_templates")
                    .select("*")
                    .eq("id", nextStep.template_id)
                    .single();

                if (!template) {
                    await supabase.from("newsletter_dispatch_jobs").update({ status: "failed", last_error: "Automation step template missing", updated_at: new Date().toISOString() }).eq("id", job.id);
                    await supabase.from("newsletter_automation_enrollments").update({ status: "failed", last_error: "Automation step template missing", updated_at: new Date().toISOString() }).eq("id", enrollmentId);
                    continue;
                }

                const campaign = await createCampaignFromTemplate({
                    supabase,
                    workspaceId: job.workspace_id,
                    automationId: automation.id,
                    audienceId: automation.audience_id,
                    template,
                    sourceContent: (sourceContent ?? null) as ContentSourceRecord | null,
                    settings,
                    subjectOverride: nextStep.subject_line_override,
                    preheaderOverride: nextStep.preheader_override,
                    bodyOverride: nextStep.body_markdown_override || (contact?.email ? `Welcome ${contact.email}.\n\n${template.body_markdown_template}` : null),
                });

                await supabase.from("newsletter_campaigns").update({
                    metadata: {
                        ...toJsonRecord(campaign.metadata),
                        enrollment_id: enrollmentId,
                        automation_step_position: nextStep.position,
                        ...(contactId ? { target_contact_id: contactId } : {}),
                    } as unknown as Json,
                }).eq("id", campaign.id);
                await supabase.from("newsletter_campaigns").update({
                    status: "sending",
                    scheduled_for: null,
                    updated_at: new Date().toISOString(),
                }).eq("id", campaign.id);
                await supabase.from("newsletter_dispatch_jobs").insert({
                    workspace_id: job.workspace_id,
                    job_type: "campaign_send",
                    campaign_id: campaign.id,
                    status: "pending",
                    run_at: new Date().toISOString(),
                });
            }
            processed += 1;
        }

        await supabase.from("newsletter_dispatch_jobs").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", job.id);
        await supabase
            .from("newsletter_automation_enrollments")
            .update({
                status: "active",
                next_run_at: null,
                updated_at: new Date().toISOString(),
            })
            .eq("id", enrollmentId);
    }

    return processed;
}

// Time budget for one dispatch cycle. Vercel Hobby times out at 10s, Pro at
// 60s; we leave a margin so the final batch's upserts complete cleanly. Past
// this, the campaign is recorded as `partial_sent` and the dispatch job is
// re-queued so the next cycle picks up the rest.
const DISPATCH_SOFT_DEADLINE_MS = 50_000;
// Resend Batch API max per request.
const RESEND_BATCH_SIZE = 100;

async function advanceAutomationAfterCampaign(
    supabase: SupabaseClient,
    campaign: Database["public"]["Tables"]["newsletter_campaigns"]["Row"],
) {
    const metadata = toJsonRecord(campaign.metadata);
    const enrollmentId = typeof metadata.enrollment_id === "string" ? metadata.enrollment_id : null;
    const completedPosition = typeof metadata.automation_step_position === "number"
        ? metadata.automation_step_position
        : null;
    if (!enrollmentId || completedPosition === null || !campaign.automation_id) return;

    const { data: enrollment } = await supabase
        .from("newsletter_automation_enrollments")
        .select("id,current_step_position,contact_id,source_content_id,status")
        .eq("id", enrollmentId)
        .maybeSingle();
    if (!enrollment || enrollment.current_step_position >= completedPosition || enrollment.status === "stopped") {
        return;
    }

    const { data: followingStep } = await supabase
        .from("newsletter_automation_steps")
        .select("position,delay_minutes")
        .eq("automation_id", campaign.automation_id)
        .gt("position", completedPosition)
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();
    const followingRunAt = followingStep
        ? addMinutes(new Date(), followingStep.delay_minutes).toISOString()
        : null;

    await supabase
        .from("newsletter_automation_enrollments")
        .update({
            status: followingStep ? "active" : "completed",
            current_step_position: completedPosition,
            next_run_at: followingRunAt,
            last_error: null,
            updated_at: new Date().toISOString(),
        })
        .eq("id", enrollmentId);

    if (followingStep && followingRunAt) {
        await enqueueAutomationStepJob({
            supabase,
            workspaceId: campaign.workspace_id,
            enrollmentId,
            automationId: campaign.automation_id,
            contactId: enrollment.contact_id,
            sourceContentId: enrollment.source_content_id,
            nextStepPosition: followingStep.position,
            runAt: followingRunAt,
        });
    }
}

// True for Resend "domain not verified" responses. These fail every recipient
// in a campaign for the same reason; we surface it as a campaign-level error
// once instead of marking each recipient `failed` with the same opaque text.
function isDomainVerificationError(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    const m = err.message.toLowerCase();
    return m.includes("403") && (m.includes("domain") || m.includes("verify"));
}

async function runCampaignJobs(supabase: SupabaseClient) {
    const cycleStart = Date.now();
    const { data: jobs } = await supabase
        .from("newsletter_dispatch_jobs")
        .select("*")
        .eq("job_type", "campaign_send")
        .eq("status", "pending")
        .lte("run_at", new Date().toISOString())
        .order("run_at", { ascending: true })
        .limit(10);

    let processed = 0;

    for (const job of jobs ?? []) {
        if (Date.now() - cycleStart > DISPATCH_SOFT_DEADLINE_MS) break;
        if (!job.campaign_id) continue;

        const { data: campaign } = await supabase
            .from("newsletter_campaigns")
            .select("*")
            .eq("id", job.campaign_id)
            .single();

        const campaignMetadata = toJsonRecord(campaign?.metadata);
        const targetContactId = typeof campaignMetadata.target_contact_id === "string"
            ? campaignMetadata.target_contact_id
            : null;

        if (!campaign || (!campaign.audience_id && !targetContactId)) {
            await supabase.from("newsletter_dispatch_jobs").update({
                status: "failed",
                attempts: job.attempts + 1,
                last_error: "Campaign audience and target contact are missing",
            }).eq("id", job.id);
            continue;
        }

        // SQL-level filter: only contacts currently subscribed AND that don't
        // already have a `sent`/`delivered` recipient row for this campaign.
        // This makes a resumed dispatch idempotent without needing the loop
        // to track sent emails itself.
        const { data: workspaceRow } = await supabase
            .from("workspaces")
            .select("name")
            .eq("id", job.workspace_id)
            .single();

        const settings = await getNewsletterSettingsForWorkspace(
            job.workspace_id,
            workspaceRow?.name ?? "Workspace",
        );

        // CAN-SPAM / Gmail bulk-sender compliance: refuse to dispatch when
        // the postal address is still the placeholder. The previous behavior
        // shipped the literal string "Workspace address not configured yet"
        // in every email footer — non-compliant and unprofessional. Fail
        // the job loudly so the operator notices and configures it.
        if (
            !settings.companyAddress ||
            settings.companyAddress.trim() === NEWSLETTER_ADDRESS_PLACEHOLDER ||
            settings.companyAddress.trim().length < 5
        ) {
            const attempts = job.attempts + 1;
            await supabase.from("newsletter_dispatch_jobs").update({
                status: attempts >= 20 ? "failed" : "pending",
                attempts,
                last_error: "Newsletter postal address is not configured. Set it in Settings → Newsletter before sending.",
                run_at: addMinutes(new Date(), 15).toISOString(),
                updated_at: new Date().toISOString(),
            }).eq("id", job.id);
            await supabase.from("newsletter_campaigns").update({
                status: "draft",
            }).eq("id", job.campaign_id);
            continue;
        }

        await supabase.from("newsletter_campaigns").update({
            status: "sending",
            updated_at: new Date().toISOString(),
        }).eq("id", campaign.id);

        const { data: alreadySentRows } = await supabase
            .from("newsletter_campaign_recipients")
            .select("contact_id, send_status")
            .eq("campaign_id", campaign.id);

        const alreadyHandled = new Set(
            (alreadySentRows ?? [])
                .filter((r) => r.send_status !== "pending" && r.send_status !== "failed")
                .map((r) => r.contact_id as string),
        );

        type SendableContact = {
            id: string;
            email: string;
            email_normalized: string;
            status: string;
            locale: string | null;
            unsubscribe_token: string;
        };

        let candidateContacts: SendableContact[] = [];
        if (targetContactId) {
            const { data: targetContact } = await supabase
                .from("newsletter_contacts")
                .select("id,email,email_normalized,status,locale,unsubscribe_token")
                .eq("workspace_id", job.workspace_id)
                .eq("id", targetContactId)
                .maybeSingle();
            candidateContacts = targetContact ? [targetContact] : [];
            candidateContacts = selectAutomationRecipients(candidateContacts, targetContactId);
        } else if (campaign.audience_id) {
            const { data: audienceMembers } = await supabase
                .from("newsletter_audience_members")
                .select("contact_id, newsletter_contacts!inner(id,email,email_normalized,status,locale,unsubscribe_token)")
                .eq("audience_id", campaign.audience_id)
                .eq("newsletter_contacts.status", "subscribed");
            candidateContacts = (audienceMembers ?? [])
                .map((member) => Array.isArray(member.newsletter_contacts)
                    ? member.newsletter_contacts[0]
                    : member.newsletter_contacts)
                .filter((contact): contact is SendableContact => Boolean(contact?.id));
        }

        const sendableContacts = candidateContacts.filter((contact) => !alreadyHandled.has(contact.id));
        if (targetContactId && candidateContacts.length === 0) {
            const enrollmentId = typeof campaignMetadata.enrollment_id === "string"
                ? campaignMetadata.enrollment_id
                : null;
            await supabase.from("newsletter_dispatch_jobs").update({
                status: "failed",
                attempts: job.attempts + 1,
                last_error: "Automation target contact is missing or no longer subscribed.",
                updated_at: new Date().toISOString(),
            }).eq("id", job.id);
            await supabase.from("newsletter_campaigns").update({
                status: "failed",
                updated_at: new Date().toISOString(),
            }).eq("id", campaign.id);
            if (enrollmentId) {
                await supabase.from("newsletter_automation_enrollments").update({
                    status: "stopped",
                    last_error: "Automation target contact is missing or no longer subscribed.",
                    updated_at: new Date().toISOString(),
                }).eq("id", enrollmentId);
            }
            continue;
        }

        const fromAddress = formatFromAddress(
            campaign.from_name || settings.fromName,
            campaign.from_email || settings.fromEmail,
        );

        let domainErrorAborted = false;
        let sentThisJob = 0;
        let failedThisJob = 0;

        // Chunk into Resend Batch API requests of up to 100 messages each.
        for (let i = 0; i < sendableContacts.length; i += RESEND_BATCH_SIZE) {
            if (Date.now() - cycleStart > DISPATCH_SOFT_DEADLINE_MS) break;

            const slice = sendableContacts.slice(i, i + RESEND_BATCH_SIZE);
            const messages = slice.map((contact) => {
                const unsubscribeUrl = buildUnsubscribeUrl(contact.unsubscribe_token);
                // Pull the article URL + CTA from the campaign metadata so
                // the dispatch-time render matches what was stored at create
                // time. If the columns are absent (older campaigns) the
                // renderer simply falls back to its placeholder-stripping path.
                const campaignMetadata = (campaign.metadata ?? {}) as { cta?: { label?: string; url?: string } | null };
                const campaignCta = campaignMetadata.cta && typeof campaignMetadata.cta.url === "string"
                    ? campaignMetadata.cta
                    : null;
                const html = buildCampaignHtml({
                    subjectLine: campaign.subject_line,
                    preheader: campaign.preheader || "",
                    bodyMarkdown: campaign.body_markdown,
                    settings,
                    unsubscribeUrl,
                    ctaLabel: campaignCta?.label ?? null,
                    ctaUrl: campaignCta?.url ?? null,
                    articleUrl: campaignCta?.url ?? null,
                });
                return {
                    from: fromAddress,
                    to: contact.email,
                    subject: campaign.subject_line,
                    html,
                    replyTo: campaign.reply_to_email || settings.replyToEmail || undefined,
                    headers: buildListUnsubscribeHeaders(unsubscribeUrl),
                };
            });

            try {
                const batchResult = await sendEmailBatch(messages);
                const ids = batchResult.data.map((d) => d.id);
                const rows = slice.map((contact, idx) => ({
                    campaign_id: campaign.id,
                    contact_id: contact.id,
                    email: contact.email,
                    provider_message_id: ids[idx] ?? null,
                    send_status: "sent",
                    sent_at: new Date().toISOString(),
                }));
                await supabase
                    .from("newsletter_campaign_recipients")
                    .upsert(rows, { onConflict: "campaign_id,contact_id" });
                sentThisJob += slice.length;
            } catch (error) {
                // Domain verification errors fail every recipient identically —
                // mark the campaign as failed once and stop. Operator gets
                // a clear, actionable message instead of N identical "failed"
                // recipient rows.
                if (isDomainVerificationError(error)) {
                    domainErrorAborted = true;
                    break;
                }
                const message = error instanceof Error ? error.message : "Send failed.";
                const rows = slice.map((contact) => ({
                    campaign_id: campaign.id,
                    contact_id: contact.id,
                    email: contact.email,
                    send_status: "failed",
                    last_error: message,
                }));
                await supabase
                    .from("newsletter_campaign_recipients")
                    .upsert(rows, { onConflict: "campaign_id,contact_id" });
                failedThisJob += slice.length;
            }
        }

        if (domainErrorAborted) {
            await supabase.from("newsletter_campaigns").update({
                status: "failed",
                updated_at: new Date().toISOString(),
            }).eq("id", campaign.id);
            await supabase.from("newsletter_dispatch_jobs").update({
                status: "failed",
                attempts: job.attempts + 1,
                last_error: "Sending domain is not verified at Resend. Verify the domain or update NEWSLETTER_FROM_EMAIL.",
                updated_at: new Date().toISOString(),
            }).eq("id", job.id);
            processed += 1;
            continue;
        }

        // Honest terminal state. If anything was deferred (deadline hit, or
        // failed recipients we want to retry), record the campaign as
        // partial_sent and leave the dispatch job pending for the next cycle.
        const remaining = sendableContacts.length - sentThisJob;
        const isComplete = remaining === 0 && failedThisJob === 0;

        await supabase.from("newsletter_campaigns").update({
            status: isComplete ? "sent" : "partial_sent",
            sent_at: isComplete ? new Date().toISOString() : campaign.sent_at,
            updated_at: new Date().toISOString(),
        }).eq("id", campaign.id);

        await supabase.from("newsletter_dispatch_jobs").update({
            status: isComplete ? "completed" : "pending",
            attempts: job.attempts + 1,
            last_error: isComplete ? null : `Partial cycle: ${sentThisJob} sent, ${failedThisJob} failed, ${remaining} remaining`,
            run_at: isComplete ? job.run_at : new Date(Date.now() + 60_000).toISOString(),
            updated_at: new Date().toISOString(),
        }).eq("id", job.id);

        if (isComplete) {
            await advanceAutomationAfterCampaign(supabase, campaign);
        }

        processed += 1;
    }

    return processed;
}

export async function runNewsletterDispatchCycle() {
    assertEmailSubsystemReady();
    const supabase = getServiceClient() as unknown as SupabaseClient;
    const automationJobs = await runAutomationJobs(supabase);
    const campaignJobs = await runCampaignJobs(supabase);

    return {
        automationJobs,
        campaignJobs,
    };
}

function coerceWorkspaceIdFromPayload(payload: Record<string, unknown>): string | null {
    if (typeof payload.workspace_id === "string") {
        return payload.workspace_id;
    }

    if (payload.workspace_id && typeof payload.workspace_id === "object") {
        const nestedId = (payload.workspace_id as { id?: unknown }).id;
        return typeof nestedId === "string" ? nestedId : null;
    }

    const metadataWorkspaceId = payload.metadata && typeof payload.metadata === "object"
        ? (payload.metadata as { workspace_id?: unknown }).workspace_id
        : null;

    return typeof metadataWorkspaceId === "string" ? metadataWorkspaceId : null;
}

export async function processNewsletterWebhook(payload: Record<string, unknown>) {
    const supabase = getServiceClient();
    const providerEventId = typeof payload.created_at === "string" ? `${payload.type ?? "event"}:${payload.created_at}` : null;
    const eventType = typeof payload.type === "string" ? payload.type : "unknown";

    const data = payload.data && typeof payload.data === "object" ? payload.data as Record<string, unknown> : {};
    const providerMessageId = typeof data.email_id === "string"
        ? data.email_id
        : typeof data.emailId === "string"
            ? data.emailId
            : typeof data.id === "string"
                ? data.id
                : null;

    // Resolve workspace from provider_message_id via database lookup; do not trust payload body.
    let workspaceId: string | null = null;
    let existingRecipient: Database["public"]["Tables"]["newsletter_campaign_recipients"]["Row"] | null = null;
    if (providerMessageId) {
        const { data: recipient } = await supabase
            .from("newsletter_campaign_recipients")
            .select("*, newsletter_campaigns!inner(workspace_id)")
            .eq("provider_message_id", providerMessageId)
            .maybeSingle();

        if (recipient) {
            existingRecipient = recipient as unknown as Database["public"]["Tables"]["newsletter_campaign_recipients"]["Row"];
            const campaign = (recipient as unknown as { newsletter_campaigns?: { workspace_id?: string } | { workspace_id?: string }[] }).newsletter_campaigns;
            const campaignRow = Array.isArray(campaign) ? campaign[0] : campaign;
            workspaceId = campaignRow?.workspace_id ?? null;
        }
    }

    if (!workspaceId) {
        workspaceId = coerceWorkspaceIdFromPayload(payload);
    }

    const { error: webhookError } = await supabase.from("newsletter_webhook_events").upsert({
        workspace_id: workspaceId,
        provider: "resend",
        event_type: eventType,
        provider_event_id: providerEventId,
        payload: payload as unknown as Json,
        processed_at: new Date().toISOString(),
    }, { onConflict: "provider,provider_event_id" });

    if (webhookError) {
        return { error: webhookError.message };
    }

    if (!providerMessageId || !existingRecipient) {
        return { error: null };
    }

    const nextUpdate: Database["public"]["Tables"]["newsletter_campaign_recipients"]["Update"] = {
        updated_at: new Date().toISOString(),
    };

    if (eventType === "email.sent") {
        nextUpdate.send_status = "sent";
        nextUpdate.sent_at = new Date().toISOString();
    } else if (eventType === "email.delivered") {
        nextUpdate.send_status = "delivered";
        nextUpdate.delivered_at = new Date().toISOString();
    } else if (eventType === "email.opened") {
        nextUpdate.send_status = "opened";
        nextUpdate.opened_at = new Date().toISOString();
        nextUpdate.open_count = (existingRecipient.open_count ?? 0) + 1;
    } else if (eventType === "email.clicked") {
        nextUpdate.send_status = "clicked";
        nextUpdate.clicked_at = new Date().toISOString();
        nextUpdate.click_count = (existingRecipient.click_count ?? 0) + 1;
    } else if (eventType === "email.bounced") {
        nextUpdate.send_status = "bounced";
        nextUpdate.bounced_at = new Date().toISOString();
        // Suppress the contact so future campaigns don't include this
        // address. Resend's bounce taxonomy distinguishes hard vs soft;
        // we only suppress on hard (`type === "hard_bounce"` / `bounce_type`
        // beginning with "Permanent"). Soft bounces stay subscribed —
        // Resend retries those internally.
        const bounceType =
            (typeof data.type === "string" && data.type)
            || (typeof data.bounce_type === "string" && data.bounce_type)
            || "";
        const isHardBounce =
            bounceType.toLowerCase() === "hard_bounce"
            || bounceType.startsWith("Permanent");
        if (isHardBounce && existingRecipient.contact_id) {
            await supabase.from("newsletter_contacts").update({
                status: "bounced",
                bounced_at: new Date().toISOString(),
            }).eq("id", existingRecipient.contact_id);
        }
    } else if (eventType === "email.complained") {
        nextUpdate.send_status = "complained";
        nextUpdate.complained_at = new Date().toISOString();
        // Complaints are always terminal — spam reports must immediately
        // suppress the contact to protect sender reputation.
        if (existingRecipient.contact_id) {
            await supabase.from("newsletter_contacts").update({
                status: "complained",
                complained_at: new Date().toISOString(),
            }).eq("id", existingRecipient.contact_id);
        }
    } else if (eventType === "email.delivery_delayed") {
        // Soft state — Resend retries internally. Surface it so the
        // operator dashboard can show "delivery delayed" instead of stale
        // "sent". Don't overwrite a terminal bounce/complaint.
        if (existingRecipient.send_status !== "bounced" && existingRecipient.send_status !== "complained") {
            nextUpdate.send_status = "delayed";
        }
    } else if (eventType === "email.failed") {
        nextUpdate.send_status = "failed";
        const reason = typeof data.reason === "string" ? data.reason : null;
        if (reason) nextUpdate.last_error = reason;
    }

    const { error } = await supabase
        .from("newsletter_campaign_recipients")
        .update(nextUpdate)
        .eq("provider_message_id", providerMessageId);

    if (workspaceId) {
        const mappedEvent = eventType === "email.bounced"
            ? "bounced"
            : eventType === "email.complained"
                ? "complained"
                : eventType === "email.sent"
                    ? "campaign_sent"
                    : null;
        if (mappedEvent) {
            let contact: { email: string; name: string | null } | null = null;
            if (existingRecipient.contact_id) {
                const { data: contactRow } = await supabase
                    .from("newsletter_contacts")
                    .select("email,first_name,last_name")
                    .eq("id", existingRecipient.contact_id)
                    .maybeSingle();
                if (contactRow?.email) {
                    contact = {
                        email: contactRow.email,
                        name: [contactRow.first_name, contactRow.last_name].filter(Boolean).join(" ") || contactRow.email,
                    };
                }
            }
            await recordNewsletterBusinessEvent({
                supabase,
                workspaceId,
                eventType: mappedEvent,
                contact: contact ? { email: contact.email, name: contact.name } : undefined,
                contactId: existingRecipient.contact_id,
                campaignId: existingRecipient.campaign_id,
                providerEventId,
                payload: { providerMessageId, resendEventType: eventType },
            });
        }
        await recordBusinessIntegrationHealthCheck({
            workspaceId,
            provider: "resend",
            integrationKey: "email-delivery",
            status: eventType === "email.failed" || eventType === "email.bounced" || eventType === "email.complained" ? "degraded" : "healthy",
            message: `Resend webhook processed: ${eventType}`,
            details: { providerMessageId, providerEventId, sendStatus: nextUpdate.send_status ?? null },
        });
    }

    return { error: error?.message ?? null };
}
