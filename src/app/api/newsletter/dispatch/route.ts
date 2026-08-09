import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runNewsletterDispatchCycle } from "@/features/newsletter/service";
import { runTransactionalEmailDispatchCycle } from "@/features/communications/transactional-email";

// Accept either secret so the same endpoint works for:
//  - the Vercel cron (which sends `Authorization: Bearer ${CRON_SECRET}`)
//  - manual operator triggers via the dashboard "Run dispatch cycle" button
//    (which signs with the workspace-managed NEWSLETTER_DISPATCH_SECRET).
function getAcceptedSecrets(): string[] {
    return [process.env.NEWSLETTER_DISPATCH_SECRET, process.env.CRON_SECRET]
        .map((v) => v?.trim())
        .filter((v): v is string => Boolean(v));
}

function authorize(req: NextRequest): boolean {
    const header = req.headers.get("authorization");
    if (!header?.startsWith("Bearer ")) return false;
    const candidate = header.slice("Bearer ".length).trim();
    const cBuf = Buffer.from(candidate);
    return getAcceptedSecrets().some((secret) => {
        const sBuf = Buffer.from(secret);
        if (cBuf.length !== sBuf.length) return false;
        return timingSafeEqual(cBuf, sBuf);
    });
}

export async function POST(req: NextRequest) {
    if (getAcceptedSecrets().length === 0) {
        return NextResponse.json(
            { ok: false, error: "Dispatch endpoint is not configured." },
            { status: 503 },
        );
    }

    if (!authorize(req)) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
        const [newsletter, transactional] = await Promise.all([
            runNewsletterDispatchCycle(),
            runTransactionalEmailDispatchCycle(),
        ]);
        return NextResponse.json({ ok: true, ...newsletter, transactional });
    } catch (error) {
        return NextResponse.json(
            { ok: false, error: error instanceof Error ? error.message : "Dispatch cycle failed." },
            { status: 500 },
        );
    }
}

// Vercel cron uses GET by default; accept either method so the route
// works whether configured as a cron job or invoked manually via POST.
export const GET = POST;
