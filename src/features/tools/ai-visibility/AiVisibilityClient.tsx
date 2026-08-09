"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, AlertCircle, XCircle, Loader2, Globe2 } from "lucide-react";
import { runAiVisibilityChecker } from "./actions";
import type { AiVisibilityInput, AiVisibilityResult, VisibilityCheck } from "./compute";
import { EmailGate } from "../shared/ui/EmailGate";
import { ToolUnlockModal } from "../shared/ui/ToolUnlockModal";
import { useToolUnlock } from "../shared/use-tool-unlock";
import { getToolClientStrings } from "../shared/client-i18n";
import type { ToolLocale } from "../shared/types";
import { HoneypotField, useFormStartedAt } from "../shared/ui/anti-abuse-fields";
import {
    ToolField,
    ToolInput,
    ToolPanel,
    ToolPrimaryButton,
    ToolPrintSummary,
    ToolResultCallout,
    ToolStatTile,
} from "../shared/ui/primitives";

const STATUS_ICON: Record<VisibilityCheck["status"], React.ReactNode> = {
    pass: <CheckCircle2 className="size-4 text-emerald-300 print:text-emerald-700" aria-hidden />,
    warn: <AlertCircle className="size-4 text-amber-300 print:text-amber-700" aria-hidden />,
    fail: <XCircle className="size-4 text-rose-300 print:text-rose-700" aria-hidden />,
};

export function AiVisibilityClient({ locale }: { locale: ToolLocale }) {
    const t = getToolClientStrings(locale);
    const [form, setForm] = useState<AiVisibilityInput>({
        url: "",
        brandName: "",
        industry: "",
        location: "",
    });
    const [result, setResult] = useState<AiVisibilityResult | null>(null);
    const [leadId, setLeadId] = useState<string | null>(null);
    const [shareToken, setShareToken] = useState<string | null>(null);
    const [fromCache, setFromCache] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const [honeypot, setHoneypot] = useState("");
    const formStartedAt = useFormStartedAt();

    const unlock = useToolUnlock(runAiVisibilityChecker);

    function processResult(res: Awaited<ReturnType<typeof runAiVisibilityChecker>>) {
        if (!res.ok || !res.data) {
            if (!res.requiresSubscription) setError(res.error ?? "Could not run check.");
            return;
        }
        setError(null);
        setResult(res.data.result);
        setLeadId(res.data.leadId);
        setShareToken(res.data.shareToken);
        setFromCache(res.data.fromCache);
        window.scrollTo({ top: window.scrollY + 200, behavior: "smooth" });
    }

    useEffect(() => unlock.onResult(processResult), [unlock]);

    function submit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
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
                tool="ai-visibility-checker"
                toolName="AI Visibility Checker"
                locale={locale}
                onClose={unlock.closeModal}
                onUnlocked={unlock.retryAfterUnlock}
            />
            <ToolPanel hideOnPrint>
                <form onSubmit={submit} className="relative space-y-5">
                    <HoneypotField value={honeypot} onChange={setHoneypot} />
                    <ToolField label={t.urlToCheck} htmlFor="ai-url">
                        <ToolInput
                            id="ai-url"
                            type="url"
                            required
                            placeholder="https://your-site.com"
                            value={form.url}
                            onChange={(e) => setForm({ ...form, url: e.target.value })}
                        />
                    </ToolField>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <ToolField label={t.brandName}>
                            <ToolInput
                                type="text"
                                required
                                value={form.brandName}
                                onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                                maxLength={80}
                            />
                        </ToolField>
                        <ToolField label={t.industryLabel}>
                            <ToolInput
                                type="text"
                                required
                                value={form.industry}
                                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                                placeholder="dental clinic, agency…"
                                maxLength={60}
                            />
                        </ToolField>
                        <ToolField label={t.location} helper={t.optional}>
                            <ToolInput
                                type="text"
                                value={form.location ?? ""}
                                onChange={(e) => setForm({ ...form, location: e.target.value })}
                                maxLength={80}
                                placeholder="Amsterdam, NL"
                            />
                        </ToolField>
                    </div>
                    {error ? (
                        <p role="alert" className="rounded-xl border border-rose-400/40 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>
                    ) : null}
                    <ToolPrimaryButton
                        type="submit"
                        disabled={pending}
                        iconLeft={pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Globe2 className="size-4" aria-hidden />}
                    >
                        {pending ? t.auditing : t.runAiVisibilityCheck}
                    </ToolPrimaryButton>
                </form>
            </ToolPanel>

            {result ? (
                <>
                    <ToolResultCallout
                        eyebrow={fromCache ? "Your AI visibility · cached" : "Your AI visibility"}
                        headline={`${t.citationReadiness}: ${result.overallScore}/100 (${result.citationReadiness})`}
                        body={result.title ?? result.finalUrl}
                    >
                        <div className="grid gap-4 sm:grid-cols-3">
                            <ToolStatTile label={t.score} value={`${result.overallScore}/100`} accent="cyan" />
                            <ToolStatTile label={t.readiness} value={result.citationReadiness} accent="violet" />
                            <ToolStatTile label={t.checks} value={`${result.checks.length}`} hint={t.checksTotalHint} accent="neutral" />
                        </div>
                    </ToolResultCallout>

                    <ToolPanel>
                        <h2 className="text-lg font-semibold text-white print:text-slate-900">{t.aiAssessment}</h2>
                        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300 print:text-slate-700">
                            {result.prose}
                        </p>
                    </ToolPanel>

                    <ToolPanel>
                        <h2 className="text-lg font-semibold text-white print:text-slate-900">{t.checks}</h2>
                        <ul className="mt-4 space-y-2">
                            {result.checks.map((c) => (
                                <li key={c.id} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm print:border-slate-300 print:bg-white">
                                    {STATUS_ICON[c.status]}
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-white print:text-slate-900">{c.label}</p>
                                        <p className="text-slate-300 print:text-slate-700">{c.detail}</p>
                                    </div>
                                    <span className="text-[10px] uppercase tracking-wider text-slate-500 print:text-slate-600">{c.impact}</span>
                                </li>
                            ))}
                        </ul>
                    </ToolPanel>

                    {result.topFixes.length ? (
                        <ToolPanel>
                            <h2 className="text-lg font-semibold text-white print:text-slate-900">{t.topFixes}</h2>
                            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-300 print:text-slate-900">
                                {result.topFixes.map((fix, i) => <li key={i}>{fix}</li>)}
                            </ol>
                        </ToolPanel>
                    ) : null}

                    <ToolPanel>
                        <h2 className="text-lg font-semibold text-white print:text-slate-900">{t.samplePrompts}</h2>
                        <ul className="mt-3 space-y-1 text-sm text-slate-300 print:text-slate-700">
                            {result.samplePrompts.map((p, i) => <li key={i}>· {p}</li>)}
                        </ul>
                        <p className="mt-4 text-xs text-slate-400 print:text-slate-700">
                            {t.samplePromptsBody}
                        </p>
                    </ToolPanel>

                    <EmailGate leadId={leadId} locale={locale} shareUrl={shareUrl} />

                    <ToolPrintSummary title={`AI visibility report · ${result.finalUrl}`}>
                        <p>
                            Score <strong>{result.overallScore}/100</strong> · readiness <strong>{result.citationReadiness}</strong>.
                        </p>
                        <ul className="ml-5 list-disc">
                            {result.checks.map((c) => (
                                <li key={c.id}>
                                    [{c.status}] {c.label} — {c.detail}
                                </li>
                            ))}
                        </ul>
                    </ToolPrintSummary>
                </>
            ) : null}
        </div>
    );
}
