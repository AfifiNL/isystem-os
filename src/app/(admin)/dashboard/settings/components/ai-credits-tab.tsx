"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Zap, Plus, RefreshCw, AlertTriangle, Star, Check } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { topUpWorkspaceAiCredits } from "@/features/admin/actions/ai-balance";
import type { AiCreditLedgerEntry } from "@/features/admin/actions/ai-balance";
import type { DashboardRole } from "@/features/admin/lib/dashboard-state";
import {
    BACKGROUND_AI_SERVICES,
    INTERACTIVE_AI_SERVICES,
    AI_SERVICE_OPTIONS,
    getAiServiceOption,
    type AiService
} from "@/shared/lib/ai/models";
import { getWorkspaceAiConfigs, updateWorkspaceAiConfigs } from "@/features/admin/actions/ai-configs";

const SERVICE_LABELS: Record<AiService, string> = {
    copywriting: "Copywriting & Generation",
    reasoning: "Reasoning & Strategy",
    structuring: "Structuring & Metadata",
    legal: "Legal & Bookkeeping",
    transcription: "Audio Transcription",
    seo_automation: "SEO Automation",
    translation_localization: "Translation & Localization",
};

const SERVICE_DESCRIPTIONS: Record<AiService, string> = {
    copywriting: "High coherence marketing copy and drafts.",
    reasoning: "Complex SEO reasoning, reviews, and judge logic.",
    structuring: "JSON/schema metadata extraction and formatting.",
    legal: "Compliance drafting, zero-hallucination policies.",
    transcription: "Speech processing and transcription summaries.",
    seo_automation: "Background internal linking, metadata, audits, and retryable optimization jobs.",
    translation_localization: "Background localization, locale expansion, and multilingual copy adaptation.",
};

const BACKGROUND_POLICY_PLACEHOLDERS = [
    { label: "Scheduling policy", value: "Pending worker rollout" },
    { label: "Credit guardrails", value: "Use workspace AI balance floor" },
    { label: "Review policy", value: "Human review controls not configured yet" },
] as const;

interface AiCreditsTabProps {
    workspace: { id: string; name: string };
    role: DashboardRole;
    balanceMillicents: number;
    floorMillicents: number;
    ledger: AiCreditLedgerEntry[];
}

function formatEuros(millicents: number): string {
    return `€${(millicents / 10_000).toFixed(2)}`;
}

export function AiCreditsTab({ workspace, role, balanceMillicents, floorMillicents, ledger }: AiCreditsTabProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [amountEuros, setAmountEuros] = useState("10");
    const [notes, setNotes] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [configs, setConfigs] = useState<Record<string, string>>({});
    const [loadingConfigs, setLoadingConfigs] = useState(true);
    const [isPendingConfigs, startTransitionConfigs] = useTransition();
    const [configError, setConfigError] = useState<string | null>(null);
    const [configSuccess, setConfigSuccess] = useState<string | null>(null);

    useEffect(() => {
        getWorkspaceAiConfigs(workspace.id).then((res) => {
            if (res.configs) {
                setConfigs(res.configs);
            }
            setLoadingConfigs(false);
        });
    }, [workspace.id]);

    const handleModelChange = (service: AiService, modelId: string) => {
        setConfigs((prev) => ({ ...prev, [service]: modelId }));
    };

    const handleSaveConfigs = () => {
        setConfigError(null);
        setConfigSuccess(null);
        startTransitionConfigs(async () => {
            const res = await updateWorkspaceAiConfigs(workspace.id, configs);
            if (res.error) {
                setConfigError(res.error);
                return;
            }
            setConfigSuccess("AI model configurations updated successfully!");
            setTimeout(() => setConfigSuccess(null), 3000);
            router.refresh();
        });
    };

    const status = balanceMillicents < floorMillicents ? "blocked" : balanceMillicents < floorMillicents * 5 ? "low" : "ok";

    const renderServiceCard = (service: AiService) => {
        const currentModelId = getAiServiceOption(service, configs[service]).id;
        const options = AI_SERVICE_OPTIONS[service];
        const selectedOption = options.find((opt) => opt.id === currentModelId) ?? options[0];

        return (
            <div key={service} className="relative group rounded-md border border-border/60 bg-background/30 p-4 transition-all duration-300 hover:border-primary/30 hover:bg-background/40 animate-in fade-in duration-300">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <h4 className="text-[17px] font-semibold tracking-tight">
                            {SERVICE_LABELS[service]}
                        </h4>
                        <p className="mt-1 text-[17px] text-muted-foreground line-clamp-2">
                            {SERVICE_DESCRIPTIONS[service]}
                        </p>
                    </div>
                    {selectedOption.transport !== "vertex-google-sdk" && (
                        <span className="shrink-0 text-[16px] font-medium bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5 capitalize">
                            {selectedOption.transport === "vertex-partner-anthropic" ? "Anthropic" : "Open Source"}
                        </span>
                    )}
                </div>

                <div className="mt-4 space-y-3">
                    <div>
                        <label className="text-[16px] uppercase tracking-wider text-muted-foreground block mb-1">Model Choice</label>
                        <select
                            value={currentModelId}
                            onChange={(e) => handleModelChange(service, e.target.value)}
                            className="w-full rounded-md border border-border/80 bg-background px-3 py-1.5 text-[15px] text-foreground transition-all focus:border-primary focus:outline-none"
                        >
                            {options.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                    {opt.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center justify-between text-[15px] pt-1 border-t border-border/40">
                        <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">Quality:</span>
                            <span className="font-semibold text-foreground">{selectedOption.quality}/10</span>
                            <div className="flex text-amber-500">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <Star
                                        key={i}
                                        className={`h-3 w-3 ${i < Math.round(selectedOption.quality / 2) ? "fill-current" : "opacity-30"}`}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">Cost:</span>
                            <span className="font-mono font-semibold text-foreground">
                                {"€".repeat(selectedOption.cost)}
                            </span>
                            <span className="text-[16px] text-muted-foreground">
                                ({selectedOption.cost === 1 ? "Ultra Low" : selectedOption.cost === 2 ? "Low" : selectedOption.cost === 3 ? "Medium" : "Premium"})
                            </span>
                        </div>
                    </div>

                    <p className="text-[17px] text-muted-foreground italic bg-muted/20 rounded p-1.5 border border-border/30">
                        {selectedOption.description}
                    </p>
                </div>
            </div>
        );
    };

    const backgroundSelections = BACKGROUND_AI_SERVICES.map((service) => {
        const currentModelId = getAiServiceOption(service, configs[service]).id;
        const selectedOption = AI_SERVICE_OPTIONS[service].find((opt) => opt.id === currentModelId) ?? AI_SERVICE_OPTIONS[service][0];
        return { service, selectedOption };
    });

    const statusBanner = useMemo(() => {
        if (status === "blocked") return { tone: "border-destructive/40 bg-destructive/10 text-destructive", text: "AI generation is blocked until the balance rises above the minimum floor." };
        if (status === "low") return { tone: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300", text: "Balance is low. Top up to avoid interrupting AI workflows." };
        return { tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", text: "Balance is healthy." };
    }, [status]);

    const handleTopUp = () => {
        setError(null);
        setSuccess(null);
        const euros = Number.parseFloat(amountEuros);
        if (!Number.isFinite(euros) || euros <= 0) {
            setError("Enter a valid positive amount in EUR.");
            return;
        }
        startTransition(async () => {
            const trimmedNotes = notes.trim();
            const result = await topUpWorkspaceAiCredits({
                workspaceId: workspace.id,
                amountEuros: euros,
                ...(trimmedNotes ? { notes: trimmedNotes } : {}),
            });
            if (result.error || !result.data) {
                setError(result.error ?? "Failed to top up credits.");
                return;
            }
            setSuccess(`Top-up applied. New balance: ${formatEuros(result.data.balanceMillicents)}`);
            setNotes("");
            router.refresh();
        });
    };

    return (
        <section id="ai-credits" className="space-y-6">
            <header className="rounded-md border border-border/70 bg-card/70 p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[17px] font-semibold uppercase tracking-[0.2em] text-primary">
                            <Zap className="h-3.5 w-3.5" /> AI Credits
                        </div>
                        <h2 className="mt-3 text-2xl font-bold tracking-tight">Metered AI usage</h2>
                        <p className="mt-1 text-[17px] text-muted-foreground">
                            Every AI action (draft, enhance, verify, asset) is metered in millicents EUR against this workspace balance. The minimum floor blocks new AI calls below {formatEuros(floorMillicents)} to prevent mid-workflow failures.
                        </p>
                    </div>
                    <div className="shrink-0 text-right">
                        <p className="text-[17px] uppercase tracking-wider text-muted-foreground">Current balance</p>
                        <p className="mt-1 text-3xl font-bold text-foreground">{formatEuros(balanceMillicents)}</p>
                        <p className="mt-1 text-[17px] text-muted-foreground">Floor {formatEuros(floorMillicents)}</p>
                    </div>
                </div>
                <p className={`mt-4 rounded-md border px-3 py-2 text-[15px] ${statusBanner.tone}`}>{statusBanner.text}</p>
            </header>

            {/* Model Configurator Section */}
            <div className="rounded-md border border-border/70 bg-card/70 p-6 shadow-sm space-y-6">
                <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Zap className="h-5 w-5 text-primary" /> AI Model Configurator
                    </h3>
                    <p className="mt-1 text-[17px] text-muted-foreground">
                        Configure which AI models are used for specific services in this workspace. Partner models (Anthropic) and Open-Source models (DeepSeek, LLaMA, Qwen) are served via serverless MaaS with no 24/7 dedicated hosting fees.
                    </p>
                </div>

                {loadingConfigs ? (
                    <div className="flex justify-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div>
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                    <h4 className="text-[17px] font-semibold">Interactive AI services</h4>
                                    <p className="text-[15px] text-muted-foreground">Models used when a manager actively requests generation, review, transcription, or drafting.</p>
                                </div>
                                <span className="rounded-full border border-border/70 bg-muted/30 px-2 py-0.5 text-[16px] font-medium uppercase tracking-wider text-muted-foreground">
                                    User-triggered
                                </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {INTERACTIVE_AI_SERVICES.map(renderServiceCard)}
                            </div>
                        </div>

                        <div>
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                    <h4 className="text-[17px] font-semibold">Background AI services</h4>
                                    <p className="text-[15px] text-muted-foreground">Models reserved for automation workers that can run outside the immediate editor flow.</p>
                                </div>
                                <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[16px] font-medium uppercase tracking-wider text-primary">
                                    Worker-ready
                                </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {BACKGROUND_AI_SERVICES.map(renderServiceCard)}
                            </div>
                        </div>

                        <div className="rounded-md border border-primary/15 bg-primary/5 p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h4 className="text-[17px] font-semibold">Background AI Services</h4>
                                    <p className="mt-1 text-[15px] text-muted-foreground">
                                        Visibility for automation model profiles. Worker policy controls are shown as placeholders until the backing automation settings are available.
                                    </p>
                                </div>
                                <span className="rounded-full border border-border/70 bg-background/60 px-2 py-0.5 text-[16px] font-medium uppercase tracking-wider text-muted-foreground">
                                    Preview
                                </span>
                            </div>
                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                                {backgroundSelections.map(({ service, selectedOption }) => (
                                    <div key={service} className="rounded-md border border-border/60 bg-background/50 p-3">
                                        <p className="text-[16px] font-semibold uppercase tracking-wider text-muted-foreground">{SERVICE_LABELS[service]}</p>
                                        <p className="mt-1 text-[17px] font-semibold text-foreground">{selectedOption.name}</p>
                                        <p className="mt-1 text-[17px] text-muted-foreground">{selectedOption.description}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 grid gap-2 md:grid-cols-3">
                                {BACKGROUND_POLICY_PLACEHOLDERS.map((policy) => (
                                    <div key={policy.label} className="rounded-md border border-dashed border-border/70 bg-background/30 p-3">
                                        <p className="text-[16px] font-semibold uppercase tracking-wider text-muted-foreground">{policy.label}</p>
                                        <p className="mt-1 text-[15px] text-foreground">{policy.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                    <Button
                        onClick={handleSaveConfigs}
                        disabled={loadingConfigs || isPendingConfigs}
                        className="shadow-[0_8px_20px_rgba(37,99,235,0.15)]"
                    >
                        {isPendingConfigs ? (
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Check className="mr-2 h-4 w-4" />
                        )}
                        Save Configurations
                    </Button>
                </div>

                {configError ? (
                    <p className="inline-flex items-center gap-1.5 text-[15px] text-destructive">
                        <AlertTriangle className="h-3 w-3" />
                        {configError}
                    </p>
                ) : null}
                {configSuccess ? (
                    <p className="text-[15px] text-emerald-700 dark:text-emerald-300">
                        {configSuccess}
                    </p>
                ) : null}
            </div>

            {role === "admin" ? (
                <div className="rounded-md border border-border/70 bg-card/70 p-6 shadow-sm">
                    <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4 text-primary" />
                        <h3 className="text-lg font-semibold">Top up credits</h3>
                    </div>
                    <p className="mt-1 text-[17px] text-muted-foreground">
                        Grant credits to this workspace. Writes an append-only ledger entry with reason <code className="rounded bg-muted/50 px-1 text-[15px]">manual_topup</code>.
                    </p>
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[140px_1fr_auto]">
                        <div>
                            <label className="text-[17px] uppercase tracking-wider text-muted-foreground">Amount (EUR)</label>
                            <Input
                                type="number"
                                min={1}
                                step="0.01"
                                value={amountEuros}
                                onChange={(e) => setAmountEuros(e.target.value)}
                                disabled={isPending}
                            />
                        </div>
                        <div>
                            <label className="text-[17px] uppercase tracking-wider text-muted-foreground">Notes (optional)</label>
                            <Input
                                type="text"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="e.g. Prepaid Q2 allocation"
                                disabled={isPending}
                            />
                        </div>
                        <div className="flex items-end">
                            <Button onClick={handleTopUp} disabled={isPending} className="w-full">
                                {isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                Apply top-up
                            </Button>
                        </div>
                    </div>
                    {error ? (
                        <p className="mt-3 inline-flex items-center gap-1.5 text-[15px] text-destructive">
                            <AlertTriangle className="h-3 w-3" />
                            {error}
                        </p>
                    ) : null}
                    {success ? <p className="mt-3 text-[15px] text-emerald-700 dark:text-emerald-300">{success}</p> : null}
                </div>
            ) : (
                <div className="rounded-md border border-border/70 bg-muted/20 px-6 py-4 text-[17px] text-muted-foreground">
                    Contact a workspace admin to add credits.
                </div>
            )}

            <div className="rounded-md border border-border/70 bg-card/70 p-6 shadow-sm">
                <h3 className="text-lg font-semibold">Recent ledger</h3>
                <p className="mt-1 text-[17px] text-muted-foreground">Append-only entries from the AI credit ledger. Positive amounts are top-ups or refunds; negative amounts are usage.</p>
                {ledger.length === 0 ? (
                    <p className="mt-4 rounded-md border border-dashed border-border/60 px-4 py-6 text-center text-[17px] text-muted-foreground">
                        No ledger entries yet.
                    </p>
                ) : (
                    <ul className="mt-4 divide-y divide-border/60 text-[17px]">
                        {ledger.map((entry) => (
                            <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium text-foreground">{entry.reason.replace(/_/g, " ")}</p>
                                    {entry.notes ? (
                                        <p className="truncate text-[15px] text-muted-foreground">{entry.notes}</p>
                                    ) : null}
                                </div>
                                <div className="flex items-center gap-4 text-right">
                                    <span className={`font-mono text-[17px] ${entry.amount_millicents >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                                        {entry.amount_millicents >= 0 ? "+" : ""}
                                        {formatEuros(entry.amount_millicents)}
                                    </span>
                                    <span className="w-24 text-[15px] text-muted-foreground">{new Date(entry.created_at).toLocaleDateString()}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}
