import { requireAdminDashboardState } from "@/features/admin/lib/route-guard";
import { listLegalDocuments } from "@/features/legal-vault/actions/documents";
import { listLegalAgreements } from "@/features/legal-vault/actions/agreements";
import { listAccountingEntries } from "@/features/legal-vault/actions/bookkeeping";
import { LegalVaultOverview } from "@/features/legal-vault/ui/legal-vault-overview";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Legal Vault",
};

export default async function LegalVaultPage() {
    const state = await requireAdminDashboardState();
    const [result, agreements, entries] = await Promise.all([
        listLegalDocuments({ includeDeleted: true, limit: 100 }),
        listLegalAgreements({ limit: 100 }),
        listAccountingEntries({ limit: 500 }),
    ]);

    return (
        <LegalVaultOverview
            initialDocuments={result.success ? result.data : []}
            initialAgreements={agreements.success ? agreements.data : []}
            initialEntries={entries.success ? entries.data : []}
            initialError={result.success ? null : result.error}
            workspaceId={state.workspace.id}
            workspaceName={state.workspace.name}
        />
    );
}
