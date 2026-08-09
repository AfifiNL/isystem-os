"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Trash2, TrendingUp, Wallet, Clock, Loader2, BadgeCheck } from "lucide-react";
import { runRoiCalculator } from "./actions";
import type { RoiInput, RoiResult, RoiTask } from "./compute";
import { EmailGate } from "../shared/ui/EmailGate";
import { ToolUnlockModal } from "../shared/ui/ToolUnlockModal";
import { useToolUnlock } from "../shared/use-tool-unlock";
import { HoneypotField, useFormStartedAt } from "../shared/ui/anti-abuse-fields";
import { getToolClientStrings } from "../shared/client-i18n";
import { getToolsChrome } from "../shared/i18n";
import type { ToolLocale } from "../shared/types";
import {
    ToolField,
    ToolInput,
    ToolPanel,
    ToolPrimaryButton,
    ToolPrintSummary,
    ToolRange,
    ToolResultCallout,
    ToolStatTile,
} from "../shared/ui/primitives";

const EMPTY_TASK: RoiTask = { name: "", hoursPerWeek: 0, hourlyCostEur: 40, errorReworkPercent: 10 };

function fmt(n: number): string {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n));
}

export function RoiCalculatorClient({ locale }: { locale: ToolLocale }) {
    const t = getToolClientStrings(locale);
    const chrome = getToolsChrome(locale).stat;
    const [tasks, setTasks] = useState<RoiTask[]>([
        { name: "Manual lead intake & qualification", hoursPerWeek: 6, hourlyCostEur: 45, errorReworkPercent: 15 },
        { name: "Invoice chasing", hoursPerWeek: 3, hourlyCostEur: 35, errorReworkPercent: 5 },
    ]);
    const [monthlyToolingCostEur, setMonthlyToolingCostEur] = useState(80);
    const [implementationCostEur, setImplementationCostEur] = useState(5000);
    const [coverage, setCoverage] = useState(70);
    const [result, setResult] = useState<RoiResult | null>(null);
    const [leadId, setLeadId] = useState<string | null>(null);
    const [shareToken, setShareToken] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const [honeypot, setHoneypot] = useState("");
    const formStartedAt = useFormStartedAt();

    function updateTask(idx: number, patch: Partial<RoiTask>) {
        setTasks((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
    }
    function addTask() {
        if (tasks.length >= 8) return;
        setTasks([...tasks, { ...EMPTY_TASK, name: `Task ${tasks.length + 1}` }]);
    }
    function removeTask(idx: number) {
        if (tasks.length <= 1) return;
        setTasks(tasks.filter((_, i) => i !== idx));
    }

    const unlock = useToolUnlock(runRoiCalculator);

    function processResult(res: Awaited<ReturnType<typeof runRoiCalculator>>) {
        if (!res.ok || !res.data) {
            if (!res.requiresSubscription) setError(res.error ?? "Could not compute.");
            return;
        }
        setError(null);
        setResult(res.data.result);
        setLeadId(res.data.leadId);
        setShareToken(res.data.shareToken);
        window.scrollTo({ top: window.scrollY + 200, behavior: "smooth" });
    }

    useEffect(() => unlock.onResult(processResult), [unlock]);

    function submit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        const payload: RoiInput = {
            tasks: tasks.filter((t) => t.name.trim().length > 0 && t.hoursPerWeek > 0),
            monthlyToolingCostEur,
            implementationCostEur,
            automationCoveragePercent: coverage,
            website: honeypot,
            formStartedAt,
        };
        if (payload.tasks.length === 0) {
            setError("Add at least one task with hours > 0.");
            return;
        }
        startTransition(async () => {
            const res = await unlock.run(payload);
            processResult(res);
        });
    }

    const shareUrl = shareToken && typeof window !== "undefined" ? `${window.location.origin}/tools/share/${shareToken}` : undefined;

    return (
        <>
            <ToolUnlockModal
                open={unlock.modalOpen}
                tool="automation-roi-calculator"
                toolName="Automation ROI Calculator"
                locale={locale}
                onClose={unlock.closeModal}
                onUnlocked={unlock.retryAfterUnlock}
            />
        <div className="space-y-6">
            <ToolPanel hideOnPrint>
                <form onSubmit={submit} className="relative space-y-6">
                    <HoneypotField value={honeypot} onChange={setHoneypot} />
                    <fieldset className="space-y-3">
                        <legend className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Repetitive tasks</legend>
                        {tasks.map((task, idx) => (
                            <div key={idx} className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 sm:grid-cols-12">
                                <div className="sm:col-span-5">
                                    <ToolField label="Task name">
                                        <ToolInput
                                            type="text"
                                            value={task.name}
                                            maxLength={80}
                                            onChange={(e) => updateTask(idx, { name: e.target.value })}
                                        />
                                    </ToolField>
                                </div>
                                <div className="sm:col-span-2">
                                    <ToolField label="h / wk">
                                        <ToolInput
                                            type="number"
                                            min={0}
                                            max={200}
                                            value={task.hoursPerWeek}
                                            onChange={(e) => updateTask(idx, { hoursPerWeek: Number(e.target.value) })}
                                        />
                                    </ToolField>
                                </div>
                                <div className="sm:col-span-2">
                                    <ToolField label="€ / h">
                                        <ToolInput
                                            type="number"
                                            min={5}
                                            max={500}
                                            value={task.hourlyCostEur}
                                            onChange={(e) => updateTask(idx, { hourlyCostEur: Number(e.target.value) })}
                                        />
                                    </ToolField>
                                </div>
                                <div className="sm:col-span-2">
                                    <ToolField label="Rework %">
                                        <ToolInput
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={task.errorReworkPercent}
                                            onChange={(e) => updateTask(idx, { errorReworkPercent: Number(e.target.value) })}
                                        />
                                    </ToolField>
                                </div>
                                <div className="flex items-end sm:col-span-1">
                                    <button
                                        type="button"
                                        onClick={() => removeTask(idx)}
                                        aria-label="Remove task"
                                        className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-300 hover:border-rose-400/40 hover:bg-rose-400/10 hover:text-rose-200 disabled:opacity-40"
                                        disabled={tasks.length <= 1}
                                    >
                                        <Trash2 className="size-4" aria-hidden />
                                    </button>
                                </div>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={addTask}
                            disabled={tasks.length >= 8}
                            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-dashed border-cyan-400/40 bg-cyan-400/5 px-4 text-sm font-medium text-cyan-200 hover:bg-cyan-400/10 disabled:opacity-40"
                        >
                            <Plus className="size-4" aria-hidden /> Add task
                        </button>
                    </fieldset>

                    <div className="grid gap-4 sm:grid-cols-3">
                        <ToolField label="Tooling cost (€/month)">
                            <ToolInput
                                type="number"
                                min={0}
                                max={20000}
                                value={monthlyToolingCostEur}
                                onChange={(e) => setMonthlyToolingCostEur(Number(e.target.value))}
                            />
                        </ToolField>
                        <ToolField label="Implementation (€)">
                            <ToolInput
                                type="number"
                                min={0}
                                max={500000}
                                value={implementationCostEur}
                                onChange={(e) => setImplementationCostEur(Number(e.target.value))}
                            />
                        </ToolField>
                        <ToolRange
                            label="Automation coverage"
                            value={coverage}
                            min={10}
                            max={95}
                            step={5}
                            suffix="%"
                            onChange={setCoverage}
                        />
                    </div>

                    {error ? (
                        <p role="alert" className="rounded-xl border border-rose-400/40 bg-rose-400/10 p-3 text-sm text-rose-200">
                            {error}
                        </p>
                    ) : null}

                    <ToolPrimaryButton
                        type="submit"
                        disabled={pending}
                        iconLeft={pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                    >
                        {pending ? t.calculating : t.calculate}
                    </ToolPrimaryButton>
                </form>
            </ToolPanel>

            {result ? (
                <>
                    <ToolResultCallout eyebrow="Business case" headline="Here's what automation is worth.">
                        <div className="grid gap-4 sm:grid-cols-4">
                            <ToolStatTile label={chrome.monthlyWaste} value={`€${fmt(result.monthlyWastedCostEur)}`} accent="cyan" />
                            <ToolStatTile label={chrome.yearlySavings} value={`€${fmt(result.yearlyAutomatedSavingsEur)}`} accent="violet" />
                            <ToolStatTile label={chrome.netYearOne} value={`€${fmt(result.netYearlySavingsEur)}`} accent="cyan" />
                            <ToolStatTile label={chrome.payback} value={result.paybackMonths !== null ? `${result.paybackMonths}m` : "—"} accent="neutral" />
                        </div>
                    </ToolResultCallout>

                    <ToolPanel>
                        <h2 className="text-lg font-semibold text-white print:text-slate-900">Per-task breakdown</h2>
                        <div className="mt-4 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-400 print:text-slate-700">
                                    <tr>
                                        <th className="py-2 font-medium">Task</th>
                                        <th className="py-2 text-right font-medium">h / mo</th>
                                        <th className="py-2 text-right font-medium">€ / mo wasted</th>
                                        <th className="py-2 text-right font-medium">€ / year if automated</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-slate-200 print:divide-slate-200 print:text-slate-900">
                                    {result.tasks.map((task, i) => (
                                        <tr key={i}>
                                            <td className="py-2.5">{task.name}</td>
                                            <td className="py-2.5 text-right">{fmt(task.monthlyHours)}</td>
                                            <td className="py-2.5 text-right">€{fmt(task.monthlyWastedCostEur)}</td>
                                            <td className="py-2.5 text-right font-semibold text-cyan-300 print:text-slate-900">
                                                €{fmt(task.yearlyAutomatedSavingsEur)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-slate-300 print:border-slate-300 print:bg-slate-50 print:text-slate-900">
                            <BadgeCheck className="mr-1 inline-block size-4 text-cyan-300 print:text-slate-700" aria-hidden />
                            Recommended level: <strong className="capitalize text-white print:text-slate-900">{result.automationLevel}</strong>.{" "}
                            {result.paybackMonths !== null
                                ? `Implementation pays back in ~${result.paybackMonths} months at ${coverage}% coverage.`
                                : "Your tooling cost exceeds projected savings — start with a single high-impact task and re-run."}
                        </p>
                    </ToolPanel>

                    <EmailGate leadId={leadId} locale={locale} shareUrl={shareUrl} headline={getToolsChrome(locale).emailGate.eyebrowAlt} />

                    <ToolPrintSummary title="Automation ROI · iSystem.ai">
                        <p>
                            <Wallet className="mr-1 inline-block size-3.5" aria-hidden /> Monthly waste:{" "}
                            <strong>€{fmt(result.monthlyWastedCostEur)}</strong>.{" "}
                            <TrendingUp className="mx-1 inline-block size-3.5" aria-hidden /> Yearly savings:{" "}
                            <strong>€{fmt(result.yearlyAutomatedSavingsEur)}</strong>.{" "}
                            <Clock className="mx-1 inline-block size-3.5" aria-hidden /> Payback:{" "}
                            {result.paybackMonths !== null ? `${result.paybackMonths} months` : "—"}.
                        </p>
                    </ToolPrintSummary>
                </>
            ) : null}
        </div>
        </>
    );
}
