import {
    assertWorkspaceAdminOrManager,
    type WorkspaceContext,
    type WorkspaceSummary,
} from "@/shared/lib/workspace/context";

export interface LegalVaultAccess extends WorkspaceContext {
    activeWorkspace: WorkspaceSummary;
}

// Legal Vault is core compliance, not a Pro upsell — every workspace can keep
// agreements and bookkeeping. Access is therefore gated solely by role; the
// finer-grained legal.read / legal.write / legal.manage capabilities are
// enforced by Postgres RLS on every query.
export async function assertLegalVaultAccess(): Promise<LegalVaultAccess> {
    return assertWorkspaceAdminOrManager();
}
