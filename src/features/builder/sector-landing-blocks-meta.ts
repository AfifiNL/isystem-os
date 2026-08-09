// Plain-data registry for the sector-landing block group. Mirrors the
// pattern in extended-blocks-meta.ts: keep the type list out of the client
// module so it can be imported from puck.config.tsx in any context.

export const SECTOR_LANDING_BLOCK_TYPES = [
    "SectorHeroBlock",
    "SectorRunSectionBlock",
    "SectorHonestProofBlock",
    "SectorReplaceBlock",
    "SectorPricingNoteBlock",
    "SectorNotForBlock",
    "SectorCtaPillBlock",
    // Phase-3 blocks for the 5 structurally-different pages
    // (basic-vs-pro, enterprise-support, governance, thesis, changelog).
    "BasicProSplitHeroBlock",
    "BasicProMatrixBlock",
    "ToolReplacementListBlock",
    "EngagementShapeListBlock",
    "NumberedFindingsBlock",
    "CalloutCardBlock",
    "ChangelogTimelineBlock",
] as const;

export type SectorLandingBlockType = typeof SECTOR_LANDING_BLOCK_TYPES[number];
