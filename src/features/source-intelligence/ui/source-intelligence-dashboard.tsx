"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, type ReactNode } from "react";
import {
    AlertTriangle,
    CheckCircle2,
    CircleDot,
    Clock3,
    ExternalLink,
    FileCheck2,
    Gauge,
    Library,
    Loader2,
    Play,
    Search,
    ShieldCheck,
    type LucideIcon,
} from "lucide-react";
import type {
    ContentEvidenceLinkDashboardItem,
    SourceEvidenceClaimDashboardItem,
    SourceIngestionRunDashboardItem,
    SourceIntelligenceDashboardData,
    SourceIntelligenceFilters,
    SourceRegistryDashboardItem,
} from "@/features/source-intelligence/dashboard";
import type { SourceQuality, SourceTrustTier } from "@/features/source-intelligence/types";
import {
    initialSourceIntelligenceRunActionState,
    type SourceIntelligenceRunActionState,
} from "@/features/source-intelligence/action-state";
import {
    triggerSourceIntelligenceRunAction,
    updateContentEvidenceFeedbackFormAction,
} from "@/features/source-intelligence/actions";

import {
    DashboardAppWorkbench,
    AppCommandBar,
    AppMetricStrip,
    AppMetric,
    AppFeedbackLoop,
} from "@/features/admin/ui/app-workbench";

const QUALITY_OPTIONS: Array<SourceQuality | "all"> = ["all", "authoritative", "high", "medium", "low", "unverified"];
const TIER_OPTIONS: Array<SourceTrustTier | "all"> = ["all", "regulatory", "industry", "internal", "vendor", "community", "unknown"];
const LOCALE_OPTIONS = ["all", "en", "nl", "ar"] as const;

function formatDate(value: string | null | undefined, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("en", options).format(date);
}

function qualityTone(quality: SourceQuality | null) {
    switch (quality) {
        case "authoritative":
            return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
        case "high":
            return "border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400";
        case "medium":
            return "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400";
        case "low":
            return "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400";
        default:
            return "border-border bg-muted/50 text-muted-foreground";
    }
}

function statusTone(status: string | null) {
    if (status === "completed" || status === "accepted" || status === "healthy") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    if (status === "running" || status === "queued") return "border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400";
    if (status === "failed" || status === "rejected" || status === "missing" || status === "blocked" || status === "unauthorized") return "border-destructive/30 bg-destructive/10 text-destructive";
    if (status === "downgraded" || status === "superseded" || status === "rate_limited" || status === "degraded") return "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400";
    return "border-border bg-muted/50 text-muted-foreground";
}

function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
    return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[14px] font-semibold uppercase tracking-[0.12em] ${className}`}>{children}</span>;
}

export function SourceIntelligenceDashboard({ data, filters }: { data: SourceIntelligenceDashboardData; filters: SourceIntelligenceFilters }) {
    if (data.error) {
        return (
            <DashboardAppWorkbench>
                <div className="p-4">
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-5 py-4 text-[17px] text-destructive">
                        <strong>Source Intelligence failed to load:</strong> {data.error}
                    </div>
                </div>
            </DashboardAppWorkbench>
        );
    }

    return (
        <DashboardAppWorkbench>
            <AppCommandBar>
                <div className="flex w-full items-center justify-end">
                    <ManualRefreshForm variant="compact" />
                </div>
            </AppCommandBar>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <OperationalDiagnostics data={data} />

                <AutomationStatusPanel data={data} />

                <AppFeedbackLoop
                    title="Evidence confidence loop"
                    description="Source registry health determines what can become verified, public-safe evidence."
                    stages={[
                        { label: "Sources", value: data.stats.enabledSources, detail: "enabled registry", tone: data.stats.enabledSources > 0 ? "info" : "warning" },
                        { label: "Queued", value: data.stats.queuedJobs, detail: "awaiting worker", tone: data.stats.queuedJobs > 0 ? "warning" : "default" },
                        { label: "Running", value: data.stats.runningJobs, detail: "being checked", tone: data.stats.runningJobs > 0 ? "info" : "default" },
                        { label: "Claims", value: data.stats.visualEligibleClaims, detail: "evidence-ready", tone: "success" },
                        { label: "Public", value: data.stats.publicEvidenceLinks, detail: "safe links", tone: "success" },
                    ]}
                    feedbackLabel="Failed or stale ingestion changes source trust; public evidence should never outrun verification."
                />

                <AppMetricStrip>
                    <AppMetric icon={ShieldCheck} label="Approved sources" value={data.stats.approvedSources} />
                    <AppMetric icon={Gauge} label="Authority tier" value={data.stats.authoritativeSources} />
                    <AppMetric icon={Library} label="Visual claims" value={data.stats.visualEligibleClaims} />
                    <AppMetric icon={FileCheck2} label="Public links" value={data.stats.publicEvidenceLinks} />
                </AppMetricStrip>

                <FilterBar filters={filters} contentItems={data.contentItems} />

                <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                    <SourceRegistryPanel registry={data.registry} enabledSources={data.stats.enabledSources} />
                    <IngestionRunsPanel runs={data.runs} queuedJobs={data.stats.queuedJobs} runningJobs={data.stats.runningJobs} />
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                    <EvidenceLibraryPanel claims={data.claims} />
                    <ContentEvidencePanel links={data.contentLinks} validation={data.validationPreview} />
                </div>
            </div>
        </DashboardAppWorkbench>
    );
}

function ManualRefreshForm({ registryId, sourceName, variant = "compact" }: { registryId?: string; sourceName?: string; variant?: "hero" | "compact" }) {
    const router = useRouter();
    const [state, formAction, isPending] = useActionState(triggerSourceIntelligenceRunAction, initialSourceIntelligenceRunActionState);

    useEffect(() => {
        if (state.timestamp && state.success) router.refresh();
    }, [router, state.success, state.timestamp]);

    const isHero = variant === "hero";

    return (
        <form action={formAction} className={isHero ? "relative z-10 flex max-w-md flex-col items-start gap-3" : "flex flex-col items-end gap-2"}>
            {registryId ? <input type="hidden" name="registryId" value={registryId} /> : null}
            <button
                type="submit"
                disabled={isPending}
                className={isHero
                    ? "inline-flex h-11 items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400 px-5 text-[17px] font-bold text-slate-950 shadow-[0_0_32px_rgba(34,211,238,0.28)] transition hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-70"
                    : "rounded-full border border-slate-700/80 bg-slate-900/85 px-3 py-1.5 text-[14px] font-bold uppercase tracking-[0.12em] text-slate-100 transition hover:border-cyan-300/40 hover:bg-cyan-400/10 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                }
                aria-label={sourceName ? `Refresh ${sourceName}` : "Run source intelligence ingestion manually"}
                aria-busy={isPending || undefined}
            >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {isPending ? "Refreshing…" : isHero ? "Manual refresh" : "Refresh"}
            </button>
            <RunActionFeedback state={state} compact={!isHero} />
        </form>
    );
}

function RunActionFeedback({ state, compact }: { state: SourceIntelligenceRunActionState; compact: boolean }) {
    if (!state.timestamp) return null;
    const tone = state.error
        ? "border-rose-400/35 bg-rose-950/75 text-rose-100"
        : state.enqueued === 0 && state.processed === 0
            ? "border-amber-400/35 bg-amber-950/75 text-amber-100"
            : "border-emerald-400/35 bg-emerald-950/70 text-emerald-100";
    return (
        <div className={`rounded-md border ${tone} ${compact ? "max-w-xs px-3 py-2 text-right text-[14px]" : "w-full px-4 py-3 text-[17px]"}`} role="status" aria-live="polite">
            <p className="font-semibold">{state.error ? "Refresh failed" : state.enqueued === 0 && state.processed === 0 ? "Refresh checked the queue" : "Refresh triggered"}</p>
            <p className="mt-1 leading-5">{state.summary}</p>
            {!compact && !state.error ? (
                <p className="mt-2 text-[15px] opacity-80">
                    Run: {state.runId ?? "no new run"} · Enqueued {state.enqueued} · Processed {state.processed} · Existing queued {state.existingQueued} · {formatDate(state.timestamp, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
            ) : null}
        </div>
    );
}

function OperationalDiagnostics({ data }: { data: SourceIntelligenceDashboardData }) {
    const messages: string[] = [];
    if (data.stats.enabledSources === 0) {
        messages.push("No enabled sources are available. Manual refresh can only enqueue active source registry entries.");
    }
    if (data.stats.queuedJobs > 0 && data.stats.runningJobs === 0) {
        messages.push(`${data.stats.queuedJobs} source job${data.stats.queuedJobs === 1 ? " is" : "s are"} queued with no running job visible. Confirm the Coolify worker process is running npm run worker:source-intelligence.`);
    }
    if (data.stats.runningJobs > 0) {
        messages.push(`${data.stats.runningJobs} source job${data.stats.runningJobs === 1 ? " is" : "s are"} currently running; new refreshes avoid duplicate active jobs.`);
    }
    if (data.stats.failedJobs > 0) {
        messages.push(`${data.stats.failedJobs} source job${data.stats.failedJobs === 1 ? " has" : "s have"} failed in the latest visible ingestion runs. Check worker logs for fetch, policy, or schema errors.`);
    }
    if (messages.length === 0) return null;

    return (
        <section className="rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-[17px] text-amber-800 dark:text-amber-200">
            <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                    <p className="font-semibold">Source Intelligence queue notes</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] leading-5 text-amber-800/90 dark:text-amber-100/90">
                        {messages.map((message) => <li key={message}>{message}</li>)}
                    </ul>
                </div>
            </div>
        </section>
    );
}

function AutomationStatusPanel({ data }: { data: SourceIntelligenceDashboardData }) {
    const queuedWaiting = data.stats.queuedJobs > 0;
    const workerHandoff = queuedWaiting && data.stats.runningJobs === 0
        ? "Queued jobs are waiting. If this number does not fall after the next worker poll, inspect the Coolify worker process."
        : data.stats.runningJobs > 0
            ? "A worker has running jobs visible now. Cron should continue enqueueing; the durable worker handles ingestion."
            : "No queued Source Intelligence jobs are waiting for the worker.";

    return (
        <section className="rounded-md border border-border/50 bg-card p-4 text-[17px] text-foreground">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                    <span className="rounded-md border border-border bg-muted p-2 text-muted-foreground">
                        <Clock3 className="h-4 w-4" />
                    </span>
                    <div>
                        <p className="font-semibold text-foreground">Scheduled automation handoff</p>
                        <p className="mt-1 max-w-3xl text-[15px] leading-5 text-muted-foreground">
                            Coolify cron calls the protected run endpoint to enqueue due sources; the separate long-running worker drains durable jobs from the database.
                        </p>
                    </div>
                </div>
                <div className="grid min-w-0 gap-2 text-[15px] sm:grid-cols-3 lg:min-w-[520px]">
                    <RunMetric label="last trigger" value={data.stats.latestRunTrigger ?? "—"} />
                    <RunMetric label="last reason" value={data.stats.latestRunReason ?? "—"} />
                    <RunMetric label="last cron" value={formatDate(data.stats.latestScheduledRunAt, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} />
                </div>
            </div>
            <p className={`mt-3 rounded-md border px-3 py-2 text-[15px] leading-5 ${queuedWaiting ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"}`}>
                {workerHandoff}
            </p>
        </section>
    );
}

function FilterBar({ filters, contentItems }: { filters: SourceIntelligenceFilters; contentItems: SourceIntelligenceDashboardData["contentItems"] }) {
    return (
        <form action="/dashboard/source-intelligence" className="rounded-md border border-border/50 bg-card p-4">
            <div className="grid dashboard-mobile-stack gap-3 md:grid-cols-[1.2fr_repeat(4,minmax(0,0.75fr))]">
                <label className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <span className="sr-only">Search sources or claims</span>
                    <input name="q" defaultValue={filters.search ?? ""} placeholder="Search source, claim, or URL" className="h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 text-[17px] text-foreground outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-ring" />
                </label>
                <Select name="locale" label="Locale" value={filters.locale ?? "all"} options={LOCALE_OPTIONS.map((value) => ({ value, label: value.toUpperCase() }))} />
                <Select name="quality" label="Quality" value={filters.quality ?? "all"} options={QUALITY_OPTIONS.map((value) => ({ value, label: value }))} />
                <Select name="tier" label="Tier" value={filters.trustTier ?? "all"} options={TIER_OPTIONS.map((value) => ({ value, label: value }))} />
                <Select name="contentId" label="Content" value={filters.contentId ?? ""} options={[{ value: "", label: "Latest content" }, ...contentItems.map((item) => ({ value: item.id, label: item.title }))]} />
            </div>
            <div className="mt-3 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Link href="/dashboard/source-intelligence" className="text-[15px] font-medium text-muted-foreground transition hover:text-foreground">Clear filters</Link>
                <button type="submit" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-[15px] font-medium text-primary-foreground hover:bg-primary/90 transition cursor-pointer">
                    Apply filters
                </button>
            </div>
        </form>
    );
}

function Select({ name, label, value, options }: { name: string; label: string; value: string; options: Array<{ value: string; label: string }> }) {
    return (
        <label className="block">
            <span className="sr-only">{label}</span>
            <select name={name} defaultValue={value} className="h-11 w-full rounded-md border border-input bg-background px-3 text-[17px] text-foreground outline-none transition focus:ring-2 focus:ring-ring" aria-label={label}>
                {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
        </label>
    );
}

function Panel({ title, icon: Icon, children, empty, emptyMessage }: { title: string; icon: LucideIcon; children: ReactNode; empty?: boolean; emptyMessage?: string }) {
    return (
        <section className="rounded-md border border-border/50 bg-card p-5 text-foreground">
            <div className="mb-4 flex items-center gap-2">
                <span className="rounded-md border border-border bg-muted p-2 text-muted-foreground"><Icon className="h-4 w-4" /></span>
                <h2 className="text-[19px] font-bold tracking-tight text-foreground">{title}</h2>
            </div>
            {empty ? <EmptyState message={emptyMessage} /> : children}
        </section>
    );
}

function EmptyState({ message = "No records match the current filters yet." }: { message?: string }) {
    return (
        <div className="rounded-md border border-dashed border-border/50 bg-background/50 p-6 text-center text-[17px] leading-6 text-muted-foreground">
            {message}
        </div>
    );
}

function SourceRegistryPanel({ registry, enabledSources }: { registry: SourceRegistryDashboardItem[]; enabledSources: number }) {
    const emptyMessage = enabledSources === 0
        ? "No enabled sources are available. Enable at least one source registry entry before manual refresh can queue ingestion jobs."
        : "No source registry rows match the current filters. Clear filters to inspect enabled sources.";
    return (
        <Panel title="Source registry" icon={ShieldCheck} empty={registry.length === 0} emptyMessage={emptyMessage}>
            <div className="space-y-3">
                {registry.map((source) => (
                    <article key={source.id} className="rounded-md border border-border/50 bg-card/60 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h3 className="truncate text-[17px] font-semibold text-foreground">{source.name}</h3>
                                <a href={source.canonicalUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-[15px] text-primary hover:underline">
                                    <span className="truncate">{source.canonicalUrl}</span><ExternalLink className="h-3 w-3 shrink-0" />
                                </a>
                            </div>
                            <ManualRefreshForm registryId={source.id} sourceName={source.name} />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <Pill className={qualityTone(source.quality)}>{source.quality}</Pill>
                            <Pill className="border-border bg-background text-muted-foreground">{source.trustTier}</Pill>
                            <Pill className={source.enabled ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border-border bg-muted/40 text-muted-foreground"}>{source.enabled ? "Enabled" : "Paused"}</Pill>
                            <Pill className={statusTone(source.latestStatus)}>{source.latestStatus ?? "not checked"}</Pill>
                            {source.sourceHealthStatus ? <Pill className={statusTone(source.sourceHealthStatus)}>health: {source.sourceHealthStatus}</Pill> : null}
                        </div>
                        <p className="mt-3 text-[15px] text-muted-foreground">Cadence: {source.cadence} · Last checked: {formatDate(source.lastCheckedAt, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                        {source.sourceHealthReason ? <p className="mt-2 text-[15px] text-amber-600 dark:text-amber-400">Latest fetch classification: {source.sourceHealthReason}</p> : null}
                        {source.topicTags.length ? <p className="mt-2 text-[15px] text-muted-foreground">{source.topicTags.join(" · ")}</p> : null}
                    </article>
                ))}
            </div>
        </Panel>
    );
}

function IngestionRunsPanel({ runs, queuedJobs, runningJobs }: { runs: SourceIngestionRunDashboardItem[]; queuedJobs: number; runningJobs: number }) {
    const emptyMessage = queuedJobs > 0
        ? `${queuedJobs} jobs are queued, but no ingestion run is visible in the current result window. Confirm the worker is running and refresh the dashboard.`
        : runningJobs > 0
            ? `${runningJobs} jobs are running. Results will appear here after the worker refreshes run metrics.`
            : "No ingestion runs exist yet. Use Manual refresh to enqueue enabled sources; if jobs remain queued, start the Source Intelligence worker.";
    return (
        <Panel title="Ingestion runs" icon={CircleDot} empty={runs.length === 0} emptyMessage={emptyMessage}>
            <div className="space-y-3">
                {runs.map((run) => (
                    <article key={run.id} className="rounded-md border border-border/50 bg-card/60 p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-[17px] font-semibold text-foreground">{run.sourceName ?? "Workspace sweep"}</p>
                                <p className="mt-1 text-[15px] text-muted-foreground">{run.reason} · {run.trigger} · {formatDate(run.requestedAt ?? run.createdAt, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                            </div>
                            <Pill className={statusTone(run.status)}>{run.status}</Pill>
                        </div>
                        <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[15px]">
                            <RunMetric label="sources" value={run.totalJobs} />
                            <RunMetric label="docs" value={run.documentCount} />
                            <RunMetric label="done" value={run.completedJobs} />
                            <RunMetric label="errors" value={run.failedJobs} />
                        </div>
                        {run.drainLimit !== null ? <p className="mt-3 text-[15px] text-muted-foreground">Requested drain limit: {run.drainLimit}</p> : null}
                    </article>
                ))}
            </div>
        </Panel>
    );
}

function RunMetric({ label, value }: { label: string; value: number | string }) {
    return <div className="rounded-md border border-border/50 bg-background/50 px-2 py-2"><p className="font-bold text-foreground">{value}</p><p className="mt-0.5 uppercase tracking-wide text-muted-foreground">{label}</p></div>;
}

function EvidenceLibraryPanel({ claims }: { claims: SourceEvidenceClaimDashboardItem[] }) {
    return (
        <Panel title="Evidence library" icon={Library} empty={claims.length === 0} emptyMessage="No extracted claims match the current filters. If ingestion jobs are only queued, start or inspect the worker before expecting claims here.">
            <div className="max-h-[720px] space-y-3 overflow-y-auto pr-1">
                {claims.map((claim) => (
                    <article key={claim.id} className="rounded-md border border-border/50 bg-card/60 p-4">
                        <div className="flex flex-wrap gap-2">
                            <Pill className={qualityTone(claim.quality)}>{claim.quality}</Pill>
                            <Pill className="border-border bg-background text-muted-foreground">{claim.trustTier}</Pill>
                            {claim.visualEligible ? <Pill className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">visual eligible</Pill> : null}
                            <Pill className="border-border bg-background text-muted-foreground">{Math.round(claim.confidence)}%</Pill>
                        </div>
                        <p className="mt-3 text-[17px] leading-6 text-foreground/90">{claim.claimText}</p>
                        <a href={claim.citationUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[15px] font-medium text-primary hover:underline">
                            {claim.publisher ?? claim.sourceTitle}<ExternalLink className="h-3 w-3" />
                        </a>
                    </article>
                ))}
            </div>
        </Panel>
    );
}

function ContentEvidencePanel({ links, validation }: { links: ContentEvidenceLinkDashboardItem[]; validation: SourceIntelligenceDashboardData["validationPreview"] }) {
    return (
        <div className="space-y-6">
            <Panel title="Validation preview" icon={AlertTriangle} empty={!validation} emptyMessage="No content is available for validation preview under the current template/content filters.">
                {validation ? (
                    <div className="rounded-md border border-border/50 bg-card/60 p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-[17px] font-semibold text-foreground">{validation.title}</p>
                                <p className="mt-1 text-[15px] text-muted-foreground">{validation.blockerCount} blockers · {validation.warningCount} warnings · {validation.repairAttempts} repair attempts</p>
                            </div>
                            <Pill className={validation.valid ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border-destructive/30 bg-destructive/10 text-destructive"}>{validation.valid ? "Pass" : "Review"}</Pill>
                        </div>
                        <div className="mt-4 space-y-2">
                            {validation.topIssues.length ? validation.topIssues.map((issue) => (
                                <div key={`${issue.code}-${issue.message}`} className="rounded-md border border-border/40 bg-background/60 p-3">
                                    <p className="text-[15px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">{issue.severity} · {issue.code}</p>
                                    <p className="mt-1 text-[15px] leading-5 text-foreground/90">{issue.message}</p>
                                    <p className="mt-1 text-[15px] leading-5 text-muted-foreground">Repair: {issue.repairInstruction}</p>
                                </div>
                            )) : <p className="text-[17px] text-muted-foreground">No blocker codes found for this article.</p>}
                        </div>
                    </div>
                ) : null}
            </Panel>
            <Panel title="Content evidence links" icon={FileCheck2} empty={links.length === 0} emptyMessage="No evidence links match the current filters. Public proof surfaces are unchanged; links only appear after governed evidence has been attached to content.">
                <div className="space-y-3">
                    {links.map((link) => (
                        <article key={link.id} className="rounded-md border border-border/50 bg-card/60 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-[17px] font-semibold text-foreground">{link.contentTitle}</p>
                                    <p className="mt-1 text-[15px] text-muted-foreground">{link.sourceTitle ?? link.citationLabel ?? "External citation"}</p>
                                </div>
                                <Pill className={statusTone(link.validationStatus)}>{link.validationStatus}</Pill>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <Pill className={qualityTone(link.quality)}>{link.quality ?? "unknown"}</Pill>
                                <Pill className="border-border bg-background text-muted-foreground">{link.trustTier ?? "unknown"}</Pill>
                                <Pill className={link.isPublicSafe ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border-border bg-muted/40 text-muted-foreground"}>{link.isPublicSafe ? "public safe" : "private"}</Pill>
                            </div>
                            {link.citationUrl ? <a href={link.citationUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[15px] text-primary hover:underline">Open citation <ExternalLink className="h-3 w-3" /></a> : null}
                            <form action={updateContentEvidenceFeedbackFormAction} className="mt-3 flex flex-wrap gap-2">
                                <input type="hidden" name="linkId" value={link.id} />
                                <FeedbackButton value="accepted" label="Accept" icon="accept" />
                                <FeedbackButton value="downgraded" label="Downgrade" icon="warn" />
                                <FeedbackButton value="rejected" label="Reject" icon="reject" />
                            </form>
                        </article>
                    ))}
                </div>
            </Panel>
        </div>
    );
}

function FeedbackButton({ value, label, icon }: { value: string; label: string; icon: "accept" | "warn" | "reject" }) {
    const Icon = icon === "accept" ? CheckCircle2 : icon === "reject" ? AlertTriangle : Gauge;
    return (
        <button type="submit" name="feedback" value={value} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-[15px] font-semibold text-foreground transition hover:bg-muted cursor-pointer">
            <Icon className="h-3 w-3" /> {label}
        </button>
    );
}
