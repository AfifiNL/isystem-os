"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/shared/ui/button";
import { voidLegalAgreement } from "@/features/legal-vault/actions/agreements";
import { getAgreementEvidenceBundle, sendAgreementForSignature } from "@/features/legal-vault/actions/signatures";
import type { LegalAgreement, LegalAgreementStatus } from "@/features/legal-vault/types";

interface AgreementDetailProps {
    agreement: LegalAgreement;
}

const STATUS_LABEL: Record<LegalAgreementStatus, string> = {
    draft: "Draft",
    sent: "Sent for signature",
    viewed: "Viewed by counterparty",
    signed: "Signed",
    void: "Void",
    expired: "Expired",
};

export function AgreementDetail({ agreement }: AgreementDetailProps) {
    const [state, setState] = useState(agreement);
    const [error, setError] = useState<string | null>(null);
    const [evidenceHash, setEvidenceHash] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const renderedHtml =
        typeof state.payload?.rendered_html === "string" ? (state.payload.rendered_html as string) : null;

    function handleSend() {
        setError(null);
        startTransition(async () => {
            const result = await sendAgreementForSignature({ agreementId: state.id });
            if (!result.success) {
                setError(result.error);
                return;
            }
            setState((prev) => ({ ...prev, status: "sent" }));
        });
    }

    function handleVoid() {
        if (!window.confirm("Mark this agreement as void? This cannot be undone.")) return;
        setError(null);
        startTransition(async () => {
            const result = await voidLegalAgreement(state.id);
            if (!result.success) {
                setError(result.error);
                return;
            }
            setState((prev) => ({ ...prev, status: "void" }));
        });
    }

    function handleEvidence() {
        setError(null);
        startTransition(async () => {
            const result = await getAgreementEvidenceBundle(state.id);
            if (!result.success) {
                setError(result.error);
                return;
            }
            setEvidenceHash(result.data.sha256);
            const blob = new Blob([JSON.stringify(result.data.bundle, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `evidence-${state.id}.json`;
            anchor.click();
            URL.revokeObjectURL(url);
        });
    }

    return (
        <div className="flex h-full flex-col overflow-y-auto bg-background">
            <header className="border-b border-border/60 bg-card/50 px-8 py-6">
                <p className="text-[15px] text-muted-foreground">
                    <Link href="/dashboard/legal-vault/agreements" className="hover:underline">Agreements</Link>
                    {" / "}
                    {STATUS_LABEL[state.status]}
                </p>
                <h1 className="mt-1 text-[27px] font-semibold tracking-tight">{state.title}</h1>
                <p className="mt-1 text-[17px] text-muted-foreground">
                    {state.partyName} · {state.partyEmail}
                    {state.effectiveDate ? <> · effective {state.effectiveDate}</> : null}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                    {state.status === "draft" ? (
                        <Button onClick={handleSend} disabled={isPending}>
                            {isPending ? "Sending…" : "Send for signature"}
                        </Button>
                    ) : null}
                    {state.status !== "signed" && state.status !== "void" ? (
                        <Button variant="ghost" onClick={handleVoid} disabled={isPending}>
                            Mark void
                        </Button>
                    ) : null}
                    {state.status === "sent" || state.status === "viewed" ? (
                        <Link
                            href={`/sign/${state.publicToken}`}
                            target="_blank"
                            className="rounded-md border border-border px-3 py-1.5 text-[17px] hover:bg-muted"
                        >
                            Open signer view
                        </Link>
                    ) : null}
                    {state.status === "signed" ? (
                        <Button variant="ghost" onClick={handleEvidence} disabled={isPending}>
                            Export evidence bundle
                        </Button>
                    ) : null}
                </div>

                {evidenceHash ? (
                    <div className="mt-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[15px] text-emerald-700 dark:text-emerald-300">
                        Evidence bundle exported · sha256 <code>{evidenceHash.slice(0, 32)}…</code>
                    </div>
                ) : null}

                {error ? (
                    <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[17px] text-destructive">
                        {error}
                    </div>
                ) : null}
            </header>

            <section className="px-8 py-6">
                {state.status === "signed" ? (
                    <div className="mx-auto mb-4 max-w-3xl rounded-md border border-emerald-500/30 bg-emerald-500/5 p-4 text-[17px] text-emerald-700 dark:text-emerald-300">
                        <p className="font-medium">Signed with eIDAS Simple Electronic Signature (SES)</p>
                        <p className="mt-1 text-[15px]">
                            The evidence bundle contains the rendered agreement, event log, signer metadata, and SHA-256 manifests.
                            This is not marketed as a qualified electronic signature (QES).
                        </p>
                    </div>
                ) : null}
                <article className="mx-auto max-w-3xl rounded-md border border-border/60 bg-card p-8 prose prose-base dark:prose-invert">
                    {renderedHtml ? (
                        <div dangerouslySetInnerHTML={{ __html: htmlFromMarkdown(renderedHtml) }} />
                    ) : (
                        <p className="text-muted-foreground">No rendered content available.</p>
                    )}
                </article>
            </section>
        </div>
    );
}

// Lightweight Markdown→HTML for the rendered template. The template body
// arrives as Markdown with HTML-escaped variable values already substituted;
// we apply minimal formatting (headings, bold, paragraphs, tables) — full
// MDX is intentionally avoided to keep the renderer auditable for a legal
// surface.
function htmlFromMarkdown(input: string): string {
    const lines = input.split(/\r?\n/);
    const out: string[] = [];
    let inTable = false;
    let tableHeader = false;

    for (const raw of lines) {
        const line = raw.trimEnd();
        if (line.startsWith("|") && line.endsWith("|")) {
            if (!inTable) {
                inTable = true;
                tableHeader = true;
                out.push("<table><thead>");
            }
            if (line.includes("---")) {
                out.push("</thead><tbody>");
                tableHeader = false;
                continue;
            }
            const cells = line
                .slice(1, -1)
                .split("|")
                .map((c) => c.trim());
            const tag = tableHeader ? "th" : "td";
            out.push(`<tr>${cells.map((c) => `<${tag}>${inlineFormat(c)}</${tag}>`).join("")}</tr>`);
            continue;
        }
        if (inTable) {
            out.push("</tbody></table>");
            inTable = false;
        }
        if (/^#{1,6}\s/.test(line)) {
            const level = (line.match(/^#+/) ?? [""])[0].length;
            const text = line.replace(/^#+\s*/, "");
            out.push(`<h${level}>${inlineFormat(text)}</h${level}>`);
        } else if (line === "---") {
            out.push("<hr />");
        } else if (line.trim() === "") {
            out.push("");
        } else {
            out.push(`<p>${inlineFormat(line)}</p>`);
        }
    }
    if (inTable) out.push("</tbody></table>");
    return out.join("\n");
}

function inlineFormat(value: string): string {
    return value
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/`([^`]+)`/g, "<code>$1</code>");
}
