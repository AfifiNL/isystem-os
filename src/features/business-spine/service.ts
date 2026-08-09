"use server";

import { createClient } from "@/shared/lib/supabase/server";
import type { Json } from "@/shared/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchRecorderWorkflowEvent } from "@/features/business-spine/workflow-events";
import { resolveCanonicalCustomerId } from "@/features/business-spine/identity";
import { deriveAccountCommercialSummary } from "@/features/business-spine/commercial-summary";
import { getPostSessionCommercialFollowUpPlan } from "@/features/booking/lib/customer-management-policy";
import { deriveBookingLifecycle } from "@/features/business-spine/lifecycle";
import type {
    BusinessCustomer,
    BusinessCustomerDetail,
    BusinessAssigneeOption,
    BusinessCommercialLink,
    BusinessHealthSummary,
    BusinessIntegrationHealth,
    BusinessLifecycleStatus,
    BusinessWorkItem,
    BusinessWorkItemPriority,
    BusinessWorkItemStatus,
    BusinessWorkflowRule,
    BusinessTimelineEvent,
} from "@/features/business-spine/types";

type SupabaseLike = Awaited<ReturnType<typeof createClient>> | SupabaseClient;

async function bestEffortWorkflow(input: Parameters<typeof dispatchRecorderWorkflowEvent>[0]) {
    const telemetry = await dispatchRecorderWorkflowEvent(input);
    if (telemetry && !telemetry.ok) {
        console.warn("[business-spine] workflow dispatch failed", {
            eventKey: telemetry.eventKey,
            idempotencyKey: telemetry.idempotencyKey,
            error: telemetry.error,
        });
    }
}

type CustomerRow = {
    id: string;
    workspace_id: string;
    display_name: string;
    legal_name: string | null;
    lifecycle_status: BusinessLifecycleStatus;
    primary_email: string | null;
    primary_phone: string | null;
    owner_profile_id: string | null;
    portal_client_id: string | null;
    source_module: string | null;
    updated_at: string;
};

type WorkItemRow = {
    id: string;
    workspace_id: string;
    customer_id: string | null;
    title: string;
    description: string | null;
    kind: string;
    status: BusinessWorkItemStatus;
    priority: BusinessWorkItemPriority;
    assigned_to_profile_id: string | null;
    due_at: string | null;
    source_module: string | null;
    source_entity_type: string | null;
    source_entity_id: string | null;
    created_at: string;
    updated_at: string;
};

type WorkflowRuleRow = {
    id: string;
    workspace_id: string;
    name: string;
    trigger_key: string;
    is_enabled: boolean;
    requires_approval: boolean;
    condition_json?: unknown;
    action_json?: unknown;
    metadata?: unknown;
    updated_at: string;
};

type IntegrationRow = {
    id: string;
    workspace_id: string;
    provider: string;
    integration_key: string;
    status: BusinessIntegrationHealth["status"];
    last_success_at: string | null;
    last_failure_at: string | null;
    consecutive_failures: number;
    last_error_message: string | null;
    updated_at: string;
};

type TimelineRow = {
    id: string;
    customer_id: string;
    event_type: string;
    summary: string;
    body: string | null;
    actor_type: string;
    source_module: string;
    source_table: string | null;
    source_id: string | null;
    occurred_at: string;
};

type CommercialLinkRow = {
    id: string;
    customer_id: string | null;
    link_type: string;
    linked_record_type: string;
    linked_record_id: string | null;
    linked_record_ref: string | null;
    created_at: string;
};

type PortalClientRow = {
    id: string;
    email: string | null;
    full_name: string | null;
};

const LIFECYCLE_RANK: Record<BusinessLifecycleStatus, number> = {
    prospect: 0,
    lead: 1,
    qualified: 2,
    customer: 3,
    active: 4,
    paused: 5,
    churned: 6,
};

type ExistingCustomerRow = {
    id: string;
    lifecycle_status: BusinessLifecycleStatus;
    display_name: string;
    primary_email: string | null;
    primary_phone: string | null;
    portal_client_id: string | null;
    metadata: Json;
};

function mapCustomer(row: CustomerRow): BusinessCustomer {
    return {
        id: row.id,
        workspaceId: row.workspace_id,
        displayName: row.display_name,
        legalName: row.legal_name,
        lifecycleStatus: row.lifecycle_status,
        primaryEmail: row.primary_email,
        primaryPhone: row.primary_phone,
        ownerProfileId: row.owner_profile_id,
        portalClientId: row.portal_client_id,
        sourceModule: row.source_module,
        updatedAt: row.updated_at,
    };
}

async function updateExistingCustomerForSignal(
    supabase: SupabaseLike | SupabaseClient,
    existing: ExistingCustomerRow,
    input: {
        workspaceId: string;
        displayName: string;
        email?: string | null;
        phone?: string | null;
        portalClientId?: string | null;
        sourceModule: string;
        lifecycleStatus?: BusinessLifecycleStatus;
        metadata?: Record<string, unknown>;
    },
) {
    const nextLifecycle = input.lifecycleStatus ?? existing.lifecycle_status;
    const lifecycleStatus = LIFECYCLE_RANK[nextLifecycle] > LIFECYCLE_RANK[existing.lifecycle_status]
        ? nextLifecycle
        : existing.lifecycle_status;
    const normalizedEmail = input.email?.trim().toLowerCase() || null;
    const displayNameCandidate = input.displayName.trim();
    const nextDisplayName = displayNameCandidate && displayNameCandidate !== "Booking customer"
        ? displayNameCandidate
        : existing.display_name;
    const nextEmail = input.email !== undefined ? normalizedEmail : existing.primary_email;
    const nextPhone = input.phone !== undefined ? input.phone?.trim() || null : existing.primary_phone;
    const nextPortalClientId = input.portalClientId !== undefined
        ? input.portalClientId
        : existing.portal_client_id;
    const existingMetadata = existing.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
        ? existing.metadata as Record<string, unknown>
        : {};

    const { error } = await supabase
        .from("workspace_customers" as never)
        .update({
            display_name: nextDisplayName || nextEmail || "Unknown customer",
            lifecycle_status: lifecycleStatus,
            primary_email: nextEmail,
            primary_phone: nextPhone,
            portal_client_id: nextPortalClientId,
            source_module: input.sourceModule,
            metadata: { ...existingMetadata, ...(input.metadata ?? {}) } as Json,
        } as never)
        .eq("workspace_id" as never, input.workspaceId as never)
        .eq("id" as never, existing.id as never);

    if (error) console.warn("[business-spine] customer update failed", error.message);
}

function mapWorkItem(row: WorkItemRow): BusinessWorkItem {
    return {
        id: row.id,
        workspaceId: row.workspace_id,
        customerId: row.customer_id,
        title: row.title,
        description: row.description,
        kind: row.kind,
        status: row.status,
        priority: row.priority,
        assignedToProfileId: row.assigned_to_profile_id,
        dueAt: row.due_at,
        sourceModule: row.source_module,
        sourceEntityType: row.source_entity_type,
        sourceEntityId: row.source_entity_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function mapWorkflowRule(row: WorkflowRuleRow): BusinessWorkflowRule {
    return {
        id: row.id,
        workspaceId: row.workspace_id,
        name: row.name,
        triggerKey: row.trigger_key,
        isEnabled: row.is_enabled,
        requiresApproval: row.requires_approval,
        updatedAt: row.updated_at,
        conditionJson: row.condition_json,
        actionJson: row.action_json,
        metadata: row.metadata,
    };
}

function mapIntegration(row: IntegrationRow): BusinessIntegrationHealth {
    return {
        id: row.id,
        workspaceId: row.workspace_id,
        provider: row.provider,
        integrationKey: row.integration_key,
        status: row.status,
        lastSuccessAt: row.last_success_at,
        lastFailureAt: row.last_failure_at,
        consecutiveFailures: row.consecutive_failures,
        lastErrorMessage: row.last_error_message,
        updatedAt: row.updated_at,
    };
}

async function maybeArray<T>(query: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
    try {
        const { data, error } = await query;
        if (error) return [];
        return Array.isArray(data) ? data as T[] : [];
    } catch {
        return [];
    }
}

async function maybeCount(query: PromiseLike<{ count: number | null; error: { message: string } | null }>): Promise<number> {
    try {
        const { count, error } = await query;
        if (error) return 0;
        return count ?? 0;
    } catch {
        return 0;
    }
}

export async function listBusinessCustomers(workspaceId: string): Promise<BusinessCustomer[]> {
    const supabase = await createClient();
    const rows = await maybeArray<CustomerRow>(
        supabase
            .from("workspace_customers" as never)
            .select("id,workspace_id,display_name,legal_name,lifecycle_status,primary_email,primary_phone,owner_profile_id,portal_client_id,source_module,updated_at" as never)
            .eq("workspace_id" as never, workspaceId as never)
            .is("deleted_at" as never, null as never)
            .order("updated_at" as never, { ascending: false })
            .limit(100) as never,
    );
    return rows.map(mapCustomer);
}

export async function listBusinessWorkItems(workspaceId: string): Promise<BusinessWorkItem[]> {
    const supabase = await createClient();
    const rows = await maybeArray<WorkItemRow>(
        supabase
            .from("workspace_work_items" as never)
            .select("id,workspace_id,customer_id,title,description,kind,status,priority,assigned_to_profile_id,due_at,source_module,source_entity_type,source_entity_id,created_at,updated_at" as never)
            .eq("workspace_id" as never, workspaceId as never)
            .in("status" as never, ["open", "in_progress", "blocked"] as never)
            .order("priority" as never, { ascending: false })
            .order("due_at" as never, { ascending: true, nullsFirst: false })
            .limit(100) as never,
    );
    return rows.map(mapWorkItem);
}

export async function listBusinessWorkflowRules(workspaceId: string): Promise<BusinessWorkflowRule[]> {
    const supabase = await createClient();
    const rows = await maybeArray<WorkflowRuleRow>(
        supabase
            .from("workspace_workflow_rules" as never)
            .select("id,workspace_id,name,trigger_key,is_enabled,requires_approval,condition_json,action_json,metadata,updated_at" as never)
            .eq("workspace_id" as never, workspaceId as never)
            .order("updated_at" as never, { ascending: false })
            .limit(100) as never,
    );
    return rows.map(mapWorkflowRule);
}

export async function getBusinessCustomerDetail(workspaceId: string, customerId: string): Promise<BusinessCustomerDetail | null> {
    const supabase = await createClient();
    const { data: customerRow, error } = await supabase
        .from("workspace_customers" as never)
        .select("id,workspace_id,display_name,legal_name,lifecycle_status,primary_email,primary_phone,owner_profile_id,portal_client_id,source_module,updated_at" as never)
        .eq("workspace_id" as never, workspaceId as never)
        .eq("id" as never, customerId as never)
        .is("deleted_at" as never, null as never)
        .maybeSingle() as unknown as { data: CustomerRow | null; error: { message: string } | null };
    if (error || !customerRow) return null;

    const [timelineRows, workRows, commercialRows, portalRow] = await Promise.all([
        maybeArray<TimelineRow>(
            supabase
                .from("workspace_customer_timeline_events" as never)
                .select("id,customer_id,event_type,summary,body,actor_type,source_module,source_table,source_id,occurred_at" as never)
                .eq("workspace_id" as never, workspaceId as never)
                .eq("customer_id" as never, customerId as never)
                .order("occurred_at" as never, { ascending: false })
                .limit(50) as never,
        ),
        maybeArray<WorkItemRow>(
            supabase
                .from("workspace_work_items" as never)
                .select("id,workspace_id,customer_id,title,description,kind,status,priority,assigned_to_profile_id,due_at,source_module,source_entity_type,source_entity_id,created_at,updated_at" as never)
                .eq("workspace_id" as never, workspaceId as never)
                .eq("customer_id" as never, customerId as never)
                .in("status" as never, ["open", "in_progress", "blocked"] as never)
                .order("priority" as never, { ascending: false })
                .order("created_at" as never, { ascending: false })
                .limit(30) as never,
        ),
        maybeArray<CommercialLinkRow>(
            supabase
                .from("workspace_commercial_links" as never)
                .select("id,customer_id,link_type,linked_record_type,linked_record_id,linked_record_ref,created_at" as never)
                .eq("workspace_id" as never, workspaceId as never)
                .eq("customer_id" as never, customerId as never)
                .order("created_at" as never, { ascending: false })
                .limit(30) as never,
        ),
        customerRow.portal_client_id
            ? supabase
                .from("client_portal_users" as never)
                .select("id,email,full_name" as never)
                .eq("id" as never, customerRow.portal_client_id as never)
                .maybeSingle()
                .then((result) => (result as unknown as { data: PortalClientRow | null }).data ?? null, () => null)
            : Promise.resolve(null),
    ]);

    const timeline: BusinessTimelineEvent[] = timelineRows.map((row) => ({
        id: row.id,
        customerId: row.customer_id,
        eventType: row.event_type,
        summary: row.summary,
        body: row.body,
        actorType: row.actor_type,
        sourceModule: row.source_module,
        sourceTable: row.source_table,
        sourceId: row.source_id,
        occurredAt: row.occurred_at,
    }));
    const commercialLinks: BusinessCommercialLink[] = commercialRows.map((row) => ({
        id: row.id,
        customerId: row.customer_id,
        linkType: row.link_type,
        linkedRecordType: row.linked_record_type,
        linkedRecordId: row.linked_record_id,
        linkedRecordRef: row.linked_record_ref,
        createdAt: row.created_at,
    }));

    return {
        customer: mapCustomer(customerRow),
        timeline,
        openWorkItems: workRows.map(mapWorkItem),
        commercialLinks,
        commercialSummary: deriveAccountCommercialSummary({ commercialLinks, timeline }),
        portalClient: portalRow ? {
            id: portalRow.id,
            email: portalRow.email,
            fullName: portalRow.full_name,
        } : null,
    };
}

// Compatibility helper for the account truth boundary:
// workspace_customers is the internal Customer Spine account record, while
// client_portal_users remains Partner Portal membership truth. Resolution must
// mirror upsertCustomerForSignal(): portal client first, normalized email second;
// booking, legal-agreement, and payment identifiers are only safe fallbacks that
// derive an existing customer through those same identity keys.
export async function resolveCanonicalBusinessCustomerId(input: {
    supabase?: SupabaseLike;
    workspaceId: string;
    portalClientId?: string | null;
    email?: string | null;
    bookingId?: string | null;
    legalAgreementId?: string | null;
    paymentId?: string | null;
}): Promise<string | null> {
    const supabase = input.supabase ?? await createClient();
    return resolveCanonicalCustomerId({
        supabase,
        workspaceId: input.workspaceId,
        portalClientId: input.portalClientId,
        email: input.email,
        bookingId: input.bookingId,
        legalAgreementId: input.legalAgreementId,
        paymentId: input.paymentId,
    });
}

export async function listBusinessAssignees(workspaceId: string): Promise<BusinessAssigneeOption[]> {
    const supabase = await createClient();
    const rows = await maybeArray<{
        profile_id: string;
        membership_role: string;
        profiles: { email: string | null } | { email: string | null }[] | null;
    }>(
        supabase
            .from("workspace_memberships" as never)
            .select("profile_id,membership_role,profiles(email)" as never)
            .eq("workspace_id" as never, workspaceId as never)
            .in("membership_role" as never, ["owner", "admin", "manager", "member"] as never)
            .order("membership_role" as never, { ascending: true }) as never,
    );
    return rows.map((row) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        return {
            profileId: row.profile_id,
            email: profile?.email ?? row.profile_id,
            role: row.membership_role,
        };
    });
}

export async function listBusinessIntegrations(workspaceId: string): Promise<BusinessIntegrationHealth[]> {
    const supabase = await createClient();
    const rows = await maybeArray<IntegrationRow>(
        supabase
            .from("workspace_integrations" as never)
            .select("id,workspace_id,provider,integration_key,status,last_success_at,last_failure_at,consecutive_failures,last_error_message,updated_at" as never)
            .eq("workspace_id" as never, workspaceId as never)
            .order("provider" as never, { ascending: true })
            .limit(100) as never,
    );
    return rows.map(mapIntegration);
}

export async function getBusinessHealthSummary(workspaceId: string): Promise<BusinessHealthSummary> {
    const supabase = await createClient();
    const now = new Date().toISOString();

    const [
        totalCustomers,
        activeCustomers,
        leadCustomers,
        openWork,
        urgentWork,
        overdueWork,
        failingIntegrations,
        degradedIntegrations,
        enabledRules,
        failedRuns,
    ] = await Promise.all([
        maybeCount(supabase.from("workspace_customers" as never).select("id" as never, { count: "exact", head: true }).eq("workspace_id" as never, workspaceId as never).is("deleted_at" as never, null as never) as never),
        maybeCount(supabase.from("workspace_customers" as never).select("id" as never, { count: "exact", head: true }).eq("workspace_id" as never, workspaceId as never).in("lifecycle_status" as never, ["customer", "active"] as never).is("deleted_at" as never, null as never) as never),
        maybeCount(supabase.from("workspace_customers" as never).select("id" as never, { count: "exact", head: true }).eq("workspace_id" as never, workspaceId as never).in("lifecycle_status" as never, ["prospect", "lead", "qualified"] as never).is("deleted_at" as never, null as never) as never),
        maybeCount(supabase.from("workspace_work_items" as never).select("id" as never, { count: "exact", head: true }).eq("workspace_id" as never, workspaceId as never).in("status" as never, ["open", "in_progress", "blocked"] as never) as never),
        maybeCount(supabase.from("workspace_work_items" as never).select("id" as never, { count: "exact", head: true }).eq("workspace_id" as never, workspaceId as never).eq("priority" as never, "urgent" as never).in("status" as never, ["open", "in_progress", "blocked"] as never) as never),
        maybeCount(supabase.from("workspace_work_items" as never).select("id" as never, { count: "exact", head: true }).eq("workspace_id" as never, workspaceId as never).lt("due_at" as never, now as never).in("status" as never, ["open", "in_progress", "blocked"] as never) as never),
        maybeCount(supabase.from("workspace_integrations" as never).select("id" as never, { count: "exact", head: true }).eq("workspace_id" as never, workspaceId as never).eq("status" as never, "failing" as never) as never),
        maybeCount(supabase.from("workspace_integrations" as never).select("id" as never, { count: "exact", head: true }).eq("workspace_id" as never, workspaceId as never).eq("status" as never, "degraded" as never) as never),
        maybeCount(supabase.from("workspace_workflow_rules" as never).select("id" as never, { count: "exact", head: true }).eq("workspace_id" as never, workspaceId as never).eq("is_enabled" as never, true as never) as never),
        maybeCount(supabase.from("workspace_workflow_runs" as never).select("id" as never, { count: "exact", head: true }).eq("workspace_id" as never, workspaceId as never).eq("status" as never, "failed" as never) as never),
    ]);

    return {
        customers: {
            total: totalCustomers,
            active: activeCustomers,
            leads: leadCustomers,
        },
        work: {
            open: openWork,
            urgent: urgentWork,
            overdue: overdueWork,
        },
        integrations: {
            failing: failingIntegrations,
            degraded: degradedIntegrations,
        },
        automation: {
            enabledRules,
            failedRuns,
        },
    };
}

export async function upsertCustomerForSignal(input: {
    supabase: SupabaseLike;
    workspaceId: string;
    displayName: string;
    email?: string | null;
    phone?: string | null;
    portalClientId?: string | null;
    sourceModule: string;
    lifecycleStatus?: BusinessLifecycleStatus;
    metadata?: Record<string, unknown>;
}): Promise<string | null> {
    try {
        const normalizedEmail = input.email?.trim().toLowerCase() || null;
        if (input.portalClientId) {
            const { data: existing } = await input.supabase
                .from("workspace_customers" as never)
                .select("id,lifecycle_status,display_name,primary_email,primary_phone,portal_client_id,metadata" as never)
                .eq("workspace_id" as never, input.workspaceId as never)
                .eq("portal_client_id" as never, input.portalClientId as never)
                .maybeSingle() as unknown as { data: ExistingCustomerRow | null; error: unknown };
            if (existing?.id) {
                await updateExistingCustomerForSignal(input.supabase, existing, input);
                return existing.id;
            }
        }

        if (normalizedEmail) {
            const { data: existing } = await input.supabase
                .from("workspace_customers" as never)
                .select("id,lifecycle_status,display_name,primary_email,primary_phone,portal_client_id,metadata" as never)
                .eq("workspace_id" as never, input.workspaceId as never)
                .eq("primary_email" as never, normalizedEmail as never)
                .maybeSingle() as unknown as { data: ExistingCustomerRow | null; error: unknown };
            if (existing?.id) {
                await updateExistingCustomerForSignal(input.supabase, existing, input);
                return existing.id;
            }
        }

        const { data, error } = await input.supabase
            .from("workspace_customers" as never)
            .insert({
                workspace_id: input.workspaceId,
                display_name: input.displayName.trim() || normalizedEmail || "Unknown customer",
                lifecycle_status: input.lifecycleStatus ?? "lead",
                primary_email: normalizedEmail,
                primary_phone: input.phone ?? null,
                portal_client_id: input.portalClientId ?? null,
                source_module: input.sourceModule,
                metadata: (input.metadata ?? {}) as Json,
            } as never)
            .select("id" as never)
            .single() as unknown as { data: { id: string } | null; error: { message: string } | null };
        if (error) {
            console.warn("[business-spine] customer upsert failed", error.message);
            return null;
        }
        return data?.id ?? null;
    } catch (error) {
        console.warn("[business-spine] customer upsert failed", error);
        return null;
    }
}

export async function recordTimelineEvent(input: {
    supabase: SupabaseLike;
    workspaceId: string;
    customerId: string | null;
    eventType: string;
    summary: string;
    sourceModule: string;
    sourceTable?: string | null;
    sourceId?: string | null;
    idempotencyKey: string;
    actorType?: string;
    payload?: Record<string, unknown>;
}): Promise<void> {
    if (!input.customerId) return;
    try {
        const { error } = await input.supabase
            .from("workspace_customer_timeline_events" as never)
            .upsert({
                workspace_id: input.workspaceId,
                customer_id: input.customerId,
                event_type: input.eventType,
                summary: input.summary,
                actor_type: input.actorType ?? "system",
                source_module: input.sourceModule,
                source_table: input.sourceTable ?? null,
                source_id: input.sourceId ?? null,
                idempotency_key: input.idempotencyKey,
                payload: (input.payload ?? {}) as Json,
            } as never, { onConflict: "workspace_id,idempotency_key" } as never);
        if (error) console.warn("[business-spine] timeline write failed", error.message);
    } catch (error) {
        console.warn("[business-spine] timeline write failed", error);
    }
}

export async function upsertWorkItem(input: {
    supabase: SupabaseLike;
    workspaceId: string;
    customerId?: string | null;
    title: string;
    description?: string | null;
    kind: string;
    priority?: BusinessWorkItemPriority;
    sourceModule: string;
    sourceEntityType: string;
    sourceEntityId: string;
    idempotencyKey: string;
    dueAt?: string | null;
    metadata?: Record<string, unknown>;
}): Promise<void> {
    try {
        const { error } = await input.supabase
            .from("workspace_work_items" as never)
            .upsert({
                workspace_id: input.workspaceId,
                customer_id: input.customerId ?? null,
                title: input.title,
                description: input.description ?? null,
                kind: input.kind,
                status: "open",
                priority: input.priority ?? "normal",
                due_at: input.dueAt ?? null,
                source_module: input.sourceModule,
                source_entity_type: input.sourceEntityType,
                source_entity_id: input.sourceEntityId,
                idempotency_key: input.idempotencyKey,
                metadata: (input.metadata ?? {}) as Json,
            } as never, { onConflict: "workspace_id,idempotency_key" } as never);
        if (error) console.warn("[business-spine] work item write failed", error.message);
    } catch (error) {
        console.warn("[business-spine] work item write failed", error);
    }
}

export async function recordBookingBusinessEvent(input: {
    supabase: SupabaseLike;
    workspaceId: string;
    reservationId: string;
    status: string;
    customerName?: string | null;
    customerEmail?: string | null;
    customerPhone?: string | null;
    portalClientId?: string | null;
    scheduledStart?: string | null;
    source?: "public_flow" | "operator" | "payment";
    serviceKey?: string | null;
    paymentStatus?: string | null;
    engagementStarted?: boolean;
}): Promise<void> {
    type ReservationFacts = {
        booking_services: { service_key: string | null } | null;
        booking_payments: Array<{ status: string }> | { status: string } | null;
        customer_full_name: string | null;
        customer_email: string | null;
        customer_phone: string | null;
        portal_client_id: string | null;
    };

    let serviceKey = input.serviceKey ?? null;
    let paymentStatus = input.paymentStatus ?? null;
    let reservationFacts: ReservationFacts | null = null;

    // Resolve commercial facts from the reservation whenever a caller only
    // has the reservation identifier. This keeps lifecycle derivation truthful
    // for racing payment/webhook callbacks and avoids trusting caller-supplied
    // customer objects as the identity source.
    if (!serviceKey || input.paymentStatus === undefined || !input.customerName || !input.customerEmail) {
        const reservationFactsResult = await input.supabase
            .from("booking_reservations" as never)
            .select("booking_services!booking_reservations_workspace_service_fk ( service_key ), booking_payments!booking_payments_workspace_reservation_fk ( status ), customer_full_name, customer_email, customer_phone, portal_client_id" as never)
            .eq("workspace_id" as never, input.workspaceId as never)
            .eq("id" as never, input.reservationId as never)
            .maybeSingle() as unknown as {
                data: ReservationFacts | null;
                error: { message: string } | null;
            };
        if (reservationFactsResult.error) {
            console.warn("[business-spine] booking facts lookup failed", reservationFactsResult.error.message);
        }
        reservationFacts = reservationFactsResult.data;
        serviceKey = serviceKey ?? reservationFacts?.booking_services?.service_key ?? null;
        const paymentRows = reservationFacts?.booking_payments;
        const paymentRow = Array.isArray(paymentRows)
            ? paymentRows.find((row) => row.status === "verified") ?? paymentRows[0]
            : paymentRows;
        paymentStatus = paymentStatus ?? paymentRow?.status ?? null;
    }

    const customerName = input.customerName?.trim() || reservationFacts?.customer_full_name?.trim() || "Booking customer";
    const customerEmail = input.customerEmail?.trim().toLowerCase() || reservationFacts?.customer_email?.trim().toLowerCase() || null;
    const customerPhone = input.customerPhone ?? reservationFacts?.customer_phone ?? null;
    const portalClientId = input.portalClientId ?? reservationFacts?.portal_client_id ?? null;

    const lifecycleStatus = deriveBookingLifecycle({
        status: input.status,
        serviceKey,
        paymentStatus,
        engagementStarted: input.engagementStarted,
    });
    const engagementStarted = input.engagementStarted === true;
    const recorderEventKey = input.status === "pending_review"
        ? "booking.pending_review"
        : input.status === "confirmed"
            ? "booking.confirmed"
            : input.status === "completed"
                ? "booking.completed"
                : input.status === "cancelled_by_customer"
                    || input.status === "cancelled_by_workspace"
                    || input.status === "expired"
                    ? "booking.cancelled"
                    : null;
    const canonicalCustomerId = await resolveCanonicalCustomerId({
        supabase: input.supabase,
        workspaceId: input.workspaceId,
        portalClientId,
        email: customerEmail,
        bookingId: input.reservationId,
    });
    const upsertedCustomerId = customerEmail || portalClientId
        ? await upsertCustomerForSignal({
            supabase: input.supabase,
            workspaceId: input.workspaceId,
            displayName: customerName,
            email: customerEmail,
            phone: customerPhone,
            portalClientId,
            sourceModule: "booking",
            lifecycleStatus,
            metadata: {
                lastReservationId: input.reservationId,
                lastBookingStatus: input.status,
                serviceKey,
                paymentStatus,
                engagementStarted,
            },
        })
        : null;
    const customerId = canonicalCustomerId ?? upsertedCustomerId;

    await recordTimelineEvent({
        supabase: input.supabase,
        workspaceId: input.workspaceId,
        customerId,
        eventType: `booking.${input.status}`,
        summary: `Booking ${input.status.replace(/_/g, " ")}`,
        sourceModule: "booking",
        sourceTable: "booking_reservations",
        sourceId: input.reservationId,
        idempotencyKey: `booking:${input.reservationId}:${input.status}`,
        actorType: input.source ?? "system",
        payload: {
            scheduledStart: input.scheduledStart ?? null,
            lifecycleStatus,
            engagementStarted,
        },
    });

    if (input.status === "pending_review") {
        await upsertWorkItem({
            supabase: input.supabase,
            workspaceId: input.workspaceId,
            customerId,
            title: `Review booking request from ${customerName}`,
            description: input.scheduledStart ? `Requested slot: ${input.scheduledStart}` : null,
            kind: "booking_review",
            priority: "high",
            sourceModule: "booking",
            sourceEntityType: "booking_reservation",
            sourceEntityId: input.reservationId,
            idempotencyKey: `work:booking-review:${input.reservationId}`,
            metadata: {
                customerEmail,
                status: input.status,
            },
        });
    }

    if (input.status === "completed") {
        const followUp = getPostSessionCommercialFollowUpPlan({
            reservationId: input.reservationId,
            customerName,
            completedAt: new Date().toISOString(),
        });
        await upsertWorkItem({
            supabase: input.supabase,
            workspaceId: input.workspaceId,
            customerId,
            title: followUp.title,
            description: "Review the session outcome and choose the governed next step: no-fit close, direct written proposal, or paid Blueprint. Any commercial message requires operator review before sending.",
            kind: followUp.kind,
            priority: followUp.priority,
            dueAt: followUp.dueAt,
            sourceModule: "booking",
            sourceEntityType: "booking_reservation",
            sourceEntityId: input.reservationId,
            idempotencyKey: followUp.idempotencyKey,
            metadata: {
                customerEmail,
                status: input.status,
                requiresHumanApproval: true,
            },
        });
    }

    if (recorderEventKey) {
        await bestEffortWorkflow({
            workspaceId: input.workspaceId,
            sourceModule: "booking",
            recorderEventKey,
            sourceEntityType: "booking_reservation",
            sourceEntityId: input.reservationId,
            payload: {
                reservationId: input.reservationId,
                status: input.status,
                customerName,
                customerEmail,
                scheduledStart: input.scheduledStart ?? null,
                serviceKey,
                paymentStatus,
                lifecycleStatus,
                engagementStarted,
                source: input.source ?? "system",
            },
            idempotencyValues: { reservationId: input.reservationId },
        });
    }
}

export async function recordSlaFlagBusinessEvent(input: {
    supabase: SupabaseLike;
    workspaceId: string;
    portalClientId: string;
    scheduleId: string;
    taskName: string;
    locationName: string;
    customerEmail: string;
    body: string;
}): Promise<void> {
    const customerId = await upsertCustomerForSignal({
        supabase: input.supabase,
        workspaceId: input.workspaceId,
        displayName: input.customerEmail || "Portal client",
        email: input.customerEmail || null,
        portalClientId: input.portalClientId,
        sourceModule: "sla",
        lifecycleStatus: "active",
        metadata: {
            lastSlaTaskId: input.scheduleId,
        },
    });

    await recordTimelineEvent({
        supabase: input.supabase,
        workspaceId: input.workspaceId,
        customerId,
        eventType: "sla.flagged",
        summary: `SLA issue flagged: ${input.taskName}`,
        sourceModule: "sla",
        sourceTable: "workspace_sla_tasks",
        sourceId: input.scheduleId,
        idempotencyKey: `sla-flag:${input.scheduleId}:${Date.now()}`,
        actorType: "portal_client",
        payload: {
            locationName: input.locationName,
            body: input.body,
        },
    });

    await upsertWorkItem({
        supabase: input.supabase,
        workspaceId: input.workspaceId,
        customerId,
        title: `Resolve SLA flag: ${input.taskName}`,
        description: input.body,
        kind: "sla_flag",
        priority: "urgent",
        sourceModule: "sla",
        sourceEntityType: "workspace_sla_task",
        sourceEntityId: input.scheduleId,
        idempotencyKey: `work:sla-flag:${input.scheduleId}`,
        metadata: {
            locationName: input.locationName,
            customerEmail: input.customerEmail,
        },
    });

    await bestEffortWorkflow({
        workspaceId: input.workspaceId,
        sourceModule: "sla",
        recorderEventKey: "sla.flagged",
        sourceEntityType: "workspace_sla_task",
        sourceEntityId: input.scheduleId,
        payload: {
            scheduleId: input.scheduleId,
            portalClientId: input.portalClientId,
            taskName: input.taskName,
            locationName: input.locationName,
            customerEmail: input.customerEmail,
            body: input.body,
        },
        idempotencyValues: { scheduleId: input.scheduleId },
    });
}

export type DuplicateCandidateGroup = {
    reason: string;
    customers: BusinessCustomer[];
};

export async function getDuplicateCandidates(workspaceId: string): Promise<DuplicateCandidateGroup[]> {
    const supabase = await createClient();
    const { data: rows, error } = await supabase
        .from("workspace_customers" as never)
        .select("*" as never)
        .eq("workspace_id" as never, workspaceId as never)
        .is("deleted_at" as never, null as never) as unknown as { data: CustomerRow[] | null; error: { message: string } | null };

    if (error || !rows) return [];

    const byEmail = new Map<string, CustomerRow[]>();
    const byPortalClient = new Map<string, CustomerRow[]>();

    for (const row of rows) {
        if (row.primary_email) {
            const list = byEmail.get(row.primary_email) ?? [];
            list.push(row);
            byEmail.set(row.primary_email, list);
        }
        if (row.portal_client_id) {
            const list = byPortalClient.get(row.portal_client_id) ?? [];
            list.push(row);
            byPortalClient.set(row.portal_client_id, list);
        }
    }

    const groups: DuplicateCandidateGroup[] = [];
    const emittedCandidateIds = new Set<string>();

    for (const [email, groupRows] of byEmail.entries()) {
        if (groupRows.length > 1) {
            groups.push({ reason: `Matching email: ${email}`, customers: groupRows.map(mapCustomer) });
            for (const r of groupRows) emittedCandidateIds.add(r.id);
        }
    }
    for (const [portalClientId, groupRows] of byPortalClient.entries()) {
        if (groupRows.length > 1) {
            const unEmitted = groupRows.filter((r) => !emittedCandidateIds.has(r.id));
            if (unEmitted.length > 0) {
                groups.push({ reason: `Matching portal client: ${portalClientId}`, customers: groupRows.map(mapCustomer) });
                for (const r of groupRows) emittedCandidateIds.add(r.id);
            }
        }
    }

    return groups;
}

export async function mergeBusinessCustomers(
    workspaceId: string,
    sourceCustomerId: string,
    targetCustomerId: string
): Promise<{ ok: boolean; message: string }> {
    const supabase = await createClient();

    await supabase.from("workspace_work_items" as never)
        .update({ customer_id: targetCustomerId } as never)
        .eq("workspace_id" as never, workspaceId as never)
        .eq("customer_id" as never, sourceCustomerId as never);

    await supabase.from("workspace_customer_timeline_events" as never)
        .update({ customer_id: targetCustomerId } as never)
        .eq("workspace_id" as never, workspaceId as never)
        .eq("customer_id" as never, sourceCustomerId as never);

    await supabase.from("workspace_commercial_links" as never)
        .update({ customer_id: targetCustomerId } as never)
        .eq("workspace_id" as never, workspaceId as never)
        .eq("customer_id" as never, sourceCustomerId as never);

    const { error } = await supabase.from("workspace_customers" as never)
        .update({
            deleted_at: new Date().toISOString(),
            merged_into_id: targetCustomerId
        } as never)
        .eq("workspace_id" as never, workspaceId as never)
        .eq("id" as never, sourceCustomerId as never);

    if (error) return { ok: false, message: error.message };

    await recordTimelineEvent({
        supabase,
        workspaceId,
        customerId: targetCustomerId,
        eventType: "customer.merged",
        summary: "Merged duplicate customer record",
        sourceModule: "dashboard",
        idempotencyKey: `merge:${sourceCustomerId}:${targetCustomerId}:${Date.now()}`,
        payload: { sourceCustomerId }
    });

    return { ok: true, message: "Customers merged successfully." };
}
