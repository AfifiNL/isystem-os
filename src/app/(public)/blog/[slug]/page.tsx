import { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { findPublishedLocalesForSlug, getPostBySlug, getRelatedPosts } from "@/features/blog/actions";
import { getActiveTemplate } from "@/features/templates/actions";
import { resolveMetadataBase } from "@/features/templates/metadata";
import { Render } from "@puckeditor/core/rsc";
import { isPublicBuilderData, normalizePublicBuilderData, puckRenderConfig } from "@/features/builder/puck.config";
import { PostExtrasTail } from "@/features/templates/ui/post-extras-tail";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, toOpenGraphLocale } from "@/shared/lib/i18n/routing";
import { getVisualEnrichment } from "@/features/content-engine/visual-enrichment";
import { canonicalBlogHref } from "@/features/blog/urls";
import { getPublicEvidenceForContent, summarizePublicEvidenceSources } from "@/features/source-intelligence/public";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// When a post is missing in the active locale, recover any inbound link
// equity (especially from Google's index) by 308-redirecting to a locale
// where the post does exist. Prefer the default locale; fall back to the
// first available. Returns true only if a redirect was issued.
async function redirectToAvailableLocaleOrNotFound(slug: string): Promise<never> {
    const availableLocales = await findPublishedLocalesForSlug(slug);

    if (availableLocales.length === 0) {
        notFound();
    }

    const targetLocale = availableLocales.includes(DEFAULT_LOCALE)
        ? DEFAULT_LOCALE
        : availableLocales[0];

    permanentRedirect(canonicalBlogHref(targetLocale, `/blog/${slug}`));
}

interface BlogPostPageProps {
    params: Promise<{ slug: string }>;
}

function resolveDefaultShareImage(templateId: string) {
    if (templateId === "facility-services") {
        return "/themes/facility-services/hero.jpg";
    }

    return "/stealth-cto-hero.png";
}

function resolveAbsoluteAssetUrl(metadataBase: URL | null, assetPath: string | null | undefined) {
    if (!assetPath) {
        return undefined;
    }

    if (assetPath.startsWith("http://") || assetPath.startsWith("https://")) {
        return assetPath;
    }

    return metadataBase ? new URL(assetPath, metadataBase).toString() : assetPath;
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
    const { slug } = await params;
    const [{ data: post }, { config, settings, locale }] = await Promise.all([
        getPostBySlug(slug),
        getActiveTemplate(),
    ]);

    if (!post) {
        await redirectToAvailableLocaleOrNotFound(slug);
    }

    const seo = post.metadata?.seo || {};
    const title = seo.title || post.title;
    const description = seo.description || post.metadata?.excerpt || "";
    const metadataBase = resolveMetadataBase(settings.siteDomain);
    const path = `/blog/${post.slug}`;
    const absoluteUrl = metadataBase ? new URL(canonicalBlogHref(locale, path), metadataBase).toString() : undefined;
    const imageUrl = resolveAbsoluteAssetUrl(
        metadataBase,
        post.metadata?.featured_image_url || resolveDefaultShareImage(config.id),
    );
    const availableLocales = await findPublishedLocalesForSlug(post.slug);
    const targetLocales = availableLocales.length > 0 ? availableLocales : [DEFAULT_LOCALE];
    const defaultLocale = targetLocales.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : targetLocales[0];
    const languageAlternates = metadataBase
        ? Object.fromEntries([
            ...targetLocales.map((supportedLocale) => [
                supportedLocale,
                new URL(canonicalBlogHref(supportedLocale, path), metadataBase).toString(),
            ]),
            ["x-default", new URL(canonicalBlogHref(defaultLocale, path), metadataBase).toString()],
        ])
        : undefined;

    return {
        title,
        description,
        keywords: Array.isArray(seo.keywords) ? seo.keywords : undefined,
        alternates: absoluteUrl || languageAlternates
            ? {
                canonical: absoluteUrl,
                languages: languageAlternates,
            }
            : undefined,
        openGraph: {
            type: "article",
            url: absoluteUrl,
            locale: toOpenGraphLocale(locale),
            alternateLocale: SUPPORTED_LOCALES.filter((supportedLocale) => supportedLocale !== locale).map(toOpenGraphLocale),
            title,
            description,
            siteName: settings.siteName || config.name,
            publishedTime: post.created_at || undefined,
            modifiedTime: post.updated_at || post.created_at || undefined,
            images: imageUrl
                ? [{ url: imageUrl, width: 1200, height: 630, alt: title }]
                : undefined,
        },
        twitter: {
            card: imageUrl ? "summary_large_image" : "summary",
            title,
            description,
            images: imageUrl ? [imageUrl] : undefined,
        },
    };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
    const { slug } = await params;
    const [{ data: post }, { config, locale, settings }] = await Promise.all([
        getPostBySlug(slug),
        getActiveTemplate(),
    ]);

    if (!post) {
        await redirectToAvailableLocaleOrNotFound(slug);
    }

    const metadataBase = resolveMetadataBase(settings.siteDomain);
    const siteName = settings.siteName || config.name;
    const siteUrl = metadataBase?.toString().replace(/\/$/, "") ?? undefined;
    const canonicalUrl = metadataBase ? new URL(canonicalBlogHref(locale, `/blog/${post.slug}`), metadataBase).toString() : undefined;
    const imageUrl = resolveAbsoluteAssetUrl(
        metadataBase,
        post.metadata?.featured_image_url || resolveDefaultShareImage(config.id),
    );
    const logoPath = config.id === "isystem-agency"
        ? "/isystem-assets/isystem-logo-light.png"
        : "/themes/facility-services/logo.svg";
    const logoUrl = resolveAbsoluteAssetUrl(metadataBase, logoPath);
    const seo = post.metadata?.seo || {};
    const title = seo.title || post.title;
    const description = seo.description || post.metadata?.excerpt || "";
    const enrichment = getVisualEnrichment(post.metadata);
    const chartDatasets = enrichment.visual_blocks.filter((block) => block.type === "chart");
    const articleSchema = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: title,
        description,
        image: imageUrl ? [imageUrl] : undefined,
        datePublished: post.created_at || undefined,
        dateModified: post.updated_at || post.created_at || undefined,
        mainEntityOfPage: canonicalUrl,
        inLanguage: locale,
        // Author Person schema when the post has a real author profile
        // attached. Falls back to the site Organization for posts that
        // predate the author-profile feature so structured data never goes
        // missing. Person → BlogPosting authorship is what Google's "About
        // this result" surface looks for.
        author: post.author?.display_name
            ? {
                "@type": "Person",
                name: post.author.display_name,
                jobTitle: post.author.role_title || undefined,
                description: post.author.bio || undefined,
                image: post.author.avatar_url || undefined,
                sameAs: Object.values(post.author.social_links || {}).filter(
                    (url) => typeof url === "string" && url.length > 0,
                ),
                worksFor: {
                    "@type": "Organization",
                    name: siteName,
                },
            }
            : {
                "@type": "Organization",
                name: siteName,
            },
        publisher: {
            "@type": "Organization",
            name: siteName,
            logo: logoUrl
                ? {
                    "@type": "ImageObject",
                    url: logoUrl,
                }
                : undefined,
        },
        isPartOf: siteUrl
            ? {
                "@type": "Blog",
                name: `${siteName} Blog`,
                url: `${siteUrl}${canonicalBlogHref(locale, "/blog")}`,
            }
            : undefined,
    };
    const visualSchema = chartDatasets.map((block) => ({
        "@context": "https://schema.org",
        "@type": "Dataset",
        name: block.title,
        description: block.description || block.caption,
        creator: {
            "@type": "Organization",
            name: siteName,
        },
        license: canonicalUrl,
        isBasedOn: block.source_url || canonicalUrl,
        variableMeasured: block.data.map((datum) => ({
            "@type": "PropertyValue",
            name: datum.label,
            value: datum.value,
            unitText: block.unit,
            description: datum.note,
        })),
    }));

    const faqs = post.metadata?.faqs;
    const faqSchema = Array.isArray(faqs) && faqs.length > 0 ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((faq: Record<string, unknown>) => ({
            "@type": "Question",
            name: typeof faq.question === "string" ? faq.question : "",
            acceptedAnswer: {
                "@type": "Answer",
                text: typeof faq.answer === "string" ? faq.answer : "",
            },
        })),
    } : null;

    const allSchemas: Array<Record<string, unknown>> = [articleSchema, ...visualSchema];
    if (faqSchema) allSchemas.push(faqSchema);

    // The post body lives in `content_markdown` / `metadata.generated_formats.blog_post` /
    // `metadata.manual_builder.sections`. `visual_layout` is an *additional*
    // Puck composition. Older posts may be fully Puck-authored (no markdown
    // body); newer posts use Puck only to append a tail strip (e.g.
    // ToolsHighlightBlock for internal linking) after a markdown body.
    //
    // Discriminate on body presence rather than on `isPublicBuilderData`,
    // otherwise saving any `visual_layout` would silently replace the
    // markdown body with whatever Puck blocks were dropped in — which is
    // what happened the moment editors started using the builder for
    // posts.
    const manualSections = post.metadata?.manual_builder?.sections;
    const hasBody = Boolean(
        post.content_markdown
            || post.metadata?.generated_formats?.blog_post
            || (Array.isArray(manualSections) && manualSections.length > 0),
    );
    const hasPuckLayout = isPublicBuilderData(post.visual_layout);

    // Legacy: fully Puck-authored post with no markdown body. Preserve the
    // original behaviour so existing posts in the DB keep rendering.
    if (!hasBody && hasPuckLayout) {
        const pageKind = typeof post.metadata?.page_kind === "string" ? post.metadata.page_kind : undefined;
        const normalizedVisualLayout = normalizePublicBuilderData(post.visual_layout, pageKind, {
            skipSeoSupportSeed: true,
        });

        if (!normalizedVisualLayout) {
            notFound();
        }

        if ((locale === "nl" || locale === "en") && normalizedVisualLayout.root?.props) {
            normalizedVisualLayout.root.props.locale = locale;
        }

        return (
            <div className={config.id === "isystem-agency" ? "isystem-editorial-surface" : undefined}>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(allSchemas) }}
                />
                {Render({ config: puckRenderConfig, data: normalizedVisualLayout as never, metadata: { locale } })}
            </div>
        );
    }

    const [{ data: relatedPosts }, publicEvidenceSources] = await Promise.all([
        getRelatedPosts(post.id, 3),
        getPublicEvidenceForContent(post.id, {
            workspaceId: post.workspace_id,
            templateId: post.template_id,
            metadata: post.metadata,
            contentMarkdown: post.content_markdown
                ?? post.metadata?.generated_formats?.blog_post
                ?? null,
            siteHost: metadataBase?.hostname,
        }),
    ]);
    const evidenceSummary = publicEvidenceSources.length > 0
        ? summarizePublicEvidenceSources(publicEvidenceSources, post.id)
        : null;

    // Dynamically resolve the Template's BlogPost renderer, or fallback
    const Renderer = config.renderers?.blogPost;

    if (!Renderer) {
        return (
            <div className="py-20 text-center">
                <p className="text-muted-foreground">This template does not support blog posts.</p>
            </div>
        );
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { renderers, ...safeConfig } = config;

    return (
        <div className={config.id === "isystem-agency" ? "isystem-editorial-surface" : undefined}>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(allSchemas) }}
            />
            <Renderer post={{ ...post, evidenceSummary, publicEvidenceSources }} relatedPosts={relatedPosts || []} config={safeConfig as typeof config} locale={locale} />
            <PostExtrasTail visualLayout={post.visual_layout ?? null} locale={locale} />
        </div>
    );
}
