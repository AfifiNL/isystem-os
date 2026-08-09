const FENCED_CODE_BLOCK_RE = /^[ \t]*(```|~~~)[ \t]*([^\n]*)\n([\s\S]*?)\n[ \t]*\1[ \t]*$/gim;
const ASCII_BOX_DRAWING_RE = /[┌└│├┬┼┴┤┐┘]/g;
const BRACKETED_NODE_RE = /\[([^\]\n]{1,80})\]/g;
const CONNECTOR_LINE_RE = /(?:<[-=]{2,}>|[-=]{2,}>|<[-=]{2,}|[-=]{2,}>|={3,}|-{3,}|\\{2,}|\/{2,}|(?:^|\s)[v^](?:\s+[v^])+(?:\s|$))/i;

export interface AsciiDiagramIntent {
    id: string;
    heading?: string;
    source: string;
}

function cleanLine(value: string): string {
    return value
        .replace(/^[#>*+\-\s]+/, "")
        .replace(/:\s*$/, "")
        .replace(/\s+/g, " ")
        .trim();
}

function shortLabel(value: string, fallback: string): string {
    const cleaned = cleanLine(value)
        .replace(/^\[|\]$/g, "")
        .replace(/\s*\([^)]*\)\s*$/, "")
        .trim();
    return cleaned.split(/\s+/).slice(0, 5).join(" ") || fallback;
}

function slugify(value: string, fallback: string): string {
    const normalized = value
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 64);
    return normalized || fallback;
}

export function looksLikeAsciiDiagram(source: string): boolean {
    const boxDrawingCount = source.match(ASCII_BOX_DRAWING_RE)?.length ?? 0;
    if (boxDrawingCount >= 3) return true;

    const bracketedNodeCount = source.match(BRACKETED_NODE_RE)?.length ?? 0;
    if (bracketedNodeCount < 3) return false;

    const connectorLineCount = source
        .split("\n")
        .filter((line) => CONNECTOR_LINE_RE.test(line.trim()))
        .length;

    return connectorLineCount >= 2;
}

export function extractAsciiDiagramIntents(markdown: string): AsciiDiagramIntent[] {
    const intents: AsciiDiagramIntent[] = [];
    FENCED_CODE_BLOCK_RE.lastIndex = 0;

    for (const match of markdown.matchAll(FENCED_CODE_BLOCK_RE)) {
        const source = match[3].trim();
        if (!looksLikeAsciiDiagram(source)) continue;

        const prefix = markdown.slice(0, match.index ?? 0);
        const headingMatches = Array.from(prefix.matchAll(/^#{2,3}\s+(.+?)\s*$/gm));
        const heading = headingMatches.at(-1)?.[1]?.trim();

        intents.push({
            id: `draft-diagram-intent-${intents.length + 1}`,
            heading,
            source,
        });
    }

    return intents;
}

export function containsAsciiDiagramLeak(markdown: string): boolean {
    ASCII_BOX_DRAWING_RE.lastIndex = 0;
    return ASCII_BOX_DRAWING_RE.test(markdown) || extractAsciiDiagramIntents(markdown).length > 0;
}

export function stripFencedAsciiDiagramLeaks(markdown: string): string {
    FENCED_CODE_BLOCK_RE.lastIndex = 0;
    return markdown.replace(
        FENCED_CODE_BLOCK_RE,
        (block, _fence: string, _info: string, source: string) => (
            looksLikeAsciiDiagram(source) ? "" : block
        ),
    );
}

function sectionDescription(lines: string[], startIndex: number, endIndex: number): string {
    const window = lines.slice(startIndex + 1, endIndex);
    const parenthetical = window
        .map((line) => line.trim())
        .find((line) => /^\([^()]{12,240}\)$/.test(line));
    if (parenthetical) return parenthetical.slice(1, -1).trim();

    const labels = Array.from(
        window.join("\n").matchAll(BRACKETED_NODE_RE),
        (match) => cleanLine(match[1]),
    ).filter(Boolean);
    return labels.length
        ? `Connects ${Array.from(new Set(labels)).slice(0, 5).join(", ")}.`
        : "Structured interpretation of the original draft diagram.";
}

/**
 * Builds a render-safe author-synthesis block when the structured model fails
 * to convert a detected ASCII diagram intent. The fallback favors comparison
 * cards for multi-architecture sketches and a relational map otherwise.
 */
export function buildAsciiDiagramFallback(intent: AsciiDiagramIntent): Record<string, unknown> {
    const lines = intent.source.split("\n").map((line) => line.trim()).filter(Boolean);
    const title = cleanLine(lines[0] ?? "") || "Structured system diagram";
    const sectionIndexes = lines
        .map((line, index) => ({ line, index }))
        .filter(({ line, index }) => index > 0 && /:\s*$/.test(line) && !/^\[/.test(line));

    let diagramType: "comparison_matrix" | "relational" = "relational";
    let nodes: Array<Record<string, unknown>>;
    const edges: Array<Record<string, unknown>> = [];

    if (sectionIndexes.length >= 2) {
        diagramType = "comparison_matrix";
        nodes = sectionIndexes.slice(0, 4).map(({ line, index }, nodeIndex) => {
            const nextIndex = sectionIndexes[nodeIndex + 1]?.index ?? lines.length;
            const label = shortLabel(line, `Option ${nodeIndex + 1}`);
            return {
                id: slugify(label, `option-${nodeIndex + 1}`),
                label,
                description: sectionDescription(lines, index, nextIndex),
                node_type: "boundary",
            };
        });
    } else {
        const uniqueLabels = Array.from(new Set(
            Array.from(intent.source.matchAll(BRACKETED_NODE_RE), (match) => cleanLine(match[1]))
                .filter(Boolean),
        ));
        const fallbackLabels = Array.from(new Set(
            lines
                .filter((line) => !/^(?:[v^]\s*)+$/i.test(line))
                .map((line) => cleanLine(line.replace(/[┌└│├┬┼┴┤┐┘─═<>/=\\^]+/g, " ")))
                .filter((line) => /[a-z]{2,}/i.test(line) && line.length <= 80),
        ));
        const diagramLabels = (uniqueLabels.length >= 2 ? uniqueLabels : fallbackLabels).slice(0, 8);
        nodes = diagramLabels.map((label, index) => ({
            id: slugify(label, `node-${index + 1}`),
            label: shortLabel(label, `Node ${index + 1}`),
            description: "System element recovered from the draft's diagram intent.",
            node_type: "actor",
        }));

        for (const line of lines) {
            const lineLabels = Array.from(line.matchAll(BRACKETED_NODE_RE), (match) => cleanLine(match[1]));
            for (let index = 0; index < lineLabels.length - 1; index += 1) {
                edges.push({
                    from: slugify(lineLabels[index], ""),
                    to: slugify(lineLabels[index + 1], ""),
                    label: "coordinates with",
                    polarity: "neutral",
                });
            }
        }
    }

    return {
        id: intent.id,
        type: "diagram",
        diagram_type: diagramType,
        system_archetype: diagramType === "relational" ? "system_map" : undefined,
        feedback_type: "none",
        title,
        description: "A structured rendering of the architecture comparison requested in the draft.",
        caption: "Author synthesis of the relationships expressed in the draft; not external proof.",
        source_label: "",
        source_url: "",
        seo_alt: `${title} structured diagram`,
        placement_hint: intent.heading,
        nodes,
        edges,
        evidence: {
            claim_id: `${intent.id}-evidence`,
            claim_text: title,
            evidence_type: "author_synthesis",
            source_quality: "internal",
            confidence: "medium",
            source_note: "Author synthesis converted from draft diagram intent; not external proof.",
        },
    };
}

export function formatAsciiDiagramIntentsForPrompt(intents: readonly AsciiDiagramIntent[]): string {
    if (!intents.length) return "No raw diagram intents were detected in the draft.";

    return intents.map((intent) => [
        `REQUIRED STRUCTURED DIAGRAM ID: ${intent.id}`,
        `CONTAINING HEADING: ${intent.heading ?? "Use the closest matching H2/H3 target"}`,
        "RAW DRAFT DIAGRAM INTENT:",
        intent.source.slice(0, 2400),
    ].join("\n")).join("\n\n");
}
