export const TEXT_FREE_IMAGEN_NEGATIVE_PROMPT = [
    "text",
    "words",
    "letters",
    "numbers",
    "pseudo-text",
    "gibberish text",
    "typography",
    "headline",
    "caption",
    "title",
    "article title",
    "written words",
    "logo",
    "watermark",
    "signage",
    "poster",
    "document",
    "paperwork",
    "book page",
    "magazine page",
    "whiteboard",
    "presentation slide",
    "browser text",
    "dashboard labels",
    "UI labels",
    "screen text",
    "code",
    "subtitles",
].join(", ");

export const TEXT_FREE_BACKGROUND_SUFFIX = [
    "CRITICAL TEXT-FREE BACKGROUND REQUIREMENT:",
    "the generated image itself must contain zero readable or pseudo-readable text, letters, numbers, title blocks, captions, UI labels, logos, watermarks, signage, paperwork, book pages, whiteboards, browser windows, code, or document layouts.",
    "Do not include paper, books, documents, whiteboards, posters, signs, visible screens, dashboards, browser windows, charts with labels, code editors, or interfaces.",
    "The left 55 percent of the image must be empty solid dark negative space with no objects, no surfaces, no screens, and no marks, reserved for an external SVG overlay.",
    "Place any real-world focal subject on the right half only; do not render the article title or any typography inside the image.",
].join(" ");

const TEXT_PRONE_REPLACEMENTS: Array<readonly [RegExp, string]> = [
    [
        /\b((?:article|blog post|video|post)\s+)(?:titled|called|named)\s+["“][^"”]+["”]/gi,
        "$1topic",
    ],
    [
        /\b(?:printed\s+)?(?:guide|document|page|article|report|paperwork|paper|book page|magazine page|brochure|notebook)\b/gi,
        "soft out-of-focus background texture",
    ],
    [
        /\b(?:whiteboard|presentation slide|poster|signage|sign|billboard|placard)\b/gi,
        "clean shadowed negative space",
    ],
    [
        /\b(?:dashboards?|browser windows?|app screens?|software interfaces?|user interfaces?|UI|HUD|screens?|monitors?|displays?|tablet|phone interface|laptop screen)\b/gi,
        "text-free physical workspace detail",
    ],
    [
        /\b(?:text overlay ready|typography-ready|bold typography|headline|title text|caption text|lettering)\b/gi,
        "clean negative-space composition",
    ],
];

const TEXT_SURFACE_PATTERN = /\b(?:documents?|papers?|pages?|guides?|reports?|books?|magazines?|brochures?|notebooks?|whiteboards?|posters?|signage|signs?|billboards?|placards?|dashboards?|browsers?|interfaces?|screens?|monitors?|displays?|code|labels?|chart labels?)\b/i;

export function buildTextFreeEditorialPrompt(input: {
    industry: string;
    keywords: readonly string[];
    visualStyle: string;
    assetDescription: string;
}): string {
    const safeThemes = input.keywords
        .slice(0, 4)
        .map((keyword) => keyword.replace(/[^\p{L}\p{N}\s-]/gu, " ").trim())
        .filter(Boolean)
        .join(", ") || input.industry;

    return enforceTextFreeImagenPrompt([
        `Create ${input.assetDescription} for the ${input.industry} industry without showing any article, guide, document, screen, interface, dashboard, chart, or written surface.`,
        `Visual themes to imply through objects and atmosphere only: ${safeThemes}.`,
        `Use this visual style: ${input.visualStyle}.`,
        "Composition: empty solid dark matte gradient on the entire left 55 percent reserved for an external SVG overlay; single premium real-world focal subject on the right half only; shallow depth of field; soft cinematic studio side light; no visible screens or flat surfaces that could contain writing.",
        TEXT_FREE_BACKGROUND_SUFFIX,
    ].join(" "));
}

export function enforceTextFreeImagenPrompt(prompt: string): string {
    let guarded = prompt.normalize("NFC").replace(/\s+/g, " ").trim();

    for (const [pattern, replacement] of TEXT_PRONE_REPLACEMENTS) {
        guarded = guarded.replace(pattern, replacement);
    }

    // If a prompt still contains any text-bearing surface after targeted
    // replacement, drop the concept entirely into a safer editorial fallback.
    if (TEXT_SURFACE_PATTERN.test(guarded)) {
        guarded = "Premium photorealistic editorial background: empty dark matte gradient on the entire left half, a clean modern workspace detail on the right half only, shallow depth of field, soft studio side lighting, no visible screens and no flat surfaces that could contain writing.";
    }

    if (!guarded.includes("CRITICAL TEXT-FREE BACKGROUND REQUIREMENT")) {
        guarded = `${guarded} ${TEXT_FREE_BACKGROUND_SUFFIX}`;
    }

    return guarded.trim();
}
