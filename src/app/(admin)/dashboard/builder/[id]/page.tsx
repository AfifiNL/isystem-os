import { notFound } from "next/navigation";
import { AlertTriangle, Info } from "lucide-react";
import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
// PuckEditor is loaded via a thin client wrapper (puck-editor-lazy.tsx) so
// it can use `dynamic(..., { ssr: false })`. Next 15 forbids ssr:false in
// Server Components — this page must stay a Server Component because it
// reads from the DB and defines a server action via `"use server"`.
import { PuckEditorLazy as PuckEditor } from "@/features/builder/puck-editor-lazy";
import { normalizePublicBuilderData, type PublicBuilderData } from "@/features/builder/puck.config";
import { isSlugShadowedByAppRoute } from "@/features/builder/shadowed-routes";
import { getContentItemById, updateContentVisualLayout } from "@/features/content-engine/actions";
import { getActiveTemplate } from "@/features/templates/actions";
import { getDictionary } from "@/shared/lib/i18n/get-dictionary";
import { BlogMarkdownWithVisuals } from "@/features/content-engine/ui/blog-markdown-with-visuals";
import { getVisualEnrichment } from "@/features/content-engine/visual-enrichment";
import type { Locale } from "@/features/templates/types";
import type { PublicPagePuckDataV2 } from "@/features/public-site/public-page-contract";
import { isPublicPagePuckDataV2 } from "@/features/public-site/public-page-data";
import { createIsystemPublicPageData } from "@/features/public-site/isystem-public-page-seeds";

const ITEM_TYPE_LABELS: Record<string, { singular: string; bodyLabel: string }> = {
    blog: { singular: "article", bodyLabel: "article body" },
    page: { singular: "page", bodyLabel: "page" },
    video: { singular: "video", bodyLabel: "video description" },
    podcast: { singular: "episode", bodyLabel: "episode notes" },
};

function getItemTypeLabel(type: string | null | undefined) {
    return ITEM_TYPE_LABELS[type ?? ""] ?? { singular: type ?? "item", bodyLabel: `${type ?? "item"} body` };
}

interface BuilderPageProps {
    params: Promise<{ id: string }>;
}

export default async function BuilderPage({ params }: BuilderPageProps) {
    await requireDashboardModuleAccess("builder");

    const { id } = await params;
    const { data: item, error } = await getContentItemById(id);

    if (error || !item) {
        notFound();
    }

    async function handleSave(payload: PublicBuilderData | PublicPagePuckDataV2, status: string) {
        "use server";

        return updateContentVisualLayout(id, payload, status);
    }

    const pageKind = typeof item.metadata?.page_kind === "string" ? item.metadata.page_kind : undefined;
    // Only `type === "page"` content items own the full layout via Puck
    // and benefit from an auto-seeded SeoSupportBlock. Everything else —
    // blog articles (`type === "blog"`), and any future videos /
    // podcasts / etc. that get visual extras — uses the canvas purely
    // as a tail that appends below the body emitted by the dedicated
    // public renderer. Auto-seeding SeoSupportBlock for those would
    // duplicate the article/episode-level JSON-LD already emitted by
    // their public routes and would pollute an otherwise-empty canvas
    // with a block the editor can never legitimately use.
    const isTailOnlyItem = item.type !== "page";
    const normalizedLayout = normalizePublicBuilderData(item.visual_layout, pageKind, {
        skipSeoSupportSeed: isTailOnlyItem,
    });
    // Strip any previously-saved SeoSupportBlock from the canvas for
    // tail-only items. Earlier sessions auto-seeded it before we added
    // `skipSeoSupportSeed`, so existing posts/videos/etc. still carry
    // the stale block in their visual_layout. Pulling it out here means
    // the next Save persists a clean layout. Pages keep the block.
    const visualLayout = normalizedLayout && isTailOnlyItem
        ? {
            ...normalizedLayout,
            content: (normalizedLayout.content ?? []).filter(
                (block) => block?.type !== "SeoSupportBlock",
            ),
        }
        : normalizedLayout;

    // Pull the active template + dictionary so the builder canvas can render
    // the exact public theme component for core pages (home/services/about/
    // contact). Functions on `config.renderers` aren't serialisable across
    // the server/client boundary, so strip them before forwarding.
    const { config, settings } = await getActiveTemplate();
    const dictionary = await getDictionary(settings.locale);
    const locale = (item.locale ?? settings.locale) as Locale;
    const clientConfig = Object.fromEntries(
        Object.entries(config).filter(([key]) => key !== "renderers"),
    ) as typeof config;

    const storedV2Layout = (item as unknown as { public_layout_v2?: unknown }).public_layout_v2;
    const publicPageV2Layout = config.id === "isystem-agency" && isPublicPagePuckDataV2(storedV2Layout)
        ? storedV2Layout
        : config.id === "isystem-agency" && !isTailOnlyItem && (pageKind === "home" || pageKind === "services" || pageKind === "about" || pageKind === "contact")
            ? createIsystemPublicPageData(pageKind)
            : null;

    const slug = typeof item.slug === "string" ? item.slug : null;
    const isShadowed = isSlugShadowedByAppRoute(slug);
    const typeLabel = getItemTypeLabel(item.type);

    // For tail-only items (blog/video/podcast), render a read-only preview
    // of the body above the Puck canvas so editors see the full composition
    // they're appending to. The body itself can't be edited here — it lives
    // in the dedicated editor (`/dashboard/content/<id>`) — but showing it
    // removes the "I don't see the post content" confusion and makes the
    // tail-extras model self-explanatory.
    const bodyMarkdown = isTailOnlyItem
        ? (typeof item.content_markdown === "string" && item.content_markdown.trim().length > 0
            ? item.content_markdown
            : typeof item.metadata?.generated_formats?.blog_post === "string"
                ? item.metadata.generated_formats.blog_post
                : "")
        : "";
    const visualBlocks = isTailOnlyItem ? getVisualEnrichment(item.metadata).visual_blocks : [];

    return (
        <div className="mx-auto max-w-[1680px] px-4 py-6 lg:px-6">
            {isTailOnlyItem ? (
                <div className="mb-4 flex items-start gap-3 rounded-md border border-border bg-card px-4 py-3 text-[17px] text-foreground shadow-sm">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#002f58]" aria-hidden />
                    <div className="space-y-1">
                        <p className="font-medium">
                            This canvas appends blocks <em>after</em> the {typeLabel.bodyLabel}.
                        </p>
                        <p className="text-[15px] leading-6 text-muted-foreground">
                            The {typeLabel.singular} body is rendered by its dedicated template (markdown / manual sections / media) and can be edited at{" "}
                            <code className="rounded bg-muted px-1 py-0.5 text-[14px] text-foreground">/dashboard/content/{item.id}</code>.
                            Use this builder only for extras — e.g. a related-tools strip or CTA — that should appear at the end of the published {typeLabel.singular}.
                        </p>
                    </div>
                </div>
            ) : null}
            {isTailOnlyItem && bodyMarkdown ? (
                <details className="mb-4 overflow-hidden rounded-md border border-border bg-card shadow-sm" open>
                    <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-[17px] font-medium text-foreground hover:bg-muted/30">
                        <span>
                            Body preview <span className="text-muted-foreground">(read-only · edit in content editor)</span>
                        </span>
                        <span className="text-[15px] text-muted-foreground">▾</span>
                    </summary>
                    <div className="border-t border-border bg-muted/20 px-6 py-5">
                        <BlogMarkdownWithVisuals
                            content={bodyMarkdown}
                            visualBlocks={visualBlocks}
                            locale={locale}
                            className="prose prose-slate max-w-none text-[17px] leading-relaxed prose-headings:text-foreground prose-p:text-foreground/90 prose-li:text-foreground/90 prose-strong:text-foreground prose-a:text-[#002f58]"
                            imageClassName="my-4 max-h-72 w-auto rounded-lg border border-border"
                            imageAltFallback={typeof item.title === "string" ? item.title : "Body image"}
                        />
                        <p className="mt-4 border-t border-border pt-3 text-[14px] uppercase tracking-[0.18em] text-muted-foreground">
                            ↑ End of body — Puck canvas below appends here ↓
                        </p>
                    </div>
                </details>
            ) : null}
            {isShadowed ? (
                <div className="mb-4 flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-[17px] text-amber-900 shadow-sm dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-100">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <div className="space-y-1">
                        <p className="font-medium">
                            Edits here will not appear on the public page <code className="rounded bg-amber-900/10 px-1.5 py-0.5 text-[15px] dark:bg-black/30">/{slug}</code>.
                        </p>
                        <p className="text-[15px] leading-6">
                            The route <code className="rounded bg-amber-900/10 px-1 py-0.5 dark:bg-black/30">src/app/(public)/{slug}/page.tsx</code> is a hardcoded React file and takes precedence over the CMS. To make this slug builder-driven, delete that file so the dynamic <code className="rounded bg-amber-900/10 px-1 py-0.5 dark:bg-black/30">[slug]</code> route can render the saved blocks.
                        </p>
                    </div>
                </div>
            ) : null}
            <PuckEditor
                contentId={item.id}
                initialData={publicPageV2Layout ?? visualLayout}
                initialStatus={item.status}
                onSaveAction={handleSave}
                templateConfig={clientConfig}
                dictionary={dictionary}
                siteName={settings.siteName}
                siteDescription={settings.siteDescription}
                siteChrome={settings.siteChrome!}
            />
        </div>
    );
}
