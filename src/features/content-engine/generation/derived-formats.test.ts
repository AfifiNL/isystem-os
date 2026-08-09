import assert from "node:assert/strict";
import test from "node:test";
import { normalizeGeneratedDraftFormats } from "./derived-formats";

test("implicit newsletter output is explicit in the derived output manifest", () => {
    const result = normalizeGeneratedDraftFormats({
        generatedFormats: {
            blog_post: { content_markdown: "# Post" },
            newsletter_issue: {
                subject_lines: ["One", "Two"],
                preheader: "A short preview",
                body_markdown: "Hello operator.",
            },
        },
        requestedFormats: ["blog_post"],
        evidencePack: { checked_at: "2026-07-24" },
    });

    assert.equal(result.generatedFormats.newsletter_issue, "Hello operator.");
    assert.deepEqual(result.derivedOutputs, [{
        format: "newsletter_issue",
        derivedFrom: "blog_post",
        status: "generated",
        companionFormats: ["newsletter_subject_lines", "newsletter_preheader"],
    }]);
});

test("failed implicit newsletter generation remains visible instead of silently disappearing", () => {
    const result = normalizeGeneratedDraftFormats({
        generatedFormats: {
            blog_post: { content_markdown: "# Post" },
            newsletter_issue: { raw_fallback: "provider failed" },
        },
        requestedFormats: ["blog_post"],
        evidencePack: null,
    });

    assert.equal("newsletter_issue" in result.generatedFormats, false);
    assert.equal(result.derivedOutputs[0]?.status, "failed");
});

test("an explicitly requested newsletter is not mislabeled as a derived output", () => {
    const result = normalizeGeneratedDraftFormats({
        generatedFormats: {
            newsletter_issue: {
                subject_lines: [],
                preheader: "",
                body_markdown: "Requested newsletter.",
            },
        },
        requestedFormats: ["newsletter_issue"],
        evidencePack: null,
    });

    assert.deepEqual(result.derivedOutputs, []);
});
