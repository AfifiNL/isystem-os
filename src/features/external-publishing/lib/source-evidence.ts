import type { Json } from "@/shared/lib/supabase/database.types";
import { getPublicEvidenceForContent, type PublicEvidenceSource } from "@/features/source-intelligence/public";

export type ExternalPublishingEvidenceItem = {
    title?: string;
    url?: string;
    excerpt?: string;
    source?: "source_intelligence" | "package" | "research" | "metadata";
    metadata?: Record<string, unknown>;
};

type SourceEvidencePackageLike = {
    id: string;
    workspace_id: string;
    template_id: string | null;
    source_content_id: string | null;
    topic: string;
    primary_query: string | null;
    evidence_pack: Json;
    metadata: Json;
};

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asEvidenceArray(value: unknown): ExternalPublishingEvidenceItem[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => asRecord(item))
        .map((item) => ({
            title: typeof item.title === "string" ? item.title : undefined,
            url: typeof item.url === "string" ? item.url : typeof item.citationUrl === "string" ? item.citationUrl : undefined,
            excerpt: typeof item.excerpt === "string" ? item.excerpt : typeof item.summary === "string" ? item.summary : undefined,
            source: typeof item.source === "string" ? item.source as ExternalPublishingEvidenceItem["source"] : "package",
            metadata: asRecord(item.metadata),
        }))
        .filter((item) => item.title || item.url || item.excerpt);
}

function evidenceFromPublicSource(source: PublicEvidenceSource): ExternalPublishingEvidenceItem {
    const descriptor = [
        source.publisher ? `Publisher: ${source.publisher}` : null,
        source.quality ? `Quality: ${source.quality}` : null,
        source.trustTier ? `Trust tier: ${source.trustTier}` : null,
        source.evidenceCategory ? `Category: ${source.evidenceCategory}` : null,
    ].filter(Boolean).join(" · ");

    return {
        title: source.title,
        url: source.citationUrl,
        excerpt: descriptor || source.citationLabel || "Public-safe Source Intelligence evidence.",
        source: "source_intelligence",
        metadata: {
            sourceEvidenceId: source.id,
            publisher: source.publisher,
            quality: source.quality,
            trustTier: source.trustTier,
            publishedAt: source.publishedAt,
            retrievedAt: source.retrievedAt,
            citationLabel: source.citationLabel,
            evidenceType: source.evidenceType,
            evidenceCategory: source.evidenceCategory,
        },
    };
}

export function mergeExternalPublishingEvidence(
    canonicalEvidence: ExternalPublishingEvidenceItem[],
    fallbackEvidence: ExternalPublishingEvidenceItem[],
    limit = 8,
): ExternalPublishingEvidenceItem[] {
    const seen = new Set<string>();
    const merged: ExternalPublishingEvidenceItem[] = [];
    for (const item of [...canonicalEvidence, ...fallbackEvidence]) {
        const key = `${item.url ?? ""}:${item.title ?? ""}`.toLowerCase();
        if (!key.trim() || seen.has(key)) continue;
        seen.add(key);
        merged.push(item);
        if (merged.length >= limit) break;
    }
    return merged;
}

export async function getCanonicalExternalPublishingEvidence(row: SourceEvidencePackageLike, limit = 8): Promise<ExternalPublishingEvidenceItem[]> {
    const fallback = asEvidenceArray(row.evidence_pack);
    if (!row.source_content_id) return fallback.slice(0, limit);

    const publicSources = await getPublicEvidenceForContent(row.source_content_id, {
        workspaceId: row.workspace_id,
        templateId: row.template_id,
        metadata: row.metadata,
        limit,
    });

    const canonical = publicSources.map(evidenceFromPublicSource);
    return mergeExternalPublishingEvidence(canonical, fallback, limit);
}
