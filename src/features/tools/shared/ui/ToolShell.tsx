import Link from "next/link";
import { ArrowRight, CalendarCheck, Clock, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { ToolLocale, ToolMeta } from "../types";
import { AdSlot } from "./AdSlot";
import { AffiliateRail } from "./AffiliateRail";
import { ToolAtmosphere, ToolEyebrow } from "./primitives";
import {
    buildBreadcrumbJsonLd,
    buildFaqJsonLd,
    buildFounderJsonLd,
    buildOrganizationJsonLd,
    buildToolHowToJsonLd,
    buildToolJsonLd,
} from "../jsonld";
import { getToolsChrome } from "../i18n";
import { TOOL_REGISTRY, TOOL_SLUGS } from "../registry";
import { localizeHref } from "@/shared/lib/i18n/routing";

const CATEGORY_INTENT_COPY: Record<ToolMeta["category"], Record<ToolLocale, string>> = {
    automation: {
        en: "Use this when manual work, fragmented tools, or unclear ROI are blocking an automation decision.",
        nl: "Gebruik dit bij handwerk, versnipperde tools of onduidelijke ROI.",
        ar: "استخدمها عندما يمنع العمل اليدوي أو تشتت الأدوات أو غموض العائد قرار الأتمتة.",
    },
    "ai-search": {
        en: "Use this when AI engines, search snippets, or citation surfaces need clearer public signals.",
        nl: "Gebruik dit als AI-engines, snippets of citaties duidelijke publieke signalen nodig hebben.",
        ar: "استخدمها عندما تحتاج محركات الذكاء الاصطناعي أو مقتطفات البحث إلى إشارات عامة أوضح.",
    },
    compliance: {
        en: "Use this when public trust, privacy, contracts, or auditability need a safer first pass.",
        nl: "Gebruik dit voor vertrouwen, privacy, contracten of auditability.",
        ar: "استخدمها عندما تحتاج الثقة العامة أو الخصوصية أو العقود إلى مرور أول أكثر أمانًا.",
    },
    growth: {
        en: "Use this when conversion, reviews, or reputation workflows need sharper public copy.",
        nl: "Gebruik dit als conversie, reviews of reputatie scherpere publieke copy nodig hebben.",
        ar: "استخدمها عندما تحتاج التحويلات أو التقييمات أو السمعة إلى نص عام أوضح.",
    },
    support: {
        en: "Use this when customer volume, repetition, or response delays may justify governed support automation.",
        nl: "Gebruik dit als volume, herhaling of responstijd supportautomatisering kan rechtvaardigen.",
        ar: "استخدمها عندما يبرر الحجم أو التكرار أو تأخر الرد أتمتة دعم مُحوكَمة.",
    },
};

interface ToolShellProps {
    meta: ToolMeta;
    locale: ToolLocale;
    siteName: string;
    siteUrl: string;
    pageUrl: string;
    tool: ReactNode;
    content: ReactNode;
    faq: Array<{ q: string; a: string }>;
    serviceCta: { heading: string; body: string; buttonLabel: string; href: string };
    howToSteps?: Array<{ name: string; text: string }>;
    featureList?: string[];
    containerClassName?: string;
}

export function ToolShell({
    meta,
    locale,
    siteName,
    siteUrl,
    pageUrl,
    tool,
    content,
    faq,
    serviceCta,
    howToSteps,
    featureList,
    containerClassName,
}: ToolShellProps) {
    const dir = locale === "ar" ? "rtl" : undefined;
    const chrome = getToolsChrome(locale);

    const softwareLd = buildToolJsonLd({ meta, locale, siteName, siteUrl, pageUrl, featureList });
    const faqLd = buildFaqJsonLd(faq);
    const orgLd = buildOrganizationJsonLd({ siteName, siteUrl });
    const founderLd = buildFounderJsonLd({ siteUrl });
    const breadcrumbLd = buildBreadcrumbJsonLd([
        { name: siteName, url: siteUrl },
        { name: "Free tools", url: `${siteUrl}/tools` },
        { name: meta.title[locale], url: pageUrl },
    ]);
    const howToLd = howToSteps && howToSteps.length > 0 ? buildToolHowToJsonLd({ meta, locale, steps: howToSteps }) : null;

    return (
        <section
            dir={dir}
            className="relative isolate overflow-hidden bg-slate-950 py-20 text-slate-50 sm:py-24 print:bg-white print:py-0 print:text-slate-900"
        >
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(founderLd) }} />
            {faqLd ? (
                <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
            ) : null}
            {howToLd ? (
                <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToLd) }} />
            ) : null}

            <ToolAtmosphere />

            <div className={containerClassName ?? "mx-auto max-w-4xl px-4 sm:px-6 print:max-w-none print:px-0"}>
                <header className="text-center print:hidden">
                    <ToolEyebrow icon={<Sparkles className="h-3.5 w-3.5" aria-hidden />}>
                        {chrome.shell.freeToolPrefix} · {chrome.shell.freeToolMinutes(meta.timeMinutes)}
                    </ToolEyebrow>
                    <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight sm:text-5xl">{meta.title[locale]}</h1>
                    <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-slate-300 sm:text-lg">
                        {meta.summary[locale]}
                    </p>
                    <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
                        {CATEGORY_INTENT_COPY[meta.category][locale]}
                    </p>
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400">
                        <Link href={localizeHref(locale, "/tools")} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 hover:border-cyan-400/40 hover:text-cyan-200">
                            Browse all diagnostics
                        </Link>
                        <Link href={localizeHref(locale, "/booking")} className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-cyan-200 hover:border-cyan-300/60">
                            Scope this with Hossam
                        </Link>
                    </div>
                </header>

                <section aria-label="Tool" className="mt-12">{tool}</section>

                <div className="mt-12 print:hidden">
                    <AdSlot slot="in_content" label="Tool sponsored content" />
                </div>

                <section className="prose prose-invert prose-slate mt-12 max-w-none prose-headings:text-white prose-headings:tracking-tight prose-p:text-slate-300 prose-li:text-slate-300 prose-strong:text-white prose-a:text-cyan-300 print:hidden">
                    {content}
                </section>

                <RelatedToolsRail currentSlug={meta.slug} locale={locale} chrome={chrome} />

                {faq.length > 0 ? (
                    <section className="mt-12 print:hidden">
                        <ToolEyebrow icon={<Clock className="h-3.5 w-3.5" aria-hidden />}>{chrome.shell.faqEyebrow}</ToolEyebrow>
                        <h2 className="mt-3 text-2xl font-bold tracking-tight">{chrome.shell.faqHeading}</h2>
                        <ul className="mt-5 space-y-3">
                            {faq.map((item) => (
                                <li
                                    key={item.q}
                                    className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md"
                                >
                                    <p className="font-semibold text-white">{item.q}</p>
                                    <p className="mt-2 text-sm leading-relaxed text-slate-300">{item.a}</p>
                                </li>
                            ))}
                        </ul>
                    </section>
                ) : null}

                <div className="print:hidden">
                    <AffiliateRail slug={meta.slug} locale={locale} />
                </div>

                <aside className="mt-14 rounded-3xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/15 via-cyan-400/5 to-violet-500/10 p-8 shadow-[0_30px_80px_rgba(0,15,40,0.45)] backdrop-blur-xl print:hidden">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">{chrome.shell.workWith}</p>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{serviceCta.heading}</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">{serviceCta.body}</p>
                    <Link
                        href={localizeHref(locale, serviceCta.href)}
                        className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-cyan-500 px-7 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(6,182,212,0.35)] transition-all hover:bg-cyan-400 hover:shadow-[0_0_36px_rgba(6,182,212,0.55)] focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-900"
                    >
                        <CalendarCheck className="h-4 w-4" aria-hidden />
                        {serviceCta.buttonLabel}
                    </Link>
                    <p className="mt-3 text-xs text-slate-400">{chrome.shell.ctaNote}</p>
                </aside>

                <div className="mt-10 print:hidden">
                    <AdSlot slot="below_result" label="End of article" />
                </div>
            </div>
        </section>
    );
}

interface RelatedToolsRailProps {
    currentSlug: ToolMeta["slug"];
    locale: ToolLocale;
    chrome: ReturnType<typeof getToolsChrome>;
}

/**
 * Server-rendered internal-link mesh: cross-links every tool to every
 * other tool. Exists to fix the "Discovered – currently not indexed"
 * bucket where individual /tools/* URLs received exactly one inbound
 * link (from the /tools hub). With this rail, each tool earns 7 fresh
 * intra-site links per render and Google can discover siblings without
 * relying on the hub alone.
 */
function RelatedToolsRail({ currentSlug, locale, chrome }: RelatedToolsRailProps) {
    const others = TOOL_SLUGS
        .filter((slug) => slug !== currentSlug)
        .map((slug) => TOOL_REGISTRY[slug]);

    if (others.length === 0) {
        return null;
    }

    return (
        <section aria-label={chrome.shell.relatedHeading} className="mt-14 print:hidden">
            <ToolEyebrow icon={<Sparkles className="h-3.5 w-3.5" aria-hidden />}>
                {chrome.shell.relatedEyebrow}
            </ToolEyebrow>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">{chrome.shell.relatedHeading}</h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {others.map((tool) => (
                    <li key={tool.slug}>
                        <Link
                            href={localizeHref(locale, `/tools/${tool.slug}`)}
                            className="group flex h-full flex-col rounded-2xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur-md transition-colors hover:border-cyan-400/40 hover:bg-slate-900/80"
                        >
                            <span className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                <span>{tool.timeMinutes} min</span>
                                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                            </span>
                            <span className="mt-2 text-sm font-semibold leading-snug text-white">
                                {tool.title[locale]}
                            </span>
                            <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">
                                {tool.summary[locale]}
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}
