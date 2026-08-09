import type { SourceEvidencePack } from "@/features/source-intelligence/types";

export function buildSourceAwareEpisodeNotes(input: {
    summary: string;
    evidencePack?: SourceEvidencePack | null;
    maxSources?: number;
}): string {
    const sources = (input.evidencePack?.documents ?? []).slice(0, input.maxSources ?? 5);
    if (sources.length === 0) return input.summary;
    const sourceLines = sources.map((source) => `- ${source.publisher ?? source.title}: ${source.canonical_url}`).join("\n");
    return `${input.summary.trim()}\n\n### Sources discussed\n${sourceLines}`.trim();
}
