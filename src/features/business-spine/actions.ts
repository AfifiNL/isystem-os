"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import type { Json } from "@/shared/lib/supabase/database.types";
import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { recordBusinessIntegrationHealthCheck, upsertBusinessIntegrationRegistry } from "@/features/business-spine/integrations";
import { validateWorkflowRulePreview } from "@/features/business-spine/workflow-engine";
import { resumeWorkflowRun } from "@/features/business-spine/workflow-service";
import { buildWorkflowRuleWritePayload, buildWorkflowTemplateRuleRows, formatWorkflowRuleSchemaError } from "@/features/business-spine/workflow-templates";
import { buildCustomerNoteTimelinePayload, validateBusinessLifecycleStatus } from "@/features/business-spine/account-record";
import type { BusinessIntegrationStatus } from "@/features/business-spine/health";
import type { BusinessWorkItemPriority, BusinessWorkItemStatus } from "@/features/business-spine/types";

type ActionState = {
    ok: boolean;
    message: string;
};

type WorkflowRuleExistingRow = {
    id: string;
    metadata: Json | null;
};

const WORK_STATUSES = new Set<BusinessWorkItemStatus>(["open", "in_progress", "blocked", "done", "dismissed"]);
const WORK_PRIORITIES = new Set<BusinessWorkItemPriority>(["low", "normal", "high", "urgent"]);
const HEALTH_STATUSES = new Set<BusinessIntegrationStatus>(["healthy", "degraded", "failing", "unknown", "disabled"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(formData: FormData, key: string) {
    const value = formData.get(key);
    return typeof value === "string" ? value.trim() : "";
}

function nullableText(formData: FormData, key: string) {
    const value = text(formData, key);
    return value.length > 0 ? value : null;
}

function uuidOrNull(formData: FormData, key: string) {
    const value = nullableText(formData, key);
    return value && UUID_RE.test(value) ? value : null;
}

function revalidateCustomerPaths(customerId: string) {
    revalidatePath("/dashboard/customers");
    revalidatePath(`/dashboard/customers/${customerId}`);
}

function checkbox(formData: FormData, key: string) {
    return formData.get(key) === "on" || formData.get(key) === "true";
}

function parseJsonField(formData: FormData, key: string): { ok: true; value: unknown } | { ok: false; message: string } {
    const raw = text(formData, key);
    if (!raw) return { ok: true, value: {} };
    try {
        return { ok: true, value: JSON.parse(raw) as unknown };
    } catch (error) {
        return {
            ok: false,
            message: `${key} is not valid JSON: ${error instanceof Error ? error.message : "parse failed"}`,
        };
    }
}

export async function updateBusinessWorkItemAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
    const state = await requireDashboardModuleAccess("work");
    const workItemId = text(formData, "workItemId");
    if (!workItemId) return { ok: false, message: "Missing work item id." };

    const statusRaw = text(formData, "status") as BusinessWorkItemStatus;
    const priorityRaw = text(formData, "priority") as BusinessWorkItemPriority;
    const status = WORK_STATUSES.has(statusRaw) ? statusRaw : "open";
    const priority = WORK_PRIORITIES.has(priorityRaw) ? priorityRaw : "normal";
    const assignedTo = nullableText(formData, "assignedToProfileId");
    const dueAt = nullableText(formData, "dueAt");
    const snoozedUntil = nullableText(formData, "snoozedUntil");

    const supabase = await createClient();

    // Fetch the work item to check if it's a workflow approval being completed
    const { data: currentItem } = await supabase
        .from("workspace_work_items" as never)
        .select("kind, status, metadata" as never)
        .eq("workspace_id" as never, state.workspace.id as never)
        .eq("id" as never, workItemId as never)
        .maybeSingle() as unknown as { data: { kind: string; status: string; metadata: Record<string, unknown> } | null };

    const { error } = await supabase
        .from("workspace_work_items" as never)
        .update({
            status,
            priority,
            assigned_to_profile_id: assignedTo,
            due_at: dueAt,
            snoozed_until: snoozedUntil,
            completed_at: status === "done" || status === "dismissed" ? new Date().toISOString() : null,
        } as never)
        .eq("workspace_id" as never, state.workspace.id as never)
        .eq("id" as never, workItemId as never);

    if (error) return { ok: false, message: error.message };

    // Trigger workflow resumption if it was a workflow_approval that just became 'done'
    if (currentItem?.kind === "workflow_approval" && currentItem.status !== "done" && status === "done") {
        const runId = typeof currentItem.metadata?.workflow_run_id === "string" ? currentItem.metadata.workflow_run_id : null;
        if (runId) {
            // We run it synchronously so we don't return until it's queued or done,
            // but we wrap in a catch block so the work item update still succeeds even if run fails.
            try {
                await resumeWorkflowRun(runId);
            } catch (err) {
                console.error("Failed to resume workflow run", err);
            }
        }
    }

    revalidatePath("/dashboard/work");
    if (text(formData, "customerId")) revalidatePath(`/dashboard/customers/${text(formData, "customerId")}`);
    return { ok: true, message: "Work item updated." };
}

export async function updateBusinessWorkItemFormAction(formData: FormData): Promise<void> {
    await updateBusinessWorkItemAction({ ok: false, message: "" }, formData);
}

export async function assignBusinessCustomerOwnerAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
    const state = await requireDashboardModuleAccess("customers");
    const customerId = text(formData, "customerId");
    if (!customerId) return { ok: false, message: "Missing customer id." };

    const rawOwner = nullableText(formData, "ownerProfileId");
    if (rawOwner && !UUID_RE.test(rawOwner)) return { ok: false, message: "Owner profile id must be a valid UUID." };

    const supabase = await createClient();
    const { error } = await supabase
        .from("workspace_customers" as never)
        .update({ owner_profile_id: rawOwner } as never)
        .eq("workspace_id" as never, state.workspace.id as never)
        .eq("id" as never, customerId as never)
        .is("deleted_at" as never, null as never);

    if (error) return { ok: false, message: error.message };
    revalidateCustomerPaths(customerId);
    return { ok: true, message: rawOwner ? "Customer owner updated." : "Customer owner cleared." };
}

export async function assignBusinessCustomerOwnerFormAction(formData: FormData): Promise<void> {
    await assignBusinessCustomerOwnerAction({ ok: false, message: "" }, formData);
}

export async function transitionBusinessCustomerLifecycleAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
    const state = await requireDashboardModuleAccess("customers");
    const customerId = text(formData, "customerId");
    const lifecycleStatus = validateBusinessLifecycleStatus(text(formData, "lifecycleStatus"));
    if (!customerId) return { ok: false, message: "Missing customer id." };
    if (!lifecycleStatus) return { ok: false, message: "Invalid customer lifecycle status." };

    const supabase = await createClient();
    const { error } = await supabase
        .from("workspace_customers" as never)
        .update({ lifecycle_status: lifecycleStatus } as never)
        .eq("workspace_id" as never, state.workspace.id as never)
        .eq("id" as never, customerId as never)
        .is("deleted_at" as never, null as never);

    if (error) return { ok: false, message: error.message };
    revalidateCustomerPaths(customerId);
    return { ok: true, message: "Customer lifecycle updated." };
}

export async function transitionBusinessCustomerLifecycleFormAction(formData: FormData): Promise<void> {
    await transitionBusinessCustomerLifecycleAction({ ok: false, message: "" }, formData);
}

export async function addBusinessCustomerNoteAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
    const state = await requireDashboardModuleAccess("customers");
    const customerId = text(formData, "customerId");
    const note = text(formData, "note");
    if (!customerId) return { ok: false, message: "Missing customer id." };
    if (note.length < 2) return { ok: false, message: "Note must be at least 2 characters." };
    if (note.length > 4000) return { ok: false, message: "Note must be 4,000 characters or fewer." };

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const authorProfileId = user?.id ?? null;
    const payload = buildCustomerNoteTimelinePayload({ note, authorProfileId });
    const timestamp = new Date().toISOString();
    const idempotencyKey = `customer-note:${customerId}:${authorProfileId ?? "unknown"}:${timestamp}`;

    const { error } = await supabase
        .from("workspace_customer_timeline_events" as never)
        .insert({
            workspace_id: state.workspace.id,
            customer_id: customerId,
            occurred_at: timestamp,
            event_type: payload.eventType,
            summary: payload.summary,
            body: payload.body,
            actor_profile_id: authorProfileId,
            actor_type: payload.actorType,
            source_module: payload.sourceModule,
            source_table: "workspace_customers",
            source_id: uuidOrNull(formData, "customerId"),
            visibility: payload.visibility,
            idempotency_key: idempotencyKey,
            payload: payload.payload,
        } as never);

    if (error) return { ok: false, message: error.message };
    revalidateCustomerPaths(customerId);
    return { ok: true, message: "Customer note added." };
}

export async function addBusinessCustomerNoteFormAction(formData: FormData): Promise<void> {
    await addBusinessCustomerNoteAction({ ok: false, message: "" }, formData);
}

export async function recordManualIntegrationEvidenceAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
    await requireDashboardModuleAccess("health");
    const workspaceId = text(formData, "workspaceId");
    const provider = text(formData, "provider");
    const integrationKey = text(formData, "integrationKey");
    const statusRaw = text(formData, "status") as BusinessIntegrationStatus;
    const status = HEALTH_STATUSES.has(statusRaw) ? statusRaw : "unknown";
    const message = text(formData, "message") || "Manual operator evidence recorded.";
    const evidenceUrl = nullableText(formData, "evidenceUrl");
    const evidenceRef = nullableText(formData, "evidenceRef");
    const checkedBy = nullableText(formData, "checkedBy");

    if (!workspaceId || !provider || !integrationKey) {
        return { ok: false, message: "Missing evidence target." };
    }

    const result = await recordBusinessIntegrationHealthCheck({
        workspaceId,
        provider,
        integrationKey,
        status,
        message,
        details: {
            evidenceUrl,
            evidenceRef,
            checkedBy,
            source: "manual_admin_evidence",
        },
    });

    revalidatePath("/dashboard/health");
    return result.ok
        ? { ok: true, message: "Evidence recorded." }
        : { ok: false, message: result.error ?? "Evidence write failed." };
}

export async function recordManualIntegrationEvidenceFormAction(formData: FormData): Promise<void> {
    await recordManualIntegrationEvidenceAction({ ok: false, message: "" }, formData);
}

export async function saveWorkflowRuleAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
    const state = await requireDashboardModuleAccess("automations");
    if (state.role !== "admin" && !state.capabilities.includes("workflow.manage")) {
        return { ok: false, message: "Missing workflow.manage capability." };
    }
    const ruleId = nullableText(formData, "ruleId");
    const name = text(formData, "name");
    const triggerKey = text(formData, "triggerKey");
    const condition = parseJsonField(formData, "conditionJson");
    const actions = parseJsonField(formData, "actionJson");
    if (!name || !triggerKey) return { ok: false, message: "Rule name and trigger are required." };
    if (!condition.ok) return { ok: false, message: condition.message };
    if (!actions.ok) return { ok: false, message: actions.message };

    const preview = validateWorkflowRulePreview({
        triggerKey,
        conditionJson: condition.value,
        actionJson: actions.value,
        sampleSourceModule: "dashboard",
    });
    if (!preview.ok) return { ok: false, message: preview.errors.join("; ") };

    const supabase = await createClient();
    let existingRule: WorkflowRuleExistingRow | null = null;
    if (ruleId) {
        const { data, error } = await supabase
            .from("workspace_workflow_rules" as never)
            .select("id,metadata" as never)
            .eq("workspace_id" as never, state.workspace.id as never)
            .eq("id" as never, ruleId as never)
            .maybeSingle() as unknown as { data: WorkflowRuleExistingRow | null; error: { message: string } | null };

        if (error) return { ok: false, message: error.message };
        if (!data) return { ok: false, message: "Workflow rule not found for this workspace." };
        existingRule = data;
    }

    const payload = buildWorkflowRuleWritePayload({
        workspaceId: state.workspace.id,
        name,
        triggerKey,
        isEnabled: checkbox(formData, "isEnabled"),
        requiresApproval: checkbox(formData, "requiresApproval"),
        conditionJson: condition.value,
        actionJson: actions.value,
        killSwitch: checkbox(formData, "killSwitch"),
        existingMetadata: existingRule?.metadata,
    });

    const query = ruleId
        ? supabase
            .from("workspace_workflow_rules" as never)
            .update(payload as never)
            .eq("workspace_id" as never, state.workspace.id as never)
            .eq("id" as never, ruleId as never)
        : supabase
            .from("workspace_workflow_rules" as never)
            .insert(payload as never);
    const { error } = await query;
    if (error) return { ok: false, message: formatWorkflowRuleSchemaError(error) };
    revalidatePath("/dashboard/automations");
    return { ok: true, message: ruleId ? "Rule updated." : "Rule created." };
}

export async function setWorkflowRuleEnabledAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
    const state = await requireDashboardModuleAccess("automations");
    if (state.role !== "admin" && !state.capabilities.includes("workflow.manage")) {
        return { ok: false, message: "Missing workflow.manage capability." };
    }

    const ruleId = nullableText(formData, "ruleId");
    if (!ruleId) return { ok: false, message: "Missing workflow rule id." };

    const supabase = await createClient();
    const { error } = await supabase
        .from("workspace_workflow_rules" as never)
        .update({ is_enabled: checkbox(formData, "isEnabled") } as never)
        .eq("workspace_id" as never, state.workspace.id as never)
        .eq("id" as never, ruleId as never);

    if (error) return { ok: false, message: formatWorkflowRuleSchemaError(error) };
    revalidatePath("/dashboard/automations");
    return { ok: true, message: checkbox(formData, "isEnabled") ? "Rule enabled." : "Rule disabled." };
}

export async function setWorkflowRuleEnabledFormAction(formData: FormData): Promise<void> {
    await setWorkflowRuleEnabledAction({ ok: false, message: "" }, formData);
}

export async function saveWorkflowRuleFormAction(formData: FormData): Promise<void> {
    await saveWorkflowRuleAction({ ok: false, message: "" }, formData);
}

export async function installWorkflowTemplatesAction(): Promise<ActionState> {
    const state = await requireDashboardModuleAccess("automations");
    const supabase = await createClient();
    const rows = buildWorkflowTemplateRuleRows(state.workspace.id);
    const { data: existing, error: existingError } = await supabase
        .from("workspace_workflow_rules" as never)
        .select("trigger_key,metadata" as never)
        .eq("workspace_id" as never, state.workspace.id as never) as unknown as {
            data: Array<{ trigger_key: string; metadata: Json }> | null;
            error: { message: string } | null;
        };
    if (existingError) return { ok: false, message: existingError.message };

    const existingTemplateIds = new Set(
        (existing ?? [])
            .map((rule) => rule.metadata && typeof rule.metadata === "object" && !Array.isArray(rule.metadata) ? rule.metadata.installed_template : null)
            .filter((templateId): templateId is string => typeof templateId === "string" && templateId.length > 0),
    );
    const existingTriggerKeys = new Set((existing ?? []).map((rule) => rule.trigger_key));
    const rowsToInsert = rows.filter((row) => !existingTemplateIds.has(row.metadata.installed_template) && !existingTriggerKeys.has(row.trigger_key));
    const skippedCount = rows.length - rowsToInsert.length;

    if (rowsToInsert.length === 0) {
        revalidatePath("/dashboard/automations");
        return { ok: true, message: `No new workflow templates needed. ${skippedCount} template${skippedCount === 1 ? "" : "s"} already installed or covered by existing trigger rules.` };
    }

    const { error } = await supabase
        .from("workspace_workflow_rules" as never)
        .insert(rowsToInsert.map((row) => ({ ...row, metadata: row.metadata as Json })) as never);
    if (error) return { ok: false, message: formatWorkflowRuleSchemaError(error) };
    revalidatePath("/dashboard/automations");
    return {
        ok: true,
        message: `${rowsToInsert.length} workflow template${rowsToInsert.length === 1 ? "" : "s"} installed disabled for review.${skippedCount > 0 ? ` ${skippedCount} already installed or covered by existing trigger rules.` : ""}`,
    };
}

export async function installWorkflowTemplatesStateAction(): Promise<ActionState> {
    return installWorkflowTemplatesAction();
}

export async function installWorkflowTemplatesFormAction(): Promise<ActionState> {
    return installWorkflowTemplatesAction();
}

export async function syncBusinessIntegrationRegistryAction(): Promise<ActionState> {
    const state = await requireDashboardModuleAccess("integrations");
    const result = await upsertBusinessIntegrationRegistry(state.workspace.id);

    if (!result.ok) {
        return { ok: false, message: result.error ?? "Failed to sync integrations registry." };
    }

    revalidatePath("/dashboard/integrations");
    revalidatePath("/dashboard/health");
    return { ok: true, message: "Integrations configuration synced." };
}

export async function syncBusinessIntegrationRegistryFormAction(): Promise<void> {
    await syncBusinessIntegrationRegistryAction();
}

import { mergeBusinessCustomers } from "@/features/business-spine/service";

export async function mergeBusinessCustomersAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
    const state = await requireDashboardModuleAccess("customers");
    const sourceCustomerId = text(formData, "sourceCustomerId");
    const targetCustomerId = text(formData, "targetCustomerId");

    if (!sourceCustomerId || !targetCustomerId) {
        return { ok: false, message: "Source and target customer IDs are required." };
    }
    if (sourceCustomerId === targetCustomerId) {
        return { ok: false, message: "Cannot merge a customer into itself." };
    }

    const result = await mergeBusinessCustomers(state.workspace.id, sourceCustomerId, targetCustomerId);

    if (result.ok) {
        revalidatePath("/dashboard/customers");
        revalidatePath(`/dashboard/customers/${targetCustomerId}`);
        revalidatePath(`/dashboard/customers/${sourceCustomerId}`);
    }
    return result;
}

export async function mergeBusinessCustomersFormAction(formData: FormData): Promise<void> {
    await mergeBusinessCustomersAction({ ok: false, message: "" }, formData);
}
