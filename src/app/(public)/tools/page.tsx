import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, CalendarCheck, Clock, SearchCheck, Sparkles } from "lucide-react";
import { TOOL_REGISTRY, TOOL_SLUGS } from "@/features/tools/shared/registry";
import { buildToolsHubMetadata, getToolPageContext } from "@/features/tools/shared/page-metadata";
import { localizeHref } from "@/shared/lib/i18n/routing";
import {
    buildBreadcrumbJsonLd,
    buildConsultingServiceJsonLd,
    buildOrganizationJsonLd,
    buildToolHubItemListJsonLd,
    buildWebsiteJsonLd,
} from "@/features/tools/shared/jsonld";
import { ISYSTEM_BUSINESS, formatTradeRegistryLine } from "@/features/tools/shared/business";
import { ToolAtmosphere, ToolEyebrow } from "@/features/tools/shared/ui/primitives";
import type { ToolLocale, ToolMeta } from "@/features/tools/shared/types";

export const generateMetadata = (): Promise<Metadata> => buildToolsHubMetadata();

const CATEGORY_LABELS: Record<ToolMeta["category"], Record<ToolLocale, string>> = {
    automation: { en: "Automation", nl: "Automatisering", ar: "الأتمتة" },
    "ai-search": { en: "AI search", nl: "AI-zoeken", ar: "بحث الذكاء الاصطناعي" },
    compliance: { en: "Compliance", nl: "Compliance", ar: "الامتثال" },
    growth: { en: "Growth", nl: "Groei", ar: "النموّ" },
    support: { en: "Support", nl: "Support", ar: "الدعم" },
};

const CATEGORY_ACCENT: Record<ToolMeta["category"], string> = {
    automation: "text-cyan-300",
    "ai-search": "text-violet-300",
    compliance: "text-emerald-300",
    growth: "text-amber-300",
    support: "text-pink-300",
};

const HUB_COPY: Record<ToolLocale, {
    eyebrow: string;
    headline: string;
    lede: string;
    sub: string;
    notForHeading: string;
    notForItems: string[];
    bottomHeading: string;
    bottomBody: string;
    bottomCta: string;
    intentHeading: string;
    intentBody: string;
    intentGroups: Array<{ label: string; body: string; slugs: ToolMeta["slug"][] }>;
}> = {
    en: {
        eyebrow: "Free tools · iSystem.ai",
        headline: "Diagnostic tools for SME operators who are tired of guessing.",
        lede: "Nine calculators, audits, and generators built on the same playbook we use with iSystem clients. You answer 6–10 questions; you leave with a number, a roadmap, a document, or a fix — not a sales call.",
        sub: "Each tool is free, anonymous by default, and built around governed AI — every run is logged, every estimate is reversible, every recommendation cites a source. The opposite of <em>open ChatGPT and hope</em>.",
        notForHeading: "Not built for:",
        notForItems: [
            "Funded startups with a 30-person growth team — HubSpot fits you better.",
            "Marketplace operators chasing unit-economics dashboards — different category.",
            "Anyone who wants an unmetered AI sandbox — we run governed AI, not the other thing.",
            "Buyers shopping multi-vendor agency relationships — we are founder-led.",
        ],
        bottomHeading: "Want the human version after the tool?",
        bottomBody: "Hossam runs every iSystem Systems Fit Call himself. It is a free 30-minute qualification conversation in English or Dutch, with no slides and no pitch deck.",
        bottomCta: "Book the free Systems Fit Call",
        intentHeading: "Start with the question you are trying to answer",
        intentBody: "The tools are grouped by operator intent, not by feature name. Run one diagnostic, email yourself the result, then use the linked booking path only if the next step is worth scoping.",
        intentGroups: [
            { label: "Find automation ROI", body: "Quantify repetitive work before buying another subscription.", slugs: ["automation-scanner", "automation-roi-calculator", "ai-stack-recommender"] },
            { label: "Get found by AI and search", body: "Check citation, conversion, and public-page signals that agents and search engines can read.", slugs: ["ai-visibility-checker", "conversion-audit"] },
            { label: "Reduce operational risk", body: "Spot support, privacy, reputation, and contract surfaces that need a governed workflow.", slugs: ["support-automation-readiness", "gdpr-cookie-scanner", "review-response-generator", "nl-zzp-agreement-generator"] },
        ],
    },
    nl: {
        eyebrow: "Gratis tools · iSystem.ai",
        headline: "Diagnose-tools voor MKB-ondernemers die klaar zijn met gokken.",
        lede: "Negen calculators, audits en generators, gebouwd op hetzelfde speelboek dat we bij iSystem-klanten gebruiken. Beantwoord 6–10 vragen; vertrek met een getal, roadmap, document of fix — geen verkoopgesprek.",
        sub: "Elke tool is vrijblijvend, standaard anoniem, en gebouwd rond governed AI — elke run wordt gelogd, elke schatting is omkeerbaar, elke aanbeveling toont z'n bron. Het tegenovergestelde van <em>open ChatGPT en hoop op het beste</em>.",
        notForHeading: "Niet voor:",
        notForItems: [
            "Gefinancierde startups met een groeiteam van 30 — HubSpot past beter.",
            "Marktplaats-operators die unit-economics dashboards zoeken — andere categorie.",
            "Wie een onbeperkte AI-sandbox wil — wij draaien governed AI, niet het andere.",
            "Kopers die agencies met meerdere accountmanagers willen — wij zijn founder-led.",
        ],
        bottomHeading: "De menselijke versie na de tool?",
        bottomBody: "Hossam voert elke iSystem-discovery-call zelf. 30 minuten, geen dia's, geen pitchdeck, in NL of EN. Aan het einde van het gesprek weet je of iSystem bij je bedrijf past.",
        bottomCta: "Plan 30 minuten met Hossam",
        intentHeading: "Begin met de vraag die je wilt beantwoorden",
        intentBody: "De tools zijn gegroepeerd op intentie, niet op feature-naam. Draai één diagnose, mail jezelf het resultaat en boek alleen als de volgende stap scope verdient.",
        intentGroups: [
            { label: "Automatiserings-ROI vinden", body: "Kwantificeer repetitief werk voor je nog een abonnement koopt.", slugs: ["automation-scanner", "automation-roi-calculator", "ai-stack-recommender"] },
            { label: "Vindbaar worden in AI en search", body: "Check citation-, conversie- en publieke paginasignalen die agents en zoekmachines lezen.", slugs: ["ai-visibility-checker", "conversion-audit"] },
            { label: "Operationeel risico verlagen", body: "Vind support-, privacy-, reputatie- en contractsurfaces die governance nodig hebben.", slugs: ["support-automation-readiness", "gdpr-cookie-scanner", "review-response-generator", "nl-zzp-agreement-generator"] },
        ],
    },
    ar: {
        eyebrow: "أدوات مجانية · iSystem.ai",
        headline: "أدوات تشخيصية لمشغّلي الشركات الصغيرة الذين سئموا التخمين.",
        lede: "تسع حواسب وعمليات تدقيق ومولّدات، مبنية على نفس الدليل الذي نستخدمه مع عملاء iSystem. أجب عن 6–10 أسئلة وستخرج برقم أو خارطة طريق أو مستند أو حلّ — لا بمكالمة مبيعات.",
        sub: "كل أداة مجانية، مجهولة افتراضيًا، ومبنية حول الذكاء الاصطناعي المُحكَم — كل تشغيل يُسجَّل، كل تقدير قابل للعكس، كل توصية تذكر مصدرها. عكس <em>افتح ChatGPT وتمنّ النجاح</em>.",
        notForHeading: "ليست مصمَّمة لـ:",
        notForItems: [
            "الشركات الناشئة الممولّة بفريق نموّ من 30 شخصًا — HubSpot يناسبك أكثر.",
            "مشغّلو الأسواق الذين يطاردون لوحات بيانات اقتصاديات الوحدة — فئة مختلفة.",
            "من يبحث عن صندوق ذكاء اصطناعي بلا قيود — نحن نُشغّل ذكاءً مُحكَمًا، لا غير ذلك.",
            "المشترون الباحثون عن وكالات بعلاقات متعدّدة الموظفين — نحن نموذج مؤسِّس.",
        ],
        bottomHeading: "تريد النسخة البشرية بعد الأداة؟",
        bottomBody: "حسام يدير كل مكالمة استكشاف iSystem بنفسه. ثلاثون دقيقة، بلا شرائح، بلا عرض مبيعات، بالإنجليزية أو الهولندية. ستعرف بنهاية المكالمة إن كان iSystem يناسب عملك.",
        bottomCta: "احجز 30 دقيقة مع حسام",
        intentHeading: "ابدأ بالسؤال الذي تريد إجابته",
        intentBody: "الأدوات مجمّعة حسب نية المشغّل لا حسب اسم الميزة. شغّل تشخيصًا واحدًا، أرسل النتيجة لنفسك، ثم احجز فقط إن كانت الخطوة التالية تستحق تحديد النطاق.",
        intentGroups: [
            { label: "حساب عائد الأتمتة", body: "كمّي العمل المتكرر قبل شراء اشتراك آخر.", slugs: ["automation-scanner", "automation-roi-calculator", "ai-stack-recommender"] },
            { label: "الظهور في الذكاء الاصطناعي والبحث", body: "افحص إشارات الاقتباس والتحويل والصفحات العامة التي تقرأها الوكلاء ومحركات البحث.", slugs: ["ai-visibility-checker", "conversion-audit"] },
            { label: "خفض المخاطر التشغيلية", body: "اكتشف أسطح الدعم والخصوصية والسمعة والعقود التي تحتاج حوكمة.", slugs: ["support-automation-readiness", "gdpr-cookie-scanner", "review-response-generator", "nl-zzp-agreement-generator"] },
        ],
    },
};

export default async function ToolsHubPage() {
    const { locale, siteUrl, siteName } = await getToolPageContext("automation-scanner");
    const tools = TOOL_SLUGS.map((slug) => TOOL_REGISTRY[slug]);
    const copy = HUB_COPY[locale];
    const dir = locale === "ar" ? "rtl" : undefined;
    const pageUrl = `${siteUrl}/tools`;
    const websiteLd = buildWebsiteJsonLd({ siteName, siteUrl });
    const organizationLd = buildOrganizationJsonLd({ siteName, siteUrl });
    const serviceLd = buildConsultingServiceJsonLd({ siteUrl });
    const itemListLd = buildToolHubItemListJsonLd({ tools, locale, pageUrl });
    const breadcrumbLd = buildBreadcrumbJsonLd([
        { name: siteName, url: siteUrl },
        { name: "Free tools", url: pageUrl },
    ]);

    return (
        <section
            dir={dir}
            className="relative isolate overflow-hidden bg-slate-950 py-20 text-slate-50 sm:py-28"
        >
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

            <ToolAtmosphere />

            <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <header className="mx-auto max-w-3xl text-center">
                    <ToolEyebrow icon={<Sparkles className="h-3.5 w-3.5" aria-hidden />}>
                        {copy.eyebrow}
                    </ToolEyebrow>
                    <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight sm:text-5xl">{copy.headline}</h1>
                    <p className="mt-5 text-pretty text-lg leading-relaxed text-slate-300">{copy.lede}</p>
                    <p className="mt-3 text-sm text-slate-400" dangerouslySetInnerHTML={{ __html: copy.sub }} />
                </header>

                <section className="mx-auto mt-12 max-w-5xl rounded-3xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-xl sm:p-8">
                    <div className="flex items-center gap-2 text-cyan-300">
                        <SearchCheck className="size-4" aria-hidden />
                        <p className="text-xs font-semibold uppercase tracking-[0.18em]">Operator intent</p>
                    </div>
                    <h2 className="mt-3 text-2xl font-bold tracking-tight text-white">{copy.intentHeading}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">{copy.intentBody}</p>
                    <div className="mt-6 grid gap-4 lg:grid-cols-3">
                        {copy.intentGroups.map((group) => (
                            <article key={group.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                <h3 className="text-sm font-semibold text-white">{group.label}</h3>
                                <p className="mt-2 text-xs leading-relaxed text-slate-400">{group.body}</p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {group.slugs.map((slug) => (
                                        <Link
                                            key={slug}
                                            href={localizeHref(locale, `/tools/${slug}`)}
                                            className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-medium text-cyan-200 hover:border-cyan-300/50"
                                        >
                                            {TOOL_REGISTRY[slug].title[locale]}
                                        </Link>
                                    ))}
                                </div>
                            </article>
                        ))}
                    </div>
                </section>

                <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {tools.map((tool) => (
                        <li key={tool.slug}>
                            <Link
                                href={localizeHref(locale, `/tools/${tool.slug}`)}
                                className="group relative block h-full overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-[0_30px_80px_rgba(0,15,40,0.45)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-cyan-400/40 hover:shadow-[0_0_36px_rgba(6,182,212,0.25)]"
                            >
                                <div
                                    aria-hidden
                                    className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-cyan-500/0 via-cyan-400/0 to-violet-500/0 opacity-0 transition-opacity group-hover:from-cyan-500/10 group-hover:to-violet-500/10 group-hover:opacity-100"
                                />
                                <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em]">
                                    <span className={CATEGORY_ACCENT[tool.category]}>
                                        {CATEGORY_LABELS[tool.category][locale]}
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-slate-400">
                                        <Clock className="size-3" aria-hidden /> {tool.timeMinutes}m
                                    </span>
                                </div>
                                <h2 className="mt-4 text-xl font-semibold leading-snug text-white">{tool.title[locale]}</h2>
                                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-300">{tool.summary[locale]}</p>
                                <p className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-300 transition-transform group-hover:translate-x-1">
                                    Open tool <ArrowRight className="size-4" aria-hidden />
                                </p>
                            </Link>
                        </li>
                    ))}
                </ul>

                <section className="mx-auto mt-16 max-w-3xl rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-xl sm:p-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Honesty matters more than reach</p>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">{copy.notForHeading}</h2>
                    <ul className="mt-4 space-y-2 text-sm leading-relaxed text-slate-300">
                        {copy.notForItems.map((item, i) => (
                            <li key={i} className="flex gap-2">
                                <span aria-hidden className="mt-1 size-1.5 shrink-0 rounded-full bg-cyan-400/60" />
                                {item}
                            </li>
                        ))}
                    </ul>
                </section>

                <aside className="mx-auto mt-12 max-w-3xl rounded-3xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/15 via-cyan-400/5 to-violet-500/10 p-8 text-center shadow-[0_30px_80px_rgba(0,15,40,0.45)] backdrop-blur-xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Work directly with the founder</p>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{copy.bottomHeading}</h2>
                    <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-300">{copy.bottomBody}</p>
                    <Link
                        href={localizeHref(locale, "/booking")}
                        className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-cyan-500 px-7 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(6,182,212,0.35)] transition-all hover:bg-cyan-400 hover:shadow-[0_0_36px_rgba(6,182,212,0.55)]"
                    >
                        <CalendarCheck className="size-4" aria-hidden /> {copy.bottomCta}
                    </Link>
                    <p className="mt-3 text-xs text-slate-400">No slides. No pitch deck. EN or NL.</p>
                </aside>

                <footer className="mx-auto mt-10 max-w-3xl text-center text-[11px] leading-relaxed text-slate-500">
                    <p>{formatTradeRegistryLine(locale)}</p>
                    <p className="mt-1">
                        Remote engagements worldwide. In-person scoping in{" "}
                        <span className="text-slate-300">{ISYSTEM_BUSINESS.meetingCities.join(", ")}</span>; client visits
                        elsewhere in Europe by arrangement. No walk-in office.
                    </p>
                </footer>
            </div>
        </section>
    );
}
