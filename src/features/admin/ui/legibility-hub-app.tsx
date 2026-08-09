"use client";

import { useState } from "react";
import {
    Search,
    Sparkles,
    Layers,
    Database,
    Tag,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    CheckCircle,
    ShieldCheck,
    Table2,
    HelpCircle,
} from "lucide-react";
import { DashboardAppWorkbench } from "@/features/admin/ui/app-workbench";
import { queryLegibilityHub, type LegibilityHubAnswer, type SemanticSearchResultNode } from "@/features/legibility-hub/actions";

const HUB_EXAMPLES = [
    "Which integrations are failing?",
    "Which work items are blocked?",
    "Show recent workflow failures.",
    "How many customers are active?",
    "What did the last meeting mention about SEO?",
];

function modeLabel(mode: LegibilityHubAnswer["mode"] | null) {
    switch (mode) {
        case "structured":
            return "Structured Query";
        case "hybrid":
            return "Hybrid Answer";
        case "unsupported":
            return "Unsupported Metric";
        case "semantic":
            return "Semantic Retrieval";
        default:
            return "Legibility Hub";
    }
}

function modeBadgeClass(mode: LegibilityHubAnswer["mode"] | null) {
    switch (mode) {
        case "structured":
            return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-300";
        case "hybrid":
            return "bg-cyan-500/10 text-cyan-700 border-cyan-500/20 dark:text-cyan-300";
        case "unsupported":
            return "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300";
        case "semantic":
        default:
            return "bg-primary/10 text-primary border-primary/20";
    }
}

function formatCell(value: unknown) {
    if (value === null || value === undefined) return "—";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
    return JSON.stringify(value);
}

export function LegibilityHubApp() {
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [answer, setAnswer] = useState<string | null>(null);
    const [nodes, setNodes] = useState<SemanticSearchResultNode[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<LegibilityHubAnswer | null>(null);

    // UI state toggles
    const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
    const [metadataOpen, setMetadataOpen] = useState<Record<string, boolean>>({});

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setError(null);
        setAnswer(null);
        setNodes([]);
        setResult(null);

        try {
            const res = await queryLegibilityHub(query);
            setResult(res);
            if (res.error) {
                setError(res.error);
            } else {
                setAnswer(res.answer);
                setNodes(res.nodes);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const toggleMetadata = (id: string) => {
        setMetadataOpen((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <DashboardAppWorkbench>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <div className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                <CheckCircle className="h-3.5 w-3.5" />
                Active workspace scoped
            </div>
            <form onSubmit={handleSearch} className="rounded-md border border-border/60 bg-card/70 p-4 shadow-sm">
                <div className="flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex-1 w-full">
                        <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-muted-foreground" />
                        </span>
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Query the semantic engine... (e.g. 'what are the current client priorities?')"
                            className="w-full rounded-md border border-input bg-background py-3 pl-10 pr-4 text-[17px] text-foreground placeholder:text-muted-foreground transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                            disabled={loading}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !query.trim()}
                        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground md:w-auto"
                    >
                        {loading ? (
                            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Sparkles className="h-4 w-4" />
                        )}
                        <span>{loading ? "Searching..." : "Query AI"}</span>
                    </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-6 border-t border-border/60 pt-3 text-[15px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <Database className="h-3 w-3 text-muted-foreground" />
                        Semantic retrieval and structured metrics stay scoped to the active workspace
                    </span>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                    {HUB_EXAMPLES.map((example) => (
                        <button
                            key={example}
                            type="button"
                            onClick={() => setQuery(example)}
                            className="rounded-md border border-border/60 bg-background px-3 py-1.5 text-[15px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                            disabled={loading}
                        >
                            {example}
                        </button>
                    ))}
                </div>
            </form>

            {/* Error handling */}
            {error && (
                <div className="flex items-start gap-2 rounded-md border border-rose-500/20 bg-rose-500/10 p-4 text-[15px] text-rose-600 dark:text-rose-300">
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>
                        <span className="font-semibold">Query Engine Error:</span> {error}
                    </div>
                </div>
            )}

            {/* Results Section */}
            {(answer || nodes.length > 0 || loading || result) && (
                <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">

                    {/* Left Panel: Conversational Synthesis (RAG) */}
                    <div className="lg:col-span-7 space-y-4">
                        <div className="overflow-hidden rounded-md border border-border/60 bg-card shadow-sm">
                            <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-5 py-4">
                                <h2 className="flex items-center gap-2 text-[15px] font-semibold uppercase text-primary">
                                    {result?.mode === "structured" ? <ShieldCheck className="h-4 w-4 text-emerald-500" /> : <Sparkles className="h-4 w-4 text-primary animate-pulse" />}
                                    {modeLabel(result?.mode ?? null)}
                                </h2>
                                <span className={`text-[13px] border px-2 py-0.5 rounded-full font-mono ${modeBadgeClass(result?.mode ?? null)}`}>
                                    {result?.trace?.usedGemini ? "Model summary" : modeLabel(result?.mode ?? null)}
                                </span>
                            </div>

                            <div className="flex min-h-[220px] flex-col justify-between p-5">
                                {loading ? (
                                    <div className="flex-1 flex flex-col items-center justify-center py-12 space-y-4">
                                        <div className="relative">
                                            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
                                            <Sparkles className="absolute inset-0 m-auto h-5 w-5 animate-pulse text-primary" />
                                        </div>
                                        <p className="animate-pulse text-[15px] text-muted-foreground">Routing query and preparing answer...</p>
                                    </div>
                                ) : answer ? (
                                    <div className="whitespace-pre-wrap font-sans text-[15px] leading-relaxed text-foreground">
                                        {answer}
                                    </div>
                                ) : (
                                    <div className="py-12 text-center text-[15px] italic text-muted-foreground">
                                        Enter a search query above to synthesize workspace knowledge.
                                    </div>
                                )}
                            </div>
                        </div>

                        {result?.unsupported && (
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-4 space-y-3">
                                <h3 className="text-[17px] font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-2">
                                    <HelpCircle className="h-4 w-4" />
                                    Supported structured metrics
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {result.unsupported.suggestions.map((suggestion) => (
                                        <button
                                            key={suggestion.key}
                                            type="button"
                                            onClick={() => setQuery(suggestion.query)}
                                            className="px-3 py-1.5 rounded-full text-[15px] bg-background/60 border border-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 transition-colors"
                                        >
                                            {suggestion.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {result?.structured && (
                            <div className="bg-card border border-border/60 rounded-md shadow-xl overflow-hidden">
                                <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
                                    <h3 className="text-[17px] font-semibold tracking-wider uppercase text-emerald-700 flex items-center gap-2 dark:text-emerald-300">
                                        <Database className="h-4 w-4" />
                                        Provenance
                                    </h3>
                                    <span className="text-[13px] text-muted-foreground font-mono">
                                        {new Date(result.structured.provenance.executedAt).toLocaleString()}
                                    </span>
                                </div>
                                <div className="p-5 space-y-4 text-[15px] text-foreground">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="bg-background/60 border border-border/60 rounded-md p-3">
                                            <div className="text-muted-foreground uppercase tracking-wide text-[13px] mb-1">Source</div>
                                            <div className="font-medium text-emerald-700 dark:text-emerald-300">Structured query</div>
                                        </div>
                                        <div className="bg-background/60 border border-border/60 rounded-md p-3">
                                            <div className="text-muted-foreground uppercase tracking-wide text-[13px] mb-1">Scope</div>
                                            <div className="font-medium text-foreground">{result.structured.scope === "active_workspace" ? "Active workspace" : "Admin global"}</div>
                                        </div>
                                        <div className="bg-background/60 border border-border/60 rounded-md p-3 md:col-span-2">
                                            <div className="text-muted-foreground uppercase tracking-wide text-[13px] mb-1">Dataset</div>
                                            <div className="font-mono text-foreground">{result.structured.provenance.tables.join(", ")}</div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-muted-foreground uppercase tracking-wide text-[13px] mb-1">Business definition</div>
                                        <p className="text-foreground leading-relaxed">{result.structured.provenance.businessDefinition}</p>
                                    </div>
                                    <details className="bg-background/60 border border-border/60 rounded-md p-3">
                                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Filters</summary>
                                        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-[13px] text-muted-foreground">{JSON.stringify(result.structured.provenance.filters, null, 2)}</pre>
                                    </details>
                                    {(result.structured.provenance.limitations?.length ?? 0) > 0 && (
                                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-3 text-amber-700 dark:text-amber-300">
                                            <div className="font-semibold mb-1">Limitations</div>
                                            <ul className="list-disc pl-4 space-y-1">
                                                {result.structured.provenance.limitations?.map((limitation) => <li key={limitation}>{limitation}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {result?.structured?.rows && result.structured.rows.length > 0 && (
                            <div className="bg-card border border-border/60 rounded-md shadow-xl overflow-hidden">
                                <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2 text-[17px] font-semibold tracking-wider uppercase text-cyan-700 dark:text-cyan-300">
                                    <Table2 className="h-4 w-4" />
                                    Structured Rows ({result.structured.rows.length})
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-[15px] text-left">
                                        <thead className="bg-muted/40 text-muted-foreground uppercase tracking-wide text-[13px]">
                                            <tr>
                                                {Object.keys(result.structured.rows[0]).map((key) => (
                                                    <th key={key} className="px-4 py-3 font-medium">{key}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/60">
                                            {result.structured.rows.map((row, index) => (
                                                <tr key={index} className="text-foreground">
                                                    {Object.keys(result.structured?.rows?.[0] ?? {}).map((key) => (
                                                        <td key={key} className="px-4 py-3 max-w-[220px] truncate" title={formatCell(row[key])}>{formatCell(row[key])}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {result?.trace && (
                            <details className="bg-card border border-border/60 rounded-md p-4">
                                <summary className="cursor-pointer text-[15px] font-semibold tracking-wider uppercase text-muted-foreground hover:text-foreground">
                                    Admin debug: why this answer
                                </summary>
                                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-[13px] text-muted-foreground">{JSON.stringify(result.trace, null, 2)}</pre>
                            </details>
                        )}
                    </div>

                    {/* Right Panel: Ranked Semantic Documents */}
                    <div className="lg:col-span-5 space-y-4">
                        <h2 className="text-[17px] font-semibold tracking-wider uppercase text-muted-foreground flex items-center gap-2 px-1">
                            <Layers className="h-4 w-4 text-muted-foreground" />
                            Retrieved Context Nodes ({nodes.length})
                        </h2>

                        <div className="space-y-3">
                            {loading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="h-28 bg-card/50 border border-border/60 rounded-md animate-pulse" />
                                ))
                            ) : nodes.length > 0 ? (
                                nodes.map((node, index) => {
                                    const score = Math.round(node.similarity * 100);
                                    const isExpanded = !!expandedNodes[node.id];
                                    const isMetaOpen = !!metadataOpen[node.id];
                                    const contentLines = node.content.split("\n");
                                    const previewContent = contentLines.slice(0, 3).join("\n");
                                    const hasMore = contentLines.length > 3 || node.content.length > 150;

                                    return (
                                        <div
                                            key={node.id}
                                            className="bg-card/80 border border-border/60 hover:border-border rounded-md p-4 transition-all shadow-md flex flex-col space-y-3"
                                        >
                                            {/* Card Top: Entity info + Score */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[13px] font-mono bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded uppercase flex items-center gap-1 font-semibold">
                                                        <Tag className="h-2.5 w-2.5" />
                                                        {node.entity_type}
                                                    </span>
                                                    {node.title && (
                                                        <span className="text-[15px] font-semibold text-foreground truncate max-w-[150px]" title={node.title}>
                                                            {node.title}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[15px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                                                    #{index + 1} · {score}% Match
                                                </span>
                                            </div>

                                            {/* Card Content Preview/Full */}
                                            <div className="text-foreground text-[15px] font-mono leading-relaxed bg-background/60 p-2.5 rounded border border-border/60 whitespace-pre-wrap">
                                                {isExpanded ? node.content : (
                                                    <>
                                                        {previewContent}
                                                        {hasMore && <span className="text-muted-foreground"> ...</span>}
                                                    </>
                                                )}
                                            </div>

                                            {/* Card Actions */}
                                            <div className="flex items-center justify-between text-[14px] text-muted-foreground pt-1 border-t border-border/40">
                                                <button
                                                    onClick={() => toggleMetadata(node.id)}
                                                    className="hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
                                                >
                                                    <Database className="h-3 w-3" />
                                                    <span>{isMetaOpen ? "Hide Meta" : "Show Meta"}</span>
                                                </button>

                                                {hasMore && (
                                                    <button
                                                        onClick={() => toggleExpand(node.id)}
                                                        className="hover:text-foreground transition-colors flex items-center gap-0.5 cursor-pointer font-medium"
                                                    >
                                                        <span>{isExpanded ? "Collapse" : "Expand"}</span>
                                                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                                    </button>
                                                )}
                                            </div>

                                            {/* Metadata view */}
                                            {isMetaOpen && (
                                                <div className="bg-background p-2.5 rounded border border-border/60 text-[13px] font-mono text-muted-foreground overflow-x-auto whitespace-pre">
                                                    {JSON.stringify(node.metadata || {}, null, 2)}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-muted-foreground text-[15px] italic text-center py-8">
                                    No matches retrieved.
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            )}
            </div>
        </DashboardAppWorkbench>
    );
}
