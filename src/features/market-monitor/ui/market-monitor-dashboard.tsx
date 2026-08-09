"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Archive,
    ArchiveRestore,
    Check,
    ChevronLeft,
    ChevronRight,
    Eye,
    EyeOff,
    ExternalLink,
    Filter,
    Loader2,
    Play,
    RefreshCw,
    Search,
    Shield,
    Trash2,
    TrendingUp,
    X,
} from "lucide-react";
import type { MarketMonitorConfig, MarketMonitorResult, MonitorChangeType } from "../types";
import {
    deleteMarketMonitorResults,
    setMarketMonitorResultsArchived,
    setMarketMonitorResultsRead,
    triggerMarketMonitorScan,
} from "../actions";
import {
    DashboardAppWorkbench,
    AppCommandBar,
    AppMetricStrip,
    AppMetric,
    AppStatusBanner,
    AppSectionHeader,
    AppFeedbackLoop,
} from "@/features/admin/ui/app-workbench";
import { SelectionCheckbox } from "@/shared/ui/list-controls";

type ReadState = "all" | "unread" | "read";
type ArchivedState = "active" | "archived" | "all";

interface ActiveFilters {
    changeTypes: MonitorChangeType[];
    trustTiers: number[];
    readState: ReadState;
    archivedState: ArchivedState;
    search: string;
    sinceDays: number | null;
}

interface MarketMonitorDashboardProps {
    config: MarketMonitorConfig | null;
    results: MarketMonitorResult[];
    total: number;
    page: number;
    pageSize: number;
    unreadCount: number;
    archivedCount: number;
    filters: ActiveFilters;
}

const CHANGE_TYPE_LABEL: Record<MonitorChangeType, string> = {
    new_page: "New page",
    competitor_update: "Competitor update",
    industry_news: "Industry news",
    pricing_signal: "Pricing signal",
    regulation_update: "Regulation update",
};

const CHANGE_TYPE_TONE: Record<MonitorChangeType, string> = {
    new_page: "border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-300",
    competitor_update: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    industry_news: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    pricing_signal: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    regulation_update: "border-destructive/30 bg-destructive/10 text-destructive",
};

const ALL_CHANGE_TYPES: MonitorChangeType[] = [
    "new_page",
    "competitor_update",
    "industry_news",
    "pricing_signal",
    "regulation_update",
];

const TRUST_TIERS = [1, 2, 3];
const DATE_RANGES: Array<{ value: number | null; label: string }> = [
    { value: null, label: "All time" },
    { value: 1, label: "24h" },
    { value: 7, label: "7 days" },
    { value: 30, label: "30 days" },
    { value: 90, label: "90 days" },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function MarketMonitorDashboard({
    config,
    results,
    total,
    page,
    pageSize,
    unreadCount,
    archivedCount,
    filters,
}: MarketMonitorDashboardProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [isScanning, startScanTransition] = useTransition();
    const [isBulkPending, startBulkTransition] = useTransition();
    const [scanFeedback, setScanFeedback] = useState<
        | { kind: "success"; newResults: number; scannedAt: string; errors: string[] }
        | { kind: "error"; message: string }
        | null
    >(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [searchDraft, setSearchDraft] = useState(filters.search);

    useEffect(() => {
        setSearchDraft(filters.search);
    }, [filters.search]);

    useEffect(() => {
        setSelected((prev) => {
            if (prev.size === 0) return prev;
            const visible = new Set(results.map((r) => r.id));
            let changed = false;
            const next = new Set<string>();
            prev.forEach((id) => {
                if (visible.has(id)) next.add(id);
                else changed = true;
            });
            return changed ? next : prev;
        });
    }, [results]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const allSelected = results.length > 0 && results.every((r) => selected.has(r.id));
    const someSelected = selected.size > 0 && !allSelected;
    const canRun = Boolean(
        config?.enabled &&
            ((config.competitor_domains.length ?? 0) > 0 ||
                (config.authority_domains.length ?? 0) > 0) &&
            (config.industry_keywords.length ?? 0) > 0,
    );

    const updateParams = (patch: Record<string, string | null>) => {
        const next = new URLSearchParams(searchParams?.toString() ?? "");
        Object.entries(patch).forEach(([key, value]) => {
            if (value === null || value === "") next.delete(key);
            else next.set(key, value);
        });
        const qs = next.toString();
        router.push(qs ? `/dashboard/market-monitor?${qs}` : "/dashboard/market-monitor");
    };

    const toggleChangeType = (type: MonitorChangeType) => {
        const next = filters.changeTypes.includes(type)
            ? filters.changeTypes.filter((t) => t !== type)
            : [...filters.changeTypes, type];
        updateParams({ type: next.length ? next.join(",") : null, page: null });
    };

    const toggleTrustTier = (tier: number) => {
        const next = filters.trustTiers.includes(tier)
            ? filters.trustTiers.filter((t) => t !== tier)
            : [...filters.trustTiers, tier];
        updateParams({ tier: next.length ? next.join(",") : null, page: null });
    };

    const submitSearch = (term: string) => {
        updateParams({ q: term.trim() ? term.trim() : null, page: null });
    };

    const resetFilters = () => {
        router.push("/dashboard/market-monitor");
    };

    const hasActiveFilters =
        filters.changeTypes.length > 0 ||
        filters.trustTiers.length > 0 ||
        filters.readState !== "all" ||
        filters.archivedState !== "active" ||
        filters.search.length > 0 ||
        filters.sinceDays !== null;

    const handleRunNow = () => {
        setScanFeedback(null);
        startScanTransition(async () => {
            const result = await triggerMarketMonitorScan();
            if (result.error || !result.summary) {
                setScanFeedback({ kind: "error", message: result.error ?? "Scan failed." });
                return;
            }
            setScanFeedback({
                kind: "success",
                newResults: result.summary.new_results,
                scannedAt: result.summary.scanned_at,
                errors: result.summary.errors,
            });
            router.refresh();
        });
    };

    const runBulkAction = (
        runner: () => Promise<{ error: string | null }>,
        { clearSelection = true }: { clearSelection?: boolean } = {},
    ) => {
        setActionError(null);
        startBulkTransition(async () => {
            const result = await runner();
            if (result.error) {
                setActionError(result.error);
                return;
            }
            if (clearSelection) setSelected(new Set());
            router.refresh();
        });
    };

    const bulkArchive = (archived: boolean) => {
        const ids = Array.from(selected);
        if (ids.length === 0) return;
        runBulkAction(() => setMarketMonitorResultsArchived(ids, archived));
    };

    const bulkRead = (read: boolean) => {
        const ids = Array.from(selected);
        if (ids.length === 0) return;
        runBulkAction(() => setMarketMonitorResultsRead(ids, read));
    };

    const bulkDelete = () => {
        const ids = Array.from(selected);
        if (ids.length === 0) return;
        if (
            !confirm(`Delete ${ids.length} signal${ids.length === 1 ? "" : "s"}? This cannot be undone.`)
        )
            return;
        runBulkAction(async () => await deleteMarketMonitorResults(ids));
    };

    const toggleSelectAll = () => {
        if (allSelected) {
            setSelected(new Set());
        } else {
            setSelected(new Set(results.map((r) => r.id)));
        }
    };

    const firstIndex = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const lastIndex = Math.min(total, page * pageSize);

    return (
        <DashboardAppWorkbench>
            <AppCommandBar>
                <div className="flex w-full items-center justify-end">
                  <button
                    type="button"
                    onClick={handleRunNow}
                    disabled={isScanning || !canRun}
                    title={
                        !canRun
                            ? "Configure keywords and competitor/authority domains in settings."
                            : "Run a scan now."
                    }
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[15px] font-medium text-primary-foreground hover:bg-primary/95 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                >
                    {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    {isScanning ? "Scanning…" : "Run now"}
                  </button>
                </div>
            </AppCommandBar>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <AppMetricStrip>
                    <AppMetric label="Unread Signals" value={unreadCount} icon={EyeOff} />
                    <AppMetric label="Archived Signals" value={archivedCount} icon={Archive} />
                    <AppMetric label="Total Signals" value={total} icon={TrendingUp} />
                </AppMetricStrip>

                <AppFeedbackLoop
                    title="Market signal loop"
                    description="Observed changes are filtered into a decision queue, then returned to the next scan."
                    stages={[
                        { label: "Observed", value: total, detail: "visible signals", tone: "info" },
                        { label: "Unread", value: unreadCount, detail: "operator queue", tone: unreadCount > 0 ? "warning" : "success" },
                        { label: "Selected", value: selected.size, detail: "current decision set", tone: selected.size > 0 ? "info" : "default" },
                        { label: "Archived", value: archivedCount, detail: "closed context", tone: "default" },
                    ]}
                    feedbackLabel="A signal only earns attention when it changes a decision; archive, read, or follow-up actions shape the next scan."
                />

                {scanFeedback && (
                    <AppStatusBanner variant={scanFeedback.kind === "success" ? "success" : "destructive"}>
                        {scanFeedback.kind === "success" ? (
                            <>
                                Scan complete — {scanFeedback.newResults} new signal{scanFeedback.newResults === 1 ? "" : "s"} at {new Date(scanFeedback.scannedAt).toLocaleTimeString()}.
                                {scanFeedback.errors.length > 0 && ` (${scanFeedback.errors.length} query errors)`}
                            </>
                        ) : (
                            <>Scan failed: {scanFeedback.message}</>
                        )}
                    </AppStatusBanner>
                )}

                {config ? (
                    <div className="rounded-md border border-border/50 bg-card/40 p-4">
                        <AppSectionHeader title="Configuration Overview" description="Active rules for competitor update tracking." />
                        <ConfigSummary config={config} />
                    </div>
                ) : (
                    <AppStatusBanner variant="warning">
                        No market-monitor configuration for this workspace yet. Add competitor domains, authority domains, and keywords in workspace settings to start receiving signals.
                    </AppStatusBanner>
                )}

            <section className="rounded-md border border-border/50 bg-card/30 px-4 py-4 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative min-w-0 flex-1 sm:min-w-[200px]">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="search"
                            value={searchDraft}
                            onChange={(e) => setSearchDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") submitSearch(searchDraft);
                            }}
                            onBlur={() => {
                                if (searchDraft !== filters.search) submitSearch(searchDraft);
                            }}
                            placeholder="Search title, snippet, or URL…"
                            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-[17px] focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                    </div>
                    <SegmentedControl
                        value={filters.readState}
                        onChange={(v) => updateParams({ read: v === "all" ? null : v, page: null })}
                        options={[
                            { value: "all", label: "All" },
                            { value: "unread", label: "Unread" },
                            { value: "read", label: "Read" },
                        ]}
                    />
                    <SegmentedControl
                        value={filters.archivedState}
                        onChange={(v) => updateParams({ archived: v === "active" ? null : v, page: null })}
                        options={[
                            { value: "active", label: "Active" },
                            { value: "archived", label: "Archived" },
                            { value: "all", label: "All" },
                        ]}
                    />
                    <select
                        value={String(filters.sinceDays ?? "")}
                        onChange={(e) => updateParams({ days: e.target.value || null, page: null })}
                        className="h-9 rounded-md border border-input bg-background px-2 text-[17px] focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                        {DATE_RANGES.map((r) => (
                            <option key={r.label} value={r.value ?? ""}>
                                {r.label}
                            </option>
                        ))}
                    </select>
                    {hasActiveFilters ? (
                        <button
                            type="button"
                            onClick={resetFilters}
                            className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2.5 py-1.5 text-[15px] text-muted-foreground hover:text-foreground"
                        >
                            <X className="h-3 w-3" />
                            Clear filters
                        </button>
                    ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[14px] uppercase tracking-wider text-muted-foreground">
                        <Filter className="h-3 w-3" /> Type
                    </span>
                    {ALL_CHANGE_TYPES.map((t) => (
                        <FilterChip
                            key={t}
                            active={filters.changeTypes.includes(t)}
                            onClick={() => toggleChangeType(t)}
                            label={CHANGE_TYPE_LABEL[t]}
                        />
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] uppercase tracking-wider text-muted-foreground">Trust tier</span>
                    {TRUST_TIERS.map((tier) => (
                        <FilterChip
                            key={tier}
                            active={filters.trustTiers.includes(tier)}
                            onClick={() => toggleTrustTier(tier)}
                            label={`Tier ${tier}`}
                        />
                    ))}
                </div>
            </section>

            {selected.size > 0 ? (
                <section className="premium-panel flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-4 py-3">
                    <span className="text-[15px] font-medium text-primary">
                        {selected.size} selected
                    </span>
                    <BulkActionButton
                        onClick={() => bulkRead(true)}
                        pending={isBulkPending}
                        icon={<Eye className="h-3 w-3" />}
                        label="Mark read"
                    />
                    <BulkActionButton
                        onClick={() => bulkRead(false)}
                        pending={isBulkPending}
                        icon={<EyeOff className="h-3 w-3" />}
                        label="Mark unread"
                    />
                    <BulkActionButton
                        onClick={() => bulkArchive(true)}
                        pending={isBulkPending}
                        icon={<Archive className="h-3 w-3" />}
                        label="Archive"
                    />
                    <BulkActionButton
                        onClick={() => bulkArchive(false)}
                        pending={isBulkPending}
                        icon={<ArchiveRestore className="h-3 w-3" />}
                        label="Unarchive"
                    />
                    <BulkActionButton
                        onClick={bulkDelete}
                        pending={isBulkPending}
                        icon={<Trash2 className="h-3 w-3" />}
                        label="Delete"
                        tone="destructive"
                    />
                    <button
                        type="button"
                        onClick={() => setSelected(new Set())}
                        className="ml-auto text-[15px] text-muted-foreground hover:text-foreground"
                    >
                        Clear selection
                    </button>
                </section>
            ) : null}

            {actionError ? (
                <div className="premium-panel rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-[15px] text-destructive">
                    {actionError}
                </div>
            ) : null}

            <section className="space-y-3">
                <div className="flex items-center justify-between gap-3 text-[15px] text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <div className="inline-flex items-center gap-2">
                            <SelectionCheckbox
                                checked={allSelected}
                                indeterminate={someSelected}
                                onCheckedChange={toggleSelectAll}
                                disabled={results.length === 0}
                                label="Select all market signals on this page"
                            />
                            <span>Select page</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span>
                            {total === 0 ? "0 signals" : `${firstIndex}–${lastIndex} of ${total}`}
                        </span>
                        <label className="inline-flex items-center gap-1">
                            <span>Per page</span>
                            <select
                                value={String(pageSize)}
                                onChange={(e) => updateParams({ pageSize: e.target.value, page: null })}
                                className="h-7 rounded border border-input bg-background px-1 text-[15px]"
                            >
                                {PAGE_SIZE_OPTIONS.map((n) => (
                                    <option key={n} value={n}>
                                        {n}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                </div>

                {results.length === 0 ? (
                    <p className="rounded-md border border-border/50 bg-background/40 px-6 py-10 text-center text-[17px] text-muted-foreground">
                        {hasActiveFilters
                            ? "No signals match the current filters."
                            : "No market signals detected yet. Signals appear here once the monitor runs."}
                    </p>
                ) : (
                    <ul className="space-y-3">
                        {results.map((result) => (
                            <ResultRow
                                key={result.id}
                                result={result}
                                selected={selected.has(result.id)}
                                onToggleSelected={(checked) => {
                                    setSelected((prev) => {
                                        const next = new Set(prev);
                                        if (checked) next.add(result.id);
                                        else next.delete(result.id);
                                        return next;
                                    });
                                }}
                                onActionError={setActionError}
                            />
                        ))}
                    </ul>
                )}

                <Pagination
                    page={page}
                    totalPages={totalPages}
                    onChange={(p) => updateParams({ page: p === 1 ? null : String(p) })}
                />
            </section>
        </div>
        </DashboardAppWorkbench>
    );
}

function ConfigSummary({ config }: { config: MarketMonitorConfig }) {
    return (
        <dl className="mt-4 grid grid-cols-1 gap-3 text-[15px] sm:grid-cols-3">
            <ConfigBlock icon={<TrendingUp className="h-3.5 w-3.5" />} label="Competitors" items={config.competitor_domains} />
            <ConfigBlock icon={<Shield className="h-3.5 w-3.5" />} label="Authority sources" items={config.authority_domains} />
            <ConfigBlock icon={<RefreshCw className="h-3.5 w-3.5" />} label="Keywords" items={config.industry_keywords} />
        </dl>
    );
}

function ConfigBlock({ icon, label, items }: { icon: React.ReactNode; label: string; items: string[] }) {
    return (
        <div className="rounded-lg border border-border/50 bg-background/40 px-3 py-2">
            <dt className="flex items-center gap-1.5 text-[14px] uppercase tracking-wider text-muted-foreground">
                {icon}
                {label}
            </dt>
            <dd className="mt-1 text-foreground/90">
                {items.length === 0 ? (
                    <span className="text-muted-foreground italic">None configured</span>
                ) : (
                    items.slice(0, 4).join(", ") + (items.length > 4 ? `, +${items.length - 4}` : "")
                )}
            </dd>
        </div>
    );
}

function SegmentedControl<T extends string>({
    value,
    onChange,
    options,
}: {
    value: T;
    onChange: (v: T) => void;
    options: Array<{ value: T; label: string }>;
}) {
    return (
        <div className="inline-flex overflow-hidden rounded-md border border-border/60 bg-background/60 text-[15px]">
            {options.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange(opt.value)}
                    className={`px-3 py-1.5 transition-colors ${
                        value === opt.value
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-full px-2.5 py-1 text-[14px] font-medium transition-colors ${
                active
                    ? "bg-primary text-primary-foreground"
                    : "border border-border/60 bg-background/60 text-muted-foreground hover:text-foreground"
            }`}
        >
            {label}
        </button>
    );
}

function BulkActionButton({
    onClick,
    pending,
    icon,
    label,
    tone = "default",
}: {
    onClick: () => void;
    pending: boolean;
    icon: React.ReactNode;
    label: string;
    tone?: "default" | "destructive";
}) {
    const toneClass =
        tone === "destructive"
            ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
            : "border-border/60 bg-background/60 hover:text-foreground";
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={pending}
            aria-busy={pending || undefined}
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[15px] transition-colors disabled:opacity-50 ${toneClass}`}
        >
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : icon}
            {label}
        </button>
    );
}

function Pagination({
    page,
    totalPages,
    onChange,
}: {
    page: number;
    totalPages: number;
    onChange: (page: number) => void;
}) {
    const pages = useMemo(() => {
        const out = new Set<number>();
        out.add(1);
        out.add(totalPages);
        for (let i = Math.max(1, page - 1); i <= Math.min(totalPages, page + 1); i++) {
            out.add(i);
        }
        return Array.from(out).sort((a, b) => a - b);
    }, [page, totalPages]);

    if (totalPages <= 1) return null;

    return (
        <nav className="flex items-center justify-center gap-1 text-[15px]">
            <button
                type="button"
                onClick={() => onChange(page - 1)}
                disabled={page <= 1}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-border/60 px-2 text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
                <ChevronLeft className="h-3 w-3" />
                Prev
            </button>
            {pages.map((p, index) => {
                const prev = pages[index - 1];
                const gap = prev !== undefined && p - prev > 1;
                return (
                    <span key={p} className="inline-flex items-center gap-1">
                        {gap ? <span className="px-1 text-muted-foreground">…</span> : null}
                        <button
                            type="button"
                            onClick={() => onChange(p)}
                            className={`h-8 min-w-8 rounded-md px-2 font-medium ${
                                p === page
                                    ? "bg-primary text-primary-foreground"
                                    : "border border-border/60 text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {p}
                        </button>
                    </span>
                );
            })}
            <button
                type="button"
                onClick={() => onChange(page + 1)}
                disabled={page >= totalPages}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-border/60 px-2 text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
                Next
                <ChevronRight className="h-3 w-3" />
            </button>
        </nav>
    );
}

function ResultRow({
    result,
    selected,
    onToggleSelected,
    onActionError,
}: {
    result: MarketMonitorResult;
    selected: boolean;
    onToggleSelected: (checked: boolean) => void;
    onActionError: (message: string | null) => void;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [localRead, setLocalRead] = useState(result.read);
    const [localArchived, setLocalArchived] = useState(result.archived);

    useEffect(() => setLocalRead(result.read), [result.read]);
    useEffect(() => setLocalArchived(result.archived), [result.archived]);

    const runAction = (
        runner: () => Promise<{ error: string | null }>,
        onSuccess?: () => void,
    ) => {
        onActionError(null);
        startTransition(async () => {
            const res = await runner();
            if (res.error) {
                onActionError(res.error);
                return;
            }
            onSuccess?.();
            router.refresh();
        });
    };

    const toggleRead = () => {
        const next = !localRead;
        setLocalRead(next);
        runAction(
            () => setMarketMonitorResultsRead([result.id], next),
            () => undefined,
        );
    };

    const toggleArchive = () => {
        const next = !localArchived;
        setLocalArchived(next);
        runAction(
            () => setMarketMonitorResultsArchived([result.id], next),
            () => undefined,
        );
    };

    const remove = () => {
        if (!confirm("Delete this signal? This cannot be undone.")) return;
        runAction(async () => await deleteMarketMonitorResults([result.id]));
    };

    const changeType = (result.change_type as MonitorChangeType) ?? "new_page";
    const toneClass = CHANGE_TYPE_TONE[changeType] ?? CHANGE_TYPE_TONE.new_page;

    return (
        <li
            className={`premium-panel flex gap-3 rounded-md border px-5 py-4 transition-opacity ${
                localRead ? "opacity-70" : ""
            } ${localArchived ? "border-dashed" : ""}`}
        >
            <div className="flex shrink-0 items-start">
                <SelectionCheckbox
                    checked={selected}
                    onCheckedChange={onToggleSelected}
                    label={`Select market signal ${result.title ?? result.url}`}
                />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[13px] font-medium uppercase tracking-wider ${toneClass}`}
                    >
                        {CHANGE_TYPE_LABEL[changeType] ?? changeType}
                    </span>
                    <span className="text-[14px] text-muted-foreground">Trust tier {result.trust_tier}</span>
                    <span className="text-[14px] text-muted-foreground">
                        {new Date(result.detected_at).toLocaleDateString()}
                    </span>
                    {localArchived ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[13px] uppercase tracking-wider text-muted-foreground">
                            <Archive className="h-2.5 w-2.5" /> Archived
                        </span>
                    ) : null}
                </div>
                <h3 className="mt-2 truncate font-semibold">{result.title ?? result.url}</h3>
                {result.snippet ? (
                    <p className="mt-1 line-clamp-2 text-[17px] text-muted-foreground leading-relaxed">
                        {result.snippet}
                    </p>
                ) : null}
                <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-[15px] text-primary hover:underline"
                >
                    <ExternalLink className="h-3 w-3" />
                    Open source
                </a>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
                <RowActionButton
                    onClick={toggleRead}
                    pending={isPending}
                    icon={localRead ? <EyeOff className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                    label={localRead ? "Mark unread" : "Mark read"}
                />
                <RowActionButton
                    onClick={toggleArchive}
                    pending={isPending}
                    icon={localArchived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
                    label={localArchived ? "Unarchive" : "Archive"}
                />
                <RowActionButton
                    onClick={remove}
                    pending={isPending}
                    icon={<Trash2 className="h-3 w-3" />}
                    label="Delete"
                    tone="destructive"
                />
            </div>
        </li>
    );
}

function RowActionButton({
    onClick,
    pending,
    icon,
    label,
    tone = "default",
}: {
    onClick: () => void;
    pending: boolean;
    icon: React.ReactNode;
    label: string;
    tone?: "default" | "destructive";
}) {
    const toneClass =
        tone === "destructive"
            ? "hover:border-destructive/40 hover:text-destructive"
            : "hover:border-primary/40 hover:text-primary";
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={pending}
            aria-busy={pending || undefined}
            className={`inline-flex shrink-0 items-center gap-1 rounded-md border border-border/60 bg-background/60 px-2.5 py-1 text-[15px] transition-colors disabled:opacity-50 ${toneClass}`}
        >
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : icon}
            {label}
        </button>
    );
}
