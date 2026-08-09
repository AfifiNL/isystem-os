import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    buildAsciiDiagramFallback,
    extractAsciiDiagramIntents,
    looksLikeAsciiDiagram,
} from "./diagram-intents";

const ARCHITECTURE_SKETCH = [
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
].join("\n");

describe("ASCII diagram intent conversion", () => {
    it("recognizes the generated bracket-and-connector architecture sketch", () => {
        assert.equal(looksLikeAsciiDiagram(ARCHITECTURE_SKETCH), true);
        assert.equal(looksLikeAsciiDiagram("const a = staff[0];\nconst b = staff[1];\nreturn staff[2];"), false);
    });

    it("captures the containing heading and a stable required id", () => {
        const markdown = [
            "## The scaling rule",
            "Prose before.",
            "",
            "```",
            ARCHITECTURE_SKETCH,
            "```",
        ].join("\n");
        const intents = extractAsciiDiagramIntents(markdown);

        assert.equal(intents.length, 1);
        assert.equal(intents[0].id, "draft-diagram-intent-1");
        assert.equal(intents[0].heading, "The scaling rule");
    });

    it("builds a structured comparison fallback with author-synthesis evidence", () => {
        const [intent] = extractAsciiDiagramIntents([
            "## The scaling rule",
            "```",
            ARCHITECTURE_SKETCH,
            "```",
        ].join("\n"));
        const fallback = buildAsciiDiagramFallback(intent);
        const nodes = fallback.nodes as Array<Record<string, unknown>>;
        const evidence = fallback.evidence as Record<string, unknown>;

        assert.equal(fallback.id, "draft-diagram-intent-1");
        assert.equal(fallback.diagram_type, "comparison_matrix");
        assert.equal(fallback.placement_hint, "The scaling rule");
        assert.equal(nodes.length, 2);
        assert.deepEqual(nodes.map((node) => node.label), [
            "Traditional",
            "Centralized System State Architecture",
        ]);
        assert.equal(evidence.evidence_type, "author_synthesis");
        assert.equal(evidence.source_quality, "internal");
    });

    it("keeps box-drawing-only intents renderable without model output", () => {
        const fallback = buildAsciiDiagramFallback({
            id: "draft-diagram-intent-2",
            heading: "Data boundary",
            source: [
                "System boundary",
                "┌──────────────┐",
                "│ Public input │",
                "└──────┬───────┘",
                "       │",
                "┌──────┴───────┐",
                "│ Review queue │",
                "└──────────────┘",
            ].join("\n"),
        });
        const nodes = fallback.nodes as Array<Record<string, unknown>>;

        assert.ok(nodes.length >= 2);
        assert.ok(nodes.some((node) => node.label === "Review queue"));
        assert.equal(fallback.diagram_type, "relational");
    });
});
