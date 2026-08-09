import React from "react";
import {
    isPlaceholderSourceLabel,
    normalizeEvidenceForVisualBlock,
    sanitizeEvidenceSourceLabel,
    type BlogChartBlock,
    type BlogDiagramBlock,
    type BlogDiagramPolarity,
    type BlogEvidenceRecord,
    type BlogVisualBlock,
} from "@/features/content-engine/visual-enrichment";
import {
    getVisualEvidenceBadgeLabel,
    getVisualEvidenceCaveat,
    isQuantitativeVisualBlock,
} from "@/features/content-engine/lib/visual-evidence-display";

const token = {
    border: "var(--template-border-inverse, var(--template-border-soft, var(--border, #cbd5e1)))",
    surface: "var(--template-surface-inverse-raised, var(--template-surface-glass, var(--template-surface-light, var(--card, #ffffff))))",
    text: "var(--template-text-inverse, var(--template-text-primary, var(--foreground, #0f172a)))",
    muted: "var(--template-text-inverse-muted, var(--template-text-secondary, var(--muted-foreground, #475569)))",
    subtle: "var(--template-text-inverse-subtle, var(--template-text-subtle, var(--muted-foreground, #475569)))",
    accent: "var(--template-text-accent-strong, var(--template-accent, var(--template-primary, var(--primary, #2563eb))))",
    primary: "var(--template-primary, var(--primary, #2563eb))",
    gradientFrom: "var(--template-gradient-from, var(--template-primary, var(--primary, #2563eb)))",
    gradientTo: "var(--template-gradient-to, var(--template-accent, var(--template-primary, var(--primary, #2563eb))))",
    radiusXl: "var(--template-radius-xl, 1.5rem)",
    radiusLg: "var(--template-radius-lg, 1rem)",
    radiusMd: "var(--template-radius-md, 0.75rem)",
    depth: "var(--template-depth-md, 0 18px 50px rgba(15, 23, 42, 0.08))",
    glow: "var(--template-depth-glow, 0 0 0 transparent)",
} as const;

const gradient = `linear-gradient(135deg, ${token.gradientFrom}, ${token.gradientTo})`;

function softBackground(color: string = token.primary, amount = 8) {
    return `color-mix(in oklch, ${color} ${amount}%, transparent)`;
}

function formatValue(value: number, unit?: string) {
    const formatted = Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return unit ? `${formatted}${unit.startsWith("%") ? "" : " "}${unit}` : formatted;
}

function isHttpUrl(url: string | undefined) {
    return Boolean(url && /^https?:\/\//i.test(url));
}

function displayDate(value: string | undefined) {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function appendGuaranteeLanguage(note: string) {
    return /not a performance guarantee/i.test(note) ? note : `${note.replace(/\.$/, "")}. Not a performance guarantee.`;
}

function formatSourceQuality(quality: BlogEvidenceRecord["source_quality"]) {
    switch (quality) {
        case "primary":
            return "primary source";
        case "near_primary":
            return "near-primary source";
        case "secondary":
            return "secondary source";
        case "vendor":
            return "vendor source";
        case "internal":
            return "Internal source";
        case "unknown":
        default:
            return undefined;
    }
}

function evidenceDetails(evidence: BlogEvidenceRecord) {
    const publicationDate = displayDate(evidence.publication_date);
    const accessedDate = displayDate(evidence.accessed_date);
    const metricDefinition = cleanInlineMarkdown(evidence.metric_definition);
    const quality = formatSourceQuality(evidence.source_quality);

    return [
        quality,
        evidence.confidence ? `confidence: ${evidence.confidence}` : undefined,
        publicationDate ? `published ${publicationDate}` : undefined,
        accessedDate ? `accessed ${accessedDate}` : undefined,
        metricDefinition ? `metric: ${metricDefinition}` : undefined,
    ].filter(Boolean) as string[];
}

function sourceAnchor(evidence: BlogEvidenceRecord) {
    const label = sanitizeEvidenceSourceLabel(evidence.source_label) || (evidence.source_url ? "source" : undefined);
    if (!label) return null;
    if (isHttpUrl(evidence.source_url)) {
        return <a className="underline-offset-4 hover:underline" style={{ color: token.accent }} href={evidence.source_url} target="_blank" rel="noopener noreferrer">{label}</a>;
    }
    return <span>{label}</span>;
}

function sourceNoteParts(evidence: BlogEvidenceRecord, quantitative: boolean, publicView?: boolean) {
    const source = sourceAnchor(evidence);
    const caveat = getVisualEvidenceCaveat(evidence, { publicView, quantitative });

    // Persisted evidence notes contain reviewer diagnostics, confidence labels,
    // and machine-readable fallback reasons. Those fields are useful in the
    // editor, but they are not article copy. Public surfaces only get the
    // source anchor and the controlled evidence caveat.
    if (publicView) {
        const sourcePrefix = evidence.evidence_type === "author_synthesis"
            || evidence.evidence_type === "internal_estimate"
            ? "Context source"
            : "Source";
        return [
            source ? <>{sourcePrefix}: {source}</> : undefined,
            caveat,
        ].filter(Boolean);
    }

    const sourceNote = cleanInlineMarkdown(evidence.source_note);
    const details = evidenceDetails(evidence);

    switch (evidence.evidence_type) {
        case "forecast": {
            const note = sourceNote || "Forward-looking estimate from the cited source.";
            return [source ? <>Source: {source}</> : undefined, appendGuaranteeLanguage(`Forecast: ${note.replace(/^Forecast:\s*/i, "")}`), details.length ? details.join(" · ") : undefined].filter(Boolean);
        }
        case "author_framework":
            return [caveat || "Author framework, not an external statistic.", sourceNote, details.length ? details.join(" · ") : undefined].filter(Boolean);
        case "author_synthesis":
            return [source ? <>Context source: {source}</> : undefined, caveat || "Author synthesis, not an external statistic.", sourceNote, details.length ? details.join(" · ") : undefined].filter(Boolean);
        case "internal_estimate":
            return [source ? <>Context source: {source}</> : undefined, caveat || "Directional scenario model, not a published benchmark.", sourceNote, details.length ? details.join(" · ") : undefined].filter(Boolean);
        case "unsupported":
            return [source ? <>Source under review: {source}</> : undefined, caveat, cleanInlineMarkdown(evidence.safe_fallback_wording) || (!source ? "Unsupported / review needed before publication." : undefined)].filter(Boolean);
        case "verified_statistic":
        case "time_sensitive_benchmark":
        default: {
            return [source ? <>Source: {source}</> : undefined, caveat, sourceNote, details.length ? details.join(" · ") : undefined].filter(Boolean);
        }
    }
}

function EvidenceBadge({ evidence, quantitative, publicView }: { evidence: BlogEvidenceRecord; quantitative: boolean; publicView?: boolean }) {
    const label = getVisualEvidenceBadgeLabel(evidence, { publicView, quantitative });
    if (!label) return null;
    return (
        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ borderColor: softBackground(token.accent, 32), background: softBackground(token.accent, 10), color: token.text }}>
            {label}
        </span>
    );
}

function EvidenceSourceNote({ block, publicView }: { block: BlogChartBlock | BlogDiagramBlock; publicView?: boolean }) {
    const evidence = normalizeEvidenceForVisualBlock(block, block.evidence);
    const quantitative = isQuantitativeVisualBlock(block);
    const parts = sourceNoteParts(evidence, quantitative, publicView);
    const legacySourceLabel = sanitizeEvidenceSourceLabel(block.source_label);
    const shouldRenderLegacySource = !evidence.source_label && legacySourceLabel && !isPlaceholderSourceLabel(legacySourceLabel);
    const legacySource = shouldRenderLegacySource
        ? isHttpUrl(block.source_url)
            ? <a className="underline-offset-4 hover:underline" style={{ color: token.accent }} href={block.source_url} target="_blank" rel="noopener noreferrer">{legacySourceLabel}</a>
            : <span>{legacySourceLabel}</span>
        : null;

    return (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-medium" style={{ color: token.text }}>
            <EvidenceBadge evidence={evidence} quantitative={quantitative} publicView={publicView} />
            {parts.length ? (
                <span className="text-[11px] font-medium" style={{ color: token.muted }}>
                    {parts.map((part, index) => (
                        <span key={index}>{index > 0 ? " · " : null}{part}</span>
                    ))}
                </span>
            ) : legacySource ? (
                <span className="text-[11px] font-medium" style={{ color: token.muted }}>Source: {legacySource}</span>
            ) : null}
        </div>
    );
}

function cleanInlineMarkdown(value: string | undefined) {
    if (!value) return "";
    return value
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/__(.*?)__/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/_(.*?)_/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
        .replace(/^[-*]\s+/gm, "")
        .replace(/\s{2,}/g, " ")
        .trim();
}

function Text({ children, className, style }: { children: string | undefined; className?: string; style?: React.CSSProperties }) {
    const cleaned = cleanInlineMarkdown(children);
    if (!cleaned) return null;
    return <span className={className} style={style}>{cleaned}</span>;
}

// Visual kicker labels ("Map of the moves", "Snapshot", "How it fits
// together", "By the numbers") were introduced as an anti-tell measure —
// the rotation broke the uniform "DATA INSIGHT" / "STRATEGIC DIAGRAM"
// repetition. But an AI-detection review on a published article flagged
// the rotated set itself as still reading "templated and cute". The
// block's own title is descriptive enough; the kicker added no real
// information and contributed to the visual chrome that gives away
// pipeline-produced content. Removed entirely.

function ChartShell({ block, children, publicView }: { block: BlogChartBlock | BlogDiagramBlock; children: React.ReactNode; publicView?: boolean }) {
    return (
        <figure
            data-blog-visual-block={block.id}
            className="not-prose my-10 overflow-hidden border backdrop-blur-[16px]"
            style={{ borderColor: token.border, background: token.surface, borderRadius: token.radiusXl, boxShadow: token.depth }}
        >
            <div className="relative overflow-hidden border-b px-5 py-5" style={{ borderColor: token.border }}>
                <div className="pointer-events-none absolute inset-0 opacity-70" style={{ background: `radial-gradient(circle at top right, ${softBackground(token.accent, 14)} 0%, transparent 42%)` }} />
                <h3 className="relative text-xl font-bold tracking-tight" style={{ color: token.text }}>{block.title}</h3>
                {block.description ? <p className="relative mt-1 text-sm leading-6" style={{ color: token.muted }}><Text>{block.description}</Text></p> : null}
            </div>
            <div className="p-5">{children}</div>
            <figcaption className="border-t px-5 py-3 text-xs leading-5" style={{ borderColor: token.border, background: softBackground(token.primary, 4), color: token.muted }}>
                <Text>{block.caption || block.seo_alt}</Text>
                <EvidenceSourceNote block={block} publicView={publicView} />
            </figcaption>
        </figure>
    );
}

function BarChart({ block }: { block: BlogChartBlock }) {
    const max = Math.max(...block.data.map((item) => Math.abs(item.value)), 1);
    return (
        <div className="space-y-4" role="img" aria-label={block.seo_alt}>
            {block.data.map((item) => {
                const width = Math.max(4, Math.round((Math.abs(item.value) / max) * 100));
                return (
                    <div key={`${item.label}-${item.value}`} className="space-y-2">
                        <div className="flex items-center justify-between gap-4 text-sm">
                            <span className="font-medium" style={{ color: token.text }}>{item.label}</span>
                            <span className="tabular-nums" style={{ color: token.muted }}>{formatValue(item.value, block.unit)}</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full" style={{ background: softBackground(token.primary, 10) }}>
                            <div className="h-full rounded-full" style={{ width: `${width}%`, background: gradient, boxShadow: token.glow }} />
                        </div>
                        {item.note ? <p className="text-xs" style={{ color: token.muted }}><Text>{item.note}</Text></p> : null}
                    </div>
                );
            })}
        </div>
    );
}

function LineChart({ block }: { block: BlogChartBlock }) {
    const width = 640;
    const height = 260;
    const padding = 34;
    const values = block.data.map((item) => item.value);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const range = max - min || 1;
    const points = block.data.map((item, index) => {
        const x = padding + (index / Math.max(block.data.length - 1, 1)) * (width - padding * 2);
        const y = height - padding - ((item.value - min) / range) * (height - padding * 2);
        return { x, y, item };
    });
    const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
    return (
        <div role="img" aria-label={block.seo_alt} className="overflow-x-auto">
            <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[520px] w-full" style={{ borderRadius: token.radiusLg, background: softBackground(token.primary, 8) }}>
                <path d={path} fill="none" stroke={token.accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                {points.map(({ x, y, item }) => (
                    <g key={`${item.label}-${item.value}`}>
                        <circle cx={x} cy={y} r="5" fill={token.accent} />
                        <text x={x} y={height - 10} textAnchor="middle" className="text-[11px]" fill={token.muted}>{item.label}</text>
                        <text x={x} y={Math.max(18, y - 12)} textAnchor="middle" className="text-[12px] font-semibold" fill={token.text}>{formatValue(item.value, block.unit)}</text>
                    </g>
                ))}
            </svg>
        </div>
    );
}

function DonutChart({ block }: { block: BlogChartBlock }) {
    const total = block.data.reduce((sum, item) => sum + Math.max(0, item.value), 0) || 1;
    let cumulative = 0;
    const colors = [token.primary, token.accent, token.gradientTo, `color-mix(in oklch, ${token.primary} 62%, white)`, `color-mix(in oklch, ${token.accent} 62%, white)`];
    const conic = block.data.map((item, index) => {
        const start = (cumulative / total) * 100;
        cumulative += Math.max(0, item.value);
        const end = (cumulative / total) * 100;
        return `${colors[index % colors.length]} ${start}% ${end}%`;
    }).join(", ");
    return (
        <div className="grid gap-6 md:grid-cols-[180px_1fr] md:items-center" role="img" aria-label={block.seo_alt}>
            <div className="mx-auto grid h-44 w-44 place-items-center rounded-full" style={{ background: `conic-gradient(${conic})` }}>
                <div className="grid h-24 w-24 place-items-center rounded-full text-center text-sm font-bold" style={{ background: token.surface, color: token.text, boxShadow: token.depth }}>{formatValue(total, block.unit)}</div>
            </div>
            <div className="space-y-3">
                {block.data.map((item) => (
                    <div key={`${item.label}-${item.value}`} className="flex items-center justify-between gap-4 border px-3 py-2 text-sm" style={{ borderColor: softBackground(token.accent, 24), background: softBackground(token.accent, 7), borderRadius: token.radiusMd }}>
                        <span className="font-medium" style={{ color: token.text }}>{item.label}</span>
                        <span className="tabular-nums" style={{ color: token.muted }}>{formatValue(item.value, block.unit)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function KpiChart({ block }: { block: BlogChartBlock }) {
    return (
        <div className="grid gap-3 sm:grid-cols-2" role="img" aria-label={block.seo_alt}>
            {block.data.map((item) => (
                <div key={`${item.label}-${item.value}`} className="border p-4" style={{ borderColor: softBackground(token.accent, 24), background: softBackground(token.accent, 7), borderRadius: token.radiusLg }}>
                    <p className="text-sm font-medium" style={{ color: token.muted }}>{item.label}</p>
                    <p className="mt-2 text-3xl font-black tracking-tight" style={{ color: token.accent }}>{formatValue(item.value, block.unit)}</p>
                    {item.note ? <p className="mt-2 text-xs leading-5" style={{ color: token.muted }}><Text>{item.note}</Text></p> : null}
                </div>
            ))}
        </div>
    );
}

function ComparisonTable({ block }: { block: BlogChartBlock }) {
    return (
        <div className="overflow-x-auto" role="img" aria-label={block.seo_alt}>
            <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                    <tr className="border-b text-left" style={{ borderColor: token.border }}>
                        <th className="py-3 pr-4 font-semibold" style={{ color: token.text }}>Metric</th>
                        <th className="py-3 pr-4 font-semibold" style={{ color: token.text }}>Value</th>
                        <th className="py-3 pr-4 font-semibold" style={{ color: token.text }}>Context</th>
                    </tr>
                </thead>
                <tbody>
                    {block.data.map((item) => (
                        <tr key={`${item.label}-${item.value}`} className="border-b" style={{ borderColor: token.border }}>
                            <td className="py-3 pr-4 font-medium" style={{ color: token.text }}>{item.label}</td>
                            <td className="py-3 pr-4 tabular-nums" style={{ color: token.muted }}>{formatValue(item.value, block.unit)}</td>
                            <td className="py-3 pr-4" style={{ color: token.muted }}><Text>{item.note || item.group || "—"}</Text></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function ChartBlock({ block, publicView }: { block: BlogChartBlock; publicView?: boolean }) {
    return (
        <ChartShell block={block} publicView={publicView}>
            {block.chart_type === "line" ? <LineChart block={block} /> : null}
            {block.chart_type === "donut" ? <DonutChart block={block} /> : null}
            {block.chart_type === "kpi" ? <KpiChart block={block} /> : null}
            {block.chart_type === "comparison_table" ? <ComparisonTable block={block} /> : null}
            {block.chart_type === "bar" || !["line", "donut", "kpi", "comparison_table"].includes(block.chart_type) ? <BarChart block={block} /> : null}
        </ChartShell>
    );
}

function orderedFlowNodes(block: BlogDiagramBlock) {
    const nodes = block.nodes || [];
    const edges = block.edges || [];
    if (!nodes.length || !edges.length) return nodes;
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const incoming = new Set(edges.map((edge) => edge.to));
    const start = nodes.find((node) => !incoming.has(node.id)) || nodes[0];
    const ordered = [start];
    const seen = new Set([start.id]);
    let current = start.id;

    while (ordered.length < nodes.length) {
        const nextEdge = edges.find((edge) => edge.from === current && !seen.has(edge.to));
        const next = nextEdge ? byId.get(nextEdge.to) : null;
        if (!next) break;
        ordered.push(next);
        seen.add(next.id);
        current = next.id;
    }

    nodes.forEach((node) => {
        if (!seen.has(node.id)) ordered.push(node);
    });
    return ordered;
}

function FlowDiagram({ block }: { block: BlogDiagramBlock }) {
    const nodes = orderedFlowNodes(block);
    const edges = block.edges || [];
    return (
        <div role="img" aria-label={block.seo_alt} className="space-y-0">
            {nodes.map((node, index) => {
                const nextEdge = edges.find((edge) => edge.from === node.id);
                return (
                    <div key={node.id} className="relative">
                        <div className="flex items-start gap-4">
                            <div className="flex flex-col items-center">
                                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: gradient, boxShadow: token.glow }}>{index + 1}</span>
                                {index < nodes.length - 1 ? <span className="my-2 h-10 w-px" style={{ background: `linear-gradient(${token.accent}, transparent)` }} /> : null}
                            </div>
                            <div className="flex-1 border p-4" style={{ borderColor: softBackground(token.accent, 24), background: softBackground(token.accent, 7), borderRadius: token.radiusLg }}>
                                <p className="font-semibold" style={{ color: token.text }}><Text>{node.label}</Text></p>
                                {node.description ? <p className="mt-1 text-sm leading-6" style={{ color: token.muted }}><Text>{node.description}</Text></p> : null}
                                {nextEdge?.label ? <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: token.accent }}>Next: <Text>{nextEdge.label}</Text></p> : null}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function TimelineDiagram({ block }: { block: BlogDiagramBlock }) {
    return (
        <div role="img" aria-label={block.seo_alt} className="relative space-y-4 pl-7">
            <span className="absolute left-3 top-2 bottom-2 w-px" style={{ background: `linear-gradient(${token.accent}, transparent)` }} />
            {(block.nodes || []).map((node, index) => (
                <div key={node.id} className="relative border p-4" style={{ borderColor: softBackground(token.accent, 24), background: softBackground(token.accent, 7), borderRadius: token.radiusLg }}>
                    <span className="absolute -left-[2rem] top-4 grid h-7 w-7 place-items-center rounded-full text-xs font-bold text-white" style={{ background: gradient }}>{index + 1}</span>
                    <p className="font-semibold" style={{ color: token.text }}><Text>{node.label}</Text></p>
                    {node.description ? <p className="mt-1 text-sm leading-6" style={{ color: token.muted }}><Text>{node.description}</Text></p> : null}
                </div>
            ))}
        </div>
    );
}

function FunnelDiagram({ block }: { block: BlogDiagramBlock }) {
    const nodes = block.nodes || [];
    return (
        <div role="img" aria-label={block.seo_alt} className="space-y-3">
            {nodes.map((node, index) => {
                const width = Math.max(58, 100 - index * (36 / Math.max(nodes.length - 1, 1)));
                return (
                    <div key={node.id} className="mx-auto border px-5 py-4 text-center" style={{ width: `${width}%`, borderColor: softBackground(token.accent, 24), background: index === 0 ? gradient : softBackground(token.accent, 7), borderRadius: token.radiusLg, color: index === 0 ? "white" : token.text }}>
                        <p className="font-semibold"><Text>{node.label}</Text></p>
                        {node.description ? <p className="mt-1 text-sm leading-6" style={{ color: index === 0 ? "rgba(255,255,255,0.82)" : token.muted }}><Text>{node.description}</Text></p> : null}
                    </div>
                );
            })}
        </div>
    );
}

function FrameworkDiagram({ block }: { block: BlogDiagramBlock }) {
    // Each card used to carry a `Pillar {index + 1}` kicker. The AI-detection
    // reviewer flagged the "Pillar 1 / Pillar 2 / Pillar 9" labeling as the
    // single most obvious tell across multiple published articles — exactly
    // the templated card scaffolding the writer prompt forbids in prose. The
    // node already has its own specific label below; the generic kicker
    // adds no information and is a pure AI signal. Removed.
    return (
        <div role="img" aria-label={block.seo_alt} className="grid gap-4 md:grid-cols-2">
            {(block.nodes || []).map((node, index) => (
                <div key={node.id} className="border p-4" style={{ borderColor: softBackground(token.accent, 24), background: softBackground(index % 2 === 0 ? token.accent : token.primary, 7), borderRadius: token.radiusLg }}>
                    <p className="font-semibold" style={{ color: token.text }}><Text>{node.label}</Text></p>
                    {node.description ? <p className="mt-1 text-sm leading-6" style={{ color: token.muted }}><Text>{node.description}</Text></p> : null}
                </div>
            ))}
        </div>
    );
}

function MatrixDiagram({ block }: { block: BlogDiagramBlock }) {
    const nodes = block.nodes || [];
    return (
        <div role="img" aria-label={block.seo_alt} className="overflow-x-auto">
            <div className="grid min-w-[520px] gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(nodes.length, 2), 4)}, minmax(0, 1fr))` }}>
                {nodes.map((node) => (
                    <div key={node.id} className="border p-4" style={{ borderColor: softBackground(token.accent, 24), background: softBackground(token.accent, 7), borderRadius: token.radiusLg }}>
                        <p className="font-semibold" style={{ color: token.text }}><Text>{node.label}</Text></p>
                        {node.description ? <p className="mt-2 text-sm leading-6" style={{ color: token.muted }}><Text>{node.description}</Text></p> : null}
                    </div>
                ))}
            </div>
        </div>
    );
}

function humanizeDiagramEnum(value: string) {
    const text = value.replace(/_/g, " ");
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function relationalNodePosition(index: number, count: number) {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(count, 1);
    return {
        x: 380 + Math.cos(angle) * 265,
        y: 190 + Math.sin(angle) * 125,
    };
}

function splitNodeLabel(label: string): [string, string?] {
    const words = label.trim().split(/\s+/);
    if (words.length <= 3) return [label];
    const midpoint = Math.ceil(words.length / 2);
    return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")];
}

function RelationalDiagram({ block }: { block: BlogDiagramBlock }) {
    const nodes = (block.nodes || []).slice(0, 8);
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const edges = (block.edges || []).filter((edge) => nodeById.has(edge.from) && nodeById.has(edge.to)).slice(0, 12);
    const positions = new Map(nodes.map((node, index) => [node.id, relationalNodePosition(index, nodes.length)]));
    const markerPrefix = `relational-${block.id.replace(/[^a-zA-Z0-9_-]/g, "") || "diagram"}`;
    const feedbackLabel = block.feedback_type && block.feedback_type !== "none"
        ? `${humanizeDiagramEnum(block.feedback_type)} loop`
        : block.system_archetype
            ? humanizeDiagramEnum(block.system_archetype)
            : "System map";

    const polarityStyle = (polarity: BlogDiagramPolarity | undefined) => {
        if (polarity === "negative") {
            return {
                sign: "−",
                label: "negative relationship",
                color: "var(--destructive, #dc2626)",
            };
        }
        if (polarity === "positive") {
            return {
                sign: "+",
                label: "positive relationship",
                color: token.accent,
            };
        }
        return {
            sign: "→",
            label: "neutral relationship",
            color: token.muted,
        };
    };

    return (
        <div
            role="img"
            aria-label={block.seo_alt}
            data-diagram-type="relational"
            data-system-archetype={block.system_archetype || "system_map"}
            className="space-y-4"
        >
            <div className="flex flex-wrap items-center gap-2">
                <span
                    className="rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em]"
                    style={{
                        borderColor: softBackground(token.accent, 28),
                        background: softBackground(token.accent, 9),
                        color: token.text,
                    }}
                >
                    {feedbackLabel}
                </span>
                <span className="text-xs" style={{ color: token.muted }}>
                    Arrows show direction; + and − show causal polarity.
                </span>
            </div>

            <div className="overflow-x-auto">
                <svg
                    viewBox="0 0 760 380"
                    className="h-auto min-w-[680px] w-full"
                    aria-hidden="true"
                    focusable="false"
                >
                    <defs>
                        {(["positive", "negative", "neutral"] as const).map((polarity) => {
                            const style = polarityStyle(polarity);
                            return (
                                <marker
                                    key={polarity}
                                    id={`${markerPrefix}-${polarity}`}
                                    markerWidth="8"
                                    markerHeight="8"
                                    refX="7"
                                    refY="4"
                                    orient="auto"
                                >
                                    <path d="M0,0 L8,4 L0,8 z" fill={style.color} />
                                </marker>
                            );
                        })}
                    </defs>

                    {edges.map((edge, index) => {
                        const from = positions.get(edge.from);
                        const to = positions.get(edge.to);
                        if (!from || !to) return null;
                        const polarity = edge.polarity || "neutral";
                        const style = polarityStyle(polarity);
                        const midpointX = (from.x + to.x) / 2;
                        const midpointY = (from.y + to.y) / 2;
                        return (
                            <g key={`${edge.from}-${edge.to}-${index}`}>
                                <line
                                    x1={from.x}
                                    y1={from.y}
                                    x2={to.x}
                                    y2={to.y}
                                    stroke={style.color}
                                    strokeWidth="2.5"
                                    strokeDasharray={edge.delay ? "8 6" : undefined}
                                    markerEnd={`url(#${markerPrefix}-${polarity})`}
                                    opacity="0.78"
                                />
                                <circle cx={midpointX} cy={midpointY} r="12" fill={token.surface} stroke={style.color} strokeWidth="1.5" />
                                <text
                                    x={midpointX}
                                    y={midpointY + 4}
                                    textAnchor="middle"
                                    fontSize="13"
                                    fontWeight="700"
                                    fill={style.color}
                                >
                                    {style.sign}
                                </text>
                            </g>
                        );
                    })}

                    {nodes.map((node) => {
                        const position = positions.get(node.id);
                        if (!position) return null;
                        const [firstLine, secondLine] = splitNodeLabel(node.label);
                        return (
                            <g key={node.id} transform={`translate(${position.x - 84} ${position.y - 34})`}>
                                <title>{node.description || node.label}</title>
                                <rect
                                    width="168"
                                    height="68"
                                    rx="16"
                                    fill={token.surface}
                                    stroke={token.accent}
                                    strokeWidth="1.5"
                                />
                                {node.node_type ? (
                                    <text x="84" y="16" textAnchor="middle" fontSize="9" fontWeight="700" fill={token.muted}>
                                        {node.node_type.toUpperCase()}
                                    </text>
                                ) : null}
                                <text x="84" y={node.node_type ? "37" : secondLine ? "29" : "39"} textAnchor="middle" fontSize="13" fontWeight="700" fill={token.text}>
                                    {firstLine}
                                </text>
                                {secondLine ? (
                                    <text x="84" y={node.node_type ? "54" : "47"} textAnchor="middle" fontSize="13" fontWeight="700" fill={token.text}>
                                        {secondLine}
                                    </text>
                                ) : null}
                            </g>
                        );
                    })}
                </svg>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
                {edges.map((edge, index) => {
                    const from = nodeById.get(edge.from);
                    const to = nodeById.get(edge.to);
                    if (!from || !to) return null;
                    const style = polarityStyle(edge.polarity);
                    return (
                        <div
                            key={`${edge.from}-${edge.to}-detail-${index}`}
                            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
                            style={{ borderColor: softBackground(style.color, 22), background: softBackground(style.color, 6), color: token.text }}
                        >
                            <span className="font-semibold">{from.label}</span>
                            <span aria-label={style.label} title={style.label} className="font-bold" style={{ color: style.color }}>
                                {style.sign}
                            </span>
                            <span className="font-semibold">{to.label}</span>
                            {edge.label ? <span style={{ color: token.muted }}>· {edge.label}</span> : null}
                            {edge.delay ? <span className="font-semibold" style={{ color: token.muted }}>· delay</span> : null}
                        </div>
                    );
                })}
            </div>

            <ul className="sr-only">
                {nodes.map((node) => (
                    <li key={`${node.id}-description`}>{node.label}: {node.description || "System element"}</li>
                ))}
                {edges.map((edge, index) => {
                    const from = nodeById.get(edge.from);
                    const to = nodeById.get(edge.to);
                    const style = polarityStyle(edge.polarity);
                    return from && to ? (
                        <li key={`${edge.from}-${edge.to}-accessible-${index}`}>
                            {from.label} has a {style.label} to {to.label}{edge.label ? `: ${edge.label}` : ""}{edge.delay ? ", with a delay" : ""}.
                        </li>
                    ) : null;
                })}
            </ul>
        </div>
    );
}

function DiagramBlock({ block, publicView }: { block: BlogDiagramBlock; publicView?: boolean }) {
    return (
        <ChartShell block={block} publicView={publicView}>
            {block.diagram_type === "relational" ? <RelationalDiagram block={block} /> : null}
            {block.diagram_type === "timeline" ? <TimelineDiagram block={block} /> : null}
            {block.diagram_type === "funnel" ? <FunnelDiagram block={block} /> : null}
            {block.diagram_type === "framework" ? <FrameworkDiagram block={block} /> : null}
            {block.diagram_type === "comparison_matrix" ? <MatrixDiagram block={block} /> : null}
            {block.diagram_type === "flowchart" || !["relational", "timeline", "funnel", "framework", "comparison_matrix"].includes(block.diagram_type) ? <FlowDiagram block={block} /> : null}
        </ChartShell>
    );
}

export function BlogVisualBlockRenderer({ block, publicView }: { block: BlogVisualBlock; publicView?: boolean }) {
    if (block.type === "chart") return <ChartBlock block={block} publicView={publicView} />;
    return <DiagramBlock block={block} publicView={publicView} />;
}
