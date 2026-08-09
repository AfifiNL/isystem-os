/* eslint-disable @next/next/no-img-element */
// Plain <img> tags are deliberate here. The Puck builder canvas re-renders
// every keystroke; next/image's URL signing pipeline doesn't tolerate
// frequently-changing src values gracefully and ends up emitting endless
// 400s in the dev console. Editorial / marketing imagery in these blocks is
// also frequently external (uploaded URLs, third-party CDNs) where the
// loader would error anyway.
//
// This module is intentionally a SERVER module — no "use client". Marking
// it use-client made `puck.config.tsx` see the `extendedBlocks` export as a
// React client-reference proxy; spreading that proxy yielded zero
// enumerable keys and the blocks silently disappeared from the rendered
// page. Only the InsightsGrid block needs hooks (it fetches /api/insights/
// recent on mount), so that one component lives in
// extended-blocks-insights-grid.tsx ("use client") and gets used here as a
// normal client-component import — JSX-as-function-call serializes the
// boundary correctly.

import { type ComponentType, type ReactNode } from "react";
import { InsightsGridClient } from "@/features/builder/extended-blocks-insights-grid";
import {
    BarChart3,
    Briefcase,
    Check,
    ChevronDown,
    Database,
    FileCheck2,
    Globe,
    HelpCircle,
    Image as ImageIcon,
    Layers,
    Lightbulb,
    Mail,
    MousePointerClick,
    Linkedin,
    Quote,
    Rocket,
    Shield,
    Sparkles,
    Star,
    Twitter,
    Users,
    Zap,
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
import { RichTextRenderer } from "@/features/content-engine/ui/rich-text-renderer";

// ───────────────────────── shared design primitives ─────────────────────────
// Mirror the visual vocabulary used elsewhere in the workspace builder so the
// new blocks feel native: dark surfaces, cyan/violet accents, glassmorphic
// cards, generous spacing.

const SECTION_BASE = "relative isolate overflow-hidden";
const EYEBROW = "text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300";
const HEADING = "text-[var(--template-display-sm)] font-semibold leading-[0.98] tracking-[-0.04em] text-white";
const MUTED = "text-slate-300";
const SUBTLE = "text-slate-400";
const CARD = "rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md";
const CARD_HOVER = "transition-colors hover:border-cyan-400/30 hover:bg-white/[0.07]";
const CTA_PRIMARY = "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-cyan-500 px-6 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(6,182,212,0.35)] transition-all hover:bg-cyan-400 hover:shadow-[0_0_36px_rgba(6,182,212,0.55)]";
const CTA_GHOST = "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 text-sm font-medium text-white transition-colors hover:border-cyan-400/40 hover:bg-white/10";
const DEFAULT_EXTENDED_STYLE = createSectionStyle({ surfaceTone: "dark", width: "wide", density: "comfortable" });

function resolveSectionStyle(style?: Partial<SectionStyleProps> | null): SectionStyleProps {
    return {
        ...DEFAULT_EXTENDED_STYLE,
        ...(style ?? {}),
    };
}

function pickLocale<T extends LocaleField | RichLocaleField | undefined>(locale: SupportedLocale, field: T): string {
    if (!field) return "";
    return getLocaleValue(locale, field as LocaleField);
}

function pickRich<T extends LocaleField | RichLocaleField | undefined>(locale: SupportedLocale, field: T): string {
    if (!field) return "";
    return getRichTextLocaleValue(locale, field as LocaleField);
}

function normalizeBuilderRichText(value: string): string {
    return value
        .replace(/&lt;(\/?(?:p|br|strong|em|a|ul|ol|li|span|code|blockquote|h[1-3])(?:\s[^&]*?)?)&gt;/gi, "<$1>")
        .replace(/&amp;nbsp;/g, "&nbsp;")
        .trim();
}

function getRenderLocale(props: { puck?: { metadata?: { locale?: SupportedLocale } } }): SupportedLocale {
    const value = props.puck?.metadata?.locale;
    if (value === "nl" || value === "ar") return value;
    return "en";
}

// ──────────────────────── reusable field primitives ─────────────────────────
// Local copies kept tiny on purpose; the canonical helpers live in
// puck.config.tsx and exporting them across files would create a circular
// dependency given that file's own imports.

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

const triLingualLink = (label: string) => ({
    type: "object" as const,
    label,
    objectFields: {
        label: triLingualText("Label"),
        href: { type: "text" as const, label: "Href" },
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

// ─────────────────────────── 1) InsightsGridBlock ──────────────────────────

export type InsightsGridBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    readMoreLabel: LocaleField;
    limit: number;
};

const insightsGridFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: triLingualText("Eyebrow"),
    title: triLingualTextarea("Title"),
    description: triLingualTextarea("Description"),
    readMoreLabel: triLingualText("Read-more label"),
    limit: {
        type: "number" as const,
        label: "Number of articles",
        min: 1,
        max: 12,
    },
} satisfies Fields<InsightsGridBlockProps & { id: string }>;

function buildInsightsGridProps(): InsightsGridBlockProps {
    return {
        style: createSectionStyle({ surfaceTone: "dark", width: "wide", density: "spacious" }),
        eyebrow: { en: "Insights", nl: "Inzichten", ar: "رؤى" },
        title: {
            en: "Recent thinking from the workspace",
            nl: "Recent denkwerk uit de workspace",
            ar: "أحدث الأفكار من ورشة العمل",
        },
        description: {
            en: "Six fresh notes on AI systems, automation, and the operating model behind this workspace.",
            nl: "Zes verse notities over AI-systemen, automatisering en het werkmodel achter deze workspace.",
            ar: "ست ملاحظات حديثة حول أنظمة الذكاء الاصطناعي والأتمتة ونموذج العمل خلف مساحة العمل هذه.",
        },
        readMoreLabel: { en: "Read article", nl: "Lees artikel", ar: "اقرأ المقال" },
        limit: 6,
    };
}

interface InsightsGridProps extends InsightsGridBlockProps {
    locale: SupportedLocale;
}

function InsightsGrid({ locale, eyebrow, title, description, readMoreLabel, limit, style }: InsightsGridProps) {
    return (
        <SectionFrame
            style={style}
            eyebrow={pickLocale(locale, eyebrow)}
            title={pickLocale(locale, title)}
            description={pickRich(locale, description)}
        >
            <InsightsGridClient
                locale={locale}
                eyebrow={eyebrow}
                title={title}
                description={description}
                readMoreLabel={readMoreLabel}
                limit={limit}
                style={style}
            />
        </SectionFrame>
    );
}

// ────────────────────────── 2) BentoFeatureBlock ──────────────────────────

export type BentoTile = {
    id: string;
    icon?: string;
    accent?: "cyan" | "violet" | "amber" | "emerald";
    title: LocaleField;
    description: RichLocaleField;
    image?: string;
    cta?: { label: LocaleField; href: string };
    span?: "tall" | "wide" | "small";
};

export type BentoFeatureBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    tiles: BentoTile[];
};

const BENTO_ICONS: Record<string, ComponentType<{ className?: string }>> = {
    sparkles: Sparkles,
    rocket: Rocket,
    layers: Layers,
    shield: Shield,
    zap: Zap,
    lightbulb: Lightbulb,
    globe: Globe,
    briefcase: Briefcase,
};

const BENTO_ACCENT_RING: Record<NonNullable<BentoTile["accent"]>, string> = {
    cyan: "border-cyan-400/30 [background:radial-gradient(circle_at_top_right,rgba(6,182,212,0.18),transparent_40%)]",
    violet: "border-violet-400/30 [background:radial-gradient(circle_at_top_right,rgba(139,92,246,0.18),transparent_40%)]",
    amber: "border-amber-400/30 [background:radial-gradient(circle_at_top_right,rgba(251,191,36,0.16),transparent_40%)]",
    emerald: "border-emerald-400/30 [background:radial-gradient(circle_at_top_right,rgba(52,211,153,0.16),transparent_40%)]",
};

const bentoFeatureFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: triLingualText("Eyebrow"),
    title: triLingualTextarea("Title"),
    description: triLingualTextarea("Description"),
    tiles: {
        type: "array" as const,
        label: "Bento tiles",
        getItemSummary: (item?: Partial<BentoTile>) =>
            item?.title?.en ?? item?.title?.nl ?? item?.id ?? "Tile",
        arrayFields: {
            id: { type: "text" as const, label: "ID" },
            icon: {
                type: "select" as const,
                label: "Icon",
                options: ["sparkles", "rocket", "layers", "shield", "zap", "lightbulb", "globe", "briefcase"]
                    .map((v) => ({ label: v, value: v })),
            },
            accent: {
                type: "select" as const,
                label: "Accent",
                options: ["cyan", "violet", "amber", "emerald"].map((v) => ({ label: v, value: v })),
            },
            title: triLingualText("Title"),
            description: triLingualTextarea("Description"),
            image: { type: "text" as const, label: "Image URL (optional)" },
            cta: triLingualLink("CTA"),
            span: {
                type: "select" as const,
                label: "Span",
                options: ["tall", "wide", "small"].map((v) => ({ label: v, value: v })),
            },
        },
    },
} satisfies Fields<BentoFeatureBlockProps & { id: string }>;

function buildBentoFeatureProps(): BentoFeatureBlockProps {
    return {
        style: createSectionStyle({ surfaceTone: "dark", width: "wide", density: "spacious" }),
        eyebrow: { en: "What you get", nl: "Wat je krijgt", ar: "ما الذي ستحصل عليه" },
        title: {
            en: "An operating system for the AI-native business",
            nl: "Een besturingssysteem voor het AI-native bedrijf",
            ar: "نظام تشغيل للأعمال الأصلية بالذكاء الاصطناعي",
        },
        description: {
            en: "Four pillars, one cohesive system. Edit each tile or rearrange to fit any landing page.",
            nl: "Vier pijlers, één samenhangend systeem. Bewerk elk vak of herschik vrij voor elke landingspagina.",
            ar: "أربعة ركائز ونظام واحد متكامل. عدّل كل بطاقة أو أعد ترتيبها لتناسب أي صفحة هبوط.",
        },
        tiles: [
            {
                id: "tile-strategy",
                icon: "rocket",
                accent: "cyan",
                span: "tall",
                title: { en: "Strategy & systems design", nl: "Strategie & systeemontwerp", ar: "الاستراتيجية وتصميم الأنظمة" },
                description: {
                    en: "Map the operation end-to-end, then choose where AI agents and automation actually pay back.",
                    nl: "Breng de operatie volledig in kaart en kies waar AI-agents en automatisering werkelijk renderen.",
                    ar: "ارسم خرائط العمليات من البداية إلى النهاية ثم اختر حيث تحقق وكلاء الذكاء الاصطناعي والأتمتة قيمة فعلية.",
                },
            },
            {
                id: "tile-platform",
                icon: "layers",
                accent: "violet",
                span: "small",
                title: { en: "Platform foundation", nl: "Platformfundament", ar: "أساس المنصة" },
                description: {
                    en: "One workspace for content, growth, and operations.",
                    nl: "Eén workspace voor content, groei en operatie.",
                    ar: "مساحة عمل واحدة للمحتوى والنمو والعمليات.",
                },
            },
            {
                id: "tile-automation",
                icon: "zap",
                accent: "amber",
                span: "wide",
                title: { en: "AI-amplified execution", nl: "AI-versterkte uitvoering", ar: "تنفيذ معزز بالذكاء الاصطناعي" },
                description: {
                    en: "Specialist agents handle research, drafting, QA, and delivery support — directed by a human operator.",
                    nl: "Gespecialiseerde agents nemen onderzoek, drafting, QA en delivery-support op zich — onder menselijke regie.",
                    ar: "وكلاء متخصصون يتولّون البحث والصياغة وضمان الجودة ودعم التسليم — بقيادة بشرية.",
                },
            },
            {
                id: "tile-trust",
                icon: "shield",
                accent: "emerald",
                span: "small",
                title: { en: "Trust by design", nl: "Vertrouwen by design", ar: "ثقة بالتصميم" },
                description: {
                    en: "SLAs, RLS, and audit trails baked into the operational layer.",
                    nl: "SLA's, RLS en audit-sporen ingebouwd in de operationele laag.",
                    ar: "اتفاقيات خدمة وأمان على مستوى الصفوف وسجلات تدقيق مدمجة في طبقة العمليات.",
                },
            },
        ],
    };
}

interface BentoFeatureProps extends BentoFeatureBlockProps {
    locale: SupportedLocale;
}

function BentoFeature({ locale, style, eyebrow, title, description, tiles }: BentoFeatureProps) {
    return (
        <SectionFrame
            style={style}
            eyebrow={pickLocale(locale, eyebrow)}
            title={pickLocale(locale, title)}
            description={pickRich(locale, description)}
        >
            <div className="grid auto-rows-[minmax(220px,auto)] gap-4 md:grid-cols-3 md:gap-6 lg:auto-rows-[minmax(220px,auto)] lg:grid-cols-4">
                {tiles.map((tile) => {
                    const Icon = tile.icon ? BENTO_ICONS[tile.icon] ?? Sparkles : Sparkles;
                    const accent = tile.accent ?? "cyan";
                    const span = tile.span ?? "small";
                    const spanClass =
                        span === "tall"
                            ? "md:row-span-2 lg:col-span-2 lg:row-span-2"
                            : span === "wide"
                                ? "lg:col-span-2"
                                : "";
                    return (
                        <div
                            key={tile.id}
                            className={`group relative overflow-hidden rounded-3xl border bg-slate-900/60 p-6 backdrop-blur-md ${BENTO_ACCENT_RING[accent]} ${spanClass}`}
                        >
                            {tile.image ? (
                                <div className="absolute inset-0 -z-10 opacity-30">
                                    <img src={tile.image} alt="" aria-hidden="true" className="h-full w-full object-cover" loading="lazy" />
                                </div>
                            ) : null}
                            <div className="flex h-full flex-col">
                                <div className={`mb-5 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-${accent === "cyan" ? "cyan" : accent === "violet" ? "violet" : accent === "amber" ? "amber" : "emerald"}-300`}>
                                    <Icon className="h-4 w-4" />
                                </div>
                                <h3 className="text-lg font-semibold text-white">{pickLocale(locale, tile.title)}</h3>
                                <p className={`${SUBTLE} mt-2 text-sm leading-relaxed`}>{pickRich(locale, tile.description)}</p>
                                {tile.cta && tile.cta.href ? (
                                    <a href={tile.cta.href} className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200">
                                        {pickLocale(locale, tile.cta.label) || "Learn more"} →
                                    </a>
                                ) : null}
                            </div>
                        </div>
                    );
                })}
            </div>
        </SectionFrame>
    );
}

// ──────────────────────────── 3) PullQuoteBlock ────────────────────────────

export type PullQuoteBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    quote: RichLocaleField;
    authorName: string;
    authorRole: LocaleField;
    authorImage?: string;
    company?: string;
};

const pullQuoteFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: triLingualText("Eyebrow"),
    quote: triLingualTextarea("Quote"),
    authorName: { type: "text" as const, label: "Author name" },
    authorRole: triLingualText("Author role"),
    authorImage: { type: "text" as const, label: "Author image URL (optional)" },
    company: { type: "text" as const, label: "Company / source (optional)" },
} satisfies Fields<PullQuoteBlockProps & { id: string }>;

function buildPullQuoteProps(): PullQuoteBlockProps {
    return {
        style: createSectionStyle({ surfaceTone: "dark", width: "contained", density: "comfortable" }),
        eyebrow: { en: "Voice from the field", nl: "Stem uit de praktijk", ar: "صوت من الميدان" },
        quote: {
            en: "We replaced four overlapping tools and a weekly status meeting with one operating system. Two months later the team is shipping more, with less ceremony.",
            nl: "We vervingen vier overlappende tools en een wekelijkse statusmeeting door één besturingssysteem. Twee maanden later levert het team meer, met minder gedoe.",
            ar: "استبدلنا أربع أدوات متداخلة واجتماع حالة أسبوعي بنظام تشغيل واحد. بعد شهرين، يُسلّم الفريق أكثر بأقل بيروقراطية.",
        },
        authorName: "Renata van Houten",
        authorRole: { en: "COO, Northpath Legal", nl: "COO, Northpath Legal", ar: "المدير التشغيلي، نورث‌باث ليجال" },
        authorImage: "",
        company: "Northpath Legal",
    };
}

interface PullQuoteProps extends PullQuoteBlockProps {
    locale: SupportedLocale;
}

function PullQuote({ locale, style, eyebrow, quote, authorName, authorRole, authorImage, company }: PullQuoteProps) {
    return (
        <SectionFrame style={style} align="center">
            <figure className="mx-auto flex max-w-3xl flex-col items-center gap-8 text-center">
                <Quote className="h-10 w-10 text-cyan-300/60" aria-hidden="true" />
                {style.showEyebrow ? <p className={EYEBROW}>{pickLocale(locale, eyebrow)}</p> : null}
                <blockquote className="text-balance text-2xl font-medium leading-snug text-white sm:text-3xl md:text-[clamp(1.875rem,2.5vw,2.5rem)]">
                    “{pickRich(locale, quote)}”
                </blockquote>
                <figcaption className="flex items-center gap-3">
                    {authorImage ? (
                        <img src={authorImage} alt={authorName} className="h-10 w-10 rounded-full object-cover" loading="lazy" />
                    ) : (
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-500/30 to-violet-500/30" />
                    )}
                    <div className="text-left">
                        <p className="text-sm font-semibold text-white">{authorName}</p>
                        <p className={`${SUBTLE} text-xs`}>
                            {pickLocale(locale, authorRole)}
                            {company ? ` · ${company}` : ""}
                        </p>
                    </div>
                </figcaption>
            </figure>
        </SectionFrame>
    );
}

// ──────────────────────── 4) FaqAccordionBlock ────────────────────────────

export type FaqAccordionItem = {
    id: string;
    question: LocaleField;
    answer: RichLocaleField;
};

export type FaqAccordionBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    items: FaqAccordionItem[];
};

const faqAccordionFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: triLingualText("Eyebrow"),
    title: triLingualTextarea("Title"),
    description: triLingualTextarea("Description"),
    items: {
        type: "array" as const,
        label: "FAQ items",
        getItemSummary: (item?: Partial<FaqAccordionItem>) =>
            item?.question?.en ?? item?.question?.nl ?? item?.id ?? "FAQ",
        arrayFields: {
            id: { type: "text" as const, label: "ID" },
            question: triLingualText("Question"),
            answer: triLingualTextarea("Answer"),
        },
    },
} satisfies Fields<FaqAccordionBlockProps & { id: string }>;

function buildFaqAccordionProps(): FaqAccordionBlockProps {
    return {
        style: createSectionStyle({ surfaceTone: "dark", width: "contained", density: "spacious" }),
        eyebrow: { en: "Frequently asked", nl: "Veelgesteld", ar: "الأسئلة الشائعة" },
        title: { en: "Questions, answered", nl: "Antwoorden in een oogopslag", ar: "إجابات واضحة" },
        description: {
            en: "What teams usually ask before a Systems Fit Call.",
            nl: "Alles wat teams meestal vragen voor een kennismaking.",
            ar: "ما تسأله الفرق عادة قبل مكالمة ملاءمة الأنظمة.",
        },
        items: [
            {
                id: "faq-1",
                question: { en: "How fast can we go live?", nl: "Hoe snel kunnen we live?", ar: "ما السرعة التي يمكننا فيها الانطلاق؟" },
                answer: {
                    en: "Most workspaces ship a usable system within 4 weeks. The exact pace depends on integration scope and content readiness.",
                    nl: "De meeste workspaces gaan binnen 4 weken live met een bruikbaar systeem. Het exacte tempo hangt af van integratiescope en content.",
                    ar: "تنطلق معظم مساحات العمل بنظام قابل للاستخدام خلال 4 أسابيع، حسب نطاق التكامل وجاهزية المحتوى.",
                },
            },
            {
                id: "faq-2",
                question: { en: "Do you replace our existing tools?", nl: "Vervangen jullie onze huidige tools?", ar: "هل تستبدلون أدواتنا الحالية؟" },
                answer: {
                    en: "Often, yes — when the math makes sense. We map your stack first and only consolidate where it visibly reduces friction or cost.",
                    nl: "Vaak wel — als de rekensom klopt. We brengen eerst je stack in kaart en consolideren alleen waar dat aantoonbaar wrijving of kosten wegneemt.",
                    ar: "غالبًا، نعم — عند توفر مبرر مالي. نرسم خرائط حزمتك أولًا ونوحّد فقط حيث يقلّل ذلك بوضوح من الاحتكاك أو التكلفة.",
                },
            },
            {
                id: "faq-3",
                question: { en: "Who owns the system after handover?", nl: "Wie is eigenaar na oplevering?", ar: "من يملك النظام بعد التسليم؟" },
                answer: {
                    en: "You do. The codebase, content, and operational data live in your workspace from day one.",
                    nl: "Jij. De codebase, content en operationele data staan vanaf dag één in jouw workspace.",
                    ar: "أنت. يعيش الكود والمحتوى والبيانات التشغيلية داخل مساحة عملك منذ اليوم الأول.",
                },
            },
        ],
    };
}

interface FaqAccordionProps extends FaqAccordionBlockProps {
    locale: SupportedLocale;
}

function FaqAccordion({ locale, style, eyebrow, title, description, items }: FaqAccordionProps) {
    return (
        <SectionFrame
            style={style}
            eyebrow={pickLocale(locale, eyebrow)}
            title={pickLocale(locale, title)}
            description={pickRich(locale, description)}
        >
            <div className="mx-auto max-w-3xl divide-y divide-white/10 border-y border-white/10">
                {items.map((item) => (
                    <details key={item.id} className="group py-5">
                        <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-left text-base font-medium text-white">
                            <span className="flex items-start gap-3">
                                <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
                                {pickLocale(locale, item.question)}
                            </span>
                            <ChevronDown className="h-5 w-5 shrink-0 text-cyan-300 transition-transform duration-300 group-open:rotate-180" aria-hidden="true" />
                        </summary>
                        <RichTextRenderer
                            content={normalizeBuilderRichText(pickRich(locale, item.answer))}
                            className={`${SUBTLE} mt-3 ms-7 text-sm leading-relaxed`}
                        />
                    </details>
                ))}
            </div>
        </SectionFrame>
    );
}

// ──────────────────────── 5) PricingTiersBlock ────────────────────────────

export type PricingTier = {
    id: string;
    name: LocaleField;
    price: LocaleField;
    period: LocaleField;
    description: RichLocaleField;
    features: Array<{ id: string; en: string; nl: string; ar: string }>;
    cta: { label: LocaleField; href: string };
    popular?: boolean;
};

export type PricingTiersBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    tiers: PricingTier[];
};

const pricingTiersFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: triLingualText("Eyebrow"),
    title: triLingualTextarea("Title"),
    description: triLingualTextarea("Description"),
    tiers: {
        type: "array" as const,
        label: "Pricing tiers",
        getItemSummary: (item?: Partial<PricingTier>) =>
            item?.name?.en ?? item?.name?.nl ?? item?.id ?? "Tier",
        arrayFields: {
            id: { type: "text" as const, label: "ID" },
            name: triLingualText("Name"),
            price: triLingualText("Price"),
            period: triLingualText("Period (e.g. /mo)"),
            description: triLingualTextarea("Description"),
            features: {
                type: "array" as const,
                label: "Features",
                getItemSummary: (item?: { en?: string; nl?: string; id?: string }) =>
                    item?.en ?? item?.nl ?? item?.id ?? "Feature",
                arrayFields: {
                    id: { type: "text" as const, label: "ID" },
                    en: { type: "text" as const, label: "English" },
                    nl: { type: "text" as const, label: "Dutch" },
                    ar: { type: "text" as const, label: "Arabic" },
                },
            },
            cta: triLingualLink("CTA"),
            popular: {
                type: "radio" as const,
                label: "Highlight as popular",
                options: [
                    { label: "No", value: false },
                    { label: "Yes", value: true },
                ],
            },
        },
    },
} satisfies Fields<PricingTiersBlockProps & { id: string }>;

function buildPricingTiersProps(): PricingTiersBlockProps {
    return {
        style: createSectionStyle({ surfaceTone: "dark", width: "wide", density: "spacious" }),
        eyebrow: { en: "Engagement models", nl: "Samenwerkingsmodellen", ar: "نماذج التعاون" },
        title: { en: "Choose how you want to start", nl: "Kies hoe je wilt starten", ar: "اختر كيف تريد البدء" },
        description: {
            en: "Three transparent ways to engage. Move between them as your operation matures.",
            nl: "Drie transparante manieren om met ons te starten. Beweeg ertussen naarmate je operatie volwassener wordt.",
            ar: "ثلاث طرق شفافة للبدء. تنقّل بينها مع نضوج عملياتك.",
        },
        tiers: [
            {
                id: "tier-audit",
                name: { en: "Audit & roadmap", nl: "Audit & roadmap", ar: "تدقيق وخارطة طريق" },
                price: { en: "€4,500", nl: "€4.500", ar: "‎4,500‎ €" },
                period: { en: "fixed", nl: "vast", ar: "ثابت" },
                description: {
                    en: "A two-week diagnostic of your operation, stack, and growth path.",
                    nl: "Tweeweekse diagnose van je operatie, stack en groeipad.",
                    ar: "تشخيص لمدة أسبوعين لعملياتك وأدواتك ومسار نموك.",
                },
                features: [
                    { id: "f1", en: "Operational map", nl: "Operationele kaart", ar: "خريطة تشغيلية" },
                    { id: "f2", en: "Tech-stack audit", nl: "Tech-stack audit", ar: "تدقيق حزمة التقنيات" },
                    { id: "f3", en: "12-month roadmap", nl: "12-maands roadmap", ar: "خارطة طريق 12 شهرًا" },
                ],
                cta: { label: { en: "Book a call", nl: "Plan een gesprek", ar: "احجز مكالمة" }, href: "/contact" },
            },
            {
                id: "tier-build",
                name: { en: "Build sprint", nl: "Build sprint", ar: "سبرينت البناء" },
                price: { en: "€18,000", nl: "€18.000", ar: "‎18,000‎ €" },
                period: { en: "/sprint", nl: "/sprint", ar: "/سبرينت" },
                description: {
                    en: "Six-week delivery sprint to ship a website, automation layer, or internal platform.",
                    nl: "Zesweekse delivery sprint voor een website, automatisering of intern platform.",
                    ar: "سبرينت تسليم لمدة ستة أسابيع لإطلاق موقع أو طبقة أتمتة أو منصة داخلية.",
                },
                features: [
                    { id: "f1", en: "Strategy + design + build", nl: "Strategie + ontwerp + bouw", ar: "استراتيجية + تصميم + بناء" },
                    { id: "f2", en: "AI workflow integration", nl: "AI-workflow integratie", ar: "تكامل تدفقات الذكاء الاصطناعي" },
                    { id: "f3", en: "Handover + 30-day support", nl: "Oplevering + 30 dagen support", ar: "تسليم ودعم 30 يومًا" },
                    { id: "f4", en: "Production-ready system", nl: "Productie-klaar systeem", ar: "نظام جاهز للإنتاج" },
                ],
                cta: { label: { en: "Start a sprint", nl: "Start een sprint", ar: "ابدأ سبرينت" }, href: "/contact" },
                popular: true,
            },
            {
                id: "tier-embed",
                name: { en: "Embedded support", nl: "Embedded support", ar: "دعم مدمج" },
                price: { en: "€6,500", nl: "€6.500", ar: "‎6,500‎ €" },
                period: { en: "/mo", nl: "/maand", ar: "/شهر" },
                description: {
                    en: "Specialist delivery partner inside your team under a service agreement.",
                    nl: "Specialistische delivery-partner binnen je team onder service agreement.",
                    ar: "شريك تسليم متخصص داخل فريقك بموجب اتفاقية خدمة.",
                },
                features: [
                    { id: "f1", en: "Dedicated operator", nl: "Toegewijde operator", ar: "مشغّل مخصص" },
                    { id: "f2", en: "Monthly delivery cadence", nl: "Maandelijkse delivery cadence", ar: "إيقاع تسليم شهري" },
                    { id: "f3", en: "SLA-backed support", nl: "SLA-gebaseerde support", ar: "دعم بموجب اتفاقية مستوى خدمة" },
                ],
                cta: { label: { en: "Discuss embedding", nl: "Bespreek embedding", ar: "ناقش الاندماج" }, href: "/contact" },
            },
        ],
    };
}

interface PricingTiersProps extends PricingTiersBlockProps {
    locale: SupportedLocale;
}

function PricingTiers({ locale, style, eyebrow, title, description, tiers }: PricingTiersProps) {
    return (
        <SectionFrame
            style={style}
            eyebrow={pickLocale(locale, eyebrow)}
            title={pickLocale(locale, title)}
            description={pickRich(locale, description)}
            align="center"
        >
            <div className="grid gap-6 md:grid-cols-3">
                {tiers.map((tier) => {
                    const featureLocale = (f: PricingTier["features"][number]) =>
                        locale === "nl" ? f.nl : locale === "ar" ? f.ar : f.en;
                    return (
                        <div
                            key={tier.id}
                            className={`relative flex flex-col rounded-3xl border bg-slate-900/60 p-7 backdrop-blur-md ${tier.popular ? "border-cyan-400/60 shadow-[0_0_60px_rgba(6,182,212,0.18)]" : "border-white/10"}`}
                        >
                            {tier.popular ? (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-cyan-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-950">
                                    {locale === "nl" ? "Populair" : locale === "ar" ? "الأكثر طلبًا" : "Most popular"}
                                </div>
                            ) : null}
                            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">{pickLocale(locale, tier.name)}</h3>
                            <div className="mt-4 flex items-baseline gap-1">
                                <span className="text-4xl font-bold text-white">{pickLocale(locale, tier.price)}</span>
                                <span className={`${SUBTLE} text-sm`}>{pickLocale(locale, tier.period)}</span>
                            </div>
                            <p className={`${MUTED} mt-3 text-sm leading-relaxed`}>{pickRich(locale, tier.description)}</p>
                            <ul className="mt-6 space-y-3 text-sm">
                                {tier.features.map((f) => (
                                    <li key={f.id} className="flex items-start gap-2 text-slate-300">
                                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
                                        <span>{featureLocale(f) || f.en}</span>
                                    </li>
                                ))}
                            </ul>
                            <a
                                href={tier.cta.href}
                                className={`mt-8 ${tier.popular ? CTA_PRIMARY : CTA_GHOST}`}
                            >
                                {pickLocale(locale, tier.cta.label)}
                            </a>
                        </div>
                    );
                })}
            </div>
        </SectionFrame>
    );
}

// ────────────────────────── 6) TeamGridBlock ──────────────────────────────

export type TeamMember = {
    id: string;
    name: string;
    role: LocaleField;
    bio: RichLocaleField;
    image?: string;
    linkedinUrl?: string;
    twitterUrl?: string;
};

export type TeamGridBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    members: TeamMember[];
};

const teamGridFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: triLingualText("Eyebrow"),
    title: triLingualTextarea("Title"),
    description: triLingualTextarea("Description"),
    members: {
        type: "array" as const,
        label: "Team members",
        getItemSummary: (item?: Partial<TeamMember>) => item?.name ?? item?.id ?? "Member",
        arrayFields: {
            id: { type: "text" as const, label: "ID" },
            name: { type: "text" as const, label: "Name" },
            role: triLingualText("Role"),
            bio: triLingualTextarea("Bio"),
            image: { type: "text" as const, label: "Photo URL" },
            linkedinUrl: { type: "text" as const, label: "LinkedIn URL" },
            twitterUrl: { type: "text" as const, label: "X / Twitter URL" },
        },
    },
} satisfies Fields<TeamGridBlockProps & { id: string }>;

function buildTeamGridProps(): TeamGridBlockProps {
    return {
        style: createSectionStyle({ surfaceTone: "dark", width: "wide", density: "spacious" }),
        eyebrow: { en: "The team", nl: "Het team", ar: "الفريق" },
        title: { en: "Founder-led, AI-amplified", nl: "Founder-led, AI-versterkt", ar: "بقيادة المؤسس وتعزيز بالذكاء الاصطناعي" },
        description: {
            en: "A small core directing a larger workforce of specialist AI agents.",
            nl: "Een klein kernteam dat een groter werknet van gespecialiseerde AI-agents aanstuurt.",
            ar: "فريق أساسي صغير يدير قوة عاملة أكبر من وكلاء الذكاء الاصطناعي المتخصصين.",
        },
        members: [
            {
                id: "m-1",
                name: "Workspace operator",
                role: { en: "Founder & systems architect", nl: "Founder & systeemarchitect", ar: "المؤسس ومهندس الأنظمة" },
                bio: {
                    en: "Experienced digital systems operator across enterprise and SME environments.",
                    nl: "Ervaren digital-systems-operator voor enterprise- en mkb-omgevingen.",
                    ar: "مشغّل ذو خبرة في الأنظمة الرقمية لبيئات الشركات الكبرى والمتوسطة.",
                },
                image: "",
            },
            {
                id: "m-2",
                name: "Specialist agent fleet",
                role: { en: "Research, drafting, QA", nl: "Onderzoek, drafting, QA", ar: "البحث والصياغة وضمان الجودة" },
                bio: {
                    en: "Domain-tuned agents for web research, content drafting, code review, and operational checks.",
                    nl: "Domein-afgestemde agents voor research, content, code-review en operationele checks.",
                    ar: "وكلاء مضبوطون على المجال للبحث وصياغة المحتوى ومراجعة الكود والفحوصات التشغيلية.",
                },
                image: "",
            },
            {
                id: "m-3",
                name: "Trusted advisors",
                role: { en: "Legal, finance, compliance", nl: "Legal, finance, compliance", ar: "قانوني ومالي والامتثال" },
                bio: {
                    en: "External specialists pulled in on demand for regulated work.",
                    nl: "Externe specialisten op afroep voor gereguleerd werk.",
                    ar: "متخصصون خارجيون يُستدعون عند الطلب للأعمال المنظَّمة.",
                },
                image: "",
            },
        ],
    };
}

interface TeamGridProps extends TeamGridBlockProps {
    locale: SupportedLocale;
}

function TeamGrid({ locale, style, eyebrow, title, description, members }: TeamGridProps) {
    return (
        <SectionFrame
            style={style}
            eyebrow={pickLocale(locale, eyebrow)}
            title={pickLocale(locale, title)}
            description={pickRich(locale, description)}
        >
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {members.map((member) => (
                    <article key={member.id} className={`${CARD} ${CARD_HOVER} flex flex-col p-6`}>
                        <div className="relative mb-5 aspect-[4/5] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500/10 to-violet-500/10">
                            {member.image ? (
                                <img src={member.image} alt={member.name} className="h-full w-full object-cover" loading="lazy" />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center text-cyan-300/40">
                                    <Users className="h-12 w-12" aria-hidden="true" />
                                </div>
                            )}
                        </div>
                        <h3 className="text-lg font-semibold text-white">{member.name}</h3>
                        <p className="mt-1 text-sm font-medium text-cyan-300">{pickLocale(locale, member.role)}</p>
                        <p className={`${SUBTLE} mt-3 text-sm leading-relaxed`}>{pickRich(locale, member.bio)}</p>
                        {(member.linkedinUrl || member.twitterUrl) ? (
                            <div className="mt-5 flex items-center gap-2 border-t border-white/10 pt-4">
                                {member.linkedinUrl ? (
                                    <a href={member.linkedinUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/15 p-2 text-slate-300 transition-colors hover:border-cyan-400/40 hover:text-cyan-300" aria-label="LinkedIn">
                                        <Linkedin className="h-4 w-4" aria-hidden="true" />
                                    </a>
                                ) : null}
                                {member.twitterUrl ? (
                                    <a href={member.twitterUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/15 p-2 text-slate-300 transition-colors hover:border-cyan-400/40 hover:text-cyan-300" aria-label="X / Twitter">
                                        <Twitter className="h-4 w-4" aria-hidden="true" />
                                    </a>
                                ) : null}
                            </div>
                        ) : null}
                    </article>
                ))}
            </div>
        </SectionFrame>
    );
}

// ──────────────────────── 7) CtaSplitBlock ────────────────────────────

export type CtaSplitBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    image?: string;
    primaryCta: { label: LocaleField; href: string };
    secondaryCta?: { label: LocaleField; href: string };
    mediaPosition: "left" | "right";
};

const ctaSplitFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: triLingualText("Eyebrow"),
    title: triLingualTextarea("Title"),
    description: triLingualTextarea("Description"),
    image: { type: "text" as const, label: "Image URL" },
    primaryCta: triLingualLink("Primary CTA"),
    secondaryCta: triLingualLink("Secondary CTA"),
    mediaPosition: {
        type: "radio" as const,
        label: "Image position",
        options: [
            { label: "Left", value: "left" },
            { label: "Right", value: "right" },
        ],
    },
} satisfies Fields<CtaSplitBlockProps & { id: string }>;

function buildCtaSplitProps(): CtaSplitBlockProps {
    return {
        style: createSectionStyle({ surfaceTone: "dark", width: "wide", density: "spacious" }),
        eyebrow: { en: "Next step", nl: "Volgende stap", ar: "الخطوة التالية" },
        title: {
            en: "Translate your operation into a system that runs itself.",
            nl: "Vertaal je operatie naar een systeem dat zichzelf draagt.",
            ar: "حوّل عملياتك إلى نظام يشتغل بنفسه.",
        },
        description: {
            en: "Book the free Systems Fit Call to clarify your highest-value automation problem and whether a scoped engagement makes sense.",
            nl: "Plan de gratis Systems Fit Call om het belangrijkste automatiseringsprobleem te verduidelijken en te bepalen of een afgebakend traject zinvol is.",
            ar: "احجز مكالمة ملاءمة الأنظمة المجانية لتوضيح أهم مشكلة أتمتة وتحديد ما إذا كان مسار محدد النطاق مناسبًا.",
        },
        image: "",
        primaryCta: { label: { en: "Book the Fit Call", nl: "Plan de Fit Call", ar: "احجز مكالمة الملاءمة" }, href: "/booking" },
        secondaryCta: { label: { en: "See services", nl: "Bekijk diensten", ar: "اطّلع على الخدمات" }, href: "/services" },
        mediaPosition: "right",
    };
}

interface CtaSplitProps extends CtaSplitBlockProps {
    locale: SupportedLocale;
}

function CtaSplit({ locale, style, eyebrow, title, description, image, primaryCta, secondaryCta, mediaPosition }: CtaSplitProps) {
    const mediaFirst = mediaPosition === "left";
    return (
        <SectionFrame style={style}>
            <div className={`grid items-stretch gap-6 overflow-hidden rounded-[2.25rem] border border-cyan-500/20 bg-gradient-to-br from-slate-900 to-slate-950 lg:grid-cols-2 ${mediaFirst ? "" : "lg:[&>div:first-child]:order-1"}`}>
                <div className="relative min-h-[280px] lg:min-h-0">
                    {image ? (
                        <img src={image} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                    ) : (
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.25),transparent_60%),radial-gradient(circle_at_bottom_left,rgba(139,92,246,0.18),transparent_60%)]">
                            <div className="absolute inset-0 grid place-items-center text-cyan-300/40">
                                <ImageIcon className="h-16 w-16" aria-hidden="true" />
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex flex-col justify-center gap-4 p-8 md:p-12 lg:p-16">
                    {style.showEyebrow ? <p className={EYEBROW}>{pickLocale(locale, eyebrow)}</p> : null}
                    <h2 className={`${HEADING} text-balance`}>{pickLocale(locale, title)}</h2>
                    <p className={`${MUTED} text-base leading-relaxed`}>{pickRich(locale, description)}</p>
                    <div className="mt-4 flex flex-wrap gap-3">
                        <a href={primaryCta.href} className={CTA_PRIMARY}>
                            <Star className="h-4 w-4" aria-hidden="true" />
                            {pickLocale(locale, primaryCta.label)}
                        </a>
                        {secondaryCta && secondaryCta.href ? (
                            <a href={secondaryCta.href} className={CTA_GHOST}>
                                {pickLocale(locale, secondaryCta.label)}
                            </a>
                        ) : null}
                    </div>
                </div>
            </div>
        </SectionFrame>
    );
}

// ──────────────────────── 8) ToolsHighlightBlock ──────────────────────────
//
// Editor-pickable strip of 1–8 tool cards. Each card is a real
// server-rendered <a href="/tools/<slug>"> so search engines can crawl
// the link out of any Puck-managed page (home, about, blog post) it's
// dropped onto. The tool registry is the single source of truth for
// titles/summaries/minutes — the block stores only the picked slug list,
// so a tool copy edit propagates everywhere automatically.
//
// Added to address the "Discovered – currently not indexed" issue on
// /tools/* URLs: those pages previously had a single inbound link (the
// /tools hub). Featuring them from high-authority pages distributes
// internal link equity and gives Google more crawl signals to act on.

import { TOOL_REGISTRY, TOOL_SLUGS } from "@/features/tools/shared/registry";
import type { ToolLocale, ToolSlug } from "@/features/tools/shared/types";

const TOOL_SLUG_OPTIONS = TOOL_SLUGS.map((slug) => ({
    label: TOOL_REGISTRY[slug].title.en,
    value: slug,
}));

export type ToolHighlightItem = {
    slug: ToolSlug;
};

export type ToolsHighlightBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    tools: ToolHighlightItem[];
    ctaLabel: LocaleField;
};

const toolsHighlightFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: triLingualText("Eyebrow"),
    title: triLingualTextarea("Title"),
    description: triLingualTextarea("Description"),
    tools: {
        type: "array" as const,
        label: "Tools (1–8)",
        min: 1,
        max: TOOL_SLUGS.length,
        defaultItemProps: { slug: TOOL_SLUGS[0] },
        arrayFields: {
            slug: {
                type: "select" as const,
                label: "Tool",
                options: TOOL_SLUG_OPTIONS,
            },
        },
    },
    ctaLabel: triLingualText("Card CTA label"),
} satisfies Fields<ToolsHighlightBlockProps & { id: string }>;

function buildToolsHighlightProps(): ToolsHighlightBlockProps {
    return {
        style: createSectionStyle({ surfaceTone: "dark", width: "wide", density: "spacious" }),
        eyebrow: { en: "Free tools", nl: "Vrijblijvende tools", ar: "أدوات مجانية" },
        title: {
            en: "Diagnose your operation in minutes — no sales call.",
            nl: "Diagnose je operatie in minuten — geen verkoopgesprek.",
            ar: "شخّص عملياتك في دقائق — بلا مكالمة مبيعات.",
        },
        description: {
            en: "Eight short diagnostics built on a practical implementation playbook. Answer 6–10 questions; leave with a number, a roadmap, or a fix.",
            nl: "Acht korte diagnoses, gebouwd op een praktisch implementatiespeelboek. Beantwoord 6–10 vragen; vertrek met een getal, roadmap of fix.",
            ar: "ثمانية تشخيصات قصيرة مبنية على دليل تنفيذ عملي. أجب عن 6–10 أسئلة وستخرج برقم أو خارطة طريق أو حلّ.",
        },
        tools: [
            { slug: "automation-scanner" },
            { slug: "automation-roi-calculator" },
            { slug: "ai-visibility-checker" },
        ],
        ctaLabel: { en: "Open tool", nl: "Open tool", ar: "افتح الأداة" },
    };
}

interface ToolsHighlightProps extends ToolsHighlightBlockProps {
    locale: SupportedLocale;
}

function resolveToolLocale(locale: SupportedLocale): ToolLocale {
    return locale === "nl" || locale === "ar" ? locale : "en";
}

function ToolsHighlight({ locale, style, eyebrow, title, description, tools, ctaLabel }: ToolsHighlightProps) {
    const toolLocale = resolveToolLocale(locale);

    // Defensive: drop unknown slugs (e.g. a slug renamed in the registry but
    // still present in old saved Puck data) so the block never throws and
    // never renders a broken /tools/<dead-slug> link.
    const items = (tools ?? [])
        .map((item) => TOOL_REGISTRY[item?.slug])
        .filter((meta): meta is (typeof TOOL_REGISTRY)[ToolSlug] => Boolean(meta));

    if (items.length === 0) {
        return null;
    }

    const ctaText = pickLocale(locale, ctaLabel) || "Open tool";

    return (
        <SectionFrame
            style={style}
            eyebrow={pickLocale(locale, eyebrow)}
            title={pickLocale(locale, title)}
            description={pickRich(locale, description)}
        >
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((tool) => (
                    <li key={tool.slug}>
                        <a
                            href={`/tools/${tool.slug}`}
                            className={`group relative flex h-full flex-col gap-3 p-6 ${CARD} ${CARD_HOVER}`}
                        >
                            <span className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                <span className="text-cyan-300">{tool.timeMinutes} min</span>
                                <Sparkles className="h-3.5 w-3.5 text-cyan-300/70" aria-hidden />
                            </span>
                            <span className="text-lg font-semibold leading-snug text-white">
                                {tool.title[toolLocale]}
                            </span>
                            <span className="line-clamp-3 text-sm leading-relaxed text-slate-300">
                                {tool.summary[toolLocale]}
                            </span>
                            <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-300 transition-transform group-hover:translate-x-1">
                                {ctaText} <Rocket className="h-3.5 w-3.5" aria-hidden />
                            </span>
                        </a>
                    </li>
                ))}
            </ul>
        </SectionFrame>
    );
}

// ───────────────────── 9) Reporting / proof vocabulary blocks ─────────────────────

type LocalizedCta = {
    label: LocaleField;
    href: string;
};

type EvidenceTone = "cyan" | "emerald" | "amber" | "rose" | "slate";

type SummaryItem = object | null | undefined;

function summaryLocale(item: SummaryItem, key: string): string | undefined {
    if (!item) return undefined;
    const value = (item as Record<string, unknown>)[key];
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const locale = value as { en?: unknown; nl?: unknown; ar?: unknown };
    return typeof locale.en === "string"
        ? locale.en
        : typeof locale.nl === "string"
            ? locale.nl
            : typeof locale.ar === "string"
                ? locale.ar
                : undefined;
}

function summaryString(item: SummaryItem, key: string): string | undefined {
    if (!item) return undefined;
    const value = (item as Record<string, unknown>)[key];
    return typeof value === "string" ? value : undefined;
}

function evidenceToneClasses(tone: EvidenceTone | undefined) {
    if (tone === "emerald") return "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
    if (tone === "amber") return "border-amber-300/25 bg-amber-300/10 text-amber-100";
    if (tone === "rose") return "border-rose-300/25 bg-rose-300/10 text-rose-100";
    if (tone === "slate") return "border-white/10 bg-white/5 text-slate-200";
    return "border-cyan-300/25 bg-cyan-300/10 text-cyan-100";
}

function statusToneClasses(status: string | undefined) {
    if (status === "published" || status === "shipped") return "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
    if (status === "recorded" || status === "careful") return "border-cyan-300/25 bg-cyan-300/10 text-cyan-100";
    if (status === "coming" || status === "roadmap") return "border-amber-300/25 bg-amber-300/10 text-amber-100";
    if (status === "not-shipped") return "border-rose-300/25 bg-rose-300/10 text-rose-100";
    return "border-white/10 bg-white/5 text-slate-200";
}

function featureStatusLabel(locale: SupportedLocale, status: FeatureStatusRow["status"]) {
    const labels: Record<FeatureStatusRow["status"], LocaleField> = {
        shipped: { en: "Live", nl: "Live", ar: "متاح" },
        careful: { en: "Scoped", nl: "Afgebakend", ar: "محدد النطاق" },
        "not-shipped": { en: "Not included", nl: "Niet inbegrepen", ar: "غير مشمول" },
    };
    return pickLocale(locale, labels[status]);
}

const localizedCtaField = (label: string) => ({
    type: "object" as const,
    label,
    objectFields: {
        label: triLingualText("Label"),
        href: { type: "text" as const, label: "Href" },
    },
});

const localeArrayFields = {
    en: { type: "text" as const, label: "English" },
    nl: { type: "text" as const, label: "Dutch" },
    ar: { type: "text" as const, label: "Arabic (العربية)" },
};

interface WorkspaceMetricCard {
    id: string;
    label: LocaleField;
    value: LocaleField;
    context: LocaleField;
    sourceNote: LocaleField;
    tone: EvidenceTone;
}

export type WorkspaceProofLedgerBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    period: LocaleField;
    metrics: WorkspaceMetricCard[];
    footnote: LocaleField;
    disclaimer: LocaleField;
    cta?: LocalizedCta;
};

const workspaceProofLedgerFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: triLingualText("Eyebrow"),
    title: triLingualTextarea("Title"),
    description: triLingualTextarea("Description"),
    period: triLingualText("Report period"),
    metrics: {
        type: "array" as const,
        label: "Metric cards",
        getItemSummary: (item: SummaryItem) => summaryLocale(item, "label") ?? summaryString(item, "id") ?? "Metric",
        arrayFields: {
            id: { type: "text" as const, label: "ID" },
            label: triLingualText("Label"),
            value: triLingualText("Value"),
            context: triLingualTextarea("Context"),
            sourceNote: triLingualText("Source note"),
            tone: {
                type: "select" as const,
                label: "Tone",
                options: ["cyan", "emerald", "amber", "rose", "slate"].map((value) => ({ label: value, value })),
            },
        },
    },
    footnote: triLingualTextarea("How measured footnote"),
    disclaimer: triLingualTextarea("Honesty disclaimer"),
    cta: localizedCtaField("CTA"),
} satisfies Fields<WorkspaceProofLedgerBlockProps & { id: string }>;

function buildWorkspaceProofLedgerProps(): WorkspaceProofLedgerBlockProps {
    return {
        style: createSectionStyle({ surfaceTone: "dark", width: "wide", density: "spacious", alignment: "left" }),
        eyebrow: { en: "Operational proof", nl: "Operationeel bewijs", ar: "إثبات تشغيلي" },
        title: {
            en: "What the workspace has run recently",
            nl: "Wat de werkruimte recent heeft uitgevoerd",
            ar: "ما شغّلته مساحة العمل مؤخرًا",
        },
        description: {
            en: "A short public report: content shipped, AI calls metered, opportunities opened, bookings processed, legal documents generated, and product updates logged. No inflated claims — only what the workspace can account for.",
            nl: "Een kort openbaar rapport: gepubliceerde content, gemeten AI-aanroepen, geopende kansen, verwerkte boekingen, juridische documenten en productupdates. Geen opgeblazen claims — alleen wat de werkruimte kan verantwoorden.",
            ar: "تقرير عام مختصر: محتوى منشور، استدعاءات ذكاء اصطناعي مُقاسة، فرص مفتوحة، حجوزات معالجة، مستندات قانونية وتحديثات منتج موثقة. بلا مبالغة — فقط ما يمكن لمساحة العمل حسابه.",
        },
        period: { en: "Public report · curated monthly", nl: "Publiek rapport · maandelijks samengesteld", ar: "تقرير عام · يُنسّق شهريًا" },
        metrics: [
            { id: "content", label: { en: "Content items", nl: "Contentitems", ar: "عناصر المحتوى" }, value: { en: "Manual", nl: "Handmatig", ar: "يدوي" }, context: { en: "Pages, articles, podcast/video surfaces that were actually published or updated.", nl: "Pagina's, artikelen en podcast/video-oppervlakken die werkelijk zijn gepubliceerd of bijgewerkt.", ar: "صفحات ومقالات وأسطح بودكاست/فيديو نُشرت أو حُدّثت فعليًا." }, sourceNote: { en: "CMS + repo", nl: "CMS + repo", ar: "CMS + المستودع" }, tone: "cyan" },
            { id: "ai", label: { en: "AI usage", nl: "AI-gebruik", ar: "استخدام الذكاء الاصطناعي" }, value: { en: "Metered", nl: "Gemeten", ar: "مُقاس" }, context: { en: "Governed AI work uses a bounded budget and leaves a reviewable usage record.", nl: "Beheerst AI-werk gebruikt een begrensd budget en laat een controleerbaar gebruiksrecord achter.", ar: "يعمل الذكاء الاصطناعي المحكوم ضمن ميزانية محددة ويترك سجل استخدام قابلًا للمراجعة." }, sourceNote: { en: "Usage record", nl: "Gebruiksrecord", ar: "سجل الاستخدام" }, tone: "emerald" },
            { id: "features", label: { en: "Feature updates", nl: "Feature-updates", ar: "تحديثات الميزات" }, value: { en: "Logged", nl: "Geloggd", ar: "موثّقة" }, context: { en: "Public changelog entries name what exists, what changed, and what is not claimed.", nl: "Publieke changelogregels benoemen wat bestaat, wat veranderde en wat niet wordt geclaimd.", ar: "تسمي سجلات التغيير العامة ما هو موجود وما تغيّر وما لا يتم ادعاؤه." }, sourceNote: { en: "Changelog", nl: "Changelog", ar: "سجل التغييرات" }, tone: "amber" },
        ],
        footnote: { en: "Numbers can be curated manually before publication; do not expose private client or workspace data without review.", nl: "Cijfers kunnen vóór publicatie handmatig worden samengesteld; publiceer geen privéklant- of werkruimtedata zonder review.", ar: "يمكن تنسيق الأرقام يدويًا قبل النشر؛ لا تكشف بيانات عميل أو مساحة عمل خاصة دون مراجعة." },
        disclaimer: { en: "This is a reporting block, not a vanity counter. If a metric cannot be traced, it should not be shown.", nl: "Dit is een rapportageblok, geen vanity-counter. Als een metric niet traceerbaar is, hoort hij hier niet thuis.", ar: "هذا قالب تقرير لا عدّاد غرور. إذا تعذر تتبع المقياس، فلا ينبغي عرضه." },
        cta: { label: { en: "Read the changelog", nl: "Lees de changelog", ar: "اقرأ سجل التغييرات" }, href: "/changelog" },
    };
}

function WorkspaceProofLedger({ locale, style, eyebrow, title, description, period, metrics, footnote, disclaimer, cta }: WorkspaceProofLedgerBlockProps & { locale: SupportedLocale }) {
    return (
        <SectionFrame style={style} eyebrow={pickLocale(locale, eyebrow)} title={pickLocale(locale, title)} description={pickRich(locale, description)}>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                    {pickLocale(locale, period)}
                </span>
                {cta?.href && pickLocale(locale, cta.label) ? (
                    <a href={cta.href} className={CTA_GHOST}>{pickLocale(locale, cta.label)} <Rocket className="h-4 w-4" aria-hidden /></a>
                ) : null}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
                {(metrics ?? []).map((metric) => (
                    <article key={metric.id} className={`flex min-h-56 flex-col rounded-2xl border p-5 ${evidenceToneClasses(metric.tone)}`}>
                        <div className="mb-8 flex items-start justify-between gap-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">{pickLocale(locale, metric.label)}</p>
                            <BarChart3 className="h-5 w-5 opacity-70" aria-hidden />
                        </div>
                        <p className="text-4xl font-semibold tracking-[-0.04em] text-white">{pickLocale(locale, metric.value)}</p>
                        <p className="mt-4 text-sm leading-relaxed text-slate-200">{pickLocale(locale, metric.context)}</p>
                        <p className="mt-auto pt-6 text-[11px] uppercase tracking-[0.16em] text-slate-400">{pickLocale(locale, metric.sourceNote)}</p>
                    </article>
                ))}
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
                <p className={`${CARD} p-5 text-sm leading-relaxed text-slate-300`}>{pickLocale(locale, footnote)}</p>
                <p className={`${CARD} border-amber-300/20 bg-amber-300/5 p-5 text-sm leading-relaxed text-amber-100`}>{pickLocale(locale, disclaimer)}</p>
            </div>
        </SectionFrame>
    );
}

interface LegibilityQueryExample {
    id: string;
    query: LocaleField;
    mode: "structured" | "semantic" | "hybrid";
    answer: LocaleField;
}

interface StructuredFactCard {
    id: string;
    label: LocaleField;
    value: LocaleField;
    note: LocaleField;
}

export type LegibilityHubQueryBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    examples: LegibilityQueryExample[];
    facts: StructuredFactCard[];
    provenanceNote: LocaleField;
    cta?: LocalizedCta;
};

const legibilityHubQueryFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: triLingualText("Eyebrow"),
    title: triLingualTextarea("Title"),
    description: triLingualTextarea("Description"),
    examples: {
        type: "array" as const,
        label: "Example queries",
        getItemSummary: (item: SummaryItem) => summaryLocale(item, "query") ?? summaryString(item, "id") ?? "Query",
        arrayFields: {
            id: { type: "text" as const, label: "ID" },
            query: triLingualText("Query"),
            mode: { type: "select" as const, label: "Mode", options: ["structured", "semantic", "hybrid"].map((value) => ({ label: value, value })) },
            answer: triLingualTextarea("Answer preview"),
        },
    },
    facts: {
        type: "array" as const,
        label: "Structured fact cards",
        getItemSummary: (item: SummaryItem) => summaryLocale(item, "label") ?? summaryString(item, "id") ?? "Fact",
        arrayFields: {
            id: { type: "text" as const, label: "ID" },
            label: triLingualText("Label"),
            value: triLingualText("Value"),
            note: triLingualTextarea("Note"),
        },
    },
    provenanceNote: triLingualTextarea("Provenance note"),
    cta: localizedCtaField("CTA"),
} satisfies Fields<LegibilityHubQueryBlockProps & { id: string }>;

function buildLegibilityHubQueryProps(): LegibilityHubQueryBlockProps {
    return {
        style: createSectionStyle({ surfaceTone: "dark", width: "wide", density: "spacious", alignment: "left" }),
        eyebrow: { en: "Legibility Hub", nl: "Legibility Hub", ar: "مركز الوضوح" },
        title: { en: "Ask the workspace operational questions without raw SQL.", nl: "Stel operationele vragen aan de werkruimte zonder ruwe SQL.", ar: "اسأل مساحة العمل أسئلة تشغيلية دون SQL خام." },
        description: { en: "Structured counts run through allowlisted database cards. Narrative context uses semantic retrieval only when needed. Hybrid answers separate deterministic facts from retrieved snippets and show provenance.", nl: "Gestructureerde tellingen lopen via vooraf toegestane databasekaarten. Narratieve context gebruikt semantische retrieval alleen wanneer nodig. Hybride antwoorden scheiden deterministische feiten van opgehaalde snippets en tonen herkomst.", ar: "تعمل العدّادات المنظمة عبر بطاقات قاعدة بيانات مسموح بها. يستخدم السياق السردي الاسترجاع الدلالي فقط عند الحاجة. تفصل الإجابات الهجينة الحقائق الحتمية عن المقاطع المسترجعة وتعرض المصدر." },
        examples: [
            { id: "overdue", query: { en: "What is overdue this week?", nl: "Wat is deze week te laat?", ar: "ما المتأخر هذا الأسبوع؟" }, mode: "structured", answer: { en: "Counts overdue SLA tasks from scoped workspace tables.", nl: "Telt achterstallige SLA-taken uit scoped werkruimtetabellen.", ar: "يعد مهام SLA المتأخرة من جداول مساحة العمل المحددة." } },
            { id: "clients", query: { en: "Which clients need attention and why?", nl: "Welke klanten vragen aandacht en waarom?", ar: "أي العملاء يحتاجون انتباهًا ولماذا؟" }, mode: "hybrid", answer: { en: "Combines unresolved flags with recent semantic notes.", nl: "Combineert open vlaggen met recente semantische notities.", ar: "يجمع العلامات غير المحلولة مع الملاحظات الدلالية الحديثة." } },
            { id: "content", query: { en: "What content exists for booking and legal workflows?", nl: "Welke content bestaat rond boeking en juridische workflows?", ar: "ما المحتوى الموجود للحجز والتدفقات القانونية؟" }, mode: "semantic", answer: { en: "Retrieves relevant workspace semantic nodes with citations.", nl: "Haalt relevante semantische knooppunten uit de werkruimte op met citaties.", ar: "يسترجع العقد الدلالية ذات الصلة في مساحة العمل مع الاستشهادات." } },
        ],
        facts: [
            { id: "allowlisted", label: { en: "Query cards", nl: "Querykaarten", ar: "بطاقات الاستعلام" }, value: { en: "Allowlisted", nl: "Toegestaan", ar: "مسموح بها" }, note: { en: "No generated text-to-SQL surface is exposed.", nl: "Er wordt geen gegenereerde text-to-SQL-interface geopend.", ar: "لا يتم كشف واجهة text-to-SQL مولدة." } },
            { id: "metering", label: { en: "Metering", nl: "Metering", ar: "القياس" }, value: { en: "Only on synthesis", nl: "Alleen bij synthese", ar: "فقط عند التركيب" }, note: { en: "Structured-only answers avoid Gemini and do not burn credits.", nl: "Alleen gestructureerde antwoorden vermijden Gemini en kosten geen credits.", ar: "الإجابات المنظمة فقط تتجنب Gemini ولا تستهلك أرصدة." } },
            { id: "scope", label: { en: "Scope", nl: "Scope", ar: "النطاق" }, value: { en: "Workspace RLS", nl: "Workspace RLS", ar: "RLS لمساحة العمل" }, note: { en: "No cross-workspace data access is claimed or allowed.", nl: "Cross-workspace datatoegang wordt niet geclaimd en niet toegestaan.", ar: "لا يُدعى أو يُسمح بالوصول عبر مساحات عمل متعددة." } },
        ],
        provenanceNote: { en: "Every answer can expose provenance: tables, filters, definitions, semantic snippets, and whether Gemini synthesis was used.", nl: "Elk antwoord kan herkomst tonen: tabellen, filters, definities, semantische snippets en of Gemini-synthese is gebruikt.", ar: "يمكن لكل إجابة إظهار المصدر: الجداول والفلاتر والتعريفات والمقاطع الدلالية وما إذا استُخدم تركيب Gemini." },
        cta: { label: { en: "Audit governance", nl: "Audit governance", ar: "دقّق الحوكمة" }, href: "/governance" },
    };
}

function LegibilityHubQuery({ locale, style, eyebrow, title, description, examples, facts, provenanceNote, cta }: LegibilityHubQueryBlockProps & { locale: SupportedLocale }) {
    return (
        <SectionFrame style={style} eyebrow={pickLocale(locale, eyebrow)} title={pickLocale(locale, title)} description={pickRich(locale, description)}>
            <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
                <div className="space-y-4">
                    {(examples ?? []).map((example) => (
                        <article key={example.id} className={`${CARD} ${CARD_HOVER} p-5`}>
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                                <p className="text-lg font-semibold text-white">“{pickLocale(locale, example.query)}”</p>
                                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${statusToneClasses(example.mode === "hybrid" ? "recorded" : example.mode === "structured" ? "shipped" : "coming")}`}>{example.mode}</span>
                            </div>
                            <p className="text-sm leading-relaxed text-slate-300">{pickLocale(locale, example.answer)}</p>
                        </article>
                    ))}
                </div>
                <div className="space-y-4">
                    {(facts ?? []).map((fact) => (
                        <article key={fact.id} className={`${CARD} p-5`}>
                            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">{pickLocale(locale, fact.label)}</p>
                            <p className="mt-3 text-2xl font-semibold text-white">{pickLocale(locale, fact.value)}</p>
                            <p className="mt-2 text-sm leading-relaxed text-slate-300">{pickLocale(locale, fact.note)}</p>
                        </article>
                    ))}
                    <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5 text-sm leading-relaxed text-amber-100">
                        <Database className="mb-3 h-5 w-5" aria-hidden />
                        {pickLocale(locale, provenanceNote)}
                    </div>
                    {cta?.href ? <a href={cta.href} className={CTA_PRIMARY}>{pickLocale(locale, cta.label)}</a> : null}
                </div>
            </div>
        </SectionFrame>
    );
}

interface PopupTemplateCard {
    id: string;
    title: LocaleField;
    body: LocaleField;
    kind: string;
}

interface MiniMetric {
    id: string;
    label: LocaleField;
    value: LocaleField;
}

export type PopupConversionLayerBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    templates: PopupTemplateCard[];
    triggerChips: LocaleField[];
    localeChips: LocaleField[];
    reportingMetrics: MiniMetric[];
    cta?: LocalizedCta;
};

const popupConversionLayerFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: triLingualText("Eyebrow"),
    title: triLingualTextarea("Title"),
    description: triLingualTextarea("Description"),
    templates: {
        type: "array" as const,
        label: "Popup templates",
        getItemSummary: (item: SummaryItem) => summaryLocale(item, "title") ?? summaryString(item, "kind") ?? "Template",
        arrayFields: {
            id: { type: "text" as const, label: "ID" },
            title: triLingualText("Title"),
            body: triLingualTextarea("Body"),
            kind: { type: "text" as const, label: "Template kind" },
        },
    },
    triggerChips: { type: "array" as const, label: "Trigger chips", arrayFields: localeArrayFields },
    localeChips: { type: "array" as const, label: "Locale chips", arrayFields: localeArrayFields },
    reportingMetrics: {
        type: "array" as const,
        label: "Reporting metrics",
        getItemSummary: (item: SummaryItem) => summaryLocale(item, "label") ?? summaryString(item, "id") ?? "Metric",
        arrayFields: { id: { type: "text" as const, label: "ID" }, label: triLingualText("Label"), value: triLingualText("Value") },
    },
    cta: localizedCtaField("CTA"),
} satisfies Fields<PopupConversionLayerBlockProps & { id: string }>;

function buildPopupConversionLayerProps(): PopupConversionLayerBlockProps {
    return {
        style: createSectionStyle({ surfaceTone: "dark", width: "wide", density: "spacious" }),
        eyebrow: { en: "Workspace Popups", nl: "Workspace Popups", ar: "نوافذ مساحة العمل" },
        title: { en: "Conversion utility built into the workspace, not bolted on.", nl: "Conversiefunctionaliteit ingebouwd in de werkruimte, niet achteraf vastgeplakt.", ar: "أداة تحويل مدمجة في مساحة العمل، لا إضافة خارجية." },
        description: { en: "Newsletter and booking popups inherit locale handling, scheduling, GDPR posture, and analytics from the same workspace instead of another vendor tag.", nl: "Nieuwsbrief- en boekingspopups erven taalafhandeling, planning, GDPR-houding en analytics uit dezelfde werkruimte in plaats van nog een vendor-tag.", ar: "ترث نوافذ النشرة والحجز اللغة والجدولة ووضع GDPR والتحليلات من مساحة العمل نفسها بدل وسم مزود آخر." },
        templates: [
            { id: "newsletter-classic", kind: "newsletter-classic", title: { en: "Newsletter classic", nl: "Nieuwsbrief classic", ar: "النشرة الكلاسيكية" }, body: { en: "Longer value proposition, email capture, clear dismiss label.", nl: "Langere waardepropositie, e-mailcapture, duidelijke sluitoptie.", ar: "عرض قيمة أطول، التقاط بريد، وزر إغلاق واضح." } },
            { id: "newsletter-minimal", kind: "newsletter-minimal", title: { en: "Newsletter minimal", nl: "Nieuwsbrief minimal", ar: "النشرة المختصرة" }, body: { en: "Lightweight subscription prompt for high-intent pages.", nl: "Lichte inschrijfprompt voor pagina's met hoge intentie.", ar: "دعوة اشتراك خفيفة لصفحات عالية النية." } },
            { id: "booking-promo", kind: "booking-promo", title: { en: "Booking promo", nl: "Boekingspromo", ar: "ترويج الحجز" }, body: { en: "Invite visitors to the free Systems Fit Call.", nl: "Nodigt bezoekers uit voor de gratis Systems Fit Call.", ar: "يدعو الزوار إلى مكالمة ملاءمة الأنظمة المجانية." } },
            { id: "booking-urgency", kind: "booking-urgency", title: { en: "Booking urgency", nl: "Boekingsurgentie", ar: "إلحاح الحجز" }, body: { en: "Time-windowed offer with scheduled start and end.", nl: "Tijdgebonden aanbod met geplande start en einde.", ar: "عرض بزمن محدد مع بداية ونهاية مجدولتين." } },
        ],
        triggerChips: [{ en: "Exit intent", nl: "Exit intent", ar: "نية الخروج" }, { en: "Timed", nl: "Getimed", ar: "مؤقت" }],
        localeChips: [{ en: "EN", nl: "EN", ar: "EN" }, { en: "NL", nl: "NL", ar: "NL" }, { en: "AR + RTL fallback", nl: "AR + RTL-fallback", ar: "AR + دعم RTL" }],
        reportingMetrics: [
            { id: "impressions", label: { en: "Impressions", nl: "Vertoningen", ar: "الظهور" }, value: { en: "Tracked", nl: "Getrackt", ar: "متتبّع" } },
            { id: "dismissals", label: { en: "Dismissals", nl: "Sluitingen", ar: "الإغلاقات" }, value: { en: "Tracked", nl: "Getrackt", ar: "متتبّع" } },
            { id: "conversions", label: { en: "Conversions", nl: "Conversies", ar: "التحويلات" }, value: { en: "Tracked", nl: "Getrackt", ar: "متتبّع" } },
        ],
        cta: { label: { en: "Map a conversion layer", nl: "Breng een conversielaag in kaart", ar: "خطط طبقة تحويل" }, href: "/contact" },
    };
}

function PopupConversionLayer({ locale, style, eyebrow, title, description, templates, triggerChips, localeChips, reportingMetrics, cta }: PopupConversionLayerBlockProps & { locale: SupportedLocale }) {
    return (
        <SectionFrame style={style} eyebrow={pickLocale(locale, eyebrow)} title={pickLocale(locale, title)} description={pickRich(locale, description)}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {(templates ?? []).map((template) => (
                    <article key={template.id} className={`${CARD} ${CARD_HOVER} overflow-hidden p-5`}>
                        <div className="mb-5 rounded-2xl border border-white/10 bg-slate-900/80 p-4 shadow-2xl">
                            <div className="mb-3 h-2 w-20 rounded-full bg-cyan-300/60" />
                            <p className="text-sm font-semibold text-white">{pickLocale(locale, template.title)}</p>
                            <p className="mt-2 text-xs leading-relaxed text-slate-400">{pickLocale(locale, template.body)}</p>
                            <div className="mt-4 h-8 rounded-full bg-cyan-400/20" />
                        </div>
                        <span className="text-[11px] uppercase tracking-[0.16em] text-cyan-300">{template.kind}</span>
                    </article>
                ))}
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
                <ChipPanel icon={<MousePointerClick className="h-5 w-5" aria-hidden />} title="Triggers" chips={triggerChips} locale={locale} />
                <ChipPanel icon={<Globe className="h-5 w-5" aria-hidden />} title="Locales" chips={localeChips} locale={locale} />
                <div className={`${CARD} p-5`}>
                    <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Reporting</p>
                    <div className="grid grid-cols-3 gap-2">
                        {(reportingMetrics ?? []).map((metric) => (
                            <div key={metric.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                                <p className="text-xs text-slate-400">{pickLocale(locale, metric.label)}</p>
                                <p className="mt-1 text-sm font-semibold text-white">{pickLocale(locale, metric.value)}</p>
                            </div>
                        ))}
                    </div>
                    {cta?.href ? <a href={cta.href} className="mt-5 inline-flex text-sm font-semibold text-cyan-300">{pickLocale(locale, cta.label)} →</a> : null}
                </div>
            </div>
        </SectionFrame>
    );
}

function ChipPanel({ icon, title, chips, locale }: { icon: ReactNode; title: string; chips: LocaleField[]; locale: SupportedLocale }) {
    return (
        <div className={`${CARD} p-5`}>
            <div className="mb-4 flex items-center gap-2 text-cyan-300">{icon}<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</p></div>
            <div className="flex flex-wrap gap-2">
                {(chips ?? []).map((chip, index) => <span key={`${title}-${index}`} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">{pickLocale(locale, chip)}</span>)}
            </div>
        </div>
    );
}

interface LifecycleStep {
    id: string;
    badge: LocaleField;
    title: LocaleField;
    body: LocaleField;
}

export type NewsletterLifecycleBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    steps: LifecycleStep[];
    complianceNotes: LocaleField[];
    replaces: LocaleField[];
    cta?: LocalizedCta;
};

const newsletterLifecycleFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: triLingualText("Eyebrow"),
    title: triLingualTextarea("Title"),
    description: triLingualTextarea("Description"),
    steps: {
        type: "array" as const,
        label: "Lifecycle steps",
        getItemSummary: (item: SummaryItem) => summaryLocale(item, "title") ?? summaryString(item, "id") ?? "Step",
        arrayFields: { id: { type: "text" as const, label: "ID" }, badge: triLingualText("Badge"), title: triLingualText("Title"), body: triLingualTextarea("Body") },
    },
    complianceNotes: { type: "array" as const, label: "Compliance notes", arrayFields: localeArrayFields },
    replaces: { type: "array" as const, label: "What this replaces", arrayFields: localeArrayFields },
    cta: localizedCtaField("CTA"),
} satisfies Fields<NewsletterLifecycleBlockProps & { id: string }>;

function buildNewsletterLifecycleProps(): NewsletterLifecycleBlockProps {
    return {
        style: createSectionStyle({ surfaceTone: "dark", width: "wide", density: "spacious" }),
        eyebrow: { en: "Newsletter operating system", nl: "Nieuwsbrief operating system", ar: "نظام تشغيل النشرة" },
        title: { en: "A published article should not die in the CMS.", nl: "Een gepubliceerd artikel hoort niet te sterven in het CMS.", ar: "لا ينبغي أن يموت المقال المنشور داخل CMS." },
        description: { en: "The newsletter layer turns content into a scheduled, trackable campaign with consent, unsubscribe, bounce suppression, and webhook-backed reporting.", nl: "De nieuwsbrieflaag verandert content in een geplande, meetbare campagne met toestemming, uitschrijven, bounce-suppressie en webhookrapportage.", ar: "تحول طبقة النشرة المحتوى إلى حملة مجدولة وقابلة للتتبع مع الموافقة وإلغاء الاشتراك وقمع الارتداد وتقارير webhooks." },
        steps: [
            { id: "audience", badge: { en: "01", nl: "01", ar: "01" }, title: { en: "Audience", nl: "Publiek", ar: "الجمهور" }, body: { en: "Contacts and lists remain workspace-scoped.", nl: "Contacten en lijsten blijven workspace-scoped.", ar: "تبقى جهات الاتصال والقوائم ضمن مساحة العمل." } },
            { id: "template", badge: { en: "02", nl: "02", ar: "02" }, title: { en: "Template", nl: "Template", ar: "القالب" }, body: { en: "Broadcast, welcome, nurture, and re-engagement templates.", nl: "Broadcast-, welkom-, nurture- en re-engagementtemplates.", ar: "قوالب بث وترحيب ورعاية وإعادة تفاعل." } },
            { id: "content", badge: { en: "03", nl: "03", ar: "03" }, title: { en: "Content conversion", nl: "Contentconversie", ar: "تحويل المحتوى" }, body: { en: "Published posts can feed campaign automation.", nl: "Gepubliceerde posts kunnen campagneautomatisering voeden.", ar: "يمكن للمنشورات المنشورة تغذية أتمتة الحملات." } },
            { id: "dispatch", badge: { en: "04", nl: "04", ar: "04" }, title: { en: "Scheduled dispatch", nl: "Geplande verzending", ar: "إرسال مجدول" }, body: { en: "Resend-backed batches with resumable jobs.", nl: "Resend-batches met hervatbare jobs.", ar: "دفعات Resend بمهام قابلة للاستئناف." } },
            { id: "tracking", badge: { en: "05", nl: "05", ar: "05" }, title: { en: "Tracking", nl: "Tracking", ar: "التتبع" }, body: { en: "Opens, clicks, delivered, delayed, bounced, complained.", nl: "Opens, clicks, delivered, delayed, bounced, complained.", ar: "فتح ونقر وتسليم وتأخير وارتداد وشكوى." } },
        ],
        complianceNotes: [{ en: "Double opt-in", nl: "Double opt-in", ar: "اشتراك مؤكد" }, { en: "One-click unsubscribe", nl: "One-click uitschrijven", ar: "إلغاء بنقرة واحدة" }, { en: "Bounce + complaint suppression", nl: "Bounce- en klachtensuppressie", ar: "قمع الارتداد والشكاوى" }],
        replaces: [{ en: "Mailchimp for basic campaigns", nl: "Mailchimp voor basiscampagnes", ar: "Mailchimp للحملات الأساسية" }, { en: "Manual blog-to-email copy-paste", nl: "Handmatig blog-naar-mail kopiëren", ar: "نسخ يدوي من المدونة إلى البريد" }, { en: "Separate campaign tracking sheet", nl: "Los campagne-trackingbestand", ar: "جدول تتبع حملات منفصل" }],
        cta: { label: { en: "Plan the growth loop", nl: "Plan de growth-loop", ar: "خطط حلقة النمو" }, href: "/contact" },
    };
}

function NewsletterLifecycle({ locale, style, eyebrow, title, description, steps, complianceNotes, replaces, cta }: NewsletterLifecycleBlockProps & { locale: SupportedLocale }) {
    return <LifecycleRender locale={locale} style={style} eyebrow={eyebrow} title={title} description={description} steps={steps} notesTitle="Compliance" notes={complianceNotes} replaces={replaces} cta={cta} icon={<Mail className="h-5 w-5" aria-hidden />} />;
}

export type BookingLifecycleReportBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    adapterType: LocaleField;
    lifecycleCards: LifecycleStep[];
    antiAbuseNote: LocaleField;
    metrics: MiniMetric[];
    cta?: LocalizedCta;
};

const bookingLifecycleReportFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: triLingualText("Eyebrow"),
    title: triLingualTextarea("Title"),
    description: triLingualTextarea("Description"),
    adapterType: triLingualText("Adapter type label"),
    lifecycleCards: {
        type: "array" as const,
        label: "Lifecycle cards",
        getItemSummary: (item: SummaryItem) => summaryLocale(item, "title") ?? summaryString(item, "id") ?? "Lifecycle card",
        arrayFields: { id: { type: "text" as const, label: "ID" }, badge: triLingualText("Badge"), title: triLingualText("Title"), body: triLingualTextarea("Body") },
    },
    antiAbuseNote: triLingualTextarea("Anti-abuse note"),
    metrics: { type: "array" as const, label: "KPI cards", getItemSummary: (item: SummaryItem) => summaryLocale(item, "label") ?? summaryString(item, "id") ?? "Metric", arrayFields: { id: { type: "text" as const, label: "ID" }, label: triLingualText("Label"), value: triLingualText("Value") } },
    cta: localizedCtaField("CTA"),
} satisfies Fields<BookingLifecycleReportBlockProps & { id: string }>;

function buildBookingLifecycleReportProps(): BookingLifecycleReportBlockProps {
    return {
        style: createSectionStyle({ surfaceTone: "dark", width: "wide", density: "spacious" }),
        eyebrow: { en: "Booking lifecycle", nl: "Boekingslifecycle", ar: "دورة حياة الحجز" },
        title: { en: "Your booking becomes an operational record.", nl: "Uw boeking wordt een operationeel record.", ar: "يتحول الحجز إلى سجل تشغيلي." },
        description: { en: "The booking is not the end of the form. It can become a client record, confirmation trail, Legal Vault draft, and follow-up path.", nl: "De boeking is niet het einde van het formulier. Ze kan een klantrecord, bevestigingsspoor, Legal Vault-concept en opvolgpad worden.", ar: "الحجز ليس نهاية النموذج. يمكن أن يصبح سجل عميل ومسار تأكيد ومسودة Legal Vault ومسار متابعة." },
        adapterType: { en: "Consultation · horeca · real estate · custom", nl: "Consult · horeca · vastgoed · custom", ar: "استشارة · ضيافة · عقار · مخصص" },
        lifecycleCards: [
            { id: "reserved", badge: { en: "Reserved", nl: "Gereserveerd", ar: "محجوز" }, title: { en: "Reservation captured", nl: "Reservering vastgelegd", ar: "تم التقاط الحجز" }, body: { en: "Public availability and active/gated/unavailable states guide the intake.", nl: "Publieke beschikbaarheid en actieve/geblokkeerde/niet-beschikbare staten sturen de intake.", ar: "توجه حالات التوفر العامة والنشطة/المقيدة/غير المتاحة الإدخال." } },
            { id: "confirmed", badge: { en: "Confirmed", nl: "Bevestigd", ar: "مؤكد" }, title: { en: "Status history", nl: "Statushistorie", ar: "تاريخ الحالة" }, body: { en: "Reservation changes create an operational trail instead of a lost inbox thread.", nl: "Wijzigingen maken een operationeel spoor in plaats van een verloren inboxthread.", ar: "تُنشئ التغييرات أثرًا تشغيليًا بدل خيط بريد ضائع." } },
            { id: "portal", badge: { en: "Portal", nl: "Portaal", ar: "البوابة" }, title: { en: "Client access on consent", nl: "Klanttoegang met toestemming", ar: "وصول العميل بموافقة" }, body: { en: "Portal-client provisioning can attach the booking to a future client workspace relationship.", nl: "Portal-client provisioning kan de boeking koppelen aan een toekomstige klantrelatie.", ar: "يمكن لتجهيز عميل البوابة ربط الحجز بعلاقة عميل مستقبلية." } },
            { id: "legal", badge: { en: "Legal", nl: "Legal", ar: "قانوني" }, title: { en: "DVO draft path", nl: "DVO-conceptpad", ar: "مسار مسودة DVO" }, body: { en: "Confirmed reservations can draft a service agreement into Legal Vault where enabled.", nl: "Bevestigde reserveringen kunnen een dienstverleningsovereenkomst naar Legal Vault concepten waar ingeschakeld.", ar: "يمكن للحجوزات المؤكدة إنشاء مسودة اتفاقية خدمة داخل Legal Vault عند التفعيل." } },
        ],
        antiAbuseNote: { en: "Public submissions run through honeypot and form-start timing checks before they become operational data.", nl: "Publieke inzendingen gaan door honeypot- en form-start-timingchecks voordat ze operationele data worden.", ar: "تمر الإدخالات العامة عبر honeypot وفحوص توقيت بداية النموذج قبل أن تصبح بيانات تشغيلية." },
        metrics: [{ id: "reservations", label: { en: "Reservations", nl: "Reserveringen", ar: "الحجوزات" }, value: { en: "Lifecycle", nl: "Lifecycle", ar: "دورة حياة" } }, { id: "history", label: { en: "Status history", nl: "Statushistorie", ar: "تاريخ الحالة" }, value: { en: "Logged", nl: "Geloggd", ar: "موثّق" } }, { id: "abuse", label: { en: "Anti-abuse", nl: "Anti-abuse", ar: "مكافحة الإساءة" }, value: { en: "Checked", nl: "Gecheckt", ar: "مفحوص" } }],
        cta: { label: { en: "Open booking", nl: "Open booking", ar: "افتح الحجز" }, href: "/booking" },
    };
}

function BookingLifecycleReport({ locale, style, eyebrow, title, description, adapterType, lifecycleCards, antiAbuseNote, metrics, cta }: BookingLifecycleReportBlockProps & { locale: SupportedLocale }) {
    return (
        <SectionFrame style={style} eyebrow={pickLocale(locale, eyebrow)} title={pickLocale(locale, title)} description={pickRich(locale, description)}>
            <div className="mb-5 inline-flex rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">{pickLocale(locale, adapterType)}</div>
            <div className="grid gap-4 md:grid-cols-4">
                {(lifecycleCards ?? []).map((card) => <LifecycleCard key={card.id} locale={locale} step={card} />)}
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.2fr_auto] lg:items-center">
                <p className={`${CARD} border-amber-300/20 bg-amber-300/5 p-5 text-sm leading-relaxed text-amber-100`}><Shield className="mb-3 h-5 w-5" aria-hidden />{pickLocale(locale, antiAbuseNote)}</p>
                <div className="grid grid-cols-3 gap-2">
                    {(metrics ?? []).map((metric) => <div key={metric.id} className={`${CARD} p-4 text-center`}><p className="text-xs text-slate-400">{pickLocale(locale, metric.label)}</p><p className="mt-1 text-sm font-semibold text-white">{pickLocale(locale, metric.value)}</p></div>)}
                </div>
                {cta?.href ? <a href={cta.href} className={CTA_PRIMARY}>{pickLocale(locale, cta.label)}</a> : null}
            </div>
        </SectionFrame>
    );
}

function LifecycleRender({ locale, style, eyebrow, title, description, steps, notesTitle, notes, replaces, cta, icon }: {
    locale: SupportedLocale;
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    steps: LifecycleStep[];
    notesTitle: string;
    notes: LocaleField[];
    replaces: LocaleField[];
    cta?: LocalizedCta;
    icon: ReactNode;
}) {
    return (
        <SectionFrame style={style} eyebrow={pickLocale(locale, eyebrow)} title={pickLocale(locale, title)} description={pickRich(locale, description)}>
            <div className="grid gap-4 lg:grid-cols-5">
                {(steps ?? []).map((step) => <LifecycleCard key={step.id} locale={locale} step={step} />)}
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className={`${CARD} p-5`}>
                    <div className="mb-4 flex items-center gap-2 text-cyan-300">{icon}<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{notesTitle}</p></div>
                    <ul className="flex flex-wrap gap-2">{(notes ?? []).map((note, index) => <li key={`note-${index}`} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100">{pickLocale(locale, note)}</li>)}</ul>
                </div>
                <div className={`${CARD} p-5`}>
                    <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">What this replaces</p>
                    <ul className="space-y-2">{(replaces ?? []).map((item, index) => <li key={`replace-${index}`} className="flex gap-2 text-sm text-slate-300"><Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" aria-hidden />{pickLocale(locale, item)}</li>)}</ul>
                    {cta?.href ? <a href={cta.href} className="mt-5 inline-flex text-sm font-semibold text-cyan-300">{pickLocale(locale, cta.label)} →</a> : null}
                </div>
            </div>
        </SectionFrame>
    );
}

function LifecycleCard({ locale, step }: { locale: SupportedLocale; step: LifecycleStep }) {
    return (
        <article className={`${CARD} ${CARD_HOVER} p-5`}>
            <span className="mb-5 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">{pickLocale(locale, step.badge)}</span>
            <h3 className="text-base font-semibold text-white">{pickLocale(locale, step.title)}</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">{pickLocale(locale, step.body)}</p>
        </article>
    );
}

interface FeatureStatusRow {
    id: string;
    capability: LocaleField;
    status: "shipped" | "careful" | "not-shipped";
    evidence: LocaleField;
    boundary: LocaleField;
}

export type FeatureStatusMatrixBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    rows: FeatureStatusRow[];
    footnote: LocaleField;
};

const featureStatusMatrixFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: triLingualText("Eyebrow"),
    title: triLingualTextarea("Title"),
    description: triLingualTextarea("Description"),
    rows: {
        type: "array" as const,
        label: "Status rows",
        getItemSummary: (item: SummaryItem) => summaryLocale(item, "capability") ?? summaryString(item, "id") ?? "Status row",
        arrayFields: {
            id: { type: "text" as const, label: "ID" },
            capability: triLingualText("Capability"),
            status: { type: "select" as const, label: "Status", options: [{ label: "Shipped", value: "shipped" }, { label: "Phrase carefully", value: "careful" }, { label: "Not shipped", value: "not-shipped" }] },
            evidence: triLingualTextarea("Evidence"),
            boundary: triLingualTextarea("Boundary / what not to claim"),
        },
    },
    footnote: triLingualTextarea("Footnote"),
} satisfies Fields<FeatureStatusMatrixBlockProps & { id: string }>;

function buildFeatureStatusMatrixProps(): FeatureStatusMatrixBlockProps {
    return {
        style: createSectionStyle({ surfaceTone: "dark", width: "wide", density: "spacious" }),
        eyebrow: { en: "Clear scope", nl: "Heldere scope", ar: "نطاق واضح" },
        title: { en: "What you can rely on — and where the boundary is.", nl: "Waar u op kunt rekenen — en waar de grens ligt.", ar: "ما يمكنك الاعتماد عليه — وأين تقف الحدود." },
        description: { en: "The workspace is designed to be inspected, not oversold. This section separates live capabilities from areas where the promise remains intentionally smaller.", nl: "De workspace is ontworpen om gecontroleerd te worden, niet om te overdrijven. Deze sectie scheidt live mogelijkheden van onderdelen waar de belofte bewust kleiner blijft.", ar: "صُممت مساحة العمل لتكون قابلة للفحص، لا للمبالغة. يفصل هذا القسم القدرات المتاحة عن المجالات التي يبقى فيها الوعد أصغر عمدًا." },
        rows: [
            { id: "metering", capability: { en: "Governed AI usage", nl: "Beheerst AI-gebruik", ar: "استخدام ذكاء اصطناعي محكوم" }, status: "shipped", evidence: { en: "AI work is checked against workspace credits before it runs and recorded in an audit ledger afterwards.", nl: "AI-werk wordt vooraf gecontroleerd op workspace-credits en daarna vastgelegd in een auditgrootboek.", ar: "يُفحص عمل الذكاء الاصطناعي مقابل أرصدة مساحة العمل قبل التشغيل ويُسجل بعد ذلك في سجل تدقيق." }, boundary: { en: "AI is metered and accountable, not packaged as unlimited usage.", nl: "AI is gemeten en verantwoordbaar, niet verpakt als onbeperkt gebruik.", ar: "الذكاء الاصطناعي مُقاس وقابل للمساءلة، وليس استخدامًا غير محدود." } },
            { id: "video", capability: { en: "Public video library", nl: "Publieke videobibliotheek", ar: "مكتبة فيديو عامة" }, status: "careful", evidence: { en: "The public video section and manager upload flow are ready for real walkthroughs and product demos.", nl: "De publieke videosectie en manager-uploadflow zijn klaar voor echte walkthroughs en productdemo's.", ar: "قسم الفيديو العام وتدفق رفع المدير جاهزان للجولات العملية وعروض المنتج الحقيقية." }, boundary: { en: "It is a publishing surface for demos, not an automatic video-production engine.", nl: "Het is een publicatieoppervlak voor demo's, geen automatische videoproductiemachine.", ar: "إنها مساحة نشر للعروض، وليست محرك إنتاج فيديو آلي." } },
            { id: "agents", capability: { en: "Autonomous AI agents", nl: "Autonome AI-agents", ar: "وكلاء ذكاء اصطناعي مستقلون" }, status: "not-shipped", evidence: { en: "Today, AI runs through specific reviewed workflows for content, SEO, media, legal, and operations work.", nl: "Vandaag loopt AI via specifieke beoordeelde workflows voor content, SEO, media, legal en operations.", ar: "اليوم يعمل الذكاء الاصطناعي عبر تدفقات محددة ومراجعة للمحتوى والسيو والوسائط والعمل القانوني والتشغيلي." }, boundary: { en: "General autonomous agents are not part of the current offer; the focus is controlled, reviewable workflows.", nl: "Algemene autonome agents horen niet bij het huidige aanbod; de focus ligt op gecontroleerde, reviewbare workflows.", ar: "الوكلاء المستقلون العامون ليسوا جزءًا من العرض الحالي؛ التركيز على تدفقات محكومة وقابلة للمراجعة." } },
        ],
        footnote: { en: "If we cannot show it clearly in the workspace or explain exactly how it runs, we do not sell it as a capability.", nl: "Als we het niet helder in de werkruimte kunnen laten zien of exact kunnen uitleggen hoe het werkt, verkopen we het niet als capability.", ar: "إذا لم نتمكن من عرضه بوضوح داخل مساحة العمل أو شرح طريقة عمله بدقة، فلا نبيعه كقدرة." },
    };
}

function FeatureStatusMatrix({ locale, style, eyebrow, title, description, rows, footnote }: FeatureStatusMatrixBlockProps & { locale: SupportedLocale }) {
    return (
        <SectionFrame style={style} eyebrow={pickLocale(locale, eyebrow)} title={pickLocale(locale, title)} description={pickRich(locale, description)}>
            <div className="overflow-hidden rounded-2xl border border-white/10">
                {(rows ?? []).map((row) => (
                    <article key={row.id} className="grid gap-4 border-b border-white/10 bg-white/[0.03] p-5 last:border-b-0 md:grid-cols-[0.7fr_0.45fr_1fr_1fr] md:items-start">
                        <h3 className="font-semibold text-white">{pickLocale(locale, row.capability)}</h3>
                        <span className={`w-fit rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${statusToneClasses(row.status)}`}>{featureStatusLabel(locale, row.status)}</span>
                        <p className="text-sm leading-relaxed text-slate-300">{pickLocale(locale, row.evidence)}</p>
                        <p className="text-sm leading-relaxed text-slate-400">{pickLocale(locale, row.boundary)}</p>
                    </article>
                ))}
            </div>
            <p className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5 text-sm leading-relaxed text-amber-100">{pickLocale(locale, footnote)}</p>
        </SectionFrame>
    );
}

interface DemoEvidenceItem {
    id: string;
    title: LocaleField;
    description: LocaleField;
    status: "promised" | "recorded" | "published" | "coming";
    href?: string;
}

export type DemoEvidenceGridBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    demos: DemoEvidenceItem[];
    footnote: LocaleField;
};

const demoEvidenceGridFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: triLingualText("Eyebrow"),
    title: triLingualTextarea("Title"),
    description: triLingualTextarea("Description"),
    demos: {
        type: "array" as const,
        label: "Demo items",
        getItemSummary: (item: SummaryItem) => summaryLocale(item, "title") ?? summaryString(item, "id") ?? "Demo",
        arrayFields: {
            id: { type: "text" as const, label: "ID" },
            title: triLingualText("Title"),
            description: triLingualTextarea("Description"),
            status: { type: "select" as const, label: "Status", options: ["promised", "recorded", "published", "coming"].map((value) => ({ label: value, value })) },
            href: { type: "text" as const, label: "Href" },
        },
    },
    footnote: triLingualTextarea("Footnote"),
} satisfies Fields<DemoEvidenceGridBlockProps & { id: string }>;

function buildDemoEvidenceGridProps(): DemoEvidenceGridBlockProps {
    return {
        style: createSectionStyle({ surfaceTone: "dark", width: "wide", density: "spacious" }),
        eyebrow: { en: "Demo evidence", nl: "Demo-bewijs", ar: "دليل العروض" },
        title: { en: "Demos, not promos.", nl: "Demo's, geen promo's.", ar: "عروض توضيحية، لا إعلانات." },
        description: { en: "A public editorial roadmap for screen-by-screen walkthroughs of what is shipped. Use it while the first videos are being recorded so the video page is not an empty promise.", nl: "Een publieke redactionele roadmap voor scherm-voor-scherm walkthroughs van wat geleverd is. Gebruik dit terwijl de eerste video's worden opgenomen zodat de videopagina geen lege belofte blijft.", ar: "خارطة تحريرية عامة لجولات شاشة بشاشة لما تم إطلاقه. تُستخدم أثناء تسجيل أول الفيديوهات كي لا تبقى صفحة الفيديو وعدًا فارغًا." },
        demos: [
            { id: "desktop", title: { en: "Desktop OS shell walkthrough", nl: "Desktop OS shell walkthrough", ar: "جولة واجهة سطح المكتب" }, description: { en: "Workspace, Start menu, apps, mobile-adapted shell.", nl: "Workspace, Start-menu, apps, mobiele shell.", ar: "مساحة العمل وقائمة البداية والتطبيقات والواجهة على الهاتف." }, status: "coming", href: "/videos" },
            { id: "seo", title: { en: "SEO Control Center walkthrough", nl: "SEO Control Center walkthrough", ar: "جولة SEO Control Center" }, description: { en: "Plans, graph, proposals, rollback.", nl: "Plannen, graph, voorstellen, rollback.", ar: "خطط ورسم وروابط ومقترحات وتراجع." }, status: "coming", href: "/videos" },
            { id: "legal", title: { en: "Legal Vault workflow", nl: "Legal Vault workflow", ar: "تدفق Legal Vault" }, description: { en: "DVO draft, signature trail, BTW ledger.", nl: "DVO-concept, ondertekeningsspoor, BTW-grootboek.", ar: "مسودة DVO ومسار توقيع وسجل BTW." }, status: "coming", href: "/videos" },
        ],
        footnote: { en: "Do not promote the video index as proof until at least one real walkthrough is published.", nl: "Promoot de video-index niet als bewijs voordat minstens één echte walkthrough gepubliceerd is.", ar: "لا تروج لفهرس الفيديو كدليل قبل نشر جولة حقيقية واحدة على الأقل." },
    };
}

function DemoEvidenceGrid({ locale, style, eyebrow, title, description, demos, footnote }: DemoEvidenceGridBlockProps & { locale: SupportedLocale }) {
    return (
        <SectionFrame style={style} eyebrow={pickLocale(locale, eyebrow)} title={pickLocale(locale, title)} description={pickRich(locale, description)}>
            <div className="grid gap-4 md:grid-cols-3">
                {(demos ?? []).map((demo) => {
                    const body = (
                        <article className={`${CARD} ${CARD_HOVER} flex h-full flex-col p-5`}>
                            <div className="mb-8 flex items-center justify-between gap-3">
                                <FileCheck2 className="h-5 w-5 text-cyan-300" aria-hidden />
                                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${statusToneClasses(demo.status)}`}>{demo.status}</span>
                            </div>
                            <h3 className="text-lg font-semibold text-white">{pickLocale(locale, demo.title)}</h3>
                            <p className="mt-3 text-sm leading-relaxed text-slate-300">{pickLocale(locale, demo.description)}</p>
                        </article>
                    );
                    return demo.href ? <a key={demo.id} href={demo.href}>{body}</a> : <div key={demo.id}>{body}</div>;
                })}
            </div>
            <p className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5 text-sm leading-relaxed text-amber-100">{pickLocale(locale, footnote)}</p>
        </SectionFrame>
    );
}

// ──────────────────────── component registry export ────────────────────────

export type ExtendedComponents = {
    InsightsGridBlock: InsightsGridBlockProps & { id: string };
    BentoFeatureBlock: BentoFeatureBlockProps & { id: string };
    PullQuoteBlock: PullQuoteBlockProps & { id: string };
    FaqAccordionBlock: FaqAccordionBlockProps & { id: string };
    PricingTiersBlock: PricingTiersBlockProps & { id: string };
    TeamGridBlock: TeamGridBlockProps & { id: string };
    CtaSplitBlock: CtaSplitBlockProps & { id: string };
    ToolsHighlightBlock: ToolsHighlightBlockProps & { id: string };
    WorkspaceProofLedgerBlock: WorkspaceProofLedgerBlockProps & { id: string };
    LegibilityHubQueryBlock: LegibilityHubQueryBlockProps & { id: string };
    PopupConversionLayerBlock: PopupConversionLayerBlockProps & { id: string };
    NewsletterLifecycleBlock: NewsletterLifecycleBlockProps & { id: string };
    BookingLifecycleReportBlock: BookingLifecycleReportBlockProps & { id: string };
    FeatureStatusMatrixBlock: FeatureStatusMatrixBlockProps & { id: string };
    DemoEvidenceGridBlock: DemoEvidenceGridBlockProps & { id: string };
};

interface BuilderRenderProps<T> {
    puck?: { metadata?: { locale?: SupportedLocale } };
    [key: string]: unknown;
    style: SectionStyleProps;
    // Index-typed access for property destructuring above.
    _placeholder?: T;
}

// Each component definition follows Puck's ComponentConfig shape: `label`,
// `fields`, `defaultProps`, `render`. We export a single map and let
// puck.config.tsx merge it into the master config so block ordering is
// preserved without intrusive changes there.
export const extendedBlocks = {
    InsightsGridBlock: {
        label: "Insights · recent articles",
        fields: insightsGridFields,
        defaultProps: { id: "insights-grid", ...buildInsightsGridProps() },
        render: (props: BuilderRenderProps<InsightsGridBlockProps>) => (
            <InsightsGrid
                locale={getRenderLocale(props)}
                style={props.style as SectionStyleProps}
                eyebrow={props.eyebrow as LocaleField}
                title={props.title as LocaleField}
                description={props.description as RichLocaleField}
                readMoreLabel={props.readMoreLabel as LocaleField}
                limit={(props.limit as number) || 6}
            />
        ),
    },
    BentoFeatureBlock: {
        label: "Bento feature grid",
        fields: bentoFeatureFields,
        defaultProps: { id: "bento-feature", ...buildBentoFeatureProps() },
        render: (props: BuilderRenderProps<BentoFeatureBlockProps>) => (
            <BentoFeature
                locale={getRenderLocale(props)}
                style={props.style as SectionStyleProps}
                eyebrow={props.eyebrow as LocaleField}
                title={props.title as LocaleField}
                description={props.description as RichLocaleField}
                tiles={(props.tiles as BentoTile[]) ?? []}
            />
        ),
    },
    PullQuoteBlock: {
        label: "Editorial pull quote",
        fields: pullQuoteFields,
        defaultProps: { id: "pull-quote", ...buildPullQuoteProps() },
        render: (props: BuilderRenderProps<PullQuoteBlockProps>) => (
            <PullQuote
                locale={getRenderLocale(props)}
                style={props.style as SectionStyleProps}
                eyebrow={props.eyebrow as LocaleField}
                quote={props.quote as RichLocaleField}
                authorName={(props.authorName as string) ?? ""}
                authorRole={props.authorRole as LocaleField}
                authorImage={props.authorImage as string | undefined}
                company={props.company as string | undefined}
            />
        ),
    },
    FaqAccordionBlock: {
        label: "FAQ accordion",
        fields: faqAccordionFields,
        defaultProps: { id: "faq-accordion", ...buildFaqAccordionProps() },
        render: (props: BuilderRenderProps<FaqAccordionBlockProps>) => {
            const defaults = buildFaqAccordionProps();
            return (
                <FaqAccordion
                    locale={getRenderLocale(props)}
                    style={resolveSectionStyle(props.style)}
                    eyebrow={(props.eyebrow as LocaleField | undefined) ?? defaults.eyebrow}
                    title={(props.title as LocaleField | undefined) ?? defaults.title}
                    description={(props.description as RichLocaleField | undefined) ?? defaults.description}
                    items={(props.items as FaqAccordionItem[] | undefined) ?? defaults.items}
                />
            );
        },
    },
    PricingTiersBlock: {
        label: "Pricing tiers",
        fields: pricingTiersFields,
        defaultProps: { id: "pricing-tiers", ...buildPricingTiersProps() },
        render: (props: BuilderRenderProps<PricingTiersBlockProps>) => (
            <PricingTiers
                locale={getRenderLocale(props)}
                style={props.style as SectionStyleProps}
                eyebrow={props.eyebrow as LocaleField}
                title={props.title as LocaleField}
                description={props.description as RichLocaleField}
                tiers={(props.tiers as PricingTier[]) ?? []}
            />
        ),
    },
    TeamGridBlock: {
        label: "Team grid",
        fields: teamGridFields,
        defaultProps: { id: "team-grid", ...buildTeamGridProps() },
        render: (props: BuilderRenderProps<TeamGridBlockProps>) => (
            <TeamGrid
                locale={getRenderLocale(props)}
                style={props.style as SectionStyleProps}
                eyebrow={props.eyebrow as LocaleField}
                title={props.title as LocaleField}
                description={props.description as RichLocaleField}
                members={(props.members as TeamMember[]) ?? []}
            />
        ),
    },
    CtaSplitBlock: {
        label: "Split CTA",
        fields: ctaSplitFields,
        defaultProps: { id: "cta-split", ...buildCtaSplitProps() },
        render: (props: BuilderRenderProps<CtaSplitBlockProps>) => (
            <CtaSplit
                locale={getRenderLocale(props)}
                style={props.style as SectionStyleProps}
                eyebrow={props.eyebrow as LocaleField}
                title={props.title as LocaleField}
                description={props.description as RichLocaleField}
                image={props.image as string | undefined}
                primaryCta={props.primaryCta as { label: LocaleField; href: string }}
                secondaryCta={props.secondaryCta as { label: LocaleField; href: string } | undefined}
                mediaPosition={(props.mediaPosition as "left" | "right") ?? "right"}
            />
        ),
    },
    ToolsHighlightBlock: {
        label: "Tools · highlight strip",
        fields: toolsHighlightFields,
        defaultProps: { id: "tools-highlight", ...buildToolsHighlightProps() },
        render: (props: BuilderRenderProps<ToolsHighlightBlockProps>) => (
            <ToolsHighlight
                locale={getRenderLocale(props)}
                style={props.style as SectionStyleProps}
                eyebrow={props.eyebrow as LocaleField}
                title={props.title as LocaleField}
                description={props.description as RichLocaleField}
                tools={(props.tools as ToolHighlightItem[]) ?? []}
                ctaLabel={props.ctaLabel as LocaleField}
            />
        ),
    },
    WorkspaceProofLedgerBlock: {
        label: "Proof · workspace ledger",
        fields: workspaceProofLedgerFields,
        defaultProps: { id: "workspace-proof-ledger", ...buildWorkspaceProofLedgerProps() },
        render: (props: BuilderRenderProps<WorkspaceProofLedgerBlockProps>) => (
            <WorkspaceProofLedger
                locale={getRenderLocale(props)}
                style={props.style as SectionStyleProps}
                eyebrow={props.eyebrow as LocaleField}
                title={props.title as LocaleField}
                description={props.description as RichLocaleField}
                period={props.period as LocaleField}
                metrics={(props.metrics as WorkspaceMetricCard[]) ?? []}
                footnote={props.footnote as LocaleField}
                disclaimer={props.disclaimer as LocaleField}
                cta={props.cta as LocalizedCta | undefined}
            />
        ),
    },
    LegibilityHubQueryBlock: {
        label: "Proof · Legibility Hub queries",
        fields: legibilityHubQueryFields,
        defaultProps: { id: "legibility-hub-query", ...buildLegibilityHubQueryProps() },
        render: (props: BuilderRenderProps<LegibilityHubQueryBlockProps>) => (
            <LegibilityHubQuery
                locale={getRenderLocale(props)}
                style={props.style as SectionStyleProps}
                eyebrow={props.eyebrow as LocaleField}
                title={props.title as LocaleField}
                description={props.description as RichLocaleField}
                examples={(props.examples as LegibilityQueryExample[]) ?? []}
                facts={(props.facts as StructuredFactCard[]) ?? []}
                provenanceNote={props.provenanceNote as LocaleField}
                cta={props.cta as LocalizedCta | undefined}
            />
        ),
    },
    PopupConversionLayerBlock: {
        label: "Growth · popup conversion layer",
        fields: popupConversionLayerFields,
        defaultProps: { id: "popup-conversion-layer", ...buildPopupConversionLayerProps() },
        render: (props: BuilderRenderProps<PopupConversionLayerBlockProps>) => (
            <PopupConversionLayer
                locale={getRenderLocale(props)}
                style={props.style as SectionStyleProps}
                eyebrow={props.eyebrow as LocaleField}
                title={props.title as LocaleField}
                description={props.description as RichLocaleField}
                templates={(props.templates as PopupTemplateCard[]) ?? []}
                triggerChips={(props.triggerChips as LocaleField[]) ?? []}
                localeChips={(props.localeChips as LocaleField[]) ?? []}
                reportingMetrics={(props.reportingMetrics as MiniMetric[]) ?? []}
                cta={props.cta as LocalizedCta | undefined}
            />
        ),
    },
    NewsletterLifecycleBlock: {
        label: "Growth · newsletter lifecycle",
        fields: newsletterLifecycleFields,
        defaultProps: { id: "newsletter-lifecycle", ...buildNewsletterLifecycleProps() },
        render: (props: BuilderRenderProps<NewsletterLifecycleBlockProps>) => (
            <NewsletterLifecycle
                locale={getRenderLocale(props)}
                style={props.style as SectionStyleProps}
                eyebrow={props.eyebrow as LocaleField}
                title={props.title as LocaleField}
                description={props.description as RichLocaleField}
                steps={(props.steps as LifecycleStep[]) ?? []}
                complianceNotes={(props.complianceNotes as LocaleField[]) ?? []}
                replaces={(props.replaces as LocaleField[]) ?? []}
                cta={props.cta as LocalizedCta | undefined}
            />
        ),
    },
    BookingLifecycleReportBlock: {
        label: "Ops · booking lifecycle report",
        fields: bookingLifecycleReportFields,
        defaultProps: { id: "booking-lifecycle-report", ...buildBookingLifecycleReportProps() },
        render: (props: BuilderRenderProps<BookingLifecycleReportBlockProps>) => (
            <BookingLifecycleReport
                locale={getRenderLocale(props)}
                style={props.style as SectionStyleProps}
                eyebrow={props.eyebrow as LocaleField}
                title={props.title as LocaleField}
                description={props.description as RichLocaleField}
                adapterType={props.adapterType as LocaleField}
                lifecycleCards={(props.lifecycleCards as LifecycleStep[]) ?? []}
                antiAbuseNote={props.antiAbuseNote as LocaleField}
                metrics={(props.metrics as MiniMetric[]) ?? []}
                cta={props.cta as LocalizedCta | undefined}
            />
        ),
    },
    FeatureStatusMatrixBlock: {
        label: "Proof · feature status matrix",
        fields: featureStatusMatrixFields,
        defaultProps: { id: "feature-status-matrix", ...buildFeatureStatusMatrixProps() },
        render: (props: BuilderRenderProps<FeatureStatusMatrixBlockProps>) => (
            <FeatureStatusMatrix
                locale={getRenderLocale(props)}
                style={props.style as SectionStyleProps}
                eyebrow={props.eyebrow as LocaleField}
                title={props.title as LocaleField}
                description={props.description as RichLocaleField}
                rows={(props.rows as FeatureStatusRow[]) ?? []}
                footnote={props.footnote as LocaleField}
            />
        ),
    },
    DemoEvidenceGridBlock: {
        label: "Proof · demo evidence grid",
        fields: demoEvidenceGridFields,
        defaultProps: { id: "demo-evidence-grid", ...buildDemoEvidenceGridProps() },
        render: (props: BuilderRenderProps<DemoEvidenceGridBlockProps>) => (
            <DemoEvidenceGrid
                locale={getRenderLocale(props)}
                style={props.style as SectionStyleProps}
                eyebrow={props.eyebrow as LocaleField}
                title={props.title as LocaleField}
                description={props.description as RichLocaleField}
                demos={(props.demos as DemoEvidenceItem[]) ?? []}
                footnote={props.footnote as LocaleField}
            />
        ),
    },
};

// Re-export the plain-data registry from its non-client home so callers can
// import everything from one place without inadvertently pulling in the
// React component bodies on the server.
export { EXTENDED_BLOCK_TYPES, type ExtendedBlockType } from "@/features/builder/extended-blocks-meta";
