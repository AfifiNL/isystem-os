import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertWorkspaceAiEnabled } from "@/shared/lib/workspace/context";
import { InsufficientAiBalanceError } from "@/shared/lib/ai/metering";
import { getAiProviderErrorTelemetry } from "@/shared/lib/ai/errors";
import { getModelMetadata, type AiModelAlias } from "@/shared/lib/ai/provider";
import {
    executeWorkspaceAiObject,
    WorkspaceAiRateLimitError,
} from "@/shared/lib/ai/workspace-execution";
import { listLegalTemplates } from "@/features/legal-vault/actions/templates";
import { createLegalAgreement } from "@/features/legal-vault/actions/agreements";
import { recordLegalAuditEvent } from "@/features/legal-vault/lib/audit";

export const maxDuration = 60;

const ROUTE_NAME = "legal/generate-agreement";
const MODEL_ALIAS: AiModelAlias = "text.legal";

const requestSchema = z.object({
    templateSlug: z.string().trim().min(2).max(80),
    intent: z.string().trim().min(10).max(2000),
    partyName: z.string().trim().min(2).max(160),
    partyEmail: z.string().email(),
    clientId: z.string().uuid().nullable().optional(),
    bookingId: z.string().uuid().nullable().optional(),
    effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    knownContext: z.record(
        z.string().min(1).max(80),
        z.union([z.string().max(2_000), z.number().finite()]),
    ).refine((value) => Object.keys(value).length <= 50, {
        message: "knownContext supports at most 50 fields.",
    }).optional(),
}).strict();

// AI returns suggested values for the template variables. We keep the schema
// permissive (string|number) because templates vary; the create action
// re-validates required vs optional against the template manifest.
const suggestionSchema = z.object({
    variables: z.record(z.string(), z.union([z.string(), z.number()])),
    rationale: z.string().max(2000),
});

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
        return NextResponse.json(
            { error: parsed.error.issues[0]?.message ?? "Invalid input." },
            { status: 400 },
        );
    }

    const templates = await listLegalTemplates();
    if (!templates.success) {
        return NextResponse.json({ error: templates.error }, { status: 500 });
    }
    const template = templates.data.find((t) => t.slug === parsed.data.templateSlug);
    if (!template) {
        return NextResponse.json({ error: "Unknown template slug." }, { status: 404 });
    }

    const variablesSpec = template.variables
        .map((v) => `- ${v.key} (${v.type}${v.required ? ", required" : ", optional"}): ${v.label}${v.description ? ` — ${v.description}` : ""}`)
        .join("\n");

    const systemPrompt = `You are a Dutch ZZP legal-drafting assistant.

Hard constraints:
- Output is interpolated into an operator-approved template; do NOT
  generate clauses, only fill values for the variables defined below.
- For any service-agreement (DVO) template, every clause must avoid Wet DBA
  "schijnzelfstandigheid" markers: no gezagsverhouding, no opgelegde
  werktijden, no exclusivity, and explicit vrije vervanging where applicable.
- Money values: integer or decimal strings, no currency symbol (e.g. "85.00",
  not "€ 85,00"). Dates: ISO 8601 (YYYY-MM-DD). Booleans: not allowed — use a
  short string explanation.
- If you cannot determine a required variable from the intent, return a
  conservative, legally defensible placeholder and call it out in rationale.
- Never invent legal entities, KvK numbers, BTW IDs, IBANs, or addresses.
  Echo the values from knownContext when supplied; otherwise leave a clearly
  marked "TBD — operator to confirm" string.`;

    let generated: z.infer<typeof suggestionSchema>;
    let usage: { inputTokens: number; outputTokens: number } | null = null;
    let aiExecutionMetadata: Record<string, unknown> | null = null;
    try {
        const result = await executeWorkspaceAiObject({
            authorization: {
                kind: "active_workspace",
                expectedWorkspaceId: workspaceId,
                requiredCapability: "legal.write",
            },
            route: ROUTE_NAME,
            operation: "legal_agreement_variables",
            modelAlias: MODEL_ALIAS,
            rateLimit: { maxPerWindow: 20, windowSeconds: 60 },
            schema: suggestionSchema,
            metadata: { templateSlug: parsed.data.templateSlug },
            prompt: {
                id: "legal.generate-agreement-variables",
                version: "2026-07-24.1",
                system: systemPrompt,
                task: "Fill every listed template variable from the supplied intent and known context. Return only schema-compliant variables and a concise rationale.",
                trustedContext: [],
                untrustedContext: [
                    { label: "template_name", value: template.name, maxLength: 500 },
                    { label: "template_category", value: template.category, maxLength: 200 },
                    { label: "jurisdiction", value: template.jurisdiction, maxLength: 200 },
                    { label: "template_locale", value: template.locale, maxLength: 50 },
                    {
                        label: "variables_specification",
                        value: variablesSpec,
                        maxLength: 12_000,
                    },
                    {
                        label: "operator_intent",
                        value: parsed.data.intent,
                        maxLength: 2_000,
                    },
                    {
                        label: "counterparty_name",
                        value: parsed.data.partyName,
                        maxLength: 160,
                    },
                    {
                        label: "counterparty_email",
                        value: parsed.data.partyEmail,
                        maxLength: 320,
                    },
                    {
                        label: "known_context",
                        value: parsed.data.knownContext ?? {},
                        maxLength: 12_000,
                    },
                    {
                        label: "effective_date",
                        value: parsed.data.effectiveDate ?? "use today",
                        maxLength: 40,
                    },
                ],
            },
        });
        generated = result.object;
        usage = {
            inputTokens: result.usage?.inputTokens ?? 0,
            outputTokens: result.usage?.outputTokens ?? 0,
        };
        aiExecutionMetadata = result.workspaceAi as unknown as Record<string, unknown>;
    } catch (error: unknown) {
        const model = getModelMetadata(MODEL_ALIAS);
        await recordLegalAuditEvent({
            workspaceId,
            actorUserId: profileId,
            event: "ai_generation.failed",
            resourceType: "ai_generation",
            metadata: {
                route: ROUTE_NAME,
                modelAlias: MODEL_ALIAS,
                templateSlug: parsed.data.templateSlug,
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
        if (error instanceof Error && error.message === "Forbidden: missing legal.write capability.") {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        return NextResponse.json(
            { error: "Generation failed. Try simplifying the intent." },
            { status: 502 },
        );
    }

    // Merge AI suggestions with operator-provided knownContext (operator wins).
    const mergedVariables = { ...generated.variables, ...(parsed.data.knownContext ?? {}) };
    if (parsed.data.effectiveDate && !mergedVariables.effective_date) {
        mergedVariables.effective_date = parsed.data.effectiveDate;
    }

    const createResult = await createLegalAgreement({
        templateId: template.id,
        clientId: parsed.data.clientId ?? null,
        bookingId: parsed.data.bookingId ?? null,
        partyName: parsed.data.partyName,
        partyEmail: parsed.data.partyEmail,
        effectiveDate: parsed.data.effectiveDate,
        variables: mergedVariables,
    });

    if (!createResult.success) {
        await recordLegalAuditEvent({
            workspaceId,
            actorUserId: profileId,
            event: "ai_generation.agreement_create_failed",
            resourceType: "ai_generation",
            metadata: {
                route: ROUTE_NAME,
                modelAlias: MODEL_ALIAS,
                templateSlug: parsed.data.templateSlug,
                error: createResult.error,
                aiExecution: aiExecutionMetadata,
            },
        });
        return NextResponse.json({ error: createResult.error, suggestion: generated }, { status: 422 });
    }

    await recordLegalAuditEvent({
        workspaceId,
        actorUserId: profileId,
        event: "ai_generation.agreement_succeeded",
        resourceType: "agreement",
        resourceId: createResult.data.id,
        metadata: {
            route: ROUTE_NAME,
            modelAlias: MODEL_ALIAS,
            templateSlug: parsed.data.templateSlug,
            tokensIn: usage?.inputTokens ?? 0,
            tokensOut: usage?.outputTokens ?? 0,
            aiExecution: aiExecutionMetadata,
        },
    });

    return NextResponse.json({
        success: true,
        agreement: createResult.data,
        rationale: generated.rationale,
    });
}
