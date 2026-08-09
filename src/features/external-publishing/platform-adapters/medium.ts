import type { ExternalPublishingPlatformAdapter } from "./types";

export const mediumAdapter: ExternalPublishingPlatformAdapter = {
    platform: "medium",
    label: "Medium",
    outputShapes: ["markdown_article", "checklist"],
    maxLinks: 3,
    titleGuidance: {
        maxLength: 90,
        guidance: [
            "Use a specific problem/lesson title, not a keyword-stuffed SEO title.",
            "Avoid clickbait, inflated claims, and generic top-10 framing.",
        ],
    },
    bodyGuidance: {
        minWords: 900,
        maxWords: 2200,
        guidance: [
            "Write as a long-form article with headings, pull quotes, and useful examples.",
            "Include original framing or analysis; do not syndicate an owned blog post verbatim.",
            "Use Markdown image placeholders when a diagram or header image materially helps the reader.",
        ],
    },
    linkPolicy: {
        densityGuidance: "Allow 1-3 relevant owned links depending on article length; each link must solve the reader's next problem.",
        requireUsefulLinkRationale: true,
        noLinkVersionRequired: false,
        preferLinkPlacement: "body",
    },
    disclosureNotes: [
        "Add a source/canonical note only when the piece genuinely expands from owned research and a human approves it.",
        "Make commercial affiliation clear when linking to owned tools or services.",
    ],
    moderationNotes: [
        "Medium is tolerant of owned links when the article is substantive and not doorway content.",
        "Avoid thin summaries whose main purpose is routing readers elsewhere.",
    ],
    salesToneRedFlags: ["book a call", "our platform is the best", "revolutionary", "game-changing", "ultimate guide"],
    imageDiagramPolicy: [
        "Strongly recommend a header image or simple process diagram.",
        "Diagrams should clarify the framework, not decorate generic claims.",
    ],
    canonicalGuidance: [
        "If repurposing owned content, include manual canonical/source guidance and ensure the article adds a platform-native angle.",
        "Never imply canonical metadata was set automatically; this studio generates copy/paste guidance only.",
    ],
};
