import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertWorkspaceAiEnabled } from "@/shared/lib/workspace/context";
import {
    InsufficientAiBalanceError,
} from "@/shared/lib/ai/metering";
import { getAiProviderErrorTelemetry } from "@/shared/lib/ai/errors";
import {
    getModelMetadata,
    type AiModelAlias,
} from "@/shared/lib/ai/provider";
import {
    executeWorkspaceAiText,
    WorkspaceAiRateLimitError,
} from "@/shared/lib/ai/workspace-execution";
import { getBtwSummary } from "@/features/legal-vault/actions/bookkeeping";
import { formatEuro } from "@/features/legal-vault/lib/btw";
import { recordLegalAuditEvent } from "@/features/legal-vault/lib/audit";

export const maxDuration = 30;

const ROUTE_NAME = "legal/btw-summary";
const MODEL_ALIAS: AiModelAlias = "text.bulk";

const requestSchema = z.object({
    periodId: z.string().uuid(),
}).strict();

export async function POST(req: NextRequest) {
    let context: Awaited<ReturnType<typeof assertWorkspaceAiEnabled>>;
    try {
        context = await assertWorkspaceAiEnabled();
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unauthorized";
        return NextResponse.json(
            { error: message },
            { status: message === "AI generation is only available on Pro workspaces." ? 403 : 401 },
        );
    }

    const workspaceId = context.activeWorkspace.id;
    const profileId = context.userId;

    const body = await req.json().catch(() => null);
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }

    const summary = await getBtwSummary(parsed.data.periodId);
    if (!summary.success) {
        return NextResponse.json({ error: summary.error }, { status: 404 });
    }

    const { period, totals } = summary.data;
    const systemPrompt = `You are a Dutch ZZP accounting assistant. Produce a short BTW aangifte prep narrative for the operator.

Hard constraints:
- Output is read-only operator-facing prose, ~5-8 sentences. No legal advice;
  this is a working summary the operator will reconcile against Belastingdienst Mijn Belastingdienst Zakelijk.
- Highlight: net BTW to pay (or to reclaim), gross income, gross expense, anomalies (e.g. no income in quarter, unusually large single expense), and missing categorisation.
- Always end with a one-line "Action:" suggesting the next step (file aangifte, double-check a category, etc.).
- Currency is EUR; numbers are pre-formatted — quote them verbatim, do not recompute.`;

    let narrative = "";
    let aiExecutionMetadata: Record<string, unknown> | null = null;
    try {
        const result = await executeWorkspaceAiText({
            authorization: {
                kind: "active_workspace",
                expectedWorkspaceId: workspaceId,
                requiredCapability: "bookkeeping.read",
            },
            route: ROUTE_NAME,
            operation: "btw_summary",
            modelAlias: MODEL_ALIAS,
            rateLimit: { maxPerWindow: 10, windowSeconds: 60 },
            metadata: { periodId: parsed.data.periodId },
            prompt: {
                id: "legal.btw-summary",
                version: "2026-07-24.1",
                system: systemPrompt,
                task: "Write the requested BTW aangifte preparation narrative and finish with one Action line.",
                trustedContext: [
                    { label: "period_start", value: period.startsOn },
                    { label: "period_end", value: period.endsOn },
                    { label: "entry_count", value: totals.entry_count },
                    {
                        label: "income_excluding_btw",
                        value: formatEuro(totals.income_excl_btw_cents),
                    },
                    {
                        label: "income_btw_collected",
                        value: formatEuro(totals.income_btw_cents),
                    },
                    {
                        label: "expense_excluding_btw",
                        value: formatEuro(totals.expense_excl_btw_cents),
                    },
                    {
                        label: "expense_btw_paid",
                        value: formatEuro(totals.expense_btw_cents),
                    },
                    {
                        label: "net_btw_position",
                        value: formatEuro(totals.btw_to_pay_cents),
                    },
                ],
                untrustedContext: [],
            },
        });
        narrative = result.text;
        aiExecutionMetadata = result.workspaceAi as unknown as Record<string, unknown>;
    } catch (error: unknown) {
        const model = getModelMetadata(MODEL_ALIAS);
        await recordLegalAuditEvent({
            workspaceId,
            actorUserId: profileId,
            event: "ai_summary.failed",
            resourceType: "ai_summary",
            resourceId: parsed.data.periodId,
            metadata: {
                route: ROUTE_NAME,
                modelAlias: MODEL_ALIAS,
                error: getAiProviderErrorTelemetry(error, {
                    provider: model.provider,
                    modelAlias: MODEL_ALIAS,
                    modelId: model.modelId,
                }),
            },
        });

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
        if (error instanceof Error && error.message === "Forbidden: missing bookkeeping.read capability.") {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        return NextResponse.json({ error: "Summary generation failed." }, { status: 502 });
    }

    await recordLegalAuditEvent({
        workspaceId,
        actorUserId: profileId,
        event: "ai_summary.btw_succeeded",
        resourceType: "ai_summary",
        resourceId: parsed.data.periodId,
        metadata: {
            route: ROUTE_NAME,
            modelAlias: MODEL_ALIAS,
            entryCount: totals.entry_count,
            aiExecution: aiExecutionMetadata,
        },
    });

    return NextResponse.json({
        success: true,
        period,
        totals,
        narrative,
    });
}
