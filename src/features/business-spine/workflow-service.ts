import "server-only";

import { createAdminClient } from "@/shared/lib/supabase/admin";
import { createClient } from "@/shared/lib/supabase/server";
import type { Json } from "@/shared/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/shared/lib/resend/send-email";
import { recordBusinessIntegrationEvent } from "@/features/business-spine/integrations";
import { enqueueContentTranslationJob } from "@/features/blog/translation-jobs";
import {
    evaluateWorkflowCondition,
    normalizeWorkflowActions,
    getWorkflowWorkerRuntimeRegistry,
    type WorkflowAction,
    type WorkflowEventContext,
} from "@/features/business-spine/workflow-engine";
import {
    buildWorkflowRuleHealthCards,
    type WorkflowRuleHealthCard,
    type WorkflowRuleHealthCardEventRow,
    type WorkflowRuleHealthCardRuleRow,
    type WorkflowRuleHealthCardRunRow,
} from "@/features/business-spine/workflow-health";
import {
    buildWorkflowAwaitingApprovalSummary,
    buildWorkflowResumedApprovalSummary,
    deriveWorkflowRunPosture,
    isWorkflowRunAwaitingApproval,
    WORKFLOW_APPROVAL_AWAITING_STATUS,
} from "@/features/business-spine/workflow-posture";

type SupabaseLike = SupabaseClient;

type WorkflowRuleRow = {
    id: string;
    workspace_id: string;
    name: string;
    trigger_key: string;
    is_enabled: boolean;
    requires_approval: boolean;
    condition_json: unknown;
    action_json: unknown;
    metadata: unknown;
};

type WorkflowRunRow = {
    id: string;
    workspace_id: string;
    rule_id: string | null;
    event_id: string | null;
    work_item_id: string | null;
    status: "queued" | "running" | "completed" | "failed" | "cancelled" | "retrying";
    attempts: number;
    max_attempts: number;
    trigger_payload: unknown;
    result_summary: unknown;
    error_message: string | null;
    created_at: string;
    updated_at: string;
};

type WorkflowEventRow = {
    id: string;
    workspace_id: string;
    event_key: string;
    source_module: string;
    source_entity_type: string | null;
    source_entity_id: string | null;
    payload: unknown;
    idempotency_key: string;
    created_at: string;
};

export type WorkflowAutomationSummary = {
    available: boolean;
    events: {
        total: number;
        recentByKey: Array<{
            eventKey: string;
            count: number;
            latestAt: string;
        }>;
        recent: Array<{
            id: string;
            eventKey: string;
            sourceModule: string;
            createdAt: string;
        }>;
    };
    rules: {
        total: number;
        enabled: number;
        requiresApproval: number;
        healthCards: WorkflowRuleHealthCard[];
        recent: Array<{
            id: string;
            name: string;
            triggerKey: string;
            isEnabled: boolean;
            requiresApproval: boolean;
            updatedAt: string;
        }>;
    };
    runs: {
        queued: number;
        running: number;
        failed: number;
        awaitingApproval: number;
        recent: Array<{
            id: string;
            status: string;
            posture: string;
            attempts: number;
            maxAttempts: number;
            errorMessage: string | null;
            updatedAt: string;
        }>;
    };
};

export type DispatchWorkflowEventInput = {
    workspaceId: string;
    eventKey: string;
    sourceModule: string;
    sourceEntityType?: string | null;
    sourceEntityId?: string | null;
    payload?: Record<string, unknown>;
    idempotencyKey: string;
    runImmediately?: boolean;
};

type DispatchResult = {
    eventId: string | null;
    matchedRules: number;
    enqueuedRuns: number;
    failedRules: number;
    skippedRules: number;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeUuid(value: string | null | undefined): string | null {
    return value && UUID_RE.test(value) ? value : null;
}

function isMissingRelationError(error: { code?: string; message?: string } | null | undefined) {
    return error?.code === "42P01" || /relation .* does not exist/i.test(error?.message ?? "");
}

async function maybeCount(query: PromiseLike<{ count: number | null; error: { code?: string; message: string } | null }>) {
    const { count, error } = await query;
    if (error) {
        if (isMissingRelationError(error)) return { available: false, count: 0 };
        return { available: true, count: 0 };
    }
    return { available: true, count: count ?? 0 };
}

async function maybeRows<T>(query: PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>) {
    const { data, error } = await query;
    if (error) {
        return { available: !isMissingRelationError(error), rows: [] as T[] };
    }
    return { available: true, rows: Array.isArray(data) ? data as T[] : [] };
}

function composeRunIdempotencyKey(ruleId: string, eventId: string) {
    return `workflow-run:${ruleId}:${eventId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWorkflowRuleKilled(rule: Pick<WorkflowRuleRow, "metadata">) {
    if (!isRecord(rule.metadata)) return false;
    return rule.metadata.kill_switch === true || rule.metadata.killSwitch === true;
}

async function logWorkflowEvent(input: {
    supabase: SupabaseLike;
    workspaceId: string;
    eventKey: string;
    sourceModule?: string;
    sourceEntityType?: string | null;
    sourceEntityId?: string | null;
    idempotencyKey: string;
    payload?: Record<string, unknown>;
}) {
    await input.supabase
        .from("workspace_workflow_events" as never)
        .upsert({
            workspace_id: input.workspaceId,
            event_key: input.eventKey,
            source_module: input.sourceModule ?? "workflow",
            source_entity_type: input.sourceEntityType ?? null,
            source_entity_id: safeUuid(input.sourceEntityId),
            idempotency_key: input.idempotencyKey,
            payload: (input.payload ?? {}) as Json,
        } as never, { onConflict: "workspace_id,idempotency_key", ignoreDuplicates: true } as never);
}

async function findOrCreateWorkflowEvent(input: DispatchWorkflowEventInput, supabase: SupabaseLike): Promise<WorkflowEventRow | null> {
    const payload = input.payload ?? {};
    const { data: inserted, error: insertError } = await supabase
        .from("workspace_workflow_events" as never)
        .upsert({
            workspace_id: input.workspaceId,
            event_key: input.eventKey,
            source_module: input.sourceModule,
            source_entity_type: input.sourceEntityType ?? null,
            source_entity_id: safeUuid(input.sourceEntityId),
            payload: payload as Json,
            idempotency_key: input.idempotencyKey,
        } as never, { onConflict: "workspace_id,idempotency_key", ignoreDuplicates: true } as never)
        .select("id,workspace_id,event_key,source_module,source_entity_type,source_entity_id,payload,idempotency_key,created_at" as never)
        .maybeSingle() as unknown as { data: WorkflowEventRow | null; error: { message: string } | null };

    if (inserted?.id) return inserted;
    if (insertError && !insertError.message.toLowerCase().includes("duplicate")) {
        throw new Error(`Failed to write workflow event: ${insertError.message}`);
    }

    const { data: existing, error: existingError } = await supabase
        .from("workspace_workflow_events" as never)
        .select("id,workspace_id,event_key,source_module,source_entity_type,source_entity_id,payload,idempotency_key,created_at" as never)
        .eq("workspace_id" as never, input.workspaceId as never)
        .eq("idempotency_key" as never, input.idempotencyKey as never)
        .maybeSingle() as unknown as { data: WorkflowEventRow | null; error: { message: string } | null };

    if (existingError) throw new Error(`Failed to load workflow event: ${existingError.message}`);
    return existing;
}

function eventContextFromRow(row: WorkflowEventRow): WorkflowEventContext {
    return {
        eventKey: row.event_key,
        sourceModule: row.source_module,
        sourceEntityType: row.source_entity_type,
        sourceEntityId: row.source_entity_id,
        payload: row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
            ? row.payload as Record<string, unknown>
            : {},
    };
}

async function insertWorkflowRun(input: {
    supabase: SupabaseLike;
    workspaceId: string;
    rule: WorkflowRuleRow;
    event: WorkflowEventRow;
    status: "queued" | "failed";
    errorMessage?: string | null;
    resultSummary?: Record<string, unknown>;
}) {
    const { error } = await input.supabase
        .from("workspace_workflow_runs" as never)
        .upsert({
            workspace_id: input.workspaceId,
            rule_id: input.rule.id,
            event_id: input.event.id,
            status: input.status,
            max_attempts: 3,
            idempotency_key: composeRunIdempotencyKey(input.rule.id, input.event.id),
            trigger_payload: {
                event: eventContextFromRow(input.event),
                rule: {
                    id: input.rule.id,
                    name: input.rule.name,
                    triggerKey: input.rule.trigger_key,
                    requiresApproval: input.rule.requires_approval,
                },
            } as Json,
            result_summary: (input.resultSummary ?? {}) as Json,
            error_message: input.errorMessage ?? null,
            completed_at: input.status === "failed" ? new Date().toISOString() : null,
        } as never, { onConflict: "workspace_id,idempotency_key", ignoreDuplicates: true } as never);

    if (error && !error.message.toLowerCase().includes("duplicate")) {
        throw new Error(`Failed to enqueue workflow run: ${error.message}`);
    }
}

async function markRun(input: {
    supabase: SupabaseLike;
    runId: string;
    workspaceId: string;
    status: WorkflowRunRow["status"];
    resultSummary?: Record<string, unknown>;
    errorMessage?: string | null;
    workItemId?: string | null;
    runAfter?: string;
}) {
    const updateData: Record<string, unknown> = {
        status: input.status,
        result_summary: (input.resultSummary ?? {}) as Json,
        error_message: input.errorMessage ?? null,
        work_item_id: input.workItemId ?? null,
        completed_at: ["completed", "failed", "cancelled"].includes(input.status) ? new Date().toISOString() : null,
    };
    if (input.runAfter) {
        updateData.run_after = input.runAfter;
    }

    await input.supabase
        .from("workspace_workflow_runs" as never)
        .update(updateData as never)
        .eq("workspace_id" as never, input.workspaceId as never)
        .eq("id" as never, input.runId as never);
}

async function createWorkItemForAction(input: {
    supabase: SupabaseLike;
    workspaceId: string;
    runId: string;
    action: Extract<WorkflowAction, { type: "create_work_item" }> | Extract<WorkflowAction, { type: "request_approval" }>;
    actionIndex: number;
}) {
    const sourceEntityId = input.action.type === "create_work_item"
        ? input.action.sourceEntityId ?? input.runId
        : input.runId;
    const { data, error } = await input.supabase
        .from("workspace_work_items" as never)
        .upsert({
            workspace_id: input.workspaceId,
            customer_id: input.action.type === "create_work_item" ? input.action.customerId ?? null : null,
            title: input.action.title,
            description: input.action.description ?? null,
            kind: input.action.type === "create_work_item" ? input.action.kind : "workflow_approval",
            status: "open",
            priority: input.action.priority,
            assigned_to_profile_id: input.action.assignedToProfileId ?? null,
            due_at: input.action.type === "create_work_item" ? input.action.dueAt ?? null : null,
            source_module: "workflow",
            source_entity_type: input.action.type === "create_work_item" ? input.action.sourceEntityType ?? "workspace_workflow_run" : "workspace_workflow_run",
            source_entity_id: safeUuid(sourceEntityId),
            idempotency_key: `workflow-action:${input.runId}:${input.actionIndex}`,
            metadata: {
                ...(input.action.metadata ?? {}),
                workflow_run_id: input.runId,
                action_type: input.action.type,
                target_type: input.action.type === "request_approval" ? input.action.targetType : undefined,
                target_status: input.action.type === "request_approval" ? input.action.targetStatus ?? null : undefined,
            } as Json,
        } as never, { onConflict: "workspace_id,idempotency_key" } as never)
        .select("id" as never)
        .maybeSingle() as unknown as { data: { id: string } | null; error: { message: string } | null };

    if (error) throw new Error(`Failed to create workflow work item: ${error.message}`);
    return data?.id ?? null;
}

async function executeWorkerJobAction(input: {
    supabase: SupabaseLike;
    workspaceId: string;
    runId: string;
    action: Extract<WorkflowAction, { type: "enqueue_worker_job" }>;
    actionIndex: number;
}) {
    const idempotencyKey = `workflow-worker:${input.runId}:${input.actionIndex}`;
    const registry = getWorkflowWorkerRuntimeRegistry().find(r => r.key === input.action.workerKey);
    if (!registry) throw new Error(`Unknown worker key: ${input.action.workerKey}`);

    const parseResult = registry.typedRuntimeBindingSchema.safeParse(input.action);
    if (!parseResult.success) {
        await logWorkflowEvent({
            supabase: input.supabase,
            workspaceId: input.workspaceId,
            eventKey: `${registry.auditTrail.eventKeyPrefix}.validation_failed`,
            idempotencyKey: `${idempotencyKey}:validation_failed`,
            sourceEntityType: "workspace_workflow_run",
            sourceEntityId: input.runId,
            payload: { errors: parseResult.error.issues, action: input.action },
        });
        throw new Error(`Worker input validation failed: ${parseResult.error.message}`);
    }

    if (input.action.workerKey === "source_ingestion" && input.action.registryId && input.action.sourceUrl) {
        const { data, error } = await input.supabase
            .from("source_ingestion_jobs" as never)
            .insert({
                workspace_id: input.workspaceId,
                registry_id: input.action.registryId,
                run_id: input.action.runId ?? null,
                source_url: input.action.sourceUrl,
                locale: input.action.locale ?? "en",
                status: "queued",
                priority: input.action.priority,
                run_after: input.action.runAfter ?? new Date().toISOString(),
                input_hash: input.action.inputHash ?? null,
            } as never)
            .select("id" as never)
            .maybeSingle() as unknown as { data: { id: string } | null; error: { message: string } | null };
        if (error) throw new Error(`Failed to enqueue source ingestion job: ${error.message}`);

        await logWorkflowEvent({
            supabase: input.supabase,
            workspaceId: input.workspaceId,
            eventKey: `${registry.auditTrail.eventKeyPrefix}.enqueued`,
            idempotencyKey: `${idempotencyKey}:enqueued`,
            sourceEntityType: "workspace_workflow_run",
            sourceEntityId: input.runId,
            payload: { jobId: data?.id, action: input.action },
        });
        return { mode: "concrete", table: "source_ingestion_jobs", jobId: data?.id ?? null };
    }

    if (input.action.workerKey === "seo_internal_link" && input.action.templateId && input.action.contentId && input.action.contentHash) {
        const { data, error } = await input.supabase
            .from("seo_internal_link_jobs" as never)
            .insert({
                workspace_id: input.workspaceId,
                template_id: input.action.templateId,
                content_id: input.action.contentId,
                locale: input.action.locale ?? "en",
                status: "queued",
                content_hash: input.action.contentHash,
                model_config_snapshot: input.action.metadata ?? {},
            } as never)
            .select("id" as never)
            .maybeSingle() as unknown as { data: { id: string } | null; error: { message: string } | null };
        if (error) throw new Error(`Failed to enqueue SEO internal-link job: ${error.message}`);

        await logWorkflowEvent({
            supabase: input.supabase,
            workspaceId: input.workspaceId,
            eventKey: `${registry.auditTrail.eventKeyPrefix}.enqueued`,
            idempotencyKey: `${idempotencyKey}:enqueued`,
            sourceEntityType: "workspace_workflow_run",
            sourceEntityId: input.runId,
            payload: { jobId: data?.id, action: input.action },
        });
        return { mode: "concrete", table: "seo_internal_link_jobs", jobId: data?.id ?? null };
    }

    if (input.action.workerKey === "outreach_dispatch" && input.action.campaignId && input.action.messageId) {
        const { data, error } = await input.supabase
            .from("outreach_dispatch_jobs" as never)
            .insert({
                workspace_id: input.workspaceId,
                campaign_id: input.action.campaignId,
                message_id: input.action.messageId,
                status: "queued",
                priority: input.action.priority,
                run_after: input.action.runAfter ?? new Date().toISOString(),
                idempotency_key: idempotencyKey,
            } as never)
            .select("id" as never)
            .maybeSingle() as unknown as { data: { id: string } | null; error: { message: string } | null };
        if (error) throw new Error(`Failed to enqueue outreach dispatch job: ${error.message}`);

        await logWorkflowEvent({
            supabase: input.supabase,
            workspaceId: input.workspaceId,
            eventKey: `${registry.auditTrail.eventKeyPrefix}.enqueued`,
            idempotencyKey: `${idempotencyKey}:enqueued`,
            sourceEntityType: "workspace_workflow_run",
            sourceEntityId: input.runId,
            payload: { jobId: data?.id, action: input.action },
        });
        return { mode: "concrete", table: "outreach_dispatch_jobs", jobId: data?.id ?? null };
    }

    if (input.action.workerKey === "content_translation" && input.action.contentId) {
        const { data: content, error: contentError } = await input.supabase
            .from("content_items")
            .select("id,workspace_id,type,status,locale,updated_at")
            .eq("id", input.action.contentId)
            .eq("workspace_id", input.workspaceId)
            .maybeSingle();
        if (contentError || !content) {
            throw new Error(
                `Failed to load translation source content: ${contentError?.message ?? "not found"}`,
            );
        }
        if (
            content.type !== "blog"
            || content.status !== "published"
            || content.locale !== "en"
        ) {
            throw new Error(
                "Content translation requires a published English blog post.",
            );
        }

        const queued = await enqueueContentTranslationJob({
            workspaceId: input.workspaceId,
            contentId: content.id,
            sourceVersion: content.updated_at,
            targetLocales: input.action.targetLocales,
        }, input.supabase as ReturnType<typeof createAdminClient>);

        await logWorkflowEvent({
            supabase: input.supabase,
            workspaceId: input.workspaceId,
            eventKey: `${registry.auditTrail.eventKeyPrefix}.enqueued`,
            idempotencyKey: `${idempotencyKey}:enqueued`,
            sourceEntityType: "workspace_workflow_run",
            sourceEntityId: input.runId,
            payload: { jobId: queued.jobId, action: input.action },
        });
        return {
            mode: "concrete",
            table: "content_translation_jobs",
            jobId: queued.jobId,
        };
    }

    await logWorkflowEvent({
        supabase: input.supabase,
        workspaceId: input.workspaceId,
        eventKey: "workflow.worker_job_requested",
        idempotencyKey,
        sourceEntityType: "workspace_workflow_run",
        sourceEntityId: input.runId,
        payload: {
            workerKey: input.action.workerKey,
            metadata: input.action.metadata ?? {},
            reason: "Concrete worker input was incomplete; recorded metadata-only descriptor.",
        },
    });
    return { mode: "metadata_only", table: null, jobId: null };
}

async function executeAction(input: {
    supabase: SupabaseLike;
    workspaceId: string;
    runId: string;
    action: WorkflowAction;
    actionIndex: number;
}) {
    if (input.action.type === "create_work_item" || input.action.type === "request_approval") {
        const workItemId = await createWorkItemForAction({
            supabase: input.supabase,
            workspaceId: input.workspaceId,
            runId: input.runId,
            action: input.action,
            actionIndex: input.actionIndex,
        });
        return { action: input.action.type, workItemId };
    }

    if (input.action.type === "assign_owner") {
        const { error } = await input.supabase
            .from("workspace_work_items" as never)
            .update({ assigned_to_profile_id: input.action.ownerProfileId } as never)
            .eq("workspace_id" as never, input.workspaceId as never)
            .eq("id" as never, input.action.workItemId as never);
        if (error) throw new Error(`Failed to assign workflow owner: ${error.message}`);
        return { action: input.action.type, workItemId: input.action.workItemId };
    }

    if (input.action.type === "write_timeline_event") {
        if (!input.action.customerId) {
            await logWorkflowEvent({
                supabase: input.supabase,
                workspaceId: input.workspaceId,
                eventKey: "workflow.timeline_event_skipped",
                idempotencyKey: `workflow-timeline-skipped:${input.runId}:${input.actionIndex}`,
                sourceEntityType: "workspace_workflow_run",
                sourceEntityId: input.runId,
                payload: { reason: "customerId is required for customer timeline events.", action: input.action },
            });
            return { action: input.action.type, skipped: true };
        }

        const { error } = await input.supabase
            .from("workspace_customer_timeline_events" as never)
            .upsert({
                workspace_id: input.workspaceId,
                customer_id: input.action.customerId,
                event_type: input.action.eventType,
                summary: input.action.summary,
                body: input.action.body ?? null,
                actor_type: "workflow",
                source_module: "workflow",
                source_table: "workspace_workflow_runs",
                source_id: input.runId,
                visibility: input.action.visibility,
                idempotency_key: `workflow-timeline:${input.runId}:${input.actionIndex}`,
                payload: (input.action.metadata ?? {}) as Json,
            } as never, { onConflict: "workspace_id,idempotency_key" } as never);
        if (error) throw new Error(`Failed to write workflow timeline event: ${error.message}`);
        return { action: input.action.type };
    }

    if (input.action.type === "enqueue_worker_job") {
        const result = await executeWorkerJobAction({
            supabase: input.supabase,
            workspaceId: input.workspaceId,
            runId: input.runId,
            action: input.action,
            actionIndex: input.actionIndex,
        });
        return { action: input.action.type, ...result };
    }

    if (input.action.type === "send_templated_email" && input.action.templateKey === "workflow_approval_request") {
        const from = process.env.WORKFLOW_FROM_EMAIL?.trim() || process.env.NEWSLETTER_FROM_EMAIL?.trim();
        const to = input.action.to?.trim() || process.env.WORKFLOW_APPROVAL_TO_EMAIL?.trim() || process.env.NEWSLETTER_REPLY_TO_EMAIL?.trim();
        if (!from || !to) {
            throw new Error("Workflow approval email requires WORKFLOW_FROM_EMAIL/NEWSLETTER_FROM_EMAIL and WORKFLOW_APPROVAL_TO_EMAIL/NEWSLETTER_REPLY_TO_EMAIL.");
        }
        const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0f172a;padding:24px;">
<h1 style="font-size:18px;margin:0 0 12px;">Workflow approval requested</h1>
<p style="margin:0 0 12px;">A workflow run requires manager review before the next operating step continues.</p>
<p style="margin:0;color:#475569;">Run: ${input.runId}</p>
</body></html>`;
        const result = await sendEmail({
            from,
            to,
            subject: "Workflow approval requested",
            html,
            idempotencyKey: `workflow-approval-email:${input.runId}:${input.actionIndex}`,
        });
        await recordBusinessIntegrationEvent({
            workspaceId: input.workspaceId,
            provider: "resend",
            integrationKey: "email-delivery",
            eventType: "workflow.approval_email_sent",
            providerEventId: result.id ?? `workflow-approval-email:${input.runId}:${input.actionIndex}`,
            payload: {
                runId: input.runId,
                templateKey: input.action.templateKey,
                to,
                customerId: input.action.customerId ?? null,
            },
        });
        return { action: input.action.type, mode: "sent", providerMessageId: result.id };
    }

    await logWorkflowEvent({
        supabase: input.supabase,
        workspaceId: input.workspaceId,
        eventKey: "workflow.templated_email_skipped",
        idempotencyKey: `workflow-email:${input.runId}:${input.actionIndex}`,
        sourceEntityType: "workspace_workflow_run",
        sourceEntityId: input.runId,
        payload: {
            templateKey: input.action.templateKey,
            to: input.action.to ?? null,
            customerId: input.action.customerId ?? null,
            metadata: input.action.metadata ?? {},
            mode: "unsupported_template",
        },
    });
    return { action: input.action.type, mode: "unsupported_template" };
}

async function executeClaimedRun(supabase: SupabaseLike, run: WorkflowRunRow, options?: { skipApprovalCheck?: boolean }) {
    if (run.attempts > run.max_attempts) {
        await markRun({
            supabase,
            runId: run.id,
            workspaceId: run.workspace_id,
            status: "failed",
            errorMessage: "Workflow run exceeded max attempts.",
        });
        return { success: false, runId: run.id, workspaceId: run.workspace_id, message: "Workflow run exceeded max attempts." };
    }

    const { data: rule, error: ruleError } = await supabase
        .from("workspace_workflow_rules" as never)
        .select("id,workspace_id,name,trigger_key,is_enabled,requires_approval,condition_json,action_json,metadata" as never)
        .eq("workspace_id" as never, run.workspace_id as never)
        .eq("id" as never, run.rule_id as never)
        .maybeSingle() as unknown as { data: WorkflowRuleRow | null; error: { message: string } | null };

    if (ruleError || !rule) {
        const message = ruleError?.message ?? "Workflow rule no longer exists.";
        await markRun({ supabase, runId: run.id, workspaceId: run.workspace_id, status: "failed", errorMessage: message });
        return { success: false, runId: run.id, workspaceId: run.workspace_id, message };
    }

    if (!rule.is_enabled || isWorkflowRuleKilled(rule)) {
        await markRun({
            supabase,
            runId: run.id,
            workspaceId: run.workspace_id,
            status: "cancelled",
            resultSummary: { cancelled: true, reason: isWorkflowRuleKilled(rule) ? "Rule kill switch enabled before execution." : "Rule disabled before execution." },
        });
        await logWorkflowEvent({
            supabase,
            workspaceId: run.workspace_id,
            eventKey: "workflow.run_cancelled",
            idempotencyKey: `workflow-run-cancelled:${run.id}`,
            sourceEntityType: "workspace_workflow_run",
            sourceEntityId: run.id,
            payload: { reason: isWorkflowRuleKilled(rule) ? "Rule kill switch enabled before execution." : "Rule disabled before execution." },
        });
        return { success: true, runId: run.id, workspaceId: run.workspace_id, message: isWorkflowRuleKilled(rule) ? "Rule kill switch enabled before execution." : "Rule disabled before execution." };
    }

    const normalized = normalizeWorkflowActions(rule.action_json);
    if (!normalized.ok) {
        await markRun({
            supabase,
            runId: run.id,
            workspaceId: run.workspace_id,
            status: "failed",
            errorMessage: normalized.errors.join("; "),
            resultSummary: { allowlistErrors: normalized.errors },
        });
        return { success: false, runId: run.id, workspaceId: run.workspace_id, message: normalized.errors.join("; ") };
    }

    const actions = rule.requires_approval && !options?.skipApprovalCheck
        ? [{
            type: "request_approval",
            title: `Approve automation: ${rule.name}`,
            description: "This workflow rule requires approval before its configured actions can run.",
            targetType: "work_item",
            priority: "high",
            metadata: {
                rule_id: rule.id,
                blocked_actions: normalized.actions.map((action) => action.type),
            },
        } satisfies WorkflowAction]
        : normalized.actions;

    try {
        const actionResults = [];
        let firstWorkItemId: string | null = null;
        for (const [index, action] of actions.entries()) {
            const result = await executeAction({
                supabase,
                workspaceId: run.workspace_id,
                runId: run.id,
                action,
                actionIndex: index,
            });
            if ("workItemId" in result && typeof result.workItemId === "string" && !firstWorkItemId) {
                firstWorkItemId = result.workItemId;
            }
            actionResults.push(result);
        }

        await markRun({
            supabase,
            runId: run.id,
            workspaceId: run.workspace_id,
            status: "completed",
            workItemId: firstWorkItemId,
            resultSummary: rule.requires_approval && !options?.skipApprovalCheck
                ? buildWorkflowAwaitingApprovalSummary({
                    ruleId: rule.id,
                    ruleName: rule.name,
                    blockedActions: normalized.actions.map((action) => action.type),
                    actionResults,
                })
                : options?.skipApprovalCheck
                    ? buildWorkflowResumedApprovalSummary(actionResults)
                    : { requiresApproval: false, actionResults },
        });
        await logWorkflowEvent({
            supabase,
            workspaceId: run.workspace_id,
            eventKey: "workflow.run_completed",
            idempotencyKey: `workflow-run-completed:${run.id}`,
            sourceEntityType: "workspace_workflow_run",
            sourceEntityId: run.id,
            payload: { actionResults },
        });
        return { success: true, runId: run.id, workspaceId: run.workspace_id, message: "Workflow run completed." };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Workflow run failed.";
        const nextStatus = run.attempts >= run.max_attempts ? "failed" : "retrying";

        let runAfter: string | undefined = undefined;
        if (nextStatus === "retrying") {
            const registryEntry = getWorkflowWorkerRuntimeRegistry().find(r =>
                actions.some(a => a.type === "enqueue_worker_job" && a.workerKey === r.key)
            );
            const baseDelayMs = registryEntry?.retryPolicy.baseDelayMs ?? 30000;
            const delayMs = Math.pow(2, run.attempts - 1) * baseDelayMs;
            runAfter = new Date(Date.now() + delayMs).toISOString();
        }

        await markRun({
            supabase,
            runId: run.id,
            workspaceId: run.workspace_id,
            status: nextStatus,
            errorMessage: message,
            runAfter,
            resultSummary: { failedAt: new Date().toISOString(), attempts: run.attempts },
        });
        await logWorkflowEvent({
            supabase,
            workspaceId: run.workspace_id,
            eventKey: nextStatus === "failed" ? "workflow.run_failed" : "workflow.run_retrying",
            idempotencyKey: `workflow-run-${nextStatus}:${run.id}:${run.attempts}`,
            sourceEntityType: "workspace_workflow_run",
            sourceEntityId: run.id,
            payload: { error: message, nextRunAfter: runAfter },
        });
        return { success: false, runId: run.id, workspaceId: run.workspace_id, message };
    }
}

export async function resumeWorkflowRun(runId: string) {
    const supabase = createAdminClient();
    const { data: run, error } = await supabase
        .from("workspace_workflow_runs" as never)
        .select("*" as never)
        .eq("id" as never, runId as never)
        .maybeSingle() as unknown as { data: WorkflowRunRow | null; error: { message: string } | null };

    if (error || !run) throw new Error(`Could not load run ${runId}`);
    if (!isWorkflowRunAwaitingApproval(run)) {
        throw new Error(`Workflow run ${runId} is not awaiting approval.`);
    }

    await markRun({
        supabase,
        runId: run.id,
        workspaceId: run.workspace_id,
        status: "running",
    });

    return executeClaimedRun(supabase, run, { skipApprovalCheck: true });
}

export async function dispatchWorkflowEvent(input: DispatchWorkflowEventInput): Promise<DispatchResult> {
    const supabase = createAdminClient();
    const event = await findOrCreateWorkflowEvent(input, supabase);
    if (!event) return { eventId: null, matchedRules: 0, enqueuedRuns: 0, failedRules: 0, skippedRules: 0 };

    const { data: rules, error } = await supabase
        .from("workspace_workflow_rules" as never)
        .select("id,workspace_id,name,trigger_key,is_enabled,requires_approval,condition_json,action_json,metadata" as never)
        .eq("workspace_id" as never, input.workspaceId as never)
        .eq("trigger_key" as never, input.eventKey as never)
        .eq("is_enabled" as never, true as never) as unknown as { data: WorkflowRuleRow[] | null; error: { message: string } | null };

    if (error) throw new Error(`Failed to load workflow rules: ${error.message}`);

    const context = eventContextFromRow(event);
    let matchedRules = 0;
    let enqueuedRuns = 0;
    let failedRules = 0;
    let skippedRules = 0;

    for (const rule of rules ?? []) {
        if (!rule.is_enabled || isWorkflowRuleKilled(rule)) {
            skippedRules += 1;
            continue;
        }

        const condition = evaluateWorkflowCondition(rule.condition_json, context);
        if (!condition.matched) {
            skippedRules += 1;
            continue;
        }

        matchedRules += 1;
        const normalized = normalizeWorkflowActions(rule.action_json);
        if (!normalized.ok) {
            failedRules += 1;
            await insertWorkflowRun({
                supabase,
                workspaceId: input.workspaceId,
                rule,
                event,
                status: "failed",
                errorMessage: normalized.errors.join("; "),
                resultSummary: { allowlistErrors: normalized.errors },
            });
            continue;
        }

        await insertWorkflowRun({
            supabase,
            workspaceId: input.workspaceId,
            rule,
            event,
            status: "queued",
        });
        enqueuedRuns += 1;
    }

    if (input.runImmediately) {
        await processNextWorkflowRun(`dispatch:${event.id}`);
    }

    return {
        eventId: event.id,
        matchedRules,
        enqueuedRuns,
        failedRules,
        skippedRules,
    };
}

export async function processNextWorkflowRun(workerId: string) {
    const supabase = createAdminClient();
    const { data: run, error } = await (supabase.rpc as unknown as (
        name: string,
        args: Record<string, unknown>
    ) => Promise<{ data: WorkflowRunRow | null; error: { message: string } | null }>)(
        "claim_next_workspace_workflow_run",
        { p_worker_id: workerId },
    );

    if (error) return { success: false, message: error.message };
    if (!run?.id) return { success: false, message: "No queued workflow runs found." };
    return executeClaimedRun(supabase, run);
}

export async function getWorkflowAutomationSummary(workspaceId: string): Promise<WorkflowAutomationSummary> {
    const supabase = await createClient();
    const [
        totalRules,
        enabledRules,
        approvalRules,
        totalEvents,
        recentEvents,
        queuedRuns,
        runningRuns,
        failedRuns,
        awaitingApprovalRuns,
        recentRules,
        recentRuns,
        healthRules,
        healthEvents,
        healthRuns,
    ] = await Promise.all([
        maybeCount(supabase.from("workspace_workflow_rules" as never).select("id" as never, { count: "exact", head: true }).eq("workspace_id" as never, workspaceId as never) as never),
        maybeCount(supabase.from("workspace_workflow_rules" as never).select("id" as never, { count: "exact", head: true }).eq("workspace_id" as never, workspaceId as never).eq("is_enabled" as never, true as never) as never),
        maybeCount(supabase.from("workspace_workflow_rules" as never).select("id" as never, { count: "exact", head: true }).eq("workspace_id" as never, workspaceId as never).eq("requires_approval" as never, true as never) as never),
        maybeCount(supabase.from("workspace_workflow_events" as never).select("id" as never, { count: "exact", head: true }).eq("workspace_id" as never, workspaceId as never) as never),
        maybeRows<{
            id: string;
            event_key: string;
            source_module: string;
            created_at: string;
        }>(supabase
            .from("workspace_workflow_events" as never)
            .select("id,event_key,source_module,created_at" as never)
            .eq("workspace_id" as never, workspaceId as never)
            .order("created_at" as never, { ascending: false })
            .limit(24) as never),
        maybeCount(supabase.from("workspace_workflow_runs" as never).select("id" as never, { count: "exact", head: true }).eq("workspace_id" as never, workspaceId as never).eq("status" as never, "queued" as never) as never),
        maybeCount(supabase.from("workspace_workflow_runs" as never).select("id" as never, { count: "exact", head: true }).eq("workspace_id" as never, workspaceId as never).eq("status" as never, "running" as never) as never),
        maybeCount(supabase.from("workspace_workflow_runs" as never).select("id" as never, { count: "exact", head: true }).eq("workspace_id" as never, workspaceId as never).eq("status" as never, "failed" as never) as never),
        maybeCount(supabase
            .from("workspace_workflow_runs" as never)
            .select("id" as never, { count: "exact", head: true })
            .eq("workspace_id" as never, workspaceId as never)
            .eq("status" as never, "completed" as never)
            .contains("result_summary" as never, {
                requiresApproval: true,
                awaitingApproval: true,
                approvalStatus: WORKFLOW_APPROVAL_AWAITING_STATUS,
            } as never) as never),
        maybeRows<{
            id: string;
            name: string;
            trigger_key: string;
            is_enabled: boolean;
            requires_approval: boolean;
            updated_at: string;
        }>(supabase
            .from("workspace_workflow_rules" as never)
            .select("id,name,trigger_key,is_enabled,requires_approval,updated_at" as never)
            .eq("workspace_id" as never, workspaceId as never)
            .order("updated_at" as never, { ascending: false })
            .limit(8) as never),
        maybeRows<{
            id: string;
            status: string;
            rule_id: string | null;
            attempts: number;
            max_attempts: number;
            result_summary: unknown;
            error_message: string | null;
            created_at: string;
            updated_at: string;
        }>(supabase
            .from("workspace_workflow_runs" as never)
            .select("id,rule_id,status,attempts,max_attempts,result_summary,error_message,created_at,updated_at" as never)
            .eq("workspace_id" as never, workspaceId as never)
            .order("updated_at" as never, { ascending: false })
            .limit(8) as never),
        maybeRows<WorkflowRuleHealthCardRuleRow>(supabase
            .from("workspace_workflow_rules" as never)
            .select("id,name,trigger_key,is_enabled,requires_approval,updated_at" as never)
            .eq("workspace_id" as never, workspaceId as never)
            .order("updated_at" as never, { ascending: false })
            .limit(50) as never),
        maybeRows<WorkflowRuleHealthCardEventRow>(supabase
            .from("workspace_workflow_events" as never)
            .select("id,event_key,source_module,created_at" as never)
            .eq("workspace_id" as never, workspaceId as never)
            .order("created_at" as never, { ascending: false })
            .limit(200) as never),
        maybeRows<WorkflowRuleHealthCardRunRow>(supabase
            .from("workspace_workflow_runs" as never)
            .select("id,rule_id,status,attempts,max_attempts,result_summary,error_message,created_at,updated_at" as never)
            .eq("workspace_id" as never, workspaceId as never)
            .order("updated_at" as never, { ascending: false })
            .limit(200) as never),
    ]);

    const available = [
        totalRules,
        enabledRules,
        approvalRules,
        totalEvents,
        recentEvents,
        queuedRuns,
        runningRuns,
        failedRuns,
        awaitingApprovalRuns,
        recentRules,
        recentRuns,
        healthRules,
        healthEvents,
        healthRuns,
    ].every((result) => result.available);

    const recentEventCounts = new Map<string, { eventKey: string; count: number; latestAt: string }>();
    for (const event of recentEvents.rows) {
        const existing = recentEventCounts.get(event.event_key);
        if (existing) {
            existing.count += 1;
            if (event.created_at > existing.latestAt) existing.latestAt = event.created_at;
        } else {
            recentEventCounts.set(event.event_key, { eventKey: event.event_key, count: 1, latestAt: event.created_at });
        }
    }
    return {
        available,
        events: {
            total: totalEvents.count,
            recentByKey: [...recentEventCounts.values()]
                .sort((left, right) => right.latestAt.localeCompare(left.latestAt))
                .slice(0, 6),
            recent: recentEvents.rows.slice(0, 8).map((event) => ({
                id: event.id,
                eventKey: event.event_key,
                sourceModule: event.source_module,
                createdAt: event.created_at,
            })),
        },
        rules: {
            total: totalRules.count,
            enabled: enabledRules.count,
            requiresApproval: approvalRules.count,
            healthCards: buildWorkflowRuleHealthCards({
                rules: healthRules.rows,
                events: healthEvents.rows,
                runs: healthRuns.rows,
            }),
            recent: recentRules.rows.map((rule) => ({
                id: rule.id,
                name: rule.name,
                triggerKey: rule.trigger_key,
                isEnabled: rule.is_enabled,
                requiresApproval: rule.requires_approval,
                updatedAt: rule.updated_at,
            })),
        },
        runs: {
            queued: queuedRuns.count,
            running: runningRuns.count,
            failed: failedRuns.count,
            awaitingApproval: awaitingApprovalRuns.count,
            recent: recentRuns.rows.map((run) => ({
                id: run.id,
                status: run.status,
                posture: deriveWorkflowRunPosture({ status: run.status, result_summary: run.result_summary }),
                attempts: run.attempts,
                maxAttempts: run.max_attempts,
                errorMessage: run.error_message,
                updatedAt: run.updated_at,
            })),
        },
    };
}
