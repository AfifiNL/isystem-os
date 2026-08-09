"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";

export interface RenderQueueJobRow {
    id: string;
    workspace_id: string;
    content_id: string | null;
    status: string;
    storage_path: string;
    result_video_url: string | null;
    created_at: string;
    workspaces: { name: string | null } | { name: string | null }[] | null;
}

export interface RenderQueueQuery {
    statuses?: string[];
    search?: string;
    page?: number;
    pageSize?: number;
}

export interface RenderQueueResult {
    rows: RenderQueueJobRow[];
    total: number;
    page: number;
    pageSize: number;
    statusCounts: Record<string, number>;
    error: string | null;
}

async function requireAdmin(): Promise<{ error: string | null }> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated." };
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
    if (!profile || profile.role !== "admin") return { error: "Admin access required." };
    return { error: null };
}

export async function listRenderQueueJobs(query: RenderQueueQuery = {}): Promise<RenderQueueResult> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(5, query.pageSize ?? 25));

    try {
        const auth = await requireAdmin();
        if (auth.error) {
            return { rows: [], total: 0, page, pageSize, statusCounts: {}, error: auth.error };
        }

        const supabase = await createClient();
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let builder = (supabase.from("video_render_jobs") as unknown as {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            select: (c: string, opts: { count: "exact" }) => any;
        })
            .select("id,workspace_id,content_id,status,storage_path,result_video_url,created_at,workspaces(name)", {
                count: "exact",
            });

        if (query.statuses && query.statuses.length > 0) {
            builder = builder.in("status", query.statuses);
        }
        if (query.search && query.search.trim()) {
            const term = query.search.trim().replace(/[%_]/g, "\\$&");
            builder = builder.or(`storage_path.ilike.%${term}%,result_video_url.ilike.%${term}%`);
        }

        const { data, count, error } = await builder
            .order("created_at", { ascending: false })
            .range(from, to);

        if (error) {
            return { rows: [], total: 0, page, pageSize, statusCounts: {}, error: error.message };
        }

        const countStatus = async (status: string) => {
            const res = await (supabase.from("video_render_jobs") as unknown as {
                select: (c: string, opts: { count: "exact"; head: true }) => {
                    eq: (c: string, v: string) => Promise<{ count: number | null }>;
                };
            })
                .select("id", { count: "exact", head: true })
                .eq("status", status);
            return res.count ?? 0;
        };
        const STATUSES = ["pending", "pending_admin", "processing", "completed", "failed"] as const;
        const counts = await Promise.all(STATUSES.map(countStatus));
        const statusCounts: Record<string, number> = {};
        STATUSES.forEach((s, i) => {
            statusCounts[s] = counts[i];
        });

        return {
            rows: (data ?? []) as RenderQueueJobRow[],
            total: count ?? 0,
            page,
            pageSize,
            statusCounts,
            error: null,
        };
    } catch (err) {
        return {
            rows: [],
            total: 0,
            page,
            pageSize,
            statusCounts: {},
            error: err instanceof Error ? err.message : "Failed to load render queue.",
        };
    }
}

function sanitizeIds(ids: readonly string[]): string[] {
    return Array.from(new Set(ids.filter((id) => typeof id === "string" && id.length > 0)));
}

export async function deleteRenderQueueJobs(
    ids: readonly string[],
): Promise<{ error: string | null; deleted: number }> {
    try {
        const auth = await requireAdmin();
        if (auth.error) return { error: auth.error, deleted: 0 };
        const cleaned = sanitizeIds(ids);
        if (cleaned.length === 0) return { error: null, deleted: 0 };
        const supabase = await createClient();
        const { error, count } = await (supabase as unknown as {
            from: (t: string) => {
                delete: (opts: { count: "exact" }) => {
                    in: (c: string, v: string[]) => Promise<{ error: { message: string } | null; count: number | null }>;
                };
            };
        })
            .from("video_render_jobs")
            .delete({ count: "exact" })
            .in("id", cleaned);
        if (error) return { error: error.message, deleted: 0 };
        revalidatePath("/dashboard/render-queue");
        return { error: null, deleted: count ?? 0 };
    } catch (err) {
        return { error: err instanceof Error ? err.message : "Failed to delete jobs.", deleted: 0 };
    }
}

export async function setRenderQueueJobStatus(
    id: string,
    status: string,
): Promise<{ error: string | null }> {
    try {
        const auth = await requireAdmin();
        if (auth.error) return { error: auth.error };
        const supabase = await createClient();
        const { error } = await supabase.from("video_render_jobs").update({ status }).eq("id", id);
        if (error) return { error: error.message };
        revalidatePath("/dashboard/render-queue");
        return { error: null };
    } catch (err) {
        return { error: err instanceof Error ? err.message : "Failed to update job status." };
    }
}
