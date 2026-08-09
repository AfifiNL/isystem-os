import { ContentFeed } from "@/features/content-engine/ui/content-feed";
import { Button } from "@/shared/ui/button";
import { Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { resolveWorkspaceContext } from "@/shared/lib/workspace/context";
import { ProFeatureNotice } from "@/shared/ui/pro-feature-notice";
import {
    DashboardAppWorkbench,
    AppCommandBar,
    AppTabList,
} from "@/features/admin/ui/app-workbench";

interface ContentDashboardPageProps {
    searchParams: Promise<{ source?: string }>;
}

function resolveSourceFilter(raw: string | undefined): "manual" | "ai-draft" | null {
    if (raw === "manual" || raw === "ai-draft") return raw;
    return null;
}

export default async function ContentDashboardPage({ searchParams }: ContentDashboardPageProps) {
    await requireDashboardModuleAccess("content");
    const context = await resolveWorkspaceContext();
    const isBasicWorkspace = context?.activeWorkspace?.workspace_tier === "basic";
    const params = await searchParams;
    const activeSource = resolveSourceFilter(params.source);

    const tabs = [
        { label: "All", value: "all", href: "/dashboard/content", active: activeSource === null },
        { label: "AI drafts", value: "ai-draft", href: "/dashboard/content?source=ai-draft", active: activeSource === "ai-draft" },
        { label: "Manual", value: "manual", href: "/dashboard/content?source=manual", active: activeSource === "manual" },
    ];

    return (
        <DashboardAppWorkbench>
            <AppCommandBar>
                <div className="flex w-full items-center justify-end gap-2">
                        {!isBasicWorkspace ? (
                            <Link href="/dashboard/generate" className="min-w-0">
                                <Button variant="outline" size="sm" className="border-cyan-500/40 text-cyan-700 hover:bg-cyan-500/10 dark:text-cyan-300 text-[15px]">
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Generate with AI
                                </Button>
                            </Link>
                        ) : null}
                        <Link href="/dashboard/content/new" className="min-w-0">
                            <Button size="sm" className="shadow-lg shadow-primary/20 text-[15px]">
                                <Plus className="mr-2 h-4 w-4" />
                                {isBasicWorkspace ? "Create Manual Draft" : "Create New Draft"}
                            </Button>
                        </Link>
                </div>
            </AppCommandBar>

            {!isBasicWorkspace ? (
                <div className="border-b border-border/60 bg-card/30 px-4 py-2">
                    <AppTabList tabs={tabs} />
                </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                {isBasicWorkspace ? (
                    <div className="mx-auto max-w-6xl space-y-4">
                        <ProFeatureNotice
                            title="AI Content Studio is available on Pro"
                            description="This workspace uses the manual drafting flow. Upgrade to Pro to unlock AI-assisted drafting and media generation."
                            ctaLabel="Activate Pro for AI Content Studio"
                            benefits={[
                                "Create manual drafts now.",
                                "Keep all manual posts in one library.",
                                "Unlock AI drafting and media generation with Pro.",
                            ]}
                        />
                        <ContentFeed sourceFilter="manual" />
                    </div>
                ) : (
                    <ContentFeed sourceFilter={activeSource} />
                )}
            </div>
        </DashboardAppWorkbench>
    );
}
