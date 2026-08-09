import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { processNextIndexingJob } from "@/features/seo/indexing/service";

export const maxDuration = 300;

function acceptedSecrets() {
    return [process.env.SEO_INDEXING_SECRET, process.env.CRON_SECRET]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value));
}

function isAuthorized(authHeader: string | null) {
    if (!authHeader?.startsWith("Bearer ")) return false;
    const candidate = Buffer.from(authHeader.slice("Bearer ".length).trim());
    return acceptedSecrets().some((secret) => {
        const expected = Buffer.from(secret);
        return candidate.length === expected.length && timingSafeEqual(candidate, expected);
    });
}

export async function POST(request: Request) {
    if (!isAuthorized(request.headers.get("authorization"))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({})) as { limit?: unknown };
    const limit = Math.min(20, Math.max(1, typeof body.limit === "number" ? Math.floor(body.limit) : 5));
    const results = [];

    for (let index = 0; index < limit; index += 1) {
        const result = await processNextIndexingJob();
        results.push(result);
        if (result.message === "No queued indexing jobs found.") {
            break;
        }
    }

    return NextResponse.json({
        ok: results.every((result) => result.success),
        processed: results.filter((result) => result.jobId).length,
        results,
    });
}
