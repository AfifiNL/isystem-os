import { facilityServicesTheme as enTheme } from "@/shared/lib/i18n/dictionaries/en";
import { facilityServicesTheme as nlTheme } from "@/shared/lib/i18n/dictionaries/nl";

export type SupportedLocale = "en" | "nl" | "ar";
export type CorePageKind = "home" | "services" | "contact" | "about";
export type PageKind = CorePageKind | "custom";
export type PageIntent =
    | "service-page"
    | "campaign-landing"
    | "sector-page"
    | "trust-proof"
    | "case-study"
    | "quote-capture"
    | "recruitment"
    | "location-page";

export function isCorePageKind(value: string): value is CorePageKind {
    return value === "home" || value === "services" || value === "about" || value === "contact";
}

export type SurfaceTone = "light" | "soft" | "dark" | "brand" | "premium";
export type AccentTone = "primary" | "emerald" | "amber" | "rose" | "slate";
export type SectionWidth = "contained" | "wide" | "full";
export type ContentAlignment = "left" | "center";
export type Density = "compact" | "comfortable" | "spacious";
export type CardStyle = "flat" | "outline" | "elevated" | "glass";
export type EmphasisLevel = "subtle" | "medium" | "strong";
export type MediaPosition = "left" | "right";
export type CtaLayout = "inline" | "stacked";

export type LinkField = {
    label: LocaleField;
    href: string;
};

export type SectionStyleProps = {
    surfaceTone: SurfaceTone;
    accentTone: AccentTone;
    width: SectionWidth;
    alignment: ContentAlignment;
    density: Density;
    cardStyle: CardStyle;
    emphasis: EmphasisLevel;
    showEyebrow: boolean;
};

export type RootCtaData = {
    primaryLabel: string;
    primaryHref: string;
    secondaryLabel: string;
    secondaryHref: string;
};

export type BuilderPageMetadata = {
    pageIntent?: PageIntent;
    audienceType?: string;
    conversionGoal?: string;
    campaignLabel?: string;
    seoTitle?: string;
    seoDescription?: string;
    heroMedia?: string;
    canonicalPath?: string;
    noindex?: boolean;
    publishedLabel?: string;
    starterPreset?: string;
    recommendedBlocks?: string[];
    cta?: RootCtaData;
    hideNavbar?: boolean;
    hideFooter?: boolean;
    ctaVariant?: "default" | "mobile";
};

export type CommitmentBlockProps = {
    title: LocaleField;
    description: RichLocaleField;
    style: SectionStyleProps;
};

export type LocaleField = {
    en: string;
    nl: string;
    ar?: string;
};

export type RichLocaleField = LocaleField & {
    richEn?: string;
    richNl?: string;
    richAr?: string;
};

export type LocaleListItem = {
    id: string;
    en: string;
    nl: string;
    ar?: string;
};

export type IconCardItem = {
    id: string;
    icon: string;
    title: LocaleField;
    description: RichLocaleField;
};

export type TestimonialItem = {
    id: string;
    quote: RichLocaleField;
    name: string;
    role: LocaleField;
    company: string;
};

export type LogoItem = {
    id: string;
    name: string;
    image: string;
};

export type TimelineItem = {
    id: string;
    step: string;
    title: LocaleField;
    description: RichLocaleField;
};

export type MetricItem = {
    id: string;
    value: string;
    label: LocaleField;
    supportingText: RichLocaleField;
};

export type GalleryImage = {
    id: string;
    image: string;
    alt: LocaleField;
    caption: LocaleField;
};

export type ScopeMatrixRow = {
    id: string;
    item: LocaleField;
    frequency: LocaleField;
    result: RichLocaleField;
};

export type PackageItem = {
    id: string;
    title: LocaleField;
    description: RichLocaleField;
    features: LocaleListItem[];
    badge: LocaleField;
};

export type PositioningStatement = {
    id: string;
    title: LocaleField;
    detail: RichLocaleField;
};

export type ComparisonFeature = {
    id: string;
    label: LocaleField;
    basic: LocaleField;
    pro: LocaleField;
};

export type OperationalProofItem = {
    id: string;
    title: LocaleField;
    description: RichLocaleField;
    proof: LocaleField;
};

export type EnterpriseEngagementItem = {
    id: string;
    title: LocaleField;
    description: RichLocaleField;
    supportPoints: LocaleListItem[];
};

export type SectorItem = {
    id: string;
    title: LocaleField;
    description: RichLocaleField;
    proofPoints: LocaleListItem[];
};

export type StatsItem = {
    id: string;
    value: string;
    label: LocaleField;
};

export type ServiceFeature = LocaleListItem;

export type ServiceItem = {
    id: string;
    orderLabel: string;
    title: LocaleField;
    description: RichLocaleField;
    image: string;
    alt: LocaleField;
    features: ServiceFeature[];
};

export type MethodologyStep = {
    id: string;
    stepNumber: string;
    title: LocaleField;
    description: RichLocaleField;
};

export type FaqItem = {
    id: string;
    question: LocaleField;
    answer: RichLocaleField;
};

export type HeroBlockProps = {
    eyebrow: LocaleField;
    titleLineOne: LocaleField;
    titleLineTwo: LocaleField;
    subtitle: RichLocaleField;
    primaryCta: LocaleField;
    primaryHref: string;
    secondaryCta: LocaleField;
    secondaryHref: string;
    backgroundVideo: string;
    trustBadges: LocaleListItem[];
};

export type StatsBlockProps = {
    items: StatsItem[];
};

export type FoundationBlockProps = {
    title: LocaleField;
    description: RichLocaleField;
    supportLine: RichLocaleField;
    style: SectionStyleProps;
};

export type AboutBlockProps = {
    eyebrow: LocaleField;
    headline: RichLocaleField;
    description: RichLocaleField;
    missionTitle: LocaleField;
    missionText: RichLocaleField;
    visionTitle: LocaleField;
    visionText: RichLocaleField;
    whyTitle: LocaleField;
    image: string;
    imageAlt: LocaleField;
    whyPoints: LocaleListItem[];
    style: SectionStyleProps;
};

export type ServicesShowcaseBlockProps = {
    title: LocaleField;
    subtitle: RichLocaleField;
    description: RichLocaleField;
    items: ServiceItem[];
    primaryCta: LocaleField;
    primaryHref: string;
};

export type MethodologyBlockProps = {
    title: LocaleField;
    subtitle: RichLocaleField;
    steps: MethodologyStep[];
};

export type ContactBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    heroImage: string;
    heroImageAlt: LocaleField;
    email: string;
    phone: string;
    address: LocaleField;
    kvk: string;
    supportHours: LocaleField;
    trustTitle: LocaleField;
    trustItems: LocaleListItem[];
    formTitle: LocaleField;
    formSubtitle: RichLocaleField;
    fieldName: LocaleField;
    fieldCompany: LocaleField;
    fieldEmail: LocaleField;
    fieldPhone: LocaleField;
    fieldFacilitySize: LocaleField;
    fieldFacilitySizeOptions: LocaleListItem[];
    fieldNeeds: LocaleField;
    formNeedsPlaceholder: LocaleField;
    submitLabel: LocaleField;
    submitPendingLabel: LocaleField;
    facilitySizePlaceholder: LocaleField;
    successMessage: RichLocaleField;
    faqTitle: LocaleField;
    faqItems: FaqItem[];
    previewNotice: RichLocaleField;
};

export type IntroBannerBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    body: RichLocaleField;
    richBodyEn?: string;
    richBodyNl?: string;
    richBodyAr?: string;
    cta: LinkField;
};

export type RichTextSectionBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    body: RichLocaleField;
    richBodyEn?: string;
    richBodyNl?: string;
    richBodyAr?: string;
    supportingPoints: LocaleListItem[];
    cta?: LinkField;
};

export type FeatureListBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    items: LocaleListItem[];
};

export type IconCardsBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    items: IconCardItem[];
};

export type StoryBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    body: RichLocaleField;
    richBodyEn?: string;
    richBodyNl?: string;
    richBodyAr?: string;
    image: string;
    imageAlt: LocaleField;
    mediaPosition: MediaPosition;
};

export type TestimonialsBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    items: TestimonialItem[];
};

export type ClientLogosBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    items: LogoItem[];
};

export type MetricsBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    items: MetricItem[];
};

export type TimelineBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    items: TimelineItem[];
};

export type CtaBannerBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    primaryCta: LinkField;
    secondaryCta: LinkField;
    ctaLayout: CtaLayout;
};

export type QuoteRequestBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    richDescriptionEn?: string;
    richDescriptionNl?: string;
    richDescriptionAr?: string;
    offerItems: LocaleListItem[];
    primaryCta: LinkField;
};

export type GalleryBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    items: GalleryImage[];
};

export type VideoBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    videoUrl: string;
    posterUrl: string;
    primaryCta: LinkField;
};

export type SectorGridBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    items: SectorItem[];
};

export type ScopeMatrixBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    rows: ScopeMatrixRow[];
};

export type PackagesBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    items: PackageItem[];
};

export type PositioningStripBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    items: PositioningStatement[];
};

export type BasicProComparisonBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    basicTitle: LocaleField;
    basicSubtitle: RichLocaleField;
    proTitle: LocaleField;
    proSubtitle: RichLocaleField;
    comparisonRows: ComparisonFeature[];
};

export type OperationalProofBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    items: OperationalProofItem[];
};

export type EnterpriseSupportBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    items: EnterpriseEngagementItem[];
    cta: LinkField;
};

export type SpacerBlockProps = {
    style: SectionStyleProps;
    height: "sm" | "md" | "lg" | "xl";
};

export type DividerBlockProps = {
    style: SectionStyleProps;
    label: LocaleField;
};

export type SeoSupportBlockProps = {
    style: SectionStyleProps;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    richDescriptionEn?: string;
    richDescriptionNl?: string;
    richDescriptionAr?: string;
    placement: "top" | "middle" | "bottom";
    tone: "muted" | "prominent";
};

export const defaultSectionStyle: SectionStyleProps = {
    surfaceTone: "light",
    accentTone: "primary",
    width: "contained",
    alignment: "left",
    density: "comfortable",
    cardStyle: "elevated",
    emphasis: "medium",
    showEyebrow: true,
};

export function createSectionStyle(overrides: Partial<SectionStyleProps> = {}): SectionStyleProps {
    return {
        ...defaultSectionStyle,
        ...overrides,
    };
}

export function localeField(en: string, nl: string): LocaleField {
    return { en, nl };
}

export function richLocaleField(en: string, nl: string, rich?: Partial<Record<SupportedLocale, string>>): RichLocaleField {
    return {
        en,
        nl,
        richEn: rich?.en,
        richNl: rich?.nl,
    };
}

export function localeItem(id: string, en: string, nl: string): LocaleListItem {
    return { id, en, nl };
}

export function faqItem(
    id: string,
    enQuestion: string,
    nlQuestion: string,
    enAnswer: string,
    nlAnswer: string,
    richAnswer?: Partial<Record<SupportedLocale, string>>,
): FaqItem {
    return {
        id,
        question: localeField(enQuestion, nlQuestion),
        answer: richLocaleField(enAnswer, nlAnswer, richAnswer),
    };
}

export function getLocaleValue(locale: SupportedLocale, field: LocaleField) {
    if (!field || typeof field !== "object") {
        return "";
    }

    if (locale === "ar") {
        // Treat ar as "untranslated" when it's missing, empty, or identical
        // to en — return empty so resolveField/resolveRichText callers fall
        // back to their hand-curated AR copy instead of leaking English.
        // Real AR translations differ from EN by definition, so equality is
        // a reliable "no-real-translation" signal here.
        const ar = field.ar;
        if (!ar || ar === field.en) return "";
        return ar;
    }
    return locale === "nl" ? (field.nl ?? field.en ?? "") : (field.en ?? field.nl ?? "");
}

export function getRichTextLocaleValue(locale: SupportedLocale, field: LocaleField | RichLocaleField) {
    if (!field || typeof field !== "object") {
        return "";
    }

    const richField = field as RichLocaleField;

    if (locale === "ar") {
        // Same EN-mirror guard as getLocaleValue. Check rich first, then
        // plain. If both are mirrors of EN, return "" so the renderer's
        // hand-translated fallback wins.
        const richAr = richField.richAr;
        if (richAr && richAr !== richField.richEn) return richAr;
        const ar = field.ar;
        if (ar && ar !== field.en) return ar;
        return "";
    }
    return locale === "nl"
        ? richField.richNl ?? richField.richEn ?? field.nl ?? field.en ?? ""
        : richField.richEn ?? richField.richNl ?? field.en ?? field.nl ?? "";
}

export function translateListItem(locale: SupportedLocale, item: LocaleListItem) {
    if (locale === "ar") {
        // Mirror guard: when ar is missing or identical to en, return empty
        // so resolveListItems falls back to its hand-curated AR array instead
        // of leaking English. Real translations differ from en by definition.
        if (item.ar && item.ar !== item.en) return item.ar;
        return "";
    }
    return locale === "nl" ? item.nl : item.en;
}

export function getThemes() {
    return { en: enTheme, nl: nlTheme };
}

function getWorkspaceStatsCopy() {
    return {
        en: [
            { value: "150,000+", label: "people reached through founder-led education programs" },
            { value: "300+", label: "international students recruited during the Georgia chapter" },
            { value: "EN · NL · AR", label: "workspace languages with RTL handling where it matters" },
        ],
        nl: [
            { value: "150.000+", label: "mensen bereikt via founder-led onderwijsprogramma's" },
            { value: "300+", label: "internationale studenten gerekruteerd tijdens het Georgië-hoofdstuk" },
            { value: "EN · NL · AR", label: "workspace-talen met RTL waar dat ertoe doet" },
        ],
    };
}

function getWorkspaceFoundationCopy() {
    return {
        en: {
            title: "Your business computer, in the browser.",
            description: "This digital operating workspace is for SMEs that no longer want to run the business across a CMS, newsletter tool, booking widget, SEO spreadsheet, podcast folder, GDPR tracker, and AI chat thread.",
            supportLine: "Founder-led from Breda. KvK-registered. Built around the desktop OS metaphor, governed AI workflows, and a workspace that remembers what it learns.",
        },
        nl: {
            title: "Uw bedrijfscomputer, in de browser.",
            description: "Deze digitale operating workspace is voor mkb-bedrijven die hun operatie niet langer willen verdelen over een CMS, nieuwsbrief-tool, boekingswidget, SEO-sheet, podcastmap, GDPR-tracker en AI-chatthread.",
            supportLine: "Founder-led vanuit Breda. KvK-geregistreerd. Gebouwd rond de desktop-OS-metafoor, governed AI-workflows en een workspace die onthoudt wat hij leert.",
        },
    };
}

function getWorkspaceAboutCopy() {
    return {
        en: {
            eyebrow: "Why this is different",
            headline: "A workspace, not a dashboard. Governance, not hype. A system that learns.",
            description: "The category is deliberate. This is neither an agency selling deliverables nor a SaaS vendor selling seats. It is one governed workspace with an accountable operator.",
            missionTitle: "The operating problem",
            missionText: "You should not need a CMS, newsletter tool, booking widget, SEO sheet, podcast folder, GDPR tracker, and AI chat thread just to keep the business moving. The workspace puts the working parts in one governed environment.",
            visionTitle: "What keeps improving",
            visionText: "Every accepted edit, internal-link change, authority source, proposal event, and workspace signal becomes part of the operating history. The workspace gets clearer as the business uses it.",
            whyTitle: "Three anchors",
            whyPoints: [
                "Desktop OS metaphor: wallpaper, windowed apps, taskbar, Start menu, Notes, Calculator, Voice Memo, Content Studio, SEO Control Center, Bookings, Newsletter, Podcast Studio.",
                "Governed AI: bounded budgets, reviewable usage records, fact-verified drafts, preview/apply/rollback, and role-gated changes.",
                "System memory: Opportunity Engine, SEO Control Center, Content Graph, Newsletter, Podcast, and Bookings persist the decisions that make the next cycle sharper.",
            ],
        },
        nl: {
            eyebrow: "Waarom dit anders is",
            headline: "Een workspace, geen dashboard. Governance, geen hype. Een systeem dat leert.",
            description: "De categorie is bewust gekozen. Dit is geen agency die losse deliverables verkoopt en geen SaaS-leverancier die seats verkoopt. Het is één governed workspace met een aanspreekbare operator.",
            missionTitle: "Het operationele probleem",
            missionText: "U zou geen CMS, nieuwsbrief-tool, boekingswidget, SEO-sheet, podcastmap, GDPR-tracker en AI-chatthread nodig moeten hebben om het bedrijf draaiende te houden. De workspace zet de werkende onderdelen in één governed omgeving.",
            visionTitle: "Wat blijft verbeteren",
            visionText: "Elke geaccepteerde edit, interne-linkwijziging, autoriteitsbron, proposal-event en workspace-signaal wordt onderdeel van de operationele historie. De workspace wordt duidelijker naarmate het bedrijf ermee werkt.",
            whyTitle: "Drie ankers",
            whyPoints: [
                "Desktop-OS-metafoor: wallpaper, vensterapps, taakbalk, Start-menu, Notes, Calculator, Voice Memo, Content Studio, SEO Control Center, Bookings, Newsletter, Podcast Studio.",
                "Governed AI: begrensde budgetten, controleerbare gebruiksregistratie, geverifieerde concepten, preview/apply/rollback en rolgebonden wijzigingen.",
                "Systeemgeheugen: Opportunity Engine, SEO Control Center, Content Graph, Newsletter, Podcast en Bookings bewaren beslissingen die de volgende cyclus scherper maken.",
            ],
        },
    };
}

function getWorkspaceServicesCopy() {
    return {
        en: {
            title: "What runs inside the workspace",
            subtitle: "One operating layer for content, growth, bookings, media, and governance",
            description: "These are not separate services stitched together after the fact. They are the visible apps inside the same governed workspace — editable in the page builder, scoped to the workspace, and operated from one place.",
            items: [
                {
                    id: "content-growth",
                    title: "Content and growth operations",
                    description: "Content Studio, SEO Control Center, Opportunity Engine, Market Monitor, and Newsletter Control Center work from the same workspace memory.",
                    alt: "Content and growth operations workspace",
                    image: "/stealth-cto-hero.png",
                    features: ["Fact-verified drafts", "Preview/apply/rollback SEO edits", "Newsletter on Resend"],
                },
                {
                    id: "workspace-os",
                    title: "Desktop-style workspace",
                    description: "Wallpaper, windowed apps, taskbar, Start menu, productivity utilities, and a mobile-adapted shell turn admin work into a recognizable operating environment.",
                    alt: "Desktop OS workspace interface",
                    image: "/stealth-cto-hero.png",
                    features: ["Custom wallpaper", "Windowed app shell", "Notes, Calculator, Voice Memo"],
                },
                {
                    id: "governed-operations",
                    title: "Governed operations",
                    description: "Bookings, partner portal, popups, GDPR settings, DSR tracking, anti-abuse logging, AI credit ledger, and role-gated mutations sit under one operational roof.",
                    alt: "Governed operations and compliance workspace",
                    image: "/stealth-cto-hero.png",
                    features: ["Booking templates", "GDPR and anti-abuse logs", "AI credit ledger"],
                },
            ],
        },
        nl: {
            title: "Wat in de workspace draait",
            subtitle: "Eén operationele laag voor content, groei, boekingen, media en governance",
            description: "Dit zijn geen losse diensten die achteraf aan elkaar zijn geplakt. Het zijn zichtbare apps binnen dezelfde governed workspace — beheerbaar in de pagebuilder, workspace-scoped en vanuit één plek bediend.",
            items: [
                {
                    id: "content-growth",
                    title: "Content- en groeioperatie",
                    description: "Content Studio, SEO Control Center, Opportunity Engine, Market Monitor en Newsletter Control Center werken vanuit hetzelfde workspace-geheugen.",
                    alt: "Content- en groeiworkspace",
                    image: "/stealth-cto-hero.png",
                    features: ["Fact-verified drafts", "Preview/apply/rollback SEO-edits", "Nieuwsbrief op Resend"],
                },
                {
                    id: "workspace-os",
                    title: "Desktop-achtige workspace",
                    description: "Wallpaper, vensterapps, taakbalk, Start-menu, productiviteitstools en een mobiele shell maken adminwerk herkenbaar als werkomgeving.",
                    alt: "Desktop-OS workspace-interface",
                    image: "/stealth-cto-hero.png",
                    features: ["Eigen wallpaper", "Vensterapp-shell", "Notes, Calculator, Voice Memo"],
                },
                {
                    id: "governed-operations",
                    title: "Governed operations",
                    description: "Boekingen, partnerportaal, popups, GDPR-instellingen, DSR-tracking, anti-abuse logging, AI-credit ledger en role-gated mutaties zitten onder één operationeel dak.",
                    alt: "Governed operations en compliance-workspace",
                    image: "/stealth-cto-hero.png",
                    features: ["Boekingstemplates", "GDPR- en anti-abuse logs", "AI-credit ledger"],
                },
            ],
        },
    };
}

function getWorkspaceMethodologyCopy() {
    return {
        en: {
            title: "Audit. Build. Operate.",
            subtitle: "The work starts with the current system, not a slide deck. The output is a governed workspace that a real SME team can run.",
            steps: [
                { title: "Audit", description: "Map the six-tool reality: public site, content, SEO, newsletter, bookings, media, GDPR, analytics, and the places where AI is already being used without governance." },
                { title: "Build", description: "Provision the workspace, set the page-builder structure, seed the content model, configure governed AI workflows, and localize the core surface in EN/NL/AR where needed." },
                { title: "Operate", description: "Run monthly review cycles on content, link graph, market signals, booking signals, and ledger activity. The system already remembers; the roadmap is to let it act on more of what it remembers." },
            ],
        },
        nl: {
            title: "Audit. Bouw. Bedrijf.",
            subtitle: "Het werk start bij het huidige systeem, niet bij een slide deck. De output is een governed workspace waar een echt mkb-team mee kan werken.",
            steps: [
                { title: "Audit", description: "Breng de zes-tool-realiteit in kaart: publieke site, content, SEO, nieuwsbrief, boekingen, media, GDPR, analytics en de plekken waar AI al zonder governance wordt gebruikt." },
                { title: "Bouw", description: "Richt de workspace in, zet de pagebuilder-structuur neer, seed het contentmodel, configureer governed AI-workflows en lokaliseer de kernsurface in EN/NL/AR waar nodig." },
                { title: "Bedrijf", description: "Draai maandelijkse reviewcycli op content, linkgraph, marktsignalen, bookingsignalen en ledger-activiteit. Het systeem onthoudt al; de roadmap is dat het op meer van die herinnering gaat handelen." },
            ],
        },
    };
}

function getWorkspaceCommitmentCopy() {
    return {
        en: {
            title: "Our commitment",
            description: "We build systems that improve execution, strengthen credibility, and support long-term operational clarity.",
        },
        nl: {
            title: "Onze commitment",
            description: "Wij bouwen systemen die de uitvoering verbeteren, geloofwaardigheid versterken en langetermijnhelderheid in de operatie ondersteunen.",
        },
    };
}

function getWorkspaceContactIdentityCopy() {
    return {
        en: {
            eyebrow: "Contact",
            title: "Let’s discuss your system",
            description: "Tell us what you want to improve across AI, automation, websites, operations, or digital delivery. We will recommend the right next step.",
            heroImage: "/stealth-cto-hero.png",
            heroImageAlt: "Strategy and delivery workspace",
            email: "hello@example.invalid",
            phone: "+31 20 000 0000",
            address: "Netherlands-based · serving local and international clients",
            kvk: "Available on request",
            supportHours: "By appointment · project and retainer support",
        },
        nl: {
            eyebrow: "Contact",
            title: "Laten we uw systeem bespreken",
            description: "Vertel ons wat u wilt verbeteren op het gebied van AI, automatisering, websites, operatie of digitale delivery. Wij adviseren de juiste vervolgstap.",
            heroImage: "/stealth-cto-hero.png",
            heroImageAlt: "Strategie- en delivery-workspace",
            email: "hello@example.invalid",
            phone: "+31 20 000 0000",
            address: "In Nederland gevestigd · voor lokale en internationale klanten",
            kvk: "Beschikbaar op aanvraag",
            supportHours: "Op afspraak · project- en retainersupport",
        },
    };
}

function getWorkspaceHeroCopy() {
    return {
        en: {
            eyebrow: "Digital operating workspace for SMEs",
            titleLineOne: "One workspace",
            titleLineTwo: "instead of six tools.",
            subtitle: "A founder-led digital operating system for service businesses: desktop-style workspace, governed AI, content, SEO, newsletter, podcast, bookings, GDPR, and analytics in one place.",
            primaryCta: "Plan a 30-minute call",
            secondaryCta: "See what is shipped",
            trustBadges: [
                "Founder-led from Breda · KvK-registered",
                "Governed AI: metered, reviewable, reversible",
                "Master's thesis on AI adoption in Dutch SMEs",
            ],
        },
        nl: {
            eyebrow: "Digitale operating workspace voor het mkb",
            titleLineOne: "Eén workspace",
            titleLineTwo: "in plaats van zes tools.",
            subtitle: "Een founder-led digitaal besturingssysteem voor servicebedrijven: desktop-workspace, governed AI, content, SEO, nieuwsbrief, podcast, boekingen, GDPR en analytics op één plek.",
            primaryCta: "Plan een gesprek van 30 minuten",
            secondaryCta: "Bekijk wat al live is",
            trustBadges: [
                "Founder-led vanuit Breda · KvK-geregistreerd",
                "Governed AI: gemeten, controleerbaar, terug te draaien",
                "Masterscriptie over AI-adoptie in Nederlandse mkb's",
            ],
        },
    };
}

export function buildHeroProps() {
    const copy = getWorkspaceHeroCopy();
    return {
        id: "home-hero",
        eyebrow: localeField(
            copy.en.eyebrow,
            copy.nl.eyebrow,
        ),
        titleLineOne: localeField(copy.en.titleLineOne, copy.nl.titleLineOne),
        titleLineTwo: localeField(copy.en.titleLineTwo, copy.nl.titleLineTwo),
        subtitle: richLocaleField(copy.en.subtitle, copy.nl.subtitle),
        primaryCta: localeField(copy.en.primaryCta, copy.nl.primaryCta),
        primaryHref: "/contact",
        secondaryCta: localeField(copy.en.secondaryCta, copy.nl.secondaryCta),
        secondaryHref: "/services",
        backgroundVideo: "",
        trustBadges: copy.en.trustBadges.map((badge, index) => localeItem(`hero-badge-${index + 1}`, badge, copy.nl.trustBadges[index] ?? badge)),
    };
}

export function buildStatsProps() {
    const copy = getWorkspaceStatsCopy();
    return {
        id: "home-stats",
        items: copy.en.map((item, index) => ({
            id: `stat-${index + 1}`,
            value: item.value,
            label: localeField(item.label, copy.nl[index]?.label ?? item.label),
        })),
    };
}

export function buildFoundationProps() {
    const copy = getWorkspaceFoundationCopy();
    return {
        id: "home-foundation",
        title: localeField(copy.en.title, copy.nl.title),
        description: richLocaleField(copy.en.description, copy.nl.description),
        supportLine: richLocaleField(copy.en.supportLine, copy.nl.supportLine),
        style: createSectionStyle({ surfaceTone: "soft" }),
    };
}

export function buildAboutProps() {
    const copy = getWorkspaceAboutCopy();
    return {
        id: "home-about",
        eyebrow: localeField(copy.en.eyebrow, copy.nl.eyebrow),
        headline: richLocaleField(copy.en.headline, copy.nl.headline),
        description: richLocaleField(copy.en.description, copy.nl.description),
        missionTitle: localeField(copy.en.missionTitle, copy.nl.missionTitle),
        missionText: richLocaleField(copy.en.missionText, copy.nl.missionText),
        visionTitle: localeField(copy.en.visionTitle, copy.nl.visionTitle),
        visionText: richLocaleField(copy.en.visionText, copy.nl.visionText),
        whyTitle: localeField(copy.en.whyTitle, copy.nl.whyTitle),
        image: "/stealth-cto-hero.png",
        imageAlt: localeField("Digital systems consulting", "Digitale systeemconsultancy"),
        whyPoints: copy.en.whyPoints.map((point, index) => localeItem(`why-${index + 1}`, point, copy.nl.whyPoints[index] ?? point)),
        style: createSectionStyle({ width: "wide" }),
    };
}

export function buildServicesShowcaseProps(blockId: string) {
    const copy = getWorkspaceServicesCopy();
    return {
        id: blockId,
        title: localeField(copy.en.title, copy.nl.title),
        subtitle: richLocaleField(copy.en.subtitle, copy.nl.subtitle),
        description: richLocaleField(copy.en.description, copy.nl.description),
        primaryCta: localeField("Book a strategy call", "Plan een strategiesessie"),
        primaryHref: "/contact",
        items: copy.en.items.map((item, index) => ({
            id: item.id,
            orderLabel: String(index + 1).padStart(2, "0"),
            title: localeField(item.title, copy.nl.items[index]?.title ?? item.title),
            description: richLocaleField(item.description, copy.nl.items[index]?.description ?? item.description),
            image: item.image,
            alt: localeField(item.alt, copy.nl.items[index]?.alt ?? item.alt),
            features: item.features.map((feature, featureIndex) =>
                localeItem(
                    `${item.id}-feature-${featureIndex + 1}`,
                    feature,
                    copy.nl.items[index]?.features[featureIndex] ?? feature
                )
            ),
        })),
    };
}

export function buildMethodologyProps(blockId: string) {
    const copy = getWorkspaceMethodologyCopy();
    return {
        id: blockId,
        title: localeField(copy.en.title, copy.nl.title),
        subtitle: richLocaleField(copy.en.subtitle, copy.nl.subtitle),
        steps: copy.en.steps.map((step, index) => ({
            id: `step-${index + 1}`,
            stepNumber: String(index + 1).padStart(2, "0"),
            title: localeField(step.title, copy.nl.steps[index]?.title ?? step.title),
            description: richLocaleField(step.description, copy.nl.steps[index]?.description ?? step.description),
        })),
    };
}

export function buildContactProps() {
    const copy = getWorkspaceContactIdentityCopy();
    return {
        id: "contact-main",
        style: createSectionStyle({ surfaceTone: "soft", accentTone: "primary", cardStyle: "glass" }),
        eyebrow: localeField(copy.en.eyebrow, copy.nl.eyebrow),
        title: localeField(copy.en.title, copy.nl.title),
        description: richLocaleField(copy.en.description, copy.nl.description),
        heroImage: copy.en.heroImage,
        heroImageAlt: localeField(copy.en.heroImageAlt, copy.nl.heroImageAlt),
        email: copy.en.email,
        phone: copy.en.phone,
        address: localeField(copy.en.address, copy.nl.address),
        kvk: copy.en.kvk,
        supportHours: localeField(copy.en.supportHours, copy.nl.supportHours),
        trustTitle: localeField("What to expect", "Wat u kunt verwachten"),
        trustItems: [
            localeItem("contact-trust-1", "Founder-led discovery and business context review", "Founder-led discovery en review van de businesscontext"),
            localeItem("contact-trust-2", "Recommended roadmap, scope, or delivery model", "Aanbevolen roadmap, scope of deliverymodel"),
            localeItem("contact-trust-3", "Clear proposal for build, advisory, or embedded support", "Duidelijk voorstel voor build, advies of embedded support"),
            localeItem("contact-trust-4", "Fast next-step alignment without agency overhead", "Snelle vervolgstap zonder agency-overhead"),
        ],
        formTitle: localeField("Project intake", "Project intake"),
        formSubtitle: richLocaleField(
            "Share your goals, current bottlenecks, and the kind of support you need. We will recommend the right starting point.",
            "Deel uw doelen, huidige knelpunten en het type ondersteuning dat u nodig heeft. Wij adviseren het juiste startpunt."
        ),
        fieldName: localeField("Full name", "Volledige naam"),
        fieldCompany: localeField("Company", "Bedrijf"),
        fieldEmail: localeField("Work email", "Werk e-mail"),
        fieldPhone: localeField("Phone", "Telefoon"),
        fieldFacilitySize: localeField("Project scope", "Projectscope"),
        fieldFacilitySizeOptions: [
            localeItem("project-scope-1", "Discovery / audit", "Discovery / audit"),
            localeItem("project-scope-2", "Single build sprint", "Enkele build sprint"),
            localeItem("project-scope-3", "Ongoing retainer", "Doorlopende retainer"),
            localeItem("project-scope-4", "Embedded team support", "Embedded team support"),
        ],
        fieldNeeds: localeField("What do you need help with?", "Waar heeft u hulp bij nodig?"),
        formNeedsPlaceholder: localeField(
            "Tell us about your AI, automation, website, or delivery challenge.",
            "Vertel ons meer over uw AI-, automatiserings-, website- of delivery-uitdaging."
        ),
        submitLabel: localeField("Request strategy call", "Vraag strategiesessie aan"),
        submitPendingLabel: localeField("Submitting...", "Bezig met verzenden..."),
        facilitySizePlaceholder: localeField("Select scope", "Selecteer scope"),
        successMessage: richLocaleField(
            "Thank you! Your request has been successfully received. We will be in touch shortly.",
            "Bedankt! Uw aanvraag is succesvol ontvangen. Wij nemen spoedig contact met u op."
        ),
        faqTitle: localeField("Frequently asked questions", "Veelgestelde vragen"),
        faqItems: [
            faqItem(
                "contact-faq-1",
                "Do you work with SMEs and larger enterprise teams?",
                "Werken jullie met het mkb én grotere enterprise teams?",
                "Yes. We support SMEs directly and can also embed as a specialist delivery layer inside larger enterprise teams under service agreement.",
                "Ja. We ondersteunen het mkb direct en kunnen ook embedded werken als specialistische delivery-laag binnen grotere enterprise teams via een service agreement."
            ),
            faqItem(
                "contact-faq-2",
                "What kind of projects are a fit?",
                "Voor welke soorten projecten zijn jullie geschikt?",
                "AI integration, workflow automation, websites, portals, content systems, SEO operations, and broader digital operating-model improvements are all strong fits.",
                "AI-integratie, workflow-automatisering, websites, portals, contentsystemen, SEO-operaties en bredere verbeteringen van het digitale operating model passen allemaal goed."
            ),
            faqItem(
                "contact-faq-3",
                "Can you start with strategy before implementation?",
                "Kunnen jullie starten met strategie vóór implementatie?",
                "Absolutely. Many engagements begin with an audit, roadmap, or advisory phase before moving into implementation or retained support.",
                "Absoluut. Veel trajecten starten met een audit, roadmap of adviesfase voordat ze overgaan naar implementatie of retained support."
            ),
        ],
        previewNotice: richLocaleField(
            "Builder-managed copy preview only. Live form submission and interaction choreography stay in the public renderer.",
            "Alleen builder-preview van copy. Live formulierverzending en interactie-choreografie blijven in de publieke renderer."
        ),
    };
}

export function buildIntroBannerProps(blockId = "intro-banner"): IntroBannerBlockProps & { id: string } {
    return {
        id: blockId,
        style: createSectionStyle({ surfaceTone: "brand", accentTone: "primary", alignment: "center", emphasis: "strong" }),
        eyebrow: localeField("Digital systems consultancy", "Digitale systeemconsultancy"),
        title: localeField("A sharper way to present, manage, and scale digital execution.", "Een scherpere manier om digitale uitvoering te presenteren, beheren en opschalen."),
        body: localeField(
            "Use this banner to open sector pages, solution pages, or premium landing pages with a clear executive message.",
            "Gebruik deze banner om sectorpagina's, solution pages of premium landingspagina's te openen met een heldere executive boodschap."
        ),
        richBodyEn: "<p>Use this banner to introduce <strong>sector pages</strong>, solution pages, or premium landing pages with an executive-level message.</p>",
        richBodyNl: "<p>Gebruik deze banner om <strong>sectorpagina's</strong>, solution pages of premium landingspagina's te openen met een executive boodschap.</p>",
        cta: {
            label: localeField("Book a strategy call", "Plan een strategiesessie"),
            href: "/contact",
        },
    };
}

export function buildRichTextSectionProps(blockId = "richtext-section"): RichTextSectionBlockProps & { id: string } {
    return {
        id: blockId,
        style: createSectionStyle(),
        eyebrow: localeField("Why this matters", "Waarom dit belangrijk is"),
        title: localeField("Turn digital clarity into visible client confidence.", "Maak digitale helderheid zichtbaar als klantvertrouwen."),
        body: localeField(
            "Use this block for strong narrative sections, commercial explanation, or strategic positioning statements. It is ideal for pages that need more than a simple list of services.",
            "Gebruik dit blok voor sterke narratieve secties, commerciële uitleg of strategische positionering. Ideaal voor pagina's die meer nodig hebben dan alleen een lijst met diensten."
        ),
        richBodyEn: "<p>Use this block for <strong>strong narrative sections</strong>, commercial explanation, or strategic positioning statements.</p><p>It is ideal for pages that need more than a simple list of services.</p>",
        richBodyNl: "<p>Gebruik dit blok voor <strong>sterke narratieve secties</strong>, commerciële uitleg of strategische positionering.</p><p>Ideaal voor pagina's die meer nodig hebben dan alleen een lijst met diensten.</p>",
        supportingPoints: [
            localeItem("rich-point-1", "Explain the client problem clearly", "Leg het klantprobleem duidelijk uit"),
            localeItem("rich-point-2", "Connect systems to trust and growth", "Verbind systemen met vertrouwen en groei"),
            localeItem("rich-point-3", "Lead naturally into proof or CTA sections", "Leid natuurlijk door naar bewijs- of CTA-secties"),
        ],
        cta: {
            label: localeField("See capabilities", "Bekijk mogelijkheden"),
            href: "/services",
        },
    };
}

export function buildFeatureListProps(blockId = "feature-list"): FeatureListBlockProps & { id: string } {
    return {
        id: blockId,
        style: createSectionStyle({ surfaceTone: "soft", cardStyle: "outline" }),
        eyebrow: localeField("What teams gain", "Wat teams winnen"),
        title: localeField("The system behind a more modern digital business.", "Het systeem achter een modernere digitale organisatie."),
        description: richLocaleField(
            "Use this section to highlight a focused set of strategic advantages.",
            "Gebruik deze sectie om een gerichte set strategische voordelen uit te lichten."
        ),
        items: [
            localeItem("feature-1", "Premium website and page management", "Premium website- en paginabeheer"),
            localeItem("feature-2", "Client transparency and SLA support", "Klanttransparantie en SLA-ondersteuning"),
            localeItem("feature-3", "AI-assisted growth and communication workflows", "AI-ondersteunde groei- en communicatieworkflows"),
            localeItem("feature-4", "Workspace-level governance and manager control", "Workspace-governance en managercontrole"),
        ],
    };
}

export function buildIconCardsProps(blockId = "icon-cards"): IconCardsBlockProps & { id: string } {
    return {
        id: blockId,
        style: createSectionStyle({ surfaceTone: "light", cardStyle: "elevated", width: "wide" }),
        eyebrow: localeField("Core pillars", "Kernpijlers"),
        title: localeField("Structure the page around clear business outcomes.", "Bouw de pagina op rond duidelijke bedrijfsuitkomsten."),
        description: richLocaleField(
            "Use icon cards to create clean, scannable sections with premium positioning.",
            "Gebruik icon cards voor heldere, scanbare secties met premium positionering."
        ),
        items: [
            { id: "icon-card-1", icon: "shield", title: localeField("Trust", "Vertrouwen"), description: richLocaleField("Show how you professionalize service transparency.", "Laat zien hoe u service-transparantie professionaliseert.") },
            { id: "icon-card-2", icon: "sparkles", title: localeField("Growth", "Groei"), description: richLocaleField("Connect content, campaigns, and visibility to commercial momentum.", "Verbind content, campagnes en zichtbaarheid aan commerciële groei.") },
            { id: "icon-card-3", icon: "building", title: localeField("Operations", "Operaties"), description: richLocaleField("Frame delivery as a structured operating model.", "Positioneer delivery als een gestructureerd operating model.") },
        ],
    };
}

export function buildStoryBlockProps(blockId = "story-block"): StoryBlockProps & { id: string } {
    return {
        id: blockId,
        style: createSectionStyle({ width: "wide", surfaceTone: "soft" }),
        eyebrow: localeField("The story", "Het verhaal"),
        title: localeField("High-quality delivery deserves an equally high-quality system around it.", "Hoogwaardige dienstverlening verdient een even hoogwaardig systeem eromheen."),
        body: localeField(
            "Use this block for founder narratives, transformation stories, or operational philosophy. It is ideal when the page needs a human strategic voice.",
            "Gebruik dit blok voor oprichtersverhalen, transformatieverhalen of operationele filosofie. Ideaal wanneer de pagina een menselijke strategische stem nodig heeft."
        ),
        richBodyEn: "<p>Use this block for founder narratives, transformation stories, or operational philosophy.</p><p>It is ideal when the page needs a human strategic voice with <a href=\"/contact\">clear momentum toward action</a>.</p>",
        richBodyNl: "<p>Gebruik dit blok voor oprichtersverhalen, transformatieverhalen of operationele filosofie.</p><p>Ideaal wanneer de pagina een menselijke strategische stem nodig heeft met <a href=\"/contact\">duidelijke beweging richting actie</a>.</p>",
        image: "/stealth-cto-hero.png",
        imageAlt: localeField("Founder-led digital systems workspace", "Founder-led digitale systeemworkspace"),
        mediaPosition: "right",
    };
}

export function buildTestimonialsProps(blockId = "testimonials"): TestimonialsBlockProps & { id: string } {
    return {
        id: blockId,
        style: createSectionStyle({ surfaceTone: "premium", accentTone: "amber", width: "wide" }),
        eyebrow: localeField("Client confidence", "Klantvertrouwen"),
        title: localeField("Use trust language backed by delivery credibility.", "Gebruik vertrouwensboodschappen ondersteund door delivery-geloofwaardigheid."),
        description: richLocaleField(
            "Ideal for social proof, references, and quality positioning.",
            "Ideaal voor social proof, referenties en kwaliteitspositionering."
        ),
        items: [
            { id: "testimonial-1", quote: richLocaleField("The workspace helped us turn scattered tools into one clearer digital operating model.", "De workspace hielp ons versnipperde tools om te zetten in één duidelijker digitaal operating model."), name: "Operations Lead", role: localeField("Service business transformation", "Transformatie van servicebedrijven"), company: "Northline Advisory" },
            { id: "testimonial-2", quote: richLocaleField("The biggest shift was not only speed, but the structure behind content, workflows, and client communication.", "De grootste verandering was niet alleen snelheid, maar vooral de structuur achter content, workflows en klantcommunicatie."), name: "Managing Partner", role: localeField("Digital growth and delivery", "Digitale groei en delivery"), company: "Studio Meridian" },
        ],
    };
}

export function buildClientLogosProps(blockId = "client-logos"): ClientLogosBlockProps & { id: string } {
    return {
        id: blockId,
        style: createSectionStyle({ alignment: "center", cardStyle: "flat" }),
        eyebrow: localeField("Trusted by", "Vertrouwd door"),
        title: localeField("Add recognisable brands to increase confidence quickly.", "Voeg herkenbare merken toe om sneller vertrouwen op te bouwen."),
        description: richLocaleField("Use this area as a trust strip or a mid-page confidence booster.", "Gebruik dit gebied als trust strip of als mid-page confidence booster."),
        items: [
            { id: "logo-1", name: "Example Workplace", image: "/themes/facility-services/logo.svg" },
            { id: "logo-2", name: "Example Hospitality Site", image: "/themes/facility-services/logo.svg" },
            { id: "logo-3", name: "Example Operations Partner", image: "/themes/facility-services/logo.svg" },
        ],
    };
}

export function buildMetricsProps(blockId = "metrics"): MetricsBlockProps & { id: string } {
    return {
        id: blockId,
        style: createSectionStyle({ width: "wide", cardStyle: "glass", accentTone: "emerald" }),
        eyebrow: localeField("Outcomes", "Resultaten"),
        title: localeField("Translate performance into business value.", "Vertaal prestaties naar zakelijke waarde."),
        description: richLocaleField("Use this section for KPIs, business impact, and retention proof.", "Gebruik deze sectie voor KPI's, impact en retentie-bewijs."),
        items: [
            { id: "metric-1", value: "98%", label: localeField("Schedule adherence", "Naleving planning"), supportingText: richLocaleField("Supports premium account confidence.", "Ondersteunt vertrouwen bij premium accounts.") },
            { id: "metric-2", value: "24h", label: localeField("Delivery response visibility", "Zichtbaarheid van delivery-reactie"), supportingText: richLocaleField("Position faster accountability.", "Positioneer snellere accountability.") },
            { id: "metric-3", value: "1 system", label: localeField("Digital control layer", "Digitale control-laag"), supportingText: richLocaleField("Show connected workflow maturity.", "Laat volwassen, verbonden workflows zien.") },
        ],
    };
}

export function buildTimelineProps(blockId = "timeline"): TimelineBlockProps & { id: string } {
    return {
        id: blockId,
        style: createSectionStyle({ surfaceTone: "soft", cardStyle: "outline" }),
        eyebrow: localeField("Rollout path", "Uitrolpad"),
        title: localeField("Show prospects how implementation can unfold.", "Laat prospects zien hoe implementatie kan verlopen."),
        description: richLocaleField("This is ideal for onboarding, methodology, or transformation pages.", "Ideaal voor onboarding-, methodologie- of transformatiepagina's."),
        items: [
            { id: "timeline-1", step: "01", title: localeField("Assess", "Inventariseren"), description: richLocaleField("Understand business priorities, delivery constraints, and digital opportunities.", "Breng zakelijke prioriteiten, delivery-beperkingen en digitale kansen in kaart.") },
            { id: "timeline-2", step: "02", title: localeField("Configure", "Configureren"), description: richLocaleField("Shape messaging, workflow structure, and system direction around the right commercial goal.", "Richt messaging, workflowstructuur en systeemrichting in rond het juiste commerciële doel.") },
            { id: "timeline-3", step: "03", title: localeField("Operate", "Opereren"), description: richLocaleField("Use the system as the premium control layer for communication, execution, and transparency.", "Gebruik het systeem als premium control-laag voor communicatie, uitvoering en transparantie.") },
        ],
    };
}

export function buildCtaBannerProps(blockId = "cta-banner"): CtaBannerBlockProps & { id: string } {
    return {
        id: blockId,
        style: createSectionStyle({ surfaceTone: "brand", accentTone: "primary", alignment: "center", emphasis: "strong" }),
        eyebrow: localeField("Next step", "Volgende stap"),
        title: localeField("Invite the prospect into a strategic conversation.", "Nodig de prospect uit voor een strategisch gesprek."),
        description: richLocaleField("Use this near the bottom of campaign, sector, or quote-capture pages.", "Gebruik dit onderaan campagne-, sector- of quote-capture-pagina's."),
        primaryCta: { label: localeField("Book a strategy walkthrough", "Plan een strategiesessie"), href: "/contact" },
        secondaryCta: { label: localeField("View services", "Bekijk diensten"), href: "/services" },
        ctaLayout: "inline",
    };
}

export function buildQuoteRequestProps(blockId = "quote-request"): QuoteRequestBlockProps & { id: string } {
    return {
        id: blockId,
        style: createSectionStyle({ surfaceTone: "premium", accentTone: "amber", cardStyle: "glass" }),
        eyebrow: localeField("Project intake", "Project intake"),
        title: localeField("Make it easy for qualified prospects to start the right conversation.", "Maak het eenvoudig voor gekwalificeerde prospects om het juiste gesprek te starten."),
        description: richLocaleField("Use this section on lead-generation, strategy, or service inquiry pages.", "Gebruik deze sectie op leadgeneratie-, strategie- of service inquiry-pagina's."),
        richDescriptionEn: "<p>Use this section on lead-generation, strategy, or service inquiry pages.</p><p>Add inline emphasis, links, and clear promises for qualified prospects who are ready to move.</p>",
        richDescriptionNl: "<p>Gebruik deze sectie op leadgeneratie-, strategie- of service inquiry-pagina's.</p><p>Voeg inline nadruk, links en duidelijke beloften toe voor gekwalificeerde prospects die klaar zijn om verder te gaan.</p>",
        offerItems: [
            localeItem("offer-1", "Recommended project scope", "Aanbevolen projectscope"),
            localeItem("offer-2", "Delivery model and implementation guidance", "Advies over deliverymodel en implementatie"),
            localeItem("offer-3", "Clear next-step roadmap", "Duidelijke roadmap voor de vervolgstap"),
        ],
        primaryCta: { label: localeField("Request strategy call", "Vraag strategiesessie aan"), href: "/contact" },
    };
}

export function buildPositioningStripProps(blockId = "positioning-strip"): PositioningStripBlockProps & { id: string } {
    return {
        id: blockId,
        style: createSectionStyle({ surfaceTone: "premium", accentTone: "primary", width: "wide", cardStyle: "glass" }),
        eyebrow: localeField("Positioning strip", "Positioneringsstrip"),
        title: localeField("System-first positioning for serious operators.", "System-first positionering voor serieuze operators."),
        description: richLocaleField(
            "Use this strip to establish the workspace lens immediately: lean, accountable, AI-assisted, and built for business execution.",
            "Gebruik deze strip om direct de workspace-lens neer te zetten: lean, aanspreekbaar, AI-ondersteund en gebouwd voor business execution."
        ),
        items: [
            {
                id: "positioning-1",
                title: localeField("Netherlands-based digital systems partner", "In Nederland gevestigde digitale systeempartner"),
                detail: richLocaleField("Built for local and international clients that need sharper execution without agency bloat.", "Gebouwd voor lokale en internationale klanten die scherpere uitvoering nodig hebben zonder agency-overhead."),
            },
            {
                id: "positioning-2",
                title: localeField("AI-enabled delivery without unnecessary complexity", "AI-enabled delivery zonder onnodige complexiteit"),
                detail: richLocaleField("Human strategic direction amplified by AI agents across research, content, structure, and delivery speed.", "Menselijke strategische regie versterkt door AI-agents voor research, content, structuur en deliveriesnelheid."),
            },
            {
                id: "positioning-3",
                title: localeField("Built for SMEs, ready for enterprise collaboration", "Gebouwd voor het mkb, klaar voor enterprise samenwerking"),
                detail: richLocaleField("A lean operating layer for growing businesses or a focused specialist capability inside larger teams under service agreement.", "Een lean operating layer voor groeiende bedrijven of een gerichte specialistische capability binnen grotere teams via service agreement."),
            },
        ],
    };
}

export function buildBasicProComparisonProps(blockId = "basic-pro-comparison"): BasicProComparisonBlockProps & { id: string } {
    return {
        id: blockId,
        style: createSectionStyle({ surfaceTone: "dark", accentTone: "amber", width: "wide", cardStyle: "glass", emphasis: "strong" }),
        eyebrow: localeField("Basic vs Pro", "Basic vs Pro"),
        title: localeField("Choose between a digital foundation and a full operating system.", "Kies tussen een digitale basis en een volledig operating system."),
        description: richLocaleField(
            "Use this block to explain the difference between credibility-first presence and full operational leverage.",
            "Gebruik dit blok om het verschil uit te leggen tussen een credibility-first presence en volledige operationele leverage."
        ),
        basicTitle: localeField("Basic Workspace", "Basic Workspace"),
        basicSubtitle: richLocaleField("A credible digital foundation with premium pages, strong messaging, and core business clarity.", "Een geloofwaardige digitale basis met premium pagina's, sterke messaging en zakelijke helderheid."),
        proTitle: localeField("Pro Workspace", "Pro Workspace"),
        proSubtitle: richLocaleField("A full digital operating system for growth, content, visibility, client management, and media workflows.", "Een volledig digitaal operating system voor groei, content, zichtbaarheid, klantmanagement en mediaworkflows."),
        comparisonRows: [
            { id: "compare-1", label: localeField("Website and premium pages", "Website en premium pagina's"), basic: localeField("Included", "Inbegrepen"), pro: localeField("Included + expanded system pages", "Inbegrepen + uitgebreide systeempagina's") },
            { id: "compare-2", label: localeField("AI-assisted draft generation", "AI-ondersteunde draftgeneratie"), basic: localeField("Not included", "Niet inbegrepen"), pro: localeField("Included", "Inbegrepen") },
            { id: "compare-3", label: localeField("SEO workflow support", "SEO-workflowondersteuning"), basic: localeField("Light structure", "Lichte structuur"), pro: localeField("Operational workflow", "Operationele workflow") },
            { id: "compare-4", label: localeField("Client management and SLA visibility", "Klantmanagement en SLA-zichtbaarheid"), basic: localeField("Not included", "Niet inbegrepen"), pro: localeField("Included", "Inbegrepen") },
        ],
    };
}

export function buildOperationalProofProps(blockId = "operational-proof"): OperationalProofBlockProps & { id: string } {
    return {
        id: blockId,
        style: createSectionStyle({ surfaceTone: "soft", accentTone: "emerald", width: "wide", cardStyle: "outline" }),
        eyebrow: localeField("Operational proof", "Operationeel bewijs"),
        title: localeField("Show that the system supports execution, not only appearance.", "Laat zien dat het systeem uitvoering ondersteunt, niet alleen uitstraling."),
        description: richLocaleField(
            "This block translates platform depth into concrete business credibility.",
            "Dit blok vertaalt platformdiepte naar concrete zakelijke geloofwaardigheid."
        ),
        items: [
            { id: "proof-1", title: localeField("Client account management", "Klantaccountmanagement"), description: richLocaleField("Support account ownership, linked profiles, and continuity across client relationships.", "Ondersteun account ownership, gekoppelde profielen en continuïteit in klantrelaties."), proof: localeField("Linked profiles and access continuity", "Gekoppelde profielen en toegangscontinuïteit") },
            { id: "proof-2", title: localeField("SLA-oriented visibility", "SLA-georiënteerde zichtbaarheid"), description: richLocaleField("Track service items, response quality, and delivery visibility through a structured operational layer.", "Volg service-items, responskwaliteit en delivery-zichtbaarheid via een gestructureerde operationele laag."), proof: localeField("Multi-scope SLA tracking", "Multi-scope SLA-tracking") },
            { id: "proof-3", title: localeField("AI media and content workflows", "AI-media- en contentworkflows"), description: richLocaleField("Coordinate draft generation, voiceover support, and asset workflows from one environment.", "Coördineer draftgeneratie, voiceover-ondersteuning en assetworkflows vanuit één omgeving."), proof: localeField("Narration, assets, and workflow orchestration", "Narratie, assets en workfloworkestratie") },
            { id: "proof-4", title: localeField("SEO planning and internal-link operations", "SEO-planning en internal-link-operaties"), description: richLocaleField("Translate content strategy into structured visibility opportunities and controlled execution.", "Vertaal contentstrategie naar gestructureerde zichtbaarheidskansen en gecontroleerde uitvoering."), proof: localeField("Opportunity planning built in", "Opportunity planning ingebouwd") },
        ],
    };
}

export function buildEnterpriseSupportProps(blockId = "enterprise-support"): EnterpriseSupportBlockProps & { id: string } {
    return {
        id: blockId,
        style: createSectionStyle({ surfaceTone: "brand", accentTone: "primary", width: "wide", cardStyle: "glass", emphasis: "strong" }),
        eyebrow: localeField("Enterprise support model", "Enterprise support model"),
        title: localeField("A specialist layer for larger teams under service agreement.", "Een specialistische laag voor grotere teams via service agreement."),
        description: richLocaleField(
            "Use this block to explain how the workspace can operate as part of bigger delivery environments without pretending to be a bloated agency.",
            "Gebruik dit blok om uit te leggen hoe de workspace kan opereren als onderdeel van grotere deliveryomgevingen zonder zich voor te doen als een log agentschap."
        ),
        items: [
            {
                id: "enterprise-1",
                title: localeField("Focused specialist capability", "Gerichte specialistische capability"),
                description: richLocaleField("Position the workspace as an accountable execution layer that plugs into larger teams where speed, structure, and systems thinking matter.", "Positioneer de workspace als een aanspreekbare execution layer die aansluit op grotere teams waar snelheid, structuur en systeemdenken tellen."),
                supportPoints: [
                    localeItem("enterprise-1-point-1", "No inflated headcount claims", "Geen opgeblazen headcount-claims"),
                    localeItem("enterprise-1-point-2", "Clear scope and accountability", "Heldere scope en accountability"),
                    localeItem("enterprise-1-point-3", "Service-agreement friendly", "Geschikt voor service agreements"),
                ],
            },
            {
                id: "enterprise-2",
                title: localeField("Cross-functional contribution", "Cross-functionele bijdrage"),
                description: richLocaleField("Support strategy, implementation, content systems, SEO operations, and digital execution as one connected capability.", "Ondersteun strategie, implementatie, contentsystemen, SEO-operaties en digitale uitvoering als één verbonden capability."),
                supportPoints: [
                    localeItem("enterprise-2-point-1", "Strategy and structure", "Strategie en structuur"),
                    localeItem("enterprise-2-point-2", "Execution and optimization", "Uitvoering en optimalisatie"),
                    localeItem("enterprise-2-point-3", "Lean by design", "Lean by design"),
                ],
            },
        ],
        cta: { label: localeField("Discuss collaboration", "Bespreek samenwerking"), href: "/contact" },
    };
}

export function buildGalleryProps(blockId = "gallery"): GalleryBlockProps & { id: string } {
    return {
        id: blockId,
        style: createSectionStyle({ width: "wide", cardStyle: "flat" }),
        eyebrow: localeField("Visual proof", "Visueel bewijs"),
        title: localeField("Use imagery to reinforce professionalism and atmosphere.", "Gebruik beeld om professionaliteit en sfeer te versterken."),
        description: richLocaleField("Ideal for service pages, landing pages, and proof-led storytelling.", "Ideaal voor servicepagina's, landingspagina's en bewijsgerichte storytelling."),
        items: [
            { id: "gallery-1", image: "/themes/facility-services/hero.jpg", alt: localeField("Well-maintained workplace", "Goed onderhouden werkplek"), caption: localeField("Facility operations environment", "Omgeving voor facilitaire operatie") },
            { id: "gallery-2", image: "/themes/facility-services/logo.svg", alt: localeField("Replaceable facility-services demo mark", "Vervangbaar demo-logo voor facility services"), caption: localeField("Configurable demo identity", "Configureerbare demo-identiteit") },
            { id: "gallery-3", image: "/stealth-cto-hero.png", alt: localeField("Connected operating workflow", "Verbonden operationele workflow"), caption: localeField("Reusable system visual", "Herbruikbare systeemvisual") },
        ],
    };
}

export function buildVideoBlockProps(blockId = "video-block"): VideoBlockProps & { id: string } {
    return {
        id: blockId,
        style: createSectionStyle({ width: "wide", surfaceTone: "dark", accentTone: "primary", emphasis: "strong" }),
        eyebrow: localeField("Media spotlight", "Media spotlight"),
        title: localeField("Explain the system with motion, not just copy.", "Leg het systeem uit met beweging, niet alleen met copy."),
        description: richLocaleField("Use this for launch pages, demos, and visual storytelling sections.", "Gebruik dit voor launch pages, demo's en visuele storytelling."),
        videoUrl: "",
        posterUrl: "/themes/facility-services/hero.jpg",
        primaryCta: { label: localeField("Request a walkthrough", "Vraag een walkthrough aan"), href: "/contact" },
    };
}

export function buildSectorGridProps(blockId = "sector-grid"): SectorGridBlockProps & { id: string } {
    return {
        id: blockId,
        style: createSectionStyle({ width: "wide", cardStyle: "elevated" }),
        eyebrow: localeField("Sector fit", "Sector fit"),
        title: localeField("Tailor pages for the audiences you serve best.", "Maak pagina's op maat voor de doelgroepen die u het beste bedient."),
        description: richLocaleField("Use this for sector pages, solution pages, and commercial segmentation.", "Gebruik dit voor sectorpagina's, solution pages en commerciële segmentatie."),
        items: [
            { id: "sector-1", title: localeField("Horeca & hospitality", "Horeca & hospitality"), description: richLocaleField("Position digital systems that improve guest-facing operations, workflows, and marketing agility.", "Positioneer digitale systemen die gastgerichte operaties, workflows en marketingwendbaarheid verbeteren."), proofPoints: [localeItem("sector-1-point-1", "Workflow automation", "Workflow-automatisering"), localeItem("sector-1-point-2", "Guest-experience support", "Ondersteuning van gastervaring")] },
            { id: "sector-2", title: localeField("Education & training", "Onderwijs & training"), description: richLocaleField("Show how structured content, portals, and AI-assisted delivery support modern learning operations.", "Laat zien hoe gestructureerde content, portals en AI-ondersteunde delivery moderne leeroperaties ondersteunen."), proofPoints: [localeItem("sector-2-point-1", "Content systems", "Contentsystemen"), localeItem("sector-2-point-2", "Operational clarity", "Operationele duidelijkheid")] },
            { id: "sector-3", title: localeField("Legal, media & real estate", "Legal, media & vastgoed"), description: richLocaleField("Connect digital execution to credibility, responsiveness, and client confidence in specialist service sectors.", "Verbind digitale uitvoering met geloofwaardigheid, responsiviteit en klantvertrouwen in specialistische dienstensectoren."), proofPoints: [localeItem("sector-3-point-1", "Professional visibility", "Professionele zichtbaarheid"), localeItem("sector-3-point-2", "Structured client journeys", "Gestructureerde klanttrajecten")] },
        ],
    };
}

export function buildScopeMatrixProps(blockId = "scope-matrix"): ScopeMatrixBlockProps & { id: string } {
    return {
        id: blockId,
        style: createSectionStyle({ surfaceTone: "soft", width: "wide" }),
        eyebrow: localeField("Delivery standards", "Delivery-standaarden"),
        title: localeField("Clarify what gets delivered, how it flows, and where the value sits.", "Maak duidelijk wat wordt geleverd, hoe het proces loopt en waar de waarde zit."),
        description: richLocaleField("Ideal for service pages, offer pages, and proof-led consulting propositions.", "Ideaal voor servicepagina's, aanbodpagina's en bewijsgerichte consultancyproposities."),
        rows: [
            { id: "scope-1", item: localeField("AI workflow mapping", "AI-workflowmapping"), frequency: localeField("Discovery", "Discovery"), result: richLocaleField("Clear automation opportunities", "Duidelijke automatiseringskansen") },
            { id: "scope-2", item: localeField("Platform build sprint", "Platform-build sprint"), frequency: localeField("Implementation", "Implementatie"), result: richLocaleField("Connected digital delivery", "Verbonden digitale delivery") },
            { id: "scope-3", item: localeField("Optimization and reporting", "Optimalisatie en rapportage"), frequency: localeField("Ongoing", "Doorlopend"), result: richLocaleField("Better growth visibility and stakeholder confidence", "Meer groeizichtbaarheid en stakeholdervertrouwen") },
        ],
    };
}

export function buildPackagesProps(blockId = "packages"): PackagesBlockProps & { id: string } {
    return {
        id: blockId,
        style: createSectionStyle({ width: "wide", cardStyle: "glass", accentTone: "primary" }),
        eyebrow: localeField("Service model", "Servicemodel"),
        title: localeField("Show packaged options without losing premium positioning.", "Toon pakketten zonder premium positionering te verliezen."),
        description: richLocaleField("Use this for quote capture, service comparisons, and sales support pages.", "Gebruik dit voor offertepagina's, servicevergelijkingen en sales support."),
        items: [
            { id: "package-1", title: localeField("Basic Workspace", "Basic Workspace"), description: richLocaleField("For teams that need a credible digital foundation with structured pages and core operational clarity.", "Voor teams die een geloofwaardige digitale basis nodig hebben met gestructureerde pagina's en operationele duidelijkheid."), features: [localeItem("package-1-feature-1", "Core website and page structure", "Kernwebsite en paginastructuur"), localeItem("package-1-feature-2", "Foundation for future automation", "Basis voor toekomstige automatisering")], badge: localeField("Foundation", "Foundation") },
            { id: "package-2", title: localeField("Pro Workspace", "Pro Workspace"), description: richLocaleField("For teams that want AI drafting, SEO workflows, asset generation, and a full digital operating system.", "Voor teams die AI-drafting, SEO-workflows, assetgeneratie en een volledig digitaal operating system willen."), features: [localeItem("package-2-feature-1", "AI content and media workflows", "AI-content- en mediaworkflows"), localeItem("package-2-feature-2", "Growth and operational control", "Groei- en operationele controle")], badge: localeField("Recommended", "Aanbevolen") },
        ],
    };
}

export function buildSeoSupportProps(blockId = "seo-support"): SeoSupportBlockProps & { id: string } {
    const defaultDescription =
        "This page is part of a broader operating layer for AI, content, SEO, bookings, media, and governance. The goal is not another isolated tool, but one workspace where business systems reinforce each other.";
    const defaultDescriptionNl =
        "Deze pagina maakt deel uit van een bredere operationele laag voor AI, content, SEO, boekingen, media en governance. Het doel is geen extra losstaande tool, maar één workspace waarin bedrijfssystemen elkaar versterken.";

    return {
        id: blockId,
        style: createSectionStyle({
            surfaceTone: "soft",
            accentTone: "primary",
            width: "contained",
            cardStyle: "outline",
            emphasis: "subtle",
        }),
        eyebrow: localeField("Related context", "Gerelateerde context"),
        title: localeField(
            "How this connects to the rest of the workspace.",
            "Hoe dit aansluit op de rest van de workspace.",
        ),
        description: richLocaleField(
            defaultDescription,
            defaultDescriptionNl,
        ),
        richDescriptionEn: `<p>${defaultDescription}</p>`,
        richDescriptionNl: `<p>${defaultDescriptionNl}</p>`,
        placement: "bottom",
        tone: "muted",
    };
}

export type FacilityServicesStructuredPageData = {
    home: {
        hero: ReturnType<typeof buildHeroProps>;
        stats: ReturnType<typeof buildStatsProps>;
        foundation: ReturnType<typeof buildFoundationProps>;
        about: ReturnType<typeof buildAboutProps>;
        services: ReturnType<typeof buildServicesShowcaseProps>;
        methodology: ReturnType<typeof buildMethodologyProps>;
    };
    services: {
        showcase: ReturnType<typeof buildServicesShowcaseProps>;
        methodology: ReturnType<typeof buildMethodologyProps>;
    };
    about: {
        about: ReturnType<typeof buildAboutProps>;
        commitment: CommitmentBlockProps;
    };
    contact: {
        main: ReturnType<typeof buildContactProps>;
    };
};

export function buildFacilityServicesStructuredPageData(): FacilityServicesStructuredPageData {
    const commitment = getWorkspaceCommitmentCopy();
    return {
        home: {
            hero: buildHeroProps(),
            stats: buildStatsProps(),
            foundation: buildFoundationProps(),
            about: buildAboutProps(),
            services: buildServicesShowcaseProps("home-services-showcase"),
            methodology: buildMethodologyProps("home-methodology"),
        },
        services: {
            showcase: buildServicesShowcaseProps("services-showcase"),
            methodology: buildMethodologyProps("services-methodology"),
        },
        about: {
            about: buildAboutProps(),
            commitment: {
                title: localeField(commitment.en.title, commitment.nl.title),
                description: richLocaleField(commitment.en.description, commitment.nl.description),
                style: createSectionStyle({ width: "wide" }),
            },
        },
        contact: {
            main: buildContactProps(),
        },
    };
}

export type FacilityServicesHomeStructuredData = FacilityServicesStructuredPageData["home"];
export type FacilityServicesServicesStructuredData = FacilityServicesStructuredPageData["services"];
export type FacilityServicesAboutStructuredData = FacilityServicesStructuredPageData["about"];
export type FacilityServicesContactStructuredData = FacilityServicesStructuredPageData["contact"];
