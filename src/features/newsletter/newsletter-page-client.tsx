"use client";

import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, Mail, Sparkles, Zap } from "lucide-react";
import { PublicPageHeroVisual } from "@/features/public-site/public-page-hero-visual";

type SupportedLocale = "en" | "nl" | "ar";

interface NewsletterPageClientProps {
    title: string;
    description: string;
    templateId: string;
    locale: SupportedLocale;
    brandName?: string;
    brandLogoUrl?: string;
}

interface Strings {
    eyebrow: string;
    placeholder: string;
    submit: string;
    submitting: string;
    privacy: string;
    successFallback: string;
    errorFallback: string;
    networkError: string;
    benefitsHeading: string;
    benefits: Array<{ icon: typeof Sparkles; title: string; description: string }>;
    emailLabel: string;
}

// iSystem house copy. Keeps the marketing tone consistent with the home /
// services pages — concise, founder-direct, no marketing fluff. The Arabic
// strings mirror the Dutch tone (casual but specific) rather than the more
// formal register used in some legal pages.
const STRINGS: Record<SupportedLocale, Strings> = {
    en: {
        eyebrow: "Source-backed operating notes",
        placeholder: "you@company.com",
        submit: "Subscribe",
        submitting: "Subscribing…",
        privacy: "Two short emails per month. Unsubscribe in a click.",
        successFallback: "You're in. Check your inbox for the first edition.",
        errorFallback: "Something went wrong. Please try again.",
        networkError: "Network error. Please try again.",
        benefitsHeading: "What you'll get",
        emailLabel: "Email address",
        benefits: [
            { icon: Sparkles, title: "Operating notes", description: "Short observations from governed workspace builds and SME AI adoption work." },
            { icon: Zap, title: "Source-backed signals", description: "Relevant regulation, market, and implementation signals with the noise removed." },
            { icon: BookOpen, title: "Practical methods", description: "Checklists and patterns we can explain, audit, and reuse." },
        ],
    },
    nl: {
        eyebrow: "Source-backed operating notes",
        placeholder: "jij@bedrijf.nl",
        submit: "Inschrijven",
        submitting: "Bezig…",
        privacy: "Twee korte e-mails per maand. Met één klik uit te schrijven.",
        successFallback: "Je bent erbij. Check je inbox voor de eerste editie.",
        errorFallback: "Er is iets misgegaan. Probeer het opnieuw.",
        networkError: "Netwerkfout. Probeer het opnieuw.",
        benefitsHeading: "Wat je krijgt",
        emailLabel: "E-mailadres",
        benefits: [
            { icon: Sparkles, title: "Operationele notities", description: "Korte observaties uit governed workspace-builds en mkb-AI-adoptie." },
            { icon: Zap, title: "Bron-gedragen signalen", description: "Relevante regulering, markt- en implementatiesignalen zonder ruis." },
            { icon: BookOpen, title: "Praktische methodes", description: "Checklists en patronen die we kunnen uitleggen, controleren en hergebruiken." },
        ],
    },
    ar: {
        eyebrow: "ملاحظات تشغيلية مدعومة بالمصادر",
        placeholder: "you@company.com",
        submit: "اشترك",
        submitting: "جارٍ الاشتراك…",
        privacy: "رسالتان قصيرتان شهريًا. ألغِ الاشتراك بنقرة واحدة.",
        successFallback: "تم! تحقّق من بريدك للحصول على العدد الأول.",
        errorFallback: "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
        networkError: "خطأ في الشبكة. حاول مرة أخرى.",
        benefitsHeading: "ما ستحصل عليه",
        emailLabel: "البريد الإلكتروني",
        benefits: [
            { icon: Sparkles, title: "ملاحظات تشغيلية", description: "مشاهدات قصيرة من بناء مساحات عمل محوكمة وتبنّي الذكاء الاصطناعي في الشركات الصغيرة." },
            { icon: Zap, title: "إشارات مدعومة بالمصادر", description: "تنظيمات وسوق وتنفيذ، بلا ضجيج زائد." },
            { icon: BookOpen, title: "طرق عملية", description: "قوائم تحقق وأنماط يمكن شرحها ومراجعتها وإعادة استخدامها." },
        ],
    },
};

export function NewsletterPageClient({ title, description, templateId, locale, brandName, brandLogoUrl }: NewsletterPageClientProps) {
    const strings = STRINGS[locale] ?? STRINGS.en;
    const [email, setEmail] = useState("");
    const [website, setWebsite] = useState("");
    // Captured once on mount so the anti-abuse layer can reject too-fast
    // submissions. Memoised so re-renders don't reset the timestamp.
    const formStartedAt = useMemo(() => new Date().toISOString(), []);
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!email || status === "loading") return;
        setStatus("loading");
        setMessage("");
        try {
            const res = await fetch("/api/newsletter/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    website,
                    formStartedAt,
                    templateId,
                    // Attribution: distinguishes /newsletter form submissions
                    // from popup conversions in the analytics events table.
                    source: "newsletter_page",
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setStatus("success");
                setMessage(data?.message || strings.successFallback);
                setEmail("");
            } else {
                setStatus("error");
                setMessage(data?.error || strings.errorFallback);
            }
        } catch {
            setStatus("error");
            setMessage(strings.networkError);
        }
    }

    return (
        <section
            className={`relative isolate overflow-hidden bg-slate-950 py-20 text-slate-50 sm:py-28 ${templateId === "isystem-agency" ? "isystem-newsletter-surface" : ""}`}
            data-isystem-public-surface={templateId === "isystem-agency" ? "" : undefined}
        >
            {/* Atmospheric blobs — same vocabulary as the iSystem home/contact
                pages. Two cyan washes positioned at opposite corners, blurred
                heavily, blended with screen so they read as ambient light. */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -z-10"
            >
                <div className="absolute -top-40 left-1/4 h-[520px] w-[520px] rounded-full bg-cyan-500/12 blur-[140px] mix-blend-screen" />
                <div className="absolute -bottom-32 right-1/5 h-[420px] w-[420px] rounded-full bg-violet-500/10 blur-[120px] mix-blend-screen" />
                <div
                    className="absolute inset-0 opacity-[0.06]"
                    style={{
                        backgroundImage:
                            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)",
                        backgroundSize: "32px 32px",
                    }}
                />
            </div>

            <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-14">
                    {/* Eyebrow + title */}
                    <div className="text-center lg:text-start" data-public-surface-intro>
                        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300 backdrop-blur-md">
                            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                            {strings.eyebrow}
                        </div>
                        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
                            {title}
                        </h1>
                        <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-slate-300 sm:text-lg lg:mx-0">
                            {description}
                        </p>
                    </div>
                    <PublicPageHeroVisual locale={locale} variant="newsletter" density="compact" brandName={brandName} brandLogoUrl={brandLogoUrl} />
                </div>

                {/* Subscribe card */}
                <div
                    className="relative mx-auto mt-16 max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_80px_rgba(0,15,40,0.5)] backdrop-blur-xl sm:p-10"
                    data-public-surface-block
                >
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-violet-500/5"
                    />

                    {status === "success" ? (
                        <div className="relative z-10 flex flex-col items-center gap-3 py-4 text-center">
                            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-5 py-2.5 text-sm font-medium text-emerald-300">
                                <span aria-hidden="true">✓</span>
                                {message || strings.successFallback}
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="relative z-10" noValidate>
                            {/* Honeypot — visually offscreen rather than
                                display:none so naïve form-fillers still touch
                                it (some bots skip display:none nodes). The
                                schema rejects any non-empty value. */}
                            <div className="absolute h-px w-px overflow-hidden whitespace-nowrap" style={{ clip: "rect(0 0 0 0)", clipPath: "inset(50%)" }} aria-hidden="true">
                                <label>
                                    Company website
                                    <input
                                        type="text"
                                        tabIndex={-1}
                                        autoComplete="off"
                                        value={website}
                                        onChange={(event) => setWebsite(event.target.value)}
                                    />
                                </label>
                            </div>

                            <label htmlFor="newsletter-email" className="sr-only">
                                {strings.emailLabel}
                            </label>
                            <div className="flex flex-col gap-3 sm:flex-row">
                                <input
                                    id="newsletter-email"
                                    type="email"
                                    inputMode="email"
                                    autoComplete="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder={strings.placeholder}
                                    required
                                    disabled={status === "loading"}
                                    className="h-12 flex-1 rounded-full border border-white/15 bg-white/5 px-5 text-sm text-white placeholder:text-white/40 focus:border-cyan-400/60 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-60"
                                />
                                <button
                                    type="submit"
                                    disabled={status === "loading"}
                                    className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-cyan-500 px-7 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(6,182,212,0.35)] transition-all hover:bg-cyan-400 hover:shadow-[0_0_36px_rgba(6,182,212,0.55)] focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
                                >
                                    {status === "loading" ? strings.submitting : strings.submit}
                                    {status !== "loading" ? (
                                        <ArrowRight
                                            className={locale === "ar" ? "h-4 w-4 rotate-180" : "h-4 w-4"}
                                            aria-hidden="true"
                                        />
                                    ) : null}
                                </button>
                            </div>
                            <p className="mt-4 text-center text-xs text-slate-400">
                                {strings.privacy}
                            </p>
                            {status === "error" ? (
                                <p
                                    role="alert"
                                    className="mt-3 text-center text-xs font-medium text-rose-300"
                                >
                                    {message}
                                </p>
                            ) : null}
                        </form>
                    )}
                </div>

                {/* Benefits */}
                <div className="mx-auto mt-14 max-w-3xl" data-public-surface-block>
                    <h2 className="text-center text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                        {strings.benefitsHeading}
                    </h2>
                    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        {strings.benefits.map((benefit) => {
                            const Icon = benefit.icon;
                            return (
                                <div
                                    key={benefit.title}
                                    className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 backdrop-blur-md transition-colors hover:border-cyan-400/30 hover:bg-slate-900/70"
                                >
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                                        <Icon className="h-4 w-4" aria-hidden="true" />
                                    </div>
                                    <h3 className="mt-4 text-sm font-semibold text-white">
                                        {benefit.title}
                                    </h3>
                                    <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                                        {benefit.description}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
}
