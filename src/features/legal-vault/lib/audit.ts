import { headers } from "next/headers";
import { sha256Hex } from "@/features/legal-vault/lib/hashing";
import { getLegalVaultServiceClient } from "@/features/legal-vault/lib/service-client";

export type LegalAuditResourceType =
    | "document"
    | "agreement"
    | "signature_event"
    | "accounting_entry"
    | "accounting_period"
    | "ai_generation"
    | "ai_summary"
    | "retention_policy"
    | "system";

export interface LegalAuditEventInput {
    workspaceId: string;
    actorUserId?: string | null;
    actorEmail?: string | null;
    actorRole?: string | null;
    event: string;
    resourceType: LegalAuditResourceType | string;
    resourceId?: string | null;
    metadata?: Record<string, unknown>;
    actorIp?: string | null;
    actorUserAgent?: string | null;
}

export async function recordLegalAuditEvent(input: LegalAuditEventInput): Promise<void> {
    const service = getLegalVaultServiceClient();
    if (!service) return;

    const requestContext = await captureAuditRequestContext();
    const actorIp = input.actorIp ?? requestContext.ip;
    const actorUserAgent = input.actorUserAgent ?? requestContext.userAgent;

    const { data: previous } = await service
        .from("legal_audit_events")
        .select("event_hash")
        .eq("workspace_id", input.workspaceId)
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    const previousEventHash = typeof previous?.event_hash === "string" ? previous.event_hash : null;
    const occurredAt = new Date().toISOString();
    const canonicalPayload = JSON.stringify({
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId ?? null,
        actorEmail: input.actorEmail ?? null,
        actorRole: input.actorRole ?? null,
        event: input.event,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        actorIp,
        actorUserAgent,
        metadata: stableJson(input.metadata ?? {}),
        previousEventHash,
        occurredAt,
    });

    await service.from("legal_audit_events").insert({
        workspace_id: input.workspaceId,
        actor_user_id: input.actorUserId ?? null,
        actor_email: input.actorEmail ?? null,
        actor_role: input.actorRole ?? null,
        event: input.event,
        resource_type: input.resourceType,
        resource_id: input.resourceId ?? null,
        actor_ip: actorIp,
        actor_user_agent: actorUserAgent,
        metadata: input.metadata ?? {},
        previous_event_hash: previousEventHash,
        event_hash: sha256Hex(canonicalPayload),
        occurred_at: occurredAt,
    });
}

async function captureAuditRequestContext(): Promise<{ ip: string | null; userAgent: string | null }> {
    try {
        const h = await headers();
        const forwarded = h.get("x-forwarded-for");
        const ip = forwarded ? forwarded.split(",")[0]?.trim() ?? null : h.get("x-real-ip");
        return {
            ip: ip || null,
            userAgent: h.get("user-agent"),
        };
    } catch {
        return { ip: null, userAgent: null };
    }
}

function stableJson(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stableJson);
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, nested]) => [key, stableJson(nested)]),
        );
    }
    return value;
}
