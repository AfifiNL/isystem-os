"use client";

import { useEffect, useState, useTransition } from "react";
import { ShieldAlert, ShieldCheck, AlertCircle, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { runGdprScanner } from "./actions";
import { ToolUnlockModal } from "../shared/ui/ToolUnlockModal";
import { useToolUnlock } from "../shared/use-tool-unlock";
import type { GdprResult } from "./compute";
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

const RISK_LABEL: Record<GdprResult["overallRisk"], { label: string; accent: "cyan" | "violet"; text: string }> = {
    low: { label: "Low risk", accent: "cyan", text: "text-emerald-300 print:text-emerald-700" },
    moderate: { label: "Moderate risk", accent: "violet", text: "text-amber-300 print:text-amber-700" },
    high: { label: "High risk", accent: "violet", text: "text-rose-300 print:text-rose-700" },
    critical: { label: "Critical risk", accent: "violet", text: "text-rose-300 print:text-rose-700" },
};

const SEVERITY_ICON = {
    info: <AlertCircle className="size-4 text-slate-300 print:text-slate-700" aria-hidden />,
    warn: <AlertCircle className="size-4 text-amber-300 print:text-amber-700" aria-hidden />,
    high: <ShieldAlert className="size-4 text-rose-300 print:text-rose-700" aria-hidden />,
} as const;

export function GdprScannerClient({ locale }: { locale: ToolLocale }) {
    const t = getToolClientStrings(locale);
    const [url, setUrl] = useState("");
    const [result, setResult] = useState<GdprResult | null>(null);
    const [leadId, setLeadId] = useState<string | null>(null);
    const [shareToken, setShareToken] = useState<string | null>(null);
    const [fromCache, setFromCache] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const [honeypot, setHoneypot] = useState("");
    const formStartedAt = useFormStartedAt();

    const unlock = useToolUnlock(runGdprScanner);

    function processResult(res: Awaited<ReturnType<typeof runGdprScanner>>) {
        if (!res.ok || !res.data) {
            if (!res.requiresSubscription) setError(res.error ?? "Could not scan.");
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
                tool="gdpr-cookie-scanner"
                toolName="GDPR Cookie Scanner"
                locale={locale}
                onClose={unlock.closeModal}
                onUnlocked={unlock.retryAfterUnlock}
            />
            <ToolPanel hideOnPrint>
                <form onSubmit={submit} className="relative space-y-5">
                    <HoneypotField value={honeypot} onChange={setHoneypot} />
                    <ToolField label={t.websiteUrlToScan} htmlFor="gdpr-url">
                        <ToolInput
                            id="gdpr-url"
                            type="url"
                            required
                            placeholder="https://your-site.com"
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
                        iconLeft={pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ShieldCheck className="size-4" aria-hidden />}
                    >
                        {pending ? t.scanning : t.runScan}
                    </ToolPrimaryButton>
                </form>
            </ToolPanel>

            {result ? (
                <>
                    <ToolResultCallout
                        eyebrow={fromCache ? "Cached scan" : "GDPR risk scan"}
                        headline={`Risk score: ${result.riskScore}/100 · ${RISK_LABEL[result.overallRisk].label}`}
                    >
                        <div className="grid gap-4 sm:grid-cols-3">
                            <ToolStatTile label={t.score} value={`${result.riskScore}/100`} hint={RISK_LABEL[result.overallRisk].label} accent={RISK_LABEL[result.overallRisk].accent} />
                            <ToolStatTile
                                label={t.cookieBanner}
                                value={result.cookieBanner.detected ? t.yes : t.no}
                                hint={result.cookieBanner.vendor ?? `${result.trackers.filter((t) => t.requiresConsent).length} consent-required trackers`}
                                accent="violet"
                            />
                            <ToolStatTile
                                label={t.trackersDetected}
                                value={`${result.trackers.length}`}
                                hint={`${result.trackers.filter((t) => t.requiresConsent).length} need consent`}
                                accent="neutral"
                            />
                        </div>
                    </ToolResultCallout>

                    <ToolPanel>
                        <h2 className="text-lg font-semibold text-white print:text-slate-900">{t.trackersDetected} ({result.trackers.length})</h2>
                        {result.trackers.length === 0 ? (
                            <p className="mt-3 text-sm text-slate-400">{t.noKnownTrackers}</p>
                        ) : (
                            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                                {result.trackers.map((tracker) => (
                                    <li key={tracker.id} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm print:border-slate-300 print:bg-white">
                                        <p className="font-semibold text-white print:text-slate-900">{tracker.name}</p>
                                        <p className="mt-1 text-xs capitalize text-slate-400 print:text-slate-700">
                                            {tracker.category} · {tracker.requiresConsent ? t.consentRequired : t.consentOptional}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </ToolPanel>

                    <ToolPanel>
                        <h2 className="text-lg font-semibold text-white print:text-slate-900">{t.policiesHeading}</h2>
                        <ul className="mt-4 grid gap-2 sm:grid-cols-3 text-sm">
                            <PolicyRow label={t.policiesPrivacy} present={result.policies.privacy} />
                            <PolicyRow label={t.policiesCookies} present={result.policies.cookies} />
                            <PolicyRow label={t.policiesTerms} present={result.policies.terms} />
                        </ul>
                    </ToolPanel>

                    <ToolPanel>
                        <h2 className="text-lg font-semibold text-white print:text-slate-900">{t.findingsFixes}</h2>
                        {result.findings.length === 0 ? (
                            <p className="mt-3 text-sm text-slate-400">{t.findingsClean}</p>
                        ) : (
                            <ul className="mt-4 space-y-3">
                                {result.findings.map((f) => (
                                    <li key={f.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm print:border-slate-300 print:bg-white">
                                        <div className="flex items-start gap-3">
                                            {SEVERITY_ICON[f.severity]}
                                            <div>
                                                <p className="font-semibold text-white print:text-slate-900">{f.label}</p>
                                                <p className="mt-0.5 text-slate-300 print:text-slate-700">{f.detail}</p>
                                                {f.fix ? (
                                                    <p className="mt-2 text-xs text-cyan-300 print:text-slate-900">
                                                        <strong>Fix:</strong> {f.fix}
                                                    </p>
                                                ) : null}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </ToolPanel>

                    <EmailGate leadId={leadId} locale={locale} shareUrl={shareUrl} />

                    <ToolPrintSummary title="GDPR + Cookie risk scan · iSystem.ai">
                        <p>
                            URL: <code>{result.finalUrl}</code>. Risk score <strong>{result.riskScore}/100</strong> ({result.overallRisk}).
                        </p>
                        <ul className="ml-5 list-disc">
                            {result.findings.map((f) => (
                                <li key={f.id}>[{f.severity}] {f.label} — {f.detail}</li>
                            ))}
                        </ul>
                    </ToolPrintSummary>
                </>
            ) : null}
        </div>
    );
}

function PolicyRow({ label, present }: { label: string; present: boolean }) {
    return (
        <li className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 print:border-slate-300 print:bg-white">
            {present ? (
                <CheckCircle2 className="size-4 text-emerald-300 print:text-emerald-700" aria-hidden />
            ) : (
                <XCircle className="size-4 text-rose-300 print:text-rose-700" aria-hidden />
            )}
            <span className="text-slate-200 print:text-slate-900">{label}</span>
        </li>
    );
}
