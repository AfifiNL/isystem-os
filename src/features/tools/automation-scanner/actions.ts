"use server";

import { automationScannerInputSchema } from "./schema";
import { scoreAutomationScanner, type AutomationScannerResult } from "./scoring";
import { runWithToolGuardrails } from "../shared/action-wrapper";
import { saveToolLead } from "../shared/store";
import type { ToolActionResult } from "../shared/types";

export interface ScannerActionResponse {
    result: AutomationScannerResult;
    leadId: string | null;
    shareToken: string | null;
}

export async function runAutomationScanner(input: unknown): Promise<ToolActionResult<ScannerActionResponse>> {
    const parsed = automationScannerInputSchema.safeParse(input);
    if (!parsed.success) {
        return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }
    const data = parsed.data;

    const guarded = await runWithToolGuardrails({
        tool: "automation-scanner",
        guardrails: { website: data.website, formStartedAt: data.formStartedAt },
        contentSummary: data.biggestPainPoint,
        sourcePath: "/tools/automation-scanner",
        compute: async (context) => {
            const result = scoreAutomationScanner(data);
            const saved = await saveToolLead({
                tool: "automation-scanner",
                payload: data,
                result: result as unknown as Record<string, unknown>,
                context,
                shareable: true,
            });
            return {
                ok: true,
                data: {
                    result,
                    leadId: saved?.id ?? null,
                    shareToken: saved?.shareToken ?? null,
                },
            };
        },
    });

    return guarded as ToolActionResult<ScannerActionResponse>;
}
