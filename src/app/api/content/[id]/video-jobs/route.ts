import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { assertAuthorizedContentAccess } from "@/shared/lib/workspace/context";

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const { id } = params;

    if (!id) {
        return NextResponse.json({ error: "Content ID is required" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        console.error("[api/content/video-jobs] Missing Supabase environment variables");
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    // Use service_role because the client making the UI request might be a manager
    // We can fetch data related to the content item safely.
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });

    try {
        await assertAuthorizedContentAccess(id, { requireAiEnabled: true });

        const { data: jobs, error } = await supabase
            .from("video_render_jobs")
            .select("*")
            .eq("content_id", id)
            .order("created_at", { ascending: false });

        if (error) {
            console.error(`[api/content/video-jobs] Database error for ${id}:`, error);
            return NextResponse.json({ error: "Failed to fetch video jobs" }, { status: 500 });
        }

        // Generate signed URLs for completed jobs
        const jobsWithUrls = await Promise.all(
            jobs.map(async (job) => {
                if (job.status === "completed" && job.result_video_url) {
                    const { data } = await supabase.storage
                        .from("protected-videos")
                        .createSignedUrl(job.result_video_url, 3600);
                    return { ...job, signedUrl: data?.signedUrl || null };
                }
                return job;
            })
        );

        return NextResponse.json({ jobs: jobsWithUrls });
    } catch (err) {
        if (err instanceof Error) {
            if (err.message === "AI generation is only available on Pro workspaces.") {
                return NextResponse.json({ error: err.message }, { status: 403 });
            }

            if (err.message === "Unauthorized: No active workspace session found.") {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }

            if (err.message === "Content item not found.") {
                return NextResponse.json({ error: err.message }, { status: 404 });
            }

            if (err.message === "Forbidden: content is outside the active workspace scope.") {
                return NextResponse.json({ error: err.message }, { status: 403 });
            }
        }

        console.error("[api/content/video-jobs] Unexpected error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
