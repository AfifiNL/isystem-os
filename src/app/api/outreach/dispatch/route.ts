import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runOutreachDispatchCycle } from "@/features/outreach/dispatch";

function acceptedSecrets() {
    return [process.env.OUTREACH_DISPATCH_SECRET, process.env.CRON_SECRET]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value));
}

function authorize(req: NextRequest) {
    const header = req.headers.get("authorization");
    if (!header?.startsWith("Bearer ")) return false;
    const candidate = Buffer.from(header.slice("Bearer ".length).trim());
    return acceptedSecrets().some((secret) => {
        const expected = Buffer.from(secret);
        return candidate.length === expected.length && timingSafeEqual(candidate, expected);
    });
}

export async function POST(req: NextRequest) {
    if (acceptedSecrets().length === 0) {
        return NextResponse.json({ ok: false, error: "Outreach dispatch endpoint is not configured." }, { status: 503 });
    }
    if (!authorize(req)) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({})) as { limit?: unknown };
    const parsedLimit = typeof body.limit === "number" ? body.limit : Number(body.limit);
    const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(25, Math.trunc(parsedLimit))) : 10;
    const result = await runOutreachDispatchCycle(limit);
    return NextResponse.json({ ok: true, ...result });
}

export const GET = POST;
