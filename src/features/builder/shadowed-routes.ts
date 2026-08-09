import "server-only";
import { readdirSync } from "node:fs";
import { join } from "node:path";

// Some `(public)/<slug>/page.tsx` routes are hardcoded TSX with embedded copy.
// They take precedence over the dynamic `(public)/[slug]/page.tsx` route that
// renders `content_items.visual_layout` via Puck. When that happens, edits in
// the builder cannot affect what visitors see — the public route ignores the
// CMS row entirely. The builder surfaces a warning banner for those slugs so
// authors aren't editing dead data.

let cache: ReadonlySet<string> | null = null;

function loadShadowedSlugs(): ReadonlySet<string> {
    try {
        const dir = join(process.cwd(), "src", "app", "(public)");
        const entries = readdirSync(dir, { withFileTypes: true });
        const slugs = entries
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            // Skip Next.js dynamic segments and route groups — they don't shadow.
            .filter((name) => !name.startsWith("[") && !name.startsWith("("));
        return new Set(slugs);
    } catch {
        return new Set();
    }
}

export function getShadowedPublicSlugs(): ReadonlySet<string> {
    if (!cache) cache = loadShadowedSlugs();
    return cache;
}

export function isSlugShadowedByAppRoute(slug: string | null | undefined): boolean {
    if (!slug) return false;
    return getShadowedPublicSlugs().has(slug);
}
