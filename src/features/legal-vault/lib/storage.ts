import { createClient as createServerClient } from "@/shared/lib/supabase/server";

export const LEGAL_VAULT_BUCKET = "legal-vault";

// Storage RLS keys objects by `<workspace_id>/<…>`; we use a stable convention
// that also keeps related files clustered for easier inspection in the
// Supabase Storage UI.
export function buildVaultObjectPath(
    workspaceId: string,
    options: {
        kind: string;
        relatedId?: string | null;
        filename: string;
    },
): string {
    const safeKind = options.kind.replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeFile = options.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const folderId = options.relatedId ?? "loose";
    return `${workspaceId}/${safeKind}/${folderId}/${stamp}-${safeFile}`;
}

export async function createVaultSignedUrl(
    storagePath: string,
    expiresInSeconds: number = 60,
): Promise<string | null> {
    const supabase = await createServerClient();
    const { data, error } = await supabase.storage
        .from(LEGAL_VAULT_BUCKET)
        .createSignedUrl(storagePath, expiresInSeconds);

    if (error || !data?.signedUrl) {
        return null;
    }
    return data.signedUrl;
}
