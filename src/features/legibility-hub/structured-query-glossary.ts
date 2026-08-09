import type { StructuredHubQueryKey } from "./structured-query-types";

export interface StructuredQueryGlossaryEntry {
    key: StructuredHubQueryKey;
    label: string;
    businessDefinition: string;
    synonyms: string[];
    exampleQuery: string;
}

export const STRUCTURED_QUERY_GLOSSARY: StructuredQueryGlossaryEntry[] = [
    {
        key: "client_count",
        label: "Portal client count",
        businessDefinition: "Portal clients means rows in client_portal_users scoped to the active workspace.",
        synonyms: ["clients", "portal clients", "accounts", "customers", "partners"],
        exampleQuery: "How many clients do we have?",
    },
    {
        key: "client_list",
        label: "Portal client list",
        businessDefinition: "Portal client list means client_portal_users rows scoped to the active workspace, capped for display.",
        synonyms: ["list clients", "show clients", "which clients", "client names"],
        exampleQuery: "List our clients.",
    },
    {
        key: "customer_lifecycle_counts",
        label: "Customer lifecycle counts",
        businessDefinition: "Business Spine customers means non-deleted workspace_customers rows scoped to the active workspace, grouped by lifecycle_status.",
        synonyms: ["customer lifecycle", "active customers", "customer status", "customer breakdown", "workspace customers"],
        exampleQuery: "How many customers are active?",
    },
    {
        key: "project_count",
        label: "Project/location count",
        businessDefinition: "Projects or locations means workspace_client_projects rows scoped to the active workspace.",
        synonyms: ["projects", "locations", "facilities", "sites"],
        exampleQuery: "How many locations do we have?",
    },
    {
        key: "sla_task_count",
        label: "SLA task count",
        businessDefinition: "SLA tasks means workspace_sla_tasks joined through workspace_client_projects scoped to the active workspace.",
        synonyms: ["sla tasks", "schedules", "recurring tasks", "cleaning schedules"],
        exampleQuery: "How many SLA tasks do we have?",
    },
    {
        key: "overdue_sla_task_count",
        label: "Overdue SLA task count",
        businessDefinition: "Overdue SLA tasks are computed in TypeScript with computeTaskDueState using the task cadence, completion date, and grace period.",
        synonyms: ["overdue", "late", "behind schedule", "past due"],
        exampleQuery: "How many overdue SLA tasks do we have?",
    },
    {
        key: "unresolved_sla_flags_count",
        label: "Unresolved SLA flag count",
        businessDefinition: "Unresolved SLA flags means latest workspace_sla_task_notes flags without a later resolution note, scoped to the active workspace.",
        synonyms: ["unresolved flags", "client flags", "awaiting reply", "flagged tasks"],
        exampleQuery: "How many unresolved client flags are there?",
    },
    {
        key: "open_work_item_list",
        label: "Open work item list",
        businessDefinition: "Open work items means workspace_work_items rows scoped to the active workspace with status open or in_progress.",
        synonyms: ["open work items", "active work items", "in progress work", "ops tasks"],
        exampleQuery: "Which work items are open?",
    },
    {
        key: "blocked_work_item_list",
        label: "Blocked work item list",
        businessDefinition: "Blocked work items means workspace_work_items rows scoped to the active workspace with status blocked.",
        synonyms: ["blocked work items", "blocked tasks", "blocked ops items"],
        exampleQuery: "Which work items are blocked?",
    },
    {
        key: "failing_integration_list",
        label: "Failing or degraded integrations",
        businessDefinition: "Failing integrations means workspace_integrations rows scoped to the active workspace with status failing or degraded.",
        synonyms: ["failing integrations", "degraded integrations", "unhealthy providers", "broken connectors"],
        exampleQuery: "Which integrations are failing?",
    },
    {
        key: "recent_failed_workflow_run_list",
        label: "Recent failed workflow runs",
        businessDefinition: "Recent failed workflow runs means workspace_workflow_runs rows scoped to the active workspace with status failed or retrying, capped for display.",
        synonyms: ["workflow failures", "failed automations", "retrying workflows", "automation errors"],
        exampleQuery: "Show recent workflow failures.",
    },
    {
        key: "unprocessed_voice_memo_count",
        label: "Unprocessed voice memo count",
        businessDefinition: "Unprocessed voice memos means workspace_voice_memos rows in the active workspace where processed_at is null.",
        synonyms: ["unprocessed voice memos", "unprocessed recordings", "pending recordings"],
        exampleQuery: "How many voice memos are unprocessed?",
    },
    {
        key: "recent_voice_memo_count",
        label: "Recent voice memo count",
        businessDefinition: "Recent voice memos means workspace_voice_memos rows created inside the deterministic date window, scoped to the active workspace.",
        synonyms: ["recent voice memos", "recordings", "calls", "voice memos"],
        exampleQuery: "How many voice memos in the last 30 days?",
    },
    {
        key: "content_item_count",
        label: "Content item count",
        businessDefinition: "Content items means content_items rows scoped to the active workspace. Template-specific filtering is not inferred unless explicitly supported.",
        synonyms: ["content", "content items", "posts", "pages"],
        exampleQuery: "How many content items do we have?",
    },
    {
        key: "published_content_count",
        label: "Published content count",
        businessDefinition: "Published content means content_items rows scoped to the active workspace where status is published.",
        synonyms: ["published content", "published posts", "published pages"],
        exampleQuery: "How many published posts do we have?",
    },
    {
        key: "booking_reservation_count",
        label: "Booking reservation count",
        businessDefinition: "Booking reservations means booking_reservations rows scoped to the active workspace, optionally filtered by a deterministic created_at window.",
        synonyms: ["reservations", "bookings", "booking requests", "appointments"],
        exampleQuery: "How many bookings were created this month?",
    },
    {
        key: "open_opportunity_count",
        label: "Open opportunity count",
        businessDefinition: "Open opportunities means workspace_opportunities rows scoped to the active workspace with status pending or approved.",
        synonyms: ["open opportunities", "pending opportunities", "approved opportunities"],
        exampleQuery: "How many open opportunities do we have?",
    },
    {
        key: "quote_status_counts",
        label: "Quote status counts",
        businessDefinition: "Quotes means workspace_quotes rows scoped to the active workspace, grouped by status.",
        synonyms: ["quotes", "quote status", "pending quotes"],
        exampleQuery: "What is the status of our quotes?",
    },
    {
        key: "invoice_status_counts",
        label: "Invoice status counts",
        businessDefinition: "Invoices means legal_invoices rows scoped to the active workspace, grouped by status.",
        synonyms: ["invoices", "invoice status", "unpaid invoices", "paid invoices"],
        exampleQuery: "How many invoices are unpaid?",
    },
    {
        key: "recent_customer_lifecycle_events",
        label: "Recent customer lifecycle events",
        businessDefinition: "Customer lifecycle events means workspace_customer_timeline_events rows scoped to the active workspace.",
        synonyms: ["customer events", "lifecycle events", "recent customer activity"],
        exampleQuery: "Show recent customer lifecycle events.",
    },
];

export const SUPPORTED_STRUCTURED_EXAMPLES = STRUCTURED_QUERY_GLOSSARY.map((entry) => ({
    label: entry.label,
    query: entry.exampleQuery,
    key: entry.key,
}));

export const UNSUPPORTED_METRIC_RESPONSE = "I can’t answer that as a structured metric yet.";

export function findGlossaryEntry(key: StructuredHubQueryKey) {
    return STRUCTURED_QUERY_GLOSSARY.find((entry) => entry.key === key);
}

export function suggestStructuredMetrics(queryText = "") {
    const normalized = queryText.toLowerCase();
    const scored = STRUCTURED_QUERY_GLOSSARY.map((entry) => {
        const score = entry.synonyms.reduce((acc, synonym) => acc + (normalized.includes(synonym) ? 1 : 0), 0);
        return { entry, score };
    }).sort((a, b) => b.score - a.score);

    return scored.map(({ entry }) => ({
        label: entry.label,
        query: entry.exampleQuery,
        key: entry.key,
    }));
}
