"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Sparkles, UploadCloud, Receipt, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
    deleteAccountingEntry,
    importAccountingEntriesCsv,
    upsertAccountingEntry,
} from "@/features/legal-vault/actions/bookkeeping";
import {
    BTW_REDUCED_BP,
    BTW_STANDARD_BP,
    BTW_ZERO_BP,
    formatEuro,
    summarizeBtwQuarter,
} from "@/features/legal-vault/lib/btw";
import type {
    AccountingEntry,
    AccountingPeriod,
} from "@/features/legal-vault/types";
import {
    DashboardAppWorkbench,
    AppCommandBar,
    AppMetricStrip,
    AppMetric,
    AppTabList,
    AppQueueTable,
    AppStatusBanner,
    AppSectionHeader
} from "@/features/admin/ui/app-workbench";

interface BookkeepingLedgerProps {
    initialEntries: AccountingEntry[];
    initialError: string | null;
    quarters: AccountingPeriod[];
}

export function BookkeepingLedger({ initialEntries, initialError, quarters }: BookkeepingLedgerProps) {
    const [entries, setEntries] = useState<AccountingEntry[]>(initialEntries);
    const [error, setError] = useState<string | null>(initialError);
    const [activeQuarterId, setActiveQuarterId] = useState<string | "all">("all");
    const [showForm, setShowForm] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [narrative, setNarrative] = useState<string | null>(null);
    const [narrativePending, startNarrative] = useTransition();

    const visibleEntries = useMemo(() => {
        if (activeQuarterId === "all") return entries;
        return entries.filter((e) => e.periodId === activeQuarterId);
    }, [entries, activeQuarterId]);

    const totals = useMemo(() => summarizeBtwQuarter(visibleEntries), [visibleEntries]);

    function handleCreated(entry: AccountingEntry) {
        setEntries((prev) => [entry, ...prev]);
        setShowForm(false);
    }

    async function handleDelete(id: string) {
        if (!window.confirm("Delete this entry? Period must still be open.")) return;
        const result = await deleteAccountingEntry(id);
        if (!result.success) {
            setError(result.error);
            return;
        }
        setEntries((prev) => prev.filter((e) => e.id !== id));
    }

    function fetchNarrative() {
        if (activeQuarterId === "all") {
            setError("Select a specific BTW quarter to generate a narrative.");
            return;
        }
        setError(null);
        startNarrative(async () => {
            const response = await fetch("/api/legal/btw-summary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ periodId: activeQuarterId }),
            });
            const payload = await response.json().catch(() => null) as
                | { success: true; narrative: string }
                | { error: string }
                | null;
            if (!response.ok || !payload || "error" in payload) {
                setError(payload && "error" in payload ? payload.error : `HTTP ${response.status}`);
                return;
            }
            setNarrative(payload.narrative);
        });
    }

    const tabs = [
        { label: "Documents", value: "documents", href: "/dashboard/legal-vault" },
        { label: "Agreements", value: "agreements", href: "/dashboard/legal-vault/agreements" },
        { label: "Bookkeeping", value: "bookkeeping", href: "/dashboard/legal-vault/bookkeeping", active: true }
    ];

    const tableHeaders = (
        <tr className="border-b border-border/50 text-[13px]">
            <th className="px-3 py-2 w-20">Date</th>
            <th className="px-3 py-2">Description</th>
            <th className="px-3 py-2 w-28">Type &amp; BTW</th>
            <th className="px-3 py-2 w-28 text-right">Excl. BTW</th>
            <th className="px-3 py-2 w-28 text-right">Incl. BTW</th>
            <th className="px-3 py-2 w-16 text-right" />
        </tr>
    );

    return (
        <DashboardAppWorkbench>
            <AppCommandBar>
                <AppTabList tabs={tabs} />
                <div className="flex flex-wrap items-center gap-2">
                    <select
                        value={activeQuarterId}
                        onChange={(e) => setActiveQuarterId(e.target.value as typeof activeQuarterId)}
                        className="h-8 rounded-md border border-input bg-background px-2.5 py-1 text-[15px] select-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                        <option value="all">All entries</option>
                        {quarters.map((q) => (
                            <option key={q.id} value={q.id}>
                                {q.startsOn} → {q.endsOn}{q.closedAt ? " (closed)" : ""}
                            </option>
                        ))}
                    </select>
                    <Button size="xs" onClick={() => setShowForm((s) => !s)} className="cursor-pointer">
                        <Plus className="size-3" /> New Entry
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => setShowImport((s) => !s)} className="cursor-pointer">
                        <UploadCloud className="size-3" /> Import CSV
                    </Button>
                    <Button size="xs" variant="ghost" onClick={fetchNarrative} disabled={narrativePending || activeQuarterId === "all"} className="cursor-pointer">
                        <Sparkles className="size-3 text-cyan-500" /> {narrativePending ? "Generating…" : "AI Summary"}
                    </Button>
                </div>
            </AppCommandBar>

            <AppMetricStrip>
                <AppMetric label="Entries" value={totals.entry_count} icon={Receipt} />
                <AppMetric label="Income excl. BTW" value={formatEuro(totals.income_excl_btw_cents)} variant="success" />
                <AppMetric label="Expense excl. BTW" value={formatEuro(totals.expense_excl_btw_cents)} variant="warning" />
                <AppMetric label="BTW Collected" value={formatEuro(totals.income_btw_cents)} />
                <AppMetric
                    label="Net BTW to Pay"
                    value={formatEuro(totals.btw_to_pay_cents)}
                    variant={totals.btw_to_pay_cents > 0 ? "destructive" : "default"}
                    description="Owed to Belastingdienst"
                />
            </AppMetricStrip>

            <div className="flex-1 overflow-y-auto min-h-0">
                {narrative && (
                    <div className="mx-4 mt-3">
                        <AppStatusBanner variant="success">
                            <p className="font-semibold uppercase text-[12px] tracking-wide mb-1">BTW Aangifte Prep (AI Analysis)</p>
                            <p className="whitespace-pre-wrap leading-relaxed text-[14px]">{narrative}</p>
                        </AppStatusBanner>
                    </div>
                )}

                {error && (
                    <div className="mx-4 mt-3">
                        <AppStatusBanner variant="destructive">
                            {error}
                        </AppStatusBanner>
                    </div>
                )}

                {showForm && (
                    <div className="border-b border-border/60 bg-muted/20 px-4 py-3 shrink-0">
                        <EntryForm
                            onCancel={() => setShowForm(false)}
                            onCreated={handleCreated}
                            onError={setError}
                        />
                    </div>
                )}

                {showImport && (
                    <div className="border-b border-border/60 bg-muted/20 px-4 py-3 shrink-0">
                        <ImportPanel onClose={() => setShowImport(false)} onDone={(count) => {
                            setShowImport(false);
                            if (count > 0) window.location.reload();
                        }} onError={setError} />
                    </div>
                )}

                <div className="flex flex-col h-full min-h-0">
                    <div className="px-4 pt-3 flex-none">
                        <AppSectionHeader
                            title="Ledger Entries"
                            description="Belastingdienst-aligned bookkeeping records. Double-check values before finalizing quarterly declarations."
                        />
                    </div>
                    <AppQueueTable
                        headers={tableHeaders}
                        empty={visibleEntries.length === 0}
                        emptyText="No ledger records match this view. Add one or import a bank statement CSV."
                        mobileCards={visibleEntries.map((entry) => {
                            const isIncome = entry.direction === "income";
                            return (
                                <div key={entry.id} className="rounded-md border border-border/60 bg-card/45 p-3 text-[15px] shadow-3xs">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate font-semibold text-foreground">{entry.description}</p>
                                            <p className="mt-1 text-[13px] text-muted-foreground">
                                                {entry.occurredOn} · {entry.category}{entry.partyName ? ` · ${entry.partyName}` : ""}
                                            </p>
                                        </div>
                                        <Button size="xs" variant="ghost" onClick={() => handleDelete(entry.id)} className="h-7 w-7 shrink-0 p-0 hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer">
                                            ×
                                        </Button>
                                    </div>
                                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                        <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[13px] font-semibold uppercase ${
                                            isIncome ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                                        }`}>
                                            {isIncome ? <ArrowUpRight className="size-3" /> : <ArrowDownLeft className="size-3" />}
                                            {isIncome ? "Income" : "Expense"}
                                        </span>
                                        <span className="font-mono font-medium text-foreground">{formatEuro(entry.amountInclBtwCents)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    >
                        {visibleEntries.map((entry) => {
                            const isIncome = entry.direction === "income";
                            return (
                                <tr key={entry.id} className="border-b border-border/30 hover:bg-muted/30">
                                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground font-mono">
                                        {entry.occurredOn}
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <div className="font-medium text-foreground">{entry.description}</div>
                                        <div className="text-[13px] text-muted-foreground mt-0.5">
                                            {entry.category}{entry.partyName ? ` · ${entry.partyName}` : ""}{entry.invoiceNumber ? ` · ${entry.invoiceNumber}` : ""}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5 font-medium">
                                            {isIncome ? (
                                                <span className="inline-flex items-center gap-0.5 text-[13px] text-emerald-600 bg-emerald-500/10 px-1 rounded font-semibold uppercase">
                                                    <ArrowUpRight className="size-3" /> Income
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-0.5 text-[13px] text-amber-600 bg-amber-500/10 px-1 rounded font-semibold uppercase">
                                                    <ArrowDownLeft className="size-3" /> Expense
                                                </span>
                                            )}
                                            <span className="text-muted-foreground text-[13px]">
                                                {(entry.btwRateBp / 100).toFixed(0)}% BTW
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-mono font-medium text-foreground">
                                        {formatEuro(entry.amountExclBtwCents)}
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">
                                        {formatEuro(entry.amountInclBtwCents)}
                                    </td>
                                    <td className="px-3 py-2.5 text-right">
                                        <Button size="xs" variant="ghost" onClick={() => handleDelete(entry.id)} className="h-6 w-6 p-0 hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer">
                                            ×
                                        </Button>
                                    </td>
                                </tr>
                            );
                        })}
                    </AppQueueTable>
                </div>
            </div>
        </DashboardAppWorkbench>
    );
}

function EntryForm({
    onCancel,
    onCreated,
    onError,
}: {
    onCancel: () => void;
    onCreated: (entry: AccountingEntry) => void;
    onError: (msg: string) => void;
}) {
    const [isPending, startTransition] = useTransition();
    const [direction, setDirection] = useState<"income" | "expense">("income");
    const [amount, setAmount] = useState("");
    const [btwRateBp, setBtwRateBp] = useState<number>(BTW_STANDARD_BP);

    function submit(form: FormData) {
        const amountCents = Math.round(Number.parseFloat(form.get("amount") as string) * 100);
        if (!Number.isFinite(amountCents)) {
            onError("Amount must be a number.");
            return;
        }
        startTransition(async () => {
            const result = await upsertAccountingEntry({
                direction: form.get("direction"),
                category: form.get("category"),
                description: form.get("description"),
                invoiceNumber: form.get("invoiceNumber") || null,
                partyName: form.get("partyName") || null,
                amountExclBtwCents: amountCents,
                btwRateBp: Number.parseInt(form.get("btwRateBp") as string, 10),
                occurredOn: form.get("occurredOn"),
                currency: "EUR",
            });
            if (!result.success) {
                onError(result.error);
                return;
            }
            onCreated(result.data);
        });
    }

    return (
        <form action={submit} className="grid grid-cols-1 gap-3 md:grid-cols-6 text-[15px]">
            <div>
                <label className="block text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Date</label>
                <Input type="date" name="occurredOn" required defaultValue={new Date().toISOString().slice(0, 10)} className="h-8 text-[15px] cursor-pointer" />
            </div>
            <div>
                <label className="block text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Direction</label>
                <select
                    name="direction"
                    value={direction}
                    onChange={(e) => setDirection(e.target.value as "income" | "expense")}
                    className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-[15px] select-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
                >
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                </select>
            </div>
            <div>
                <label className="block text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Category</label>
                <Input name="category" required placeholder="services / hosting / travel" className="h-8 text-[15px]" />
            </div>
            <div className="md:col-span-3">
                <label className="block text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Description</label>
                <Input name="description" required maxLength={500} className="h-8 text-[15px]" />
            </div>
            <div>
                <label className="block text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Invoice #</label>
                <Input name="invoiceNumber" maxLength={40} className="h-8 text-[15px]" />
            </div>
            <div>
                <label className="block text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Party</label>
                <Input name="partyName" maxLength={160} className="h-8 text-[15px]" />
            </div>
            <div>
                <label className="block text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Amount excl. BTW</label>
                <Input
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="h-8 text-[15px]"
                />
            </div>
            <div>
                <label className="block text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">BTW rate</label>
                <select
                    name="btwRateBp"
                    value={btwRateBp}
                    onChange={(e) => setBtwRateBp(Number.parseInt(e.target.value, 10))}
                    className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-[15px] select-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
                >
                    <option value={BTW_STANDARD_BP}>21 %</option>
                    <option value={BTW_REDUCED_BP}>9 %</option>
                    <option value={BTW_ZERO_BP}>0 % / verlegd</option>
                </select>
            </div>
            <div className="md:col-span-6 flex justify-end gap-1.5 pt-1">
                <Button type="button" size="xs" variant="ghost" onClick={onCancel} disabled={isPending} className="cursor-pointer">Cancel</Button>
                <Button type="submit" size="xs" disabled={isPending} className="cursor-pointer">{isPending ? "Saving…" : "Save Entry"}</Button>
            </div>
        </form>
    );
}

function ImportPanel({
    onClose,
    onDone,
    onError,
}: {
    onClose: () => void;
    onDone: (insertedCount: number) => void;
    onError: (msg: string) => void;
}) {
    const [isPending, startTransition] = useTransition();
    const [report, setReport] = useState<{ inserted: number; errors: string[] } | null>(null);

    function submit(form: FormData) {
        startTransition(async () => {
            const result = await importAccountingEntriesCsv(form);
            if (!result.success) {
                onError(result.error);
                return;
            }
            setReport(result.data);
            if (result.data.errors.length === 0) {
                onDone(result.data.inserted);
            }
        });
    }

    return (
        <div className="space-y-3 text-[15px]">
            <p className="text-muted-foreground text-[13px]">
                CSV columns: <code>occurred_on, direction, category, description, invoice_number, party_name, party_vat, amount_excl_btw, btw_rate_bp, currency</code>.
            </p>
            <form action={submit} className="flex items-center gap-2">
                <Input type="file" name="file" accept=".csv" required className="h-8 text-[15px] cursor-pointer file:cursor-pointer" />
                <Button type="submit" size="xs" disabled={isPending} className="cursor-pointer">{isPending ? "Importing…" : "Import"}</Button>
                <Button type="button" size="xs" variant="ghost" onClick={onClose} className="cursor-pointer">Cancel</Button>
            </form>
            {report ? (
                <div className="rounded-md border border-border/50 bg-card p-3 text-[14px]">
                    <p className="font-semibold">Import Complete: Inserted {report.inserted} row(s).</p>
                    {report.errors.length > 0 ? (
                        <details className="mt-2">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                {report.errors.length} skipped errors (click to expand)
                            </summary>
                            <pre className="mt-1.5 max-h-40 overflow-auto text-[13px] bg-muted/40 p-2 rounded leading-relaxed font-mono">{report.errors.join("\n")}</pre>
                        </details>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
