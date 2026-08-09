import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    normalizeSeoDescription,
    normalizeSeoTitle,
    publicTextExcerpt,
} from "./public-metadata-text";

describe("public SEO metadata text", () => {
    it("removes repeated site-name suffixes before the root title template runs", () => {
        assert.equal(
            normalizeSeoTitle({
                value: "AI for Dutch SMEs | iSystem.ai | iSystem.ai",
                siteName: "iSystem.ai",
            }),
            "AI for Dutch SMEs",
        );
    });

    it("truncates long descriptions on a word boundary with a visible ellipsis", () => {
        const description = normalizeSeoDescription({
            value: "A deliberately long description that explains the public operating system in enough detail to exceed the configured search snippet limit without ending halfway through an important word.",
            maxLength: 120,
        });

        assert.ok(description.length <= 120);
        assert.match(description, /…$/u);
        assert.doesNotMatch(description, /import…$/u);
    });

    it("turns markdown into a clean fallback excerpt", () => {
        assert.equal(
            publicTextExcerpt("## A practical guide\n\nUse **governed workflows** with [source evidence](https://example.com)."),
            "A practical guide Use governed workflows with source evidence.",
        );
    });
});
