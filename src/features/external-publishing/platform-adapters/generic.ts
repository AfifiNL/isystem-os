import type { ExternalPublishingPlatformAdapter } from "./types";

export const genericForumAdapter: ExternalPublishingPlatformAdapter = {
    platform: "generic_forum",
    label: "Generic forum / community",
    outputShapes: ["plain_text_post", "qa_answer", "checklist"],
    maxLinks: 1,
    titleGuidance: {
        maxLength: 120,
        guidance: ["Use a specific help-seeking or help-giving title; avoid branded wording."],
    },
    bodyGuidance: {
        minWords: 180,
        maxWords: 900,
        guidance: [
            "Answer the community's problem directly before mentioning any owned resource.",
            "Include a no-link version by default for strict moderation environments.",
        ],
    },
    linkPolicy: {
        densityGuidance: "Allow at most 1 useful link and default to no-link if rules are unknown.",
        requireUsefulLinkRationale: true,
        noLinkVersionRequired: true,
        preferLinkPlacement: "footer",
    },
    disclosureNotes: ["Disclose affiliation for any owned resource."],
    moderationNotes: ["Check community-specific self-promotion and link rules before publishing."],
    salesToneRedFlags: ["try our", "book", "demo", "best solution", "guaranteed"],
    imageDiagramPolicy: ["Plain text should be sufficient; attach diagrams only if community norms allow it."],
    canonicalGuidance: ["No canonical assumptions for generic forums."],
};

export const genericArticleAdapter: ExternalPublishingPlatformAdapter = {
    platform: "generic_article",
    label: "Generic article",
    outputShapes: ["markdown_article", "checklist"],
    maxLinks: 2,
    titleGuidance: {
        maxLength: 95,
        guidance: ["Use a useful editorial title that matches the host publication's audience."],
    },
    bodyGuidance: {
        minWords: 650,
        maxWords: 1700,
        guidance: [
            "Create a standalone article with evidence and a distinct platform-native angle.",
            "Avoid duplicating owned blog content without substantial new framing.",
        ],
    },
    linkPolicy: {
        densityGuidance: "Allow up to 2 useful links when editorially justified.",
        requireUsefulLinkRationale: true,
        noLinkVersionRequired: false,
        preferLinkPlacement: "body",
    },
    disclosureNotes: ["Use publication-specific disclosure/source notes where required."],
    moderationNotes: ["Follow host publication editorial rules and avoid doorway content."],
    salesToneRedFlags: ["sponsored by", "buy now", "book a call", "ultimate", "secret"],
    imageDiagramPolicy: ["Recommend an image or diagram only when it improves comprehension."],
    canonicalGuidance: ["Include manual canonical/source guidance if the host supports canonical URLs."],
};

export const quoraAdapter: ExternalPublishingPlatformAdapter = {
    platform: "quora",
    label: "Generic Q&A / Quora-style answer",
    outputShapes: ["qa_answer", "checklist"],
    maxLinks: 1,
    titleGuidance: {
        maxLength: 160,
        guidance: ["Mirror the user's question and answer intent; do not turn it into a headline."],
    },
    bodyGuidance: {
        minWords: 220,
        maxWords: 1000,
        guidance: [
            "Start with the direct answer, then add a framework, example, and caveats.",
            "The answer must remain useful without the link.",
        ],
    },
    linkPolicy: {
        densityGuidance: "Allow at most 1 supporting link after the answer delivers value.",
        requireUsefulLinkRationale: true,
        noLinkVersionRequired: true,
        preferLinkPlacement: "footer",
    },
    disclosureNotes: ["Disclose affiliation before linking to owned resources."],
    moderationNotes: ["Avoid spam answers, copied blog intros, and unsupported expertise claims."],
    salesToneRedFlags: ["I recommend our", "contact us", "best provider", "sign up"],
    imageDiagramPolicy: ["Use text-first explanation; diagrams are optional."],
    canonicalGuidance: ["No canonical assumptions for Q&A answers."],
};

export const indieHackersAdapter: ExternalPublishingPlatformAdapter = {
    platform: "indiehackers",
    label: "Indie Hackers",
    outputShapes: ["plain_text_post", "checklist"],
    maxLinks: 1,
    titleGuidance: {
        maxLength: 120,
        guidance: ["Use transparent founder/operator learning, not a launch announcement unless asked."],
    },
    bodyGuidance: {
        minWords: 250,
        maxWords: 1000,
        guidance: ["Share practical lessons, numbers only when verifiable, and ask for peer feedback."],
    },
    linkPolicy: {
        densityGuidance: "Allow at most 1 contextual link after the useful lesson.",
        requireUsefulLinkRationale: true,
        noLinkVersionRequired: true,
        preferLinkPlacement: "footer",
    },
    disclosureNotes: ["Be explicit when discussing your own product or research."],
    moderationNotes: ["Avoid drive-by promotion; make the founder learning valuable without a link."],
    salesToneRedFlags: ["launching today", "try it free", "growth hack", "secret formula"],
    imageDiagramPolicy: ["Screenshots or simple diagrams can help if they support the lesson."],
    canonicalGuidance: ["No canonical assumptions for community posts."],
};
