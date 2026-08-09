import { CheckCircle2, AlertTriangle, HelpCircle, ShieldQuestion } from "lucide-react";
import { getResendDomainStatus } from "@/shared/lib/resend/domains";

interface DomainStatusCardProps {
    /**
     * Sender domain extracted from the workspace's configured From address
     * (e.g. "isystem.ai" derived from "Hossam <hi@isystem.ai>"). Passed in by
     * the dashboard so this component stays free of workspace lookup logic.
     */
    domain: string | null;
}

function deriveDomainFromEmail(email: string | null | undefined): string | null {
    if (!email) return null;
    const at = email.indexOf("@");
    if (at < 0) return null;
    return email.slice(at + 1).trim().toLowerCase();
}

export { deriveDomainFromEmail };

export async function DomainStatusCard({ domain }: DomainStatusCardProps) {
    if (!domain) {
        return (
            <div className="rounded-md border border-border/60 bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2 text-[17px] font-semibold text-muted-foreground">
                    <HelpCircle className="h-4 w-4" />
                    Sender domain not configured
                </div>
                <p className="mt-2 text-[15px] text-muted-foreground">
                    Set <code className="rounded bg-muted px-1.5 py-0.5">NEWSLETTER_FROM_EMAIL</code> in the project environment so the
                    dashboard can verify the domain at Resend.
                </p>
            </div>
        );
    }

    const status = await getResendDomainStatus(domain);

    if (!status) {
        return (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-[17px] font-semibold text-amber-700 dark:text-amber-300">
                    <ShieldQuestion className="h-4 w-4" />
                    Sender domain not found at Resend
                </div>
                <p className="mt-2 text-[15px] text-muted-foreground">
                    <strong>{domain}</strong> is not registered as a Resend sending domain — campaigns
                    sent from this address will be rejected. Add it in the Resend dashboard and verify the
                    DNS records.
                </p>
            </div>
        );
    }

    const verified = status.status?.toLowerCase() === "verified";
    return (
        <div className={`rounded-md border p-4 shadow-sm ${verified ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
            <div className={`flex items-center gap-2 text-[17px] font-semibold ${verified ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
                {verified ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                Sender domain status: {status.status}
            </div>
            <p className="mt-2 text-[15px] text-muted-foreground">
                <strong>{status.name}</strong>
                {status.region ? ` · ${status.region}` : ""}
                {verified
                    ? ` — ready to send campaigns.`
                    : ` — Resend requires verification before campaigns can be sent. Open the Resend dashboard to complete DNS verification.`}
            </p>
        </div>
    );
}
