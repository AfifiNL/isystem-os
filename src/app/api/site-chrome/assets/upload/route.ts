import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { resolveWorkspaceContext } from "@/shared/lib/workspace/context";
import { deriveExtension, isSafeImageMime, processRasterUpload } from "@/shared/lib/images/process-upload";
import { checkAiRateLimitPg } from "@/shared/lib/ai/metering";

const MAX_INPUT_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_REQUEST_BYTES = MAX_INPUT_BYTES + 1024 * 1024;
const MAX_WORKSPACE_STORAGE_BYTES = 100 * 1024 * 1024;
const ALLOWED_TARGETS = new Set(["navbarLogo", "footerLogo", "favicon"]);

export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceContext = await resolveWorkspaceContext();
    const workspaceId = workspaceContext?.activeWorkspace?.id;

    if (!workspaceId) {
        return NextResponse.json({ error: "No active workspace found." }, { status: 400 });
    }
    if ((workspaceContext.role !== "admin" && workspaceContext.role !== "manager")
        || !workspaceContext.effectiveCapabilities.includes("theme.manage")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const contentLength = Number(req.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
        return NextResponse.json({ error: "Request too large." }, { status: 413 });
    }
    const rate = await checkAiRateLimitPg(workspaceId, "site-chrome-assets-upload", { maxPerWindow: 10 });
    if (!rate.allowed) {
        return NextResponse.json({ error: "Too many uploads." }, { status: 429 });
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
    const target = String(formData.get("target") ?? "asset");
    if (!ALLOWED_TARGETS.has(target)) {
        return NextResponse.json({ error: "Invalid asset target." }, { status: 400 });
    }

    if (!(file instanceof File)) {
        return NextResponse.json({ error: "A file upload is required" }, { status: 400 });
    }

    if (file.size > MAX_INPUT_BYTES) {
        return NextResponse.json(
            { error: `File too large. Max ${MAX_INPUT_BYTES / (1024 * 1024)} MB.` },
            { status: 413 },
        );
    }

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
    const { data: existingFiles, error: quotaError } = await serviceClient.storage
        .from("public-media")
        .list(`generated/site-chrome/${workspaceId}`, { limit: 1000 });
    if (quotaError) {
        return NextResponse.json({ error: "Storage quota could not be verified." }, { status: 503 });
    }
    const storedBytes = (existingFiles ?? []).reduce((total, item) => {
        const size = typeof item.metadata?.size === "number" ? item.metadata.size : 0;
        return total + size;
    }, 0);
    if (storedBytes + processed.buffer.length > MAX_WORKSPACE_STORAGE_BYTES) {
        return NextResponse.json({ error: "Workspace asset quota exceeded." }, { status: 413 });
    }

    // Hard gate before we hand bytes to a publicly served bucket.
    // See SAFE_IMAGE_MIME_TYPES note in process-upload.ts.
    if (!isSafeImageMime(processed.contentType)) {
        return NextResponse.json(
            { error: "File contents did not produce a safe image output." },
            { status: 415 },
        );
    }

    const baseName = rawName.replace(/\.[^.]+$/, "") || "upload";
    const safeName = `${baseName}.${processed.extension}`;
    const filePath = `generated/site-chrome/${workspaceId}/${target}-${Date.now()}-${safeName}`;

    const { error: uploadError } = await serviceClient.storage
        .from("public-media")
        .upload(filePath, processed.buffer, {
            contentType: processed.contentType,
            cacheControl: "public, max-age=31536000, immutable",
            upsert: false,
        });

    if (uploadError) {
        return NextResponse.json({ error: "Failed to upload asset" }, { status: 500 });
    }

    const { data: publicUrl } = serviceClient.storage.from("public-media").getPublicUrl(filePath);

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
