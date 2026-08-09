import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { resolveWorkspaceContext } from "@/shared/lib/workspace/context";
import { deriveExtension, isSafeImageMime, processRasterUpload } from "@/shared/lib/images/process-upload";

/**
 * Workspace desktop wallpaper upload. Reuses the same image pipeline as the
 * site-chrome asset uploader: processRasterUpload strips EXIF, clamps the max
 * edge to 2400px, and re-encodes raster inputs to WebP. Only workspace admins
 * (owner_profile_id or memberships.role='admin') can upload so a manager
 * can't repaint the desktop for the rest of the team.
 */
export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceContext = await resolveWorkspaceContext();
    const workspace = workspaceContext?.activeWorkspace;

    if (!workspace?.id) {
        return NextResponse.json({ error: "No active workspace found." }, { status: 400 });
    }

    // Only owners / admins can change the desktop wallpaper.
    const isOwner = workspace.owner_profile_id === user.id;
    const isAdmin = workspaceContext?.role === "admin";
    if (!isOwner && !isAdmin) {
        return NextResponse.json(
            { error: "Only workspace admins can change the wallpaper." },
            { status: 403 },
        );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (!supabaseUrl || !serviceRoleKey) {
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const serviceClient = createServiceClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
        return NextResponse.json({ error: "A file upload is required" }, { status: 400 });
    }

    const MAX_INPUT_BYTES = 15 * 1024 * 1024; // 15 MB
    if (file.size > MAX_INPUT_BYTES) {
        return NextResponse.json(
            { error: "Wallpaper must be 15 MB or smaller." },
            { status: 413 },
        );
    }

    // Reject by client-supplied MIME first so we can fail fast and avoid
    // letting an attacker-claimed image/svg+xml or text/html buffer reach the
    // sharp pipeline at all.
    if (!isSafeImageMime(file.type)) {
        return NextResponse.json(
            { error: "Only PNG, JPEG, WebP, AVIF, or GIF images are accepted." },
            { status: 415 },
        );
    }

    const rawName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const rawBuffer = Buffer.from(await file.arrayBuffer());
    const originalExt = deriveExtension(rawName);
    const processed = await processRasterUpload(rawBuffer, file.type, originalExt);

    // Hard gate: reject anything that didn't end up as a safe raster image.
    // The previous startsWith("image/") allowed image/svg+xml through, which
    // renders as HTML and executes script when navigated directly.
    if (!isSafeImageMime(processed.contentType)) {
        return NextResponse.json(
            { error: "File contents did not produce a safe image output." },
            { status: 415 },
        );
    }

    const baseName = rawName.replace(/\.[^.]+$/, "") || "wallpaper";
    const safeName = `${baseName}.${processed.extension}`;
    const filePath = `generated/workspace-wallpaper/${workspace.id}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await serviceClient.storage
        .from("public-media")
        .upload(filePath, processed.buffer, {
            contentType: processed.contentType,
            cacheControl: "public, max-age=31536000, immutable",
            upsert: false,
        });

    if (uploadError) {
        return NextResponse.json(
            { error: uploadError.message ?? "Failed to upload wallpaper" },
            { status: 500 },
        );
    }

    const { data: publicUrl } = serviceClient.storage.from("public-media").getPublicUrl(filePath);

    // Persist the new URL directly here so a failed follow-up save doesn't
    // leave an orphaned storage object with no DB row pointing at it.
    const { error: updateError } = await serviceClient
        .from("workspaces")
        .update({
            wallpaper_url: publicUrl.publicUrl,
            updated_at: new Date().toISOString(),
        })
        .eq("id", workspace.id);

    if (updateError) {
        // Attempt best-effort cleanup so we don't leak storage on a failed
        // DB update.
        await serviceClient.storage.from("public-media").remove([filePath]).catch(() => undefined);
        return NextResponse.json(
            { error: updateError.message ?? "Failed to save wallpaper." },
            { status: 500 },
        );
    }

    // Re-render every dashboard route so the new wallpaper shows up server-
    // side immediately. The desktop-tab also calls router.refresh() but that
    // alone leaves cached server segments stale on Vercel until the next full
    // navigation. Pair them so the wallpaper "just appears" after upload.
    revalidatePath("/dashboard", "layout");

    return NextResponse.json({
        asset: {
            name: safeName,
            url: publicUrl.publicUrl,
            path: filePath,
            contentType: processed.contentType,
            width: processed.width,
            height: processed.height,
            size: processed.buffer.length,
            optimized: processed.didProcess,
        },
    });
}

/**
 * DELETE clears the wallpaper so the default gradient is restored. Does not
 * attempt to remove the stored file because multiple workspaces may have been
 * spun up from the same template image. Storage GC happens on a separate job.
 */
export async function DELETE() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceContext = await resolveWorkspaceContext();
    const workspace = workspaceContext?.activeWorkspace;

    if (!workspace?.id) {
        return NextResponse.json({ error: "No active workspace found." }, { status: 400 });
    }

    const isOwner = workspace.owner_profile_id === user.id;
    const isAdmin = workspaceContext?.role === "admin";
    if (!isOwner && !isAdmin) {
        return NextResponse.json(
            { error: "Only workspace admins can change the wallpaper." },
            { status: 403 },
        );
    }

    // Use the service-role client so admins who are not the workspace owner
    // can clear the wallpaper. The RLS UPDATE policy on `workspaces` requires
    // is_workspace_owner(id), which would otherwise silently no-op for
    // workspace admins (UPDATE returns no error but mutates zero rows). We
    // already gated the request on owner-OR-admin above, so bypassing RLS
    // here is intentional and matches what the upload handler does.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (!supabaseUrl || !serviceRoleKey) {
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const serviceClient = createServiceClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await serviceClient
        .from("workspaces")
        .update({ wallpaper_url: null, updated_at: new Date().toISOString() })
        .eq("id", workspace.id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidatePath("/dashboard", "layout");

    return NextResponse.json({ ok: true });
}
