"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Headphones, Clock4, TrendingUp } from "lucide-react";
import { runSupportReadiness } from "./actions";
import { ToolUnlockModal } from "../shared/ui/ToolUnlockModal";
import { useToolUnlock } from "../shared/use-tool-unlock";
import { getAutomationTypeLabel, type SupportInput, type SupportResult } from "./compute";
import { EmailGate } from "../shared/ui/EmailGate";
import { getToolClientStrings } from "../shared/client-i18n";
import type { ToolLocale } from "../shared/types";
import { HoneypotField, useFormStartedAt } from "../shared/ui/anti-abuse-fields";
import {
    ToolCheckboxButton,
    ToolField,
    ToolInput,
    ToolPanel,
    ToolPrimaryButton,
    ToolPrintSummary,
    ToolRange,
    ToolResultCallout,
    ToolSegmented,
    ToolStatTile,
} from "../shared/ui/primitives";

const CHANNEL_LABELS: Record<SupportInput["channels"][number], string> = {
    email: "Email",
    chat: "Web chat",
    phone: "Phone",
    whatsapp: "WhatsApp",
    social: "Social DM",
};

export function SupportReadinessClient({ locale }: { locale: ToolLocale }) {
    const t = getToolClientStrings(locale);
    const [form, setForm] = useState<SupportInput>({
        monthlyInquiries: 400,
        repeatedQuestionsPercent: 65,
        channels: ["email", "chat"],
        avgResponseHours: 6,
        avgComplexity: "medium",
        teamSize: 2,
        avgAgentCostEurMonth: 3200,
        hasFaq: true,
        hasHelpdesk: false,
    });
    const [result, setResult] = useState<SupportResult | null>(null);
    const [leadId, setLeadId] = useState<string | null>(null);
    const [shareToken, setShareToken] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const [honeypot, setHoneypot] = useState("");
    const formStartedAt = useFormStartedAt();

    function toggleChannel(c: SupportInput["channels"][number]) {
        setForm((prev) => ({
            ...prev,
            channels: prev.channels.includes(c) ? prev.channels.filter((x) => x !== c) : [...prev.channels, c],
        }));
    }

    const unlock = useToolUnlock(runSupportReadiness);

    function processResult(res: Awaited<ReturnType<typeof runSupportReadiness>>) {
        if (!res.ok || !res.data) {
            if (!res.requiresSubscription) setError(res.error ?? "Could not compute readiness.");
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
        if (form.channels.length === 0) {
            setError("Select at least one support channel.");
            return;
        }
        startTransition(async () => {
            const res = await unlock.run({ ...form, website: honeypot, formStartedAt });
            processResult(res);
        });
    }

    const shareUrl = shareToken && typeof window !== "undefined" ? `${window.location.origin}/tools/share/${shareToken}` : undefined;

    return (
        <div className="space-y-6">
            <ToolUnlockModal
                open={unlock.modalOpen}
                tool="support-automation-readiness"
                toolName="Support Automation Readiness"
                locale={locale}
                onClose={unlock.closeModal}
                onUnlocked={unlock.retryAfterUnlock}
            />
            <ToolPanel hideOnPrint>
                <form onSubmit={submit} className="relative space-y-5">
                    <HoneypotField value={honeypot} onChange={setHoneypot} />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <ToolField label="Monthly inquiries">
                            <ToolInput
                                type="number"
                                min={0}
                                max={200000}
                                value={form.monthlyInquiries}
                                onChange={(e) => setForm({ ...form, monthlyInquiries: Number(e.target.value) })}
                            />
                        </ToolField>
                        <ToolField label="Avg response time (hours)">
                            <ToolInput
                                type="number"
                                min={0}
                                max={168}
                                step={0.5}
                                value={form.avgResponseHours}
                                onChange={(e) => setForm({ ...form, avgResponseHours: Number(e.target.value) })}
                            />
                        </ToolField>
                    </div>

                    <ToolRange
                        label="Repeated questions"
                        value={form.repeatedQuestionsPercent}
                        onChange={(v) => setForm({ ...form, repeatedQuestionsPercent: v })}
                        min={0}
                        max={100}
                        step={5}
                        suffix="%"
                    />

                    <ToolField label="Channels in use">
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                            {(["email", "chat", "phone", "whatsapp", "social"] as const).map((c) => (
                                <ToolCheckboxButton
                                    key={c}
                                    checked={form.channels.includes(c)}
                                    onChange={() => toggleChannel(c)}
                                >
                                    {CHANNEL_LABELS[c]}
                                </ToolCheckboxButton>
                            ))}
                        </div>
                    </ToolField>

                    <div className="grid gap-4 sm:grid-cols-3">
                        <ToolField label="Inquiry complexity">
                            <ToolSegmented
                                value={form.avgComplexity}
                                onChange={(v) => setForm({ ...form, avgComplexity: v })}
                                options={[
                                    { value: "low", label: "Low" },
                                    { value: "medium", label: "Medium" },
                                    { value: "high", label: "High" },
                                ]}
                            />
                        </ToolField>
                        <ToolField label="Support team size">
                            <ToolInput
                                type="number"
                                min={0}
                                max={500}
                                value={form.teamSize}
                                onChange={(e) => setForm({ ...form, teamSize: Number(e.target.value) })}
                            />
                        </ToolField>
                        <ToolField label="Avg agent cost (€/mo)">
                            <ToolInput
                                type="number"
                                min={0}
                                max={20000}
                                value={form.avgAgentCostEurMonth}
                                onChange={(e) => setForm({ ...form, avgAgentCostEurMonth: Number(e.target.value) })}
                            />
                        </ToolField>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                            <input
                                type="checkbox"
                                checked={form.hasFaq}
                                onChange={(e) => setForm({ ...form, hasFaq: e.target.checked })}
                                className="size-3.5 accent-cyan-400"
                            />
                            We already have a public FAQ
                        </label>
                        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                            <input
                                type="checkbox"
                                checked={form.hasHelpdesk}
                                onChange={(e) => setForm({ ...form, hasHelpdesk: e.target.checked })}
                                className="size-3.5 accent-cyan-400"
                            />
                            We use a helpdesk (Zendesk, HubSpot…)
                        </label>
                    </div>

                    {error ? (
                        <p role="alert" className="rounded-xl border border-rose-400/40 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>
                    ) : null}

                    <ToolPrimaryButton
                        type="submit"
                        disabled={pending}
                        iconLeft={pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Headphones className="size-4" aria-hidden />}
                    >
                        {pending ? t.computing : t.checkReadiness}
                    </ToolPrimaryButton>
                </form>
            </ToolPanel>

            {result ? (
                <>
                    <ToolResultCallout
                        eyebrow="Support readiness"
                        headline={getAutomationTypeLabel(result.primaryRecommendation)}
                        body={`Tooling cost ≈ €${result.payback.tooling}/mo · recovers ${result.payback.recoveredHours} hours/month.`}
                    >
                        <div className="grid gap-4 sm:grid-cols-3">
                            <ToolStatTile label="Readiness" value={`${result.readinessScore}/100`} accent="cyan" />
                            <ToolStatTile label="Hours / month" value={`${result.monthlyHoursSaved}h`} accent="violet" />
                            <ToolStatTile label="€ / month" value={`€${result.monthlyEurSaved}`} accent="cyan" />
                        </div>
                    </ToolResultCallout>

                    {result.rationale.length ? (
                        <ToolPanel>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Why this recommendation</p>
                            <ul className="mt-3 space-y-2 text-sm text-slate-300 print:text-slate-900">
                                {result.rationale.map((r, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <TrendingUp className="mt-0.5 size-3.5 shrink-0 text-cyan-300 print:text-slate-700" aria-hidden />
                                        {r}
                                    </li>
                                ))}
                            </ul>
                        </ToolPanel>
                    ) : null}

                    <EmailGate leadId={leadId} locale={locale} shareUrl={shareUrl} />

                    <ToolPrintSummary title="Support automation readiness · iSystem.ai">
                        <p>
                            Readiness <strong>{result.readinessScore}/100</strong>. Recommended:{" "}
                            <strong>{getAutomationTypeLabel(result.primaryRecommendation)}</strong>. Monthly savings:{" "}
                            <strong>€{result.monthlyEurSaved}</strong> (
                            <Clock4 className="inline-block size-3.5" aria-hidden /> {result.monthlyHoursSaved}h).
                        </p>
                    </ToolPrintSummary>
                </>
            ) : null}
        </div>
    );
}
