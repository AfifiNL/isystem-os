import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BlogEvidenceRecord, BlogVisualBlock } from "../visual-enrichment";
import {
    getVisualEvidenceBadgeLabel,
    getVisualEvidenceCaveat,
    hasStrongEvidenceMetadata,
    isQuantitativeVisualBlock,
} from "./visual-evidence-display";

const quantitativeChart: BlogVisualBlock = {
    id: "chart_1",
    type: "chart",
    title: "Automation benchmark",
    description: "A chart with precise values.",
    caption: "Shows automation potential.",
    source_label: "McKinsey",
    source_url: "https://www.mckinsey.com/example",
    seo_alt: "Automation benchmark chart",
    chart_type: "bar",
    unit: "%",
    data: [{ label: "Potential", value: 64 }],
};

const baseEvidence: BlogEvidenceRecord = {
    claim_id: "claim-1",
    visual_id: "chart_1",
    claim_text: "Automation potential claim.",
    claim_type: "verified_statistic",
    evidence_type: "verified_statistic",
    source_url: "https://www.mckinsey.com/example",
    source_label: "McKinsey",
    source_quality: "near_primary",
    confidence: "high",
    source_note: "Source-backed statistic.",
    badge_label: "Evidence",
};

describe("visual evidence display decisions", () => {
    it("detects precise quantitative visual blocks", () => {
        assert.equal(isQuantitativeVisualBlock(quantitativeChart), true);
    });

    it("treats sourced high-confidence statistic metadata as strong evidence", () => {
        assert.equal(hasStrongEvidenceMetadata(baseEvidence), true);
        assert.equal(getVisualEvidenceBadgeLabel(baseEvidence, { publicView: true, quantitative: true }), "Evidence");
        assert.equal(getVisualEvidenceCaveat(baseEvidence, { publicView: true, quantitative: true }), undefined);
    });

    it("labels author frameworks transparently in public rendering", () => {
        const evidence: BlogEvidenceRecord = {
            ...baseEvidence,
            evidence_type: "author_framework",
            claim_type: "author_framework",
            source_url: undefined,
            source_label: undefined,
            source_quality: "internal",
            confidence: "medium",
            badge_label: "Framework",
        };

        assert.equal(getVisualEvidenceBadgeLabel(evidence, { publicView: true, quantitative: true }), "Framework");
        assert.match(getVisualEvidenceCaveat(evidence, { publicView: true, quantitative: true }) ?? "", /not an external statistic/i);
    });

    it("does not let custom badge text make author synthesis look like external evidence", () => {
        const evidence: BlogEvidenceRecord = {
            ...baseEvidence,
            evidence_type: "author_synthesis",
            claim_type: "author_synthesis",
            source_quality: "near_primary",
            confidence: "medium",
            badge_label: "Evidence",
        };

        assert.equal(getVisualEvidenceBadgeLabel(evidence, { publicView: true, quantitative: false }), "Synthesis");
    });

    it("uses a neutral caveat for precise visuals without strong evidence metadata", () => {
        const evidence: BlogEvidenceRecord = {
            ...baseEvidence,
            evidence_type: "unsupported",
            claim_type: "unsupported",
            source_url: undefined,
            source_label: undefined,
            source_quality: "unknown",
            confidence: "low",
            badge_label: "Needs evidence",
        };

        assert.equal(hasStrongEvidenceMetadata(evidence), false);
        assert.equal(getVisualEvidenceBadgeLabel(evidence, { publicView: true, quantitative: true }), "Directional framework");
        assert.match(getVisualEvidenceCaveat(evidence, { publicView: true, quantitative: true }) ?? "", /not strong enough/i);
    });
});
