import { notFound } from "next/navigation";
import { requireAdminDashboardState } from "@/features/admin/lib/route-guard";
import { getLegalAgreement } from "@/features/legal-vault/actions/agreements";
import { AgreementDetail } from "@/features/legal-vault/ui/agreement-detail";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Agreement | Legal Vault",
};

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function AgreementDetailPage({ params }: PageProps) {
    await requireAdminDashboardState();
    const { id } = await params;
    const result = await getLegalAgreement(id);
    if (!result.success) {
        notFound();
    }

    return <AgreementDetail agreement={result.data} />;
}
