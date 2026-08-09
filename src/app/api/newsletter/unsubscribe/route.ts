import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/supabase/database.types";
import { buildSiteUrl } from "@/shared/lib/site-url";

// One-click unsubscribe per RFC 8058. Resend forwards `List-Unsubscribe-Post:
// List-Unsubscribe=One-Click` headers on every campaign send; Gmail/Yahoo
// fire a POST to this URL when the user clicks the inline unsubscribe link
// rendered by the mail client. We MUST respond 2xx even when the contact is
// already unsubscribed — anything else gets the sender penalized.
//
// We also accept GET so the in-email footer link works as a direct browser
// navigation; on success the user is redirected to the public confirmation
// page so they see something useful instead of raw JSON.

function getServiceClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !key) {
        throw new Error("Missing Supabase service credentials.");
    }
    return createServiceClient<Database>(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

async function processUnsubscribe(token: string): Promise<{ ok: boolean; error?: string }> {
    if (!token) return { ok: false, error: "Missing token." };
    const supabase = getServiceClient();
    const { data: contact, error } = await supabase
        .from("newsletter_contacts")
        .select("id, status")
        .eq("unsubscribe_token", token)
        .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!contact) {
        // Don't reveal whether the token exists. RFC 8058 requires 2xx on
        // success; treat invalid as already-unsubscribed silently.
        return { ok: true };
    }
    if (contact.status === "unsubscribed") return { ok: true };

    const { error: updateError } = await supabase
        .from("newsletter_contacts")
        .update({
            status: "unsubscribed",
            unsubscribed_at: new Date().toISOString(),
        })
        .eq("id", contact.id);
    if (updateError) return { ok: false, error: updateError.message };
    return { ok: true };
}

export async function POST(req: NextRequest) {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") ?? "";
    const result = await processUnsubscribe(token);
    if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") ?? "";
    const result = await processUnsubscribe(token);
    const target = new URL(buildSiteUrl("/newsletter/unsubscribe"));
    target.searchParams.set("status", result.ok ? "ok" : "error");
    if (!result.ok && result.error) {
        target.searchParams.set("message", result.error);
    }
    return NextResponse.redirect(target, { status: 302 });
}
