import { computeTaskDueState } from "@/features/portal/lib/sla-overdue";
import { createClient } from "@/shared/lib/supabase/server";
import { createRecentStructuredHubDateWindow } from "./structured-query-date-windows";
import { buildStructuredResult, formatCountAnswer, formatListAnswer, formatWindowedCountAnswer } from "./structured-answer-formatters";
import { findGlossaryEntry } from "./structured-query-glossary";
import type {
    StructuredHubQueryCard,
    StructuredHubQueryKey,
    StructuredHubQueryResult,
    StructuredHubQueryRunnerParams,
    StructuredHubSlaTaskRow,
} from "./structured-query-types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const DEFAULT_LIST_LIMIT = 25;
const MAX_LIST_LIMIT = 100;
const FLAG_NOTE_SCAN_LIMIT = 500;

function safeLimit(limit: number | undefined, defaultLimit = DEFAULT_LIST_LIMIT, maxLimit = MAX_LIST_LIMIT) {
    return Math.min(Math.max(limit ?? defaultLimit, 1), maxLimit);
}

function glossary(key: StructuredHubQueryKey) {
    const entry = findGlossaryEntry(key);
    return {
        label: entry?.label ?? key,
        businessDefinition: entry?.businessDefinition ?? "Allowlisted structured query scoped to the active workspace.",
    };
}

function workspaceFilter(workspaceId: string) {
    return { workspace_id: workspaceId };
}

async function exactCount(builder: { then: PromiseLike<{ count: number | null; error: { message: string } | null }>["then"] }) {
    const { count, error } = await builder;
    if (error) throw new Error(error.message);
    return count ?? 0;
}

async function runClientCount(params: StructuredHubQueryRunnerParams) {
    const supabase = await createClient();
    const { label, businessDefinition } = glossary(params.key);
    const count = await exactCount(
        supabase.from("client_portal_users").select("id", { count: "exact", head: true }).eq("workspace_id", params.workspaceId),
    );

    return buildStructuredResult({
        key: params.key,
        label,
        answer: formatCountAnswer(count, "portal client"),
        value: count,
        scope: params.scope,
        tables: ["client_portal_users"],
        filters: workspaceFilter(params.workspaceId),
        businessDefinition,
    });
}

async function runClientList(params: StructuredHubQueryRunnerParams) {
    const supabase = await createClient();
    const { label, businessDefinition } = glossary(params.key);
    const limit = safeLimit(params.limit);
    const { data, error } = await supabase
        .from("client_portal_users")
        .select("id,company_name,created_at")
        .eq("workspace_id", params.workspaceId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) throw new Error(error.message);

    const rows = (data ?? []).map((row: { id: string; company_name: string | null; created_at: string }) => ({
        id: row.id,
        company_name: row.company_name ?? "Unnamed client",
        created_at: row.created_at,
        client_id: row.id,
    }));

    return buildStructuredResult({
        key: params.key,
        label,
        answer: formatListAnswer(rows.length, "portal client", rows.map((row) => String(row.company_name))),
        value: rows.length,
        rows,
        scope: params.scope,
        tables: ["client_portal_users"],
        filters: { ...workspaceFilter(params.workspaceId), limit },
        businessDefinition,
    });
}

async function runProjectCount(params: StructuredHubQueryRunnerParams) {
    const supabase = await createClient();
    const { label, businessDefinition } = glossary(params.key);
    const count = await exactCount(
        supabase.from("workspace_client_projects").select("id", { count: "exact", head: true }).eq("workspace_id", params.workspaceId),
    );

    return buildStructuredResult({
        key: params.key,
        label,
        answer: formatCountAnswer(count, "client project/location"),
        value: count,
        scope: params.scope,
        tables: ["workspace_client_projects"],
        filters: workspaceFilter(params.workspaceId),
        businessDefinition,
    });
}

async function runCustomerLifecycleCounts(params: StructuredHubQueryRunnerParams) {
    const supabase = await createClient();
    const { label, businessDefinition } = glossary(params.key);
    const { data, error } = await supabase
        .from("workspace_customers" as never)
        .select("id,display_name,lifecycle_status,updated_at" as never)
        .eq("workspace_id" as never, params.workspaceId as never)
        .is("deleted_at" as never, null)
        .limit(1000) as unknown as { data: Array<{ id: string; display_name: string; lifecycle_status: string; updated_at: string }> | null; error: { message: string } | null };

    if (error) throw new Error(error.message);

    const counts = new Map<string, number>();
    for (const row of data ?? []) counts.set(row.lifecycle_status, (counts.get(row.lifecycle_status) ?? 0) + 1);
    const rows = Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([lifecycle_status, count]) => ({ lifecycle_status, count }));
    const activeCount = counts.get("active") ?? 0;

    return buildStructuredResult({
        key: params.key,
        label,
        answer: `There ${activeCount === 1 ? "is" : "are"} ${activeCount} active ${activeCount === 1 ? "customer" : "customers"}. Lifecycle breakdown: ${rows.map((row) => `${row.lifecycle_status}: ${row.count}`).join(", ") || "none"}.`,
        value: activeCount,
        rows,
        scope: params.scope,
        tables: ["workspace_customers"],
        filters: { ...workspaceFilter(params.workspaceId), deleted_at: null, scan_limit: 1000 },
        businessDefinition,
        limitations: ["Lifecycle grouping scans at most the first 1,000 non-deleted customers in this bounded MVP."],
    });
}

async function runSlaTaskCount(params: StructuredHubQueryRunnerParams) {
    const supabase = await createClient();
    const { label, businessDefinition } = glossary(params.key);
    const count = await exactCount(
        supabase
            .from("workspace_sla_tasks")
            .select("id,workspace_client_projects!inner(workspace_id)", { count: "exact", head: true })
            .eq("workspace_client_projects.workspace_id", params.workspaceId),
    );

    return buildStructuredResult({
        key: params.key,
        label,
        answer: formatCountAnswer(count, "SLA task"),
        value: count,
        scope: params.scope,
        tables: ["workspace_sla_tasks", "workspace_client_projects"],
        filters: { "workspace_client_projects.workspace_id": params.workspaceId },
        businessDefinition,
    });
}

async function fetchSlaTaskRows(supabase: SupabaseClient, workspaceId: string) {
    const { data, error } = await supabase
        .from("workspace_sla_tasks")
        .select(`
            id,
            task_name,
            frequency_kind,
            frequency_value_days,
            grace_period_days,
            last_completed_at,
            status,
            workspace_client_projects!inner ( id, name, client_id, workspace_id )
        `)
        .eq("workspace_client_projects.workspace_id", workspaceId);

    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as StructuredHubSlaTaskRow[];
}

function firstProject(project: StructuredHubSlaTaskRow["workspace_client_projects"]) {
    if (Array.isArray(project)) return project[0] ?? null;
    return project ?? null;
}

async function runOverdueSlaTaskCount(params: StructuredHubQueryRunnerParams) {
    const supabase = await createClient();
    const { label, businessDefinition } = glossary(params.key);
    const tasks = await fetchSlaTaskRows(supabase, params.workspaceId);
    const now = new Date();
    const overdueRows = tasks
        .map((task) => ({ task, dueState: computeTaskDueState(task, now) }))
        .filter(({ dueState }) => dueState.isOverdue)
        .map(({ task, dueState }) => {
            const project = firstProject(task.workspace_client_projects);
            return {
                id: task.id,
                task_name: task.task_name ?? "Untitled task",
                project_id: project?.id ?? null,
                project_name: project?.name ?? null,
                client_id: project?.client_id ?? null,
                due_at: dueState.dueAt,
                days_overdue: dueState.daysOverdue,
            };
        });

    return buildStructuredResult({
        key: params.key,
        label,
        answer: formatCountAnswer(overdueRows.length, "overdue SLA task"),
        value: overdueRows.length,
        rows: overdueRows.slice(0, DEFAULT_LIST_LIMIT),
        scope: params.scope,
        tables: ["workspace_sla_tasks", "workspace_client_projects"],
        filters: { "workspace_client_projects.workspace_id": params.workspaceId, computed_with: "computeTaskDueState" },
        businessDefinition,
    });
}

async function runUnresolvedSlaFlagsCount(params: StructuredHubQueryRunnerParams) {
    const supabase = await createClient();
    const { label, businessDefinition } = glossary(params.key);
    const { data, error } = await supabase
        .from("workspace_sla_task_notes")
        .select("sla_task_id,is_flag,is_resolution,created_at,body")
        .eq("workspace_id", params.workspaceId)
        .or("is_flag.eq.true,is_resolution.eq.true")
        .order("created_at", { ascending: false })
        .limit(FLAG_NOTE_SCAN_LIMIT);

    if (error) throw new Error(error.message);

    const unresolvedFlagSchedules = new Map<string, { body: string; created_at: string }>();
    const seenResolution = new Set<string>();
    for (const note of (data ?? []) as Array<{ sla_task_id: string; is_flag: boolean; is_resolution: boolean; created_at: string; body: string }>) {
        if (note.is_resolution) {
            seenResolution.add(note.sla_task_id);
            continue;
        }
        if (note.is_flag && !seenResolution.has(note.sla_task_id) && !unresolvedFlagSchedules.has(note.sla_task_id)) {
            unresolvedFlagSchedules.set(note.sla_task_id, { body: note.body, created_at: note.created_at });
        }
    }

    const rows = Array.from(unresolvedFlagSchedules.entries()).slice(0, DEFAULT_LIST_LIMIT).map(([slaTaskId, note]) => ({
        sla_task_id: slaTaskId,
        flag_created_at: note.created_at,
        flag_preview: note.body.slice(0, 160),
    }));

    return buildStructuredResult({
        key: params.key,
        label,
        answer: formatCountAnswer(unresolvedFlagSchedules.size, "unresolved client flag"),
        value: unresolvedFlagSchedules.size,
        rows,
        scope: params.scope,
        tables: ["workspace_sla_task_notes"],
        filters: { ...workspaceFilter(params.workspaceId), is_flag: true, is_resolution: true, scan_limit: FLAG_NOTE_SCAN_LIMIT },
        businessDefinition,
        limitations: [`Flag/resolution note scan is capped at the latest ${FLAG_NOTE_SCAN_LIMIT} notes.`],
    });
}

async function runWorkItemList(params: StructuredHubQueryRunnerParams, statuses: string[], noun: string) {
    const supabase = await createClient();
    const { label, businessDefinition } = glossary(params.key);
    const limit = safeLimit(params.limit);
    const { data, error } = await supabase
        .from("workspace_work_items" as never)
        .select("id,title,status,priority,due_at,customer_id,created_at" as never)
        .eq("workspace_id" as never, params.workspaceId as never)
        .in("status" as never, statuses as never)
        .order("priority" as never, { ascending: false })
        .order("due_at" as never, { ascending: true, nullsFirst: false })
        .limit(limit) as unknown as { data: Array<Record<string, unknown>> | null; error: { message: string } | null };

    if (error) throw new Error(error.message);
    const rows = data ?? [];

    return buildStructuredResult({
        key: params.key,
        label,
        answer: formatListAnswer(rows.length, noun, rows.map((row) => String(row.title ?? "Untitled work item"))),
        value: rows.length,
        rows,
        scope: params.scope,
        tables: ["workspace_work_items"],
        filters: { ...workspaceFilter(params.workspaceId), status: statuses, limit },
        businessDefinition,
    });
}

async function runOpenWorkItemList(params: StructuredHubQueryRunnerParams) {
    return runWorkItemList(params, ["open", "in_progress"], "open work item");
}

async function runBlockedWorkItemList(params: StructuredHubQueryRunnerParams) {
    return runWorkItemList(params, ["blocked"], "blocked work item");
}

async function runFailingIntegrationList(params: StructuredHubQueryRunnerParams) {
    const supabase = await createClient();
    const { label, businessDefinition } = glossary(params.key);
    const statuses = ["failing", "degraded"];
    const limit = safeLimit(params.limit);
    const { data, error } = await supabase
        .from("workspace_integrations" as never)
        .select("id,provider,integration_key,status,last_failure_at,consecutive_failures,last_error_code,last_error_message,updated_at" as never)
        .eq("workspace_id" as never, params.workspaceId as never)
        .in("status" as never, statuses as never)
        .order("updated_at" as never, { ascending: false })
        .limit(limit) as unknown as { data: Array<Record<string, unknown>> | null; error: { message: string } | null };

    if (error) throw new Error(error.message);
    const rows = data ?? [];

    return buildStructuredResult({
        key: params.key,
        label,
        answer: formatListAnswer(rows.length, "failing/degraded integration", rows.map((row) => `${row.provider}/${row.integration_key} (${row.status})`)),
        value: rows.length,
        rows,
        scope: params.scope,
        tables: ["workspace_integrations"],
        filters: { ...workspaceFilter(params.workspaceId), status: statuses, limit },
        businessDefinition,
        limitations: ["This reports health evidence rows only; it is not a connector lifecycle manager or payload replay surface."],
    });
}

async function runRecentFailedWorkflowRunList(params: StructuredHubQueryRunnerParams) {
    const supabase = await createClient();
    const { label, businessDefinition } = glossary(params.key);
    const statuses = ["failed", "retrying"];
    const limit = safeLimit(params.limit);
    const { data, error } = await supabase
        .from("workspace_workflow_runs" as never)
        .select("id,status,attempts,max_attempts,run_after,error_message,worker_id,created_at,updated_at,work_item_id" as never)
        .eq("workspace_id" as never, params.workspaceId as never)
        .in("status" as never, statuses as never)
        .order("updated_at" as never, { ascending: false })
        .limit(limit) as unknown as { data: Array<Record<string, unknown>> | null; error: { message: string } | null };

    if (error) throw new Error(error.message);
    const rows = data ?? [];

    return buildStructuredResult({
        key: params.key,
        label,
        answer: formatListAnswer(rows.length, "failed/retrying workflow run", rows.map((row) => `${row.status} run ${String(row.id).slice(0, 8)}${row.error_message ? `: ${String(row.error_message).slice(0, 80)}` : ""}`)),
        value: rows.length,
        rows,
        scope: params.scope,
        tables: ["workspace_workflow_runs"],
        filters: { ...workspaceFilter(params.workspaceId), status: statuses, limit },
        businessDefinition,
    });
}

async function runUnprocessedVoiceMemoCount(params: StructuredHubQueryRunnerParams) {
    const supabase = await createClient();
    const { label, businessDefinition } = glossary(params.key);
    const count = await exactCount(
        supabase
            .from("workspace_voice_memos")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", params.workspaceId)
            .is("processed_at", null),
    );

    return buildStructuredResult({
        key: params.key,
        label,
        answer: formatCountAnswer(count, "unprocessed voice memo"),
        value: count,
        scope: params.scope,
        tables: ["workspace_voice_memos"],
        filters: { ...workspaceFilter(params.workspaceId), processed_at: null },
        businessDefinition,
    });
}

async function runRecentVoiceMemoCount(params: StructuredHubQueryRunnerParams) {
    const supabase = await createClient();
    const { label, businessDefinition } = glossary(params.key);
    const dateWindow = params.dateWindow ?? createRecentStructuredHubDateWindow("UTC", 30);
    const count = await exactCount(
        supabase
            .from("workspace_voice_memos")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", params.workspaceId)
            .gte("created_at", dateWindow.from)
            .lte("created_at", dateWindow.to),
    );

    return buildStructuredResult({
        key: params.key,
        label,
        answer: formatWindowedCountAnswer(count, "voice memo", dateWindow.label),
        value: count,
        scope: params.scope,
        tables: ["workspace_voice_memos"],
        filters: { ...workspaceFilter(params.workspaceId), created_at: { from: dateWindow.from, to: dateWindow.to, label: dateWindow.label, timezone: dateWindow.timezone } },
        businessDefinition,
    });
}

async function runContentItemCount(params: StructuredHubQueryRunnerParams) {
    const supabase = await createClient();
    const { label, businessDefinition } = glossary(params.key);
    const count = await exactCount(
        supabase.from("content_items").select("id", { count: "exact", head: true }).eq("workspace_id", params.workspaceId),
    );

    return buildStructuredResult({
        key: params.key,
        label,
        answer: formatCountAnswer(count, "content item"),
        value: count,
        scope: params.scope,
        tables: ["content_items"],
        filters: workspaceFilter(params.workspaceId),
        businessDefinition,
        limitations: ["Template-specific content filtering is not inferred in this MVP unless a future structured parameter supplies template_id."],
    });
}

async function runPublishedContentCount(params: StructuredHubQueryRunnerParams) {
    const supabase = await createClient();
    const { label, businessDefinition } = glossary(params.key);
    const count = await exactCount(
        supabase
            .from("content_items")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", params.workspaceId)
            .eq("status", "published"),
    );

    return buildStructuredResult({
        key: params.key,
        label,
        answer: formatCountAnswer(count, "published content item"),
        value: count,
        scope: params.scope,
        tables: ["content_items"],
        filters: { ...workspaceFilter(params.workspaceId), status: "published" },
        businessDefinition,
        limitations: ["Template-specific content filtering is not inferred in this MVP unless a future structured parameter supplies template_id."],
    });
}

async function runBookingReservationCount(params: StructuredHubQueryRunnerParams) {
    const supabase = await createClient();
    const { label, businessDefinition } = glossary(params.key);
    let query = supabase.from("booking_reservations").select("id", { count: "exact", head: true }).eq("workspace_id", params.workspaceId);
    const filters: Record<string, unknown> = workspaceFilter(params.workspaceId);
    if (params.dateWindow) {
        query = query.gte("created_at", params.dateWindow.from).lte("created_at", params.dateWindow.to);
        filters.created_at = { from: params.dateWindow.from, to: params.dateWindow.to, label: params.dateWindow.label, timezone: params.dateWindow.timezone };
    }
    const count = await exactCount(query);

    return buildStructuredResult({
        key: params.key,
        label,
        answer: params.dateWindow
            ? formatWindowedCountAnswer(count, "booking reservation", params.dateWindow.label)
            : formatCountAnswer(count, "booking reservation"),
        value: count,
        scope: params.scope,
        tables: ["booking_reservations"],
        filters,
        businessDefinition,
    });
}

async function runOpenOpportunityCount(params: StructuredHubQueryRunnerParams) {
    const supabase = await createClient();
    const { label, businessDefinition } = glossary(params.key);
    const statuses = ["pending", "approved"];
    const count = await exactCount(
        supabase
            .from("workspace_opportunities")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", params.workspaceId)
            .in("status", statuses),
    );

    return buildStructuredResult({
        key: params.key,
        label,
        answer: formatCountAnswer(count, "open opportunity"),
        value: count,
        scope: params.scope,
        tables: ["workspace_opportunities"],
        filters: { ...workspaceFilter(params.workspaceId), status: statuses },
        businessDefinition,
    });
}

async function runQuoteStatusCounts(params: StructuredHubQueryRunnerParams) {
    const supabase = await createClient();
    const { label, businessDefinition } = glossary(params.key);
    const { data, error } = await supabase
        .from("workspace_quotes" as never)
        .select("id,status" as never)
        .eq("workspace_id" as never, params.workspaceId as never)
        .limit(1000) as unknown as { data: Array<{ status: string }> | null; error: { message: string } | null };

    if (error) throw new Error(error.message);

    const counts = new Map<string, number>();
    for (const row of data ?? []) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
    const rows = Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([status, count]) => ({ status, count }));
    const totalCount = (data ?? []).length;

    return buildStructuredResult({
        key: params.key,
        label,
        answer: `There ${totalCount === 1 ? "is" : "are"} ${totalCount} ${totalCount === 1 ? "quote" : "quotes"}. Status breakdown: ${rows.map((row) => `${row.status}: ${row.count}`).join(", ") || "none"}.`,
        value: totalCount,
        rows,
        scope: params.scope,
        tables: ["workspace_quotes"],
        filters: { ...workspaceFilter(params.workspaceId), scan_limit: 1000 },
        businessDefinition,
        limitations: ["Status grouping scans at most the first 1,000 quotes in this bounded MVP."],
    });
}

async function runInvoiceStatusCounts(params: StructuredHubQueryRunnerParams) {
    const supabase = await createClient();
    const { label, businessDefinition } = glossary(params.key);
    const { data, error } = await supabase
        .from("legal_invoices" as never)
        .select("id,status" as never)
        .eq("workspace_id" as never, params.workspaceId as never)
        .limit(1000) as unknown as { data: Array<{ status: string }> | null; error: { message: string } | null };

    if (error) throw new Error(error.message);

    const counts = new Map<string, number>();
    for (const row of data ?? []) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
    const rows = Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([status, count]) => ({ status, count }));
    const totalCount = (data ?? []).length;

    return buildStructuredResult({
        key: params.key,
        label,
        answer: `There ${totalCount === 1 ? "is" : "are"} ${totalCount} ${totalCount === 1 ? "invoice" : "invoices"}. Status breakdown: ${rows.map((row) => `${row.status}: ${row.count}`).join(", ") || "none"}.`,
        value: totalCount,
        rows,
        scope: params.scope,
        tables: ["legal_invoices"],
        filters: { ...workspaceFilter(params.workspaceId), scan_limit: 1000 },
        businessDefinition,
        limitations: ["Status grouping scans at most the first 1,000 invoices in this bounded MVP."],
    });
}

async function runRecentCustomerLifecycleEvents(params: StructuredHubQueryRunnerParams) {
    const supabase = await createClient();
    const { label, businessDefinition } = glossary(params.key);
    const limit = safeLimit(params.limit);
    const { data, error } = await supabase
        .from("workspace_customer_timeline_events" as never)
        .select("id,customer_id,event_type,summary,occurred_at" as never)
        .eq("workspace_id" as never, params.workspaceId as never)
        .order("occurred_at" as never, { ascending: false })
        .limit(limit) as unknown as { data: Array<Record<string, unknown>> | null; error: { message: string } | null };

    if (error) throw new Error(error.message);
    const rows = data ?? [];

    return buildStructuredResult({
        key: params.key,
        label,
        answer: formatListAnswer(rows.length, "recent customer event", rows.map((row) => `${row.event_type}: ${row.summary}`)),
        value: rows.length,
        rows,
        scope: params.scope,
        tables: ["workspace_customer_timeline_events"],
        filters: { ...workspaceFilter(params.workspaceId), limit },
        businessDefinition,
    });
}

export const STRUCTURED_HUB_QUERY_REGISTRY: Record<StructuredHubQueryKey, StructuredHubQueryCard> = {
    client_count: { key: "client_count", ...glossary("client_count"), description: "Count portal clients.", tables: ["client_portal_users"], supportedScopes: ["active_workspace"], run: runClientCount },
    client_list: { key: "client_list", ...glossary("client_list"), description: "List portal clients.", tables: ["client_portal_users"], supportedScopes: ["active_workspace"], defaultLimit: DEFAULT_LIST_LIMIT, maxLimit: MAX_LIST_LIMIT, run: runClientList },
    customer_lifecycle_counts: { key: "customer_lifecycle_counts", ...glossary("customer_lifecycle_counts"), description: "Count Business Spine customers by lifecycle status.", tables: ["workspace_customers"], supportedScopes: ["active_workspace"], run: runCustomerLifecycleCounts },
    project_count: { key: "project_count", ...glossary("project_count"), description: "Count workspace client projects/locations.", tables: ["workspace_client_projects"], supportedScopes: ["active_workspace"], run: runProjectCount },
    sla_task_count: { key: "sla_task_count", ...glossary("sla_task_count"), description: "Count SLA tasks through workspace projects.", tables: ["workspace_sla_tasks", "workspace_client_projects"], supportedScopes: ["active_workspace"], run: runSlaTaskCount },
    overdue_sla_task_count: { key: "overdue_sla_task_count", ...glossary("overdue_sla_task_count"), description: "Count overdue SLA tasks with shared due-state logic.", tables: ["workspace_sla_tasks", "workspace_client_projects"], supportedScopes: ["active_workspace"], run: runOverdueSlaTaskCount },
    unresolved_sla_flags_count: { key: "unresolved_sla_flags_count", ...glossary("unresolved_sla_flags_count"), description: "Count unresolved SLA flags from notes.", tables: ["workspace_sla_task_notes"], supportedScopes: ["active_workspace"], run: runUnresolvedSlaFlagsCount },
    open_work_item_list: { key: "open_work_item_list", ...glossary("open_work_item_list"), description: "List open and in-progress Business Spine work items.", tables: ["workspace_work_items"], supportedScopes: ["active_workspace"], defaultLimit: DEFAULT_LIST_LIMIT, maxLimit: MAX_LIST_LIMIT, run: runOpenWorkItemList },
    blocked_work_item_list: { key: "blocked_work_item_list", ...glossary("blocked_work_item_list"), description: "List blocked Business Spine work items.", tables: ["workspace_work_items"], supportedScopes: ["active_workspace"], defaultLimit: DEFAULT_LIST_LIMIT, maxLimit: MAX_LIST_LIMIT, run: runBlockedWorkItemList },
    failing_integration_list: { key: "failing_integration_list", ...glossary("failing_integration_list"), description: "List failing or degraded integration health evidence rows.", tables: ["workspace_integrations"], supportedScopes: ["active_workspace"], defaultLimit: DEFAULT_LIST_LIMIT, maxLimit: MAX_LIST_LIMIT, run: runFailingIntegrationList },
    recent_failed_workflow_run_list: { key: "recent_failed_workflow_run_list", ...glossary("recent_failed_workflow_run_list"), description: "List recent failed or retrying workflow runs.", tables: ["workspace_workflow_runs"], supportedScopes: ["active_workspace"], defaultLimit: DEFAULT_LIST_LIMIT, maxLimit: MAX_LIST_LIMIT, run: runRecentFailedWorkflowRunList },
    unprocessed_voice_memo_count: { key: "unprocessed_voice_memo_count", ...glossary("unprocessed_voice_memo_count"), description: "Count voice memos awaiting processing.", tables: ["workspace_voice_memos"], supportedScopes: ["active_workspace"], run: runUnprocessedVoiceMemoCount },
    recent_voice_memo_count: { key: "recent_voice_memo_count", ...glossary("recent_voice_memo_count"), description: "Count voice memos in a deterministic date window.", tables: ["workspace_voice_memos"], supportedScopes: ["active_workspace"], run: runRecentVoiceMemoCount },
    content_item_count: { key: "content_item_count", ...glossary("content_item_count"), description: "Count workspace content items.", tables: ["content_items"], supportedScopes: ["active_workspace"], run: runContentItemCount },
    published_content_count: { key: "published_content_count", ...glossary("published_content_count"), description: "Count published workspace content.", tables: ["content_items"], supportedScopes: ["active_workspace"], run: runPublishedContentCount },
    booking_reservation_count: { key: "booking_reservation_count", ...glossary("booking_reservation_count"), description: "Count booking reservations.", tables: ["booking_reservations"], supportedScopes: ["active_workspace"], run: runBookingReservationCount },
    open_opportunity_count: { key: "open_opportunity_count", ...glossary("open_opportunity_count"), description: "Count pending/approved opportunities.", tables: ["workspace_opportunities"], supportedScopes: ["active_workspace"], run: runOpenOpportunityCount },
    quote_status_counts: { key: "quote_status_counts", ...glossary("quote_status_counts"), description: "Count Business Spine quotes by status.", tables: ["workspace_quotes"], supportedScopes: ["active_workspace"], run: runQuoteStatusCounts },
    invoice_status_counts: { key: "invoice_status_counts", ...glossary("invoice_status_counts"), description: "Count Legal Vault invoices by status.", tables: ["legal_invoices"], supportedScopes: ["active_workspace"], run: runInvoiceStatusCounts },
    recent_customer_lifecycle_events: { key: "recent_customer_lifecycle_events", ...glossary("recent_customer_lifecycle_events"), description: "List recent customer timeline events.", tables: ["workspace_customer_timeline_events"], supportedScopes: ["active_workspace"], defaultLimit: DEFAULT_LIST_LIMIT, maxLimit: MAX_LIST_LIMIT, run: runRecentCustomerLifecycleEvents },
};

export async function runStructuredHubQuery(params: StructuredHubQueryRunnerParams): Promise<{ data: StructuredHubQueryResult | null; error: string | null }> {
    try {
        const card = STRUCTURED_HUB_QUERY_REGISTRY[params.key];
        if (!card) {
            return { data: null, error: "Unsupported structured query key." };
        }

        if (!card.supportedScopes.includes(params.scope)) {
            return { data: null, error: "This structured query is not approved for the requested scope." };
        }

        const data = await card.run(params);
        return { data, error: null };
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown structured query error";
        console.error("[legibility-hub] structured query error:", message);
        return { data: null, error: message };
    }
}
