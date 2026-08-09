"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { getContentItems, deleteContentItem, runWorkspaceContentFreshnessScanAction } from "../actions";
import { Button } from "@/shared/ui/button";
import { ActionButton } from "@/shared/ui/action-button";
import { AlertTriangle, Trash2, Edit, ExternalLink, RefreshCw, FileText, CheckCircle2, Clock3, Bot, PencilLine } from "lucide-react";
import { PremiumPanelSkeleton, PremiumTableSkeleton } from "@/shared/ui/loading";
import { AppMetric, AppMetricStrip } from "@/features/admin/ui/app-workbench";
import { canonicalBlogHref } from "@/features/blog/urls";

interface ContentItem {
    id: string;
    title: string;
    content_markdown: string;
    type: string;
    status: string;
    slug: string | null;
    created_at: string;
    author: { email: string } | null;
    metadata?: {
        source?: string;
        provenance?: {
            last_freshness_check?: {
                checked_at: string;
                verification_status: "fresh" | "stale" | "uncertain" | "evergreen" | "error";
                stale_indicators?: string[];
            };
        };
        [key: string]: unknown;
    } | null;
}

interface ContentFeedProps {
    sourceFilter?: "manual" | "ai-draft" | null;
}

export function ContentFeed({ sourceFilter = null }: ContentFeedProps) {
    const [rawItems, setRawItems] = useState<ContentItem[]>([]);
    const [items, setItems] = useState<ContentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [freshnessFilter, setFreshnessFilter] = useState<string>("all");
    const [isScanning, startScanTransition] = useTransition();
    const [scanMessage, setScanMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

    async function loadContent() {
        setLoading(true);
        const { data, error } = await getContentItems();
        if (!error && data) {
            // Only show blog-type content here — pages are managed in the builder
            const blogItems = (data as ContentItem[]).filter((item) => item.type === "blog" || !item.type);
            setRawItems(blogItems);
        }
        setLoading(false);
    }

    useEffect(() => {
        loadContent();
    }, []);

    useEffect(() => {
        let filtered = rawItems;

        // Apply source filter
        if (sourceFilter) {
            filtered = filtered.filter((item) => item.metadata?.source === sourceFilter);
        } else {
            filtered = filtered.filter((item) => item.metadata?.source !== "manual");
        }

        // Apply freshness filter
        if (freshnessFilter !== "all") {
            filtered = filtered.filter((item) => {
                const check = item.metadata?.provenance?.last_freshness_check;
                if (freshnessFilter === "stale") return check?.verification_status === "stale";
                if (freshnessFilter === "uncertain") return check?.verification_status === "uncertain";
                if (freshnessFilter === "fresh") return check?.verification_status === "fresh" || check?.verification_status === "evergreen";
                if (freshnessFilter === "unchecked") return !check;
                return true;
            });
        }

        setItems(filtered);
    }, [rawItems, sourceFilter, freshnessFilter]);

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this item?")) return;
        const result = await deleteContentItem(id);
        if (result.success) {
            setRawItems(rawItems.filter((item) => item.id !== id));
        } else {
            alert("Failed to delete content");
        }
    };

    const handleFreshnessScan = () => {
        startScanTransition(async () => {
            setScanMessage(null);
            const result = await runWorkspaceContentFreshnessScanAction();
            setScanMessage({
                tone: result.success ? "success" : "error",
                text: result.error ? `${result.message} ${result.error}` : result.message,
            });
            await loadContent();
        });
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <PremiumPanelSkeleton lines={3} />
                <PremiumTableSkeleton rows={4} columns={2} />
            </div>
        );
    }

    // Count stale items for the Attention Inbox banner (scoped to current source filter)
    const activeSourceItems = sourceFilter
        ? rawItems.filter((item) => item.metadata?.source === sourceFilter)
        : rawItems.filter((item) => item.metadata?.source !== "manual");

    const staleItemsCount = activeSourceItems.filter(
        (item) => item.metadata?.provenance?.last_freshness_check?.verification_status === "stale"
    ).length;
    const publishedCount = activeSourceItems.filter((item) => item.status === "published").length;
    const draftCount = activeSourceItems.filter((item) => item.status !== "published").length;
    const uncheckedCount = activeSourceItems.filter((item) => !item.metadata?.provenance?.last_freshness_check).length;
    const sourceLabel = sourceFilter === "manual" ? "Manual drafts" : sourceFilter === "ai-draft" ? "AI drafts" : "AI and published";

    return (
        <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-4">
            <AppMetricStrip className="grid-cols-2 rounded-md border border-border/60 bg-card/50 px-3 py-3 md:grid-cols-4">
                <AppMetric label="Library view" value={sourceLabel} icon={FileText} />
                <AppMetric label="Published" value={publishedCount} icon={CheckCircle2} variant="success" />
                <AppMetric label="Drafts" value={draftCount} icon={PencilLine} variant="info" />
                <AppMetric label="Needs review" value={staleItemsCount + uncheckedCount} icon={Clock3} variant={staleItemsCount > 0 ? "warning" : "default"} />
            </AppMetricStrip>

            {staleItemsCount > 0 && (
                <div className="flex items-center gap-3 rounded-md border border-red-500/20 bg-red-500/5 p-4 text-[15px] font-medium text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <div>
                        <span className="font-semibold">Attention required:</span> {staleItemsCount} published blog post{staleItemsCount > 1 ? "s have" : " has"} been flagged with stale claims. Please review and refresh their content.
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-card/70 p-3 text-[15px] shadow-sm lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="mr-1.5 pl-1.5 text-[14px] font-semibold uppercase text-muted-foreground">Freshness</span>
                    <button
                        onClick={() => setFreshnessFilter("all")}
                        className={`rounded-md px-3 py-1 font-medium transition-colors ${freshnessFilter === "all" ? "border bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        All posts
                    </button>
                    <button
                        onClick={() => setFreshnessFilter("stale")}
                        className={`rounded-md px-3 py-1 font-medium transition-colors ${freshnessFilter === "stale" ? "border border-red-500/20 bg-red-500/10 text-red-600" : "text-muted-foreground hover:text-red-500"}`}
                    >
                        Stale ({activeSourceItems.filter(i => i.metadata?.provenance?.last_freshness_check?.verification_status === "stale").length})
                    </button>
                    <button
                        onClick={() => setFreshnessFilter("uncertain")}
                        className={`rounded-md px-3 py-1 font-medium transition-colors ${freshnessFilter === "uncertain" ? "border border-amber-500/20 bg-amber-500/10 text-amber-600" : "text-muted-foreground hover:text-amber-500"}`}
                    >
                        Uncertain ({activeSourceItems.filter(i => i.metadata?.provenance?.last_freshness_check?.verification_status === "uncertain").length})
                    </button>
                    <button
                        onClick={() => setFreshnessFilter("fresh")}
                        className={`rounded-md px-3 py-1 font-medium transition-colors ${freshnessFilter === "fresh" ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-600" : "text-muted-foreground hover:text-emerald-500"}`}
                    >
                        Fresh / Evergreen ({activeSourceItems.filter(i => i.metadata?.provenance?.last_freshness_check?.verification_status === "fresh" || i.metadata?.provenance?.last_freshness_check?.verification_status === "evergreen").length})
                    </button>
                    <button
                        onClick={() => setFreshnessFilter("unchecked")}
                        className={`rounded-md px-3 py-1 font-medium transition-colors ${freshnessFilter === "unchecked" ? "border bg-muted text-muted-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        Unchecked ({activeSourceItems.filter(i => !i.metadata?.provenance?.last_freshness_check).length})
                    </button>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full shrink-0 gap-2 text-[15px] lg:w-auto"
                    disabled={isScanning}
                    onClick={handleFreshnessScan}
                >
                    <RefreshCw className={`h-4 w-4 ${isScanning ? "animate-spin" : ""}`} />
                    {isScanning ? "Scanning" : "Run scan"}
                </Button>
            </div>

            {scanMessage && (
                <div className={`rounded-md border px-3 py-2 text-[15px] ${
                    scanMessage.tone === "success"
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300"
                }`}>
                    {scanMessage.text}
                </div>
            )}

            {items.length === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-muted/20 p-12 text-center">
                    <h3 className="mb-2 text-[20px] font-medium">No Blog Posts Found</h3>
                    <p className="text-[15px] text-muted-foreground">Try adjusting your filters or create a new draft.</p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-md border border-border/60 bg-card/70 shadow-sm">
                    <div className="grid grid-cols-[minmax(0,1fr)_8rem_9rem] gap-3 border-b border-border/60 bg-muted/40 px-4 py-2 text-[13px] font-semibold uppercase text-muted-foreground md:grid-cols-[minmax(0,1fr)_8rem_9rem_8rem_10rem]">
                        <span>Title</span>
                        <span className="hidden md:block">Source</span>
                        <span>Status</span>
                        <span className="hidden md:block">Freshness</span>
                        <span className="text-right">Actions</span>
                    </div>
                    <div className="divide-y divide-border/50">
                        {items.map((item) => {
                            const isPublished = item.status === "published";
                            const slug = item.slug || item.id;
                            const isManual = item.metadata?.source === "manual";
                            const editHref = isManual ? `/dashboard/content/manual/${item.id}` : `/dashboard/content/${item.id}`;
                            const check = item.metadata?.provenance?.last_freshness_check;
                            const plainText = item.content_markdown.replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim();

                            return (
                                <div
                                    key={item.id}
                                    className="grid grid-cols-[minmax(0,1fr)_8rem_9rem] gap-3 px-4 py-3 transition-colors hover:bg-muted/25 md:grid-cols-[minmax(0,1fr)_8rem_9rem_8rem_10rem]"
                                >
                                    <div className="min-w-0">
                                        <div className="flex min-w-0 items-center gap-2">
                                            {isManual ? (
                                                <PencilLine className="h-4 w-4 shrink-0 text-muted-foreground" />
                                            ) : (
                                                <Bot className="h-4 w-4 shrink-0 text-primary" />
                                            )}
                                            <Link href={editHref} className="min-w-0 truncate text-[17px] font-semibold text-foreground hover:text-primary">
                                                {item.title}
                                            </Link>
                                        </div>
                                        <p className="mt-1 line-clamp-1 text-[15px] text-muted-foreground">
                                            {plainText || "No preview available."}
                                        </p>
                                        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
                                            <span>{item.author?.email || "Unknown"}</span>
                                            <span>·</span>
                                            <span>{new Date(item.created_at).toLocaleDateString()}</span>
                                            {slug ? (
                                                <>
                                                    <span className="hidden sm:inline">·</span>
                                                    <span className="hidden max-w-[14rem] truncate font-mono sm:inline">/blog/{slug}</span>
                                                </>
                                            ) : null}
                                        </div>
                                    </div>

                                    <div className="hidden items-center md:flex">
                                        <span className="rounded-md border border-border/60 bg-background px-2 py-1 text-[13px] font-semibold uppercase text-muted-foreground">
                                            {isManual ? "Manual" : "AI draft"}
                                        </span>
                                    </div>

                                    <div className="flex items-center">
                                        <span className={`rounded-md px-2 py-1 text-[13px] font-semibold uppercase ${
                                            isPublished
                                                ? "bg-emerald-500/10 text-emerald-600"
                                                : "bg-amber-500/10 text-amber-600"
                                        }`}>
                                            {isPublished ? "Published" : "Draft"}
                                        </span>
                                    </div>

                                    <div className="hidden items-center md:flex">
                                        {check ? (
                                            <span className={`rounded-md border px-2 py-1 text-[13px] font-semibold uppercase ${
                                                check.verification_status === "stale" ? "border-red-500/20 bg-red-500/10 text-red-600" :
                                                check.verification_status === "uncertain" ? "border-amber-500/20 bg-amber-500/10 text-amber-600" :
                                                "border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
                                            }`} title={check.verification_status === "stale" && check.stale_indicators?.length ? check.stale_indicators.join("\n") : undefined}>
                                                {check.verification_status === "stale" ? "Stale" : check.verification_status}
                                            </span>
                                        ) : (
                                            <span className="rounded-md border border-border/60 bg-background px-2 py-1 text-[13px] font-semibold uppercase text-muted-foreground">
                                                Unchecked
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-end gap-2">
                                        {isPublished ? (
                                            <a
                                                href={canonicalBlogHref("en", `/blog/${slug}`)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:text-foreground"
                                                aria-label={`View ${item.title} live`}
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                            </a>
                                        ) : null}
                                        <Link href={editHref} className="min-w-0">
                                            <Button variant="outline" size="icon-sm" aria-label={`Edit ${item.title}`}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                        </Link>
                                        <ActionButton
                                            variant="destructive"
                                            size="icon-sm"
                                            onAction={() => handleDelete(item.id)}
                                            idleIcon={<Trash2 className="h-4 w-4" />}
                                            pendingLabel="Deleting"
                                            aria-label={`Delete ${item.title}`}
                                        >
                                            <span className="sr-only">Delete</span>
                                        </ActionButton>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
