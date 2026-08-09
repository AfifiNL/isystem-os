"use server";

import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { getCurrentUserRole, resolveWorkspaceContext } from "@/shared/lib/workspace/context";
import { eurosToMillicents, MIN_BALANCE_FLOOR_MILLICENTS } from "@/shared/lib/ai/pricing";

export type AiBalanceStatus = "ok" | "low" | "blocked";

export interface AiBalanceSummary {
    balanceMillicents: number;
    status: AiBalanceStatus;
    floorMillicents: number;
}

const LOW_BALANCE_WARN_MILLICENTS = MIN_BALANCE_FLOOR_MILLICENTS * 5;

export interface AiCreditLedgerEntry {
    id: string;
    reason: string;
    amount_millicents: number;
    balance_after_millicents: number;
    notes: string | null;
    created_at: string;
}

/**
 * Read the recent ledger entries for the active workspace so the settings
 * page can show a usage/top-up history. Limited to the last 20 entries to
 * keep the settings surface light.
 */
export async function listWorkspaceAiCreditLedger(limit = 20): Promise<{ data: AiCreditLedgerEntry[] | null; error: string | null }> {
    try {
        const ctx = await resolveWorkspaceContext();
        if (!ctx?.activeWorkspace?.id) return { data: null, error: "No active workspace." };
        const supabase = await createClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.from("ai_credit_ledger") as any)
            .select("id,reason,amount_millicents,balance_after_millicents,notes,created_at")
            .eq("workspace_id", ctx.activeWorkspace.id)
            .order("created_at", { ascending: false })
            .limit(limit) as { data: AiCreditLedgerEntry[] | null; error: { message: string } | null };
        if (error) return { data: null, error: error.message };
        return { data: data ?? [], error: null };
    } catch (err) {
        return { data: null, error: err instanceof Error ? err.message : "Failed to read ledger." };
    }
}

/**
 * Read-only balance summary for client components that want to render a
 * contextual warning near an AI action button. Returns a coarse status the
 * UI can render without leaking raw numbers to users who should not see them.
 */
export async function getWorkspaceAiBalanceSummary(): Promise<{ data: AiBalanceSummary | null; error: string | null }> {
    try {
        const ctx = await resolveWorkspaceContext();
        if (!ctx?.activeWorkspace?.id) return { data: null, error: "No active workspace." };

        const supabase = await createClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.from("workspaces") as any)
            .select("ai_balance_millicents")
            .eq("id", ctx.activeWorkspace.id)
            .maybeSingle() as { data: { ai_balance_millicents: number } | null; error: { message: string } | null };

        if (error) return { data: null, error: error.message };
        const balance = data?.ai_balance_millicents ?? 0;
        const status: AiBalanceStatus = balance < MIN_BALANCE_FLOOR_MILLICENTS
            ? "blocked"
            : balance < LOW_BALANCE_WARN_MILLICENTS
                ? "low"
                : "ok";
        return {
            data: { balanceMillicents: balance, status, floorMillicents: MIN_BALANCE_FLOOR_MILLICENTS },
            error: null,
        };
    } catch (err) {
        return { data: null, error: err instanceof Error ? err.message : "Failed to read balance." };
    }
}

async function assertAdminRole() {
    const roleCtx = await getCurrentUserRole();
    if (roleCtx?.role !== "admin") {
        throw new Error("Forbidden: admin role required");
    }
    return roleCtx;
}

export interface GrantResult {
    data: { balanceMillicents: number } | null;
    error: string | null;
}

export async function topUpWorkspaceAiCredits(input: {
    workspaceId: string;
    amountEuros: number;
    notes?: string;
}): Promise<GrantResult> {
    try {
        const roleCtx = await assertAdminRole();

        if (!Number.isFinite(input.amountEuros) || input.amountEuros === 0) {
            return { data: null, error: "Amount must be a non-zero number of euros (positive to credit, negative to debit)." };
        }

        const deltaMillicents = eurosToMillicents(input.amountEuros);
        const supabase = createAdminClient();
        const notes = input.notes?.trim().slice(0, 2000) || null;
        const { error: rpcError } = await supabase.rpc("grant_ai_credits", {
            p_workspace_id: input.workspaceId,
            p_delta_millicents: deltaMillicents,
            p_reason: input.amountEuros >= 0 ? "manual_topup" : "adjustment",
            p_notes: notes,
            p_metadata: {
                actorProfileId: roleCtx.userId,
                source: "admin_ai_credit_topup",
            },
        });

        if (rpcError) {
            return { data: null, error: rpcError.message ?? "Failed to grant credits." };
        }

        const { data, error } = await supabase.from("workspaces")
            .select("ai_balance_millicents")
            .eq("id", input.workspaceId)
            .single();

        if (error || !data) {
            return { data: null, error: error?.message ?? "Failed to read updated balance." };
        }

        return { data: { balanceMillicents: data.ai_balance_millicents }, error: null };
    } catch (err) {
        return {
            data: null,
            error: err instanceof Error ? err.message : "Failed to top up AI credits.",
        };
    }
}

export interface WorkspaceAiSnapshot {
    balanceMillicents: number;
    spend30dMillicents: number;
    recentActivity: Array<{
        id: string;
        delta_millicents: number;
        reason: string;
        notes: string | null;
        created_at: string;
    }>;
}

export async function getWorkspaceAiSnapshot(workspaceId: string): Promise<WorkspaceAiSnapshot> {
    const supabase = await createClient();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Loose typing: ai_balance_millicents column + ai_credit_ledger table added by
    // migration 20260421120000. Re-run `supabase gen types` to restore strict types.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const loose = supabase as unknown as { from: (table: string) => any };
    const [balanceRes, spendRes, recentRes] = await Promise.all([
        loose.from("workspaces")
            .select("ai_balance_millicents")
            .eq("id", workspaceId)
            .single(),
        loose.from("ai_credit_ledger")
            .select("delta_millicents")
            .eq("workspace_id", workspaceId)
            .eq("reason", "ai_usage")
            .gte("created_at", since),
        loose.from("ai_credit_ledger")
            .select("id,delta_millicents,reason,notes,created_at")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false })
            .limit(20),
    ]) as [
        { data: { ai_balance_millicents: number } | null },
        { data: Array<{ delta_millicents: number }> | null },
        { data: WorkspaceAiSnapshot["recentActivity"] | null },
    ];
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const balance = balanceRes.data?.ai_balance_millicents ?? 0;
    const spend30d = (spendRes.data ?? []).reduce((sum, row) => sum + Math.abs(row.delta_millicents), 0);

    return {
        balanceMillicents: balance,
        spend30dMillicents: spend30d,
        recentActivity: recentRes.data ?? [],
    };
}
