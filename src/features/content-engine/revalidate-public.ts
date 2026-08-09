"use server";

import { revalidatePath } from "next/cache";
import { SUPPORTED_LOCALES } from "@/shared/lib/i18n/routing";

/**
 * Why this exists:
 *
 * Middleware rewrites `/<locale>/<path>` → `/<path>` so the React tree only
 * has one route per page, but Next.js's Full Route Cache keys HTML by the
 * VISIBLE URL — `/`, `/en`, `/nl`, `/ar`, `/about`, `/en/about`, …. Calling
 * `revalidatePath("/about")` alone leaves the locale-prefixed entries stale,
 * which is why CMS edits historically "didn't show up" for visitors landing
 * on `/en/...` (i.e. almost everyone).
 *
 * The PublicLayout also reads CMS data (chrome/navbar/footer overrides),
 * so revalidation must target the `"layout"` segment to bust both page-
 * and layout-level data.
 */

const CORE_PAGE_SLUGS = new Set(["home", "about", "services", "contact"]);

function localeVariants(unprefixedPath: string): string[] {
    const normalized = unprefixedPath === "" || unprefixedPath === "/" ? "" : unprefixedPath.startsWith("/") ? unprefixedPath : `/${unprefixedPath}`;
    const root = normalized === "" ? "/" : normalized;
    return [root, ...SUPPORTED_LOCALES.map((loc) => `/${loc}${normalized}`)];
}

function revalidateAllLocales(unprefixedPath: string): void {
    for (const path of localeVariants(unprefixedPath)) {
        try {
            revalidatePath(path, "layout");
        } catch {
            console.warn(`[public:revalidate] revalidatePath skipped for ${path}: not in Next.js context.`);
        }
    }
}

function revalidateAgentDiscovery(): void {
    for (const path of ["/llms.txt", "/llms-full.txt", "/.well-known/mcp.json", "/.well-known/webmcp.json"]) {
        try {
            revalidatePath(path);
        } catch {
            console.warn(`[public:revalidate] agent discovery revalidate skipped for ${path}: not in Next.js context.`);
        }
    }
}

interface PageRevalidationInput {
    type: "page";
    slug?: string | null;
    pageKind?: string | null;
}

interface BlogRevalidationInput {
    type: "blog";
    slug?: string | null;
}

interface VideoRevalidationInput {
    type: "video";
    slug?: string | null;
}

export type PublicRevalidationInput = PageRevalidationInput | BlogRevalidationInput | VideoRevalidationInput;

/**
 * Revalidate every public URL that may render a piece of content.
 * Safe to call on any mutation — over-revalidation is cheap; staleness is not.
 */
export async function revalidatePublicContent(input: PublicRevalidationInput): Promise<void> {
    revalidateAgentDiscovery();

    if (input.type === "page") {
        const slug = input.slug?.trim() || null;
        const pageKind = input.pageKind?.trim() || null;

        if (pageKind === "home" || slug === "home") {
            revalidateAllLocales("");
            return;
        }

        const target = pageKind && CORE_PAGE_SLUGS.has(pageKind) ? pageKind : slug;
        if (target) {
            revalidateAllLocales(`/${target}`);
        }
        return;
    }

    if (input.type === "blog") {
        revalidateAllLocales("/blog");
        const slug = input.slug?.trim();
        if (slug) {
            revalidateAllLocales(`/blog/${slug}`);
        }
        return;
    }

    if (input.type === "video") {
        revalidateAllLocales("/videos");
        const slug = input.slug?.trim();
        if (slug) {
            revalidateAllLocales(`/videos/${slug}`);
        }
        return;
    }
}

/**
 * Aggressive bust for site-wide changes (template switch, settings, chrome).
 * Drops the entire public cache across every locale.
 */
export async function revalidateAllPublicSurfaces(): Promise<void> {
    revalidateAgentDiscovery();

    try {
        revalidatePath("/", "layout");
    } catch {}
    for (const loc of SUPPORTED_LOCALES) {
        try {
            revalidatePath(`/${loc}`, "layout");
        } catch {}
    }
}
