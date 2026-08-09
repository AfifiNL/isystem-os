import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileSignature } from "lucide-react";
import { createClient } from "@/shared/lib/supabase/server";
import { getPartnerPortalAccess } from "@/features/portal/actions/portal-access";

export const metadata = {
    title: "Legal | Portal",
    description: "Read-only portal legal agreement list.",
};

type AgreementRow = {
    id: string;
    title: string;
    status: string;
    party_name: string;
    party_email: string;
    effective_date: string | null;
    expires_at: string | null;
    signed_at: string | null;
    created_at: string;
};

function formatDate(value: string | null) {
    if (!value) return "Not set";
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export default async function PortalLegalPage() {
    const access = await getPartnerPortalAccess();
    if (!access) redirect("/portal/login");

    const supabase = await createClient();
    const { data } = await supabase
        .from("legal_agreements" as never)
        .select("id,title,status,party_name,party_email,effective_date,expires_at,signed_at,created_at" as never)
        .eq("workspace_id" as never, access.workspace.id as never)
        .eq("client_id" as never, access.membershipId as never)
        .order("created_at" as never, { ascending: false }) as unknown as { data: AgreementRow[] | null; error: { message: string } | null };
    const agreements = data ?? [];

    return (
        <main className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-6">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <Link href="/portal/dashboard" className="mb-3 inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Portal
                    </Link>
                    <h1 className="text-2xl font-semibold text-foreground">Legal agreements</h1>
                    <p className="mt-1 text-sm text-muted-foreground">{access.workspace.name} · read-only agreement history</p>
                </div>
            </header>

            <section className="overflow-hidden rounded-lg border border-border/60 bg-background/70">
                <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
                    <FileSignature className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-semibold">Agreements</h2>
                </div>
                <div className="divide-y divide-border/60">
                    {agreements.map((agreement) => (
                        <article key={agreement.id} className="grid gap-2 px-4 py-4 md:grid-cols-[1fr_auto]">
                            <div>
                                <p className="text-sm font-semibold">{agreement.title}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{agreement.party_name} · {agreement.party_email}</p>
                                <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                    Effective {formatDate(agreement.effective_date)} · Expires {formatDate(agreement.expires_at)}
                                </p>
                            </div>
                            <div className="text-left md:text-right">
                                <p className="text-sm font-medium capitalize">{agreement.status.replace(/_/g, " ")}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{agreement.signed_at ? `Signed ${formatDate(agreement.signed_at)}` : `Created ${formatDate(agreement.created_at)}`}</p>
                            </div>
                        </article>
                    ))}
                    {agreements.length === 0 ? (
                        <p className="px-4 py-5 text-sm text-muted-foreground">No agreements are visible in your portal yet.</p>
                    ) : null}
                </div>
            </section>
        </main>
    );
}
