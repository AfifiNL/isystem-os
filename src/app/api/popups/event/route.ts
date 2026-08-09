import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { popupEventSchema } from "@/features/popups/schema";
import { sanitizeAnalyticsMetadataForExport } from "@/features/analytics/privacy";
import { derivePageSlug, normalizeAnalyticsPath, type AnalyticsEventType } from "@/features/analytics/taxonomy";
import { extractAntiAbuseRequestContext } from "@/shared/lib/anti-abuse/server";
import { readBoundedJson } from "@/shared/lib/public-request";
import { lookupActivePublicWorkspaceByDomain, resolvePublicWorkspace } from "@/shared/lib/public-workspace";

// Per-fingerprint cap: at most 30 events / minute from the same visitor for
// the same popup+event combination. Impressions and convert events are rare
// per visitor (usually one each) so this is a generous ceiling that catches
// pathological loops without ever blocking legitimate behaviour.
const EVENT_RATE_LIMIT_WINDOW_MS = 60_000;
const EVENT_MAX_PER_WINDOW = 30;

function hashValue(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

function sanitizeText(value: string | undefined | null, maxLength: number) {
    if (!value) return undefined;
    const normalized = value.replace(/[\u0000-\u001F\u007F]+/g, " ").replace(/\s+/g, " ").trim();
    return normalized ? normalized.slice(0, maxLength) : undefined;
}

const POPUP_ANALYTICS_EVENT_TYPES = {
    impression: "popup_impression",
    dismiss: "popup_dismiss",
    convert: "popup_convert",
} as const satisfies Record<"impression" | "dismiss" | "convert", AnalyticsEventType>;

export async function POST(req: NextRequest) {
    const body = await readBoundedJson(req, 16 * 1024);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
    const rawBody = body.value;

    const parsed = popupEventSchema.safeParse(rawBody);
    if (!parsed.success) {
        return NextResponse.json(
            { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
            { status: 400 },
        );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!supabaseUrl || !serviceRoleKey) {
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const supabase = createServiceClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    let workspace;
    try {
        workspace = await resolvePublicWorkspace({
            requestHost: req.headers.get("host") ?? req.headers.get("x-forwarded-host") ?? req.nextUrl.host,
            expectedWorkspaceId: parsed.data.workspaceId,
            lookupByDomain: (domain) => lookupActivePublicWorkspaceByDomain(supabase, domain),
        });
    } catch {
        return NextResponse.json({ error: "Popup event does not match this site." }, { status: 409 });
    }

    // Verify the popup actually exists in the claimed workspace and is
    // active. Without this an attacker could insert events for arbitrary
    // popup IDs they don't own — the table allows it because we're using
    // the service-role client to bypass RLS for the public path.
    const { data: popup, error: popupErr } = await supabase
        .from("workspace_popups")
        .select("id, workspace_id, is_active, name, template_kind")
        .eq("id", parsed.data.popupId)
        .eq("workspace_id", workspace.id)
        .maybeSingle();
    if (popupErr || !popup) {
        return NextResponse.json({ error: "Popup not found" }, { status: 404 });
    }
    if (!popup.is_active) {
        // Silently accept — analytics from a popup that just got disabled
        // shouldn't blow up the client. Drop on the floor.
        return NextResponse.json({ ok: true, ignored: true });
    }

    const requestContext = extractAntiAbuseRequestContext(req.headers);
    const ipHash = requestContext.ipAddress ? hashValue(requestContext.ipAddress) : "unknown";
    const fingerprint = hashValue([
        ipHash,
        parsed.data.visitorId ?? "anon",
        parsed.data.popupId,
        parsed.data.eventType,
    ].join("::"));

    const since = new Date(Date.now() - EVENT_RATE_LIMIT_WINDOW_MS).toISOString();
    const [{ count: globalIpCount }, { count: tenantIpCount }] = await Promise.all([
        supabase.from("workspace_popup_events").select("id", { count: "exact", head: true })
            .contains("metadata", { ipHash }).gte("created_at", since),
        supabase.from("workspace_popup_events").select("id", { count: "exact", head: true })
            .eq("workspace_id", workspace.id).contains("metadata", { ipHash }).gte("created_at", since),
    ]);

    if ((globalIpCount ?? 0) >= EVENT_MAX_PER_WINDOW * 2 || (tenantIpCount ?? 0) >= EVENT_MAX_PER_WINDOW) {
        return NextResponse.json({ ok: true, throttled: true });
    }

    const { error: insertErr } = await supabase.from("workspace_popup_events").insert({
        popup_id: parsed.data.popupId,
        workspace_id: workspace.id,
        event_type: parsed.data.eventType,
        visitor_id: parsed.data.visitorId ?? null,
        session_id: parsed.data.sessionId ?? null,
        locale: parsed.data.locale ?? null,
        path: parsed.data.path ?? null,
        metadata: {
            fp: fingerprint,
            ipHash,
            ua: req.headers.get("user-agent")?.slice(0, 200) ?? null,
        },
    });

    if (insertErr) {
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    const normalizedPath = normalizeAnalyticsPath(parsed.data.path ?? "/") ?? "/";
    const pageSlug = derivePageSlug(normalizedPath);
    const analyticsEventType = POPUP_ANALYTICS_EVENT_TYPES[parsed.data.eventType];
    const mirroredMetadata = sanitizeAnalyticsMetadataForExport({
        popupId: popup.id,
        templateKind: popup.template_kind,
        campaignName: popup.name,
        page: pageSlug,
        path: normalizedPath,
        locale: parsed.data.locale ?? null,
        source: "popup_host",
        utmSource: parsed.data.utmSource ?? null,
        utmMedium: parsed.data.utmMedium ?? null,
        utmCampaign: parsed.data.utmCampaign ?? null,
    });

    const analyticsClient = supabase as unknown as {
        from: (table: string) => {
            insert: (payload: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
        };
    };
    const { error: analyticsInsertErr } = await analyticsClient.from("analytics_events").insert({
        workspace_id: popup.workspace_id,
        page_slug: pageSlug,
        event_type: analyticsEventType,
        event_name: analyticsEventType,
        visitor_id: sanitizeText(parsed.data.visitorId, 120),
        session_id: sanitizeText(parsed.data.sessionId, 120),
        referrer: sanitizeText(parsed.data.referrer, 500),
        utm_source: sanitizeText(parsed.data.utmSource, 120),
        utm_medium: sanitizeText(parsed.data.utmMedium, 120),
        utm_campaign: sanitizeText(parsed.data.utmCampaign, 120),
        path: normalizedPath,
        metadata: mirroredMetadata,
    });

    if (analyticsInsertErr) {
        return NextResponse.json({ error: analyticsInsertErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
