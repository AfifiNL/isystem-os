import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import {
    getTransactionalWebhookSourceStatuses,
    isClaimableDelivery,
    normalizeEmailLocale,
    type TransactionalEmailWebhookStatus,
} from "./email-lifecycle";
import { sendEmail } from "@/shared/lib/resend/send-email";

type TransactionalEmailStatus =
    | "pending"
    | "running"
    | "sent"
    | "delivered"
    | "failed"
    | "skipped"
    | "bounced"
    | "complained";

interface TransactionalEmailJob {
    id: string;
    workspace_id: string;
    aggregate_type: string;
    aggregate_id: string | null;
    event_type: string;
    recipient_role: "customer" | "manager" | "user";
    recipient_email: string;
    locale: string;
    from_email: string;
    reply_to_email: string | null;
    subject: string;
    html_body: string;
    idempotency_key: string;
    status: TransactionalEmailStatus;
    attempts: number;
    max_attempts: number;
    payload_json: Record<string, unknown> | null;
    next_attempt_at: string;
    updated_at: string;
}

export interface TransactionalEmailInput {
    workspaceId: string;
    aggregateType: string;
    aggregateId?: string | null;
    eventType: string;
    recipientRole: "customer" | "manager" | "user";
    recipientEmail: string;
    locale?: string | null;
    fromEmail: string;
    replyToEmail?: string | null;
    subject: string;
    html: string;
    idempotencyKey: string;
    payload?: Record<string, unknown>;
}

function getServiceClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !serviceRoleKey) {
        throw new Error("Missing Supabase service-role configuration.");
    }

    return createSupabaseClient(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

function retryAt(attempts: number) {
    const delayMinutes = Math.min(12 * 60, 2 ** Math.max(0, attempts - 1) * 5);
    return new Date(Date.now() + delayMinutes * 60_000).toISOString();
}

async function dispatchJob(
    supabase: ReturnType<typeof getServiceClient>,
    job: TransactionalEmailJob,
) {
    if (
        !isClaimableDelivery({
            status: job.status,
            attempts: job.attempts,
            maxAttempts: job.max_attempts,
            updatedAt: job.updated_at,
        })
    ) {
        return { claimed: false, sent: false };
    }

    const attempts = job.attempts + 1;
    const { data: claimed, error: claimError } = await supabase
        .from("transactional_email_jobs")
        .update({ status: "running", attempts, updated_at: new Date().toISOString() })
        .eq("id", job.id)
        .eq("status", job.status)
        .eq("attempts", job.attempts)
        .select("id")
        .maybeSingle();

    if (claimError) {
        throw new Error(claimError.message);
    }
    if (!claimed) {
        return { claimed: false, sent: false };
    }

    if (!process.env.RESEND_API_KEY?.trim()) {
        const { error } = await supabase
            .from("transactional_email_jobs")
            .update({
                status: "skipped",
                last_error: "RESEND_API_KEY missing",
                next_attempt_at: retryAt(attempts),
                updated_at: new Date().toISOString(),
            })
            .eq("id", job.id)
            .eq("status", "running")
            .eq("attempts", attempts);
        if (error) {
            throw new Error(error.message);
        }
        return { claimed: true, sent: false };
    }

    try {
        const result = await sendEmail({
            from: job.from_email,
            to: job.recipient_email,
            subject: job.subject,
            html: job.html_body,
            replyTo: job.reply_to_email || undefined,
            idempotencyKey: `transactional-email:${job.id}`,
        });
        const { error } = await supabase
            .from("transactional_email_jobs")
            .update({
                status: "sent",
                provider_message_id: result.id,
                sent_at: new Date().toISOString(),
                last_error: null,
                updated_at: new Date().toISOString(),
            })
            .eq("id", job.id)
            .eq("status", "running")
            .eq("attempts", attempts);
        if (error) {
            throw new Error(error.message);
        }
        return { claimed: true, sent: true };
    } catch (error) {
        const { error: persistError } = await supabase
            .from("transactional_email_jobs")
            .update({
                status: "failed",
                last_error: error instanceof Error ? error.message : "Transactional email send failed.",
                next_attempt_at: retryAt(attempts),
                updated_at: new Date().toISOString(),
            })
            .eq("id", job.id)
            .eq("status", "running")
            .eq("attempts", attempts);
        if (persistError) {
            throw new Error(persistError.message);
        }
        return { claimed: true, sent: false };
    }
}

export async function enqueueTransactionalEmail(input: TransactionalEmailInput) {
    const supabase = getServiceClient();
    const normalizedRecipient = input.recipientEmail.trim().toLowerCase();

    const { data: existing, error: existingError } = await supabase
        .from("transactional_email_jobs")
        .select("*")
        .eq("workspace_id", input.workspaceId)
        .eq("idempotency_key", input.idempotencyKey)
        .maybeSingle();

    if (existingError) {
        throw new Error(existingError.message);
    }

    let job = existing as TransactionalEmailJob | null;
    if (!job) {
        const { data, error } = await supabase
            .from("transactional_email_jobs")
            .insert({
                workspace_id: input.workspaceId,
                aggregate_type: input.aggregateType,
                aggregate_id: input.aggregateId ?? null,
                event_type: input.eventType,
                recipient_role: input.recipientRole,
                recipient_email: normalizedRecipient,
                locale: normalizeEmailLocale(input.locale),
                from_email: input.fromEmail,
                reply_to_email: input.replyToEmail ?? null,
                subject: input.subject,
                html_body: input.html,
                idempotency_key: input.idempotencyKey,
                payload_json: input.payload ?? {},
            })
            .select("*")
            .single();

        if (error?.code === "23505") {
            const { data: racedJob, error: racedJobError } = await supabase
                .from("transactional_email_jobs")
                .select("*")
                .eq("workspace_id", input.workspaceId)
                .eq("idempotency_key", input.idempotencyKey)
                .single();
            if (racedJobError || !racedJob) {
                throw new Error(racedJobError?.message ?? "Failed to resolve concurrent transactional email enqueue.");
            }
            job = racedJob as TransactionalEmailJob;
        } else if (error || !data) {
            throw new Error(error?.message ?? "Failed to enqueue transactional email.");
        } else {
            job = data as TransactionalEmailJob;
        }
    }

    await dispatchJob(supabase, job);
    return { id: job.id };
}

export type TargetedTransactionalEmailDispatchOutcome = {
    requested: number;
    delivered: number;
    accepted: number;
    failed: number;
};

export async function dispatchTransactionalEmailJobsByIdempotencyKeys(
    workspaceId: string,
    requestedKeys: readonly string[],
): Promise<TargetedTransactionalEmailDispatchOutcome> {
    const idempotencyKeys = Array.from(new Set(requestedKeys));
    if (idempotencyKeys.length === 0) {
        return { requested: 0, delivered: 0, accepted: 0, failed: 0 };
    }

    const supabase = getServiceClient();
    const { data, error } = await supabase
        .from("transactional_email_jobs")
        .select("*")
        .eq("workspace_id", workspaceId)
        .in("idempotency_key", idempotencyKeys);
    if (error) {
        throw new Error(error.message);
    }

    const jobs = (data ?? []) as TransactionalEmailJob[];
    if (jobs.length !== idempotencyKeys.length) {
        throw new Error("Atomic contact email jobs could not all be loaded after commit.");
    }

    const results = await Promise.allSettled(jobs.map(async (job): Promise<"delivered" | "accepted" | "failed"> => {
        if (job.status === "sent" || job.status === "delivered") {
            return "delivered";
        }
        if (job.status === "bounced" || job.status === "complained") {
            return "failed";
        }

        const result = await dispatchJob(supabase, job);
        if (result.sent) {
            return "delivered";
        }
        return job.attempts + (result.claimed ? 1 : 0) >= job.max_attempts
            ? "failed"
            : "accepted";
    }));
    const dispatchError = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    if (dispatchError) {
        throw dispatchError.reason instanceof Error
            ? dispatchError.reason
            : new Error("Targeted transactional email dispatch failed.");
    }

    const dispositions = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    const delivered = dispositions.filter((result) => result === "delivered").length;
    const accepted = dispositions.filter((result) => result === "accepted").length;
    const failed = dispositions.filter((result) => result === "failed").length;

    return { requested: idempotencyKeys.length, delivered, accepted, failed };
}

export async function runTransactionalEmailDispatchCycle(limit = 50) {
    const supabase = getServiceClient();
    const now = new Date();
    const nowIso = now.toISOString();
    const staleBefore = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
    const { data: due, error: dueError } = await supabase
        .from("transactional_email_jobs")
        .select("*")
        .in("status", ["pending", "failed", "skipped"])
        .lte("next_attempt_at", nowIso)
        .order("next_attempt_at", { ascending: true })
        .limit(limit);
    const { data: abandoned, error: abandonedError } = await supabase
        .from("transactional_email_jobs")
        .select("*")
        .eq("status", "running")
        .lte("updated_at", staleBefore)
        .order("updated_at", { ascending: true })
        .limit(limit);

    if (dueError || abandonedError) {
        throw new Error(dueError?.message ?? abandonedError?.message ?? "Failed to load email jobs.");
    }

    const jobs = [
        ...((abandoned ?? []) as TransactionalEmailJob[]),
        ...((due ?? []) as TransactionalEmailJob[]),
    ].slice(0, limit);

    let processed = 0;
    let sent = 0;
    for (const row of jobs) {
        const result = await dispatchJob(supabase, row);
        if (result.claimed) {
            processed += 1;
        }
        if (result.sent) {
            sent += 1;
        }
    }

    return { processed, sent };
}

export async function processTransactionalEmailWebhook(payload: Record<string, unknown>) {
    const data = payload.data && typeof payload.data === "object"
        ? payload.data as Record<string, unknown>
        : {};
    const providerMessageId = typeof data.email_id === "string"
        ? data.email_id
        : typeof data.emailId === "string"
            ? data.emailId
            : typeof data.id === "string"
                ? data.id
                : null;

    if (!providerMessageId || typeof payload.type !== "string") {
        return { error: null };
    }

    const statusByEvent: Record<string, TransactionalEmailWebhookStatus> = {
        "email.sent": "sent",
        "email.delivered": "delivered",
        "email.bounced": "bounced",
        "email.complained": "complained",
        "email.failed": "failed",
    };
    const status = statusByEvent[payload.type];
    if (!status) {
        return { error: null };
    }

    const supabase = getServiceClient();
    const patch: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
    };
    if (status === "failed") {
        patch.next_attempt_at = retryAt(1);
        patch.last_error = typeof data.reason === "string" ? data.reason : payload.type;
    } else if (status === "bounced" || status === "complained") {
        patch.last_error = typeof data.reason === "string" ? data.reason : payload.type;
    }

    const { error } = await supabase
        .from("transactional_email_jobs")
        .update(patch)
        .eq("provider_message_id", providerMessageId)
        .in("status", getTransactionalWebhookSourceStatuses(status));

    return { error: error?.message ?? null };
}
