// Plain-data constants for the Resource blocks registry.
// Imported safely on both server and client.

export const RESOURCE_BLOCK_TYPES = [
    "ResourceHeroBlock",
    "ResourceCardGridBlock",
    "PdfDownloadPanelBlock",
    "ResourceUseCasesBlock",
    "ResourceVisualPreviewBlock",
] as const;

export type ResourceBlockType = typeof RESOURCE_BLOCK_TYPES[number];
