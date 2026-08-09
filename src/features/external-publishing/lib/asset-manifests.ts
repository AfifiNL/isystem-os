import type { Json } from "@/shared/lib/supabase/database.types";
import type { ExternalPublicationAssetType, ExternalPublicationPackageRow } from "../types";

export type ExternalPublicationAssetManifestInput = {
    assetType?: ExternalPublicationAssetType;
    title?: string | null;
    description?: string | null;
    imagePrompt?: string | null;
    mermaid?: string | null;
    altText?: string | null;
    caption?: string | null;
    sourceEvidence?: unknown;
    metadata?: Record<string, unknown>;
};

export type ExternalPublicationAssetManifest = {
    asset_type: ExternalPublicationAssetType;
    title: string;
    description: string | null;
    markdown_embed: string | null;
    alt_text: string | null;
    metadata: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstString(...values: unknown[]): string | null {
    for (const value of values) {
        const text = asString(value);
        if (text) return text;
    }
    return null;
}

export function buildExternalPublicationAssetManifestFromVisualPlan(
    pkg: Pick<ExternalPublicationPackageRow, "id" | "topic" | "platform" | "visual_plan" | "evidence_pack">,
    input: ExternalPublicationAssetManifestInput = {},
): ExternalPublicationAssetManifest {
    const visualPlan = asRecord(pkg.visual_plan);
    const imagePrompt = firstString(input.imagePrompt, visualPlan.imagePrompt, visualPlan.image_prompt, visualPlan.prompt);
    const mermaid = firstString(input.mermaid, visualPlan.mermaid, visualPlan.mermaidSource, visualPlan.diagram);
    const caption = firstString(input.caption, visualPlan.caption);
    const description = firstString(input.description, caption, imagePrompt, `Manual asset request for ${pkg.topic}.`);
    const assetType = input.assetType ?? (mermaid ? "diagram_mermaid" : "featured_image");
    const markdownEmbed = assetType === "diagram_mermaid" && mermaid ? `\`\`\`mermaid\n${mermaid.replace(/```/g, "")}\n\`\`\`` : null;

    return {
        asset_type: assetType,
        title: firstString(input.title, visualPlan.title, `${pkg.topic} visual asset`)?.slice(0, 180) ?? "External publishing visual asset",
        description,
        markdown_embed: markdownEmbed,
        alt_text: firstString(input.altText, visualPlan.altText, visualPlan.alt_text, `Visual explanation for ${pkg.topic}`),
        metadata: {
            ...asRecord(input.metadata),
            source: "external_publishing_visual_plan",
            packageId: pkg.id,
            platform: pkg.platform,
            imagePrompt,
            mermaid,
            caption,
            sourceEvidence: input.sourceEvidence ?? pkg.evidence_pack,
            generationStatus: "manifest_only",
            storage: {
                bucket: null,
                path: null,
                publicUrl: null,
            },
        },
    };
}

export function serializeAssetManifestForDatabase(manifest: ExternalPublicationAssetManifest): {
    asset_type: ExternalPublicationAssetType;
    title: string;
    description: string | null;
    markdown_embed: string | null;
    alt_text: string | null;
    metadata: Json;
} {
    return {
        asset_type: manifest.asset_type,
        title: manifest.title,
        description: manifest.description,
        markdown_embed: manifest.markdown_embed,
        alt_text: manifest.alt_text,
        metadata: manifest.metadata as Json,
    };
}
