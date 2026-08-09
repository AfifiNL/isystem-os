"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireAdminDashboardState } from "@/features/admin/lib/route-guard";
import { createClient } from "@/shared/lib/supabase/server";
import { sendEmail } from "@/shared/lib/resend/send-email";
import { recordSlaFlagBusinessEvent } from "@/features/business-spine/service";

export interface ScheduleNote {
    id: string;
    body: string;
    author_kind: "portal_client" | "workspace_manager";
    author_email: string | null;
    is_flag: boolean;
    is_resolution: boolean;
    created_at: string;
}

const MAX_NOTE_LENGTH = 4000;

function bookingFromEmail(): string {
    const fromEmail = process.env.BOOKING_FROM_EMAIL?.trim()
        || process.env.NEWSLETTER_FROM_EMAIL?.trim();
    if (!fromEmail) {
        throw new Error("SLA alert email sender is not configured.");
    }
    return fromEmail;
}

function bookingReplyTo(): string | undefined {
    return (
        process.env.BOOKING_REPLY_TO_EMAIL?.trim() ||
        process.env.NEWSLETTER_REPLY_TO_EMAIL?.trim() ||
        undefined
    );
}

function configuredSiteUrl(): string {
    const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (!configured) {
        throw new Error("NEXT_PUBLIC_SITE_URL is not configured.");
    }
    const siteUrl = new URL(configured);
    if (siteUrl.protocol !== "http:" && siteUrl.protocol !== "https:") {
        throw new Error("NEXT_PUBLIC_SITE_URL must use HTTP or HTTPS.");
    }
    return siteUrl.toString().replace(/\/$/, "");
}

function createServiceRoleClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Missing Supabase service-role configuration.");
    }
    return createSupabaseClient(supabaseUrl, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/** Resolve the authenticated portal client's row for the given schedule, or
 * null if the schedule isn't theirs. RLS would already block writes, but this
 * makes the action return a friendly error instead of a 500. */
async function resolvePortalClientForSchedule(
    scheduleId: string,
): Promise<{
    workspaceId: string;
    profileId: string;
    portalClientId: string;
    customerEmail: string;
    locationName: string;
    taskName: string;
} | null> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from("workspace_sla_tasks")
        .select(`
            task_name,
            workspace_client_projects!inner (
                name,
                client_portal_users!inner ( id, workspace_id, profile_id )
            )
        `)
        .eq("id", scheduleId)
        .maybeSingle();

    if (error || !data) return null;

    const row = data as unknown as {
        task_name: string;
        workspace_client_projects: {
            name: string;
            client_portal_users: { id: string; workspace_id: string; profile_id: string | null }[];
        };
    };

    const cpu = row.workspace_client_projects.client_portal_users?.[0];
    if (!cpu || cpu.profile_id !== user.id) return null;

    return {
        workspaceId: cpu.workspace_id,
        profileId: user.id,
        portalClientId: cpu.id,
        customerEmail: user.email ?? "",
        locationName: row.workspace_client_projects.name,
        taskName: row.task_name,
    };
}

async function loadWorkspaceManagerEmails(workspaceId: string): Promise<string[]> {
    const supabaseAdmin = createServiceRoleClient();
    const { data, error } = await supabaseAdmin
        .from("workspace_memberships")
        .select("profiles:profile_id ( email )")
        .eq("workspace_id", workspaceId)
        .in("role", ["admin", "manager"]);

    if (error || !data) return [];

    const emails = (data as unknown as Array<{ profiles: { email: string | null } | null }>)
        .map((row) => row.profiles?.email)
        .filter((email): email is string => Boolean(email && email.includes("@")));
    return Array.from(new Set(emails.map((e) => e.toLowerCase())));
}

async function loadWorkspaceName(workspaceId: string): Promise<string> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("workspaces")
        .select("name")
        .eq("id", workspaceId)
        .maybeSingle();
    return data?.name ?? "Your workspace";
}

/**
 * Best-effort manager alert when a portal client flags an SLA task. Mirrors
 * the booking-email pattern: never throws, swallows Resend failures so the
 * client-facing flag flow stays clean.
 */
async function dispatchFlagAlertEmail(params: {
    workspaceId: string;
    customerEmail: string;
    locationName: string;
    taskName: string;
    body: string;
}): Promise<void> {
    try {
        if (!process.env.RESEND_API_KEY?.trim()) return;
        const recipients = await loadWorkspaceManagerEmails(params.workspaceId);
        if (recipients.length === 0) return;

        const workspaceName = await loadWorkspaceName(params.workspaceId);
        const siteUrl = configuredSiteUrl();
        const dashboardUrl = `${siteUrl}/dashboard/slas`;

        const subject = `Client flagged an SLA issue · ${params.locationName} · ${params.taskName}`;
        const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f7f9;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="560" style="max-width:560px;background:#ffffff;border-radius:14px;border:1px solid #e2e8f0;">
    <tr><td style="padding:28px;">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#64748b;">${escapeHtml(workspaceName)} · partner portal</p>
      <h1 style="margin:0 0 14px;font-size:20px;line-height:1.3;color:#0f172a;">Client flagged an SLA issue</h1>
      <p style="margin:0 0 6px;font-size:14px;color:#334155;"><strong>Location:</strong> ${escapeHtml(params.locationName)}</p>
      <p style="margin:0 0 6px;font-size:14px;color:#334155;"><strong>Task:</strong> ${escapeHtml(params.taskName)}</p>
      <p style="margin:0 0 6px;font-size:14px;color:#334155;"><strong>From:</strong> ${escapeHtml(params.customerEmail || "portal client")}</p>
      <div style="margin:14px 0;padding:14px;border-left:3px solid #f59e0b;background:#fef3c7;color:#7c2d12;font-size:14px;line-height:1.6;">${escapeHtml(params.body).replace(/\n/g, "<br>")}</div>
      <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;padding:10px 18px;border-radius:10px;background:#0f172a;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;">Open SLA operations</a>
    </td></tr>
  </table>
 </body></html>`;

        await sendEmail({
            from: bookingFromEmail(),
            to: recipients,
            subject,
            html,
            replyTo: bookingReplyTo(),
            idempotencyKey: `sla-flag:${params.workspaceId}:${params.taskName}:${Date.now()}`,
        });
    } catch (error) {
        console.error("dispatchFlagAlertEmail failed (non-fatal)", error);
    }
}

export async function addPortalClientFlag(
    scheduleId: string,
    body: string,
    flagIssue: boolean,
): Promise<{ data: ScheduleNote | null; error: string | null }> {
    const trimmed = body.trim();
    if (!trimmed) return { data: null, error: "A note is required." };
    if (trimmed.length > MAX_NOTE_LENGTH) {
        return { data: null, error: `Notes are capped at ${MAX_NOTE_LENGTH} characters.` };
    }

    const ctx = await resolvePortalClientForSchedule(scheduleId);
    if (!ctx) return { data: null, error: "You don't have access to this task." };

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("workspace_sla_task_notes")
        .insert({
            sla_task_id: scheduleId,
            workspace_id: ctx.workspaceId,
            author_profile_id: ctx.profileId,
            author_kind: "portal_client",
            body: trimmed,
            is_flag: flagIssue,
            is_resolution: false,
        })
        .select("id, body, author_kind, is_flag, is_resolution, created_at")
        .single();

    if (error || !data) {
        console.error("addPortalClientFlag insert error", error);
        return { data: null, error: "Could not save your note." };
    }

    // Flipping status is a side effect of flagging — keeps the existing
    // status-driven UI honest (a flagged task should not still read "On track").
    if (flagIssue) {
        const { error: statusError } = await supabase
            .from("workspace_sla_tasks")
            .update({ status: "issue" })
            .eq("id", scheduleId);
        if (statusError) {
            console.error("addPortalClientFlag status update error", statusError);
        }
        await dispatchFlagAlertEmail({
            workspaceId: ctx.workspaceId,
            customerEmail: ctx.customerEmail,
            locationName: ctx.locationName,
            taskName: ctx.taskName,
            body: trimmed,
        });
        try {
            await recordSlaFlagBusinessEvent({
                supabase: createServiceRoleClient(),
                workspaceId: ctx.workspaceId,
                portalClientId: ctx.portalClientId,
                scheduleId,
                taskName: ctx.taskName,
                locationName: ctx.locationName,
                customerEmail: ctx.customerEmail,
                body: trimmed,
            });
        } catch (businessSpineError) {
            console.warn("[sla] business spine event failed", businessSpineError instanceof Error ? businessSpineError.message : businessSpineError);
        }
    }

    revalidatePath("/portal/dashboard");
    revalidatePath("/dashboard/slas");

    return {
        data: {
            ...data,
            author_kind: data.author_kind as ScheduleNote["author_kind"],
            author_email: ctx.customerEmail || null,
        } as ScheduleNote,
        error: null,
    };
}

export async function addManagerNote(
    scheduleId: string,
    body: string,
    options: { resolves?: boolean } = {},
): Promise<{ data: ScheduleNote | null; error: string | null }> {
    const trimmed = body.trim();
    if (!trimmed) return { data: null, error: "A note is required." };
    if (trimmed.length > MAX_NOTE_LENGTH) {
        return { data: null, error: `Notes are capped at ${MAX_NOTE_LENGTH} characters.` };
    }

    const state = await requireAdminDashboardState();
    if (state.role !== "admin" && state.role !== "manager") {
        return { data: null, error: "Unauthorized" };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const authorProfileId = user?.id ?? null;
    const authorEmail = user?.email ?? null;

    const { data, error } = await supabase
        .from("workspace_sla_task_notes")
        .insert({
            sla_task_id: scheduleId,
            workspace_id: state.workspace.id,
            author_profile_id: authorProfileId,
            author_kind: "workspace_manager",
            body: trimmed,
            is_flag: false,
            is_resolution: options.resolves === true,
        })
        .select("id, body, author_kind, is_flag, is_resolution, created_at")
        .single();

    if (error || !data) {
        console.error("addManagerNote insert error", error);
        return { data: null, error: "Could not save your note." };
    }

    revalidatePath("/dashboard/slas");
    revalidatePath("/portal/dashboard");

    return {
        data: {
            ...data,
            author_kind: data.author_kind as ScheduleNote["author_kind"],
            author_email: authorEmail,
        } as ScheduleNote,
        error: null,
    };
}

export async function listScheduleNotes(scheduleId: string): Promise<{
    data: ScheduleNote[];
    error: string | null;
}> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("workspace_sla_task_notes")
        .select("id, body, author_kind, author_profile_id, is_flag, is_resolution, created_at")
        .eq("sla_task_id", scheduleId)
        .order("created_at", { ascending: false })
        .limit(25);

    if (error) {
        return { data: [], error: "Failed to load notes." };
    }

    const rows = data ?? [];
    const profileIds = rows
        .map((r) => r.author_profile_id)
        .filter((id): id is string => Boolean(id));

    let emailMap = new Map<string, string>();
    if (profileIds.length > 0) {
        const supabaseAdmin = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
        );
        const { data: profiles } = await supabaseAdmin
            .from("profiles")
            .select("id, email")
            .in("id", profileIds);
        emailMap = new Map((profiles ?? []).map((p) => [p.id, p.email ?? ""]));
    }

    return {
        data: rows.map((row) => ({
            id: row.id,
            body: row.body,
            author_kind: row.author_kind as ScheduleNote["author_kind"],
            author_email: row.author_profile_id ? emailMap.get(row.author_profile_id) ?? null : null,
            is_flag: row.is_flag,
            is_resolution: row.is_resolution,
            created_at: row.created_at,
        })),
        error: null,
    };
}
