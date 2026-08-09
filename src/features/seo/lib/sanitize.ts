/**
 * Sanitization helpers for SEO / AI-produced strings before they are written
 * into content_items.visual_layout, content_items.content_markdown, or a
 * metadata field.
 *
 * Rules of thumb:
 *   - No control characters except tab/newline.
 *   - No script/style tags, no on* handler attributes.
 *   - URLs must parse and use a safe scheme (http, https, mailto, tel,
 *     or a leading "/" for in-site links). Anything else becomes "".
 *   - Length-bound every string so a runaway model output can't bloat the row.
 *
 * The sanitizers are intentionally conservative: better to strip something
 * harmless than to risk XSS in an admin surface that also renders tenant
 * public pages.
 */

const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const SCRIPT_STYLE_RE = /<\/?(?:script|style|iframe|object|embed|svg|math|form|meta|link|base)\b[^>]*>/gi;

const EVENT_HANDLER_ATTR_RE = /\son[a-z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

const DANGEROUS_URL_RE = /^(?:javascript|data|vbscript|file|about):/i;

const SAFE_URL_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);

export interface SanitizeTextOptions {
    maxLength?: number;
    /** Collapse consecutive whitespace into a single space. Default true. */
    collapseWhitespace?: boolean;
}

/**
 * Sanitize a plain-text string — strip control chars, neutralize HTML-like
 * tokens, and cap length. Use for anchor text, titles, short descriptions.
 * NOT for markdown bodies where `\n` matters.
 */
export function sanitizeText(
    value: unknown,
    { maxLength = 500, collapseWhitespace = true }: SanitizeTextOptions = {},
): string {
    if (typeof value !== "string") return "";
    let out = value.normalize("NFC");
    out = out.replace(CONTROL_CHARS_RE, "");
    out = out.replace(SCRIPT_STYLE_RE, "");
    out = out.replace(EVENT_HANDLER_ATTR_RE, "");
    if (collapseWhitespace) {
        out = out.replace(/\s+/g, " ");
    }
    out = out.trim();
    if (out.length > maxLength) out = out.slice(0, maxLength);
    return out;
}

/**
 * Sanitize a multi-line string (e.g. markdown body, snippet). Keeps newlines
 * but still strips dangerous inline HTML and control characters.
 */
export function sanitizeMultilineText(
    value: unknown,
    { maxLength = 20_000 }: SanitizeTextOptions = {},
): string {
    if (typeof value !== "string") return "";
    let out = value.normalize("NFC");
    out = out.replace(CONTROL_CHARS_RE, "");
    out = out.replace(SCRIPT_STYLE_RE, "");
    out = out.replace(EVENT_HANDLER_ATTR_RE, "");
    if (out.length > maxLength) out = out.slice(0, maxLength);
    return out;
}

/**
 * Sanitize a URL. Returns "" if the URL cannot be parsed, uses a dangerous
 * scheme, or is longer than `maxLength`. Accepts relative URLs that start
 * with "/" or "#" for in-site navigation.
 */
export function sanitizeUrl(value: unknown, { maxLength = 2000 }: { maxLength?: number } = {}): string {
    if (typeof value !== "string") return "";
    const raw = value.trim();
    if (!raw) return "";
    if (raw.length > maxLength) return "";
    if (CONTROL_CHARS_RE.test(raw)) return "";
    if (DANGEROUS_URL_RE.test(raw)) return "";
    // Allow in-site paths and anchors.
    if (raw.startsWith("/") || raw.startsWith("#")) return raw;
    try {
        const parsed = new URL(raw);
        if (!SAFE_URL_SCHEMES.has(parsed.protocol)) return "";
        return parsed.toString();
    } catch {
        return "";
    }
}

/**
 * Recursively sanitize an arbitrary JSON-like value, treating every string
 * leaf as plain text with a bounded length. Useful right before persisting a
 * AI-produced preview snapshot into `visual_layout`.
 *
 * Object keys are preserved untouched — they come from our own schema, not
 * from the model — but values are normalized.
 */
export function deepSanitizeJsonText<T>(value: T, options: SanitizeTextOptions = {}): T {
    const seen = new WeakSet<object>();

    const walk = (node: unknown): unknown => {
        if (node === null || node === undefined) return node;
        if (typeof node === "string") {
            return sanitizeMultilineText(node, { maxLength: options.maxLength ?? 20_000 });
        }
        if (typeof node === "number" || typeof node === "boolean") return node;
        if (Array.isArray(node)) {
            return node.map(walk);
        }
        if (typeof node === "object") {
            if (seen.has(node as object)) return null;
            seen.add(node as object);
            const out: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
                out[k] = walk(v);
            }
            return out;
        }
        return null;
    };

    return walk(value) as T;
}
