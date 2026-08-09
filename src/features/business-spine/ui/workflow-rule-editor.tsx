"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2, Power, PowerOff, XCircle } from "lucide-react";
import { saveWorkflowRuleAction, setWorkflowRuleEnabledAction } from "@/features/business-spine/actions";
import type { BusinessWorkflowRule } from "@/features/business-spine/types";
import { WorkflowBuilder, type WorkflowBuilderWorkItemPreset } from "@/features/business-spine/ui/workflow-builder";

type ActionState = {
    ok: boolean;
    message: string;
};

type WorkflowEventOption = {
    key: string;
    description: string;
};

type WorkflowRuleEditorProps = {
    rule: BusinessWorkflowRule;
    eventCatalog: readonly WorkflowEventOption[];
    workItemPresets: WorkflowBuilderWorkItemPreset[];
    updatedLabel: string;
};

const initialState: ActionState = { ok: false, message: "" };

const workflowCheckboxLabelClass =
    "inline-flex min-h-10 min-w-0 cursor-pointer items-center gap-2 rounded-md border border-border/60 bg-background/70 px-3 py-2 text-[15px] font-semibold text-muted-foreground transition hover:bg-muted/40";

const workflowCheckboxInputClass = "h-4 w-4 shrink-0 rounded border-input";

function getRuleMetadata(rule: BusinessWorkflowRule) {
    return rule.metadata && typeof rule.metadata === "object" && !Array.isArray(rule.metadata)
        ? rule.metadata as Record<string, unknown>
        : {};
}

function ActionFeedback({ state, idleMessage }: { state: ActionState; idleMessage: string }) {
    const hasMessage = state.message.length > 0;

    return (
        <p
            aria-live="polite"
            className={`text-[13px] font-medium ${hasMessage ? "" : "sr-only"} ${state.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}
        >
            {hasMessage ? (
                <span className="inline-flex items-start gap-1.5">
                    {state.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                    <span>{state.message}</span>
                </span>
            ) : (
                idleMessage
            )}
        </p>
    );
}

export function WorkflowRuleEditor({ rule, eventCatalog, workItemPresets, updatedLabel }: WorkflowRuleEditorProps) {
    const metadata = getRuleMetadata(rule);
    const isInstalledTemplate = typeof metadata.installed_template === "string";
    const [saveState, saveAction, isSaving] = useActionState(saveWorkflowRuleAction, initialState);
    const [enabledState, enabledAction, isToggling] = useActionState(setWorkflowRuleEnabledAction, initialState);

    return (
        <article className="grid gap-4 px-4 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[17px] font-semibold text-foreground">{rule.name}</h3>
                        <span className={`rounded-full border px-2.5 py-1 text-[12px] font-semibold uppercase tracking-[0.12em] ${rule.isEnabled ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>
                            {rule.isEnabled ? "Enabled" : "Disabled for review"}
                        </span>
                        {metadata.kill_switch === true ? (
                            <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-destructive">
                                Kill switch on
                            </span>
                        ) : null}
                    </div>
                    <p className="mt-1 font-mono text-[14px] text-muted-foreground">{rule.triggerKey}</p>
                    <p className="mt-1 text-[14px] text-muted-foreground">
                        {rule.requiresApproval ? "Requires approval" : "Direct execution"} · Updated {updatedLabel}
                    </p>
                </div>
                <form action={enabledAction} className="flex flex-col items-end gap-2">
                    <input type="hidden" name="ruleId" value={rule.id} />
                    <input type="hidden" name="isEnabled" value={rule.isEnabled ? "false" : "true"} />
                    <button
                        type="submit"
                        disabled={isToggling}
                        aria-busy={isToggling}
                        className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[14px] font-medium transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 ${rule.isEnabled ? "border border-border bg-background hover:bg-muted" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
                    >
                        {isToggling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : rule.isEnabled ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                        {isToggling ? "Saving…" : rule.isEnabled ? "Disable" : "Enable after review"}
                    </button>
                    <ActionFeedback state={enabledState} idleMessage="Enable/disable status will appear here." />
                </form>
            </div>

            {isInstalledTemplate ? (
                <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
                    <div className="flex flex-wrap gap-2 text-[13px]">
                        <span className="rounded-full border border-primary/20 bg-background/70 px-2.5 py-1 font-mono text-primary">
                            template:{String(metadata.installed_template)}
                        </span>
                        {typeof metadata.installed_trigger_key === "string" ? (
                            <span className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1 font-mono text-muted-foreground">
                                trigger:{metadata.installed_trigger_key}
                            </span>
                        ) : null}
                    </div>
                    <p className="mt-2 text-[13px] text-muted-foreground">
                        Installed templates start disabled for review. This metadata stays visible for traceability, but admins can edit the rule and enable it after reviewing the trigger, conditions, actions, approval gate, and kill switch.
                    </p>
                </div>
            ) : null}

            <form action={saveAction} className="grid gap-3 rounded-md border border-border/60 bg-background/45 p-3">
                <input type="hidden" name="ruleId" value={rule.id} />
                <div className="grid gap-3 lg:grid-cols-6">
                    <label className="grid min-w-0 gap-1 text-[14px] font-semibold text-muted-foreground lg:col-span-3">
                        Name
                        <input name="name" required defaultValue={rule.name} className="h-9 w-full min-w-0 rounded-md border border-border bg-background px-3 text-[16px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                    </label>
                    <label className="grid min-w-0 gap-1 text-[14px] font-semibold text-muted-foreground lg:col-span-3">
                        Trigger catalog
                        <select name="triggerKey" required defaultValue={rule.triggerKey} className="h-9 w-full min-w-0 rounded-md border border-border bg-background px-3 text-[14px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                            {eventCatalog.map((event) => (
                                <option key={event.key} value={event.key}>{event.key} — {event.description}</option>
                            ))}
                        </select>
                    </label>
                    <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:col-span-6" aria-label="Workflow rule toggles">
                        <label className={workflowCheckboxLabelClass}>
                            <input name="isEnabled" type="checkbox" defaultChecked={rule.isEnabled} className={workflowCheckboxInputClass} />
                            <span className="min-w-0 break-words">Enabled</span>
                        </label>
                        <label className={workflowCheckboxLabelClass}>
                            <input name="requiresApproval" type="checkbox" defaultChecked={rule.requiresApproval} className={workflowCheckboxInputClass} />
                            <span className="min-w-0 break-words">Approval</span>
                        </label>
                    </div>
                    <WorkflowBuilder
                        initialConditionJson={rule.conditionJson}
                        initialActionJson={rule.actionJson}
                        workItemPresets={workItemPresets}
                    />
                    <label className={`${workflowCheckboxLabelClass} lg:col-span-6`}>
                        <input name="killSwitch" type="checkbox" defaultChecked={metadata.kill_switch === true} className={workflowCheckboxInputClass} />
                        <span className="min-w-0 break-words">Kill switch</span>
                    </label>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
                    <ActionFeedback state={saveState} idleMessage="Workflow update status will appear here." />
                    <button type="submit" disabled={isSaving} aria-busy={isSaving} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-[14px] font-medium hover:bg-muted cursor-pointer disabled:cursor-not-allowed disabled:opacity-70">
                        {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        {isSaving ? "Updating…" : "Update rule"}
                    </button>
                </div>
            </form>
        </article>
    );
}
