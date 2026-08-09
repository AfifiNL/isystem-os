import { NextRequest, NextResponse } from "next/server";
import { getSiteSettings } from "@/features/templates/actions";
import {
    extractThemeAiSystemContext,
    getThemeManifestConfig,
} from "@/shared/lib/workspace/theme-manifest";
import { z } from "zod";
import { HUMAN_VOICE_RULES, humanizeDeep } from "@/shared/lib/ai/human-voice";
import { buildLocaleSystemPrompt, resolveGenerationLocale } from "@/shared/lib/ai/locale";
import { InsufficientAiBalanceError } from "@/shared/lib/ai/metering";
import { getAiProviderErrorTelemetry } from "@/shared/lib/ai/errors";
import { getModelMetadata, type AiModelAlias } from "@/shared/lib/ai/provider";
import {
    executeWorkspaceAiObject,
    WorkspaceAiRateLimitError,
} from "@/shared/lib/ai/workspace-execution";
import {
    GeneratedOutputSafetyError,
    assertSafeGeneratedOutput,
} from "@/shared/lib/ai/output-safety";
import {
    normalizeWorkspaceSiteUrl,
    sanitizeWorkspaceCtaUrl,
} from "./cta-url";

const ROUTE_NAME = "generate-node";
const MODEL_ALIAS: AiModelAlias = "text.structured.bulk";

export const maxDuration = 60;

// ─── Output schemas per node type ────────────────────────────────────────────

const linkedinSchema = z.object({
    posts: z.array(
        z.object({
            hook: z.string(),
            body: z.string(),
            cta: z.string(),
            hashtags: z.array(z.string()),
        }),
    ),
});

const twitterSchema = z.object({
    thread: z.array(
        z.object({
            position: z.number().int().positive(),
            text: z.string().max(280),
        }),
    ),
});

const instagramSchema = z.object({
    variations: z.array(
        z.object({
            caption: z.string(),
            hashtags: z.array(z.string()),
            slides: z.array(
                z.object({
                    slide_number: z.number().int().positive(),
                    text: z.string(),
                    visual_idea: z.string(),
                }),
            ),
        }),
    ),
});

// Permissive parse: keep every field as plain string so the AI SDK never
// throws a 422/NoObjectGeneratedError on minor model drift. Hard caps and URL
// normalization live in `sanitizeNewsletterIssue` below and run after
// generation — the operator sees a clamped, valid payload either way.
const newsletterIssueSchema = z.object({
    subject: z.string(),
    preheader: z.string(),
    body_markdown: z.string(),
    cta_label: z.string(),
    cta_url: z.string(),
});

const NEWSLETTER_LIMITS = { subject: 80, preheader: 120, cta_label: 40 } as const;

function clampLine(value: string, max: number): string {
    const cleaned = value.replace(/\s+/g, " ").trim();
    return cleaned.length > max ? cleaned.slice(0, max - 1).trimEnd() + "…" : cleaned;
}

function sanitizeNewsletterIssue(
    raw: z.infer<typeof newsletterIssueSchema>,
    siteDomain: string,
): z.infer<typeof newsletterIssueSchema> {
    return {
        subject: clampLine(raw.subject, NEWSLETTER_LIMITS.subject),
        preheader: clampLine(raw.preheader, NEWSLETTER_LIMITS.preheader),
        body_markdown: raw.body_markdown.trim(),
        cta_label: clampLine(raw.cta_label || "Read more", NEWSLETTER_LIMITS.cta_label),
        cta_url: sanitizeWorkspaceCtaUrl(raw.cta_url, siteDomain),
    };
}

const newsletterSubjectLinesSchema = z.object({
    subject_lines: z.array(z.string()),
});

const faqSchema = z.object({
    faqs: z.array(
        z.object({
            question: z.string(),
            answer: z.string(),
        })
    ),
});

const videoScriptSchema = z.object({
    title: z.string(),
    scenes: z.array(
        z.object({
            scene_number: z.number().int().positive(),
            visuals: z.string(),
            dialogue: z.string(),
            estimated_seconds: z.number().int().positive(),
        }),
    ),
});

const NODE_TYPES = [
    "social_linkedin",
    "social_twitter",
    "social_instagram",
    "video_script",
    "newsletter_issue",
    "newsletter_subject_lines",
    "faq_schema",
] as const;

type NodeType = typeof NODE_TYPES[number];

const generateNodeRequestSchema = z.object({
    contentId: z.string().uuid(),
    nodeType: z.enum(NODE_TYPES),
}).strict();

type NodeConfig = {
    schema: z.ZodTypeAny;
    systemPrompt: string;
    userPromptSuffix: string;
};

const NODE_CONFIGS: Record<NodeType, NodeConfig> = {
    social_linkedin: {
        schema: linkedinSchema,
        systemPrompt: "You are an expert B2B social media manager specializing in LinkedIn.",
        userPromptSuffix: "Draft 2 LinkedIn post variations summarizing the key takeaways in a thought-leadership tone.",
    },
    social_twitter: {
        schema: twitterSchema,
        systemPrompt: "You are an expert X/Twitter ghostwriter.",
        userPromptSuffix: "Draft a 5-part viral X/Twitter thread. Keep each tweet under 280 characters.",
    },
    social_instagram: {
        schema: instagramSchema,
        systemPrompt: "You are an expert Instagram copywriter.",
        userPromptSuffix: "Write the text for a 5-slide Instagram carousel plus caption.",
    },
    newsletter_issue: {
        schema: newsletterIssueSchema,
        systemPrompt: "You are an elite newsletter strategist who converts long-form content into high-performing email campaigns.",
        userPromptSuffix: "Create one newsletter issue with a subject line, preheader, markdown body, and CTA optimized for email readers.",
    },
    newsletter_subject_lines: {
        schema: newsletterSubjectLinesSchema,
        systemPrompt: "You are a lifecycle email copywriter focused on sharp, high-signal subject lines.",
        userPromptSuffix: "Generate 6 distinct subject lines for the source content, balancing clarity, curiosity, and authority.",
    },
    video_script: {
        schema: videoScriptSchema,
        systemPrompt: "You are an expert YouTube scriptwriter.",
        userPromptSuffix: "Write a short YouTube video script with engaging hook, visual directions, and narration.",
    },
    faq_schema: {
        schema: faqSchema,
        systemPrompt: "You are an SEO structured data assistant. Given a blog post draft, identify up to 5 frequently asked questions directly answered by the text, and provide concise, accurate answers for each. Return ONLY a JSON object with a 'faqs' array containing objects with 'question' and 'answer' strings. Answer in the exact language of the provided blog post.",
        userPromptSuffix: "Extract and answer up to 5 frequently asked questions from this blog post.",
    },
};

export async function POST(req: NextRequest) {
    try {
        const requestResult = generateNodeRequestSchema.safeParse(await req.json());
        if (!requestResult.success) {
            return NextResponse.json(
                { error: "A valid contentId and supported nodeType are required." },
                { status: 400 },
            );
        }
        const { contentId, nodeType } = requestResult.data;

        const config = NODE_CONFIGS[nodeType];
        const settings = await getSiteSettings();
        const siteDomain = settings.siteDomain;
        const workspaceSiteUrl = normalizeWorkspaceSiteUrl(siteDomain);

        // Per-node prompt extension — currently only used to give the newsletter
        // node hard length budgets and a real CTA URL to anchor to. Without
        // this, Gemini overshoots `subject` and fabricates `cta_url`, and the
        // tightened Zod schema rejects the output as a 500.
        const nodePromptExtension: Partial<Record<NodeType, string>> = {
            newsletter_issue: "Hard constraints: subject ≤ 80 characters; preheader ≤ 120 characters; cta_label ≤ 40 characters; cta_url must use workspace_site or be a site-relative path. Never use an unrelated domain or a placeholder.",
        };

        const { object: rawObject } = await executeWorkspaceAiObject({
            authorization: {
                kind: "content",
                contentId,
                requiredCapability: "content.write",
            },
            route: ROUTE_NAME,
            operation: nodeType as string,
            modelAlias: MODEL_ALIAS,
            rateLimit: { maxPerWindow: 30 },
            schema: config.schema,
            metadata: { nodeType, contentId },
            prompt: (scope) => {
                if (!scope.context || !scope.content) {
                    throw new Error("Authorized content context is required.");
                }

                const item = scope.content;
                const rawInputs = item.metadata?.generation_inputs;
                const inputs = rawInputs && typeof rawInputs === "object" && !Array.isArray(rawInputs)
                    ? rawInputs as Record<string, unknown>
                    : {};
                const industry = typeof inputs.industry === "string"
                    ? inputs.industry
                    : "Technology";
                const keywords = Array.isArray(inputs.keywords)
                    ? inputs.keywords.filter((keyword): keyword is string => typeof keyword === "string")
                    : [];
                const generationLocale = resolveGenerationLocale({
                    requested: item.locale,
                    workspaceDefault: scope.context.activeWorkspace.default_locale,
                });
                const localePrompt = buildLocaleSystemPrompt(generationLocale);
                const themeConfig = getThemeManifestConfig(scope.context);
                const workspaceBusinessContext = extractThemeAiSystemContext(themeConfig)
                    || "Active Workspace Business Context: unavailable.";

                return {
                    id: `content.generate-node.${nodeType}`,
                    version: "2026-07-24.1",
                    system: [
                        config.systemPrompt,
                        localePrompt,
                        "Align the output with the supplied workspace business context.",
                        HUMAN_VOICE_RULES,
                    ].join("\n\n"),
                    task: [
                        config.userPromptSuffix,
                        nodePromptExtension[nodeType] ?? "",
                    ].filter(Boolean).join("\n\n"),
                    trustedContext: [
                        { label: "node_type", value: nodeType },
                        { label: "output_locale", value: generationLocale },
                    ],
                    untrustedContext: [
                        {
                            label: "workspace_site",
                            value: workspaceSiteUrl,
                            maxLength: 2_000,
                        },
                        {
                            label: "workspace_business_context",
                            value: workspaceBusinessContext,
                            maxLength: 8_000,
                        },
                        { label: "topic", value: item.title, maxLength: 1_000 },
                        { label: "industry", value: industry, maxLength: 1_000 },
                        { label: "keywords", value: keywords, maxLength: 2_000 },
                        {
                            label: "source_content",
                            value: item.content_markdown,
                            maxLength: 10_000,
                        },
                    ],
                };
            },
        });

        // Post-generation clamp: enforce hard limits without making the
        // model fail validation. Currently only the newsletter node needs
        // this — others either have soft schemas or are user-edited later.
        const object = nodeType === "newsletter_issue"
            ? sanitizeNewsletterIssue(
                rawObject as z.infer<typeof newsletterIssueSchema>,
                siteDomain,
            )
            : rawObject;

        const text = humanizeDeep(
            object as Record<string, unknown>,
            ["slug", "id", "url", "type"],
        );
        assertSafeGeneratedOutput(text);
        return NextResponse.json({ text });
    } catch (err) {
        if (err instanceof GeneratedOutputSafetyError) {
            return NextResponse.json({ error: err.message }, { status: 422 });
        }
        if (err instanceof WorkspaceAiRateLimitError) {
            return NextResponse.json(
                { error: err.message },
                {
                    status: 429,
                    headers: { "Retry-After": String(err.retryAfterSeconds) },
                },
            );
        }
        if (err instanceof InsufficientAiBalanceError) {
            return NextResponse.json({ error: err.message }, { status: 402 });
        }
        if (err instanceof Error && err.message === "AI generation is only available on Pro workspaces.") {
            return NextResponse.json({ error: err.message }, { status: 403 });
        }
        if (err instanceof Error && err.message === "Unauthorized: No active workspace session found.") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (err instanceof Error && err.message === "Content item not found.") {
            return NextResponse.json({ error: err.message }, { status: 404 });
        }
        if (err instanceof Error && err.message === "Forbidden: content is outside the active workspace scope.") {
            return NextResponse.json({ error: err.message }, { status: 403 });
        }
        if (err instanceof Error && err.message === "Forbidden: missing content.write capability.") {
            return NextResponse.json({ error: err.message }, { status: 403 });
        }

        // Surface schema validation failures as 422 so the UI can prompt a
        // retry instead of looking like a permanent server error.
        const name = (err as { name?: string })?.name;
        if (name === "NoObjectGeneratedError" || name === "AI_NoObjectGeneratedError" || name === "ZodError") {
            const model = getModelMetadata(MODEL_ALIAS);
            console.error("[generate-node] Model output failed schema validation:", {
                ...getAiProviderErrorTelemetry(err, {
                    provider: model.provider,
                    modelAlias: MODEL_ALIAS,
                    modelId: model.modelId,
                }),
                errorName: name,
            });
            return NextResponse.json(
                { error: "Model output did not match the required schema. Try regenerating." },
                { status: 422 },
            );
        }
        const model = getModelMetadata(MODEL_ALIAS);
        console.error(
            "[generate-node] AI execution failed:",
            getAiProviderErrorTelemetry(err, {
                provider: model.provider,
                modelAlias: MODEL_ALIAS,
                modelId: model.modelId,
            }),
        );
        return NextResponse.json({ error: "Failed to generate content" }, { status: 500 });
    }
}
