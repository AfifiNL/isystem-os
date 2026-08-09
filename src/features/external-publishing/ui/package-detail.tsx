"use client";

import { AlertTriangle, Check, Loader2, Send, X } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    generateExternalPublishingPackageAction,
    recordExternalPublishingManualPublicationAction,
    transitionExternalPublishingPackageStatusAction,
} from "@/features/external-publishing/actions";
import type { ExternalPublicationAssetRow, ExternalPublicationPackageRow, ExternalPublicationStatus } from "@/features/external-publishing/types";
import type { ExternalPublishingAttributionSummary } from "@/features/external-publishing/lib/performance-attribution";
import { Button } from "@/shared/ui/button";
import { PackagePreviewTabs } from "./package-preview-tabs";
import { PackageQualityScorecard } from "./package-quality-scorecard";
import { formatPlatform } from "./package-card";

export function PackageDetail({ pkg, performance, assets = [] }: { pkg: ExternalPublicationPackageRow | null; performance?: ExternalPublishingAttributionSummary | null; assets?: ExternalPublicationAssetRow[] }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
    const [manualUrl, setManualUrl] = useState("");

    if (!pkg) {
        return (
            <section className="flex min-h-[520px] items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/40 p-8 text-center">
                <div className="max-w-md">
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">Review queue</p>
                    <h2 className="mt-2 text-2xl font-semibold text-foreground">Select a package</h2>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">Choose a package from the lanes to review copy, no-link variants, evidence, compliance warnings, and manual publication steps.</p>
                </div>
            </section>
        );
    }

    const packageId = pkg.id;

    function runTransition(label: string, runner: () => Promise<{ success: boolean; error?: string | null }>) {
        setFeedback(null);
        startTransition(async () => {
            const result = await runner();
            if (!result.success) {
                setFeedback({ kind: "error", message: result.error || `${label} failed.` });
                return;
            }
            setFeedback({ kind: "success", message: `${label} complete.` });
            router.refresh();
        });
    }

    const transitionStatus = (status: ExternalPublicationStatus, label: string) => {
        if (!packageId) return;
        runTransition(label, () => transitionExternalPublishingPackageStatusAction(packageId, status));
    };

    return (
        <div className="space-y-4">
            <section className="overflow-hidden rounded-3xl border border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_34%),linear-gradient(135deg,hsl(var(--card)),hsl(var(--background)))] p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                        <p className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
                            <Send className="h-3.5 w-3.5" aria-hidden="true" />
                            Manual publishing only · {formatPlatform(pkg.platform)}
                        </p>
                        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">{pkg.topic}</h2>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">This studio prepares reviewed copy and evidence. It does not post, vote, comment, scrape private communities, or call platform APIs.</p>
                    </div>
                    <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
                        <Button type="button" variant="outline" disabled={isPending} onClick={() => runTransition("Generation", () => generateExternalPublishingPackageAction(packageId))}>
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                            Generate package
                        </Button>
                        <Button type="button" variant="outline" disabled={isPending} onClick={() => transitionStatus("approved", "Approval")}>
                            <Check className="h-4 w-4" aria-hidden="true" />
                            Approve
                        </Button>
                        <Button type="button" variant="outline" disabled={isPending} onClick={() => transitionStatus("exported", "Export mark")}>
                            Mark exported
                        </Button>
                        <Button type="button" variant="destructive" disabled={isPending} onClick={() => transitionStatus("rejected", "Rejection")}>
                            <X className="h-4 w-4" aria-hidden="true" />
                            Reject
                        </Button>
                    </div>
                </div>
                {feedback ? (
                    <div className={`mt-4 rounded-xl border p-3 text-sm ${feedback.kind === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-destructive/30 bg-destructive/10 text-destructive"}`} role="status">
                        {feedback.message}
                    </div>
                ) : null}
            </section>

            <PackageQualityScorecard pkg={pkg} />
            <PackagePreviewTabs pkg={pkg} performance={performance ?? null} assets={assets} />

            <section aria-labelledby="manual-publication-title" className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
                    <div>
                        <h3 id="manual-publication-title" className="text-lg font-semibold text-foreground">Manual publication record</h3>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">Paste the public URL only after a human has manually published the package on the destination platform.</p>
                    </div>
                </div>
                <form
                    className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]"
                    onSubmit={(event) => {
                        event.preventDefault();
                        runTransition("Manual publication record", () => recordExternalPublishingManualPublicationAction(packageId, manualUrl));
                    }}
                >
                    <div>
                        <label htmlFor="manual-published-url" className="text-sm font-medium text-foreground">Published URL</label>
                        <input
                            id="manual-published-url"
                            type="url"
                            required
                            value={manualUrl}
                            onChange={(event) => setManualUrl(event.target.value)}
                            placeholder="https://platform.example/post/manual-publication"
                            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                    </div>
                    <Button type="submit" disabled={isPending || manualUrl.trim().length === 0} className="self-end">
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                        Mark published manually
                    </Button>
                </form>
                {pkg.manual_published_url ? (
                    <p className="mt-3 text-sm text-muted-foreground">Stored publication URL: <a className="font-medium text-primary underline-offset-4 hover:underline" href={pkg.manual_published_url} target="_blank" rel="noreferrer">{pkg.manual_published_url}</a></p>
                ) : null}
            </section>
        </div>
    );
}
