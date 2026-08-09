import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeContentMarkdownForSave } from "./content-normalization";

describe("normalizeContentMarkdownForSave", () => {
    it("normalizes markdown before persistence", () => {
        const normalized = normalizeContentMarkdownForSave([
            "Intro.### Collapsed heading",
            "",
            "flowchart TD A[Audit] --> B[Plan]",
            "Body.",
        ].join("\n"));

        assert.equal(normalized, [
            "Intro.",
            "",
            "### Collapsed heading",
            "",
            "Body.",
        ].join("\n"));
    });
});
