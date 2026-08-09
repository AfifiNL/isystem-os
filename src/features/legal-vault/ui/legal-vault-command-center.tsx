"use client";

import Link from "next/link";
import { Activity, AlertTriangle, CheckCircle2, FileSearch, FileText, Receipt, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { formatEuro, summarizeBtwQuarter } from "@/features/legal-vault/lib/btw";
import type { AccountingEntry, LegalAgreement, LegalDocument } from "@/features/legal-vault/types";

interface LegalVaultCommandCenterProps {
    documents: LegalDocument[];
    agreements: LegalAgreement[];
    entries: AccountingEntry[];
    workspaceName: string;
}

export function LegalVaultCommandCenter({ documents, agreements, entries, workspaceName }: LegalVaultCommandCenterProps) {
    const activeDocuments = documents.filter((doc) => !doc.deletedAt);
    const hiddenDocuments = documents.length - activeDocuments.length;
    const signedAgreements = agreements.filter((agreement) => agreement.status === "signed").length;
    const pendingAgreements = agreements.filter((agreement) => agreement.status === "sent" || agreement.status === "viewed").length;
    const staleSent = agreements.filter((agreement) => {
        if (agreement.status !== "sent" && agreement.status !== "viewed") return false;
        return Date.now() - new Date(agreement.updatedAt).getTime() > 7 * 24 * 60 * 60 * 1000;
    }).length;
    const totals = summarizeBtwQuarter(entries);
    const healthScore = Math.max(55, 100 - hiddenDocuments * 4 - staleSent * 8 - Math.max(0, pendingAgreements - 3) * 3);

    return (
        <section className="border-b border-border/60 bg-gradient-to-br from-background via-card to-muted/40 px-8 py-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ShieldCheck className="size-4 text-emerald-500" />
                        <span>Legal Vault command center · {workspaceName}</span>
                    </div>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight">Compliance operations cockpit</h1>
                    <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                        Monitor signing evidence, retention posture, Dutch BTW readiness, and document integrity from one secure workspace.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button asChild variant="outline"><Link href="/dashboard/legal-vault/agreements">Agreements</Link></Button>
                    <Button asChild variant="outline"><Link href="/dashboard/legal-vault/bookkeeping">Bookkeeping</Link></Button>
                </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-4">
                <Card className="border-emerald-500/30 bg-emerald-500/5">
                    <CardHeader className="pb-2">
                        <CardDescription>Compliance health</CardDescription>
                        <CardTitle className="text-3xl">{healthScore}%</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">
                        Based on visible documents, pending signatures, and stale signing tasks.
                    </CardContent>
                </Card>
                <MetricCard icon={<FileText className="size-4" />} label="Vault documents" value={activeDocuments.length} note={`${hiddenDocuments} hidden but retained`} />
                <MetricCard icon={<CheckCircle2 className="size-4" />} label="Signed agreements" value={signedAgreements} note={`${pendingAgreements} waiting for counterparty`} />
                <MetricCard icon={<Receipt className="size-4" />} label="Net BTW position" value={formatEuro(totals.btw_to_pay_cents)} note={`${totals.entry_count} ledger entries`} />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base"><Activity className="size-4" /> Signing pipeline</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <PipelineRow label="Draft" count={agreements.filter((a) => a.status === "draft").length} />
                        <PipelineRow label="Sent/viewed" count={pendingAgreements} />
                        <PipelineRow label="Signed" count={signedAgreements} />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="size-4" /> Action queue</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                        <p>{staleSent > 0 ? `${staleSent} agreement(s) have been waiting more than 7 days.` : "No stale signature requests detected."}</p>
                        <p>{hiddenDocuments > 0 ? `${hiddenDocuments} hidden document(s) remain retained under bewaarplicht.` : "No hidden retained documents in current view."}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base"><FileSearch className="size-4" /> Evidence posture</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        Signed agreements now expose exportable JSON evidence bundles with SHA-256 manifests and SES labeling.
                    </CardContent>
                </Card>
            </div>
        </section>
    );
}

function MetricCard({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: React.ReactNode; note: string }) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">{icon}{label}</CardDescription>
                <CardTitle className="text-2xl">{value}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{note}</CardContent>
        </Card>
    );
}

function PipelineRow({ label, count }: { label: string; count: number }) {
    return (
        <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
            <span>{label}</span>
            <span className="font-semibold">{count}</span>
        </div>
    );
}
