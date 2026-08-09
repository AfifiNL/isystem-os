"use client";

import { useId, useState, type FormEvent } from "react";
import type { Locale } from "@/features/templates/types";
import {
    pickOptionalPopupText,
    pickPopupText,
    type PopupContent,
    type PopupTemplateKind,
} from "@/features/popups/schema";
import { CloseButton, PopupShell } from "./shared";

export interface PopupTemplateProps {
    popupId: string;
    workspaceId: string;
    content: PopupContent;
    locale: Locale;
    onDismiss: () => void;
    onConvert: () => void;
}

// ─── Newsletter Classic ───────────────────────────────────────────────────
// Inline email form. Submits to the existing /api/newsletter/subscribe
// endpoint (already anti-abuse hardened). The `source` field is set to
// `popup_${id}` so newsletter analytics can attribute conversions back.

function NewsletterClassicPopup(props: PopupTemplateProps) {
    const { content, locale, popupId, onDismiss, onConvert } = props;
    const titleId = useId();
    const dir = locale === "ar" ? "rtl" : "ltr";
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const eyebrow = pickOptionalPopupText(content.eyebrow, locale);
    const title = pickPopupText(content.title, locale);
    const body = pickPopupText(content.body, locale);
    const ctaLabel = pickPopupText(content.ctaLabel, locale);
    const dismissLabel = pickOptionalPopupText(content.dismissLabel, locale)
        ?? (locale === "nl" ? "Later" : locale === "ar" ? "لاحقًا" : "Maybe later");

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (status === "submitting") return;
        setStatus("submitting");
        setErrorMessage(null);
        const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
        const utm = Object.fromEntries(
            ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]
                .map((key) => [key, params.get(key)] as const)
                .filter(([, value]) => Boolean(value)),
        );
        try {
            const res = await fetch("/api/newsletter/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    source: `popup_${popupId}`,
                    metadata: {
                        popupId,
                        sourceSurface: "popup",
                        leadMagnet: content.ctaHref || "newsletter_popup",
                        currentPath: typeof window !== "undefined" ? window.location.pathname : null,
                        referrer: typeof document !== "undefined" ? document.referrer || null : null,
                        utm,
                    },
                }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                setStatus("error");
                setErrorMessage(payload?.error || "Could not subscribe. Please try again.");
                return;
            }
            setStatus("success");
            onConvert();
        } catch {
            setStatus("error");
            setErrorMessage("Network error. Please try again.");
        }
    }

    return (
        <PopupShell titleId={titleId} dir={dir} onDismiss={onDismiss}>
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0d4f8c] via-[#002f58] to-[#001a33] p-8 text-white shadow-[0_30px_80px_rgba(0,15,40,0.45)] sm:p-10">
                <div
                    className="pointer-events-none absolute -end-24 -top-24 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl"
                    aria-hidden="true"
                />
                <CloseButton onClick={onDismiss} label={dismissLabel} />
                {eyebrow ? (
                    <div className="mb-4 inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
                        {eyebrow}
                    </div>
                ) : null}
                <h2 id={titleId} className="text-2xl font-bold leading-tight sm:text-3xl">
                    {title}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-white/80 sm:text-base">{body}</p>
                {status === "success" ? (
                    <div className="mt-6 rounded-2xl bg-emerald-500/15 p-4 text-sm text-emerald-100">
                        {locale === "nl"
                            ? "Je bent erbij! Check je inbox voor de eerste editie."
                            : locale === "ar"
                                ? "تم الاشتراك! تحقق من بريدك للحصول على العدد الأول."
                                : "You're in! Check your inbox for the first edition."}
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
                        <label className="sr-only" htmlFor={`${titleId}-email`}>
                            {locale === "nl" ? "E-mailadres" : locale === "ar" ? "البريد الإلكتروني" : "Email address"}
                        </label>
                        <input
                            id={`${titleId}-email`}
                            type="email"
                            required
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={
                                locale === "nl" ? "jij@bedrijf.nl"
                                    : locale === "ar" ? "you@company.com"
                                        : "you@company.com"
                            }
                            className="flex-1 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm text-white placeholder:text-white/45 focus:border-white/40 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-200/40"
                        />
                        <button
                            type="submit"
                            disabled={status === "submitting"}
                            className="inline-flex items-center justify-center rounded-full bg-cyan-300 px-6 py-3 text-sm font-semibold text-[#001a33] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {status === "submitting"
                                ? (locale === "nl" ? "Bezig…" : locale === "ar" ? "جارٍ…" : "Sending…")
                                : ctaLabel}
                        </button>
                    </form>
                )}
                {errorMessage ? (
                    <p role="alert" className="mt-3 text-sm text-rose-200">{errorMessage}</p>
                ) : null}
                <button
                    type="button"
                    onClick={onDismiss}
                    className="mt-4 inline-flex text-xs font-medium text-white/60 underline-offset-4 hover:text-white/80 hover:underline"
                >
                    {dismissLabel}
                </button>
            </div>
        </PopupShell>
    );
}

// ─── Newsletter Minimal ──────────────────────────────────────────────────
// No inline form — single CTA that deep-links to /newsletter with a popup
// attribution param. Lighter visual weight, better for exit-intent.

function NewsletterMinimalPopup(props: PopupTemplateProps) {
    const { content, locale, popupId, onDismiss, onConvert } = props;
    const titleId = useId();
    const dir = locale === "ar" ? "rtl" : "ltr";

    const title = pickPopupText(content.title, locale);
    const body = pickPopupText(content.body, locale);
    const ctaLabel = pickPopupText(content.ctaLabel, locale);
    const dismissLabel = pickOptionalPopupText(content.dismissLabel, locale)
        ?? (locale === "nl" ? "Sluiten" : locale === "ar" ? "إغلاق" : "Close");
    const ctaHref = appendPopupParams(content.ctaHref, popupId);

    return (
        <PopupShell titleId={titleId} dir={dir} onDismiss={onDismiss} maxWidthClass="max-w-sm">
            <div className="relative rounded-2xl bg-white p-6 text-slate-900 shadow-[0_24px_60px_rgba(15,23,42,0.25)] sm:p-7">
                <CloseButton onClick={onDismiss} label={dismissLabel} />
                <h2 id={titleId} className="text-xl font-bold leading-tight sm:text-2xl">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
                <a
                    href={ctaHref}
                    onClick={onConvert}
                    className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-[#002f58] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0d4f8c]"
                >
                    {ctaLabel}
                </a>
            </div>
        </PopupShell>
    );
}

// ─── Booking Promo ────────────────────────────────────────────────────────
// Editorial card. Strong eyebrow, long-form body, prominent CTA. Cover
// image slot is optional — if eyebrow is set we render an accent strip.

function BookingPromoPopup(props: PopupTemplateProps) {
    const { content, locale, popupId, onDismiss, onConvert } = props;
    const titleId = useId();
    const dir = locale === "ar" ? "rtl" : "ltr";
    const eyebrow = pickOptionalPopupText(content.eyebrow, locale);
    const title = pickPopupText(content.title, locale);
    const body = pickPopupText(content.body, locale);
    const ctaLabel = pickPopupText(content.ctaLabel, locale);
    const dismissLabel = pickOptionalPopupText(content.dismissLabel, locale)
        ?? (locale === "nl" ? "Niet nu" : locale === "ar" ? "ليس الآن" : "Not now");
    const ctaHref = appendPopupParams(content.ctaHref, popupId);

    return (
        <PopupShell titleId={titleId} dir={dir} onDismiss={onDismiss} maxWidthClass="max-w-lg">
            <div className="relative overflow-hidden rounded-3xl bg-white shadow-[0_30px_80px_rgba(0,15,40,0.35)]">
                <div
                    className="h-2 w-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500"
                    aria-hidden="true"
                />
                <div className="relative p-8 sm:p-10">
                    <CloseButton onClick={onDismiss} label={dismissLabel} />
                    {eyebrow ? (
                        <div className="mb-4 inline-flex items-center rounded-full bg-orange-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-orange-700">
                            {eyebrow}
                        </div>
                    ) : null}
                    <h2 id={titleId} className="text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">
                        {title}
                    </h2>
                    <p className="mt-3 text-base leading-relaxed text-slate-600">{body}</p>
                    <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <a
                            href={ctaHref}
                            onClick={onConvert}
                            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                            {ctaLabel}
                        </a>
                        <button
                            type="button"
                            onClick={onDismiss}
                            className="inline-flex items-center justify-center rounded-full px-4 py-3 text-sm font-medium text-slate-500 transition hover:text-slate-700"
                        >
                            {dismissLabel}
                        </button>
                    </div>
                </div>
            </div>
        </PopupShell>
    );
}

// ─── Booking Urgency ──────────────────────────────────────────────────────
// Designed for exit_intent. Tighter copy, urgency colour palette, single
// dominant CTA. No close button competing for attention beyond the small X.

function BookingUrgencyPopup(props: PopupTemplateProps) {
    const { content, locale, popupId, onDismiss, onConvert } = props;
    const titleId = useId();
    const dir = locale === "ar" ? "rtl" : "ltr";
    const eyebrow = pickOptionalPopupText(content.eyebrow, locale);
    const title = pickPopupText(content.title, locale);
    const body = pickPopupText(content.body, locale);
    const ctaLabel = pickPopupText(content.ctaLabel, locale);
    const dismissLabel = pickOptionalPopupText(content.dismissLabel, locale)
        ?? (locale === "nl" ? "Sluiten" : locale === "ar" ? "إغلاق" : "Close");
    const ctaHref = appendPopupParams(content.ctaHref, popupId);

    return (
        <PopupShell titleId={titleId} dir={dir} onDismiss={onDismiss} maxWidthClass="max-w-md">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-600 via-orange-500 to-amber-400 p-8 text-white shadow-[0_30px_80px_rgba(120,20,30,0.45)] sm:p-10">
                <CloseButton onClick={onDismiss} label={dismissLabel} />
                {eyebrow ? (
                    <div className="mb-4 inline-flex items-center rounded-full bg-black/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-white">
                        {eyebrow}
                    </div>
                ) : null}
                <h2 id={titleId} className="text-3xl font-extrabold leading-tight sm:text-4xl">
                    {title}
                </h2>
                <p className="mt-3 text-base leading-relaxed text-white/90">{body}</p>
                <a
                    href={ctaHref}
                    onClick={onConvert}
                    className="mt-7 inline-flex w-full items-center justify-center rounded-full bg-white px-6 py-4 text-base font-bold text-slate-900 transition hover:bg-slate-100"
                >
                    {ctaLabel}
                </a>
            </div>
        </PopupShell>
    );
}

// Append a `popup_id` query param to the CTA href so server-side analytics
// (and the booking flow) can correlate conversions back to the popup row
// even when the user navigates away from the page that rendered it.
function appendPopupParams(href: string, popupId: string): string {
    if (!href) return href;
    try {
        // Relative + absolute URLs both work via the URL constructor when
        // we provide a base.
        const url = new URL(href, "https://placeholder.local");
        url.searchParams.set("popup_id", popupId);
        url.searchParams.set("utm_source", "popup");
        url.searchParams.set("utm_medium", "site");
        url.searchParams.set("utm_campaign", popupId);
        // Strip the placeholder origin so relative hrefs stay relative.
        if (href.startsWith("/")) {
            return `${url.pathname}${url.search}${url.hash}`;
        }
        return url.toString();
    } catch {
        return href;
    }
}

const REGISTRY: Record<PopupTemplateKind, (props: PopupTemplateProps) => React.JSX.Element> = {
    "newsletter-classic": NewsletterClassicPopup,
    "newsletter-minimal": NewsletterMinimalPopup,
    "booking-promo": BookingPromoPopup,
    "booking-urgency": BookingUrgencyPopup,
};

export function renderPopupTemplate(kind: PopupTemplateKind, props: PopupTemplateProps) {
    const Component = REGISTRY[kind];
    if (!Component) return null;
    return <Component {...props} />;
}
