import { tavilyCountryForLocale, tavilySearch } from "@/shared/lib/ai/tavily";
import type { OpportunitySignal } from "../types";

export interface SignalEnrichment {
    signalKey: string;
    externalContext: string | null;
}

// Cap enrichment to top N signals by priority to control Tavily credit spend
const MAX_ENRICHABLE_SIGNALS = 3;

function buildSignalSearchQuery(signal: OpportunitySignal): string {
    return `${signal.title} ${signal.category} improvement best practices`;
}

async function enrichOne(signal: OpportunitySignal, country: string | undefined): Promise<SignalEnrichment> {
    try {
        const results = await tavilySearch({
            query: buildSignalSearchQuery(signal),
            search_depth: "basic",
            topic: "general",
            max_results: 3,
            country,
        });

        if (results.results.length === 0) {
            return { signalKey: signal.signalKey, externalContext: null };
        }

        const lines = results.results
            .slice(0, 3)
            .map((r) => `- [${r.title}](${r.url}): ${r.content.substring(0, 180)}`);

        return {
            signalKey: signal.signalKey,
            externalContext: `**External context:**\n${lines.join("\n")}`,
        };
    } catch {
        return { signalKey: signal.signalKey, externalContext: null };
    }
}

/**
 * Fetches live Tavily context for the top high/medium-priority signals.
 * Returns an empty map when TAVILY_API_KEY is not configured so callers
 * don't need to branch.
 */
export async function enrichSignalsWithExternalContext(
    signals: OpportunitySignal[],
    options: { locale?: string | null } = {},
): Promise<Map<string, SignalEnrichment>> {
    const map = new Map<string, SignalEnrichment>();
    if (!process.env.TAVILY_API_KEY) return map;

    const toEnrich = signals
        .filter((s) => s.severity === "high" || s.severity === "medium")
        .sort((a, b) => b.priorityScore - a.priorityScore)
        .slice(0, MAX_ENRICHABLE_SIGNALS);

    // Bias enrichment sources by workspace locale so a Dutch workspace's
    // "best practices" context cites Dutch playbooks, not US-only material.
    const country = tavilyCountryForLocale(options.locale);

    const results = await Promise.allSettled(toEnrich.map((signal) => enrichOne(signal, country)));
    for (const result of results) {
        if (result.status === "fulfilled") {
            map.set(result.value.signalKey, result.value);
        }
    }

    return map;
}
