"use client";

import { useMemo, useState, useTransition } from "react";
import {
    FileText,
    Receipt,
    UploadCloud,
    EyeOff,
    Eye,
    RotateCcw,
    CheckCircle2,
    ShieldCheck,
    FileSearch
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
    getLegalDocumentSignedUrl,
    restoreLegalDocument,
    softDeleteLegalDocument,
    uploadLegalDocument,
    verifyLegalDocumentSha256,
} from "@/features/legal-vault/actions/documents";
import type {
    AccountingEntry,
    LegalAgreement,
    LegalDocument,
    LegalDocumentKind,
} from "@/features/legal-vault/types";
import { formatEuro, summarizeBtwQuarter } from "@/features/legal-vault/lib/btw";
import {
    DashboardAppWorkbench,
    AppCommandBar,
    AppMetricStrip,
    AppMetric,
    AppSplitPane,
    AppTabList,
    AppQueueTable,
    AppStatusBanner,
    AppSectionHeader,
    AppFeedbackLoop,
} from "@/features/admin/ui/app-workbench";

interface LegalVaultOverviewProps {
    initialDocuments: LegalDocument[];
    initialAgreements?: LegalAgreement[];
    initialEntries?: AccountingEntry[];
    initialError: string | null;
    workspaceId: string;
    workspaceName: string;
}

const KIND_LABELS: Record<LegalDocumentKind, string> = {
    agreement: "Service agreement",
    invoice: "Invoice",
    receipt: "Receipt",
    accounting_export: "Accounting export",
    identity: "Identity document",
    correspondence: "Correspondence",
    other: "Other",
};

export function LegalVaultOverview({
    initialDocuments,
    initialAgreements = [],
    initialEntries = [],
    initialError,
    workspaceId,
    workspaceName,
}: LegalVaultOverviewProps) {
    const [documents, setDocuments] = useState<LegalDocument[]>(initialDocuments);
    const [error, setError] = useState<string | null>(initialError);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [selectedDocId, setSelectedDocId] = useState<string | null>(initialDocuments[0]?.id || null);

    // Compliance Calculations
    const activeDocuments = documents.filter((doc) => !doc.deletedAt);
    const hiddenDocuments = documents.length - activeDocuments.length;
    const signedAgreements = initialAgreements.filter((agreement) => agreement.status === "signed").length;
    const pendingAgreements = initialAgreements.filter((agreement) => agreement.status === "sent" || agreement.status === "viewed").length;
    const staleSent = initialAgreements.filter((agreement) => {
        if (agreement.status !== "sent" && agreement.status !== "viewed") return false;
        return Date.now() - new Date(agreement.updatedAt).getTime() > 7 * 24 * 60 * 60 * 1000;
    }).length;
    const btwTotals = summarizeBtwQuarter(initialEntries);
    const healthScore = Math.max(55, 100 - hiddenDocuments * 4 - staleSent * 8 - Math.max(0, pendingAgreements - 3) * 3);

    const selectedDoc = useMemo(() => documents.find((d) => d.id === selectedDocId), [documents, selectedDocId]);

    const tabs = [
        { label: "Documents", value: "documents", href: "/dashboard/legal-vault", active: true },
        { label: "Agreements", value: "agreements", href: "/dashboard/legal-vault/agreements" },
        { label: "Bookkeeping", value: "bookkeeping", href: "/dashboard/legal-vault/bookkeeping" }
    ];

    function handleAfterUpload(newDoc: LegalDocument) {
        setDocuments((prev) => [newDoc, ...prev]);
        setSelectedDocId(newDoc.id);
        setUploadOpen(false);
    }

    async function handleSoftDelete(documentId: string) {
        if (!window.confirm("Hide this document from the vault view? The file is retained under bewaarplicht and can be restored.")) {
            return;
        }
        const result = await softDeleteLegalDocument({ documentId });
        if (!result.success) {
            setError(result.error);
            return;
        }
        setDocuments((prev) => prev.filter((d) => d.id !== documentId));
        if (selectedDocId === documentId) {
            setSelectedDocId(documents.find((d) => d.id !== documentId)?.id || null);
        }
    }

    async function handleRestore(documentId: string) {
        const result = await restoreLegalDocument({ documentId });
        if (!result.success) {
            setError(result.error);
            return;
        }
        setDocuments((prev) => prev.map((doc) => doc.id === documentId ? { ...doc, deletedAt: null } : doc));
    }

    const tableHeaders = (
        <tr className="border-b border-border/50 text-[13px]">
            <th className="px-3 py-2">Document Title</th>
            <th className="px-3 py-2">Kind</th>
            <th className="px-3 py-2 text-right">Uploaded</th>
        </tr>
    );

    return (
        <DashboardAppWorkbench>
            <AppCommandBar>
                <AppTabList tabs={tabs} />
                <div className="flex items-center gap-2">
                    <Button size="xs" variant={uploadOpen ? "secondary" : "default"} onClick={() => setUploadOpen((open) => !open)} className="cursor-pointer">
                        <UploadCloud className="size-3" />
                        Upload to Vault
                    </Button>
                </div>
            </AppCommandBar>

            <AppMetricStrip>
                <AppMetric
                    label="Compliance Health"
                    value={`${healthScore}%`}
                    icon={ShieldCheck}
                    variant={healthScore >= 90 ? "success" : healthScore >= 75 ? "warning" : "destructive"}
                    description={`${staleSent} stale signature task${staleSent === 1 ? "" : "s"}`}
                />
                <AppMetric
                    label="Vault Documents"
                    value={activeDocuments.length}
                    icon={FileText}
                    description={`${hiddenDocuments} hidden (retained)`}
                />
                <AppMetric
                    label="Signed Agreements"
                    value={signedAgreements}
                    icon={CheckCircle2}
                    description={`${pendingAgreements} pending countersign`}
                />
                <AppMetric
                    label="Net BTW Position"
                    value={formatEuro(btwTotals.btw_to_pay_cents)}
                    icon={Receipt}
                    description={`${btwTotals.entry_count} ledger entries`}
                />
            </AppMetricStrip>

            <AppFeedbackLoop
                title="Compliance evidence loop"
                description={`${workspaceName}: documents, signatures, retention, and ledger evidence should reinforce one another.`}
                stages={[
                    { label: "Documents", value: activeDocuments.length, detail: "retained records", tone: "info" },
                    { label: "Pending", value: pendingAgreements, detail: "signature queue", tone: pendingAgreements > 0 ? "warning" : "success" },
                    { label: "Signed", value: signedAgreements, detail: "verified agreements", tone: "success" },
                    { label: "Ledger", value: btwTotals.entry_count, detail: "BTW entries", tone: "info" },
                    { label: "Health", value: `${healthScore}%`, detail: "compliance posture", tone: healthScore >= 90 ? "success" : "warning" },
                ]}
                feedbackLabel="A stale signature or hidden record changes the compliance posture; ledger and document evidence must remain reconcilable."
            />

            {uploadOpen && (
                <div className="border-b border-border/60 bg-muted/20 px-4 py-3 shrink-0">
                    <UploadPanel
                        workspaceId={workspaceId}
                        onClose={() => setUploadOpen(false)}
                        onUploaded={handleAfterUpload}
                        onError={setError}
                    />
                </div>
            )}

            {error && (
                <AppStatusBanner variant="destructive" className="mx-4 mt-4">
                    {error}
                </AppStatusBanner>
            )}

            <AppSplitPane
                main={
                    <div className="flex flex-col flex-1 h-full min-h-0">
                        <div className="px-4 pt-3 flex-none">
                            <AppSectionHeader
                                title="Documents Archive"
                                description={`Securely stored legal artifacts for ${workspaceName}. Click any row to inspect compliance fingerprint hashes, audit trail details, and mint download permissions.`}
                            />
                        </div>
                        <AppQueueTable
                            headers={tableHeaders}
                            empty={documents.length === 0}
                            emptyText="No documents found in the vault. Enforce bewaarplicht by uploading a file."
                            mobileCards={documents.map((doc) => {
                                const isSelected = doc.id === selectedDocId;
                                return (
                                    <button
                                        key={doc.id}
                                        type="button"
                                        onClick={() => setSelectedDocId(doc.id)}
                                        className={`w-full rounded-md border p-3 text-left text-[15px] shadow-3xs transition-colors ${
                                            isSelected
                                                ? "border-cyan-500/40 bg-cyan-500/5 dark:bg-cyan-950/10"
                                                : "border-border/60 bg-card/45 active:bg-muted/40"
                                        }`}
                                    >
                                        <span className="flex min-w-0 items-start justify-between gap-3">
                                            <span className="min-w-0">
                                                <span className="block truncate font-semibold text-foreground">{doc.title}</span>
                                                <span className="mt-1 block text-[13px] text-muted-foreground">
                                                    {KIND_LABELS[doc.kind]} · {new Date(doc.createdAt).toLocaleDateString("nl-NL")}
                                                </span>
                                            </span>
                                            {doc.deletedAt ? (
                                                <span className="shrink-0 rounded-full bg-muted/60 px-1.5 py-0.5 text-[11px] font-semibold uppercase text-muted-foreground">
                                                    hidden
                                                </span>
                                            ) : null}
                                        </span>
                                    </button>
                                );
                            })}
                        >
                            {documents.map((doc) => {
                                const isSelected = doc.id === selectedDocId;
                                return (
                                    <tr
                                        key={doc.id}
                                        onClick={() => setSelectedDocId(doc.id)}
                                        className={`border-b border-border/30 hover:bg-muted/30 cursor-pointer transition-colors ${
                                            isSelected ? "bg-muted/50 font-medium" : ""
                                        }`}
                                    >
                                        <td className="px-3 py-2.5 truncate max-w-xs">
                                            {doc.title}
                                            {doc.deletedAt && (
                                                <span className="ml-1.5 rounded-full bg-muted/60 px-1.5 py-0.5 text-[13px] text-muted-foreground uppercase font-semibold">hidden</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5 text-muted-foreground">
                                            {KIND_LABELS[doc.kind]}
                                        </td>
                                        <td className="px-3 py-2.5 text-right text-muted-foreground">
                                            {new Date(doc.createdAt).toLocaleDateString("nl-NL")}
                                        </td>
                                    </tr>
                                );
                            })}
                        </AppQueueTable>
                    </div>
                }
                inspectorLabel="Document inspector"
                inspector={
                    <div className="flex flex-col h-full min-h-0 p-4 space-y-4">
                        {selectedDoc ? (
                            <InspectorContent
                                document={selectedDoc}
                                onSoftDelete={() => handleSoftDelete(selectedDoc.id)}
                                onRestore={() => handleRestore(selectedDoc.id)}
                                onError={setError}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center text-center p-6 h-full text-muted-foreground text-[15px] space-y-2">
                                <FileSearch className="size-8 text-muted-foreground/40" />
                                <span className="font-semibold text-foreground">No document selected</span>
                                <span>Choose an archive record to audit its cryptographic fingerprints and retention parameters.</span>
                            </div>
                        )}
                    </div>
                }
            />
        </DashboardAppWorkbench>
    );
}

interface UploadPanelProps {
    workspaceId: string;
    onClose: () => void;
    onUploaded: (doc: LegalDocument) => void;
    onError: (message: string) => void;
}

function UploadPanel({ onClose, onUploaded, onError }: UploadPanelProps) {
    const [isPending, startTransition] = useTransition();

    function onSubmit(formData: FormData) {
        startTransition(async () => {
            const result = await uploadLegalDocument(formData);
            if (!result.success) {
                onError(result.error);
                return;
            }
            onUploaded(result.data);
        });
    }

    return (
        <form className="grid gap-3 sm:grid-cols-2 text-[15px]" action={onSubmit}>
            <div className="sm:col-span-2">
                <label htmlFor="file" className="block text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    File (PDF, image, CSV, DOCX, XLSX — up to 50 MB)
                </label>
                <Input id="file" name="file" type="file" required accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.docx,.xlsx,.zip" className="h-8 text-[15px] cursor-pointer file:cursor-pointer" />
            </div>
            <div>
                <label htmlFor="title" className="block text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Title</label>
                <Input id="title" name="title" required minLength={2} maxLength={200} placeholder="e.g. Service agreement — Acme BV" className="h-8 text-[15px]" />
            </div>
            <div>
                <label htmlFor="kind" className="block text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Kind</label>
                <select
                    id="kind"
                    name="kind"
                    required
                    defaultValue="agreement"
                    className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-[15px] select-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
                >
                    {Object.entries(KIND_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                    ))}
                </select>
            </div>
            <div className="sm:col-span-2 flex items-center justify-end gap-1.5 pt-1">
                <Button type="button" size="xs" variant="ghost" onClick={onClose} disabled={isPending} className="cursor-pointer">
                    Cancel
                </Button>
                <Button type="submit" size="xs" disabled={isPending} className="cursor-pointer">
                    {isPending ? "Uploading…" : "Upload to Vault"}
                </Button>
            </div>
        </form>
    );
}

function InspectorContent({
    document: doc,
    onSoftDelete,
    onRestore,
    onError
}: {
    document: LegalDocument;
    onSoftDelete: () => void;
    onRestore: () => void;
    onError: (msg: string | null) => void;
}) {
    const [signedUrl, setSignedUrl] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [verified, setVerified] = useState(false);

    async function handleReveal() {
        if (signedUrl) {
            setSignedUrl(null);
            return;
        }
        setPending(true);
        const result = await getLegalDocumentSignedUrl(doc.id);
        setPending(false);
        if (result.success) {
            setSignedUrl(result.data.url);
            window.open(result.data.url, "_blank", "noopener,noreferrer");
        }
    }

    async function handleVerify() {
        setPending(true);
        const result = await verifyLegalDocumentSha256(doc.id);
        setPending(false);
        if (!result.success) {
            onError(result.error);
            return;
        }
        setVerified(result.data.verified);
        if (!result.data.verified) {
            onError("Document hash mismatch detected. Treat this record as tamper-suspect until reviewed.");
        }
    }

    return (
        <div className="space-y-4 text-[15px]">
            <AppSectionHeader title="Inspector Pane" description="Audit details and verify integrity manifests." />

            <div className="space-y-3">
                <div className="rounded-md border border-border/50 bg-background/30 p-3 space-y-2">
                    <p className="font-semibold text-foreground leading-tight text-[17px] break-words">{doc.title}</p>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[14px] text-muted-foreground pt-1 border-t border-border/30">
                        <div>Kind:</div>
                        <div className="text-foreground font-medium">{KIND_LABELS[doc.kind]}</div>
                        <div>Size:</div>
                        <div className="text-foreground font-medium">{formatBytes(doc.sizeBytes)}</div>
                        <div>Uploaded:</div>
                        <div className="text-foreground font-medium">{new Date(doc.createdAt).toLocaleString()}</div>
                    </div>
                </div>

                <div className="rounded-md border border-border/50 bg-background/30 p-3 space-y-2">
                    <p className="font-semibold text-foreground uppercase text-[12px] tracking-wider text-muted-foreground">Compliance Manifest</p>
                    <div className="space-y-1 text-[14px] text-muted-foreground">
                        <div className="flex justify-between">
                            <span>Fingerprint:</span>
                            <code className="text-foreground text-[13px] bg-muted/60 px-1 rounded">{doc.sha256.slice(0, 16)}…</code>
                        </div>
                        <div className="flex justify-between">
                            <span>Retention End:</span>
                            <span className="text-foreground font-medium">{doc.retentionUntil}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                            <span>Status:</span>
                            {verified ? (
                                <span className="inline-flex items-center gap-1 text-[13px] text-emerald-600 font-semibold uppercase">
                                    <CheckCircle2 className="size-3" /> Hash Verified
                                </span>
                            ) : (
                                <span className="text-[13px] text-muted-foreground italic">Unverified (click check)</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
                <Button size="sm" onClick={handleReveal} disabled={pending} className="w-full cursor-pointer">
                    {signedUrl ? <EyeOff className="size-3.5 mr-2" /> : <Eye className="size-3.5 mr-2" />}
                    {signedUrl ? "Revoke URL" : "Reveal Document"}
                </Button>

                <Button size="sm" variant="outline" onClick={handleVerify} disabled={pending} className="w-full cursor-pointer">
                    <CheckCircle2 className="size-3.5 mr-2 text-emerald-500" />
                    Verify Integrity Hash
                </Button>

                {doc.deletedAt ? (
                    <Button size="sm" variant="secondary" onClick={onRestore} className="w-full cursor-pointer">
                        <RotateCcw className="size-3.5 mr-2" />
                        Restore to View
                    </Button>
                ) : (
                    <Button size="sm" variant="ghost" onClick={onSoftDelete} className="w-full text-rose-500 hover:text-rose-600 hover:bg-rose-500/5 cursor-pointer">
                        Hide from Vault
                    </Button>
                )}
            </div>
        </div>
    );
}

function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const exponent = Math.min(units.length - 1, Math.floor(Math.log10(bytes) / 3));
    const value = bytes / 10 ** (exponent * 3);
    return `${value.toFixed(value >= 100 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}
