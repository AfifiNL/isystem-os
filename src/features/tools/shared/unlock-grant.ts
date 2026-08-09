// Newsletter-unlock grant helpers for the free-tools surface.
//
// Used by:
//   - runWithToolGuardrails (server-side, falls back to this when the
//     1/day IP cap is hit)
//   - /api/newsletter/subscribe (server-side, mints the grant + cookie
//     when a tool-modal subscribe carries `grantUnlock: { tool }`)
//
// Cookie contract:
//   - Name: NEWSLETTER_UNLOCK_COOKIE
//   - HttpOnly, Secure (in prod), SameSite=Lax
//   - 30-day lifetime; refreshed each time a grant is minted
//   - Carries an opaque random token. The server resolves the token to a
//     grant row; the cookie never carries counters. Stealing the cookie
//     gets the attacker at most the remaining uses; tampering with a fake
//     token resolves to nothing.

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getToolsServiceClient } from "./service-client";
import type { ToolSlug } from "./types";

export const NEWSLETTER_UNLOCK_COOKIE = "isystem_unlock";
export const UNLOCK_USES_PER_TOOL = 3;
export const UNLOCK_TTL_DAYS = 30;

function generateUnlockToken(): string {
    return randomBytes(24).toString("base64url");
}

/** Peek (no consume) the remaining uses for a given token + tool. Used after
 * mintUnlockGrant to report accurate "you have N runs left" copy — important
 * when the grant was reused (visitor re-subscribing) and the count is not
 * a fresh UNLOCK_USES_PER_TOOL. */
export async function getUnlockRemainingForTool(token: string, tool: ToolSlug): Promise<number> {
    const supabase = getToolsServiceClient();
    if (!supabase) return 0;
    const { data, error } = await supabase.rpc("newsletter_unlock_remaining", {
        p_token: token,
        p_tool: tool,
        p_per_tool_cap: UNLOCK_USES_PER_TOOL,
    });
    if (error) {
        console.error("[tools.unlock] remaining rpc error", error.message);
        return 0;
    }
    return typeof data === "number" ? data : 0;
}

/** Reads the unlock cookie from the current request. Returns null when absent. */
export async function getUnlockTokenFromCookies(): Promise<string | null> {
    const store = await cookies();
    const value = store.get(NEWSLETTER_UNLOCK_COOKIE)?.value?.trim();
    return value && value.length >= 24 ? value : null;
}

/**
 * Try to consume one unlock for the given tool against the cookie's token.
 * Returns:
 *  - `{ allowed: true, usesRemaining }` when consumption succeeded.
 *  - `{ allowed: false, reason }` when the cookie is missing, the token
 *    is unknown/expired/revoked, or the per-tool cap has been hit.
 *
 * Fails OPEN at the infra layer (no service client → returns false; the
 * caller's rate-limit error stays as-is). Never throws.
 */
export async function tryConsumeUnlockForTool(tool: ToolSlug): Promise<{
    allowed: boolean;
    usesRemaining: number;
    reason: "no_cookie" | "unknown_token" | "revoked" | "expired" | "cap_reached" | "infra";
}> {
    const token = await getUnlockTokenFromCookies();
    if (!token) return { allowed: false, usesRemaining: 0, reason: "no_cookie" };

    const supabase = getToolsServiceClient();
    if (!supabase) return { allowed: false, usesRemaining: 0, reason: "infra" };

    const { data, error } = await supabase.rpc("newsletter_unlock_consume", {
        p_token: token,
        p_tool: tool,
        p_per_tool_cap: UNLOCK_USES_PER_TOOL,
    });

    if (error) {
        console.error("[tools.unlock] consume rpc error", error.message);
        return { allowed: false, usesRemaining: 0, reason: "infra" };
    }

    // Postgres COMPOSITE returns either an object or a [a,b,c] tuple depending
    // on driver version; normalize.
    const row = (Array.isArray(data) ? data[0] : data) as {
        allowed: boolean;
        uses_remaining: number;
        reason: string | null;
    } | null;

    if (!row) return { allowed: false, usesRemaining: 0, reason: "infra" };
    if (row.allowed) return { allowed: true, usesRemaining: row.uses_remaining, reason: "infra" };

    const reason = (row.reason ?? "infra") as "unknown_token" | "revoked" | "expired" | "cap_reached" | "infra";
    return { allowed: false, usesRemaining: 0, reason };
}

/**
 * Mint an unlock grant for the given email, or reuse the existing active
 * one. Sets the HttpOnly cookie either way. Returns `{ token, expiresAt,
 * reused }` so the caller can surface accurate "uses remaining" copy.
 *
 * Why reuse instead of always minting fresh:
 *   - Without this check, a visitor could subscribe → consume all 3 unlocks
 *     → subscribe again with the same email → get 3 more → repeat. The
 *     daily 1/IP cap and the email-based subscribe (de-duped via the
 *     audience) don't stop this on their own.
 *   - "Active" = not revoked AND not expired. An exhausted-but-not-expired
 *     grant is still active; reusing it means the user keeps the existing
 *     remaining count (often 0), not a fresh 3. That's the whole point.
 *   - When the existing grant has genuinely expired, we mint a fresh one
 *     — the user has effectively rejoined after a 30-day quiet period and
 *     deserves the full quota again.
 *
 * Race note: two parallel subscribes from the same email could both fall
 * through the active-check and insert. We don't enforce a unique
 * constraint at the DB level (that's a partial-index with a time predicate
 * which Postgres won't accept) — the abuse we care about is "subscribe
 * again later to reset", not "subscribe twice in the same 300ms window."
 * In the rare race, the second insert succeeds; the cookie points to the
 * latest token; the older row sits idle until expiry. No quota inflation.
 */
export async function mintUnlockGrant(params: {
    email: string;
    workspaceId: string | null;
    source?: string;
}): Promise<{ token: string; expiresAt: Date; reused: boolean } | null> {
    const supabase = getToolsServiceClient();
    if (!supabase) {
        console.error("[tools.unlock] mint: service client not configured");
        return null;
    }

    const emailNormalized = params.email.toLowerCase().trim();
    const nowIso = new Date().toISOString();

    // Look for an existing active grant for this email + workspace. Scoped
    // to workspace_id so the same person legitimately using two workspaces
    // (rare on the public tools surface, but possible) gets one grant per
    // workspace, not a single global pool.
    let existingQuery = supabase
        .from("newsletter_unlock_grants")
        .select("unlock_token, expires_at")
        .eq("email_normalized", emailNormalized)
        .is("revoked_at", null)
        .gt("expires_at", nowIso)
        .order("granted_at", { ascending: false })
        .limit(1);

    if (params.workspaceId === null) {
        existingQuery = existingQuery.is("workspace_id", null);
    } else {
        existingQuery = existingQuery.eq("workspace_id", params.workspaceId);
    }

    const { data: existingRow } = await existingQuery.maybeSingle();

    if (existingRow?.unlock_token) {
        // Reuse path. Re-set the cookie so it survives even if the user
        // cleared cookies and is subscribing from a fresh browser session
        // — same email finds the same grant.
        const expiresAt = new Date(existingRow.expires_at);
        const remainingMaxAge = Math.max(
            60,
            Math.floor((expiresAt.getTime() - Date.now()) / 1000),
        );
        const store = await cookies();
        store.set(NEWSLETTER_UNLOCK_COOKIE, existingRow.unlock_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: remainingMaxAge,
        });
        return { token: existingRow.unlock_token, expiresAt, reused: true };
    }

    const token = generateUnlockToken();
    const expiresAt = new Date(Date.now() + UNLOCK_TTL_DAYS * 24 * 60 * 60 * 1000);

    const { error } = await supabase.from("newsletter_unlock_grants").insert({
        unlock_token: token,
        email_normalized: emailNormalized,
        workspace_id: params.workspaceId,
        source: params.source ?? "tool_modal",
        expires_at: expiresAt.toISOString(),
    });

    if (error) {
        console.error("[tools.unlock] mint insert error", error.message);
        return null;
    }

    const store = await cookies();
    store.set(NEWSLETTER_UNLOCK_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: UNLOCK_TTL_DAYS * 24 * 60 * 60,
    });

    return { token, expiresAt, reused: false };
}
