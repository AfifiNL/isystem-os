import { createElement, type ElementType, type HTMLAttributes, type ReactNode } from "react";
import { sanitizeRichTextHtml } from "@/features/content-engine/lib/rich-text";

interface SafeRichTextProps extends Omit<HTMLAttributes<HTMLElement>, "children" | "dangerouslySetInnerHTML"> {
    /** The element tag to render. Defaults to `<p>`. */
    as?: ElementType;
    /** The raw string value. May be plain text or a pre-sanitized HTML fragment. */
    value: string | null | undefined;
    /** Optional fallback rendered when value is empty. */
    fallback?: ReactNode;
}

/**
 * Renders narrative text that may contain HTML from the SEO execution pipeline
 * (internal anchors, emphasis tags, etc.). If the value looks like plain text,
 * it's emitted as a normal text node. If it contains any HTML, it flows through
 * `sanitizeRichTextHtml` — the same sanitizer used by the content engine's
 * rich-text editor — so only a small, safe tag allow-list reaches the DOM.
 *
 * Prefer this over raw `dangerouslySetInnerHTML` whenever a field may receive
 * automated mutations from `@/features/seo/content-mutation`.
 */
export function SafeRichText({ as = "p", value, fallback = null, ...rest }: SafeRichTextProps) {
    const text = typeof value === "string" ? value : "";
    if (!text) {
        return <>{fallback}</>;
    }
    if (!text.includes("<")) {
        return createElement(as, rest, text);
    }
    let html = sanitizeRichTextHtml(text);
    if (!html) {
        return <>{fallback}</>;
    }
    // When the wrapper element cannot legally contain block tags (e.g. a <p>),
    // strip a single outer <p>…</p> wrapper so we don't emit nested <p> tags.
    // The browser auto-corrects nested <p>, which produces a DOM that no
    // longer matches what React expects on hydration.
    if (as === "p") {
        const unwrapped = html.replace(/^<p(?:\s[^>]*)?>([\s\S]*?)<\/p>\s*$/i, "$1");
        if (!unwrapped.includes("<p")) {
            html = unwrapped;
        }
    }
    return createElement(as, { ...rest, dangerouslySetInnerHTML: { __html: html } });
}
