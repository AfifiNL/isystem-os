import { marked } from "marked";
import TurndownService from "turndown";

const turndownService = new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
    strongDelimiter: "**",
});

export const RICH_TEXT_COLOR_OPTIONS = [
    { label: "Default", value: "inherit" },
    { label: "Slate", value: "#334155" },
    { label: "Brand", value: "#0f766e" },
    { label: "Ocean", value: "#0369a1" },
    { label: "Amber", value: "#b45309" },
    { label: "Rose", value: "#be123c" },
    { label: "Premium", value: "#6d28d9" },
] as const;

export const RICH_TEXT_HIGHLIGHT_OPTIONS = [
    { label: "None", value: "transparent" },
    { label: "Soft amber", value: "#fef3c7" },
    { label: "Soft emerald", value: "#d1fae5" },
    { label: "Soft blue", value: "#dbeafe" },
    { label: "Soft rose", value: "#ffe4e6" },
    { label: "Soft violet", value: "#ede9fe" },
] as const;

export const RICH_TEXT_FONT_FAMILY_OPTIONS = [
    { label: "Default", value: "inherit" },
    { label: "Sans", value: "Inter, ui-sans-serif, system-ui, sans-serif" },
    { label: "Serif", value: "Georgia, Cambria, 'Times New Roman', Times, serif" },
    { label: "Mono", value: "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace" },
] as const;

export function isHtmlString(value?: string | null) {
    if (!value || typeof value !== "string") {
        return false;
    }

    return /<[^>]+>/.test(value);
}

export function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

const ALLOWED_TAGS = new Set([
    "a",
    "blockquote",
    "br",
    "code",
    "em",
    "h1",
    "h2",
    "h3",
    "img",
    "li",
    "mark",
    "ol",
    "p",
    "pre",
    "s",
    "span",
    "strong",
    "u",
    "ul",
]);

const SAFE_URL_PATTERN = /^(https?:|mailto:|tel:|\/|#)/i;
const SAFE_DATA_IMAGE_PATTERN = /^data:image\/(png|gif|jpeg|jpg|webp);base64,[a-z0-9+/=\s]+$/i;
const DISALLOWED_BLOCK_TAG_PATTERN = /<(script|style|iframe|object|embed|form|input|button|textarea|select|option|meta|link)(\s[^>]*)?>[\s\S]*?<\/\1>/gi;
const DISALLOWED_SELF_CLOSING_TAG_PATTERN = /<(script|style|iframe|object|embed|form|input|button|textarea|select|option|meta|link)(\s[^>]*)?\/?\s*>/gi;
const SAFE_ANCHOR_TARGETS = new Set(["_blank", "_self", "_parent", "_top"]);
const SAFE_REL_TOKENS = new Set(["noopener", "noreferrer", "nofollow", "sponsored", "ugc", "me"]);

function decodeHtmlEntities(value: string) {
    return value
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"');
}

function sanitizeStyleAttribute(style: string) {
    const allowedStyleProperties = new Set(["background-color", "color", "font-family", "text-align"]);

    const sanitizedRules = style
        .split(";")
        .map((rule) => rule.trim())
        .filter(Boolean)
        .map((rule) => {
            const separatorIndex = rule.indexOf(":");

            if (separatorIndex === -1) {
                return null;
            }

            const property = rule.slice(0, separatorIndex).trim().toLowerCase();
            const rawValue = rule.slice(separatorIndex + 1).trim();

            if (!allowedStyleProperties.has(property) || !rawValue) {
                return null;
            }

            const value = rawValue.replace(/\s+/g, " ");

            if (/url\s*\(|expression\s*\(|javascript:/i.test(value)) {
                return null;
            }

            if (property === "text-align" && !/^(left|center|right|justify)$/i.test(value)) {
                return null;
            }

            if ((property === "color" || property === "background-color") && !/^(#[0-9a-f]{3,8}|rgb[a]?\([^)]*\)|hsl[a]?\([^)]*\)|[a-z]+)$/i.test(value)) {
                return null;
            }

            if (property === "font-family" && !/^[\w\s,'\-]+$/i.test(value)) {
                return null;
            }

            return `${property}: ${value}`;
        })
        .filter((rule): rule is string => Boolean(rule));

    return sanitizedRules.join("; ");
}

function sanitizeAttributeValue(value: string) {
    return escapeHtml(decodeHtmlEntities(value.trim()));
}

function sanitizeAnchorHref(value: string) {
    const decoded = decodeHtmlEntities(value.trim());

    if (!SAFE_URL_PATTERN.test(decoded) || /^javascript:/i.test(decoded)) {
        return null;
    }

    return sanitizeAttributeValue(decoded);
}

function sanitizeImageSrc(value: string) {
    const decoded = decodeHtmlEntities(value.trim());

    if (SAFE_URL_PATTERN.test(decoded) || SAFE_DATA_IMAGE_PATTERN.test(decoded)) {
        return sanitizeAttributeValue(decoded);
    }

    return null;
}

function sanitizeHtmlAttributes(tagName: string, attributes: string) {
    if (!attributes.trim()) {
        return "";
    }

    const allowedAttributes = new Map<string, string>();
    const attributePattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
    let match: RegExpExecArray | null;

    while ((match = attributePattern.exec(attributes)) !== null) {
        const attributeName = match[1].toLowerCase();
        const rawValue = match[2] ?? match[3] ?? match[4] ?? "";

        if (attributeName.startsWith("on")) {
            continue;
        }

        // Strip xmlns/xml:lang/xmlns:* — TipTap's generateHTML emits the XHTML namespace
        // on root elements, which causes React #418 hydration mismatches when the same
        // content is later set via dangerouslySetInnerHTML. The browser parses these as
        // HTML, so the namespace is meaningless and only causes drift.
        if (attributeName === "xmlns" || attributeName.startsWith("xmlns:") || attributeName === "xml:lang") {
            continue;
        }

        if (attributeName === "style") {
            const sanitizedStyle = sanitizeStyleAttribute(rawValue);

            if (sanitizedStyle) {
                allowedAttributes.set("style", sanitizeAttributeValue(sanitizedStyle));
            }

            continue;
        }

        if (tagName === "a" && attributeName === "href") {
            const href = sanitizeAnchorHref(rawValue);

            if (href) {
                allowedAttributes.set("href", href);
            }

            continue;
        }

        if (tagName === "a" && attributeName === "target") {
            const target = decodeHtmlEntities(rawValue.trim()).toLowerCase();
            if (SAFE_ANCHOR_TARGETS.has(target)) {
                allowedAttributes.set("target", target);
            }
            continue;
        }

        if (tagName === "a" && attributeName === "rel") {
            const rel = decodeHtmlEntities(rawValue.trim())
                .toLowerCase()
                .split(/\s+/)
                .filter((token) => SAFE_REL_TOKENS.has(token));
            if (rel.length > 0) {
                allowedAttributes.set("rel", Array.from(new Set(rel)).join(" "));
            }
            continue;
        }

        if (tagName === "img" && attributeName === "src") {
            const src = sanitizeImageSrc(rawValue);

            if (src) {
                allowedAttributes.set("src", src);
            }

            continue;
        }

        if (tagName === "img" && (attributeName === "alt" || attributeName === "title")) {
            allowedAttributes.set(attributeName, sanitizeAttributeValue(rawValue));
        }
    }

    if (tagName === "a" && allowedAttributes.has("href")) {
        const href = allowedAttributes.get("href") ?? "";
        const isInternal = href.startsWith("/") && !href.startsWith("//");
        if (isInternal) {
            // Internal links should open in the same tab (no target=_blank) and don't
            // need rel=nofollow. Drop them entirely so a fresh sanitize pass produces
            // identical SSR/CSR output, eliminating React hydration drift.
            allowedAttributes.delete("target");
            allowedAttributes.delete("rel");
        } else {
            allowedAttributes.set("target", "_blank");
            allowedAttributes.set("rel", "noopener noreferrer nofollow");
        }
    }

    return Array.from(allowedAttributes.entries())
        .map(([name, value]) => ` ${name}="${value}"`)
        .join("");
}

export function sanitizeRichTextHtml(value?: string | null) {
    if (!value) {
        return "";
    }

    const stripped = value
        .replace(DISALLOWED_BLOCK_TAG_PATTERN, "")
        .replace(DISALLOWED_SELF_CLOSING_TAG_PATTERN, "");

    return stripped.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (fullMatch, rawTagName: string, rawAttributes: string) => {
        const tagName = rawTagName.toLowerCase();
        const isClosingTag = fullMatch.startsWith("</");

        if (!ALLOWED_TAGS.has(tagName)) {
            return "";
        }

        if (isClosingTag) {
            return `</${tagName}>`;
        }

        const isSelfClosing = fullMatch.endsWith("/>") || tagName === "br" || tagName === "img";
        const sanitizedAttributes = sanitizeHtmlAttributes(tagName, rawAttributes ?? "");

        return isSelfClosing ? `<${tagName}${sanitizedAttributes} />` : `<${tagName}${sanitizedAttributes}>`;
    });
}

export function legacyTextToRichTextHtml(value?: string | null) {
    if (!value || typeof value !== "string") {
        return "";
    }

    if (isHtmlString(value)) {
        return value;
    }

    return value
        .split(/\n{2,}/)
        .map((segment) => segment.trim())
        .filter(Boolean)
        .map((segment) => `<p>${escapeHtml(segment).replace(/\n/g, "<br />")}</p>`)
        .join("");
}

export function richTextHtmlToPlainText(value?: string | null) {
    if (!value) {
        return "";
    }

    return turndownService.turndown(value).trim();
}

export function normalizeRichTextInput(value?: string | null) {
    if (!value || typeof value !== "string") {
        return "";
    }

    if (isHtmlString(value)) {
        return sanitizeRichTextHtml(value);
    }

    const parsedHtml = marked.parse(value, { gfm: true, breaks: true }) as string;
    return sanitizeRichTextHtml(parsedHtml);
}
