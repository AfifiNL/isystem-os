"use server";

import { createClient } from "@/shared/lib/supabase/server";
import {
    ACTIVE_WORKSPACE_COOKIE,
    getCurrentUserRole,
    type WorkspaceTier,
} from "@/shared/lib/workspace/context";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

async function assertAdminRole() {
    const roleCtx = await getCurrentUserRole();
    if (roleCtx?.role !== "admin") {
        throw new Error("Forbidden: admin role required");
    }
    return roleCtx;
}

export async function getAllWorkspaces() {
    const res = await listAllWorkspaces({ page: 1, pageSize: 100 });
    if (res.error) return { data: null, error: res.error };
    return { data: res.data, error: null };
}

export interface WorkspacesQuery {
    search?: string;
    tiers?: string[];
    isActive?: "all" | "active" | "inactive";
    page?: number;
    pageSize?: number;
}

export interface WorkspacesListResult {
    data: unknown[];
    total: number;
    page: number;
    pageSize: number;
    tierCounts: Record<string, number>;
    error: string | null;
}

export async function listAllWorkspaces(query: WorkspacesQuery = {}): Promise<WorkspacesListResult> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(5, query.pageSize ?? 25));

    try {
        await assertAdminRole();
        const supabase = await createClient();
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let builder = (supabase.from("workspaces") as unknown as {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            select: (c: string, opts: { count: "exact" }) => any;
        })
            .select(
                `
                id,
                slug,
                name,
                workspace_tier,
                compute_credits,
                is_active,
                created_at,
                owner:profiles!workspaces_owner_profile_id_fkey(id, email),
                bindings:workspace_theme_bindings(
                    is_active,
                    effective_to,
                    theme_version:theme_versions(
                        version,
                        theme:theme_catalog(name)
                    )
                )
            `,
                { count: "exact" },
            );

        if (query.tiers && query.tiers.length > 0) {
            builder = builder.in("workspace_tier", query.tiers);
        }
        if (query.isActive === "active") builder = builder.eq("is_active", true);
        else if (query.isActive === "inactive") builder = builder.eq("is_active", false);

        if (query.search && query.search.trim()) {
            const term = query.search.trim().replace(/[%_]/g, "\\$&");
            builder = builder.or(`name.ilike.%${term}%,slug.ilike.%${term}%`);
        }

        const countTier = async (tier: string) => {
            const res = await (supabase.from("workspaces") as unknown as {
                select: (c: string, opts: { count: "exact"; head: true }) => {
                    eq: (c: string, v: string) => Promise<{ count: number | null }>;
                };
            })
                .select("id", { count: "exact", head: true })
                .eq("workspace_tier", tier);
            return { tier, count: res.count ?? 0 };
        };

        const [listRes, basicCount, proCount] = await Promise.all([
            builder.order("created_at", { ascending: false }).range(from, to),
            countTier("basic"),
            countTier("pro"),
        ]);

        if (listRes.error) {
            return {
                data: [],
                total: 0,
                page,
                pageSize,
                tierCounts: {},
                error: listRes.error.message,
            };
        }

        return {
            data: (listRes.data ?? []) as unknown[],
            total: listRes.count ?? 0,
            page,
            pageSize,
            tierCounts: { basic: basicCount.count, pro: proCount.count },
            error: null,
        };
    } catch (err) {
        return {
            data: [],
            total: 0,
            page,
            pageSize,
            tierCounts: {},
            error: err instanceof Error ? err.message : "Failed to fetch workspaces",
        };
    }
}

export async function getWorkspaceById(id: string) {
    try {
        await assertAdminRole();

        const supabase = await createClient();
        const { data, error } = await supabase
            .from("workspaces")
            .select("id, name, slug, is_active, compute_credits, workspace_tier")
            .eq("id", id)
            .single();

        if (error) {
            return { data: null, error: error.message };
        }

        return { data, error: null };
    } catch (err) {
        return { data: null, error: err instanceof Error ? err.message : "Failed to fetch workspace" };
    }
}

export async function updateWorkspaceComputeCredits(input: {
    workspaceId: string;
    computeCredits: number;
}) {
    try {
        await assertAdminRole();

        if (!Number.isInteger(input.computeCredits) || input.computeCredits < 0) {
            return { data: null, error: "Compute credits must be a non-negative integer." };
        }

        const supabase = await createClient();
        const { data, error } = await supabase
            .from("workspaces")
            .update({
                compute_credits: input.computeCredits,
            })
            .eq("id", input.workspaceId)
            .select("id, compute_credits")
            .single();

        if (error) {
            return { data: null, error: error.message };
        }

        return { data, error: null };
    } catch (err) {
        return {
            data: null,
            error: err instanceof Error ? err.message : "Failed to update workspace compute credits",
        };
    }
}

export async function updateWorkspaceTier(input: {
    workspaceId: string;
    workspaceTier: WorkspaceTier;
}) {
    try {
        await assertAdminRole();

        if (input.workspaceTier !== "basic" && input.workspaceTier !== "pro") {
            return { data: null, error: "Workspace tier must be either basic or pro." };
        }

        const supabase = await createClient();
        const { data, error } = await supabase
            .from("workspaces")
            .update({
                workspace_tier: input.workspaceTier,
                updated_at: new Date().toISOString(),
            })
            .eq("id", input.workspaceId)
            .select("id, workspace_tier")
            .single();

        if (error) {
            return { data: null, error: error.message }; 
        }

        const pathsToRevalidate = [
            "/dashboard",
            "/dashboard/generate",
            "/dashboard/orchestrator",
            "/dashboard/content",
            "/dashboard/workspaces",
            `/dashboard/workspaces/${input.workspaceId}`,
        ];

        for (const path of pathsToRevalidate) {
            revalidatePath(path);
        }

        return { data, error: null };
    } catch (err) {
        return {
            data: null,
            error: err instanceof Error ? err.message : "Failed to update workspace tier",
        };
    }
}

export async function createWorkspace(input: {
    name: string;
    slug: string;
    legacyTemplateId?: string;
}) {
    try {
        await assertAdminRole();

        const supabase = await createClient();
        const { data, error } = await supabase.rpc("admin_create_workspace", {
            p_name: input.name,
            p_slug: input.slug,
            p_legacy_template_id: input.legacyTemplateId || null,
        });

        if (error) {
            return { data: null, error: error.message };
        }

        const workspace = Array.isArray(data) ? data[0] : data;
        return { data: workspace ?? null, error: null };
    } catch (err) {
        return {
            data: null,
            error: err instanceof Error ? err.message : "Failed to create workspace",
        };
    }
}

export async function setActiveWorkspace(workspaceId: string) {
    try {
        await assertAdminRole();

        const supabase = await createClient();
        const { data, error } = await supabase
            .from("workspaces")
            .select("id")
            .eq("id", workspaceId)
            .single();

        if (error || !data) {
            return { data: null, error: "Workspace not found or inaccessible." };
        }

        const cookieStore = await cookies();
        cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
            path: "/",
            sameSite: "lax",
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24 * 30,
        });

        const pathsToRevalidate = [
            ["/dashboard", undefined] as const,
            ["/", "layout"] as const,
            ["/", "page"] as const,
            ["/about", "page"] as const,
            ["/services", "page"] as const,
            ["/contact", "page"] as const,
            ["/blog", "page"] as const,
            ["/projects", "page"] as const,
            ["/newsletter", "page"] as const,
            ["/videos", "page"] as const,
        ];

        for (const [path, type] of pathsToRevalidate) {
            if (type) {
                revalidatePath(path, type);
                continue;
            }

            revalidatePath(path);
        }

        return { data: { workspaceId }, error: null };
    } catch (err) {
        return {
            data: null,
            error: err instanceof Error ? err.message : "Failed to change active workspace",
        };
    }
}
