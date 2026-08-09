"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Mail, Sparkles, X } from "lucide-react";
import type { ToolLocale, ToolSlug } from "../types";
import { localizeHref } from "@/shared/lib/i18n/routing";

interface ToolUnlockModalProps {
    open: boolean;
    tool: ToolSlug;
    /** Localized copy for the tool name; appears in the headline / CTA. */
    toolName: string;
    locale: ToolLocale;
    onClose: () => void;
    /** Called after a successful subscribe + unlock grant. The parent
     * should retry the originally-blocked tool action inside this callback. */
    onUnlocked: () => void | Promise<void>;
}

const COPY: Record<ToolLocale, {
    eyebrow: string;
    headline: (toolName: string) => string;
    body: string;
    firstName: string;
    firstNameOptional: string;
    email: string;
    emailPlaceholder: string;
    consent: string;
    privacyPolicy: string;
    submit: string;
    sending: string;
    success: string;
    networkError: string;
    cancel: string;
    /** Shown when the email already had an active grant with 0 remaining
     * uses for this tool. We don't mint extras; we tell the user the truth. */
    alreadyExhausted: string;
}> = {
    en: {
        eyebrow: "You've hit today's free run",
        headline: (toolName) => `Subscribe to unlock 3 more runs of ${toolName}`,
        body: "Drop your email to keep going. We'll send you the iSystem.ai weekly digest — practical, no fluff — and immediately unlock three more runs of this tool on this browser.",
        firstName: "First name",
        firstNameOptional: "optional",
        email: "Work email",
        emailPlaceholder: "you@company.com",
        consent: "I agree to receive the iSystem.ai newsletter. Unsubscribe anytime; see our",
        privacyPolicy: "privacy policy",
        submit: "Subscribe & unlock",
        sending: "Subscribing…",
        success: "You're in. Loading your next run…",
        networkError: "Could not subscribe. Please try again.",
        cancel: "Maybe later",
        alreadyExhausted: "You're already subscribed and you've used all 3 unlocks for this tool. Try again tomorrow or use a different tool.",
    },
    nl: {
        eyebrow: "Je gratis run van vandaag is op",
        headline: (toolName) => `Abonneer voor 3 extra runs van ${toolName}`,
        body: "Laat je e-mail achter om door te gaan. Je krijgt de wekelijkse iSystem.ai digest — praktisch, geen fluff — en deblokkeert direct drie extra runs van deze tool in deze browser.",
        firstName: "Voornaam",
        firstNameOptional: "optioneel",
        email: "Werk-e-mail",
        emailPlaceholder: "jij@bedrijf.com",
        consent: "Ik ga akkoord met het ontvangen van de iSystem.ai-nieuwsbrief. Op elk moment uitschrijfbaar; zie ons",
        privacyPolicy: "privacybeleid",
        submit: "Abonneer & ontgrendel",
        sending: "Abonneren…",
        success: "Gelukt! Je volgende run wordt geladen…",
        networkError: "Kon niet abonneren. Probeer opnieuw.",
        cancel: "Misschien later",
        alreadyExhausted: "Je bent al geabonneerd en hebt alle 3 ontgrendelingen voor deze tool gebruikt. Probeer morgen opnieuw of kies een andere tool.",
    },
    ar: {
        eyebrow: "وصلت الحد اليومي للاستخدام المجاني",
        headline: (toolName) => `اشترك لإلغاء قفل 3 استخدامات إضافية لـ ${toolName}`,
        body: "أدخل بريدك الإلكتروني للمتابعة. ستحصل على نشرة iSystem.ai الأسبوعية — عملية، بلا حشو — وستفتح فوراً ثلاث استخدامات إضافية لهذه الأداة على هذا المتصفح.",
        firstName: "الاسم الأول",
        firstNameOptional: "اختياري",
        email: "البريد الإلكتروني",
        emailPlaceholder: "you@company.com",
        consent: "أوافق على استلام نشرة iSystem.ai. يمكن إلغاء الاشتراك في أي وقت؛ راجع",
        privacyPolicy: "سياسة الخصوصية",
        submit: "اشترك وألغِ القفل",
        sending: "جارٍ الاشتراك…",
        success: "تم الاشتراك! جارٍ تحميل الاستخدام التالي…",
        networkError: "تعذّر الاشتراك. حاول مجدداً.",
        cancel: "ربما لاحقاً",
        alreadyExhausted: "أنت مشترك بالفعل واستخدمت جميع الاستخدامات الثلاثة لهذه الأداة. حاول غداً أو استخدم أداة أخرى.",
    },
};

/**
 * Modal shown when a tool action returns `requiresSubscription: true`.
 *
 * The flow:
 *   1. User hits the 1/day cap, gets `requiresSubscription` in the response.
 *   2. Parent opens this modal (sets `open=true`).
 *   3. User submits email + optional name + consent.
 *   4. POST /api/newsletter/subscribe with `grantUnlock: { tool }` —
 *      the route subscribes them, mints the HttpOnly unlock cookie, and
 *      returns `{ unlock: { granted, usesRemaining } }`.
 *   5. On success, we call `onUnlocked()` so the parent retries the
 *      originally-blocked tool action. The HttpOnly cookie is already set;
 *      the action wrapper will consume one unlock and proceed.
 */
export function ToolUnlockModal({ open, tool, toolName, locale, onClose, onUnlocked }: ToolUnlockModalProps) {
    const copy = COPY[locale] ?? COPY.en;
    const dialogRef = useRef<HTMLDivElement>(null);
    const [email, setEmail] = useState("");
    const [firstName, setFirstName] = useState("");
    const [consent, setConsent] = useState(false);
    const [formStartedAt] = useState(() => new Date().toISOString());
    const [honeypot, setHoneypot] = useState("");
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Close on Escape; trap focus inside the dialog while open.
    useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape" && !pending) onClose();
        }
        document.addEventListener("keydown", onKey);
        dialogRef.current?.focus();
        return () => document.removeEventListener("keydown", onKey);
    }, [open, pending, onClose]);

    if (!open) return null;

    function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!consent || !email.trim()) {
            setError(copy.networkError);
            return;
        }
        setError(null);
        startTransition(async () => {
            try {
                const res = await fetch("/api/newsletter/subscribe", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: email.trim(),
                        firstName: firstName.trim() || undefined,
                        website: honeypot,
                        formStartedAt,
                        source: `tool_unlock:${tool}`,
                        grantUnlock: { tool },
                    }),
                });
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    setError(body.error ?? copy.networkError);
                    return;
                }
                // Reuse semantics: when the server reports `unlock.reused`
                // it means this email already had an active grant — we did
                // NOT mint a fresh 3 runs. If the remaining count is 0
                // (visitor already exhausted their unlocks earlier today),
                // tell them honestly instead of pretending they just
                // unlocked something they didn't.
                const body = await res.json().catch(() => ({}));
                const reused = Boolean(body?.unlock?.reused);
                const usesRemaining = typeof body?.unlock?.usesRemaining === "number"
                    ? body.unlock.usesRemaining
                    : null;
                if (reused && usesRemaining === 0) {
                    setError(copy.alreadyExhausted);
                    return;
                }
                setSuccess(true);
                // Brief celebration before handing back to the parent
                // so the user perceives the unlock as "happened", not
                // "was forced into the next action".
                setTimeout(() => {
                    void onUnlocked();
                }, 700);
            } catch {
                setError(copy.networkError);
            }
        });
    }

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tool-unlock-headline"
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
            onClick={(e) => {
                if (e.target === e.currentTarget && !pending) onClose();
            }}
        >
            <div
                ref={dialogRef}
                tabIndex={-1}
                className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-6 shadow-[0_30px_120px_rgba(0,15,40,0.55)] focus:outline-none sm:p-8"
            >
                <button
                    type="button"
                    onClick={onClose}
                    disabled={pending}
                    aria-label={copy.cancel}
                    className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/5 p-1.5 text-slate-300 transition hover:border-white/30 hover:bg-white/10 hover:text-white disabled:opacity-40"
                >
                    <X className="size-4" aria-hidden />
                </button>

                <div className="flex items-center gap-2 text-cyan-300">
                    <Sparkles className="size-4" aria-hidden />
                    <span className="text-xs font-semibold uppercase tracking-[0.18em]">{copy.eyebrow}</span>
                </div>
                <h2 id="tool-unlock-headline" className="mt-3 text-xl font-bold leading-snug text-white sm:text-2xl">
                    {copy.headline(toolName)}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">{copy.body}</p>

                {success ? (
                    <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm font-medium text-emerald-200">
                        {copy.success}
                    </div>
                ) : (
                    <form onSubmit={submit} className="mt-6 space-y-4">
                        {/* Honeypot — invisible to humans, irresistible to bots. */}
                        <input
                            type="text"
                            name="website"
                            value={honeypot}
                            onChange={(e) => setHoneypot(e.target.value)}
                            tabIndex={-1}
                            autoComplete="off"
                            className="absolute -left-[10000px] h-0 w-0 opacity-0"
                            aria-hidden
                        />

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="tool-unlock-firstname" className="text-xs font-medium text-slate-300">
                                    {copy.firstName} <span className="text-slate-500">({copy.firstNameOptional})</span>
                                </label>
                                <input
                                    id="tool-unlock-firstname"
                                    type="text"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    autoComplete="given-name"
                                    maxLength={80}
                                    className="h-11 rounded-xl border border-white/15 bg-white/5 px-4 text-sm text-white placeholder:text-white/40 focus:border-cyan-400/60 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="tool-unlock-email" className="text-xs font-medium text-slate-300">
                                    {copy.email}
                                </label>
                                <input
                                    id="tool-unlock-email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder={copy.emailPlaceholder}
                                    autoComplete="email"
                                    className="h-11 rounded-xl border border-white/15 bg-white/5 px-4 text-sm text-white placeholder:text-white/40 focus:border-cyan-400/60 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                                />
                            </div>
                        </div>

                        <label className="flex items-start gap-2 text-xs text-slate-400">
                            <input
                                type="checkbox"
                                checked={consent}
                                onChange={(e) => setConsent(e.target.checked)}
                                className="mt-0.5 size-3.5 accent-cyan-400"
                                required
                            />
                            <span>
                                {copy.consent}{" "}
                                <Link href={localizeHref(locale, "/privacy")} className="text-cyan-300 underline-offset-2 hover:underline">
                                    {copy.privacyPolicy}
                                </Link>
                                .
                            </span>
                        </label>

                        {error ? <p className="text-xs font-medium text-rose-300">{error}</p> : null}

                        <div className="flex items-center justify-between gap-3 pt-1">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={pending}
                                className="text-xs font-medium text-slate-400 transition hover:text-slate-200 disabled:opacity-40"
                            >
                                {copy.cancel}
                            </button>
                            <button
                                type="submit"
                                disabled={pending || !consent}
                                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-cyan-500 px-6 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(6,182,212,0.35)] transition-all hover:bg-cyan-400 hover:shadow-[0_0_36px_rgba(6,182,212,0.55)] focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
                            >
                                <Mail className="size-3.5" aria-hidden />
                                {pending ? copy.sending : copy.submit}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
