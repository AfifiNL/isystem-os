// Plain-data constants for the extended block registry. Lives in its own
// module (without a "use client" directive) so it can be imported from
// shared puck.config.tsx in both server and client contexts. The matching
// React render functions live in extended-blocks.tsx ("use client") and
// must not leak into pure-data code paths like sitemap generation.

export const EXTENDED_BLOCK_TYPES = [
    "InsightsGridBlock",
    "BentoFeatureBlock",
    "PullQuoteBlock",
    "FaqAccordionBlock",
    "PricingTiersBlock",
    "TeamGridBlock",
    "CtaSplitBlock",
    "ToolsHighlightBlock",
    "WorkspaceProofLedgerBlock",
    "LegibilityHubQueryBlock",
    "PopupConversionLayerBlock",
    "NewsletterLifecycleBlock",
    "BookingLifecycleReportBlock",
    "FeatureStatusMatrixBlock",
    "DemoEvidenceGridBlock",
] as const;

export type ExtendedBlockType = typeof EXTENDED_BLOCK_TYPES[number];
