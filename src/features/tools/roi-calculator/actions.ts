"use server";

import { computeRoi, roiInputSchema, type RoiResult } from "./compute";
import { runWithToolGuardrails } from "../shared/action-wrapper";
import { saveToolLead } from "../shared/store";
import type { ToolActionResult } from "../shared/types";

export interface RoiActionResponse {
    result: RoiResult;
    leadId: string | null;
    shareToken: string | null;
}

export async function runRoiCalculator(input: unknown): Promise<ToolActionResult<RoiActionResponse>> {
    const parsed = roiInputSchema.safeParse(input);
    if (!parsed.success) {
        return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }
    const data = parsed.data;

    const guarded = await runWithToolGuardrails({
        tool: "automation-roi-calculator",
        guardrails: { website: data.website, formStartedAt: data.formStartedAt },
        sourcePath: "/tools/automation-roi-calculator",
        compute: async (context) => {
            const result = computeRoi(data);
            const saved = await saveToolLead({
                tool: "automation-roi-calculator",
                payload: data,
                result: result as unknown as Record<string, unknown>,
                context,
                shareable: true,
            });
            return {
                ok: true,
                data: { result, leadId: saved?.id ?? null, shareToken: saved?.shareToken ?? null },
            };
        },
    });

    return guarded as ToolActionResult<RoiActionResponse>;
}
