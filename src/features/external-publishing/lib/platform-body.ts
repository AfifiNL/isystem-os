import { getExternalPublishingPlatformAdapter } from "../platform-adapters";
import type { ExternalPublishingPlatformAdapter } from "../platform-adapters";
import type { ExternalPublicationPlatform } from "../types";

const ARTICLE_OUTPUT_SHAPE = "markdown_article";
const SHORT_BODY_RATIO = 0.6;

export function stripExternalPublishingMarkdown(markdown: string): string {
    return markdown
        .replace(/```[\s\S]*?```/g, "")
        .replace(/[#*_>`\[\]]/g, "")
        .replace(/\((https?:\/\/[^)]+)\)/g, " $1")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

export function countExternalPublishingWords(text: string): number {
    return stripExternalPublishingMarkdown(text).split(/\s+/).filter(Boolean).length;
}

export function isArticleLikeExternalPublishingAdapter(adapter: Pick<ExternalPublishingPlatformAdapter, "outputShapes">): boolean {
    return adapter.outputShapes.includes(ARTICLE_OUTPUT_SHAPE);
}

function resolveAdapter(platform: ExternalPublicationPlatform, adapter?: ExternalPublishingPlatformAdapter) {
    return adapter ?? getExternalPublishingPlatformAdapter(platform);
}

function isSuspiciouslyShortArticleBody(candidate: string, bodyMarkdown: string, adapter: ExternalPublishingPlatformAdapter): boolean {
    const candidateWords = countExternalPublishingWords(candidate);
    const bodyWords = countExternalPublishingWords(bodyMarkdown);
    return candidateWords < adapter.bodyGuidance.minWords || candidateWords < bodyWords * SHORT_BODY_RATIO;
}

export function selectExternalPublishingPlatformBody({
    platform,
    bodyMarkdown,
    bodyPlaintext,
    bodyPlatformSpecific,
    adapter,
}: {
    platform: ExternalPublicationPlatform;
    bodyMarkdown?: string | null;
    bodyPlaintext?: string | null;
    bodyPlatformSpecific?: string | null;
    adapter?: ExternalPublishingPlatformAdapter;
}): string {
    const platformAdapter = resolveAdapter(platform, adapter);
    const markdown = bodyMarkdown?.trim() ?? "";
    const candidate = bodyPlatformSpecific?.trim() ?? "";

    if (isArticleLikeExternalPublishingAdapter(platformAdapter) && markdown) {
        if (!candidate || isSuspiciouslyShortArticleBody(candidate, markdown, platformAdapter)) return markdown;
        return candidate;
    }

    if (candidate) return candidate;
    if (platform === "reddit" || platform === "linkedin") return stripExternalPublishingMarkdown(markdown || bodyPlaintext || "");
    return markdown || bodyPlaintext?.trim() || "";
}

export function stripBrokenOwnedResourceTrailingSentence(markdown: string): string {
    return markdown
        .replace(/(?:^|\n)([^\n.!?]*(?:read|see|use|visit|check out|open|reference)[^\n.!?]*(?:guide|resource|reference|playbook|checklist|article)[^\n.!?]*(?:on|at|via|here)\.)\s*$/i, "")
        .trim();
}
