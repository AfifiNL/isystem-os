"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { assertLegalVaultAccess } from "@/features/legal-vault/lib/access";
import { sha256Hex } from "@/features/legal-vault/lib/hashing";
import {
    LEGAL_VAULT_BUCKET,
    buildVaultObjectPath,
    createVaultSignedUrl,
} from "@/features/legal-vault/lib/storage";
import { defaultRetentionUntil } from "@/features/legal-vault/lib/retention";
import { recordLegalAuditEvent } from "@/features/legal-vault/lib/audit";
import {
    legalDocumentSoftDeleteSchema,
    legalDocumentUploadSchema,
} from "@/features/legal-vault/schema";
import type {
    ActionResult,
    LegalDocument,
    LegalDocumentKind,
} from "@/features/legal-vault/types";

interface ListDocumentsOptions {
    kind?: LegalDocumentKind;
    includeDeleted?: boolean;
    limit?: number;
}

export async function listLegalDocuments(
    options: ListDocumentsOptions = {},
): Promise<ActionResult<LegalDocument[]>> {
    try {
        const { activeWorkspace, userId } = await assertLegalVaultAccess();
        const supabase = await createClient();

        let query = supabase
            .from("legal_documents")
            .select("*")
            .eq("workspace_id", activeWorkspace.id)
            .order("created_at", { ascending: false })
            .limit(options.limit ?? 100);

        if (!options.includeDeleted) {
            query = query.is("deleted_at", null);
        }

        if (options.kind) {
            query = query.eq("kind", options.kind);
        }

        const { data, error } = await query;
        if (error) {
            return { success: false, error: error.message };
        }

        await recordLegalAuditEvent({
            workspaceId: activeWorkspace.id,
            actorUserId: userId,
            event: "documents.list",
            resourceType: "document",
            metadata: {
                kind: options.kind ?? null,
                includeDeleted: options.includeDeleted ?? false,
                limit: options.limit ?? 100,
                count: data?.length ?? 0,
            },
        });

        return { success: true, data: (data ?? []).map(mapDocumentRow) };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function uploadLegalDocument(
    formData: FormData,
): Promise<ActionResult<LegalDocument>> {
    try {
        const { activeWorkspace, userId } = await assertLegalVaultAccess();

        const file = formData.get("file");
        if (!(file instanceof File)) {
            return { success: false, error: "Missing file." };
        }
        if (file.size === 0) {
            return { success: false, error: "Empty file." };
        }

        const parsed = legalDocumentUploadSchema.safeParse({
            title: formData.get("title"),
            kind: formData.get("kind"),
            clientId: nullableField(formData.get("clientId")),
            relatedAgreementId: nullableField(formData.get("relatedAgreementId")),
            relatedEntryId: nullableField(formData.get("relatedEntryId")),
            notes: optionalField(formData.get("notes")),
        });
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
        }

        const supabase = await createClient();
        const buffer = Buffer.from(await file.arrayBuffer());
        const sha256 = sha256Hex(buffer);
        const storagePath = buildVaultObjectPath(activeWorkspace.id, {
            kind: parsed.data.kind,
            relatedId: parsed.data.relatedAgreementId ?? parsed.data.relatedEntryId ?? null,
            filename: file.name,
        });

        const upload = await supabase.storage
            .from(LEGAL_VAULT_BUCKET)
            .upload(storagePath, buffer, {
                contentType: file.type || "application/octet-stream",
                upsert: false,
            });
        if (upload.error) {
            return { success: false, error: upload.error.message };
        }

        const { data: row, error: insertError } = await supabase
            .from("legal_documents")
            .insert({
                workspace_id: activeWorkspace.id,
                kind: parsed.data.kind,
                title: parsed.data.title,
                storage_bucket: LEGAL_VAULT_BUCKET,
                storage_path: storagePath,
                sha256,
                size_bytes: buffer.byteLength,
                mime: file.type || "application/octet-stream",
                client_id: parsed.data.clientId ?? null,
                related_agreement_id: parsed.data.relatedAgreementId ?? null,
                related_entry_id: parsed.data.relatedEntryId ?? null,
                retention_until: defaultRetentionUntil(),
                metadata: parsed.data.notes ? { notes: parsed.data.notes } : {},
                created_by: userId,
            })
            .select("*")
            .single();

        if (insertError || !row) {
            // Roll back the orphaned storage object.
            await supabase.storage.from(LEGAL_VAULT_BUCKET).remove([storagePath]);
            return { success: false, error: insertError?.message ?? "Failed to record document." };
        }

        revalidatePath("/dashboard/legal-vault");
        await recordLegalAuditEvent({
            workspaceId: activeWorkspace.id,
            actorUserId: userId,
            event: "document.uploaded",
            resourceType: "document",
            resourceId: row.id,
            metadata: {
                kind: parsed.data.kind,
                sizeBytes: buffer.byteLength,
                mime: file.type || "application/octet-stream",
                sha256,
            },
        });
        return { success: true, data: mapDocumentRow(row) };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function softDeleteLegalDocument(
    input: { documentId: string },
): Promise<ActionResult<{ id: string }>> {
    try {
        const parsed = legalDocumentSoftDeleteSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: "Invalid documentId." };
        }
        const { activeWorkspace, userId } = await assertLegalVaultAccess();
        const supabase = await createClient();

        const { error } = await supabase
            .from("legal_documents")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", parsed.data.documentId)
            .eq("workspace_id", activeWorkspace.id);

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath("/dashboard/legal-vault");
        await recordLegalAuditEvent({
            workspaceId: activeWorkspace.id,
            actorUserId: userId,
            event: "document.soft_deleted",
            resourceType: "document",
            resourceId: parsed.data.documentId,
        });
        return { success: true, data: { id: parsed.data.documentId } };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function getLegalDocumentSignedUrl(
    documentId: string,
): Promise<ActionResult<{ url: string; expiresInSeconds: number }>> {
    try {
        const { activeWorkspace, userId } = await assertLegalVaultAccess();
        const supabase = await createClient();

        const { data: row, error } = await supabase
            .from("legal_documents")
            .select("storage_path")
            .eq("id", documentId)
            .eq("workspace_id", activeWorkspace.id)
            .maybeSingle();

        if (error || !row) {
            return { success: false, error: error?.message ?? "Document not found." };
        }

        const url = await createVaultSignedUrl(row.storage_path, 60);
        if (!url) {
            return { success: false, error: "Could not mint signed URL." };
        }
        await recordLegalAuditEvent({
            workspaceId: activeWorkspace.id,
            actorUserId: userId,
            event: "document.signed_url_minted",
            resourceType: "document",
            resourceId: documentId,
            metadata: { expiresInSeconds: 60 },
        });
        return { success: true, data: { url, expiresInSeconds: 60 } };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function restoreLegalDocument(
    input: { documentId: string },
): Promise<ActionResult<{ id: string }>> {
    try {
        const parsed = legalDocumentSoftDeleteSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: "Invalid documentId." };
        }
        const { activeWorkspace, userId } = await assertLegalVaultAccess();
        const supabase = await createClient();

        const { error } = await supabase
            .from("legal_documents")
            .update({
                deleted_at: null,
                restored_at: new Date().toISOString(),
                restored_by: userId,
            })
            .eq("id", parsed.data.documentId)
            .eq("workspace_id", activeWorkspace.id);

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath("/dashboard/legal-vault");
        await recordLegalAuditEvent({
            workspaceId: activeWorkspace.id,
            actorUserId: userId,
            event: "document.restored",
            resourceType: "document",
            resourceId: parsed.data.documentId,
        });
        return { success: true, data: { id: parsed.data.documentId } };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function verifyLegalDocumentSha256(
    documentId: string,
): Promise<ActionResult<{ id: string; expectedSha256: string; actualSha256: string; verified: boolean }>> {
    try {
        const { activeWorkspace, userId } = await assertLegalVaultAccess();
        const supabase = await createClient();

        const { data: row, error } = await supabase
            .from("legal_documents")
            .select("id, storage_path, sha256")
            .eq("id", documentId)
            .eq("workspace_id", activeWorkspace.id)
            .maybeSingle();

        if (error || !row) {
            return { success: false, error: error?.message ?? "Document not found." };
        }

        const download = await supabase.storage.from(LEGAL_VAULT_BUCKET).download(row.storage_path);
        if (download.error || !download.data) {
            return { success: false, error: download.error?.message ?? "Could not download document." };
        }

        const actualSha256 = sha256Hex(Buffer.from(await download.data.arrayBuffer()));
        const verified = actualSha256 === row.sha256;

        if (verified) {
            await supabase
                .from("legal_documents")
                .update({ verified_sha256_at: new Date().toISOString() })
                .eq("id", documentId)
                .eq("workspace_id", activeWorkspace.id);
        }

        await recordLegalAuditEvent({
            workspaceId: activeWorkspace.id,
            actorUserId: userId,
            event: verified ? "document.sha256_verified" : "document.sha256_mismatch",
            resourceType: "document",
            resourceId: documentId,
            metadata: { expectedSha256: row.sha256, actualSha256 },
        });

        return {
            success: true,
            data: { id: documentId, expectedSha256: row.sha256, actualSha256, verified },
        };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error) };
    }
}

// ---------------------------------------------------------------------------
// Row mapping & helpers
// ---------------------------------------------------------------------------

interface DbDocumentRow {
    id: string;
    workspace_id: string;
    kind: LegalDocumentKind;
    title: string;
    storage_bucket: string;
    storage_path: string;
    sha256: string;
    size_bytes: number;
    mime: string;
    client_id: string | null;
    related_agreement_id: string | null;
    related_entry_id: string | null;
    retention_until: string;
    metadata: Record<string, unknown> | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
}

function mapDocumentRow(row: DbDocumentRow): LegalDocument {
    return {
        id: row.id,
        workspaceId: row.workspace_id,
        kind: row.kind,
        title: row.title,
        storageBucket: row.storage_bucket,
        storagePath: row.storage_path,
        sha256: row.sha256,
        sizeBytes: Number(row.size_bytes),
        mime: row.mime,
        clientId: row.client_id,
        relatedAgreementId: row.related_agreement_id,
        relatedEntryId: row.related_entry_id,
        retentionUntil: row.retention_until,
        metadata: row.metadata ?? {},
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at,
    };
}

function nullableField(value: FormDataEntryValue | null): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function optionalField(value: FormDataEntryValue | null): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return "Unexpected error.";
}
