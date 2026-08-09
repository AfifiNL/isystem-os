"use server";

import { createClient } from "@/shared/lib/supabase/server";
import { assertLegalVaultAccess } from "@/features/legal-vault/lib/access";
import { recordLegalAuditEvent } from "@/features/legal-vault/lib/audit";
import { extractLegalSignals } from "@/features/legal-vault/lib/document-extraction";
import { evaluateWetDbaPreflight, type WetDbaPreflightInput } from "@/features/legal-vault/lib/wet-dba";
import type { ActionResult } from "@/features/legal-vault/types";

export async function saveManualDocumentText(input: {
    documentId: string;
    text: string;
    language?: string;
    pageCount?: number;
}): Promise<ActionResult<{ id: string; signalCount: number }>> {
    try {
        const { activeWorkspace, userId } = await assertLegalVaultAccess();
        const supabase = await createClient();
        const { data, error } = await supabase
            .from("legal_document_texts")
            .insert({
                workspace_id: activeWorkspace.id,
                document_id: input.documentId,
                extracted_text: input.text,
                language: input.language ?? "nl",
                page_count: input.pageCount ?? null,
                extraction_confidence: 100,
                extractor_version: "manual-v1",
                created_by: userId,
            })
            .select("id")
            .single();
        if (error || !data) return { success: false, error: error?.message ?? "Failed to save text." };

        const signals = extractLegalSignals(input.text);
        if (signals.length > 0) {
            await supabase.from("legal_risk_findings").insert(signals.map((signal) => ({
                workspace_id: activeWorkspace.id,
                document_id: input.documentId,
                category: signal.kind,
                severity: signal.kind === "dpa_breach" ? "medium" : "info",
                title: signal.title,
                description: `Detected possible ${signal.title.toLowerCase()} clause. Human review required before relying on this extraction.`,
                source_quote: signal.sourceQuote,
                review_state: "needs_review",
                metadata: { extractor: "rule_based_v1" },
            })));
        }

        await recordLegalAuditEvent({
            workspaceId: activeWorkspace.id,
            actorUserId: userId,
            event: "document.text_extracted",
            resourceType: "document",
            resourceId: input.documentId,
            metadata: { extractorVersion: "manual-v1", signalCount: signals.length },
        });
        return { success: true, data: { id: data.id as string, signalCount: signals.length } };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function runWetDbaPreflight(input: {
    agreementId?: string;
    answers: WetDbaPreflightInput;
}): Promise<ActionResult<ReturnType<typeof evaluateWetDbaPreflight>>> {
    try {
        const { activeWorkspace, userId } = await assertLegalVaultAccess();
        const supabase = await createClient();
        const result = evaluateWetDbaPreflight(input.answers);

        if (input.agreementId && result.findings.length > 0) {
            await supabase.from("legal_risk_findings").insert(result.findings.map((finding) => ({
                workspace_id: activeWorkspace.id,
                agreement_id: input.agreementId,
                category: "wet_dba",
                severity: finding.severity,
                title: `Wet DBA: ${finding.key}`,
                description: finding.message,
                review_state: "needs_review",
                metadata: { score: result.score, level: result.level, answers: input.answers },
            })));
        }

        await recordLegalAuditEvent({
            workspaceId: activeWorkspace.id,
            actorUserId: userId,
            event: "wet_dba.preflight_completed",
            resourceType: input.agreementId ? "agreement" : "system",
            resourceId: input.agreementId ?? null,
            metadata: { score: result.score, level: result.level, findings: result.findings.length },
        });
        return { success: true, data: result };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function createPrivacyIncident(input: {
    title: string;
    description: string;
    impactedDocumentIds?: string[];
}): Promise<ActionResult<{ id: string; reportDueAt: string }>> {
    try {
        const { activeWorkspace, userId } = await assertLegalVaultAccess();
        const supabase = await createClient();
        const reportDueAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
            .from("legal_privacy_incidents")
            .insert({
                workspace_id: activeWorkspace.id,
                title: input.title,
                description: input.description,
                report_due_at: reportDueAt,
                impacted_document_ids: input.impactedDocumentIds ?? [],
                created_by: userId,
            })
            .select("id")
            .single();
        if (error || !data) return { success: false, error: error?.message ?? "Failed to create privacy incident." };

        await recordLegalAuditEvent({
            workspaceId: activeWorkspace.id,
            actorUserId: userId,
            event: "privacy_incident.created",
            resourceType: "system",
            resourceId: data.id as string,
            metadata: { reportDueAt, impactedDocumentCount: input.impactedDocumentIds?.length ?? 0 },
        });
        return { success: true, data: { id: data.id as string, reportDueAt } };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error) };
    }
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Unexpected error.";
}
