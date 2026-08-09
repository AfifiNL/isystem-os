import Link from "next/link";
import { requireAdminDashboardState } from "@/features/admin/lib/route-guard";
import { listLegalAgreements } from "@/features/legal-vault/actions/agreements";
import { AgreementList } from "@/features/legal-vault/ui/agreement-list";
import { Button } from "@/shared/ui/button";
import { DashboardAppWorkbench, AppCommandBar, AppTabList } from "@/features/admin/ui/app-workbench";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Agreements | Legal Vault",
};

export default async function AgreementsPage() {
    await requireAdminDashboardState();
    const result = await listLegalAgreements({ limit: 200 });

    const tabs = [
        { label: "Documents", value: "documents", href: "/dashboard/legal-vault" },
        { label: "Agreements", value: "agreements", href: "/dashboard/legal-vault/agreements", active: true },
        { label: "Bookkeeping", value: "bookkeeping", href: "/dashboard/legal-vault/bookkeeping" }
    ];

    return (
        <DashboardAppWorkbench>
            <AppCommandBar>
                <AppTabList tabs={tabs} />
                <Button size="xs" asChild className="cursor-pointer">
                    <Link href="/dashboard/legal-vault/agreements/new">
                        New Agreement
                    </Link>
                </Button>
            </AppCommandBar>
            <div className="flex-1 overflow-y-auto min-h-0">
                <AgreementList
                    initialAgreements={result.success ? result.data : []}
                    initialError={result.success ? null : result.error}
                />
            </div>
        </DashboardAppWorkbench>
    );
}
