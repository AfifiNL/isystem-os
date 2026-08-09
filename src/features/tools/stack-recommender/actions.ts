"use server";

import { recommendStack, stackInputSchema, type StackRecommendation } from "./catalog";
import { runWithToolGuardrails } from "../shared/action-wrapper";
import { saveToolLead } from "../shared/store";
import type { ToolActionResult } from "../shared/types";

export interface StackActionResponse {
    result: StackRecommendation;
    leadId: string | null;
    shareToken: string | null;
}

export async function runStackRecommender(input: unknown): Promise<ToolActionResult<StackActionResponse>> {
    const parsed = stackInputSchema.safeParse(input);
    if (!parsed.success) {
        return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }
    const data = parsed.data;

    const guarded = await runWithToolGuardrails({
        tool: "ai-stack-recommender",
        guardrails: { website: data.website, formStartedAt: data.formStartedAt },
        sourcePath: "/tools/ai-stack-recommender",
        compute: async (context) => {
            const result = recommendStack(data);
            const saved = await saveToolLead({
                tool: "ai-stack-recommender",
                payload: data,
                result: result as unknown as Record<string, unknown>,
                context,
                shareable: true,
            });
            return { ok: true, data: { result, leadId: saved?.id ?? null, shareToken: saved?.shareToken ?? null } };
        },
    });

    return guarded as ToolActionResult<StackActionResponse>;
}
