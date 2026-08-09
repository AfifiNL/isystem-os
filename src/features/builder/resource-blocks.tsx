/* eslint-disable @next/next/no-img-element */
import { type ReactNode } from "react";
import Link from "next/link";
import {
    ArrowRight,
    CheckCircle2,
    Download,
    FileText,
    BookOpen,
    Clock,
    XCircle,
    FileDown,
} from "lucide-react";
import type { Fields } from "@puckeditor/core";
import {
    createSectionStyle,
    getLocaleValue,
    getRichTextLocaleValue,
    type LocaleField,
    type RichLocaleField,
    type SectionStyleProps,
    type SupportedLocale,
} from "@/features/builder/facility-services-page-data";
import {
    RESOURCE_REGISTRY,
    resolveReviewedResourceVisual,
} from "@/features/resources/resource-registry";

// ───────────────────────── shared design primitives ─────────────────────────
const SECTION_BASE = "relative isolate overflow-hidden";
const EYEBROW = "text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300";
const HEADING = "text-[var(--template-display-sm)] font-semibold leading-[0.98] tracking-[-0.04em] text-white";
const MUTED = "text-slate-300";
const SUBTLE = "text-slate-400";
const CARD = "rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md";
const CARD_HOVER = "transition-colors hover:border-cyan-400/30 hover:bg-white/[0.07]";
const CTA_PRIMARY = "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-cyan-500 px-6 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(6,182,212,0.35)] transition-all hover:bg-cyan-400 hover:shadow-[0_0_36px_rgba(6,182,212,0.55)]";
const CTA_GHOST = "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 text-sm font-medium text-white transition-colors hover:border-cyan-400/40 hover:bg-white/10";
const DEFAULT_RESOURCE_STYLE = createSectionStyle({ surfaceTone: "dark", width: "wide", density: "comfortable" });

function resolveSectionStyle(style?: Partial<SectionStyleProps> | null): SectionStyleProps {
    return {
        ...DEFAULT_RESOURCE_STYLE,
        ...(style ?? {}),
    };
}

function pickLocale(locale: SupportedLocale, field: LocaleField | undefined): string {
    if (!field) return "";
    return getLocaleValue(locale, field);
}

function pickRich(locale: SupportedLocale, field: RichLocaleField | LocaleField | undefined): string {
    if (!field) return "";
    return getRichTextLocaleValue(locale, field as LocaleField);
}

function getRenderLocale(props: { puck?: { metadata?: { locale?: SupportedLocale } } }): SupportedLocale {
    const value = props.puck?.metadata?.locale;
    if (value === "nl" || value === "ar") return value;
    return "en";
}

function resourceUnavailableLabel(locale: SupportedLocale) {
    if (locale === "nl") return "Nog geen publieke resource geconfigureerd";
    if (locale === "ar") return "لم يتم إعداد مورد عام بعد";
    return "No public resource configured yet";
}

// ──────────────────────── reusable field primitives ─────────────────────────
const triLingualText = (label: string) => ({
    type: "object" as const,
    label,
    objectFields: {
        en: { type: "text" as const, label: "English" },
        nl: { type: "text" as const, label: "Dutch" },
        ar: { type: "text" as const, label: "Arabic (العربية)" },
    },
});

const triLingualTextarea = (label: string) => ({
    type: "object" as const,
    label,
    objectFields: {
        en: { type: "textarea" as const, label: "English" },
        nl: { type: "textarea" as const, label: "Dutch" },
        ar: { type: "textarea" as const, label: "Arabic (العربية)" },
    },
});

const styleField = {
    type: "object" as const,
    label: "Section style",
    objectFields: {
        surfaceTone: {
            type: "select" as const,
            label: "Surface tone",
            options: ["light", "soft", "dark", "brand", "premium"].map((v) => ({ label: v, value: v })),
        },
        accentTone: {
            type: "select" as const,
            label: "Accent tone",
            options: ["primary", "emerald", "amber", "rose", "slate"].map((v) => ({ label: v, value: v })),
        },
        width: {
            type: "select" as const,
            label: "Width",
            options: ["contained", "wide", "full"].map((v) => ({ label: v, value: v })),
        },
        alignment: {
            type: "radio" as const,
            label: "Alignment",
            options: ["left", "center"].map((v) => ({ label: v, value: v })),
        },
        density: {
            type: "select" as const,
            label: "Spacing density",
            options: ["compact", "comfortable", "spacious"].map((v) => ({ label: v, value: v })),
        },
        cardStyle: {
            type: "select" as const,
            label: "Card style",
            options: ["flat", "outline", "elevated", "glass"].map((v) => ({ label: v, value: v })),
        },
        emphasis: {
            type: "select" as const,
            label: "Visual emphasis",
            options: ["subtle", "medium", "strong"].map((v) => ({ label: v, value: v })),
        },
        showEyebrow: {
            type: "radio" as const,
            label: "Show eyebrow",
            options: [
                { label: "Yes", value: true },
                { label: "No", value: false },
            ],
        },
    },
};

function densityClasses(density: SectionStyleProps["density"]) {
    if (density === "compact") return "px-4 py-10 sm:px-6 md:py-14";
    if (density === "spacious") return "px-4 py-20 sm:px-6 md:py-28";
    return "px-4 py-14 sm:px-6 md:py-20";
}

function widthClasses(width: SectionStyleProps["width"]) {
    if (width === "wide") return "mx-auto max-w-7xl";
    if (width === "full") return "mx-auto max-w-none";
    return "mx-auto max-w-6xl";
}

interface SectionFrameProps {
    style?: Partial<SectionStyleProps> | null;
    eyebrow?: ReactNode;
    title?: ReactNode;
    description?: ReactNode;
    children: ReactNode;
    align?: "left" | "center";
}

function SectionFrame({ style, eyebrow, title, description, children, align }: SectionFrameProps) {
    const safeStyle = resolveSectionStyle(style);
    const headingAlignment = (align ?? safeStyle.alignment) === "center" ? "items-center text-center" : "items-start text-left";
    return (
        <section className={`${SECTION_BASE} bg-slate-950 text-slate-50`}>
            <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
                <div className="absolute -top-40 left-1/4 h-[420px] w-[420px] rounded-full bg-cyan-500/10 blur-[140px] mix-blend-screen" />
                <div className="absolute -bottom-32 right-1/4 h-[360px] w-[360px] rounded-full bg-violet-500/8 blur-[120px] mix-blend-screen" />
            </div>
            <div className={`${widthClasses(safeStyle.width)} ${densityClasses(safeStyle.density)}`}>
                {(eyebrow || title || description) ? (
                    <div className={`mb-10 flex flex-col gap-3 ${headingAlignment}`}>
                        {safeStyle.showEyebrow && eyebrow ? <p className={EYEBROW}>{eyebrow}</p> : null}
                        {title ? <h2 className={`${HEADING} text-balance max-w-3xl`}>{title}</h2> : null}
                        {description ? <p className={`${MUTED} max-w-2xl text-base leading-relaxed`}>{description}</p> : null}
                    </div>
                ) : null}
                {children}
            </div>
        </section>
    );
}

// ───────────────────────── 1) ResourceHeroBlock ─────────────────────────
export type ResourceHeroBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    subtitle: RichLocaleField;
    pdfSlug: string; // references resource slug in registry
    assetType: "Playbook" | "Workbook" | "Canvas" | "Framework" | "Starter Kit";
    pagesCount: string;
    readingTime: string;
    primaryCtaLabel: LocaleField;
    secondaryCta: { label: LocaleField; href: string };
};

const resourceHeroFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: triLingualText("Eyebrow"),
    title: triLingualText("Title"),
    subtitle: triLingualTextarea("Subtitle"),
    pdfSlug: {
        type: "select" as const,
        label: "Target PDF Asset",
        options: RESOURCE_REGISTRY.map((r) => ({ label: r.info.title.en, value: r.slug })),
    },
    assetType: {
        type: "select" as const,
        label: "Asset Type Badge",
        options: ["Playbook", "Workbook", "Canvas", "Framework", "Starter Kit"].map((v) => ({ label: v, value: v })),
    },
    pagesCount: { type: "text" as const, label: "Pages count" },
    readingTime: { type: "text" as const, label: "Reading time" },
    primaryCtaLabel: triLingualText("Primary CTA button label"),
    secondaryCta: {
        type: "object" as const,
        label: "Secondary CTA",
        objectFields: {
            label: triLingualText("Label"),
            href: { type: "text" as const, label: "Href" },
        },
    },
} satisfies Fields<ResourceHeroBlockProps & { id: string }>;

function buildResourceHeroProps(): ResourceHeroBlockProps {
    return {
        style: createSectionStyle({ surfaceTone: "dark", width: "wide", density: "spacious" }),
        eyebrow: { en: "Optional public resource", nl: "Optionele publieke resource", ar: "مورد عام اختياري" },
        title: {
            en: "Configure a reviewed public resource",
            nl: "Configureer een gecontroleerde publieke resource",
            ar: "قم بإعداد مورد عام تمت مراجعته",
        },
        subtitle: {
            en: "Add a redistributable file and localized metadata to the public resource registry before publishing this block.",
            nl: "Voeg vóór publicatie een herdistribueerbaar bestand en vertaalde metadata toe aan het publieke resourceregister.",
            ar: "أضف ملفًا قابلاً لإعادة التوزيع وبيانات وصفية مترجمة إلى سجل الموارد العام قبل النشر.",
        },
        pdfSlug: "",
        assetType: "Starter Kit",
        pagesCount: "",
        readingTime: "",
        primaryCtaLabel: { en: "Download resource", nl: "Download resource", ar: "تنزيل المورد" },
        secondaryCta: {
            label: { en: "Contact us", nl: "Neem contact op", ar: "تواصل معنا" },
            href: "/contact",
        },
    };
}

interface ResourceHeroProps extends ResourceHeroBlockProps {
    locale: SupportedLocale;
}

function ResourceHero({ locale, style, eyebrow, title, subtitle, pdfSlug, assetType, pagesCount, readingTime, primaryCtaLabel, secondaryCta }: ResourceHeroProps) {
    const safeStyle = resolveSectionStyle(style);
    const registryItem = RESOURCE_REGISTRY.find((r) => r.slug === pdfSlug);

    return (
        <SectionFrame style={safeStyle}>
            <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:items-center">
                <div className="flex flex-col gap-6 text-left">
                    {safeStyle.showEyebrow && eyebrow ? <p className={EYEBROW}>{pickLocale(locale, eyebrow)}</p> : null}

                    <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-200">
                            <BookOpen className="size-3" />
                            {assetType}
                        </span>
                        {pagesCount && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold text-slate-300">
                                <FileText className="size-3" />
                                {pagesCount}
                            </span>
                        )}
                        {readingTime && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold text-slate-300">
                                <Clock className="size-3" />
                                {readingTime}
                            </span>
                        )}
                    </div>

                    <h1 className="text-[var(--template-display-sm)] font-semibold leading-[1.05] tracking-[-0.04em] text-white">
                        {pickLocale(locale, title)}
                    </h1>

                    <p className={`${MUTED} text-lg leading-relaxed max-w-2xl`}>
                        {pickRich(locale, subtitle)}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 mt-4">
                        {registryItem ? (
                            <a href={registryItem.pdfHref} download className={CTA_PRIMARY}>
                                <Download className="size-4" />
                                {pickLocale(locale, primaryCtaLabel) || "Download resource"}
                            </a>
                        ) : (
                            <span className="inline-flex h-11 items-center rounded-full border border-white/15 px-6 text-sm text-slate-300" role="status">
                                {resourceUnavailableLabel(locale)}
                            </span>
                        )}

                        {secondaryCta?.href && (
                            <Link href={secondaryCta.href} className={CTA_GHOST}>
                                {pickLocale(locale, secondaryCta.label)}
                                <ArrowRight className="size-4" />
                            </Link>
                        )}
                    </div>
                </div>

                {/* Cover visual preview card */}
                <div className="flex justify-center lg:justify-end">
                    <div className={`${CARD} p-4 max-w-[340px] w-full transition-transform hover:scale-[1.02] shadow-2xl relative overflow-hidden group`}>
                        {registryItem ? (
                            <>
                                <img
                                    src={registryItem.coverImage}
                                    alt={pickLocale(locale, title)}
                                    className="w-full rounded-lg border border-white/5 object-cover aspect-[1/1.41] shadow-md bg-slate-900"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/0 to-slate-950/0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-6">
                                    <span className="inline-flex items-center gap-2 rounded-full bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-lg">
                                        <FileDown className="size-3.5" />
                                        {locale === "nl" ? "Klik om te downloaden" : locale === "ar" ? "اضغط للتحميل" : "Click to Download"}
                                    </span>
                                </div>
                            </>
                        ) : (
                            <div className="flex aspect-[1/1.41] items-center justify-center rounded-lg border border-dashed border-white/15 bg-slate-900 text-slate-400">
                                <FileText className="size-12" aria-hidden="true" />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </SectionFrame>
    );
}

// ───────────────────────── 2) ResourceCardGridBlock ─────────────────────────
export type ResourceCardGridBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    categoryFilter: "all" | "pillar" | "support" | "sector-support" | "diagnostic" | "authority";
};

const resourceCardGridFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: triLingualText("Eyebrow"),
    title: triLingualText("Title"),
    description: triLingualTextarea("Description"),
    categoryFilter: {
        type: "select" as const,
        label: "Filter Category",
        options: [
            { label: "All Assets", value: "all" },
            { label: "Pillar Asset Only", value: "pillar" },
            { label: "Topical Support Playbooks", value: "support" },
            { label: "Sector Specific Playbooks", value: "sector-support" },
            { label: "Diagnostic Checklists & Workbooks", value: "diagnostic" },
            { label: "Authority & Academic Frameworks", value: "authority" },
        ],
    },
} satisfies Fields<ResourceCardGridBlockProps & { id: string }>;

function buildResourceCardGridProps(): ResourceCardGridBlockProps {
    return {
        style: createSectionStyle({ surfaceTone: "dark", width: "wide", density: "spacious" }),
        eyebrow: { en: "Resource Hub", nl: "Bronnen Bibliotheek", ar: "مكتبة المصادر" },
        title: {
            en: "Published resources appear here after review",
            nl: "Gepubliceerde resources verschijnen hier na controle",
            ar: "تظهر الموارد المنشورة هنا بعد المراجعة",
        },
        description: {
            en: "Only reviewed, redistributable files registered in the public source are listed.",
            nl: "Alleen gecontroleerde, herdistribueerbare bestanden uit de publieke bron worden getoond.",
            ar: "يتم عرض الملفات التي تمت مراجعتها والقابلة لإعادة التوزيع والمسجلة في المصدر العام فقط.",
        },
        categoryFilter: "all",
    };
}

interface ResourceCardGridProps extends ResourceCardGridBlockProps {
    locale: SupportedLocale;
}

function ResourceCardGrid({ locale, style, eyebrow, title, description, categoryFilter }: ResourceCardGridProps) {
    const items = RESOURCE_REGISTRY.filter((item) => {
        if (categoryFilter === "all") return true;
        return item.funnelRole === categoryFilter;
    });

    return (
        <SectionFrame
            style={style}
            eyebrow={pickLocale(locale, eyebrow)}
            title={pickLocale(locale, title)}
            description={pickRich(locale, description)}
        >
            {items.length === 0 ? (
                <div className={`${CARD} p-8 text-center text-sm text-slate-300`} role="status">
                    {resourceUnavailableLabel(locale)}
                </div>
            ) : <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => {
                    const localizedTitle = item.info.title[locale] || item.info.title.en;
                    const localizedDesc = item.info.description[locale] || item.info.description.en;
                    const localizedAudience = item.info.audience[locale] || item.info.audience.en;

                    return (
                        <article
                            key={item.slug}
                            className={`${CARD} ${CARD_HOVER} flex flex-col overflow-hidden h-full group`}
                        >
                            <Link href={`/${item.slug}`} className="block relative overflow-hidden aspect-[1.5/1] bg-slate-900 border-b border-white/5">
                                <img
                                    src={item.coverImage}
                                    alt={localizedTitle}
                                    className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
                                    loading="lazy"
                                />
                                <span className="absolute top-4 left-4 inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-slate-950/80 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-cyan-200 backdrop-blur-md">
                                    {item.type}
                                </span>
                            </Link>

                            <div className="flex flex-col flex-1 p-6 gap-4">
                                <div className="space-y-2">
                                    <h3 className="text-base font-semibold text-white group-hover:text-cyan-300 transition-colors">
                                        <Link href={`/${item.slug}`}>{localizedTitle}</Link>
                                    </h3>
                                    <p className={`text-xs line-clamp-3 leading-relaxed ${MUTED}`}>
                                        {localizedDesc}
                                    </p>
                                </div>

                                <div className="mt-auto pt-4 border-t border-white/5 flex flex-col gap-2">
                                    <p className="text-[10px] text-slate-400">
                                        <strong className="text-slate-300">{locale === "nl" ? "Doelgroep: " : locale === "ar" ? "الفئة المستهدفة: " : "Audience: "}</strong>
                                        {localizedAudience}
                                    </p>
                                    <div className="flex items-center justify-between text-[10px] text-cyan-300 font-medium">
                                        <span>{item.pageCount} pages · {item.readTimeMinutes} min read</span>
                                        <Link href={`/${item.slug}`} className="inline-flex items-center gap-1 hover:underline">
                                            {locale === "nl" ? "Bekijk gids" : locale === "ar" ? "تفاصيل" : "View playbook"} →
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </article>
                    );
                })}
            </div>}
        </SectionFrame>
    );
}

// ───────────────────────── 3) PdfDownloadPanelBlock ─────────────────────────
export type PdfDownloadPanelBlockProps = {
    style: SectionStyleProps;
    title: LocaleField;
    pdfSlug: string;
    fileSize: string;
    bullets: Array<{ id: string; text: LocaleField }>;
    showCtaForm: boolean;
};

const pdfDownloadPanelFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    title: triLingualText("Title"),
    pdfSlug: {
        type: "select" as const,
        label: "Target PDF Asset",
        options: RESOURCE_REGISTRY.map((r) => ({ label: r.info.title.en, value: r.slug })),
    },
    fileSize: { type: "text" as const, label: "File size (e.g. 1.2 MB)" },
    bullets: {
        type: "array" as const,
        label: "What's inside highlights",
        arrayFields: {
            id: { type: "text" as const, label: "ID" },
            text: triLingualText("Highlight point"),
        },
        getItemSummary: (item: { text?: LocaleField }) => item.text?.en ?? "Highlight point",
    },
    showCtaForm: {
        type: "radio" as const,
        label: "Show consultation CTA",
        options: [
            { label: "Yes", value: true },
            { label: "No", value: false },
        ],
    },
} satisfies Fields<PdfDownloadPanelBlockProps & { id: string }>;

function buildPdfDownloadPanelProps(): PdfDownloadPanelBlockProps {
    return {
        style: createSectionStyle({ surfaceTone: "dark", width: "contained", density: "comfortable" }),
        title: { en: "Configure a public PDF", nl: "Configureer een publieke PDF", ar: "قم بإعداد ملف PDF عام" },
        pdfSlug: "",
        fileSize: "",
        bullets: [
            { id: "p1", text: { en: "Register only reviewed, redistributable files.", nl: "Registreer alleen gecontroleerde, herdistribueerbare bestanden.", ar: "سجّل فقط الملفات التي تمت مراجعتها والقابلة لإعادة التوزيع." } },
        ],
        showCtaForm: false,
    };
}

interface PdfDownloadPanelProps extends PdfDownloadPanelBlockProps {
    locale: SupportedLocale;
}

function PdfDownloadPanel({ locale, style, title, pdfSlug, fileSize, bullets, showCtaForm }: PdfDownloadPanelProps) {
    const registryItem = RESOURCE_REGISTRY.find((r) => r.slug === pdfSlug);

    return (
        <SectionFrame style={style}>
            <div className={`${CARD} p-8 lg:p-10 relative overflow-hidden`}>
                <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
                    <div className="space-y-6">
                        <h3 className="text-xl font-semibold text-white">
                            {pickLocale(locale, title)}
                        </h3>

                        <ul className="space-y-3">
                            {(bullets ?? []).map((bullet) => (
                                <li key={bullet.id} className="flex items-start gap-3 text-sm text-slate-100">
                                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-cyan-300" aria-hidden="true" />
                                    <span>{pickLocale(locale, bullet.text)}</span>
                                </li>
                            ))}
                        </ul>

                        {registryItem ? (
                            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400 pt-4 border-t border-white/5">
                                <span>Format: <strong className="text-slate-300">PDF Document</strong></span>
                                {fileSize ? <span>File Size: <strong className="text-slate-300">{fileSize}</strong></span> : null}
                                <span>Updated: <strong className="text-slate-300">{registryItem.lastModified}</strong></span>
                            </div>
                        ) : null}

                        <div className="pt-2">
                            {registryItem ? (
                                <a href={registryItem.pdfHref} download className={CTA_PRIMARY}>
                                    <Download className="size-4" />
                                    {locale === "nl" ? "Download PDF direct" : locale === "ar" ? "تحميل ملف PDF المباشر" : "Download PDF Direct"}
                                </a>
                            ) : (
                                <span className="inline-flex h-11 items-center rounded-full border border-white/15 px-6 text-sm text-slate-300" role="status">
                                    {resourceUnavailableLabel(locale)}
                                </span>
                            )}
                        </div>
                    </div>

                    {showCtaForm ? (
                        <div className="border-t border-white/10 lg:border-t-0 lg:border-l lg:pl-10 lg:pt-0 pt-8 space-y-4">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
                                {locale === "nl" ? "Volgende stap" : locale === "ar" ? "الخطوة التالية" : "Next Step"}
                            </span>
                            <h4 className="text-base font-semibold text-white">
                                {locale === "nl" ? "Plan een vrijblijvend gesprek van 30 minuten" : locale === "ar" ? "احجز مكالمة تعريفية لمدة 30 دقيقة" : "Book a 30-minute discovery consultation"}
                            </h4>
                            <p className={`text-xs leading-relaxed ${MUTED}`}>
                                {locale === "nl"
                                    ? "Neem de worksheet erbij. We gebruiken die om je digitale systeem rustig in kaart te brengen."
                                    : locale === "ar"
                                    ? "استخدم ملف العمل كنقطة بداية لنفهم ما يحتاجه نظامك الرقمي فعلاً."
                                    : "Bring the worksheet. We'll use it to map what your business actually needs."}
                            </p>
                            <div className="pt-2">
                                <Link href="/contact" className={CTA_GHOST}>
                                    <span>{locale === "nl" ? "Neem contact op" : locale === "ar" ? "تواصل معنا" : "Contact us"}</span>
                                    <ArrowRight className="size-4" />
                                </Link>
                            </div>
                        </div>
                    ) : null}
                </div>
                <div className="pointer-events-none absolute -bottom-16 right-0 h-44 w-44 rounded-full bg-cyan-500/10 blur-3xl" />
            </div>
        </SectionFrame>
    );
}

// ───────────────────────── 4) ResourceUseCasesBlock ─────────────────────────
export type ResourceUseCasesBlockProps = {
    style: SectionStyleProps;
    title: LocaleField;
    useCases: Array<{ id: string; text: LocaleField }>;
    notFor: Array<{ id: string; text: LocaleField }>;
};

const resourceUseCasesFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    title: triLingualText("Title"),
    useCases: {
        type: "array" as const,
        label: "Use this guide if...",
        arrayFields: {
            id: { type: "text" as const, label: "ID" },
            text: triLingualText("Use case description"),
        },
        getItemSummary: (item: { text?: LocaleField }) => item.text?.en ?? "Use case point",
    },
    notFor: {
        type: "array" as const,
        label: "This guide is NOT for...",
        arrayFields: {
            id: { type: "text" as const, label: "ID" },
            text: triLingualText("Not-for description"),
        },
        getItemSummary: (item: { text?: LocaleField }) => item.text?.en ?? "Not-for point",
    },
} satisfies Fields<ResourceUseCasesBlockProps & { id: string }>;

function buildResourceUseCasesProps(): ResourceUseCasesBlockProps {
    return {
        style: createSectionStyle({ surfaceTone: "dark", width: "wide", density: "comfortable" }),
        title: { en: "Describe who this resource is for", nl: "Beschrijf voor wie deze resource is", ar: "صِف الجمهور المناسب لهذا المورد" },
        useCases: [
            { id: "u1", text: { en: "Replace this example with the intended reader and outcome.", nl: "Vervang dit voorbeeld door de beoogde lezer en uitkomst.", ar: "استبدل هذا المثال بالقارئ والنتيجة المقصودين." } },
        ],
        notFor: [
            { id: "n1", text: { en: "Replace this example with a clear exclusion or prerequisite.", nl: "Vervang dit voorbeeld door een duidelijke uitsluiting of voorwaarde.", ar: "استبدل هذا المثال باستثناء أو متطلب واضح." } },
        ],
    };
}

interface ResourceUseCasesProps extends ResourceUseCasesBlockProps {
    locale: SupportedLocale;
}

function ResourceUseCases({ locale, style, title, useCases, notFor }: ResourceUseCasesProps) {
    return (
        <SectionFrame style={style}>
            <div className="space-y-8">
                <h3 className="text-xl font-semibold text-white text-center">
                    {pickLocale(locale, title)}
                </h3>

                <div className="grid gap-6 md:grid-cols-2">
                    <div className={`${CARD} p-6 space-y-4 border-emerald-500/20`}>
                        <h4 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                            <CheckCircle2 className="size-4" />
                            {locale === "nl" ? "Ideaal geschikt als..." : locale === "ar" ? "مناسب تمامًا إذا..." : "Best suited if..."}
                        </h4>
                        <ul className="space-y-3">
                            {(useCases ?? []).map((point) => (
                                <li key={point.id} className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-100">
                                    <span className="text-emerald-400 mt-0.5">•</span>
                                    <span>{pickLocale(locale, point.text)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className={`${CARD} p-6 space-y-4 border-rose-500/20`}>
                        <h4 className="text-sm font-semibold text-rose-400 flex items-center gap-2">
                            <XCircle className="size-4" />
                            {locale === "nl" ? "Niet geschikt als..." : locale === "ar" ? "غير مناسب إذا..." : "Not suited if..."}
                        </h4>
                        <ul className="space-y-3">
                            {(notFor ?? []).map((point) => (
                                <li key={point.id} className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-100">
                                    <span className="text-rose-400 mt-0.5">•</span>
                                    <span>{pickLocale(locale, point.text)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </SectionFrame>
    );
}

// ───────────────────────── 5) ResourceVisualPreviewBlock ─────────────────────────
export type ResourceVisualPreviewBlockProps = {
    style: SectionStyleProps;
    visualFilename: string;
    caption: LocaleField;
};

const resourceVisualPreviewFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    visualFilename: {
        type: "text" as const,
        label: "Reviewed public visual path",
    },
    caption: triLingualText("Visual caption"),
} satisfies Fields<ResourceVisualPreviewBlockProps & { id: string }>;

function buildResourceVisualPreviewProps(): ResourceVisualPreviewBlockProps {
    return {
        style: createSectionStyle({ surfaceTone: "dark", width: "wide", density: "comfortable" }),
        visualFilename: "",
        caption: {
            en: "Add a reviewed public visual to the builder configuration.",
            nl: "Voeg een gecontroleerde publieke visual toe aan de builderconfiguratie.",
            ar: "أضف عنصرًا مرئيًا عامًا تمت مراجعته إلى إعدادات المنشئ.",
        },
    };
}

interface ResourceVisualPreviewProps extends ResourceVisualPreviewBlockProps {
    locale: SupportedLocale;
}

function ResourceVisualPreview({ locale, style, visualFilename, caption }: ResourceVisualPreviewProps) {
    const visualUrl = resolveReviewedResourceVisual(visualFilename);

    return (
        <SectionFrame style={style} align="center">
            <div className="flex flex-col items-center gap-6">
                <div className={`${CARD} p-4 w-full max-w-4xl bg-slate-900 border-white/5 overflow-hidden flex items-center justify-center shadow-xl`}>
                    {visualUrl ? (
                        <img
                            src={visualUrl}
                            alt={pickLocale(locale, caption)}
                            className="w-full max-h-[480px] object-contain display-block rounded-lg"
                            loading="lazy"
                        />
                    ) : (
                        <div className="flex min-h-56 items-center justify-center text-slate-400" role="status">
                            <FileText className="size-12" aria-hidden="true" />
                            <span className="sr-only">{resourceUnavailableLabel(locale)}</span>
                        </div>
                    )}
                </div>
                {caption && (
                    <p className={`text-xs italic text-center ${SUBTLE}`}>
                        {pickLocale(locale, caption)}
                    </p>
                )}
            </div>
        </SectionFrame>
    );
}

// ─────────────────────────── Block registry export ─────────────────────────
export type ResourceComponents = {
    ResourceHeroBlock: ResourceHeroBlockProps & { id: string };
    ResourceCardGridBlock: ResourceCardGridBlockProps & { id: string };
    PdfDownloadPanelBlock: PdfDownloadPanelBlockProps & { id: string };
    ResourceUseCasesBlock: ResourceUseCasesBlockProps & { id: string };
    ResourceVisualPreviewBlock: ResourceVisualPreviewBlockProps & { id: string };
};

interface BuilderRenderProps<T> {
    puck?: { metadata?: { locale?: SupportedLocale } };
    [key: string]: unknown;
    style: SectionStyleProps;
    _placeholder?: T;
}

export const resourceBlocks = {
    ResourceHeroBlock: {
        label: "Resources · hero with preview",
        fields: resourceHeroFields,
        defaultProps: { id: "resource-hero", ...buildResourceHeroProps() },
        render: (props: BuilderRenderProps<ResourceHeroBlockProps>) => {
            const defaults = buildResourceHeroProps();
            return (
                <ResourceHero
                    locale={getRenderLocale(props)}
                    style={resolveSectionStyle(props.style)}
                    eyebrow={(props.eyebrow as LocaleField | undefined) ?? defaults.eyebrow}
                    title={(props.title as LocaleField | undefined) ?? defaults.title}
                    subtitle={(props.subtitle as RichLocaleField | undefined) ?? defaults.subtitle}
                    pdfSlug={(props.pdfSlug as string | undefined) ?? defaults.pdfSlug}
                    assetType={(props.assetType as ResourceHeroBlockProps["assetType"] | undefined) ?? defaults.assetType}
                    pagesCount={(props.pagesCount as string | undefined) ?? defaults.pagesCount}
                    readingTime={(props.readingTime as string | undefined) ?? defaults.readingTime}
                    primaryCtaLabel={(props.primaryCtaLabel as LocaleField | undefined) ?? defaults.primaryCtaLabel}
                    secondaryCta={(props.secondaryCta as ResourceHeroBlockProps["secondaryCta"] | undefined) ?? defaults.secondaryCta}
                />
            );
        },
    },
    ResourceCardGridBlock: {
        label: "Resources · card grid index",
        fields: resourceCardGridFields,
        defaultProps: { id: "resource-card-grid", ...buildResourceCardGridProps() },
        render: (props: BuilderRenderProps<ResourceCardGridBlockProps>) => {
            const defaults = buildResourceCardGridProps();
            return (
                <ResourceCardGrid
                    locale={getRenderLocale(props)}
                    style={resolveSectionStyle(props.style)}
                    eyebrow={(props.eyebrow as LocaleField | undefined) ?? defaults.eyebrow}
                    title={(props.title as LocaleField | undefined) ?? defaults.title}
                    description={(props.description as RichLocaleField | undefined) ?? defaults.description}
                    categoryFilter={(props.categoryFilter as ResourceCardGridBlockProps["categoryFilter"] | undefined) ?? defaults.categoryFilter}
                />
            );
        },
    },
    PdfDownloadPanelBlock: {
        label: "Resources · PDF download card",
        fields: pdfDownloadPanelFields,
        defaultProps: { id: "pdf-download-panel", ...buildPdfDownloadPanelProps() },
        render: (props: BuilderRenderProps<PdfDownloadPanelBlockProps>) => {
            const defaults = buildPdfDownloadPanelProps();
            return (
                <PdfDownloadPanel
                    locale={getRenderLocale(props)}
                    style={resolveSectionStyle(props.style)}
                    title={(props.title as LocaleField | undefined) ?? defaults.title}
                    pdfSlug={(props.pdfSlug as string | undefined) ?? defaults.pdfSlug}
                    fileSize={(props.fileSize as string | undefined) ?? defaults.fileSize}
                    bullets={(props.bullets as Array<{ id: string; text: LocaleField }> | undefined) ?? defaults.bullets}
                    showCtaForm={(props.showCtaForm as boolean | undefined) ?? defaults.showCtaForm}
                />
            );
        },
    },
    ResourceUseCasesBlock: {
        label: "Resources · use cases (Is this for me?)",
        fields: resourceUseCasesFields,
        defaultProps: { id: "resource-use-cases", ...buildResourceUseCasesProps() },
        render: (props: BuilderRenderProps<ResourceUseCasesBlockProps>) => {
            const defaults = buildResourceUseCasesProps();
            return (
                <ResourceUseCases
                    locale={getRenderLocale(props)}
                    style={resolveSectionStyle(props.style)}
                    title={(props.title as LocaleField | undefined) ?? defaults.title}
                    useCases={(props.useCases as Array<{ id: string; text: LocaleField }> | undefined) ?? defaults.useCases}
                    notFor={(props.notFor as Array<{ id: string; text: LocaleField }> | undefined) ?? defaults.notFor}
                />
            );
        },
    },
    ResourceVisualPreviewBlock: {
        label: "Resources · visual schematic preview",
        fields: resourceVisualPreviewFields,
        defaultProps: { id: "resource-visual-preview", ...buildResourceVisualPreviewProps() },
        render: (props: BuilderRenderProps<ResourceVisualPreviewBlockProps>) => {
            const defaults = buildResourceVisualPreviewProps();
            return (
                <ResourceVisualPreview
                    locale={getRenderLocale(props)}
                    style={resolveSectionStyle(props.style)}
                    visualFilename={(props.visualFilename as string | undefined) ?? defaults.visualFilename}
                    caption={(props.caption as LocaleField | undefined) ?? defaults.caption}
                />
            );
        },
    },
};

export {
    buildResourceHeroProps,
    buildResourceCardGridProps,
    buildPdfDownloadPanelProps,
    buildResourceUseCasesProps,
    buildResourceVisualPreviewProps,
};
