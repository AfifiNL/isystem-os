import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getVisualEnrichment } from "@/features/content-engine/visual-enrichment";
import { validateGeneratedBlogDraft } from "@/features/content-engine/lib/blog-editorial-validation";
import {
    buildBlogEditorialRemediationProposal,
    remediateBlogEditorialValidation,
} from "./blog-enhancement-remediation";

const LONG_MARKDOWN = `Opening paragraph about Zapier vs Make Comparison. Zapier vs Make Comparison matters for operations teams choosing automation platforms because teams need evidence, governance, rollout control, and realistic integration expectations before they commit budget.

## Zapier vs Make Comparison starts with integration depth

Operations teams should compare connector coverage, native app depth, governance controls, and maintenance effort before they choose an automation platform. This section gives concrete context so the draft has enough substance for editorial validation and search intent.

### Where native integrations matter

Native integrations decide how much brittle glue a team must maintain after launch.

## Governance controls shape the rollout

Approval paths, audit logs, and workspace permissions decide whether automation can move beyond a single enthusiastic operator. Buyers need practical guidance about who can create workflows, who reviews them, and how errors get rolled back.

[Automation governance](/blog/automation-governance) connects this section to the wider operating model.

## Evidence keeps the comparison useful

Research-led comparisons should separate vendor claims from source-backed observations and internal estimates. That makes the article safer for publication and clearer for readers who need to defend a platform decision.

[OECD digital research](https://www.oecd.org/digital/) supports the adoption context.

## A practical decision path

The strongest buying process starts with two or three representative workflows, then tests both platforms against maintenance effort, integration coverage, exception handling, and reporting needs. That path avoids generic feature matrices.

{{visual:chart_native-app-integrations}}

## Frequently asked questions

These common questions help readers move from comparison into practical decision-making without repeating the article summary.

### Which platform should a small team test first?

Start with the workflows that already have clear inputs, review steps, and measurable value. The best first test is narrow enough to finish, but important enough that the team will notice the operational difference.

### Why does evidence metadata matter?

Evidence metadata prevents numeric visuals from presenting unsupported estimates as external proof. That distinction keeps the article useful and publication-safe.`;

function metadataFixture() {
    return {
        seo: {
            title: "Native App Integrations for Automation Teams",
            description: "Zapier vs Make Comparison helps operations teams compare native integrations, governance, and rollout tradeoffs before choosing an automation platform.",
            keywords: ["Zapier vs Make Comparison", "automation platforms"],
        },
        generation_inputs: { length: "long" },
        enrichment: {
            schema_version: 2,
            visual_blocks: [
                {
                    id: "chart_native-app-integrations",
                    type: "chart",
                    chart_type: "bar",
                    title: "Native app integrations",
                    description: "Illustrative comparison of native app integration depth.",
                    caption: "Native app integration coverage affects maintenance effort.",
                    source_label: "AI synthesis",
                    seo_alt: "Chart comparing native app integrations",
                    data: [
                        { label: "Zapier", value: 6000 },
                        { label: "Make", value: 2000 },
                    ],
                    evidence: {
                        claim_id: "chart_native-app-integrations-evidence",
                        visual_id: "chart_native-app-integrations",
                        claim_text: "Native app integrations comparison",
                        claim_type: "unsupported",
                        evidence_type: "unsupported",
                        source_quality: "unknown",
                        confidence: "low",
                        source_note: "AI synthesis",
                        badge_label: "Needs evidence",
                    },
                },
            ],
            evidence: [],
        },
    };
}

describe("blog SEO enhancement editorial remediation", () => {
    it("builds a remediation proposal when publication-blocking SEO and visual evidence rules fail", () => {
        const proposal = buildBlogEditorialRemediationProposal({
            title: "Native App Integrations for Automation Teams",
            contentMarkdown: LONG_MARKDOWN,
            metadata: metadataFixture(),
            locale: "en",
        });

        assert.ok(proposal);
        assert.equal(proposal.type, "editorial_validation_remediation");
        assert.match(proposal.original, /primary_keyword_missing_from_seo_title/);
        assert.match(proposal.original, /visual_numeric_chart_evidence_remediated/);
    });

    it("includes the primary keyword in the SEO title and downgrades unsafe numeric charts to internal estimates", () => {
        const result = remediateBlogEditorialValidation({
            title: "Native App Integrations for Automation Teams",
            contentMarkdown: LONG_MARKDOWN,
            metadata: metadataFixture(),
            locale: "en",
        });

        assert.equal(result.changed, true);
        const seo = result.metadata.seo as { title: string };
        assert.match(seo.title, /Zapier vs Make Comparison/);
        assert.ok(seo.title.length >= 35 && seo.title.length <= 65);

        const visual = getVisualEnrichment(result.metadata).visual_blocks[0];
        assert.equal(visual.evidence?.evidence_type, "internal_estimate");
        assert.equal(visual.evidence?.source_quality, "internal");
        assert.equal(visual.source_url, undefined);
        assert.match(visual.evidence?.source_note ?? "", /not an external benchmark/i);

        const validation = validateGeneratedBlogDraft({
            markdown: LONG_MARKDOWN,
            length: "long",
            title: "Native App Integrations for Automation Teams",
            seoTitle: seo.title,
            seoDescription: "Zapier vs Make Comparison helps operations teams compare native integrations, governance, and rollout tradeoffs before choosing an automation platform.",
            primaryKeyword: "Zapier vs Make Comparison",
            keywords: ["Zapier vs Make Comparison", "automation platforms"],
            visualBlocks: getVisualEnrichment(result.metadata).visual_blocks,
            siteHost: "isystem.ai",
        });
        const blockingCodes = validation.issues.filter((issue) => issue.severity === "error").map((issue) => issue.code);
        assert.ok(!blockingCodes.includes("primary_keyword_missing_from_seo_title"));
        assert.ok(!blockingCodes.includes("visual_numeric_chart_invalid_evidence_type"));
        assert.ok(!blockingCodes.includes("visual_numeric_chart_missing_source_url"));
        assert.ok(!blockingCodes.includes("visual_external_evidence_missing_source_url"));
    });

    it("remediates the SEO title using the core phrase of a headline-style stored keyword", () => {
        const metadata = metadataFixture();
        metadata.seo.keywords = ["Enterprise Systems Enablement: A Roadmap for Operational Directors"];

        const result = remediateBlogEditorialValidation({
            title: "Native App Integrations for Automation Teams",
            contentMarkdown: LONG_MARKDOWN,
            metadata,
            locale: "en",
        });

        assert.equal(result.changed, true);
        const seo = result.metadata.seo as { title: string };
        assert.match(seo.title, /Enterprise Systems Enablement/);
        assert.ok(seo.title.length >= 35 && seo.title.length <= 65);
        assert.ok(!result.remainingBlockingIssues.some((issue) => issue.code === "primary_keyword_missing_from_seo_title"));
    });
});
