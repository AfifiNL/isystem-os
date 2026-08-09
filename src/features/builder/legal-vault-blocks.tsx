// Puck blocks that showcase the Legal Vault feature on public pages.
//
// Mirrors the visual vocabulary used in extended-blocks.tsx (dark surface,
// cyan/violet accents, glassmorphic cards, generous spacing) so authors can
// drop these alongside Insights / Bento / FAQ without a visual seam.
//
// Server module (no "use client") — every block is server-renderable. The
// blocks are pure marketing surfaces; they do not call the Legal Vault
// server actions or expose authenticated data.

import { type ReactNode } from "react";
import Link from "next/link";
import {
    ArrowRight,
    CheckCircle2,
    Download,
    FileSignature,
    Lock,
    PenLine,
    Receipt,
    Scale,
    Send,
    ShieldCheck,
    Sparkles,
    Stamp,
    Wallet,
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

// ───────────────────────── shared design primitives ─────────────────────────
// Kept locally in sync with extended-blocks.tsx so the two block families
// look like one design system without a cross-file dependency.

const SECTION_BASE = "relative isolate overflow-hidden";
const EYEBROW = "text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300";
const HEADING = "text-[var(--template-display-sm)] font-semibold leading-[0.98] tracking-[-0.04em] text-white";
const MUTED = "text-slate-300";
const SUBTLE = "text-slate-400";
const CARD = "rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md";
const CARD_HOVER = "transition-colors hover:border-cyan-400/30 hover:bg-white/[0.07]";
const CTA_PRIMARY = "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-cyan-500 px-6 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(6,182,212,0.35)] transition-all hover:bg-cyan-400 hover:shadow-[0_0_36px_rgba(6,182,212,0.55)]";
const CTA_GHOST = "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 text-sm font-medium text-white transition-colors hover:border-cyan-400/40 hover:bg-white/10";

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
    style: SectionStyleProps;
    eyebrow?: ReactNode;
    title?: ReactNode;
    description?: ReactNode;
    children: ReactNode;
    align?: "left" | "center";
}

function SectionFrame({ style, eyebrow, title, description, children, align }: SectionFrameProps) {
    const headingAlignment = (align ?? style.alignment) === "center" ? "items-center text-center" : "items-start text-left";
    return (
        <section className={`${SECTION_BASE} bg-slate-950 text-slate-50`}>
            <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
                <div className="absolute -top-40 left-1/4 h-[420px] w-[420px] rounded-full bg-cyan-500/10 blur-[140px] mix-blend-screen" />
                <div className="absolute -bottom-32 right-1/4 h-[360px] w-[360px] rounded-full bg-violet-500/8 blur-[120px] mix-blend-screen" />
            </div>
            <div className={`${widthClasses(style.width)} ${densityClasses(style.density)}`}>
                {(eyebrow || title || description) ? (
                    <div className={`mb-10 flex flex-col gap-3 ${headingAlignment}`}>
                        {style.showEyebrow && eyebrow ? <p className={EYEBROW}>{eyebrow}</p> : null}
                        {title ? <h2 className={`${HEADING} text-balance max-w-3xl`}>{title}</h2> : null}
                        {description ? <p className={`${MUTED} max-w-2xl text-base leading-relaxed`}>{description}</p> : null}
                    </div>
                ) : null}
                {children}
            </div>
        </section>
    );
}

// ─────────────────────── 1) LegalVaultOverviewBlock ────────────────────────
// Four-pillar overview of the Legal Vault module. Mirrors the four shipped
// slices: generation, signing, retention, bookkeeping.

export type LegalVaultOverviewBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    primaryCta: { label: LocaleField; href: string };
    secondaryCta: { label: LocaleField; href: string };
};

const legalVaultOverviewFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: triLingualText("Eyebrow"),
    title: triLingualText("Title"),
    description: triLingualTextarea("Description"),
    primaryCta: {
        type: "object" as const,
        label: "Primary CTA",
        objectFields: {
            label: triLingualText("Label"),
            href: { type: "text" as const, label: "Href" },
        },
    },
    secondaryCta: {
        type: "object" as const,
        label: "Secondary CTA",
        objectFields: {
            label: triLingualText("Label"),
            href: { type: "text" as const, label: "Href" },
        },
    },
} satisfies Fields<LegalVaultOverviewBlockProps & { id: string }>;

function buildLegalVaultOverviewProps(): LegalVaultOverviewBlockProps {
    return {
        style: createSectionStyle({ surfaceTone: "dark", width: "wide", density: "spacious" }),
        eyebrow: { en: "Legal Vault", nl: "Legal Vault", ar: "خزينة قانونية" },
        title: {
            en: "Run your paperwork like the rest of your business — inside one workspace",
            nl: "Beheer je papierwerk net als de rest van je bedrijf — binnen één workspace",
            ar: "أَدِر مستنداتك القانونية كباقي أعمالك — داخل مساحة عمل واحدة",
        },
        description: {
            en: "A workspace-scoped vault for service agreements, NDAs, DPAs, invoices, receipts, and a Dutch ZZP bookkeeping ledger. Wet DBA-aligned templates, eIDAS SES signing, automatic BTW quarter rolling, and the Belastingdienst seven-year retention enforced at the database level.",
            nl: "Een werkruimte-gebonden kluis voor dienstverleningsovereenkomsten, NDA's, verwerkersovereenkomsten, facturen, bonnen en een ZZP-grootboek. Modellen conform Wet DBA, eIDAS SES-ondertekening, automatische BTW-kwartaalrollen en de zevenjarige bewaarplicht afgedwongen op databaseniveau.",
            ar: "خزينة مرتبطة بمساحة العمل لعقود الخدمات واتفاقيات السرية واتفاقيات معالجة البيانات والفواتير والإيصالات ودفتر محاسبة ZZP الهولندي. نماذج متوافقة مع Wet DBA وتوقيع eIDAS SES وتدوير ربع سنوي تلقائي لضريبة BTW وفرض حفظ السبع سنوات على مستوى قاعدة البيانات.",
        },
        primaryCta: {
            label: { en: "Open Legal Vault", nl: "Open Legal Vault", ar: "افتح Legal Vault" },
            href: "/dashboard/legal-vault",
        },
        secondaryCta: {
            label: {
                en: "Try the free NL ZZP agreement generator",
                nl: "Probeer de gratis NL ZZP-overeenkomstgenerator",
                ar: "جرّب مولّد عقد ZZP المجاني",
            },
            href: "/tools/nl-zzp-agreement-generator",
        },
    };
}

interface PillarSpec {
    icon: typeof FileSignature;
    accent: string;
    titleKey: Record<SupportedLocale, string>;
    bodyKey: Record<SupportedLocale, string>;
    badge: Record<SupportedLocale, string>;
}

const VAULT_PILLARS: PillarSpec[] = [
    {
        icon: FileSignature,
        accent: "from-cyan-400/30 to-cyan-500/0",
        titleKey: {
            en: "Wet DBA-aligned generator",
            nl: "Wet DBA-conforme generator",
            ar: "مولّد متوافق مع Wet DBA",
        },
        bodyKey: {
            en: "Gemini fills a Belastingdienst-style modelovereenkomst from a one-line intent. Operator-supplied facts always override AI guesses.",
            nl: "Gemini vult een Belastingdienst-modelovereenkomst op basis van één zin. Door de operator ingevoerde feiten winnen altijd van AI-suggesties.",
            ar: "يملأ Gemini نموذج عقد على طراز مصلحة الضرائب الهولندية من جملة واحدة. القيم التي يُدخلها المشغّل تتفوّق دائمًا على اقتراحات الذكاء الاصطناعي.",
        },
        badge: { en: "AI · Gemini", nl: "AI · Gemini", ar: "ذكاء اصطناعي · Gemini" },
    },
    {
        icon: PenLine,
        accent: "from-violet-400/30 to-violet-500/0",
        titleKey: {
            en: "eIDAS SES signing",
            nl: "eIDAS SES-ondertekening",
            ar: "توقيع eIDAS SES",
        },
        bodyKey: {
            en: "Send-to-counterparty email, public sign page, typed signature, sha256 of the canonical payload, IP + user-agent + timestamp captured in an immutable audit table.",
            nl: "Verzendmail aan tegenpartij, publieke ondertekenpagina, getypte handtekening, sha256 van de canonieke payload, IP + user-agent + tijdstempel in een onveranderlijke audittabel.",
            ar: "بريد إلى الطرف الآخر وصفحة توقيع عامة وتوقيع مكتوب وsha256 للحمولة المعتمدة مع تسجيل IP وUA والطابع الزمني في جدول تدقيق غير قابل للتغيير.",
        },
        badge: { en: "Audit trail", nl: "Audit trail", ar: "سجلّ تدقيق" },
    },
    {
        icon: ShieldCheck,
        accent: "from-emerald-400/30 to-emerald-500/0",
        titleKey: {
            en: "Bewaarplicht 7-year retention",
            nl: "Bewaarplicht (7 jaar)",
            ar: "حفظ السبع سنوات (Bewaarplicht)",
        },
        bodyKey: {
            en: "Hard-delete is blocked at the database level while a document is inside its retention window or while a bookkeeping row still references it. Soft-delete hides from view but keeps the file.",
            nl: "Hard-delete wordt op databaseniveau geblokkeerd zolang een document binnen de bewaartermijn valt of nog door een boekhoudregel wordt gebruikt. Soft-delete verbergt maar bewaart het bestand.",
            ar: "يُمنع الحذف النهائي على مستوى قاعدة البيانات طوال مدة الاحتفاظ أو ما دامت هناك قيود محاسبية تشير إلى المستند. أمّا الحذف الناعم فيُخفي الصف دون فقد الملف.",
        },
        badge: { en: "Belastingdienst", nl: "Belastingdienst", ar: "مصلحة الضرائب الهولندية" },
    },
    {
        icon: Wallet,
        accent: "from-amber-400/30 to-amber-500/0",
        titleKey: {
            en: "NL ZZP bookkeeping & BTW",
            nl: "NL ZZP-boekhouding & BTW",
            ar: "محاسبة ZZP وBTW",
        },
        bodyKey: {
            en: "Manual entry or CSV import, 21% / 9% / 0% per line, BTW quarters auto-rolled, and a one-click AI aangifte prep summary you can paste into Mijn Belastingdienst Zakelijk.",
            nl: "Handmatige invoer of CSV-import, 21% / 9% / 0% per regel, BTW-kwartalen automatisch gerold, en een aangifte-samenvatting met één klik die je in Mijn Belastingdienst Zakelijk plakt.",
            ar: "إدخال يدوي أو استيراد CSV بأسعار 21% / 9% / 0% لكل سطر، تدوير تلقائي لأرباع BTW، وملخّص جاهز للتقديم يُنسخ مباشرة إلى Mijn Belastingdienst Zakelijk.",
        },
        badge: { en: "21% standard", nl: "21% standaard", ar: "21٪ قياسي" },
    },
];

interface LegalVaultOverviewProps extends LegalVaultOverviewBlockProps {
    locale: SupportedLocale;
}

function LegalVaultOverview({ locale, style, eyebrow, title, description, primaryCta, secondaryCta }: LegalVaultOverviewProps) {
    return (
        <SectionFrame
            style={style}
            eyebrow={pickLocale(locale, eyebrow)}
            title={pickLocale(locale, title)}
            description={pickRich(locale, description)}
        >
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {VAULT_PILLARS.map((pillar) => {
                    const Icon = pillar.icon;
                    return (
                        <article
                            key={pillar.titleKey.en}
                            className={`${CARD} ${CARD_HOVER} relative overflow-hidden p-6`}
                        >
                            <div
                                className={`pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br ${pillar.accent} blur-2xl`}
                                aria-hidden="true"
                            />
                            <div className="relative flex flex-col gap-4">
                                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white">
                                    <Icon className="size-5" aria-hidden="true" />
                                </span>
                                <div>
                                    <h3 className="text-base font-semibold text-white">
                                        {pillar.titleKey[locale]}
                                    </h3>
                                    <p className={`mt-2 text-sm leading-relaxed ${MUTED}`}>
                                        {pillar.bodyKey[locale]}
                                    </p>
                                </div>
                                <span className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-200">
                                    <Sparkles className="size-3" aria-hidden="true" />
                                    {pillar.badge[locale]}
                                </span>
                            </div>
                        </article>
                    );
                })}
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                {primaryCta?.href ? (
                    <Link href={primaryCta.href} className={CTA_PRIMARY}>
                        {pickLocale(locale, primaryCta.label) || (locale === "nl" ? "Open Legal Vault" : locale === "ar" ? "افتح Legal Vault" : "Open Legal Vault")}
                        <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                ) : null}
                {secondaryCta?.href ? (
                    <Link href={secondaryCta.href} className={CTA_GHOST}>
                        {pickLocale(locale, secondaryCta.label)}
                    </Link>
                ) : null}
            </div>
        </SectionFrame>
    );
}

// ────────────────────── 2) LegalComplianceBadgesBlock ──────────────────────
// Trust strip for service pages — six compliance/trust signals in one row.

export type LegalComplianceBadgesBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
};

const legalComplianceBadgesFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: triLingualText("Eyebrow"),
    title: triLingualText("Title"),
} satisfies Fields<LegalComplianceBadgesBlockProps & { id: string }>;

function buildLegalComplianceBadgesProps(): LegalComplianceBadgesBlockProps {
    return {
        style: createSectionStyle({ surfaceTone: "dark", width: "wide", density: "comfortable" }),
        eyebrow: {
            en: "Built for serious operators",
            nl: "Gebouwd voor serieuze operators",
            ar: "مصمَّم للمشغّلين الجادّين",
        },
        title: {
            en: "Compliance the platform actually enforces — not just promises",
            nl: "Compliance die het platform écht afdwingt — niet alleen belooft",
            ar: "امتثال يفرضه النظام فعلًا — لا مجرد وعود",
        },
    };
}

interface ComplianceBadgeSpec {
    icon: typeof Lock;
    label: Record<SupportedLocale, string>;
    hint: Record<SupportedLocale, string>;
}

const COMPLIANCE_BADGES: ComplianceBadgeSpec[] = [
    {
        icon: Lock,
        label: { en: "Workspace-scoped RLS", nl: "Werkruimte-RLS", ar: "RLS لكل مساحة عمل" },
        hint: {
            en: "Every row gated by Postgres policies",
            nl: "Elke rij beveiligd via Postgres-beleid",
            ar: "كل صف يحميه سياسة Postgres",
        },
    },
    {
        icon: ShieldCheck,
        label: { en: "Bewaarplicht 7 jaar", nl: "Bewaarplicht 7 jaar", ar: "حفظ 7 سنوات" },
        hint: {
            en: "Hard-delete blocked by trigger",
            nl: "Hard-delete geblokkeerd door trigger",
            ar: "الحذف النهائي محظور بمشغّل قاعدة البيانات",
        },
    },
    {
        icon: Stamp,
        label: { en: "eIDAS SES signing", nl: "eIDAS SES-ondertekening", ar: "توقيع eIDAS SES" },
        hint: {
            en: "Immutable audit trail with sha256",
            nl: "Onveranderlijk auditspoor met sha256",
            ar: "سجلّ تدقيق غير قابل للتغيير مع sha256",
        },
    },
    {
        icon: Scale,
        label: { en: "Wet DBA aligned", nl: "Wet DBA conform", ar: "متوافق مع Wet DBA" },
        hint: {
            en: "No schijnzelfstandigheid markers",
            nl: "Geen schijnzelfstandigheidsmarkers",
            ar: "خالٍ من مؤشرات schijnzelfstandigheid",
        },
    },
    {
        icon: Receipt,
        label: { en: "21% BTW ledger", nl: "21% BTW-grootboek", ar: "دفتر BTW 21٪" },
        hint: {
            en: "Quarter periods auto-rolled",
            nl: "Kwartalen automatisch gerold",
            ar: "تدوير الأرباع تلقائيًّا",
        },
    },
    {
        icon: CheckCircle2,
        label: { en: "Capability gating", nl: "Capability gating", ar: "تحكّم بالصلاحيات" },
        hint: {
            en: "legal.read / write / manage",
            nl: "legal.read / write / manage",
            ar: "legal.read / write / manage",
        },
    },
];

interface LegalComplianceBadgesProps extends LegalComplianceBadgesBlockProps {
    locale: SupportedLocale;
}

function LegalComplianceBadges({ locale, style, eyebrow, title }: LegalComplianceBadgesProps) {
    return (
        <SectionFrame
            style={style}
            eyebrow={pickLocale(locale, eyebrow)}
            title={pickLocale(locale, title)}
            align="center"
        >
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {COMPLIANCE_BADGES.map((badge) => {
                    const Icon = badge.icon;
                    return (
                        <li
                            key={badge.label.en}
                            className={`${CARD} ${CARD_HOVER} flex items-start gap-3 p-4`}
                        >
                            <span className="mt-0.5 inline-flex size-9 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-500/10 text-cyan-200">
                                <Icon className="size-4" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="text-sm font-semibold text-white">{badge.label[locale]}</p>
                                <p className={`text-xs ${SUBTLE}`}>{badge.hint[locale]}</p>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </SectionFrame>
    );
}

// ─────────────────────── 3) NlZzpAgreementCtaBlock ─────────────────────────
// Conversion-focused CTA for the public lead-magnet at
// /tools/nl-zzp-agreement-generator.

export type NlZzpAgreementCtaBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    bullets: Array<{ id: string; text: LocaleField }>;
    primaryCta: { label: LocaleField; href: string };
    secondaryCta: { label: LocaleField; href: string };
};

const nlZzpAgreementCtaFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: triLingualText("Eyebrow"),
    title: triLingualText("Title"),
    description: triLingualTextarea("Description"),
    bullets: {
        type: "array" as const,
        label: "Bullets",
        max: 6,
        arrayFields: {
            id: { type: "text" as const, label: "ID" },
            text: triLingualText("Bullet"),
        },
        getItemSummary: (item: { text?: LocaleField }) => item.text?.en ?? "Bullet",
    },
    primaryCta: {
        type: "object" as const,
        label: "Primary CTA",
        objectFields: {
            label: triLingualText("Label"),
            href: { type: "text" as const, label: "Href" },
        },
    },
    secondaryCta: {
        type: "object" as const,
        label: "Secondary CTA",
        objectFields: {
            label: triLingualText("Label"),
            href: { type: "text" as const, label: "Href" },
        },
    },
} satisfies Fields<NlZzpAgreementCtaBlockProps & { id: string }>;

function buildNlZzpAgreementCtaProps(): NlZzpAgreementCtaBlockProps {
    return {
        style: createSectionStyle({ surfaceTone: "dark", width: "wide", density: "spacious" }),
        eyebrow: { en: "Free tool", nl: "Gratis tool", ar: "أداة مجانية" },
        title: {
            en: "Generate a Wet DBA-aligned NL ZZP service agreement — free, no signup",
            nl: "Genereer een Wet DBA-conforme NL ZZP-dienstverleningsovereenkomst — gratis, zonder registratie",
            ar: "أنشئ عقد خدمات ZZP هولندي متوافق مع Wet DBA — مجانًا وبدون تسجيل",
        },
        description: {
            en: "Built on the Belastingdienst modelovereenkomst. Live preview as you type, 21% BTW-aware, print-to-PDF in seconds.",
            nl: "Gebaseerd op de Belastingdienst-modelovereenkomst. Live-voorbeeld tijdens typen, 21% BTW-bewust, in seconden af te drukken als PDF.",
            ar: "مبني على نموذج العقد الرسمي لمصلحة الضرائب الهولندية. معاينة فورية أثناء الكتابة، يدعم BTW بنسبة 21٪، وقابل للطباعة بصيغة PDF خلال ثوانٍ.",
        },
        bullets: [
            {
                id: "no-schijnzelfstandigheid",
                text: {
                    en: "No schijnzelfstandigheid markers (vrije vervanging, geen gezagsverhouding)",
                    nl: "Geen schijnzelfstandigheidsmarkers (vrije vervanging, geen gezagsverhouding)",
                    ar: "خالٍ من مؤشرات schijnzelfstandigheid (استبدال حر، دون تبعية)",
                },
            },
            {
                id: "live-preview",
                text: {
                    en: "Live preview as you type — print to PDF when ready",
                    nl: "Live-voorbeeld tijdens typen — print direct als PDF",
                    ar: "معاينة مباشرة أثناء الكتابة — اطبع PDF عند الجاهزية",
                },
            },
            {
                id: "no-data-leaves-browser",
                text: {
                    en: "Renders entirely in your browser — your data never leaves the page",
                    nl: "Volledig in je browser — je gegevens verlaten de pagina niet",
                    ar: "يعمل بالكامل داخل متصفّحك — لا تغادر بياناتك الصفحة",
                },
            },
            {
                id: "managed-version",
                text: {
                    en: "Need signing, retention, and bookkeeping? Use the workspace Legal Vault",
                    nl: "Ondertekening, bewaarplicht en boekhouding nodig? Gebruik de Legal Vault in je workspace",
                    ar: "هل تحتاج التوقيع والحفظ والمحاسبة؟ استخدم Legal Vault داخل مساحة العمل",
                },
            },
        ],
        primaryCta: {
            label: {
                en: "Open the free generator",
                nl: "Open de gratis generator",
                ar: "افتح المولّد المجاني",
            },
            href: "/tools/nl-zzp-agreement-generator",
        },
        secondaryCta: {
            label: {
                en: "Have your workspace team run it for you",
                nl: "Laat je workspaceteam dit voor je beheren",
                ar: "دع فريق مساحة العمل يديره نيابةً عنك",
            },
            href: "/booking",
        },
    };
}

interface NlZzpAgreementCtaProps extends NlZzpAgreementCtaBlockProps {
    locale: SupportedLocale;
}

function NlZzpAgreementCta({ locale, style, eyebrow, title, description, bullets, primaryCta, secondaryCta }: NlZzpAgreementCtaProps) {
    return (
        <SectionFrame style={style}>
            <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
                <div>
                    {style.showEyebrow && eyebrow ? <p className={EYEBROW}>{pickLocale(locale, eyebrow)}</p> : null}
                    <h2 className={`mt-3 ${HEADING}`}>{pickLocale(locale, title)}</h2>
                    <p className={`mt-4 max-w-xl ${MUTED}`}>{pickRich(locale, description)}</p>

                    <ul className="mt-6 grid gap-3">
                        {(bullets ?? []).map((bullet) => (
                            <li key={bullet.id} className="flex items-start gap-3 text-sm text-slate-100">
                                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-cyan-300" aria-hidden="true" />
                                <span>{pickLocale(locale, bullet.text)}</span>
                            </li>
                        ))}
                    </ul>

                    <div className="mt-8 flex flex-wrap gap-3">
                        {primaryCta?.href ? (
                            <Link href={primaryCta.href} className={CTA_PRIMARY}>
                                <Download className="size-4" aria-hidden="true" />
                                {pickLocale(locale, primaryCta.label)}
                            </Link>
                        ) : null}
                        {secondaryCta?.href ? (
                            <Link href={secondaryCta.href} className={CTA_GHOST}>
                                {pickLocale(locale, secondaryCta.label)}
                            </Link>
                        ) : null}
                    </div>
                </div>

                {/* Mock browser preview of the tool — pure decoration, no data */}
                <div
                    className={`${CARD} relative overflow-hidden p-5 lg:p-6`}
                    aria-hidden="true"
                >
                    <div className="flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full bg-red-400/70" />
                        <span className="size-2.5 rounded-full bg-amber-400/70" />
                        <span className="size-2.5 rounded-full bg-emerald-400/70" />
                        <span className="ml-3 truncate font-mono text-[10px] text-slate-400">
                            /tools/nl-zzp-agreement-generator
                        </span>
                    </div>
                    <div className="mt-5 space-y-3 text-[11px] leading-relaxed text-slate-300">
                        <p className="font-semibold text-white">Dienstverleningsovereenkomst</p>
                        <p>
                            Tussen <span className="text-cyan-200">Opdrachtgever B.V.</span>, gevestigd te
                            Amsterdam, KvK <span className="text-cyan-200">12345678</span>, BTW-id
                            NLxxxxxxxxxB01 (Opdrachtnemer)…
                        </p>
                        <p>
                            <strong className="text-white">§2. Aard van de overeenkomst.</strong>{" "}
                            Opdracht in de zin van art. 7:400 BW. Geen arbeidsovereenkomst, geen
                            gezagsverhouding, vrije vervanging.
                        </p>
                        <p>
                            <strong className="text-white">§4. Vergoeding.</strong> € 120,00 per uur,
                            exclusief 21 % BTW. Betaaltermijn 14 dagen.
                        </p>
                    </div>
                    <div className="pointer-events-none absolute -bottom-16 right-0 h-44 w-44 rounded-full bg-cyan-500/15 blur-3xl" />
                </div>
            </div>
        </SectionFrame>
    );
}

// ─────────────────────── 4) LegalWorkflowTimelineBlock ─────────────────────
// Five-step workflow showing the full booking → invoice → BTW arc.

export type LegalWorkflowTimelineBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
};

const legalWorkflowTimelineFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: triLingualText("Eyebrow"),
    title: triLingualText("Title"),
    description: triLingualTextarea("Description"),
} satisfies Fields<LegalWorkflowTimelineBlockProps & { id: string }>;

function buildLegalWorkflowTimelineProps(): LegalWorkflowTimelineBlockProps {
    return {
        style: createSectionStyle({ surfaceTone: "dark", width: "wide", density: "spacious" }),
        eyebrow: { en: "End-to-end workflow", nl: "Werkstroom van begin tot eind", ar: "سير عمل متكامل" },
        title: {
            en: "From confirmed booking to filed BTW — one tool, zero handoffs",
            nl: "Van bevestigde boeking tot ingediende BTW — één tool, geen handoffs",
            ar: "من تأكيد الحجز إلى تقديم BTW — أداة واحدة بلا تسليمات",
        },
        description: {
            en: "When a booking is confirmed, the workspace auto-drafts a service agreement into the vault, walks it through e-signing, and places the resulting invoice and receipt in the bookkeeping ledger for the next BTW quarter.",
            nl: "Zodra een boeking wordt bevestigd, maakt de workspace automatisch een conceptovereenkomst in de kluis, voert deze door de ondertekening en plaatst de factuur en bon in het boekhoudgrootboek voor het volgende BTW-kwartaal.",
            ar: "بمجرّد تأكيد الحجز، تُنشئ مساحة العمل تلقائيًّا مسوّدة عقد في الخزينة وتُمرّرها عبر التوقيع الإلكتروني، ثم تضع الفاتورة والإيصال في دفتر المحاسبة لربع BTW التالي.",
        },
    };
}

interface WorkflowStepSpec {
    icon: typeof Send;
    title: Record<SupportedLocale, string>;
    body: Record<SupportedLocale, string>;
}

const WORKFLOW_STEPS: WorkflowStepSpec[] = [
    {
        icon: Send,
        title: { en: "Booking confirmed", nl: "Boeking bevestigd", ar: "تأكيد الحجز" },
        body: {
            en: "A reservation flips to 'confirmed' in the Booking app — manually or via payment verification.",
            nl: "Een reservering gaat naar 'confirmed' in de Booking-app — handmatig of via betalingsverificatie.",
            ar: "تنتقل الحجوزات إلى حالة \"confirmed\" في تطبيق الحجز — يدويًّا أو بعد التحقّق من الدفع.",
        },
    },
    {
        icon: FileSignature,
        title: { en: "DVO auto-drafted", nl: "DVO automatisch opgesteld", ar: "صياغة DVO آليًّا" },
        body: {
            en: "draftAgreementFromBooking() fires on the workspace's default DVO template, pre-filled with scope, party, and rate.",
            nl: "draftAgreementFromBooking() vuurt op de standaard-DVO van de werkruimte, voorgevuld met scope, partij en tarief.",
            ar: "تُستدعى draftAgreementFromBooking() على نموذج DVO الافتراضي للمساحة، مع تعبئة النطاق والطرف والسعر مسبقًا.",
        },
    },
    {
        icon: PenLine,
        title: { en: "Counterparty signs", nl: "Tegenpartij ondertekent", ar: "توقيع الطرف الآخر" },
        body: {
            en: "Resend delivers the signing email; the counterparty reviews on /sign/[token] and submits an eIDAS SES signature.",
            nl: "Resend levert de ondertekenmail; de tegenpartij beoordeelt op /sign/[token] en plaatst een eIDAS SES-handtekening.",
            ar: "يُرسِل Resend بريد التوقيع؛ يراجع الطرف الآخر العقد على /sign/[token] ويوقّع بتوقيع eIDAS SES.",
        },
    },
    {
        icon: Receipt,
        title: { en: "Invoice logged", nl: "Factuur ingeboekt", ar: "تسجيل الفاتورة" },
        body: {
            en: "Issue the invoice from the same vault; it lands as an accounting_entries row at 21% BTW, linked to the source document.",
            nl: "Verstuur de factuur uit dezelfde kluis; deze landt als accounting_entries-regel met 21% BTW, gekoppeld aan het brondocument.",
            ar: "أصدر الفاتورة من نفس الخزينة؛ تُسجَّل كصفّ في accounting_entries بنسبة 21٪ BTW ومرتبطة بالمستند المصدر.",
        },
    },
    {
        icon: Wallet,
        title: { en: "BTW prep, one click", nl: "BTW-aangifte, één klik", ar: "تحضير BTW بنقرة واحدة" },
        body: {
            en: "At quarter end, the AI BTW summary produces an aangifte-ready narrative + totals you paste into Mijn Belastingdienst Zakelijk.",
            nl: "Aan het eind van het kwartaal levert de AI-BTW-samenvatting een aangifteklaar verhaal + totalen die je plakt in Mijn Belastingdienst Zakelijk.",
            ar: "في نهاية الربع، يُنتج ملخّص BTW المدعوم بالذكاء الاصطناعي سردًا جاهزًا للتقديم وإجماليات تُنسخ إلى Mijn Belastingdienst Zakelijk.",
        },
    },
];

interface LegalWorkflowTimelineProps extends LegalWorkflowTimelineBlockProps {
    locale: SupportedLocale;
}

function LegalWorkflowTimeline({ locale, style, eyebrow, title, description }: LegalWorkflowTimelineProps) {
    return (
        <SectionFrame
            style={style}
            eyebrow={pickLocale(locale, eyebrow)}
            title={pickLocale(locale, title)}
            description={pickRich(locale, description)}
        >
            <ol className="relative grid gap-6 lg:grid-cols-5">
                <div
                    className="pointer-events-none absolute left-0 right-0 top-6 -z-10 hidden h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent lg:block"
                    aria-hidden="true"
                />
                {WORKFLOW_STEPS.map((step, index) => {
                    const Icon = step.icon;
                    return (
                        <li
                            key={step.title.en}
                            className={`${CARD} ${CARD_HOVER} relative flex flex-col gap-3 p-5`}
                        >
                            <div className="flex items-center gap-3">
                                <span className="inline-flex size-12 items-center justify-center rounded-full border border-cyan-400/40 bg-slate-950 text-cyan-200 shadow-[0_0_24px_rgba(6,182,212,0.25)]">
                                    <Icon className="size-5" aria-hidden="true" />
                                </span>
                                <span className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">
                                    {String(index + 1).padStart(2, "0")}
                                </span>
                            </div>
                            <h3 className="text-sm font-semibold text-white">{step.title[locale]}</h3>
                            <p className={`text-xs leading-relaxed ${MUTED}`}>{step.body[locale]}</p>
                        </li>
                    );
                })}
            </ol>
        </SectionFrame>
    );
}

// ─────────────────────────── Block registry export ─────────────────────────

export type LegalVaultComponents = {
    LegalVaultOverviewBlock: LegalVaultOverviewBlockProps & { id: string };
    LegalComplianceBadgesBlock: LegalComplianceBadgesBlockProps & { id: string };
    NlZzpAgreementCtaBlock: NlZzpAgreementCtaBlockProps & { id: string };
    LegalWorkflowTimelineBlock: LegalWorkflowTimelineBlockProps & { id: string };
};

interface BuilderRenderProps<T> {
    puck?: { metadata?: { locale?: SupportedLocale } };
    [key: string]: unknown;
    style: SectionStyleProps;
    _placeholder?: T;
}

export const legalVaultBlocks = {
    LegalVaultOverviewBlock: {
        label: "Legal Vault · four-pillar overview",
        fields: legalVaultOverviewFields,
        defaultProps: { id: "legal-vault-overview", ...buildLegalVaultOverviewProps() },
        render: (props: BuilderRenderProps<LegalVaultOverviewBlockProps>) => (
            <LegalVaultOverview
                locale={getRenderLocale(props)}
                style={props.style}
                eyebrow={props.eyebrow as LocaleField}
                title={props.title as LocaleField}
                description={props.description as RichLocaleField}
                primaryCta={props.primaryCta as { label: LocaleField; href: string }}
                secondaryCta={props.secondaryCta as { label: LocaleField; href: string }}
            />
        ),
    },
    LegalComplianceBadgesBlock: {
        label: "Legal Vault · compliance badges strip",
        fields: legalComplianceBadgesFields,
        defaultProps: { id: "legal-compliance-badges", ...buildLegalComplianceBadgesProps() },
        render: (props: BuilderRenderProps<LegalComplianceBadgesBlockProps>) => (
            <LegalComplianceBadges
                locale={getRenderLocale(props)}
                style={props.style}
                eyebrow={props.eyebrow as LocaleField}
                title={props.title as LocaleField}
            />
        ),
    },
    NlZzpAgreementCtaBlock: {
        label: "Legal Vault · NL ZZP agreement lead magnet",
        fields: nlZzpAgreementCtaFields,
        defaultProps: { id: "nl-zzp-agreement-cta", ...buildNlZzpAgreementCtaProps() },
        render: (props: BuilderRenderProps<NlZzpAgreementCtaBlockProps>) => (
            <NlZzpAgreementCta
                locale={getRenderLocale(props)}
                style={props.style}
                eyebrow={props.eyebrow as LocaleField}
                title={props.title as LocaleField}
                description={props.description as RichLocaleField}
                bullets={(props.bullets as Array<{ id: string; text: LocaleField }>) ?? []}
                primaryCta={props.primaryCta as { label: LocaleField; href: string }}
                secondaryCta={props.secondaryCta as { label: LocaleField; href: string }}
            />
        ),
    },
    LegalWorkflowTimelineBlock: {
        label: "Legal Vault · booking → BTW workflow",
        fields: legalWorkflowTimelineFields,
        defaultProps: { id: "legal-workflow-timeline", ...buildLegalWorkflowTimelineProps() },
        render: (props: BuilderRenderProps<LegalWorkflowTimelineBlockProps>) => (
            <LegalWorkflowTimeline
                locale={getRenderLocale(props)}
                style={props.style}
                eyebrow={props.eyebrow as LocaleField}
                title={props.title as LocaleField}
                description={props.description as RichLocaleField}
            />
        ),
    },
};

export {
    buildLegalVaultOverviewProps,
    buildLegalComplianceBadgesProps,
    buildNlZzpAgreementCtaProps,
    buildLegalWorkflowTimelineProps,
};

export { LEGAL_VAULT_BLOCK_TYPES, type LegalVaultBlockType } from "@/features/builder/legal-vault-blocks-meta";
