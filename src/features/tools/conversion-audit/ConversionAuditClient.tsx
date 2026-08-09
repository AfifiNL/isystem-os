"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, CheckCircle2, AlertCircle, XCircle, Sparkles } from "lucide-react";
import { runConversionAudit } from "./actions";
import { ToolUnlockModal } from "../shared/ui/ToolUnlockModal";
import { useToolUnlock } from "../shared/use-tool-unlock";
import type { ConversionResult, ConversionCheck } from "./compute";
import { EmailGate } from "../shared/ui/EmailGate";
import { HoneypotField, useFormStartedAt } from "../shared/ui/anti-abuse-fields";
import { getToolClientStrings } from "../shared/client-i18n";
import type { ToolLocale } from "../shared/types";
import {
    ToolField,
    ToolInput,
    ToolPanel,
    ToolPrimaryButton,
    ToolPrintSummary,
    ToolResultCallout,
    ToolStatTile,
} from "../shared/ui/primitives";

const STATUS_ICON: Record<ConversionCheck["status"], React.ReactNode> = {
    pass: <CheckCircle2 className="size-4 text-emerald-300 print:text-emerald-700" aria-hidden />,
    warn: <AlertCircle className="size-4 text-amber-300 print:text-amber-700" aria-hidden />,
    fail: <XCircle className="size-4 text-rose-300 print:text-rose-700" aria-hidden />,
};

export function ConversionAuditClient({ locale }: { locale: ToolLocale }) {
    const t = getToolClientStrings(locale);
    const [url, setUrl] = useState("");
    const [result, setResult] = useState<ConversionResult | null>(null);
    const [leadId, setLeadId] = useState<string | null>(null);
    const [shareToken, setShareToken] = useState<string | null>(null);
    const [fromCache, setFromCache] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const [honeypot, setHoneypot] = useState("");
    const formStartedAt = useFormStartedAt();

    const unlock = useToolUnlock(runConversionAudit);

    function processResult(res: Awaited<ReturnType<typeof runConversionAudit>>) {
        if (!res.ok || !res.data) {
            if (!res.requiresSubscription) setError(res.error ?? "Could not audit.");
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
            const res = await unlock.run({ url, website: honeypot, formStartedAt });
            processResult(res);
        });
    }

    const shareUrl = shareToken && typeof window !== "undefined" ? `${window.location.origin}/tools/share/${shareToken}` : undefined;

    return (
        <div className="space-y-6">
            <ToolUnlockModal
                open={unlock.modalOpen}
                tool="conversion-audit"
                toolName="Conversion Audit"
                locale={locale}
                onClose={unlock.closeModal}
                onUnlocked={unlock.retryAfterUnlock}
            />
            <ToolPanel hideOnPrint>
                <form onSubmit={submit} className="relative space-y-5">
                    <HoneypotField value={honeypot} onChange={setHoneypot} />
                    <ToolField label={t.landingPageUrl} htmlFor="conv-url">
                        <ToolInput
                            id="conv-url"
                            type="url"
                            required
                            placeholder="https://your-site.com/landing-page"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                        />
                    </ToolField>
                    {error ? (
                        <p role="alert" className="rounded-xl border border-rose-400/40 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>
                    ) : null}
                    <ToolPrimaryButton
                        type="submit"
                        disabled={pending}
                        iconLeft={pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
                    >
                        {pending ? t.auditing : t.runAudit}
                    </ToolPrimaryButton>
                </form>
            </ToolPanel>

            {result ? (
                <>
                    <ToolResultCallout
                        eyebrow={fromCache ? "Cached audit" : "Conversion audit"}
                        headline={`Grade: ${result.score}/100 (${result.grade})`}
                        body={result.title ?? result.finalUrl}
                    >
                        <div className="grid gap-4 sm:grid-cols-3">
                            <ToolStatTile label={t.score} value={`${result.score}/100`} accent="cyan" />
                            <ToolStatTile label={t.grade} value={result.grade} accent="violet" />
                            <ToolStatTile label={t.trustSignals} value={`${result.trustSignalCount}`} hint={`${t.ctaStrength}: ${result.ctaStrength}`} accent="neutral" />
                        </div>
                    </ToolResultCallout>

                    <ToolPanel>
                        <h2 className="text-lg font-semibold text-white print:text-slate-900">{t.conversionSignals}</h2>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <ToolStatTile label={t.ctaStrength} value={result.ctaStrength} accent="cyan" />
                            <ToolStatTile label={t.trustSignals} value={`${result.trustSignalCount}`} accent="violet" />
                            <ToolStatTile label={t.leadMagnets} value={`${result.detectedLeadMagnets.length}`} accent="neutral" />
                        </div>
                        {result.detectedLeadMagnets.length ? (
                            <p className="mt-3 text-sm text-slate-300 print:text-slate-700">
                                {t.detectedLeadMagnets}: {result.detectedLeadMagnets.join(", ")}
                            </p>
                        ) : null}
                    </ToolPanel>

                    <ToolPanel>
                        <h2 className="text-lg font-semibold text-white print:text-slate-900">{t.whatWeChecked}</h2>
                        <ul className="mt-4 space-y-2">
                            {result.checks.map((c) => (
                                <li key={c.id} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm print:border-slate-300 print:bg-white">
                                    {STATUS_ICON[c.status]}
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-white print:text-slate-900">{c.label}</p>
                                        <p className="text-slate-300 print:text-slate-700">{c.detail}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </ToolPanel>

                    {result.recommendations.length ? (
                        <ToolPanel>
                            <h2 className="text-lg font-semibold text-white print:text-slate-900">{t.topRecommendations}</h2>
                            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-300 print:text-slate-900">
                                {result.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                            </ol>
                        </ToolPanel>
                    ) : null}

                    <EmailGate leadId={leadId} locale={locale} shareUrl={shareUrl} />

                    <ToolPrintSummary title={`Conversion audit · ${result.finalUrl}`}>
                        <p>
                            Score <strong>{result.score}/100</strong> · grade <strong>{result.grade}</strong>.
                        </p>
                        <ul className="ml-5 list-disc">
                            {result.checks.map((c) => (
                                <li key={c.id}>[{c.status}] {c.label} — {c.detail}</li>
                            ))}
                        </ul>
                    </ToolPrintSummary>
                </>
            ) : null}
        </div>
    );
}
