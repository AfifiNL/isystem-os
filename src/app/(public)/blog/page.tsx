import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPaginatedPublishedPosts } from "@/features/blog/actions";
import { getActiveTemplate } from "@/features/templates/actions";
import { buildSecondaryPageMetadata } from "@/features/templates/metadata";
import { getPublicEvidenceSummariesForContent } from "@/features/source-intelligence/public";
import { canonicalBlogHref } from "@/features/blog/urls";

const PUBLIC_BLOG_PAGE_SIZE = 9;

const BLOG_INDEX_COPY: Record<"en" | "nl" | "ar", { title: string; description: string }> = {
    en: { title: "Blog", description: "Insights, essays, and field notes from our work." },
    nl: { title: "Blog", description: "Inzichten, essays en aantekeningen uit ons werk." },
    ar: { title: "المدوّنة", description: "رؤى ومقالات وملاحظات من عملنا." },
};

export async function generateMetadata(): Promise<Metadata> {
    const { config, locale, settings } = await getActiveTemplate();
    const supported = locale === "nl" || locale === "ar" ? locale : "en";
    const copy = BLOG_INDEX_COPY[supported];
    return buildSecondaryPageMetadata({
        path: "/blog",
        title: copy.title,
        description: copy.description,
        locale,
        siteName: settings.siteName,
        siteDomain: settings.siteDomain,
        config,
        localized: true,
    });
}

interface BlogPageProps {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function parseBlogPageParam(value: string | string[] | undefined) {
    const raw = Array.isArray(value) ? value[0] : value;
    if (!raw || !/^\d+$/.test(raw)) {
        return 1;
    }

    const parsed = Number.parseInt(raw, 10);

    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function blogPageHref(locale: "en" | "nl" | "ar", page: number) {
    const baseHref = canonicalBlogHref(locale, "/blog");

    if (page <= 1) {
        return baseHref;
    }

    return `${baseHref}?page=${page}`;
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
    const params = (await searchParams) ?? {};
    const requestedPage = parseBlogPageParam(params.page);
    const { data: posts, pagination } = await getPaginatedPublishedPosts({
        page: requestedPage,
        pageSize: PUBLIC_BLOG_PAGE_SIZE,
    });
    const { config, locale } = await getActiveTemplate();

    if (pagination.currentPage > pagination.totalPages) {
        redirect(blogPageHref(locale, pagination.totalPages));
    }

    const evidenceByContentId = await getPublicEvidenceSummariesForContent((posts ?? []).map((post) => ({
        id: post.id,
        workspaceId: post.workspace_id,
        templateId: post.template_id,
        metadata: post.metadata,
    })));
    const postsWithEvidence = (posts ?? []).map((post) => ({
        ...post,
        evidenceSummary: evidenceByContentId.get(post.id) ?? null,
    }));

    // Dynamically resolve the Template's BlogIndex renderer, or fallback
    const Renderer = config.renderers?.blogIndex;

    if (!Renderer) {
        return (
            <div className="py-20 text-center">
                <p className="text-muted-foreground">This template does not support a blog index.</p>
            </div>
        );
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { renderers, ...safeConfig } = config;

    return (
        <div className={config.id === "isystem-agency" ? "isystem-editorial-surface" : undefined}>
            <Renderer posts={postsWithEvidence} config={safeConfig as typeof config} locale={locale} pagination={pagination} />
        </div>
    );
}
