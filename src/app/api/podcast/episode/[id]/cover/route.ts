import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
    assertWorkspaceAdminOrManager,
    assertWorkspaceAiEnabled,
} from "@/shared/lib/workspace/context";
import { isSafeImageMime } from "@/shared/lib/images/process-upload";

export const runtime = "nodejs";
// 4 MB max + sharp re-encode + storage upload — 30s gives comfortable headroom
// over the default 10s function timeout on Vercel.
export const maxDuration = 30;

const COVER_BUCKET = "audio-episodes"; // same bucket the generator writes to
const MAX_BYTES = 4 * 1024 * 1024;
const COVER_TARGET_PX = 1400; // matches the generator output size

function getServiceClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Server configuration error.");
    }
    return createServiceClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
    let workspaceId: string;
    try {
        const ctx = await assertWorkspaceAiEnabled();
        await assertWorkspaceAdminOrManager();
        workspaceId = ctx.activeWorkspace.id;
    } catch (err: unknown) {
        const status = err instanceof Error && err.message.startsWith("Unauthorized") ? 401 : 403;
        return NextResponse.json({ error: err instanceof Error ? err.message : "Forbidden" }, { status });
    }

    const { id: episodeId } = await context.params;
    if (!episodeId) {
        return NextResponse.json({ error: "Episode id required" }, { status: 400 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
        return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!isSafeImageMime(file.type)) {
        return NextResponse.json(
            { error: "Unsupported file type. Use PNG, JPEG, WEBP, or AVIF." },
            { status: 415 },
        );
    }
    if (file.size > MAX_BYTES) {
        return NextResponse.json(
            { error: `File too large. Max ${MAX_BYTES / (1024 * 1024)} MB.` },
            { status: 413 },
        );
    }

    let supabase;
    try {
        supabase = getServiceClient();
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
    }

    // Confirm the episode lives in the active workspace before touching storage
    // — service-role bypasses RLS so we must enforce tenant scope here.
    const { data: episode, error: episodeError } = await supabase
        .from("podcast_episodes")
        .select("id, workspace_id")
        .eq("id", episodeId)
        .maybeSingle();
    if (episodeError || !episode || episode.workspace_id !== workspaceId) {
        return NextResponse.json({ error: "Episode not found" }, { status: 404 });
    }

    // Re-encode through sharp: strips EXIF, normalizes to JPEG at the same
    // 1:1 / 1400px shape the generator produces. Keeps storage costs and
    // RSS-feed byte sizes predictable.
    let optimized: Buffer;
    try {
        const raw = Buffer.from(await file.arrayBuffer());
        optimized = await sharp(raw)
            .resize(COVER_TARGET_PX, COVER_TARGET_PX, { fit: "cover", position: "attention" })
            .jpeg({ quality: 88, mozjpeg: true })
            .toBuffer();
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Image processing failed." },
            { status: 415 },
        );
    }

    // Path matches the generator path so a manual upload overwrites the
    // AI-generated cover instead of orphaning it.
    const coverPath = `${workspaceId}/${episodeId}/cover.jpg`;
    const { error: uploadErr } = await supabase.storage
        .from(COVER_BUCKET)
        .upload(coverPath, optimized, {
            contentType: "image/jpeg",
            upsert: true,
            cacheControl: "public, max-age=31536000, immutable",
        });
    if (uploadErr) {
        return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    const { data: pub } = supabase.storage.from(COVER_BUCKET).getPublicUrl(coverPath);
    // Append a cache-buster so the dashboard <img> reflects the new upload
    // without requiring a hard refresh. The storage cache header still wins
    // for CDN edge caching long-term.
    const cacheBustedUrl = `${pub.publicUrl}?v=${Date.now()}`;

    const { error: updateError } = await supabase
        .from("podcast_episodes")
        .update({ cover_art_url: cacheBustedUrl })
        .eq("id", episodeId)
        .eq("workspace_id", workspaceId);
    if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ url: cacheBustedUrl });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
    let workspaceId: string;
    try {
        const ctx = await assertWorkspaceAiEnabled();
        await assertWorkspaceAdminOrManager();
        workspaceId = ctx.activeWorkspace.id;
    } catch (err: unknown) {
        const status = err instanceof Error && err.message.startsWith("Unauthorized") ? 401 : 403;
        return NextResponse.json({ error: err instanceof Error ? err.message : "Forbidden" }, { status });
    }

    const { id: episodeId } = await context.params;
    if (!episodeId) {
        return NextResponse.json({ error: "Episode id required" }, { status: 400 });
    }

    let supabase;
    try {
        supabase = getServiceClient();
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
    }

    const { data: episode, error: episodeError } = await supabase
        .from("podcast_episodes")
        .select("id, workspace_id")
        .eq("id", episodeId)
        .maybeSingle();
    if (episodeError || !episode || episode.workspace_id !== workspaceId) {
        return NextResponse.json({ error: "Episode not found" }, { status: 404 });
    }

    const coverPath = `${workspaceId}/${episodeId}/cover.jpg`;
    // Best-effort storage delete — if the object's already gone we still want
    // to clear the DB pointer.
    await supabase.storage.from(COVER_BUCKET).remove([coverPath]);

    const { error: updateError } = await supabase
        .from("podcast_episodes")
        .update({ cover_art_url: null })
        .eq("id", episodeId)
        .eq("workspace_id", workspaceId);
    if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
