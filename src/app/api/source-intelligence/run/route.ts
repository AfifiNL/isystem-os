import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { enqueueDueSourceIntelligenceJobs } from "@/features/source-intelligence/run";
import { buildSourceIntelligenceRunResponse } from "@/features/source-intelligence/run-response";

export const maxDuration = 300;

function cronSecrets(): string[] {
    return [process.env.SOURCE_INTELLIGENCE_CRON_SECRET, process.env.CRON_SECRET]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value));
}

function isAuthorized(req: NextRequest): boolean {
    const authorization = req.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) return false;
    const candidate = Buffer.from(authorization.slice("Bearer ".length).trim());
    return cronSecrets().some((secret) => {
        const expected = Buffer.from(secret);
        return candidate.length === expected.length && timingSafeEqual(candidate, expected);
    });
}

function intParam(req: NextRequest, name: string, fallback: number): number {
    const raw = req.nextUrl.searchParams.get(name);
    const parsed = raw ? Number.parseInt(raw, 10) : fallback;
    return Number.isFinite(parsed) ? parsed : fallback;
}

function stringBodyValue(body: Record<string, unknown>, ...names: string[]): string | null {
    for (const name of names) {
        const value = body[name];
        if (typeof value === "string" && value.trim()) return value.trim();
    }
    return null;
}

function numericBodyValue(body: Record<string, unknown>, ...names: string[]): number | null {
    for (const name of names) {
        const value = body[name];
        const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
        if (Number.isFinite(parsed)) return parsed;
    }
    return null;
}

function unauthorizedResponse() {
    return NextResponse.json({ ok: false, timestamp: new Date().toISOString(), error: "Unauthorized" }, { status: 401 });
}

export async function GET(req: NextRequest) {
    if (!isAuthorized(req)) return unauthorizedResponse();
    try {
        const requestedAt = new Date().toISOString();
        const drainLimit = intParam(req, "limit", intParam(req, "drain", 0));
        const result = await enqueueDueSourceIntelligenceJobs({
            workspaceId: req.nextUrl.searchParams.get("workspace_id") ?? req.nextUrl.searchParams.get("workspace"),
            registryId: req.nextUrl.searchParams.get("registry_id"),
            reason: "scheduled",
            trigger: req.nextUrl.searchParams.get("trigger") === "cron" ? "cron" : "api",
            drainLimit,
            requestedAt,
        });
        return NextResponse.json(buildSourceIntelligenceRunResponse(result));
    } catch (error) {
        console.error("[source-intelligence/run] GET failed", error);
        return NextResponse.json({ ok: false, timestamp: new Date().toISOString(), error: error instanceof Error ? error.message : "Run failed" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    if (!isAuthorized(req)) return unauthorizedResponse();
    try {
        const body = await req.json().catch(() => ({})) as Record<string, unknown>;
        const requestedAt = new Date().toISOString();
        const trigger = body.trigger === "cron" || body.trigger === "dashboard" || body.trigger === "worker" ? body.trigger : "api";
        const result = await enqueueDueSourceIntelligenceJobs({
            workspaceId: stringBodyValue(body, "workspace_id", "workspace"),
            registryId: stringBodyValue(body, "registry_id", "registry"),
            reason: body.reason === "manual" || body.reason === "backfill" || body.reason === "retry" ? body.reason : "scheduled",
            trigger,
            drainLimit: numericBodyValue(body, "limit", "drain") ?? 3,
            startedBy: typeof body.started_by === "string" ? body.started_by : null,
            requestedAt,
        });
        return NextResponse.json(buildSourceIntelligenceRunResponse(result));
    } catch (error) {
        console.error("[source-intelligence/run] POST failed", error);
        return NextResponse.json({ ok: false, timestamp: new Date().toISOString(), error: error instanceof Error ? error.message : "Run failed" }, { status: 500 });
    }
}
