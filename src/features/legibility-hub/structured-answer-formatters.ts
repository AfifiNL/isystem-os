import type {
    StructuredHubQueryKey,
    StructuredHubQueryResult,
    StructuredHubScope,
    UnsupportedStructuredMetricResult,
} from "./structured-query-types";
import { suggestStructuredMetrics } from "./structured-query-glossary";

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
    return count === 1 ? singular : plural;
}

export function formatCountAnswer(count: number, noun: string, scopeLabel = "in this workspace") {
    if (count === 0) {
        return `There are currently 0 ${pluralize(0, noun)} ${scopeLabel}.`;
    }

    return `You currently have ${count} ${pluralize(count, noun)} ${scopeLabel}.`;
}

export function formatWindowedCountAnswer(count: number, noun: string, windowLabel: string, scopeLabel = "in this workspace") {
    return `In ${windowLabel}, there ${count === 1 ? "was" : "were"} ${count} ${pluralize(count, noun)} ${scopeLabel}.`;
}

export function formatListAnswer(count: number, noun: string, names: string[]) {
    if (count === 0) {
        return `There are currently 0 ${pluralize(0, noun)} in this workspace.`;
    }

    const preview = names.slice(0, 5).filter(Boolean).join(", ");
    const suffix = count > 5 ? `, and ${count - 5} more` : "";
    return `I found ${count} ${pluralize(count, noun)}${preview ? `: ${preview}${suffix}.` : "."}`;
}

export function buildStructuredResult(params: {
    key: StructuredHubQueryKey;
    label: string;
    answer: string;
    value?: number | string | null;
    rows?: Array<Record<string, unknown>>;
    scope: StructuredHubScope;
    tables: string[];
    filters: Record<string, unknown>;
    businessDefinition: string;
    limitations?: string[];
    executedAt?: string;
}): StructuredHubQueryResult {
    return {
        key: params.key,
        source: "structured_query",
        label: params.label,
        answer: params.answer,
        value: params.value,
        rows: params.rows,
        rowCount: params.rows?.length ?? (typeof params.value === "number" ? params.value : undefined),
        scope: params.scope,
        provenance: {
            tables: params.tables,
            filters: params.filters,
            executedAt: params.executedAt ?? new Date().toISOString(),
            businessDefinition: params.businessDefinition,
            limitations: params.limitations,
        },
    };
}

export function formatUnsupportedMetricResponse(reason: string, queryText?: string): UnsupportedStructuredMetricResult {
    return {
        mode: "unsupported",
        answer:
            reason === "global_scope_not_supported"
                ? "I can only answer that for the active workspace right now. Global structured metrics are not enabled."
                : "I can’t answer that as a structured metric yet. I can search the semantic hub for related context, or this metric can be added to the structured query registry.",
        suggestions: suggestStructuredMetrics(queryText).slice(0, 6),
        reason,
    };
}
