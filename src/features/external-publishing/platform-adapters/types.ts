import type { ExternalPublicationPlatform } from "../types";

export type ExternalPublishingOutputShape = "markdown_article" | "plain_text_post" | "qa_answer" | "checklist";

export interface ExternalPublishingPlatformAdapter {
    platform: ExternalPublicationPlatform;
    label: string;
    outputShapes: ExternalPublishingOutputShape[];
    maxLinks: number;
    titleGuidance: {
        maxLength: number;
        guidance: string[];
    };
    bodyGuidance: {
        minWords: number;
        maxWords: number;
        guidance: string[];
    };
    linkPolicy: {
        densityGuidance: string;
        requireUsefulLinkRationale: boolean;
        noLinkVersionRequired: boolean;
        preferLinkPlacement: "body" | "comments" | "footer" | "none";
    };
    disclosureNotes: string[];
    moderationNotes: string[];
    salesToneRedFlags: string[];
    imageDiagramPolicy: string[];
    canonicalGuidance: string[];
}
