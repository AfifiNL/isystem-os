import type { ExternalPublishingPlatformAdapter } from "./types";

export const redditAdapter: ExternalPublishingPlatformAdapter = {
    platform: "reddit",
    label: "Reddit",
    outputShapes: ["plain_text_post", "checklist"],
    maxLinks: 1,
    titleGuidance: {
        maxLength: 140,
        guidance: [
            "Use a community-first question or lesson title, never a promotional headline.",
            "Prefer practical framing such as 'What I learned...' or 'Checklist for...'.",
        ],
    },
    bodyGuidance: {
        minWords: 250,
        maxWords: 1100,
        guidance: [
            "Lead with the useful framework/checklist before any mention of an owned product or service.",
            "End by asking for critique or inviting shared experience, not by pushing a CTA.",
            "Keep the no-link version equally useful.",
        ],
    },
    linkPolicy: {
        densityGuidance: "Default to 0 links. Allow at most 1 owned link only when subreddit rules and context make it genuinely useful.",
        requireUsefulLinkRationale: true,
        noLinkVersionRequired: true,
        preferLinkPlacement: "footer",
    },
    disclosureNotes: [
        "Disclose affiliation when mentioning an owned product or resource.",
        "If unsure about subreddit self-promotion rules, use the no-link version.",
    ],
    moderationNotes: [
        "Require subreddit selection notes and rule reminders before publishing.",
        "Avoid posting in communities that ban self-promotion or require moderator approval unless the human operator has approval.",
    ],
    salesToneRedFlags: ["DM me", "book a demo", "we built", "our tool", "limited offer", "lead magnet"],
    imageDiagramPolicy: [
        "Plain text should stand alone; diagrams are optional and subreddit-dependent.",
        "Do not require image uploads for a Reddit package.",
    ],
    canonicalGuidance: [
        "No canonical-link assumptions. Treat Reddit as a discussion surface, not an article syndication target.",
    ],
};
