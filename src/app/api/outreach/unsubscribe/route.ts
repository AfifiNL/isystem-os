import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { verifyOutreachUnsubscribeToken } from "@/features/outreach/unsubscribe-token";

async function parseRequest(req: NextRequest) {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
        const body = await req.json().catch(() => ({})) as { message?: unknown; token?: unknown };
        return {
            messageId: typeof body.message === "string" ? body.message : null,
            token: typeof body.token === "string" ? body.token : null,
        };
    }
    const formData = await req.formData().catch(() => null);
    return {
        messageId: typeof formData?.get("message") === "string" ? formData.get("message") as string : req.nextUrl.searchParams.get("message"),
        token: typeof formData?.get("token") === "string" ? formData.get("token") as string : req.nextUrl.searchParams.get("token"),
    };
}

async function unsubscribe(req: NextRequest) {
    const { messageId, token } = await parseRequest(req);
    if (!messageId || !token) {
        return NextResponse.json({ ok: false, error: "Missing unsubscribe token." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("outreach_messages" as never)
        .select("id,workspace_id,campaign_id,account_id,contact_id,outreach_contacts(email)" as never)
        .eq("id" as never, messageId as never)
        .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    const message = data as unknown as {
        id: string;
        workspace_id: string;
        campaign_id: string;
        account_id: string;
        contact_id: string;
        outreach_contacts?: { email?: string | null } | { email?: string | null }[] | null;
    } | null;
    if (!message) {
        return NextResponse.json({ ok: false, error: "Invalid unsubscribe token." }, { status: 401 });
    }
    try {
        if (!verifyOutreachUnsubscribeToken({ workspaceId: message.workspace_id, messageId: message.id, token })) {
            return NextResponse.json({ ok: false, error: "Invalid unsubscribe token." }, { status: 401 });
        }
    } catch (verificationError) {
        const message = verificationError instanceof Error ? verificationError.message : String(verificationError);
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }

    const contact = Array.isArray(message.outreach_contacts) ? message.outreach_contacts[0] : message.outreach_contacts;
    const email = contact?.email?.toLowerCase() ?? null;
    const now = new Date().toISOString();
    const { data: eventData } = await supabase.from("outreach_events" as never).insert({
        workspace_id: message.workspace_id,
        campaign_id: message.campaign_id,
        account_id: message.account_id,
        contact_id: message.contact_id,
        message_id: message.id,
        event_type: "unsubscribed",
        occurred_at: now,
        payload: { source: "public_unsubscribe" },
    } as never).select("id" as never).maybeSingle();

    await supabase.from("outreach_messages" as never).update({
        status: "unsubscribed",
        last_event_at: now,
    } as never).eq("id" as never, message.id as never);

    await supabase.from("outreach_contacts" as never).update({
        suppressed_at: now,
        suppression_reason: "unsubscribed",
    } as never).eq("id" as never, message.contact_id as never);

    if (email) {
        await supabase.from("outreach_suppressions" as never).insert({
            workspace_id: message.workspace_id,
            scope: "workspace",
            kind: "email",
            value: email,
            reason: "unsubscribed",
            source_event_id: (eventData as { id?: string } | null)?.id ?? null,
        } as never);
    }

    return NextResponse.json({ ok: true });
}

export const POST = unsubscribe;

export async function GET(req: NextRequest) {
    return unsubscribe(req);
}
