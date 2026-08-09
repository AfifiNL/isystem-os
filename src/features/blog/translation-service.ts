import { z } from "zod";
import { executeWorkspaceAiObject } from "@/shared/lib/ai/workspace-execution";
import { assertSafeGeneratedOutput } from "@/shared/lib/ai/output-safety";
import type { AiModelAlias } from "@/shared/lib/ai/provider";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import type { Json } from "@/shared/lib/supabase/database.types";

const TRANSLATION_MODEL_ALIAS: AiModelAlias = "text.translation";

const translationSchema = z.object({
    title: z.string().describe("The translated blog post title"),
    contentMarkdown: z.string().describe(
        "Translated markdown content with visual placeholders unchanged",
    ),
    excerpt: z.string().describe("A short translated summary"),
    seoTitle: z.string().describe("An SEO title in the target language"),
    seoDescription: z.string().describe("An SEO description in the target language"),
    category: z.string().describe("The translated category"),
    visualBlocks: z.array(z.record(z.string(), z.unknown())).optional().describe(
        "Translated visual-block data with its original structure",
    ),
});

type TranslationLocale = "nl" | "ar";

export interface BlogPostInput {
    id?: string;
    title: string;
    slug: string;
    type: string;
    status: string | null;
    locale: string;
    content_markdown: string | null;
    metadata: unknown;
    author_id: string | null;
    template_id: string | null;
    workspace_id: string | null;
    visual_layout: unknown;
    updated_at?: string;
}

export interface BlogTranslationResult {
    translatedLocales: TranslationLocale[];
    refreshedLocales: TranslationLocale[];
    skippedLocales: TranslationLocale[];
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function languageName(locale: TranslationLocale): string {
    return locale === "nl" ? "Dutch" : "Modern Standard Arabic";
}

export async function translateAndSeedPost(
    post: BlogPostInput,
    locales: readonly TranslationLocale[],
): Promise<BlogTranslationResult> {
    const workspaceId = post.workspace_id;
    if (!workspaceId) {
        throw new Error("Translation source content is missing workspace_id.");
    }

    const supabase = createAdminClient();
    const metadata = asRecord(post.metadata);
    const seo = asRecord(metadata.seo);
    const visualBlocks = Array.isArray(metadata.visual_blocks)
        ? metadata.visual_blocks
        : [];
    const translatedLocales: TranslationLocale[] = [];
    const refreshedLocales: TranslationLocale[] = [];
    const skippedLocales: TranslationLocale[] = [];
    const failures: string[] = [];

    for (const locale of locales) {
        let existingQuery = supabase
            .from("content_items")
            .select("id,metadata")
            .eq("workspace_id", workspaceId)
            .eq("locale", locale)
            .eq("slug", post.slug);
        existingQuery = post.template_id
            ? existingQuery.eq("template_id", post.template_id)
            : existingQuery.is("template_id", null);

        const { data: existing, error: checkError } = await existingQuery.maybeSingle();
        if (checkError) {
            failures.push(`${locale}: failed to check existing translation: ${checkError.message}`);
            continue;
        }
        const existingMetadata = asRecord(existing?.metadata);
        const existingTranslation = asRecord(existingMetadata.translation);
        const isManagedTranslation = Boolean(
            existing
            && post.id
            && existingTranslation.source_content_id === post.id,
        );
        const isCurrentManagedTranslation = Boolean(
            isManagedTranslation
            && post.updated_at
            && existingTranslation.source_version === post.updated_at,
        );
        if (existing && (!isManagedTranslation || isCurrentManagedTranslation)) {
            skippedLocales.push(locale);
            continue;
        }

        try {
            const targetLanguage = languageName(locale);
            const route = `blog:translation:${locale}`;
            const translationResult = await executeWorkspaceAiObject({
                authorization: {
                    kind: "system_workspace",
                    workspaceId,
                    source: "content_translation_job",
                },
                route,
                operation: "translate",
                modelAlias: TRANSLATION_MODEL_ALIAS,
                rateLimit: { maxPerWindow: 10 },
                prompt: {
                    id: "blog.translate-and-seed",
                    version: "2.0.0",
                    system: [
                        "You are a professional business translator and copywriter.",
                        "Produce natural, idiomatic, commercially grounded language.",
                        "Return only data conforming to the supplied schema.",
                    ].join("\n"),
                    task: [
                        `Translate the English source into ${targetLanguage}.`,
                        "Preserve markdown structure, HTML syntax, URLs, and every {{visual:...}} placeholder exactly.",
                        "Translate link display text while retaining link destinations.",
                        "Keep relative internal links unchanged; application code localizes their locale prefix.",
                        "The context is XML-escaped at the security boundary; interpret entities as their original characters and return normal markdown/HTML syntax.",
                    ].join("\n"),
                    trustedContext: [
                        { label: "source_locale", value: "en" },
                        { label: "target_locale", value: locale },
                        { label: "target_language", value: targetLanguage },
                    ],
                    untrustedContext: [
                        { label: "title", value: post.title, maxLength: 500 },
                        { label: "excerpt", value: metadata.excerpt, maxLength: 2_000 },
                        { label: "seo_title", value: seo.title, maxLength: 500 },
                        { label: "seo_description", value: seo.description, maxLength: 1_000 },
                        { label: "category", value: metadata.category, maxLength: 300 },
                        { label: "visual_blocks", value: visualBlocks, maxLength: 30_000 },
                        {
                            label: "content_markdown",
                            value: post.content_markdown ?? "",
                            maxLength: 80_000,
                        },
                    ],
                },
                schema: translationSchema,
                metadata: {
                    sourceContentId: post.id ?? null,
                    sourceLocale: post.locale,
                    targetLocale: locale,
                },
            });
            const translated = translationResult.object;
            assertSafeGeneratedOutput(translated);
            const localizedMarkdown = translated.contentMarkdown.replace(
                /\]\(\/en\//g,
                `](/${locale}/`,
            );
            const translatedMetadata = structuredClone(metadata);
            translatedMetadata.excerpt = translated.excerpt;
            translatedMetadata.category = translated.category;
            translatedMetadata.seo = {
                ...asRecord(translatedMetadata.seo),
                title: translated.seoTitle,
                description: translated.seoDescription,
            };
            if (translated.visualBlocks) {
                translatedMetadata.visual_blocks = translated.visualBlocks;
            }
            translatedMetadata.translation = {
                source_content_id: post.id ?? null,
                source_version: post.updated_at ?? null,
                source_locale: post.locale,
                target_locale: locale,
                generated_at: new Date().toISOString(),
                managed: true,
            };

            const translatedPost = {
                title: translated.title,
                slug: post.slug,
                type: post.type,
                status: post.status,
                locale,
                content_markdown: localizedMarkdown,
                metadata: translatedMetadata as Json,
                author_id: post.author_id,
                template_id: post.template_id,
                workspace_id: workspaceId,
                visual_layout: post.visual_layout as Json,
            };
            const mutation = existing
                ? supabase
                    .from("content_items")
                    .update(translatedPost)
                    .eq("id", existing.id)
                    .eq("workspace_id", workspaceId)
                : supabase
                    .from("content_items")
                    .insert(translatedPost);
            const { error: mutationError } = await mutation;

            if (mutationError) {
                throw new Error(
                    `Failed to ${existing ? "refresh" : "insert"} ${locale} translation: ${mutationError.message}`,
                );
            }
            if (existing) refreshedLocales.push(locale);
            else translatedLocales.push(locale);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            failures.push(`${locale}: ${message}`);
        }
    }

    if (failures.length > 0) {
        throw new Error(`Content translation incomplete: ${failures.join(" | ")}`);
    }

    return { translatedLocales, refreshedLocales, skippedLocales };
}
