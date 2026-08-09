import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertWorkspaceAdminOrManager } from "@/shared/lib/workspace/context";
import { mixEpisode } from "@/features/podcast/lib/mix-episode";

// Vercel Node runtime — needs the binary on disk and process spawning.
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Authentication: this route accepts EITHER
 *   1. A normal authenticated user session (cookies) where the user passes
 *      assertWorkspaceAdminOrManager — useful for direct testing from the
 *      dashboard with a logged-in admin.
 *   2. An internal service-role bearer token, where the caller has ALREADY
 *      authorized the user upstream and is delegating just the mix work.
 *      Scoping is then enforced via an explicit workspaceId in the body,
 *      validated against the episode's workspace_id inside the mixer.
 *
 * Server actions in the same Node runtime now invoke `mixEpisode` directly
 * via in-process import (see publishEpisode in src/features/podcast/actions.ts).
 * This HTTP route remains for: (a) external callers, (b) future async/queue
 * workers, (c) browser-driven retries.
 */
async function resolveCallerWorkspaceId(
    request: NextRequest,
    bodyWorkspaceId: string | undefined,
    bodyInternalToken: string | undefined,
): Promise<{ workspaceId: string } | { error: string; status: number }> {
    const internalSecret = process.env.PODCAST_INTERNAL_SECRET?.trim();

    // Internal-token modes (server-action self-fetch). We accept the secret
    // through any of three channels because Vercel's edge layer can strip or
    // alter request headers on internal hops, and apex/www cookie-domain
    // mismatches break cookie auth on self-fetches:
    //   1. Request body field `internalToken` (preferred — bodies are never
    //      altered in transit).
    //   2. `x-internal-token: <secret>` header (custom names survive the edge
    //      better than `authorization`).
    //   3. `authorization: Bearer <secret>` header (legacy compatibility).
    if (internalSecret) {
        const bodyToken = bodyInternalToken?.trim();
        const customToken = request.headers.get("x-internal-token")?.trim();
        const authHeader = request.headers.get("authorization") ?? "";
        const bearerToken = authHeader.startsWith("Bearer ")
            ? authHeader.slice("Bearer ".length).trim()
            : "";
        if (
            bodyToken === internalSecret
            || customToken === internalSecret
            || bearerToken === internalSecret
        ) {
            if (!bodyWorkspaceId) {
                return { error: "workspaceId required for internal-token requests.", status: 400 };
            }
            return { workspaceId: bodyWorkspaceId };
        }
    }

    // Cookie-based session auth (direct dashboard call, or server-action
    // self-fetch that successfully forwarded cookies on the canonical host).
    try {
        const context = await assertWorkspaceAdminOrManager();
        return { workspaceId: context.activeWorkspace.id };
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unauthorized";
        const status = message.startsWith("Forbidden") ? 403 : 401;
        return { error: message, status };
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = (await request.json()) as {
            episodeId?: string;
            workspaceId?: string;
            internalToken?: string;
        };
        if (!body.episodeId) {
            return NextResponse.json({ error: "episodeId required" }, { status: 400 });
        }

        const auth = await resolveCallerWorkspaceId(request, body.workspaceId, body.internalToken);
        if ("error" in auth) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
        if (!supabaseUrl || !serviceRoleKey) {
            return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
        }
        const supabase = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        const result = await mixEpisode(supabase, {
            episodeId: body.episodeId,
            expectedWorkspaceId: auth.workspaceId,
        });

        if ("error" in result) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }
        return NextResponse.json(result);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Mix failed";
        console.error("[mix-podcast-episode] error:", err);
        const status = message.startsWith("Forbidden") ? 403 : message.startsWith("Unauthorized") ? 401 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
