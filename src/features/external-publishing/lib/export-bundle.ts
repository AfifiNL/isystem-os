import type { Json } from "@/shared/lib/supabase/database.types";
import type { ExternalPublicationAssetType, ExternalPublicationPackageRow } from "../types";
import { selectExternalPublishingPlatformBody } from "./platform-body";

export type ExternalPublicationBundleAssetReference = {
    asset_type: ExternalPublicationAssetType;
    title: string;
    description?: string | null;
    public_url?: string | null;
    storage_path?: string | null;
    markdown_embed?: string | null;
    alt_text?: string | null;
    metadata?: Json;
};

type BundlePackageLike = Pick<ExternalPublicationPackageRow,
    "id" | "topic" | "platform" | "status" | "target_url" | "utm_source" | "utm_medium" | "utm_campaign" | "utm_content" |
    "title_options" | "body_markdown" | "body_plaintext" | "body_platform_specific" | "visual_plan" | "evidence_pack" |
    "link_plan" | "compliance_warnings" | "validation_result"
>;

function asStringArray(value: Json): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function stringify(value: unknown): string {
    if (value === null || typeof value === "undefined") return "Not available.";
    if (typeof value === "string") return value.trim() || "Not available.";
    return JSON.stringify(value, null, 2);
}

export function stripMarkdownLinks(markdown: string, targetUrl?: string | null) {
    void targetUrl;
    return markdown.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1");
}

export function buildExternalPublicationBundleMarkdown(pkg: BundlePackageLike, assets: ExternalPublicationBundleAssetReference[] = []) {
    const titleOptions = asStringArray(pkg.title_options).map((title) => `- ${title}`).join("\n") || "- Untitled package";
    const platformCopy = selectExternalPublishingPlatformBody({
        platform: pkg.platform,
        bodyMarkdown: pkg.body_markdown,
        bodyPlaintext: pkg.body_plaintext,
        bodyPlatformSpecific: pkg.body_platform_specific,
    }) || "Not generated yet.";
    const noLinkVersion = stripMarkdownLinks(pkg.body_markdown || pkg.body_plaintext || platformCopy, pkg.target_url);
    const manualChecklist = [
        "- Confirm destination community/platform rules before posting.",
        "- Paste manually only; do not use bots, OAuth, auto-posting, voting, or comment automation.",
        "- Prefer the no-link version when links are discouraged or trust is not established.",
        "- Keep UTM parameters intact if adding the owned link.",
        "- Record the public published URL back in the studio after a human publishes it.",
    ].join("\n");
    const assetReferences = assets.length
        ? assets.map((asset) => [
            `### ${asset.title}`,
            `- Type: ${asset.asset_type}`,
            asset.description ? `- Description: ${asset.description}` : null,
            asset.alt_text ? `- Alt text: ${asset.alt_text}` : null,
            asset.public_url ? `- Public URL: ${asset.public_url}` : null,
            asset.storage_path ? `- Storage path: ${asset.storage_path}` : null,
            asset.markdown_embed ? "\n```markdown\n" + asset.markdown_embed + "\n```" : null,
            Object.keys((asset.metadata && typeof asset.metadata === "object" && !Array.isArray(asset.metadata)) ? asset.metadata : {}).length ? `- Metadata: ${stringify(asset.metadata)}` : null,
        ].filter(Boolean).join("\n")).join("\n\n")
        : "No asset references stored. Use the visual plan as the manual asset brief.";

    return [
        `# External Publishing Bundle — ${pkg.topic}`,
        "",
        "**Manual publishing only.** This bundle is for human copy/paste review. It must not be used for auto-posting, OAuth platform posting, voting, comment automation, deceptive identity flows, or private-community scraping.",
        "",
        `- Package ID: ${pkg.id}`,
        `- Platform: ${pkg.platform}`,
        `- Status: ${pkg.status}`,
        `- Target URL: ${pkg.target_url}`,
        "",
        "## Title options",
        titleOptions,
        "",
        "## Platform copy",
        platformCopy,
        "",
        "## No-link version",
        noLinkVersion || "Not available.",
        "",
        "## Visual plan",
        stringify(pkg.visual_plan),
        "",
        "## Evidence pack",
        stringify(pkg.evidence_pack),
        "",
        "## Link/UTM plan",
        stringify({
            targetUrl: pkg.target_url,
            utm_source: pkg.utm_source,
            utm_medium: pkg.utm_medium,
            utm_campaign: pkg.utm_campaign,
            utm_content: pkg.utm_content,
            linkPlan: pkg.link_plan,
        }),
        "",
        "## Compliance notes",
        stringify({ warnings: pkg.compliance_warnings, validation: pkg.validation_result }),
        "",
        "## Manual checklist",
        manualChecklist,
        "",
        "## Asset references",
        assetReferences,
    ].join("\n");
}

export function externalPublicationBundleFilename(pkg: Pick<ExternalPublicationPackageRow, "id" | "utm_campaign" | "utm_content">) {
    return `external-publishing-${pkg.utm_campaign}-${pkg.utm_content}-${pkg.id}.md`.replace(/[^a-zA-Z0-9._-]+/g, "-");
}
