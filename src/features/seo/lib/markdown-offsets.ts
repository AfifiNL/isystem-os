// Lightweight markdown scanner that produces offset-tracked paragraph, heading,
// and link nodes. We use offsets directly for string.slice() splicing so the
// user's original markdown formatting is preserved byte-for-byte outside the
// mutated ranges — a remark-parse → remark-stringify round-trip would silently
// normalize list markers, emphasis delimiters, and whitespace.

export type MdNodeKind = "heading" | "paragraph" | "code_fence" | "blockquote" | "hr" | "list_item" | "html_block";

export interface MdBlockNode {
    kind: MdNodeKind;
    startOffset: number;   // inclusive byte offset in the source
    endOffset: number;     // exclusive
    startLine: number;     // 1-based
    endLine: number;       // 1-based inclusive
    rawText: string;       // substring source.slice(startOffset, endOffset)
    // For headings: level 1..6; for others: null
    headingLevel: number | null;
    // For paragraphs: the text with leading/trailing whitespace trimmed
    innerText: string;
}

export interface MdInlineLink {
    kind: "inline_link" | "image";
    startOffset: number;
    endOffset: number;
    anchorText: string;
    href: string;
}

export interface MdProtectedRange {
    kind: "template_placeholder";
    startOffset: number;
    endOffset: number;
    rawText: string;
}

export interface MdScanResult {
    blocks: MdBlockNode[];
    links: MdInlineLink[];
    protectedRanges: MdProtectedRange[];
    paragraphs: MdBlockNode[];
    headings: MdBlockNode[];
}

const FENCE_RE = /^(```|~~~)/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const BLOCKQUOTE_RE = /^>\s?/;
const HR_RE = /^(\s*[-*_]){3,}\s*$/;
const LIST_ITEM_RE = /^\s{0,3}(?:[-*+]|\d+[.)])\s+/;
const HTML_BLOCK_RE = /^\s*<\/?[a-z][^>]*>/i;
// Inline link: [text](url) — non-greedy text, url stops at whitespace or )
const INLINE_LINK_RE = /(!?)\[([^\]]*?)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
// Blog visual/charts are rendered from shortcode placeholders such as
// `{{visual:roi-chart}}`. The SEO mutation layer must treat every `{{...}}`
// token as opaque so link insertion can never split the renderer key.
const TEMPLATE_PLACEHOLDER_RE = /\{\{[^{}\n]{1,160}\}\}/g;

/**
 * Splits markdown into typed block nodes with source offsets. Handles fenced
 * code blocks (content inside is opaque), headings, paragraphs, blockquotes,
 * lists, horizontal rules, and raw HTML blocks.
 */
export function scanMarkdown(source: string): MdScanResult {
    const blocks: MdBlockNode[] = [];
    const lines = source.split("\n");
    const lineOffsets: number[] = [0];
    for (let i = 0; i < lines.length; i += 1) {
        lineOffsets.push(lineOffsets[i] + lines[i].length + 1);
    }

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];

        // Skip blank lines
        if (line.trim() === "") {
            i += 1;
            continue;
        }

        // Fenced code block — swallow until matching fence
        if (FENCE_RE.test(line)) {
            const start = i;
            i += 1;
            while (i < lines.length && !FENCE_RE.test(lines[i])) i += 1;
            if (i < lines.length) i += 1; // include closing fence
            blocks.push(buildBlock(source, lineOffsets, "code_fence", start, i - 1, null));
            continue;
        }

        // Heading
        const headingMatch = HEADING_RE.exec(line);
        if (headingMatch) {
            blocks.push(buildBlock(source, lineOffsets, "heading", i, i, headingMatch[1].length));
            i += 1;
            continue;
        }

        // Horizontal rule
        if (HR_RE.test(line)) {
            blocks.push(buildBlock(source, lineOffsets, "hr", i, i, null));
            i += 1;
            continue;
        }

        // Blockquote — multi-line until blank
        if (BLOCKQUOTE_RE.test(line)) {
            const start = i;
            while (i < lines.length && lines[i].trim() !== "" && BLOCKQUOTE_RE.test(lines[i])) i += 1;
            blocks.push(buildBlock(source, lineOffsets, "blockquote", start, i - 1, null));
            continue;
        }

        // List item — multi-line until blank
        if (LIST_ITEM_RE.test(line)) {
            const start = i;
            while (i < lines.length && lines[i].trim() !== "" && (LIST_ITEM_RE.test(lines[i]) || /^\s{2,}/.test(lines[i]))) i += 1;
            blocks.push(buildBlock(source, lineOffsets, "list_item", start, i - 1, null));
            continue;
        }

        // HTML block
        if (HTML_BLOCK_RE.test(line)) {
            const start = i;
            while (i < lines.length && lines[i].trim() !== "") i += 1;
            blocks.push(buildBlock(source, lineOffsets, "html_block", start, i - 1, null));
            continue;
        }

        // Paragraph — multi-line until blank or block boundary
        const start = i;
        while (
            i < lines.length
            && lines[i].trim() !== ""
            && !FENCE_RE.test(lines[i])
            && !HEADING_RE.test(lines[i])
            && !HR_RE.test(lines[i])
            && !BLOCKQUOTE_RE.test(lines[i])
            && !LIST_ITEM_RE.test(lines[i])
            && !HTML_BLOCK_RE.test(lines[i])
        ) {
            i += 1;
        }
        blocks.push(buildBlock(source, lineOffsets, "paragraph", start, i - 1, null));
    }

    // Inline link scan — restricted to paragraph and heading blocks (skip code fences)
    const links: MdInlineLink[] = [];
    for (const block of blocks) {
        if (block.kind === "code_fence" || block.kind === "html_block") continue;
        INLINE_LINK_RE.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = INLINE_LINK_RE.exec(block.rawText)) !== null) {
            const absStart = block.startOffset + match.index;
            const absEnd = absStart + match[0].length;
            links.push({
                kind: match[1] === "!" ? "image" : "inline_link",
                startOffset: absStart,
                endOffset: absEnd,
                anchorText: match[2],
                href: match[3],
            });
        }
    }

    const protectedRanges = collectMarkdownProtectedRanges(source, blocks);

    return {
        blocks,
        links,
        protectedRanges,
        paragraphs: blocks.filter((b) => b.kind === "paragraph"),
        headings: blocks.filter((b) => b.kind === "heading"),
    };
}

export function hasMarkdownTemplatePlaceholder(value: string): boolean {
    TEMPLATE_PLACEHOLDER_RE.lastIndex = 0;
    return TEMPLATE_PLACEHOLDER_RE.test(value);
}

export function stripMarkdownTemplatePlaceholders(value: string): string {
    TEMPLATE_PLACEHOLDER_RE.lastIndex = 0;
    return value.replace(TEMPLATE_PLACEHOLDER_RE, " ");
}

export function collectMarkdownProtectedRanges(
    source: string,
    blocks?: readonly MdBlockNode[],
): MdProtectedRange[] {
    const searchableBlocks = blocks && blocks.length > 0
        ? blocks.filter((block) => block.kind !== "code_fence" && block.kind !== "html_block")
        : [{ startOffset: 0, rawText: source }];
    const ranges: MdProtectedRange[] = [];

    for (const block of searchableBlocks) {
        TEMPLATE_PLACEHOLDER_RE.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = TEMPLATE_PLACEHOLDER_RE.exec(block.rawText)) !== null) {
            const absStart = block.startOffset + match.index;
            ranges.push({
                kind: "template_placeholder",
                startOffset: absStart,
                endOffset: absStart + match[0].length,
                rawText: match[0],
            });
        }
    }

    return ranges;
}

export function rangeOverlapsProtectedRange(
    startOffset: number,
    endOffset: number,
    protectedRanges: readonly MdProtectedRange[],
): boolean {
    return protectedRanges.some((range) => {
        if (startOffset === endOffset) {
            return startOffset > range.startOffset && startOffset < range.endOffset;
        }
        return startOffset < range.endOffset && range.startOffset < endOffset;
    });
}

export function blockHasProtectedRange(
    block: Pick<MdBlockNode, "startOffset" | "endOffset">,
    protectedRanges: readonly MdProtectedRange[],
): boolean {
    return protectedRanges.some((range) => block.startOffset < range.endOffset && range.startOffset < block.endOffset);
}

function buildBlock(
    source: string,
    lineOffsets: number[],
    kind: MdNodeKind,
    startLine: number,
    endLine: number,
    headingLevel: number | null,
): MdBlockNode {
    const startOffset = lineOffsets[startLine];
    // End offset: exclusive, so one past the newline of the last line (or EOF)
    const endOffset = endLine + 1 < lineOffsets.length ? lineOffsets[endLine + 1] - 1 : source.length;
    const rawText = source.slice(startOffset, endOffset);
    const innerText = kind === "heading"
        ? (HEADING_RE.exec(source.slice(startOffset, endOffset).split("\n")[0] ?? "")?.[2] ?? rawText).trim()
        : rawText.trim();
    return {
        kind,
        startOffset,
        endOffset,
        startLine: startLine + 1,
        endLine: endLine + 1,
        rawText,
        headingLevel,
        innerText,
    };
}

/**
 * Returns true if the paragraph already contains an inline link anywhere in
 * its range — used to avoid proposing a second link next to an existing one.
 */
export function paragraphHasExistingLink(paragraph: MdBlockNode, links: MdInlineLink[]): boolean {
    return links.some((link) =>
        link.startOffset >= paragraph.startOffset
        && link.endOffset <= paragraph.endOffset,
    );
}

/**
 * Applies an ordered list of non-overlapping splices in reverse document
 * order so earlier offsets remain valid while later ranges are being rewritten.
 * Throws if any two ranges overlap.
 */
export interface MdSplice {
    startOffset: number;
    endOffset: number;
    replacement: string;
}

export function applySplices(source: string, splices: MdSplice[]): string {
    const sorted = [...splices].sort((a, b) => b.startOffset - a.startOffset);
    for (let i = 0; i < sorted.length - 1; i += 1) {
        if (sorted[i].startOffset < sorted[i + 1].endOffset) {
            throw new Error(
                `applySplices: overlapping ranges at ${sorted[i].startOffset}-${sorted[i].endOffset} and ${sorted[i + 1].startOffset}-${sorted[i + 1].endOffset}`,
            );
        }
    }
    let out = source;
    for (const splice of sorted) {
        if (splice.startOffset < 0 || splice.endOffset > out.length || splice.startOffset > splice.endOffset) {
            throw new Error(`applySplices: invalid range ${splice.startOffset}-${splice.endOffset}`);
        }
        out = out.slice(0, splice.startOffset) + splice.replacement + out.slice(splice.endOffset);
    }
    return out;
}

// Stable hash of the source markdown for optimistic lock comparison. Simple
// FNV-1a — collision resistance is not the goal; detecting any change is.
export function fingerprintMarkdown(source: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < source.length; i += 1) {
        hash ^= source.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
}
