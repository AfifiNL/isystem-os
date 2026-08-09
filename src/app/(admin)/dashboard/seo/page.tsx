import { redirect } from "next/navigation";
import { getAdminDashboardState } from "@/features/admin/lib/dashboard-state";
import {
    applySeoInternalLinkRecommendation,
    clearSeoInternalLinkOpportunitiesByStatusAction,
    generateSeoExecutionPreview,
    getSeoDashboardData,
    rollbackSeoInternalLinkExecution,
    runSeoSpecialistAuditAction,
    runSeoStrategistAnalysisAction,
    spawnSeoPlansFromClusterAction,
    updateSeoContentOpportunityStatusAction,
    updateSeoContentPlanStatusAction,
    updateSeoInternalLinkOpportunityStatus,
    enqueueAllPublishedContentJobsAction,
    queueAllSeoIndexingJobsAction,
    queueSeoIndexingJobAction,
} from "@/features/seo/actions";
import { SEO_RECOMMENDATION_STATUS_VALUES } from "@/features/seo/types";
import { SeoControlCenter } from "@/features/seo/ui/seo-control-center";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "SEO Control Center",
    description: "Pro-only SEO control center for internal-link growth systems, content opportunity discovery, and strategist-grade planning.",
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
function str(v: string | string[] | undefined): string | undefined {
    if (!v) return undefined;
    return Array.isArray(v) ? v[0] : v;
}

const DEFAULT_DELETABLE_LINK_STATUSES = SEO_RECOMMENDATION_STATUS_VALUES.filter(
    (status) => status !== "applied" && status !== "applying",
);

export default async function SeoDashboardPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const state = await getAdminDashboardState();
    if (!state) {
        redirect("/login");
    }

    const moduleEntry = state.modules.find((module) => module.key === "seo");
    if (!moduleEntry) {
        redirect("/dashboard?denied=seo");
    }

    const params = await searchParams;
    const activeTab = ["overview", "search_console", "indexing", "specialist", "strategist", "graph", "plans"].includes(
        (Array.isArray(params.tab) ? params.tab[0] : params.tab) ?? "",
    )
        ? ((Array.isArray(params.tab) ? params.tab[0] : params.tab) as string)
        : "overview";
    const focusedSlugRaw = Array.isArray(params.slug) ? params.slug[0] : params.slug;
    const focusedSlug = typeof focusedSlugRaw === "string" && focusedSlugRaw.trim().length > 0
        ? focusedSlugRaw.trim().replace(/^\/+/, "")
        : null;
    const requestedLinkStatuses = parseList(params.linksStatus);
    const internalLinksStatuses = activeTab === "specialist" && requestedLinkStatuses.length === 0
        ? DEFAULT_DELETABLE_LINK_STATUSES
        : requestedLinkStatuses;
    const effectiveParams = internalLinksStatuses === requestedLinkStatuses
        ? params
        : { ...params, linksStatus: internalLinksStatuses.join(",") };

    const data = await getSeoDashboardData({
        locale: str(params.locale),
        internalLinksPage: parseInt10(params.linksPage, 1),
        internalLinksPageSize: parseInt10(params.linksPageSize, 10),
        internalLinksStatuses,
        internalLinksSearch: str(params.linksQ),
        contentOppsPage: parseInt10(params.oppsPage, 1),
        contentOppsPageSize: parseInt10(params.oppsPageSize, 10),
        contentOppsStatuses: parseList(params.oppsStatus),
        contentOppsSearch: str(params.oppsQ),
        clustersPage: parseInt10(params.clustersPage, 1),
        clustersPageSize: parseInt10(params.clustersPageSize, 10),
        plansPage: parseInt10(params.plansPage, 1),
        plansPageSize: parseInt10(params.plansPageSize, 10),
        plansStatuses: parseList(params.plansStatus),
        plansSearch: str(params.plansQ),
    });

    return (
        <SeoControlCenter
            data={data}
            activeTab={activeTab}
            focusedSlug={focusedSlug}
            currentParams={effectiveParams}
            runSeoSpecialistAuditAction={runSeoSpecialistAuditAction}
            runSeoStrategistAnalysisAction={runSeoStrategistAnalysisAction}
            updateSeoInternalLinkOpportunityAction={updateSeoInternalLinkOpportunityStatus}
            generateSeoExecutionPreviewAction={generateSeoExecutionPreview}
            applySeoInternalLinkRecommendationAction={applySeoInternalLinkRecommendation}
            rollbackSeoInternalLinkExecutionAction={rollbackSeoInternalLinkExecution}
            updateSeoContentOpportunityStatusAction={updateSeoContentOpportunityStatusAction}
            updateSeoContentPlanStatusAction={updateSeoContentPlanStatusAction}
            spawnSeoPlansFromClusterAction={spawnSeoPlansFromClusterAction}
            clearSeoInternalLinkOpportunitiesByStatusAction={clearSeoInternalLinkOpportunitiesByStatusAction}
            enqueueAllPublishedContentJobsAction={enqueueAllPublishedContentJobsAction}
            queueSeoIndexingJobAction={queueSeoIndexingJobAction}
            queueAllSeoIndexingJobsAction={queueAllSeoIndexingJobsAction}
        />
    );
}
