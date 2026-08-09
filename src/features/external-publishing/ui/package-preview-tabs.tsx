"use client";

import { Download, FileText, ImageIcon, Link2, ScrollText, ShieldAlert } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import type { Json } from "@/shared/lib/supabase/database.types";
import { createExternalPublishingAssetManifestAction, downloadExternalPublicationBundleAction } from "@/features/external-publishing/actions";
import type { ExternalPublicationAssetRow, ExternalPublicationPackageRow } from "@/features/external-publishing/types";
import type { ExternalPublishingAttributionSummary } from "@/features/external-publishing/lib/performance-attribution";
import { externalPublishingVisualFilename, extractExternalPublishingVisualFromAsset, extractExternalPublishingVisualsFromPlan } from "@/features/external-publishing/lib/visual-rendering";
import { selectExternalPublishingPlatformBody } from "@/features/external-publishing/lib/platform-body";
import { Button } from "@/shared/ui/button";
import { CopyButton } from "./copy-button";
import { VisualExportCard } from "./visual-export-card";

type TabKey = "copy" | "nolink" | "visuals" | "links" | "evidence" | "compliance" | "performance";

const tabs: Array<{ key: TabKey; label: string; icon: typeof FileText }> = [
    { key: "copy", label: "Platform copy", icon: FileText },
    { key: "nolink", label: "No-link version", icon: ScrollText },
    { key: "visuals", label: "Images/diagrams", icon: ImageIcon },
    { key: "links", label: "Links/UTM", icon: Link2 },
    { key: "evidence", label: "Evidence", icon: ScrollText },
    { key: "compliance", label: "Compliance", icon: ShieldAlert },
    { key: "performance", label: "Performance", icon: Download },
];

function asRecord(value: Json): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asStringArray(value: Json): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function stringify(value: unknown): string {
    if (value === null || typeof value === "undefined") return "Not generated yet.";
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
}

function stripMarkdownLinks(markdown: string, targetUrl: string) {
    void targetUrl;
    return markdown.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1");
}

function buildMarkdownExport(pkg: ExternalPublicationPackageRow) {
    const titles = asStringArray(pkg.title_options).map((title) => `- ${title}`).join("\n") || "- Untitled";
    const platformCopy = selectExternalPublishingPlatformBody({
        platform: pkg.platform,
        bodyMarkdown: pkg.body_markdown,
        bodyPlaintext: pkg.body_plaintext,
        bodyPlatformSpecific: pkg.body_platform_specific,
    }) || "Not generated yet.";
    return [
        `# External Publishing Package — ${pkg.topic}`,
        "",
        `Platform: ${pkg.platform}`,
        `Status: ${pkg.status}`,
        `Target URL: ${pkg.target_url}`,
        "",
        "## Title options",
        titles,
        "",
        "## Platform-ready body",
        platformCopy,
        "",
        "## No-link fallback",
        stripMarkdownLinks(pkg.body_markdown || pkg.body_plaintext || "", pkg.target_url),
        "",
        "## Link plan",
        stringify(pkg.link_plan),
        "",
        "## Visual plan",
        stringify(pkg.visual_plan),
        "",
        "## Evidence",
        stringify(pkg.evidence_pack),
        "",
        "## Compliance warnings",
        stringify(pkg.compliance_warnings),
    ].join("\n");
}

export function PackagePreviewTabs({ pkg, performance, assets = [] }: { pkg: ExternalPublicationPackageRow; performance?: ExternalPublishingAttributionSummary | null; assets?: ExternalPublicationAssetRow[] }) {
    const [active, setActive] = useState<TabKey>("copy");
    const [isExportPending, startExportTransition] = useTransition();
    const [isAssetPending, startAssetTransition] = useTransition();
    const [exportError, setExportError] = useState<string | null>(null);
    const [assetFeedback, setAssetFeedback] = useState<string | null>(null);
    const titles = asStringArray(pkg.title_options);
    const platformCopy = selectExternalPublishingPlatformBody({
        platform: pkg.platform,
        bodyMarkdown: pkg.body_markdown,
        bodyPlaintext: pkg.body_plaintext,
        bodyPlatformSpecific: pkg.body_platform_specific,
    });
    const noLink = stripMarkdownLinks(pkg.body_markdown || pkg.body_plaintext || "", pkg.target_url);
    const linkPlan = asRecord(pkg.link_plan);
    const visualPlan = asRecord(pkg.visual_plan);
    const markdownExport = useMemo(() => buildMarkdownExport(pkg), [pkg]);
    const renderedVisuals = useMemo(() => extractExternalPublishingVisualsFromPlan(pkg.visual_plan, pkg), [pkg]);

    function saveMarkdown(filename: string, markdown: string) {
        const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(url);
    }

    function downloadBundle() {
        setExportError(null);
        startExportTransition(async () => {
            const result = await downloadExternalPublicationBundleAction(pkg.id);
            if (!result.success || !result.data) {
                setExportError(result.error || "Bundle export failed.");
                return;
            }
            saveMarkdown(result.data.filename, result.data.markdown);
        });
    }

    function createAssetManifest() {
        setAssetFeedback(null);
        startAssetTransition(async () => {
            const result = await createExternalPublishingAssetManifestAction(pkg.id, {});
            setAssetFeedback(result.success ? "Asset manifest stored. Refresh to see the new library row." : result.error || "Asset manifest creation failed.");
        });
    }

    return (
        <section aria-labelledby="external-publishing-preview-title" className="rounded-2xl border border-border/60 bg-card/70 shadow-sm">
            <div className="border-b border-border/60 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h3 id="external-publishing-preview-title" className="text-lg font-semibold text-foreground">Package review workspace</h3>
                        <p className="mt-1 text-sm text-muted-foreground">Copy panels are read-only and designed for manual paste into the destination platform.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <CopyButton value={markdownExport} label="Copy Markdown" />
                        <Button type="button" size="sm" variant="outline" onClick={downloadBundle} disabled={isExportPending} aria-label="Export manual publishing bundle as Markdown">
                            <Download className="h-4 w-4" aria-hidden="true" />
                            {isExportPending ? "Exporting…" : "Export bundle"}
                        </Button>
                    </div>
                </div>
                {exportError ? <p className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{exportError}</p> : null}
                <div role="tablist" aria-label="Package preview sections" className="mt-4 flex gap-2 overflow-x-auto pb-1">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const selected = active === tab.key;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                role="tab"
                                aria-selected={selected}
                                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border/70 bg-background/70 text-muted-foreground hover:text-foreground"}`}
                                onClick={() => setActive(tab.key)}
                            >
                                <Icon className="h-4 w-4" aria-hidden="true" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className="p-4">
                {active === "copy" ? (
                    <div className="space-y-4">
                        <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                            <div className="flex items-center justify-between gap-3">
                                <label htmlFor="external-publishing-title-options" className="text-sm font-semibold text-foreground">Title options</label>
                                <CopyButton value={titles[0] ?? ""} label="Copy title" />
                            </div>
                            <textarea id="external-publishing-title-options" readOnly value={titles.join("\n") || "Generate this package to receive title options."} className="mt-2 min-h-24 w-full rounded-md border border-input bg-background p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                            <p className="mt-2 text-xs text-muted-foreground">Guidance: keep titles native to the destination community, avoid exaggerated claims, and choose the version that sounds useful without sounding promotional.</p>
                        </div>
                        <CopyPanel id="external-publishing-platform-body" label="Platform body" value={platformCopy || "Generate this package to produce platform-ready copy."} />
                    </div>
                ) : null}
                {active === "nolink" ? (
                    <div className="space-y-3">
                        <CopyPanel id="external-publishing-no-link-body" label="No-link fallback" value={noLink || "No no-link version is available yet."} />
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
                            <strong>Community caution:</strong> use this version when the destination discourages links, when you are new to a community, or when the answer should stand alone before any owned-resource reference.
                        </div>
                    </div>
                ) : null}
                {active === "visuals" ? (
                    <div className="space-y-3">
                        <div className="space-y-3">
                            {renderedVisuals.length ? (
                                renderedVisuals.map((visual) => (
                                    <VisualExportCard
                                        key={visual.id}
                                        visual={visual}
                                        filename={externalPublishingVisualFilename({ ...pkg, visualTitle: visual.title })}
                                    />
                                ))
                            ) : (
                                <div className="rounded-xl border border-dashed border-border/70 bg-background/70 p-6 text-sm text-muted-foreground">
                                    <p className="font-semibold text-foreground">No renderable visuals yet</p>
                                    <p className="mt-2">Generate this package to render Mermaid diagrams, chart specs, or image prompt cards here.</p>
                                </div>
                            )}
                        </div>
                        <StructuredPanel label="Visual and upload plan" value={visualPlan} helper="Upload images manually. Use descriptive alt text, cite the source of any diagram data, and avoid implying platform endorsement." />
                        <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-foreground">Asset Library manifests</p>
                                    <p className="mt-1 text-xs leading-5 text-muted-foreground">Create a manifest-only asset row from the visual plan. Storage fields stay empty until a human uploads or generates a final asset.</p>
                                </div>
                                <Button type="button" size="sm" variant="outline" onClick={createAssetManifest} disabled={isAssetPending}>{isAssetPending ? "Creating…" : "Create manifest"}</Button>
                            </div>
                            {assetFeedback ? <p className="mt-2 text-xs text-muted-foreground" role="status">{assetFeedback}</p> : null}
                            <div className="mt-3 space-y-2">
                                {assets.length === 0 ? <p className="text-xs text-muted-foreground">No package assets stored yet.</p> : assets.map((asset) => <AssetReference key={asset.id} asset={asset} />)}
                            </div>
                        </div>
                    </div>
                ) : null}
                {active === "links" ? (
                    <StructuredPanel label="Canonical links and UTM plan" value={{ targetUrl: pkg.target_url, utmSource: pkg.utm_source, utmMedium: pkg.utm_medium, utmCampaign: pkg.utm_campaign, utmContent: pkg.utm_content, ...linkPlan }} helper="Canonical/source note guidance: disclose owned links where appropriate and keep UTM parameters intact for attribution." />
                ) : null}
                {active === "evidence" ? (
                    <StructuredPanel label="Evidence pack" value={pkg.evidence_pack} helper="Only repeat claims supported by the evidence pack. If source context is thin, phrase the post as a practical checklist instead of a factual claim." />
                ) : null}
                {active === "compliance" ? (
                    <StructuredPanel label="Compliance and validation" value={{ validation: pkg.validation_result, warnings: pkg.compliance_warnings, status: pkg.status }} helper="Visible warnings are review blockers when they mention unsupported claims, link stuffing, subreddit rules, or missing caveats." />
                ) : null}
                {active === "performance" ? (
                    <PerformancePanel performance={performance ?? null} />
                ) : null}
            </div>
        </section>
    );
}

function AssetReference({ asset }: { asset: ExternalPublicationAssetRow }) {
    const metadata = asRecord(asset.metadata);
    const imagePrompt = typeof metadata.imagePrompt === "string" ? metadata.imagePrompt : "";
    const mermaid = typeof metadata.mermaid === "string" ? metadata.mermaid : asset.markdown_embed ?? "";
    const renderedAsset = extractExternalPublishingVisualFromAsset(asset);
    return (
        <div className="rounded-lg border border-border/60 bg-card/70 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <p className="font-medium text-foreground">{asset.title}</p>
                    <p className="text-xs text-muted-foreground">{asset.asset_type} · {asset.public_url ? "uploaded" : "manifest only"}</p>
                </div>
                <div className="flex gap-2">
                    {imagePrompt ? <CopyButton value={imagePrompt} label="Copy prompt" /> : null}
                    {mermaid ? <CopyButton value={mermaid} label="Copy Mermaid" /> : null}
                </div>
            </div>
            {asset.alt_text ? <p className="mt-2 text-xs text-muted-foreground">Alt: {asset.alt_text}</p> : null}
            {renderedAsset ? (
                <div className="mt-3">
                    <VisualExportCard visual={renderedAsset} filename={`external-publishing-asset-${asset.id}-visual.png`} />
                </div>
            ) : null}
        </div>
    );
}

function PerformancePanel({ performance }: { performance: ExternalPublishingAttributionSummary | null }) {
    if (!performance) {
        return (
            <div className="rounded-xl border border-dashed border-border/70 bg-background/70 p-6 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">No attribution summary loaded</p>
                <p className="mt-2">Refresh the dashboard after publication or export to load package-level UTM/referrer attribution.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="Attributed events" value={performance.totalEvents} />
                <Metric label="Page views" value={performance.pageViews} />
                <Metric label="CTA clicks" value={performance.ctaClicks} />
                <Metric label="Conversions" value={performance.conversions} />
                <Metric label="UTM matches" value={performance.utmMatchedEvents} />
                <Metric label="Referrer matches" value={performance.referrerMatchedEvents} />
            </div>
            <div className="rounded-xl border border-border/60 bg-background/70 p-3 text-sm text-muted-foreground">
                <p><span className="font-medium text-foreground">Last seen:</span> {performance.lastSeenAt ?? "No traffic yet"}</p>
                <p className="mt-1"><span className="font-medium text-foreground">No-traffic follow-up:</span> {performance.staleNoTraffic ? "Eligible for manual review after the follow-up window" : "Not currently stale"}</p>
                <p className="mt-2 font-medium text-foreground">Top referrers</p>
                {performance.topReferrers.length ? (
                    <ul className="mt-1 list-disc pl-5">
                        {performance.topReferrers.map((referrer) => <li key={referrer.host}>{referrer.host}: {referrer.count}</li>)}
                    </ul>
                ) : <p className="mt-1">No referrer hosts matched yet.</p>}
            </div>
        </div>
    );
}

function Metric({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-xl border border-border/60 bg-background/70 p-3">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
        </div>
    );
}

function CopyPanel({ id, label, value }: { id: string; label: string; value: string }) {
    return (
        <div className="rounded-xl border border-border/60 bg-background/70 p-3">
            <div className="flex items-center justify-between gap-3">
                <label htmlFor={id} className="text-sm font-semibold text-foreground">{label}</label>
                <CopyButton value={value} />
            </div>
            <textarea id={id} readOnly value={value} className="mt-2 min-h-80 w-full rounded-md border border-input bg-background p-3 font-mono text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
    );
}

function StructuredPanel({ label, value, helper }: { label: string; value: unknown; helper: string }) {
    const text = stringify(value);
    return (
        <div className="space-y-3">
            <CopyPanel id={`external-publishing-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} label={label} value={text} />
            <p className="rounded-xl border border-border/60 bg-background/70 p-3 text-sm text-muted-foreground">{helper}</p>
        </div>
    );
}
