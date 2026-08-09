import { requireAdminDashboardState } from "@/features/admin/lib/route-guard";
import {
    listAccountingEntries,
    listBtwQuarters,
} from "@/features/legal-vault/actions/bookkeeping";
import { BookkeepingLedger } from "@/features/legal-vault/ui/bookkeeping-ledger";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Bookkeeping | Legal Vault",
};

export default async function BookkeepingPage() {
    await requireAdminDashboardState();
    const [entries, quarters] = await Promise.all([
        listAccountingEntries({ limit: 500 }),
        listBtwQuarters(),
    ]);

    return (
        <BookkeepingLedger
            initialEntries={entries.success ? entries.data : []}
            initialError={entries.success ? null : entries.error}
            quarters={quarters.success ? quarters.data : []}
        />
    );
}
