import { notFound } from "next/navigation";
import {
    getAgreementByPublicToken,
    recordAgreementView,
} from "@/features/legal-vault/actions/signatures";
import { SignAgreement } from "@/features/legal-vault/ui/sign-agreement";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Sign agreement",
    robots: { index: false, follow: false },
};

interface PageProps {
    params: Promise<{ token: string }>;
}

export default async function SignPage({ params }: PageProps) {
    const { token } = await params;
    const result = await getAgreementByPublicToken(token);
    if (!result.success) {
        notFound();
    }

    // Best-effort view tracking; ignore errors so the page still renders.
    await recordAgreementView(token).catch(() => undefined);

    return <SignAgreement agreement={result.data} token={token} />;
}
