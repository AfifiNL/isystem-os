import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { localizeHref } from "@/shared/lib/i18n/routing";
import type { Locale } from "@/features/templates/types";
import { BlogVisualBlockRenderer } from "./blog-visual-block";
import { splitMarkdownByVisualShortcodes, type BlogVisualBlock } from "@/features/content-engine/visual-enrichment";
import { splitMarkdownByVideoShortcodes } from "@/features/content-engine/lib/video-shortcodes";
import { BlogVideoEmbed } from "./blog-video-embed";

interface BlogMarkdownWithVisualsProps {
    content: string;
    visualBlocks: BlogVisualBlock[];
    className: string;
    imageClassName: string;
    imageAltFallback: string;
    locale?: Locale;
    publicView?: boolean;
}

function normalizeInternalMarkdownHref(href: string | undefined, locale?: Locale) {
    if (!href || !locale || !href.startsWith("/") || href.startsWith("//")) {
        return href;
    }

    return localizeHref(locale, href);
}

function isExternalMarkdownHref(href: string | undefined) {
    return Boolean(href && /^https?:\/\//i.test(href));
}

export function BlogMarkdownWithVisuals({ content, visualBlocks, className, imageClassName, imageAltFallback, locale, publicView }: BlogMarkdownWithVisualsProps) {
    const chunks = splitMarkdownByVisualShortcodes(content);
    const blocksById = new Map(visualBlocks.map((block) => [block.id, block]));

    return (
        <div className={className}>
            {chunks.map((chunk, index) => {
                if (chunk.type === "visual") {
                    const block = blocksById.get(chunk.id);
                    return block ? <BlogVisualBlockRenderer key={`${chunk.id}-${index}`} block={block} publicView={publicView} /> : null;
                }

                return (
                    <div key={`video-group-${index}`} className="contents">
                        {splitMarkdownByVideoShortcodes(chunk.content).map((videoChunk, videoIndex) => {
                            if (videoChunk.type === "video") {
                                return <BlogVideoEmbed key={`video-${index}-${videoIndex}`} video={videoChunk.video} surface={publicView ? "public" : "editor"} />;
                            }

                            return (
                                <ReactMarkdown
                                    key={`markdown-${index}-${videoIndex}`}
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        h1: () => null,
                                        img: ({ alt, ...props }) => (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img alt={alt || imageAltFallback} className={imageClassName} {...props} />
                                        ),
                                        a: ({ href, children, ...props }) => {
                                            const normalizedHref = normalizeInternalMarkdownHref(href, locale);
                                            const isExternal = isExternalMarkdownHref(normalizedHref);

                                            return (
                                                <a
                                                    {...props}
                                                    href={normalizedHref}
                                                    target={isExternal ? "_blank" : undefined}
                                                    rel={isExternal ? "noopener noreferrer" : undefined}
                                                >
                                                    {children}
                                                </a>
                                            );
                                        },
                                    }}
                                >
                                    {videoChunk.content}
                                </ReactMarkdown>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
}
