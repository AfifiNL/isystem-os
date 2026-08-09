import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    collectMarkdownProtectedRanges,
    rangeOverlapsProtectedRange,
    scanMarkdown,
    stripMarkdownTemplatePlaceholders,
} from "./markdown-offsets";
import { gatherClaimCoverageProposals } from "./claim-coverage";

describe("markdown visual/template placeholder protection", () => {
    it("detects visual shortcodes as protected ranges", () => {
        const markdown = "Intro text {{visual:roi-chart}} continues.";
        const scan = scanMarkdown(markdown);

        assert.equal(scan.protectedRanges.length, 1);
        assert.deepEqual(scan.protectedRanges[0], {
            kind: "template_placeholder",
            startOffset: 11,
            endOffset: 31,
            rawText: "{{visual:roi-chart}}",
        });
    });

    it("reports link ranges that would split a visual shortcode", () => {
        const markdown = "Intro text {{visual:roi-chart}} continues.";
        const ranges = collectMarkdownProtectedRanges(markdown);
        const shortcodeStart = markdown.indexOf("roi-chart");
        const shortcodeEnd = shortcodeStart + "roi-chart".length;

        assert.equal(rangeOverlapsProtectedRange(shortcodeStart, shortcodeEnd, ranges), true);
        assert.equal(rangeOverlapsProtectedRange(0, "Intro".length, ranges), false);
    });

    it("strips placeholders before article-level SEO tokenization", () => {
        const markdown = "Before {{visual:system-of-action}} after";

        assert.equal(stripMarkdownTemplatePlaceholders(markdown), "Before   after");
    });

    it("allows claim-coverage citations after paragraphs that contain visual shortcodes", () => {
        const markdown = "Composable business architecture reduces manual handoffs and gives teams one system of action for operational work. {{visual:system-of-action}} This article explains why connected workflows matter.";
        const scan = scanMarkdown(markdown);

        const proposals = gatherClaimCoverageProposals({
            contentMarkdown: markdown,
            workspaceLocale: "en",
            metadata: {
                provenance: {
                    fact_sheet: {
                        key_claims: ["Composable business architecture reduces manual handoffs across operational teams."],
                        sources: [{ url: "https://example.com/source", title: "Example Source", trust_tier: 2 }],
                    },
                },
            },
        }, scan);

        assert.equal(proposals.length, 1);
        assert.equal(proposals[0].startOffset, markdown.length);
        assert.equal(proposals[0].endOffset, markdown.length);
    });
});
