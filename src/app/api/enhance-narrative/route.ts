import { NextResponse } from "next/server";
import {
    extractThemeAiSystemContext,
    getThemeManifestConfig,
} from "@/shared/lib/workspace/theme-manifest";
import { InsufficientAiBalanceError } from "@/shared/lib/ai/metering";
import { HUMAN_VOICE_RULES, humanize } from "@/shared/lib/ai/human-voice";
import { buildLocaleSystemPrompt, resolveGenerationLocale } from "@/shared/lib/ai/locale";
import { getAiProviderErrorTelemetry } from "@/shared/lib/ai/errors";
import {
    getModelMetadata,
    type AiModelAlias,
} from "@/shared/lib/ai/provider";
import {
    executeWorkspaceAiText,
    WorkspaceAiRateLimitError,
} from "@/shared/lib/ai/workspace-execution";
import {
    GeneratedOutputSafetyError,
    assertSafeGeneratedOutput,
} from "@/shared/lib/ai/output-safety";
import { z } from "zod";

export const maxDuration = 300;

const ROUTE_NAME = "enhance-narrative";
const MODEL_ALIAS: AiModelAlias = "text.writer";

const NARRATIVE_COMMANDS = ["professional", "conversational", "expand", "shorten", "fix"] as const;
type NarrativeCommand = typeof NARRATIVE_COMMANDS[number];

const COMMAND_PROMPTS: Record<NarrativeCommand, string> = {
    professional: "Revise the following text to sound highly professional, authoritative, and corporate-ready. Remove slang and overly casual phrasing while maintaining clarity.",
    conversational: "Revise the following text to sound conversational, friendly, and approachable. Speak directly to the reader like a mentor.",
    expand: "Expand on the following text. Add specific examples, elaborate on the core points, and make the narrative richer and longer.",
    shorten: "Condense and summarize the following text. Remove fluff, keep the sentences punchy, and get straight to the point.",
    fix: "Perform a thorough grammar, spelling, and clarity check on the following text. Fix any errors and improve sentence flow without changing the original tone.",
};

const enhanceNarrativeRequestSchema = z.object({
    text: z.string().trim().min(1).max(50_000),
    command: z.enum(NARRATIVE_COMMANDS),
    draftContext: z.string().max(10_000).optional().nullable(),
    contentId: z.string().uuid().optional().nullable(),
    locale: z.enum(["en", "nl", "ar"]).optional().nullable(),
}).strict();

export async function POST(req: Request) {
    try {
        const requestResult = enhanceNarrativeRequestSchema.safeParse(await req.json());
        if (!requestResult.success) {
            return NextResponse.json(
                { error: "Valid text and a supported narrative command are required." },
                { status: 400 },
            );
        }
        const { text, command, draftContext, contentId, locale: requestedLocale } = requestResult.data;

        const { text: resultText } = await executeWorkspaceAiText({
            authorization: contentId
                ? {
                    kind: "content",
                    contentId,
                    requiredCapability: "content.write",
                }
                : {
                    kind: "active_workspace",
                    requiredCapability: "content.write",
                },
            route: ROUTE_NAME,
            operation: command,
            modelAlias: MODEL_ALIAS,
            rateLimit: { maxPerWindow: 60 },
            metadata: { command, contentId: contentId ?? null },
            prompt: (scope) => {
                if (!scope.context) {
                    throw new Error("Authenticated workspace context is required.");
                }

                // Explicit locale → authorized parent content → workspace.
                const generationLocale = resolveGenerationLocale({
                    requested: requestedLocale ?? scope.content?.locale ?? null,
                    workspaceDefault: scope.context.activeWorkspace.default_locale,
                });
                const localePrompt = buildLocaleSystemPrompt(generationLocale);
                const themeConfig = getThemeManifestConfig(scope.context);
                const workspaceBusinessContext = extractThemeAiSystemContext(themeConfig)
                    || "Active Workspace Business Context: unavailable.";

                return {
                    id: `content.enhance-narrative.${command}`,
                    version: "2026-07-24.1",
                    system: [
                        "You improve an authorized content draft without changing its factual meaning.",
                        localePrompt,
                        COMMAND_PROMPTS[command],
                        "Align the rewrite with the supplied workspace context.",
                        HUMAN_VOICE_RULES,
                    ].join("\n\n"),
                    task: "Rewrite source_text and return only the rewritten text in Markdown. Use draft_context only as background; do not rewrite it.",
                    trustedContext: [
                        { label: "output_locale", value: generationLocale },
                    ],
                    untrustedContext: [
                        {
                            label: "workspace_business_context",
                            value: workspaceBusinessContext,
                            maxLength: 8_000,
                        },
                        {
                            label: "draft_context",
                            value: draftContext || "None provided.",
                            maxLength: 1_000,
                        },
                        { label: "source_text", value: text, maxLength: 50_000 },
                    ],
                };
            },
        });

        const result = humanize(resultText);
        assertSafeGeneratedOutput(result);
        return NextResponse.json({ result });
    } catch (error: unknown) {
        if (error instanceof GeneratedOutputSafetyError) {
            return NextResponse.json({ error: error.message }, { status: 422 });
        }
        if (error instanceof WorkspaceAiRateLimitError) {
            return NextResponse.json(
                { error: error.message },
                {
                    status: 429,
                    headers: { "Retry-After": String(error.retryAfterSeconds) },
                },
            );
        }
        if (error instanceof InsufficientAiBalanceError) {
            return NextResponse.json({ error: error.message }, { status: 402 });
        }
        if (error instanceof Error && error.message === "AI generation is only available on Pro workspaces.") {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (error instanceof Error && error.message === "Unauthorized: No active workspace session found.") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (error instanceof Error && error.message === "Content item not found.") {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error instanceof Error && error.message === "Forbidden: content is outside the active workspace scope.") {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (error instanceof Error && error.message === "Forbidden: missing content.write capability.") {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        const model = getModelMetadata(MODEL_ALIAS);
        console.error(
            "[enhance-narrative] AI execution failed:",
            getAiProviderErrorTelemetry(error, {
                provider: model.provider,
                modelAlias: MODEL_ALIAS,
                modelId: model.modelId,
            }),
        );
        return NextResponse.json(
            { error: "Failed to enhance narrative. Please try again." },
            { status: 500 },
        );
    }
}
