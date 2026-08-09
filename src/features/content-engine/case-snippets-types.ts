// Plain TS types for the case-snippet system. Lives outside `case-snippets.ts`
// (a "use server" module — every export there must be async) so any code,
// including pure helpers and client components, can import these safely.

export interface CaseSnippet {
    id: string;
    title: string;
    body: string;
    tags: string[];
    industry: string | null;
    outcome_summary: string | null;
    last_used_at: string | null;
    use_count: number;
    is_active: boolean;
}

export interface CaseSnippetInput {
    title: string;
    body: string;
    tags?: string[];
    industry?: string | null;
    outcome_summary?: string | null;
    is_active?: boolean;
}
