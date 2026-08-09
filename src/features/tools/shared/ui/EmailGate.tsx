"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Mail, CheckCircle2, Printer, Share2 } from "lucide-react";
import { useTemplate } from "@/features/templates/template-provider";
import { attachEmailToToolLead } from "../lead-capture-action";
import { getToolsChrome } from "../i18n";
import type { ToolLocale } from "../types";
import { localizeHref } from "@/shared/lib/i18n/routing";

interface EmailGateProps {
    leadId: string | null;
    locale: ToolLocale;
    /** Optional eyebrow override (defaults to localized "Email me the report"). */
    headline?: string;
    /** Optional body override (defaults to localized chrome body). */
    body?: string;
    /** Optional share URL surfaced after capture. */
    shareUrl?: string;
}

export function EmailGate({ leadId, locale, headline, body, shareUrl }: EmailGateProps) {
    const chrome = getToolsChrome(locale).emailGate;
    const [email, setEmail] = useState("");
    const [firstName, setFirstName] = useState("");
    const [consent, setConsent] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const [copied, setCopied] = useState(false);
    const { config } = useTemplate();
    const templateId = config?.id ?? null;

    if (!leadId) return null;

    function submit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
            const locationContext = typeof window !== "undefined"
                ? {
                    pagePath: window.location.pathname,
                    pageUrl: window.location.href,
                    ctaRef: `tools-${window.location.pathname.split("/").filter(Boolean).at(-1) ?? "hub"}-email-report`,
                }
                : {};
            const res = await attachEmailToToolLead({
                leadId,
                email: email.trim(),
                consent,
                firstName: firstName.trim() || undefined,
                templateId: templateId ?? undefined,
                ...locationContext,
            });
            if (!res.ok) {
                setError(res.error ?? "Could not save.");
                return;
            }
            setDone(true);
        });
    }

    async function copyShare() {
        if (!shareUrl) return;
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
        }
    }

    function handlePrint() {
        if (typeof window !== "undefined") window.print();
    }

    if (done) {
        return (
            <div className="mt-8 rounded-3xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/15 via-cyan-400/5 to-violet-500/10 p-6 shadow-[0_30px_80px_rgba(0,15,40,0.45)] backdrop-blur-xl print:hidden">
                <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 size-5 text-cyan-300" aria-hidden />
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-white">{chrome.successHeadline}</p>
                        <p className="mt-1 text-xs text-slate-300">{chrome.successBody}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={handlePrint}
                                className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 text-xs font-medium text-white hover:border-cyan-400/40 hover:bg-white/10"
                            >
                                <Printer className="size-3.5" aria-hidden /> {chrome.downloadPdf}
                            </button>
                            {shareUrl ? (
                                <button
                                    type="button"
                                    onClick={copyShare}
                                    className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 text-xs font-medium text-white hover:border-cyan-400/40 hover:bg-white/10"
                                >
                                    <Share2 className="size-3.5" aria-hidden /> {copied ? chrome.copied : chrome.copyShareLink}
                                </button>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <form
            onSubmit={submit}
            className="mt-8 rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_80px_rgba(0,15,40,0.45)] backdrop-blur-xl print:hidden"
        >
            <div className="flex items-center gap-2 text-cyan-300">
                <Mail className="size-4" aria-hidden />
                <span className="text-xs font-semibold uppercase tracking-[0.18em]">{headline ?? chrome.eyebrow}</span>
            </div>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">{body ?? chrome.body}</p>
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-slate-400">{chrome.reportDeliveryNote}</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <div className="flex flex-col gap-1.5">
                    <label htmlFor="tool-firstname" className="text-xs font-medium text-slate-300">
                        {chrome.firstName} <span className="text-slate-500">({chrome.firstNameOptional})</span>
                    </label>
                    <input
                        id="tool-firstname"
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        autoComplete="given-name"
                        maxLength={80}
                        className="h-11 rounded-xl border border-white/15 bg-white/5 px-4 text-sm text-white placeholder:text-white/40 focus:border-cyan-400/60 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label htmlFor="tool-email" className="text-xs font-medium text-slate-300">
                        {chrome.email}
                    </label>
                    <input
                        id="tool-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={chrome.emailPlaceholder}
                        autoComplete="email"
                        className="h-11 rounded-xl border border-white/15 bg-white/5 px-4 text-sm text-white placeholder:text-white/40 focus:border-cyan-400/60 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                    />
                </div>
                <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-full bg-cyan-500 px-6 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(6,182,212,0.35)] transition-all hover:bg-cyan-400 hover:shadow-[0_0_36px_rgba(6,182,212,0.55)] focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
                >
                    {pending ? chrome.sending : chrome.submit}
                </button>
            </div>

            <label className="mt-4 flex items-start gap-2 text-xs text-slate-400">
                <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 size-3.5 accent-cyan-400"
                    required
                />
                <span>
                    {chrome.consent}{" "}
                    <Link href={localizeHref(locale, "/privacy")} className="text-cyan-300 underline-offset-2 hover:underline">
                        {chrome.privacyPolicy}
                    </Link>
                    .
                </span>
            </label>
            {error ? <p className="mt-3 text-xs font-medium text-rose-300">{error}</p> : null}
        </form>
    );
}
