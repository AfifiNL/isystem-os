import type { BlogChartBlock, BlogEvidenceRecord, BlogVisualBlock } from "../visual-enrichment";

const STRONG_EXTERNAL_SOURCE_QUALITIES = new Set<BlogEvidenceRecord["source_quality"]>([
    "primary",
    "near_primary",
    "secondary",
]);

const EXTERNAL_STATISTIC_EVIDENCE_TYPES = new Set<BlogEvidenceRecord["evidence_type"]>([
    "verified_statistic",
    "time_sensitive_benchmark",
    "forecast",
]);

interface VisualEvidenceDisplayOptions {
    publicView?: boolean;
    quantitative?: boolean;
}

export function isQuantitativeVisualBlock(block: BlogVisualBlock): block is BlogChartBlock {
    return block.type === "chart" && block.data.some((item) => Number.isFinite(item.value));
}

export function hasStrongEvidenceMetadata(evidence: BlogEvidenceRecord): boolean {
    return Boolean(evidence.source_url)
        && evidence.confidence !== "low"
        && STRONG_EXTERNAL_SOURCE_QUALITIES.has(evidence.source_quality)
        && EXTERNAL_STATISTIC_EVIDENCE_TYPES.has(evidence.evidence_type);
}

export function getVisualEvidenceBadgeLabel(evidence: BlogEvidenceRecord, options: VisualEvidenceDisplayOptions = {}): string | undefined {
    const { publicView = false, quantitative = false } = options;

    if (evidence.evidence_type === "unsupported" || evidence.confidence === "low") {
        return publicView ? "Directional framework" : "Review needed";
    }

    if (evidence.evidence_type === "author_framework") return "Framework";
    if (evidence.evidence_type === "author_synthesis") return "Synthesis";
    if (evidence.evidence_type === "internal_estimate") return evidence.badge_label || "Scenario";
    if (evidence.evidence_type === "forecast") return evidence.badge_label || "Forecast";

    if (quantitative && !hasStrongEvidenceMetadata(evidence)) {
        return evidence.badge_label || "Directional framework";
    }

    if (evidence.source_quality === "primary") return evidence.badge_label || "Primary source";
    return evidence.badge_label || "Evidence";
}

export function getVisualEvidenceCaveat(evidence: BlogEvidenceRecord, options: VisualEvidenceDisplayOptions = {}): string | undefined {
    const { publicView = false, quantitative = false } = options;

    if (evidence.evidence_type === "author_framework") {
        return "Author framework, not an external statistic.";
    }

    if (evidence.evidence_type === "author_synthesis") {
        return evidence.source_url
            ? "Author synthesis with named source context."
            : "Author synthesis, not an external statistic.";
    }

    if (evidence.evidence_type === "internal_estimate") {
        return "Directional scenario model, not a published benchmark.";
    }

    if (evidence.evidence_type === "unsupported") {
        return publicView
            ? "Directional framework; source metadata is not strong enough for primary-source certainty."
            : "Evidence review needed before publication.";
    }

    if (quantitative && !hasStrongEvidenceMetadata(evidence)) {
        return "Directional framework; not presented as a primary-source statistic.";
    }

    return undefined;
}
