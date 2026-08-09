import type { ExternalPublishingPlatformAdapter } from "./types";

export const linkedinAdapter: ExternalPublishingPlatformAdapter = {
    platform: "linkedin",
    label: "LinkedIn",
    outputShapes: ["plain_text_post", "markdown_article"],
    maxLinks: 1,
    titleGuidance: {
        maxLength: 110,
        guidance: [
            "Use operator/executive framing with a clear business problem.",
            "Avoid engagement-bait openings and hype claims.",
        ],
    },
    bodyGuidance: {
        minWords: 180,
        maxWords: 900,
        guidance: [
            "Keep it skimmable with short paragraphs and concrete lessons.",
            "Use credibility-led framing: observed pattern, implication, practical response.",
            "Prefer a thoughtful next step over a hard CTA.",
        ],
    },
    linkPolicy: {
        densityGuidance: "Use 0-1 link. Put it in the body only when context requires it; otherwise suggest comments placement.",
        requireUsefulLinkRationale: true,
        noLinkVersionRequired: false,
        preferLinkPlacement: "comments",
    },
    disclosureNotes: [
        "Disclose owned perspective when discussing workspace workflows or assets.",
        "Avoid implying customer results without evidence.",
    ],
    moderationNotes: [
        "LinkedIn rewards native insight; do not make the post a wrapper around a link.",
    ],
    salesToneRedFlags: ["comment 'AI'", "DM me", "book a call", "we help companies", "10x your"],
    imageDiagramPolicy: [
        "A simple carousel/diagram prompt may help when it explains a framework.",
        "Do not depend on generated images for the copy to make sense.",
    ],
    canonicalGuidance: [
        "LinkedIn posts have no canonical handling; LinkedIn articles can include a manual source note when repurposed.",
    ],
};
