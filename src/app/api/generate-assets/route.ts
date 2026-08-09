import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { getActiveTemplate } from "@/features/templates/actions";
import { assertAuthorizedContentAccess } from "@/shared/lib/workspace/context";
import {
    extractThemeAiSystemContext,
    getThemeManifestConfig,
} from "@/shared/lib/workspace/theme-manifest";
import {
    assertSufficientAiBalance,
    checkAiRateLimitPg,
    InsufficientAiBalanceError,
    meterAndCharge,
} from "@/shared/lib/ai/metering";
import {
    buildAiRequestMetadata,
    getModelMetadata,
    normalizeAiProviderError,
    runWithWorkspaceAiConfig,
} from "@/shared/lib/ai/provider";
import { getAiProviderErrorTelemetry } from "@/shared/lib/ai/errors";
import type { AiModelAlias } from "@/shared/lib/ai/models";
import { generateVertexImage, type VertexImageAlias, type VertexImageAspectRatio } from "@/shared/lib/ai/vertex-media";
import { z } from "zod";
import { generateObjectWithFallback } from "@/shared/lib/ai/runtime-fallback";
import {
    buildTextFreeEditorialPrompt,
    enforceTextFreeImagenPrompt,
    TEXT_FREE_BACKGROUND_SUFFIX,
    TEXT_FREE_IMAGEN_NEGATIVE_PROMPT,
} from "@/app/api/generate-assets/prompt-guard";
import {
    generateSvgOverlay,
    normalizeOverlayText,
    OVERLAY_DESIGN_IDS,
    selectOverlayDesign,
    type OverlayDesignId,
} from "@/app/api/generate-assets/overlay";
import {
    buildAssetGenerationState,
    type AssetGenerationFailure,
    type AssetGenerationFallback,
} from "@/app/api/generate-assets/asset-generation-state";
import { parseAssetGenerationRequest } from "@/app/api/generate-assets/request-contract";
import { resolveWorkspaceBrandLogoDataUri } from "@/shared/lib/client-config/media-branding";

export const maxDuration = 300; // Allow up to 5 minutes for generation

// Web-optimized target dimensions per aspect ratio. Gemini returns large
// uncompressed PNG; we resize + re-encode as WebP before storage so bytes on
// the wire match what the browser actually lays out.
const WEB_TARGETS: Record<string, { width: number; height: number }> = {
    "16:9": { width: 1200, height: 675 },
    "1:1": { width: 1200, height: 1200 },
    "4:3": { width: 1200, height: 900 },
    "9:16": { width: 720, height: 1280 },
};

const WEBP_QUALITY = 82;
const STORAGE_CACHE_CONTROL = "public, max-age=31536000, immutable";

async function optimizeImageForWeb(
    pngBuffer: Buffer,
    aspectRatio: string,
    key?: string,
    overlayText?: string | null,
    category?: string,
    overlayDesign?: OverlayDesignId | null,
    logoDataUri?: string | null,
): Promise<{ buffer: Buffer; width: number; height: number }> {
    const target = WEB_TARGETS[aspectRatio] ?? WEB_TARGETS["16:9"];
    let sharpInstance = sharp(pngBuffer)
        .rotate()
        .resize(target.width, target.height, { fit: "cover", position: "attention" });

    if (key && isOverlayAssetKey(key)) {
        const svgBuffer = generateSvgOverlay(overlayText || "Key Insight", category || "Insights", overlayDesign ?? undefined, logoDataUri);
        sharpInstance = sharpInstance.composite([
            {
                input: svgBuffer,
                top: 0,
                left: 0,
            }
        ]);
    }

    const buffer = await sharpInstance
        .webp({ quality: WEBP_QUALITY, effort: 4 })
        .toBuffer();
    return { buffer, width: target.width, height: target.height };
}

const ROUTE_NAME = "generate-assets";
const PROMPT_MODEL_ALIAS: AiModelAlias = "text.bulk";
const IMAGE_MODEL_ALIAS: VertexImageAlias = "image.fast";
const PROMPT_MODEL_METADATA = getModelMetadata(PROMPT_MODEL_ALIAS);
const IMAGE_MODEL_METADATA = getModelMetadata(IMAGE_MODEL_ALIAS, { provider: "vertex" });

// ─── Image Generation via Vertex AI Gemini ──────────────────────────────────
interface ImageSpec {
    key: string;
    prompt: string;
    aspectRatio: VertexImageAspectRatio;
    modelAlias: VertexImageAlias;
    overlayText: string | null;
    overlayDesign: OverlayDesignId | null;
}

interface ImageTypeSpec {
    key: string;
    desc: string;
    ratio: VertexImageAspectRatio;
    modelAlias: VertexImageAlias;
}

interface GeneratedAsset {
    url: string;
    type: string;
    size: number;
    width?: number;
    height?: number;
    source?: "vertex_gemini" | "deterministic_svg";
    fallback?: boolean;
    overlay_text?: string;
    overlay_design?: OverlayDesignId;
}

type ImageGenerationAttempt =
    | { status: "succeeded"; key: string; base64: string; mimeType: string }
    | { status: "failed"; key: string; failure: AssetGenerationFailure };


const GENERATED_IMAGE_SCHEMA = z.object({
    images: z.array(z.object({
        key: z.string(),
        prompt: z.string(),
        overlayText: z.string().nullable(),
    }))
});

function isOverlayAssetKey(key: string): key is "blog_featured" | "youtube_thumbnail" {
    return key === "blog_featured" || key === "youtube_thumbnail";
}

function normalizeOverlayDesign(value: OverlayDesignId | null | undefined): OverlayDesignId | undefined {
    return value && OVERLAY_DESIGN_IDS.includes(value) ? value : undefined;
}

function fallbackPromptForImageType(
    type: ImageTypeSpec,
    params: {
        title: string;
        industry: string;
        keywords: string[];
        visualStyle: string;
        contentExcerpt?: string;
        locale?: string | null;
    },
): ImageSpec {
    const isOverlayAsset = type.key === "blog_featured" || type.key === "youtube_thumbnail";
    const keywordPhrase = params.keywords.slice(0, 5).join(", ") || params.industry;
    return {
        key: type.key,
        aspectRatio: type.ratio,
        modelAlias: type.modelAlias,
        overlayText: isOverlayAsset
            ? normalizeOverlayText(params.title, params.title)
            : null,
        overlayDesign: isOverlayAsset
            ? selectOverlayDesign({
                title: params.title,
                description: params.contentExcerpt,
                keywords: params.keywords,
                locale: params.locale,
                assetKey: type.key,
                promptContext: `${params.industry}\n${params.visualStyle}`,
                category: params.industry,
            })
            : null,
        prompt: buildTextFreeEditorialPrompt({
            industry: params.industry,
            keywords: keywordPhrase.split(", "),
            visualStyle: params.visualStyle,
            assetDescription: type.desc,
        }),
    };
}

function buildFallbackImageSpecs(
    imageTypes: ImageTypeSpec[],
    title: string,
    industry: string,
    keywords: string[],
    visualStyle: string,
    contentExcerpt?: string,
    locale?: string | null,
): ImageSpec[] {
    return imageTypes.map((type) => fallbackPromptForImageType(type, {
        title,
        industry,
        keywords,
        visualStyle,
        contentExcerpt,
        locale,
    }));
}

function sanitizeDiagnosticMessage(message: string): string {
    return message
        .replace(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/g, "[redacted private key]")
        .replace(/([\"']?(?:private_key|client_secret|api_key|access_token|refresh_token|authorization)[\"']?\s*[:=]\s*)[\"']?[^\"'\s,}]+/gi, "$1[redacted]")
        .slice(0, 700);
}

function providerFailureForImage(spec: ImageSpec, error: unknown): AssetGenerationFailure {
    const providerError = normalizeAiProviderError(error, {
        provider: "vertex",
        modelAlias: spec.modelAlias,
        modelId: IMAGE_MODEL_METADATA.modelId,
    });

    return {
        key: spec.key,
        stage: "image_generation",
        message: sanitizeDiagnosticMessage(providerError.message),
        category: providerError.code,
        provider: providerError.provider,
        model_alias: providerError.modelAlias,
        model_id: providerError.modelId,
        region: providerError.region,
        retryable: providerError.retryable,
    };
}

async function generateImage(spec: ImageSpec): Promise<ImageGenerationAttempt> {
    try {
        console.log(`[generate-assets] Generating image: ${spec.key} (${IMAGE_MODEL_METADATA.modelId})`);
        const result = await generateVertexImage({
            alias: spec.modelAlias,
            prompt: enforceTextFreeImagenPrompt(spec.prompt),
            aspectRatio: spec.aspectRatio,
            negativePrompt: TEXT_FREE_IMAGEN_NEGATIVE_PROMPT,
        });
        const image = result.images[0];
        if (!image?.base64) {
            const failure = providerFailureForImage(spec, new Error("Vertex Gemini Image returned no usable image for this asset."));
            console.warn("[generate-assets] Image generation returned empty output:", failure);
            return { status: "failed", key: spec.key, failure };
        }

        return { status: "succeeded", key: spec.key, base64: image.base64, mimeType: image.mimeType };
    } catch (e) {
        const failure = providerFailureForImage(spec, e);
        console.error(`[generate-assets] Image generation failed for ${spec.key}:`, failure);
        return { status: "failed", key: spec.key, failure };
    }
}

function hashString(value: string): number {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function buildDeterministicFallbackSvg(title: string, industry: string, keywords: string[]): Buffer {
    const palette = [
        ["#020617", "#0f172a", "#38bdf8", "#6366f1"],
        ["#08111f", "#172554", "#22d3ee", "#a855f7"],
        ["#0b1120", "#1e1b4b", "#14b8a6", "#60a5fa"],
        ["#111827", "#312e81", "#f59e0b", "#38bdf8"],
    ];
    const seed = hashString(`${title}|${industry}|${keywords.join(",")}`);
    const colors = palette[seed % palette.length];
    const circles = Array.from({ length: 10 }, (_, index) => {
        const local = hashString(`${seed}:${index}`);
        const cx = 610 + (local % 520);
        const cy = 60 + ((local >>> 8) % 560);
        const radius = 28 + ((local >>> 16) % 120);
        const opacity = (0.08 + (((local >>> 24) % 14) / 100)).toFixed(2);
        const color = index % 2 === 0 ? colors[2] : colors[3];
        return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${color}" opacity="${opacity}" />`;
    }).join("\n");

    const lines = Array.from({ length: 7 }, (_, index) => {
        const y = 110 + index * 72;
        const width = 190 + ((seed >>> (index % 16)) % 260);
        const opacity = (0.08 + index * 0.015).toFixed(2);
        return `<rect x="760" y="${y}" width="${width}" height="2" rx="1" fill="${colors[2]}" opacity="${opacity}" />`;
    }).join("\n");

    const svg = `
        <svg width="1200" height="675" viewBox="0 0 1200 675" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="${colors[0]}" />
                    <stop offset="55%" stop-color="${colors[1]}" />
                    <stop offset="100%" stop-color="#020617" />
                </linearGradient>
                <radialGradient id="glow" cx="78%" cy="32%" r="62%">
                    <stop offset="0%" stop-color="${colors[2]}" stop-opacity="0.34" />
                    <stop offset="60%" stop-color="${colors[3]}" stop-opacity="0.12" />
                    <stop offset="100%" stop-color="#020617" stop-opacity="0" />
                </radialGradient>
            </defs>
            <rect width="1200" height="675" fill="url(#bg)" />
            <rect width="1200" height="675" fill="url(#glow)" />
            <path d="M620 600 C760 470 860 500 1010 340 C1100 245 1125 175 1200 110 L1200 675 L620 675 Z" fill="${colors[3]}" opacity="0.10" />
            ${circles}
            ${lines}
        </svg>`;

    return Buffer.from(svg);
}

async function buildDeterministicFallbackImage(params: {
    title: string;
    industry: string;
    keywords: string[];
    overlayText: string | null | undefined;
    locale?: string | null;
    contentExcerpt?: string | null;
    visualStyle?: string | null;
    overlayDesign?: OverlayDesignId | null;
    logoDataUri?: string | null;
}): Promise<{ buffer: Buffer; width: number; height: number }> {
    const background = buildDeterministicFallbackSvg(params.title, params.industry, params.keywords);
    const overlayDesign = params.overlayDesign ?? selectOverlayDesign({
        title: params.title,
        description: params.contentExcerpt,
        keywords: params.keywords,
        locale: params.locale,
        assetKey: "blog_featured",
        promptContext: params.visualStyle,
        category: params.industry,
    });
    const overlay = generateSvgOverlay(
        normalizeOverlayText(params.overlayText, params.title),
        params.industry,
        overlayDesign,
        params.logoDataUri,
    );

    const output = await sharp(background)
        .composite([{ input: overlay, top: 0, left: 0 }])
        .webp({ quality: WEBP_QUALITY, effort: 4 })
        .toBuffer({ resolveWithObject: true });

    return { buffer: output.data, width: output.info.width, height: output.info.height };
}

function fallbackReasonFromFailures(failures: AssetGenerationFailure[], key: string): string {
    const relevant = failures.filter((failure) => failure.key === key);
    if (relevant.some((failure) => failure.stage === "upload")) return "primary_upload_failed";
    if (relevant.some((failure) => failure.stage === "optimization")) return "primary_optimization_failed";
    const providerFailure = relevant.find((failure) => failure.stage === "image_generation");
    if (providerFailure?.category) return `primary_${providerFailure.category}`;
    return "primary_generation_unavailable";
}

// ─── Prompt Generation ──────────────────────────────────────────────────────
async function generateImagePrompts(
    title: string,
    industry: string,
    keywords: string[],
    contentTypes: string[],
    visualStyle: string,
    aiSystemContext: string,
    meterCtx: { workspaceId: string; profileId: string | null },
    contentExcerpt?: string,
    locale?: string | null,
): Promise<ImageSpec[]> {
    const specs: ImageSpec[] = [];
    const imageTypes: ImageTypeSpec[] = [];

    // Switch entirely to fast-generate to prevent timeouts during large batches
    if (contentTypes.includes("blog_post")) {
        imageTypes.push({
            key: "blog_featured",
            desc: "a blog post featured hero background — cinematic, professional, high-concept visual with no text-bearing surfaces",
            ratio: "16:9",
            modelAlias: IMAGE_MODEL_ALIAS,
        });
    }

    if (contentTypes.includes("video_script")) {
        imageTypes.push({
            key: "youtube_thumbnail",
            desc: "a YouTube video thumbnail background — eye-catching, high contrast, clean negative space for an external overlay",
            ratio: "16:9",
            modelAlias: IMAGE_MODEL_ALIAS,
        });
    }

    if (contentTypes.includes("social_linkedin")) {
        imageTypes.push({
            key: "social_linkedin",
            desc: "a LinkedIn professional post header — clean, modern, business-appropriate",
            ratio: "16:9",
            modelAlias: IMAGE_MODEL_ALIAS,
        });
    }

    if (contentTypes.includes("social_twitter")) {
        imageTypes.push({
            key: "social_twitter",
            desc: "an X/Twitter post image — vibrant, attention-grabbing, card-format",
            ratio: "16:9",
            modelAlias: IMAGE_MODEL_ALIAS,
        });
    }

    if (contentTypes.includes("social_instagram")) {
        imageTypes.push({
            key: "social_instagram",
            desc: "an Instagram carousel cover background — square, lifestyle, clean negative space with no in-image typography",
            ratio: "1:1",
            modelAlias: IMAGE_MODEL_ALIAS,
        });
    }

    if (imageTypes.length === 0) return specs;

    let object: z.infer<typeof GENERATED_IMAGE_SCHEMA> | null = null;

    try {
        const result = await generateObjectWithFallback(PROMPT_MODEL_ALIAS, {
            schema: GENERATED_IMAGE_SCHEMA,
            system: `${aiSystemContext}

You are an expert visual prompt engineer for AI image generation (specifically optimized for Google's Gemini 3.1 image models). Your goal is to design visual concepts that are contextually relevant, meaningful, and professional.

### Aesthetic Rules for Prompt Generation:
1. **Focus and Simplicity**: Every prompt MUST describe a single, grounded central subject/focal point. Avoid busy, cluttered collages or complex abstract workflows.
2. **No Abstract Digital Tropes**: Avoid glowing circuits floating in space, holographic UI/HUD overlays, glowing blue databases in the clouds, or neon floating lightbulbs. These look cheap and weird. Instead, use real-world concrete spaces, modern minimalist offices, high-end desk setups, or natural landscapes.
3. **Typography Rule**: Never request any text, words, letterforms, signage, or logos in the generated background image. The background image must be completely text-free.
4. **Composition**: Describe the lighting (e.g. warm natural light, soft side studio light) and camera parameters (e.g. shot on 50mm lens, shallow depth of field, minimalist composition) to match the required visual style.
5. **Overlay Text Selection**: For 'blog_featured' or 'youtube_thumbnail' keys, define a highly relevant and meaningful title of maximum 7 words that represents the post's core message. The overlay text must be extremely concise, punchy, and readable. Set to null for other keys.
6. **No Text-Prone Surfaces**: Do not ask for printed documents, book pages, guide pages, whiteboards, signs, posters, browser windows, code editors, dashboards with labels, or readable UI. If a screen is useful, describe it as blurred/unlabeled abstract shapes only.

${TEXT_FREE_BACKGROUND_SUFFIX}

You MUST align every concept and aesthetic with the active workspace business context above.`,
            prompt: `Generate a structured visual design specification for these image assets.

Topic for overlay text only — NEVER include this title or its words in the image prompt: "${title}"
Industry: ${industry}
Keywords: ${keywords.join(", ")}
Required Visual Style: ${visualStyle}

Image assets needed:
${imageTypes.map((t, i) => `${i + 1}. Key: "${t.key}" - ${t.desc}`).join("\n")}

For each required asset, return:
- The exact asset key.
- A 1-3 sentence detailed visual prompt that incorporates the required visual style, focuses on a single grounded subject, and strictly requests a text-free background with no text-prone surfaces.
- A highly relevant, meaningful, and contextually precise title of MAXIMUM 7 words for 'blog_featured' and 'youtube_thumbnail' assets (set to null for others).`,
        });

        object = result.object;

        await meterAndCharge({
            workspaceId: meterCtx.workspaceId,
            profileId: meterCtx.profileId,
            route: ROUTE_NAME,
            usage: {
                unitType: "tokens",
                model: PROMPT_MODEL_METADATA.modelId,
                tokensIn: result.usage.inputTokens ?? 0,
                tokensOut: result.usage.outputTokens ?? 0,
            },
            metadata: {
                phase: "image_prompt_engineering",
                ai: buildAiRequestMetadata({
                    alias: PROMPT_MODEL_ALIAS,
                    workspaceId: meterCtx.workspaceId,
                    routeName: ROUTE_NAME,
                    operation: "image_prompt_engineering",
                }),
            },
        });
    } catch (error) {
        const providerError = normalizeAiProviderError(error, {
            provider: PROMPT_MODEL_METADATA.provider,
            modelAlias: PROMPT_MODEL_ALIAS,
            modelId: PROMPT_MODEL_METADATA.modelId,
        });
        console.warn(
            "[generate-assets] Prompt schema generation failed; using deterministic image prompts:",
            getAiProviderErrorTelemetry(providerError),
        );
        return buildFallbackImageSpecs(imageTypes, title, industry, keywords, visualStyle, contentExcerpt, locale);
    }

    imageTypes.forEach((type) => {
        const match = object?.images.find((img) => img.key === type.key);
        if (match) {
            const isOverlayAsset = type.key === "blog_featured" || type.key === "youtube_thumbnail";
            const overlayDesign = isOverlayAsset
                ? selectOverlayDesign({
                    title,
                    description: contentExcerpt,
                    keywords,
                    locale,
                    assetKey: type.key,
                    promptContext: `${visualStyle}\n${match.prompt}\n${aiSystemContext.slice(0, 1200)}`,
                    category: industry,
                })
                : null;
            specs.push({
                key: type.key,
                prompt: isOverlayAsset
                    ? buildTextFreeEditorialPrompt({
                        industry,
                        keywords,
                        visualStyle,
                        assetDescription: type.desc,
                    })
                    : enforceTextFreeImagenPrompt(match.prompt),
                aspectRatio: type.ratio,
                modelAlias: type.modelAlias,
                overlayText: isOverlayAsset
                    ? normalizeOverlayText(match.overlayText, title)
                    : null,
                overlayDesign,
            });
        }
    });

    if (specs.length !== imageTypes.length) {
        const missing = imageTypes.filter((type) => !specs.some((spec) => spec.key === type.key));
        console.warn("[generate-assets] Prompt object omitted required image keys; backfilling deterministic prompts:", missing.map((type) => type.key));
        specs.push(...buildFallbackImageSpecs(missing, title, industry, keywords, visualStyle, contentExcerpt, locale));
    }

    return specs;
}


export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const requestResult = parseAssetGenerationRequest(await req.json());
        if (!requestResult.ok) {
            return NextResponse.json(
                {
                    error: requestResult.error,
                    code: requestResult.code,
                    workflow: requestResult.workflow,
                },
                { status: 400 },
            );
        }
        const content_id = requestResult.value.contentId;
        const generate_images = requestResult.value.generateImages;

        const { content: item, context: workspaceContext } = await assertAuthorizedContentAccess(content_id, {
            requireAiEnabled: true,
        });
        if (!workspaceContext.effectiveCapabilities.includes("content.write")) {
            throw new Error("Forbidden: missing content.write capability.");
        }
        const workspaceId = workspaceContext.activeWorkspace.id;
        const meterCtx = { workspaceId, profileId: user.id };

        const limit = await checkAiRateLimitPg(workspaceId, ROUTE_NAME, { maxPerWindow: 10 });
        if (!limit.allowed) {
            return NextResponse.json(
                { error: "Rate limit exceeded. Please try again shortly." },
                { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
            );
        }

        await assertSufficientAiBalance(workspaceId);

        const metadata = item.metadata || {};
        const inputs = (metadata.generation_inputs as Record<string, unknown> | undefined) || {};
        const formats = (metadata.generated_formats as Record<string, unknown> | undefined) || {};
        const title = item.title;
        const themeConfig = getThemeManifestConfig(workspaceContext);
        const brandLogoDataUri = await resolveWorkspaceBrandLogoDataUri(workspaceContext.activeWorkspace.metadata);
        const aiSystemContext = extractThemeAiSystemContext(themeConfig) || "Active Workspace Business Context: unavailable.";
        // Default to the applied context if available, otherwise fetch active template
        const { config } = await getActiveTemplate();
        const appliedContext = (inputs.applied_ai_context as Record<string, unknown> | undefined) || config.aiContext || {};

        const industry = typeof appliedContext.industry === "string" ? appliedContext.industry : "Technology";
        const visualStyle = typeof appliedContext.visualStyle === "string"
            ? appliedContext.visualStyle
            : "Cinematic, photorealistic, professional.";
        const keywords = Array.isArray(inputs.keywords)
            ? inputs.keywords.filter((value): value is string => typeof value === "string")
            : [];
        const locale = typeof item.locale === "string" ? item.locale : workspaceContext.activeWorkspace.default_locale;
        const contentTypes = Object.keys(formats);

        // Fallback: manually-authored content items have no generated_formats. Infer from item.type
        // so image generation still works for blog posts and other native content created outside Content Studio.
        if (contentTypes.length === 0) {
            if (item.type === "blog") {
                contentTypes.push("blog_post");
            } else if (item.type === "page") {
                contentTypes.push("blog_post");
            }
        }
        const postContent = (formats.blog_post as string | undefined) || item.content_markdown || "";
        const contentExcerpt = postContent ? postContent.substring(0, 2000) : "";

        console.log(`[generate-assets] Starting for "${title}" — images: ${generate_images}`);

        const assets: Record<string, GeneratedAsset> = {};
        const failures: AssetGenerationFailure[] = [];
        const fallbacks: AssetGenerationFallback[] = [];
        const requestedImageKeys: string[] = [];
        // Neutral folder name. Previously this was "generated/" — which leaked
        // directly into public OG image URLs (`/public-media/generated/.../blog_featured.webp`)
        // and was an obvious tell that the article was AI-produced. Use a
        // domain-neutral path that doesn't advertise the pipeline.
        const storagePath = `articles/${content_id}`;

        if (generate_images !== false) {
            const storageSupabase = createAdminClient();
            await runWithWorkspaceAiConfig(workspaceId, async () => {
                const imageSpecs = await generateImagePrompts(title, industry, keywords, contentTypes, visualStyle, aiSystemContext, meterCtx, contentExcerpt, locale);
                requestedImageKeys.push(...imageSpecs.map((spec) => spec.key));
                console.log(`[generate-assets] Generating ${imageSpecs.length} images...`);

                // Using allSettled or map to prevent one failure from dropping all images
                const imageResults = await Promise.all(imageSpecs.map((spec) => generateImage(spec)));

                for (let index = 0; index < imageResults.length; index += 1) {
                    const result = imageResults[index];
                    const spec = imageSpecs[index];
                    if (result.status === "failed") {
                        failures.push(result.failure);
                        continue;
                    }

                    const rawBytes = Buffer.from(result.base64, "base64");
                    let optimized: { buffer: Buffer; width: number; height: number };
                    try {
                        optimized = await optimizeImageForWeb(rawBytes, spec.aspectRatio, spec.key, spec.overlayText, industry, spec.overlayDesign, brandLogoDataUri);
                        console.log(
                            `[generate-assets] ${result.key}: ${rawBytes.length} bytes PNG → ${optimized.buffer.length} bytes WebP (${optimized.width}×${optimized.height})`,
                        );
                    } catch (optimizeError) {
                        console.error(`[generate-assets] sharp failed for ${result.key}:`, optimizeError);
                        failures.push({
                            key: result.key,
                            stage: "optimization",
                            message: sanitizeDiagnosticMessage(optimizeError instanceof Error ? optimizeError.message : String(optimizeError)),
                            category: "optimization_failed",
                        });
                        continue;
                    }

                    const fileName = `${result.key}.webp`;
                    const filePath = `${storagePath}/${fileName}`;

                    const { error: uploadError } = await storageSupabase.storage
                        .from("public-media")
                        .upload(filePath, optimized.buffer, {
                            contentType: "image/webp",
                            cacheControl: STORAGE_CACHE_CONTROL,
                            upsert: true,
                        });

                    if (uploadError) {
                        console.error(`[generate-assets] Upload error for ${fileName}:`, uploadError);
                        failures.push({
                            key: result.key,
                            stage: "upload",
                            message: sanitizeDiagnosticMessage(uploadError.message),
                            category: "storage_upload_failed",
                        });
                        continue;
                    }

                    const { data: urlData } = storageSupabase.storage
                        .from("public-media")
                        .getPublicUrl(filePath);

                    assets[result.key] = {
                        url: urlData.publicUrl,
                        type: "image/webp",
                        size: optimized.buffer.length,
                        width: optimized.width,
                        height: optimized.height,
                        source: "vertex_gemini",
                        ...(isOverlayAssetKey(result.key) ? {
                            overlay_text: spec.overlayText ?? undefined,
                            overlay_design: normalizeOverlayDesign(spec.overlayDesign),
                        } : {}),
                    };

                    await meterAndCharge({
                        workspaceId,
                        profileId: user.id,
                        route: ROUTE_NAME,
                        usage: { unitType: "image", model: IMAGE_MODEL_METADATA.modelId, imageCount: 1 },
                        metadata: {
                            imageKey: result.key,
                            ai: buildAiRequestMetadata({
                                alias: spec.modelAlias,
                                provider: "vertex",
                                workspaceId,
                                routeName: ROUTE_NAME,
                                operation: `image_generation:${result.key}`,
                            }),
                        },
                    });
                }

                if (requestedImageKeys.includes("blog_featured") && !assets.blog_featured) {
                    const blogSpec = imageSpecs.find((spec) => spec.key === "blog_featured");
                    const reason = fallbackReasonFromFailures(failures, "blog_featured");
                    console.warn("[generate-assets] Primary blog_featured image unavailable; creating deterministic fallback:", {
                        content_id,
                        workspaceId,
                        reason,
                    });

                    let fallbackImage: { buffer: Buffer; width: number; height: number };
                    try {
                        fallbackImage = await buildDeterministicFallbackImage({
                            title,
                            industry,
                            keywords,
                            overlayText: blogSpec?.overlayText,
                            locale,
                            contentExcerpt,
                            visualStyle,
                            overlayDesign: blogSpec?.overlayDesign,
                            logoDataUri: brandLogoDataUri,
                        });
                    } catch (fallbackError) {
                        const message = sanitizeDiagnosticMessage(fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
                        console.error("[generate-assets] Deterministic fallback image generation failed:", message);
                        failures.push({
                            key: "blog_featured",
                            stage: "fallback_generation",
                            message,
                            category: "fallback_generation_failed",
                        });
                        fallbacks.push({
                            key: "blog_featured",
                            status: "failed",
                            source: "deterministic_svg",
                            reason,
                            message,
                        });
                        return;
                    }

                    const fallbackPath = `${storagePath}/blog_featured-fallback.webp`;
                    const { error: fallbackUploadError } = await storageSupabase.storage
                        .from("public-media")
                        .upload(fallbackPath, fallbackImage.buffer, {
                            contentType: "image/webp",
                            cacheControl: STORAGE_CACHE_CONTROL,
                            upsert: true,
                        });

                    if (fallbackUploadError) {
                        const message = sanitizeDiagnosticMessage(fallbackUploadError.message);
                        console.error("[generate-assets] Deterministic fallback upload failed:", {
                            content_id,
                            workspaceId,
                            message,
                        });
                        failures.push({
                            key: "blog_featured",
                            stage: "fallback_upload",
                            message,
                            category: "fallback_storage_upload_failed",
                        });
                        fallbacks.push({
                            key: "blog_featured",
                            status: "failed",
                            source: "deterministic_svg",
                            reason,
                            message,
                        });
                        return;
                    }

                    const { data: fallbackUrlData } = storageSupabase.storage
                        .from("public-media")
                        .getPublicUrl(fallbackPath);

                    assets.blog_featured = {
                        url: fallbackUrlData.publicUrl,
                        type: "image/webp",
                        size: fallbackImage.buffer.length,
                        width: fallbackImage.width,
                        height: fallbackImage.height,
                        source: "deterministic_svg",
                        fallback: true,
                        overlay_text: normalizeOverlayText(blogSpec?.overlayText, title),
                        overlay_design: normalizeOverlayDesign(blogSpec?.overlayDesign),
                    };
                    fallbacks.push({
                        key: "blog_featured",
                        status: "succeeded",
                        source: "deterministic_svg",
                        reason,
                        url: fallbackUrlData.publicUrl,
                    });
                    console.info("[generate-assets] Deterministic featured-image fallback attached:", {
                        content_id,
                        workspaceId,
                        reason,
                        size: fallbackImage.buffer.length,
                    });
                }
            });
        }

        const generatedAt = new Date().toISOString();
        const featuredImageUrl = assets.blog_featured?.url ?? metadata.featured_image_url ?? null;
        const assetGeneration = buildAssetGenerationState({
            requestedImages: generate_images !== false,
            requestedKeys: requestedImageKeys,
            generatedKeys: Object.keys(assets),
            failures,
            fallbacks,
            featuredImageUrl,
            generatedAt,
        });

        const updatedMetadata = {
            ...metadata,
            assets: { ...(metadata.assets || {}), ...assets },
            assets_generated_at: generatedAt,
            asset_generation: assetGeneration,
            featured_image_url: featuredImageUrl ?? metadata.featured_image_url,
            featured_image_alt: assets.blog_featured?.url ? title : metadata.featured_image_alt,
        };

        let updateQuery = supabase
            .from("content_items")
            .update({ metadata: updatedMetadata })
            .eq("id", content_id)
            .eq("workspace_id", workspaceId);

        const templateId = item.template_id;
        if (typeof templateId === "string" && templateId.length > 0) {
            updateQuery = updateQuery.eq("template_id", templateId);
        }

        const { error: updateError } = await updateQuery;

        if (updateError) {
            console.error("[generate-assets] Metadata update error:", updateError);
            failures.push({ key: "metadata", stage: "metadata_update", message: updateError.message });
            return NextResponse.json(
                {
                    error: "Asset generation finished but metadata could not be updated. Please retry asset generation.",
                    content_id,
                    assets,
                    count: Object.keys(assets).length,
                    asset_generation: buildAssetGenerationState({
                        requestedImages: generate_images !== false,
                        requestedKeys: requestedImageKeys,
                        generatedKeys: Object.keys(assets),
                        failures,
                        fallbacks,
                        featuredImageUrl,
                        generatedAt: new Date().toISOString(),
                    }),
                },
                { status: 500 },
            );
        }

        if (generate_images !== false && requestedImageKeys.length > 0 && Object.keys(assets).length === 0) {
            return NextResponse.json(
                {
                    error: "Image generation failed for all requested assets. The draft was saved; retry asset generation from the content editor.",
                    content_id,
                    assets,
                    count: 0,
                    asset_generation: assetGeneration,
                },
                { status: 502 },
            );
        }

        return NextResponse.json({
            content_id,
            assets,
            count: Object.keys(assets).length,
            asset_generation: assetGeneration,
        });
    } catch (err: unknown) {
        if (err instanceof InsufficientAiBalanceError) {
            return NextResponse.json({ error: err.message }, { status: 402 });
        }
        if (err instanceof Error) {
            if (err.message === "AI generation is only available on Pro workspaces.") {
                return NextResponse.json({ error: err.message }, { status: 403 });
            }

            if (err.message === "Unauthorized: No active workspace session found.") {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }

            if (err.message === "Content item not found.") {
                return NextResponse.json({ error: err.message }, { status: 404 });
            }

            if (err.message === "Forbidden: content is outside the active workspace scope.") {
                return NextResponse.json({ error: err.message }, { status: 403 });
            }

            if (err.message === "Forbidden: missing content.write capability.") {
                return NextResponse.json({ error: err.message }, { status: 403 });
            }
        }

        console.error("[generate-assets] Unexpected failure:", {
            errorName: err instanceof Error ? err.name : typeof err,
        });
        return NextResponse.json(
            { error: "Asset generation failed unexpectedly. Please retry." },
            { status: 500 },
        );
    }
}
