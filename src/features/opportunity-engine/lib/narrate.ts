import type { OpportunitySignal } from "../types";
import type { SignalEnrichment } from "./enrich";
import { HUMAN_VOICE_RULES, humanize } from "@/shared/lib/ai/human-voice";
import { getAiProviderErrorTelemetry } from "@/shared/lib/ai/errors";
import { getModelMetadata, type AiModelAlias } from "@/shared/lib/ai/provider";
import { executeWorkspaceAiText } from "@/shared/lib/ai/workspace-execution";

const GENERATION_MODEL_ALIAS: AiModelAlias = "text.writer";
const MAX_PARALLEL = 4;

interface NarrationInput {
    signal: OpportunitySignal;
    workspaceId: string;
    workspaceName: string;
    locale: string;
    enrichment?: SignalEnrichment | null;
}

interface NarrationResult {
    signalKey: string;
    recommendationMarkdown: string | null;
    error: string | null;
}

async function narrateOne(input: NarrationInput): Promise<NarrationResult> {
    try {
        const { text } = await executeWorkspaceAiText({
            authorization: {
                kind: "active_workspace",
                expectedWorkspaceId: input.workspaceId,
            },
            route: "opportunity-engine/narrate",
            operation: input.signal.category,
            modelAlias: GENERATION_MODEL_ALIAS,
            rateLimit: { maxPerWindow: 60, windowSeconds: 60 },
            metadata: {
                signalKey: input.signal.signalKey,
                category: input.signal.category,
            },
            prompt: {
                id: "opportunity.narrate-signal",
                version: "2026-07-24.1",
                system: [
                    "You are an operating-insight advisor. A deterministic detector surfaced an opportunity.",
                    "Do not restate raw numbers as a bulleted list. Write a short, specific recommendation the operator can act on this week.",
                    "Format Markdown with exactly three headings: `### Why this matters`, `### Recommended next action`, and `### Expected impact`.",
                    "Why this matters is one tight 2–3 sentence paragraph. Recommended next action is one concrete step naming the exact page, content item, CTA, or internal link. Expected impact is one sentence in business language.",
                    "Do not invent numbers absent from signal_data. Do not add disclaimers.",
                    HUMAN_VOICE_RULES,
                ].join("\n\n"),
                task: "Turn the detector signal into the three-section operator recommendation.",
                trustedContext: [
                    { label: "output_locale", value: input.locale },
                ],
                untrustedContext: [
                    { label: "workspace_name", value: input.workspaceName, maxLength: 500 },
                    { label: "category", value: input.signal.category },
                    { label: "severity", value: input.signal.severity },
                    { label: "title", value: input.signal.title, maxLength: 1_000 },
                    { label: "detected_summary", value: input.signal.summary, maxLength: 4_000 },
                    { label: "signal_data", value: input.signal.signalData, maxLength: 12_000 },
                    {
                        label: "external_research",
                        value: input.enrichment?.externalContext ?? "(none)",
                        maxLength: 12_000,
                    },
                ],
            },
        });
        const cleaned = humanize(text);
        return {
            signalKey: input.signal.signalKey,
            recommendationMarkdown: cleaned || null,
            error: null,
        };
    } catch (error) {
        const model = getModelMetadata(GENERATION_MODEL_ALIAS);
        const telemetry = getAiProviderErrorTelemetry(error, {
            provider: model.provider,
            modelAlias: GENERATION_MODEL_ALIAS,
            modelId: model.modelId,
        });
        return {
            signalKey: input.signal.signalKey,
            recommendationMarkdown: null,
            error: `AI narration failed (${telemetry.code}).`,
        };
    }
}

/**
 * Narrates opportunity signals in bounded parallel batches so a large scan
 * never fans out uncontrolled LLM calls. Accepts an optional enrichments map
 * produced by enrichSignalsWithExternalContext() to inject live Tavily context
 * into the recommendation prompt for high-priority signals.
 */
export async function narrateSignals(
    signals: OpportunitySignal[],
    context: { workspaceId: string; workspaceName: string; locale: string },
    enrichments?: Map<string, SignalEnrichment>,
): Promise<Map<string, NarrationResult>> {
    const results = new Map<string, NarrationResult>();

    for (let offset = 0; offset < signals.length; offset += MAX_PARALLEL) {
        const batch = signals.slice(offset, offset + MAX_PARALLEL);
        const batchResults = await Promise.all(
            batch.map((signal) =>
                narrateOne(
                    {
                        signal,
                        workspaceId: context.workspaceId,
                        workspaceName: context.workspaceName,
                        locale: context.locale,
                        enrichment: enrichments?.get(signal.signalKey) ?? null,
                    },
                ),
            ),
        );
        for (const result of batchResults) {
            results.set(result.signalKey, result);
        }
    }

    return results;
}
