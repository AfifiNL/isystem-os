"use client";

import { useMemo, useState, useTransition } from "react";
import { BarChart3, Copy, FileCode2, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { updateContentItem } from "@/features/content-engine/actions";
import { BlogVisualBlockRenderer } from "./blog-visual-block";
import {
    BLOG_EVIDENCE_CONFIDENCES,
    BLOG_EVIDENCE_TYPES,
    BLOG_SOURCE_QUALITIES,
    createVisualShortcode,
    getVisualEnrichment,
    normalizeEvidenceForVisualBlock,
    type BlogEvidenceRecord,
    type BlogVisualBlock,
    type BlogVisualEnrichment,
} from "@/features/content-engine/visual-enrichment";

interface VisualInsightsNodeProps {
    item: {
        id: string;
        content_markdown: string;
        metadata?: Record<string, unknown>;
    };
}

function updateBlock(block: BlogVisualBlock, patch: Partial<BlogVisualBlock>): BlogVisualBlock {
    return { ...block, ...patch } as BlogVisualBlock;
}

function labelize(value: string) {
    return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <span>{label}</span>
            {children}
        </label>
    );
}

export function VisualInsightsNode({ item }: VisualInsightsNodeProps) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [content, setContent] = useState(item.content_markdown || "");
    const [blocks, setBlocks] = useState<BlogVisualBlock[]>(() => getVisualEnrichment(item.metadata).visual_blocks);
    const [selectedId, setSelectedId] = useState(blocks[0]?.id || "");
    const selectedBlock = blocks.find((block) => block.id === selectedId) || blocks[0] || null;
    const selectedEvidence = selectedBlock ? normalizeEvidenceForVisualBlock(selectedBlock, selectedBlock.evidence) : null;
    const shortcode = selectedBlock ? createVisualShortcode(selectedBlock.id) : "";
    const usedShortcodes = useMemo(() => new Set(Array.from(content.matchAll(/\{\{visual:([a-zA-Z0-9_-]+)\}\}/g)).map((match) => match[1])), [content]);

    const save = () => {
        setError(null);
        startTransition(async () => {
            const previous = getVisualEnrichment(item.metadata);
            const enrichment: BlogVisualEnrichment = {
                ...previous,
                schema_version: 2,
                generated_at: previous.generated_at || new Date().toISOString(),
                visual_blocks: blocks,
                evidence: blocks.map((block) => normalizeEvidenceForVisualBlock(block, block.evidence)),
            };
            const result = await updateContentItem(item.id, {
                content_markdown: content,
                metadata: {
                    ...item.metadata,
                    enrichment,
                },
            });
            if (result.error) setError(result.error);
        });
    };

    const insertSelected = () => {
        if (!shortcode) return;
        setContent((prev) => `${prev.trim()}\n\n${shortcode}\n`);
    };

    const removeSelected = () => {
        if (!selectedBlock) return;
        setBlocks((prev) => prev.filter((block) => block.id !== selectedBlock.id));
        setSelectedId(blocks.find((block) => block.id !== selectedBlock.id)?.id || "");
    };

    const updateSelected = (patch: Partial<BlogVisualBlock>) => {
        if (!selectedBlock) return;
        setBlocks((prev) => prev.map((block) => block.id === selectedBlock.id ? updateBlock(block, patch) : block));
    };

    const updateSelectedEvidence = (patch: Partial<BlogEvidenceRecord>) => {
        if (!selectedBlock) return;
        const current = normalizeEvidenceForVisualBlock(selectedBlock, selectedBlock.evidence);
        const evidence: BlogEvidenceRecord = {
            ...current,
            ...patch,
            claim_type: patch.evidence_type ?? patch.claim_type ?? current.claim_type,
            evidence_type: patch.evidence_type ?? current.evidence_type,
            visual_id: selectedBlock.id,
        };
        updateSelected({ evidence });
    };

    return (
        <div className="grid h-full gap-6 lg:grid-cols-[320px_1fr]">
            <aside className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Visual SEO</p>
                        <h2 className="mt-1 text-lg font-bold">Charts & diagrams</h2>
                    </div>
                    <Button onClick={save} disabled={isPending} size="sm">
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save
                    </Button>
                </div>
                {error ? <div className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">{error}</div> : null}
                <div className="space-y-2">
                    {blocks.length ? blocks.map((block) => (
                        <button
                            key={block.id}
                            type="button"
                            onClick={() => setSelectedId(block.id)}
                            className={`w-full rounded-xl border p-3 text-left transition ${selectedBlock?.id === block.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{block.type}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${usedShortcodes.has(block.id) ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>{usedShortcodes.has(block.id) ? "Embedded" : "Not embedded"}</span>
                            </div>
                            <p className="mt-2 line-clamp-2 text-sm font-semibold text-foreground">{block.title}</p>
                        </button>
                    )) : (
                        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                            No generated visual blocks yet. Regenerate a draft with charts and diagrams enabled.
                        </div>
                    )}
                </div>
            </aside>

            <main className="min-w-0 space-y-6 overflow-auto">
                {selectedBlock ? (
                    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
                        <section className="space-y-4">
                            <BlogVisualBlockRenderer block={selectedBlock} />
                            <div className="rounded-2xl border bg-card p-4 shadow-sm">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <h3 className="flex items-center gap-2 font-semibold"><FileCode2 className="h-4 w-4 text-primary" /> Article placement</h3>
                                    <Button size="sm" variant="outline" onClick={insertSelected}><Plus className="mr-2 h-4 w-4" /> Insert shortcode</Button>
                                </div>
                                <Input value={shortcode} readOnly className="font-mono text-xs" />
                                <Textarea value={content} onChange={(event) => setContent(event.target.value)} className="mt-3 min-h-72 font-mono text-xs" />
                            </div>
                        </section>
                        <aside className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm">
                            <h3 className="flex items-center gap-2 font-semibold"><BarChart3 className="h-4 w-4 text-primary" /> Metadata editor</h3>
                            <div className="space-y-3">
                                <Field label="Visual title"><Input value={selectedBlock.title} onChange={(event) => updateSelected({ title: event.target.value })} placeholder="Visual title" /></Field>
                                <Field label="Description"><Textarea value={selectedBlock.description} onChange={(event) => updateSelected({ description: event.target.value })} placeholder="Description" /></Field>
                                <Field label="Caption"><Textarea value={selectedBlock.caption} onChange={(event) => updateSelected({ caption: event.target.value })} placeholder="Caption" /></Field>
                                <Field label="Source label"><Input value={selectedBlock.source_label} onChange={(event) => updateSelected({ source_label: event.target.value })} placeholder="Source label" /></Field>
                                <Field label="Source URL"><Input value={selectedBlock.source_url || ""} onChange={(event) => updateSelected({ source_url: event.target.value })} placeholder="Source URL" /></Field>
                                <Field label="SEO alt text"><Textarea value={selectedBlock.seo_alt} onChange={(event) => updateSelected({ seo_alt: event.target.value })} placeholder="SEO alt text" /></Field>
                                {selectedEvidence ? (
                                    <div className="space-y-3 rounded-xl border bg-background/50 p-3">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Evidence metadata</p>
                                        <Field label="Evidence type">
                                            <select value={selectedEvidence.evidence_type} onChange={(event) => updateSelectedEvidence({ evidence_type: event.target.value as BlogEvidenceRecord["evidence_type"] })} className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm normal-case tracking-normal text-foreground">
                                                {BLOG_EVIDENCE_TYPES.map((type) => <option key={type} value={type}>{labelize(type)}</option>)}
                                            </select>
                                        </Field>
                                        <Field label="Source quality">
                                            <select value={selectedEvidence.source_quality} onChange={(event) => updateSelectedEvidence({ source_quality: event.target.value as BlogEvidenceRecord["source_quality"] })} className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm normal-case tracking-normal text-foreground">
                                                {BLOG_SOURCE_QUALITIES.map((quality) => <option key={quality} value={quality}>{labelize(quality)}</option>)}
                                            </select>
                                        </Field>
                                        <Field label="Confidence">
                                            <select value={selectedEvidence.confidence} onChange={(event) => updateSelectedEvidence({ confidence: event.target.value as BlogEvidenceRecord["confidence"] })} className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm normal-case tracking-normal text-foreground">
                                                {BLOG_EVIDENCE_CONFIDENCES.map((confidence) => <option key={confidence} value={confidence}>{labelize(confidence)}</option>)}
                                            </select>
                                        </Field>
                                        <Field label="Metric definition"><Textarea value={selectedEvidence.metric_definition || ""} onChange={(event) => updateSelectedEvidence({ metric_definition: event.target.value })} placeholder="Define the metric, denominator, sample, or calculation method" /></Field>
                                        <div className="grid gap-3 sm:grid-cols-3">
                                            <Field label="Accessed"><Input type="date" value={selectedEvidence.accessed_date || ""} onChange={(event) => updateSelectedEvidence({ accessed_date: event.target.value })} /></Field>
                                            <Field label="Published"><Input type="date" value={selectedEvidence.publication_date || ""} onChange={(event) => updateSelectedEvidence({ publication_date: event.target.value })} /></Field>
                                            <Field label="Review"><Input type="date" value={selectedEvidence.review_date || ""} onChange={(event) => updateSelectedEvidence({ review_date: event.target.value })} /></Field>
                                        </div>
                                        <Field label="Source note"><Textarea value={selectedEvidence.source_note || ""} onChange={(event) => updateSelectedEvidence({ source_note: event.target.value })} placeholder="Operator-visible source note or caveat" /></Field>
                                        <Field label="Safe fallback wording"><Textarea value={selectedEvidence.safe_fallback_wording || ""} onChange={(event) => updateSelectedEvidence({ safe_fallback_wording: event.target.value })} placeholder="Fallback claim if source confidence is low or unsupported" /></Field>
                                    </div>
                                ) : null}
                            </div>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" className="flex-1" onClick={() => navigator.clipboard?.writeText(shortcode)}><Copy className="mr-2 h-4 w-4" /> Copy</Button>
                                <Button type="button" variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10" onClick={removeSelected}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
                            </div>
                        </aside>
                    </div>
                ) : null}
            </main>
        </div>
    );
}
