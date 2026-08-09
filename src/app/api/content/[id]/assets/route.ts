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
        console.error("[api/content/assets] Missing Supabase environment variables");
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    // Initialize Supabase client with Service Role Key to bypass RLS for server-to-server ops
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });

    try {
        await assertAuthorizedContentAccess(id);

        // List from both the current `articles/` path (new uploads) AND the
        // legacy `generated/` path (assets created before the rename). Old
        // assets still have their absolute URLs stored on content_items, so
        // they continue to render; this list endpoint just needs to surface
        // them in the admin UI.
        const folderPaths = [`articles/${id}`, `generated/${id}`];
        const listed = await Promise.all(
            folderPaths.map(async (folderPath) => {
                const { data, error } = await supabase.storage
                    .from("public-media")
                    .list(folderPath, {
                        limit: 100,
                        offset: 0,
                        sortBy: { column: "created_at", order: "desc" },
                    });
                if (error) {
                    console.error(`[api/content/assets] Storage list error for ${id} (${folderPath}):`, error);
                    return [] as Array<{ folderPath: string; file: typeof data extends Array<infer T> ? T : never }>;
                }
                return (data ?? []).map((file) => ({ folderPath, file }));
            }),
        );

        const assets = listed
            .flat()
            .filter(({ file }) => file.name !== ".emptyFolderPlaceholder")
            .map(({ folderPath, file }) => {
                const { data: urlData } = supabase.storage
                    .from("public-media")
                    .getPublicUrl(`${folderPath}/${file.name}`);

                return {
                    name: file.name,
                    id: file.id,
                    url: urlData.publicUrl,
                    metadata: file.metadata || null,
                    created_at: file.created_at,
                    updated_at: file.updated_at,
                };
            });

        return NextResponse.json({ assets });
    } catch (err) {
        if (err instanceof Error) {
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

        console.error("[api/content/assets] Unexpected error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
