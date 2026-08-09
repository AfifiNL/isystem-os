import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, CircleGauge, CircleSlash, ShieldAlert, ShieldCheck } from "lucide-react";
import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { listBusinessIntegrationRegistry } from "@/features/business-spine/integrations";
import { recordManualIntegrationEvidenceFormAction } from "@/features/business-spine/actions";
import type { BusinessIntegrationStatus } from "@/features/business-spine/health";
import {
    DashboardAppWorkbench,
    AppCommandBar,
    AppMetricStrip,
    AppMetric,
    AppFeedbackLoop,
} from "@/features/admin/ui/app-workbench";

export const metadata = {
    title: "Workspace Health | Admin",
    description: "Workspace health scaffold for operating signals, risks, and checks.",
};

const STATUS_COPY: Record<BusinessIntegrationStatus, string> = {
    healthy: "Healthy",
    degraded: "Degraded",
    failing: "Failing",
    unknown: "Unknown",
    disabled: "Disabled",
};

const STATUS_CLASS: Record<BusinessIntegrationStatus, string> = {
    healthy: "text-emerald-600 dark:text-emerald-300",
    degraded: "text-amber-600 dark:text-amber-300",
    failing: "text-rose-600 dark:text-rose-300",
    unknown: "text-muted-foreground",
    disabled: "text-muted-foreground",
};

function statusIcon(status: BusinessIntegrationStatus) {
    if (status === "healthy") return CheckCircle2;
    if (status === "degraded") return AlertTriangle;
    if (status === "failing") return ShieldAlert;
    if (status === "disabled") return CircleSlash;
    return CircleGauge;
}

function formatTimestamp(value: string | null) {
    if (!value) return "No check yet";
    return new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value));
}

function detailsText(details: unknown) {
    if (!details || typeof details !== "object" || Array.isArray(details)) return null;
    const record = details as Record<string, unknown>;
    const parts = [
        typeof record.evidenceRef === "string" && record.evidenceRef ? `ref: ${record.evidenceRef}` : null,
        typeof record.evidenceUrl === "string" && record.evidenceUrl ? `url: ${record.evidenceUrl}` : null,
        typeof record.checkedBy === "string" && record.checkedBy ? `by: ${record.checkedBy}` : null,
        typeof record.processed === "number" ? `processed: ${record.processed}` : null,
        typeof record.failed === "number" ? `failed: ${record.failed}` : null,
        typeof record.queueDepth === "number" ? `queue: ${record.queueDepth}` : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : null;
}

export default async function HealthPage() {
    const state = await requireDashboardModuleAccess("health");
    const snapshot = await listBusinessIntegrationRegistry(state.workspace.id);

    // Stale heartbeat detection override
    const activeItems = snapshot.items.filter((item) => item.status !== "disabled").map((item) => {
        if (item.status === "healthy" && item.latestCheck?.checkedAt) {
            const hoursSince = (Date.now() - new Date(item.latestCheck.checkedAt).getTime()) / (1000 * 60 * 60);
            if (hoursSince > 24 && (item.category === "cron" || item.category === "worker")) {
                return {
                    ...item,
                    status: "degraded" as BusinessIntegrationStatus,
                    latestCheck: {
                        ...item.latestCheck,
                        message: "Stale heartbeat: no evidence in >24h",
                    },
                };
            }
        }
        return item;
    });

    const attentionItems = activeItems.filter((item) => item.status !== "healthy");
    const rollup = {
        healthy: activeItems.filter((i) => i.status === "healthy").length,
        degraded: activeItems.filter((i) => i.status === "degraded").length,
        failing: activeItems.filter((i) => i.status === "failing").length,
        unknown: activeItems.filter((i) => i.status === "unknown").length,
        disabled: snapshot.rollup.disabled,
        total: snapshot.rollup.total,
        status: "healthy" as BusinessIntegrationStatus,
    };
    if (rollup.failing > 0) rollup.status = "failing";
    else if (rollup.degraded > 0) rollup.status = "degraded";
    else if (rollup.unknown > 0 && rollup.healthy === 0) rollup.status = "unknown";

    const postureIcon = statusIcon(rollup.status);
    const PostureIcon = postureIcon;
    const manualItems = activeItems.filter((item) => item.provider === "self-hosted-supabase" || item.status !== "healthy" || item.provider === "backup-drills");

    return (
        <DashboardAppWorkbench>
            <AppCommandBar>
                <div className="flex w-full items-center justify-end">
                    <Link
                        href="/dashboard/integrations"
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/60 bg-background/70 px-3 text-[14px] font-medium hover:bg-muted/50 transition-colors"
                    >
                        Open integrations
                        <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                </div>
            </AppCommandBar>

            <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-6">
                <div>
                    <h1 className="text-[33px] font-bold tracking-tight text-foreground">Workspace Health</h1>
                    <p className="mt-2 text-[17px] text-muted-foreground">
                        Workspace health console for {state.workspace.name}: read-only posture, owner modules, and review routes.
                    </p>
                </div>

                <AppMetricStrip className="px-0 py-0 border-b-0 bg-transparent">
                    <AppMetric
                        label="Status Posture"
                        value={STATUS_COPY[rollup.status]}
                        icon={PostureIcon}
                        description={`${rollup.total} surfaces, ${activeItems.length} active`}
                        variant={rollup.status === "healthy" ? "success" : rollup.status === "degraded" ? "warning" : "destructive"}
                    />
                    <AppMetric
                        label="Need Attention"
                        value={rollup.degraded + rollup.failing}
                        icon={AlertTriangle}
                        description="Degraded or failing worker cron routes"
                        variant={rollup.degraded + rollup.failing > 0 ? "destructive" : "default"}
                    />
                    <AppMetric
                        label="Awaiting Checks"
                        value={rollup.unknown}
                        icon={CircleGauge}
                        description="No recent health evidence"
                    />
                </AppMetricStrip>

                <AppFeedbackLoop
                    title="Health recovery loop"
                    description="Evidence moves from a heartbeat to a named intervention and back into the next check."
                    stages={[
                        { label: "Observed", value: activeItems.length, detail: "active checks", tone: "info" },
                        { label: "Healthy", value: rollup.healthy, detail: "verified", tone: "success" },
                        { label: "Attention", value: attentionItems.length, detail: "degraded or unknown", tone: attentionItems.length > 0 ? "warning" : "success" },
                        { label: "Failing", value: rollup.failing, detail: "recovery queue", tone: rollup.failing > 0 ? "danger" : "success" },
                    ]}
                    feedbackLabel="Stale or failing evidence changes the owner and recovery action; a green count without recent evidence is not healthy."
                />

                <section className="overflow-hidden rounded-md border border-border/60 bg-card/40">
                    <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3 bg-muted/20">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        <h2 className="text-[19px] font-semibold text-foreground">Evidence checks</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead className="bg-muted/40 border-b border-border/50 text-[14px] uppercase tracking-wider text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-2.5 font-semibold">Check</th>
                                    <th className="px-4 py-2.5 font-semibold">Status</th>
                                    <th className="px-4 py-2.5 font-semibold">Owner / Evidence</th>
                                    <th className="px-4 py-2.5 font-semibold">Required action</th>
                                    <th className="px-4 py-2.5 font-semibold">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                                {(attentionItems.length > 0 ? attentionItems : activeItems).map((item) => {
                                    const Icon = statusIcon(item.status);
                                    return (
                                        <tr key={`${item.provider}:${item.integrationKey}`} className="hover:bg-muted/40 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <Icon className={`h-4 w-4 ${STATUS_CLASS[item.status]}`} />
                                                    <span className="font-semibold text-foreground text-[17px]">{item.label}</span>
                                                </div>
                                            </td>
                                            <td className={`px-4 py-3 font-semibold text-[17px] ${STATUS_CLASS[item.status]}`}>{STATUS_COPY[item.status]}</td>
                                            <td className="px-4 py-3 text-muted-foreground text-[17px]">
                                                <p>{item.owner} · latest {formatTimestamp(item.latestCheck?.checkedAt ?? item.updatedAt)}</p>
                                                <p className="mt-1 text-[15px]">{item.latestCheck?.message ?? item.purpose}</p>
                                                {detailsText(item.latestCheck?.details) ? <p className="mt-1 text-[14px]">{detailsText(item.latestCheck?.details)}</p> : null}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground text-[17px]">
                                                {item.status === "healthy" ? "Monitor freshness" : item.configStatus === "action_required" ? `Configure ${item.missingEnv.join(", ")}` : "Record evidence or investigate"}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Link href={item.href} className="text-[15px] font-medium text-primary hover:underline">
                                                    Open
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {activeItems.length === 0 && (
                                    <tr>
                                        <td className="px-4 py-6 text-muted-foreground text-[17px] text-center" colSpan={5}>
                                            No active health surfaces are registered yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="overflow-hidden rounded-md border border-border/60 bg-card/40">
                    <div className="border-b border-border/60 px-4 py-3 bg-muted/20">
                        <h2 className="text-[19px] font-semibold text-foreground">Manual cutover evidence</h2>
                    </div>
                    <div className="divide-y divide-border/60">
                        {manualItems.map((item) => (
                            <form key={`manual-${item.integrationKey}`} action={recordManualIntegrationEvidenceFormAction} className="grid gap-3 px-4 py-4 lg:grid-cols-6">
                                <input type="hidden" name="workspaceId" value={state.workspace.id} />
                                <input type="hidden" name="provider" value={item.provider} />
                                <input type="hidden" name="integrationKey" value={item.integrationKey} />
                                <div className="lg:col-span-2">
                                    <p className="text-[17px] font-medium text-foreground">{item.label}</p>
                                    <p className="mt-1 text-[15px] text-muted-foreground">{item.purpose}</p>
                                </div>
                                <label className="grid gap-1 text-[14px] font-semibold text-muted-foreground">
                                    Status
                                    <select name="status" defaultValue={item.status === "unknown" ? "healthy" : item.status} className="h-9 rounded-md border border-border bg-background px-2 text-[17px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                                        <option value="healthy">Healthy</option>
                                        <option value="degraded">Degraded</option>
                                        <option value="failing">Failing</option>
                                        <option value="unknown">Unknown</option>
                                    </select>
                                </label>
                                <label className="grid gap-1 text-[14px] font-semibold text-muted-foreground">
                                    Evidence ref
                                    <input name="evidenceRef" placeholder="runbook/check id" className="h-9 rounded-md border border-border bg-background px-3 text-[17px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                                </label>
                                <label className="grid gap-1 text-[14px] font-semibold text-muted-foreground">
                                    Checked by
                                    <input name="checkedBy" placeholder="operator" className="h-9 rounded-md border border-border bg-background px-3 text-[17px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                                </label>
                                <div className="flex items-end">
                                    <button type="submit" className="h-9 w-full rounded-md bg-primary px-3 text-[17px] font-medium text-primary-foreground hover:bg-primary/90 cursor-pointer">
                                        Record
                                    </button>
                                </div>
                                <label className="grid gap-1 text-[14px] font-semibold text-muted-foreground lg:col-span-4">
                                    Evidence note
                                    <input name="message" defaultValue={item.latestCheck?.message ?? ""} placeholder="What was verified?" className="h-9 rounded-md border border-border bg-background px-3 text-[17px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                                </label>
                                <label className="grid gap-1 text-[14px] font-semibold text-muted-foreground lg:col-span-2">
                                    Evidence URL
                                    <input name="evidenceUrl" placeholder="optional" className="h-9 rounded-md border border-border bg-background px-3 text-[17px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                                </label>
                            </form>
                        ))}
                    </div>
                </section>
            </div>
        </DashboardAppWorkbench>
    );
}
