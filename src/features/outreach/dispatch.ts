import { createAdminClient } from "@/shared/lib/supabase/admin";
import { sendEmail } from "@/shared/lib/resend/send-email";
import {
    buildListUnsubscribeHeaders,
    buildOutreachUnsubscribeUrl,
    domainFromEmail,
    evaluateContactEligibility,
    evaluateMessageEligibility,
    normalizeOutreachEmail,
} from "@/features/outreach/compliance";
import { renderOutreachEmailHtml } from "@/features/outreach/email-template";
import { createOutreachUnsubscribeToken } from "@/features/outreach/unsubscribe-token";
import { recordOutreachBusinessEvent } from "@/features/business-spine/recorders";
import { getSiteUrl } from "@/shared/lib/site-url";
import type {
    OutreachContactRow,
    OutreachDispatchJobRow,
    OutreachMessageRow,
    OutreachWorkspaceSettingsRow,
    OutreachWorkerResult,
} from "@/features/outreach/types";

type RpcError = { message: string } | null;

type JoinedMessage = OutreachMessageRow & {
    outreach_contacts?: OutreachContactRow | OutreachContactRow[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
    return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function defaultSettings(workspaceId: string): OutreachWorkspaceSettingsRow {
    return {
        workspace_id: workspaceId,
        from_name: process.env.OUTREACH_FROM_NAME?.trim() || "Your team",
        from_email: process.env.OUTREACH_FROM_EMAIL?.trim() || null,
        reply_to_email: process.env.OUTREACH_REPLY_TO_EMAIL?.trim() || process.env.NEWSLETTER_REPLY_TO_EMAIL?.trim() || null,
        company_address: null,
        daily_workspace_cap: 25,
        daily_sender_cap: 20,
        daily_domain_cap: 2,
        require_human_approval: true,
        warmup_enabled: true,
        allowed_lawful_bases: ["explicit_consent", "existing_customer", "legitimate_interest_assessment", "manual_warranty"],
        default_country: "NL",
        metadata: {},
        created_at: new Date(0).toISOString(),
        updated_at: new Date(0).toISOString(),
    };
}

function sender(settings: OutreachWorkspaceSettingsRow) {
    const fromEmail = settings.from_email?.trim() || process.env.OUTREACH_FROM_EMAIL?.trim() || process.env.NEWSLETTER_FROM_EMAIL?.trim();
    if (!fromEmail) throw new Error("Outreach sender is not configured.");
    const fromName = settings.from_name?.trim() || process.env.OUTREACH_FROM_NAME?.trim();
    return fromName && !fromEmail.includes("<") ? `${fromName} <${fromEmail}>` : fromEmail;
}

async function countSentToday(supabase: ReturnType<typeof createAdminClient>, workspaceId: string, fromEmail: string, recipientDomain: string | null) {
    const since = new Date();
    since.setHours(0, 0, 0, 0);

    const { count: workspaceCount } = await (supabase.from("outreach_events" as never) as unknown as {
        select: (columns: string, opts: { count: "exact"; head: true }) => {
            eq: (column: string, value: string) => {
                eq: (column: string, value: string) => {
                    gte: (column: string, value: string) => Promise<{ count: number | null }>;
                };
            };
        };
    })
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("event_type", "sent")
        .gte("occurred_at", since.toISOString());

    const { count: senderCount } = await (supabase.from("outreach_messages" as never) as unknown as {
        select: (columns: string, opts: { count: "exact"; head: true }) => {
            eq: (column: string, value: string) => {
                eq: (column: string, value: string) => {
                    gte: (column: string, value: string) => Promise<{ count: number | null }>;
                };
            };
        };
    })
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("metadata->>from_email", fromEmail)
        .gte("last_event_at", since.toISOString());

    if (!recipientDomain) {
        return { workspaceCount: workspaceCount ?? 0, senderCount: senderCount ?? 0, domainCount: 0 };
    }

    const { count: domainCount } = await (supabase.from("outreach_messages" as never) as unknown as {
        select: (columns: string, opts: { count: "exact"; head: true }) => {
            eq: (column: string, value: string) => {
                eq: (column: string, value: string) => {
                    gte: (column: string, value: string) => Promise<{ count: number | null }>;
                };
            };
        };
    })
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("metadata->>recipient_domain", recipientDomain)
        .gte("last_event_at", since.toISOString());

    return { workspaceCount: workspaceCount ?? 0, senderCount: senderCount ?? 0, domainCount: domainCount ?? 0 };
}

async function processClaimedOutreachDispatchJob(
    supabase: ReturnType<typeof createAdminClient>,
    job: OutreachDispatchJobRow,
): Promise<OutreachWorkerResult> {
    try {
        const { data, error } = await supabase
            .from("outreach_messages" as never)
            .select("*, outreach_contacts(*)" as never)
            .eq("id" as never, job.message_id as never)
            .maybeSingle();
        if (error) throw new Error(error.message);
        const message = data as unknown as JoinedMessage | null;
        if (!message) throw new Error("Outreach message not found.");

        const contact = one(message.outreach_contacts);
        if (!contact) throw new Error("Outreach contact not found.");
        const { data: settingsData } = await supabase
            .from("outreach_workspace_settings" as never)
            .select("*" as never)
            .eq("workspace_id" as never, message.workspace_id as never)
            .maybeSingle();
        const settings = (settingsData as unknown as OutreachWorkspaceSettingsRow | null) ?? defaultSettings(message.workspace_id);
        const email = normalizeOutreachEmail(contact.email);
        if (!email) throw new Error("Outreach contact email is invalid.");

        const contactEligibility = evaluateContactEligibility({ contact, settings });
        if (!contactEligibility.allowed) throw new Error(contactEligibility.reason);
        const messageEligibility = evaluateMessageEligibility({ message, requireHumanApproval: settings.require_human_approval });
        if (!messageEligibility.allowed) throw new Error(messageEligibility.reason);

        const from = sender(settings);
        const fromEmail = settings.from_email?.trim() || process.env.OUTREACH_FROM_EMAIL?.trim() || from;
        const recipientDomain = domainFromEmail(email);
        const counts = await countSentToday(supabase, message.workspace_id, fromEmail, recipientDomain);
        if (counts.workspaceCount >= settings.daily_workspace_cap) throw new Error("Workspace daily outreach cap reached.");
        if (counts.senderCount >= settings.daily_sender_cap) throw new Error("Sender daily outreach cap reached.");
        if (recipientDomain && counts.domainCount >= settings.daily_domain_cap) throw new Error("Recipient domain daily outreach cap reached.");

        const token = createOutreachUnsubscribeToken({ workspaceId: message.workspace_id, messageId: message.id });
        const unsubscribeUrl = buildOutreachUnsubscribeUrl(message.id, token);
        const replyTo = settings.reply_to_email ?? process.env.OUTREACH_REPLY_TO_EMAIL?.trim() ?? undefined;
        const result = await sendEmail({
            from,
            to: email,
            subject: message.subject,
            html: renderOutreachEmailHtml({
                bodyHtml: message.body_html,
                previewText: message.preview_text,
                unsubscribeUrl,
                brandName: settings.from_name?.trim() || process.env.OUTREACH_FROM_NAME?.trim() || "Your team",
                siteUrl: getSiteUrl(),
                logoUrl: process.env.OUTREACH_LOGO_URL?.trim() || null,
                footerText: process.env.OUTREACH_FOOTER_TEXT?.trim() || null,
            }),
            replyTo,
            headers: buildListUnsubscribeHeaders(unsubscribeUrl, replyTo),
            idempotencyKey: job.idempotency_key,
        });
        const now = new Date().toISOString();

        await supabase.from("outreach_messages" as never).update({
            status: "sent",
            provider: "resend",
            provider_message_id: result.id,
            idempotency_key: job.idempotency_key,
            last_event_at: now,
            metadata: {
                ...(message.metadata && typeof message.metadata === "object" ? message.metadata as Record<string, unknown> : {}),
                from_email: fromEmail,
                recipient_domain: recipientDomain,
                unsubscribe_url: unsubscribeUrl,
                email_template: "workspace_outreach_v1",
            },
        } as never).eq("id" as never, message.id as never);

        await supabase.from("outreach_events" as never).insert({
            workspace_id: message.workspace_id,
            campaign_id: message.campaign_id,
            account_id: message.account_id,
            contact_id: message.contact_id,
            message_id: message.id,
            event_type: "sent",
            provider: "resend",
            provider_message_id: result.id,
            occurred_at: now,
            payload: { dispatch_job_id: job.id, email_template: "isystem_outreach_v1" },
        } as never);

        await recordOutreachBusinessEvent({
            supabase,
            workspaceId: message.workspace_id,
            eventType: "contacted",
            contact: { email, name: contact.full_name },
            campaignId: message.campaign_id,
            contactId: message.contact_id,
            messageId: message.id,
            payload: { providerMessageId: result.id, dispatchJobId: job.id },
        });

        await supabase.from("outreach_dispatch_jobs" as never).update({
            status: "completed",
            completed_at: now,
            result_summary: { provider_message_id: result.id },
            error_message: null,
        } as never).eq("id" as never, job.id as never);

        return { success: true, jobId: job.id, workspaceId: job.workspace_id, message: "Outreach message sent." };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await supabase.from("outreach_dispatch_jobs" as never).update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: message,
        } as never).eq("id" as never, job.id as never);
        await supabase.from("outreach_messages" as never).update({
            status: "failed",
            last_event_at: new Date().toISOString(),
            metadata: { dispatch_failure: message },
        } as never).eq("id" as never, job.message_id as never);
        return { success: false, jobId: job.id, workspaceId: job.workspace_id, message };
    }
}

export async function processNextOutreachDispatchJob(workerId: string): Promise<OutreachWorkerResult> {
    const supabase = createAdminClient();
    const { data: job, error: claimError } = await (supabase.rpc as unknown as (
        name: string,
        args: Record<string, unknown>,
    ) => Promise<{ data: OutreachDispatchJobRow | null; error: RpcError }>)(
        "claim_next_outreach_dispatch_job",
        { p_worker_id: workerId },
    );

    if (claimError) return { success: false, message: claimError.message };
    if (!job?.id) return { success: false, message: "No queued jobs found." };

    return processClaimedOutreachDispatchJob(supabase, job);
}

export async function processOutreachDispatchJobById(jobId: string, workerId: string): Promise<OutreachWorkerResult> {
    const supabase = createAdminClient();
    const now = new Date().toISOString();
    const { data: jobData, error } = await supabase.from("outreach_dispatch_jobs" as never).update({
        status: "running",
        locked_at: now,
        worker_id: workerId,
        result_summary: { worker_id: workerId, claimed_at: now, claim_mode: "execute_action" },
    } as never)
        .eq("id" as never, jobId as never)
        .eq("status" as never, "queued" as never)
        .select("*" as never)
        .maybeSingle();
    if (error) return { success: false, jobId, message: error.message };
    const job = jobData as unknown as OutreachDispatchJobRow | null;
    if (!job?.id) return { success: false, jobId, message: "Dispatch job was not queued." };

    await supabase.from("outreach_messages" as never).update({
        status: "sending",
    } as never).eq("id" as never, job.message_id as never);

    return processClaimedOutreachDispatchJob(supabase, job);
}

export async function runOutreachDispatchCycle(limit = 10) {
    const workerId = `outreach-dispatch-route-${Date.now()}`;
    let processed = 0;
    let failed = 0;
    for (let index = 0; index < limit; index += 1) {
        const result = await processNextOutreachDispatchJob(workerId);
        if (!result.jobId && result.message === "No queued jobs found.") break;
        if (result.success) processed += 1;
        else failed += 1;
    }
    return { processed, failed };
}
