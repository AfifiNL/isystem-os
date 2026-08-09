import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { processPendingVoiceMemosForCron } from "@/features/productivity/recorder/actions";

export const maxDuration = 300;

function acceptedSecrets(): string[] {
    return [process.env.VOICE_MEMO_PROCESSING_SECRET, process.env.CRON_SECRET]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value));
}

function authorize(req: NextRequest): boolean {
    const header = req.headers.get("authorization");
    if (!header?.startsWith("Bearer ")) return false;
    const candidate = Buffer.from(header.slice("Bearer ".length).trim());
    return acceptedSecrets().some((secret) => {
        const expected = Buffer.from(secret);
        return candidate.length === expected.length && timingSafeEqual(candidate, expected);
    });
}

function boundedLimit(value: unknown, fallback = 3): number {
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.min(10, Math.trunc(parsed)));
}

function unauthorizedResponse() {
    return NextResponse.json({ ok: false, timestamp: new Date().toISOString(), error: "Unauthorized" }, { status: 401 });
}

function notConfiguredResponse() {
    return NextResponse.json(
        { ok: false, timestamp: new Date().toISOString(), error: "Voice memo processing endpoint is not configured." },
        { status: 503 },
    );
}

function processResponse(result: Awaited<ReturnType<typeof processPendingVoiceMemosForCron>>) {
    return NextResponse.json({
        ok: !result.error,
        timestamp: new Date().toISOString(),
        attempted: result.attempted,
        processed: result.processed,
        failed: result.failed,
        skipped: result.skipped,
        error: result.error,
    }, { status: result.error ? 500 : 200 });
}

export async function GET(req: NextRequest) {
    if (acceptedSecrets().length === 0) return notConfiguredResponse();
    if (!authorize(req)) return unauthorizedResponse();

    const limit = boundedLimit(req.nextUrl.searchParams.get("limit"));
    const result = await processPendingVoiceMemosForCron(limit);
    return processResponse(result);
}

export async function POST(req: NextRequest) {
    if (acceptedSecrets().length === 0) return notConfiguredResponse();
    if (!authorize(req)) return unauthorizedResponse();

    const body = await req.json().catch(() => ({})) as { limit?: unknown };
    const limit = boundedLimit(body.limit ?? req.nextUrl.searchParams.get("limit"));
    const result = await processPendingVoiceMemosForCron(limit);
    return processResponse(result);
}
