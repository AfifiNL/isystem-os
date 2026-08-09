"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CalendarCheck, Calculator, Lock, Printer, Sparkles, TrendingDown, Workflow } from "lucide-react";
import {
    AuditInputs,
    AuditOutputs,
    EMPTY_AUDIT_INPUTS,
    calculateAuditOutputs,
    hasMeaningfulAuditInputs,
    sanitizeAuditInputs,
} from "./lib/calculations";
import { PublicPageHeroVisual } from "@/features/public-site/public-page-hero-visual";

type SupportedLocale = "en" | "nl" | "ar";

interface AuditPageClientProps {
    title: string;
    description: string;
    templateId: string;
    locale: SupportedLocale;
    bookingUrl?: string;
    brandName?: string;
    brandLogoUrl?: string;
}

interface Strings {
    eyebrow: string;
    cta: string;
    submitting: string;
    moduleOneTitle: string;
    moduleOneSubtitle: string;
    moduleTwoTitle: string;
    moduleTwoSubtitle: string;
    fields: Record<keyof AuditInputs, { label: string; helper?: string }>;
    teaserHeadline: string;
    teaserCopy: string;
    annualSaas: string;
    annualBleed: string;
    nameLabel: string;
    namePlaceholder: string;
    emailLabel: string;
    emailPlaceholder: string;
    unlock: string;
    unlocking: string;
    privacy: string;
    networkError: string;
    errorFallback: string;
    inputsRequired: string;
    revealEyebrow: string;
    revealHeadline: string;
    consolidationLabel: string;
    consolidationHint: string;
    automationLabel: string;
    automationHint: string;
    combinedLabel: string;
    combinedHint: string;
    bookingCta: string;
    printCta: string;
    summaryFor: string;
    poweredBy: string;
}

const STRINGS: Record<SupportedLocale, Strings> = {
    en: {
        eyebrow: "Systems audit",
        cta: "See your numbers",
        submitting: "Calculating…",
        moduleOneTitle: "Tech stack fragmentation",
        moduleOneSubtitle: "Monthly spend on the four pillars most companies pay for separately.",
        moduleTwoTitle: "Automation ROI",
        moduleTwoSubtitle: "Estimated capacity tied up in repetitive workflows.",
        fields: {
            crm_spend: { label: "CRM / Sales tools (per month)", helper: "HubSpot, Salesforce, Pipedrive, etc." },
            marketing_spend: { label: "Email / marketing software (per month)", helper: "Mailchimp, Klaviyo, ActiveCampaign." },
            cms_spend: { label: "CMS / website hosting (per month)", helper: "Webflow, WordPress hosting, Contentful." },
            ops_spend: { label: "Operations / project management (per month)", helper: "Asana, Monday, ClickUp, Notion." },
            employee_count: { label: "Employees affected", helper: "People doing the manual work." },
            hours_wasted: { label: "Hours per week (per employee)", helper: "On repetitive, copy-paste tasks." },
            hourly_rate: { label: "Loaded hourly rate", helper: "Salary plus benefits and overhead." },
        },
        teaserHeadline: "The first estimates are ready.",
        teaserCopy: "We've calculated the first view. Add your email to unlock the full breakdown, including the assumptions behind the modeled savings and recovered capacity.",
        annualSaas: "Total annual SaaS spend",
        annualBleed: "Estimated annual manual-work cost",
        nameLabel: "Full name",
        namePlaceholder: "Mary van der Berg",
        emailLabel: "Work email",
        emailPlaceholder: "you@company.com",
        unlock: "Unlock full results",
        unlocking: "Unlocking…",
        privacy: "We send one short follow-up. No newsletter spam, unsubscribe in a click.",
        networkError: "Network error. Please try again.",
        errorFallback: "Something went wrong. Please try again.",
        inputsRequired: "Add at least one figure above so we can calculate.",
        revealEyebrow: "Your audit",
        revealHeadline: "Here is the modeled opportunity.",
        consolidationLabel: "Software consolidation savings",
        consolidationHint: "Annualised. Assumes a 45% reduction in software overhead.",
        automationLabel: "Projected automation recovery",
        automationHint: "Annualised. Assumes a 75% reduction in manual workflows.",
        combinedLabel: "Combined annual upside",
        combinedHint: "Software you stop paying for, plus team time you reclaim.",
        bookingCta: "Book the free 30-minute Systems Fit Call",
        printCta: "Download as PDF",
        summaryFor: "Audit summary for",
        poweredBy: "Systems Audit",
    },
    nl: {
        eyebrow: "Systeemaudit",
        cta: "Bekijk jouw cijfers",
        submitting: "Berekenen…",
        moduleOneTitle: "Tech stack fragmentatie",
        moduleOneSubtitle: "Maandelijkse uitgaven aan de vier pijlers die de meeste bedrijven los betalen.",
        moduleTwoTitle: "Automatisering ROI",
        moduleTwoSubtitle: "Geschatte capaciteit die vastzit in repetitief werk.",
        fields: {
            crm_spend: { label: "CRM / sales tools (per maand)", helper: "HubSpot, Salesforce, Pipedrive, etc." },
            marketing_spend: { label: "E-mail / marketing software (per maand)", helper: "Mailchimp, Klaviyo, ActiveCampaign." },
            cms_spend: { label: "CMS / website hosting (per maand)", helper: "Webflow, WordPress hosting, Contentful." },
            ops_spend: { label: "Operations / projectmanagement (per maand)", helper: "Asana, Monday, ClickUp, Notion." },
            employee_count: { label: "Aantal medewerkers", helper: "Mensen die het handwerk doen." },
            hours_wasted: { label: "Uren per week (per medewerker)", helper: "Aan repetitieve copy-paste taken." },
            hourly_rate: { label: "Volledig uurtarief", helper: "Salaris plus secundair en overhead." },
        },
        teaserHeadline: "De eerste schattingen zijn klaar.",
        teaserCopy: "We hebben je input doorgerekend. Laat je e-mail achter voor de volledige uitsplitsing, inclusief de aannames achter de berekende besparing en capaciteit.",
        annualSaas: "Totale jaarlijkse SaaS-uitgaven",
        annualBleed: "Geschatte jaarlijkse kosten van handwerk",
        nameLabel: "Volledige naam",
        namePlaceholder: "Mary van der Berg",
        emailLabel: "Zakelijk e-mail",
        emailPlaceholder: "jij@bedrijf.nl",
        unlock: "Resultaten ontgrendelen",
        unlocking: "Bezig…",
        privacy: "Eén korte follow-up. Geen nieuwsbriefspam, met één klik uit te schrijven.",
        networkError: "Netwerkfout. Probeer het opnieuw.",
        errorFallback: "Er is iets misgegaan. Probeer het opnieuw.",
        inputsRequired: "Vul ten minste één veld in zodat we kunnen rekenen.",
        revealEyebrow: "Jouw audit",
        revealHeadline: "Dit is de berekende kans.",
        consolidationLabel: "Softwareconsolidatiebesparing",
        consolidationHint: "Op jaarbasis. Uitgaande van 45% minder software-overhead.",
        automationLabel: "Verwachte automatiseringswinst",
        automationHint: "Op jaarbasis. Uitgaande van 75% minder handmatig werk.",
        combinedLabel: "Gecombineerde jaarwinst",
        combinedHint: "Software die je niet meer betaalt, plus tijd die je terugwint.",
        bookingCta: "Plan de gratis Systems Fit Call van 30 minuten",
        printCta: "Download als PDF",
        summaryFor: "Audit-samenvatting voor",
        poweredBy: "Systeemaudit",
    },
    ar: {
        eyebrow: "تدقيق الأنظمة",
        cta: "اعرض أرقامك",
        submitting: "جارٍ الحساب…",
        moduleOneTitle: "تشتّت حزمة التقنيات",
        moduleOneSubtitle: "الإنفاق الشهري على الأركان الأربعة التي تدفعها معظم الشركات بشكل منفصل.",
        moduleTwoTitle: "عائد الأتمتة",
        moduleTwoSubtitle: "القدرة التقديرية العالقة في العمل المتكرر.",
        fields: {
            crm_spend: { label: "أدوات CRM / المبيعات (شهريًا)", helper: "HubSpot، Salesforce، Pipedrive." },
            marketing_spend: { label: "البريد / برامج التسويق (شهريًا)", helper: "Mailchimp، Klaviyo، ActiveCampaign." },
            cms_spend: { label: "نظام إدارة المحتوى / الاستضافة (شهريًا)", helper: "Webflow، WordPress، Contentful." },
            ops_spend: { label: "العمليات / إدارة المشاريع (شهريًا)", helper: "Asana، Monday، ClickUp، Notion." },
            employee_count: { label: "عدد الموظفين المتأثرين", helper: "الأشخاص الذين يقومون بالعمل اليدوي." },
            hours_wasted: { label: "ساعات أسبوعية (لكل موظف)", helper: "على المهام المتكررة." },
            hourly_rate: { label: "التكلفة الشاملة لكل ساعة", helper: "الراتب مع المزايا والتكاليف الإدارية." },
        },
        teaserHeadline: "التقديرات الأولى جاهزة.",
        teaserCopy: "حسبنا المدخلات الأولى. أضف بريدك لفتح التفاصيل الكاملة، بما في ذلك الافتراضات وراء الوفورات والقدرة المحسوبة.",
        annualSaas: "إجمالي الإنفاق السنوي على SaaS",
        annualBleed: "التكلفة السنوية التقديرية للعمل اليدوي",
        nameLabel: "الاسم الكامل",
        namePlaceholder: "ماري فان دير بيرغ",
        emailLabel: "البريد المهني",
        emailPlaceholder: "you@company.com",
        unlock: "افتح النتائج الكاملة",
        unlocking: "جارٍ الفتح…",
        privacy: "متابعة واحدة قصيرة فقط. ألغِ الاشتراك بنقرة واحدة.",
        networkError: "خطأ في الشبكة. حاول مرة أخرى.",
        errorFallback: "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
        inputsRequired: "أدخل قيمة واحدة على الأقل لنتمكن من الحساب.",
        revealEyebrow: "تدقيقك",
        revealHeadline: "هذه هي الفرصة المحسوبة.",
        consolidationLabel: "وفورات توحيد البرامج",
        consolidationHint: "سنويًا. بافتراض خفض 45% من تكاليف البرامج.",
        automationLabel: "العائد المتوقع من الأتمتة",
        automationHint: "سنويًا. بافتراض خفض 75% من المهام اليدوية.",
        combinedLabel: "إجمالي المكسب السنوي",
        combinedHint: "برامج تتوقف عن دفعها، ووقت تستردّه لفريقك.",
        bookingCta: "احجز مكالمة ملاءمة الأنظمة المجانية لمدة 30 دقيقة",
        printCta: "تنزيل كـ PDF",
        summaryFor: "ملخص التدقيق لـ",
        poweredBy: "تدقيق الأنظمة",
    },
};

type Step = "inputs" | "gate" | "unlocked";

const MODULE_ONE_FIELDS: Array<keyof AuditInputs> = ["crm_spend", "marketing_spend", "cms_spend", "ops_spend"];
const MODULE_TWO_FIELDS: Array<keyof AuditInputs> = ["employee_count", "hours_wasted", "hourly_rate"];

export function AuditPageClient({ title, description, templateId, locale, bookingUrl = "/booking", brandName, brandLogoUrl }: AuditPageClientProps) {
    const strings = STRINGS[locale] ?? STRINGS.en;
    const isRtl = locale === "ar";

    const [inputs, setInputs] = useState<AuditInputs>(EMPTY_AUDIT_INPUTS);
    const [step, setStep] = useState<Step>("inputs");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [website, setWebsite] = useState("");
    const formStartedAt = useMemo(() => new Date().toISOString(), []);
    const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState("");

    const outputs: AuditOutputs = useMemo(() => calculateAuditOutputs(inputs), [inputs]);
    const canAdvance = hasMeaningfulAuditInputs(inputs);

    const formatCurrency = useMemo(() => {
        // iSystem prices and commercial examples are denominated in EUR. Keep
        // the diagnostic consistent across EN, NL, and AR rather than making
        // the English route look like a US-market calculator.
        const currency = "EUR";
        const intlLocale = locale === "ar" ? "en" : locale;
        return new Intl.NumberFormat(intlLocale, {
            style: "currency",
            currency,
            maximumFractionDigits: 0,
        });
    }, [locale]);

    const formatNumber = useMemo(() => {
        return new Intl.NumberFormat(locale === "ar" ? "en" : locale, { maximumFractionDigits: 0 });
    }, [locale]);

    function updateField(key: keyof AuditInputs, raw: string) {
        const sanitized = sanitizeAuditInputs({ ...inputs, [key]: raw });
        setInputs(sanitized);
    }

    function goToGate() {
        if (!canAdvance) return;
        setStep("gate");
        // Defer the scroll so the gate section has actually mounted before we
        // try to focus it. Cheap rAF beats setTimeout(0) for layout safety.
        requestAnimationFrame(() => {
            document.getElementById("audit-gate")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    }

    async function handleUnlock(event: React.FormEvent) {
        event.preventDefault();
        if (status === "loading") return;
        if (!name.trim() || !email.trim()) return;
        setStatus("loading");
        setErrorMessage("");
        try {
            const res = await fetch("/api/audit/submit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    email: email.trim(),
                    website,
                    formStartedAt,
                    templateId,
                    locale,
                    inputs,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setStatus("error");
                setErrorMessage(data?.error ?? strings.errorFallback);
                return;
            }
            setStatus("idle");
            setStep("unlocked");
            requestAnimationFrame(() => {
                document.getElementById("audit-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        } catch {
            setStatus("error");
            setErrorMessage(strings.networkError);
        }
    }

    function handlePrint() {
        if (typeof window === "undefined") return;
        // Browser print dialog "Save as PDF" is good enough for v1: zero
        // dependencies, native UX, prints the dedicated print-only summary
        // section we mark up further down.
        window.print();
    }

    return (
        <section
            dir={isRtl ? "rtl" : undefined}
            data-isystem-public-surface={templateId === "isystem-agency" ? "" : undefined}
            className={`relative isolate overflow-hidden bg-slate-950 py-20 text-slate-50 sm:py-28 print:bg-white print:py-0 print:text-slate-900 ${
                templateId === "isystem-agency" ? "isystem-audit-surface" : ""
            }`}
        >
            {/* Atmosphere — kept identical to the newsletter / contact pages so
                the audit reads as part of the same brand language, not a
                bolt-on. Hidden on print to keep the PDF clean. */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 print:hidden">
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

            <div className="mx-auto max-w-4xl px-4 sm:px-6 print:max-w-none print:px-0">
                <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-12">
                    <div className="text-center print:hidden lg:text-start" data-public-surface-intro>
                        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300 backdrop-blur-md">
                            <Calculator className="h-3.5 w-3.5" aria-hidden="true" />
                            {strings.eyebrow}
                        </div>
                        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
                        <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-slate-300 sm:text-lg lg:mx-0">
                            {description}
                        </p>
                    </div>
                    <div className="print:hidden">
                        <PublicPageHeroVisual locale={locale} variant="audit" density="compact" brandName={brandName} brandLogoUrl={brandLogoUrl} />
                    </div>
                </div>

                {/* Stage 1: input modules. Always rendered so users can revise
                    after seeing the teaser; we just collapse the affordance. */}
                <div className="mt-16 grid gap-6 sm:grid-cols-2 print:hidden" data-public-surface-block>
                    <ModuleCard
                        icon={<TrendingDown className="h-4 w-4" aria-hidden="true" />}
                        title={strings.moduleOneTitle}
                        subtitle={strings.moduleOneSubtitle}
                    >
                        {MODULE_ONE_FIELDS.map((key) => (
                            <NumberField
                                key={key}
                                id={`audit-${key}`}
                                label={strings.fields[key].label}
                                helper={strings.fields[key].helper}
                                value={inputs[key]}
                                onChange={(raw) => updateField(key, raw)}
                                isRtl={isRtl}
                                prefix={key === "ops_spend" || key === "cms_spend" || key === "marketing_spend" || key === "crm_spend" ? "currency" : undefined}
                                currencySymbol="€"
                            />
                        ))}
                    </ModuleCard>

                    <ModuleCard
                        icon={<Workflow className="h-4 w-4" aria-hidden="true" />}
                        title={strings.moduleTwoTitle}
                        subtitle={strings.moduleTwoSubtitle}
                    >
                        {MODULE_TWO_FIELDS.map((key) => (
                            <NumberField
                                key={key}
                                id={`audit-${key}`}
                                label={strings.fields[key].label}
                                helper={strings.fields[key].helper}
                                value={inputs[key]}
                                onChange={(raw) => updateField(key, raw)}
                                isRtl={isRtl}
                                prefix={key === "hourly_rate" ? "currency" : undefined}
                                currencySymbol="€"
                            />
                        ))}
                    </ModuleCard>
                </div>

                {step === "inputs" ? (
                    <div className="mt-8 flex flex-col items-center gap-3 print:hidden">
                        <button
                            type="button"
                            onClick={goToGate}
                            disabled={!canAdvance}
                            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-cyan-500 px-7 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(6,182,212,0.35)] transition-all hover:bg-cyan-400 hover:shadow-[0_0_36px_rgba(6,182,212,0.55)] focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
                        >
                            {strings.cta}
                            <ArrowRight className={isRtl ? "h-4 w-4 rotate-180" : "h-4 w-4"} aria-hidden="true" />
                        </button>
                        {!canAdvance ? (
                            <p className="text-xs text-slate-400">{strings.inputsRequired}</p>
                        ) : null}
                    </div>
                ) : null}

                {/* Stage 2: gate. Teaser metrics blurred, lead-capture form. */}
                {step === "gate" || step === "unlocked" ? (
                    <div
                        id="audit-gate"
                        data-public-surface-block
                        className={
                            step === "unlocked"
                                ? "hidden"
                                : "relative mt-12 overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_80px_rgba(0,15,40,0.5)] backdrop-blur-xl sm:p-10 print:hidden"
                        }
                    >
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-violet-500/5"
                        />
                        <div className="relative z-10">
                            <div className="grid gap-6 sm:grid-cols-2">
                                <TeaserMetric
                                    label={strings.annualSaas}
                                    value={formatCurrency.format(outputs.total_annual_saas_spend)}
                                />
                                <TeaserMetric
                                    label={strings.annualBleed}
                                    value={formatCurrency.format(outputs.annual_productivity_bleed)}
                                />
                            </div>

                            <div className="mt-8 flex items-center gap-2 text-cyan-300">
                                <Sparkles className="h-4 w-4" aria-hidden="true" />
                                <span className="text-xs font-semibold uppercase tracking-[0.22em]">
                                    {strings.teaserHeadline}
                                </span>
                            </div>
                            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-300">
                                {strings.teaserCopy}
                            </p>

                            <form onSubmit={handleUnlock} className="mt-6 space-y-4" noValidate>
                                {/* Honeypot — same offscreen pattern as the newsletter form. */}
                                <div
                                    className="absolute h-px w-px overflow-hidden whitespace-nowrap"
                                    style={{ clip: "rect(0 0 0 0)", clipPath: "inset(50%)" }}
                                    aria-hidden="true"
                                >
                                    <label>
                                        Company website
                                        <input
                                            type="text"
                                            tabIndex={-1}
                                            autoComplete="off"
                                            value={website}
                                            onChange={(e) => setWebsite(e.target.value)}
                                        />
                                    </label>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="flex flex-col gap-1.5">
                                        <label htmlFor="audit-name" className="text-xs font-medium text-slate-300">
                                            {strings.nameLabel}
                                        </label>
                                        <input
                                            id="audit-name"
                                            type="text"
                                            autoComplete="name"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder={strings.namePlaceholder}
                                            required
                                            disabled={status === "loading"}
                                            className="h-11 rounded-xl border border-white/15 bg-white/5 px-4 text-sm text-white placeholder:text-white/40 focus:border-cyan-400/60 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-60"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label htmlFor="audit-email" className="text-xs font-medium text-slate-300">
                                            {strings.emailLabel}
                                        </label>
                                        <input
                                            id="audit-email"
                                            type="email"
                                            inputMode="email"
                                            autoComplete="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder={strings.emailPlaceholder}
                                            required
                                            disabled={status === "loading"}
                                            className="h-11 rounded-xl border border-white/15 bg-white/5 px-4 text-sm text-white placeholder:text-white/40 focus:border-cyan-400/60 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-60"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col items-start gap-3 pt-1">
                                    <button
                                        type="submit"
                                        disabled={status === "loading" || !name.trim() || !email.trim()}
                                        className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-cyan-500 px-7 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(6,182,212,0.35)] transition-all hover:bg-cyan-400 hover:shadow-[0_0_36px_rgba(6,182,212,0.55)] focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
                                    >
                                        <Lock className="h-4 w-4" aria-hidden="true" />
                                        {status === "loading" ? strings.unlocking : strings.unlock}
                                    </button>
                                    <p className="text-xs text-slate-400">{strings.privacy}</p>
                                    {status === "error" ? (
                                        <p role="alert" className="text-xs font-medium text-rose-300">
                                            {errorMessage}
                                        </p>
                                    ) : null}
                                </div>
                            </form>
                        </div>
                    </div>
                ) : null}

                {/* Stage 3: full reveal. Print-targeted, so the PDF is just
                    the summary plus the user's submitted inputs. */}
                {step === "unlocked" ? (
                    <div
                        id="audit-results"
                        className="mt-12 space-y-6 print:mt-0 print:space-y-4"
                        data-public-surface-block
                    >
                        <div className="hidden print:block">
                            <h2 className="text-2xl font-bold">{strings.poweredBy}{brandName ? ` · ${brandName}` : ""}</h2>
                            <p className="mt-1 text-sm text-slate-700">
                                {strings.summaryFor} <strong>{name}</strong> ({email})
                            </p>
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 backdrop-blur-xl sm:p-10 print:rounded-lg print:border print:border-slate-300 print:bg-white print:p-6 print:shadow-none">
                            <div className="flex items-center gap-2 text-cyan-300 print:text-slate-700">
                                <Sparkles className="h-4 w-4" aria-hidden="true" />
                                <span className="text-xs font-semibold uppercase tracking-[0.22em]">
                                    {strings.revealEyebrow}
                                </span>
                            </div>
                            <h2 className="mt-3 text-balance text-2xl font-bold tracking-tight sm:text-3xl print:text-slate-900">
                                {strings.revealHeadline}
                            </h2>

                            <div className="mt-8 grid gap-4 sm:grid-cols-2">
                                <ResultMetric
                                    label={strings.consolidationLabel}
                                    hint={strings.consolidationHint}
                                    value={formatCurrency.format(outputs.isystem_consolidation_savings)}
                                    accent="cyan"
                                />
                                <ResultMetric
                                    label={strings.automationLabel}
                                    hint={strings.automationHint}
                                    value={formatCurrency.format(outputs.projected_automation_recovery)}
                                    accent="violet"
                                />
                            </div>

                            <div className="mt-6 rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/15 via-cyan-400/5 to-violet-500/10 p-6 print:rounded-lg print:border-slate-300 print:bg-slate-50">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200 print:text-slate-700">
                                    {strings.combinedLabel}
                                </p>
                                <p className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl print:text-slate-900">
                                    {formatCurrency.format(outputs.combined_annual_savings)}
                                </p>
                                <p className="mt-2 text-xs text-slate-300 print:text-slate-600">
                                    {strings.combinedHint}
                                </p>
                            </div>

                            <div className="mt-8 flex flex-wrap items-center gap-3 print:hidden">
                                <a
                                    href={bookingUrl}
                                    className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-cyan-500 px-7 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(6,182,212,0.35)] transition-all hover:bg-cyan-400 hover:shadow-[0_0_36px_rgba(6,182,212,0.55)] focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-900"
                                >
                                    <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                                    {strings.bookingCta}
                                </a>
                                <button
                                    type="button"
                                    onClick={handlePrint}
                                    className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 text-sm font-medium text-white transition-colors hover:border-cyan-400/40 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-900"
                                >
                                    <Printer className="h-4 w-4" aria-hidden="true" />
                                    {strings.printCta}
                                </button>
                            </div>
                        </div>

                        {/* Inputs echoed into the print version so the PDF
                            tells the operator (and the user) exactly which
                            numbers produced the savings figure. */}
                        <div className="hidden print:block">
                            <h3 className="text-sm font-semibold text-slate-900">Submitted inputs</h3>
                            <table className="mt-2 w-full text-left text-xs text-slate-700">
                                <tbody>
                                    {(Object.keys(strings.fields) as Array<keyof AuditInputs>).map((key) => (
                                        <tr key={key} className="border-b border-slate-200">
                                            <td className="py-1.5 pr-4">{strings.fields[key].label}</td>
                                            <td className="py-1.5 text-right font-medium">
                                                {key === "employee_count" || key === "hours_wasted"
                                                    ? formatNumber.format(inputs[key])
                                                    : formatCurrency.format(inputs[key])}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : null}
            </div>

            {/* Print-only rules. Keep this scoped to the audit page so we
                don't accidentally restyle the rest of the site when the
                audit page is printed in isolation. */}
            <style>{`
                @media print {
                    @page { margin: 18mm; }
                    body { background: white !important; }
                    nav, footer, [aria-hidden="true"]:not(.print\\:block) { display: none !important; }
                }
            `}</style>
        </section>
    );
}

interface ModuleCardProps {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    children: React.ReactNode;
}

function ModuleCard({ icon, title, subtitle, children }: ModuleCardProps) {
    return (
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-xl">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-transparent"
            />
            <div className="relative z-10">
                <div className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                        {icon}
                    </span>
                    <h3 className="text-sm font-semibold text-white">{title}</h3>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{subtitle}</p>
                <div className="mt-5 space-y-4">{children}</div>
            </div>
        </div>
    );
}

interface NumberFieldProps {
    id: string;
    label: string;
    helper?: string;
    value: number;
    onChange: (raw: string) => void;
    isRtl: boolean;
    prefix?: "currency";
    currencySymbol?: string;
}

function NumberField({ id, label, helper, value, onChange, isRtl, prefix, currencySymbol = "€" }: NumberFieldProps) {
    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-xs font-medium text-slate-300">
                {label}
            </label>
            <div className="relative">
                {prefix === "currency" ? (
                    <span
                        className={
                            isRtl
                                ? "pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400"
                                : "pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs text-slate-400"
                        }
                    >
                        {currencySymbol}
                    </span>
                ) : null}
                <input
                    id={id}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    // String value lets users clear the field; binding the raw
                    // number means typing "0" then a digit re-displays "00".
                    value={value === 0 ? "" : value}
                    onChange={(e) => onChange(e.target.value)}
                    className={
                        prefix === "currency"
                            ? isRtl
                                ? "h-11 w-full rounded-xl border border-white/15 bg-white/5 pe-8 ps-4 text-sm text-white placeholder:text-white/40 focus:border-cyan-400/60 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                                : "h-11 w-full rounded-xl border border-white/15 bg-white/5 ps-8 pe-4 text-sm text-white placeholder:text-white/40 focus:border-cyan-400/60 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                            : "h-11 w-full rounded-xl border border-white/15 bg-white/5 px-4 text-sm text-white placeholder:text-white/40 focus:border-cyan-400/60 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                    }
                    placeholder="0"
                />
            </div>
            {helper ? <p className="text-[11px] leading-snug text-slate-500">{helper}</p> : null}
        </div>
    );
}

interface TeaserMetricProps {
    label: string;
    value: string;
}

function TeaserMetric({ label, value }: TeaserMetricProps) {
    return (
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
            <p
                aria-hidden="true"
                className="mt-3 select-none text-3xl font-bold tracking-tight text-white blur-md sm:text-4xl"
                style={{ filter: "blur(10px)" }}
            >
                {value}
            </p>
            {/* Screen-reader gets a generic description rather than the
                blurred number so the gate is not bypassable via assistive
                tech. */}
            <span className="sr-only">Result hidden until you submit the form below.</span>
        </div>
    );
}

interface ResultMetricProps {
    label: string;
    hint: string;
    value: string;
    accent: "cyan" | "violet";
}

function ResultMetric({ label, hint, value, accent }: ResultMetricProps) {
    const ring = accent === "cyan" ? "border-cyan-400/30 from-cyan-500/10" : "border-violet-400/30 from-violet-500/10";
    return (
        <div
            className={`rounded-2xl border bg-gradient-to-br to-transparent p-5 backdrop-blur-md print:border-slate-300 print:bg-white ${ring}`}
        >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300 print:text-slate-700">
                {label}
            </p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl print:text-slate-900">
                {value}
            </p>
            <p className="mt-2 text-[11px] leading-snug text-slate-400 print:text-slate-600">{hint}</p>
        </div>
    );
}
