// Sector-landing block set. Wraps the section vocabulary used across the
// hand-written sector pages (real-estate, legal, horeca, etc.) as Puck
// blocks so the same EN/NL/AR copy can be edited in the builder and
// rendered identically on /<slug>.
//
// Visual targets the hand-coded TSX (see e.g. the historic
// src/app/(public)/real-estate-digital-systems/page.tsx): max-w-5xl
// containers, light-on-dark surfaces, amber-flagged review banner, simple
// 2-col module grid, ghost-bordered proof card, accent-pill CTA. Each
// block is a complete <section>, including its own vertical spacing —
// they're meant to be stacked top-to-bottom and read as one page.

import Link from "next/link";
import type { Fields } from "@puckeditor/core";
import {
    getLocaleValue,
    type LocaleField,
    type SupportedLocale,
} from "@/features/builder/facility-services-page-data";

// ───────────────────────── shared primitives ─────────────────────────

const SECTION_CONTAINER = "container mx-auto max-w-5xl px-4 md:px-6 text-[var(--template-text-primary)]";

function pickLocale(locale: SupportedLocale, field: LocaleField | undefined): string {
    if (!field) return "";
    return getLocaleValue(locale, field);
}

function getRenderLocale(props: { puck?: { metadata?: { locale?: SupportedLocale } } }): SupportedLocale {
    const value = props.puck?.metadata?.locale;
    if (value === "nl" || value === "ar") return value;
    return "en";
}

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

// ───────────────────────────── types ─────────────────────────────

interface SectorRunModule {
    id: string;
    title: LocaleField;
    body: LocaleField;
}

interface SectorNotForItem {
    id: string;
    en: string;
    nl: string;
    ar?: string;
}

export interface SectorHeroBlockProps {
    id: string;
    eyebrow: LocaleField;
    headline: LocaleField;
    subhead: LocaleField;
    nlReviewFlag?: LocaleField;
    /**
     * Optional byline rendered below the headline in mono small caps. Used
     * by the thesis abstract page (author + degree + date), kept empty
     * everywhere else. Pre-existing rows without this field render
     * unchanged because we only render when the resolved string is
     * non-empty.
     */
    byline?: LocaleField;
}

export interface SectorRunSectionBlockProps {
    id: string;
    header: LocaleField;
    modules: SectorRunModule[];
}

export interface SectorHonestProofBlockProps {
    id: string;
    header: LocaleField;
    body: LocaleField;
    linkLabel?: LocaleField;
    linkHref?: string;
}

export interface SectorReplaceBlockProps {
    id: string;
    header: LocaleField;
    body: LocaleField;
}

export interface SectorPricingNoteBlockProps {
    id: string;
    header: LocaleField;
    body: LocaleField;
    linkLabel?: LocaleField;
    linkHref?: string;
}

export interface SectorNotForBlockProps {
    id: string;
    header: LocaleField;
    items: SectorNotForItem[];
}

export interface SectorCtaPillBlockProps {
    id: string;
    label: LocaleField;
    href: string;
}

// ─────────────────────────── field schemas ───────────────────────────

const sectorHeroFields: Fields<SectorHeroBlockProps> = {
    id: { type: "text", label: "Block ID" },
    eyebrow: triLingualText("Eyebrow"),
    headline: triLingualTextarea("Headline"),
    subhead: triLingualTextarea("Subhead"),
    nlReviewFlag: triLingualTextarea("NL native-review flag (optional)"),
    byline: triLingualText("Byline (optional — used on thesis-style pages)"),
};

const sectorRunFields: Fields<SectorRunSectionBlockProps> = {
    id: { type: "text", label: "Block ID" },
    header: triLingualText("Section header"),
    modules: {
        type: "array",
        label: "Modules",
        getItemSummary: (item) => item?.title?.en ?? item?.title?.nl ?? item?.id ?? "Module",
        arrayFields: {
            id: { type: "text", label: "ID" },
            title: triLingualText("Title"),
            body: triLingualTextarea("Body"),
        },
    },
};

const sectorHonestProofFields: Fields<SectorHonestProofBlockProps> = {
    id: { type: "text", label: "Block ID" },
    header: triLingualText("Header"),
    body: triLingualTextarea("Body"),
    linkLabel: triLingualText("Link label (optional)"),
    linkHref: { type: "text", label: "Link href (optional)" },
};

const sectorReplaceFields: Fields<SectorReplaceBlockProps> = {
    id: { type: "text", label: "Block ID" },
    header: triLingualText("Header"),
    body: triLingualTextarea("Body"),
};

const sectorPricingNoteFields: Fields<SectorPricingNoteBlockProps> = {
    id: { type: "text", label: "Block ID" },
    header: triLingualText("Header"),
    body: triLingualTextarea("Body"),
    linkLabel: triLingualText("Link label (optional)"),
    linkHref: { type: "text", label: "Link href (optional)" },
};

const sectorNotForFields: Fields<SectorNotForBlockProps> = {
    id: { type: "text", label: "Block ID" },
    header: triLingualText("Header"),
    items: {
        type: "array",
        label: "Items",
        getItemSummary: (item) => item?.en ?? item?.nl ?? item?.id ?? "Item",
        arrayFields: {
            id: { type: "text", label: "ID" },
            en: { type: "text", label: "English" },
            nl: { type: "text", label: "Dutch" },
            ar: { type: "text", label: "Arabic (العربية)" },
        },
    },
};

const sectorCtaPillFields: Fields<SectorCtaPillBlockProps> = {
    id: { type: "text", label: "Block ID" },
    label: triLingualText("CTA label"),
    href: { type: "text", label: "CTA href" },
};

// ─────────────────────────── default props ───────────────────────────

const emptyLocale = (): LocaleField => ({ en: "", nl: "", ar: "" });

const sectorHeroDefaults: SectorHeroBlockProps = {
    id: "sector-hero",
    eyebrow: emptyLocale(),
    headline: emptyLocale(),
    subhead: emptyLocale(),
    nlReviewFlag: emptyLocale(),
    byline: emptyLocale(),
};

const sectorRunDefaults: SectorRunSectionBlockProps = {
    id: "sector-run",
    header: emptyLocale(),
    modules: [],
};

const sectorHonestProofDefaults: SectorHonestProofBlockProps = {
    id: "sector-proof",
    header: emptyLocale(),
    body: emptyLocale(),
    linkLabel: emptyLocale(),
    linkHref: "",
};

const sectorReplaceDefaults: SectorReplaceBlockProps = {
    id: "sector-replace",
    header: emptyLocale(),
    body: emptyLocale(),
};

const sectorPricingNoteDefaults: SectorPricingNoteBlockProps = {
    id: "sector-pricing",
    header: emptyLocale(),
    body: emptyLocale(),
    linkLabel: emptyLocale(),
    linkHref: "",
};

const sectorNotForDefaults: SectorNotForBlockProps = {
    id: "sector-not-for",
    header: emptyLocale(),
    items: [],
};

const sectorCtaPillDefaults: SectorCtaPillBlockProps = {
    id: "sector-cta",
    label: emptyLocale(),
    href: "/contact",
};

// ─────────────────────────── render helpers ───────────────────────────

type WithPuck<T> = T & { puck?: { metadata?: { locale?: SupportedLocale } } };

function SectorHeroRender(props: WithPuck<SectorHeroBlockProps>) {
    const locale = getRenderLocale(props);
    const isRtl = locale === "ar";
    const reviewFlag = pickLocale(locale, props.nlReviewFlag);
    const byline = pickLocale(locale, props.byline);
    return (
        <section dir={isRtl ? "rtl" : "ltr"} className={`${SECTION_CONTAINER} pt-16 md:pt-24`}>
            {pickLocale(locale, props.eyebrow) ? (
                <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--template-text-accent)]">
                    {pickLocale(locale, props.eyebrow)}
                </p>
            ) : null}
            <h1 className="mb-6 text-4xl font-semibold tracking-tight md:text-5xl">
                {pickLocale(locale, props.headline)}
            </h1>
            {byline ? (
                <p className="mb-6 font-mono text-sm text-[var(--template-text-subtle)]">{byline}</p>
            ) : null}
            <p className="max-w-3xl text-lg leading-relaxed text-[var(--template-text-secondary)]">
                {pickLocale(locale, props.subhead)}
            </p>
            {reviewFlag ? (
                <p className="mt-4 rounded-lg border border-amber-300/40 bg-amber-300/5 px-4 py-2 text-xs uppercase tracking-wider text-amber-200">
                    {reviewFlag}
                </p>
            ) : null}
        </section>
    );
}

function SectorRunSectionRender(props: WithPuck<SectorRunSectionBlockProps>) {
    const locale = getRenderLocale(props);
    const isRtl = locale === "ar";
    const modules = Array.isArray(props.modules) ? props.modules : [];
    return (
        <section dir={isRtl ? "rtl" : "ltr"} className={`${SECTION_CONTAINER} mt-16`}>
            <h2 className="mb-6 text-2xl font-semibold">{pickLocale(locale, props.header)}</h2>
            <div className="grid gap-4 md:grid-cols-2">
                {modules.map((mod) => (
                    <article key={mod.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                        <h3 className="mb-2 text-base font-semibold text-[var(--template-text-accent)]">
                            {pickLocale(locale, mod.title)}
                        </h3>
                        <p className="text-sm leading-relaxed text-[var(--template-text-secondary)]">
                            {pickLocale(locale, mod.body)}
                        </p>
                    </article>
                ))}
            </div>
        </section>
    );
}

function SectorHonestProofRender(props: WithPuck<SectorHonestProofBlockProps>) {
    const locale = getRenderLocale(props);
    const isRtl = locale === "ar";
    const linkLabel = pickLocale(locale, props.linkLabel);
    return (
        <section dir={isRtl ? "rtl" : "ltr"} className={`${SECTION_CONTAINER} mt-16`}>
            <h2 className="mb-4 text-2xl font-semibold">{pickLocale(locale, props.header)}</h2>
            <article className="rounded-3xl border border-amber-300/30 bg-white/[0.03] p-8">
                <p className="text-[var(--template-text-secondary)]">{pickLocale(locale, props.body)}</p>
                {linkLabel && props.linkHref ? (
                    <Link
                        href={props.linkHref}
                        className="mt-4 inline-block text-sm font-semibold text-[var(--template-text-accent)] hover:underline"
                    >
                        {linkLabel}
                    </Link>
                ) : null}
            </article>
        </section>
    );
}

function SectorReplaceRender(props: WithPuck<SectorReplaceBlockProps>) {
    const locale = getRenderLocale(props);
    const isRtl = locale === "ar";
    return (
        <section dir={isRtl ? "rtl" : "ltr"} className={`${SECTION_CONTAINER} mt-16`}>
            <h2 className="mb-4 text-2xl font-semibold">{pickLocale(locale, props.header)}</h2>
            <p className="max-w-3xl text-[var(--template-text-secondary)]">{pickLocale(locale, props.body)}</p>
        </section>
    );
}

function SectorPricingNoteRender(props: WithPuck<SectorPricingNoteBlockProps>) {
    const locale = getRenderLocale(props);
    const isRtl = locale === "ar";
    const linkLabel = pickLocale(locale, props.linkLabel);
    return (
        <section dir={isRtl ? "rtl" : "ltr"} className={`${SECTION_CONTAINER} mt-16`}>
            <h2 className="mb-4 text-2xl font-semibold">{pickLocale(locale, props.header)}</h2>
            <p className="mb-4 max-w-3xl text-[var(--template-text-secondary)]">{pickLocale(locale, props.body)}</p>
            {linkLabel && props.linkHref ? (
                <Link
                    href={props.linkHref}
                    className="text-sm font-semibold text-[var(--template-text-accent)] hover:underline"
                >
                    {linkLabel}
                </Link>
            ) : null}
        </section>
    );
}

function SectorNotForRender(props: WithPuck<SectorNotForBlockProps>) {
    const locale = getRenderLocale(props);
    const isRtl = locale === "ar";
    const items = Array.isArray(props.items) ? props.items : [];
    return (
        <section dir={isRtl ? "rtl" : "ltr"} className={`${SECTION_CONTAINER} mt-16`}>
            <h2 className="mb-4 text-2xl font-semibold">{pickLocale(locale, props.header)}</h2>
            <ul className="space-y-2 text-[var(--template-text-secondary)]">
                {items.map((item) => {
                    const text = locale === "nl" ? item.nl : locale === "ar" ? (item.ar ?? item.en) : item.en;
                    return (
                        <li key={item.id} className="flex gap-3">
                            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--template-text-subtle)]" />
                            <span>{text}</span>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

function SectorCtaPillRender(props: WithPuck<SectorCtaPillBlockProps>) {
    const locale = getRenderLocale(props);
    const isRtl = locale === "ar";
    return (
        <section dir={isRtl ? "rtl" : "ltr"} className={`${SECTION_CONTAINER} mt-16 pb-20`}>
            <Link
                href={props.href}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--template-text-accent)] px-6 py-3 text-sm font-semibold text-slate-900 transition hover:scale-[1.02]"
            >
                {pickLocale(locale, props.label)}
                <span aria-hidden>{isRtl ? "←" : "→"}</span>
            </Link>
        </section>
    );
}

// ─────────────────────── phase-3: structurally-different blocks ───────────────────────
//
// The five remaining hand-coded sector pages (basic-vs-pro, enterprise-support,
// governance, thesis, changelog) use layouts that don't fit the seven sector
// blocks above. The blocks below cover the gap so every public page on the
// site can be rendered (and edited) from `content_items.visual_layout`.

// Basic-vs-Pro split hero (two pricing cards) ──────────────────────────────

export interface BasicProSplitHeroBlockProps {
    id: string;
    basicTitle: LocaleField;
    basicPrice: LocaleField;
    basicLine: LocaleField;
    proTitle: LocaleField;
    proPrice: LocaleField;
    proLine: LocaleField;
}

const basicProSplitHeroFields: Fields<BasicProSplitHeroBlockProps> = {
    id: { type: "text", label: "Block ID" },
    basicTitle: triLingualText("Basic — title"),
    basicPrice: triLingualText("Basic — price line"),
    basicLine: triLingualTextarea("Basic — value line"),
    proTitle: triLingualText("Pro — title"),
    proPrice: triLingualText("Pro — price line"),
    proLine: triLingualTextarea("Pro — value line"),
};

const basicProSplitHeroDefaults: BasicProSplitHeroBlockProps = {
    id: "basic-pro-split",
    basicTitle: emptyLocale(),
    basicPrice: emptyLocale(),
    basicLine: emptyLocale(),
    proTitle: emptyLocale(),
    proPrice: emptyLocale(),
    proLine: emptyLocale(),
};

function BasicProSplitHeroRender(props: WithPuck<BasicProSplitHeroBlockProps>) {
    const locale = getRenderLocale(props);
    const isRtl = locale === "ar";
    return (
        <section dir={isRtl ? "rtl" : "ltr"} className={`container mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-6 px-4 md:grid-cols-2 md:px-6 text-[var(--template-text-primary)]`}>
            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-8">
                <h2 className="mb-2 text-2xl font-semibold">{pickLocale(locale, props.basicTitle)}</h2>
                <p className="mb-3 font-mono text-sm text-[var(--template-text-accent)]">{pickLocale(locale, props.basicPrice)}</p>
                <p className="text-[var(--template-text-secondary)]">{pickLocale(locale, props.basicLine)}</p>
            </article>
            <article className="rounded-3xl border border-amber-300/40 bg-gradient-to-br from-amber-300/10 to-cyan-400/5 p-8 shadow-[0_24px_80px_rgba(99,166,255,0.18)]">
                <h2 className="mb-2 text-2xl font-semibold">{pickLocale(locale, props.proTitle)}</h2>
                <p className="mb-3 font-mono text-sm text-[var(--template-text-accent)]">{pickLocale(locale, props.proPrice)}</p>
                <p className="text-[var(--template-text-secondary)]">{pickLocale(locale, props.proLine)}</p>
            </article>
        </section>
    );
}

// Basic-vs-Pro feature matrix (multi-group comparison) ────────────────────

interface BasicProFeatureRow {
    id: string;
    label: LocaleField;
    basic: "yes" | "no" | "locked";
    pro: "yes" | "no" | "locked";
}

interface BasicProFeatureGroup {
    id: string;
    label: LocaleField;
    rows: BasicProFeatureRow[];
}

export interface BasicProMatrixBlockProps {
    id: string;
    capabilityLabel: LocaleField;
    basicLabel?: LocaleField;
    proLabel?: LocaleField;
    yesLabel: LocaleField;
    noLabel: LocaleField;
    lockedLabel: LocaleField;
    groups: BasicProFeatureGroup[];
}

const yesNoLockedField = (label: string) => ({
    type: "select" as const,
    label,
    options: [
        { label: "Included (yes)", value: "yes" },
        { label: "Not included (no)", value: "no" },
        { label: "Promoted, not active (locked)", value: "locked" },
    ],
});

const basicProMatrixFields: Fields<BasicProMatrixBlockProps> = {
    id: { type: "text", label: "Block ID" },
    capabilityLabel: triLingualText("Capability column header"),
    basicLabel: triLingualText("Foundation column header"),
    proLabel: triLingualText("Growth column header"),
    yesLabel: triLingualText("Cell label — included"),
    noLabel: triLingualText("Cell label — not included"),
    lockedLabel: triLingualText("Cell label — promoted, not active"),
    groups: {
        type: "array",
        label: "Feature groups",
        getItemSummary: (item) => item?.label?.en ?? item?.label?.nl ?? item?.id ?? "Group",
        arrayFields: {
            id: { type: "text", label: "Group ID" },
            label: triLingualText("Group label"),
            rows: {
                type: "array",
                label: "Rows",
                getItemSummary: (item) => item?.label?.en ?? item?.label?.nl ?? item?.id ?? "Row",
                arrayFields: {
                    id: { type: "text", label: "Row ID" },
                    label: triLingualTextarea("Capability"),
                    basic: yesNoLockedField("Basic"),
                    pro: yesNoLockedField("Pro"),
                },
            },
        },
    },
};

const basicProMatrixDefaults: BasicProMatrixBlockProps = {
    id: "basic-pro-matrix",
    capabilityLabel: { en: "Capability", nl: "Mogelijkheid", ar: "القدرة" },
    basicLabel: { en: "Foundation", nl: "Foundation", ar: "نظام التأسيس" },
    proLabel: { en: "Growth", nl: "Growth", ar: "نظام النمو" },
    yesLabel: { en: "Included", nl: "Inbegrepen", ar: "مُضمَّن" },
    noLabel: { en: "Not included", nl: "Niet inbegrepen", ar: "غير مُضمَّن" },
    lockedLabel: { en: "Promoted, not active", nl: "Zichtbaar, niet actief", ar: "مُعرَّف لا فعّال" },
    groups: [],
};

function BasicProMatrixRender(props: WithPuck<BasicProMatrixBlockProps>) {
    const locale = getRenderLocale(props);
    const isRtl = locale === "ar";
    const groups = Array.isArray(props.groups) ? props.groups : [];
    function cell(state: "yes" | "no" | "locked") {
        if (state === "yes") return <span className="text-emerald-300">{pickLocale(locale, props.yesLabel)}</span>;
        if (state === "locked") return <span className="text-amber-300/80">{pickLocale(locale, props.lockedLabel)}</span>;
        return <span className="text-slate-500">{pickLocale(locale, props.noLabel)}</span>;
    }
    return (
        <section dir={isRtl ? "rtl" : "ltr"} className={`${SECTION_CONTAINER} mt-16`}>
            {groups.map((group) => (
                <div key={group.id} className="mb-10">
                    <h3 className="mb-4 text-xl font-semibold text-[var(--template-text-accent)]">{pickLocale(locale, group.label)}</h3>
                    <div className="overflow-hidden rounded-2xl border border-white/10">
                        <table className="w-full text-sm">
                            <thead className="bg-white/[0.04] text-left text-xs uppercase tracking-wider text-[var(--template-text-subtle)]">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">{pickLocale(locale, props.capabilityLabel)}</th>
                                    <th className="px-4 py-3 font-semibold">{pickLocale(locale, props.basicLabel ?? basicProMatrixDefaults.basicLabel!)}</th>
                                    <th className="px-4 py-3 font-semibold">{pickLocale(locale, props.proLabel ?? basicProMatrixDefaults.proLabel!)}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(group.rows ?? []).map((row) => (
                                    <tr key={row.id} className="border-t border-white/5">
                                        <td className="px-4 py-3 text-[var(--template-text-secondary)]">{pickLocale(locale, row.label)}</td>
                                        <td className="px-4 py-3">{cell(row.basic)}</td>
                                        <td className="px-4 py-3">{cell(row.pro)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </section>
    );
}

// Tool replacement list (basic-vs-pro "what would you pay otherwise") ─────

interface ToolReplacementItem {
    id: string;
    tool: string;
    description: LocaleField;
}

export interface ToolReplacementListBlockProps {
    id: string;
    header: LocaleField;
    intro: LocaleField;
    items: ToolReplacementItem[];
    footnote?: LocaleField;
}

const toolReplacementListFields: Fields<ToolReplacementListBlockProps> = {
    id: { type: "text", label: "Block ID" },
    header: triLingualText("Header"),
    intro: triLingualTextarea("Intro paragraph"),
    items: {
        type: "array",
        label: "Tool list",
        getItemSummary: (item) => item?.tool ?? item?.id ?? "Tool",
        arrayFields: {
            id: { type: "text", label: "ID" },
            tool: { type: "text", label: "Tool name" },
            description: triLingualText("Description"),
        },
    },
    footnote: triLingualTextarea("Footnote (optional)"),
};

const toolReplacementListDefaults: ToolReplacementListBlockProps = {
    id: "tool-replacement",
    header: emptyLocale(),
    intro: emptyLocale(),
    items: [],
    footnote: emptyLocale(),
};

function ToolReplacementListRender(props: WithPuck<ToolReplacementListBlockProps>) {
    const locale = getRenderLocale(props);
    const isRtl = locale === "ar";
    const items = Array.isArray(props.items) ? props.items : [];
    const footnote = pickLocale(locale, props.footnote);
    return (
        <section dir={isRtl ? "rtl" : "ltr"} className={`${SECTION_CONTAINER} mt-16`}>
            <h2 className="mb-4 text-2xl font-semibold">{pickLocale(locale, props.header)}</h2>
            <p className="mb-6 max-w-3xl text-[var(--template-text-secondary)]">{pickLocale(locale, props.intro)}</p>
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {items.map((item) => (
                    <li key={item.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
                        <span className="font-semibold">{item.tool}</span>
                        <span className="text-[var(--template-text-subtle)]"> — {pickLocale(locale, item.description)}</span>
                    </li>
                ))}
            </ul>
            {footnote ? (
                <p className="mt-6 text-sm italic text-[var(--template-text-subtle)]">{footnote}</p>
            ) : null}
        </section>
    );
}

// Engagement shape list (enterprise-support engagement patterns) ──────────

interface EngagementShapeItem {
    id: string;
    title: LocaleField;
    timeframe: LocaleField;
    description: LocaleField;
}

export interface EngagementShapeListBlockProps {
    id: string;
    header: LocaleField;
    subhead?: LocaleField;
    items: EngagementShapeItem[];
    linkLabel?: LocaleField;
    linkHref?: string;
}

const engagementShapeListFields: Fields<EngagementShapeListBlockProps> = {
    id: { type: "text", label: "Block ID" },
    header: triLingualText("Section header"),
    subhead: triLingualTextarea("Subhead (optional)"),
    items: {
        type: "array",
        label: "Engagement shapes",
        getItemSummary: (item) => item?.title?.en ?? item?.title?.nl ?? item?.id ?? "Shape",
        arrayFields: {
            id: { type: "text", label: "ID" },
            title: triLingualText("Title"),
            timeframe: triLingualText("Timeframe"),
            description: triLingualTextarea("Description"),
        },
    },
    linkLabel: triLingualText("Link label (optional)"),
    linkHref: { type: "text", label: "Link href (optional)" },
};

const engagementShapeListDefaults: EngagementShapeListBlockProps = {
    id: "engagement-shape-list",
    header: emptyLocale(),
    subhead: emptyLocale(),
    items: [],
    linkLabel: emptyLocale(),
    linkHref: "",
};

function EngagementShapeListRender(props: WithPuck<EngagementShapeListBlockProps>) {
    const locale = getRenderLocale(props);
    const isRtl = locale === "ar";
    const items = Array.isArray(props.items) ? props.items : [];
    const subhead = pickLocale(locale, props.subhead);
    const linkLabel = pickLocale(locale, props.linkLabel);
    return (
        <section dir={isRtl ? "rtl" : "ltr"} className={`${SECTION_CONTAINER} mt-16`}>
            <h2 className="mb-3 text-xl font-semibold text-[var(--template-text-accent)]">{pickLocale(locale, props.header)}</h2>
            {subhead ? (
                <p className="mb-6 text-sm italic text-[var(--template-text-subtle)]">{subhead}</p>
            ) : null}
            <div className="space-y-4">
                {items.map((item) => (
                    <article key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                        <div className="mb-2 flex items-baseline justify-between gap-4">
                            <h3 className="text-base font-semibold text-[var(--template-text-accent)]">{pickLocale(locale, item.title)}</h3>
                            <span className="font-mono text-xs uppercase tracking-wider text-[var(--template-text-subtle)]">{pickLocale(locale, item.timeframe)}</span>
                        </div>
                        <p className="text-sm text-[var(--template-text-secondary)]">{pickLocale(locale, item.description)}</p>
                    </article>
                ))}
            </div>
            {linkLabel && props.linkHref ? (
                <Link href={props.linkHref} className="mt-6 inline-block text-sm font-semibold text-[var(--template-text-accent)] hover:underline">
                    {linkLabel}
                </Link>
            ) : null}
        </section>
    );
}

// Numbered findings (thesis "Five findings that shape the platform") ─────

interface NumberedFinding {
    id: string;
    en: string;
    nl: string;
    ar?: string;
}

export interface NumberedFindingsBlockProps {
    id: string;
    header: LocaleField;
    intro?: LocaleField;
    items: NumberedFinding[];
}

const numberedFindingsFields: Fields<NumberedFindingsBlockProps> = {
    id: { type: "text", label: "Block ID" },
    header: triLingualText("Header"),
    intro: triLingualTextarea("Intro paragraph (optional)"),
    items: {
        type: "array",
        label: "Findings (numbered)",
        getItemSummary: (item) => item?.en ?? item?.nl ?? item?.id ?? "Finding",
        arrayFields: {
            id: { type: "text", label: "ID" },
            en: { type: "textarea", label: "English" },
            nl: { type: "textarea", label: "Dutch" },
            ar: { type: "textarea", label: "Arabic (العربية)" },
        },
    },
};

const numberedFindingsDefaults: NumberedFindingsBlockProps = {
    id: "numbered-findings",
    header: emptyLocale(),
    intro: emptyLocale(),
    items: [],
};

function NumberedFindingsRender(props: WithPuck<NumberedFindingsBlockProps>) {
    const locale = getRenderLocale(props);
    const isRtl = locale === "ar";
    const items = Array.isArray(props.items) ? props.items : [];
    const intro = pickLocale(locale, props.intro);
    return (
        <section dir={isRtl ? "rtl" : "ltr"} className={`${SECTION_CONTAINER} mt-16`}>
            <h2 className="mb-3 text-xl font-semibold text-[var(--template-text-accent)]">{pickLocale(locale, props.header)}</h2>
            {intro ? (
                <p className="mb-4 text-[var(--template-text-secondary)]">{intro}</p>
            ) : null}
            <ol className="space-y-4 text-[var(--template-text-secondary)]">
                {items.map((item, idx) => {
                    const text = locale === "nl" ? item.nl : locale === "ar" ? (item.ar ?? item.en) : item.en;
                    return (
                        <li key={item.id} className="flex gap-4">
                            <span className="font-mono text-sm text-[var(--template-text-subtle)]">{String(idx + 1).padStart(2, "0")}</span>
                            <span>{text}</span>
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}

// Callout card (amber/cyan/emerald bordered note) ─────────────────────────

export interface CalloutCardBlockProps {
    id: string;
    accent: "amber" | "cyan" | "emerald" | "rose" | "neutral";
    header?: LocaleField;
    body: LocaleField;
    italic?: boolean;
}

const calloutCardFields: Fields<CalloutCardBlockProps> = {
    id: { type: "text", label: "Block ID" },
    accent: {
        type: "select",
        label: "Accent",
        options: [
            { label: "Amber (warning / wave note)", value: "amber" },
            { label: "Cyan", value: "cyan" },
            { label: "Emerald", value: "emerald" },
            { label: "Rose", value: "rose" },
            { label: "Neutral", value: "neutral" },
        ],
    },
    header: triLingualText("Header (optional)"),
    body: triLingualTextarea("Body"),
    italic: { type: "radio", label: "Italic body?", options: [{ label: "Yes", value: true }, { label: "No", value: false }] },
};

const calloutCardDefaults: CalloutCardBlockProps = {
    id: "callout-card",
    accent: "amber",
    header: emptyLocale(),
    body: emptyLocale(),
    italic: false,
};

function CalloutCardRender(props: WithPuck<CalloutCardBlockProps>) {
    const locale = getRenderLocale(props);
    const isRtl = locale === "ar";
    const header = pickLocale(locale, props.header);
    const accent = props.accent ?? "amber";
    const borderClass = {
        amber: "border-amber-300/30",
        cyan: "border-cyan-400/30",
        emerald: "border-emerald-400/30",
        rose: "border-rose-400/30",
        neutral: "border-white/10",
    }[accent];
    const headerClass = {
        amber: "text-amber-200",
        cyan: "text-cyan-200",
        emerald: "text-emerald-200",
        rose: "text-rose-200",
        neutral: "text-[var(--template-text-primary)]",
    }[accent];
    return (
        <section dir={isRtl ? "rtl" : "ltr"} className={`${SECTION_CONTAINER} mt-12`}>
            <div className={`rounded-2xl border ${borderClass} bg-white/[0.03] p-6`}>
                {header ? (
                    <h2 className={`mb-3 text-base font-semibold ${headerClass}`}>{header}</h2>
                ) : null}
                <p className={`text-sm ${props.italic ? "italic " : ""}text-[var(--template-text-secondary)]`}>
                    {pickLocale(locale, props.body)}
                </p>
            </div>
        </section>
    );
}

// Changelog timeline (date-tagged entries with platform/marketing/ops tag)

interface ChangelogEntry {
    id: string;
    date: string;
    sprint: string;
    tag: "platform" | "marketing" | "ops";
    title: LocaleField;
    body: LocaleField;
}

export interface ChangelogTimelineBlockProps {
    id: string;
    legendHeader?: LocaleField;
    legendItems: NumberedFinding[];
    entries: ChangelogEntry[];
    footnote?: LocaleField;
}

const changelogTagField = {
    type: "select" as const,
    label: "Tag",
    options: [
        { label: "platform", value: "platform" },
        { label: "marketing", value: "marketing" },
        { label: "ops", value: "ops" },
    ],
};

const changelogTimelineFields: Fields<ChangelogTimelineBlockProps> = {
    id: { type: "text", label: "Block ID" },
    legendHeader: triLingualText("Legend header (optional)"),
    legendItems: {
        type: "array",
        label: "Legend items",
        getItemSummary: (item) => item?.en ?? item?.nl ?? item?.id ?? "Item",
        arrayFields: {
            id: { type: "text", label: "ID" },
            en: { type: "text", label: "English" },
            nl: { type: "text", label: "Dutch" },
            ar: { type: "text", label: "Arabic (العربية)" },
        },
    },
    entries: {
        type: "array",
        label: "Timeline entries",
        getItemSummary: (item) => item?.title?.en ?? item?.date ?? item?.id ?? "Entry",
        arrayFields: {
            id: { type: "text", label: "ID" },
            date: { type: "text", label: "Date (YYYY-MM-DD)" },
            sprint: { type: "text", label: "Sprint label" },
            tag: changelogTagField,
            title: triLingualText("Title"),
            body: triLingualTextarea("Body"),
        },
    },
    footnote: triLingualTextarea("Footnote (optional)"),
};

const changelogTimelineDefaults: ChangelogTimelineBlockProps = {
    id: "changelog-timeline",
    legendHeader: emptyLocale(),
    legendItems: [],
    entries: [],
    footnote: emptyLocale(),
};

function changelogTagStyle(tag: ChangelogEntry["tag"]): string {
    if (tag === "platform") return "bg-cyan-400/15 text-cyan-200 border-cyan-400/30";
    if (tag === "marketing") return "bg-amber-300/15 text-amber-200 border-amber-300/30";
    return "bg-emerald-300/15 text-emerald-200 border-emerald-300/30";
}

function ChangelogTimelineRender(props: WithPuck<ChangelogTimelineBlockProps>) {
    const locale = getRenderLocale(props);
    const isRtl = locale === "ar";
    const legendItems = Array.isArray(props.legendItems) ? props.legendItems : [];
    const entries = Array.isArray(props.entries) ? props.entries : [];
    const footnote = pickLocale(locale, props.footnote);
    const legendHeader = pickLocale(locale, props.legendHeader);
    return (
        <section dir={isRtl ? "rtl" : "ltr"} className={`${SECTION_CONTAINER} mt-12`}>
            {legendItems.length > 0 ? (
                <div className="mb-12">
                    {legendHeader ? (
                        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--template-text-subtle)]">{legendHeader}</h2>
                    ) : null}
                    <ul className="grid gap-2 text-xs text-[var(--template-text-subtle)] md:grid-cols-3">
                        {legendItems.map((item) => {
                            const text = locale === "nl" ? item.nl : locale === "ar" ? (item.ar ?? item.en) : item.en;
                            return <li key={item.id}>{text}</li>;
                        })}
                    </ul>
                </div>
            ) : null}
            <ol className="space-y-6">
                {entries.map((entry) => (
                    <li key={entry.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                        <div className="mb-3 flex flex-wrap items-baseline gap-3">
                            <span className="font-mono text-xs uppercase tracking-wider text-[var(--template-text-subtle)]">{entry.date}</span>
                            <span className="text-xs text-[var(--template-text-subtle)]">·</span>
                            <span className="text-xs italic text-[var(--template-text-subtle)]">{entry.sprint}</span>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${changelogTagStyle(entry.tag)}`}>{entry.tag}</span>
                        </div>
                        <h3 className="mb-2 text-base font-semibold text-[var(--template-text-accent)]">{pickLocale(locale, entry.title)}</h3>
                        <p className="text-sm leading-relaxed text-[var(--template-text-secondary)]">{pickLocale(locale, entry.body)}</p>
                    </li>
                ))}
            </ol>
            {footnote ? (
                <p className="mt-12 rounded-2xl border border-amber-300/20 bg-white/[0.03] p-6 text-sm italic text-[var(--template-text-secondary)]">
                    {footnote}
                </p>
            ) : null}
        </section>
    );
}

// ──────────────────────── component registry export ────────────────────────

export type SectorLandingComponents = {
    SectorHeroBlock: SectorHeroBlockProps;
    SectorRunSectionBlock: SectorRunSectionBlockProps;
    SectorHonestProofBlock: SectorHonestProofBlockProps;
    SectorReplaceBlock: SectorReplaceBlockProps;
    SectorPricingNoteBlock: SectorPricingNoteBlockProps;
    SectorNotForBlock: SectorNotForBlockProps;
    SectorCtaPillBlock: SectorCtaPillBlockProps;
    BasicProSplitHeroBlock: BasicProSplitHeroBlockProps;
    BasicProMatrixBlock: BasicProMatrixBlockProps;
    ToolReplacementListBlock: ToolReplacementListBlockProps;
    EngagementShapeListBlock: EngagementShapeListBlockProps;
    NumberedFindingsBlock: NumberedFindingsBlockProps;
    CalloutCardBlock: CalloutCardBlockProps;
    ChangelogTimelineBlock: ChangelogTimelineBlockProps;
};

export const sectorLandingBlocks = {
    SectorHeroBlock: {
        label: "Sector hero",
        fields: sectorHeroFields,
        defaultProps: sectorHeroDefaults,
        render: SectorHeroRender,
    },
    SectorRunSectionBlock: {
        label: "Sector — what you'll run",
        fields: sectorRunFields,
        defaultProps: sectorRunDefaults,
        render: SectorRunSectionRender,
    },
    SectorHonestProofBlock: {
        label: "Sector — honest proof",
        fields: sectorHonestProofFields,
        defaultProps: sectorHonestProofDefaults,
        render: SectorHonestProofRender,
    },
    SectorReplaceBlock: {
        label: "Sector — what this replaces",
        fields: sectorReplaceFields,
        defaultProps: sectorReplaceDefaults,
        render: SectorReplaceRender,
    },
    SectorPricingNoteBlock: {
        label: "Sector — pricing note",
        fields: sectorPricingNoteFields,
        defaultProps: sectorPricingNoteDefaults,
        render: SectorPricingNoteRender,
    },
    SectorNotForBlock: {
        label: "Sector — not for",
        fields: sectorNotForFields,
        defaultProps: sectorNotForDefaults,
        render: SectorNotForRender,
    },
    SectorCtaPillBlock: {
        label: "Sector — CTA pill",
        fields: sectorCtaPillFields,
        defaultProps: sectorCtaPillDefaults,
        render: SectorCtaPillRender,
    },
    BasicProSplitHeroBlock: {
        label: "Basic vs Pro — split hero",
        fields: basicProSplitHeroFields,
        defaultProps: basicProSplitHeroDefaults,
        render: BasicProSplitHeroRender,
    },
    BasicProMatrixBlock: {
        label: "Basic vs Pro — feature matrix",
        fields: basicProMatrixFields,
        defaultProps: basicProMatrixDefaults,
        render: BasicProMatrixRender,
    },
    ToolReplacementListBlock: {
        label: "Tool replacement list",
        fields: toolReplacementListFields,
        defaultProps: toolReplacementListDefaults,
        render: ToolReplacementListRender,
    },
    EngagementShapeListBlock: {
        label: "Engagement shape list",
        fields: engagementShapeListFields,
        defaultProps: engagementShapeListDefaults,
        render: EngagementShapeListRender,
    },
    NumberedFindingsBlock: {
        label: "Numbered findings",
        fields: numberedFindingsFields,
        defaultProps: numberedFindingsDefaults,
        render: NumberedFindingsRender,
    },
    CalloutCardBlock: {
        label: "Callout card (amber/cyan/emerald)",
        fields: calloutCardFields,
        defaultProps: calloutCardDefaults,
        render: CalloutCardRender,
    },
    ChangelogTimelineBlock: {
        label: "Changelog timeline",
        fields: changelogTimelineFields,
        defaultProps: changelogTimelineDefaults,
        render: ChangelogTimelineRender,
    },
};
