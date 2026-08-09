import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Mail, Network, Sparkles, Zap } from "lucide-react";
import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { getWorkflowAutomationSummary } from "@/features/business-spine/workflow-service";
import { listBusinessWorkflowRules } from "@/features/business-spine/service";
import { saveWorkflowRuleFormAction } from "@/features/business-spine/actions";
import { BUSINESS_SPINE_WORKFLOW_EVENT_CATALOG } from "@/features/business-spine/workflow-events";
import { WORKFLOW_ACTION_SUPPORT, getWorkflowWorkerRuntimeRegistry } from "@/features/business-spine/workflow-engine";
import { WORKFLOW_TEMPLATES } from "@/features/business-spine/workflow-templates";
import { WorkflowBuilder, type WorkflowBuilderWorkItemPreset } from "@/features/business-spine/ui/workflow-builder";
import { InstallWorkflowTemplatesForm } from "@/features/business-spine/ui/install-workflow-templates-form";
import { WorkflowRuleEditor } from "@/features/business-spine/ui/workflow-rule-editor";
import {
    DashboardAppWorkbench,
    AppCommandBar,
    AppMetricStrip,
    AppMetric,
    AppFeedbackLoop,
} from "@/features/admin/ui/app-workbench";

export const metadata = {
    title: "Automations | Admin",
    description: "Automation operating view for triggers, handoffs, and exception paths.",
};

const LANES = [
    { name: "Lead + newsletter intake", trigger: "Contact, subscribe, bounce, complaint", owner: "Growth", href: "/dashboard/newsletter", icon: Mail },
    { name: "Outreach + payments", trigger: "Reply, conversion, capture, failure", owner: "Revenue", href: "/dashboard/customers", icon: Zap },
    { name: "Legal + booking handoffs", trigger: "Signed, voided, confirmed, cancelled", owner: "Operations", href: "/dashboard/booking", icon: Sparkles },
    { name: "Intelligence + integration health", trigger: "GSC, stale source, degraded, failing", owner: "Platform", href: "/dashboard/integrations", icon: Network },
];

const TEMPLATE_TRIGGER_COUNT = new Set(WORKFLOW_TEMPLATES.map((template) => template.triggerKey)).size;
const WORK_ITEM_PRESETS: WorkflowBuilderWorkItemPreset[] = WORKFLOW_TEMPLATES.map((template) => ({
    label: template.name,
    triggerKey: template.triggerKey,
    title: template.actionJson[0].title,
    kind: template.actionJson[0].kind,
    priority: template.actionJson[0].priority,
    description: template.actionJson[0].description,
}));

const workflowCheckboxLabelClass =
    "inline-flex min-h-10 min-w-0 cursor-pointer items-center gap-2 rounded-md border border-border/60 bg-background/70 px-3 py-2 text-[15px] font-semibold text-muted-foreground transition hover:bg-muted/40";

const workflowCheckboxInputClass = "h-4 w-4 shrink-0 rounded border-input";

function formatDate(value: string) {
    return new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value));
}

function formatLabel(value: string) {
    return value.replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMaybeDate(value: string | null | undefined) {
    return value ? formatDate(value) : "Not recorded";
}

function formatApprovalAge(minutes: number | null) {
    if (minutes === null) return "Not awaiting approval";
    if (minutes < 60) return `${minutes}m waiting`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m waiting`;
}

export default async function AutomationsPage() {
    const state = await requireDashboardModuleAccess("automations");
    const [summary, rules] = await Promise.all([
        getWorkflowAutomationSummary(state.workspace.id),
        listBusinessWorkflowRules(state.workspace.id),
    ]);
    const workerRuntimeRegistry = getWorkflowWorkerRuntimeRegistry();

    return (
        <DashboardAppWorkbench>
            <AppCommandBar>
                <div className="flex w-full items-center justify-end gap-2">
                        <Link
                            href="/dashboard/newsletter"
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/60 bg-background/70 px-3 text-[14px] font-medium hover:bg-muted/50 transition-colors"
                        >
                            Newsletter automations
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                        <InstallWorkflowTemplatesForm />
                </div>
            </AppCommandBar>

            <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-6">
                <div>
                    <h1 className="text-[33px] font-bold tracking-tight text-foreground">Automations</h1>
                    <p className="mt-2 text-[17px] text-muted-foreground">
                        Automation map for {state.workspace.name}: what fires, where it hands off, and where operators check exceptions.
                    </p>
                </div>

                <AppMetricStrip className="px-0 py-0 border-b-0 bg-transparent">
                    <AppMetric label="Enabled rules" value={summary.rules.enabled} icon={CheckCircle2} />
                    <AppMetric label="Approval-gated rules" value={summary.rules.requiresApproval} icon={Sparkles} />
                    <AppMetric label="Awaiting approval" value={summary.runs.awaitingApproval} icon={Clock3} variant={summary.runs.awaitingApproval > 0 ? "warning" : "default"} />
                    <AppMetric label="Failed runs" value={summary.runs.failed} variant={summary.runs.failed > 0 ? "destructive" : "default"} icon={AlertTriangle} />
                </AppMetricStrip>

                <AppFeedbackLoop
                    title="Workflow control loop"
                    description="Every automation is a governed path from an event to an operator-visible outcome."
                    stages={[
                        { label: "Enabled", value: summary.rules.enabled, detail: "active rules", tone: summary.rules.enabled > 0 ? "success" : "default" },
                        { label: "Approval", value: summary.runs.awaitingApproval, detail: "waiting decisions", tone: summary.runs.awaitingApproval > 0 ? "warning" : "default" },
                        { label: "Failed", value: summary.runs.failed, detail: "exception queue", tone: summary.runs.failed > 0 ? "danger" : "success" },
                        { label: "Lanes", value: LANES.length, detail: "handoff routes", tone: "info" },
                    ]}
                    feedbackLabel="Approval latency and failed runs should change the rule, owner, or kill-switch posture before adding more automation."
                />

                {!summary.available ? (
                    <section className="rounded-md border border-border/60 bg-muted/30 p-4">
                        <h2 className="text-[17px] font-semibold text-foreground">Workflow engine</h2>
                        <p className="mt-1 text-[15px] text-muted-foreground">
                            No workflow tables are available in this environment yet.
                        </p>
                    </section>
                ) : null}

                <section className="grid gap-4 lg:grid-cols-3" aria-label="Workflow authoring guidance">
                    <div className="rounded-md border border-border/60 bg-card/40 p-4 lg:col-span-2">
                        <h2 className="text-[19px] font-semibold text-foreground">Catalog-first authoring</h2>
                        <p className="mt-2 text-[15px] leading-6 text-muted-foreground">
                            Rules should start from canonical Business Spine events. Matching create_work_item presets are suggested when a trigger is selected. Raw trigger keys and JSON descriptors remain available for internal operators, but catalog selections prevent typos and keep recorder wiring aligned with the workflow engine.
                        </p>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {BUSINESS_SPINE_WORKFLOW_EVENT_CATALOG.slice(0, 6).map((event) => (
                                <div key={event.key} className="rounded-md border border-border/60 bg-background/60 p-3">
                                    <p className="text-[14px] font-mono text-foreground">{event.key}</p>
                                    <p className="mt-1 text-[14px] text-muted-foreground">{event.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-4">
                        <h2 className="text-[19px] font-semibold text-foreground">Safe template defaults</h2>
                        <p className="mt-2 text-[15px] leading-6 text-muted-foreground">
                            Starter templates install disabled and approval-required for safe review. Disabled is not a lock: admins can edit every field and enable each rule after checking the trigger, condition JSON, and action JSON for the workspace.
                        </p>
                        <ul className="mt-3 space-y-2 text-[14px] text-muted-foreground">
                            <li>• Installs {WORKFLOW_TEMPLATES.length} templates across {TEMPLATE_TRIGGER_COUNT} catalog triggers.</li>
                            <li>• Every seeded template is disabled and approval-required by default for review.</li>
                            <li>• Admins can update names, triggers, conditions, actions, approval, kill switch, and enabled state.</li>
                            <li>• Re-install is idempotent: existing template ids or trigger keys are skipped.</li>
                            <li>• Kill switch can pause a saved rule without deleting it.</li>
                        </ul>
                    </div>
                </section>

                <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Automation lanes">
                    {LANES.map((lane) => {
                        const Icon = lane.icon;
                        return (
                            <Link
                                key={lane.name}
                                href={lane.href}
                                className="rounded-md border border-border/60 bg-card/40 p-4 transition hover:border-primary/40 hover:bg-primary/5"
                            >
                                <Icon className="mb-3 h-4 w-4 text-primary" />
                                <p className="text-[17px] font-semibold text-foreground">{lane.name}</p>
                                <p className="mt-1 text-[15px] text-muted-foreground">Trigger: {lane.trigger}</p>
                                <p className="mt-2 text-[14px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">{lane.owner}</p>
                            </Link>
                        );
                    })}
                </section>

                <section className="rounded-md border border-border/60 bg-card/40 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h2 className="text-[21px] font-semibold text-foreground">Create workflow rule</h2>
                            <p className="mt-1 text-[15px] text-muted-foreground">
                                Choose a catalog trigger first. Condition and action JSON are advanced/internal controls for operators who understand workflow payloads.
                            </p>
                        </div>
                        <span className="rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-[13px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Disabled + approval by default
                        </span>
                    </div>
                    <form action={saveWorkflowRuleFormAction} className="mt-4 grid gap-3 lg:grid-cols-6">
                        <label className="grid min-w-0 gap-1 text-[14px] font-semibold text-muted-foreground lg:col-span-3">
                            Name
                            <input name="name" required className="h-9 w-full min-w-0 rounded-md border border-border bg-background px-3 text-[17px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                        </label>
                        <label className="grid min-w-0 gap-1 text-[14px] font-semibold text-muted-foreground lg:col-span-3">
                            Trigger catalog
                            <select name="triggerKey" required defaultValue="" className="h-9 w-full min-w-0 rounded-md border border-border bg-background px-3 text-[15px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                                <option value="" disabled>Select canonical event</option>
                                {BUSINESS_SPINE_WORKFLOW_EVENT_CATALOG.map((event) => (
                                    <option key={event.key} value={event.key}>{event.key} — {event.description}</option>
                                ))}
                            </select>
                        </label>
                        <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:col-span-6" aria-label="Workflow rule toggles">
                            <label className={workflowCheckboxLabelClass}>
                                <input name="isEnabled" type="checkbox" className={workflowCheckboxInputClass} />
                                <span className="min-w-0 break-words">Enabled</span>
                            </label>
                            <label className={workflowCheckboxLabelClass}>
                                <input name="requiresApproval" type="checkbox" defaultChecked className={workflowCheckboxInputClass} />
                                <span className="min-w-0 break-words">Approval</span>
                            </label>
                        </div>
                         <WorkflowBuilder
                             initialConditionJson={{}}
                             initialActionJson={[{ type: "create_work_item", title: "Review signal", kind: "task", priority: "normal" }]}
                             workItemPresets={WORK_ITEM_PRESETS}
                          />
                        <label className={`${workflowCheckboxLabelClass} lg:col-span-6`}>
                            <input name="killSwitch" type="checkbox" className={workflowCheckboxInputClass} />
                            <span className="min-w-0 break-words">Kill switch</span>
                        </label>
                        <div className="lg:col-span-6 pt-2">
                            <button type="submit" className="h-9 rounded-md bg-primary px-4 text-[17px] font-medium text-primary-foreground hover:bg-primary/90 cursor-pointer">
                                Save rule
                            </button>
                        </div>
                    </form>
                </section>

                <section className="rounded-md border border-border/60 bg-card/40 p-5" aria-label="Workflow rule health cards">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h2 className="text-[21px] font-semibold text-foreground">Per-rule health</h2>
                            <p className="mt-1 text-[15px] text-muted-foreground">
                                Last matched event, run posture, errors, approval age, and idempotency skips from the workflow summary. Installed rules that are disabled are waiting for admin review, not locked.
                            </p>
                        </div>
                        <span className="rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-[13px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            {summary.rules.healthCards.length} cards
                        </span>
                    </div>
                    <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                        {summary.rules.healthCards.length > 0 ? summary.rules.healthCards.map((card) => (
                            <article key={card.ruleId} className="rounded-md border border-border/60 bg-background/60 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h3 className="text-[16px] font-semibold text-foreground">{card.name}</h3>
                                        <p className="mt-1 font-mono text-[13px] text-muted-foreground">{card.triggerKey}</p>
                                    </div>
                                    <span className={`rounded-full border px-2.5 py-1 text-[12px] font-semibold ${card.lastRun?.posture === "failed" || card.lastError ? "border-destructive/30 bg-destructive/10 text-destructive" : card.lastRun?.posture === "awaiting_approval" ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}`}>
                                        {card.lastRun ? formatLabel(card.lastRun.posture) : card.isEnabled ? "Enabled" : "Disabled"}
                                    </span>
                                </div>
                                <dl className="mt-4 grid gap-2 text-[14px]">
                                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Last matched</dt><dd className="text-right text-foreground">{formatMaybeDate(card.lastMatchedEvent?.createdAt)}</dd></div>
                                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Source</dt><dd className="text-right text-foreground">{card.lastMatchedEvent?.sourceModule ?? "—"}</dd></div>
                                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Last run</dt><dd className="text-right text-foreground">{card.lastRun ? `${formatLabel(card.lastRun.status)} · ${card.lastRun.attempts}/${card.lastRun.maxAttempts}` : "No run"}</dd></div>
                                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Approval age</dt><dd className="text-right text-foreground">{formatApprovalAge(card.approvalAgeMinutes)}</dd></div>
                                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Idempotency skips</dt><dd className="text-right text-foreground">{card.idempotencySkipCount}</dd></div>
                                </dl>
                                {card.lastError ? <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] font-semibold text-destructive">{card.lastError}</p> : null}
                            </article>
                        )) : (
                            <p className="rounded-md border border-border/60 bg-background/60 px-4 py-6 text-center text-[15px] text-muted-foreground lg:col-span-2 xl:col-span-3">No rule health cards available yet.</p>
                        )}
                    </div>
                </section>

                <section className="grid gap-4 lg:grid-cols-2" aria-label="Workflow observability">
                    <div className="overflow-hidden rounded-md border border-border/60 bg-card/40">
                        <div className="border-b border-border/60 px-4 py-3 bg-muted/20">
                            <h2 className="text-[19px] font-semibold text-foreground">Recent workflow events</h2>
                            <p className="mt-1 text-[14px] text-muted-foreground">{summary.events.total} total events recorded for this workspace.</p>
                        </div>
                        <div className="divide-y divide-border/60">
                            {summary.events.recentByKey.length > 0 ? summary.events.recentByKey.map((event) => (
                                <div key={event.eventKey} className="flex items-center justify-between gap-3 px-4 py-3">
                                    <div>
                                        <p className="text-[15px] font-mono text-foreground">{event.eventKey}</p>
                                        <p className="text-[14px] text-muted-foreground">Latest {formatDate(event.latestAt)}</p>
                                    </div>
                                    <span className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-[14px] font-semibold text-foreground">{event.count}</span>
                                </div>
                            )) : (
                                <p className="px-4 py-6 text-[17px] text-muted-foreground text-center">No workflow events recorded yet.</p>
                            )}
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-md border border-border/60 bg-card/40">
                        <div className="border-b border-border/60 px-4 py-3 bg-muted/20">
                            <h2 className="text-[19px] font-semibold text-foreground">Action support boundaries</h2>
                            <p className="mt-1 text-[14px] text-muted-foreground">Unsupported templates and incomplete worker descriptors are recorded as workflow events, not silently executed.</p>
                        </div>
                        <div className="grid gap-3 p-4">
                            <div>
                                <p className="text-[14px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Concrete actions</p>
                                <p className="mt-1 text-[15px] text-foreground">{WORKFLOW_ACTION_SUPPORT.concreteActions.map(formatLabel).join(", ")}</p>
                            </div>
                            <div className="grid gap-2">
                                <p className="text-[14px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Worker jobs</p>
                                {workerRuntimeRegistry.map((worker) => (
                                    <div key={worker.key} className="rounded-md border border-border/60 bg-background/60 p-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <p className="font-mono text-[14px] text-foreground">{worker.key}</p>
                                            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">Advanced runtime-bound</span>
                                        </div>
                                        <p className="mt-2 text-[14px] text-muted-foreground">Not starter-template eligible until typed binding schema, retry policy, and audit trail are complete.</p>
                                        <ul className="mt-2 grid gap-1 text-[13px] text-muted-foreground">
                                            <li>• Binding schema: typed (validated before enqueue)</li>
                                            <li>• Retry policy: {worker.retryPolicy.maxRetries} retries, {worker.retryPolicy.backoffStrategy} backoff from {Math.round(worker.retryPolicy.baseDelayMs / 1000)}s</li>
                                            <li>• Audit trail: {worker.auditTrail.table} ({worker.auditTrail.eventKeyPrefix})</li>
                                        </ul>
                                    </div>
                                ))}
                            </div>
                            <div className="grid gap-2">
                                <p className="text-[14px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Worker support notes</p>
                                {WORKFLOW_ACTION_SUPPORT.workerJobs.map((worker) => (
                                    <p key={worker.key} className="text-[14px] text-muted-foreground"><span className="font-mono text-foreground">{worker.key}</span>: {worker.support}</p>
                                ))}
                            </div>
                            <div className="grid gap-2">
                                <p className="text-[14px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Email templates</p>
                                {WORKFLOW_ACTION_SUPPORT.emailTemplates.map((template) => (
                                    <p key={template.key} className="text-[14px] text-muted-foreground"><span className="font-mono text-foreground">{template.key}</span>: {template.support}</p>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="grid gap-4 lg:grid-cols-2" aria-label="Live workflow records">
                    <div className="overflow-hidden rounded-md border border-border/60 bg-card/40">
                        <div className="border-b border-border/60 px-4 py-3 bg-muted/20">
                            <h2 className="text-[19px] font-semibold text-foreground">Workflow rules</h2>
                            <p className="mt-1 text-[14px] text-muted-foreground">
                                Edit installed and custom rules in place. Template metadata stays visible for traceability, but it does not make a rule immutable.
                            </p>
                        </div>
                        <div className="divide-y divide-border/60">
                            {rules.length > 0 ? rules.map((rule) => (
                                <WorkflowRuleEditor
                                    key={rule.id}
                                    rule={rule}
                                    eventCatalog={BUSINESS_SPINE_WORKFLOW_EVENT_CATALOG}
                                    workItemPresets={WORK_ITEM_PRESETS}
                                    updatedLabel={formatDate(rule.updatedAt)}
                                />
                            )) : (
                                <p className="px-4 py-6 text-[17px] text-muted-foreground text-center">No workflow rules registered.</p>
                            )}
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-md border border-border/60 bg-card/40">
                        <div className="border-b border-border/60 px-4 py-3 bg-muted/20">
                            <h2 className="text-[19px] font-semibold text-foreground">Recent runs</h2>
                        </div>
                        <div className="divide-y divide-border/60">
                            {summary.runs.recent.length > 0 ? summary.runs.recent.map((run) => (
                                <div key={run.id} className="grid gap-1 px-4 py-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-[17px] font-medium capitalize text-foreground">{run.posture.replace(/_/g, " ")}</p>
                                        <span className="text-[14px] text-muted-foreground">{run.attempts}/{run.maxAttempts} attempts</span>
                                    </div>
                                    {run.errorMessage ? <p className="text-[15px] text-destructive font-semibold">{run.errorMessage}</p> : null}
                                    <p className="text-[14px] text-muted-foreground">Updated {formatDate(run.updatedAt)}</p>
                                </div>
                            )) : (
                                <p className="px-4 py-6 text-[17px] text-muted-foreground text-center">No workflow runs recorded.</p>
                            )}
                        </div>
                    </div>
                </section>
            </div>
        </DashboardAppWorkbench>
    );
}
