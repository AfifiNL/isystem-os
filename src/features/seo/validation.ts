import type { Json } from "@/shared/lib/supabase/database.types";
import { isPublicBuilderData } from "@/features/builder/puck.config";
import { resolveBuilderSignals } from "@/features/seo/lib/analysis";
import type {
    SeoAutomationTier,
    SeoBuilderBlockAdapter,
    SeoBuilderContentFormat,
    SeoBuilderMutationTarget,
    SeoMutationStrategy,
    SeoRendererCompatibilityStatus,
    SeoRendererType,
    SeoRiskCheckResult,
} from "@/features/seo/types";

type RecordLike = Record<string, unknown>;

export interface SeoMutableContentRecord {
    id: string;
    title: string;
    slug: string;
    type: string;
    content_markdown: string | null;
    metadata: Json | null;
    visual_layout?: Json | null;
}

export interface SeoContentSupportResult {
    supported: boolean;
    contentFormat: SeoBuilderContentFormat;
    renderer: SeoRendererType;
    mutationStrategy: SeoMutationStrategy;
    manualReviewReason: string | null;
    riskChecks: SeoRiskCheckResult[];
    targets: SeoBuilderMutationTarget[];
}

type BuilderRegistryField = {
    key: string;
    localized: boolean;
    contentFormat: Exclude<SeoBuilderContentFormat, "unsupported">;
    renderer: SeoRendererType;
    compatibilityStatus: SeoRendererCompatibilityStatus;
    automationTier?: Exclude<SeoAutomationTier, "manual_review">;
    reason: string;
    /**
     * Optional fallback read path when the primary rich field is empty. Used for blocks
     * like IntroBannerBlock where the rich variant lives at top-level props.richBodyEn
     * but the writable narrative source is props.body.en. The mutation still writes to
     * the primary path so the renderer (which reads top-level rich first) picks up the
     * link, while the engine can use the plain body for sentence/anchor selection.
     */
    fallbackReadPath?: string[];
};

type BuilderRegistryEntry = {
    adapter: SeoBuilderBlockAdapter;
    fields: BuilderRegistryField[];
};

function buildAdapter(input: SeoBuilderBlockAdapter): SeoBuilderBlockAdapter {
    return input;
}

const BUILDER_MUTATION_REGISTRY: BuilderRegistryEntry[] = [
    {
        adapter: buildAdapter({
            automationTier: "native",
            blockType: "ContactBlock",
            displayName: "Contact block",
            preferredInsertionStyle: "exact_then_rephrase_then_sentence",
            prefersExactReplacement: true,
            prefersRephrase: true,
            maxMutationScope: "single_sentence",
            fallbackAppendAllowed: false,
            sentencePolicy: "rephrase_then_append",
            allowedOutputFormat: "builder_rich_text_html",
            importanceScore: 88,
            conversionProximity: 95,
            safeFields: ["props.description.en", "props.description.nl", "props.formSubtitle.en", "props.formSubtitle.nl"],
        }),
        fields: [
            {
                key: "description",
                localized: true,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "manual_review_only",
                reason: "Contact narrative stays renderer-compatible, but auto-linking is blocked because contact sections are conversion-sensitive CTA surfaces.",
            },
            {
                key: "formSubtitle",
                localized: true,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "manual_review_only",
                reason: "Form supporting copy is renderer-compatible, but auto-linking is blocked because contact forms should not receive automated narrative rewrites.",
            },
            {
                key: "successMessage",
                localized: true,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "manual_review_only",
                reason: "Submission confirmation copy is renderer-compatible but operationally sensitive, so automatic hyperlink injection remains blocked.",
            },
            {
                key: "previewNotice",
                localized: true,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "manual_review_only",
                reason: "Preview notice copy is builder-only operational guidance and is excluded from automatic linking even though it uses rich-text rendering.",
            },
        ],
    },
    {
        adapter: buildAdapter({
            automationTier: "native",
            blockType: "IntroBannerBlock",
            displayName: "Intro banner block",
            preferredInsertionStyle: "exact_then_rephrase_then_sentence",
            prefersExactReplacement: true,
            prefersRephrase: true,
            maxMutationScope: "single_sentence",
            fallbackAppendAllowed: false,
            sentencePolicy: "rephrase_then_append",
            allowedOutputFormat: "builder_rich_text_html",
            importanceScore: 74,
            conversionProximity: 70,
            safeFields: ["props.richBodyEn", "props.richBodyNl", "props.body.en", "props.body.nl"],
        }),
        fields: [
            {
                key: "richBodyEn",
                localized: false,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "safe_automatic_linking",
                reason: "Intro rich body is rendered through the rich-text renderer and supports compact in-flow linking.",
                fallbackReadPath: ["props", "body", "en"],
            },
            {
                key: "richBodyNl",
                localized: false,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "safe_automatic_linking",
                reason: "Dutch intro rich body is renderer-safe for one compact link mutation.",
                fallbackReadPath: ["props", "body", "nl"],
            },
        ],
    },
    {
        adapter: buildAdapter({
            automationTier: "native",
            blockType: "RichTextSectionBlock",
            displayName: "Rich text section",
            preferredInsertionStyle: "exact_then_rephrase_then_sentence",
            prefersExactReplacement: true,
            prefersRephrase: true,
            maxMutationScope: "single_paragraph_fragment",
            fallbackAppendAllowed: true,
            sentencePolicy: "rephrase_then_append",
            allowedOutputFormat: "builder_rich_text_html",
            importanceScore: 92,
            conversionProximity: 62,
            safeFields: ["props.richBodyEn", "props.richBodyNl", "props.body.en", "props.body.nl"],
        }),
        fields: [
            {
                key: "richBodyEn",
                localized: false,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "safe_automatic_linking",
                reason: "Rich HTML body is the most flexible narrative surface for exact replacement, sentence insertion, or controlled semantic rephrase.",
                fallbackReadPath: ["props", "body", "en"],
            },
            {
                key: "richBodyNl",
                localized: false,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "safe_automatic_linking",
                reason: "Dutch rich narrative body is safe for validated HTML mutation through the same renderer path.",
                fallbackReadPath: ["props", "body", "nl"],
            },
        ],
    },
    {
        adapter: buildAdapter({
            automationTier: "native",
            blockType: "StoryBlock",
            displayName: "Story block",
            preferredInsertionStyle: "exact_then_rephrase_then_sentence",
            prefersExactReplacement: true,
            prefersRephrase: true,
            maxMutationScope: "single_paragraph_fragment",
            fallbackAppendAllowed: true,
            sentencePolicy: "rephrase_then_append",
            allowedOutputFormat: "builder_rich_text_html",
            importanceScore: 84,
            conversionProximity: 54,
            safeFields: ["props.richBodyEn", "props.richBodyNl", "props.body.en", "props.body.nl"],
        }),
        fields: [
            {
                key: "richBodyEn",
                localized: false,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "safe_automatic_linking",
                reason: "Story narrative is rendered through the rich-text renderer, making minimal linked rewrites visually safe.",
                fallbackReadPath: ["props", "body", "en"],
            },
            {
                key: "richBodyNl",
                localized: false,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "safe_automatic_linking",
                reason: "Dutch story narrative stays renderer-safe through the same rich-text path.",
                fallbackReadPath: ["props", "body", "nl"],
            },
        ],
    },
    {
        adapter: buildAdapter({
            automationTier: "native",
            blockType: "FeatureListBlock",
            displayName: "Feature list block",
            preferredInsertionStyle: "manual_review_only",
            prefersExactReplacement: false,
            prefersRephrase: false,
            maxMutationScope: "single_sentence",
            fallbackAppendAllowed: false,
            sentencePolicy: "manual_review_only",
            allowedOutputFormat: "builder_plain_text",
            importanceScore: 56,
            conversionProximity: 48,
            safeFields: ["props.description.en", "props.description.nl"],
        }),
        fields: [
            {
                key: "description",
                localized: true,
                contentFormat: "builder_plain_text",
                renderer: "builder_plain_text_literal",
                compatibilityStatus: "manual_review_only",
                reason: "Feature list descriptions are rendered as literal subtitles above structured UI cards, so automatic links are blocked.",
            },
        ],
    },
    {
        adapter: buildAdapter({
            automationTier: "native",
            blockType: "MethodologyBlock",
            displayName: "Methodology block",
            preferredInsertionStyle: "exact_then_rephrase_then_sentence",
            prefersExactReplacement: true,
            prefersRephrase: true,
            maxMutationScope: "single_sentence",
            fallbackAppendAllowed: false,
            sentencePolicy: "rephrase_then_append",
            allowedOutputFormat: "builder_rich_text_html",
            importanceScore: 58,
            conversionProximity: 52,
            safeFields: ["props.subtitle.en", "props.subtitle.nl"],
        }),
        fields: [
            {
                key: "subtitle",
                localized: true,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "safe_automatic_linking",
                reason: "Methodology subtitles resolve through the facility-services rich-text renderer, so validated HTML output remains field-compatible.",
            },
        ],
    },
    {
        adapter: buildAdapter({
            automationTier: "native",
            blockType: "TimelineBlock",
            displayName: "Timeline block",
            preferredInsertionStyle: "manual_review_only",
            prefersExactReplacement: false,
            prefersRephrase: false,
            maxMutationScope: "single_sentence",
            fallbackAppendAllowed: false,
            sentencePolicy: "manual_review_only",
            allowedOutputFormat: "builder_plain_text",
            importanceScore: 52,
            conversionProximity: 42,
            safeFields: ["props.description.en", "props.description.nl"],
        }),
        fields: [
            {
                key: "description",
                localized: true,
                contentFormat: "builder_plain_text",
                renderer: "builder_plain_text_literal",
                compatibilityStatus: "manual_review_only",
                reason: "Timeline descriptions are plain subtitle copy and must not receive raw markup automatically.",
            },
        ],
    },
    {
        adapter: buildAdapter({
            automationTier: "native",
            blockType: "AboutBlock",
            displayName: "About block",
            preferredInsertionStyle: "exact_then_rephrase_then_sentence",
            prefersExactReplacement: true,
            prefersRephrase: true,
            maxMutationScope: "single_sentence",
            fallbackAppendAllowed: false,
            sentencePolicy: "rephrase_then_append",
            allowedOutputFormat: "builder_rich_text_html",
            importanceScore: 66,
            conversionProximity: 44,
            safeFields: ["props.description.en", "props.description.nl", "props.missionText.en", "props.missionText.nl", "props.visionText.en", "props.visionText.nl"],
        }),
        fields: [
            {
                key: "description",
                localized: true,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "safe_automatic_linking",
                reason: "About narrative copy is rendered through the facility-services rich-text renderer, so automatic hyperlink output stays renderer-compatible.",
            },
            {
                key: "missionText",
                localized: true,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "safe_automatic_linking",
                reason: "Mission copy is rendered through the rich-text renderer inside the facility-services card layout, so validated HTML links remain safe.",
            },
            {
                key: "visionText",
                localized: true,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "safe_automatic_linking",
                reason: "Vision copy shares the same renderer-safe rich-text path as the mission card.",
            },
        ],
    },
    {
        adapter: buildAdapter({
            automationTier: "native",
            blockType: "ServicesShowcaseBlock",
            displayName: "Services showcase block",
            preferredInsertionStyle: "exact_then_rephrase_then_sentence",
            prefersExactReplacement: true,
            prefersRephrase: true,
            maxMutationScope: "single_sentence",
            fallbackAppendAllowed: false,
            sentencePolicy: "rephrase_then_append",
            allowedOutputFormat: "builder_rich_text_html",
            importanceScore: 80,
            conversionProximity: 84,
            safeFields: ["props.description.en", "props.description.nl"],
        }),
        fields: [
            {
                key: "description",
                localized: true,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "safe_automatic_linking",
                reason: "Services showcase narrative copy is rendered through the facility-services rich-text renderer, so HTML link mutations remain field-compatible.",
            },
        ],
    },
    {
        adapter: buildAdapter({
            automationTier: "native",
            blockType: "QuoteRequestBlock",
            displayName: "Quote request block",
            preferredInsertionStyle: "exact_then_rephrase_then_sentence",
            prefersExactReplacement: true,
            prefersRephrase: true,
            maxMutationScope: "single_sentence",
            fallbackAppendAllowed: false,
            sentencePolicy: "rephrase_then_append",
            allowedOutputFormat: "builder_rich_text_html",
            importanceScore: 90,
            conversionProximity: 94,
            safeFields: ["props.richDescriptionEn", "props.richDescriptionNl", "props.description.en", "props.description.nl"],
        }),
        fields: [
            {
                key: "richDescriptionEn",
                localized: false,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "manual_review_only",
                reason: "Quote-request narrative is renderer-compatible, but auto-linking is blocked because quote capture blocks are high-intent CTA surfaces.",
                fallbackReadPath: ["props", "description", "en"],
            },
            {
                key: "richDescriptionNl",
                localized: false,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "manual_review_only",
                reason: "Dutch quote-request narrative stays renderer-compatible, but auto-linking is blocked because quote capture blocks are high-intent CTA surfaces.",
                fallbackReadPath: ["props", "description", "nl"],
            },
        ],
    },
    {
        adapter: buildAdapter({
            automationTier: "native",
            blockType: "FoundationBlock",
            displayName: "Foundation block",
            preferredInsertionStyle: "exact_then_rephrase_then_sentence",
            prefersExactReplacement: true,
            prefersRephrase: true,
            maxMutationScope: "single_sentence",
            fallbackAppendAllowed: false,
            sentencePolicy: "rephrase_then_append",
            allowedOutputFormat: "builder_rich_text_html",
            importanceScore: 60,
            conversionProximity: 36,
            safeFields: ["props.description.en", "props.description.nl"],
        }),
        fields: [
            {
                key: "description",
                localized: true,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "safe_automatic_linking",
                reason: "Foundation narrative copy is rendered through the facility-services rich-text renderer, so automatic links remain HTML-safe.",
            },
            {
                key: "supportLine",
                localized: true,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "manual_review_only",
                reason: "Support-line copy renders through rich text but behaves like short utility emphasis, so automatic links remain blocked.",
            },
        ],
    },
    {
        adapter: buildAdapter({
            automationTier: "native",
            blockType: "CommitmentBlock",
            displayName: "Commitment block",
            preferredInsertionStyle: "exact_then_rephrase_then_sentence",
            prefersExactReplacement: true,
            prefersRephrase: true,
            maxMutationScope: "single_sentence",
            fallbackAppendAllowed: false,
            sentencePolicy: "rephrase_then_append",
            allowedOutputFormat: "builder_rich_text_html",
            importanceScore: 68,
            conversionProximity: 58,
            safeFields: ["props.description.en", "props.description.nl"],
        }),
        fields: [
            {
                key: "description",
                localized: true,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "safe_automatic_linking",
                reason: "Commitment copy is rendered through the facility-services rich-text renderer and is a safer narrative target than heading-level fields.",
            },
        ],
    },
    {
        adapter: buildAdapter({
            automationTier: "native",
            blockType: "HeroBlock",
            displayName: "Hero block",
            preferredInsertionStyle: "exact_then_rephrase_then_sentence",
            prefersExactReplacement: true,
            prefersRephrase: true,
            maxMutationScope: "single_sentence",
            fallbackAppendAllowed: false,
            sentencePolicy: "rephrase_then_append",
            allowedOutputFormat: "builder_rich_text_html",
            importanceScore: 76,
            conversionProximity: 78,
            safeFields: ["props.subtitle.en", "props.subtitle.nl"],
        }),
        fields: [
            {
                key: "subtitle",
                localized: true,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "manual_review_only",
                reason: "Hero copy is renderer-compatible, but auto-linking is blocked because hero sections are too prominent for unattended SEO rewrites.",
            },
        ],
    },
    {
        adapter: buildAdapter({
            automationTier: "native",
            blockType: "PositioningStripBlock",
            displayName: "Positioning strip block",
            preferredInsertionStyle: "exact_then_rephrase_then_sentence",
            prefersExactReplacement: true,
            prefersRephrase: true,
            maxMutationScope: "single_sentence",
            fallbackAppendAllowed: true,
            sentencePolicy: "rephrase_then_append",
            allowedOutputFormat: "builder_rich_text_html",
            importanceScore: 82,
            conversionProximity: 66,
            safeFields: ["props.description.en", "props.description.nl", "props.items.detail.en", "props.items.detail.nl"],
        }),
        fields: [
            {
                key: "description",
                localized: true,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "safe_automatic_linking",
                reason: "Positioning strip description is rich narrative copy rendered safely through the rich-text renderer.",
            },
        ],
    },
    {
        adapter: buildAdapter({
            automationTier: "native",
            blockType: "MetricsBlock",
            displayName: "Metrics block",
            preferredInsertionStyle: "exact_then_rephrase_then_sentence",
            prefersExactReplacement: true,
            prefersRephrase: true,
            maxMutationScope: "single_sentence",
            fallbackAppendAllowed: true,
            sentencePolicy: "rephrase_then_append",
            allowedOutputFormat: "builder_rich_text_html",
            importanceScore: 72,
            conversionProximity: 60,
            safeFields: ["props.description.en", "props.description.nl"],
        }),
        fields: [
            {
                key: "description",
                localized: true,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "safe_automatic_linking",
                reason: "Metrics intro copy is narrative rich text and remains renderer-safe for one contextual internal link.",
            },
        ],
    },
    {
        adapter: buildAdapter({
            automationTier: "native",
            blockType: "OperationalProofBlock",
            displayName: "Operational proof block",
            preferredInsertionStyle: "exact_then_rephrase_then_sentence",
            prefersExactReplacement: true,
            prefersRephrase: true,
            maxMutationScope: "single_sentence",
            fallbackAppendAllowed: true,
            sentencePolicy: "rephrase_then_append",
            allowedOutputFormat: "builder_rich_text_html",
            importanceScore: 78,
            conversionProximity: 68,
            safeFields: ["props.description.en", "props.description.nl"],
        }),
        fields: [
            {
                key: "description",
                localized: true,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "safe_automatic_linking",
                reason: "Operational proof intro copy is rich-text narrative and can carry a single validated internal link safely.",
            },
        ],
    },
    {
        adapter: buildAdapter({
            automationTier: "native",
            blockType: "TestimonialsBlock",
            displayName: "Testimonials block",
            preferredInsertionStyle: "exact_then_rephrase_then_sentence",
            prefersExactReplacement: true,
            prefersRephrase: true,
            maxMutationScope: "single_sentence",
            fallbackAppendAllowed: true,
            sentencePolicy: "rephrase_then_append",
            allowedOutputFormat: "builder_rich_text_html",
            importanceScore: 70,
            conversionProximity: 64,
            safeFields: ["props.description.en", "props.description.nl"],
        }),
        fields: [
            {
                key: "description",
                localized: true,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "manual_review_only",
                reason: "Testimonial framing copy is renderer-compatible, but auto-linking is blocked to avoid contaminating trust-oriented proof sections with SEO edits.",
            },
        ],
    },
    {
        adapter: buildAdapter({
            automationTier: "native",
            blockType: "ClientLogosBlock",
            displayName: "Client logos block",
            preferredInsertionStyle: "exact_then_rephrase_then_sentence",
            prefersExactReplacement: true,
            prefersRephrase: true,
            maxMutationScope: "single_sentence",
            fallbackAppendAllowed: true,
            sentencePolicy: "rephrase_then_append",
            allowedOutputFormat: "builder_rich_text_html",
            importanceScore: 62,
            conversionProximity: 46,
            safeFields: ["props.description.en", "props.description.nl"],
        }),
        fields: [
            {
                key: "description",
                localized: true,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "safe_automatic_linking",
                reason: "Client-logo support copy is narrative-rich text and can safely host one compact internal link without affecting logo labels.",
            },
        ],
    },
    {
        adapter: buildAdapter({
            automationTier: "native",
            blockType: "EnterpriseSupportBlock",
            displayName: "Enterprise support block",
            preferredInsertionStyle: "exact_then_rephrase_then_sentence",
            prefersExactReplacement: true,
            prefersRephrase: true,
            maxMutationScope: "single_sentence",
            fallbackAppendAllowed: true,
            sentencePolicy: "rephrase_then_append",
            allowedOutputFormat: "builder_rich_text_html",
            importanceScore: 86,
            conversionProximity: 82,
            safeFields: ["props.description.en", "props.description.nl"],
        }),
        fields: [
            {
                key: "description",
                localized: true,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "safe_automatic_linking",
                reason: "Enterprise support narrative is rich-text explanatory copy and is a safe surface for one contextual internal link.",
            },
        ],
    },
    {
        adapter: buildAdapter({
            automationTier: "native",
            blockType: "CtaBannerBlock",
            displayName: "CTA banner block",
            preferredInsertionStyle: "exact_then_rephrase_then_sentence",
            prefersExactReplacement: true,
            prefersRephrase: true,
            maxMutationScope: "single_sentence",
            fallbackAppendAllowed: true,
            sentencePolicy: "rephrase_then_append",
            allowedOutputFormat: "builder_rich_text_html",
            importanceScore: 74,
            conversionProximity: 88,
            safeFields: ["props.description.en", "props.description.nl"],
        }),
        fields: [
            {
                key: "description",
                localized: true,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "manual_review_only",
                reason: "CTA banner copy is renderer-compatible, but auto-linking is blocked because CTA sections should not be altered by unattended SEO rewrites.",
            },
        ],
    },
    {
        adapter: buildAdapter({
            automationTier: "native",
            blockType: "GalleryBlock",
            displayName: "Gallery block",
            preferredInsertionStyle: "exact_then_rephrase_then_sentence",
            prefersExactReplacement: true,
            prefersRephrase: true,
            maxMutationScope: "single_sentence",
            fallbackAppendAllowed: true,
            sentencePolicy: "rephrase_then_append",
            allowedOutputFormat: "builder_rich_text_html",
            importanceScore: 60,
            conversionProximity: 42,
            safeFields: ["props.description.en", "props.description.nl"],
        }),
        fields: [
            {
                key: "description",
                localized: true,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "safe_automatic_linking",
                reason: "Gallery intro copy is narrative rich text and can safely absorb a single supporting internal link.",
            },
        ],
    },
    {
        adapter: buildAdapter({
            automationTier: "native",
            blockType: "SectorGridBlock",
            displayName: "Sector grid block",
            preferredInsertionStyle: "exact_then_rephrase_then_sentence",
            prefersExactReplacement: true,
            prefersRephrase: true,
            maxMutationScope: "single_sentence",
            fallbackAppendAllowed: true,
            sentencePolicy: "rephrase_then_append",
            allowedOutputFormat: "builder_rich_text_html",
            importanceScore: 84,
            conversionProximity: 76,
            safeFields: ["props.description.en", "props.description.nl"],
        }),
        fields: [
            {
                key: "description",
                localized: true,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "safe_automatic_linking",
                reason: "Sector-grid intro copy is rich-text narrative and offers a safe native surface before the engine falls back to a dedicated SEO block.",
            },
        ],
    },
    {
        adapter: buildAdapter({
            automationTier: "native",
            blockType: "ScopeMatrixBlock",
            displayName: "Scope matrix block",
            preferredInsertionStyle: "exact_then_rephrase_then_sentence",
            prefersExactReplacement: true,
            prefersRephrase: true,
            maxMutationScope: "single_sentence",
            fallbackAppendAllowed: true,
            sentencePolicy: "rephrase_then_append",
            allowedOutputFormat: "builder_rich_text_html",
            importanceScore: 68,
            conversionProximity: 58,
            safeFields: ["props.description.en", "props.description.nl"],
        }),
        fields: [
            {
                key: "description",
                localized: true,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "safe_automatic_linking",
                reason: "Scope-matrix intro copy is rich-text narrative and remains safe for one renderer-compatible internal link.",
            },
        ],
    },
    {
        adapter: buildAdapter({
            automationTier: "native",
            blockType: "PackagesBlock",
            displayName: "Packages block",
            preferredInsertionStyle: "exact_then_rephrase_then_sentence",
            prefersExactReplacement: true,
            prefersRephrase: true,
            maxMutationScope: "single_sentence",
            fallbackAppendAllowed: true,
            sentencePolicy: "rephrase_then_append",
            allowedOutputFormat: "builder_rich_text_html",
            importanceScore: 72,
            conversionProximity: 70,
            safeFields: ["props.description.en", "props.description.nl"],
        }),
        fields: [
            {
                key: "description",
                localized: true,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "safe_automatic_linking",
                reason: "Packages intro copy is rich-text narrative and can carry one contextual internal link without touching package labels or badges.",
            },
        ],
    },
    {
        adapter: buildAdapter({
            automationTier: "native",
            blockType: "SeoSupportBlock",
            displayName: "SEO support block",
            preferredInsertionStyle: "exact_then_sentence_then_rephrase",
            prefersExactReplacement: true,
            prefersRephrase: true,
            maxMutationScope: "single_sentence",
            fallbackAppendAllowed: true,
            sentencePolicy: "append_then_rephrase",
            allowedOutputFormat: "builder_rich_text_html",
            importanceScore: 140,
            conversionProximity: 72,
            safeFields: ["props.richDescriptionEn", "props.richDescriptionNl", "props.description.en", "props.description.nl"],
        }),
        fields: [
            {
                key: "richDescriptionEn",
                localized: false,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "manual_review_only",
                reason: "Reserved English SEO support narrative exists for manual editorial enrichment only and is excluded from auto-apply.",
                fallbackReadPath: ["props", "description", "en"],
            },
            {
                key: "richDescriptionNl",
                localized: false,
                contentFormat: "builder_rich_text_html",
                renderer: "builder_rich_text_renderer",
                compatibilityStatus: "manual_review_only",
                reason: "Reserved Dutch SEO support narrative exists for manual editorial enrichment only and is excluded from auto-apply.",
                fallbackReadPath: ["props", "description", "nl"],
            },
        ],
    },
];

function asRecord(value: unknown): RecordLike {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    return value as RecordLike;
}

function pushRisk(
    riskChecks: SeoRiskCheckResult[],
    input: Omit<SeoRiskCheckResult, "severity"> & { severity?: SeoRiskCheckResult["severity"] },
) {
    riskChecks.push({
        severity: input.severity ?? (input.passed ? "info" : "error"),
        ...input,
    });
}

function getPreferredLocale(content: SeoMutableContentRecord) {
    if (!content.visual_layout || typeof content.visual_layout !== "object" || Array.isArray(content.visual_layout)) {
        return "en";
    }

    const root = asRecord((content.visual_layout as RecordLike).root);
    const props = asRecord(root.props);
    return typeof props.locale === "string" && props.locale.trim() ? props.locale.trim() : "en";
}

function getStringAtPath(value: unknown, path: string[]) {
    let current: unknown = value;

    for (const segment of path) {
        if (!current || typeof current !== "object" || Array.isArray(current)) {
            return null;
        }
        current = (current as RecordLike)[segment];
    }

    return typeof current === "string" && current.trim().length > 0 ? current : null;
}

function normalizeWords(value: string) {
    return value
        .toLowerCase()
        .replace(/<[^>]+>/g, " ")
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length >= 4);
}

function semanticOverlapScore(text: string, context: string) {
    const textWords = new Set(normalizeWords(text));
    const contextWords = new Set(normalizeWords(context));
    if (textWords.size === 0 || contextWords.size === 0) {
        return 0;
    }

    let overlap = 0;
    for (const word of textWords) {
        if (contextWords.has(word)) {
            overlap += 1;
        }
    }

    return Math.min(28, overlap * 4);
}

function getPreferredStrategies(entry: BuilderRegistryEntry, field: BuilderRegistryField): SeoMutationStrategy[] {
    if (field.compatibilityStatus !== "safe_automatic_linking") {
        return ["manual_review"];
    }

    if (field.contentFormat === "builder_markdown") {
        return ["builder_structured_markdown_link", "builder_structured_markdown_rephrase_link"];
    }

    if (entry.adapter.sentencePolicy === "rephrase_only") {
        return ["builder_structured_html_text_node", "builder_structured_html_rephrase_link"];
    }
    if (entry.adapter.sentencePolicy === "append_only") {
        return ["builder_structured_html_text_node"];
    }
    if (entry.adapter.sentencePolicy === "rephrase_then_append") {
        return ["builder_structured_html_text_node", "builder_structured_html_rephrase_link"];
    }

    return ["builder_structured_html_text_node", "builder_structured_html_rephrase_link"];
}

function rankBuilderMutationTarget(content: SeoMutableContentRecord, target: Omit<SeoBuilderMutationTarget, "rankingScore" | "rankingBreakdown">) {
    const breakdown: string[] = [];
    let score = 0;
    const normalized = target.currentValue.toLowerCase();
    const signals = resolveBuilderSignals(content.metadata);
    const pageContext = [content.title, content.slug, content.type, signals.pageIntent ?? "", signals.conversionGoal ?? ""].filter(Boolean).join(" ");

    const semanticFit = semanticOverlapScore(target.currentValue, pageContext);
    score += semanticFit;
    breakdown.push(`Semantic relevance +${semanticFit}`);

    const fieldSuitability = target.compatibilityStatus === "safe_automatic_linking" ? 24 : -38;
    score += fieldSuitability;
    breakdown.push(`Renderer compatibility ${fieldSuitability >= 0 ? `+${fieldSuitability}` : fieldSuitability}`);

    const lengthScore = target.currentValue.length >= 320 ? 16 : target.currentValue.length >= 180 ? 11 : target.currentValue.length >= 90 ? 6 : 1;
    score += lengthScore;
    breakdown.push(`Field length +${lengthScore}`);

    const conversionScore = Math.min(18, Math.round(target.adapter.conversionProximity / 6));
    score += conversionScore;
    breakdown.push(`Conversion metadata +${conversionScore}`);

    score += target.adapter.importanceScore;
    breakdown.push(`Block importance +${target.adapter.importanceScore}`);

    const rendererBonus = target.renderer === "builder_rich_text_renderer" ? 22 : target.renderer === "builder_markdown_renderer" ? 12 : -30;
    score += rendererBonus;
    breakdown.push(`Output compatibility ${rendererBonus >= 0 ? `+${rendererBonus}` : rendererBonus}`);

    const readability = /[.!?]/.test(normalized) ? 10 : 3;
    score += readability;
    breakdown.push(`Readability confidence +${readability}`);

    const intentBonus = content.slug === "contact" && target.blockType === "QuoteRequestBlock"
        ? 14
        : content.slug === "contact" && target.blockType === "ContactBlock"
            ? -28
            : 0;
    score += intentBonus;
    if (intentBonus !== 0) {
        breakdown.push(`Page-intent adjustment ${intentBonus >= 0 ? `+${intentBonus}` : intentBonus}`);
    }

    const orderBonus = Math.max(0, 12 - target.sourceOrder);
    score += orderBonus;
    breakdown.push(`Block order +${orderBonus}`);

    const automationTierBonus = target.automationTier === "native"
        ? 26
        : target.automationTier === "fallback_field"
            ? 18
            : -60;
    score += automationTierBonus;
    breakdown.push(`Automation tier ${automationTierBonus >= 0 ? `+${automationTierBonus}` : automationTierBonus}`);

    return {
        rankingScore: score,
        rankingBreakdown: breakdown,
    };
}

export function getBuilderMutationTargets(content: SeoMutableContentRecord): SeoBuilderMutationTarget[] {
    if (!isPublicBuilderData(content.visual_layout)) {
        return [];
    }

    const preferredLocale = getPreferredLocale(content);

    return content.visual_layout.content.flatMap((block, sourceOrder) => {
        const registry = BUILDER_MUTATION_REGISTRY.find((entry) => entry.adapter.blockType === block.type);
        if (!registry) {
            return [];
        }

        const props = asRecord(block.props);
        const blockId = typeof props.id === "string" && props.id.trim().length > 0 ? props.id : `${block.type}-${sourceOrder}`;

        return registry.fields.flatMap((field) => {
            const locale = field.localized ? preferredLocale : field.key.endsWith("Nl") ? "nl" : field.key.endsWith("En") ? "en" : null;
            const richLocaleKey = preferredLocale === "nl" ? "richNl" : "richEn";
            const plainLocaleKey = preferredLocale === "nl" ? "nl" : "en";
            const localizedFieldKey = field.contentFormat === "builder_rich_text_html" ? richLocaleKey : preferredLocale;
            const pathSegments = field.localized ? ["props", field.key, localizedFieldKey] : ["props", field.key];
            let currentValue = getStringAtPath(block, pathSegments);

            // Mirror getRichTextLocaleValue fallback: richEn/richNl may be undefined on template-initialized blocks
            if (!currentValue && field.localized && field.contentFormat === "builder_rich_text_html") {
                currentValue = getStringAtPath(block, ["props", field.key, plainLocaleKey]);
            }

            // Explicit fallback read path. Used by top-level rich fields (richBodyEn /
            // richDescriptionEn) whose narrative source actually lives in plain `body.en`
            // / `description.en`. Without this fallback the engine would skip the block
            // because the rich field is undefined on legacy template-initialized pages.
            // The mutation still writes to `pathSegments` so the renderer picks it up.
            if (!currentValue && field.fallbackReadPath) {
                currentValue = getStringAtPath(block, field.fallbackReadPath);
            }

            if (!currentValue || currentValue.trim().length < 30) {
                return [];
            }

            const baseTarget = {
                blockId,
                blockType: block.type,
                fieldPath: pathSegments.join("."),
                locale,
                contentFormat: field.contentFormat,
                renderer: field.renderer,
                compatibilityStatus: field.compatibilityStatus,
                automationTier: field.compatibilityStatus === "safe_automatic_linking"
                    ? (field.automationTier ?? registry.adapter.automationTier ?? "native")
                    : "manual_review",
                preferredStrategies: getPreferredStrategies(registry, field),
                adapter: registry.adapter,
                currentValue,
                reason: field.reason,
                compatibilityNote: field.compatibilityStatus === "safe_automatic_linking"
                    ? "Field is rendered through a rich-text-compatible surface, so validated HTML output can render safely."
                    : field.renderer === "builder_plain_text_literal"
                        ? "Field is rendered as literal plain text in the public UI, so automatic link injection is blocked."
                        : "Field is renderer-compatible, but this surface is policy-protected and remains manual-review only for narrative or conversion reasons.",
                sourceOrder,
            } satisfies Omit<SeoBuilderMutationTarget, "rankingScore" | "rankingBreakdown">;

            const ranking = rankBuilderMutationTarget(content, baseTarget);

            return [{
                ...baseTarget,
                ...ranking,
            } satisfies SeoBuilderMutationTarget];
        });
    }).sort((left, right) => right.rankingScore - left.rankingScore);
}

export function assessSeoMutationSupport(
    content: SeoMutableContentRecord,
    options?: { aggressiveMode?: boolean },
): SeoContentSupportResult {
    const riskChecks: SeoRiskCheckResult[] = [];
    const metadata = asRecord(content.metadata);
    const hasManualBuilder = Boolean(metadata.manual_builder && typeof metadata.manual_builder === "object");
    const hasVisualLayout = isPublicBuilderData(content.visual_layout);
    const source = typeof metadata.source === "string" ? metadata.source : null;
    // In aggressive mode, unlock policy-locked narrative surfaces (Hero/CTA/Contact/QuoteRequest)
    // so risk checks, manualReviewReason, and the support flag all reflect the actual
    // automation surface instead of the conservative-mode default.
    const targets = (options?.aggressiveMode
        ? getBuilderMutationTargets(content).map((target) =>
            target.compatibilityStatus === "safe_automatic_linking" || target.renderer === "builder_plain_text_literal"
                ? target
                : {
                    ...target,
                    compatibilityStatus: "safe_automatic_linking" as const,
                    automationTier: target.automationTier === "manual_review" ? ("native" as const) : target.automationTier,
                    compatibilityNote: `${target.compatibilityNote} (Aggressive automation mode unlocked this policy-locked surface for auto-linking.)`,
                })
        : getBuilderMutationTargets(content));
    const automaticTargets = targets.filter((target) => target.compatibilityStatus === "safe_automatic_linking");
    const nativeTargets = automaticTargets.filter((target) => target.automationTier === "native");
    const fallbackTargets = automaticTargets.filter((target) => target.automationTier === "fallback_field");
    const protectedTargets = targets.filter((target) => target.compatibilityStatus !== "safe_automatic_linking" && target.renderer !== "builder_plain_text_literal");

    pushRisk(riskChecks, {
        key: "has_content",
        label: "Source field contains editable content",
        passed: hasVisualLayout,
        message: hasVisualLayout
            ? "Structured builder data is available for safe field-level mutation."
            : "No supported builder-managed visual layout is available.",
    });

    pushRisk(riskChecks, {
        key: "builder_managed",
        label: "Builder-managed content detected",
        passed: hasVisualLayout,
        message: hasVisualLayout
            ? "Builder-managed visual layout was detected and will be mutated through structured field paths only."
            : "This execution layer only supports builder-managed visual layout data.",
    });

    pushRisk(riskChecks, {
        key: "manual_builder",
        label: "Manual builder flow preserved",
        passed: !hasManualBuilder,
        severity: hasManualBuilder ? "warning" : "info",
        message: !hasManualBuilder
            ? "No manual builder payload was detected."
            : "This item stores manual builder section data. Automatic mutation is avoided to preserve editor fidelity.",
    });

    if (!hasVisualLayout) {
        return {
            supported: false,
            contentFormat: "unsupported",
            renderer: "manual_review_required",
            mutationStrategy: "manual_review",
            manualReviewReason: "The source item does not contain a supported builder-managed visual layout.",
            riskChecks,
            targets,
        };
    }

    if (hasManualBuilder || source === "manual") {
        return {
            supported: false,
            contentFormat: "unsupported",
            renderer: "manual_review_required",
            mutationStrategy: "manual_review",
            manualReviewReason: "This content is maintained through the manual blog builder. Automatic mutation is blocked to preserve section-level authoring data.",
            riskChecks,
            targets: [],
        };
    }

    pushRisk(riskChecks, {
        key: "registry_targets",
        label: "Registry found builder narrative candidates",
        passed: targets.length > 0,
        severity: targets.length > 0 ? "info" : "warning",
        message: targets.length > 0
            ? `The builder mutation registry identified ${targets.length} candidate field${targets.length === 1 ? "" : "s"} with renderer-aware diagnostics.`
            : "No builder field matched this layout, so manual review is required.",
    });

    pushRisk(riskChecks, {
        key: "renderer_compatibility",
        label: "Renderer compatibility enforced",
        passed: automaticTargets.length > 0,
        severity: automaticTargets.length > 0 ? "info" : "warning",
        message: automaticTargets.length > 0
            ? `Only ${automaticTargets.length} renderer-compatible narrative field${automaticTargets.length === 1 ? "" : "s"} remain eligible for automatic linking. Plain-text fields stay manual-review only.`
            : protectedTargets.length > 0
                ? `Renderer-compatible narrative field${protectedTargets.length === 1 ? " remains" : "s remain"}, but they are policy-protected and therefore stop at manual review instead of unattended SEO mutation.`
                : "No renderer-compatible field could safely render an automatic link, so the engine will stop at manual review instead of forcing markup into literal UI copy.",
    });

    pushRisk(riskChecks, {
        key: "in_flow_only",
        label: "Auto-apply stays inside native in-flow copy",
        passed: fallbackTargets.length === 0,
        severity: fallbackTargets.length === 0 ? "info" : "warning",
        message: fallbackTargets.length === 0
            ? "Automatic execution will only touch existing native narrative fields. Dedicated SEO support sections remain manual-only."
            : `Detected ${fallbackTargets.length} fallback field${fallbackTargets.length === 1 ? "" : "s"}, but they are excluded from auto-apply and remain manual-review only.`,
    });

    if (automaticTargets.length === 0) {
        return {
            supported: false,
            contentFormat: "unsupported",
            renderer: "manual_review_required",
            mutationStrategy: "manual_review",
            manualReviewReason: protectedTargets.length > 0
                ? "Only policy-protected narrative surfaces matched this layout. Manual editorial review is required instead of unattended SEO mutation."
                : "No renderer-compatible builder field matched this layout. Manual editorial review is required instead of forcing a mutation into plain text UI copy.",
            riskChecks,
            targets,
        };
    }

    const preferredTarget = automaticTargets[0];
    pushRisk(riskChecks, {
        key: "target_ranking",
        label: "Best-ranked compatible target selected first",
        passed: true,
        severity: "info",
        message: `Top automatic candidate is ${preferredTarget.blockType}.${preferredTarget.fieldPath} with ranking ${preferredTarget.rankingScore}. Lower-ranked compatible targets remain available as safe fallbacks.`,
    });

    if (nativeTargets.length === 0 && automaticTargets.length > 0) {
        pushRisk(riskChecks, {
            key: "native_fields_optional",
            label: "Auto-apply depends on native narrative surfaces",
            passed: true,
            severity: "info",
            message: "No protected fallback section will be created. Automatic execution proceeds only because at least one native narrative field remains eligible.",
        });
    }

    return {
        supported: true,
        contentFormat: preferredTarget.contentFormat,
        renderer: preferredTarget.renderer,
        mutationStrategy: preferredTarget.preferredStrategies[0] ?? "manual_review",
        manualReviewReason: null,
        riskChecks,
        targets,
    };
}

export function verifySeoTargetInventory(content: SeoMutableContentRecord) {
    const support = assessSeoMutationSupport(content);
    const nativeTargets = support.targets.filter((target) => target.automationTier === "native");
    const fallbackTargets = support.targets.filter((target) => target.automationTier === "fallback_field");

    return {
        supported: support.supported,
        totalTargets: support.targets.length,
        nativeTargets: nativeTargets.length,
        fallbackTargets: fallbackTargets.length,
        topTarget: support.targets[0]
            ? {
                blockType: support.targets[0].blockType,
                fieldPath: support.targets[0].fieldPath,
                automationTier: support.targets[0].automationTier,
                rankingScore: support.targets[0].rankingScore,
            }
            : null,
        riskChecks: support.riskChecks,
        manualReviewReason: support.manualReviewReason,
    };
}
