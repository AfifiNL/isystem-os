"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Locale } from "@/features/templates/types";
import {
    ACCEPT_ALL,
    REJECT_ALL,
    readConsentFromBrowserCookie,
    writeConsentToBrowserCookie,
    type ConsentChoice,
} from "@/features/gdpr/consent";

interface CookieConsentBannerProps {
    locale: Locale;
    privacyHref: string;
    termsHref: string;
    /** When true, the customize panel can be reopened from a global event. */
    listenForReopen?: boolean;
}

interface Copy {
    title: string;
    body: string;
    acceptAll: string;
    rejectAll: string;
    customize: string;
    savePrefs: string;
    privacy: string;
    terms: string;
    essential: string;
    essentialDesc: string;
    analytics: string;
    analyticsDesc: string;
    marketing: string;
    marketingDesc: string;
    learnMore: string;
    close: string;
}

const COPY: Record<Locale, Copy> = {
    en: {
        title: "We respect your privacy",
        body: "We use essential cookies to run this site. With your consent, we also use analytics and marketing cookies to understand how visitors engage with our services and to improve what we ship.",
        acceptAll: "Accept all",
        rejectAll: "Reject non-essential",
        customize: "Customize",
        savePrefs: "Save preferences",
        privacy: "Privacy Policy",
        terms: "Terms",
        essential: "Essential",
        essentialDesc: "Required for the site to function. Always on.",
        analytics: "Analytics",
        analyticsDesc: "Helps us understand which pages, tools, and content matter to visitors.",
        marketing: "Marketing",
        marketingDesc: "Lets us measure campaign performance and attribute referrals.",
        learnMore: "Learn more",
        close: "Close",
    },
    nl: {
        title: "Wij respecteren je privacy",
        body: "We gebruiken essentiële cookies om deze site te laten werken. Met je toestemming gebruiken we ook analyse- en marketingcookies om te begrijpen hoe bezoekers onze diensten gebruiken en om te verbeteren wat we leveren.",
        acceptAll: "Alles accepteren",
        rejectAll: "Niet-essentieel weigeren",
        customize: "Aanpassen",
        savePrefs: "Voorkeuren opslaan",
        privacy: "Privacybeleid",
        terms: "Voorwaarden",
        essential: "Essentieel",
        essentialDesc: "Vereist voor de werking van de site. Altijd aan.",
        analytics: "Analyse",
        analyticsDesc: "Helpt ons begrijpen welke pagina's, tools en content belangrijk zijn.",
        marketing: "Marketing",
        marketingDesc: "Maakt het meten van campagnes en het toewijzen van verwijzingen mogelijk.",
        learnMore: "Meer weten",
        close: "Sluiten",
    },
    ar: {
        title: "نحترم خصوصيتك",
        body: "نستخدم ملفات تعريف الارتباط الأساسية لتشغيل هذا الموقع. وبموافقتك، نستخدم أيضًا ملفات تعريف للتحليلات والتسويق لفهم كيفية تفاعل الزوار مع خدماتنا وتحسين ما نقدّمه.",
        acceptAll: "قبول الكل",
        rejectAll: "رفض غير الأساسية",
        customize: "تخصيص",
        savePrefs: "حفظ التفضيلات",
        privacy: "سياسة الخصوصية",
        terms: "الشروط",
        essential: "أساسية",
        essentialDesc: "ضرورية لعمل الموقع. مفعّلة دائمًا.",
        analytics: "تحليلات",
        analyticsDesc: "يساعدنا على فهم الصفحات والأدوات والمحتوى الأهم للزوار.",
        marketing: "تسويق",
        marketingDesc: "يتيح قياس أداء الحملات وإسناد الإحالات.",
        learnMore: "اقرأ المزيد",
        close: "إغلاق",
    },
};

export const REOPEN_EVENT = "ix-consent:reopen";

export function CookieConsentBanner({
    locale,
    privacyHref,
    termsHref,
    listenForReopen = true,
}: CookieConsentBannerProps) {
    const t = COPY[locale] ?? COPY.en;
    const isRtl = locale === "ar";

    const [visible, setVisible] = useState(false);
    const [showPanel, setShowPanel] = useState(false);
    const [analytics, setAnalytics] = useState(false);
    const [marketing, setMarketing] = useState(false);

    // First-paint: decide whether to show the banner based on the consent
    // cookie. Reading happens on the client to avoid hydration mismatch — the
    // banner is presentational, so a brief delay on first paint is acceptable.
    useEffect(() => {
        const existing = readConsentFromBrowserCookie();
        if (!existing) {
            setVisible(true);
        } else {
            setAnalytics(existing.analytics);
            setMarketing(existing.marketing);
        }
    }, []);

    // Allow other parts of the UI (footer link, settings) to reopen the panel.
    useEffect(() => {
        if (!listenForReopen) return;
        const onReopen = () => {
            const existing = readConsentFromBrowserCookie();
            if (existing) {
                setAnalytics(existing.analytics);
                setMarketing(existing.marketing);
            }
            setShowPanel(true);
            setVisible(true);
        };
        window.addEventListener(REOPEN_EVENT, onReopen);
        return () => window.removeEventListener(REOPEN_EVENT, onReopen);
    }, [listenForReopen]);

    const dispatchConsentChange = useCallback((choice: ConsentChoice) => {
        window.dispatchEvent(
            new CustomEvent("ix-consent:change", { detail: choice }),
        );
    }, []);

    const persistAndClose = useCallback(
        (choice: Omit<ConsentChoice, "ts">) => {
            writeConsentToBrowserCookie(choice);
            dispatchConsentChange({ ...choice, ts: Date.now() });
            setVisible(false);
            setShowPanel(false);
        },
        [dispatchConsentChange],
    );

    const handleAcceptAll = useCallback(() => persistAndClose(ACCEPT_ALL), [persistAndClose]);
    const handleRejectAll = useCallback(() => persistAndClose(REJECT_ALL), [persistAndClose]);
    const handleSavePrefs = useCallback(() => {
        persistAndClose({ v: 1, essential: true, analytics, marketing });
    }, [analytics, marketing, persistAndClose]);

    const dialogId = useMemo(() => `ix-consent-${Math.random().toString(36).slice(2, 8)}`, []);

    if (!visible) return null;

    return (
        <div
            role="dialog"
            aria-modal="false"
            aria-labelledby={`${dialogId}-title`}
            aria-describedby={`${dialogId}-body`}
            dir={isRtl ? "rtl" : "ltr"}
            className="fixed inset-x-3 bottom-3 z-[60] flex justify-center pointer-events-none sm:inset-x-6 sm:bottom-6 md:justify-end"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
            <div className="pointer-events-auto w-full max-w-[36rem] overflow-hidden rounded-2xl border border-slate-200/70 bg-white/95 shadow-[0_24px_60px_-24px_rgba(13,79,140,0.45)] backdrop-blur-xl ring-1 ring-slate-900/5">
                <div className="relative px-5 pt-5 sm:px-6 sm:pt-6">
                    <div className={`absolute ${isRtl ? "left-4" : "right-4"} top-4 hidden h-1 w-12 rounded-full bg-gradient-to-r from-[#0d4f8c]/70 to-[#0d4f8c]/10 md:block`} aria-hidden="true" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0d4f8c]">
                        {t.privacy}
                    </p>
                    <h2 id={`${dialogId}-title`} className="mt-1 text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
                        {t.title}
                    </h2>
                    <p id={`${dialogId}-body`} className="mt-2 text-sm leading-6 text-slate-600">
                        {t.body}{" "}
                        <a
                            href={privacyHref}
                            className="font-semibold text-[#0d4f8c] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d4f8c]/50 rounded-sm"
                        >
                            {t.learnMore}
                        </a>
                    </p>
                </div>

                {showPanel && (
                    <div className="mt-4 grid gap-2 border-t border-slate-200/70 bg-slate-50/60 px-5 py-4 sm:px-6">
                        <PreferenceRow
                            title={t.essential}
                            description={t.essentialDesc}
                            checked
                            disabled
                            onChange={() => undefined}
                        />
                        <PreferenceRow
                            title={t.analytics}
                            description={t.analyticsDesc}
                            checked={analytics}
                            onChange={setAnalytics}
                        />
                        <PreferenceRow
                            title={t.marketing}
                            description={t.marketingDesc}
                            checked={marketing}
                            onChange={setMarketing}
                        />
                    </div>
                )}

                <div className="flex flex-col gap-2 px-5 pb-5 pt-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:pb-6">
                    <a
                        href={termsHref}
                        className="hidden text-xs text-slate-500 underline-offset-4 hover:text-slate-700 hover:underline sm:inline"
                    >
                        {t.terms}
                    </a>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                        {!showPanel && (
                            <button
                                type="button"
                                onClick={() => setShowPanel(true)}
                                className="inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d4f8c]/40"
                            >
                                {t.customize}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleRejectAll}
                            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d4f8c]/40"
                        >
                            {t.rejectAll}
                        </button>
                        {showPanel ? (
                            <button
                                type="button"
                                onClick={handleSavePrefs}
                                className="inline-flex h-9 items-center justify-center rounded-md bg-[#0d4f8c] px-4 text-sm font-semibold text-white shadow-[0_8px_20px_-12px_rgba(13,79,140,0.6)] transition-transform hover:-translate-y-px hover:bg-[#0c4882] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d4f8c]/60"
                            >
                                {t.savePrefs}
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleAcceptAll}
                                className="inline-flex h-9 items-center justify-center rounded-md bg-[#0d4f8c] px-4 text-sm font-semibold text-white shadow-[0_8px_20px_-12px_rgba(13,79,140,0.6)] transition-transform hover:-translate-y-px hover:bg-[#0c4882] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d4f8c]/60"
                            >
                                {t.acceptAll}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function PreferenceRow({
    title,
    description,
    checked,
    disabled,
    onChange,
}: {
    title: string;
    description: string;
    checked: boolean;
    disabled?: boolean;
    onChange: (next: boolean) => void;
}) {
    return (
        <label className="flex items-start justify-between gap-3 rounded-lg border border-slate-200/80 bg-white/80 px-3 py-2.5">
            <span className="flex-1">
                <span className="block text-sm font-semibold text-slate-900">{title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span>
            </span>
            <span className="relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center">
                <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => onChange(e.target.checked)}
                    className="peer sr-only"
                />
                <span
                    aria-hidden="true"
                    className={`absolute inset-0 rounded-full transition-colors ${
                        checked ? "bg-[#0d4f8c]" : "bg-slate-300"
                    } ${disabled ? "opacity-60" : ""}`}
                />
                <span
                    aria-hidden="true"
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        checked ? "translate-x-4 rtl:-translate-x-4" : "translate-x-0.5 rtl:-translate-x-0.5"
                    }`}
                />
            </span>
        </label>
    );
}
