"use client";

import { useState, useTransition } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { signAgreement, type PublicAgreementView } from "@/features/legal-vault/actions/signatures";

interface SignAgreementProps {
    agreement: PublicAgreementView;
    token: string;
}

export function SignAgreement({ agreement, token }: SignAgreementProps) {
    const [signerName, setSignerName] = useState(agreement.partyName);
    const [signerEmail, setSignerEmail] = useState(agreement.partyEmail);
    const [typedSignature, setTypedSignature] = useState("");
    const [accepted, setAccepted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [signedAt, setSignedAt] = useState<string | null>(agreement.signedAt);
    const [isPending, startTransition] = useTransition();

    const alreadySigned = agreement.status === "signed" || Boolean(signedAt);

    function submit() {
        setError(null);
        if (!accepted) {
            setError("Please confirm that you intend to sign this agreement.");
            return;
        }
        startTransition(async () => {
            const result = await signAgreement({
                token,
                signerName,
                signerEmail,
                typedSignature,
                acceptedAt: new Date().toISOString(),
            });
            if (!result.success) {
                setError(result.error);
                return;
            }
            setSignedAt(new Date().toISOString());
        });
    }

    return (
        <main className="mx-auto max-w-3xl px-6 py-10">
            <header className="mb-6">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Electronic signature</p>
                <h1 className="text-2xl font-semibold tracking-tight">{agreement.title}</h1>
                <p className="mt-1 text-sm text-muted-foreground">For: {agreement.partyName}</p>
                <div className="mt-3 rounded-md border border-blue-500/30 bg-blue-500/5 p-3 text-xs text-blue-700 dark:text-blue-300">
                    Signature level: eIDAS Simple Electronic Signature (SES). We record your intent, timestamp,
                    email, IP address, browser user-agent, and a SHA-256 evidence hash. This is not a QES.
                </div>
            </header>

            <article className="prose prose-sm dark:prose-invert mb-8 rounded-md border border-border/60 bg-card p-8">
                {agreement.renderedHtml ? (
                    <div dangerouslySetInnerHTML={{ __html: htmlFromMarkdown(agreement.renderedHtml) }} />
                ) : (
                    <p className="text-muted-foreground">This agreement has no content to display.</p>
                )}
            </article>

            {alreadySigned ? (
                <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
                    <p className="font-medium">Signed</p>
                    <p>This agreement was signed on {new Date(signedAt ?? "").toLocaleString()}.</p>
                    {agreement.signedSha256 ? (
                        <p className="mt-1 text-xs">Signature hash: <code>{agreement.signedSha256.slice(0, 32)}…</code></p>
                    ) : null}
                </div>
            ) : (
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        submit();
                    }}
                    className="space-y-4 rounded-md border border-border/60 bg-card p-6"
                >
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-medium">Your name</label>
                            <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} required />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Your email</label>
                            <Input
                                type="email"
                                value={signerEmail}
                                onChange={(e) => setSignerEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium">Type your full name as signature</label>
                        <Input
                            value={typedSignature}
                            onChange={(e) => setTypedSignature(e.target.value)}
                            placeholder="Full legal name"
                            className="font-serif italic"
                            required
                        />
                    </div>
                    <label className="flex items-start gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={accepted}
                            onChange={(e) => setAccepted(e.target.checked)}
                            className="mt-1"
                        />
                        <span>
                            I have read this agreement, I am the named counterparty, and my typed signature
                            above constitutes my legally binding electronic signature (eIDAS SES).
                        </span>
                    </label>
                    {error ? (
                        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                            {error}
                        </p>
                    ) : null}
                    <Button type="submit" disabled={isPending}>
                        {isPending ? "Signing…" : "Sign agreement"}
                    </Button>
                </form>
            )}
        </main>
    );
}

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
            const cells = line.slice(1, -1).split("|").map((c) => c.trim());
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
            out.push(`<h${level}>${inlineFormat(line.replace(/^#+\s*/, ""))}</h${level}>`);
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
