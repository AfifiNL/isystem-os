import type { ExternalPublicationPlatform } from "../types";
import { devtoAdapter } from "./devto";
import { genericArticleAdapter, genericForumAdapter, indieHackersAdapter, quoraAdapter } from "./generic";
import { linkedinAdapter } from "./linkedin";
import { mediumAdapter } from "./medium";
import { redditAdapter } from "./reddit";
import type { ExternalPublishingPlatformAdapter } from "./types";

export type { ExternalPublishingPlatformAdapter, ExternalPublishingOutputShape } from "./types";

export const EXTERNAL_PUBLISHING_PLATFORM_ADAPTERS: Record<ExternalPublicationPlatform, ExternalPublishingPlatformAdapter> = {
    medium: mediumAdapter,
    reddit: redditAdapter,
    linkedin: linkedinAdapter,
    devto: devtoAdapter,
    indiehackers: indieHackersAdapter,
    quora: quoraAdapter,
    generic_forum: genericForumAdapter,
    generic_article: genericArticleAdapter,
};

export function getExternalPublishingPlatformAdapter(platform: ExternalPublicationPlatform): ExternalPublishingPlatformAdapter {
    return EXTERNAL_PUBLISHING_PLATFORM_ADAPTERS[platform];
}
