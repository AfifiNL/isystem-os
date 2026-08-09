import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { resolveWorkspaceContext, getCurrentUserRole } from "@/shared/lib/workspace/context";

const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const PUBLIC_VIDEOS_BUCKET = "public-videos";

export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        const body = (await req.json()) as { pathname: string; contentType: string; size?: number };
        const { pathname, contentType, size } = body;

        if (!pathname || !contentType) {
            return NextResponse.json({ error: "Missing pathname or contentType" }, { status: 400 });
        }

        if (!ALLOWED_VIDEO_TYPES.includes(contentType)) {
            return NextResponse.json({ error: `Unsupported content type: ${contentType}` }, { status: 400 });
        }

        if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) {
            return NextResponse.json({ error: "Missing or invalid file size" }, { status: 400 });
        }

        if (size > MAX_VIDEO_BYTES) {
            return NextResponse.json({ error: "Video file exceeds the 500MB limit" }, { status: 400 });
        }

        // Authenticate user
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Authorize user role
        const role = await getCurrentUserRole();
        if (!role || (role.role !== "admin" && role.role !== "manager")) {
            return NextResponse.json({ error: "Manager or admin role required" }, { status: 403 });
        }

        // Get active workspace context
        const ctx = await resolveWorkspaceContext();
        const workspaceId = ctx?.activeWorkspace?.id;
        if (!workspaceId) {
            return NextResponse.json({ error: "No active workspace" }, { status: 400 });
        }

        // Enforce workspace path scoping
        if (!pathname.startsWith(`videos/${workspaceId}/`) || pathname.includes("..") || pathname.endsWith("/")) {
            return NextResponse.json({ error: "Upload path must be scoped to active workspace" }, { status: 400 });
        }

        // Generate signed upload URL from Supabase Storage with the service role.
        // The route has already authenticated and authorized the manager/admin,
        // so the privileged client is only used to mint the short-lived upload credential.
        const adminSupabase = createAdminClient();
        const { data, error } = await adminSupabase.storage
            .from(PUBLIC_VIDEOS_BUCKET)
            .createSignedUploadUrl(pathname);

        if (error || !data) {
            return NextResponse.json({ error: error?.message || "Failed to generate upload URL" }, { status: 500 });
        }

        const { data: publicData } = adminSupabase.storage
            .from(PUBLIC_VIDEOS_BUCKET)
            .getPublicUrl(pathname);

        return NextResponse.json({
            uploadUrl: data.signedUrl,
            path: data.path,
            token: data.token,
            publicUrl: publicData.publicUrl,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Upload token error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
