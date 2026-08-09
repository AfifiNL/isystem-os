// Tiny handlebars-style template engine. Supports:
//   {{key}}                    → escaped value
//   {{#key}}…{{/key}}          → block, renders body when value is truthy
// No partials, no helpers, no nested context — intentional. Anything richer
// must live in code, not in template content authored by operators.

const TAG_RE = /\{\{\s*([#/]?)([a-z0-9_]+)\s*\}\}/gi;

export type TemplateValue = string | number | boolean | null | undefined;
export type TemplateContext = Record<string, TemplateValue>;

export function renderTemplate(body: string, context: TemplateContext): string {
    const tokens: Array<
        | { kind: "text"; value: string }
        | { kind: "var"; key: string }
        | { kind: "block_open"; key: string }
        | { kind: "block_close"; key: string }
    > = [];

    let cursor = 0;
    for (const match of body.matchAll(TAG_RE)) {
        const [whole, modifier, key] = match;
        const idx = match.index ?? 0;
        if (idx > cursor) {
            tokens.push({ kind: "text", value: body.slice(cursor, idx) });
        }
        if (modifier === "#") tokens.push({ kind: "block_open", key });
        else if (modifier === "/") tokens.push({ kind: "block_close", key });
        else tokens.push({ kind: "var", key });
        cursor = idx + whole.length;
    }
    if (cursor < body.length) {
        tokens.push({ kind: "text", value: body.slice(cursor) });
    }

    return walk(tokens, 0, context, null).output;
}

interface WalkResult {
    output: string;
    nextIndex: number;
}

type Token =
    | { kind: "text"; value: string }
    | { kind: "var"; key: string }
    | { kind: "block_open"; key: string }
    | { kind: "block_close"; key: string };

function walk(
    tokens: Token[],
    start: number,
    context: TemplateContext,
    closing: string | null,
): WalkResult {
    let out = "";
    let i = start;
    while (i < tokens.length) {
        const token = tokens[i];
        if (token.kind === "text") {
            out += token.value;
            i += 1;
            continue;
        }
        if (token.kind === "var") {
            out += escapeHtml(String(context[token.key] ?? ""));
            i += 1;
            continue;
        }
        if (token.kind === "block_open") {
            const inner = walk(tokens, i + 1, context, token.key);
            if (isTruthy(context[token.key])) {
                out += inner.output;
            }
            i = inner.nextIndex;
            continue;
        }
        if (token.kind === "block_close") {
            if (closing !== token.key) {
                throw new Error(`Template block mismatch: closing ${token.key} expected ${closing}`);
            }
            return { output: out, nextIndex: i + 1 };
        }
    }
    if (closing !== null) {
        throw new Error(`Template block ${closing} not closed.`);
    }
    return { output: out, nextIndex: i };
}

function isTruthy(value: TemplateValue): boolean {
    if (value === undefined || value === null || value === false) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (typeof value === "number") return value !== 0;
    return Boolean(value);
}

const ESCAPE_MAP: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
};

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch] ?? ch);
}
