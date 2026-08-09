import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { assertWorkspaceAdminOrManager } from "@/shared/lib/workspace/context";
import {
    isSafeImageMime,
    processRasterUpload,
} from "@/shared/lib/images/process-upload";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

export const runtime = "nodejs";
// Vercel functions default to 10s, which is too tight for a 4 MB upload over
// a slow connection plus the sharp re-encode. The earlier
// `net::ERR_TIMED_OUT` reports were the platform timeout firing partway
// through the upload. 60s gives us ~50s of slack on the slowest realistic
// connection and is well under any platform plan ceiling.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
    try {
        await assertWorkspaceAdminOrManager();
    } catch (err: unknown) {
        const status = err instanceof Error && err.message.startsWith("Unauthorized") ? 401 : 403;
        return NextResponse.json({ error: err instanceof Error ? err.message : "Forbidden" }, { status });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
        return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!isSafeImageMime(file.type)) {
        return NextResponse.json({ error: "Unsupported file type. Use PNG, JPEG, WEBP, AVIF, or GIF." }, { status: 415 });
    }
    if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: `File too large. Max ${MAX_BYTES / (1024 * 1024)} MB.` }, { status: 413 });
    }

    // Re-encode raster inputs through sharp the same way the other upload
    // routes do — strips EXIF, clamps dimensions, normalizes to WebP. Avatars
    // come straight from a phone or screenshot in practice, so the resize is
    // typically what makes the upload finish in time.
    const rawBuffer = Buffer.from(await file.arrayBuffer());
    const processed = await processRasterUpload(rawBuffer, file.type, file.type.split("/")[1] || "bin");
    if (!isSafeImageMime(processed.contentType)) {
        return NextResponse.json(
            { error: "File contents did not produce a safe image output." },
            { status: 415 },
        );
    }

    // Service-role client. Author avatars live in a public bucket and the
    // route is already gated by assertWorkspaceAdminOrManager — using the
    // anon-bound `createClient(...)` here forces the storage upload to run
    // an extra RLS check on every byte, which is exactly the latency that
    // was tipping us over the 10s function timeout.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!supabaseUrl || !serviceRoleKey) {
        return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
    }
    const supabase = createServiceClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    const path = `${randomUUID()}.${processed.extension}`;
    const { error: uploadErr } = await supabase
        .storage
        .from("author-avatars")
        .upload(path, processed.buffer, {
            contentType: processed.contentType,
            cacheControl: "31536000",
            upsert: false,
        });
    if (uploadErr) {
        return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    const { data: pub } = supabase.storage.from("author-avatars").getPublicUrl(path);
    if (!pub?.publicUrl) {
        return NextResponse.json({ error: "Failed to resolve public URL." }, { status: 500 });
    }

    return NextResponse.json({ url: pub.publicUrl });
}
