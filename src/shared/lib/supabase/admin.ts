
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/supabase/database.types";

/**
 * Service-role Supabase client for internal server-only operations that must
 * bypass Row Level Security (e.g. reading workspace config inside AI routes
 * where the calling context may not carry the user session cookie).
 *
 * NEVER expose this client to the browser or return its data directly to users.
 */
export function createAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (!url || !serviceKey) {
        throw new Error(
            "Missing required env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set for internal admin queries.",
        );
    }

    return createSupabaseClient<Database>(url, serviceKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}
