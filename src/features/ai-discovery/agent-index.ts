import { getPublishedPostLocaleMap, getPublishedPosts } from "@/features/blog/actions";
import { canonicalBlogHref } from "@/features/blog/urls";
import { getPageContentItems } from "@/features/content-engine/actions";
import { getPublishedEpisodeLocaleMap, getPublishedShows } from "@/features/podcast/public-actions";
import { RESOURCE_REGISTRY } from "@/features/resources/resource-registry";
import { getSiteSettings } from "@/features/templates/actions";
import { resolveMetadataBase } from "@/features/templates/metadata";
import { TOOL_REGISTRY, TOOL_SLUGS } from "@/features/tools/shared/registry";
import { isPublicToolsBrandReady } from "@/features/tools/shared/availability";
import { getPublishedVideoLocaleMap } from "@/features/video-stream/public-actions";
import { DEFAULT_LOCALE, localizeHref } from "@/shared/lib/i18n/routing";
import { normalizeSeoDescription } from "@/features/seo/public-metadata-text";
import {
    isPublicPageLayoutNoIndex,
    isRetiredPublicSlug,
} from "@/features/public-site/sitemap-policy";
import { getPublicPageAvailableLocales } from "@/features/public-site/public-page-seo";
import { getPublicVideoDescription } from "@/features/video-stream/public-seo";

type AgentLink = {
    title: string;
    url: string;
    description: string;
    lastModified?: string;
};

type AgentIndex = {
    siteName: string;
    siteDescription: string;
    siteUrl: string;
    generatedAt: string;
    lastContentModified: string;
    corePages: AgentLink[];
    publishedPages: AgentLink[];
    blogPosts: AgentLink[];
    tools: AgentLink[];
    resources: AgentLink[];
    podcasts: AgentLink[];
    videos: AgentLink[];
};

const TOOL_USE_CASES = [
    "Automation ROI and roadmap diagnostics",
    "AI search and citation-readiness checks",
    "Landing-page conversion and lead-magnet review",
    "GDPR cookie and tracker risk triage",
    "Support automation readiness",
    "Review-response drafting with human review",
    "Dutch ZZP service agreement drafting",
] as const;

const AGENT_SAFETY_BOUNDARIES = [
    "Public agents may read and recommend public pages only; do not request dashboard, portal, customer, private workspace, API, or unpublished data.",
    "Public tools are browser diagnostics, not executable MCP tools. Do not claim you ran a tool unless a human used the public page and provided the result.",
    "For commercial routing, use the published booking or contact pages. Recommend a diagnostic only when it is listed in this index.",
    "Do not submit forms, book calls, or provide legal/compliance conclusions on behalf of a user without explicit human confirmation.",
] as const;

const CORE_PAGES = [
    {
        title: "Home",
        path: "/",
        description: "The canonical public home page for this workspace.",
    },
    {
        title: "Services",
        path: "/services",
        description: "Published services, offers, and delivery information.",
    },
    {
        title: "About",
        path: "/about",
        description: "Background, operating context, and organization information.",
    },
    {
        title: "Blog",
        path: "/blog",
        description: "Published essays and operating notes on AI governance, SEO, automation, and SME digital systems.",
    },
    {
        title: "Free tools",
        path: "/tools",
        description: "Public diagnostic tools for AI visibility, automation readiness, GDPR, and operational ROI.",
    },
    {
        title: "Booking",
        path: "/booking",
        description: "Review available services and request a suitable appointment.",
    },
] as const;

const CORE_PAGE_SLUGS = new Set(
    CORE_PAGES.map((page) => page.path === "/" ? "home" : page.path.replace(/^\//, "")),
);

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asString(value: unknown): string | null {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function absoluteUrl(base: URL, pathOrUrl: string): string {
    if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
        return pathOrUrl;
    }

    return new URL(pathOrUrl, base).toString();
}

function markdownText(value: string): string {
    return value
        .replace(/\s+/g, " ")
        .replace(/\[/g, "(")
        .replace(/\]/g, ")")
        .trim();
}

function markdownLink(item: AgentLink): string {
    const description = item.description ? `: ${markdownText(item.description)}` : "";
    return `- [${markdownText(item.title)}](${item.url})${description}`;
}

function pickDescription(metadata: unknown, fallback: unknown): string {
    const meta = asRecord(metadata);
    const seo = asRecord(meta?.seo);
    const generatedFormats = asRecord(meta?.generated_formats);
    const excerpt =
        asString(seo?.description)
        ?? asString(meta?.excerpt)
        ?? asString(generatedFormats?.excerpt)
        ?? asString(fallback);

    if (!excerpt) {
        return "Published site content.";
    }

    return normalizeSeoDescription({
        value: excerpt,
        maxLength: 220,
    });
}

function isoDate(value: unknown): string | undefined {
    const raw = asString(value);
    if (!raw) return undefined;

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return undefined;

    return date.toISOString();
}

function newestDate(...values: Array<string | undefined>): string {
    const timestamps = values
        .map((value) => value ? new Date(value).getTime() : 0)
        .filter((value) => Number.isFinite(value) && value > 0);

    return new Date(timestamps.length ? Math.max(...timestamps) : Date.now()).toISOString();
}

function sortByNewest(items: AgentLink[]): AgentLink[] {
    return [...items].sort((a, b) => {
        const aTime = a.lastModified ? new Date(a.lastModified).getTime() : 0;
        const bTime = b.lastModified ? new Date(b.lastModified).getTime() : 0;
        return bTime - aTime || a.title.localeCompare(b.title);
    });
}

export async function getAgentIndex(): Promise<AgentIndex> {
    const settings = await getSiteSettings();
    const metadataBase = resolveMetadataBase(settings.siteDomain);
    if (!metadataBase) {
        throw new Error("A valid site domain is required to publish the agent discovery index.");
    }
    const siteUrl = metadataBase.toString().replace(/\/$/, "");

    const [
        { data: pageRows },
        { data: posts },
        { data: postLocaleRows },
        { data: shows },
        episodeRows,
        { data: videoLocaleRows },
    ] = await Promise.all([
        getPageContentItems(),
        getPublishedPosts(24, DEFAULT_LOCALE),
        getPublishedPostLocaleMap(),
        getPublishedShows(),
        getPublishedEpisodeLocaleMap(),
        getPublishedVideoLocaleMap(),
    ]);

    const publicToolsEnabled = isPublicToolsBrandReady(settings.activeTemplate);
    const corePages = CORE_PAGES
        .filter((page) => publicToolsEnabled || page.path !== "/tools")
        .map((page) => ({
            title: page.title,
            url: absoluteUrl(metadataBase, localizeHref(DEFAULT_LOCALE, page.path)),
            description: page.description,
        }));

    const publishedPages = sortByNewest((pageRows ?? [])
        .filter((page) => (
            page.status === "published"
            && typeof page.slug === "string"
            && page.slug.length > 0
            && !CORE_PAGE_SLUGS.has(page.slug)
            && !isRetiredPublicSlug(page.slug)
            && !isPublicPageLayoutNoIndex(page.visual_layout)
            && !isPublicPageLayoutNoIndex(page.public_layout_v2)
            && getPublicPageAvailableLocales({
                title: page.title,
                visual_layout: page.visual_layout,
                public_layout_v2: page.public_layout_v2,
            }).includes(DEFAULT_LOCALE)
        ))
        .map((page) => {
            const slug = page.slug === "home" ? "" : page.slug;
            const path = slug ? `/${slug}` : "/";
            return {
                title: page.title || page.slug || "Published page",
                url: absoluteUrl(metadataBase, localizeHref(DEFAULT_LOCALE, path)),
                description: "Published page in the public content system.",
                lastModified: isoDate(page.updated_at),
            };
        }));

    const blogPosts = sortByNewest((posts ?? [])
        .filter((post) => typeof post.slug === "string" && post.slug.length > 0)
        .map((post) => ({
            title: post.title || post.slug || "Blog post",
            url: absoluteUrl(metadataBase, canonicalBlogHref(DEFAULT_LOCALE, `/blog/${post.slug}`)),
            description: pickDescription(post.metadata, post.content_markdown),
            lastModified: isoDate(post.updated_at ?? post.created_at),
        })));

    const tools = (publicToolsEnabled ? TOOL_SLUGS : []).map((slug) => {
        const tool = TOOL_REGISTRY[slug];
        return {
            title: tool.title.en,
            url: absoluteUrl(metadataBase, localizeHref(DEFAULT_LOCALE, `/tools/${slug}`)),
            description: tool.summary.en,
        };
    });

    const resources = RESOURCE_REGISTRY
        .filter((resource) => resource.locales.en.status === "published")
        .map((resource) => ({
            title: resource.info.title.en,
            url: absoluteUrl(metadataBase, resource.locales.en.pdfHref),
            description: resource.info.description.en,
            lastModified: new Date(resource.lastModified).toISOString(),
        }));

    const podcasts = sortByNewest([
        ...(shows ?? [])
            .filter((show) => typeof show.slug === "string" && show.slug.length > 0)
            .map((show) => ({
                title: show.title || show.slug,
                url: absoluteUrl(metadataBase, localizeHref(DEFAULT_LOCALE, `/podcast/${show.slug}`)),
                description: show.description || "Published podcast show.",
                lastModified: isoDate(show.updated_at ?? show.created_at),
            })),
        ...episodeRows
            .filter((episode) => episode.locale === DEFAULT_LOCALE && episode.show_slug && episode.episode_slug)
            .map((episode) => ({
                title: episode.content_item_slug || episode.episode_slug,
                url: absoluteUrl(metadataBase, localizeHref(DEFAULT_LOCALE, `/podcast/${episode.show_slug}/${episode.episode_slug}`)),
                description: "Published podcast episode.",
                lastModified: isoDate(episode.updated_at ?? episode.published_at),
            })),
    ]);

    const videos = sortByNewest((videoLocaleRows ?? [])
        .filter((video) => video.locale === DEFAULT_LOCALE && typeof video.slug === "string" && video.slug.length > 0)
        .map((video) => ({
            title: video.title || video.slug,
            url: absoluteUrl(metadataBase, localizeHref(DEFAULT_LOCALE, `/videos/${video.slug}`)),
            description: getPublicVideoDescription(video),
            lastModified: isoDate(video.updated_at ?? video.created_at),
        })));

    const lastContentModified = newestDate(
        ...publishedPages.map((item) => item.lastModified),
        ...blogPosts.map((item) => item.lastModified),
        ...resources.map((item) => item.lastModified),
        ...podcasts.map((item) => item.lastModified),
        ...videos.map((item) => item.lastModified),
        ...(postLocaleRows ?? []).map((row) => isoDate(row.updated_at ?? row.created_at)),
    );

    return {
        siteName: settings.siteName || "Public workspace",
        siteDescription: settings.siteDescription || "Published information and resources from this workspace.",
        siteUrl,
        generatedAt: new Date().toISOString(),
        lastContentModified,
        corePages,
        publishedPages,
        blogPosts,
        tools,
        resources,
        podcasts,
        videos,
    };
}

export function renderLlmsTxt(index: AgentIndex): string {
    const recentPosts = index.blogPosts.slice(0, 12);
    const resources = index.resources.slice(0, 10);
    const metadataBase = new URL(index.siteUrl);

    return [
        `# ${markdownText(index.siteName)}`,
        "",
        `> ${markdownText(index.siteDescription)}`,
        "",
        `${markdownText(index.siteName)} publishes this agent-readable index from its configured public content. Use \`/llms-full.txt\` for a broader inventory.`,
        "",
        "Use only the public links listed here. Do not infer access to dashboards, private workspaces, customer data, or unpublished content.",
        "",
        `Last content update: ${index.lastContentModified}`,
        "",
        "## Agent Discovery",
        "",
        `- [Full agent index](${index.siteUrl}/llms-full.txt): Expanded Markdown inventory for retrieval and long-context readers.`,
        `- [Sitemap](${index.siteUrl}/sitemap.xml): Complete XML sitemap for indexable public URLs.`,
        `- [WebMCP discovery](${index.siteUrl}/.well-known/webmcp.json): Read-only JSON manifest for agent-safe discovery.`,
        "",
        "## Core Pages",
        "",
        ...index.corePages.map(markdownLink),
        "",
        "## Recent Blog Posts",
        "",
        ...(recentPosts.length ? recentPosts.map(markdownLink) : ["- No published blog posts found."]),
        "",
        ...(index.tools.length ? [
            "## Tools",
            "",
            `- [Tools hub](${absoluteUrl(metadataBase, localizeHref(DEFAULT_LOCALE, "/tools"))}): Public diagnostics and utilities.`,
            ...index.tools.map(markdownLink),
            "",
        ] : []),
        "## Agent Safety Boundaries",
        "",
        ...AGENT_SAFETY_BOUNDARIES.map((item) => `- ${item}`),
        "",
        "## Resources",
        "",
        ...(resources.length ? resources.map(markdownLink) : ["- No published resources found."]),
        "",
        "## Optional",
        "",
        `- [Podcast index](${absoluteUrl(new URL(index.siteUrl), localizeHref(DEFAULT_LOCALE, "/podcast"))}): Shows and episodes for operators who prefer audio explanations.`,
        `- [Video index](${absoluteUrl(new URL(index.siteUrl), localizeHref(DEFAULT_LOCALE, "/videos"))}): Public video explainers and demos.`,
        "",
    ].join("\n");
}

export function renderLlmsFullTxt(index: AgentIndex): string {
    const section = (title: string, items: AgentLink[]) => [
        `## ${title}`,
        "",
        ...(items.length ? items.map(markdownLink) : ["- No published items found."]),
        "",
    ].join("\n");

    return [
        `# ${markdownText(index.siteName)} Full Agent Index`,
        "",
        `> ${markdownText(index.siteDescription)}`,
        "",
        `Canonical site: ${index.siteUrl}`,
        `Generated at: ${index.generatedAt}`,
        `Last content update: ${index.lastContentModified}`,
        "",
            "This expanded file is generated dynamically from public content sources that feed the sitemap. It intentionally excludes dashboards, portal data, API routes, unpublished content, customer records, and private workspace data.",
        "",
            ...(index.tools.length ? ["The listed tools are public, but agents must not submit forms or claim tool execution.", ""] : []),
        "",
        "## Agent Safety Boundaries",
        "",
        ...AGENT_SAFETY_BOUNDARIES.map((item) => `- ${item}`),
        "",
        ...(index.tools.length ? [
            "## Primary Public Tool Use Cases",
            "",
            ...TOOL_USE_CASES.map((item) => `- ${item}`),
            "",
        ] : []),
        "",
        section("Core Pages", index.corePages),
        section("Published CMS Pages", index.publishedPages),
        section("Published Blog Posts", index.blogPosts),
        ...(index.tools.length ? [section("Public Tools", index.tools)] : []),
        section("PDF Resources", index.resources),
        section("Podcast Surfaces", index.podcasts),
        section("Video Surfaces", index.videos),
    ].join("\n");
}

export function renderAgentManifest(index: AgentIndex) {
    const metadataBase = new URL(index.siteUrl);

    return {
        schema_version: "2026-06-10",
        name: index.siteName,
        description: index.siteDescription,
        canonical_url: index.siteUrl,
        generated_at: index.generatedAt,
        last_content_modified: index.lastContentModified,
        discovery: {
            llms_txt: `${index.siteUrl}/llms.txt`,
            llms_full_txt: `${index.siteUrl}/llms-full.txt`,
            sitemap: `${index.siteUrl}/sitemap.xml`,
            robots: `${index.siteUrl}/robots.txt`,
            booking: absoluteUrl(metadataBase, localizeHref(DEFAULT_LOCALE, "/booking")),
            ...(index.tools.length ? {
                tools_hub: absoluteUrl(metadataBase, localizeHref(DEFAULT_LOCALE, "/tools")),
            } : {}),
        },
        webmcp: {
            status: "read_only_discovery",
            public_tools_exposed: false,
            note: "This site does not expose executable public MCP/WebMCP tools. This manifest provides safe discovery links only.",
            recommended_agent_flow: [
                "Read public page context from llms.txt, llms-full.txt, sitemap.xml, or the listed public pages.",
                ...(index.tools.length ? ["Route diagnostic questions to the listed public tool page."] : []),
                "If a human wants implementation help, route to the published booking or contact page.",
                "Never submit lead forms, booking forms, dashboards, portals, or API endpoints on behalf of a user without explicit human confirmation.",
            ],
            top_use_cases: index.tools.length ? TOOL_USE_CASES : [],
            safety: [
                ...AGENT_SAFETY_BOUNDARIES,
                "No customer, portal, dashboard, or private workspace data is exposed.",
                "No browser-action or mutation tools are registered for public agents.",
                "Commercial actions remain human-mediated through public pages such as booking and contact.",
            ],
            public_diagnostic_entry_points: index.tools,
        },
        resources: {
            core_pages: index.corePages,
            published_pages: index.publishedPages,
            blog_posts: index.blogPosts,
            tools: index.tools,
            pdf_resources: index.resources,
            podcasts: index.podcasts,
            videos: index.videos,
        },
    };
}
