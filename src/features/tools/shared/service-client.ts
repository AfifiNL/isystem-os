import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/supabase/database.types";

let cached: SupabaseClient<Database> | null = null;

/**
 * Service-role Supabase client for public tools. All writes to `tool_leads`,
 * `tool_scan_cache`, and `tool_rate_limits` go through this client because
 * those tables have RLS enabled and no anon policies — by design, since the
 * tools run anonymously.
 */
export function getToolsServiceClient(): SupabaseClient<Database> | null {
    if (cached) return cached;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error("[tools] SUPABASE_SERVICE_ROLE_KEY missing — public tools cannot persist results.");
        return null;
    }
    cached = createServiceClient<Database>(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    return cached;
}
