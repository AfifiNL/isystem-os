import { embed, type EmbeddingModel } from "ai";
import type { ZodType } from "zod";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import type { Json } from "@/shared/lib/supabase/database.types";
import {
    assertAuthorizedContentAccess,
    assertWorkspaceAiEnabled,
    type AuthorizedContentAccess,
    type WorkspaceContext,
    type WorkspaceSummary,
} from "@/shared/lib/workspace/context";
import {
    assertSufficientAiBalance,
    checkAiRateLimitPg,
    meterAndCharge,
    type MeterResult,
    type RateLimitConfig,
} from "@/shared/lib/ai/metering";
import {
    getAiProviderErrorTelemetry,
    normalizeAiProviderError,
} from "@/shared/lib/ai/errors";
import {
    buildResolvedAiRequestMetadata,
    getAiModel,
    getModelMetadata,
    runWithWorkspaceAiConfig,
    type AiModelAlias,
    type AiRequestMetadataLabels,
} from "@/shared/lib/ai/provider";
import {
    generateObjectWithFallback,
    generateTextWithFallback,
    type AiRuntimeFallbackMetadata,
    type GenerateObjectWithFallbackResult,
    type GenerateTextWithFallbackResult,
} from "@/shared/lib/ai/runtime-fallback";
import {
    buildWorkspaceAiPrompt,
    type RenderedWorkspaceAiPrompt,
    type WorkspaceAiPromptDefinition,
} from "@/shared/lib/ai/prompt-safety";
import { assertSafeGeneratedOutput } from "@/shared/lib/ai/output-safety";

type ActiveWorkspaceContext = WorkspaceContext & { activeWorkspace: WorkspaceSummary };
type TextGenerationSettings = Omit<
    Parameters<typeof generateTextWithFallback>[1],
    "system" | "prompt"
>;
type ObjectGenerationSettings<T> = Omit<
    Parameters<typeof generateObjectWithFallback<T>>[1],
    "system" | "prompt" | "schema"
>;
type EmbeddingGenerationSettings = Omit<
    Parameters<typeof embed>[0],
    "model" | "value"
>;

export const WORKSPACE_AI_SYSTEM_SOURCES = [
    "content_translation_job",
    "seo_internal_link_worker",
] as const;
export type WorkspaceAiSystemSource = typeof WORKSPACE_AI_SYSTEM_SOURCES[number];
const WORKSPACE_AI_SYSTEM_SOURCE_SET = new Set<string>(WORKSPACE_AI_SYSTEM_SOURCES);

export type WorkspaceAiAuthorization =
    | {
        kind: "active_workspace";
        /** Guards against a caller accidentally mixing a previously loaded tenant. */
        expectedWorkspaceId?: string;
        /** Optional capability required before the workspace budget may be used. */
        requiredCapability?: string;
    }
    | {
        kind: "content";
        contentId: string;
        /** Optional capability required before the workspace budget may be used. */
        requiredCapability?: string;
    }
    | {
        /**
         * Reserved for server-owned jobs whose workspace was loaded from a
         * tenant-scoped database row. This path re-checks active + Pro status.
         */
        kind: "system_workspace";
        workspaceId: string;
        source: WorkspaceAiSystemSource;
    };

export interface WorkspaceAiAuthorizedScope {
    workspaceId: string;
    profileId: string | null;
    authorizationKind: WorkspaceAiAuthorization["kind"];
    context?: ActiveWorkspaceContext;
    content?: AuthorizedContentAccess["content"];
    systemSource?: string;
}

type PromptFactory =
    | WorkspaceAiPromptDefinition
    | ((
        scope: WorkspaceAiAuthorizedScope,
    ) => WorkspaceAiPromptDefinition | Promise<WorkspaceAiPromptDefinition>);

interface WorkspaceAiExecutionInput {
    authorization: WorkspaceAiAuthorization;
    route: string;
    operation: string;
    modelAlias: AiModelAlias;
    rateLimit: RateLimitConfig;
    prompt: PromptFactory;
    metadata?: Record<string, unknown>;
}

export interface ExecuteWorkspaceAiTextInput extends WorkspaceAiExecutionInput {
    generation?: TextGenerationSettings;
}

export interface ExecuteWorkspaceAiObjectInput<T> extends WorkspaceAiExecutionInput {
    schema: ZodType<T>;
    generation?: ObjectGenerationSettings<T>;
}

export interface ExecuteWorkspaceAiEmbeddingInput extends WorkspaceAiExecutionInput {
    value: string;
    generation?: EmbeddingGenerationSettings;
}

export interface WorkspaceAiExecutionMetadata {
    auditRunId: string | null;
    prompt: RenderedWorkspaceAiPrompt["metadata"];
    request: AiRequestMetadataLabels;
    runtimeFallback: AiRuntimeFallbackMetadata;
    billing: MeterResult | null;
}

export type ExecuteWorkspaceAiTextResult = GenerateTextWithFallbackResult & {
    scope: WorkspaceAiAuthorizedScope;
    workspaceAi: WorkspaceAiExecutionMetadata;
};

export type ExecuteWorkspaceAiObjectResult<T> = GenerateObjectWithFallbackResult<T> & {
    scope: WorkspaceAiAuthorizedScope;
    workspaceAi: WorkspaceAiExecutionMetadata;
};

export interface ExecuteWorkspaceAiEmbeddingResult {
    value: string;
    embedding: number[];
    embeddingTokenUsage: number;
    runtimeFallback: AiRuntimeFallbackMetadata;
    scope: WorkspaceAiAuthorizedScope;
    workspaceAi: WorkspaceAiExecutionMetadata;
}

export class WorkspaceAiRateLimitError extends Error {
    constructor(
        public readonly retryAfterSeconds: number,
        public readonly remaining: number,
    ) {
        super("Rate limit exceeded. Please try again shortly.");
        this.name = "WorkspaceAiRateLimitError";
    }
}

interface RuntimeGenerationResult {
    usage?: {
        inputTokens?: number;
        outputTokens?: number;
    };
    runtimeFallback: AiRuntimeFallbackMetadata;
}

interface AiExecutionAuditStart {
    scope: WorkspaceAiAuthorizedScope;
    input: WorkspaceAiExecutionInput;
    prompt: RenderedWorkspaceAiPrompt;
}

interface AiExecutionAuditCompletion {
    status: "succeeded" | "failed";
    resolvedModelAlias?: string;
    resolvedModelId?: string;
    errorCode?: string;
    errorMessage?: string;
    runtimeMetadata: Record<string, unknown>;
}

async function resolveSystemWorkspaceAuthorization(
    authorization: Extract<WorkspaceAiAuthorization, { kind: "system_workspace" }>,
): Promise<WorkspaceAiAuthorizedScope> {
    const workspaceId = authorization.workspaceId.trim();
    const source = authorization.source.trim();
    if (
        !workspaceId
        || !source
        || !WORKSPACE_AI_SYSTEM_SOURCE_SET.has(source)
    ) {
        throw new Error("System AI authorization requires a workspace and allowlisted source.");
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("workspaces")
        .select("id, workspace_tier, is_active")
        .eq("id", workspaceId)
        .maybeSingle();

    if (error || !data || !data.is_active) {
        throw new Error("Unauthorized: system AI workspace is unavailable.");
    }
    if (data.workspace_tier !== "pro") {
        throw new Error("AI generation is only available on Pro workspaces.");
    }

    return {
        workspaceId: data.id,
        profileId: null,
        authorizationKind: authorization.kind,
        systemSource: source,
    };
}

export async function resolveWorkspaceAiAuthorization(
    authorization: WorkspaceAiAuthorization,
): Promise<WorkspaceAiAuthorizedScope> {
    if (authorization.kind === "system_workspace") {
        return resolveSystemWorkspaceAuthorization(authorization);
    }

    if (authorization.kind === "content") {
        const access = await assertAuthorizedContentAccess(authorization.contentId, {
            requireAiEnabled: true,
        });
        const requiredCapability = authorization.requiredCapability?.trim();
        if (
            requiredCapability
            && !access.context.effectiveCapabilities.includes(requiredCapability)
        ) {
            throw new Error(`Forbidden: missing ${requiredCapability} capability.`);
        }
        return {
            workspaceId: access.context.activeWorkspace.id,
            profileId: access.context.userId,
            authorizationKind: authorization.kind,
            context: access.context,
            content: access.content,
        };
    }

    const context = await assertWorkspaceAiEnabled();
    if (
        authorization.expectedWorkspaceId
        && authorization.expectedWorkspaceId !== context.activeWorkspace.id
    ) {
        throw new Error("Forbidden: AI request workspace does not match the active workspace.");
    }
    const requiredCapability = authorization.requiredCapability?.trim();
    if (
        requiredCapability
        && !context.effectiveCapabilities.includes(requiredCapability)
    ) {
        throw new Error(`Forbidden: missing ${requiredCapability} capability.`);
    }

    return {
        workspaceId: context.activeWorkspace.id,
        profileId: context.userId,
        authorizationKind: authorization.kind,
        context,
    };
}

async function startAiExecutionAudit(
    details: AiExecutionAuditStart,
): Promise<string | null> {
    try {
        const supabase = createAdminClient();
        const { data, error } = await supabase
            .from("ai_execution_runs")
            .insert({
                workspace_id: details.scope.workspaceId,
                profile_id: details.scope.profileId,
                authorization_kind: details.scope.authorizationKind,
                route: details.input.route,
                operation: details.input.operation,
                prompt_id: details.prompt.metadata.id,
                prompt_version: details.prompt.metadata.version,
                prompt_hash: details.prompt.metadata.hash,
                requested_model_alias: details.input.modelAlias,
                runtime_metadata: {
                    ...details.input.metadata,
                    authorization: {
                        kind: details.scope.authorizationKind,
                        systemSource: details.scope.systemSource ?? null,
                    },
                    prompt: {
                        trustedLabels: details.prompt.metadata.trustedLabels,
                        untrustedLabels: details.prompt.metadata.untrustedLabels,
                    },
                } as Json,
            })
            .select("id")
            .maybeSingle();

        if (error) {
            console.error("[workspace-ai] Failed to start execution audit:", error.message);
            return null;
        }
        return data?.id ?? null;
    } catch (error) {
        console.error("[workspace-ai] Execution audit unavailable:", error);
        return null;
    }
}

async function completeAiExecutionAudit(
    auditRunId: string | null,
    completion: AiExecutionAuditCompletion,
): Promise<void> {
    if (!auditRunId) return;

    try {
        const supabase = createAdminClient();
        const { error } = await supabase
            .from("ai_execution_runs")
            .update({
                status: completion.status,
                resolved_model_alias: completion.resolvedModelAlias ?? null,
                resolved_model_id: completion.resolvedModelId ?? null,
                error_code: completion.errorCode ?? null,
                error_message: completion.errorMessage?.slice(0, 2_000) ?? null,
                runtime_metadata: completion.runtimeMetadata as Json,
                completed_at: new Date().toISOString(),
            })
            .eq("id", auditRunId);

        if (error) {
            console.error("[workspace-ai] Failed to complete execution audit:", error.message);
        }
    } catch (error) {
        console.error("[workspace-ai] Failed to complete execution audit:", error);
    }
}

function resolvedRequestMetadata(
    input: WorkspaceAiExecutionInput,
    scope: WorkspaceAiAuthorizedScope,
    runtimeFallback: AiRuntimeFallbackMetadata,
): AiRequestMetadataLabels {
    const selectedAttempt = runtimeFallback.attempts.find((attempt) => !attempt.failed);
    const selectedMetadata = getModelMetadata(runtimeFallback.selectedAlias);

    return buildResolvedAiRequestMetadata({
        alias: runtimeFallback.selectedAlias,
        metadata: {
            ...selectedMetadata,
            modelId: runtimeFallback.selectedModelId,
            transport: selectedAttempt?.transport ?? selectedMetadata.transport,
        },
        workspaceId: scope.workspaceId,
        routeName: input.route,
        operation: input.operation,
    });
}

async function executeWorkspaceAiCall<TResult extends RuntimeGenerationResult>(
    input: WorkspaceAiExecutionInput,
    generate: (prompt: RenderedWorkspaceAiPrompt) => Promise<TResult>,
): Promise<TResult & {
    scope: WorkspaceAiAuthorizedScope;
    workspaceAi: WorkspaceAiExecutionMetadata;
}> {
    const scope = await resolveWorkspaceAiAuthorization(input.authorization);
    const rate = await checkAiRateLimitPg(scope.workspaceId, input.route, input.rateLimit);
    if (!rate.allowed) {
        throw new WorkspaceAiRateLimitError(rate.retryAfterSeconds, rate.remaining);
    }
    await assertSufficientAiBalance(scope.workspaceId);

    const definition = typeof input.prompt === "function"
        ? await input.prompt(scope)
        : input.prompt;
    const renderedPrompt = buildWorkspaceAiPrompt(definition);

    return runWithWorkspaceAiConfig(scope.workspaceId, async () => {
        const requestedMetadata = getModelMetadata(input.modelAlias);
        const auditRunId = await startAiExecutionAudit({
            scope,
            input,
            prompt: renderedPrompt,
        });

        try {
            const result = await generate(renderedPrompt);
            const requestMetadata = resolvedRequestMetadata(
                input,
                scope,
                result.runtimeFallback,
            );
            const tokensIn = result.usage?.inputTokens ?? 0;
            const tokensOut = result.usage?.outputTokens ?? 0;
            const persistedMetadata = {
                ...input.metadata,
                authorization: {
                    kind: scope.authorizationKind,
                    systemSource: scope.systemSource ?? null,
                },
                prompt: renderedPrompt.metadata,
                ai: requestMetadata,
                runtimeFallback: result.runtimeFallback,
            };

            const billing = await meterAndCharge({
                workspaceId: scope.workspaceId,
                profileId: scope.profileId,
                route: input.route,
                usage: {
                    unitType: "tokens",
                    model: result.runtimeFallback.selectedModelId,
                    tokensIn,
                    tokensOut,
                },
                status: "succeeded",
                metadata: persistedMetadata,
            });
            await completeAiExecutionAudit(auditRunId, {
                status: "succeeded",
                resolvedModelAlias: result.runtimeFallback.selectedAlias,
                resolvedModelId: result.runtimeFallback.selectedModelId,
                runtimeMetadata: {
                    ...persistedMetadata,
                    usage: { tokensIn, tokensOut },
                },
            });

            return Object.assign(result, {
                scope,
                workspaceAi: {
                    auditRunId,
                    prompt: renderedPrompt.metadata,
                    request: requestMetadata,
                    runtimeFallback: result.runtimeFallback,
                    billing,
                },
            });
        } catch (error) {
            const providerError = normalizeAiProviderError(error, {
                provider: requestedMetadata.provider,
                modelAlias: input.modelAlias,
                modelId: requestedMetadata.modelId,
            });
            const errorTelemetry = getAiProviderErrorTelemetry(providerError);
            const failedRequestMetadata = buildResolvedAiRequestMetadata({
                alias: input.modelAlias,
                metadata: requestedMetadata,
                workspaceId: scope.workspaceId,
                routeName: input.route,
                operation: input.operation,
            });
            const failedMetadata = {
                ...input.metadata,
                authorization: {
                    kind: scope.authorizationKind,
                    systemSource: scope.systemSource ?? null,
                },
                prompt: renderedPrompt.metadata,
                ai: failedRequestMetadata,
                aiError: errorTelemetry,
            };

            await meterAndCharge({
                workspaceId: scope.workspaceId,
                profileId: scope.profileId,
                route: input.route,
                usage: {
                    unitType: "tokens",
                    model: requestedMetadata.modelId,
                    tokensIn: 0,
                    tokensOut: 0,
                },
                status: "failed",
                metadata: failedMetadata,
            });
            await completeAiExecutionAudit(auditRunId, {
                status: "failed",
                resolvedModelAlias: input.modelAlias,
                resolvedModelId: requestedMetadata.modelId,
                errorCode: providerError.code,
                errorMessage: `AI execution failed (${providerError.code}).`,
                runtimeMetadata: failedMetadata,
            });
            throw error;
        }
    });
}

export async function executeWorkspaceAiText(
    input: ExecuteWorkspaceAiTextInput,
): Promise<ExecuteWorkspaceAiTextResult> {
    return executeWorkspaceAiCall(input, async (prompt) => {
        const result = await generateTextWithFallback(input.modelAlias, {
            ...input.generation,
            system: prompt.system,
            prompt: prompt.prompt,
        });
        assertSafeGeneratedOutput(result.text);
        return result;
    });
}

export async function executeWorkspaceAiObject<T>(
    input: ExecuteWorkspaceAiObjectInput<T>,
): Promise<ExecuteWorkspaceAiObjectResult<T>> {
    return executeWorkspaceAiCall(input, async (prompt) => {
        const result = await generateObjectWithFallback(input.modelAlias, {
            ...input.generation,
            schema: input.schema,
            system: prompt.system,
            prompt: prompt.prompt,
        });
        assertSafeGeneratedOutput(result.object);
        return result;
    });
}

export async function executeWorkspaceAiEmbedding(
    input: ExecuteWorkspaceAiEmbeddingInput,
): Promise<ExecuteWorkspaceAiEmbeddingResult> {
    return executeWorkspaceAiCall(input, async () => {
        const metadata = getModelMetadata(input.modelAlias);
        const result = await embed({
            ...input.generation,
            model: getAiModel(input.modelAlias) as EmbeddingModel,
            value: input.value,
        });
        const runtimeFallback: AiRuntimeFallbackMetadata = {
            selectedAlias: input.modelAlias,
            selectedModelId: metadata.modelId,
            attempts: [{
                alias: input.modelAlias,
                modelId: metadata.modelId,
                transport: metadata.transport,
                failed: false,
            }],
        };

        return {
            value: result.value,
            embedding: result.embedding,
            embeddingTokenUsage: result.usage.tokens,
            usage: {
                inputTokens: result.usage.tokens,
                outputTokens: 0,
            },
            runtimeFallback,
        };
    });
}
