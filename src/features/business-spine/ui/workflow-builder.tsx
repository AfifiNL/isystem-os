"use client";

import React, { useMemo, useRef, useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";

type Condition = {
    field: string;
    operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than";
    value: string;
};

type Action = {
    type: "create_work_item" | "send_templated_email" | "request_approval";
    [key: string]: string | undefined;
};

const WORK_ITEM_PRESETS = [
    { label: "Task", title: "Review signal", kind: "task", priority: "normal", description: "Review the workflow signal and decide the next operator action." },
    { label: "Inbound lead", title: "Review new contact submission", kind: "inbound_lead_review", priority: "high", description: "Review intent, owner, and response plan for this inbound lead." },
    { label: "Payment recovery", title: "Review failed payment", kind: "payment_recovery", priority: "urgent", description: "Review provider evidence, customer impact, and recovery next step." },
    { label: "Operations handoff", title: "Confirm delivery handoff", kind: "booking_handoff", priority: "normal", description: "Confirm owner, timeline, and customer expectations for delivery." },
] as const;

export type WorkflowBuilderWorkItemPreset = {
    label: string;
    triggerKey?: string;
    title: string;
    kind: string;
    priority: "low" | "normal" | "high" | "urgent";
    description: string;
};

export function WorkflowBuilder({
    initialConditionJson,
    initialActionJson,
    workItemPresets = [],
}: {
    initialConditionJson?: unknown;
    initialActionJson?: unknown;
    workItemPresets?: WorkflowBuilderWorkItemPreset[];
}) {
    const rootRef = useRef<HTMLDivElement>(null);
    const [selectedTriggerKey, setSelectedTriggerKey] = useState("");
    const [conditions, setConditions] = useState<Condition[]>(() => {
        try {
            const parsed = typeof initialConditionJson === "string" ? JSON.parse(initialConditionJson) : initialConditionJson;
            if (Array.isArray(parsed?.all)) {
                return parsed.all.map((c: Record<string, string>) => ({
                    field: c.fact || "",
                    operator: c.operator || "equals",
                    value: c.value || ""
                }));
            }
            return [];
        } catch {
            return [];
        }
    });

    const [actions, setActions] = useState<Action[]>(() => {
        try {
            const parsed = typeof initialActionJson === "string" ? JSON.parse(initialActionJson) : initialActionJson;
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    });

    const [showAdvanced, setShowAdvanced] = useState(false);
    const [rawCondition, setRawCondition] = useState(() => JSON.stringify(initialConditionJson || {}, null, 2));
    const [rawAction, setRawAction] = useState(() => JSON.stringify(initialActionJson || [], null, 2));

    React.useEffect(() => {
        const form = rootRef.current?.closest("form") ?? null;
        const select = form?.querySelector<HTMLSelectElement>('select[name="triggerKey"]');
        const hidden = form?.querySelector<HTMLInputElement>('input[name="triggerKey"]');
        const readTriggerKey = () => setSelectedTriggerKey(select?.value || hidden?.value || "");

        readTriggerKey();
        select?.addEventListener("change", readTriggerKey);
        return () => select?.removeEventListener("change", readTriggerKey);
    }, []);

    const presetOptions = useMemo(() => {
        const customPresets = workItemPresets.map((preset) => ({ ...preset, source: "template" as const }));
        const fallbackPresets = WORK_ITEM_PRESETS.map((preset) => ({ ...preset, triggerKey: undefined, source: "fallback" as const }));
        const matching = selectedTriggerKey ? customPresets.filter((preset) => preset.triggerKey === selectedTriggerKey) : [];
        const otherCatalog = selectedTriggerKey ? customPresets.filter((preset) => preset.triggerKey !== selectedTriggerKey) : customPresets;
        return [...matching, ...fallbackPresets, ...otherCatalog];
    }, [selectedTriggerKey, workItemPresets]);

    // Update raw JSON when builder changes
    React.useEffect(() => {
        if (!showAdvanced) {
            const newCondition = conditions.length > 0 ? { all: conditions.map(c => ({ fact: c.field, operator: c.operator, value: c.value })) } : {};
            setRawCondition(JSON.stringify(newCondition, null, 2));
            setRawAction(JSON.stringify(actions, null, 2));
        }
    }, [conditions, actions, showAdvanced]);

    const addCondition = () => setConditions([...conditions, { field: "", operator: "equals", value: "" }]);
    const removeCondition = (i: number) => setConditions(conditions.filter((_, idx) => idx !== i));
    const updateCondition = (i: number, key: keyof Condition, val: string) => {
        const newC = [...conditions];
        newC[i] = { ...newC[i], [key]: val };
        setConditions(newC);
    };

    const addAction = (type: Action["type"]) => {
        if (type === "create_work_item") setActions([...actions, { type, title: "Review signal", kind: "task", priority: "normal", description: "Review the workflow signal and decide the next operator action." }]);
        if (type === "request_approval") setActions([...actions, { type, title: "Review Request" }]);
        if (type === "send_templated_email") setActions([...actions, { type, templateKey: "", toEmailPath: "" }]);
    };
    const removeAction = (i: number) => setActions(actions.filter((_, idx) => idx !== i));
    const updateAction = (i: number, key: string, val: string) => {
        const newA = [...actions];
        newA[i] = { ...newA[i], [key]: val };
        setActions(newA);
    };

    const applyWorkItemPreset = (i: number, presetIndex: string) => {
        const preset = presetOptions[Number(presetIndex)];
        if (!preset) return;
        const newA = [...actions];
        newA[i] = {
            ...newA[i],
            type: "create_work_item",
            title: preset.title,
            kind: preset.kind,
            priority: preset.priority,
            description: preset.description,
        };
        setActions(newA);
    };

    return (
        <div ref={rootRef} className="grid gap-4 lg:col-span-6 w-full">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] text-muted-foreground">
                    Save validates trigger, condition JSON, and action JSON before persisting. Raw JSON stays available for advanced operators.
                </p>
                <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="text-[13px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                    {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {showAdvanced ? "Hide Advanced Editor" : "Show Advanced Editor"}
                </button>
            </div>

            {showAdvanced ? (
                <>
                    <label className="grid gap-1 text-[14px] font-semibold text-muted-foreground">
                        Condition JSON (advanced/internal)
                        <textarea
                            name="conditionJson"
                            value={rawCondition}
                            onChange={e => setRawCondition(e.target.value)}
                            rows={6}
                            className="rounded-md border border-border bg-background px-3 py-2 font-mono text-[14px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-full"
                        />
                    </label>
                    <label className="grid gap-1 text-[14px] font-semibold text-muted-foreground">
                        Action JSON (advanced/internal)
                        <textarea
                            name="actionJson"
                            value={rawAction}
                            onChange={e => setRawAction(e.target.value)}
                            rows={6}
                            className="rounded-md border border-border bg-background px-3 py-2 font-mono text-[14px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-full"
                        />
                    </label>
                </>
            ) : (
                <>
                    <input type="hidden" name="conditionJson" value={rawCondition} />
                    <input type="hidden" name="actionJson" value={rawAction} />

                    <div className="rounded-md border border-border/60 bg-card/40 p-4">
                        <h3 className="text-[15px] font-semibold text-foreground mb-3">Conditions (All must match)</h3>
                        <div className="grid gap-2 mb-3">
                            {conditions.map((cond, i) => (
                                <div key={i} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                                    <input placeholder="Field (e.g. sourceModule)" value={cond.field} onChange={e => updateCondition(i, "field", e.target.value)} className="h-9 w-full sm:w-[35%] rounded-md border border-input bg-background px-3 text-[14px] text-foreground" />
                                    <select value={cond.operator} onChange={e => updateCondition(i, "operator", e.target.value)} className="h-9 w-full sm:w-[25%] rounded-md border border-input bg-background px-3 text-[14px] text-foreground">
                                        <option value="equals">Equals</option>
                                        <option value="not_equals">Not Equals</option>
                                        <option value="contains">Contains</option>
                                    </select>
                                    <input placeholder="Value" value={cond.value} onChange={e => updateCondition(i, "value", e.target.value)} className="h-9 w-full sm:w-[35%] rounded-md border border-input bg-background px-3 text-[14px] text-foreground" />
                                    <button type="button" onClick={() => removeCondition(i)} className="p-2 hover:bg-destructive/10 text-destructive rounded-md"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            ))}
                            {conditions.length === 0 && <p className="text-[13px] text-muted-foreground italic">Always run (no conditions)</p>}
                        </div>
                        <button type="button" onClick={addCondition} className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:text-primary/80">
                            <Plus className="w-3.5 h-3.5" /> Add Condition
                        </button>
                    </div>

                    <div className="rounded-md border border-border/60 bg-card/40 p-4">
                        <h3 className="text-[15px] font-semibold text-foreground mb-3">Actions</h3>
                        <div className="grid gap-3 mb-3">
                            {actions.map((act, i) => (
                                <div key={i} className="flex flex-col sm:flex-row gap-3 rounded-md border border-border bg-background/50 p-3 relative">
                                    <button type="button" onClick={() => removeAction(i)} className="absolute top-2 right-2 p-1.5 hover:bg-destructive/10 text-destructive rounded-md"><Trash2 className="w-4 h-4" /></button>
                                    <div className="w-full sm:w-1/3">
                                        <span className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Type</span>
                                        <p className="text-[14px] font-medium text-foreground capitalize">{act.type.replace(/_/g, " ")}</p>
                                    </div>
                                    <div className="w-full sm:w-2/3 grid gap-2">
                                         {act.type === "create_work_item" && (
                                              <>
                                                {selectedTriggerKey && presetOptions.some((preset) => preset.triggerKey === selectedTriggerKey) ? (
                                                    <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-[13px] text-primary">
                                                        Suggested presets are prioritized for <span className="font-mono">{selectedTriggerKey}</span>.
                                                    </p>
                                                ) : null}
                                                 <select defaultValue="" onChange={e => applyWorkItemPreset(i, e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-[14px]">
                                                     <option value="" disabled>Apply create_work_item preset</option>
                                                     {presetOptions.map((preset, presetIndex) => (
                                                         <option key={`${preset.source}-${preset.label}-${preset.triggerKey ?? "default"}`} value={presetIndex}>
                                                            {preset.triggerKey === selectedTriggerKey ? "Suggested: " : ""}{preset.label}
                                                         </option>
                                                     ))}
                                                 </select>
                                                 <input placeholder="Task Title" value={act.title || ""} onChange={e => updateAction(i, "title", e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-[14px]" />
                                                 <div className="flex gap-2">
                                                     <select value={act.kind || "task"} onChange={e => updateAction(i, "kind", e.target.value)} className="h-9 w-1/2 rounded-md border border-input bg-background px-3 text-[14px]">
                                                         <option value="task">Task</option>
                                                         <option value="issue">Issue</option>
                                                         <option value="review">Review</option>
                                                         <option value="inbound_lead_review">Inbound Lead</option>
                                                         <option value="payment_recovery">Payment Recovery</option>
                                                         <option value="booking_handoff">Booking Handoff</option>
                                                     </select>
                                                     <select value={act.priority || "normal"} onChange={e => updateAction(i, "priority", e.target.value)} className="h-9 w-1/2 rounded-md border border-input bg-background px-3 text-[14px]">
                                                         <option value="low">Low</option>
                                                        <option value="normal">Normal</option>
                                                        <option value="high">High</option>
                                                        <option value="urgent">Urgent</option>
                                                     </select>
                                                 </div>
                                                 <textarea placeholder="Description" value={act.description || ""} onChange={e => updateAction(i, "description", e.target.value)} rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-[14px]" />
                                             </>
                                         )}
                                        {act.type === "request_approval" && (
                                            <input placeholder="Approval Request Title" value={act.title || ""} onChange={e => updateAction(i, "title", e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-[14px]" />
                                        )}
                                        {act.type === "send_templated_email" && (
                                            <>
                                                <input placeholder="Template Key (e.g. welcome_email)" value={act.templateKey || ""} onChange={e => updateAction(i, "templateKey", e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-[14px]" />
                                                <input placeholder="To Email Path (e.g. data.customerEmail)" value={act.toEmailPath || ""} onChange={e => updateAction(i, "toEmailPath", e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-[14px]" />
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {actions.length === 0 && <p className="text-[13px] text-muted-foreground italic">No actions added.</p>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => addAction("create_work_item")} className="inline-flex items-center gap-1 text-[13px] font-medium text-primary border border-primary/20 bg-primary/5 hover:bg-primary/10 rounded-md px-2.5 py-1">
                                <Plus className="w-3.5 h-3.5" /> Work Item
                            </button>
                            <button type="button" onClick={() => addAction("request_approval")} className="inline-flex items-center gap-1 text-[13px] font-medium text-primary border border-primary/20 bg-primary/5 hover:bg-primary/10 rounded-md px-2.5 py-1">
                                <Plus className="w-3.5 h-3.5" /> Approval
                            </button>
                            <button type="button" onClick={() => addAction("send_templated_email")} className="inline-flex items-center gap-1 text-[13px] font-medium text-primary border border-primary/20 bg-primary/5 hover:bg-primary/10 rounded-md px-2.5 py-1">
                                <Plus className="w-3.5 h-3.5" /> Email
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
