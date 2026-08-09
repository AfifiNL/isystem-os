import { createClient } from "@/shared/lib/supabase/server";
import { redirect } from "next/navigation";
import { resolveWorkspaceContext } from "@/shared/lib/workspace/context";
import { ProFeatureNotice } from "@/shared/ui/pro-feature-notice";
import { listRenderQueueJobs } from "@/features/admin/actions/render-queue";
import { RenderQueueList } from "@/features/admin/ui/render-queue-list";
import {
    DashboardAppWorkbench,
} from "@/features/admin/ui/app-workbench";

export const metadata = {
    title: "Render Queue - Admin Dashboard",
};

function parseList(v: string | string[] | undefined): string[] {
    if (!v) return [];
    const raw = Array.isArray(v) ? v.join(",") : v;
    return raw.split(",").map((x) => x.trim()).filter(Boolean);
}

function parseInt10(v: string | string[] | undefined, fallback: number): number {
    const raw = Array.isArray(v) ? v[0] : v;
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

const ALLOWED_STATUSES = new Set([
    "pending_admin",
    "pending",
    "processing",
    "completed",
    "failed",
]);

export default async function AdminRenderQueuePage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const supabase = await createClient();
    const workspaceContext = await resolveWorkspaceContext();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/");

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || profile.role !== "admin") redirect("/dashboard");

    if (!workspaceContext?.productFeatures.aiGeneration) {
        return (
            <DashboardAppWorkbench>
                <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                    <ProFeatureNotice
                        title="Render Queue fulfillment is available on Pro"
                        description="Manage render jobs and fulfillment from one queue."
                        ctaLabel="Activate Pro for Render Queue"
                        benefits={[
                            "Collect render requests.",
                            "Track fulfillment status.",
                            "Manage completed output in one place.",
                        ]}
                    />
                </div>
            </DashboardAppWorkbench>
        );
    }

    const params = await searchParams;
    const statuses = parseList(params.status).filter((s) => ALLOWED_STATUSES.has(s));
    const effectiveStatuses = statuses.length > 0 ? statuses : ["pending_admin"];
    const search = Array.isArray(params.q) ? params.q[0] : params.q;
    const page = Math.max(1, parseInt10(params.page, 1));
    const pageSize = Math.min(100, Math.max(5, parseInt10(params.pageSize, 25)));

    const result = await listRenderQueueJobs({
        statuses: effectiveStatuses,
        search,
        page,
        pageSize,
    });

    if (result.error) {
        return (
            <DashboardAppWorkbench>
                <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-[17px] text-destructive">
                        Failed to load render queue: {result.error}
                    </div>
                </div>
            </DashboardAppWorkbench>
        );
    }

    return (
        <DashboardAppWorkbench>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                <div>
                    <p className="text-muted-foreground text-[17px]">
                        Manage manual AI video rendering fulfillment for workspaces.
                    </p>
                </div>

                <RenderQueueList
                    jobs={result.rows}
                    total={result.total}
                    page={result.page}
                    pageSize={result.pageSize}
                    statuses={statuses}
                    search={search ?? ""}
                    statusCounts={result.statusCounts}
                />
            </div>
        </DashboardAppWorkbench>
    );
}
