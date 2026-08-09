import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, CircleSlash, DatabaseZap, HelpCircle, ShieldAlert } from "lucide-react";
import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { AppCommandBar, AppMetric, AppMetricStrip, AppStatusBanner, AppFeedbackLoop, DashboardAppWorkbench } from "@/features/admin/ui/app-workbench";
import { listBusinessIntegrationRegistry, type BusinessIntegrationRegistryItem } from "@/features/business-spine/integrations";
import type { BusinessIntegrationStatus } from "@/features/business-spine/health";
import { syncBusinessIntegrationRegistryFormAction } from "@/features/business-spine/actions";

export const metadata = {
    title: "Integrations | Admin",
    description: "Health evidence registry for connected systems and ownership.",
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
    failing: "text-red-600 dark:text-red-300",
    unknown: "text-muted-foreground",
    disabled: "text-muted-foreground",
};

function statusIcon(status: BusinessIntegrationStatus) {
    if (status === "healthy") return CheckCircle2;
    if (status === "degraded") return AlertTriangle;
    if (status === "failing") return ShieldAlert;
    if (status === "disabled") return CircleSlash;
    return HelpCircle;
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

function configCopy(item: BusinessIntegrationRegistryItem) {
    if (item.configStatus === "configured") return "Configured";
    if (item.configStatus === "disabled") return "Disabled";
    return `Missing ${item.missingEnv.join(", ")}`;
}

function nextActionCopy(item: BusinessIntegrationRegistryItem) {
    if (!item.registered) return "Expected surface only: confirm environment config or wait for the next health write to register evidence.";
    if (item.configStatus === "action_required") return `Add missing environment configuration: ${item.missingEnv.join(", ")}.`;
    if (item.status === "failing") return "Open the runbook, inspect the latest error, and record fresh evidence after remediation.";
    if (item.status === "degraded") return "Review recent failures and confirm whether the provider or worker has recovered.";
    if (item.status === "unknown") return "Run the relevant worker/cron/provider check so this registry has current evidence.";
    if (item.status === "disabled") return "Keep disabled intentionally or re-enable the provider configuration before checking health.";
    return "Monitor the latest check and keep owner/runbook metadata current.";
}

export default async function IntegrationsPage() {
    const state = await requireDashboardModuleAccess("integrations");
    const snapshot = await listBusinessIntegrationRegistry(state.workspace.id);
    const registeredCount = snapshot.items.filter((item) => item.registered).length;
    const attentionCount = snapshot.rollup.degraded + snapshot.rollup.failing + snapshot.rollup.unknown;

    return (
        <DashboardAppWorkbench>
            <AppCommandBar>
                <div className="flex w-full items-center justify-end gap-2">
                    <form action={syncBusinessIntegrationRegistryFormAction}>
                        <button
                            type="submit"
                            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-primary px-3 text-[15px] font-medium text-primary-foreground hover:bg-primary/90"
                        >
                            <ArrowRight className="hidden" /> {/* just to ensure lucide import is kept if unused later */}
                            Sync Registry
                        </button>
                    </form>
                    <Link
                        href="/dashboard/settings"
                        className="inline-flex h-9 items-center gap-2 rounded-md border border-border/60 bg-background px-3 text-[15px] font-medium hover:bg-muted"
                    >
                        Open settings
                        <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                </div>
            </AppCommandBar>

            <AppMetricStrip>
                <AppMetric label="Healthy" value={snapshot.rollup.healthy} variant="success" />
                <AppMetric label="Degraded" value={snapshot.rollup.degraded} variant="warning" />
                <AppMetric label="Failing" value={snapshot.rollup.failing} variant="destructive" />
                <AppMetric label="Unknown" value={snapshot.rollup.unknown} />
                <AppMetric label="Disabled" value={snapshot.rollup.disabled} />
            </AppMetricStrip>

            <AppFeedbackLoop
                title="Integration recovery loop"
                description="Configuration becomes a health check, a named owner, and a recoverable evidence trail."
                stages={[
                    { label: "Configured", value: snapshot.items.filter((item) => item.configStatus === "configured").length, detail: "provider surfaces", tone: "info" },
                    { label: "Registered", value: registeredCount, detail: "with evidence", tone: registeredCount > 0 ? "success" : "default" },
                    { label: "Attention", value: attentionCount, detail: "degraded, failing, or unknown", tone: attentionCount > 0 ? "warning" : "success" },
                    { label: "Disabled", value: snapshot.rollup.disabled, detail: "intentional pause", tone: "default" },
                ]}
                feedbackLabel="A failed or stale check changes the owner and runbook path; configuration alone is not proof of a healthy connection."
            />

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {!snapshot.registryAvailable && (
                    <AppStatusBanner variant="warning" className="mb-4">
                        Integration registry tables are not available in this environment yet. Expected surfaces are shown from configuration only.
                    </AppStatusBanner>
                )}

            <section className="overflow-hidden rounded-md border border-border/60 bg-background/70">
                <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
                    <DatabaseZap className="h-4 w-4 text-primary" />
                    <div>
                        <h2 className="text-[17px] font-semibold">Health evidence registry</h2>
                        <p className="text-[15px] text-muted-foreground">
                            This is not a full connector manager yet. It summarizes configuration, health checks, errors, owners, and operator next actions from existing evidence fields.
                        </p>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-[15px]">
                        <thead className="bg-muted/50 text-[14px] uppercase text-muted-foreground">
                            <tr>
                                <th className="px-4 py-2 font-medium">Integration</th>
                                <th className="px-4 py-2 font-medium">Purpose</th>
                                <th className="px-4 py-2 font-medium">Owner</th>
                                <th className="px-4 py-2 font-medium">Config</th>
                                <th className="px-4 py-2 font-medium">Health</th>
                                <th className="px-4 py-2 font-medium">Last check</th>
                                <th className="px-4 py-2 font-medium">Evidence / next action</th>
                                <th className="px-4 py-2 font-medium">Runbook</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                            {snapshot.items.map((item) => {
                                const Icon = statusIcon(item.status);
                                return (
                                    <tr key={`${item.provider}:${item.integrationKey}`}>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Icon className={`h-4 w-4 ${STATUS_CLASS[item.status]}`} />
                                                <div>
                                                    <p className="font-medium text-foreground">{item.label}</p>
                                                    <p className="text-[15px] text-muted-foreground">{item.provider}/{item.integrationKey}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="max-w-sm px-4 py-3 text-muted-foreground">{item.purpose}</td>
                                        <td className="px-4 py-3 text-muted-foreground">{item.owner}</td>
                                        <td className="px-4 py-3 text-muted-foreground">{configCopy(item)}</td>
                                        <td className={`px-4 py-3 font-medium ${STATUS_CLASS[item.status]}`}>{STATUS_COPY[item.status]}</td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            <div>{formatTimestamp(item.latestCheck?.checkedAt ?? item.updatedAt)}</div>
                                            {item.latestCheck?.message && <div className="max-w-xs truncate text-[13px]">{item.latestCheck.message}</div>}
                                            {item.lastErrorMessage && <div className="max-w-xs truncate text-[13px] text-red-600 dark:text-red-300">{item.lastErrorMessage}</div>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="max-w-sm text-[14px] text-muted-foreground">{nextActionCopy(item)}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Link href={item.href} className="text-[15px] font-medium text-primary hover:underline">
                                                Open runbook
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>
            </div>
        </DashboardAppWorkbench>
    );
}
