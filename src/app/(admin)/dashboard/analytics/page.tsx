import { requireAdminDashboardState, requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { getAnalyticsEvents, getAnalyticsOverview } from "@/features/analytics/actions";
import { ANALYTICS_EVENT_TYPES } from "@/features/analytics/taxonomy";
import { AnalyticsDashboard } from "@/features/analytics/ui/analytics-dashboard";
import { AnalyticsEventsLog } from "@/features/analytics/ui/analytics-events-log";
import { AnalyticsFilterForm } from "./analytics-filter-form";
import { DashboardAppWorkbench, AppCommandBar, AppStatusBanner } from "@/features/admin/ui/app-workbench";

const AVAILABLE_EVENT_TYPES = [...ANALYTICS_EVENT_TYPES];

function parseList(value: string | string[] | undefined): string[] {
    if (!value) return [];
    const raw = Array.isArray(value) ? value.join(",") : value;
    return raw.split(",").map((v) => v.trim()).filter(Boolean);
}

function parseInt10(value: string | string[] | undefined, fallback: number): number {
    const raw = Array.isArray(value) ? value[0] : value;
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export default async function AnalyticsPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    await requireDashboardModuleAccess("analytics");
    const dashboardState = await requireAdminDashboardState();
    const resolved = await searchParams;
    const workspaceIdRaw = Array.isArray(resolved.workspaceId) ? resolved.workspaceId[0] : resolved.workspaceId;
    const selectedWorkspaceId = workspaceIdRaw || dashboardState.workspace.id;
    const selectedDays = Math.max(1, Math.min(parseInt10(resolved.days, 30), 365));

    const eventTypes = parseList(resolved.eventType).filter((t) => (AVAILABLE_EVENT_TYPES as readonly string[]).includes(t));
    const search = Array.isArray(resolved.q) ? resolved.q[0] : resolved.q;
    const eventDaysRaw = parseInt10(resolved.eventDays, 0);
    const eventDays = eventDaysRaw > 0 ? eventDaysRaw : null;
    const eventsPage = Math.max(1, parseInt10(resolved.eventsPage, 1));
    const eventsPageSize = Math.min(100, Math.max(5, parseInt10(resolved.eventsPageSize, 25)));

    const [overviewResult, eventsResult] = await Promise.all([
        getAnalyticsOverview({ workspaceId: selectedWorkspaceId, days: selectedDays }),
        getAnalyticsEvents({
            workspaceId: selectedWorkspaceId,
            eventTypes,
            search,
            sinceDays: eventDays,
            page: eventsPage,
            pageSize: eventsPageSize,
        }),
    ]);

    if (overviewResult.error || !overviewResult.data) {
        throw new Error(overviewResult.error || "Failed to load analytics overview.");
    }

    return (
        <DashboardAppWorkbench>
            <AppCommandBar
                filters={<AnalyticsFilterForm
                    selectedWorkspaceId={selectedWorkspaceId}
                    selectedDays={selectedDays}
                    workspaces={dashboardState.accessibleWorkspaces}
                />}
            />

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {overviewResult.data.trendAggregationCapped ? (
                    <AppStatusBanner variant="warning">
                        Trend chart aggregation is capped at 5,000 page-view events for the selected window. Top pages and daily trend may be a sample. Totals below use full-table counts.
                    </AppStatusBanner>
                ) : null}

                <AnalyticsDashboard analytics={overviewResult.data} />

                <AnalyticsEventsLog
                    workspaceId={selectedWorkspaceId}
                    rows={eventsResult.rows}
                    total={eventsResult.total}
                    page={eventsResult.page}
                    pageSize={eventsResult.pageSize}
                    eventTypes={eventTypes}
                    search={search ?? ""}
                    sinceDays={eventDays}
                    availableEventTypes={AVAILABLE_EVENT_TYPES}
                />
            </div>
        </DashboardAppWorkbench>
    );
}
