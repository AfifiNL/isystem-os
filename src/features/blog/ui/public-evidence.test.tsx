import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PublicEvidenceSource } from "@/features/source-intelligence/public";
import { PublicEvidenceBadges, PublicEvidenceDrawer } from "./public-evidence";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const blogPageSource = readFileSync(
    new URL("../../../app/(public)/blog/[slug]/page.tsx", import.meta.url),
    "utf8",
);

const reviewedSource: PublicEvidenceSource = {
    id: "nist-ai-rmf",
    title: "AI Risk Management Framework",
    publisher: "NIST",
    quality: "authoritative",
    trustTier: "regulatory",
    publishedAt: null,
    retrievedAt: null,
    citationUrl: "https://www.nist.gov/itl/ai-risk-management-framework",
    citationLabel: "Governance reference",
    evidenceType: "supporting",
    evidenceCategory: "context_source",
};

describe("public blog evidence rendering", () => {
    it("renders no evidence surface when no reviewed public source exists", () => {
        const markup = renderToStaticMarkup(
            <PublicEvidenceDrawer sources={[]} locale="en" />,
        );

        assert.equal(markup, "");
        assert.doesNotMatch(markup, /No public evidence links are available/i);
    });

    it("renders reviewed public sources as external links", () => {
        const markup = renderToStaticMarkup(
            <PublicEvidenceDrawer sources={[reviewedSource]} locale="en" />,
        );

        assert.match(markup, /Evidence used/);
        assert.match(markup, /AI Risk Management Framework/);
        assert.match(markup, /https:\/\/www\.nist\.gov\/itl\/ai-risk-management-framework/);
    });

    it("describes public evidence as reviewed rather than universally verified", () => {
        const markup = renderToStaticMarkup(
            <PublicEvidenceBadges
                summary={{
                    contentId: "content-1",
                    verifiedSourceCount: 1,
                    hasPrimaryOrNearPrimary: true,
                    updatedThisWeek: false,
                    evidenceTaxonomy: ["context_source"],
                }}
                locale="en"
            />,
        );

        assert.match(markup, /1 reviewed sources/i);
        assert.doesNotMatch(markup, /verified sources/i);
    });

    it("passes article markdown and the canonical host to the evidence resolver", () => {
        assert.match(blogPageSource, /contentMarkdown:\s*post\.content_markdown/);
        assert.match(blogPageSource, /siteHost:\s*metadataBase\?\.hostname/);
    });
});
