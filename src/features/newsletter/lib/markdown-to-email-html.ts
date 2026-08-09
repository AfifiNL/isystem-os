// Email-safe markdown → HTML renderer for newsletter campaigns.
//
// Why hand-rolled and not a library:
// - `react-markdown` is the only markdown lib in the project, and it's
//   React-only — email rendering needs a plain HTML string.
// - The construct set the content engine emits is a known subset of
//   CommonMark (headings, paragraphs, lists, bold/italic, links, inline
//   code, blockquotes), not the full spec.
// - Every tag is emitted with inline styles, which means no `<style>` block,
//   no class names, no external CSS — what Gmail / Outlook / Apple Mail
//   actually render reliably.
//
// What this is NOT:
// - A full CommonMark parser. No HTML pass-through, no autolinks beyond
//   explicit `[text](url)`, no tables (newsletters shouldn't carry them).
// - A sanitizer for arbitrary user input. All callers feed it text that
//   was either authored by a manager or produced by the AI orchestrator;
//   neither is trusted with raw HTML. We still HTML-escape every text node
//   before wrapping in tags, so a stray `<script>` in the markdown body
//   ships as literal text instead of an XSS vector.
//
// Visual placeholders (`{{visual:slug}}`) are resolved into anchor links
// back to the article when an `articleUrl` is supplied — preserves authorial
// intent ("see the chart") without trying to inline image generation.

const INLINE_CSS = {
    p: 'margin:0 0 16px;line-height:1.7;color:#1f2937;font-size:15px;',
    h1: 'margin:32px 0 16px;font-size:24px;line-height:1.3;font-weight:800;color:#0f172a;',
    h2: 'margin:28px 0 12px;font-size:20px;line-height:1.35;font-weight:700;color:#0f172a;',
    h3: 'margin:24px 0 10px;font-size:17px;line-height:1.4;font-weight:700;color:#0f172a;',
    h4: 'margin:20px 0 8px;font-size:15px;line-height:1.4;font-weight:700;color:#0f172a;letter-spacing:0.02em;text-transform:uppercase;',
    ul: 'margin:0 0 16px 0;padding-left:22px;color:#1f2937;font-size:15px;line-height:1.7;',
    ol: 'margin:0 0 16px 0;padding-left:22px;color:#1f2937;font-size:15px;line-height:1.7;',
    li: 'margin:0 0 6px;',
    blockquote: 'margin:0 0 16px;padding:12px 18px;border-left:3px solid #cbd5e1;background:#f8fafc;color:#475569;font-size:15px;line-height:1.7;font-style:italic;',
    code: 'background:#f1f5f9;padding:2px 6px;border-radius:4px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:13px;color:#0f172a;',
    a: 'color:#0d4f8c;text-decoration:underline;',
    em: 'font-style:italic;',
    strong: 'font-weight:700;',
    hr: 'border:0;border-top:1px solid #e2e8f0;margin:24px 0;',
    visualLink: 'margin:0 0 16px;padding:10px 14px;border-left:3px solid #cbd5e1;background:#f8fafc;color:#475569;font-size:13px;font-style:italic;',
} as const;

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function escapeAttr(value: string): string {
    return escapeHtml(value).replace(/\n/g, "");
}

/**
 * Apply inline markdown to escaped text. Order matters: code spans first
 * (they suppress further processing inside), then links, then bold, then
 * italic. All inputs are already HTML-escaped, so the markers we look for
 * are literal `**`, `*`, `\`...\``, `[...](...)`.
 */
function renderInline(escaped: string): string {
    // Code spans first — content inside is treated as literal.
    let out = escaped.replace(/`([^`]+)`/g, (_, code) => `<code style="${INLINE_CSS.code}">${code}</code>`);

    // Links: [text](url). URL is allowed to contain anything except whitespace
    // and the closing paren. We re-escape the URL as an attribute.
    out = out.replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (_, text, url) => {
        return `<a href="${escapeAttr(url)}" style="${INLINE_CSS.a}">${text}</a>`;
    });

    // Bold (**), then italic (*). Bold first so it doesn't get half-eaten
    // by the italic regex.
    out = out.replace(/\*\*([^*]+)\*\*/g, (_, b) => `<strong style="${INLINE_CSS.strong}">${b}</strong>`);
    out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, (_, prefix, i) => `${prefix}<em style="${INLINE_CSS.em}">${i}</em>`);

    return out;
}

interface RenderOptions {
    /** If supplied, `{{visual:slug}}` placeholders become anchored links back
     * to the article. Without this, they collapse into a small italic caption. */
    articleUrl?: string;
}

/**
 * Resolve a `{{visual:slug}}` placeholder. The site renderer swaps these for
 * actual images/charts/diagrams; in email we can't (and shouldn't — embedded
 * images bloat the message and trigger spam filters). Instead, point the
 * reader at the article anchor.
 */
function renderVisualPlaceholder(slug: string, opts: RenderOptions): string {
    const label = slug.replace(/[_-]+/g, " ").trim();
    if (opts.articleUrl) {
        const url = `${opts.articleUrl.replace(/#.*$/, "")}#${encodeURIComponent(slug)}`;
        return `<p style="${INLINE_CSS.visualLink}">📊 <a href="${escapeAttr(url)}" style="${INLINE_CSS.a}">See "${escapeHtml(label)}" in the full article →</a></p>`;
    }
    return `<p style="${INLINE_CSS.visualLink}">📊 ${escapeHtml(label)}</p>`;
}

export function markdownToEmailHtml(markdown: string, opts: RenderOptions = {}): string {
    if (!markdown.trim()) return "";

    // Normalize whitespace and split into blocks. A block is one or more
    // lines separated from neighbors by a blank line.
    const normalized = markdown.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ");
    const blocks = normalized.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

    const rendered: string[] = [];

    for (const block of blocks) {
        // Visual placeholder — own paragraph.
        const visualMatch = block.match(/^\{\{\s*visual:([^}\s]+)\s*\}\}$/);
        if (visualMatch) {
            rendered.push(renderVisualPlaceholder(visualMatch[1], opts));
            continue;
        }

        // Inline visual placeholders embedded in a paragraph — pull them out
        // into their own caption block to preserve placement.
        if (/\{\{\s*visual:[^}]+\}\}/.test(block)) {
            const parts = block.split(/(\{\{\s*visual:[^}]+\}\})/);
            for (const part of parts) {
                if (!part.trim()) continue;
                const inlineVisual = part.match(/^\{\{\s*visual:([^}\s]+)\s*\}\}$/);
                if (inlineVisual) {
                    rendered.push(renderVisualPlaceholder(inlineVisual[1], opts));
                } else {
                    rendered.push(renderBlock(part.trim(), opts));
                }
            }
            continue;
        }

        rendered.push(renderBlock(block, opts));
    }

    return rendered.join("\n");
}

function renderBlock(block: string, opts: RenderOptions): string {
    void opts;
    // Horizontal rule
    if (/^(---|\*\*\*|___)$/.test(block.trim())) {
        return `<hr style="${INLINE_CSS.hr}" />`;
    }

    // Headings (allow optional leading whitespace)
    const headingMatch = block.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch && !block.includes("\n")) {
        const level = headingMatch[1].length;
        const tag = `h${level}` as keyof typeof INLINE_CSS;
        const text = renderInline(escapeHtml(headingMatch[2].trim()));
        return `<${tag} style="${INLINE_CSS[tag]}">${text}</${tag}>`;
    }

    // Blockquote
    if (block.split("\n").every((line) => line.startsWith(">"))) {
        const inner = block
            .split("\n")
            .map((line) => line.replace(/^>\s?/, ""))
            .join(" ");
        return `<blockquote style="${INLINE_CSS.blockquote}">${renderInline(escapeHtml(inner))}</blockquote>`;
    }

    // Unordered list
    if (block.split("\n").every((line) => /^[-*+]\s+/.test(line))) {
        const items = block
            .split("\n")
            .map((line) => `<li style="${INLINE_CSS.li}">${renderInline(escapeHtml(line.replace(/^[-*+]\s+/, "")))}</li>`)
            .join("");
        return `<ul style="${INLINE_CSS.ul}">${items}</ul>`;
    }

    // Ordered list
    if (block.split("\n").every((line) => /^\d+\.\s+/.test(line))) {
        const items = block
            .split("\n")
            .map((line) => `<li style="${INLINE_CSS.li}">${renderInline(escapeHtml(line.replace(/^\d+\.\s+/, "")))}</li>`)
            .join("");
        return `<ol style="${INLINE_CSS.ol}">${items}</ol>`;
    }

    // Default: paragraph. Soft line breaks become <br>.
    const text = renderInline(escapeHtml(block)).replace(/\n/g, "<br />");
    return `<p style="${INLINE_CSS.p}">${text}</p>`;
}
