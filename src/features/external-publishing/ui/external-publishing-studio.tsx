"use client";

import { BarChart3, CheckCircle2, FilePlus2, Loader2, Search, Send, Settings2, Sparkles } from "lucide-react";
import type React from "react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    createExternalPublishingCampaignAction,
    createExternalPublishingPackageDraftAction,
    mineExternalPublishingOpportunitiesAction,
    syncExternalPublishingConversionFeedbackAction,
    upsertExternalPublishingPlatformProfileAction,
} from "@/features/external-publishing/actions";
import type { ExternalPublicationAssetRow, ExternalPublicationPackageRow, ExternalPublicationPlatform, ExternalPublicationPlatformProfileRow, ExternalPublicationSourceType } from "@/features/external-publishing/types";
import { EXTERNAL_PUBLICATION_PLATFORMS, EXTERNAL_PUBLICATION_SOURCE_TYPES } from "@/features/external-publishing/types";
import type { ExternalPublishingOpportunity } from "@/features/external-publishing/lib/opportunity-miner";
import type { ExternalPublishingAttributionSummary } from "@/features/external-publishing/lib/performance-attribution";
import type { ExternalPublishingGrowthLoopRow } from "@/features/external-publishing/lib/growth-loop-report";
import { DashboardAppWorkbench, AppCommandBar, AppMetric, AppMetricStrip } from "@/features/admin/ui/app-workbench";
import { Button } from "@/shared/ui/button";
import { PackageCard } from "./package-card";
import { PackageDetail } from "./package-detail";

type CampaignRow = {
    id: string;
    name: string;
    goal: string;
    utm_campaign: string;
    target_persona?: string | null;
};

type ExternalPublishingStudioData = {
    campaigns: unknown[];
    packages: ExternalPublicationPackageRow[];
    platformProfiles: ExternalPublicationPlatformProfileRow[];
    assetsByPackageId: Record<string, ExternalPublicationAssetRow[]>;
    activeResearchJobs: unknown[];
    recentEvents: unknown[];
    performanceByPackageId: Record<string, ExternalPublishingAttributionSummary>;
    growthLoop: ExternalPublishingGrowthLoopRow[];
    analytics: {
        packageCount: number;
        generatedCount: number;
        exportedCount: number;
        publishedManualCount: number;
    };
};

const STATUS_LANES: Array<{ key: string; title: string; description: string }> = [
    { key: "draft", title: "Drafts", description: "Briefed but not generated" },
    { key: "generated", title: "Generated", description: "Ready for human review" },
    { key: "needs_review", title: "Needs review", description: "Warnings or validation notes" },
    { key: "approved", title: "Approved", description: "Cleared for export" },
    { key: "exported", title: "Exported", description: "Copied or downloaded" },
    { key: "published_manual", title: "Published", description: "Manual URL recorded" },
];

function isCampaignRow(value: unknown): value is CampaignRow {
    return Boolean(value && typeof value === "object" && "id" in value && "name" in value && "utm_campaign" in value);
}

function slugify(value: string) {
    return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "external-publishing";
}

export function ExternalPublishingStudio({ initialData }: { initialData: ExternalPublishingStudioData }) {
    const router = useRouter();
    const [data] = useState(initialData);
    const [selectedPackageId, setSelectedPackageId] = useState<string | null>(data.packages[0]?.id ?? null);
    const [opportunities, setOpportunities] = useState<ExternalPublishingOpportunity[]>([]);
    const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
    const [isPending, startTransition] = useTransition();
    const campaigns = data.campaigns.filter(isCampaignRow);
    const selectedPackage = data.packages.find((pkg) => pkg.id === selectedPackageId) ?? data.packages[0] ?? null;

    const counts = useMemo(() => {
        const approved = data.packages.filter((pkg) => pkg.status === "approved").length;
        const review = data.packages.filter((pkg) => pkg.status === "needs_review").length;
        return { approved, review };
    }, [data.packages]);

    function run(label: string, runner: () => Promise<{ success: boolean; error?: string | null; data?: unknown }>, onSuccess?: (data: unknown) => void) {
        setFeedback(null);
        startTransition(async () => {
            const result = await runner();
            if (!result.success) {
                setFeedback({ kind: "error", message: result.error || `${label} failed.` });
                return;
            }
            setFeedback({ kind: "success", message: `${label} complete.` });
            onSuccess?.(result.data);
            router.refresh();
        });
    }

    return (
        <DashboardAppWorkbench className="bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.10),transparent_30%),hsl(var(--background))]">
            <AppCommandBar
                leading={
                    <div>
                        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
                            <Send className="h-3.5 w-3.5" aria-hidden="true" />
                            External Publishing Studio
                        </p>
                        <p className="mt-0.5 text-sm text-muted-foreground">Package useful off-site answers for manual review and publication.</p>
                    </div>
                }
                actions={
                    <Button type="button" onClick={() => run("Opportunity mining", () => mineExternalPublishingOpportunitiesAction(), (result) => setOpportunities(Array.isArray(result) ? result as ExternalPublishingOpportunity[] : []))} disabled={isPending}>
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
                        Mine opportunities
                    </Button>
                }
            />
            <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                    <AppMetricStrip>
                        <AppMetric label="Packages" value={data.analytics.packageCount} icon={FilePlus2} />
                        <AppMetric label="Generated" value={data.analytics.generatedCount} icon={Sparkles} />
                        <AppMetric label="Needs review" value={counts.review} icon={Search} />
                        <AppMetric label="Approved" value={counts.approved} icon={CheckCircle2} />
                        <AppMetric label="Manual publications" value={data.analytics.publishedManualCount} icon={BarChart3} />
                    </AppMetricStrip>

                    {feedback ? (
                        <div className={`rounded-2xl border p-3 text-sm ${feedback.kind === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-destructive/30 bg-destructive/10 text-destructive"}`} role="status">
                            {feedback.message}
                        </div>
                    ) : null}

                    <section className="grid gap-4 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
                        <div className="space-y-4">
                            <CampaignAndDraftPanel campaigns={campaigns} isPending={isPending} run={run} />
                            <PlatformProfilesPanel profiles={data.platformProfiles} isPending={isPending} run={run} />
                            <GrowthLoopPanel rows={data.growthLoop} isPending={isPending} run={run} />
                            <OpportunitiesPanel opportunities={opportunities} isPending={isPending} run={run} campaigns={campaigns} />
                            <PackageLanes packages={data.packages} selectedPackageId={selectedPackage?.id ?? null} onSelect={setSelectedPackageId} />
                        </div>
                        <PackageDetail pkg={selectedPackage} performance={selectedPackage ? data.performanceByPackageId[selectedPackage.id] ?? null : null} assets={selectedPackage ? data.assetsByPackageId[selectedPackage.id] ?? [] : []} />
                    </section>
                </div>
            </div>
        </DashboardAppWorkbench>
    );
}

function PlatformProfilesPanel({ profiles, isPending, run }: { profiles: ExternalPublicationPlatformProfileRow[]; isPending: boolean; run: (label: string, runner: () => Promise<{ success: boolean; error?: string | null; data?: unknown }>) => void }) {
    const [platform, setPlatform] = useState<ExternalPublicationPlatform>(profiles[0]?.platform ?? "linkedin");
    const current = profiles.find((profile) => profile.platform === platform);
    const [defaultDisclosure, setDefaultDisclosure] = useState(current?.default_disclosure ?? "");
    const [blockedCommunities, setBlockedCommunities] = useState((current?.blocked_communities ?? []).join("\n"));
    const [toneRules, setToneRules] = useState(JSON.stringify(current?.tone_rules ?? {}, null, 2));

    function loadProfile(nextPlatform: ExternalPublicationPlatform) {
        const next = profiles.find((profile) => profile.platform === nextPlatform);
        setPlatform(nextPlatform);
        setDefaultDisclosure(next?.default_disclosure ?? "");
        setBlockedCommunities((next?.blocked_communities ?? []).join("\n"));
        setToneRules(JSON.stringify(next?.tone_rules ?? {}, null, 2));
    }

    return (
        <section aria-labelledby="platform-profiles-title" className="rounded-3xl border border-border/60 bg-card/70 p-4 shadow-sm">
            <h2 id="platform-profiles-title" className="flex items-center gap-2 text-lg font-semibold text-foreground"><Settings2 className="h-5 w-5" aria-hidden="true" /> Platform rules</h2>
            <p className="mt-1 text-sm text-muted-foreground">Workspace-level defaults are used during generation and review. They never enable auto-posting.</p>
            <form className="mt-4 space-y-3" onSubmit={(event) => {
                event.preventDefault();
                let parsedToneRules: Record<string, unknown> = {};
                try { parsedToneRules = JSON.parse(toneRules || "{}"); } catch { parsedToneRules = { parseWarning: "Invalid JSON in UI; saved as note", raw: toneRules }; }
                run("Platform profile save", () => upsertExternalPublishingPlatformProfileAction({
                    platform,
                    defaultDisclosure: defaultDisclosure || null,
                    blockedCommunities: blockedCommunities.split(/\n|,/).map((item) => item.trim()).filter(Boolean),
                    preferredCommunities: [],
                    toneRules: parsedToneRules,
                    metadata: { source: "external_publishing_studio" },
                }));
            }}>
                <Field id="profile-platform" label="Platform">
                    <select id="profile-platform" value={platform} onChange={(event) => loadProfile(event.target.value as ExternalPublicationPlatform)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                        {EXTERNAL_PUBLICATION_PLATFORMS.map((item) => <option key={item} value={item}>{item.replace(/_/g, " ")}</option>)}
                    </select>
                </Field>
                <Field id="profile-disclosure" label="Default disclosure">
                    <textarea id="profile-disclosure" value={defaultDisclosure} onChange={(event) => setDefaultDisclosure(event.target.value)} placeholder="Disclosure for owned links or company affiliation." className="min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </Field>
                <Field id="profile-blocked" label="Blocked communities / destinations">
                    <textarea id="profile-blocked" value={blockedCommunities} onChange={(event) => setBlockedCommunities(event.target.value)} placeholder="One per line" className="min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </Field>
                <Field id="profile-tone" label="Tone rules JSON">
                    <textarea id="profile-tone" value={toneRules} onChange={(event) => setToneRules(event.target.value)} className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
                </Field>
                <Button type="submit" size="sm" disabled={isPending}>Save platform rules</Button>
            </form>
        </section>
    );
}

function GrowthLoopPanel({ rows, isPending, run }: { rows: ExternalPublishingGrowthLoopRow[]; isPending: boolean; run: (label: string, runner: () => Promise<{ success: boolean; error?: string | null; data?: unknown }>) => void }) {
    return (
        <section aria-labelledby="growth-loop-title" className="rounded-3xl border border-border/60 bg-card/70 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h2 id="growth-loop-title" className="text-lg font-semibold text-foreground">Growth-loop reporting</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Signal → package → platform → URL → traffic → conversion → follow-up.</p>
                </div>
                <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => run("Conversion feedback sync", () => syncExternalPublishingConversionFeedbackAction())}>Sync feedback</Button>
            </div>
            <div className="mt-4 max-h-80 overflow-auto rounded-xl border border-border/60">
                <table className="min-w-full text-left text-xs">
                    <thead className="bg-muted/50 text-muted-foreground">
                        <tr><th className="px-3 py-2">Signal</th><th className="px-3 py-2">Platform</th><th className="px-3 py-2">URL</th><th className="px-3 py-2">Traffic</th><th className="px-3 py-2">Conv.</th><th className="px-3 py-2">Follow-up</th></tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? <tr><td className="px-3 py-4 text-muted-foreground" colSpan={6}>No growth-loop rows yet.</td></tr> : rows.slice(0, 20).map((row) => (
                            <tr key={row.packageId} className="border-t border-border/60">
                                <td className="px-3 py-2"><p className="font-medium text-foreground">{row.sourceType}</p><p className="text-muted-foreground">{row.topic}</p></td>
                                <td className="px-3 py-2 text-muted-foreground">{row.platform}<br />{row.packageStatus}</td>
                                <td className="max-w-[180px] truncate px-3 py-2 text-muted-foreground">{row.manualUrl ?? "Not published"}</td>
                                <td className="px-3 py-2 text-foreground">{row.totalTraffic}</td>
                                <td className="px-3 py-2 text-foreground">{row.conversions}</td>
                                <td className="px-3 py-2 text-muted-foreground">{row.latestFollowUp ?? "None"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

function CampaignAndDraftPanel({ campaigns, isPending, run }: { campaigns: CampaignRow[]; isPending: boolean; run: (label: string, runner: () => Promise<{ success: boolean; error?: string | null; data?: unknown }>) => void }) {
    const [campaignName, setCampaignName] = useState("");
    const [goal, setGoal] = useState("");
    const [topic, setTopic] = useState("");
    const [targetUrl, setTargetUrl] = useState("");
    const [platform, setPlatform] = useState<ExternalPublicationPlatform>("linkedin");
    const [sourceType, setSourceType] = useState<ExternalPublicationSourceType>("manual_brief");
    const [campaignId, setCampaignId] = useState<string>("");

    return (
        <section aria-labelledby="campaign-draft-title" className="rounded-3xl border border-border/60 bg-card/70 p-4 shadow-sm">
            <h2 id="campaign-draft-title" className="text-lg font-semibold text-foreground">Campaign + package setup</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Create a reviewed campaign or brief a manual package. Nothing is published automatically.</p>
            <form
                className="mt-4 space-y-3"
                onSubmit={(event) => {
                    event.preventDefault();
                    run("Campaign creation", () => createExternalPublishingCampaignAction({ name: campaignName, goal, targetPersona: null, targetGeographies: [], utmCampaign: slugify(campaignName), metadata: { source: "dashboard" } }));
                    setCampaignName("");
                    setGoal("");
                }}
            >
                <Field id="campaign-name" label="Campaign name">
                    <input id="campaign-name" value={campaignName} onChange={(event) => setCampaignName(event.target.value)} required minLength={3} placeholder="Q3 governed visibility" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </Field>
                <Field id="campaign-goal" label="Campaign goal">
                    <textarea id="campaign-goal" value={goal} onChange={(event) => setGoal(event.target.value)} required minLength={8} placeholder="Help operators understand where governed workflows outperform scattered tools." className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </Field>
                <Button type="submit" size="sm" disabled={isPending || !campaignName || !goal}>Create campaign</Button>
            </form>
            <form
                className="mt-5 space-y-3 border-t border-border/60 pt-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    const campaign = campaigns.find((item) => item.id === campaignId);
                    run("Package draft creation", () => createExternalPublishingPackageDraftAction({
                        campaignId: campaignId || null,
                        platform,
                        locale: "en",
                        sourceType,
                        topic,
                        targetUrl,
                        targetSlug: null,
                        primaryQuery: topic,
                        utmSource: platform,
                        utmMedium: "external_publishing",
                        utmCampaign: campaign?.utm_campaign || slugify(topic),
                        utmContent: slugify(`${platform}-${topic}`),
                        metadata: { source: "dashboard_manual_brief" },
                    }));
                    setTopic("");
                    setTargetUrl("");
                }}
            >
                <div className="grid gap-3 sm:grid-cols-2">
                    <Field id="package-platform" label="Platform">
                        <select id="package-platform" value={platform} onChange={(event) => setPlatform(event.target.value as ExternalPublicationPlatform)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                            {EXTERNAL_PUBLICATION_PLATFORMS.map((item) => <option key={item} value={item}>{item.replace(/_/g, " ")}</option>)}
                        </select>
                    </Field>
                    <Field id="package-source-type" label="Source type">
                        <select id="package-source-type" value={sourceType} onChange={(event) => setSourceType(event.target.value as ExternalPublicationSourceType)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                            {EXTERNAL_PUBLICATION_SOURCE_TYPES.map((item) => <option key={item} value={item}>{item.replace(/_/g, " ")}</option>)}
                        </select>
                    </Field>
                </div>
                <Field id="package-campaign" label="Campaign">
                    <select id="package-campaign" value={campaignId} onChange={(event) => setCampaignId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                        <option value="">No campaign</option>
                        {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
                    </select>
                </Field>
                <Field id="package-topic" label="Topic / title field guidance">
                    <input id="package-topic" value={topic} onChange={(event) => setTopic(event.target.value)} required minLength={3} placeholder="Workflow governance checklist for agencies" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </Field>
                <Field id="package-target-url" label="Canonical target URL">
                    <input id="package-target-url" type="url" value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} required placeholder="https://example.com/resource" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </Field>
                <Button type="submit" size="sm" disabled={isPending || !topic || !targetUrl}>Create package draft</Button>
            </form>
        </section>
    );
}

function OpportunitiesPanel({ opportunities, isPending, run, campaigns }: { opportunities: ExternalPublishingOpportunity[]; isPending: boolean; campaigns: CampaignRow[]; run: (label: string, runner: () => Promise<{ success: boolean; error?: string | null; data?: unknown }>) => void }) {
    return (
        <section aria-labelledby="opportunities-title" className="rounded-3xl border border-border/60 bg-card/70 p-4 shadow-sm">
            <h2 id="opportunities-title" className="text-lg font-semibold text-foreground">Opportunities panel</h2>
            <p className="mt-1 text-sm text-muted-foreground">Mine deterministic source opportunities, then create draft packages for manual review.</p>
            <div className="mt-4 max-h-96 space-y-3 overflow-y-auto pr-1">
                {opportunities.length === 0 ? <p className="rounded-2xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">No mined opportunities in this view yet. Run mining to surface SEO, content, and market-signal candidates.</p> : opportunities.map((opportunity) => (
                    <div key={opportunity.id} className="rounded-2xl border border-border/60 bg-background/70 p-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{opportunity.sourceType.replace(/_/g, " ")} · Score {opportunity.score}/100</p>
                                <h3 className="mt-1 text-sm font-semibold text-foreground">{opportunity.title}</h3>
                                <p className="mt-1 text-xs text-muted-foreground">{opportunity.scoreReasons.join(", ") || "Workspace signal"}</p>
                            </div>
                            <Button type="button" size="xs" variant="outline" disabled={isPending} onClick={() => run("Opportunity package draft", () => createExternalPublishingPackageDraftAction({
                                campaignId: campaigns[0]?.id ?? null,
                                platform: "linkedin",
                                locale: opportunity.locale,
                                sourceType: opportunity.sourceType,
                                sourceContentId: opportunity.sourceContentId ?? null,
                                sourceSeoPlanId: opportunity.sourceSeoPlanId ?? null,
                                sourceSeoOpportunityId: opportunity.sourceSeoOpportunityId ?? null,
                                topic: opportunity.topic,
                                primaryQuery: opportunity.primaryQuery ?? opportunity.topic,
                                targetUrl: opportunity.targetUrl,
                                targetSlug: opportunity.targetSlug ?? null,
                                utmSource: "linkedin",
                                utmMedium: "external_publishing",
                                utmCampaign: campaigns[0]?.utm_campaign ?? slugify(opportunity.topic),
                                utmContent: slugify(`linkedin-${opportunity.topic}`),
                                metadata: { opportunityId: opportunity.id, provenance: opportunity.provenance },
                            }))}>Draft</Button>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

function PackageLanes({ packages, selectedPackageId, onSelect }: { packages: ExternalPublicationPackageRow[]; selectedPackageId: string | null; onSelect: (id: string) => void }) {
    return (
        <section aria-labelledby="package-lanes-title" className="rounded-3xl border border-border/60 bg-card/70 p-4 shadow-sm">
            <h2 id="package-lanes-title" className="text-lg font-semibold text-foreground">Package lanes</h2>
            <p className="mt-1 text-sm text-muted-foreground">Status lanes keep the workflow review-first: draft → generate → approve → export → publish manually.</p>
            <div className="mt-4 grid gap-4">
                {STATUS_LANES.map((lane) => {
                    const lanePackages = packages.filter((pkg) => pkg.status === lane.key);
                    return (
                        <div key={lane.key} className="rounded-2xl border border-border/60 bg-background/50 p-3">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground">{lane.title}</h3>
                                    <p className="text-xs text-muted-foreground">{lane.description}</p>
                                </div>
                                <span className="rounded-full border border-border/70 bg-card px-2 py-0.5 text-xs text-muted-foreground">{lanePackages.length}</span>
                            </div>
                            <div className="space-y-3">
                                {lanePackages.length === 0 ? <p className="text-xs text-muted-foreground">No packages in this lane.</p> : lanePackages.map((pkg) => <PackageCard key={pkg.id} pkg={pkg} selected={pkg.id === selectedPackageId} onSelect={() => onSelect(pkg.id)} />)}
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
    return (
        <div>
            <label htmlFor={id} className="text-sm font-medium text-foreground">{label}</label>
            <div className="mt-1">{children}</div>
        </div>
    );
}
