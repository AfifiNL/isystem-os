"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { resolveWorkspaceContext } from "@/shared/lib/workspace/context";
import type { CaseSnippet, CaseSnippetInput } from "./case-snippets-types";

// Types live in `./case-snippets-types.ts`. Import from there directly when
// you need them; this module only exports async server actions.

interface CaseSnippetRow {
    id: string;
    title: string;
    body: string;
    tags: string[] | null;
    industry: string | null;
    outcome_summary: string | null;
    last_used_at: string | null;
    use_count: number | null;
    is_active: boolean;
}

function toSnippet(row: CaseSnippetRow): CaseSnippet {
    return {
        id: row.id,
        title: row.title,
        body: row.body,
        tags: row.tags ?? [],
        industry: row.industry,
        outcome_summary: row.outcome_summary,
        last_used_at: row.last_used_at,
        use_count: row.use_count ?? 0,
        is_active: row.is_active,
    };
}

/** List all snippets for the current workspace (admin UI). */
export async function listCaseSnippets(): Promise<{ data: CaseSnippet[]; error: string | null }> {
    const supabase = await createClient();
    const ctx = await resolveWorkspaceContext();
    if (!ctx?.activeWorkspace?.id) {
        return { data: [], error: "No active workspace." };
    }
    const { data, error } = await supabase
        .from("workspace_case_snippets")
        .select("id, title, body, tags, industry, outcome_summary, last_used_at, use_count, is_active")
        .eq("workspace_id", ctx.activeWorkspace.id)
        .order("updated_at", { ascending: false });
    if (error) {
        return { data: [], error: error.message };
    }
    return { data: (data as CaseSnippetRow[]).map(toSnippet), error: null };
}

interface PickInput {
    workspaceId: string;
    keywords?: string[];
    industry?: string | null;
    /** Article title — used to extract additional topic signal so the picker
     * matches the article subject and not just the operator's tag list. The
     * tag-only picker was scoring tied snippets on LRU and frequently picked
     * a thematically-unrelated story (e.g. anti-abuse snippet on a Shadow-AI
     * article) which read as a non-sequitur. */
    title?: string;
}

const TITLE_STOPWORDS = new Set([
    "a", "an", "the", "and", "or", "but", "of", "to", "for", "in", "on", "at",
    "by", "with", "from", "as", "is", "are", "was", "were", "be", "been", "being",
    "this", "that", "these", "those", "your", "our", "their", "his", "her", "its",
    "how", "what", "why", "when", "where", "who", "which",
    "you", "we", "they", "i", "it", "me", "us", "them",
    "do", "does", "did", "have", "has", "had", "will", "would", "should", "could",
    "new", "best", "top", "guide", "tips", "ways", "ultimate", "complete", "essential",
]);

function extractTopicTerms(text: string | undefined): string[] {
    if (!text) return [];
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 3 && w.length <= 20 && !TITLE_STOPWORDS.has(w));
}

/**
 * Pick the best-fit anecdote for a generation run. Strategy:
 *   1. Active snippets only.
 *   2. Prefer tag/industry overlap with the brief.
 *   3. Among ties, prefer least-recently-used so the same story doesn't
 *      get welded to every article.
 *
 * Returns `null` when the workspace has no eligible snippets — the prompt
 * is structured to degrade gracefully rather than fabricate a fake story.
 */
export async function pickCaseSnippetForBrief(input: PickInput): Promise<CaseSnippet | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("workspace_case_snippets")
        .select("id, title, body, tags, industry, outcome_summary, last_used_at, use_count, is_active")
        .eq("workspace_id", input.workspaceId)
        .eq("is_active", true);
    if (error || !data || data.length === 0) {
        return null;
    }

    const candidates = (data as CaseSnippetRow[]).map(toSnippet);
    const wantedTags = new Set((input.keywords ?? []).map((k) => k.toLowerCase()));
    const wantedIndustry = input.industry?.toLowerCase() ?? null;
    // Topic terms from the article title supplement the operator keywords.
    // This is what closes the "wrong snippet picked because tags didn't
    // overlap" failure mode — the snippet body itself is checked for
    // overlap with what the article is actually about.
    const titleTerms = extractTopicTerms(input.title);
    const titleTermSet = new Set(titleTerms);

    const score = (s: CaseSnippet) => {
        const tagOverlap = s.tags.filter((t) => wantedTags.has(t.toLowerCase())).length;
        const industryMatch = wantedIndustry && s.industry && s.industry.toLowerCase() === wantedIndustry ? 1 : 0;
        // Body-term overlap with article title: how many of the title's
        // topic words appear in the snippet body or tags. Weighted higher
        // than a single tag match because it directly reflects topical fit.
        const bodyTerms = extractTopicTerms(`${s.title} ${s.body} ${s.tags.join(" ")}`);
        const bodyOverlap = bodyTerms.filter((t) => titleTermSet.has(t)).length;
        // Tag overlap also gets bumped when a tag appears in the title (the
        // operator tagged the snippet with a term the article is about).
        const tagInTitleOverlap = s.tags.filter((t) => titleTermSet.has(t.toLowerCase())).length;
        return tagOverlap * 2 + industryMatch + tagInTitleOverlap * 3 + Math.min(bodyOverlap, 5);
    };

    const ranked = candidates
        .map((s) => ({ s, score: score(s) }))
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            // Older last_used_at wins (or null wins outright).
            const aTime = a.s.last_used_at ? new Date(a.s.last_used_at).getTime() : 0;
            const bTime = b.s.last_used_at ? new Date(b.s.last_used_at).getTime() : 0;
            return aTime - bTime;
        });

    return ranked[0]?.s ?? null;
}

/** Mark a snippet as used after a successful generation. Best-effort, never throws. */
export async function recordCaseSnippetUsage(snippetId: string): Promise<void> {
    const supabase = await createClient();
    const { data: current } = await supabase
        .from("workspace_case_snippets")
        .select("use_count")
        .eq("id", snippetId)
        .maybeSingle();
    const nextCount = ((current as { use_count: number | null } | null)?.use_count ?? 0) + 1;
    await supabase
        .from("workspace_case_snippets")
        .update({
            last_used_at: new Date().toISOString(),
            use_count: nextCount,
        })
        .eq("id", snippetId);
}

// ────────────────────────────────────────────────────────────────────────────
// Admin mutations
// ────────────────────────────────────────────────────────────────────────────

// Patterns that indicate the body has slipped into engineer voice. The
// AI writer is instructed to weave snippet bodies in verbatim — so any
// dev-flavored language here will leak straight into a leadership-audience
// article and read as a register-break (an AI-detection tell). Reject
// before save and let the operator rewrite in reader-facing voice.
const DEV_JARGON_PATTERNS: Array<{ re: RegExp; hint: string }> = [
    { re: /\b(?:client|api|src|app|dashboard|portal|admin)\/[\w@.-]+/i, hint: "file or branch path (e.g. client/<x>-production, dashboard/<x>)" },
    { re: /\b(?:git|repo|repository|fork|branch|commit|push|merge)\b/i, hint: 'git vocabulary ("git", "repo", "fork", "branch")' },
    { re: /\b(?:RLS|row[- ]level security|Postgres(?:QL)?|Supabase|migration|migrations|jsonb?|RPC)\b/i, hint: 'database internals ("RLS", "Postgres", "Supabase", "migrations")' },
    { re: /\b(?:snake_case|camelCase|kebab-case|PascalCase)\b/i, hint: "code naming convention" },
    { re: /\.(?:ts|tsx|js|jsx|sql|json|yaml|yml|md|sh)\b/i, hint: "source file extension" },
    { re: /\b(?:server actions?|edge functions?|webhooks?|cron jobs?)\b/i, hint: "platform infrastructure terminology" },
];

function sanitizeInput(input: CaseSnippetInput): {
    title: string;
    body: string;
    tags: string[];
    industry: string | null;
    outcome_summary: string | null;
    is_active: boolean;
} | { error: string } {
    const title = input.title?.trim();
    const body = input.body?.trim();
    if (!title) return { error: "Title is required." };
    if (!body) return { error: "Body is required." };
    if (body.length > 2000) return { error: "Body is too long (2000 chars max)." };

    for (const { re, hint } of DEV_JARGON_PATTERNS) {
        if (re.test(body)) {
            return {
                error: `Body contains developer jargon (${hint}) that will leak into the generated article. Rewrite this passage in the voice you would use on a sales call.`,
            };
        }
    }

    const tags = (input.tags ?? [])
        .map((t) => (typeof t === "string" ? t.trim().toLowerCase() : ""))
        .filter((t) => t.length > 0 && t.length <= 40)
        .slice(0, 20);

    const industry = input.industry?.trim() || null;
    const outcome_summary = input.outcome_summary?.trim() || null;
    const is_active = input.is_active !== false;

    return { title, body, tags, industry, outcome_summary, is_active };
}

async function requireWorkspace(): Promise<{ workspaceId: string; userId: string } | { error: string }> {
    const ctx = await resolveWorkspaceContext();
    if (!ctx?.activeWorkspace?.id) return { error: "No active workspace." };
    if (!ctx.userId) return { error: "Not authenticated." };
    return { workspaceId: ctx.activeWorkspace.id, userId: ctx.userId };
}

export async function createCaseSnippet(input: CaseSnippetInput): Promise<{ data: CaseSnippet | null; error: string | null }> {
    const sanitized = sanitizeInput(input);
    if ("error" in sanitized) return { data: null, error: sanitized.error };
    const ctx = await requireWorkspace();
    if ("error" in ctx) return { data: null, error: ctx.error };

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("workspace_case_snippets")
        .insert({
            workspace_id: ctx.workspaceId,
            created_by: ctx.userId,
            title: sanitized.title,
            body: sanitized.body,
            tags: sanitized.tags,
            industry: sanitized.industry,
            outcome_summary: sanitized.outcome_summary,
            is_active: sanitized.is_active,
        })
        .select("id, title, body, tags, industry, outcome_summary, last_used_at, use_count, is_active")
        .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/case-snippets");
    return { data: toSnippet(data as CaseSnippetRow), error: null };
}

export async function updateCaseSnippet(id: string, input: CaseSnippetInput): Promise<{ data: CaseSnippet | null; error: string | null }> {
    if (!id) return { data: null, error: "Snippet id is required." };
    const sanitized = sanitizeInput(input);
    if ("error" in sanitized) return { data: null, error: sanitized.error };
    const ctx = await requireWorkspace();
    if ("error" in ctx) return { data: null, error: ctx.error };

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("workspace_case_snippets")
        .update({
            title: sanitized.title,
            body: sanitized.body,
            tags: sanitized.tags,
            industry: sanitized.industry,
            outcome_summary: sanitized.outcome_summary,
            is_active: sanitized.is_active,
        })
        .eq("id", id)
        .eq("workspace_id", ctx.workspaceId)
        .select("id, title, body, tags, industry, outcome_summary, last_used_at, use_count, is_active")
        .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/case-snippets");
    return { data: toSnippet(data as CaseSnippetRow), error: null };
}

export async function toggleCaseSnippetActive(id: string, nextActive: boolean): Promise<{ error: string | null }> {
    if (!id) return { error: "Snippet id is required." };
    const ctx = await requireWorkspace();
    if ("error" in ctx) return { error: ctx.error };

    const supabase = await createClient();
    const { error } = await supabase
        .from("workspace_case_snippets")
        .update({ is_active: nextActive })
        .eq("id", id)
        .eq("workspace_id", ctx.workspaceId);

    if (error) return { error: error.message };
    revalidatePath("/dashboard/case-snippets");
    return { error: null };
}

export async function deleteCaseSnippet(id: string): Promise<{ error: string | null }> {
    if (!id) return { error: "Snippet id is required." };
    const ctx = await requireWorkspace();
    if ("error" in ctx) return { error: ctx.error };

    const supabase = await createClient();
    const { error } = await supabase
        .from("workspace_case_snippets")
        .delete()
        .eq("id", id)
        .eq("workspace_id", ctx.workspaceId);

    if (error) return { error: error.message };
    revalidatePath("/dashboard/case-snippets");
    return { error: null };
}

// `buildCaseSnippetPromptBlock` lives in `./case-snippets-prompt.ts` — a "use
// server" module cannot export sync functions, so the prompt formatter sits
// in a sibling module and is imported by generate-draft and the LLM routes.
