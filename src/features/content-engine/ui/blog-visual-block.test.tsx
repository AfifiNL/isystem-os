import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { BlogDiagramBlock } from "../visual-enrichment";
import { BlogVisualBlockRenderer } from "./blog-visual-block";

const block: BlogDiagramBlock = {
    id: "diagram-review-boundary",
    type: "diagram",
    diagram_type: "framework",
    title: "Review boundary",
    description: "A public framework.",
    caption: "A controlled public caption.",
    source_label: "iSystem.ai framework",
    source_url: "",
    seo_alt: "Review boundary framework",
    nodes: [{ id: "review", label: "Review" }],
    edges: [],
    evidence: {
        claim_id: "claim-review-boundary",
        visual_id: "diagram-review-boundary",
        claim_text: "A directional framework.",
        claim_type: "author_framework",
        evidence_type: "author_framework",
        source_quality: "internal",
        confidence: "low",
        metric_definition: "Internal reviewer-only metric definition.",
        source_note: "no_primary_or_near_primary_numeric_claim_available",
        safe_fallback_wording: "Internal fallback wording.",
        badge_label: "Framework",
    },
};

describe("blog visual public evidence boundary", () => {
    it("does not render reviewer diagnostics or machine reason codes publicly", () => {
        const markup = renderToStaticMarkup(
            <BlogVisualBlockRenderer block={block} publicView />,
        );

        assert.doesNotMatch(markup, /no_primary_or_near_primary/i);
        assert.doesNotMatch(markup, /reviewer-only metric/i);
        assert.doesNotMatch(markup, /confidence:/i);
        assert.doesNotMatch(markup, /Internal fallback wording/i);
        assert.match(markup, /not an external statistic/i);
    });

    it("keeps diagnostics available in the private editor rendering", () => {
        const markup = renderToStaticMarkup(
            <BlogVisualBlockRenderer block={block} />,
        );

        assert.match(markup, /noprimaryornearprimarynumericclaim/i);
        assert.match(markup, /reviewer-only metric/i);
    });
});

const relationalBlock = {
    ...block,
    id: "diagram-capacity-loop",
    diagram_type: "relational",
    title: "Capacity feedback loop",
    seo_alt: "A reinforcing feedback loop between demand, capacity, and trust",
    system_archetype: "reinforcing_loop",
    feedback_type: "reinforcing",
    nodes: [
        { id: "demand", label: "Demand signal", description: "Qualified demand enters the system." },
        { id: "capacity", label: "Delivery capacity", description: "The team absorbs new work." },
        { id: "trust", label: "Customer trust", description: "Reliable delivery builds trust." },
    ],
    edges: [
        { from: "demand", to: "capacity", label: "increases", polarity: "positive", delay: true },
        { from: "capacity", to: "trust", label: "builds", polarity: "positive" },
        { from: "trust", to: "demand", label: "reinforces", polarity: "positive" },
    ],
} as unknown as BlogDiagramBlock;

describe("relational systems diagram rendering", () => {
    it("renders archetype, relationship polarity, and delays as an accessible system map", () => {
        const markup = renderToStaticMarkup(
            <BlogVisualBlockRenderer block={relationalBlock} publicView />,
        );

        assert.match(markup, /data-diagram-type="relational"/);
        assert.match(markup, /Reinforcing loop/);
        assert.match(markup, /increases/);
        assert.match(markup, /positive relationship/i);
        assert.match(markup, /delay/i);
        assert.match(markup, /aria-label="A reinforcing feedback loop/);
    });

    it("uses valid high-contrast color fallbacks in Content Studio and published rendering", () => {
        const editorMarkup = renderToStaticMarkup(
            <BlogVisualBlockRenderer block={relationalBlock} />,
        );
        const publicMarkup = renderToStaticMarkup(
            <BlogVisualBlockRenderer block={relationalBlock} publicView />,
        );

        for (const markup of [editorMarkup, publicMarkup]) {
            assert.doesNotMatch(markup, /hsl\(var\(--(?:card|foreground|muted-foreground|primary|border)\)/);
            assert.match(markup, /fill="var\(--template-surface-inverse-raised,[^"]*var\(--card, #ffffff\)/);
            assert.match(markup, /fill="var\(--template-text-inverse,[^"]*var\(--foreground, #0f172a\)/);
            assert.match(markup, /var\(--primary, #2563eb\)/);
        }
    });
});
