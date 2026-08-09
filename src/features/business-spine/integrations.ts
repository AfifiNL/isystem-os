import { createAdminClient } from "@/shared/lib/supabase/admin";
import { createClient } from "@/shared/lib/supabase/server";
import type { Json } from "@/shared/lib/supabase/database.types";
import { dispatchRecorderWorkflowEvent } from "@/features/business-spine/workflow-events";
import {
    aggregateBusinessIntegrationStatuses,
    BUSINESS_INTEGRATION_SURFACES,
    deriveBusinessIntegrationStatusFromConfig,
    evaluateBusinessIntegrationConfig,
    type BusinessIntegrationHealthRollup,
    type BusinessIntegrationStatus,
    type BusinessIntegrationSurface,
} from "@/features/business-spine/health";

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

type IntegrationRow = {
    id: string;
    workspace_id: string;
    provider: string;
    integration_key: string;
    status: BusinessIntegrationStatus;
    last_success_at: string | null;
    last_failure_at: string | null;
    consecutive_failures: number;
    rate_limit_reset_at: string | null;
    last_error_code: string | null;
    last_error_message: string | null;
    metadata: Json;
    updated_at: string;
};

type HealthCheckRow = {
    id: string;
    workspace_id: string;
    integration_id: string | null;
    status: BusinessIntegrationStatus;
    checked_at: string;
    latency_ms: number | null;
    status_code: number | null;
    message: string | null;
    details: Json;
};

type IntegrationEventRow = {
    id: string;
    workspace_id: string;
    integration_id: string | null;
    provider: string;
    provider_event_id: string | null;
    event_type: string;
    occurred_at: string;
    payload: Json;
};

export interface BusinessIntegrationRegistryItem {
    id: string | null;
    workspaceId: string;
    provider: string;
    integrationKey: string;
    label: string;
    purpose: string;
    owner: string;
    href: string;
    category: BusinessIntegrationSurface["category"] | "custom";
    status: BusinessIntegrationStatus;
    configStatus: "configured" | "action_required" | "disabled";
    configured: boolean;
    missingEnv: string[];
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    consecutiveFailures: number;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
    latestCheck: {
        id: string;
        status: BusinessIntegrationStatus;
        checkedAt: string;
        latencyMs: number | null;
        statusCode: number | null;
        message: string | null;
        details: Json;
    } | null;
    updatedAt: string | null;
    registered: boolean;
}

export interface BusinessIntegrationRegistrySnapshot {
    registryAvailable: boolean;
    checksAvailable: boolean;
    items: BusinessIntegrationRegistryItem[];
    rollup: BusinessIntegrationHealthRollup;
}

async function safeArray<T>(query: PromiseLike<{ data: unknown; error: { message: string } | null }>) {
    try {
        const { data, error } = await query;
        if (error) return { rows: [] as T[], available: false, error };
        return { rows: Array.isArray(data) ? data as T[] : [] as T[], available: true, error: null };
    } catch (error) {
        return { rows: [] as T[], available: false, error };
    }
}

function surfaceKey(provider: string, integrationKey: string) {
    return `${provider}:${integrationKey}`;
}

function latestChecksByIntegration(checks: readonly HealthCheckRow[]) {
    const map = new Map<string, HealthCheckRow>();

    for (const check of checks) {
        if (!check.integration_id || map.has(check.integration_id)) continue;
        map.set(check.integration_id, check);
    }

    return map;
}

function metadataValue(metadata: Json, key: string) {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
    const value = metadata[key as keyof typeof metadata];
    return typeof value === "string" && value.trim() ? value : null;
}

function buildExpectedItem(workspaceId: string, surface: BusinessIntegrationSurface): BusinessIntegrationRegistryItem {
    const config = evaluateBusinessIntegrationConfig(surface);

    return {
        id: null,
        workspaceId,
        provider: surface.provider,
        integrationKey: surface.integrationKey,
        label: surface.label,
        purpose: surface.purpose,
        owner: surface.owner,
        href: surface.href,
        category: surface.category,
        status: deriveBusinessIntegrationStatusFromConfig(config),
        configStatus: config.status,
        configured: config.configured,
        missingEnv: config.missingEnv,
        lastSuccessAt: null,
        lastFailureAt: null,
        consecutiveFailures: 0,
        lastErrorCode: null,
        lastErrorMessage: null,
        latestCheck: null,
        updatedAt: null,
        registered: false,
    };
}

function mergeRowIntoItem(
    workspaceId: string,
    expected: BusinessIntegrationRegistryItem,
    row: IntegrationRow,
    check: HealthCheckRow | undefined,
): BusinessIntegrationRegistryItem {
    return {
        ...expected,
        id: row.id,
        workspaceId,
        status: row.status,
        lastSuccessAt: row.last_success_at,
        lastFailureAt: row.last_failure_at,
        consecutiveFailures: row.consecutive_failures,
        lastErrorCode: row.last_error_code,
        lastErrorMessage: row.last_error_message,
        latestCheck: check
            ? {
                id: check.id,
                status: check.status,
                checkedAt: check.checked_at,
                latencyMs: check.latency_ms,
                statusCode: check.status_code,
                message: check.message,
                details: check.details,
            }
            : null,
        updatedAt: row.updated_at,
        registered: true,
    };
}

function mapCustomRow(workspaceId: string, row: IntegrationRow, check: HealthCheckRow | undefined): BusinessIntegrationRegistryItem {
    const label = metadataValue(row.metadata, "label") ?? row.integration_key;
    const purpose = metadataValue(row.metadata, "purpose") ?? "Custom integration registered by this workspace.";
    const owner = metadataValue(row.metadata, "owner") ?? "Workspace";
    const href = metadataValue(row.metadata, "href") ?? "/dashboard/integrations";

    return mergeRowIntoItem(workspaceId, {
        id: null,
        workspaceId,
        provider: row.provider,
        integrationKey: row.integration_key,
        label,
        purpose,
        owner,
        href,
        category: "custom",
        status: row.status,
        configStatus: "configured",
        configured: true,
        missingEnv: [],
        lastSuccessAt: null,
        lastFailureAt: null,
        consecutiveFailures: 0,
        lastErrorCode: null,
        lastErrorMessage: null,
        latestCheck: null,
        updatedAt: null,
        registered: true,
    }, row, check);
}

export async function listBusinessIntegrationRegistry(workspaceId: string): Promise<BusinessIntegrationRegistrySnapshot> {
    const supabase = await createClient();

    const [integrationResult, checkResult] = await Promise.all([
        safeArray<IntegrationRow>(
            supabase
                .from("workspace_integrations" as never)
                .select("id,workspace_id,provider,integration_key,status,last_success_at,last_failure_at,consecutive_failures,rate_limit_reset_at,last_error_code,last_error_message,metadata,updated_at" as never)
                .eq("workspace_id" as never, workspaceId as never)
                .order("provider" as never, { ascending: true })
                .order("integration_key" as never, { ascending: true })
                .limit(200) as never,
        ),
        safeArray<HealthCheckRow>(
            supabase
                .from("workspace_integration_health_checks" as never)
                .select("id,workspace_id,integration_id,status,checked_at,latency_ms,status_code,message,details" as never)
                .eq("workspace_id" as never, workspaceId as never)
                .order("checked_at" as never, { ascending: false })
                .limit(300) as never,
        ),
    ]);

    const rowBySurface = new Map(integrationResult.rows.map((row) => [surfaceKey(row.provider, row.integration_key), row]));
    const checksById = latestChecksByIntegration(checkResult.rows);

    const items: BusinessIntegrationRegistryItem[] = BUSINESS_INTEGRATION_SURFACES.map((surface) => {
        const expected = buildExpectedItem(workspaceId, surface);
        const row = rowBySurface.get(surfaceKey(surface.provider, surface.integrationKey));
        if (!row) return expected;
        return mergeRowIntoItem(workspaceId, expected, row, checksById.get(row.id));
    });

    const expectedKeys = new Set(BUSINESS_INTEGRATION_SURFACES.map((surface) => surfaceKey(surface.provider, surface.integrationKey)));
    for (const row of integrationResult.rows) {
        if (expectedKeys.has(surfaceKey(row.provider, row.integration_key))) continue;
        items.push(mapCustomRow(workspaceId, row, checksById.get(row.id)));
    }

    items.sort((a, b) => {
        const categoryCompare = a.category.localeCompare(b.category);
        if (categoryCompare !== 0) return categoryCompare;
        return a.label.localeCompare(b.label);
    });

    return {
        registryAvailable: integrationResult.available,
        checksAvailable: checkResult.available,
        items,
        rollup: aggregateBusinessIntegrationStatuses(items.map((item) => item.status)),
    };
}

export async function upsertBusinessIntegrationRegistry(workspaceId: string, surfaces: readonly BusinessIntegrationSurface[] = BUSINESS_INTEGRATION_SURFACES) {
    try {
        const supabase = createAdminClient();
        const rows = surfaces.map((surface) => {
            const config = evaluateBusinessIntegrationConfig(surface);

            return {
                workspace_id: workspaceId,
                provider: surface.provider,
                integration_key: surface.integrationKey,
                status: deriveBusinessIntegrationStatusFromConfig(config),
                metadata: ({
                    label: surface.label,
                    purpose: surface.purpose,
                    owner: surface.owner,
                    href: surface.href,
                    category: surface.category,
                    config_status: config.status,
                    configured: config.configured,
                    missing_env: config.missingEnv,
                    env_signals: [
                        ...(surface.requiredEnv ?? []),
                        ...(surface.anyRequiredEnv ?? []).map((group) => group.join(" or ")),
                    ],
                    registered_by: "business-spine",
                } satisfies Record<string, unknown>) as Json,
            };
        });

        const { error } = await supabase
            .from("workspace_integrations" as never)
            .upsert(rows as never, { onConflict: "workspace_id,provider,integration_key" } as never);

        if (error) {
            console.warn("[business-spine] integration registry upsert failed", error.message);
            return { ok: false, error: error.message };
        }

        return { ok: true, error: null };
    } catch (error) {
        console.warn("[business-spine] integration registry upsert failed", error);
        return { ok: false, error: error instanceof Error ? error.message : "Unknown integration registry error" };
    }
}

export async function recordBusinessIntegrationHealthCheck(input: {
    workspaceId: string;
    provider: string;
    integrationKey: string;
    status: BusinessIntegrationStatus;
    latencyMs?: number | null;
    statusCode?: number | null;
    message?: string | null;
    errorCode?: string | null;
    details?: Record<string, unknown>;
    checkedAt?: string;
}) {
    try {
        const supabase = createAdminClient();
        const checkedAt = input.checkedAt ?? new Date().toISOString();
        const currentResult = await supabase
            .from("workspace_integrations" as never)
            .select("id,consecutive_failures,last_success_at,last_failure_at,metadata" as never)
            .eq("workspace_id" as never, input.workspaceId as never)
            .eq("provider" as never, input.provider as never)
            .eq("integration_key" as never, input.integrationKey as never)
            .maybeSingle() as unknown as {
                data: {
                    id: string;
                    consecutive_failures: number;
                    last_success_at: string | null;
                    last_failure_at: string | null;
                    metadata: Json;
                } | null;
                error: { message: string } | null;
            };
        if (currentResult.error) {
            console.warn("[business-spine] health integration lookup failed", currentResult.error.message);
        }
        const isFailure = input.status === "degraded" || input.status === "failing";
        const failureCount = isFailure ? (currentResult.data?.consecutive_failures ?? 0) + 1 : 0;
        const metadata = currentResult.data?.metadata && typeof currentResult.data.metadata === "object" && !Array.isArray(currentResult.data.metadata)
            ? currentResult.data.metadata as Record<string, unknown>
            : {};
        const { data: integration, error: integrationError } = await supabase
            .from("workspace_integrations" as never)
            .upsert({
                workspace_id: input.workspaceId,
                provider: input.provider,
                integration_key: input.integrationKey,
                status: input.status,
                last_success_at: input.status === "healthy" ? checkedAt : currentResult.data?.last_success_at ?? null,
                last_failure_at: isFailure ? checkedAt : currentResult.data?.last_failure_at ?? null,
                consecutive_failures: failureCount,
                last_error_code: input.errorCode ?? null,
                last_error_message: input.message ?? null,
                metadata: {
                    ...metadata,
                    last_health_details: input.details ?? {},
                    last_checked_by: "business-spine",
                } as Json,
            } as never, { onConflict: "workspace_id,provider,integration_key" } as never)
            .select("id,consecutive_failures" as never)
            .single() as unknown as { data: { id: string; consecutive_failures: number } | null; error: { message: string } | null };

        if (integrationError || !integration) {
            const message = integrationError?.message ?? "Missing integration row after upsert";
            console.warn("[business-spine] health integration upsert failed", message);
            return { ok: false, error: message };
        }

        const { error } = await supabase
            .from("workspace_integration_health_checks" as never)
            .insert({
                workspace_id: input.workspaceId,
                integration_id: integration.id,
                status: input.status,
                checked_at: checkedAt,
                latency_ms: input.latencyMs ?? null,
                status_code: input.statusCode ?? null,
                message: input.message ?? null,
                details: (input.details ?? {}) as Json,
            } as never);

        if (error) {
            console.warn("[business-spine] health check write failed", error.message);
            return { ok: false, error: error.message };
        }

        if (input.status === "degraded" || input.status === "failing") {
            await bestEffortWorkflow({
                workspaceId: input.workspaceId,
                sourceModule: "integration-health",
                recorderEventKey: `integration.${input.status}`,
                sourceEntityType: "workspace_integration",
                sourceEntityId: integration.id,
                payload: {
                    provider: input.provider,
                    integrationKey: input.integrationKey,
                    status: input.status,
                    latencyMs: input.latencyMs ?? null,
                    statusCode: input.statusCode ?? null,
                    message: input.message ?? null,
                    errorCode: input.errorCode ?? null,
                    consecutiveFailures: integration.consecutive_failures,
                    details: input.details ?? {},
                },
                idempotencyValues: { provider: input.provider, integrationKey: input.integrationKey },
            });
        }

        return { ok: true, error: null };
    } catch (error) {
        console.warn("[business-spine] health check write failed", error);
        return { ok: false, error: error instanceof Error ? error.message : "Unknown health check error" };
    }
}

export async function recordBusinessIntegrationEvent(input: {
    workspaceId: string;
    provider: string;
    integrationKey?: string | null;
    eventType: string;
    providerEventId?: string | null;
    occurredAt?: string;
    payload?: Record<string, unknown>;
}) {
    try {
        const supabase = createAdminClient();
        let integrationId: string | null = null;

        if (input.integrationKey) {
            const { data } = await supabase
                .from("workspace_integrations" as never)
                .select("id" as never)
                .eq("workspace_id" as never, input.workspaceId as never)
                .eq("provider" as never, input.provider as never)
                .eq("integration_key" as never, input.integrationKey as never)
                .maybeSingle() as unknown as { data: { id: string } | null; error: { message: string } | null };

            integrationId = data?.id ?? null;
        }

        const payload = {
            workspace_id: input.workspaceId,
            integration_id: integrationId,
            provider: input.provider,
            provider_event_id: input.providerEventId ?? null,
            event_type: input.eventType,
            occurred_at: input.occurredAt ?? new Date().toISOString(),
            payload: (input.payload ?? {}) as Json,
        };

        const { error } = input.providerEventId
            ? await supabase
                .from("workspace_integration_events" as never)
                .upsert(payload as never, { onConflict: "workspace_id,provider,provider_event_id" } as never)
            : await supabase
                .from("workspace_integration_events" as never)
                .insert(payload as never);

        if (error) {
            console.warn("[business-spine] integration event write failed", error.message);
            return { ok: false, error: error.message };
        }

        return { ok: true, error: null };
    } catch (error) {
        console.warn("[business-spine] integration event write failed", error);
        return { ok: false, error: error instanceof Error ? error.message : "Unknown integration event error" };
    }
}

export async function listBusinessIntegrationEvents(workspaceId: string, limit = 50) {
    const supabase = await createClient();
    const result = await safeArray<IntegrationEventRow>(
        supabase
            .from("workspace_integration_events" as never)
            .select("id,workspace_id,integration_id,provider,provider_event_id,event_type,occurred_at,payload" as never)
            .eq("workspace_id" as never, workspaceId as never)
            .order("occurred_at" as never, { ascending: false })
            .limit(limit) as never,
    );

    return result.rows.map((row) => ({
        id: row.id,
        workspaceId: row.workspace_id,
        integrationId: row.integration_id,
        provider: row.provider,
        providerEventId: row.provider_event_id,
        eventType: row.event_type,
        occurredAt: row.occurred_at,
        payload: row.payload,
    }));
}
