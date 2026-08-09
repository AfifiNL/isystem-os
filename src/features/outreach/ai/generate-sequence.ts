import { z } from "zod";
import { normalizeAiProviderError } from "@/shared/lib/ai/errors";
import {
    getModelMetadata,
    runWithWorkspaceAiConfig,
    buildResolvedAiRequestMetadata,
    type AiModelAlias,
} from "@/shared/lib/ai/provider";
import { generateObjectWithFallback } from "@/shared/lib/ai/runtime-fallback";
import {
    assertSufficientAiBalance,
    checkAiRateLimitPg,
    meterAndCharge,
} from "@/shared/lib/ai/metering";
import type { OutreachContactRow } from "../types";

const OUTREACH_MODEL_ALIAS: AiModelAlias = "text.writer";

export const outreachSequenceSchema = z.object({
    steps: z.array(z.object({
        position: z.number().describe("The step position index, starting at 1"),
        delayDays: z.number().describe("The number of delay days since the previous step. 0 for the first touch."),
        objective: z.string().describe("The strategic objective of this email step"),
        subject: z.string().describe("The subject line for the email"),
        bodyText: z.string().describe("The plain text body copy of the email"),
        tone: z.string().describe("A brief description of the tone (e.g., direct, consultative, technical)"),
        complianceFlags: z.array(z.string()).describe("Compliance warnings or concerns (e.g. GDPR contact warnings, lack of opt-out mentions)"),
    })).describe("A sequence of outreach email touchpoints"),
});

export type GeneratedSequence = z.infer<typeof outreachSequenceSchema>;

interface StrategyAccount {
    id: string;
    campaign_id: string;
    name: string;
    domain: string | null;
    website_url: string | null;
    fit_score: number;
    fit_summary: string | null;
    why_now_trigger: string | null;
}

interface StrategyCampaign {
    id: string;
    name?: string;
    brief: string;
    icp_description: string;
}

interface KnowledgeDoc {
    canonical_url: string;
    title: string;
    excerpt: string | null;
}

export async function generateOutreachSequenceWithGemini(params: {
    workspaceId: string;
    userId: string;
    senderName: string;
    account: StrategyAccount;
    campaign: StrategyCampaign;
    docs: KnowledgeDoc[];
    contacts: OutreachContactRow[];
}): Promise<{ data: GeneratedSequence | null; error: string | null }> {
    const { workspaceId, userId, senderName, account, campaign, docs, contacts } = params;
    const routeName = "outreach:generate_sequence";

    try {
        return await runWithWorkspaceAiConfig(workspaceId, async () => {
            const modelMetadata = getModelMetadata(OUTREACH_MODEL_ALIAS);

            // Balance check
            await assertSufficientAiBalance(workspaceId);

            // Rate limit check
            const limit = await checkAiRateLimitPg(workspaceId, routeName, { maxPerWindow: 20 });
            if (!limit.allowed) {
                return { data: null, error: `Rate limit exceeded. Retry in ${limit.retryAfterSeconds}s.` };
            }

            const systemPrompt = `You are a professional outreach copywriter.
Generate a highly personalized 3-step email sequence for the prospect.
Keep the emails extremely short, direct, value-focused, and evidence-based.
Do not use generic sales jargon. Speak like a senior peer offering real help.

Guidelines:
- Step 1: Delay = 0 days. Strategic opening showing context and value.
- Step 2: Delay = 3 to 5 days. Concrete operational benefit or workflow case study.
- Step 3: Delay = 5 to 8 days. Politely close the loop or ask for a brief intro call.
- Write on behalf of the configured sender, ${senderName}, and sign every message with exactly that sender name.
- Reference the knowledge documents provided where appropriate to ground your claims.
- Identify any potential GDPR/compliance risks (e.g. direct cold emailing without lawful basis confirmation) and label them in complianceFlags.`;

            const userPrompt = `
Campaign Brief: ${campaign.brief}
ICP Target Description: ${campaign.icp_description}

Prospect Account: ${account.name}
Domain: ${account.domain ?? "N/A"}
Fit Summary: ${account.fit_summary ?? "N/A"}
Trigger Event (Why Now): ${account.why_now_trigger ?? "N/A"}
Fit Score: ${account.fit_score}

Primary Contact Details:
${contacts.map(c => `- ${c.full_name ?? "Unknown"} (${c.email ?? "no email"}, role: ${c.contact_type ?? "unknown"})`).join("\n")}

Knowledge Reference Documents:
${docs.map((doc, idx) => `Doc [${idx + 1}]: ${doc.title}\nURL: ${doc.canonical_url}\nExcerpt: ${doc.excerpt ?? "N/A"}`).join("\n\n")}
`;

            const generationResult = await generateObjectWithFallback(OUTREACH_MODEL_ALIAS, {
                schema: outreachSequenceSchema,
                prompt: userPrompt,
                system: systemPrompt,
            });

            const runtimeModelId = generationResult.runtimeFallback.selectedModelId;
            const successfulAttempt = generationResult.runtimeFallback.attempts.find((attempt) => !attempt.failed);
            const runtimeRequestMetadata = buildResolvedAiRequestMetadata({
                alias: generationResult.runtimeFallback.selectedAlias,
                metadata: {
                    ...modelMetadata,
                    modelId: runtimeModelId,
                    transport: successfulAttempt?.transport ?? modelMetadata.transport,
                },
                workspaceId,
                routeName,
                operation: "generate_sequence",
            });

            // Charge balance
            await meterAndCharge({
                workspaceId,
                profileId: userId,
                route: routeName,
                usage: {
                    unitType: "tokens",
                    model: runtimeModelId,
                    tokensIn: generationResult.usage.inputTokens ?? 0,
                    tokensOut: generationResult.usage.outputTokens ?? 0,
                },
                metadata: { ai: runtimeRequestMetadata, runtimeFallback: generationResult.runtimeFallback },
            });

            return { data: generationResult.object, error: null };
        });
    } catch (err) {
        const modelMetadata = getModelMetadata(OUTREACH_MODEL_ALIAS);
        const providerError = normalizeAiProviderError(err, {
            provider: modelMetadata.provider,
            modelAlias: OUTREACH_MODEL_ALIAS,
            modelId: modelMetadata.modelId,
        });
        console.error(`[outreach-ai] Sequence generation failed: ${providerError.message}`, providerError.toJSON());
        return { data: null, error: providerError.message };
    }
}
