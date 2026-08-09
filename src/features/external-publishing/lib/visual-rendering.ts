import type { ExternalPublicationAssetRow, ExternalPublicationPackageRow } from "../types";

export type ExternalPublishingChartDatum = {
    label: string;
    value: number;
    note?: string;
};

export type ExternalPublishingVisualRenderItem = {
    id: string;
    kind: "mermaid" | "chart" | "prompt";
    title: string;
    description?: string;
    altText?: string;
    source: string;
    chartType?: "bar" | "kpi";
    data?: ExternalPublishingChartDatum[];
    unit?: string;
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
    return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function firstString(...values: unknown[]): string | undefined {
    for (const value of values) {
        const text = asString(value);
        if (text) return text;
    }
    return undefined;
}

function slugify(value: string, fallback = "visual") {
    const slug = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96);
    return slug || fallback;
}

function normalizeMermaidSource(value: string): string {
    return value.trim().replace(/^```mermaid\s*/i, "").replace(/```$/i, "").trim();
}

function markdownMermaidSource(value: string | null): string | undefined {
    if (!value) return undefined;
    const fenced = value.match(/```mermaid\s*([\s\S]*?)```/i);
    return normalizeMermaidSource(fenced?.[1] ?? value);
}

function chartData(value: unknown): ExternalPublishingChartDatum[] {
    return asArray(value)
        .map((item): ExternalPublishingChartDatum | null => {
            const row = asRecord(item);
            const label = firstString(row.label, row.name, row.metric, row.category);
            const rawValue = typeof row.value === "number" ? row.value : typeof row.value === "string" ? Number(row.value) : NaN;
            if (!label || !Number.isFinite(rawValue)) return null;
            return { label, value: rawValue, note: firstString(row.note, row.context, row.description) };
        })
        .filter((item): item is ExternalPublishingChartDatum => Boolean(item));
}

function visualTitle(plan: UnknownRecord, fallback: string) {
    return firstString(plan.title, plan.visualTitle, plan.name, fallback) ?? fallback;
}

function appendChart(items: ExternalPublishingVisualRenderItem[], candidate: unknown, fallbackTitle: string, idPrefix: string) {
    const record = asRecord(candidate);
    const data = chartData(record.data ?? record.values ?? record.series ?? candidate);
    if (!data.length) return;

    items.push({
        id: `${idPrefix}-chart-${items.length + 1}`,
        kind: "chart",
        chartType: firstString(record.chartType, record.chart_type, record.type) === "kpi" ? "kpi" : "bar",
        title: visualTitle(record, fallbackTitle),
        description: firstString(record.description, record.caption, record.notes),
        altText: firstString(record.altText, record.alt_text, record.seo_alt),
        source: JSON.stringify(candidate, null, 2),
        data,
        unit: firstString(record.unit, record.suffix),
    });
}

export function extractExternalPublishingVisualsFromPlan(
    visualPlan: unknown,
    context: Pick<ExternalPublicationPackageRow, "topic" | "platform" | "utm_content">,
): ExternalPublishingVisualRenderItem[] {
    const plan = asRecord(visualPlan);
    const items: ExternalPublishingVisualRenderItem[] = [];
    const mermaid = firstString(plan.mermaid, plan.mermaidSource, plan.mermaid_source, plan.diagram);
    if (mermaid) {
        items.push({
            id: `${slugify(context.utm_content ?? context.topic)}-mermaid-1`,
            kind: "mermaid",
            title: visualTitle(plan, `${context.topic} diagram`),
            description: firstString(plan.description, plan.caption, plan.notes),
            altText: firstString(plan.altText, plan.alt_text, `Diagram for ${context.topic}`),
            source: normalizeMermaidSource(mermaid),
        });
    }

    appendChart(items, plan.chart ?? plan.dataChart ?? plan.data_chart, `${context.topic} chart`, slugify(context.utm_content ?? context.topic));
    for (const chart of asArray(plan.charts ?? plan.dataCharts ?? plan.data_charts)) {
        appendChart(items, chart, `${context.topic} chart`, slugify(context.utm_content ?? context.topic));
    }

    const imagePrompt = firstString(plan.imagePrompt, plan.image_prompt, plan.prompt);
    if (imagePrompt && !items.some((item) => item.source === imagePrompt)) {
        items.push({
            id: `${slugify(context.utm_content ?? context.topic)}-prompt-${items.length + 1}`,
            kind: "prompt",
            title: visualTitle(plan, `${context.topic} image prompt`),
            description: firstString(plan.caption, plan.description),
            altText: firstString(plan.altText, plan.alt_text),
            source: imagePrompt,
        });
    }

    return items;
}

export function extractExternalPublishingVisualFromAsset(asset: ExternalPublicationAssetRow): ExternalPublishingVisualRenderItem | null {
    const metadata = asRecord(asset.metadata);
    const mermaid = firstString(metadata.mermaid, metadata.mermaidSource, metadata.diagram) ?? markdownMermaidSource(asset.markdown_embed);
    if (mermaid) {
        return {
            id: `asset-${asset.id}`,
            kind: "mermaid",
            title: asset.title,
            description: asset.description ?? undefined,
            altText: asset.alt_text ?? undefined,
            source: normalizeMermaidSource(mermaid),
        };
    }

    const chartCandidate = metadata.chart ?? metadata.dataChart ?? metadata.data_chart;
    const items: ExternalPublishingVisualRenderItem[] = [];
    appendChart(items, chartCandidate, asset.title, `asset-${asset.id}`);
    if (items[0]) return { ...items[0], id: `asset-${asset.id}` };

    const imagePrompt = firstString(metadata.imagePrompt, metadata.image_prompt, metadata.prompt);
    if (!imagePrompt) return null;
    return {
        id: `asset-${asset.id}`,
        kind: "prompt",
        title: asset.title,
        description: asset.description ?? undefined,
        altText: asset.alt_text ?? undefined,
        source: imagePrompt,
    };
}

export function externalPublishingVisualFilename(input: Pick<ExternalPublicationPackageRow, "platform" | "utm_content" | "target_slug" | "id"> & { visualTitle?: string }) {
    const packageSlug = slugify(input.utm_content ?? input.target_slug ?? input.id, "package");
    const visualSlug = input.visualTitle ? `-${slugify(input.visualTitle)}` : "";
    return `external-publishing-${slugify(input.platform, "platform")}-${packageSlug}${visualSlug}-visual.png`;
}
