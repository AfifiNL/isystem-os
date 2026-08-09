"use client";

import { Render } from "@puckeditor/core";
import {
    isPublicBuilderData,
    normalizePublicBuilderData,
    puckRenderConfig,
    type PublicBuilderData,
} from "@/features/builder/puck.config";
import type { Json } from "@/shared/lib/supabase/database.types";
import type { Locale } from "@/features/templates/types";

interface PostExtrasTailProps {
    visualLayout: Json | null | undefined;
    locale: Locale;
}

/**
 * Render Puck extras at the end of a blog post body.
 *
 * Mirrors `ExtraBlocksTail` (used by home/about/services/contact) so the
 * runtime path is identical to the proven one: a client component that
 * imports `Render` from `@puckeditor/core`. Using `@puckeditor/core/rsc`
 * inside the public blog server component for the tail (rather than the
 * legacy whole-page-Puck branch) was throwing a Server Components
 * render error in production, almost certainly because of how Puck's
 * RSC Render composes with the surrounding Renderer output. Routing
 * through this client tail keeps the same render contract as core
 * pages.
 *
 * SeoSupportBlock is filtered because the article-level JSON-LD is
 * already emitted server-side by the blog route — leaving it in would
 * duplicate structured data and double-pollute the page.
 *
 * Returns null when there are no extras, so posts without a saved
 * visual_layout render exactly as before (zero markup, zero JS).
 */
export function PostExtrasTail({ visualLayout, locale }: PostExtrasTailProps) {
    if (!isPublicBuilderData(visualLayout)) return null;

    const normalized = normalizePublicBuilderData(visualLayout, undefined, {
        skipSeoSupportSeed: true,
    });
    if (!normalized || !Array.isArray(normalized.content) || normalized.content.length === 0) {
        return null;
    }

    const extras = normalized.content.filter((block) => block && block.type !== "SeoSupportBlock");
    if (extras.length === 0) return null;

    const extrasData: PublicBuilderData = {
        ...normalized,
        content: extras,
    };

    if (extrasData.root?.props) {
        extrasData.root.props.locale = locale;
    }

    return (
        <section aria-label="Post extras" className="bg-slate-950">
            <Render config={puckRenderConfig} data={extrasData as never} metadata={{ locale }} />
        </section>
    );
}
