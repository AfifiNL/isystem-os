import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { getCreativeRenderProviderConfig } from "@/features/creative-studio/providers/config";
import {
    buildHiggsfieldWebhookLedgerKey,
    verifyHiggsfieldWebhookSignature,
} from "@/features/creative-studio/webhook-security";
import { createHash } from "node:crypto";
import { extractAntiAbuseRequestContext } from "@/shared/lib/anti-abuse/server";

export const runtime = "nodejs";
const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;
const MAX_WEBHOOKS_PER_MINUTE = 120;

function safePayload(rawBody: string): Record<string, unknown> {
    try {
        const parsed = JSON.parse(rawBody);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
        return { parse_error: "invalid_json" };
    }
}

function stringField(payload: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
        const value = payload[key];
        if (typeof value === "string" && value.trim()) return value.trim();
    }
    return null;
}

export async function POST(req: NextRequest) {
    const config = getCreativeRenderProviderConfig();
    if (!config.higgsfield.enabled) {
        return NextResponse.json({ ok: false, error: "Higgsfield webhook is disabled." }, { status: 503 });
    }
    if (!config.higgsfield.webhookSecret) {
        return NextResponse.json({ ok: false, error: "Higgsfield webhook is not configured." }, { status: 503 });
    }
    const contentLength = Number(req.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_WEBHOOK_BODY_BYTES) {
        return NextResponse.json({ ok: false, error: "Payload too large." }, { status: 413 });
    }
    const rawBody = await req.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BODY_BYTES) {
        return NextResponse.json({ ok: false, error: "Payload too large." }, { status: 413 });
    }
    const payload = safePayload(rawBody);
    const providerEventId = stringField(payload, ["eventId", "event_id", "id"]);
    const providerJobId = stringField(payload, ["providerJobId", "provider_job_id", "jobId", "job_id"]);
    const rawStatus = stringField(payload, ["status", "state"]);
    const signature = verifyHiggsfieldWebhookSignature({
        rawBody,
        secret: config.higgsfield.webhookSecret,
        signatureHeader: req.headers.get("higgsfield-signature") ?? req.headers.get("x-higgsfield-signature"),
    });
    if (!signature.signatureValid) {
        return NextResponse.json({ ok: false, error: "Invalid signature." }, { status: 401 });
    }
    if (!providerEventId) {
        return NextResponse.json({ ok: false, error: "A provider event id is required." }, { status: 400 });
    }
    const idempotencyKey = buildHiggsfieldWebhookLedgerKey({ providerEventId, providerJobId, rawStatus });
    const supabase = createAdminClient();
    const requestContext = extractAntiAbuseRequestContext(req.headers);
    const source = requestContext.ipAddress ?? "unattributed";
    const bucket = `higgsfield-webhook:${createHash("sha256").update(source).digest("hex")}`;
    const windowStart = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
    const { data: rateCount, error: rateError } = await supabase.rpc("tool_rate_limit_increment", {
        p_bucket: bucket,
        p_window_start: windowStart,
    });
    if (rateError) return NextResponse.json({ ok: false, error: "Rate limiter unavailable." }, { status: 503 });
    if ((rateCount ?? 0) > MAX_WEBHOOKS_PER_MINUTE) {
        return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429 });
    }

    let workspaceId: string | null = null;
    if (providerJobId) {
        const { data } = await supabase
            .from("creative_render_jobs" as never)
            .select("workspace_id" as never)
            .eq("provider" as never, "higgsfield" as never)
            .eq("provider_job_id" as never, providerJobId as never)
            .maybeSingle();
        workspaceId = (data as { workspace_id?: string } | null)?.workspace_id ?? null;
    }

    const ledgerPayload = {
        workspace_id: workspaceId,
        provider: "higgsfield",
        provider_event_id: providerEventId,
        provider_job_id: providerJobId,
        signature_valid: signature.signatureValid,
        idempotency_key: idempotencyKey,
        payload: {
            fail_closed: true,
            disabled_reason: "Official Higgsfield API/webhook contract is unverified; route stores ledger only and performs no mutation.",
            signature_reason: signature.reason,
            body: payload,
        },
        processing_error: config.higgsfield.enabled
            ? "Higgsfield webhook mutation disabled until official API contract is verified."
            : "Higgsfield provider disabled; webhook stored without mutation.",
    };

    const query = supabase.from("creative_provider_webhook_events" as never).upsert(ledgerPayload as never, {
        onConflict: providerEventId ? "provider,provider_event_id" : "provider,idempotency_key",
        ignoreDuplicates: true,
    });
    const { error } = await query;
    if (error) {
        return NextResponse.json({ ok: false, error: "Webhook ledger insert failed." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, stored: true, processed: false, failClosed: true });
}
