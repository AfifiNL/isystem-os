"use client";

import { Download, Loader2, Wand2 } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ExternalPublishingVisualRenderItem } from "@/features/external-publishing/lib/visual-rendering";
import { Button } from "@/shared/ui/button";

type ExportState = "idle" | "exporting" | "success" | "error";

function cleanSvg(svg: string) {
    return svg.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
}

function formatValue(value: number, unit?: string) {
    const formatted = Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return unit ? `${formatted}${unit.startsWith("%") ? "" : " "}${unit}` : formatted;
}

async function downloadElementAsPng(element: HTMLElement, filename: string) {
    const { toPng } = await import("html-to-image");
    const dataUrl = await toPng(element, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        style: {
            margin: "0",
            transform: "none",
        },
    });

    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = filename;
    anchor.click();
}

export function VisualExportCard({ visual, filename }: { visual: ExternalPublishingVisualRenderItem; filename: string }) {
    const exportRef = useRef<HTMLDivElement>(null);
    const mermaidId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
    const [svg, setSvg] = useState<string | null>(null);
    const [renderError, setRenderError] = useState<string | null>(null);
    const [exportState, setExportState] = useState<ExportState>("idle");
    const canRender = visual.kind === "chart" || visual.kind === "prompt" || Boolean(svg);
    const maxValue = useMemo(() => Math.max(...(visual.data ?? []).map((item) => Math.abs(item.value)), 1), [visual.data]);

    useEffect(() => {
        let cancelled = false;
        setSvg(null);
        setRenderError(null);
        if (visual.kind !== "mermaid") return;

        async function renderMermaid() {
            try {
                const mermaid = (await import("mermaid")).default;
                mermaid.initialize({
                    startOnLoad: false,
                    securityLevel: "strict",
                    theme: "base",
                    themeVariables: {
                        background: "#ffffff",
                        primaryColor: "#ecfdf5",
                        primaryBorderColor: "#10b981",
                        primaryTextColor: "#0f172a",
                        lineColor: "#059669",
                        secondaryColor: "#eff6ff",
                        tertiaryColor: "#f8fafc",
                        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    },
                });
                const result = await mermaid.render(`external-publishing-${mermaidId}`, visual.source);
                if (!cancelled) setSvg(cleanSvg(result.svg));
            } catch (error) {
                if (!cancelled) setRenderError(error instanceof Error ? error.message : "Mermaid rendering failed.");
            }
        }

        void renderMermaid();
        return () => {
            cancelled = true;
        };
    }, [mermaidId, visual.kind, visual.source]);

    async function exportPng() {
        if (!exportRef.current || !canRender) return;
        setExportState("exporting");
        try {
            await downloadElementAsPng(exportRef.current, filename);
            setExportState("success");
            window.setTimeout(() => setExportState("idle"), 1600);
        } catch (error) {
            console.error("[external-publishing] visual export failed", error);
            setExportState("error");
        }
    }

    return (
        <article className="rounded-2xl border border-border/60 bg-background/70 p-3 shadow-sm" data-external-publishing-visual-card>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="text-sm font-semibold text-foreground">{visual.title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{visual.kind === "mermaid" ? "Rendered Mermaid diagram" : visual.kind === "chart" ? "Rendered data chart" : "Image-generation prompt card"}</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={exportPng} disabled={!canRender || exportState === "exporting"} aria-label={`Export ${visual.title} as PNG`}>
                    {exportState === "exporting" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
                    {exportState === "exporting" ? "Exporting…" : "Export PNG"}
                </Button>
            </div>

            <div ref={exportRef} className="overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white text-slate-950 shadow-sm" data-external-publishing-export-target>
                <div className="relative min-h-[320px] p-8">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_34%),linear-gradient(135deg,#ffffff,#f8fafc)]" />
                    <div className="relative">
                        <div className="mb-6 max-w-2xl">
                            <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">External publishing visual</p>
                            <h4 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{visual.title}</h4>
                            {visual.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{visual.description}</p> : null}
                        </div>
                        {visual.kind === "mermaid" ? (
                            svg ? <div className="external-publishing-mermaid-svg mx-auto max-w-4xl [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full" role="img" aria-label={visual.altText ?? visual.title} dangerouslySetInnerHTML={{ __html: svg }} /> : (
                                <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">Rendering diagram…</div>
                            )
                        ) : null}
                        {visual.kind === "chart" ? (
                            <div className="space-y-4" role="img" aria-label={visual.altText ?? visual.title}>
                                {visual.chartType === "kpi" ? (
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        {(visual.data ?? []).map((item) => <KpiTile key={`${item.label}-${item.value}`} item={item} unit={visual.unit} />)}
                                    </div>
                                ) : (visual.data ?? []).map((item) => {
                                    const width = Math.max(6, Math.round((Math.abs(item.value) / maxValue) * 100));
                                    return (
                                        <div key={`${item.label}-${item.value}`} className="space-y-2">
                                            <div className="flex items-center justify-between gap-4 text-sm">
                                                <span className="font-semibold text-slate-800">{item.label}</span>
                                                <span className="font-bold tabular-nums text-emerald-700">{formatValue(item.value, visual.unit)}</span>
                                            </div>
                                            <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                                                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500" style={{ width: `${width}%` }} />
                                            </div>
                                            {item.note ? <p className="text-xs leading-5 text-slate-500">{item.note}</p> : null}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : null}
                        {visual.kind === "prompt" ? (
                            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5" role="img" aria-label={visual.altText ?? visual.title}>
                                <div className="flex items-start gap-3">
                                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-600 text-white"><Wand2 className="h-5 w-5" aria-hidden="true" /></span>
                                    <p className="text-lg font-semibold leading-8 text-slate-900">{visual.source}</p>
                                </div>
                            </div>
                        ) : null}
                        {visual.altText ? <p className="mt-6 border-t border-slate-200 pt-3 text-xs leading-5 text-slate-500">Alt text: {visual.altText}</p> : null}
                    </div>
                </div>
            </div>

            {renderError ? (
                <details className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100" open>
                    <summary className="cursor-pointer font-semibold">Diagram source fallback</summary>
                    <p className="mt-2 text-xs">Mermaid could not render this source: {renderError}</p>
                    <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-background/80 p-3 text-xs text-foreground">{visual.source}</pre>
                </details>
            ) : null}
            {exportState === "success" ? <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300" role="status">PNG downloaded.</p> : null}
            {exportState === "error" ? <p className="mt-2 text-xs text-destructive" role="alert">Export failed. Try again after the visual finishes rendering.</p> : null}
        </article>
    );
}

function KpiTile({ item, unit }: { item: { label: string; value: number; note?: string }; unit?: string }) {
    return (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5">
            <p className="text-sm font-semibold text-slate-600">{item.label}</p>
            <p className="mt-2 text-4xl font-black tracking-tight text-emerald-700">{formatValue(item.value, unit)}</p>
            {item.note ? <p className="mt-2 text-xs leading-5 text-slate-500">{item.note}</p> : null}
        </div>
    );
}
