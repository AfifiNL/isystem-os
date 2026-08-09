import { revalidatePath } from "next/cache";
import { revalidatePublicContent } from "@/features/content-engine/revalidate-public";

export function buildSeoRevalidationPaths(input: { slug: string | null; type: string; id: string; pageKind?: string | null }) {
    const paths = new Set<string>([
        "/dashboard/seo",
        "/dashboard/content",
        "/dashboard/manual-posts",
        `/dashboard/content/${input.id}`,
    ]);

    if (input.type === "blog" && input.slug) {
        paths.add(`/blog/${input.slug}`);
    }

    if (input.type === "page") {
        if (!input.slug || input.slug === "home") {
            paths.add("/");
        } else {
            paths.add(`/${input.slug}`);
        }
    }

    return Array.from(paths);
}

export async function revalidateSeoPaths(input: { slug: string | null; type: string; id: string; pageKind?: string | null }) {
    for (const path of buildSeoRevalidationPaths(input)) {
        try {
            revalidatePath(path);
        } catch {
            console.warn(`[seo:revalidate] revalidatePath skipped for ${path}: not in Next.js context.`);
        }
    }

    // Public routes are locale-rewritten by middleware. Bust every visible URL
    // variant so server-side SEO auto-fixes immediately reflect on pages like
    // `/en/blog/slug`, `/nl/blog/slug`, and `/en/page-slug`.
    if (input.type === "blog") {
        await revalidatePublicContent({ type: "blog", slug: input.slug });
    } else if (input.type === "page") {
        await revalidatePublicContent({ type: "page", slug: input.slug, pageKind: input.pageKind });
    }
}
