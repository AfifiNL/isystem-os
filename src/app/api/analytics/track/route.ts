import { createHash } from "node:crypto";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { analyticsTrackSchema, type AnalyticsEventType } from "@/features/analytics/schema";
import {
    derivePageSlug,
    isAnalyticsPublicTrackEvent,
    normalizeAnalyticsPath,
    normalizeAnalyticsSlug,
} from "@/features/analytics/taxonomy";
import { extractAntiAbuseRequestContext } from "@/shared/lib/anti-abuse/server";
import { readBoundedJson } from "@/shared/lib/public-request";
import { lookupActivePublicWorkspaceByDomain, resolvePublicWorkspace } from "@/shared/lib/public-workspace";

const ANALYTICS_RATE_LIMIT_WINDOW_MS = 60_000;
const ANALYTICS_MAX_EVENTS_PER_WINDOW = 45;
const ANALYTICS_ALLOWED_EVENT_TYPES = { has: isAnalyticsPublicTrackEvent };

function hashValue(value: string) {
    return createHash("sha256").update(value).digest("hex");
}

function sanitizeText(value: string | undefined, maxLength: number) {
    if (!value) {
        return undefined;
    }

    const normalized = value.replace(/[\u0000-\u001F\u007F]+/g, " ").replace(/\s+/g, " ").trim();
    return normalized ? normalized.slice(0, maxLength) : undefined;
}

function sanitizeHref(value: string | undefined) {
    const normalized = sanitizeText(value, 500);

    if (!normalized) {
        return undefined;
    }

    if (/^(https?:\/\/|\/)/i.test(normalized)) {
        return normalized;
    }

    return undefined;
}

function sanitizeAnalyticsMetadata(eventType: AnalyticsEventType, metadata: Record<string, unknown> | undefined) {
    if (!metadata) return {};

    if (eventType === "cta_click") {
        return {
            ...(typeof metadata.href === "string" ? { href: sanitizeHref(metadata.href) } : {}),
            ...(typeof metadata.label === "string" ? { label: sanitizeText(metadata.label, 120) } : {}),
            ...(typeof metadata.placement === "string" ? { placement: sanitizeText(metadata.placement, 80) } : {}),
        };
    }

    if (eventType === "audio_play" || eventType === "audio_progress" || eventType === "audio_complete") {
        const episodeId = typeof metadata.episodeId === "string" ? metadata.episodeId.trim() : null;
        const episodeSlug = typeof metadata.episodeSlug === "string" ? sanitizeText(metadata.episodeSlug, 180) : null;
        const showSlug = typeof metadata.showSlug === "string" ? sanitizeText(metadata.showSlug, 180) : null;
        const milestone = typeof metadata.milestone === "number" ? metadata.milestone : null;
        return {
            ...(episodeId && /^[0-9a-f-]{8,40}$/i.test(episodeId) ? { episodeId } : {}),
            ...(episodeSlug ? { episodeSlug } : {}),
            ...(showSlug ? { showSlug } : {}),
            ...(milestone !== null && milestone >= 0 && milestone <= 1 ? { milestone } : {}),
        };
    }

    if (
        eventType === "booking_widget_viewed"
        || eventType === "booking_service_selected"
        || eventType === "booking_slot_selected"
        || eventType === "booking_intake_started"
    ) {
        return {
            ...(typeof metadata.serviceId === "string" ? { serviceId: sanitizeText(metadata.serviceId, 80) } : {}),
            ...(typeof metadata.templateKey === "string" ? { templateKey: sanitizeText(metadata.templateKey, 80) } : {}),
            ...(typeof metadata.sourceChannel === "string" ? { sourceChannel: sanitizeText(metadata.sourceChannel, 120) } : {}),
            ...(typeof metadata.sourceCampaign === "string" ? { sourceCampaign: sanitizeText(metadata.sourceCampaign, 120) } : {}),
            ...(typeof metadata.selectedSlot === "string" ? { selectedSlot: sanitizeText(metadata.selectedSlot, 80) } : {}),
            ...(typeof metadata.locale === "string" ? { locale: sanitizeText(metadata.locale, 12) } : {}),
        };
    }

    return {};
}

function isBotUserAgent(userAgent: string) {
    return /(bot|crawl|spider|preview|headless|monitor|uptime|curl|wget)/i.test(userAgent);
}

function buildFingerprint(input: {
    eventType: string;
    path: string;
    visitorId?: string;
    sessionId?: string;
}) {
    return [input.eventType, input.path, input.visitorId ?? "anon", input.sessionId ?? "anon"].join("::");
}

export async function POST(req: NextRequest) {
    const body = await readBoundedJson(req, 16 * 1024);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
    const rawBody = body.value;

    const payload = analyticsTrackSchema.safeParse(rawBody);

    if (!payload.success) {
        return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
    }

    if (!ANALYTICS_ALLOWED_EVENT_TYPES.has(payload.data.eventType)) {
        return NextResponse.json({ error: "Unsupported analytics event type" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (!supabaseUrl || !serviceRoleKey) {
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const supabase = createServiceClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    // Audio events may originate from a player embedded across many pages —
    // path is optional in the schema. Fall back to the Referer header (which
    // the browser supplies from the page that loaded the player) and finally
    // to "/" so the row is still inserted with a stable column value.
    let candidatePath = payload.data.path;
    if (!candidatePath) {
        const referer = req.headers.get("referer");
        if (referer) {
            try {
                candidatePath = new URL(referer).pathname;
            } catch {
                /* ignore malformed referer */
            }
        }
    }
    const normalizedPath = candidatePath ? normalizeAnalyticsPath(candidatePath) ?? "/" : "/";

    // Server-side canonical route derivation is authoritative. The browser may
    // provide pageSlug for legacy compatibility, but it must never override the
    // route-aware mapping because that lets a client-supplied slug bypass
    // locale/blog/system-route normalization and pollute a different page.
    const normalizedSlug = derivePageSlug(normalizedPath);
    const clientSlug = normalizeAnalyticsSlug(payload.data.pageSlug);
    const userAgent = sanitizeText(payload.data.userAgent || req.headers.get("user-agent") || "", 300) || "";
    const requestContext = extractAntiAbuseRequestContext(req.headers);
    const ipHash = requestContext.ipAddress ? hashValue(requestContext.ipAddress) : "unknown";
    const rateLimitFingerprint = hashValue([
        ipHash,
        payload.data.eventType,
        normalizedPath,
        userAgent.slice(0, 120),
    ].join("::"));
    const fingerprint = buildFingerprint({
        eventType: payload.data.eventType,
        path: normalizedPath,
        visitorId: payload.data.visitorId,
        sessionId: payload.data.sessionId,
    });

    let workspace;
    try {
        workspace = await resolvePublicWorkspace({
            requestHost: req.headers.get("host") ?? req.headers.get("x-forwarded-host") ?? req.nextUrl.host,
            expectedWorkspaceId: payload.data.workspaceId,
            lookupByDomain: (domain) => lookupActivePublicWorkspaceByDomain(supabase, domain),
        });
    } catch {
        return NextResponse.json({ error: "Analytics event does not match this site." }, { status: 409 });
    }
    const workspaceId = workspace.id;
    let contentId: string | null = null;
    if (normalizedSlug) {
        const { data: content } = await supabase.from("content_items").select("id")
            .eq("slug", normalizedSlug).eq("workspace_id", workspaceId).eq("status", "published").limit(1).maybeSingle();
        contentId = content?.id ?? null;
    }

    const analyticsClient = supabase as unknown as {
        from: (table: string) => {
            insert: (payload: unknown) => Promise<{ error: { message: string } | null }>;
            select: (query: string) => {
                eq: (column: string, value: string) => {
                    eq: (column: string, value: string) => {
                        gte: (column: string, value: string) => {
                            limit: (count: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
                        };
                    };
                    gte: (column: string, value: string) => Promise<{ count: number | null; error: { message: string } | null }>;
                };
            };
        };
    };

    const rateLimitSince = new Date(Date.now() - ANALYTICS_RATE_LIMIT_WINDOW_MS).toISOString();
    const [{ count: recentGlobalIpEvents }, { count: recentTenantIpEvents }] = await Promise.all([
        supabase.from("analytics_ingestion_logs").select("id", { count: "exact", head: true })
            .contains("metadata", { ipHash }).gte("created_at", rateLimitSince),
        supabase.from("analytics_ingestion_logs").select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId).contains("metadata", { ipHash }).gte("created_at", rateLimitSince),
    ]);

    const logIngestion = async (status: string, reason: string, extraMetadata: Record<string, unknown> = {}) => {
        await analyticsClient.from("analytics_ingestion_logs").insert({
            workspace_id: workspaceId,
            path: normalizedPath,
            event_type: payload.data.eventType,
            event_name: payload.data.eventType === "page_view"
                ? normalizedPath
                : sanitizeText(payload.data.eventName, 160) || normalizedPath,
            status,
            reason,
            request_fingerprint: rateLimitFingerprint,
            metadata: {
                pageSlug: normalizedSlug,
                clientPageSlug: clientSlug,
                referrer: sanitizeText(payload.data.referrer, 500),
                userAgent,
                ipHash,
                eventFingerprint: fingerprint,
                ...extraMetadata,
            },
        });
    };

    // Short-circuit BEFORE writing an ingestion-log row for any "ignored"
    // status. An attacker can rotate UA / path to defeat the fingerprint and
    // amplify this endpoint into unbounded log inserts; logging the rejection
    // is a debug nicety, not a security signal, so the cost isn't worth it.
    if ((recentGlobalIpEvents ?? 0) >= ANALYTICS_MAX_EVENTS_PER_WINDOW * 2
        || (recentTenantIpEvents ?? 0) >= ANALYTICS_MAX_EVENTS_PER_WINDOW) {
        return NextResponse.json({ ok: true, throttled: true });
    }

    if (isBotUserAgent(userAgent)) {
        return NextResponse.json({ ok: true, ignored: true });
    }

    if (normalizedPath.startsWith("/dashboard") || normalizedPath.startsWith("/login")) {
        return NextResponse.json({ ok: true, ignored: true });
    }

    if (payload.data.eventType === "page_view") {
        const dedupeSince = new Date(Date.now() - 30_000).toISOString();
        let duplicateQuery = supabase
            .from("analytics_events")
            .select("id", { count: "exact", head: true })
            .eq("event_type", "page_view")
            .eq("path", normalizedPath)
            .gte("created_at", dedupeSince);

        if (workspaceId) {
            duplicateQuery = duplicateQuery.eq("workspace_id", workspaceId);
        } else {
            duplicateQuery = duplicateQuery.is("workspace_id", null);
        }

        if (payload.data.visitorId) {
            duplicateQuery = duplicateQuery.eq("visitor_id", payload.data.visitorId);
        }

        if (payload.data.sessionId) {
            duplicateQuery = duplicateQuery.eq("session_id", payload.data.sessionId);
        }

        const { count: duplicateEvents } = await duplicateQuery;

        if ((duplicateEvents ?? 0) > 0) {
            await logIngestion("deduped", "recent_page_view", { dedupeSince });
            return NextResponse.json({ ok: true, deduped: true });
        }
    }

    const sanitizedEventName = payload.data.eventType === "page_view"
        ? normalizedPath
        : sanitizeText(payload.data.eventName, 160) || normalizedPath;
    const sanitizedMetadata = sanitizeAnalyticsMetadata(payload.data.eventType, payload.data.metadata);

    const { error } = await analyticsClient.from("analytics_events").insert({
            workspace_id: workspaceId,
            content_id: contentId,
            page_slug: normalizedSlug,
            event_type: payload.data.eventType,
            event_name: sanitizedEventName,
            visitor_id: sanitizeText(payload.data.visitorId, 120),
            session_id: sanitizeText(payload.data.sessionId, 120),
            referrer: sanitizeText(payload.data.referrer, 500),
            utm_source: sanitizeText(payload.data.utmSource, 120),
            utm_medium: sanitizeText(payload.data.utmMedium, 120),
            utm_campaign: sanitizeText(payload.data.utmCampaign, 120),
            path: normalizedPath,
            metadata: {
                ...sanitizedMetadata,
                userAgent,
                fingerprint,
                ipHash,
            },
        });

    if (error) {
        await logIngestion("failed", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logIngestion("accepted", "stored");

    return NextResponse.json({ ok: true });
}
