// Loop B — signals out.
//
// After a Blog SEO Enhance apply, three persistence writes turn per-proposal
// decisions into durable workspace state:
//
//   1. Every accepted internal-link proposal → an edge in inventory_link_graph.
//      Orphan detection and cluster ranking become a select, not a scan.
//
//   2. Every proposal (accepted or rejected) → a row in
//      blog_enhancement_proposal_events. Future detectors read these to
//      compute noise scores and suppress signals the workspace consistently
//      rejects.
//
//   3. Every applied external citation → a counter bump on
//      workspace_learned_authority_domains. The market monitor and the
//      external-ref generator read this to boost domains the workspace has
//      already chosen to trust.
//
// All writes are best-effort: a feedback-loop failure must not block the
// apply action itself — the user has already accepted the proposals and the
// markdown has been written. Errors are logged, not thrown.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BlogEnhancementProposal } from "@/features/seo/types";

interface EmissionInput {
    workspaceId: string;
    runId: string;
    contentId: string;
    acceptedProposals: BlogEnhancementProposal[];
    rejectedProposals: BlogEnhancementProposal[];
}

export interface EmissionResult {
    linkGraph: "ok" | "skipped" | "failed";
    proposalEvents: "ok" | "skipped" | "failed";
    learnedAuthority: "ok" | "skipped" | "failed";
    errors: string[];
}

export async function emitEnhancementFeedback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: SupabaseClient<any, any, any>,
    input: EmissionInput,
): Promise<EmissionResult> {
    const [linkGraph, proposalEvents, learnedAuthority] = await Promise.all([
        recordLinkGraphEdges(supabase, input),
        recordProposalEvents(supabase, input),
        recordLearnedAuthority(supabase, input),
    ]);

    const errors = [linkGraph, proposalEvents, learnedAuthority]
        .filter((r) => r.status === "failed")
        .map((r) => r.error ?? "unknown");

    return {
        linkGraph: linkGraph.status,
        proposalEvents: proposalEvents.status,
        learnedAuthority: learnedAuthority.status,
        errors,
    };
}

type Outcome = { status: "ok" | "skipped" | "failed"; error?: string };

// ─── 1. inventory_link_graph ────────────────────────────────────────────────

async function recordLinkGraphEdges(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: SupabaseClient<any, any, any>,
    input: EmissionInput,
): Promise<Outcome> {
    const edges = input.acceptedProposals
        .filter((p) => p.type === "internal_link_insertion")
        .map((p) => {
            const parsed = parseInternalLinkProposed(p.proposed);
            if (!parsed) return null;
            return {
                workspace_id: input.workspaceId,
                source_content_id: input.contentId,
                target_slug: parsed.slug,
                anchor_text: parsed.anchor,
                enhancement_run_id: input.runId,
            };
        })
        .filter((edge): edge is NonNullable<typeof edge> => edge !== null);

    if (edges.length === 0) return { status: "skipped" };

    const { error } = await supabase
        .from("inventory_link_graph")
        .upsert(edges, { onConflict: "workspace_id,source_content_id,target_slug,anchor_text" });

    if (error) {
        console.warn("[seo-feedback-loop] link graph write failed:", error.message);
        return { status: "failed", error: error.message };
    }
    return { status: "ok" };
}

// The internal-link proposal serializes as `[anchor](/slug)`. Parse rather
// than threading extra fields through BlogEnhancementProposal so the loop
// stays decoupled from proposal shape.
function parseInternalLinkProposed(proposed: string): { anchor: string; slug: string } | null {
    const match = /^\[([^\]]+)\]\((\/[^)\s]+)\)$/.exec(proposed.trim());
    if (!match) return null;
    return { anchor: match[1], slug: match[2] };
}

// ─── 2. blog_enhancement_proposal_events ───────────────────────────────────

async function recordProposalEvents(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: SupabaseClient<any, any, any>,
    input: EmissionInput,
): Promise<Outcome> {
    const toRow = (p: BlogEnhancementProposal, decision: "accepted" | "rejected") => ({
        workspace_id: input.workspaceId,
        run_id: input.runId,
        content_id: input.contentId,
        proposal_id: p.id,
        proposal_type: p.type,
        signal_key: `blog_enhancement:${p.type}`,
        decision,
        risk_flags: p.riskFlags,
    });

    const rows = [
        ...input.acceptedProposals.map((p) => toRow(p, "accepted")),
        ...input.rejectedProposals.map((p) => toRow(p, "rejected")),
    ];

    if (rows.length === 0) return { status: "skipped" };

    const { error } = await supabase.from("blog_enhancement_proposal_events").insert(rows);

    if (error) {
        console.warn("[seo-feedback-loop] proposal events write failed:", error.message);
        return { status: "failed", error: error.message };
    }
    return { status: "ok" };
}

// ─── 3. workspace_learned_authority_domains ─────────────────────────────────

async function recordLearnedAuthority(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: SupabaseClient<any, any, any>,
    input: EmissionInput,
): Promise<Outcome> {
    // Collect unique domains per applied citation type so each authority
    // increment reflects one real editorial decision by the workspace, not
    // a single proposal with two shapes.
    const domainCounts = new Map<string, number>();
    for (const p of input.acceptedProposals) {
        if (p.type !== "external_reference_insertion" && p.type !== "external_citation_sentence") continue;
        const domain = extractDomainFromProposed(p.proposed);
        if (!domain) continue;
        domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
    }

    if (domainCounts.size === 0) return { status: "skipped" };

    const now = new Date().toISOString();
    const rows = Array.from(domainCounts.entries()).map(([domain, count]) => ({
        workspace_id: input.workspaceId,
        domain,
        cite_count: count,
        first_cited_at: now,
        last_cited_at: now,
    }));

    // Supabase cannot atomically sum on conflict without an RPC — we read
    // existing rows, merge counts in application code, then upsert. The set
    // of domains per apply is small (typically 1-3), so the extra roundtrip
    // is cheap and keeps this module free of SQL-function deployment.
    const { data: existing, error: readError } = await supabase
        .from("workspace_learned_authority_domains")
        .select("domain,cite_count,first_cited_at")
        .eq("workspace_id", input.workspaceId)
        .in("domain", Array.from(domainCounts.keys())) as {
            data: Array<{ domain: string; cite_count: number; first_cited_at: string }> | null;
            error: { message: string } | null;
        };

    if (readError) {
        console.warn("[seo-feedback-loop] learned authority read failed:", readError.message);
        return { status: "failed", error: readError.message };
    }

    const existingByDomain = new Map((existing ?? []).map((r) => [r.domain, r]));
    const merged = rows.map((row) => {
        const prior = existingByDomain.get(row.domain);
        return prior
            ? {
                ...row,
                cite_count: prior.cite_count + row.cite_count,
                first_cited_at: prior.first_cited_at,
            }
            : row;
    });

    const { error: writeError } = await supabase
        .from("workspace_learned_authority_domains")
        .upsert(merged, { onConflict: "workspace_id,domain" });

    if (writeError) {
        console.warn("[seo-feedback-loop] learned authority write failed:", writeError.message);
        return { status: "failed", error: writeError.message };
    }
    return { status: "ok" };
}

// External citations are markdown of either `[anchor](https://domain/path)`
// or ` text ([Source Title](https://domain/path))`. Pull the first http(s)
// URL and return its hostname.
function extractDomainFromProposed(proposed: string): string | null {
    const urlMatch = /https?:\/\/([^/)\s]+)/.exec(proposed);
    if (!urlMatch) return null;
    const host = urlMatch[1].toLowerCase();
    // Strip leading www. for stable counting — "nytimes.com" and
    // "www.nytimes.com" are the same authority source.
    return host.replace(/^www\./, "");
}
