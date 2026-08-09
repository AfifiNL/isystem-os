import Link from "next/link";
import { Activity, AlertTriangle, Clock3 } from "lucide-react";
import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { listOpportunities } from "@/features/opportunity-engine/actions";
import { OpportunityList } from "@/features/opportunity-engine/ui/opportunity-list";
import { ScanTrigger } from "@/features/opportunity-engine/ui/scan-trigger";
import { getSeoPendingSummary } from "@/features/seo/actions";
import { ProFeatureNotice } from "@/shared/ui/pro-feature-notice";
import {
    DashboardAppWorkbench,
    AppCommandBar,
    AppMetricStrip,
    AppMetric,
    AppStatusBanner,
    AppFeedbackLoop,
} from "@/features/admin/ui/app-workbench";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "AI Opportunity Engine",
    description:
        "Continuously surface SEO gaps, content opportunities, and conversion weak points across this workspace.",
};

function formatRelativeTime(iso: string | null): string {
    if (!iso) return "never";
    const diffMs = Date.now() - new Date(iso).getTime();
    const minutes = Math.round(diffMs / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
}

const VALID_STATUSES = ["pending", "approved", "implemented", "dismissed", "superseded"] as const;
const VALID_SEVERITIES = ["high", "medium", "low"] as const;
const VALID_CATEGORIES = ["seo", "content", "conversion"] as const;

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

interface OpportunitiesPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function OpportunitiesPage({ searchParams }: OpportunitiesPageProps) {
    const state = await requireDashboardModuleAccess("opportunities");

    if (state.workspace.workspace_tier === "basic") {
        return (
            <DashboardAppWorkbench>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <ProFeatureNotice
                        title="AI Opportunity Engine requires Pro"
                        description="Continuously diagnose SEO gaps, under-performing content, and conversion weak points — with AI-written next actions."
                        ctaLabel="Activate Pro"
                        benefits={[
                            "Deterministic detectors over your real analytics, SEO, and content data.",
                            "AI-written recommendations for each opportunity.",
                            "Approve, implement, or dismiss — reviewed opportunities won't re-surface.",
                        ]}
                    />
                </div>
            </DashboardAppWorkbench>
        );
    }

    const params = await searchParams;
    const statuses = parseList(params.status).filter((s): s is (typeof VALID_STATUSES)[number] =>
        (VALID_STATUSES as readonly string[]).includes(s),
    );
    const severities = parseList(params.severity).filter((s): s is (typeof VALID_SEVERITIES)[number] =>
        (VALID_SEVERITIES as readonly string[]).includes(s),
    );
    const categories = parseList(params.category).filter((c): c is (typeof VALID_CATEGORIES)[number] =>
        (VALID_CATEGORIES as readonly string[]).includes(c),
    );
    const search = Array.isArray(params.q) ? params.q[0] : params.q;
    const page = Math.max(1, parseInt10(params.page, 1));
    const pageSize = Math.min(100, Math.max(5, parseInt10(params.pageSize, 25)));

    const [listResult, seoPending] = await Promise.all([
        listOpportunities({ statuses, severities, categories, search, page, pageSize }),
        getSeoPendingSummary(),
    ]);

    const { opportunities, latestScan, error, total, statusCounts } = listResult;
    const pendingCount = statusCounts.pending;
    const highSeverityCount = opportunities.filter(
        (opp) => opp.status === "pending" && opp.severity === "high",
    ).length;

    return (
        <DashboardAppWorkbench>
            <AppCommandBar>
                <div className="flex w-full items-center justify-end">
                    <ScanTrigger />
                </div>
            </AppCommandBar>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <AppMetricStrip>
                    <AppMetric label="Pending" value={pendingCount} icon={Activity} />
                    <AppMetric label="High-Severity Open" value={highSeverityCount} icon={AlertTriangle} variant={highSeverityCount > 0 ? "destructive" : "default"} />
                    <AppMetric label="Last Scan" value={formatRelativeTime(latestScan?.completedAt ?? latestScan?.createdAt ?? null)} icon={Clock3} />
                </AppMetricStrip>

                <AppFeedbackLoop
                    title="Opportunity decision loop"
                    description="Signals are scored, committed, implemented, and evaluated before they re-enter the queue."
                    stages={[
                        { label: "Pending", value: pendingCount, detail: "open signals", tone: pendingCount > 0 ? "warning" : "success" },
                        { label: "High", value: highSeverityCount, detail: "needs attention", tone: highSeverityCount > 0 ? "danger" : "success" },
                        { label: "Approved", value: statusCounts.approved, detail: "committed", tone: "info" },
                        { label: "Implemented", value: statusCounts.implemented, detail: "applied", tone: "success" },
                    ]}
                    feedbackLabel="Implementation and conversion evidence should change detector priority; a growing pending queue signals a capacity problem."
                />

                {error && (
                    <AppStatusBanner variant="destructive">
                        {error}
                    </AppStatusBanner>
                )}

                {seoPending.error && (
                    <AppStatusBanner variant="destructive">
                        SEO counters failed to load: {seoPending.error}
                    </AppStatusBanner>
                )}

                {latestScan?.errorMessage && (
                    <AppStatusBanner variant="warning">
                        Previous scan completed with warnings: {latestScan.errorMessage}
                    </AppStatusBanner>
                )}

                <div className="rounded-md border bg-card/40 border-border/50 px-4 py-3.5 text-[15px]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="font-semibold text-foreground">SEO Control Center</p>
                            <p className="mt-0.5 text-[13px] text-muted-foreground">
                                <strong className="text-foreground">{seoPending.internalLinks}</strong> internal link{seoPending.internalLinks !== 1 ? "s" : ""} pending
                                {" · "}
                                <strong className="text-foreground">{seoPending.contentOpportunities}</strong> content opportunit{seoPending.contentOpportunities !== 1 ? "ies" : "y"} pending
                            </p>
                        </div>
                        <Link
                            href="/dashboard/seo"
                            className="text-[15px] font-semibold text-primary hover:underline cursor-pointer"
                        >
                            Open SEO Control Center →
                        </Link>
                    </div>
                </div>

                <OpportunityList
                    opportunities={opportunities}
                    total={total}
                    page={listResult.page}
                    pageSize={listResult.pageSize}
                    statuses={statuses}
                    severities={severities}
                    categories={categories}
                    search={search ?? ""}
                    statusCounts={statusCounts}
                />
            </div>
        </DashboardAppWorkbench>
    );
}
