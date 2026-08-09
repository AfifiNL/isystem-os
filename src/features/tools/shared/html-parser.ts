/**
 * Tiny, dependency-free HTML inspection helpers. We deliberately avoid pulling
 * in a full DOM parser (jsdom, linkedom) because:
 *   1. We only need cheap signal extraction (presence of tags, attributes).
 *   2. Big parsers can blow memory on adversarial input even with our size cap.
 *
 * All matchers are case-insensitive and forgiving of attribute ordering /
 * single-quoted attributes.
 */

export interface ParsedHtmlSignals {
    title: string | null;
    description: string | null;
    canonical: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
    headings: { h1: number; h2: number; h3: number };
    structuredData: string[]; // raw JSON-LD blocks
    scripts: string[]; // external script src values
    links: string[]; // external link href values
    metaTags: Record<string, string>;
    bodyTextLength: number;
    rawTextSample: string;
    hasViewport: boolean;
    hasFaviconLink: boolean;
    forms: number;
}

function decodeEntities(text: string): string {
    return text
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

function firstMatch(re: RegExp, html: string): string | null {
    const m = re.exec(html);
    return m ? decodeEntities(m[1].trim()) : null;
}

function countMatches(re: RegExp, html: string): number {
    let n = 0;
    const local = new RegExp(re.source, re.flags);
    while (local.exec(html) !== null) n++;
    return n;
}

function extractAllAttrValues(html: string, tag: string, attr: string): string[] {
    const re = new RegExp(`<${tag}\\b[^>]*\\b${attr}\\s*=\\s*['"]([^'"]+)['"]`, "gi");
    const out: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
        out.push(m[1]);
    }
    return out;
}

function extractMetaTags(html: string): Record<string, string> {
    const result: Record<string, string> = {};
    const re = /<meta\b[^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
        const block = m[0];
        const nameMatch = /\bname\s*=\s*['"]([^'"]+)['"]/i.exec(block) || /\bproperty\s*=\s*['"]([^'"]+)['"]/i.exec(block);
        const contentMatch = /\bcontent\s*=\s*['"]([^'"]*)['"]/i.exec(block);
        if (nameMatch && contentMatch) {
            result[nameMatch[1].toLowerCase()] = decodeEntities(contentMatch[1]);
        }
    }
    return result;
}

function extractJsonLd(html: string): string[] {
    const re = /<script\b[^>]*type\s*=\s*['"]application\/ld\+json['"][^>]*>([\s\S]*?)<\/script>/gi;
    const out: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) out.push(m[1].trim());
    return out;
}

function extractBodyText(html: string): { text: string; length: number } {
    // Strip scripts, styles, then HTML tags, then collapse whitespace.
    const noScripts = html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");
    const stripped = noScripts.replace(/<\/?[^>]+>/g, " ");
    const collapsed = decodeEntities(stripped.replace(/\s+/g, " ")).trim();
    return { text: collapsed, length: collapsed.length };
}

export function parseHtmlSignals(html: string): ParsedHtmlSignals {
    const title = firstMatch(/<title[^>]*>([\s\S]*?)<\/title>/i, html);
    const meta = extractMetaTags(html);
    const description = meta["description"] ?? null;
    const ogTitle = meta["og:title"] ?? null;
    const ogDescription = meta["og:description"] ?? null;
    const canonical =
        firstMatch(/<link\b[^>]*rel\s*=\s*['"]canonical['"][^>]*href\s*=\s*['"]([^'"]+)['"]/i, html) ||
        firstMatch(/<link\b[^>]*href\s*=\s*['"]([^'"]+)['"][^>]*rel\s*=\s*['"]canonical['"]/i, html);
    const body = extractBodyText(html);

    return {
        title,
        description,
        canonical,
        ogTitle,
        ogDescription,
        headings: {
            h1: countMatches(/<h1\b/gi, html),
            h2: countMatches(/<h2\b/gi, html),
            h3: countMatches(/<h3\b/gi, html),
        },
        structuredData: extractJsonLd(html),
        scripts: extractAllAttrValues(html, "script", "src"),
        links: extractAllAttrValues(html, "link", "href"),
        metaTags: meta,
        bodyTextLength: body.length,
        rawTextSample: body.text.slice(0, 4000),
        hasViewport: /viewport/i.test(meta["viewport"] ?? ""),
        hasFaviconLink: /<link\b[^>]*rel\s*=\s*['"][^'"]*icon[^'"]*['"]/i.test(html),
        forms: countMatches(/<form\b/gi, html),
    };
}
