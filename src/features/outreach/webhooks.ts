import { createAdminClient } from "@/shared/lib/supabase/admin";
import type { Json } from "@/shared/lib/supabase/database.types";
import type { OutreachEventType, OutreachMessageRow } from "@/features/outreach/types";
import { recordOutreachBusinessEvent } from "@/features/business-spine/recorders";

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function providerMessageId(payload: Record<string, unknown>) {
    const data = asRecord(payload.data);
    return typeof data.email_id === "string"
        ? data.email_id
        : typeof data.emailId === "string"
            ? data.emailId
            : typeof data.id === "string"
                ? data.id
                : null;
}

function mapResendEvent(type: string): OutreachEventType | null {
    switch (type) {
        case "email.sent": return "sent";
        case "email.delivered": return "delivered";
        case "email.opened": return "opened";
        case "email.clicked": return "clicked";
        case "email.bounced": return "bounced";
        case "email.complained": return "complained";
        case "email.failed": return "failed";
        case "email.received": return "received";
        default: return null;
    }
}

function messageStatus(eventType: OutreachEventType) {
    if (eventType === "delivered") return "delivered";
    if (eventType === "opened") return "opened";
    if (eventType === "clicked") return "clicked";
    if (eventType === "bounced") return "bounced";
    if (eventType === "complained") return "complained";
    if (eventType === "failed") return "failed";
    if (eventType === "received") return "replied";
    return "sent";
}

export async function processOutreachResendWebhook(payload: Record<string, unknown>) {
    const eventTypeRaw = typeof payload.type === "string" ? payload.type : "unknown";
    const eventType = mapResendEvent(eventTypeRaw);
    const providerEventId = typeof payload.created_at === "string" ? `${eventTypeRaw}:${payload.created_at}` : null;
    const messageId = providerMessageId(payload);
    if (!eventType || !messageId) return { processed: false, reason: "Not an outreach event." };

    const supabase = createAdminClient();
    const { data: messageData, error: messageError } = await supabase
        .from("outreach_messages" as never)
        .select("*" as never)
        .eq("provider_message_id" as never, messageId as never)
        .maybeSingle();
    if (messageError) return { processed: false, error: messageError.message };
    const message = messageData as unknown as OutreachMessageRow | null;
    if (!message) return { processed: false, reason: "Provider message id not managed by Outreach." };

    const now = new Date().toISOString();
    const { data: eventData, error: eventError } = await supabase.from("outreach_events" as never).upsert({
        workspace_id: message.workspace_id,
        campaign_id: message.campaign_id,
        account_id: message.account_id,
        contact_id: message.contact_id,
        message_id: message.id,
        event_type: eventType,
        provider: "resend",
        provider_event_id: providerEventId,
        provider_message_id: messageId,
        occurred_at: now,
        payload: payload as Json,
    } as never, { onConflict: "provider,provider_event_id" }).select("id" as never).maybeSingle();
    if (eventError) return { processed: false, error: eventError.message };

    await supabase.from("outreach_messages" as never).update({
        status: messageStatus(eventType),
        last_event_at: now,
    } as never).eq("id" as never, message.id as never);

    if (eventType === "bounced" || eventType === "complained") {
        const { data: contactData } = await supabase
            .from("outreach_contacts" as never)
            .select("email,email_hash,full_name" as never)
            .eq("id" as never, message.contact_id as never)
            .maybeSingle();
        const contact = contactData as unknown as { email?: string | null; email_hash?: string | null; full_name?: string | null } | null;
        if (contact?.email) {
            await supabase.from("outreach_suppressions" as never).insert({
                workspace_id: message.workspace_id,
                scope: "workspace",
                kind: "email",
                value: contact.email.toLowerCase(),
                reason: eventType,
                source_event_id: (eventData as { id?: string } | null)?.id ?? null,
            } as never);
            await supabase.from("outreach_contacts" as never).update({
                suppressed_at: now,
                suppression_reason: eventType,
            } as never).eq("id" as never, message.contact_id as never);
            await recordOutreachBusinessEvent({
                supabase,
                workspaceId: message.workspace_id,
                eventType: "suppressed",
                contact: { email: contact.email, name: contact.full_name ?? null },
                campaignId: message.campaign_id,
                contactId: message.contact_id,
                messageId: message.id,
                payload: { providerEventId, providerMessageId: messageId, reason: eventType },
            });
        }
    }

    if (eventType === "received") {
        const { data: contactData } = await supabase
            .from("outreach_contacts" as never)
            .select("email,full_name" as never)
            .eq("id" as never, message.contact_id as never)
            .maybeSingle();
        const contact = contactData as unknown as { email?: string | null; full_name?: string | null } | null;
        await recordOutreachBusinessEvent({
            supabase,
            workspaceId: message.workspace_id,
            eventType: "replied",
            contact: { email: contact?.email ?? null, name: contact?.full_name ?? null },
            campaignId: message.campaign_id,
            contactId: message.contact_id,
            messageId: message.id,
            payload: { providerEventId, providerMessageId: messageId },
        });
    }

    return { processed: true, eventType };
}
