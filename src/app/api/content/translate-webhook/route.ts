import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { enqueueContentTranslationJob } from "@/features/blog/translation-jobs";
import { createAdminClient } from "@/shared/lib/supabase/admin";

const requestSchema = z.object({
    id: z.string().uuid(),
}).strict();

function isAuthorized(req: Request): boolean {
    const secret = process.env.BLOG_TRANSLATION_WEBHOOK_SECRET?.trim();
    const authorization = req.headers.get("authorization");
    if (!secret || !authorization?.startsWith("Bearer ")) return false;

    const candidate = Buffer.from(authorization.slice("Bearer ".length), "utf8");
    const expected = Buffer.from(secret, "utf8");
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export async function POST(req: Request) {
    if (!isAuthorized(req)) {
        console.warn(
            "[translate-webhook] Unauthorized request or missing webhook secret configuration.",
        );
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const parsed = requestSchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json(
                { error: "A valid content item ID is required." },
                { status: 400 },
            );
        }

        const supabase = createAdminClient();
        const { data: post, error: fetchError } = await supabase
            .from("content_items")
            .select("id,workspace_id,type,status,locale,updated_at")
            .eq("id", parsed.data.id)
            .maybeSingle();

        if (fetchError || !post) {
            console.error(
                `[translate-webhook] Failed to retrieve content item ${parsed.data.id}:`,
                fetchError?.message,
            );
            return NextResponse.json({ error: "Content item not found." }, { status: 404 });
        }

        if (post.type !== "blog" || post.status !== "published" || post.locale !== "en") {
            return NextResponse.json({
                skipped: true,
                reason: "Not a published English blog post.",
            });
        }
        if (!post.workspace_id) {
            return NextResponse.json(
                { error: "Content item is not assigned to a workspace." },
                { status: 409 },
            );
        }

        const queued = await enqueueContentTranslationJob({
            workspaceId: post.workspace_id,
            contentId: post.id,
            sourceVersion: post.updated_at,
            targetLocales: ["nl", "ar"],
        }, supabase);

        return NextResponse.json(
            {
                accepted: true,
                jobId: queued.jobId,
                jobStatus: queued.status,
                deduplicated: queued.deduplicated,
            },
            { status: 202 },
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[translate-webhook] Endpoint handler exception:", message);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}

export const dynamic = "force-dynamic";
