import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    buildSupabaseAuditSql,
    scanArticleTrustSignals,
    scanPublicationSafetyMetadata,
    scanPublicationSafetyText,
} from "./publication-safety-audit";

const bannedAiResearchSynthesisLabel = `AI ${"research"} synthesis`;
const bannedAiSynthesisLabel = `AI ${"synthesis"}`;

describe("publication safety audit", () => {
    it("detects banned placeholder source labels without requiring database writes", () => {
        const matches = scanPublicationSafetyText(`source_label: ${bannedAiResearchSynthesisLabel}\nsource_label: ${bannedAiSynthesisLabel}`);

        assert.deepEqual(matches.map((match) => match.patternId), [
            "placeholder-ai-research-synthesis-label",
            "placeholder-ai-synthesis-label",
        ]);
    });

    it("detects exact high-risk commercial claims that need source context or softening", () => {
        const matches = scanPublicationSafetyText([
            "Agency margins rose from 11-15 percent to 25-35 percent after implementation.",
            "The SLA dispute resolution cycle was reduced by 40 percent.",
            "IDC says data silos costing 20-30 percent of revenue.",
            "PMI research says project visibility increasing success by 20-30 percent.",
            "The hyperautomation market forecast will explode by 2030.",
        ].join("\n"));

        assert.deepEqual(matches.map((match) => match.patternId), [
            "unsupported-agency-margin-range",
            "unsupported-sla-dispute-reduction",
            "unsupported-idc-data-silo-revenue-cost",
            "unsupported-pmi-project-visibility-success",
            "hyperautomation-forecast-without-caveat",
        ]);
    });

    it("documents a read-only Supabase audit query scoped to iSystem blog content", () => {
        const sql = buildSupabaseAuditSql();

        assert.match(sql, /SELECT slug, title, locale, status/);
        assert.match(sql, /template_id = 'isystem-agency'/);
        assert.match(sql, /type = 'blog'/);
        assert.match(sql, /from-agency-stack-to-ai-operating-system-redefining-agency-growth/);
        assert.doesNotMatch(sql, /\b(?:UPDATE|DELETE|INSERT)\b/i);
    });

    it("detects incomplete structured evidence in metadata JSON", () => {
        const issues = scanPublicationSafetyMetadata({
            enrichment: {
                visual_blocks: [{
                    id: "chart_bad",
                    type: "chart",
                    source_label: bannedAiResearchSynthesisLabel,
                    data: [{ label: "Adoption", value: 73 }],
                    evidence: {
                        visual_id: "chart_bad",
                        evidence_type: "author_synthesis",
                        source_label: bannedAiResearchSynthesisLabel,
                    },
                }],
            },
        });

        assert.deepEqual(issues.map((issue) => issue.code), [
            "metadata_banned_visual_source_label",
            "metadata_numeric_chart_invalid_evidence_type",
            "metadata_numeric_chart_missing_source_url",
            "metadata_exact_number_missing_source_date",
        ]);
    });

    it("reports competitor-style article trust weaknesses without rewriting content", () => {
        const markdown = `${"AI operating system ".repeat(20)}

## How this transforms the business

This comprehensive solution can unlock the potential of every workflow. It gives teams a seamless solution and a robust platform without showing an operating change or external proof.

${Array.from({ length: 80 }, () => "The platform improves operations with broad strategic language but no named source link or visual evidence block.").join("\n\n")}`;

        const issues = scanArticleTrustSignals({
            title: "AI operating system",
            markdown,
            metadata: {},
        });

        const codes = issues.map((issue) => issue.code);
        assert.ok(codes.includes("trust_no_external_evidence_links"));
        assert.ok(codes.includes("trust_missing_before_after_workflow"));
        assert.ok(codes.includes("trust_missing_visual_evidence_or_diagram"));
        assert.ok(codes.includes("trust_missing_evidence_taxonomy"));
        assert.ok(codes.includes("trust_repetitive_seo_phrase"), `missing trust_repetitive_seo_phrase in ${codes.join(", ")}`);
        assert.ok(codes.includes("trust_vague_big_claim_language"));
    });
});
