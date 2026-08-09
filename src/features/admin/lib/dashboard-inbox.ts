// Dashboard inbox — the single "what needs my attention" feed rendered above
// the quick-action tiles on /dashboard. Aggregates signals from multiple
// subsystems (opportunities, credits, content, market monitor) so the user
// does not have to discover each feature individually.
//
// Design principle: each item has a destination. An item with no next action
// should not be here.

import { createClient } from "@/shared/lib/supabase/server";
import { MIN_BALANCE_FLOOR_MILLICENTS } from "@/shared/lib/ai/pricing";
import { computeTaskDueState, type FrequencyKind } from "@/features/portal/lib/sla-overdue";
import { aggregateInternalLinkJobSummaries, formatInternalLinkAutomationOutcome } from "@/features/seo/lib/internal-link-job-summary";

export type InboxItemKind =
    | "low_credits"
    | "pending_opportunity"
    | "stale_draft"
    | "market_signal"
    | "pending_booking"
    | "sla_overdue"
    | "sla_client_flag"
    | "business_work_item"
    | "integration_failure"
    | "contact_submission"
    | "seo_automation_summary";

export type InboxItemSeverity = "critical" | "warning" | "info";

export interface InboxItem {
    id: string;
    kind: InboxItemKind;
    severity: InboxItemSeverity;
    title: string;
    summary: string;
    href: string;
    cta: string;
    createdAt?: string;
}

export interface DashboardInbox {
    items: InboxItem[];
    counts: {
        pendingOpportunities: number;
        staleDrafts: number;
        unreadMarketSignals: number;
        pendingBookings: number;
        overdueSlaTasks: number;
        unresolvedClientFlags: number;
        businessWorkItems: number;
        integrationFailures: number;
        contactSubmissions: number;
        seoAutomationSummaries: number;
    };
    aiBalanceMillicents: number;
}

// Drafts untouched for this many days are surfaced as "needs attention".
const STALE_DRAFT_DAYS = 7;
// Warn at 5× the minimum balance floor so the user has time to top up
// before they get blocked mid-workflow.
const LOW_BALANCE_WARN_MILLICENTS = MIN_BALANCE_FLOOR_MILLICENTS * 5;

const MAX_INBOX_PER_KIND = 3;
const SEO_AUTOMATION_SUMMARY_DAYS = 7;
const MAX_RECENT_SEO_JOB_SUMMARIES = 20;

interface DBBookingReservation {
    id: string;
    public_reference: string;
    customer_full_name: string;
    status: string;
}

interface DBBookingPaymentItem {
    id: string;
    status: string;
    provider: string;
    deadline_at: string | null;
    created_at: string;
    paypal_order_id: string | null;
    booking_reservations: DBBookingReservation | DBBookingReservation[] | null;
}

export async function loadDashboardInbox(workspaceId: string): Promise<DashboardInbox> {
    const supabase = await createClient();
    const staleBefore = new Date(Date.now() - STALE_DRAFT_DAYS * 86_400_000).toISOString();
    const seoCompletedAfter = new Date(Date.now() - SEO_AUTOMATION_SUMMARY_DAYS * 86_400_000).toISOString();

    const workspaceResult = await supabase
        .from("workspaces")
        .select("ai_balance_millicents,default_locale")
        .eq("id", workspaceId)
        .maybeSingle() as unknown as { data: { ai_balance_millicents: number; default_locale: string } | null; error: { message: string } | null };
    const aiBalance = workspaceResult.data?.ai_balance_millicents ?? 0;
    const workspaceLocale = workspaceResult.data?.default_locale ?? "en";

    const [
        opportunitiesResult,
        opportunitiesCountResult,
        draftsResult,
        draftsCountResult,
        seoJobsResult,
        marketResult,
        marketCountResult,
        bookingsResult,
        bookingsCountResult,
        slaTasksResult,
        slaNotesResult,
        businessWorkResult,
        businessWorkCountResult,
        integrationFailuresResult,
        integrationFailuresCountResult,
        contactsResult,
        contactsCountResult,
        stuckPaymentsResult,
    ] = await Promise.all([
        supabase
            .from("workspace_opportunities")
            .select("id,title,summary,severity,category,priority_score,created_at")
            .eq("workspace_id", workspaceId)
            .eq("status", "pending")
            .order("priority_score", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(MAX_INBOX_PER_KIND),
        supabase
            .from("workspace_opportunities")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .eq("status", "pending"),
        supabase
            .from("content_items")
            .select("id,title,updated_at")
            .eq("workspace_id", workspaceId)
            .eq("status", "draft")
            .lt("updated_at", staleBefore)
            .order("updated_at", { ascending: true })
            .limit(MAX_INBOX_PER_KIND),
        supabase
            .from("content_items")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .eq("status", "draft")
            .lt("updated_at", staleBefore),
        // Concise, non-spammy SEO automation summary. Scoped by workspace and
        // dashboard locale, and aggregated below into one inbox item.
        supabase
            .from("seo_internal_link_jobs")
            .select("id,locale,status,summary,completed_at,created_at")
            .eq("workspace_id", workspaceId)
            .eq("locale", workspaceLocale)
            .eq("status", "completed")
            .gt("completed_at", seoCompletedAfter)
            .order("completed_at", { ascending: false })
            .limit(MAX_RECENT_SEO_JOB_SUMMARIES)
            .then(
                (r) => r,
                () => ({ data: [] as Array<{ id: string; locale: string; status: string; summary: unknown; completed_at: string | null; created_at: string }>, error: null as null | { message: string } }),
            ),
        // Tier 3: market monitor surface. The table exists; when the UI ships
        // this query populates unread-signal items in the inbox automatically.
        supabase
            .from("workspace_market_monitor_results")
            .select("id,title,url,detected_at")
            .eq("workspace_id", workspaceId)
            .eq("read", false)
            .order("detected_at", { ascending: false })
            .limit(MAX_INBOX_PER_KIND)
            .then(
                (r) => r,
                // Silently degrade if the table isn't provisioned in this environment.
                () => ({ data: [] as Array<{ id: string; title: string | null; url: string; detected_at: string }>, error: null as null | { message: string } }),
            ),
        supabase
            .from("workspace_market_monitor_results")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .eq("read", false)
            .then(
                (r) => r,
                () => ({ count: null as number | null, error: null as null | { message: string } }),
            ),
        // Bookings awaiting operator review. Surface here so a manager who
        // never thinks to navigate to /dashboard/booking still sees that
        // reservations are waiting on them. Degrades silently if the booking
        // tables are not provisioned in this environment (older workspaces).
        supabase
            .from("booking_reservations")
            .select("id,public_reference,customer_full_name,customer_email,scheduled_start,created_at")
            .eq("workspace_id", workspaceId)
            .eq("status", "pending_review")
            .order("created_at", { ascending: false })
            .limit(MAX_INBOX_PER_KIND)
            .then(
                (r) => r,
                () => ({ data: [] as Array<{ id: string; public_reference: string; customer_full_name: string; customer_email: string; scheduled_start: string; created_at: string }>, error: null as null | { message: string } }),
            ),
        supabase
            .from("booking_reservations")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .eq("status", "pending_review")
            .then(
                (r) => r,
                () => ({ count: null as number | null, error: null as null | { message: string } }),
            ),
        // Overdue SLA tasks. Overdue is computed in code from
        // (last_completed_at + interval) so we have to fetch the rows and
        // tally. Scoped via workspace_client_projects.workspace_id to avoid
        // cross-tenant leaks. Degrades silently on older workspaces without
        // the SLA tables provisioned.
        supabase
            .from("workspace_sla_tasks")
            .select(`
                id,
                frequency_kind,
                frequency_value_days,
                grace_period_days,
                last_completed_at,
                status,
                workspace_client_projects!inner ( workspace_id )
            `)
            .eq("workspace_client_projects.workspace_id", workspaceId)
            .then(
                (r) => r,
                // Silently degrade if the table isn't provisioned in this environment.
                () => ({ data: [] as Array<{ frequency_kind: FrequencyKind; frequency_value_days: number | null; grace_period_days: number; last_completed_at: string | null; status: "compliant" | "completed" | "pending" | "issue" }>, error: null as null | { message: string } }),
            ),
        // Flag and resolution notes for this workspace. We compute
        // "unresolved" in code by grouping per schedule: a schedule is
        // unresolved iff it has at least one flag with no later resolution.
        supabase
            .from("workspace_sla_task_notes")
            .select("sla_task_id, is_flag, is_resolution, created_at, body")
            .eq("workspace_id", workspaceId)
            .or("is_flag.eq.true,is_resolution.eq.true")
            .order("created_at", { ascending: false })
            .limit(500)
            .then(
                (r) => r,
                // Silently degrade if the table isn't provisioned in this environment.
                () => ({ data: [] as Array<{ sla_task_id: string; is_flag: boolean; is_resolution: boolean; created_at: string; body: string }>, error: null as null | { message: string } }),
            ),
        supabase
            .from("workspace_work_items" as never)
            .select("id,title,description,kind,status,priority,due_at,created_at" as never)
            .eq("workspace_id" as never, workspaceId as never)
            .in("status" as never, ["open", "in_progress", "blocked"] as never)
            .order("priority" as never, { ascending: false })
            .order("created_at" as never, { ascending: false })
            .limit(MAX_INBOX_PER_KIND)
            .then(
                (r) => r,
                () => ({ data: [] as Array<{ id: string; title: string; description: string | null; kind: string; status: string; priority: string; due_at: string | null; created_at: string }>, error: null as null | { message: string } }),
            ),
        supabase
            .from("workspace_work_items" as never)
            .select("id" as never, { count: "exact", head: true })
            .eq("workspace_id" as never, workspaceId as never)
            .in("status" as never, ["open", "in_progress", "blocked"] as never)
            .then(
                (r) => r,
                () => ({ count: null as number | null, error: null as null | { message: string } }),
            ),
        supabase
            .from("workspace_integrations" as never)
            .select("id,provider,integration_key,status,last_error_message,last_failure_at,updated_at" as never)
            .eq("workspace_id" as never, workspaceId as never)
            .in("status" as never, ["failing", "degraded"] as never)
            .order("updated_at" as never, { ascending: false })
            .limit(MAX_INBOX_PER_KIND)
            .then(
                (r) => r,
                () => ({ data: [] as Array<{ id: string; provider: string; integration_key: string; status: "failing" | "degraded"; last_error_message: string | null; last_failure_at: string | null; updated_at: string }>, error: null as null | { message: string } }),
            ),
        supabase
            .from("workspace_integrations" as never)
            .select("id" as never, { count: "exact", head: true })
            .eq("workspace_id" as never, workspaceId as never)
            .in("status" as never, ["failing", "degraded"] as never)
            .then(
                (r) => r,
                () => ({ count: null as number | null, error: null as null | { message: string } }),
            ),
        // Contact form submissions. Surfaced based on recent creation dates (last 7 days).
        supabase
            .from("newsletter_contacts")
            .select("id,email,first_name,last_name,created_at,metadata")
            .eq("workspace_id", workspaceId)
            .or("source.eq.contact_form,metadata->>event.eq.contact_form_submit")
            .gt("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString())
            .order("created_at", { ascending: false })
            .limit(MAX_INBOX_PER_KIND)
            .then(
                (r) => r,
                () => ({ data: [] as Array<{ id: string; email: string; first_name: string | null; last_name: string | null; created_at: string; metadata: unknown }>, error: null as null | { message: string } }),
            ),
        supabase
            .from("newsletter_contacts")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .or("source.eq.contact_form,metadata->>event.eq.contact_form_submit")
            .gt("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString())
            .then(
                (r) => r,
                () => ({ count: null as number | null, error: null as null | { message: string } }),
            ),
        // Stuck booking payments query
        supabase
            .from("booking_payments")
            .select("id,status,provider,deadline_at,created_at,paypal_order_id,booking_reservations!booking_payments_workspace_reservation_fk!inner(id,public_reference,customer_full_name,status)")
            .eq("workspace_id", workspaceId)
            .in("status", ["requested", "failed", "verified"])
            .in("booking_reservations.status", ["pending_confirmation", "confirmed"])
            .limit(10)
            .then(
                (r) => r,
                () => ({ data: null as DBBookingPaymentItem[] | null, error: null })
            ),
    ]);

    const items: InboxItem[] = [];

    // Filter stuck payments
    const rawPayments = (stuckPaymentsResult?.data ?? []) as DBBookingPaymentItem[];

    const stuckPayments = rawPayments.filter((payment) => {
        const reservation = Array.isArray(payment.booking_reservations)
            ? payment.booking_reservations[0]
            : payment.booking_reservations;
        if (!reservation) return false;

        const isMismatch1 = payment.status === 'verified' && reservation.status === 'pending_confirmation';
        const isMismatch2 = payment.status !== 'verified' && reservation.status === 'confirmed';
        const isStuckPaypal = payment.provider === 'paypal_checkout' &&
                              payment.status === 'requested' &&
                              payment.paypal_order_id &&
                              new Date(payment.created_at).getTime() < Date.now() - 30 * 60 * 1000;
        const isDeadlinePassed = payment.status === 'requested' &&
                                 payment.deadline_at &&
                                 new Date(payment.deadline_at).getTime() < Date.now();
        const isFailed = payment.status === 'failed';

        return isMismatch1 || isMismatch2 || isStuckPaypal || isDeadlinePassed || isFailed;
    });

    for (const payment of stuckPayments) {
        const reservation = Array.isArray(payment.booking_reservations)
            ? payment.booking_reservations[0]
            : payment.booking_reservations;

        if (!reservation) continue;

        let reason = "Stuck payment hold requiring attention.";
        if (payment.status === 'verified' && reservation.status === 'pending_confirmation') {
            reason = "Payment is verified but booking is not confirmed.";
        } else if (payment.status !== 'verified' && reservation.status === 'confirmed') {
            reason = "Booking is confirmed but payment is not verified.";
        } else if (payment.status === 'failed') {
            reason = "Booking payment failed.";
        } else if (payment.status === 'requested' && payment.deadline_at && new Date(payment.deadline_at).getTime() < Date.now()) {
            reason = "Payment deadline passed without verification.";
        } else if (payment.provider === 'paypal_checkout' && payment.status === 'requested') {
            reason = "PayPal order created but not captured.";
        }

        items.push({
            id: `stuck-payment-${payment.id}`,
            kind: "integration_failure",
            severity: "warning",
            title: `Stuck Booking Hold · ${reservation.customer_full_name ?? "Customer"}`,
            summary: `${reservation.public_reference ?? "Booking"}: ${reason}`,
            href: "/dashboard/booking?tab=inbox",
            cta: "Manage booking",
            createdAt: payment.created_at,
        });
    }

    if (aiBalance < MIN_BALANCE_FLOOR_MILLICENTS) {
        items.push({
            id: "credits-blocked",
            kind: "low_credits",
            severity: "critical",
            title: "AI credits exhausted",
            summary: `Balance is below the minimum floor of €${(MIN_BALANCE_FLOOR_MILLICENTS / 10_000).toFixed(2)}. AI generation is blocked until top-up.`,
            href: "/dashboard/settings?section=ai-credits",
            cta: "Top up credits",
        });
    } else if (aiBalance < LOW_BALANCE_WARN_MILLICENTS) {
        items.push({
            id: "credits-low",
            kind: "low_credits",
            severity: "warning",
            title: "AI credits running low",
            summary: `Balance is €${(aiBalance / 10_000).toFixed(2)}. Top up before it drops below €${(MIN_BALANCE_FLOOR_MILLICENTS / 10_000).toFixed(2)} to keep AI workflows unblocked.`,
            href: "/dashboard/settings?section=ai-credits",
            cta: "Review balance",
        });
    }

    for (const opp of opportunitiesResult.data ?? []) {
        const record = opp as { id: string; title: string; summary: string | null; severity: "low" | "medium" | "high"; category: "seo" | "content" | "conversion"; created_at: string };
        items.push({
            id: `opp-${record.id}`,
            kind: "pending_opportunity",
            severity: record.severity === "high" ? "warning" : "info",
            title: record.title,
            summary: record.summary ?? `${record.category} opportunity awaiting review.`,
            href: `/dashboard/opportunities#${record.id}`,
            cta: "Review opportunity",
            createdAt: record.created_at,
        });
    }

    for (const draft of draftsResult.data ?? []) {
        const record = draft as { id: string; title: string; updated_at: string };
        const days = Math.floor((Date.now() - new Date(record.updated_at).getTime()) / 86_400_000);
        items.push({
            id: `draft-${record.id}`,
            kind: "stale_draft",
            severity: "info",
            title: record.title || "Untitled draft",
            summary: `Unpublished for ${days} day${days === 1 ? "" : "s"}. Publish it or archive it to keep the library tidy.`,
            href: `/dashboard/content/${record.id}`,
            cta: "Open draft",
            createdAt: record.updated_at,
        });
    }

    const seoAutomationAggregate = aggregateInternalLinkJobSummaries((seoJobsResult.data ?? []) as Array<{
        id: string;
        summary: unknown;
        completed_at: string | null;
    }>);
    if (seoAutomationAggregate.hasOutcomeCounts) {
        const outcome = formatInternalLinkAutomationOutcome(seoAutomationAggregate);
        items.push({
            id: `seo-automation-${seoAutomationAggregate.latestJobId ?? workspaceLocale}`,
            kind: "seo_automation_summary",
            severity: seoAutomationAggregate.failed > 0 ? "warning" : "info",
            title: `SEO internal-link automation completed · ${outcome}`,
            summary: `${seoAutomationAggregate.jobCount} recent worker job${seoAutomationAggregate.jobCount === 1 ? "" : "s"} processed for ${workspaceLocale.toUpperCase()}. Open the SEO Specialist tab for applied, ready-to-apply, and manual-review details.`,
            href: "/dashboard/seo?tab=specialist",
            cta: "Open SEO summary",
            createdAt: seoAutomationAggregate.latestCompletedAt ?? undefined,
        });
    }

    const now = new Date();
    const overdueSlaTasks = ((slaTasksResult.data ?? []) as Array<{
        frequency_kind: FrequencyKind;
        frequency_value_days: number | null;
        grace_period_days: number;
        last_completed_at: string | null;
        status: "compliant" | "completed" | "pending" | "issue";
    }>).filter((task) => computeTaskDueState(task, now).isOverdue).length;

    if (overdueSlaTasks > 0) {
        items.push({
            id: "sla-overdue-summary",
            kind: "sla_overdue",
            severity: overdueSlaTasks >= 5 ? "critical" : "warning",
            title: `${overdueSlaTasks} SLA task${overdueSlaTasks === 1 ? "" : "s"} overdue`,
            summary: "Recurring task deadlines have passed. Open SLA operations to mark complete or rebaseline.",
            href: "/dashboard/slas",
            cta: "Open SLA operations",
        });
    }

    // Group notes by schedule. A schedule is "unresolved" iff its most-recent
    // flag has no later resolution. Notes are returned in DESC order, so for
    // each schedule the first flag we see is the latest one; if any later
    // resolution exists it would have appeared first.
    const noteRows = (slaNotesResult.data ?? []) as Array<{
        sla_task_id: string;
        is_flag: boolean;
        is_resolution: boolean;
        created_at: string;
        body: string;
    }>;
    const unresolvedFlagSchedules = new Map<string, { body: string; created_at: string }>();
    const seenResolution = new Set<string>();
    for (const note of noteRows) {
        if (note.is_resolution) {
            seenResolution.add(note.sla_task_id);
            continue;
        }
        if (note.is_flag && !seenResolution.has(note.sla_task_id)) {
            if (!unresolvedFlagSchedules.has(note.sla_task_id)) {
                unresolvedFlagSchedules.set(note.sla_task_id, {
                    body: note.body,
                    created_at: note.created_at,
                });
            }
        }
    }
    const unresolvedClientFlags = unresolvedFlagSchedules.size;
    if (unresolvedClientFlags > 0) {
        items.push({
            id: "sla-client-flags-summary",
            kind: "sla_client_flag",
            severity: "warning",
            title: `${unresolvedClientFlags} client flag${unresolvedClientFlags === 1 ? "" : "s"} awaiting reply`,
            summary: "Portal clients flagged tasks that haven't been resolved. Open SLA operations to respond.",
            href: "/dashboard/slas",
            cta: "Review flags",
        });
    }

    for (const workItem of businessWorkResult.data ?? []) {
        const record = workItem as { id: string; title: string; description: string | null; kind: string; status: string; priority: string; due_at: string | null; created_at: string };
        items.push({
            id: `business-work-${record.id}`,
            kind: "business_work_item",
            severity: record.priority === "urgent" || record.status === "blocked" ? "warning" : "info",
            title: record.title,
            summary: record.description ?? `${record.kind.replace(/_/g, " ")} is ${record.status.replace(/_/g, " ")}.`,
            href: `/dashboard/work?item=${record.id}#${record.id}`,
            cta: "Open work queue",
            createdAt: record.due_at ?? record.created_at,
        });
    }

    for (const integration of integrationFailuresResult.data ?? []) {
        const record = integration as { id: string; provider: string; integration_key: string; status: "failing" | "degraded"; last_error_message: string | null; last_failure_at: string | null; updated_at: string };
        items.push({
            id: `integration-${record.id}`,
            kind: "integration_failure",
            severity: record.status === "failing" ? "critical" : "warning",
            title: `${record.provider} integration ${record.status}`,
            summary: record.last_error_message ?? `${record.integration_key} needs an operator health review.`,
            href: "/dashboard/integrations",
            cta: "Open integrations",
            createdAt: record.last_failure_at ?? record.updated_at,
        });
    }

    for (const booking of bookingsResult.data ?? []) {
        const record = booking as { id: string; public_reference: string; customer_full_name: string; customer_email: string; scheduled_start: string; created_at: string };
        items.push({
            id: `booking-${record.id}`,
            kind: "pending_booking",
            severity: "warning",
            title: `Booking awaiting review · ${record.customer_full_name}`,
            summary: `${record.public_reference} for ${new Date(record.scheduled_start).toLocaleString()} — needs operator approval.`,
            href: "/dashboard/booking?tab=inbox",
            cta: "Open booking inbox",
            createdAt: record.created_at,
        });
    }

    for (const signal of marketResult.data ?? []) {
        const record = signal as { id: string; title: string | null; url: string; detected_at: string };
        items.push({
            id: `market-${record.id}`,
            kind: "market_signal",
            severity: "info",
            title: record.title ?? record.url,
            summary: "New market signal detected by the competitor / authority monitor.",
            href: "/dashboard/market-monitor",
            cta: "View signal",
            createdAt: record.detected_at,
        });
    }

    for (const ct of contactsResult.data ?? []) {
        const record = ct as {
            id: string;
            email: string;
            first_name: string | null;
            last_name: string | null;
            created_at: string;
            metadata: {
                inquiry?: {
                    company?: string;
                    requestType?: string;
                    timeline?: string;
                    challenge?: string;
                };
            } | null | undefined;
        };
        const name = [record.first_name, record.last_name].filter(Boolean).join(" ") || record.email;
        const inquiry = record.metadata?.inquiry;
        const interest = inquiry?.requestType ? ` (${inquiry.requestType})` : "";
        items.push({
            id: `contact-${record.id}`,
            kind: "contact_submission",
            severity: "info",
            title: `New contact submission · ${name}${interest}`,
            summary: inquiry?.challenge
                ? (inquiry.challenge.length > 120 ? inquiry.challenge.slice(0, 117) + "..." : inquiry.challenge)
                : `Contact submission from ${record.email}`,
            href: "/dashboard/newsletter",
            cta: "View contact inbox",
            createdAt: record.created_at,
        });
    }

    return {
        items,
        counts: {
            pendingOpportunities: opportunitiesCountResult.count ?? opportunitiesResult.data?.length ?? 0,
            staleDrafts: draftsCountResult.count ?? draftsResult.data?.length ?? 0,
            unreadMarketSignals: marketCountResult.count ?? marketResult.data?.length ?? 0,
            pendingBookings: bookingsCountResult.count ?? bookingsResult.data?.length ?? 0,
            overdueSlaTasks,
            unresolvedClientFlags,
            businessWorkItems: businessWorkCountResult.count ?? businessWorkResult.data?.length ?? 0,
            integrationFailures: (integrationFailuresCountResult.count ?? integrationFailuresResult.data?.length ?? 0) + stuckPayments.length,
            contactSubmissions: contactsCountResult.count ?? contactsResult.data?.length ?? 0,
            seoAutomationSummaries: seoAutomationAggregate.hasOutcomeCounts ? 1 : 0,
        },
        aiBalanceMillicents: aiBalance,
    };
}
