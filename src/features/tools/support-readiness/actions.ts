"use server";

import { computeSupportReadiness, supportInputSchema, type SupportResult } from "./compute";
import { runWithToolGuardrails } from "../shared/action-wrapper";
import { saveToolLead } from "../shared/store";
import type { ToolActionResult } from "../shared/types";

export interface SupportActionResponse {
    result: SupportResult;
    leadId: string | null;
    shareToken: string | null;
}

export async function runSupportReadiness(input: unknown): Promise<ToolActionResult<SupportActionResponse>> {
    const parsed = supportInputSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    const data = parsed.data;

    const guarded = await runWithToolGuardrails({
        tool: "support-automation-readiness",
        guardrails: { website: data.website, formStartedAt: data.formStartedAt },
        sourcePath: "/tools/support-automation-readiness",
        compute: async (context) => {
            const result = computeSupportReadiness(data);
            const saved = await saveToolLead({
                tool: "support-automation-readiness",
                payload: data,
                result: result as unknown as Record<string, unknown>,
                context,
                shareable: true,
            });
            return { ok: true, data: { result, leadId: saved?.id ?? null, shareToken: saved?.shareToken ?? null } };
        },
    });

    return guarded as ToolActionResult<SupportActionResponse>;
}
