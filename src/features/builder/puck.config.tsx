import type { Config, Data, Fields } from "@puckeditor/core";
import Image from "next/image";
import type { CSSProperties } from "react";
import type { VisualLayoutInput } from "@/features/content-engine/actions";
import { RichTextRenderer } from "@/features/content-engine/ui/rich-text-renderer";
import {
    type CommitmentBlockProps,
    type BuilderPageMetadata,
    buildClientLogosProps,
    buildCtaBannerProps,
    buildAboutProps,
    buildContactProps,
    buildFacilityServicesStructuredPageData,
    buildFeatureListProps,
    buildFoundationProps,
    buildGalleryProps,
    buildHeroProps,
    buildIconCardsProps,
    buildIntroBannerProps,
    buildMethodologyProps,
    buildMetricsProps,
    buildOperationalProofProps,
    buildPackagesProps,
    buildPositioningStripProps,
    buildQuoteRequestProps,
    buildRichTextSectionProps,
    buildSeoSupportProps,
    buildScopeMatrixProps,
    buildSectorGridProps,
    buildServicesShowcaseProps,
    buildStatsProps,
    buildStoryBlockProps,
    buildTestimonialsProps,
    buildTimelineProps,
    buildVideoBlockProps,
    buildBasicProComparisonProps,
    buildEnterpriseSupportProps,
    createSectionStyle,
    defaultSectionStyle,
    getRichTextLocaleValue,
    getLocaleValue,
    isCorePageKind,
    type AboutBlockProps,
    type AccentTone,
    type CardStyle,
    type ClientLogosBlockProps,
    type ContentAlignment,
    type ContactBlockProps,
    type CtaBannerBlockProps,
    type Density,
    type DividerBlockProps,
    type SeoSupportBlockProps,
    type FaqItem,
    type FeatureListBlockProps,
    type FoundationBlockProps,
    type GalleryBlockProps,
    type HeroBlockProps,
    type IconCardsBlockProps,
    type IntroBannerBlockProps,
    type LocaleField,
    type LocaleListItem,
    type RichLocaleField,
    type MetricsBlockProps,
    type MethodologyStep,
    type MethodologyBlockProps,
    type OperationalProofBlockProps,
    type PackagesBlockProps,
    type PageIntent,
    type PageKind,
    type PositioningStripBlockProps,
    type QuoteRequestBlockProps,
    type RichTextSectionBlockProps,
    type ScopeMatrixBlockProps,
    type SectionStyleProps,
    type SectorGridBlockProps,
    type ServiceFeature,
    type ServiceItem,
    type ServicesShowcaseBlockProps,
    type SpacerBlockProps,
    type StatsBlockProps,
    type StatsItem,
    type StoryBlockProps,
    type SupportedLocale,
    type SurfaceTone,
    type TestimonialsBlockProps,
    type TimelineBlockProps,
    type VideoBlockProps,
    type SectionWidth,
    type EmphasisLevel,
    type BasicProComparisonBlockProps,
    type EnterpriseSupportBlockProps,
} from "@/features/builder/facility-services-page-data";
import { buildTemplateCssVariables } from "@/features/templates/design-tokens";
import { isystemAgencyConfig } from "@/features/templates/configs/isystem-agency";
import { InViewReveal } from "@/shared/ui/animations/in-view-reveal";
import { extendedBlocks } from "@/features/builder/extended-blocks";
import { legalVaultBlocks } from "@/features/builder/legal-vault-blocks";
import { resourceBlocks } from "@/features/builder/resource-blocks";
// Constants come from a non-client module so they remain real arrays in
// server contexts. The component map above stays in the client module.
import { EXTENDED_BLOCK_TYPES } from "@/features/builder/extended-blocks-meta";
import { LEGAL_VAULT_BLOCK_TYPES } from "@/features/builder/legal-vault-blocks-meta";
import { RESOURCE_BLOCK_TYPES } from "@/features/builder/resource-blocks-meta";
import { resolveBuilderVideoSource } from "@/features/builder/builder-media";
import { sectorLandingBlocks } from "@/features/builder/sector-landing-blocks";
import { SECTOR_LANDING_BLOCK_TYPES } from "@/features/builder/sector-landing-blocks-meta";
import { publicPuckComponents, PUBLIC_PUCK_BLOCK_TYPES, type PublicSemanticBlockProps } from "@/features/builder/public-puck-blocks";

type PuckProps<T> = T & { id: string };

const editorPreviewCssVars = buildTemplateCssVariables(isystemAgencyConfig) as CSSProperties;

function resolveBuilderContentIdFromLocation() {
    if (typeof window === "undefined") {
        return null;
    }

    const match = window.location.pathname.match(/\/dashboard\/builder\/([^/]+)/);
    return match?.[1] ?? null;
}

async function uploadBuilderMediaAsset(file: File) {
    const contentId = resolveBuilderContentIdFromLocation();

    if (!contentId) {
        throw new Error("Unable to resolve builder content id for media upload.");
    }

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`/api/content/${contentId}/assets/upload`, {
        method: "POST",
        body: formData,
    });

    const payload = await response.json();

    if (!response.ok || !payload.asset?.url) {
        throw new Error(payload.error || "Failed to upload media asset.");
    }

    return {
        url: payload.asset.url as string,
        name: (payload.asset.name || file.name) as string,
        contentType: (payload.asset.contentType || file.type) as string,
    };
}

const mediaField = (label: string, accept: string, placeholder: string) => ({
    type: "custom" as const,
    label,
    render: ({ id, name, value, onChange, readOnly }: { id: string; name: string; value: string; onChange: (value: string) => void; readOnly?: boolean }) => (
        <div className="space-y-2">
            <input
                id={id}
                name={name}
                type="text"
                value={value ?? ""}
                placeholder={placeholder}
                readOnly={readOnly}
                onChange={(event) => onChange(event.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
            <label className={`inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition ${readOnly ? "cursor-not-allowed opacity-60" : "hover:bg-accent"}`}>
                <input
                    type="file"
                    accept={accept}
                    disabled={readOnly}
                    className="hidden"
                    onChange={async (event) => {
                        const file = event.currentTarget.files?.[0];
                        event.currentTarget.value = "";

                        if (!file) {
                            return;
                        }

                        try {
                            const asset = await uploadBuilderMediaAsset(file);
                            onChange(asset.url);
                        } catch (error) {
                            const message = error instanceof Error ? error.message : "Failed to upload media asset.";
                            if (typeof window !== "undefined") {
                                window.alert(message);
                            }
                        }
                    }}
                />
                <span>Upload file</span>
            </label>
        </div>
    ),
});

export type PuckComponents = {
    HeroBlock: PuckProps<HeroBlockProps>;
    PositioningStripBlock: PuckProps<PositioningStripBlockProps>;
    IntroBannerBlock: PuckProps<IntroBannerBlockProps>;
    RichTextSectionBlock: PuckProps<RichTextSectionBlockProps>;
    FeatureListBlock: PuckProps<FeatureListBlockProps>;
    IconCardsBlock: PuckProps<IconCardsBlockProps>;
    StatsBlock: PuckProps<StatsBlockProps>;
    MetricsBlock: PuckProps<MetricsBlockProps>;
    OperationalProofBlock: PuckProps<OperationalProofBlockProps>;
    FoundationBlock: PuckProps<FoundationBlockProps>;
    AboutBlock: PuckProps<AboutBlockProps>;
    StoryBlock: PuckProps<StoryBlockProps>;
    CommitmentBlock: PuckProps<CommitmentBlockProps>;
    ServicesShowcaseBlock: PuckProps<ServicesShowcaseBlockProps>;
    MethodologyBlock: PuckProps<MethodologyBlockProps>;
    BasicProComparisonBlock: PuckProps<BasicProComparisonBlockProps>;
    TimelineBlock: PuckProps<TimelineBlockProps>;
    TestimonialsBlock: PuckProps<TestimonialsBlockProps>;
    ClientLogosBlock: PuckProps<ClientLogosBlockProps>;
    EnterpriseSupportBlock: PuckProps<EnterpriseSupportBlockProps>;
    CtaBannerBlock: PuckProps<CtaBannerBlockProps>;
    QuoteRequestBlock: PuckProps<QuoteRequestBlockProps>;
    GalleryBlock: PuckProps<GalleryBlockProps>;
    VideoBlock: PuckProps<VideoBlockProps>;
    SectorGridBlock: PuckProps<SectorGridBlockProps>;
    ScopeMatrixBlock: PuckProps<ScopeMatrixBlockProps>;
    PackagesBlock: PuckProps<PackagesBlockProps>;
    SpacerBlock: PuckProps<SpacerBlockProps>;
    DividerBlock: PuckProps<DividerBlockProps>;
    SeoSupportBlock: PuckProps<SeoSupportBlockProps>;
    ContactBlock: PuckProps<ContactBlockProps>;
    // Extended layout blocks. Their props live in extended-blocks.tsx but
    // their type identities are merged in here so they participate in
    // PublicBuilderData and the saved JSON shape on disk.
    InsightsGridBlock: import("@/features/builder/extended-blocks").ExtendedComponents["InsightsGridBlock"];
    BentoFeatureBlock: import("@/features/builder/extended-blocks").ExtendedComponents["BentoFeatureBlock"];
    PullQuoteBlock: import("@/features/builder/extended-blocks").ExtendedComponents["PullQuoteBlock"];
    FaqAccordionBlock: import("@/features/builder/extended-blocks").ExtendedComponents["FaqAccordionBlock"];
    PricingTiersBlock: import("@/features/builder/extended-blocks").ExtendedComponents["PricingTiersBlock"];
    TeamGridBlock: import("@/features/builder/extended-blocks").ExtendedComponents["TeamGridBlock"];
    CtaSplitBlock: import("@/features/builder/extended-blocks").ExtendedComponents["CtaSplitBlock"];
    ToolsHighlightBlock: import("@/features/builder/extended-blocks").ExtendedComponents["ToolsHighlightBlock"];
    WorkspaceProofLedgerBlock: import("@/features/builder/extended-blocks").ExtendedComponents["WorkspaceProofLedgerBlock"];
    LegibilityHubQueryBlock: import("@/features/builder/extended-blocks").ExtendedComponents["LegibilityHubQueryBlock"];
    PopupConversionLayerBlock: import("@/features/builder/extended-blocks").ExtendedComponents["PopupConversionLayerBlock"];
    NewsletterLifecycleBlock: import("@/features/builder/extended-blocks").ExtendedComponents["NewsletterLifecycleBlock"];
    BookingLifecycleReportBlock: import("@/features/builder/extended-blocks").ExtendedComponents["BookingLifecycleReportBlock"];
    FeatureStatusMatrixBlock: import("@/features/builder/extended-blocks").ExtendedComponents["FeatureStatusMatrixBlock"];
    DemoEvidenceGridBlock: import("@/features/builder/extended-blocks").ExtendedComponents["DemoEvidenceGridBlock"];
    // Sector-landing blocks. Same lazy-import trick — props live in
    // sector-landing-blocks.tsx but their type identities flow into
    // PublicBuilderData so saved JSON is type-safe.
    SectorHeroBlock: import("@/features/builder/sector-landing-blocks").SectorLandingComponents["SectorHeroBlock"];
    SectorRunSectionBlock: import("@/features/builder/sector-landing-blocks").SectorLandingComponents["SectorRunSectionBlock"];
    SectorHonestProofBlock: import("@/features/builder/sector-landing-blocks").SectorLandingComponents["SectorHonestProofBlock"];
    SectorReplaceBlock: import("@/features/builder/sector-landing-blocks").SectorLandingComponents["SectorReplaceBlock"];
    SectorPricingNoteBlock: import("@/features/builder/sector-landing-blocks").SectorLandingComponents["SectorPricingNoteBlock"];
    SectorNotForBlock: import("@/features/builder/sector-landing-blocks").SectorLandingComponents["SectorNotForBlock"];
    SectorCtaPillBlock: import("@/features/builder/sector-landing-blocks").SectorLandingComponents["SectorCtaPillBlock"];
    BasicProSplitHeroBlock: import("@/features/builder/sector-landing-blocks").SectorLandingComponents["BasicProSplitHeroBlock"];
    BasicProMatrixBlock: import("@/features/builder/sector-landing-blocks").SectorLandingComponents["BasicProMatrixBlock"];
    ToolReplacementListBlock: import("@/features/builder/sector-landing-blocks").SectorLandingComponents["ToolReplacementListBlock"];
    EngagementShapeListBlock: import("@/features/builder/sector-landing-blocks").SectorLandingComponents["EngagementShapeListBlock"];
    NumberedFindingsBlock: import("@/features/builder/sector-landing-blocks").SectorLandingComponents["NumberedFindingsBlock"];
    CalloutCardBlock: import("@/features/builder/sector-landing-blocks").SectorLandingComponents["CalloutCardBlock"];
    ChangelogTimelineBlock: import("@/features/builder/sector-landing-blocks").SectorLandingComponents["ChangelogTimelineBlock"];
    // Legal Vault marketing blocks — see legal-vault-blocks.tsx.
    LegalVaultOverviewBlock: import("@/features/builder/legal-vault-blocks").LegalVaultComponents["LegalVaultOverviewBlock"];
    LegalComplianceBadgesBlock: import("@/features/builder/legal-vault-blocks").LegalVaultComponents["LegalComplianceBadgesBlock"];
    NlZzpAgreementCtaBlock: import("@/features/builder/legal-vault-blocks").LegalVaultComponents["NlZzpAgreementCtaBlock"];
    LegalWorkflowTimelineBlock: import("@/features/builder/legal-vault-blocks").LegalVaultComponents["LegalWorkflowTimelineBlock"];
    // Resource / PDF assets marketing blocks
    ResourceHeroBlock: import("@/features/builder/resource-blocks").ResourceComponents["ResourceHeroBlock"];
    ResourceCardGridBlock: import("@/features/builder/resource-blocks").ResourceComponents["ResourceCardGridBlock"];
    PdfDownloadPanelBlock: import("@/features/builder/resource-blocks").ResourceComponents["PdfDownloadPanelBlock"];
    ResourceUseCasesBlock: import("@/features/builder/resource-blocks").ResourceComponents["ResourceUseCasesBlock"];
    ResourceVisualPreviewBlock: import("@/features/builder/resource-blocks").ResourceComponents["ResourceVisualPreviewBlock"];
    OutcomeHero: PuckProps<PublicSemanticBlockProps>;
    ProblemRecognition: PuckProps<PublicSemanticBlockProps>;
    SystemMap: PuckProps<PublicSemanticBlockProps>;
    OperatingLoop: PuckProps<PublicSemanticBlockProps>;
    ServiceArchitecture: PuckProps<PublicSemanticBlockProps>;
    OfferComparison: PuckProps<PublicSemanticBlockProps>;
    ScopeBoundary: PuckProps<PublicSemanticBlockProps>;
    MethodTimeline: PuckProps<PublicSemanticBlockProps>;
    FounderWorkingModel: PuckProps<PublicSemanticBlockProps>;
    FitAndNonFit: PuckProps<PublicSemanticBlockProps>;
    QuestionAccordion: PuckProps<PublicSemanticBlockProps>;
    FeatureStatusMatrix: PuckProps<PublicSemanticBlockProps>;
    FinalDecisionCta: PuckProps<PublicSemanticBlockProps>;
    ContactExperience: PuckProps<PublicSemanticBlockProps>;
    ProductEvidenceWindow: PuckProps<PublicSemanticBlockProps>;
    AnnotatedWorkspaceView: PuckProps<PublicSemanticBlockProps>;
    WorkflowEvidence: PuckProps<PublicSemanticBlockProps>;
    ProofLedger: PuckProps<PublicSemanticBlockProps>;
    OutcomeCaseStudy: PuckProps<PublicSemanticBlockProps>;
    MetricWithMethod: PuckProps<PublicSemanticBlockProps>;
    TrustControlGrid: PuckProps<PublicSemanticBlockProps>;
    SourceMethodology: PuckProps<PublicSemanticBlockProps>;
    DeliveryChangelog: PuckProps<PublicSemanticBlockProps>;
    DemoEvidenceGrid: PuckProps<PublicSemanticBlockProps>;
};

type RootProps = {
    schemaVersion?: 2;
    title?: string;
    locale?: SupportedLocale;
    pageKind?: PageKind;
    pageIntent?: PageIntent;
    presetId?: string;
    themeVariant?: "default" | "editorial" | "proof" | "transactional";
    chromeMode?: "default" | "minimal" | "hidden";
    metadata?: BuilderPageMetadata;
};

export type PublicBuilderData = Data<PuckComponents, RootProps>;

type RootMetadata = RootProps & {
    pageKind?: PageKind;
};


type PuckRenderProps<T> = T & {
    puck?: {
        metadata?: RootMetadata;
    };
};

const bilingualTextField = (label: string) => ({
    type: "object" as const,
    label,
    objectFields: {
        en: { type: "text" as const, label: "English" },
        nl: { type: "text" as const, label: "Dutch" },
        ar: { type: "text" as const, label: "Arabic (العربية)" },
    },
});

const bilingualTextareaField = (label: string) => ({
    type: "object" as const,
    label,
    objectFields: {
        en: { type: "textarea" as const, label: "English" },
        nl: { type: "textarea" as const, label: "Dutch" },
        ar: { type: "textarea" as const, label: "Arabic (العربية)" },
    },
});

const bilingualNarrativeField = (label: string) => ({
    type: "object" as const,
    label,
    objectFields: {
        en: { type: "textarea" as const, label: "English fallback" },
        nl: { type: "textarea" as const, label: "Dutch fallback" },
        ar: { type: "textarea" as const, label: "Arabic fallback (العربية)" },
        richEn: { type: "richtext" as const, label: "Rich text (English)" },
        richNl: { type: "richtext" as const, label: "Rich text (Dutch)" },
        richAr: { type: "richtext" as const, label: "Rich text (Arabic)" },
    },
});

const linkField = (label: string) => ({
    type: "object" as const,
    label,
    objectFields: {
        label: bilingualTextField("Label"),
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
            options: ["light", "soft", "dark", "brand", "premium"].map((value) => ({ label: value, value })),
        },
        accentTone: {
            type: "select" as const,
            label: "Accent tone",
            options: ["primary", "emerald", "amber", "rose", "slate"].map((value) => ({ label: value, value })),
        },
        width: {
            type: "select" as const,
            label: "Width",
            options: ["contained", "wide", "full"].map((value) => ({ label: value, value })),
        },
        alignment: {
            type: "radio" as const,
            label: "Alignment",
            options: ["left", "center"].map((value) => ({ label: value, value })),
        },
        density: {
            type: "select" as const,
            label: "Spacing density",
            options: ["compact", "comfortable", "spacious"].map((value) => ({ label: value, value })),
        },
        cardStyle: {
            type: "select" as const,
            label: "Card style",
            options: ["flat", "outline", "elevated", "glass"].map((value) => ({ label: value, value })),
        },
        emphasis: {
            type: "select" as const,
            label: "Visual emphasis",
            options: ["subtle", "medium", "strong"].map((value) => ({ label: value, value })),
        },
        showEyebrow: { type: "radio" as const, label: "Show eyebrow", options: [{ label: "Yes", value: true }, { label: "No", value: false }] },
    },
};

const bilingualListField = (label: string) => ({
    type: "array" as const,
    label,
    getItemSummary: (item?: Partial<LocaleListItem>) => item?.en ?? item?.nl ?? item?.ar ?? item?.id ?? "Item",
    arrayFields: {
        id: { type: "text" as const, label: "ID" },
        en: { type: "text" as const, label: "English" },
        nl: { type: "text" as const, label: "Dutch" },
        ar: { type: "text" as const, label: "Arabic (العربية)" },
    },
});

const bilingualFaqField = {
    type: "array" as const,
    label: "FAQ items",
    getItemSummary: (item?: Partial<FaqItem>) => item?.question?.en ?? item?.question?.nl ?? item?.id ?? "FAQ",
    arrayFields: {
        id: { type: "text" as const, label: "ID" },
        question: bilingualTextField("Question"),
        answer: bilingualNarrativeField("Answer"),
    },
};

const statsItemsField = {
    type: "array" as const,
    label: "Stats",
    getItemSummary: (item?: Partial<StatsItem>) => item?.label?.en ?? item?.label?.nl ?? item?.value ?? item?.id ?? "Stat",
    arrayFields: {
        id: { type: "text" as const, label: "ID" },
        value: { type: "text" as const, label: "Value" },
        label: bilingualTextField("Label"),
    },
};

const serviceItemField = {
    type: "array" as const,
    label: "Service items",
    getItemSummary: (item?: Partial<ServiceItem>) => item?.title?.en ?? item?.title?.nl ?? item?.id ?? "Service",
    arrayFields: {
        id: { type: "text" as const, label: "ID" },
        orderLabel: { type: "text" as const, label: "Order label" },
        title: bilingualTextField("Title"),
        description: bilingualNarrativeField("Description"),
        image: mediaField("Image path", "image/*", "/stealth-cto-hero.png"),
        alt: bilingualTextField("Image alt"),
        features: {
            type: "array" as const,
            label: "Features",
            getItemSummary: (item?: Partial<ServiceFeature>) => item?.en ?? item?.nl ?? item?.id ?? "Feature",
            arrayFields: {
                id: { type: "text" as const, label: "ID" },
                en: { type: "text" as const, label: "English" },
                nl: { type: "text" as const, label: "Dutch" },
            },
        },
    },
};

const methodologyStepsField = {
    type: "array" as const,
    label: "Methodology steps",
    getItemSummary: (item?: Partial<MethodologyStep>) => item?.title?.en ?? item?.title?.nl ?? item?.stepNumber ?? item?.id ?? "Step",
    arrayFields: {
        id: { type: "text" as const, label: "ID" },
        stepNumber: { type: "text" as const, label: "Step number" },
        title: bilingualTextField("Title"),
        description: bilingualNarrativeField("Description"),
    },
};

function getLocale(metadata?: RootMetadata): SupportedLocale {
    if (metadata?.locale === "nl") return "nl";
    if (metadata?.locale === "ar") return "ar";
    return "en";
}

function translate(locale: SupportedLocale, field: LocaleField) {
    return getLocaleValue(locale, field);
}

function translateRich(locale: SupportedLocale, english?: string, dutch?: string, fallback?: LocaleField, arabic?: string) {
    const rich = locale === "ar"
        ? (arabic ?? english ?? dutch)
        : locale === "nl"
            ? (dutch ?? english)
            : (english ?? dutch);

    if (typeof rich === "string" && rich.length > 0) {
        return rich;
    }

    return fallback ? translate(locale, fallback) : "";
}

function translateNarrative(locale: SupportedLocale, field?: LocaleField | RichLocaleField) {
    if (!field) {
        return "";
    }

    return getRichTextLocaleValue(locale, field);
}

function cloneData<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

const imageField = (label: string) => mediaField(label, "image/*", "/stealth-cto-hero.png");

const videoField = (label: string) => mediaField(label, "video/*", "");

const heroBlockFields = {
    id: { type: "text" as const, label: "Block ID" },
    eyebrow: bilingualTextareaField("Eyebrow"),
    titleLineOne: bilingualTextField("Title line one"),
    titleLineTwo: bilingualTextField("Title line two"),
    subtitle: bilingualNarrativeField("Subtitle"),
    primaryCta: bilingualTextField("Primary CTA label"),
    primaryHref: { type: "text" as const, label: "Primary CTA href" },
    secondaryCta: bilingualTextField("Secondary CTA label"),
    secondaryHref: { type: "text" as const, label: "Secondary CTA href" },
    backgroundVideo: videoField("Background video path"),
    trustBadges: bilingualListField("Trust badges"),
} satisfies Fields<PuckProps<HeroBlockProps>>;

const statsBlockFields = {
    id: { type: "text" as const, label: "Block ID" },
    items: statsItemsField,
} satisfies Fields<PuckProps<StatsBlockProps>>;

const positioningStripBlockFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: bilingualTextField("Eyebrow"),
    title: bilingualTextareaField("Title"),
    description: bilingualNarrativeField("Description"),
    items: {
        type: "array" as const,
        label: "Positioning statements",
        getItemSummary: (item?: { title?: LocaleField; id?: string }) => item?.title?.en ?? item?.title?.nl ?? item?.id ?? "Statement",
        arrayFields: {
            id: { type: "text" as const, label: "ID" },
            title: bilingualTextField("Title"),
            detail: bilingualNarrativeField("Detail"),
        },
    },
} satisfies Fields<PuckProps<PositioningStripBlockProps>>;

const foundationBlockFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    title: bilingualTextField("Title"),
    description: bilingualNarrativeField("Description"),
    supportLine: bilingualNarrativeField("Support line"),
} satisfies Fields<PuckProps<FoundationBlockProps>>;

const aboutBlockFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: bilingualTextField("Eyebrow"),
    headline: bilingualNarrativeField("Headline"),
    description: bilingualNarrativeField("Description"),
    missionTitle: bilingualTextField("Mission title"),
    missionText: bilingualNarrativeField("Mission text"),
    visionTitle: bilingualTextField("Vision title"),
    visionText: bilingualNarrativeField("Vision text"),
    whyTitle: bilingualTextField("Why title"),
    image: imageField("Image path"),
    imageAlt: bilingualTextField("Image alt"),
    whyPoints: bilingualListField("Why points"),
} satisfies Fields<PuckProps<AboutBlockProps>>;

const servicesBlockFields = {
    id: { type: "text" as const, label: "Block ID" },
    title: bilingualTextField("Title"),
    subtitle: bilingualNarrativeField("Subtitle"),
    description: bilingualNarrativeField("Description"),
    items: serviceItemField,
    primaryCta: bilingualTextField("Primary CTA label"),
    primaryHref: { type: "text" as const, label: "Primary CTA href" },
} satisfies Fields<PuckProps<ServicesShowcaseBlockProps>>;

const commitmentBlockFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    title: bilingualTextField("Title"),
    description: bilingualNarrativeField("Description"),
} satisfies Fields<PuckProps<CommitmentBlockProps>>;

const methodologyBlockFields = {
    id: { type: "text" as const, label: "Block ID" },
    title: bilingualTextField("Title"),
    subtitle: bilingualNarrativeField("Subtitle"),
    steps: methodologyStepsField,
} satisfies Fields<PuckProps<MethodologyBlockProps>>;

const contactBlockFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: bilingualTextField("Eyebrow"),
    title: bilingualTextField("Title"),
    description: bilingualNarrativeField("Description"),
    heroImage: imageField("Hero image path"),
    heroImageAlt: bilingualTextField("Hero image alt"),
    email: { type: "text" as const, label: "Email" },
    phone: { type: "text" as const, label: "Phone" },
    address: bilingualTextareaField("Address"),
    kvk: { type: "text" as const, label: "KvK" },
    supportHours: bilingualTextField("Support hours"),
    trustTitle: bilingualTextField("Trust section title"),
    trustItems: bilingualListField("Trust items"),
    formTitle: bilingualTextField("Form title"),
    formSubtitle: bilingualNarrativeField("Form subtitle"),
    fieldName: bilingualTextField("Field: name"),
    fieldCompany: bilingualTextField("Field: company"),
    fieldEmail: bilingualTextField("Field: email"),
    fieldPhone: bilingualTextField("Field: phone"),
    fieldFacilitySize: bilingualTextField("Field: project scope"),
    fieldFacilitySizeOptions: bilingualListField("Project scope options"),
    fieldNeeds: bilingualTextField("Field: needs"),
    formNeedsPlaceholder: bilingualTextareaField("Needs placeholder"),
    submitLabel: bilingualTextField("Submit label"),
    submitPendingLabel: bilingualTextField("Submitting label"),
    facilitySizePlaceholder: bilingualTextField("Project scope placeholder"),
    successMessage: bilingualNarrativeField("Success message"),
    faqTitle: bilingualTextField("FAQ title"),
    faqItems: bilingualFaqField,
    previewNotice: bilingualNarrativeField("Preview notice"),
} satisfies Fields<PuckProps<ContactBlockProps>>;

const introBannerBlockFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: bilingualTextField("Eyebrow"),
    title: bilingualTextareaField("Title"),
    body: bilingualTextareaField("Body"),
    richBodyEn: { type: "richtext" as const, label: "Rich body (English)" },
    richBodyNl: { type: "richtext" as const, label: "Rich body (Dutch)" },
    richBodyAr: { type: "richtext" as const, label: "Rich body (Arabic)" },
    cta: linkField("CTA"),
} satisfies Fields<PuckProps<IntroBannerBlockProps>>;

const richTextBlockFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: bilingualTextField("Eyebrow"),
    title: bilingualTextareaField("Title"),
    body: bilingualTextareaField("Body"),
    richBodyEn: { type: "richtext" as const, label: "Rich body (English)" },
    richBodyNl: { type: "richtext" as const, label: "Rich body (Dutch)" },
    richBodyAr: { type: "richtext" as const, label: "Rich body (Arabic)" },
    supportingPoints: bilingualListField("Supporting points"),
    cta: linkField("Optional CTA"),
} satisfies Fields<PuckProps<RichTextSectionBlockProps>>;

const featureListBlockFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: bilingualTextField("Eyebrow"),
    title: bilingualTextareaField("Title"),
    description: bilingualNarrativeField("Description"),
    items: bilingualListField("Feature items"),
} satisfies Fields<PuckProps<FeatureListBlockProps>>;

const iconCardsBlockFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: bilingualTextField("Eyebrow"),
    title: bilingualTextareaField("Title"),
    description: bilingualNarrativeField("Description"),
    items: {
        type: "array" as const,
        label: "Cards",
        getItemSummary: (item?: { title?: LocaleField; id?: string }) => item?.title?.en ?? item?.title?.nl ?? item?.id ?? "Card",
        arrayFields: {
            id: { type: "text" as const, label: "ID" },
            icon: { type: "text" as const, label: "Icon name" },
            title: bilingualTextField("Title"),
            description: bilingualNarrativeField("Description"),
        },
    },
} satisfies Fields<PuckProps<IconCardsBlockProps>>;

const metricsBlockFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: bilingualTextField("Eyebrow"),
    title: bilingualTextareaField("Title"),
    description: bilingualNarrativeField("Description"),
    items: {
        type: "array" as const,
        label: "Metrics",
        getItemSummary: (item?: { label?: LocaleField; id?: string; value?: string }) => item?.label?.en ?? item?.label?.nl ?? item?.value ?? item?.id ?? "Metric",
        arrayFields: {
            id: { type: "text" as const, label: "ID" },
            value: { type: "text" as const, label: "Value" },
            label: bilingualTextField("Label"),
            supportingText: bilingualNarrativeField("Supporting text"),
        },
    },
} satisfies Fields<PuckProps<MetricsBlockProps>>;

const operationalProofBlockFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: bilingualTextField("Eyebrow"),
    title: bilingualTextareaField("Title"),
    description: bilingualNarrativeField("Description"),
    items: {
        type: "array" as const,
        label: "Proof items",
        getItemSummary: (item?: { title?: LocaleField; id?: string }) => item?.title?.en ?? item?.title?.nl ?? item?.id ?? "Proof item",
        arrayFields: {
            id: { type: "text" as const, label: "ID" },
            title: bilingualTextField("Title"),
            description: bilingualNarrativeField("Description"),
            proof: bilingualTextField("Proof label"),
        },
    },
} satisfies Fields<PuckProps<OperationalProofBlockProps>>;

const storyBlockFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: bilingualTextField("Eyebrow"),
    title: bilingualTextareaField("Title"),
    body: bilingualTextareaField("Body"),
    richBodyEn: { type: "richtext" as const, label: "Rich body (English)" },
    richBodyNl: { type: "richtext" as const, label: "Rich body (Dutch)" },
    richBodyAr: { type: "richtext" as const, label: "Rich body (Arabic)" },
    image: imageField("Image path"),
    imageAlt: bilingualTextField("Image alt"),
    mediaPosition: {
        type: "radio" as const,
        label: "Media position",
        options: [{ label: "Left", value: "left" }, { label: "Right", value: "right" }],
    },
} satisfies Fields<PuckProps<StoryBlockProps>>;

const timelineBlockFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: bilingualTextField("Eyebrow"),
    title: bilingualTextareaField("Title"),
    description: bilingualNarrativeField("Description"),
    items: {
        type: "array" as const,
        label: "Timeline items",
        getItemSummary: (item?: { title?: LocaleField; id?: string; step?: string }) => item?.title?.en ?? item?.title?.nl ?? item?.step ?? item?.id ?? "Timeline item",
        arrayFields: {
            id: { type: "text" as const, label: "ID" },
            step: { type: "text" as const, label: "Step" },
            title: bilingualTextField("Title"),
            description: bilingualNarrativeField("Description"),
        },
    },
} satisfies Fields<PuckProps<TimelineBlockProps>>;

const basicProComparisonBlockFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: bilingualTextField("Eyebrow"),
    title: bilingualTextareaField("Title"),
    description: bilingualNarrativeField("Description"),
    basicTitle: bilingualTextField("Basic title"),
    basicSubtitle: bilingualNarrativeField("Basic subtitle"),
    proTitle: bilingualTextField("Pro title"),
    proSubtitle: bilingualNarrativeField("Pro subtitle"),
    comparisonRows: {
        type: "array" as const,
        label: "Comparison rows",
        getItemSummary: (item?: { label?: LocaleField; id?: string }) => item?.label?.en ?? item?.label?.nl ?? item?.id ?? "Row",
        arrayFields: {
            id: { type: "text" as const, label: "ID" },
            label: bilingualTextField("Feature label"),
            basic: bilingualTextField("Basic value"),
            pro: bilingualTextField("Pro value"),
        },
    },
} satisfies Fields<PuckProps<BasicProComparisonBlockProps>>;

const testimonialsBlockFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: bilingualTextField("Eyebrow"),
    title: bilingualTextareaField("Title"),
    description: bilingualNarrativeField("Description"),
    items: {
        type: "array" as const,
        label: "Testimonials",
        getItemSummary: (item?: { name?: string; company?: string; id?: string }) => item?.name ?? item?.company ?? item?.id ?? "Testimonial",
        arrayFields: {
            id: { type: "text" as const, label: "ID" },
            quote: bilingualNarrativeField("Quote"),
            name: { type: "text" as const, label: "Name" },
            role: bilingualTextField("Role"),
            company: { type: "text" as const, label: "Company" },
        },
    },
} satisfies Fields<PuckProps<TestimonialsBlockProps>>;

const clientLogosBlockFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: bilingualTextField("Eyebrow"),
    title: bilingualTextareaField("Title"),
    description: bilingualNarrativeField("Description"),
    items: {
        type: "array" as const,
        label: "Logos",
        getItemSummary: (item?: { name?: string; id?: string }) => item?.name ?? item?.id ?? "Logo",
        arrayFields: {
            id: { type: "text" as const, label: "ID" },
            name: { type: "text" as const, label: "Name" },
            image: imageField("Logo path"),
        },
    },
} satisfies Fields<PuckProps<ClientLogosBlockProps>>;

const enterpriseSupportBlockFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: bilingualTextField("Eyebrow"),
    title: bilingualTextareaField("Title"),
    description: bilingualNarrativeField("Description"),
    items: {
        type: "array" as const,
        label: "Enterprise engagement items",
        getItemSummary: (item?: { title?: LocaleField; id?: string }) => item?.title?.en ?? item?.title?.nl ?? item?.id ?? "Engagement item",
        arrayFields: {
            id: { type: "text" as const, label: "ID" },
            title: bilingualTextField("Title"),
            description: bilingualNarrativeField("Description"),
            supportPoints: bilingualListField("Support points"),
        },
    },
    cta: linkField("CTA"),
} satisfies Fields<PuckProps<EnterpriseSupportBlockProps>>;

const ctaBannerBlockFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: bilingualTextField("Eyebrow"),
    title: bilingualTextareaField("Title"),
    description: bilingualNarrativeField("Description"),
    primaryCta: linkField("Primary CTA"),
    secondaryCta: linkField("Secondary CTA"),
    ctaLayout: {
        type: "radio" as const,
        label: "CTA layout",
        options: [{ label: "Inline", value: "inline" }, { label: "Stacked", value: "stacked" }],
    },
} satisfies Fields<PuckProps<CtaBannerBlockProps>>;

const quoteRequestBlockFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: bilingualTextField("Eyebrow"),
    title: bilingualTextareaField("Title"),
    description: bilingualNarrativeField("Description"),
    richDescriptionEn: { type: "richtext" as const, label: "Rich description (English)" },
    richDescriptionNl: { type: "richtext" as const, label: "Rich description (Dutch)" },
    richDescriptionAr: { type: "richtext" as const, label: "Rich description (Arabic)" },
    offerItems: bilingualListField("Offer items"),
    primaryCta: linkField("Primary CTA"),
} satisfies Fields<PuckProps<QuoteRequestBlockProps>>;

const galleryBlockFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: bilingualTextField("Eyebrow"),
    title: bilingualTextareaField("Title"),
    description: bilingualNarrativeField("Description"),
    items: {
        type: "array" as const,
        label: "Gallery items",
        getItemSummary: (item?: { caption?: LocaleField; id?: string }) => item?.caption?.en ?? item?.caption?.nl ?? item?.id ?? "Gallery image",
        arrayFields: {
            id: { type: "text" as const, label: "ID" },
            image: imageField("Image path"),
            alt: bilingualTextField("Alt text"),
            caption: bilingualTextField("Caption"),
        },
    },
} satisfies Fields<PuckProps<GalleryBlockProps>>;

const videoBlockFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: bilingualTextField("Eyebrow"),
    title: bilingualTextareaField("Title"),
    description: bilingualNarrativeField("Description"),
    videoUrl: videoField("Video URL"),
    posterUrl: imageField("Poster image"),
    primaryCta: linkField("Primary CTA"),
} satisfies Fields<PuckProps<VideoBlockProps>>;

const sectorGridBlockFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: bilingualTextField("Eyebrow"),
    title: bilingualTextareaField("Title"),
    description: bilingualNarrativeField("Description"),
    items: {
        type: "array" as const,
        label: "Sectors",
        getItemSummary: (item?: { title?: LocaleField; id?: string }) => item?.title?.en ?? item?.title?.nl ?? item?.id ?? "Sector",
        arrayFields: {
            id: { type: "text" as const, label: "ID" },
            title: bilingualTextField("Title"),
            description: bilingualNarrativeField("Description"),
            proofPoints: bilingualListField("Proof points"),
        },
    },
} satisfies Fields<PuckProps<SectorGridBlockProps>>;

const scopeMatrixBlockFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: bilingualTextField("Eyebrow"),
    title: bilingualTextareaField("Title"),
    description: bilingualNarrativeField("Description"),
    rows: {
        type: "array" as const,
        label: "Rows",
        getItemSummary: (item?: { item?: LocaleField; id?: string }) => item?.item?.en ?? item?.item?.nl ?? item?.id ?? "Row",
        arrayFields: {
            id: { type: "text" as const, label: "ID" },
            item: bilingualTextField("Item"),
            frequency: bilingualTextField("Frequency"),
            result: bilingualNarrativeField("Result"),
        },
    },
} satisfies Fields<PuckProps<ScopeMatrixBlockProps>>;

const packagesBlockFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: bilingualTextField("Eyebrow"),
    title: bilingualTextareaField("Title"),
    description: bilingualNarrativeField("Description"),
    items: {
        type: "array" as const,
        label: "Packages",
        getItemSummary: (item?: { title?: LocaleField; id?: string }) => item?.title?.en ?? item?.title?.nl ?? item?.id ?? "Package",
        arrayFields: {
            id: { type: "text" as const, label: "ID" },
            title: bilingualTextField("Title"),
            description: bilingualNarrativeField("Description"),
            features: bilingualListField("Features"),
            badge: bilingualTextField("Badge"),
        },
    },
} satisfies Fields<PuckProps<PackagesBlockProps>>;

const spacerBlockFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    height: {
        type: "radio" as const,
        label: "Height",
        options: ["sm", "md", "lg", "xl"].map((value) => ({ label: value.toUpperCase(), value })),
    },
} satisfies Fields<PuckProps<SpacerBlockProps>>;

const dividerBlockFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    label: bilingualTextField("Label"),
} satisfies Fields<PuckProps<DividerBlockProps>>;

const seoSupportBlockFields = {
    id: { type: "text" as const, label: "Block ID" },
    style: styleField,
    eyebrow: bilingualTextField("Eyebrow"),
    title: bilingualTextareaField("Title"),
    description: bilingualNarrativeField("Description"),
    richDescriptionEn: { type: "richtext" as const, label: "Rich description (English)" },
    richDescriptionNl: { type: "richtext" as const, label: "Rich description (Dutch)" },
    richDescriptionAr: { type: "richtext" as const, label: "Rich description (Arabic)" },
    placement: {
        type: "radio" as const,
        label: "Placement",
        options: [
            { label: "Top", value: "top" },
            { label: "Middle", value: "middle" },
            { label: "Bottom", value: "bottom" },
        ],
    },
    tone: {
        type: "radio" as const,
        label: "Tone",
        options: [
            { label: "Muted", value: "muted" },
            { label: "Prominent", value: "prominent" },
        ],
    },
} satisfies Fields<PuckProps<SeoSupportBlockProps>>;

function toneClasses(surfaceTone: SurfaceTone) {
    switch (surfaceTone) {
        case "soft": return "[background:var(--template-surface-soft)] border-[var(--template-border-soft)] text-[var(--template-text-primary)]";
        case "dark": return "[background:var(--template-surface-dark)] border-[var(--template-border-inverse)] text-[var(--template-text-inverse)]";
        case "brand": return "[background:var(--template-surface-inverse-raised)] border-[var(--template-border-accent-soft)] text-[var(--template-text-inverse)]";
        case "premium": return "[background:var(--template-surface-premium)] border-[var(--template-border-accent-soft)] text-[var(--template-text-inverse)]";
        default: return "[background:var(--template-surface-light)] border-[var(--template-border-subtle)] text-[var(--template-text-primary)]";
    }
}

// ─── Shared design-system primitives ────────────────────────────────────────
// Single source of truth for glass blur, eyebrow micro-rules, CTA buttons,
// and table chrome. All blocks consume these instead of hand-rolling each.

const BLUR_GLASS = "backdrop-blur-[18px]";
const EYEBROW_BASE = "text-[11px] font-semibold uppercase tracking-[0.24em]";
const HEADING_DISPLAY_SM = "text-[var(--template-display-sm)] font-semibold leading-[0.98] tracking-[-0.04em]";

function eyebrowClasses(accentTone: AccentTone, surfaceTone: SurfaceTone) {
    return `${EYEBROW_BASE} ${accentTextClasses(accentTone, surfaceTone)}`;
}

function ctaPrimaryClasses() {
    return "inline-flex items-center rounded-[var(--template-radius-pill)] bg-[linear-gradient(135deg,var(--template-gradient-from),var(--template-gradient-to))] px-5 py-3 text-sm font-semibold text-white shadow-[var(--template-depth-glow)] transition-transform duration-200 hover:-translate-y-0.5";
}

function ctaSecondaryClasses(surfaceTone: SurfaceTone) {
    return isInverseSurface(surfaceTone)
        ? `inline-flex items-center rounded-[var(--template-radius-pill)] border border-[var(--template-border-inverse)] [background:var(--template-surface-glass)] px-5 py-3 text-sm font-medium text-[var(--template-text-inverse)] ${BLUR_GLASS} transition-transform duration-200 hover:-translate-y-0.5`
        : "inline-flex items-center rounded-[var(--template-radius-pill)] border border-[var(--template-border-soft)] [background:var(--template-surface-light)] px-5 py-3 text-sm font-medium text-[var(--template-text-primary)] transition-transform duration-200 hover:-translate-y-0.5";
}

function tableHeadClasses(surfaceTone: SurfaceTone) {
    return isInverseSurface(surfaceTone)
        ? "[background:var(--template-surface-glass)] text-[var(--template-text-inverse)]"
        : "[background:var(--template-surface-soft)] text-[var(--template-text-secondary)]";
}

function tableBorderClasses(surfaceTone: SurfaceTone) {
    return isInverseSurface(surfaceTone)
        ? "border-[var(--template-border-inverse)]"
        : "border-[var(--template-border-soft)]";
}

function isInverseSurface(surfaceTone: SurfaceTone) {
    return surfaceTone === "dark" || surfaceTone === "brand" || surfaceTone === "premium";
}

function sectionTextClasses(surfaceTone: SurfaceTone) {
    return isInverseSurface(surfaceTone) ? "text-[var(--template-text-inverse)]" : "text-[var(--template-text-primary)]";
}

function sectionMutedTextClasses(surfaceTone: SurfaceTone) {
    return isInverseSurface(surfaceTone) ? "text-[var(--template-text-inverse-muted)]" : "text-[var(--template-text-secondary)]";
}

function sectionSubtleTextClasses(surfaceTone: SurfaceTone) {
    return isInverseSurface(surfaceTone) ? "text-[var(--template-text-inverse-subtle)]" : "text-[var(--template-text-subtle)]";
}

function sectionDividerClasses(surfaceTone: SurfaceTone) {
    return isInverseSurface(surfaceTone) ? "border-[var(--template-border-inverse)]" : "border-[var(--template-border-soft)]";
}

function surfaceCardClasses(surfaceTone: SurfaceTone) {
    return isInverseSurface(surfaceTone)
        ? "border-[var(--template-border-inverse)] [background:var(--template-surface-glass)] text-[var(--template-text-inverse)] backdrop-blur-[18px]"
        : "border-[var(--template-border-soft)] [background:var(--template-surface-light)] text-[var(--template-text-secondary)]";
}

function surfaceInputClasses(surfaceTone: SurfaceTone) {
    return isInverseSurface(surfaceTone)
        ? "border-[var(--template-border-inverse)] [background:var(--template-surface-glass)] text-[var(--template-text-inverse)] backdrop-blur-[18px]"
        : "border-[var(--template-border-soft)] [background:var(--template-surface-light)] text-[var(--template-text-primary)]";
}

// Accent tone contract:
//   * `primary` — the canonical brand accent. Token-driven via
//     `--template-text-accent` / `--template-text-accent-strong`. Use for all
//     on-brand callouts.
//   * `slate` — neutral; routed to the muted text tokens (no Tailwind palette
//     escape).
//   * `emerald` | `amber` | `rose` | `sky` — semantic-status escape hatches
//     reserved for success/warning/danger/info indicators that must read
//     correctly regardless of brand colors. Use sparingly.
function accentTextClasses(accentTone: AccentTone, surfaceTone: SurfaceTone) {
    if (accentTone === "primary") {
        return isInverseSurface(surfaceTone) ? "text-[var(--template-text-accent-strong)]" : "text-[var(--template-text-accent)]";
    }
    if (accentTone === "slate") {
        return isInverseSurface(surfaceTone) ? "text-[var(--template-text-inverse-muted)]" : "text-[var(--template-text-secondary)]";
    }

    if (isInverseSurface(surfaceTone)) {
        switch (accentTone) {
            case "emerald": return "text-emerald-300";
            case "amber": return "text-amber-300";
            case "rose": return "text-rose-300";
            default: return "text-sky-300";
        }
    }

    switch (accentTone) {
        case "emerald": return "text-emerald-700";
        case "amber": return "text-amber-700";
        case "rose": return "text-rose-700";
        default: return "text-sky-700";
    }
}

function accentSoftClasses(accentTone: AccentTone, surfaceTone: SurfaceTone) {
    if (accentTone === "primary") {
        return isInverseSurface(surfaceTone)
            ? "bg-[color-mix(in_oklch,var(--template-accent)_18%,transparent)] text-[var(--template-text-accent-strong)]"
            : "bg-[color-mix(in_oklch,var(--template-accent)_10%,transparent)] text-[var(--template-text-accent)]";
    }
    if (accentTone === "slate") {
        return isInverseSurface(surfaceTone)
            ? "[background:var(--template-surface-glass)] text-[var(--template-text-inverse-muted)]"
            : "[background:var(--template-surface-soft)] text-[var(--template-text-secondary)]";
    }

    if (isInverseSurface(surfaceTone)) {
        switch (accentTone) {
            case "emerald": return "bg-emerald-400/15 text-emerald-200";
            case "amber": return "bg-amber-400/15 text-amber-200";
            case "rose": return "bg-rose-400/15 text-rose-200";
            default: return "bg-sky-400/15 text-sky-200";
        }
    }

    switch (accentTone) {
        case "emerald": return "bg-emerald-500/10 text-emerald-700";
        case "amber": return "bg-amber-500/10 text-amber-700";
        case "rose": return "bg-rose-500/10 text-rose-700";
        default: return "bg-sky-500/10 text-sky-700";
    }
}

function accentRingClasses(accentTone: AccentTone, surfaceTone: SurfaceTone) {
    if (accentTone === "primary") {
        return isInverseSurface(surfaceTone) ? "ring-[var(--template-border-accent)]" : "ring-[var(--template-border-accent-soft)]";
    }
    if (accentTone === "slate") {
        return isInverseSurface(surfaceTone) ? "ring-[var(--template-border-inverse)]" : "ring-[var(--template-border-soft)]";
    }

    if (isInverseSurface(surfaceTone)) {
        switch (accentTone) {
            case "emerald": return "ring-emerald-300/30";
            case "amber": return "ring-amber-300/30";
            case "rose": return "ring-rose-300/30";
            default: return "ring-sky-300/30";
        }
    }

    switch (accentTone) {
        case "emerald": return "ring-emerald-500/20";
        case "amber": return "ring-amber-500/20";
        case "rose": return "ring-rose-500/20";
        default: return "ring-sky-500/20";
    }
}

function sectionBadgeClasses(surfaceTone: SurfaceTone, accentTone: AccentTone) {
    return accentSoftClasses(accentTone, surfaceTone);
}

function widthClasses(width: SectionWidth) {
    if (width === "full") return "w-full max-w-none";
    if (width === "wide") return "mx-auto w-full max-w-7xl";
    return "mx-auto w-full max-w-6xl";
}

function densityClasses(density: Density) {
    if (density === "compact") return "p-5 md:p-6";
    if (density === "spacious") return "p-8 md:p-10 lg:p-12";
    return "p-6 md:p-8";
}

function cardClasses(cardStyle: CardStyle) {
    if (cardStyle === "glass") return "backdrop-blur-[18px] shadow-[var(--template-depth-md)]";
    if (cardStyle === "outline") return "shadow-none";
    if (cardStyle === "flat") return "shadow-none border-dashed";
    if (cardStyle === "elevated") return "shadow-[var(--template-depth-lg)]";
    return "shadow-[var(--template-depth-sm)]";
}

function emphasisClasses(emphasis: EmphasisLevel, accentTone: AccentTone, surfaceTone: SurfaceTone) {
    if (emphasis === "strong") return `ring-1 ${accentRingClasses(accentTone, surfaceTone)} shadow-[var(--template-depth-glow)]`;
    if (emphasis === "subtle") return "opacity-100 shadow-[var(--template-depth-sm)]";
    return "";
}

function sectionHeadingClasses(alignment: ContentAlignment) {
    return alignment === "center" ? "text-center items-center" : "text-left items-start";
}

// Section-level CTAs always render as the brand gradient pill — same primitive
// the premium-tier blocks use, so a workspace's primary CTA looks identical
// regardless of host block. The `accentTone` parameter is retained for badge
// helpers (sectionBadgeClasses) but no longer branches the button surface.
function buttonToneClasses(_accentTone: AccentTone) {
    void _accentTone;
    return ctaPrimaryClasses();
}

 function buildSeededData() {
    const home: PublicBuilderData = {
        root: { props: { title: "Site Home", locale: "en", pageKind: "home" } },
        content: [
            { type: "HeroBlock", props: buildHeroProps() },
            { type: "StatsBlock", props: buildStatsProps() },
            { type: "FoundationBlock", props: buildFoundationProps() },
            { type: "AboutBlock", props: buildAboutProps() },
            { type: "ServicesShowcaseBlock", props: buildServicesShowcaseProps("home-services-showcase") },
            { type: "MethodologyBlock", props: buildMethodologyProps("home-methodology") },
            { type: "SeoSupportBlock", props: buildSeoSupportProps("home-seo-support") },
        ],
    };

    const services: PublicBuilderData = {
        root: { props: { title: "Site Services", locale: "en", pageKind: "services" } },
        content: [
            { type: "ServicesShowcaseBlock", props: buildServicesShowcaseProps("services-showcase") },
            { type: "MethodologyBlock", props: buildMethodologyProps("services-methodology") },
            { type: "SeoSupportBlock", props: buildSeoSupportProps("services-seo-support") },
        ],
    };

    const about: PublicBuilderData = {
        root: { props: { title: "Site About", locale: "en", pageKind: "about" } },
        content: [
            { type: "AboutBlock", props: buildAboutProps() },
            { type: "CommitmentBlock", props: { id: "about-commitment", ...buildFacilityServicesStructuredPageData().about.commitment } },
            { type: "SeoSupportBlock", props: buildSeoSupportProps("about-seo-support") },
        ],
    };

    const contact: PublicBuilderData = {
        root: { props: { title: "Site Contact", locale: "en", pageKind: "contact" } },
        content: [{ type: "ContactBlock", props: buildContactProps() }, { type: "SeoSupportBlock", props: buildSeoSupportProps("contact-seo-support") }],
    };

    return { home, services, about, contact };
}

 export const seededPuckDataBySlug: Record<"home" | "services" | "about" | "contact", PublicBuilderData> = buildSeededData();
export const defaultPuckData: PublicBuilderData = cloneData(seededPuckDataBySlug.home);

export function createEmptyPuckData(title = "New Site Page", locale: SupportedLocale = "en"): PublicBuilderData {
    return {
        root: {
            props: {
                title,
                locale,
            },
        },
        content: [{ type: "SeoSupportBlock", props: buildSeoSupportProps("page-seo-support") }],
    };
}

export function createStarterPresetPuckData(
    preset: string | null | undefined,
    title: string,
    locale: SupportedLocale = "en",
): PublicBuilderData {
    const base = createEmptyPuckData(title, locale);

    if (preset === "trust-strip") {
        return {
            ...base,
            content: [
                { type: "PositioningStripBlock", props: buildPositioningStripProps("trust-strip-positioning") },
                { type: "IntroBannerBlock", props: buildIntroBannerProps("trust-strip-banner") },
                { type: "ClientLogosBlock", props: buildClientLogosProps("trust-strip-logos") },
                { type: "TestimonialsBlock", props: buildTestimonialsProps("trust-strip-testimonials") },
                { type: "CtaBannerBlock", props: buildCtaBannerProps("trust-strip-cta") },
            ],
        };
    }

    if (preset === "service-comparison") {
        return {
            ...base,
            content: [
                { type: "HeroBlock", props: buildHeroProps() },
                { type: "BasicProComparisonBlock", props: buildBasicProComparisonProps("service-comparison-basic-pro") },
                { type: "ServicesShowcaseBlock", props: buildServicesShowcaseProps("service-comparison-services") },
                { type: "PackagesBlock", props: buildPackagesProps("service-comparison-packages") },
                { type: "ScopeMatrixBlock", props: buildScopeMatrixProps("service-comparison-scope") },
                { type: "QuoteRequestBlock", props: buildQuoteRequestProps("service-comparison-quote") },
            ],
        };
    }

    if (preset === "why-choose-us") {
        return {
            ...base,
            content: [
                { type: "IntroBannerBlock", props: buildIntroBannerProps("why-choose-us-banner") },
                { type: "PositioningStripBlock", props: buildPositioningStripProps("why-choose-us-positioning") },
                { type: "IconCardsBlock", props: buildIconCardsProps("why-choose-us-icons") },
                { type: "MetricsBlock", props: buildMetricsProps("why-choose-us-metrics") },
                { type: "OperationalProofBlock", props: buildOperationalProofProps("why-choose-us-proof") },
                { type: "StoryBlock", props: buildStoryBlockProps("why-choose-us-story") },
                { type: "CtaBannerBlock", props: buildCtaBannerProps("why-choose-us-cta") },
            ],
        };
    }

    if (preset === "operational-standards") {
        return {
            ...base,
            content: [
                { type: "IntroBannerBlock", props: buildIntroBannerProps("ops-standards-banner") },
                { type: "MethodologyBlock", props: buildMethodologyProps("ops-standards-methodology") },
                { type: "OperationalProofBlock", props: buildOperationalProofProps("ops-standards-proof") },
                { type: "ScopeMatrixBlock", props: buildScopeMatrixProps("ops-standards-scope") },
                { type: "TimelineBlock", props: buildTimelineProps("ops-standards-timeline") },
                { type: "ClientLogosBlock", props: buildClientLogosProps("ops-standards-logos") },
            ],
        };
    }

    if (preset === "call-booking-cta") {
        return {
            ...base,
            content: [
                { type: "IntroBannerBlock", props: buildIntroBannerProps("call-booking-banner") },
                { type: "QuoteRequestBlock", props: buildQuoteRequestProps("call-booking-quote") },
                { type: "ContactBlock", props: buildContactProps() },
            ],
        };
    }

    if (preset === "client-transparency") {
        return {
            ...base,
            content: [
                { type: "IntroBannerBlock", props: buildIntroBannerProps("client-transparency-banner") },
                { type: "FeatureListBlock", props: buildFeatureListProps("client-transparency-features") },
                { type: "OperationalProofBlock", props: buildOperationalProofProps("client-transparency-proof") },
                { type: "MetricsBlock", props: buildMetricsProps("client-transparency-metrics") },
                { type: "TestimonialsBlock", props: buildTestimonialsProps("client-transparency-testimonials") },
            ],
        };
    }

    if (preset === "isystem-story-system") {
        return {
            ...base,
            content: [
                { type: "HeroBlock", props: buildHeroProps() },
                { type: "PositioningStripBlock", props: buildPositioningStripProps("story-system-positioning") },
                { type: "ServicesShowcaseBlock", props: buildServicesShowcaseProps("story-system-services") },
                { type: "BasicProComparisonBlock", props: buildBasicProComparisonProps("story-system-comparison") },
                { type: "OperationalProofBlock", props: buildOperationalProofProps("story-system-proof") },
                { type: "EnterpriseSupportBlock", props: buildEnterpriseSupportProps("story-system-enterprise") },
                { type: "CtaBannerBlock", props: buildCtaBannerProps("story-system-cta") },
            ],
        };
    }

    if (preset === "facility-sector-showcase") {
        return {
            ...base,
            content: [
                { type: "IntroBannerBlock", props: buildIntroBannerProps("sector-showcase-banner") },
                { type: "SectorGridBlock", props: buildSectorGridProps("sector-showcase-grid") },
                { type: "ServicesShowcaseBlock", props: buildServicesShowcaseProps("sector-showcase-services") },
                { type: "GalleryBlock", props: buildGalleryProps("sector-showcase-gallery") },
            ],
        };
    }

    return base;
}

function getRenderLocale<T>(props: PuckRenderProps<T>): SupportedLocale {
    return getLocale(props.puck?.metadata);
}

function SectionShell({
    title,
    subtitle,
    style = defaultSectionStyle,
    eyebrow,
    children,
}: {
    title: string;
    subtitle?: string;
    style?: SectionStyleProps;
    eyebrow?: string;
    children: React.ReactNode;
}) {
    return (
        <section className={`${widthClasses(style.width)} ${toneClasses(style.surfaceTone)} ${densityClasses(style.density)} ${cardClasses(style.cardStyle)} ${emphasisClasses(style.emphasis, style.accentTone, style.surfaceTone)} rounded-[var(--template-radius-xl)] border`}>
            <div className={`mb-6 flex flex-col space-y-3 border-b pb-5 ${sectionHeadingClasses(style.alignment)} ${sectionDividerClasses(style.surfaceTone)}`}>
                {style.showEyebrow && eyebrow ? <p className={eyebrowClasses(style.accentTone, style.surfaceTone)}>{eyebrow}</p> : null}
                <h2 className={`${HEADING_DISPLAY_SM} ${sectionTextClasses(style.surfaceTone)}`}>{title}</h2>
                {subtitle ? <p className={`max-w-3xl text-sm leading-6 ${sectionMutedTextClasses(style.surfaceTone)}`}>{subtitle}</p> : null}
            </div>
            <div className={style.alignment === "center" ? "flex flex-col items-center text-center" : ""}>
                {children}
            </div>
        </section>
    );
}

export const puckConfig = {
    root: {
        fields: {
            schemaVersion: { type: "text", label: "Schema version (managed)" },
            title: { type: "text", label: "Page title" },
            locale: {
                type: "radio",
                label: "Preview locale",
                options: [
                    { label: "English", value: "en" },
                    { label: "Nederlands", value: "nl" },
                    { label: "العربية", value: "ar" },
                ],
            },
            pageKind: {
                type: "radio",
                label: "Page family",
                options: [
                    { label: "Custom / Generic", value: "custom" },
                    { label: "Home", value: "home" },
                    { label: "Services", value: "services" },
                    { label: "About", value: "about" },
                    { label: "Contact", value: "contact" },
                ],
            },
            pageIntent: {
                type: "select",
                label: "Page intent",
                options: [
                    { label: "Service page", value: "service-page" },
                    { label: "Campaign landing", value: "campaign-landing" },
                    { label: "Sector page", value: "sector-page" },
                    { label: "Trust / proof", value: "trust-proof" },
                    { label: "Case study", value: "case-study" },
                    { label: "Quote capture", value: "quote-capture" },
                    { label: "Recruitment", value: "recruitment" },
                    { label: "Location page", value: "location-page" },
                ],
            },
            presetId: { type: "text", label: "Public preset" },
            themeVariant: {
                type: "select",
                label: "Public theme variant",
                options: [
                    { label: "Default", value: "default" },
                    { label: "Editorial", value: "editorial" },
                    { label: "Proof", value: "proof" },
                    { label: "Transactional", value: "transactional" },
                ],
            },
            chromeMode: {
                type: "select",
                label: "Public chrome",
                options: [
                    { label: "Default", value: "default" },
                    { label: "Minimal", value: "minimal" },
                    { label: "Hidden", value: "hidden" },
                ],
            },
            metadata: {
                type: "object",
                label: "Page metadata",
                objectFields: {
                    audienceType: { type: "text", label: "Audience type" },
                    conversionGoal: { type: "text", label: "Conversion goal" },
                    campaignLabel: { type: "text", label: "Campaign label" },
                    seoTitle: { type: "text", label: "SEO title" },
                    seoDescription: { type: "textarea", label: "SEO description" },
                    heroMedia: { type: "text", label: "Hero media path" },
                    publishedLabel: { type: "text", label: "Publish label" },
                    starterPreset: { type: "text", label: "Starter preset" },
                    hideNavbar: { type: "radio", label: "Hide navbar", options: [{ label: "No", value: false }, { label: "Yes", value: true }] },
                    hideFooter: { type: "radio", label: "Hide footer", options: [{ label: "No", value: false }, { label: "Yes", value: true }] },
                    ctaVariant: {
                        type: "select",
                        label: "Navbar CTA variant",
                        options: [
                            { label: "Default", value: "default" },
                            { label: "Mobile", value: "mobile" },
                        ],
                    },
                },
            },
        },
        defaultProps: defaultPuckData.root.props,
        render: ({ children }) => <div className="mx-auto flex max-w-6xl flex-col gap-6 [background:var(--template-surface-canvas)] p-6 text-[var(--template-text-primary)]" style={editorPreviewCssVars}>{children}</div>,
    },
    categories: {
        facilityServices: {
            title: "Modular page system",
            components: [
                "HeroBlock",
                "PositioningStripBlock",
                "IntroBannerBlock",
                "RichTextSectionBlock",
                "FeatureListBlock",
                "IconCardsBlock",
                "StoryBlock",
                "StatsBlock",
                "MetricsBlock",
                "OperationalProofBlock",
                "FoundationBlock",
                "AboutBlock",
                "CommitmentBlock",
                "ServicesShowcaseBlock",
                "MethodologyBlock",
                "BasicProComparisonBlock",
                "TimelineBlock",
                "TestimonialsBlock",
                "ClientLogosBlock",
                "EnterpriseSupportBlock",
                "CtaBannerBlock",
                "QuoteRequestBlock",
                "GalleryBlock",
                "VideoBlock",
                "SectorGridBlock",
                "ScopeMatrixBlock",
                "PackagesBlock",
                "SpacerBlock",
                "DividerBlock",
                "SeoSupportBlock",
                "ContactBlock",
            ],
        },
        publicSystems: {
            title: "Public system blocks",
            components: [...PUBLIC_PUCK_BLOCK_TYPES],
        },
        layouts: {
            title: "Premium layouts & sections",
            // The newly-added blocks are grouped into their own category so
            // authors can find layout-driven sections (insights, bento, FAQ,
            // pricing, team, pull quote, split CTA) without scrolling past
            // the long iSystem block list.
            components: [...EXTENDED_BLOCK_TYPES],
        },
        sectorLanding: {
            title: "Sector landing pages",
            // Direct-response sector pages (real-estate, legal, horeca,
            // media-agency, education, ai-media-operations, etc.). Stack
            // these top-to-bottom for a /<slug> page that mirrors the
            // hand-coded TSX layout the same content used to live in.
            components: [...SECTOR_LANDING_BLOCK_TYPES],
        },
        legalVault: {
            title: "Legal Vault sections",
            // Marketing surfaces for the Legal Vault feature: four-pillar
            // overview, compliance badges strip, NL ZZP lead-magnet CTA, and
            // the booking → BTW workflow timeline. Drop on services, about,
            // pricing, or sector-landing pages where compliance is a buying
            // signal.
            components: [...LEGAL_VAULT_BLOCK_TYPES],
        },
        resources: {
            title: "Resource / PDF assets",
            // Resource hub and downloadable PDF playbooks blocks.
            components: [...RESOURCE_BLOCK_TYPES],
        },
    },
    components: {
        HeroBlock: {
            label: "Hero",
            fields: heroBlockFields,
            defaultProps: buildHeroProps(),
            render: (props) => {
                const locale = getRenderLocale(props);
                const titleLineOne = translate(locale, props.titleLineOne);
                const titleLineTwo = translate(locale, props.titleLineTwo);

                return (
                    <section className="relative overflow-hidden rounded-[var(--template-radius-xl)] border border-[var(--template-border-accent-soft)] [background:var(--template-surface-premium)] px-6 py-10 text-[var(--template-text-inverse)] shadow-[var(--template-depth-lg)] md:px-10 md:py-14 lg:px-14 lg:py-18">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_oklch,var(--template-accent)_22%,transparent),transparent_30%),radial-gradient(circle_at_left_center,color-mix(in_oklch,var(--template-primary)_22%,transparent),transparent_40%)]" />
                        <div className="relative z-10 grid gap-10 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
                            <div className="space-y-6">
                                <p className="inline-flex rounded-[var(--template-radius-pill)] border border-[var(--template-border-accent-soft)] bg-[color-mix(in_oklch,var(--template-accent)_10%,transparent)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.26em] text-[var(--template-text-accent-strong)]">
                                    {translate(locale, props.eyebrow)}
                                </p>
                                <div className="space-y-4">
                                    <h1 className="max-w-4xl font-semibold leading-[0.95] tracking-[-0.05em] text-[var(--template-display-lg)]">
                                        <span className="block">{titleLineOne}</span>
                                        <span
                                            className="block text-transparent bg-clip-text"
                                            style={{ backgroundImage: "linear-gradient(135deg, var(--template-text-accent-strong), var(--template-gradient-to))" }}
                                        >
                                            {titleLineTwo}
                                        </span>
                                    </h1>
                                    <RichTextRenderer content={translateNarrative(locale, props.subtitle)} className="max-w-2xl text-base leading-8 text-[var(--template-text-inverse-muted)] md:text-lg" />
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <a
                                        href={props.primaryHref}
                                        data-analytics-cta="true"
                                        data-analytics-name="hero-primary"
                                        data-analytics-placement="builder-block"
                                        className={ctaPrimaryClasses()}
                                    >
                                        {translate(locale, props.primaryCta)}
                                    </a>
                                    <a
                                        href={props.secondaryHref}
                                        className={ctaSecondaryClasses("dark")}
                                    >
                                        {translate(locale, props.secondaryCta)}
                                    </a>
                                </div>
                            </div>

                            <div className="rounded-[var(--template-radius-lg)] border border-[var(--template-border-inverse)] [background:var(--template-surface-glass)] p-6 backdrop-blur-[18px] shadow-[var(--template-depth-md)]">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--template-text-accent-strong)]">Premium system brief</p>
                                <p className="mt-4 text-sm leading-7 text-[var(--template-text-inverse-muted)]">
                                    {props.backgroundVideo || "Builder-managed premium media layer"}
                                </p>
                                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                                    {props.trustBadges.slice(0, 3).map((badge) => (
                                        <div key={badge.id} className={`rounded-[var(--template-radius-md)] border border-[var(--template-border-inverse)] [background:var(--template-surface-glass)] ${BLUR_GLASS} px-4 py-3 text-sm text-[var(--template-text-inverse-muted)]`}>
                                            {translate(locale, badge)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="relative z-10 mt-8 flex flex-wrap gap-2 border-t border-[var(--template-border-inverse)] pt-6">
                            {props.trustBadges.map((badge) => (
                                <span key={badge.id} className="rounded-[var(--template-radius-pill)] border border-[var(--template-border-inverse)] px-3 py-1.5 text-xs font-medium text-[var(--template-text-inverse-muted)]">
                                    {translate(locale, badge)}
                                </span>
                            ))}
                        </div>
                    </section>
                );
            },
        },
        PositioningStripBlock: {
            label: "Positioning strip",
            fields: positioningStripBlockFields,
            defaultProps: buildPositioningStripProps(),
            render: (props) => {
                const locale = getRenderLocale(props);
                return <SectionShell title={translate(locale, props.title)} style={props.style} eyebrow={translate(locale, props.eyebrow)}>
                    <RichTextRenderer content={translateNarrative(locale, props.description)} className={`mb-6 text-sm leading-7 ${sectionMutedTextClasses(props.style.surfaceTone)}`} />
                    <div className="grid gap-4 md:grid-cols-3">
                        {props.items.map((item) => (
                            <article key={item.id} className={`group relative overflow-hidden rounded-[var(--template-radius-lg)] border p-5 ${surfaceCardClasses(props.style.surfaceTone)}`}>
                                <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--template-gradient-from),var(--template-gradient-to))] opacity-80" />
                                <p className={`${EYEBROW_BASE} ${sectionSubtleTextClasses(props.style.surfaceTone)}`}>
                                    {locale === "ar" ? "إشارة النظام" : locale === "nl" ? "Systeemsignaal" : "System signal"}
                                </p>
                                <h3 className={`mt-3 text-lg font-semibold ${sectionTextClasses(props.style.surfaceTone)}`}>{translate(locale, item.title)}</h3>
                                <RichTextRenderer content={translateNarrative(locale, item.detail)} className={`mt-3 text-sm leading-7 ${sectionMutedTextClasses(props.style.surfaceTone)}`} />
                            </article>
                        ))}
                    </div>
                </SectionShell>;
            },
        },
        IntroBannerBlock: {
            label: "Intro banner",
            fields: introBannerBlockFields,
            defaultProps: buildIntroBannerProps(),
            render: (props) => {
                const locale = getRenderLocale(props);
                return <SectionShell title={translate(locale, props.title)} style={props.style} eyebrow={translate(locale, props.eyebrow)}>
                    <RichTextRenderer content={translateRich(locale, props.richBodyEn, props.richBodyNl, props.body, props.richBodyAr)} className={sectionMutedTextClasses(props.style.surfaceTone)} />
                    <a href={props.cta.href} data-analytics-cta="true" data-analytics-name="intro-banner-cta" data-analytics-placement="builder-block" className={buttonToneClasses(props.style.accentTone)}>{translate(locale, props.cta.label)}</a>
                </SectionShell>;
            },
        },
        RichTextSectionBlock: {
            label: "Rich text narrative",
            fields: richTextBlockFields,
            defaultProps: buildRichTextSectionProps(),
            render: (props) => {
                const locale = getRenderLocale(props);
                return <SectionShell title={translate(locale, props.title)} style={props.style} eyebrow={translate(locale, props.eyebrow)}>
                    <RichTextRenderer content={translateRich(locale, props.richBodyEn, props.richBodyNl, props.body, props.richBodyAr)} className={sectionMutedTextClasses(props.style.surfaceTone)} />
                    <ul className={`space-y-2 text-sm ${sectionMutedTextClasses(props.style.surfaceTone)}`}>
                        {props.supportingPoints.map((point) => <li key={point.id}>• {translate(locale, point)}</li>)}
                    </ul>
                    {props.cta ? <a href={props.cta.href} data-analytics-cta="true" data-analytics-name="rich-text-section-cta" data-analytics-placement="builder-block" className={`mt-4 ${buttonToneClasses(props.style.accentTone)}`}>{translate(locale, props.cta.label)}</a> : null}
                </SectionShell>;
            },
        },
        FeatureListBlock: {
            label: "Feature list",
            fields: featureListBlockFields,
            defaultProps: buildFeatureListProps(),
            render: (props) => {
                const locale = getRenderLocale(props);
                return <SectionShell title={translate(locale, props.title)} style={props.style} eyebrow={translate(locale, props.eyebrow)}>
                    <RichTextRenderer content={translateNarrative(locale, props.description)} className={`mb-4 text-sm leading-7 ${sectionMutedTextClasses(props.style.surfaceTone)}`} />
                    <div className="grid gap-3 md:grid-cols-2">
                        {props.items.map((item) => <div key={item.id} className={`rounded-[var(--template-radius-md)] border px-4 py-3 text-sm ${surfaceCardClasses(props.style.surfaceTone)}`}>{translate(locale, item)}</div>)}
                    </div>
                </SectionShell>;
            },
        },
        IconCardsBlock: {
            label: "Icon cards",
            fields: iconCardsBlockFields,
            defaultProps: buildIconCardsProps(),
            render: (props) => {
                const locale = getRenderLocale(props);
                return <SectionShell title={translate(locale, props.title)} style={props.style} eyebrow={translate(locale, props.eyebrow)}>
                    <RichTextRenderer content={translateNarrative(locale, props.description)} className={`mb-4 text-sm leading-7 ${sectionMutedTextClasses(props.style.surfaceTone)}`} />
                    <div className="grid gap-4 md:grid-cols-3">
                        {props.items.map((item) => <article key={item.id} className={`rounded-[var(--template-radius-md)] border p-4 ${surfaceCardClasses(props.style.surfaceTone)}`}><p className={`${EYEBROW_BASE} ${sectionSubtleTextClasses(props.style.surfaceTone)}`}>{item.icon}</p><h3 className={`mt-3 text-lg font-semibold ${sectionTextClasses(props.style.surfaceTone)}`}>{translate(locale, item.title)}</h3><RichTextRenderer content={translateNarrative(locale, item.description)} className={`mt-2 text-sm ${sectionMutedTextClasses(props.style.surfaceTone)}`} /></article>)}
                    </div>
                </SectionShell>;
            },
        },
        StatsBlock: {
            label: "Stats",
            fields: statsBlockFields,
            defaultProps: buildStatsProps(),
            render: (props) => {
                const locale = getRenderLocale(props);
                return (
                    <section className="overflow-hidden rounded-[var(--template-radius-xl)] border border-[var(--template-border-inverse)] [background:var(--template-surface-dark)] px-6 py-8 text-[var(--template-text-inverse)] shadow-[var(--template-depth-lg)] md:px-8 md:py-10">
                        <div className="mb-8 flex flex-col gap-3 border-b border-[var(--template-border-inverse)] pb-5 md:flex-row md:items-end md:justify-between">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--template-text-accent-strong)]">Operational proof</p>
                                <h2 className="mt-3 text-[var(--template-display-sm)] font-semibold leading-[0.98] tracking-[-0.04em]">Measured outcomes, framed like an editorial proof strip.</h2>
                            </div>
                        </div>
                        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                            {props.items.map((item) => (
                                <div key={item.id} className="relative border-l border-[var(--template-border-accent-soft)] pl-5">
                                    <p className="text-[clamp(2.5rem,6vw,4.5rem)] font-semibold leading-none tracking-[-0.05em] text-[var(--template-text-accent-strong)]">
                                        {item.value}
                                    </p>
                                    <p className="mt-3 max-w-[16ch] text-sm leading-6 text-[var(--template-text-inverse-muted)]">{translate(locale, item.label)}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                );
            },
        },
        MetricsBlock: {
            label: "KPI outcomes",
            fields: metricsBlockFields,
            defaultProps: buildMetricsProps(),
            render: (props) => {
                const locale = getRenderLocale(props);
                return <SectionShell title={translate(locale, props.title)} style={props.style} eyebrow={translate(locale, props.eyebrow)}>
                    <RichTextRenderer content={translateNarrative(locale, props.description)} className={`mb-4 text-sm leading-7 ${sectionMutedTextClasses(props.style.surfaceTone)}`} />
                    <div className="grid gap-4 md:grid-cols-3">{props.items.map((item) => <div key={item.id} className={`rounded-[var(--template-radius-md)] border p-4 ${surfaceCardClasses(props.style.surfaceTone)}`}><p className={`text-3xl font-semibold ${sectionTextClasses(props.style.surfaceTone)}`}>{item.value}</p><p className={`mt-2 text-sm font-medium ${sectionTextClasses(props.style.surfaceTone)}`}>{translate(locale, item.label)}</p><RichTextRenderer content={translateNarrative(locale, item.supportingText)} className={`mt-1 text-sm ${sectionMutedTextClasses(props.style.surfaceTone)}`} /></div>)}</div>
                </SectionShell>;
            },
        },
        OperationalProofBlock: {
            label: "Operational proof",
            fields: operationalProofBlockFields,
            defaultProps: buildOperationalProofProps(),
            render: (props) => {
                const locale = getRenderLocale(props);
                return <SectionShell title={translate(locale, props.title)} style={props.style} eyebrow={translate(locale, props.eyebrow)}>
                    <RichTextRenderer content={translateNarrative(locale, props.description)} className={`mb-6 text-sm leading-7 ${sectionMutedTextClasses(props.style.surfaceTone)}`} />
                    <div className="grid gap-4 md:grid-cols-2">
                        {props.items.map((item) => <article key={item.id} className={`rounded-[var(--template-radius-lg)] border p-5 ${surfaceCardClasses(props.style.surfaceTone)}`}><p className={`inline-flex rounded-[var(--template-radius-pill)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${sectionBadgeClasses(props.style.surfaceTone, props.style.accentTone)}`}>{translate(locale, item.proof)}</p><h3 className={`mt-4 text-lg font-semibold ${sectionTextClasses(props.style.surfaceTone)}`}>{translate(locale, item.title)}</h3><RichTextRenderer content={translateNarrative(locale, item.description)} className={`mt-3 text-sm leading-7 ${sectionMutedTextClasses(props.style.surfaceTone)}`} /></article>)}
                    </div>
                </SectionShell>;
            },
        },
        FoundationBlock: {
            label: "Foundation",
            fields: foundationBlockFields,
            defaultProps: buildFoundationProps(),
            render: (props) => {
                const locale = getRenderLocale(props);
                return (
                    <SectionShell title={translate(locale, props.title)} style={props.style}>
                        <RichTextRenderer content={translateNarrative(locale, props.description)} className={`text-sm leading-7 ${sectionMutedTextClasses(props.style.surfaceTone)}`} />
                        <RichTextRenderer content={translateNarrative(locale, props.supportLine)} className={`mt-3 text-sm font-semibold uppercase tracking-[0.15em] ${accentTextClasses(props.style.accentTone, props.style.surfaceTone)}`} />
                    </SectionShell>
                );
            },
        },
        AboutBlock: {
            label: "About",
            fields: aboutBlockFields,
            defaultProps: buildAboutProps(),
            render: (props) => {
                const locale = getRenderLocale(props);
                return (
                    <SectionShell title={translate(locale, props.headline)} style={props.style} eyebrow={translate(locale, props.eyebrow)}>
                        <RichTextRenderer content={translateNarrative(locale, props.description)} className={`mb-4 text-sm leading-7 ${sectionMutedTextClasses(props.style.surfaceTone)}`} />
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className={`rounded-[var(--template-radius-md)] border p-4 ${surfaceCardClasses(props.style.surfaceTone)}`}>
                                <p className={`${EYEBROW_BASE} ${sectionSubtleTextClasses(props.style.surfaceTone)}`}>{translate(locale, props.missionTitle)}</p>
                                <RichTextRenderer content={translateNarrative(locale, props.missionText)} className={`mt-3 text-sm leading-7 ${sectionMutedTextClasses(props.style.surfaceTone)}`} />
                            </div>
                            <div className={`rounded-[var(--template-radius-md)] border p-4 ${surfaceCardClasses(props.style.surfaceTone)}`}>
                                <p className={`${EYEBROW_BASE} ${sectionSubtleTextClasses(props.style.surfaceTone)}`}>{translate(locale, props.visionTitle)}</p>
                                <RichTextRenderer content={translateNarrative(locale, props.visionText)} className={`mt-3 text-sm leading-7 ${sectionMutedTextClasses(props.style.surfaceTone)}`} />
                            </div>
                        </div>
                        <div className={`mt-4 rounded-[var(--template-radius-md)] border p-4 ${surfaceCardClasses(props.style.surfaceTone)}`}>
                            <p className={`${EYEBROW_BASE} ${sectionSubtleTextClasses(props.style.surfaceTone)}`}>{translate(locale, props.whyTitle)}</p>
                            <ul className={`mt-3 space-y-2 text-sm ${sectionMutedTextClasses(props.style.surfaceTone)}`}>
                                {props.whyPoints.map((point) => <li key={point.id}>• {translate(locale, point)}</li>)}
                            </ul>
                        </div>
                    </SectionShell>
                );
            },
        },
        StoryBlock: {
            label: "Story block",
            fields: storyBlockFields,
            defaultProps: buildStoryBlockProps(),
            render: (props) => {
                const locale = getRenderLocale(props);
                const mediaFirst = props.mediaPosition === "left";
                return <SectionShell title={translate(locale, props.title)} style={props.style} eyebrow={translate(locale, props.eyebrow)}>
                    <div className={`grid gap-4 md:grid-cols-2 ${mediaFirst ? "" : "md:[&>*:first-child]:order-2"}`}>
                        <div className={`overflow-hidden rounded-[var(--template-radius-lg)] border ${surfaceCardClasses(props.style.surfaceTone)}`}>
                            <div className="relative aspect-[4/3] w-full overflow-hidden [background:var(--template-surface-soft)]">
                                {props.image ? (
                                    <Image
                                        src={props.image}
                                        alt={translate(locale, props.imageAlt)}
                                        fill
                                        className="object-cover"
                                        unoptimized
                                    />
                                ) : null}
                            </div>
                            <div className={`border-t ${tableBorderClasses(props.style.surfaceTone)} p-3 ${EYEBROW_BASE} ${sectionSubtleTextClasses(props.style.surfaceTone)}`}>
                                {translate(locale, props.imageAlt)}
                            </div>
                        </div>
                        <div className={`rounded-[var(--template-radius-lg)] border p-4 ${surfaceCardClasses(props.style.surfaceTone)}`}>
                            <RichTextRenderer content={translateRich(locale, props.richBodyEn, props.richBodyNl, props.body, props.richBodyAr)} className={`text-sm leading-7 ${sectionMutedTextClasses(props.style.surfaceTone)}`} />
                        </div>
                    </div>
                </SectionShell>;
            },
        },
        CommitmentBlock: {
            label: "Commitment",
            fields: commitmentBlockFields,
            defaultProps: { id: "about-commitment", ...buildFacilityServicesStructuredPageData().about.commitment },
            render: (props) => {
                const locale = getRenderLocale(props);
                return (
                    <SectionShell title={translate(locale, props.title)} style={props.style}>
                        <div className={`rounded-[var(--template-radius-md)] border p-4 ${surfaceCardClasses(props.style.surfaceTone)}`}>
                            <RichTextRenderer content={translateNarrative(locale, props.description)} className={`text-sm leading-7 ${sectionMutedTextClasses(props.style.surfaceTone)}`} />
                        </div>
                    </SectionShell>
                );
            },
        },
        ServicesShowcaseBlock: {
            label: "Services showcase",
            fields: servicesBlockFields,
            defaultProps: buildServicesShowcaseProps("services-showcase"),
            render: (props) => {
                const locale = getRenderLocale(props);
                return (
                    <section className="overflow-hidden rounded-[var(--template-radius-xl)] border border-[var(--template-border-soft)] [background:var(--template-surface-soft)] px-6 py-8 text-[var(--template-text-inverse)] shadow-[var(--template-depth-lg)] md:px-8 md:py-10">
                        <div className="mb-8 max-w-3xl space-y-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--template-text-accent-strong)]">Service architecture</p>
                            <h2 className="text-[var(--template-display-sm)] font-semibold leading-[0.98] tracking-[-0.04em]">{translate(locale, props.title)}</h2>
                            <RichTextRenderer content={translateNarrative(locale, props.subtitle)} className="text-sm leading-7 text-[var(--template-text-inverse-muted)] md:text-base" />
                            <RichTextRenderer content={translateNarrative(locale, props.description)} className="text-sm leading-7 text-[var(--template-text-inverse-subtle)] md:text-base" />
                        </div>
                        <div className="grid gap-4 lg:grid-cols-12">
                            {props.items.map((item) => (
                                <article key={item.id} className={`group relative overflow-hidden rounded-[var(--template-radius-lg)] border border-[var(--template-border-inverse)] [background:var(--template-surface-glass)] p-5 backdrop-blur-[18px] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[var(--template-depth-glow)] ${item.orderLabel === "01" ? "lg:col-span-7" : "lg:col-span-5"}`}>
                                    <span className="absolute inset-y-0 left-0 w-1 bg-[linear-gradient(180deg,var(--template-text-accent-strong),transparent)] opacity-70 transition-opacity group-hover:opacity-100" />
                                    <div className="mb-4 flex items-center justify-between gap-4 pl-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--template-text-accent-strong)]">{item.orderLabel}</p>
                                        <p className="truncate text-[11px] uppercase tracking-[0.18em] text-[var(--template-text-inverse-subtle)]">{translate(locale, item.alt)}</p>
                                    </div>
                                    <div className="relative mb-5 ml-3 mr-3 aspect-[16/9] overflow-hidden rounded-[var(--template-radius-md)] border border-[var(--template-border-inverse)] [background:var(--template-surface-glass)]">
                                        {item.image ? (
                                            <Image
                                                src={item.image}
                                                alt={translate(locale, item.alt)}
                                                fill
                                                className="object-cover"
                                                unoptimized
                                            />
                                        ) : null}
                                    </div>
                                    <div className="pl-3">
                                        <h3 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--template-text-inverse)]">{translate(locale, item.title)}</h3>
                                        <RichTextRenderer content={translateNarrative(locale, item.description)} className="mt-3 text-sm leading-7 text-[var(--template-text-inverse-muted)]" />
                                        <p className="mt-4 text-[11px] uppercase tracking-[0.22em] text-[var(--template-text-inverse-subtle)]">{translate(locale, item.alt)}</p>
                                    </div>
                                    <ul className="mt-5 space-y-2 pl-3 text-sm text-[var(--template-text-inverse-muted)]">
                                        {item.features.map((feature) => <li key={feature.id}>• {translate(locale, feature)}</li>)}
                                    </ul>
                                </article>
                            ))}
                        </div>
                        <div className="mt-8">
                            <a
                                href={props.primaryHref}
                                data-analytics-cta="true"
                                data-analytics-name="services-showcase-primary"
                                data-analytics-placement="builder-block"
                                className={ctaPrimaryClasses()}
                            >
                                {translate(locale, props.primaryCta)}
                            </a>
                        </div>
                    </section>
                );
            },
        },
        MethodologyBlock: {
            label: "Methodology",
            fields: methodologyBlockFields,
            defaultProps: buildMethodologyProps("methodology"),
            render: (props) => {
                const locale = getRenderLocale(props);
                return (
                    <section className="overflow-hidden rounded-[var(--template-radius-xl)] border border-[var(--template-border-inverse)] [background:var(--template-surface-premium-raised)] px-6 py-8 text-[var(--template-text-inverse)] shadow-[var(--template-depth-lg)] md:px-8 md:py-10">
                        <div className="mb-8 max-w-3xl space-y-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--template-text-accent-strong)]">Methodology rail</p>
                            <h2 className="text-[var(--template-display-sm)] font-semibold leading-[0.98] tracking-[-0.04em]">{translate(locale, props.title)}</h2>
                            <RichTextRenderer content={translateNarrative(locale, props.subtitle)} className="text-sm leading-7 text-[var(--template-text-inverse-muted)] md:text-base" />
                        </div>
                        <div className="relative space-y-5 pl-12 before:absolute before:left-[1.15rem] before:top-0 before:bottom-0 before:w-px before:bg-[linear-gradient(180deg,var(--template-border-accent-soft),transparent)]">
                            {props.steps.map((step, index) => (
                                <InViewReveal key={step.id} delayMs={index * 70}>
                                    <article className="relative rounded-[var(--template-radius-lg)] border border-[var(--template-border-inverse)] [background:var(--template-surface-glass)] p-5 backdrop-blur-[18px] shadow-[var(--template-depth-md)]">
                                        <div className="absolute left-[-3rem] top-5 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--template-border-accent-soft)] bg-[color-mix(in_oklch,var(--template-accent)_12%,transparent)] text-sm font-semibold text-[var(--template-text-accent-strong)]">
                                            {step.stepNumber}
                                        </div>
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--template-text-accent-strong)]">Phase {step.stepNumber}</p>
                                        <h3 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-[var(--template-text-inverse)]">{translate(locale, step.title)}</h3>
                                        <RichTextRenderer content={translateNarrative(locale, step.description)} className="mt-3 text-sm leading-7 text-[var(--template-text-inverse-muted)]" />
                                    </article>
                                </InViewReveal>
                            ))}
                        </div>
                    </section>
                );
            },
        },
        TimelineBlock: {
            label: "Timeline / process",
            fields: timelineBlockFields,
            defaultProps: buildTimelineProps(),
            render: (props) => {
                const locale = getRenderLocale(props);
                return <SectionShell title={translate(locale, props.title)} style={props.style} eyebrow={translate(locale, props.eyebrow)}>
                    <RichTextRenderer content={translateNarrative(locale, props.description)} className={`mb-4 text-sm leading-7 ${sectionMutedTextClasses(props.style.surfaceTone)}`} />
                    <div className="space-y-3">{props.items.map((item) => <div key={item.id} className={`rounded-[var(--template-radius-md)] border p-4 ${surfaceCardClasses(props.style.surfaceTone)}`}><p className={`${EYEBROW_BASE} ${sectionSubtleTextClasses(props.style.surfaceTone)}`}>{item.step}</p><h3 className={`mt-2 font-semibold ${sectionTextClasses(props.style.surfaceTone)}`}>{translate(locale, item.title)}</h3><RichTextRenderer content={translateNarrative(locale, item.description)} className={`mt-2 text-sm ${sectionMutedTextClasses(props.style.surfaceTone)}`} /></div>)}</div>
                </SectionShell>;
            },
        },
        BasicProComparisonBlock: {
            label: "Basic vs Pro comparison",
            fields: basicProComparisonBlockFields,
            defaultProps: buildBasicProComparisonProps(),
            render: (props) => {
                const locale = getRenderLocale(props);
                return <SectionShell title={translate(locale, props.title)} style={props.style} eyebrow={translate(locale, props.eyebrow)}>
                    <RichTextRenderer content={translateNarrative(locale, props.description)} className={`mb-6 text-sm leading-7 ${sectionMutedTextClasses(props.style.surfaceTone)}`} />
                    <div className="grid gap-4 lg:grid-cols-2">
                        <div className={`rounded-[var(--template-radius-lg)] border p-5 ${surfaceCardClasses(props.style.surfaceTone)}`}>
                            <p className={`inline-flex rounded-[var(--template-radius-pill)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${sectionBadgeClasses(props.style.surfaceTone, "slate")}`}>Basic</p>
                            <h3 className={`mt-4 text-xl font-semibold ${sectionTextClasses(props.style.surfaceTone)}`}>{translate(locale, props.basicTitle)}</h3>
                            <RichTextRenderer content={translateNarrative(locale, props.basicSubtitle)} className={`mt-3 text-sm leading-7 ${sectionMutedTextClasses(props.style.surfaceTone)}`} />
                        </div>
                        <div className={`rounded-[var(--template-radius-lg)] border p-5 ${surfaceCardClasses(props.style.surfaceTone)}`}>
                            <p className={`inline-flex rounded-[var(--template-radius-pill)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${sectionBadgeClasses(props.style.surfaceTone, props.style.accentTone)}`}>Pro</p>
                            <h3 className={`mt-4 text-xl font-semibold ${sectionTextClasses(props.style.surfaceTone)}`}>{translate(locale, props.proTitle)}</h3>
                            <RichTextRenderer content={translateNarrative(locale, props.proSubtitle)} className={`mt-3 text-sm leading-7 ${sectionMutedTextClasses(props.style.surfaceTone)}`} />
                        </div>
                    </div>
                    <div className={`mt-6 overflow-hidden rounded-[var(--template-radius-lg)] border ${tableBorderClasses(props.style.surfaceTone)}`}>
                        <table className={`w-full text-left text-sm ${sectionMutedTextClasses(props.style.surfaceTone)}`}>
                            <thead className={tableHeadClasses(props.style.surfaceTone)}>
                                <tr>
                                    <th className="px-4 py-3">Capability</th>
                                    <th className="px-4 py-3">Basic</th>
                                    <th className="px-4 py-3">Pro</th>
                                </tr>
                            </thead>
                            <tbody>
                                {props.comparisonRows.map((row) => <tr key={row.id} className={`border-t ${tableBorderClasses(props.style.surfaceTone)}`}><td className={`px-4 py-3 font-medium ${sectionTextClasses(props.style.surfaceTone)}`}>{translate(locale, row.label)}</td><td className="px-4 py-3">{translate(locale, row.basic)}</td><td className="px-4 py-3">{translate(locale, row.pro)}</td></tr>)}
                            </tbody>
                        </table>
                    </div>
                </SectionShell>;
            },
        },
        TestimonialsBlock: {
            label: "Testimonials",
            fields: testimonialsBlockFields,
            defaultProps: buildTestimonialsProps(),
            render: (props) => {
                const locale = getRenderLocale(props);
                return <section className="overflow-hidden rounded-[var(--template-radius-xl)] border border-[var(--template-border-accent-soft)] [background:var(--template-surface-premium)] px-6 py-8 text-[var(--template-text-inverse)] shadow-[var(--template-depth-lg)] md:px-8 md:py-10">
                    <div className="max-w-3xl space-y-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--template-text-accent-strong)]">{translate(locale, props.eyebrow)}</p>
                        <h2 className="text-[var(--template-display-sm)] font-semibold leading-[0.98] tracking-[-0.04em]">{translate(locale, props.title)}</h2>
                        <RichTextRenderer content={translateNarrative(locale, props.description)} className="text-sm leading-7 text-[var(--template-text-inverse-muted)] md:text-base" />
                    </div>
                    <div className="mt-8 grid gap-8 lg:grid-cols-2">{props.items.map((item) => <blockquote key={item.id} className="relative border-l border-[var(--template-border-accent)] pl-8"><span className="absolute left-0 top-[-0.85rem] text-6xl leading-none text-[var(--template-text-accent-strong)]">“</span><RichTextRenderer content={translateNarrative(locale, item.quote)} className="text-lg leading-8 text-[var(--template-text-inverse-muted)] md:text-xl" /><footer className="mt-6 border-t border-[var(--template-border-inverse)] pt-4 text-sm font-medium text-[var(--template-text-inverse)]">{item.name} · {item.company}<div className="mt-1 text-xs font-normal uppercase tracking-[0.18em] text-[var(--template-text-inverse-subtle)]">{translate(locale, item.role)}</div></footer></blockquote>)}</div>
                </section>;
            },
        },
        ClientLogosBlock: {
            label: "Client logos",
            fields: clientLogosBlockFields,
            defaultProps: buildClientLogosProps(),
            render: (props) => {
                const locale = getRenderLocale(props);
                return <SectionShell title={translate(locale, props.title)} style={props.style} eyebrow={translate(locale, props.eyebrow)}>
                    <RichTextRenderer content={translateNarrative(locale, props.description)} className={`mb-4 text-sm leading-7 ${sectionMutedTextClasses(props.style.surfaceTone)}`} />
                    <div className="grid gap-3 md:grid-cols-3">{props.items.map((item) => <div key={item.id} className={`rounded-[var(--template-radius-md)] border px-4 py-5 text-center text-sm font-medium ${surfaceCardClasses(props.style.surfaceTone)}`}>{item.name}</div>)}</div>
                </SectionShell>;
            },
        },
        EnterpriseSupportBlock: {
            label: "Enterprise support",
            fields: enterpriseSupportBlockFields,
            defaultProps: buildEnterpriseSupportProps(),
            render: (props) => {
                const locale = getRenderLocale(props);
                return <SectionShell title={translate(locale, props.title)} style={props.style} eyebrow={translate(locale, props.eyebrow)}>
                    <RichTextRenderer content={translateNarrative(locale, props.description)} className={`mb-6 text-sm leading-7 ${sectionMutedTextClasses(props.style.surfaceTone)}`} />
                    <div className="grid gap-4 lg:grid-cols-2">
                        {props.items.map((item) => <article key={item.id} className={`rounded-[var(--template-radius-lg)] border p-5 ${surfaceCardClasses(props.style.surfaceTone)}`}><h3 className={`text-lg font-semibold ${sectionTextClasses(props.style.surfaceTone)}`}>{translate(locale, item.title)}</h3><RichTextRenderer content={translateNarrative(locale, item.description)} className={`mt-3 text-sm leading-7 ${sectionMutedTextClasses(props.style.surfaceTone)}`} /><ul className={`mt-4 space-y-2 text-sm ${sectionMutedTextClasses(props.style.surfaceTone)}`}>{item.supportPoints.map((point) => <li key={point.id}>• {translate(locale, point)}</li>)}</ul></article>)}
                    </div>
                    <a href={props.cta.href} data-analytics-cta="true" data-analytics-name="enterprise-support-primary" data-analytics-placement="builder-block" className={`mt-6 ${buttonToneClasses(props.style.accentTone)}`}>{translate(locale, props.cta.label)}</a>
                </SectionShell>;
            },
        },
        CtaBannerBlock: {
            label: "CTA banner",
            fields: ctaBannerBlockFields,
            defaultProps: buildCtaBannerProps(),
            render: (props) => {
                const locale = getRenderLocale(props);
                return <section className="relative overflow-hidden rounded-[var(--template-radius-xl)] border border-[var(--template-border-accent-soft)] [background:var(--template-surface-dark-strong)] px-6 py-10 text-[var(--template-text-inverse)] shadow-[var(--template-depth-lg)] md:px-8 md:py-12">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_oklch,var(--template-accent)_20%,transparent),transparent_30%),radial-gradient(circle_at_bottom_left,color-mix(in_oklch,var(--template-primary)_22%,transparent),transparent_44%)]" />
                    <div className="relative z-10 max-w-3xl space-y-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--template-text-accent-strong)]">{translate(locale, props.eyebrow)}</p>
                        <h2 className="text-[var(--template-display-sm)] font-semibold leading-[0.98] tracking-[-0.04em]">{translate(locale, props.title)}</h2>
                        <RichTextRenderer content={translateNarrative(locale, props.description)} className="text-sm leading-7 text-[var(--template-text-inverse-muted)] md:text-base" />
                    </div>
                    <div className={`relative z-10 mt-8 flex gap-3 ${props.ctaLayout === "stacked" ? "flex-col items-start" : "flex-wrap items-center"}`}>
                        <a href={props.primaryCta.href} data-analytics-cta="true" data-analytics-name="cta-banner-primary" data-analytics-placement="builder-block" className={ctaPrimaryClasses()}>{translate(locale, props.primaryCta.label)}</a>
                        <a href={props.secondaryCta.href} data-analytics-cta="true" data-analytics-name="cta-banner-secondary" data-analytics-placement="builder-block" className="inline-flex items-center rounded-[var(--template-radius-pill)] border border-[var(--template-border-accent)] px-5 py-3 text-sm font-medium text-[var(--template-text-accent-strong)] transition-colors duration-200 hover:bg-[color-mix(in_oklch,var(--template-accent)_12%,transparent)]">{translate(locale, props.secondaryCta.label)}</a>
                    </div>
                </section>;
            },
        },
        QuoteRequestBlock: {
            label: "Quote request strip",
            fields: quoteRequestBlockFields,
            defaultProps: buildQuoteRequestProps(),
            render: (props) => {
                const locale = getRenderLocale(props);
                return <SectionShell title={translate(locale, props.title)} style={props.style} eyebrow={translate(locale, props.eyebrow)}>
                    <RichTextRenderer content={translateRich(locale, props.richDescriptionEn, props.richDescriptionNl, props.description, props.richDescriptionAr)} className={sectionMutedTextClasses(props.style.surfaceTone)} />
                    <ul className={`space-y-2 text-sm ${sectionMutedTextClasses(props.style.surfaceTone)}`}>{props.offerItems.map((item) => <li key={item.id}>• {translate(locale, item)}</li>)}</ul>
                    <a href={props.primaryCta.href} data-analytics-cta="true" data-analytics-name="quote-request-primary" data-analytics-placement="builder-block" className={`mt-4 ${buttonToneClasses(props.style.accentTone)}`}>{translate(locale, props.primaryCta.label)}</a>
                </SectionShell>;
            },
        },
        GalleryBlock: {
            label: "Image gallery",
            fields: galleryBlockFields,
            defaultProps: buildGalleryProps(),
            render: (props) => {
                const locale = getRenderLocale(props);
                return <SectionShell title={translate(locale, props.title)} style={props.style} eyebrow={translate(locale, props.eyebrow)}>
                    <RichTextRenderer content={translateNarrative(locale, props.description)} className={`mb-4 text-sm leading-7 ${sectionMutedTextClasses(props.style.surfaceTone)}`} />
                    <div className="grid gap-4 md:grid-cols-3">{props.items.map((item) => <div key={item.id} className={`overflow-hidden rounded-[var(--template-radius-md)] border ${surfaceCardClasses(props.style.surfaceTone)}`}><div className="relative aspect-[4/3] w-full overflow-hidden [background:var(--template-surface-soft)]">{item.image ? <Image src={item.image} alt={translate(locale, item.alt)} fill className="object-cover" unoptimized /> : null}</div><div className="p-4"><p className={`text-sm font-medium ${sectionTextClasses(props.style.surfaceTone)}`}>{translate(locale, item.caption)}</p><p className={`mt-1 text-xs ${sectionSubtleTextClasses(props.style.surfaceTone)}`}>{translate(locale, item.alt)}</p></div></div>)}</div>
                </SectionShell>;
            },
        },
        VideoBlock: {
            label: "Video section",
            fields: videoBlockFields,
            defaultProps: buildVideoBlockProps(),
            render: (props) => {
                const locale = getRenderLocale(props);
                const videoUrl = resolveBuilderVideoSource(props.videoUrl);
                return <SectionShell title={translate(locale, props.title)} style={props.style} eyebrow={translate(locale, props.eyebrow)}>
                    <RichTextRenderer content={translateNarrative(locale, props.description)} className={`mb-4 text-sm leading-7 ${sectionMutedTextClasses(props.style.surfaceTone)}`} />
                    <div className={`overflow-hidden rounded-[var(--template-radius-lg)] border ${tableBorderClasses(props.style.surfaceTone)} [background:var(--template-surface-dark-strong)]`}>
                        {videoUrl ? (
                            <video
                                className="aspect-video w-full"
                                controls
                                playsInline
                                preload="metadata"
                                poster={props.posterUrl || undefined}
                            >
                                <source src={videoUrl} />
                            </video>
                        ) : (
                            <div className="relative aspect-video w-full">
                                <Image
                                    src={props.posterUrl || "/stealth-cto-hero.png"}
                                    alt=""
                                    fill
                                    className="object-cover"
                                    unoptimized
                                />
                            </div>
                        )}
                    </div>
                    <a href={props.primaryCta.href} data-analytics-cta="true" data-analytics-name="video-primary-cta" data-analytics-placement="builder-block" className={`mt-4 ${buttonToneClasses(props.style.accentTone)}`}>{translate(locale, props.primaryCta.label)}</a>
                </SectionShell>;
            },
        },
        SectorGridBlock: {
            label: "Sector grid",
            fields: sectorGridBlockFields,
            defaultProps: buildSectorGridProps(),
            render: (props) => {
                const locale = getRenderLocale(props);
                return <SectionShell title={translate(locale, props.title)} style={props.style} eyebrow={translate(locale, props.eyebrow)}>
                    <RichTextRenderer content={translateNarrative(locale, props.description)} className={`mb-4 text-sm leading-7 ${sectionMutedTextClasses(props.style.surfaceTone)}`} />
                    <div className="grid gap-4 md:grid-cols-3">{props.items.map((item) => <div key={item.id} className={`rounded-[var(--template-radius-md)] border p-4 ${surfaceCardClasses(props.style.surfaceTone)}`}><h3 className={`font-semibold ${sectionTextClasses(props.style.surfaceTone)}`}>{translate(locale, item.title)}</h3><RichTextRenderer content={translateNarrative(locale, item.description)} className={`mt-2 text-sm ${sectionMutedTextClasses(props.style.surfaceTone)}`} /><ul className={`mt-3 space-y-2 text-sm ${sectionMutedTextClasses(props.style.surfaceTone)}`}>{item.proofPoints.map((point) => <li key={point.id}>• {translate(locale, point)}</li>)}</ul></div>)}</div>
                </SectionShell>;
            },
        },
        ScopeMatrixBlock: {
            label: "Cleaning scope matrix",
            fields: scopeMatrixBlockFields,
            defaultProps: buildScopeMatrixProps(),
            render: (props) => {
                const locale = getRenderLocale(props);
                return <SectionShell title={translate(locale, props.title)} style={props.style} eyebrow={translate(locale, props.eyebrow)}>
                    <RichTextRenderer content={translateNarrative(locale, props.description)} className={`mb-4 text-sm leading-7 ${sectionMutedTextClasses(props.style.surfaceTone)}`} />
                    <div className={`overflow-hidden rounded-[var(--template-radius-md)] border ${tableBorderClasses(props.style.surfaceTone)}`}><table className={`w-full text-left text-sm ${sectionMutedTextClasses(props.style.surfaceTone)}`}><thead className={tableHeadClasses(props.style.surfaceTone)}><tr><th className="px-3 py-2">Item</th><th className="px-3 py-2">Frequency</th><th className="px-3 py-2">Result</th></tr></thead><tbody>{props.rows.map((row) => <tr key={row.id} className={`border-t ${tableBorderClasses(props.style.surfaceTone)}`}><td className={`px-3 py-2 ${sectionTextClasses(props.style.surfaceTone)}`}>{translate(locale, row.item)}</td><td className="px-3 py-2">{translate(locale, row.frequency)}</td><td className="px-3 py-2"><RichTextRenderer content={translateNarrative(locale, row.result)} className={`text-sm leading-7 ${sectionMutedTextClasses(props.style.surfaceTone)}`} /></td></tr>)}</tbody></table></div>
                </SectionShell>;
            },
        },
        PackagesBlock: {
            label: "Packages / service model",
            fields: packagesBlockFields,
            defaultProps: buildPackagesProps(),
            render: (props) => {
                const locale = getRenderLocale(props);
                return <SectionShell title={translate(locale, props.title)} style={props.style} eyebrow={translate(locale, props.eyebrow)}>
                    <RichTextRenderer content={translateNarrative(locale, props.description)} className={`mb-4 text-sm leading-7 ${sectionMutedTextClasses(props.style.surfaceTone)}`} />
                    <div className="grid gap-4 lg:grid-cols-2">{props.items.map((item) => <div key={item.id} className={`rounded-[var(--template-radius-md)] border p-4 ${surfaceCardClasses(props.style.surfaceTone)}`}><div className={`inline-flex rounded-[var(--template-radius-pill)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${sectionBadgeClasses(props.style.surfaceTone, props.style.accentTone)}`}>{translate(locale, item.badge)}</div><h3 className={`mt-3 text-lg font-semibold ${sectionTextClasses(props.style.surfaceTone)}`}>{translate(locale, item.title)}</h3><RichTextRenderer content={translateNarrative(locale, item.description)} className={`mt-2 text-sm ${sectionMutedTextClasses(props.style.surfaceTone)}`} /><ul className={`mt-4 space-y-2 text-sm ${sectionMutedTextClasses(props.style.surfaceTone)}`}>{item.features.map((feature) => <li key={feature.id}>• {translate(locale, feature)}</li>)}</ul></div>)}</div>
                </SectionShell>;
            },
        },
        SpacerBlock: {
            label: "Spacer",
            fields: spacerBlockFields,
            defaultProps: { id: "spacer", style: createSectionStyle({ surfaceTone: "light", cardStyle: "flat" }), height: "md" },
            render: (props) => <div className={{ sm: "h-6", md: "h-12", lg: "h-20", xl: "h-28" }[props.height]} />,
        },
        DividerBlock: {
            label: "Divider",
            fields: dividerBlockFields,
            defaultProps: { id: "divider", style: createSectionStyle({ surfaceTone: "light", cardStyle: "flat", alignment: "center" }), label: { en: "Section divider", nl: "Sectiescheiding" } },
            render: (props) => {
                const locale = getRenderLocale(props);
                const tone = props.style?.surfaceTone ?? "light";
                const lineClass = isInverseSurface(tone)
                    ? "h-px flex-1 bg-[var(--template-border-inverse)]"
                    : "h-px flex-1 bg-[var(--template-border-soft)]";
                return <div className="flex items-center gap-4 py-2"><div className={lineClass} /><span className={`${EYEBROW_BASE} ${sectionSubtleTextClasses(tone)}`}>{translate(locale, props.label)}</span><div className={lineClass} /></div>;
            },
        },
        SeoSupportBlock: {
            label: "SEO support narrative",
            fields: seoSupportBlockFields,
            defaultProps: buildSeoSupportProps(),
            render: (props) => {
                const locale = getRenderLocale(props);
                const placementClasses = props.placement === "top"
                    ? "order-first"
                    : props.placement === "middle"
                        ? "order-none"
                        : "order-last";
                const supportToneClasses = props.tone === "prominent"
                    ? "border-[var(--template-border-accent-soft)] [background:var(--template-surface-premium)] shadow-[var(--template-depth-glow)]"
                    : "border-[var(--template-border-soft)] [background:var(--template-surface-soft)]";

                return (
                    <section className={`rounded-[var(--template-radius-lg)] border px-5 py-5 ${supportToneClasses} ${placementClasses}`}>
                        <div className="max-w-3xl space-y-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--template-text-accent-strong)]">
                                {translate(locale, props.eyebrow)}
                            </p>
                            <h3 className={`text-xl font-semibold tracking-[-0.02em] ${sectionTextClasses(props.style.surfaceTone)}`}>
                                {translate(locale, props.title)}
                            </h3>
                            <RichTextRenderer
                                content={translateRich(locale, props.richDescriptionEn, props.richDescriptionNl, props.description, props.richDescriptionAr)}
                                className={`text-sm leading-7 ${sectionMutedTextClasses(props.style.surfaceTone)}`}
                            />
                        </div>
                    </section>
                );
            },
        },
        ContactBlock: {
            label: "Contact",
            fields: contactBlockFields,
            defaultProps: buildContactProps(),
            render: (props) => {
                const locale = getRenderLocale(props);
                return (
                    <SectionShell title={translate(locale, props.title)} style={props.style} eyebrow={translate(locale, props.eyebrow)}>
                        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                            <div className={`space-y-3 rounded-[var(--template-radius-md)] border p-4 ${surfaceCardClasses(props.style.surfaceTone)}`}>
                                <p className={`${EYEBROW_BASE} ${sectionSubtleTextClasses(props.style.surfaceTone)}`}>{translate(locale, props.eyebrow)}</p>
                                <RichTextRenderer content={translateNarrative(locale, props.description)} className={`text-sm leading-7 ${sectionMutedTextClasses(props.style.surfaceTone)}`} />
                                <div className={`space-y-2 text-sm ${sectionMutedTextClasses(props.style.surfaceTone)}`}>
                                    <p><span className="font-semibold">Email:</span> {props.email}</p>
                                    <p><span className="font-semibold">Phone:</span> {props.phone}</p>
                                    <p><span className="font-semibold">Address:</span> {translate(locale, props.address)}</p>
                                    <p><span className="font-semibold">KvK:</span> {props.kvk}</p>
                                    <p><span className="font-semibold">Hours:</span> {translate(locale, props.supportHours)}</p>
                                </div>
                                <div>
                                    <p className={`${EYEBROW_BASE} ${sectionSubtleTextClasses(props.style.surfaceTone)}`}>{translate(locale, props.trustTitle)}</p>
                                    <ul className={`mt-3 space-y-2 text-sm ${sectionMutedTextClasses(props.style.surfaceTone)}`}>
                                        {props.trustItems.map((item) => <li key={item.id}>• {translate(locale, item)}</li>)}
                                    </ul>
                                </div>
                            </div>
                            <div className={`space-y-4 rounded-[var(--template-radius-md)] border p-4 ${surfaceCardClasses(props.style.surfaceTone)}`}>
                                <div>
                                    <h3 className={`text-lg font-semibold ${sectionTextClasses(props.style.surfaceTone)}`}>{translate(locale, props.formTitle)}</h3>
                                    <RichTextRenderer content={translateNarrative(locale, props.formSubtitle)} className={`mt-2 text-sm leading-7 ${sectionMutedTextClasses(props.style.surfaceTone)}`} />
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className={`rounded border px-3 py-2 text-sm ${surfaceInputClasses(props.style.surfaceTone)}`}>{translate(locale, props.fieldName)}</div>
                                    <div className={`rounded border px-3 py-2 text-sm ${surfaceInputClasses(props.style.surfaceTone)}`}>{translate(locale, props.fieldCompany)}</div>
                                    <div className={`rounded border px-3 py-2 text-sm ${surfaceInputClasses(props.style.surfaceTone)}`}>{translate(locale, props.fieldEmail)}</div>
                                    <div className={`rounded border px-3 py-2 text-sm ${surfaceInputClasses(props.style.surfaceTone)}`}>{translate(locale, props.fieldPhone)}</div>
                                </div>
                                <div className={`rounded border px-3 py-2 text-sm ${surfaceInputClasses(props.style.surfaceTone)}`}>{translate(locale, props.fieldFacilitySize)}: {props.fieldFacilitySizeOptions.map((option) => translate(locale, option)).join(" · ")}</div>
                                <div className={`rounded border px-3 py-3 text-sm ${surfaceInputClasses(props.style.surfaceTone)}`}>{translate(locale, props.fieldNeeds)} — {translate(locale, props.formNeedsPlaceholder)}</div>
                                <div className={`rounded-[var(--template-radius-md)] border border-dashed border-[var(--template-border-accent-soft)] [background:color-mix(in_oklch,var(--template-accent)_8%,transparent)] px-3 py-3 text-sm ${sectionMutedTextClasses(props.style.surfaceTone)}`}><RichTextRenderer content={translateNarrative(locale, props.previewNotice)} className={`text-sm leading-7 ${sectionMutedTextClasses(props.style.surfaceTone)}`} /></div>
                                <div className={`w-fit ${ctaPrimaryClasses()}`}>{translate(locale, props.submitLabel)}</div>
                                <div className={`rounded-[var(--template-radius-md)] border border-[var(--template-border-accent-soft)] [background:color-mix(in_oklch,var(--template-text-accent-strong)_10%,transparent)] px-3 py-3 text-sm ${sectionMutedTextClasses(props.style.surfaceTone)}`}><RichTextRenderer content={translateNarrative(locale, props.successMessage)} className={`text-sm leading-7 ${sectionMutedTextClasses(props.style.surfaceTone)}`} /></div>
                                <div>
                                    <p className={`${EYEBROW_BASE} ${sectionSubtleTextClasses(props.style.surfaceTone)}`}>{translate(locale, props.faqTitle)}</p>
                                    <div className="mt-3 space-y-3">
                                        {props.faqItems.map((faq) => (
                                            <div key={faq.id} className={`rounded border p-3 ${surfaceInputClasses(props.style.surfaceTone)}`}>
                                                <p className={`font-medium ${sectionTextClasses(props.style.surfaceTone)}`}>{translate(locale, faq.question)}</p>
                                                <RichTextRenderer content={translateNarrative(locale, faq.answer)} className={`mt-2 text-sm leading-7 ${sectionMutedTextClasses(props.style.surfaceTone)}`} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </SectionShell>
                );
            },
        },
        // Extended layout blocks (insights, bento, pull quote, FAQ,
        // pricing, team, split CTA). Defined in extended-blocks.tsx so the
        // visual primitives + render functions stay in their own module
        // rather than swelling this file further.
        ...extendedBlocks,
        // Sector-landing block group — replaces the hand-coded
        // src/app/(public)/<slug>/page.tsx files for real-estate, legal,
        // horeca, etc. so the same EN/NL/AR copy is editable in the builder.
        ...sectorLandingBlocks,
        // Legal Vault marketing blocks — see legal-vault-blocks.tsx.
        ...legalVaultBlocks,
        // Resource / PDF assets marketing blocks — see resource-blocks.tsx.
        ...resourceBlocks,
        ...publicPuckComponents,
    },
} as Config<PuckComponents, RootProps, "facilityServices" | "publicSystems" | "layouts" | "sectorLanding" | "legalVault" | "resources">;

// Public render config: identical block registry and root fields as the editor config,
// but with a transparent root render so blocks control their own full-width layout.
export const puckRenderConfig = {
    ...puckConfig,
    root: {
        ...puckConfig.root,
        render: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    },
} as never;

export function createSeededPagePuckData(slug: string): PublicBuilderData | null {
    if (isCorePageKind(slug)) {
        return cloneData(seededPuckDataBySlug[slug]);
    }

    return null;
}

export function createSeededStructuredPageData(slug: string) {
    const data = buildFacilityServicesStructuredPageData();

    if (slug === "home") {
        return cloneData(data.home);
    }

    if (slug === "services") {
        return cloneData(data.services);
    }

    if (slug === "about") {
        return cloneData(data.about);
    }

    if (slug === "contact") {
        return cloneData(data.contact);
    }

    return null;
}

/** Set of all registered block type keys — used to filter unknown/corrupted blocks during normalization. */
export const KNOWN_BLOCK_TYPES = new Set<string>([
    "HeroBlock",
    "PositioningStripBlock",
    "IntroBannerBlock",
    "RichTextSectionBlock",
    "FeatureListBlock",
    "IconCardsBlock",
    "StoryBlock",
    "StatsBlock",
    "MetricsBlock",
    "OperationalProofBlock",
    "FoundationBlock",
    "AboutBlock",
    "CommitmentBlock",
    "ServicesShowcaseBlock",
    "MethodologyBlock",
    "BasicProComparisonBlock",
    "TimelineBlock",
    "TestimonialsBlock",
    "ClientLogosBlock",
    "EnterpriseSupportBlock",
    "CtaBannerBlock",
    "QuoteRequestBlock",
    "GalleryBlock",
    "VideoBlock",
    "SectorGridBlock",
    "ScopeMatrixBlock",
    "PackagesBlock",
    "SpacerBlock",
    "DividerBlock",
    "SeoSupportBlock",
    "ContactBlock",
    ...PUBLIC_PUCK_BLOCK_TYPES,
    ...EXTENDED_BLOCK_TYPES,
    ...SECTOR_LANDING_BLOCK_TYPES,
    ...LEGAL_VAULT_BLOCK_TYPES,
    ...RESOURCE_BLOCK_TYPES,
]);

export function ensureSeoSupportBlock(data: PublicBuilderData, pageKind?: PageKind): PublicBuilderData {
    const next = cloneData(data);
    next.content ??= [];

    const hasSeoSupportBlock = next.content.some((block) => block?.type === "SeoSupportBlock");
    if (hasSeoSupportBlock) {
        return next;
    }

    const derivedId = pageKind && pageKind !== "custom"
        ? `${pageKind}-seo-support`
        : "page-seo-support";

    next.content.push({
        type: "SeoSupportBlock",
        props: buildSeoSupportProps(derivedId),
    });

    return next;
}

export interface NormalizeOptions {
    /**
     * When true, do NOT auto-seed `SeoSupportBlock` into the fallback
     * empty layout. Used by blog posts, whose article-level JSON-LD is
     * emitted directly by the public route — a SeoSupportBlock there
     * would duplicate structured data and pollute the editor canvas
     * with a block that has no purpose on a post.
     */
    skipSeoSupportSeed?: boolean;
}

export function normalizePublicBuilderData(
    input: unknown,
    pageKind?: PageKind,
    options: NormalizeOptions = {},
): PublicBuilderData | null {
    if (!isPublicBuilderData(input)) {
        const fallback = pageKind && isCorePageKind(pageKind) ? createSeededPagePuckData(pageKind) : createEmptyPuckData();
        if (!fallback) return null;
        return options.skipSeoSupportSeed ? fallback : ensureSeoSupportBlock(fallback, pageKind);
    }

    const data = cloneData(input);
    data.root ??= { props: {} };
    data.root.props ??= {};

    if (pageKind) {
        data.root.props.pageKind = pageKind;
        if (pageKind !== "custom") {
            data.root.props.title ??= `Site ${pageKind.charAt(0).toUpperCase()}${pageKind.slice(1)}`;
        }
    }

    data.root.props.locale = data.root.props.locale === "nl"
        ? "nl"
        : data.root.props.locale === "ar"
            ? "ar"
            : "en";

    // Initialize arrays if missing
    data.content ??= [];
    data.zones ??= {};

    // Deep sanitize function to handle id types and object-to-array conversions expected by Puck
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function sanitizePuckProps(props: Record<string, any>): Record<string, any> {
        const sanitized = { ...props };
        for (const [key, value] of Object.entries(sanitized)) {
            // Enforce string IDs if an ID is present inside arrays/objects
            if (key === "id" && value !== undefined && value !== null) {
                sanitized[key] = String(value);
            } else if (Array.isArray(value)) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                sanitized[key] = value.map((item: any) => (typeof item === "object" && item !== null && !Array.isArray(item)) ? sanitizePuckProps(item) : item);
            } else if (typeof value === "object" && value !== null) {
                // Deeply sanitize nested objects
                sanitized[key] = sanitizePuckProps(value);
            }
        }
        
        // Specifically handle known array fields that might be malformed as objects from legacy data
        const knownArrayFields = ["trustBadges", "faqItems", "items", "methodologySteps", "steps", "supportingPoints", "whyPoints", "trustItems", "features"];
        for (const arrayField of knownArrayFields) {
            if (sanitized[arrayField] && !Array.isArray(sanitized[arrayField]) && typeof sanitized[arrayField] === "object") {
                 // Convert legacy bilingual object to a single-item array to preserve data without crashing
                 sanitized[arrayField] = [
                     { id: `legacy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ...sanitized[arrayField] }
                 ];
            }
        }
        return sanitized;
    }

    // Filter out nulls/undefined from root content array, drop unknown block types, and sanitize props
    /* eslint-disable @typescript-eslint/no-explicit-any */
    data.content = data.content
        .filter((block: any) => {
            if (!block || typeof block !== "object") return false;
            // Drop blocks with unrecognized type keys — they cannot be rendered
            if (typeof block.type !== "string" || !KNOWN_BLOCK_TYPES.has(block.type)) {
                if (process.env.NODE_ENV !== "production") console.warn(`[normalizePublicBuilderData] dropping unknown block type: ${block.type}`);
                return false;
            }
            return true;
        })
        .map((block: any) => ({
            ...block,
            props: sanitizePuckProps(block.props || {})
        }));

    // Filter out nulls/undefined from zone arrays and sanitize props
    Object.keys(data.zones).forEach((zoneKey) => {
        if (!data.zones?.[zoneKey] || !Array.isArray(data.zones[zoneKey]) || data.zones[zoneKey].length === 0) {
            delete data.zones?.[zoneKey];
        } else {
            data.zones[zoneKey] = data.zones[zoneKey]
                .filter((item: any) => {
                    if (!item || typeof item !== "object") return false;
                    if (typeof item.type !== "string" || !KNOWN_BLOCK_TYPES.has(item.type)) {
                        if (process.env.NODE_ENV !== "production") console.warn(`[normalizePublicBuilderData] dropping unknown zone block type: ${item.type}`);
                        return false;
                    }
                    return true;
                })
                .map((item: any) => ({
                    ...item,
                    props: sanitizePuckProps(item.props || {})
                }));
        }
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */

    // Do not force-reinsert SeoSupportBlock for existing builder data. Users may
    // intentionally delete it from a page and that deletion should persist
    // across normalization and save cycles. We only auto-seed the block when we
    // create fallback/initial page data above.
    return data;
}

export function createSeededPageVisualLayout(slug: string): VisualLayoutInput | null {
    const seeded = createSeededPagePuckData(slug);
    return seeded ? (seeded as unknown as VisualLayoutInput) : null;
}

export function isPublicBuilderData(value: unknown): value is PublicBuilderData {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }

    const candidate = value as Partial<PublicBuilderData>;
    return Boolean(candidate.root && typeof candidate.root === "object" && Array.isArray(candidate.content));
}
