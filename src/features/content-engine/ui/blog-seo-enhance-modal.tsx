"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2, Sparkles, X, Check, Link as LinkIcon, Type, Tag } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import type {
    BlogEnhancementCategory,
    BlogEnhancementPreview,
    BlogEnhancementProposal,
    BlogEnhancementRiskFlag,
} from "@/features/seo/types";
import { applyBlogPostSeoEnhancement } from "@/features/seo/actions";

const CATEGORY_META: Record<BlogEnhancementCategory, { label: string; Icon: typeof LinkIcon }> = {
    links: { label: "Links", Icon: LinkIcon },
    copy: { label: "Copy", Icon: Type },
    meta: { label: "Meta", Icon: Tag },
};

const RISK_LABELS: Record<BlogEnhancementRiskFlag, string> = {
    changes_meaning: "may change meaning",
    external_link_unverified: "external URL not verified",
    strips_attribution: "may strip attribution",
    heading_level_shift: "heading level change",
    blocked_domain: "blocked domain",
};

interface BlogSeoEnhanceModalProps {
    preview: BlogEnhancementPreview;
    onClose: () => void;
    onApplied: (appliedCount: number) => void;
}

export function BlogSeoEnhanceModal({ preview, onClose, onApplied }: BlogSeoEnhanceModalProps) {
    const [mounted, setMounted] = useState(false);
    const [activeCategory, setActiveCategory] = useState<BlogEnhancementCategory | "all">("all");
    const [acceptedIds, setAcceptedIds] = useState<Set<string>>(() => defaultAcceptedIds(preview.proposals));
    const [isApplying, startApply] = useTransition();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !isApplying) onClose();
        };
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [isApplying, onClose]);

    const proposalsByCategory = useMemo(() => {
        const grouped: Record<BlogEnhancementCategory, BlogEnhancementProposal[]> = { links: [], copy: [], meta: [] };
        for (const p of preview.proposals) grouped[p.category].push(p);
        return grouped;
    }, [preview.proposals]);

    const visibleProposals = activeCategory === "all"
        ? preview.proposals
        : proposalsByCategory[activeCategory];

    const toggleProposal = (id: string) => {
        setAcceptedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = (checked: boolean) => {
        if (checked) setAcceptedIds(new Set(preview.proposals.map((p) => p.id)));
        else setAcceptedIds(new Set());
    };

    const handleApply = () => {
        if (acceptedIds.size === 0) return;
        setError(null);
        startApply(async () => {
            const result = await applyBlogPostSeoEnhancement({
                runId: preview.runId,
                acceptedProposalIds: Array.from(acceptedIds),
            });
            if (result.error || !result.data) {
                setError(result.error ?? "Failed to apply enhancement.");
                return;
            }
            if (result.feedbackWarnings && result.feedbackWarnings.length > 0) {
                // Apply succeeded, but observability writes reported issues.
                // Show them transiently before dismissing so the operator can
                // flag them for the team without blocking the success flow.
                console.warn("[seo-enhance] feedback warnings:", result.feedbackWarnings);
                setError(
                    `Applied, but with warnings: ${result.feedbackWarnings.slice(0, 3).join(" · ")}`,
                );
            }
            onApplied(result.data.appliedCount);
        });
    };

    const expiresAt = new Date(preview.expiresAt).getTime();
    const minutesLeft = Math.max(0, Math.floor((expiresAt - Date.now()) / 60_000));

    if (!mounted) return null;

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="blog-seo-enhance-title"
            className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget && !isApplying) onClose(); }}
        >
            <div className="relative w-full max-w-5xl max-h-[90vh] rounded-2xl border border-white/10 bg-slate-950 text-slate-100 shadow-2xl flex flex-col overflow-hidden">
                <header className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-4">
                    <div className="flex items-start gap-3">
                        <div className="mt-1 rounded-lg bg-cyan-500/15 p-2 text-cyan-300">
                            <Sparkles className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 id="blog-seo-enhance-title" className="text-base font-semibold">
                                SEO Enhancement
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {preview.proposals.length} proposals · preview expires in {minutesLeft}m
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isApplying}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-100 disabled:opacity-40"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </header>

                <nav className="flex items-center gap-1 border-b border-white/10 px-6 py-2 text-xs">
                    <CategoryTab
                        label="All"
                        count={preview.proposals.length}
                        active={activeCategory === "all"}
                        onClick={() => setActiveCategory("all")}
                    />
                    {(["links", "copy", "meta"] as BlogEnhancementCategory[]).map((cat) => {
                        const { label, Icon } = CATEGORY_META[cat];
                        return (
                            <CategoryTab
                                key={cat}
                                label={label}
                                count={proposalsByCategory[cat].length}
                                active={activeCategory === cat}
                                onClick={() => setActiveCategory(cat)}
                                Icon={Icon}
                            />
                        );
                    })}
                    <div className="ml-auto flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => toggleAll(true)}
                            disabled={isApplying}
                            className="text-[11px] uppercase tracking-wider text-slate-400 hover:text-cyan-300 disabled:opacity-40"
                        >
                            Select all
                        </button>
                        <span className="text-slate-600">·</span>
                        <button
                            type="button"
                            onClick={() => toggleAll(false)}
                            disabled={isApplying}
                            className="text-[11px] uppercase tracking-wider text-slate-400 hover:text-destructive disabled:opacity-40"
                        >
                            Reject all
                        </button>
                    </div>
                </nav>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                    {visibleProposals.length === 0 ? (
                        <p className="text-sm text-slate-500 py-12 text-center">
                            No proposals in this category.
                        </p>
                    ) : (
                        visibleProposals.map((proposal) => (
                            <ProposalCard
                                key={proposal.id}
                                proposal={proposal}
                                accepted={acceptedIds.has(proposal.id)}
                                onToggle={() => toggleProposal(proposal.id)}
                                disabled={isApplying}
                            />
                        ))
                    )}
                </div>

                <footer className="flex items-center justify-between gap-4 border-t border-white/10 bg-slate-950/80 px-6 py-4">
                    <div className="text-xs text-slate-400">
                        {error ? (
                            <span className="text-destructive">{error}</span>
                        ) : (
                            <>Applying will modify the post. Rollback available afterwards.</>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" onClick={onClose} disabled={isApplying}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleApply}
                            disabled={isApplying || acceptedIds.size === 0}
                            className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                        >
                            {isApplying ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Check className="mr-2 h-4 w-4" />
                            )}
                            Accept {acceptedIds.size} of {preview.proposals.length} · Apply
                        </Button>
                    </div>
                </footer>
            </div>
        </div>,
        document.body
    );
}

function defaultAcceptedIds(proposals: BlogEnhancementProposal[]): Set<string> {
    const ids = new Set<string>();
    for (const p of proposals) {
        const hasHardRisk = p.riskFlags.some((f) => f === "changes_meaning" || f === "external_link_unverified" || f === "blocked_domain");
        if (!hasHardRisk) ids.add(p.id);
    }
    return ids;
}

function CategoryTab({
    label, count, active, onClick, Icon,
}: {
    label: string;
    count: number;
    active: boolean;
    onClick: () => void;
    Icon?: typeof LinkIcon;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors",
                active
                    ? "bg-white/10 text-slate-100"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
            )}
        >
            {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
            <span>{label}</span>
            <span className={cn("rounded-full px-1.5 py-0.5 text-[10px]", active ? "bg-slate-950 text-slate-100" : "bg-white/5 text-slate-400")}>
                {count}
            </span>
        </button>
    );
}

interface ProposalCardProps {
    proposal: BlogEnhancementProposal;
    accepted: boolean;
    onToggle: () => void;
    disabled: boolean;
}

function ProposalCard({ proposal, accepted, onToggle, disabled }: ProposalCardProps) {
    const { Icon } = CATEGORY_META[proposal.category];
    return (
        <div
            className={cn(
                "rounded-xl border px-4 py-3 transition-colors",
                accepted ? "border-cyan-500/40 bg-cyan-500/[0.04]" : "border-white/10 bg-white/[0.02]",
            )}
        >
            <div className="flex items-start gap-3">
                <input
                    type="checkbox"
                    checked={accepted}
                    onChange={onToggle}
                    disabled={disabled}
                    className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-900 accent-cyan-500"
                    aria-label={`Accept proposal: ${proposal.rationale}`}
                />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-400">
                        <Icon className="h-3 w-3" />
                        <span>{formatProposalType(proposal.type)}</span>
                        {proposal.metaPath ? (
                            <span className="text-slate-500">· {proposal.metaPath}</span>
                        ) : proposal.startOffset >= 0 ? (
                            <span className="text-slate-500">· offset {proposal.startOffset}</span>
                        ) : null}
                        {proposal.riskFlags.map((flag) => (
                            <span
                                key={flag}
                                className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300"
                            >
                                <AlertTriangle className="h-2.5 w-2.5" />
                                {RISK_LABELS[flag]}
                            </span>
                        ))}
                    </div>

                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <div className="rounded-md bg-slate-900/60 px-3 py-2 text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Before</div>
                            {proposal.original || <span className="text-slate-600 italic">(empty)</span>}
                        </div>
                        <div className="rounded-md bg-cyan-500/[0.06] border border-cyan-500/15 px-3 py-2 text-xs text-cyan-100 whitespace-pre-wrap font-mono leading-relaxed">
                            <div className="text-[10px] uppercase tracking-wider text-cyan-400 mb-1">After</div>
                            {proposal.proposed}
                        </div>
                    </div>

                    <p className="mt-2 text-xs text-slate-400 leading-relaxed">{proposal.rationale}</p>
                </div>
            </div>
        </div>
    );
}

function formatProposalType(type: BlogEnhancementProposal["type"]): string {
    switch (type) {
        case "internal_link_insertion": return "Internal link";
        case "external_reference_insertion": return "External reference";
        case "external_citation_sentence": return "External citation (new sentence)";
        case "paragraph_paraphrase": return "Paraphrase";
        case "meta_title_refresh": return "Meta title";
        case "meta_description_refresh": return "Meta description";
        case "editorial_validation_remediation": return "Editorial validation remediation";
        case "heading_optimization": return "Heading";
    }
}
