/**
 * Normalize a markdown body so its ATX headings render correctly.
 *
 * The bug this fixes: AI-generated articles (and HTML→markdown round-trips
 * via Tiptap or our own normalizeBlogContent) sometimes emit a heading
 * marker like `### Section title` without a leading blank line — either
 * inline at the end of a paragraph (`...some text ### Section title`) or
 * directly after a paragraph (`...some text\n### Section title`). In both
 * cases CommonMark/react-markdown treats the `###` as literal text inside
 * the surrounding paragraph, so the published article shows the raw hashes.
 *
 * This helper:
 *   - unescapes `\#`, `\*`, etc. that got introduced by HTML→markdown
 *     reflows;
 *   - forces every ATX heading line to be flanked by a blank line, so it
 *     parses as a heading regardless of what came before or after it;
 *   - splits a paragraph that has an ATX marker mid-string (`text ### foo`)
 *     onto two lines first, before the blank-line pass fires;
 *   - leaves fenced code blocks alone (we don't want to touch `### ` that
 *     legitimately appears inside a code sample).
 *
 * Idempotent — applying it twice is a no-op.
 */

import { stripFencedAsciiDiagramLeaks } from "./diagram-intents";

const ATX_HEADING_RE = /^(#{1,6})\s+\S/;
const FENCE_OPEN_RE = /^\s*(```|~~~)/;
const WHOLE_DOCUMENT_MARKDOWN_FENCE_RE = /^\s*(```|~~~)[ \t]*(?:markdown|md|mdx)?[ \t]*\n([\s\S]*?)\n[ \t]*\1[ \t]*\s*$/i;
const INLINE_UNORDERED_LIST_RE = /([.!?؟:،])\s+(?=(?:[-*+]|\d+[.)])\s+\*?\*?\S)/g;
const ESCAPED_BOLD_LIST_MARKER_RE = /^(\s*)\*{3}([^*\n]{1,160}:)\*\*(?=\s|$)(.*)$/;

// Diagram-syntax leak guard. The blog generator emits mermaid/flowchart code
// for the `BlogVisualBlock` system separately from prose, but the LLM
// occasionally also pastes the raw diagram source inside `<CONTENT_MARKDOWN>`.
// When that happens it lands in `content_items.content_markdown` and renders
// as raw text under the article. Strip every fenced block whose info string
// is mermaid/flowchart/graph (case-insensitive) plus bare unfenced flowchart
// preambles ("flowchart TD", "graph LR", …) that a few drafts emit without
// any code fence at all. We also strip raw ASCII art box-drawing diagrams.
const FENCED_DIAGRAM_RE = /^[ \t]*(```|~~~)[ \t]*(?:mermaid|flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|gantt|journey|pie|mindmap|timeline|quadrantChart|gitGraph|requirementDiagram|C4Context|C4Container|C4Component|C4Dynamic)\b[\s\S]*?\n[ \t]*\1[ \t]*$/gim;
const DIAGRAM_BLOCK_START_RE = /^(?:flowchart|graph)\s+(?:TD|TB|BT|RL|LR)$/i;
const DIAGRAM_FAMILY_BLOCK_START_RE = /^(?:sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|gantt|journey|pie|mindmap|timeline|quadrantChart|gitGraph|requirementDiagram|C4Context|C4Container|C4Component|C4Dynamic)\b/i;
const INLINE_DIAGRAM_LEAK_RE = /^(?:flowchart|graph)\s+(?:TD|TB|BT|RL|LR)\s+.+(?:-->|---|==>|-.->|\[[^\]]+\]|\([^)]*\)|\{[^}]*\})/i;
const ASCII_BOX_DRAWING_RE = /[┌└│├┬┼┴┤┐┘]/;

function mapOutsideFencedCode(input: string, transformLine: (line: string) => string): string {
    const lines = input.split("\n");
    let inFence = false;

    return lines.map((line) => {
        if (FENCE_OPEN_RE.test(line)) {
            inFence = !inFence;
            return line;
        }
        return inFence ? line : transformLine(line);
    }).join("\n");
}

function unescapeFenceMarkers(input: string): string {
    return input.replace(/\\`/g, "`").replace(/\\~/g, "~");
}

function unwrapWholeDocumentMarkdownFence(input: string): string {
    const match = input.match(WHOLE_DOCUMENT_MARKDOWN_FENCE_RE);
    if (!match) return input;

    const inner = match[2].trim();
    const probe = inner.replace(/\\#/g, "#").replace(/\\\*/g, "*");
    return /^#{1,6}\s+\S/m.test(probe) || /^\s*(?:[-*+]|\d+[.)])\s+\S/m.test(probe)
        ? inner
        : input;
}

function stripUnfencedDiagramLeaks(input: string): string {
    const lines = input.split("\n");
    const out: string[] = [];
    let inFence = false;
    let skippingDiagram = false;

    for (const line of lines) {
        if (FENCE_OPEN_RE.test(line)) {
            inFence = !inFence;
            skippingDiagram = false;
            out.push(line);
            continue;
        }

        if (inFence) {
            out.push(line);
            continue;
        }

        const trimmed = line.trim();
        if (skippingDiagram) {
            if (!trimmed) {
                skippingDiagram = false;
                out.push(line);
                continue;
            }
            if (ATX_HEADING_RE.test(trimmed)) {
                skippingDiagram = false;
                out.push(line);
            }
            continue;
        }

        if (INLINE_DIAGRAM_LEAK_RE.test(trimmed)) {
            continue;
        }

        if (DIAGRAM_BLOCK_START_RE.test(trimmed) || DIAGRAM_FAMILY_BLOCK_START_RE.test(trimmed) || ASCII_BOX_DRAWING_RE.test(trimmed)) {
            if (!skippingDiagram && out.length > 0) {
                const lastLine = out[out.length - 1].trim();
                // Pop the preceding line if it's a short title/intro without terminal punctuation.
                if (lastLine.length > 0 && lastLine.length < 60 && !/[.!?؟:،]$/.test(lastLine)) {
                    out.pop();
                }
            }
            skippingDiagram = true;
            continue;
        }

        out.push(line);
    }

    return out.join("\n");
}

export function normalizeMarkdownForRender(input: string): string {
    if (!input) return "";

    // 0. Strip leaked diagram-source blocks before any other normalization.
    // Fenced first (definite), then unfenced fallback (looser — only fires
    // when a paragraph starts with a flowchart/graph preamble that's clearly
    // not prose). Both run before backslash-unescape so escaped variants
    // ("\`\`\`mermaid") get caught after step 1 too.
    let body = stripFencedAsciiDiagramLeaks(
        unwrapWholeDocumentMarkdownFence(unescapeFenceMarkers(input.trim()))
            .replace(FENCED_DIAGRAM_RE, ""),
    );
    body = stripUnfencedDiagramLeaks(body);

    // 1. Drop common HTML entity leftovers and trivial backslash-escapes.
    body = mapOutsideFencedCode(body, (line) => line
        .replace(/&#35;/g, "#")
        .replace(/&num;/g, "#")
        .replace(/\\#/g, "#")
        .replace(/\\\*/g, "*")
        .replace(/\\_/g, "_"));

    // 1b. After unescape, run the fenced-diagram strip again — this catches
    // backslash-escaped variants (e.g. "\`\`\`mermaid") that survived step 0.
    body = stripUnfencedDiagramLeaks(stripFencedAsciiDiagramLeaks(body.replace(FENCED_DIAGRAM_RE, "")));

    // 2. Split mid-line headings: ` ### Title` inside a paragraph becomes
    //    its own line. Only fires when a `#`-run is preceded by whitespace
    //    (so a literal `123#abc` URL fragment isn't touched), and only when
    //    the marker is followed by a space + non-`#` character (so we don't
    //    fire on `Issue ##42`).
    body = mapOutsideFencedCode(body, (line) => line
        .replace(/([.!?؟])(?=#{1,6}\s+\S)/g, "$1\n\n")
        .replace(
            /([^\n#])\s*(#{1,6})\s+(?=\S)/g,
            (_match, prefix: string, hashes: string) => `${prefix}\n\n${hashes} `,
        ));

    // 2b. Split inline list markers that were collapsed into a paragraph by
    // generator or translation reflows. Example: `sentence. * **Item:** text`
    // must become a real list item, otherwise ReactMarkdown renders the marker
    // literally in live prose. This intentionally requires sentence-ending
    // punctuation before the marker so ordinary emphasis (`word *emphasis*`)
    // is left alone.
    body = mapOutsideFencedCode(body, (line) => line.replace(INLINE_UNORDERED_LIST_RE, "$1\n\n"));

    // 2c. Repair escaped bold-list markers that lost the space between the
    // bullet and bold label during HTML→markdown or AI reflow passes. After
    // step 1, `\***Label:** body` becomes `***Label:** body`, which
    // ReactMarkdown renders as a literal `*` followed by bold text. Treat only
    // line-leading triple-star labels ending in `:` as malformed list items;
    // this avoids touching ordinary inline emphasis or fenced code samples.
    body = mapOutsideFencedCode(body, (line) => line.replace(
        ESCAPED_BOLD_LIST_MARKER_RE,
        (_match, indent: string, label: string, rest: string) => `${indent}* **${label}**${rest}`,
    ));

    // 3. Walk line by line and ensure ATX heading lines are flanked by a
    //    blank line on each side. Skip anything inside a fenced code block.
    const lines = body.split("\n");
    const out: string[] = [];
    let inFence = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (FENCE_OPEN_RE.test(line)) {
            inFence = !inFence;
            out.push(line);
            continue;
        }
        if (!inFence && ATX_HEADING_RE.test(line)) {
            // Ensure a blank line BEFORE the heading.
            if (out.length > 0 && out[out.length - 1].trim() !== "") {
                out.push("");
            }
            out.push(line);
            // Ensure a blank line AFTER the heading.
            const next = lines[i + 1];
            if (next !== undefined && next.trim() !== "") {
                out.push("");
            }
            continue;
        }
        out.push(line);
    }

    // 4. Collapse runs of 3+ blank lines (the previous pass can produce
    //    them) and trim outer whitespace.
    return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
