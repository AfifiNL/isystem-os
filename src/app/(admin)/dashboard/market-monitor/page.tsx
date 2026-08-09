import { loadMarketMonitorDashboard } from "@/features/market-monitor/actions";
import { MarketMonitorDashboard } from "@/features/market-monitor/ui/market-monitor-dashboard";
import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import type { MonitorChangeType } from "@/features/market-monitor/types";

export const dynamic = "force-dynamic";

const VALID_CHANGE_TYPES: MonitorChangeType[] = [
    "new_page",
    "competitor_update",
    "industry_news",
    "pricing_signal",
    "regulation_update",
];

function parseList(value: string | string[] | undefined): string[] {
    if (!value) return [];
    const raw = Array.isArray(value) ? value.join(",") : value;
    return raw.split(",").map((v) => v.trim()).filter(Boolean);
}

function parseInteger(value: string | string[] | undefined, fallback: number): number {
    const raw = Array.isArray(value) ? value[0] : value;
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

interface MarketMonitorPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MarketMonitorPage({ searchParams }: MarketMonitorPageProps) {
    await requireDashboardModuleAccess("market-monitor");

    const params = await searchParams;

    const changeTypes = parseList(params.type).filter((t): t is MonitorChangeType =>
        VALID_CHANGE_TYPES.includes(t as MonitorChangeType),
    );
    const trustTiers = parseList(params.tier)
        .map((n) => Number.parseInt(n, 10))
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= 3);

    const readStateRaw = Array.isArray(params.read) ? params.read[0] : params.read;
    const readState: "all" | "unread" | "read" =
        readStateRaw === "read" || readStateRaw === "unread" ? readStateRaw : "all";

    const archivedStateRaw = Array.isArray(params.archived) ? params.archived[0] : params.archived;
    const archivedState: "active" | "archived" | "all" =
        archivedStateRaw === "archived" || archivedStateRaw === "all" ? archivedStateRaw : "active";

    const search = Array.isArray(params.q) ? params.q[0] : params.q;
    const sinceDaysRaw = parseInteger(params.days, 0);
    const sinceDays = sinceDaysRaw > 0 ? sinceDaysRaw : null;

    const page = Math.max(1, parseInteger(params.page, 1));
    const pageSize = Math.min(100, Math.max(5, parseInteger(params.pageSize, 25)));

    const data = await loadMarketMonitorDashboard({
        changeTypes,
        trustTiers,
        readState,
        archivedState,
        search,
        sinceDays,
        page,
        pageSize,
    });

    if (data.error) {
        return (
            <div className="premium-panel rounded-md border border-destructive/30 bg-destructive/10 px-6 py-5 text-[17px] text-destructive">
                <strong>Failed to load market monitor:</strong> {data.error}
            </div>
        );
    }

    return (
        <MarketMonitorDashboard
            config={data.config}
            results={data.results}
            total={data.total}
            page={data.page}
            pageSize={data.pageSize}
            unreadCount={data.unreadCount}
            archivedCount={data.archivedCount}
            filters={{
                changeTypes,
                trustTiers,
                readState,
                archivedState,
                search: search ?? "",
                sinceDays,
            }}
        />
    );
}
