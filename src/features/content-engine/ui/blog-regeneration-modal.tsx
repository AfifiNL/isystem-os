"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, FileText, Loader2, Search, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { applyBlogPostRegeneration, type BlogRegenerationPreview } from "@/features/seo/blog-regeneration-actions";

interface BlogRegenerationModalProps {
    preview: BlogRegenerationPreview;
    onClose: () => void;
    onApplied: () => void;
}

export function BlogRegenerationModal({ preview, onClose, onApplied }: BlogRegenerationModalProps) {
    const [mounted, setMounted] = useState(false);
    const [isApplying, startApply] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<"article" | "seo" | "signals">("article");

    useEffect(() => setMounted(true), []);
    useEffect(() => {
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !isApplying) onClose();
        };
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [isApplying, onClose]);

    const minutesLeft = useMemo(() => {
        return Math.max(0, Math.floor((new Date(preview.expiresAt).getTime() - Date.now()) / 60_000));
    }, [preview.expiresAt]);

    const handleApply = () => {
        setError(null);
        startApply(async () => {
            const result = await applyBlogPostRegeneration(preview.runId);
            if (result.error || !result.data) {
                setError(result.error ?? "Failed to apply regenerated post.");
                return;
            }
            onApplied();
        });
    };

    if (!mounted) return null;

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="blog-regeneration-title"
            className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/75 p-4 text-slate-100 backdrop-blur-sm"
            onClick={(event) => {
                if (event.target === event.currentTarget && !isApplying) onClose();
            }}
        >
            <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl">
                <header className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-4">
                    <div className="flex items-start gap-3">
                        <div className="mt-1 rounded-lg bg-cyan-500/15 p-2 text-cyan-300">
                            <FileText className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 id="blog-regeneration-title" className="text-base font-semibold">
                                Regeneration Preview
                            </h2>
                            <p className="mt-0.5 text-xs text-slate-400">
                                Full replacement draft · preview expires in {minutesLeft}m · submitted indexing is not guaranteed indexing
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
                    <TabButton active={tab === "article"} onClick={() => setTab("article")} label="Article" />
                    <TabButton active={tab === "seo"} onClick={() => setTab("seo")} label="SEO" />
                    <TabButton active={tab === "signals"} onClick={() => setTab("signals")} label="Signals" />
                </nav>

                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                    {tab === "article" ? (
                        <div className="grid gap-4 lg:grid-cols-2">
                            <PreviewPane title="Current" text={preview.markdownBefore} />
                            <PreviewPane title="Regenerated" text={preview.markdownAfter} />
                        </div>
                    ) : null}

                    {tab === "seo" ? (
                        <div className="grid gap-4 lg:grid-cols-2">
                            <SeoPane title="Current" seo={preview.seoBefore} excerpt={preview.excerptBefore} faqs={preview.faqsBefore} />
                            <SeoPane title="Regenerated" seo={preview.seoAfter} excerpt={preview.excerptAfter} faqs={preview.faqsAfter} />
                        </div>
                    ) : null}

                    {tab === "signals" ? (
                        <div className="space-y-4">
                            <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                                    <Search className="h-4 w-4 text-cyan-300" />
                                    Search Console Signals
                                </h3>
                                <div className="mt-3 grid gap-2">
                                    {preview.gscSignals.length === 0 ? (
                                        <p className="text-sm text-slate-400">No fresh GSC rows matched this post. The rewrite used metadata, evidence, and internal inventory instead.</p>
                                    ) : preview.gscSignals.map((signal) => (
                                        <div key={`${signal.page_slug}-${signal.query}`} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-slate-300">
                                            <p className="font-semibold text-slate-100">{signal.query}</p>
                                            <p className="mt-1">
                                                {signal.total_impressions} impressions · {signal.total_clicks} clicks · {(signal.avg_ctr * 100).toFixed(2)}% CTR · avg position {signal.avg_position.toFixed(1)} · {signal.signal_type}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                            <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                                <h3 className="text-sm font-semibold text-slate-100">Rationale</h3>
                                <ul className="mt-2 space-y-1 text-sm text-slate-300">
                                    {preview.rationale.map((item) => <li key={item}>{item}</li>)}
                                </ul>
                            </section>
                            {preview.warnings.length > 0 ? (
                                <section className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-amber-100">
                                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                                        <AlertTriangle className="h-4 w-4" />
                                        Warnings
                                    </h3>
                                    <ul className="mt-2 space-y-1 text-sm">
                                        {preview.warnings.map((item) => <li key={item}>{item}</li>)}
                                    </ul>
                                </section>
                            ) : null}
                        </div>
                    ) : null}
                </div>

                <footer className="flex items-center justify-between gap-4 border-t border-white/10 bg-slate-950/80 px-6 py-4">
                    <p className="text-xs text-slate-400">
                        {error ? <span className="text-destructive">{error}</span> : `Estimated AI charge: ${preview.totalEstimatedCostMillicents} millicents.`}
                    </p>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" onClick={onClose} disabled={isApplying}>Cancel</Button>
                        <Button onClick={handleApply} disabled={isApplying} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
                            {isApplying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                            Apply regenerated post
                        </Button>
                    </div>
                </footer>
            </div>
        </div>,
        document.body,
    );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${active ? "bg-white/10 text-slate-100" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}
        >
            {label}
        </button>
    );
}

function PreviewPane({ title, text }: { title: string; text: string }) {
    return (
        <section className="min-h-[520px] overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
            <div className="border-b border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</div>
            <pre className="max-h-[68vh] overflow-auto whitespace-pre-wrap p-4 text-xs leading-5 text-slate-300">{text}</pre>
        </section>
    );
}

function SeoPane({
    title,
    seo,
    excerpt,
    faqs,
}: {
    title: string;
    seo: { title: string; description: string; keywords: string[] };
    excerpt: string;
    faqs: Array<{ question: string; answer: string }>;
}) {
    return (
        <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
            <Field label="SEO title" value={seo.title} />
            <Field label="Meta description" value={seo.description} />
            <Field label="Excerpt" value={excerpt || "None"} />
            <Field label="Keywords" value={seo.keywords.join(", ") || "None"} />
            <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">FAQs</p>
                <div className="mt-2 space-y-2">
                    {faqs.length === 0 ? <p className="text-sm text-slate-400">None</p> : faqs.map((faq) => (
                        <div key={faq.question} className="rounded-lg border border-white/10 bg-slate-900 p-3 text-sm text-slate-300">
                            <p className="font-semibold text-slate-100">{faq.question}</p>
                            <p className="mt-1">{faq.answer}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

function Field({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
            <p className="mt-1 text-sm text-slate-300">{value}</p>
        </div>
    );
}
