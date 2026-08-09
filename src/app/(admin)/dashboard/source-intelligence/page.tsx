import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { loadSourceIntelligenceDashboard, type SourceIntelligenceFilters } from "@/features/source-intelligence/dashboard";
import { SourceIntelligenceDashboard } from "@/features/source-intelligence/ui/source-intelligence-dashboard";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Source Intelligence",
    description: "Pro-only source registry, evidence library, ingestion runs, and public-safe proof links.",
};

type PageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function single(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

function parseFilters(params: Record<string, string | string[] | undefined>): SourceIntelligenceFilters {
    return {
        search: single(params.q),
        locale: single(params.locale) as SourceIntelligenceFilters["locale"],
        quality: single(params.quality) as SourceIntelligenceFilters["quality"],
        trustTier: single(params.tier) as SourceIntelligenceFilters["trustTier"],
        topic: single(params.topic),
        contentId: single(params.contentId) ?? null,
    };
}

export default async function SourceIntelligencePage({ searchParams }: PageProps) {
    const state = await requireDashboardModuleAccess("source-intelligence");
    const params = await searchParams;
    const filters = parseFilters(params);
    const templateCandidate = state.themeConfig.template_id;
    const templateId = typeof templateCandidate === "string"
        ? templateCandidate
        : state.theme?.themeKey;
    if (!templateId) {
        throw new Error("Source Intelligence requires an active workspace template.");
    }
    const data = await loadSourceIntelligenceDashboard({
        workspaceId: state.workspace.id,
        templateId,
        filters,
    });

    return <SourceIntelligenceDashboard data={data} filters={filters} />;
}
