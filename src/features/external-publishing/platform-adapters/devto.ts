import type { ExternalPublishingPlatformAdapter } from "./types";

export const devtoAdapter: ExternalPublishingPlatformAdapter = {
    platform: "devto",
    label: "DEV.to / technical communities",
    outputShapes: ["markdown_article", "checklist"],
    maxLinks: 2,
    titleGuidance: {
        maxLength: 90,
        guidance: [
            "Frame the post as a practical technical tutorial or implementation lesson.",
            "Only use a technical title when the package includes accurate technical substance.",
        ],
    },
    bodyGuidance: {
        minWords: 700,
        maxWords: 1800,
        guidance: [
            "Use problem-solution structure with accurate code/config snippets only when relevant.",
            "Explain tradeoffs and failure modes; do not make generic marketing claims.",
            "Include prerequisites and caveats for technical advice.",
        ],
    },
    linkPolicy: {
        densityGuidance: "Allow up to 2 relevant links when they support the tutorial or provide a working reference.",
        requireUsefulLinkRationale: true,
        noLinkVersionRequired: false,
        preferLinkPlacement: "body",
    },
    disclosureNotes: [
        "Disclose owned tools or product context when included.",
        "Do not imply open-source or independent benchmark status unless supported by evidence.",
    ],
    moderationNotes: [
        "Technical communities reject generic thought leadership; include implementable detail.",
        "Do not include unverifiable performance/security claims.",
    ],
    salesToneRedFlags: ["best AI platform", "no-code magic", "just automate everything", "sign up", "book a demo"],
    imageDiagramPolicy: [
        "Diagrams are useful when they clarify architecture, data flow, or workflow boundaries.",
        "Code blocks must be accurate and bounded; avoid pseudo-code masquerading as production code.",
    ],
    canonicalGuidance: [
        "If cross-posting from owned technical content, include manual canonical/source guidance when the destination supports it.",
    ],
};
