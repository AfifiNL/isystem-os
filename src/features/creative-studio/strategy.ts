import { z } from "zod";

import { getModelMetadata, type AiModelAlias } from "@/shared/lib/ai/provider";
import { retrieveEvidencePack } from "@/shared/lib/ai/source-intelligence";
import { InsufficientAiBalanceError } from "@/shared/lib/ai/metering";
import {
    executeWorkspaceAiObject,
    WorkspaceAiRateLimitError,
} from "@/shared/lib/ai/workspace-execution";
import type { SourceEvidencePack } from "@/features/source-intelligence/types";
import {
    CREATIVE_STUDIO_RATE_LIMIT_KEYS,
    CREATIVE_STUDIO_RATE_LIMITS,
} from "@/features/creative-studio/quotas";
import {
    compileCreativePromptManifest,
    type CreativePromptManifest,
    type CreativeScopedBrief,
    type CreativeStrategyPlan,
} from "./prompt-compiler";

export { compileCreativePromptManifest, evaluateCreativeSafetyPreflight } from "./prompt-compiler";
export type { CreativePromptManifest, CreativeScopedBrief, CreativeStrategyPlan } from "./prompt-compiler";
export { creativeEvaluatorOutputSchema, creativeSafetyPreflightSchema } from "./evaluator";

export const CREATIVE_STRATEGY_MODEL_ALIAS: AiModelAlias = "text.structured";

export const creativeStrategyOutputSchema = z.object({
    positioning: z.string().min(1),
    hook: z.string().min(1),
    narrative: z.string().min(1),
    scenes: z.array(z.object({
        title: z.string().min(1),
        visual: z.string().min(1),
        voiceover: z.string().min(1),
        evidence_required: z.boolean(),
    })).min(1).max(8),
    negative_prompt: z.string().min(1),
    claims_policy: z.literal("source_grounded_only"),
});

export interface CreativeStrategyGenerationResult {
    manifest: CreativePromptManifest;
    usage: { inputTokens: number; outputTokens: number };
    modelId: string;
    sourceModel: string;
    evidencePack: SourceEvidencePack;
}

function asString(value: unknown): string | null {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function buildDeterministicCreativeStrategy(brief: CreativeScopedBrief, evidencePack: unknown): CreativeStrategyPlan {
    const evidence = evidencePack && typeof evidencePack === "object" && !Array.isArray(evidencePack) ? evidencePack as { claims?: Array<{ claim_text?: string }> } : {};
    const evidenceLine = evidence.claims?.[0]?.claim_text ?? "source-safe qualitative proof, with unsupported claims removed";
    return {
        positioning: `${brief.title} framed as an operator-led, source-grounded creative concept`,
        hook: `Show the audience why ${brief.title.toLowerCase()} matters without inventing proof`,
        narrative: `Open with the problem, show the governed system, connect to evidence, and close with a human-approved CTA${brief.targetUrl ? ` for ${brief.targetUrl}` : ""}.`,
        scenes: [
            {
                title: "Problem frame",
                visual: "A calm dashboard-style opening shot with abstract workflow nodes and no private text visible",
                voiceover: `Teams need clearer operating systems. Evidence anchor: ${evidenceLine}`,
                evidence_required: true,
            },
            {
                title: "System reveal",
                visual: "Layered cards representing source evidence, strategy, review, and approved render handoff",
                voiceover: "The system turns approved briefs into governed creative plans before any render is queued.",
                evidence_required: false,
            },
            {
                title: "Approval gate",
                visual: "A visible human approval checkpoint before a locked render queue",
                voiceover: "Human review stays in control of claims, rights, and final submission.",
                evidence_required: false,
            },
        ],
        negative_prompt: "No celebrity likeness, no copyrighted characters, no private source text, no unsupported numbers, no medical/legal guarantees, no public personal data.",
        claims_policy: "source_grounded_only",
    };
}

export async function generateCreativeStrategyWithVertex(input: {
    brief: CreativeScopedBrief;
    evidencePack?: SourceEvidencePack;
}): Promise<CreativeStrategyGenerationResult> {
    const evidencePack = input.evidencePack ?? await retrieveEvidencePack({
        workspaceId: input.brief.workspaceId,
        topic: input.brief.title,
        keywords: input.brief.briefMarkdown.match(/[\p{L}\p{N}]{4,}/gu)?.slice(0, 16) ?? [],
        locale: input.brief.locale,
        maxClaims: 12,
    });
    const metadata = getModelMetadata(CREATIVE_STRATEGY_MODEL_ALIAS, { provider: "vertex" });
    let plan: CreativeStrategyPlan;
    let usage = { inputTokens: 0, outputTokens: 0 };
    let sourceModel = metadata.modelId;

    try {
        const result = await executeWorkspaceAiObject({
            authorization: {
                kind: "active_workspace",
                expectedWorkspaceId: input.brief.workspaceId,
                requiredCapability: "content.write",
            },
            route: CREATIVE_STUDIO_RATE_LIMIT_KEYS.strategy,
            operation: "creative_strategy",
            modelAlias: CREATIVE_STRATEGY_MODEL_ALIAS,
            rateLimit: CREATIVE_STUDIO_RATE_LIMITS.strategy,
            schema: creativeStrategyOutputSchema,
            metadata: {
                briefId: input.brief.id,
                templateId: input.brief.templateId,
            },
            prompt: {
                id: "creative-studio.strategy",
                version: "2026-07-24.1",
                system: [
                    "You are Vertex AI acting as the workspace Creative Studio strategy engine, not a render provider.",
                    "Return only a structured creative strategy. Do not queue renders or call Higgsfield.",
                    "Unsupported claims must be downgraded to qualitative language or blocked.",
                    "Do not expose raw private source text in public output. Use evidence as private grounding only.",
                ].join("\n"),
                task: "Create a source-grounded strategy plan for the supplied creative brief.",
                trustedContext: [
                    { label: "output_locale", value: input.brief.locale },
                ],
                untrustedContext: [
                    { label: "title", value: input.brief.title, maxLength: 1_000 },
                    {
                        label: "brief",
                        value: input.brief.briefMarkdown,
                        maxLength: 20_000,
                    },
                    {
                        label: "audience",
                        value: input.brief.targetAudience ?? "not specified",
                        maxLength: 2_000,
                    },
                    {
                        label: "channel",
                        value: input.brief.targetChannel ?? "manual_export",
                        maxLength: 500,
                    },
                    {
                        label: "target_url",
                        value: input.brief.targetUrl ?? "none",
                        maxLength: 2_000,
                    },
                    {
                        label: "brand_rules",
                        value: input.brief.brandRules,
                        maxLength: 12_000,
                    },
                    {
                        label: "rights_requirements",
                        value: input.brief.rightsRequirements,
                        maxLength: 12_000,
                    },
                    {
                        label: "evidence_pack",
                        value: {
                            checkedAt: evidencePack.checked_at,
                            retrievalMode: evidencePack.retrieval_mode,
                            stale: evidencePack.stale,
                            claims: evidencePack.claims.slice(0, 8).map((claim) => ({
                                claim: claim.claim_text,
                                quality: claim.quality,
                                trustTier: claim.source.trust_tier,
                                confidence: claim.confidence,
                            })),
                        },
                        maxLength: 20_000,
                    },
                ],
            },
        });
        plan = result.object;
        usage = {
            inputTokens: result.usage?.inputTokens ?? 0,
            outputTokens: result.usage?.outputTokens ?? 0,
        };
        sourceModel = asString(result.runtimeFallback?.selectedModelId) ?? metadata.modelId;
    } catch (error) {
        if (
            error instanceof InsufficientAiBalanceError
            || error instanceof WorkspaceAiRateLimitError
            || (
                error instanceof Error
                && (
                    error.message.startsWith("Forbidden:")
                    || error.message.startsWith("Unauthorized:")
                )
            )
        ) {
            throw error;
        }
        plan = buildDeterministicCreativeStrategy(input.brief, evidencePack);
        sourceModel = "deterministic-fallback-v1";
    }

    return {
        manifest: compileCreativePromptManifest({ brief: input.brief, plan, evidencePack, sourceModel }),
        usage,
        modelId: sourceModel,
        sourceModel,
        evidencePack,
    };
}
