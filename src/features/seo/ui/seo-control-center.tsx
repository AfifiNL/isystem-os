import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, CircleSlash, ExternalLink, FileText, GitBranch, Globe2, Lightbulb, LoaderCircle, Network, PlusCircle, RefreshCcw, Send, Target } from "lucide-react";
import type { SeoDashboardData } from "@/features/seo/types";
import type { SeoInternalLinkOpportunityRecord, SeoListPageMeta } from "@/features/seo/types";
import { SEO_PLAN_STATUS_VALUES, SEO_RECOMMENDATION_STATUS_VALUES } from "@/features/seo/types";
import { formatInternalLinkAutomationOutcome, normalizeInternalLinkJobSummary } from "@/features/seo/lib/internal-link-job-summary";
import { SpecialistListPanel } from "@/features/seo/ui/specialist-list-panel";
import { StrategistOpportunitiesPanel } from "@/features/seo/ui/strategist-opportunities-panel";
import { StrategistClustersPanel } from "@/features/seo/ui/strategist-clusters-panel";
import { StrategistPlansPanel } from "@/features/seo/ui/strategist-plans-panel";
import { SeoAiActionBar } from "@/features/seo/ui/seo-ai-action-bar";
import { PendingFormButton } from "@/shared/ui/pending-form-button";
import {
    generateSeoExecutionPreview,
    applySeoInternalLinkRecommendation,
    rollbackSeoInternalLinkExecution,
} from "@/features/seo/actions";
import { ProFeatureNotice } from "@/shared/ui/pro-feature-notice";
import { cn } from "@/shared/lib/utils";
import {
    DashboardAppWorkbench,
    AppCommandBar,
    AppMetricStrip,
    AppMetric,
    AppTabList,
    AppFeedbackLoop,
    AppTrendChart,
} from "@/features/admin/ui/app-workbench";

interface SeoControlCenterProps {
    data: SeoDashboardData;
    activeTab: string;
    /** Optional slug highlighted by an inbound "Audit" deep link (e.g. from Analytics or the inbox). */
    focusedSlug?: string | null;
    currentParams?: Record<string, string | string[] | undefined>;
    runSeoSpecialistAuditAction: (locale: string) => Promise<void>;
    runSeoStrategistAnalysisAction: (locale: string) => Promise<void>;
    updateSeoInternalLinkOpportunityAction: (id: string, status: string) => Promise<{ ok: true; status: string }>;
    generateSeoExecutionPreviewAction: (recommendationId: string) => Promise<import("@/features/seo/types").SeoExecutionActionResult>;
    applySeoInternalLinkRecommendationAction: (recommendationId: string) => Promise<import("@/features/seo/types").SeoExecutionActionResult>;
    rollbackSeoInternalLinkExecutionAction: (executionId: string) => Promise<import("@/features/seo/types").SeoExecutionActionResult>;
    updateSeoContentOpportunityStatusAction: (formData: FormData) => Promise<void>;
    updateSeoContentPlanStatusAction: (formData: FormData) => Promise<void>;
    spawnSeoPlansFromClusterAction: (formData: FormData) => Promise<void>;
    clearSeoInternalLinkOpportunitiesByStatusAction: (formData: FormData) => Promise<void>;
    enqueueAllPublishedContentJobsAction: (locale: string) => Promise<{ enqueuedCount: number }>;
    queueSeoIndexingJobAction: (formData: FormData) => Promise<void>;
    queueAllSeoIndexingJobsAction: (formData: FormData) => Promise<void>;
}

interface GscPreviewPayload {
    gsc?: {
        provenance?: string;
        query?: string;
    };
}

interface GscOpportunityEvidence {
    provenance?: string;
    query?: string;
    page_slug?: string;
    impressions?: number;
    clicks?: number;
    ctr?: number;
    position?: number;
    opportunity_type?: string;
    confidence_score?: number;
}

interface GscOpportunityMetadata {
    gsc?: GscOpportunityEvidence | null;
    internalLinkPolicy?: {
        autoApplyRuntimeSkipped?: boolean;
        autoApplyRuntimeSkipReason?: string;
        autoApplyEligible?: boolean;
    } | null;
    applied_via?: string;
    applied_automation_mode?: string;
}

const TAB_ITEMS = [
    { key: "overview", label: "Overview", icon: BarChart3 },
    { key: "search_console", label: "Search Console", icon: BarChart3 },
    { key: "indexing", label: "Indexing", icon: Globe2 },
    { key: "specialist", label: "SEO Specialist", icon: Network },
    { key: "strategist", label: "SEO Strategist", icon: Lightbulb },
    { key: "graph", label: "Content Graph", icon: GitBranch },
    { key: "plans", label: "Plans / Tasks", icon: Target },
];

function StatusPill({ value }: { value: string }) {
    const tone = value === "approved" || value === "saved" || value === "done" || value === "completed" || value === "applied" || value === "indexed"
        ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        : value === "dismissed" || value === "failed"
            ? "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300"
            : "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";

    return <span className={cn("inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]", tone)}>{value.replace(/_/g, " ")}</span>;
}

function formatIndexingDate(value: string | null | undefined) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

function indexingActionLabel(action: "queue" | "retry" | "none", status: string) {
    if (action === "queue") return "Queue indexing";
    if (action === "retry") return status === "failed" ? "Retry indexing" : "Queue retry";
    if (status === "queued") return "Queued";
    if (status === "processing") return "Processing";
    if (status === "indexed") return "Indexed";
    return "Submitted";
}

function latestAttemptLabel(row: SeoDashboardData["indexingRows"][number]) {
    const attempt = row.latestAttempt;
    if (!attempt) return "—";
    return `${attempt.provider.replace(/_/g, " ")} · ${attempt.status}`;
}

function buildSeoHref(
    current: Record<string, string | string[] | undefined> | undefined,
    patch: Record<string, string | null>,
): string {
    const params = new URLSearchParams();
    if (current) {
        for (const [k, v] of Object.entries(current)) {
            if (v == null) continue;
            const raw = Array.isArray(v) ? v.join(",") : v;
            if (raw) params.set(k, raw);
        }
    }
    for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") params.delete(k);
        else params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `/dashboard/seo?${qs}` : "/dashboard/seo";
}

function SeoPaginationStrip({
    meta,
    keyPrefix,
    current,
    pageSizeOptions = [5, 10, 25],
}: {
    meta: SeoListPageMeta;
    keyPrefix: string;
    current: Record<string, string | string[] | undefined> | undefined;
    pageSizeOptions?: number[];
}) {
    const totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));
    const first = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
    const last = Math.min(meta.total, meta.page * meta.pageSize);
    const prevHref = buildSeoHref(current, {
        [`${keyPrefix}Page`]: meta.page <= 1 ? null : String(meta.page - 1),
    });
    const nextHref = buildSeoHref(current, {
        [`${keyPrefix}Page`]: meta.page >= totalPages ? null : String(meta.page + 1),
    });
    return (
        <nav className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/50 bg-background/40 px-3 py-2 text-[14px] text-muted-foreground" aria-label={`${keyPrefix} results pagination`}>
            <span>{meta.total === 0 ? "0 items" : `${first}–${last} of ${meta.total}`}</span>
            <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-1" aria-label="Results per page">
                    <span>Per page</span>
                    {pageSizeOptions.map((size) => (
                        <Link
                            key={size}
                            href={buildSeoHref(current, {
                                [`${keyPrefix}PageSize`]: String(size),
                                [`${keyPrefix}Page`]: null,
                            })}
                            aria-current={meta.pageSize === size ? "true" : undefined}
                            className={cn(
                                "inline-flex h-7 min-w-7 items-center justify-center rounded border px-1.5 font-medium",
                                meta.pageSize === size
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border/60 bg-background hover:text-foreground",
                            )}
                        >
                            {size}
                        </Link>
                    ))}
                </div>
                {totalPages > 1 ? (
                    <div className="flex items-center gap-1">
                        <Link
                            href={prevHref}
                            aria-disabled={meta.page <= 1}
                            className={cn(
                                "inline-flex h-7 items-center rounded border border-border/60 px-2 hover:text-foreground",
                                meta.page <= 1 && "pointer-events-none opacity-40",
                            )}
                        >
                            Prev
                        </Link>
                        <span>Page {meta.page} / {totalPages}</span>
                        <Link
                            href={nextHref}
                            aria-disabled={meta.page >= totalPages}
                            className={cn(
                                "inline-flex h-7 items-center rounded border border-border/60 px-2 hover:text-foreground",
                                meta.page >= totalPages && "pointer-events-none opacity-40",
                            )}
                        >
                            Next
                        </Link>
                    </div>
                ) : null}
            </div>
        </nav>
    );
}

function SeoStatusChips({
    statuses,
    active,
    counts,
    current,
    paramKey,
    pagePrefix,
}: {
    statuses: readonly string[];
    active: string[];
    counts: Record<string, number>;
    current: Record<string, string | string[] | undefined> | undefined;
    paramKey: string;
    pagePrefix: string;
}) {
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[14px] uppercase tracking-wider text-muted-foreground">Status</span>
            {statuses.map((status) => {
                const isActive = active.includes(status);
                const nextSet = isActive ? active.filter((s) => s !== status) : [...active, status];
                const href = buildSeoHref(current, {
                    [paramKey]: nextSet.length ? nextSet.join(",") : null,
                    [`${pagePrefix}Page`]: null,
                });
                return (
                    <Link
                        key={status}
                        href={href}
                        className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[14px] font-medium capitalize transition-colors",
                            isActive
                                ? "bg-primary text-primary-foreground"
                                : "border border-border/60 bg-background/60 text-muted-foreground hover:text-foreground",
                        )}
                    >
                        {status.replace(/_/g, " ")}
                        <span className="rounded-full bg-black/10 px-1.5 text-[13px] font-semibold">{counts[status] ?? 0}</span>
                    </Link>
                );
            })}
            {active.length > 0 ? (
                <Link
                    href={buildSeoHref(current, {
                        [paramKey]: null,
                        [`${pagePrefix}Page`]: null,
                    })}
                    className="text-[14px] text-muted-foreground hover:text-foreground"
                >
                    Clear
                </Link>
            ) : null}
        </div>
    );
}

function SeoListSearchForm({
    paramName,
    defaultValue,
    placeholder,
    preserve,
    pagePrefix,
}: {
    paramName: string;
    defaultValue: string;
    placeholder: string;
    preserve: Record<string, string | string[] | undefined> | undefined;
    pagePrefix: string;
}) {
    return (
        <form action="/dashboard/seo" className="flex items-center gap-2">
            {preserve
                ? Object.entries(preserve).map(([k, v]) => {
                      if (k === paramName || k === `${pagePrefix}Page`) return null;
                      const raw = Array.isArray(v) ? v.join(",") : v;
                      if (!raw) return null;
                      return <input key={k} type="hidden" name={k} value={raw} />;
                  })
                : null}
            <input
                type="search"
                name={paramName}
                defaultValue={defaultValue}
                placeholder={placeholder}
                className="h-8 flex-1 min-w-[220px] rounded-md border border-input bg-background px-2 text-[15px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button type="submit" className="h-8 rounded-md border border-border/60 px-2 text-[15px] hover:text-foreground">
                Search
            </button>
        </form>
    );
}

// Filter chips and the iteration set are sourced from the canonical DB-derived
// arrays in `types.ts`. Adding a value to the Postgres enum surfaces here
// without manual edits, eliminating the previous chip/badge drift.
const SEO_LINK_STATUSES = SEO_RECOMMENDATION_STATUS_VALUES;
const SEO_CONTENT_OPP_STATUSES = SEO_RECOMMENDATION_STATUS_VALUES;
const SEO_PLAN_STATUSES = SEO_PLAN_STATUS_VALUES;

function parseParamList(v: string | string[] | undefined): string[] {
    if (!v) return [];
    const raw = Array.isArray(v) ? v.join(",") : v;
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
}
function paramStr(v: string | string[] | undefined): string {
    if (!v) return "";
    return Array.isArray(v) ? v[0] ?? "" : v;
}

function asObject(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function getGscOpportunityMetadata(item: SeoInternalLinkOpportunityRecord): GscOpportunityMetadata {
    const metadata = asObject(item.metadata);
    const rawGsc = asObject(metadata.gsc);
    const rawPolicy = asObject(metadata.internalLinkPolicy);
    return {
        gsc: Object.keys(rawGsc).length > 0
            ? {
                provenance: typeof rawGsc.provenance === "string" ? rawGsc.provenance : undefined,
                query: typeof rawGsc.query === "string" ? rawGsc.query : undefined,
                page_slug: typeof rawGsc.page_slug === "string" ? rawGsc.page_slug : undefined,
                impressions: typeof rawGsc.impressions === "number" ? rawGsc.impressions : undefined,
                clicks: typeof rawGsc.clicks === "number" ? rawGsc.clicks : undefined,
                ctr: typeof rawGsc.ctr === "number" ? rawGsc.ctr : undefined,
                position: typeof rawGsc.position === "number" ? rawGsc.position : undefined,
                opportunity_type: typeof rawGsc.opportunity_type === "string" ? rawGsc.opportunity_type : undefined,
                confidence_score: typeof rawGsc.confidence_score === "number" ? rawGsc.confidence_score : undefined,
            }
            : null,
        internalLinkPolicy: Object.keys(rawPolicy).length > 0
            ? {
                autoApplyRuntimeSkipped: rawPolicy.autoApplyRuntimeSkipped === true,
                autoApplyRuntimeSkipReason: typeof rawPolicy.autoApplyRuntimeSkipReason === "string" ? rawPolicy.autoApplyRuntimeSkipReason : undefined,
                autoApplyEligible: typeof rawPolicy.autoApplyEligible === "boolean" ? rawPolicy.autoApplyEligible : undefined,
            }
            : null,
        applied_via: typeof metadata.applied_via === "string" ? metadata.applied_via : undefined,
        applied_automation_mode: typeof metadata.applied_automation_mode === "string" ? metadata.applied_automation_mode : undefined,
    };
}

function formatGscPercent(value: number | undefined): string {
    return typeof value === "number" && Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : "—";
}

function formatGscNumber(value: number | undefined, digits = 0): string {
    return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function getGscOpportunityDecision(item: SeoInternalLinkOpportunityRecord, metadata: GscOpportunityMetadata): string {
    if (item.status === "applied") return metadata.applied_via === "auto" ? "Applied automatically" : "Applied after review";
    if (item.manual_review_reason) return item.manual_review_reason;
    if (item.failed_reason) return item.failed_reason;
    if (metadata.internalLinkPolicy?.autoApplyRuntimeSkipReason) return metadata.internalLinkPolicy.autoApplyRuntimeSkipReason;
    if (item.status === "ready_to_apply") return "Preview passed. Waiting for approval or a higher automation mode.";
    if (item.status === "pending" || item.status === "approved") return "Queued for preview.";
    return "No automation decision recorded yet.";
}

function StrategistRunBanner({ params }: { params: Record<string, string | string[] | undefined> | undefined }) {
    const status = paramStr(params?.strategistRun);
    if (!status) return null;
    const inserted = paramStr(params?.strategistInserted);
    const proposed = paramStr(params?.strategistProposed);
    const inventory = paramStr(params?.strategistInventory);
    const gscSignals = paramStr(params?.strategistGsc);
    const gscConfigured = paramStr(params?.strategistGscConfigured);
    const source = paramStr(params?.strategistSource);
    const errMsg = paramStr(params?.strategistError);

    const tone =
        status === "ok"
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : status === "empty"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";

    const title =
        status === "ok"
            ? `Strategist run complete — inserted ${inserted} (clusters/plans/opportunities).`
            : status === "empty"
                ? `Strategist run finished but stored nothing.`
                : `Strategist run failed.`;

    const reasonHints: string[] = [];
    if (status === "empty") {
        if (proposed === "0/0/0") {
            reasonHints.push(
                inventory === "0"
                    ? "No published content in this workspace yet — the strategist needs at least one published page or post (preferably with a conversion goal) to identify gaps."
                    : "The model returned no clusters/plans/opportunities for this inventory. Try again or add more conversion-oriented pages.",
            );
        } else {
            reasonHints.push(
                `The model proposed ${proposed} but every insert was skipped — usually a row-level-security mismatch on content.write. Check Vercel logs for "[seo:strategist] ... insert failed".`,
            );
        }
        if (source) reasonHints.push(`Source: ${source}.`);
    }
    if (errMsg) reasonHints.push(`First error: ${errMsg}`);
    if (status === "ok") {
        reasonHints.push(
            gscConfigured === "0"
                ? `Evidence used: ${inventory ?? "0"} published items and workspace analytics. Search Console is not configured, so no GSC evidence was claimed.`
                : `Evidence used: ${inventory ?? "0"} published items and ${gscSignals ?? "0"} fresh, locale-matched Search Console query signals.`,
        );
    }

    return (
        <div className={`rounded-md border px-4 py-3 text-[15px] ${tone}`} role={status === "error" ? "alert" : undefined}>
            <p className="font-semibold">{title}</p>
            {reasonHints.length > 0 ? (
                <ul className="mt-1 space-y-0.5">
                    {reasonHints.map((line, i) => (
                        <li key={i}>{line}</li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}

function EmptyState({ title, description }: { title: string; description: string }) {
    return (
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-8 text-center">
            <p className="text-[19px] font-semibold text-foreground">{title}</p>
            <p className="mx-auto mt-2 max-w-2xl text-[17px] leading-6 text-muted-foreground">{description}</p>
        </div>
    );
}

function FocusedSlugBanner({ slug, data }: { slug: string; data: SeoDashboardData }) {
    const normalizedSlug = slug.replace(/^\/+/, "");
    // Look across opportunities and orphan content to see if the focused slug
    // shows up in the workspace's SEO surface; if it does, summarize what's
    // known so the user has a one-glance answer to "why is /X underperforming".
    const matchingLink = data.internalLinkOpportunities.find(
        (item) => item.source_slug === normalizedSlug || item.target_slug === normalizedSlug,
    );
    const matchingOrphan = data.orphanContent.find((item) => item.slug === normalizedSlug);
    const matchingPlan = data.contentOpportunities.find((item) => item.title?.includes(normalizedSlug));

    const lines: string[] = [];
    if (matchingOrphan) lines.push(`Orphan content detected — ${matchingOrphan.pageViews} views, ${matchingOrphan.conversions} conversions.`);
    if (matchingLink) lines.push(`Appears in an internal-link opportunity (${matchingLink.status}, priority ${matchingLink.priority_score}).`);
    if (matchingPlan) lines.push(`A strategist plan references this slug.`);
    const summary = lines.length > 0 ? lines.join(" ") : "No stored SEO signals for this page yet. Run the specialist audit to score it.";

    return (
        <div className="rounded-md border border-cyan-500/30 bg-cyan-500/10 p-5 text-[17px] text-cyan-900 dark:text-cyan-100">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[14px] font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-300">
                        Focused audit
                    </p>
                    <p className="mt-1 font-semibold">/{normalizedSlug}</p>
                    <p className="mt-1 text-[17px] opacity-90">{summary}</p>
                </div>
                <Link href="/dashboard/seo" className="shrink-0 rounded-full border border-cyan-500/30 bg-background/60 px-3 py-1 text-[15px] font-medium text-cyan-700 hover:bg-cyan-500/20 dark:text-cyan-300">
                    Clear focus
                </Link>
            </div>
        </div>
    );
}

export function SeoControlCenter(props: SeoControlCenterProps) {
    const { data, activeTab, focusedSlug, currentParams } = props;
    const isBasic = data.workspace.workspaceTier === "basic";

    const activeLinkStatuses = parseParamList(currentParams?.linksStatus);
    const activeOppStatuses = parseParamList(currentParams?.oppsStatus);
    const activePlanStatuses = parseParamList(currentParams?.plansStatus);
    const linksSearch = paramStr(currentParams?.linksQ);
    const oppsSearch = paramStr(currentParams?.oppsQ);
    const plansSearch = paramStr(currentParams?.plansQ);
    const appliedExecutionCount = data.executionEvents.filter((event) => event.execution_status === "applied").length;
    const signalCount = data.searchConsoleSignals?.length ?? data.gscTopQueries?.length ?? 0;

    const tabs = TAB_ITEMS.map(({ key, label }) => ({
        label,
        value: key,
        href: buildSeoHref(currentParams, { tab: key }),
        active: activeTab === key,
    }));

    return (
        <DashboardAppWorkbench>
            <AppCommandBar
                tabs={<AppTabList tabs={tabs} />}
                actions={<SeoAiActionBar
                    runSeoSpecialistAuditAction={props.runSeoSpecialistAuditAction}
                    runSeoStrategistAnalysisAction={props.runSeoStrategistAnalysisAction}
                    enqueueAllPublishedContentJobsAction={props.enqueueAllPublishedContentJobsAction}
                    activeLocale={data.activeLocale}
                    disabled={isBasic}
                />}
            />

            <AppMetricStrip>
                <AppMetric label="Published" value={data.overview.publishedCount} icon={BarChart3} />
                <AppMetric label="Orphans" value={data.overview.orphanCount} icon={CircleSlash} variant={data.overview.orphanCount > 0 ? "warning" : "success"} />
                <AppMetric label="Open links" value={data.overview.openLinkOpportunityCount} icon={Network} variant={data.overview.openLinkOpportunityCount > 0 ? "info" : "default"} />
                <AppMetric label="Saved plans" value={data.overview.savedPlanCount} icon={Target} />
            </AppMetricStrip>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">

                {isBasic ? (
                    <ProFeatureNotice
                        title="SEO Control Center requires Pro"
                        description="Unlock workspace-scoped content graph audits, AI-assisted internal-link recommendations, strategist blue-ocean analysis, and saved SEO work plans."
                        ctaLabel="Activate Pro for SEO Control Center"
                        benefits={[
                            "Audit every published page and post for internal-link lift.",
                            "Score opportunities with analytics and conversion-goal signals.",
                            "Generate strategist-ready clusters and content briefs.",
                        ]}
                    />
                ) : null}

                {focusedSlug ? <FocusedSlugBanner slug={focusedSlug} data={data} /> : null}

            {activeTab === "overview" && (
                <div className="space-y-3">
                    <AppFeedbackLoop
                        title="SEO growth loop"
                        description="Evidence becomes prioritized work, work becomes measured change, and measured change improves the next decision."
                        stages={[
                            { label: "Observe", value: signalCount, detail: "fresh search signals", tone: "info" },
                            { label: "Diagnose", value: data.overview.openLinkOpportunityCount, detail: "open link decisions", tone: data.overview.openLinkOpportunityCount > 0 ? "warning" : "default" },
                            { label: "Execute", value: appliedExecutionCount, detail: "applied changes", tone: appliedExecutionCount > 0 ? "success" : "default" },
                            { label: "Measure", value: data.runs.length, detail: "persisted runs", tone: "info" },
                            { label: "Learn", value: data.overview.savedPlanCount, detail: "saved next moves", tone: "success" },
                        ]}
                        feedbackLabel="Search performance and conversion evidence return to the next audit; orphan growth or failed execution is a balancing signal, not another vanity metric."
                    />
                    <AppTrendChart
                        title="Search demand by page"
                        description="The highest-impression pages in the current Search Console evidence window. Use the shape to choose the next diagnostic, not as a vanity score."
                        valueLabel="impressions"
                        data={(data.searchConsoleSignals ?? []).slice(0, 8).map((signal) => ({
                            label: signal.page.replace(/^https?:\/\/[^/]+/, "").slice(0, 22) || "/",
                            value: signal.impressions,
                        }))}
                    />
                    <div className="grid gap-3 xl:grid-cols-[1.3fr_0.9fr]">
                    <div className="space-y-6">
                        <div className="rounded-md border border-border/70 bg-card/70 p-6 shadow-sm">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-[23px] font-semibold text-foreground">Priority summary</h2>
                                    <p className="mt-2 text-[17px] leading-6 text-muted-foreground">SEO scoring combines semantic fit, traffic leverage, and conversion importance from workspace metadata.</p>
                                </div>
                                <div className="rounded-md border border-primary/20 bg-primary/10 px-4 py-3 text-right">
                                    <p className="text-[15px] uppercase tracking-[0.18em] text-primary">Average score</p>
                                    <p className="text-[27px] font-semibold text-foreground">{data.overview.averagePriorityScore}</p>
                                </div>
                            </div>
                            <div className="mt-6 grid gap-4 md:grid-cols-2">
                                {data.internalLinkOpportunities.slice(0, 4).map((item) => (
                                    <div key={item.id} className="rounded-md border border-border/60 bg-background/60 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-[17px] font-semibold text-foreground">{item.source_title} <ArrowRight className="mx-1 inline h-3.5 w-3.5" /> {item.target_title}</p>
                                            <StatusPill value={item.status} />
                                        </div>
                                        <p className="mt-2 text-[17px] text-muted-foreground">Anchor: <span className="font-medium text-foreground">{item.anchor_text}</span></p>
                                        <p className="mt-2 text-[15px] uppercase tracking-[0.18em] text-muted-foreground">Priority {item.priority_score} · semantic {item.semantic_fit_score} · analytics {item.analytics_score}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-md border border-border/70 bg-card/70 p-6 shadow-sm">
                            <h2 className="text-[23px] font-semibold text-foreground">Recent SEO runs</h2>
                            <div className="mt-5 space-y-3">
                                {data.runs.length === 0 ? <EmptyState title="No SEO runs yet" description="Run the specialist audit or strategist analysis to create a persisted SEO history for this workspace." /> : data.runs.map((run) => {
                                    const summary = run.summary as { headline?: string; outcome?: string } | null;
                                    const isNoOutput = summary?.outcome === "no_output";
                                    return (
                                        <div key={run.id} className="flex flex-col gap-3 rounded-md border border-border/60 bg-background/60 p-4 md:flex-row md:items-center md:justify-between">
                                            <div>
                                                <p className="text-[17px] font-semibold text-foreground">{run.run_type.replace(/_/g, " ")}</p>
                                                <p className="mt-1 text-[17px] text-muted-foreground">{typeof summary?.headline === "string" ? summary.headline : "Persisted run result."}</p>
                                                {isNoOutput ? (
                                                    <p className="mt-1 text-[15px] text-amber-600 dark:text-amber-400">No items were inserted. Likely cause: insufficient inventory, AI returned empty payload, or schema mismatch.</p>
                                                ) : null}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {isNoOutput ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[13px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                                                        No output
                                                    </span>
                                                ) : null}
                                                <StatusPill value={run.status} />
                                                <span className="text-[15px] text-muted-foreground">{new Date(run.created_at).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="rounded-md border border-border/70 bg-card/70 p-6 shadow-sm">
                            <h2 className="text-[23px] font-semibold text-foreground">Background internal-link automation</h2>
                            <p className="mt-2 text-[17px] leading-6 text-muted-foreground">
                                Server-side worker jobs analyze published posts, preview safe edits, and apply only guardrail-approved internal links.
                            </p>
                            <div className="mt-5 space-y-3">
                                {data.internalLinkJobs.length === 0 ? <EmptyState title="No background jobs yet" description="Queue the auto-scan + safe fixes workflow to process published blog posts asynchronously." /> : data.internalLinkJobs.slice(0, 6).map((job) => {
                                    const summary = normalizeInternalLinkJobSummary(job.summary);
                                    const outcome = summary.hasOutcomeCounts
                                        ? formatInternalLinkAutomationOutcome(summary)
                                        : job.error_message ?? "Worker result summary is not available yet.";
                                    return (
                                        <div key={job.id} className="flex flex-col gap-3 rounded-md border border-border/60 bg-background/60 p-4 md:flex-row md:items-center md:justify-between">
                                            <div>
                                                <p className="text-[17px] font-semibold text-foreground">Internal-link worker · {job.locale.toUpperCase()}</p>
                                                <p className="mt-1 text-[17px] text-muted-foreground">{outcome}</p>
                                                {summary.hasOutcomeCounts ? (
                                                    <p className="mt-1 text-[15px] text-muted-foreground">
                                                        Generated {summary.generated} · Previewed {summary.previewed} · Ready {summary.readyToApply} · Manual review {summary.manualReview}
                                                    </p>
                                                ) : null}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <StatusPill value={job.status} />
                                                <span className="text-[15px] text-muted-foreground">{new Date(job.completed_at ?? job.created_at).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="rounded-md border border-border/70 bg-card/70 p-6 shadow-sm">
                            <h2 className="text-[23px] font-semibold text-foreground">Orphan priority queue</h2>
                            <div className="mt-5 space-y-3">
                                {data.orphanContent.length === 0 ? <EmptyState title="No orphan content detected" description="Published assets already have at least one internal path into them." /> : data.orphanContent.slice(0, 8).map((item) => (
                                    <div key={item.id} className="rounded-md border border-border/60 bg-background/60 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-[17px] font-semibold text-foreground">{item.title}</p>
                                            <span className="text-[15px] uppercase tracking-[0.18em] text-muted-foreground">{item.type}</span>
                                        </div>
                                        <p className="mt-2 text-[17px] text-muted-foreground">/{item.slug}</p>
                                        <p className="mt-3 text-[15px] text-muted-foreground">Views {item.pageViews} · Conversions {item.conversions}{item.conversionGoal ? ` · Goal ${item.conversionGoal}` : ""}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-md border border-border/70 bg-card/70 p-6 shadow-sm">
                            <h2 className="text-[23px] font-semibold text-foreground">Strategist backlog</h2>
                            <div className="mt-5 space-y-3">
                                {data.contentOpportunities.length === 0 ? <EmptyState title="No strategist opportunities yet" description="Run the strategist analysis to generate cluster gaps, blue-ocean ideas, and plan-ready briefs." /> : data.contentOpportunities.slice(0, 5).map((item) => (
                                    <div key={item.id} className="rounded-md border border-border/60 bg-background/60 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-[17px] font-semibold text-foreground">{item.title}</p>
                                            <StatusPill value={item.status} />
                                        </div>
                                        <p className="mt-2 text-[17px] text-muted-foreground">{item.summary}</p>
                                        <p className="mt-3 text-[15px] uppercase tracking-[0.18em] text-muted-foreground">{item.cluster_name ?? "Unclustered"} · {item.priority_score} priority</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    </div>
                </div>
            )}

            {activeTab === "specialist" && (
                <div className="space-y-6">
                    <div className="rounded-md border border-border/60 bg-card/40 p-3 space-y-3">
                        <SeoListSearchForm
                            paramName="linksQ"
                            defaultValue={linksSearch}
                            placeholder="Search by title, anchor, or rationale…"
                            preserve={currentParams}
                            pagePrefix="links"
                        />
                        <SeoStatusChips
                            statuses={SEO_LINK_STATUSES}
                            active={activeLinkStatuses}
                            counts={data.internalLinkStatusCounts}
                            current={currentParams}
                            paramKey="linksStatus"
                            pagePrefix="links"
                        />
                    </div>
                    {data.internalLinkOpportunities.length > 0 ? (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 bg-card/40 p-3">
                            <p className="text-[15px] text-muted-foreground">
                                Showing {data.internalLinkOpportunities.length} of {data.overview.internalLinkOpportunityCount} opportunities. Clean up completed ones to keep the queue focused.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <form action={props.clearSeoInternalLinkOpportunitiesByStatusAction}>
                                    <input type="hidden" name="status" value="dismissed" />
                                    <input type="hidden" name="tab" value="specialist" />
                                    <PendingFormButton className="inline-flex h-8 items-center rounded-md border border-border/60 bg-background px-3 text-[15px] font-medium text-muted-foreground hover:border-rose-500/40 hover:text-rose-600">
                                        Clear dismissed
                                    </PendingFormButton>
                                </form>
                                <form action={props.clearSeoInternalLinkOpportunitiesByStatusAction}>
                                    <input type="hidden" name="status" value="failed" />
                                    <input type="hidden" name="tab" value="specialist" />
                                    <PendingFormButton className="inline-flex h-8 items-center rounded-md border border-border/60 bg-background px-3 text-[15px] font-medium text-muted-foreground hover:border-rose-500/40 hover:text-rose-600">
                                        Clear failed
                                    </PendingFormButton>
                                </form>
                                <form action={props.clearSeoInternalLinkOpportunitiesByStatusAction}>
                                    <input type="hidden" name="status" value="rolled_back" />
                                    <input type="hidden" name="tab" value="specialist" />
                                    <PendingFormButton className="inline-flex h-8 items-center rounded-md border border-border/60 bg-background px-3 text-[15px] font-medium text-muted-foreground hover:border-rose-500/40 hover:text-rose-600">
                                        Clear rolled back
                                    </PendingFormButton>
                                </form>
                                <form action={props.clearSeoInternalLinkOpportunitiesByStatusAction}>
                                    <input type="hidden" name="status" value="manual_review_required" />
                                    <input type="hidden" name="tab" value="specialist" />
                                    <PendingFormButton className="inline-flex h-8 items-center rounded-md border border-border/60 bg-background px-3 text-[15px] font-medium text-muted-foreground hover:border-rose-500/40 hover:text-rose-600">
                                        Clear manual review
                                    </PendingFormButton>
                                </form>
                            </div>
                        </div>
                    ) : null}
                    <SeoPaginationStrip meta={data.internalLinkOpportunitiesPage} keyPrefix="links" current={currentParams} />
                    {data.internalLinkOpportunities.length === 0 ? (
                        <EmptyState title="No internal-link opportunities stored" description="Run the specialist audit to inventory published content, score opportunities, and persist recommendations for review." />
                    ) : (
                        <SpecialistListPanel
                            items={data.internalLinkOpportunities}
                            executionEvents={data.executionEvents}
                            updateStatusAction={props.updateSeoInternalLinkOpportunityAction}
                            generatePreviewAction={props.generateSeoExecutionPreviewAction}
                            applyRecommendationAction={props.applySeoInternalLinkRecommendationAction}
                            rollbackExecutionAction={props.rollbackSeoInternalLinkExecutionAction}
                        />
                    )}
                    <SeoPaginationStrip meta={data.internalLinkOpportunitiesPage} keyPrefix="links" current={currentParams} />
                </div>
            )}

            {activeTab === "strategist" && (
                <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                    <div className="space-y-6">
                        <StrategistRunBanner params={currentParams} />
                        <div className="rounded-md border border-border/60 bg-card/40 p-3 space-y-3">
                            <SeoListSearchForm
                                paramName="oppsQ"
                                defaultValue={oppsSearch}
                                placeholder="Search opportunity title, summary, or cluster…"
                                preserve={currentParams}
                                pagePrefix="opps"
                            />
                            <SeoStatusChips
                                statuses={SEO_CONTENT_OPP_STATUSES}
                                active={activeOppStatuses}
                                counts={data.contentOpportunityStatusCounts}
                                current={currentParams}
                                paramKey="oppsStatus"
                                pagePrefix="opps"
                            />
                        </div>
                        <SeoPaginationStrip meta={data.contentOpportunitiesPage} keyPrefix="opps" current={currentParams} />
                        {data.contentOpportunities.length === 0 ? (
                            <EmptyState title="No strategist opportunities stored" description="Generate strategist analysis to identify blue-ocean opportunities, underserved topic clusters, and conversion-linked content gaps." />
                        ) : (
                            <StrategistOpportunitiesPanel
                                items={data.contentOpportunities}
                                renderedRows={data.contentOpportunities.map((item) => (
                                    <div key={item.id} className="rounded-md border border-border/70 bg-card/70 p-6 shadow-sm">
                                        <div className="flex flex-col gap-4 xl:flex-row xl:justify-between">
                                            <div className="space-y-3">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <p className="text-[21px] font-semibold text-foreground">{item.title}</p>
                                                    <StatusPill value={item.status} />
                                                </div>
                                                <p className="text-[17px] leading-6 text-muted-foreground">{item.summary}</p>
                                                <p className="text-[17px] leading-6 text-muted-foreground">{item.rationale}</p>
                                                <div className="grid gap-2 text-[17px] text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
                                                    <div className="rounded-md border border-border/60 bg-background/60 p-3"><span className="text-[15px] uppercase tracking-[0.18em]">Cluster</span><p className="mt-1 font-medium text-foreground">{item.cluster_name ?? "—"}</p></div>
                                                    <div className="rounded-md border border-border/60 bg-background/60 p-3"><span className="text-[15px] uppercase tracking-[0.18em]">Intent</span><p className="mt-1 font-medium text-foreground">{item.target_intent ?? "—"}</p></div>
                                                    <div className="rounded-md border border-border/60 bg-background/60 p-3"><span className="text-[15px] uppercase tracking-[0.18em]">Funnel</span><p className="mt-1 font-medium text-foreground">{item.funnel_stage ?? "—"}</p></div>
                                                    <div className="rounded-md border border-border/60 bg-background/60 p-3"><span className="text-[15px] uppercase tracking-[0.18em]">Priority</span><p className="mt-1 font-medium text-foreground">{item.priority_score}</p></div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2 xl:w-[280px]">
                                                <div className="flex flex-wrap gap-2 xl:justify-end">
                                                    {item.draft_content_item_id ? (
                                                        <Link
                                                            href={`/dashboard/content/${item.draft_content_item_id}`}
                                                            className="inline-flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[15px] font-semibold text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                                                        >
                                                            <FileText className="h-3.5 w-3.5" /> Open draft
                                                        </Link>
                                                    ) : (
                                                        <form action={props.updateSeoContentOpportunityStatusAction}>
                                                            <input type="hidden" name="id" value={item.id} />
                                                            <input type="hidden" name="status" value="approved" />
                                                            <input type="hidden" name="tab" value="strategist" />
                                                            <PendingFormButton size="sm" className="rounded-md gap-2" idleIcon={<CheckCircle2 className="h-4 w-4" />} pendingLabel="Drafting…">Approve & draft</PendingFormButton>
                                                        </form>
                                                    )}
                                                    <form action={props.updateSeoContentOpportunityStatusAction}>
                                                        <input type="hidden" name="id" value={item.id} />
                                                        <input type="hidden" name="status" value="dismissed" />
                                                        <input type="hidden" name="tab" value="strategist" />
                                                        <PendingFormButton variant="outline" size="sm" className="rounded-md" pendingLabel="Dismissing…">Dismiss</PendingFormButton>
                                                    </form>
                                                </div>
                                                {item.draft_content_item_id && (
                                                    <p className="text-[14px] text-muted-foreground">Draft created. Approve again to refresh status.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            />
                        )}
                        <SeoPaginationStrip meta={data.contentOpportunitiesPage} keyPrefix="opps" current={currentParams} />
                    </div>

                    <div className="space-y-6">
                        <div className="rounded-md border border-border/70 bg-card/70 p-6 shadow-sm">
                            <h2 className="text-[23px] font-semibold text-foreground">Topic clusters <span className="text-[15px] text-muted-foreground">({data.topicClustersPage.total})</span></h2>
                            <SeoPaginationStrip meta={data.topicClustersPage} keyPrefix="clusters" current={currentParams} />
                            <div className="mt-5 space-y-4">
                                {data.topicClusters.length === 0 ? (
                                    <EmptyState title="No topic clusters yet" description="Strategist output will group opportunities into thematic clusters with funnel and conversion context." />
                                ) : (
                                    <StrategistClustersPanel
                                        items={data.topicClusters}
                                        renderedRows={data.topicClusters.map((cluster) => {
                                            const supportingCount = Array.isArray(cluster.supporting_topics) ? cluster.supporting_topics.length : 0;
                                            return (
                                                <div key={cluster.id} className="rounded-md border border-border/60 bg-background/60 p-4">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <p className="text-[17px] font-semibold text-foreground">{cluster.name}</p>
                                                        <StatusPill value={cluster.status} />
                                                    </div>
                                                    <p className="mt-2 text-[17px] text-muted-foreground">{cluster.summary}</p>
                                                    <p className="mt-3 text-[15px] text-muted-foreground">Pillar: {cluster.pillar_topic ?? "—"} · Intent: {cluster.primary_intent ?? "—"} · Goal: {cluster.target_conversion_goal ?? "—"}</p>
                                                    {supportingCount > 0 && (
                                                        <form action={props.spawnSeoPlansFromClusterAction} className="mt-3">
                                                            <input type="hidden" name="clusterId" value={cluster.id} />
                                                            <PendingFormButton
                                                                size="sm"
                                                                variant="outline"
                                                                className="gap-2 rounded-md"
                                                                idleIcon={<PlusCircle className="h-3.5 w-3.5" />}
                                                                pendingLabel="Spawning plans…"
                                                            >
                                                                Spawn {supportingCount} plan{supportingCount === 1 ? "" : "s"}
                                                            </PendingFormButton>
                                                        </form>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    />
                                )}
                            </div>
                            <SeoPaginationStrip meta={data.topicClustersPage} keyPrefix="clusters" current={currentParams} />
                        </div>
                    </div>
                </div>
            )}

            {activeTab === "graph" && (
                <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                    <div className="rounded-md border border-border/70 bg-card/70 p-6 shadow-sm">
                        <h2 className="text-[23px] font-semibold text-foreground">Content inventory graph</h2>
                        <p className="mt-2 text-[17px] leading-6 text-muted-foreground">Published inventory annotated with funnel metadata, conversion goals, and extracted internal-link coverage.</p>
                        <div className="mt-5 space-y-3">
                            {data.inventory.length === 0 ? <EmptyState title="No published inventory" description="Publish pages or blog posts in the workspace to build an SEO content graph." /> : data.inventory.map((item) => (
                                <div key={item.id} className="rounded-md border border-border/60 bg-background/60 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-[17px] font-semibold text-foreground">{item.title}</p>
                                        <span className="text-[15px] uppercase tracking-[0.18em] text-muted-foreground">{item.type}</span>
                                    </div>
                                    <p className="mt-2 text-[17px] text-muted-foreground">/{item.slug}</p>
                                    <p className="mt-3 text-[15px] text-muted-foreground">Intent: {item.pageIntent ?? "—"} · Goal: {item.conversionGoal ?? "—"} · Links out: {item.links.length}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-md border border-border/70 bg-card/70 p-6 shadow-sm">
                        <h2 className="text-[23px] font-semibold text-foreground">Analytics-linked content support</h2>
                        <div className="mt-5 space-y-3">
                            {data.analytics.length === 0 ? <EmptyState title="No analytics signals yet" description="Once public analytics events accumulate, SEO scoring will increase prioritization accuracy." /> : data.analytics.map((item) => (
                                <div key={item.slug} className="rounded-md border border-border/60 bg-background/60 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-[17px] font-semibold text-foreground">/{item.slug}</p>
                                        <span className="text-[15px] uppercase tracking-[0.18em] text-muted-foreground">{item.pageViews} views</span>
                                    </div>
                                    <p className="mt-2 text-[17px] text-muted-foreground">CTA clicks {item.ctaClicks} · Conversions {item.conversions}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === "plans" && (
                <div className="space-y-6">
                    <div className="rounded-md border border-border/60 bg-card/40 p-3 space-y-3">
                        <SeoListSearchForm
                            paramName="plansQ"
                            defaultValue={plansSearch}
                            placeholder="Search by plan title, keyword, or slug…"
                            preserve={currentParams}
                            pagePrefix="plans"
                        />
                        <SeoStatusChips
                            statuses={SEO_PLAN_STATUSES}
                            active={activePlanStatuses}
                            counts={data.contentPlanStatusCounts}
                            current={currentParams}
                            paramKey="plansStatus"
                            pagePrefix="plans"
                        />
                    </div>
                    <SeoPaginationStrip meta={data.contentPlansPage} keyPrefix="plans" current={currentParams} />
                    {data.contentPlans.length === 0 ? (
                        <EmptyState title="No saved or draft plans yet" description="Generate strategist plans to create persisted SEO work items with keywords, outlines, and funnel targets." />
                    ) : (
                        <StrategistPlansPanel
                            items={data.contentPlans}
                            renderedRows={data.contentPlans.map((plan) => (
                                <div key={plan.id} className="rounded-md border border-border/70 bg-card/70 p-6 shadow-sm">
                                    <div className="flex flex-col gap-4 xl:flex-row xl:justify-between">
                                        <div className="space-y-3">
                                            <div className="flex flex-wrap items-center gap-3">
                                                <p className="text-[21px] font-semibold text-foreground">{plan.title}</p>
                                                <StatusPill value={plan.status} />
                                            </div>
                                            <p className="text-[17px] text-muted-foreground">Primary keyword: <span className="font-medium text-foreground">{plan.primary_keyword ?? "—"}</span> · Slug: <span className="font-medium text-foreground">{plan.slug_suggestion ?? "—"}</span></p>
                                            <p className="text-[17px] text-muted-foreground">Intent {plan.intent_stage ?? "—"} · Funnel {plan.funnel_stage ?? "—"} · Goal {plan.target_conversion_goal ?? "—"}</p>
                                            <div className="rounded-md border border-border/60 bg-background/60 p-4">
                                                <p className="whitespace-pre-wrap text-[17px] leading-6 text-muted-foreground">{plan.brief_markdown}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2 xl:w-[280px]">
                                            <div className="flex flex-wrap gap-2 xl:justify-end">
                                                <form action={props.updateSeoContentPlanStatusAction}>
                                                    <input type="hidden" name="id" value={plan.id} />
                                                    <input type="hidden" name="status" value="saved" />
                                                    <input type="hidden" name="tab" value="plans" />
                                                    <PendingFormButton size="sm" className="rounded-md gap-2" idleIcon={<PlusCircle className="h-4 w-4" />} pendingLabel="Saving…">Save as work item</PendingFormButton>
                                                </form>
                                                {plan.draft_content_item_id ? (
                                                    <Link
                                                        href={`/dashboard/content/${plan.draft_content_item_id}`}
                                                        className="inline-flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[15px] font-semibold text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                                                    >
                                                        <FileText className="h-3.5 w-3.5" /> Open draft
                                                    </Link>
                                                ) : (
                                                    <form action={props.updateSeoContentPlanStatusAction}>
                                                        <input type="hidden" name="id" value={plan.id} />
                                                        <input type="hidden" name="status" value="in_progress" />
                                                        <input type="hidden" name="tab" value="plans" />
                                                        <PendingFormButton variant="outline" size="sm" className="rounded-md gap-2" idleIcon={<LoaderCircle className="h-4 w-4" />} pendingLabel="Drafting…">Start & draft</PendingFormButton>
                                                    </form>
                                                )}
                                                <form action={props.updateSeoContentPlanStatusAction}>
                                                    <input type="hidden" name="id" value={plan.id} />
                                                    <input type="hidden" name="status" value="done" />
                                                    <input type="hidden" name="tab" value="plans" />
                                                    <PendingFormButton variant="ghost" size="sm" className="rounded-md" pendingLabel="Updating…">Done</PendingFormButton>
                                                </form>
                                            </div>
                                            {plan.draft_content_item_id && (
                                                <p className="text-[14px] text-muted-foreground">Draft is live. Edit it to continue the work item.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        />
                    )}
                    <SeoPaginationStrip meta={data.contentPlansPage} keyPrefix="plans" current={currentParams} />
                </div>
            )}
            {activeTab === "indexing" && (
                <div className="space-y-3">
                    <AppFeedbackLoop
                        title="Indexing control loop"
                        description={`Published ${data.activeLocale.toUpperCase()} inventory moving from discovery to verified index coverage.`}
                        stages={[
                            { label: "Inventory", value: data.indexingCounts.total, detail: "published URLs" },
                            { label: "Needs action", value: data.indexingCounts.needsAction, detail: "operator queue", tone: data.indexingCounts.needsAction > 0 ? "warning" : "success" },
                            { label: "Pending", value: data.indexingCounts.pending, detail: "waiting to run", tone: data.indexingCounts.pending > 0 ? "info" : "default" },
                            { label: "Submitted", value: data.indexingCounts.submitted, detail: "provider accepted", tone: "info" },
                            { label: "Indexed", value: data.indexingCounts.indexed, detail: "verified coverage", tone: "success" },
                        ]}
                        feedbackLabel={`${data.indexingCounts.failed} failed URL${data.indexingCounts.failed === 1 ? "" : "s"} feed back into retry policy; repeated errors should change the queue strategy before more URLs are submitted.`}
                    />

                    <div className="rounded-lg border border-border/55 bg-card/35 p-3">
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <h2 className="text-[15px] font-semibold text-foreground">Indexing status</h2>
                                <p className="mt-0.5 text-[12px] text-muted-foreground">
                                    Published pages and blog posts for {data.activeLocale.toUpperCase()}.
                                </p>
                            </div>
                            <form action={props.queueAllSeoIndexingJobsAction}>
                                <input type="hidden" name="locale" value={data.activeLocale} />
                                <PendingFormButton
                                    size="sm"
                                    className="rounded-md gap-2"
                                    idleIcon={<Send className="h-4 w-4" />}
                                    pendingLabel="Queueing…"
                                    disabled={data.indexingCounts.needsAction === 0}
                                >
                                    Queue all missing
                                </PendingFormButton>
                            </form>
                        </div>

                        {data.indexingRows.length === 0 ? (
                            <div className="mt-5">
                                <EmptyState title="No indexable inventory" description="Publish CMS pages or blog posts to make them available for indexing workflows." />
                            </div>
                        ) : (
                            <div className="mt-3 space-y-2 md:hidden">
                                {data.indexingRows.map((row) => (
                                    <article key={`${row.contentId}-${row.canonicalPath}`} className="rounded-md border border-border/60 bg-background/55 p-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="font-semibold text-foreground">{row.title}</p>
                                                <a
                                                    href={row.canonicalUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="mt-1 inline-flex max-w-full items-center gap-1 text-[12px] text-primary hover:underline"
                                                >
                                                    <span className="truncate">{row.canonicalPath}</span>
                                                    <ExternalLink className="size-3 shrink-0" />
                                                </a>
                                            </div>
                                            <StatusPill value={row.displayStatus} />
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/45 pt-2">
                                            <p className="text-[11px] text-muted-foreground">
                                                {row.job?.attempt_count ?? 0} attempts · {formatIndexingDate(row.job?.last_attempt_at ?? row.job?.updated_at)}
                                            </p>
                                            {row.action === "none" ? (
                                                <span className="text-[11px] font-medium text-muted-foreground">
                                                    {indexingActionLabel(row.action, row.displayStatus)}
                                                </span>
                                            ) : (
                                                <form action={props.queueSeoIndexingJobAction}>
                                                    <input type="hidden" name="contentId" value={row.contentId} />
                                                    <input type="hidden" name="locale" value={data.activeLocale} />
                                                    <PendingFormButton
                                                        size="sm"
                                                        variant={row.action === "retry" ? "outline" : "default"}
                                                        className="h-7 rounded-md px-2 text-[11px]"
                                                        pendingLabel="Queueing…"
                                                    >
                                                        {indexingActionLabel(row.action, row.displayStatus)}
                                                    </PendingFormButton>
                                                </form>
                                            )}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}

                        {data.indexingRows.length > 0 ? (
                            <div className="mt-3 hidden overflow-x-auto rounded-md border border-border md:block">
                                <table className="w-full min-w-[1080px] text-left text-[13px]">
                                    <thead className="bg-muted/50 text-muted-foreground">
                                        <tr>
                                            <th className="px-3 py-2 font-medium">Content</th>
                                            <th className="px-3 py-2 font-medium">Canonical URL</th>
                                            <th className="px-3 py-2 font-medium">Status</th>
                                            <th className="px-3 py-2 font-medium">Attempts</th>
                                            <th className="px-3 py-2 font-medium">Last run</th>
                                            <th className="px-3 py-2 font-medium">Next run</th>
                                            <th className="px-3 py-2 font-medium">Last error</th>
                                            <th className="px-3 py-2 font-medium text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {data.indexingRows.map((row) => (
                                            <tr key={`${row.contentId}-${row.canonicalPath}`} className="align-top hover:bg-muted/30">
                                                <td className="px-3 py-2">
                                                    <p className="font-semibold text-foreground">{row.title}</p>
                                                    <p className="mt-1 text-[14px] uppercase tracking-[0.16em] text-muted-foreground">{row.type} · {row.locale ?? "—"}</p>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <a
                                                        href={row.canonicalUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex max-w-[330px] items-center gap-1 truncate text-primary hover:underline"
                                                    >
                                                        <span className="truncate">{row.canonicalPath}</span>
                                                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                                                    </a>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <StatusPill value={row.displayStatus} />
                                                    {row.job?.source_event ? (
                                                        <p className="mt-2 text-[14px] text-muted-foreground">Source: {row.job.source_event.replace(/_/g, " ")}</p>
                                                    ) : null}
                                                </td>
                                                <td className="px-3 py-2 text-muted-foreground">
                                                    <p>{row.job?.attempt_count ?? 0} total</p>
                                                    <p className="mt-1 text-[14px] capitalize">{latestAttemptLabel(row)}</p>
                                                </td>
                                                <td className="px-3 py-2 text-muted-foreground">
                                                    {formatIndexingDate(row.job?.last_attempt_at ?? row.job?.updated_at)}
                                                </td>
                                                <td className="px-3 py-2 text-muted-foreground">
                                                    {formatIndexingDate(row.job?.next_attempt_at)}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <p className="max-w-[260px] truncate text-muted-foreground" title={row.job?.last_error ?? row.latestAttempt?.error ?? undefined}>
                                                        {row.job?.last_error ?? row.latestAttempt?.error ?? "—"}
                                                    </p>
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    {row.action === "none" ? (
                                                        <span className="inline-flex h-8 items-center rounded-md border border-border/60 px-3 text-[15px] font-medium text-muted-foreground">
                                                            {indexingActionLabel(row.action, row.displayStatus)}
                                                        </span>
                                                    ) : (
                                                        <form action={props.queueSeoIndexingJobAction} className="inline-flex justify-end">
                                                            <input type="hidden" name="contentId" value={row.contentId} />
                                                            <input type="hidden" name="locale" value={data.activeLocale} />
                                                            <PendingFormButton
                                                                size="sm"
                                                                variant={row.action === "retry" ? "outline" : "default"}
                                                                className="rounded-md gap-2"
                                                                idleIcon={row.action === "retry" ? <RefreshCcw className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                                                                pendingLabel="Queueing…"
                                                            >
                                                                {indexingActionLabel(row.action, row.displayStatus)}
                                                            </PendingFormButton>
                                                        </form>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : null}
                    </div>
                </div>
            )}
            {activeTab === "search_console" && (
                <div className="space-y-8">
                    {/* Sync Status Section */}
                    <div className="rounded-md border border-border/70 bg-card/70 p-6 shadow-sm">
                        <h3 className="text-[21px] font-semibold text-foreground mb-4">GSC Sync Status & History</h3>
                        <p className="mb-4 text-[15px] text-muted-foreground">Opportunity tables below use the active content language and a true rolling 30-day window from raw Search Console rows.</p>
                        {!data.gscSyncRuns || data.gscSyncRuns.length === 0 ? (
                            <div className="rounded-md border border-dashed border-border/60 p-6 text-center">
                                <p className="text-[17px] text-muted-foreground">No sync history available.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                                {data.gscSyncRuns.map((rawRun, i) => {
                                    const run = rawRun as { target_date?: string; status?: string; rows_synced?: number | null; error_details?: string | null; started_at?: string | number | Date };
                                    return (
                                    <div key={i} className="rounded-md border border-border bg-muted/20 p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[15px] font-semibold uppercase tracking-wider text-muted-foreground">{run.target_date}</span>
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[15px] font-medium ${
                                                run.status === 'success' ? 'bg-green-500/10 text-green-500' :
                                                run.status === 'in_progress' ? 'bg-blue-500/10 text-blue-500 animate-pulse' :
                                                'bg-red-500/10 text-red-500'
                                            }`}>
                                                {run.status}
                                            </span>
                                        </div>
                                        <div className="text-[17px] font-medium text-foreground">
                                            {run.rows_synced !== null ? `${run.rows_synced} rows synced` : 'Syncing...'}
                                        </div>
                                        {run.error_details && (
                                            <div className="mt-2 text-[15px] text-red-500 truncate" title={run.error_details}>
                                                {run.error_details}
                                            </div>
                                        )}
                                        <div className="mt-2 text-[15px] text-muted-foreground">
                                            {run.started_at ? new Date(run.started_at).toLocaleTimeString() : ''}
                                        </div>
                                    </div>
                                )})}
                            </div>
                        )}
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Near Page One Section */}
                        <div className="rounded-md border border-border/70 bg-card/70 p-6 shadow-sm">
                            <h3 className="text-[21px] font-semibold text-foreground mb-2">Near-Page-One Opportunities</h3>
                            <p className="text-[17px] text-muted-foreground mb-4">Queries ranking in positions 4-12 with strong impressions.</p>
                            {!data.gscNearPageOne || data.gscNearPageOne.length === 0 ? (
                                <div className="rounded-md border border-dashed border-border/60 p-8 text-center text-muted-foreground text-[17px]">
                                    No near-page-one keywords detected.
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-md border border-border">
                                    <table className="w-full text-left text-[17px]">
                                        <thead className="bg-muted/50 text-muted-foreground">
                                            <tr>
                                                <th className="px-4 py-2 font-medium">Query</th>
                                                <th className="px-4 py-2 font-medium">Page Slug</th>
                                                <th className="px-4 py-2 font-medium text-right">Impr.</th>
                                                <th className="px-4 py-2 font-medium text-right">Position</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {data.gscNearPageOne.map((rawQ, i) => {
                                                const q = rawQ as { query?: string; page_slug?: string; total_impressions?: number; avg_position?: number | string };
                                                return (
                                                <tr key={i} className="hover:bg-muted/30">
                                                    <td className="px-4 py-2 font-medium text-foreground">{q.query}</td>
                                                    <td className="px-4 py-2 text-muted-foreground">{q.page_slug}</td>
                                                    <td className="px-4 py-2 text-right">{q.total_impressions}</td>
                                                    <td className="px-4 py-2 text-right">{Number(q.avg_position).toFixed(1)}</td>
                                                </tr>
                                            )})}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* High Impression, Low CTR */}
                        <div className="rounded-md border border-border/70 bg-card/70 p-6 shadow-sm">
                            <h3 className="text-[21px] font-semibold text-foreground mb-2">High Impression, Low CTR (≤2% CTR)</h3>
                            <p className="text-[17px] text-muted-foreground mb-4">Pages showing in search results but failing to capture clicks.</p>
                            {!data.gscLowCtr || data.gscLowCtr.length === 0 ? (
                                <div className="rounded-md border border-dashed border-border/60 p-8 text-center text-muted-foreground text-[17px]">
                                    No low-CTR keywords with high impressions detected.
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-md border border-border">
                                    <table className="w-full text-left text-[17px]">
                                        <thead className="bg-muted/50 text-muted-foreground">
                                            <tr>
                                                <th className="px-4 py-2 font-medium">Query</th>
                                                <th className="px-4 py-2 font-medium">Page Slug</th>
                                                <th className="px-4 py-2 font-medium text-right">CTR</th>
                                                <th className="px-4 py-2 font-medium text-right">Impr.</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {data.gscLowCtr.map((rawQ, i) => {
                                                const q = rawQ as { query?: string; page_slug?: string; total_impressions?: number; avg_ctr?: number | string };
                                                return (
                                                <tr key={i} className="hover:bg-muted/30">
                                                    <td className="px-4 py-2 font-medium text-foreground">{q.query}</td>
                                                    <td className="px-4 py-2 text-muted-foreground">{q.page_slug}</td>
                                                    <td className="px-4 py-2 text-right">{(Number(q.avg_ctr) * 100).toFixed(2)}%</td>
                                                    <td className="px-4 py-2 text-right">{q.total_impressions}</td>
                                                </tr>
                                            )})}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* GSC Opportunity Pipeline */}
                    <div className="rounded-md border border-border/70 bg-card/70 p-6 shadow-sm">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <h3 className="text-[21px] font-semibold text-foreground mb-2">GSC Opportunity Pipeline</h3>
                                <p className="text-[17px] text-muted-foreground">
                                    Search Console signals promoted into internal-link recommendations, including preview state and automation policy decisions.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-[14px]">
                                <span className="inline-flex rounded-full border border-border/70 bg-background/70 px-3 py-1 font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                    Mode: {data.workspace.seoAutomationMode}
                                </span>
                                <span className="inline-flex rounded-full border border-border/70 bg-background/70 px-3 py-1 font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                    Delay: {data.workspace.seoAutoApplyMinAgeSeconds}s
                                </span>
                            </div>
                        </div>
                        {(() => {
                            const opportunities = data.gscInternalLinkOpportunities ?? [];
                            if (opportunities.length === 0) {
                                return (
                                    <div className="mt-4 rounded-md border border-dashed border-border/60 p-8 text-center text-muted-foreground text-[17px]">
                                        No GSC-backed internal-link opportunities generated yet.
                                    </div>
                                );
                            }

                            const counts = opportunities.reduce<Record<string, number>>((acc, item) => {
                                acc[item.status] = (acc[item.status] ?? 0) + 1;
                                return acc;
                            }, {});

                            return (
                                <div className="mt-5 space-y-4">
                                    <div className="flex flex-wrap gap-2 text-[15px] text-muted-foreground">
                                        {Object.entries(counts).map(([status, count]) => (
                                            <span key={status} className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/70 px-3 py-1">
                                                {status.replace(/_/g, " ")}
                                                <span className="font-semibold text-foreground">{count}</span>
                                            </span>
                                        ))}
                                    </div>
                                    <div className="overflow-x-auto rounded-md border border-border">
                                        <table className="w-full min-w-[1050px] text-left text-[16px]">
                                            <thead className="bg-muted/50 text-muted-foreground">
                                                <tr>
                                                    <th className="px-4 py-3 font-medium">Query</th>
                                                    <th className="px-4 py-3 font-medium">Signal</th>
                                                    <th className="px-4 py-3 font-medium">Recommendation</th>
                                                    <th className="px-4 py-3 font-medium">Status</th>
                                                    <th className="px-4 py-3 font-medium">Decision</th>
                                                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {opportunities.map((opportunity) => {
                                                    const metadata = getGscOpportunityMetadata(opportunity);
                                                    const gsc = metadata.gsc;
                                                    const specialistHref = buildSeoHref(currentParams, {
                                                        tab: "specialist",
                                                        linksQ: opportunity.source_slug ?? opportunity.source_title,
                                                        linksPage: null,
                                                    });
                                                    return (
                                                        <tr key={opportunity.id} className="align-top hover:bg-muted/30">
                                                            <td className="px-4 py-3">
                                                                <p className="font-medium text-foreground">{gsc?.query ?? "—"}</p>
                                                                <p className="mt-1 text-[14px] text-muted-foreground">{gsc?.opportunity_type?.replace(/-/g, " ") ?? "general"}</p>
                                                            </td>
                                                            <td className="px-4 py-3 text-muted-foreground">
                                                                <p>{formatGscNumber(gsc?.impressions)} impressions · {formatGscPercent(gsc?.ctr)} CTR</p>
                                                                <p className="mt-1">Position {formatGscNumber(gsc?.position, 1)} · confidence {formatGscNumber(gsc?.confidence_score)}</p>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <p className="font-medium text-foreground">{opportunity.source_slug ?? opportunity.source_title}</p>
                                                                <p className="mt-1 flex items-center gap-1 text-muted-foreground">
                                                                    <ArrowRight className="h-3.5 w-3.5" />
                                                                    {opportunity.target_slug ?? opportunity.target_title}
                                                                </p>
                                                                <p className="mt-1 text-[14px] text-muted-foreground">Anchor: {opportunity.anchor_text}</p>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <StatusPill value={opportunity.status} />
                                                                <p className="mt-2 text-[14px] text-muted-foreground">
                                                                    Updated {new Date(opportunity.updated_at).toLocaleString()}
                                                                </p>
                                                            </td>
                                                            <td className="px-4 py-3 text-muted-foreground">
                                                                <p className="max-w-[320px] leading-6">{getGscOpportunityDecision(opportunity, metadata)}</p>
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <div className="flex flex-col items-end gap-2">
                                                                    {["approved", "ready_to_apply", "manual_review_required", "failed"].includes(opportunity.status) ? (
                                                                        <form action={async () => {
                                                                            "use server";
                                                                            await generateSeoExecutionPreview(opportunity.id);
                                                                        }}>
                                                                            <PendingFormButton variant="outline" size="sm" className="rounded-md gap-2" idleIcon={<FileText className="h-4 w-4" />} pendingLabel="Previewing…">
                                                                                Preview
                                                                            </PendingFormButton>
                                                                        </form>
                                                                    ) : null}
                                                                    {opportunity.status === "ready_to_apply" ? (
                                                                        <form action={async () => {
                                                                            "use server";
                                                                            await applySeoInternalLinkRecommendation(opportunity.id);
                                                                        }}>
                                                                            <PendingFormButton variant="secondary" size="sm" className="rounded-md gap-2" idleIcon={<CheckCircle2 className="h-4 w-4" />} pendingLabel="Applying…">
                                                                                Apply
                                                                            </PendingFormButton>
                                                                        </form>
                                                                    ) : null}
                                                                    <Link href={specialistHref} className="inline-flex items-center gap-1 rounded-md border border-border/70 px-3 py-1.5 text-[15px] font-medium text-muted-foreground hover:text-foreground">
                                                                        Open
                                                                        <ArrowRight className="h-3.5 w-3.5" />
                                                                    </Link>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Autonomous Actions and Rollbacks */}
                    <div className="rounded-md border border-border/70 bg-card/70 p-6 shadow-sm">
                        <h3 className="text-[21px] font-semibold text-foreground mb-2">Autonomous GSC SEO Actions</h3>
                        <p className="text-[17px] text-muted-foreground mb-4">
                            Actions applied autonomously when GSC confidence is high. Use the rollback button to revert any change.
                        </p>
                        {(() => {
                            const gscEvents = data.executionEvents?.filter(e => {
                                const payload = e.preview_payload as unknown as GscPreviewPayload;
                                return payload?.gsc?.provenance === 'gsc' || payload?.gsc;
                            }) || [];

                            if (gscEvents.length === 0) {
                                return (
                                    <div className="rounded-md border border-dashed border-border/60 p-8 text-center text-muted-foreground text-[17px]">
                                        No autonomous GSC actions executed yet.
                                    </div>
                                );
                            }

                            return (
                                <div className="overflow-x-auto rounded-md border border-border">
                                    <table className="w-full text-left text-[17px]">
                                        <thead className="bg-muted/50 text-muted-foreground">
                                            <tr>
                                                <th className="px-4 py-3 font-medium">Execution ID</th>
                                                <th className="px-4 py-3 font-medium">Action Type</th>
                                                <th className="px-4 py-3 font-medium">GSC Query</th>
                                                <th className="px-4 py-3 font-medium">Status</th>
                                                <th className="px-4 py-3 font-medium">Applied At</th>
                                                <th className="px-4 py-3 font-medium text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {gscEvents.map((event, i) => {
                                                const payload = event.preview_payload as unknown as GscPreviewPayload;
                                                const gsc = payload?.gsc;
                                                return (
                                                    <tr key={i} className="hover:bg-muted/30">
                                                        <td className="px-4 py-3 font-mono text-[15px] text-muted-foreground">{event.id.substring(0, 8)}</td>
                                                        <td className="px-4 py-3 font-medium text-foreground">{event.mutation_strategy}</td>
                                                        <td className="px-4 py-3 text-muted-foreground">{gsc?.query || 'N/A'}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[15px] font-medium ${
                                                                event.execution_status === 'applied' ? 'bg-green-500/10 text-green-500' :
                                                                event.execution_status === 'rolled_back' ? 'bg-yellow-500/10 text-yellow-500' :
                                                                'bg-muted text-muted-foreground'
                                                            }`}>
                                                                {event.execution_status}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-muted-foreground text-[15px]">{new Date(event.created_at).toLocaleString()}</td>
                                                        <td className="px-4 py-3 text-right">
                                                            {event.execution_status === 'applied' && (
                                                                <form action={async () => {
                                                                    "use server";
                                                                    await rollbackSeoInternalLinkExecution(event.id);
                                                                }}>
                                                                    <PendingFormButton variant="outline" size="sm" className="rounded-md border-yellow-500/40 bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 dark:text-yellow-300" pendingLabel="Rolling back…">
                                                                        Rollback
                                                                    </PendingFormButton>
                                                                </form>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}
            </div>
        </DashboardAppWorkbench>
    );
}
