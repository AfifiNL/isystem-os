import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeMarkdownForRender } from "./normalize-markdown";

describe("normalizeMarkdownForRender", () => {
    it("unwraps full-response markdown fences without breaking real code fences", () => {
        const normalized = normalizeMarkdownForRender([
            "```markdown",
            "# Launch notes",
            "",
            "Intro paragraph.",
            "",
            "```ts",
            "const heading = '# still code';",
            "```",
            "```",
        ].join("\n"));

        assert.equal(normalized, [
            "# Launch notes",
            "",
            "Intro paragraph.",
            "",
            "```ts",
            "const heading = '# still code';",
            "```",
        ].join("\n"));
    });

    it("unescapes full-response escaped fences before rendering", () => {
        const normalized = normalizeMarkdownForRender([
            "\\`\\`\\`md",
            "\\# Escaped heading",
            "",
            "Text.",
            "\\`\\`\\`",
        ].join("\n"));

        assert.equal(normalized, "# Escaped heading\n\nText.");
    });

    it("unescapes collapsed list markers so escaped bullets render as lists", () => {
        const normalized = normalizeMarkdownForRender("betrouwbaarheid. \\* **Zapier:** automatiseert overdrachten.");

        assert.equal(normalized, "betrouwbaarheid.\n\n* **Zapier:** automatiseert overdrachten.");
        assert.equal(normalized.includes("\\* **Zapier"), false);
    });

    it("repairs escaped bold-list markers that collapsed the bullet and label", () => {
        const normalized = normalizeMarkdownForRender([
            "\\***Data Sovereignty:** The ability to prove residency.",
            "\\***API-First Integration:** Rather than manual copy-pasting.",
            "\\***Some label:** body text",
        ].join("\n"));

        assert.equal(normalized, [
            "* **Data Sovereignty:** The ability to prove residency.",
            "* **API-First Integration:** Rather than manual copy-pasting.",
            "* **Some label:** body text",
        ].join("\n"));
        assert.equal(normalized.includes("\\***Data Sovereignty:**"), false);
        assert.equal(normalized.includes("\\***API-First Integration:**"), false);
    });

    it("splits collapsed heading adjacency into a renderable heading", () => {
        const normalized = normalizeMarkdownForRender("betrouwbaarheid.### Implementatie\nDetails volgen.");

        assert.equal(normalized, "betrouwbaarheid.\n\n### Implementatie\n\nDetails volgen.");
        assert.equal(normalized.includes("betrouwbaarheid.###"), false);
    });

    it("does not rewrite escaped markers or headings inside fenced code blocks", () => {
        const input = [
            "```md",
            "betrouwbaarheid. \\* **Zapier:** literal code sample",
            "\\***Data Sovereignty:** literal code sample",
            "betrouwbaarheid.### Literal heading marker",
            "```",
        ].join("\n");

        assert.equal(normalizeMarkdownForRender(input), input);
    });

    it("preserves fenced code while normalizing headings and lists outside it", () => {
        const input = [
            "Intro.### Real heading",
            "",
            "```tsx",
            "const literal = '\\# Not a markdown heading';",
            "const list = '\\* not a list';",
            "```",
            "",
            "Next sentence. \\* **Item:** render this as a list.",
        ].join("\n");

        assert.equal(normalizeMarkdownForRender(input), [
            "Intro.",
            "",
            "### Real heading",
            "",
            "```tsx",
            "const literal = '\\# Not a markdown heading';",
            "const list = '\\* not a list';",
            "```",
            "",
            "Next sentence.",
            "",
            "* **Item:** render this as a list.",
        ].join("\n"));
    });

    it("strips leaked mermaid fences after escaped fence normalization", () => {
        const normalized = normalizeMarkdownForRender([
            "Intro.",
            "",
            "\\`\\`\\`mermaid",
            "flowchart TD",
            "A-->B",
            "\\`\\`\\`",
            "",
            "Outro.",
        ].join("\n"));

        assert.equal(normalized, "Intro.\n\nOutro.");
    });

    it("strips unfenced diagram leaks without deleting adjacent prose", () => {
        const normalized = normalizeMarkdownForRender([
            "Intro.",
            "",
            "flowchart TD",
            "A-->B",
            "",
            "## Next section",
            "Details.",
        ].join("\n"));

        assert.equal(normalized, "Intro.\n\n## Next section\n\nDetails.");
    });

    it("strips unfenced gantt, journey, and pie diagram leaks", () => {
        const normalized = normalizeMarkdownForRender([
            "Intro.",
            "",
            "gantt",
            "title Launch timeline",
            "section Build",
            "Audit :a1, 2026-01-01, 7d",
            "",
            "journey",
            "title Buyer journey",
            "section Discovery",
            "Read audit: 5: Buyer",
            "",
            "pie title Budget split",
            '"Tools" : 40',
            '"Services" : 60',
            "",
            "## Next section",
            "Details.",
        ].join("\n"));

        assert.equal(normalized, "Intro.\n\n## Next section\n\nDetails.");
    });

    it("strips conservative one-line diagram DSL leaks", () => {
        const normalized = normalizeMarkdownForRender([
            "Intro.",
            "flowchart TD A[Audit] --> B[Plan]",
            "This survives.",
        ].join("\n"));

        assert.equal(normalized, "Intro.\nThis survives.");
    });

    it("preserves normal prose mentioning flowchart", () => {
        const input = "The flowchart in the article explains how audits become implementation plans.";

        assert.equal(normalizeMarkdownForRender(input), input);
    });

    it("strips fenced ASCII art diagrams", () => {
        const normalized = normalizeMarkdownForRender([
            "Intro.",
            "",
            "```",
            " ┌──────────────────────────────────────────────────────────┐ ",
            " │ TENANTS │ ",
            " │ - id (UUID, PK) │ ",
            " │ - company_name (VARCHAR) │ ",
            " │ - subscription_status (VARCHAR) │ ",
            " └────────────────────────────┬─────────────────────────────┘",
            "```",
            "",
            "Outro.",
        ].join("\n"));

        assert.equal(normalized, "Intro.\n\nOutro.");
    });

    it("strips plain fenced bracket-and-connector architecture diagrams", () => {
        const normalized = normalizeMarkdownForRender([
            "Intro.",
            "",
            "```",
            "Individualized Communication vs. Centralized System State Architecture:",
            "",
            "Traditional (M-to-N Communication):",
            " [Staff A] <=========> [Staff B]",
            " \\\\ //",
            " \\\\ //",
            " [Staff C] <=> [Staff D]",
            " (Coordination tax scales quadratically with team size)",
            "",
            "Centralized System State Architecture:",
            " [Staff A] ========\\\\ //======== [Staff B]",
            " v v",
            " [Centralized System]",
            " ^ ^",
            " [Staff C] ========// \\\\======== [Staff D]",
            " (Coordination tax scales linearly; system state is the truth source)",
            "```",
            "",
            "Outro.",
        ].join("\n"));

        assert.equal(normalized, "Intro.\n\nOutro.");
    });

    it("preserves ordinary fenced code that contains bracket access", () => {
        const input = [
            "```ts",
            "const first = staff[0];",
            "const second = staff[1];",
            "if (first === second) return staff[2];",
            "```",
        ].join("\n");

        assert.equal(normalizeMarkdownForRender(input), input);
    });

    it("strips unfenced ASCII art diagrams", () => {
        const normalized = normalizeMarkdownForRender([
            "Intro.",
            "",
            " ┌──────────────────────────────────────────────────────────┐ ",
            " │ TENANTS │ ",
            " │ - id (UUID, PK) │ ",
            " │ - company_name (VARCHAR) │ ",
            " │ - subscription_status (VARCHAR) │ ",
            " └────────────────────────────┬─────────────────────────────┘",
            "",
            "Outro.",
        ].join("\n"));

        assert.equal(normalized, "Intro.\n\nOutro.");
    });

    it("strips line graph ASCII art diagrams", () => {
        const normalized = normalizeMarkdownForRender([
            "Intro.",
            "",
            " Annual cost ▲",
            "             │        / SaaS Sprawl (Linear Seat Cost)",
            "             │       / ",
            "             │      / ",
            "             │     / ",
            "             │ ┌─────────────────────────/──────────────────────────┐",
            "             │ │ Capital Expenditure    /                           │",
            "             │ │ Custom Portal Setup   /                            │",
            "             │ └──────────────────────/─────────────────────────────┘",
            "             │   / ",
            "             │  / ",
            "             │ /      Custom Portal (Flat Maintenance)",
            "             │ /───────────────────────────────",
            "             │ /",
            "             │/",
            "             └─────────────────┴─────────────────────────────────────► Time (Months)",
            "                               6-12 Month Break-Even",
            "",
            "Outro.",
        ].join("\n"));

        assert.equal(normalized, "Intro.\n\nOutro.");
    });
});
