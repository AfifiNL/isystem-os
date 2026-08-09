import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { assertAuthorizedContentAccess } from "@/shared/lib/workspace/context";
import { deriveExtension, isSafeImageMime, processRasterUpload } from "@/shared/lib/images/process-upload";

const MAX_INPUT_BYTES = 15 * 1024 * 1024; // 15 MB

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const { id } = await props.params;

    if (!id) {
        return NextResponse.json({ error: "Content ID is required" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (!supabaseUrl || !serviceRoleKey) {
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    try {
        await assertAuthorizedContentAccess(id);

        const formData = await req.formData();
        const file = formData.get("file");

        if (!(file instanceof File)) {
            return NextResponse.json({ error: "A file upload is required" }, { status: 400 });
        }

        if (file.size > MAX_INPUT_BYTES) {
            return NextResponse.json(
                { error: `File too large. Max ${MAX_INPUT_BYTES / (1024 * 1024)} MB.` },
                { status: 413 },
            );
        }

        // Reject by client-supplied MIME first so we don't waste a sharp pass
        // on something we'll refuse anyway. The post-process check below is
        // the actual security boundary.
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

        // Hard gate before we hand bytes to public storage. processRasterUpload
        // re-encodes raster inputs to image/webp; anything else (SVG, HTML
        // disguised as image/*, etc.) falls through with the client-claimed
        // MIME, which would otherwise be served verbatim as that Content-Type
        // by the public bucket. See SAFE_IMAGE_MIME_TYPES note in process-upload.ts.
        if (!isSafeImageMime(processed.contentType)) {
            return NextResponse.json(
                { error: "File contents did not produce a safe image output." },
                { status: 415 },
            );
        }

        const baseName = rawName.replace(/\.[^.]+$/, "") || "upload";
        const safeName = `${baseName}.${processed.extension}`;
        // Neutral folder (formerly `generated/`). The old prefix leaked into
        // public OG image URLs and read as an AI-pipeline tell.
        const filePath = `articles/${id}/${Date.now()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
            .from("public-media")
            .upload(filePath, processed.buffer, {
                contentType: processed.contentType,
                cacheControl: "public, max-age=31536000, immutable",
                upsert: false,
            });

        if (uploadError) {
            console.error("[api/content/assets/upload] Upload error:", uploadError);
            return NextResponse.json({ error: "Failed to upload asset" }, { status: 500 });
        }

        const { data: publicUrl } = supabase.storage.from("public-media").getPublicUrl(filePath);

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
    } catch (error) {
        if (error instanceof Error) {
            if (error.message === "Unauthorized: No active workspace session found.") {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }

            if (error.message === "Content item not found.") {
                return NextResponse.json({ error: error.message }, { status: 404 });
            }

            if (error.message === "Forbidden: content is outside the active workspace scope.") {
                return NextResponse.json({ error: error.message }, { status: 403 });
            }
        }

        console.error("[api/content/assets/upload] Unexpected error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
