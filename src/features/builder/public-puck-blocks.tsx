import type { ReactNode } from "react";
import { renderPublicPageBlock } from "@/features/public-site/public-page-renderer";
import type { PublicPagePuckBlock } from "@/features/public-site/public-page-contract";
import {
    getIsystemPublicBlockDefaults,
    ISYSTEM_PUBLIC_GENERIC_BLOCK_COPY,
} from "@/features/public-site/isystem-public-copy";
import type { Locale } from "@/features/templates/types";

export interface PublicSemanticBlockProps {
    id: string;
    locale?: Locale;
    [key: string]: unknown;
}

const localizedField = (label: string, textarea = false) => ({
    type: "object",
    label,
    objectFields: {
        en: { type: textarea ? "textarea" : "text", label: "English" },
        nl: { type: textarea ? "textarea" : "text", label: "Dutch" },
        ar: { type: textarea ? "textarea" : "text", label: "Arabic (العربية)" },
    },
});

const copyFields = {
    id: { type: "text", label: "Block ID" },
    eyebrow: localizedField("Eyebrow"),
    title: localizedField("Title", true),
    description: localizedField("Description", true),
    locale: { type: "select", label: "Preview locale", options: [{ label: "English", value: "en" }, { label: "Dutch", value: "nl" }, { label: "Arabic", value: "ar" }] },
};

const outcomeHeroFields = {
    ...copyFields,
    headline: localizedField("Headline", true),
    subtitle: localizedField("Supporting copy", true),
    primaryCtaLabel: localizedField("Primary CTA"),
    primaryCtaHref: { type: "text", label: "Primary CTA href" },
    secondaryCtaLabel: localizedField("Secondary CTA"),
    secondaryCtaHref: { type: "text", label: "Secondary CTA href" },
    commercialLine: localizedField("Commercial line", true),
};

const defaultCopy = {
    id: "public-block",
    locale: "en" as const,
    ...ISYSTEM_PUBLIC_GENERIC_BLOCK_COPY,
};

const defaultHero = {
    ...defaultCopy,
    ...getIsystemPublicBlockDefaults("OutcomeHero"),
    primaryCtaHref: "/booking",
    secondaryCtaHref: "/services#system-map",
};

function semanticDefaults(type: string, props: Record<string, unknown> = {}): PublicSemanticBlockProps {
    return {
        ...defaultCopy,
        ...getIsystemPublicBlockDefaults(type),
        ...props,
    };
}

const blockTypes = [
    "Section",
    "Container",
    "Columns",
    "Stack",
    "Rule",
    "Spacer",
    "SurfaceBand",
    "OutcomeHero",
    "ProblemRecognition",
    "SystemMap",
    "OperatingLoop",
    "ServiceArchitecture",
    "OfferComparison",
    "ScopeBoundary",
    "MethodTimeline",
    "FounderWorkingModel",
    "FitAndNonFit",
    "QuestionAccordion",
    "FeatureStatusMatrix",
    "FinalDecisionCta",
    "ContactExperience",
    "ProductEvidenceWindow",
    "AnnotatedWorkspaceView",
    "WorkflowEvidence",
    "ProofLedger",
    "OutcomeCaseStudy",
    "MetricWithMethod",
    "TrustControlGrid",
    "SourceMethodology",
    "DeliveryChangelog",
    "DemoEvidenceGrid",
    "ArticleCollection",
    "PodcastCollection",
    "VideoCollection",
    "ResourceCollection",
    "CaseStudyCollection",
    "PublicToolCollection",
    "RelatedContent",
    "SearchPerformanceEvidence",
    "ContactExperience",
    "BookingExperience",
    "PaymentReturnSummary",
    "NewsletterSignup",
    "NewsletterPreferenceAction",
    "ResourceDownload",
    "PublicToolExperience",
    "SharedToolResult",
    "AuthExperience",
] as const;

export const PUBLIC_PUCK_BLOCK_TYPES = [...blockTypes] as const;

function renderSemantic(type: string, props: PublicSemanticBlockProps): ReactNode {
    const locale = props.locale === "nl" || props.locale === "ar" ? props.locale : "en";
    const block: PublicPagePuckBlock = { type, props };
    return <div data-public-puck-block={type}>{renderPublicPageBlock(block, locale, "preview")}</div>;
}

function component(label: string, fields: Record<string, unknown>, defaultProps: PublicSemanticBlockProps, type: string) {
    return {
        label,
        fields,
        defaultProps,
        render: (props: PublicSemanticBlockProps) => renderSemantic(type, props),
    };
}

export const publicPuckComponents = {
    OutcomeHero: component("Outcome hero", outcomeHeroFields, defaultHero, "OutcomeHero"),
    ProblemRecognition: component("Problem recognition", copyFields, semanticDefaults("ProblemRecognition"), "ProblemRecognition"),
    SystemMap: component("Five-system map", copyFields, semanticDefaults("SystemMap"), "SystemMap"),
    OperatingLoop: component("Operating loop", copyFields, semanticDefaults("OperatingLoop"), "OperatingLoop"),
    ServiceArchitecture: component("Service architecture", copyFields, semanticDefaults("ServiceArchitecture"), "ServiceArchitecture"),
    OfferComparison: component("Offer comparison", copyFields, semanticDefaults("OfferComparison"), "OfferComparison"),
    ScopeBoundary: component("Scope boundary", copyFields, semanticDefaults("ScopeBoundary"), "ScopeBoundary"),
    MethodTimeline: component("Method timeline", copyFields, semanticDefaults("MethodTimeline"), "MethodTimeline"),
    FounderWorkingModel: component("Founder working model", copyFields, semanticDefaults("FounderWorkingModel"), "FounderWorkingModel"),
    FitAndNonFit: component("Fit and non-fit", copyFields, semanticDefaults("FitAndNonFit"), "FitAndNonFit"),
    QuestionAccordion: component("Question accordion", copyFields, semanticDefaults("QuestionAccordion"), "QuestionAccordion"),
    FeatureStatusMatrix: component("Feature status matrix", copyFields, semanticDefaults("FeatureStatusMatrix"), "FeatureStatusMatrix"),
    FinalDecisionCta: component("Final decision CTA", copyFields, semanticDefaults("FinalDecisionCta", { href: "/booking" }), "FinalDecisionCta"),
    ContactExperience: component("Contact experience", copyFields, semanticDefaults("ContactExperience"), "ContactExperience"),
    ProductEvidenceWindow: component("Product evidence window", copyFields, defaultCopy, "ProductEvidenceWindow"),
    AnnotatedWorkspaceView: component("Annotated workspace view", copyFields, defaultCopy, "AnnotatedWorkspaceView"),
    WorkflowEvidence: component("Workflow evidence", copyFields, defaultCopy, "WorkflowEvidence"),
    ProofLedger: component("Proof ledger", copyFields, defaultCopy, "ProofLedger"),
    OutcomeCaseStudy: component("Outcome case study", copyFields, defaultCopy, "OutcomeCaseStudy"),
    MetricWithMethod: component("Metric with method", copyFields, defaultCopy, "MetricWithMethod"),
    TrustControlGrid: component("Trust control grid", copyFields, defaultCopy, "TrustControlGrid"),
    SourceMethodology: component("Source methodology", copyFields, defaultCopy, "SourceMethodology"),
    DeliveryChangelog: component("Delivery changelog", copyFields, defaultCopy, "DeliveryChangelog"),
    DemoEvidenceGrid: component("Demo evidence grid", copyFields, defaultCopy, "DemoEvidenceGrid"),
    Section: component("Section", copyFields, defaultCopy, "Section"),
    Container: component("Container", copyFields, defaultCopy, "Container"),
    Columns: component("Columns", copyFields, defaultCopy, "Columns"),
    Stack: component("Stack", copyFields, defaultCopy, "Stack"),
    Rule: component("Rule", copyFields, defaultCopy, "Rule"),
    Spacer: component("Spacer", copyFields, defaultCopy, "Spacer"),
    SurfaceBand: component("Surface band", copyFields, defaultCopy, "SurfaceBand"),
    ArticleCollection: component("Article collection", copyFields, defaultCopy, "ArticleCollection"),
    PodcastCollection: component("Podcast collection", copyFields, defaultCopy, "PodcastCollection"),
    VideoCollection: component("Video collection", copyFields, defaultCopy, "VideoCollection"),
    ResourceCollection: component("Resource collection", copyFields, defaultCopy, "ResourceCollection"),
    CaseStudyCollection: component("Case-study collection", copyFields, defaultCopy, "CaseStudyCollection"),
    PublicToolCollection: component("Public-tool collection", copyFields, defaultCopy, "PublicToolCollection"),
    RelatedContent: component("Related content", copyFields, defaultCopy, "RelatedContent"),
    SearchPerformanceEvidence: component("Search evidence", copyFields, defaultCopy, "SearchPerformanceEvidence"),
    BookingExperience: component("Booking experience (protected)", copyFields, defaultCopy, "BookingExperience"),
    PaymentReturnSummary: component("Payment return (protected)", copyFields, defaultCopy, "PaymentReturnSummary"),
    NewsletterSignup: component("Newsletter signup (protected)", copyFields, defaultCopy, "NewsletterSignup"),
    NewsletterPreferenceAction: component("Newsletter preferences (protected)", copyFields, defaultCopy, "NewsletterPreferenceAction"),
    ResourceDownload: component("Resource download (protected)", copyFields, defaultCopy, "ResourceDownload"),
    PublicToolExperience: component("Public tool (protected)", copyFields, defaultCopy, "PublicToolExperience"),
    SharedToolResult: component("Shared tool result (protected)", copyFields, defaultCopy, "SharedToolResult"),
    AuthExperience: component("Authentication (protected)", copyFields, defaultCopy, "AuthExperience"),
} as const;
