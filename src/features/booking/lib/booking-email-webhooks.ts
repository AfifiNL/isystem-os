import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/shared/lib/resend/send-email";
import { loadManagerRecipients } from "@/features/booking/lib/booking-emails";
import type { Database, Json } from "@/shared/lib/supabase/database.types";

function getServiceRoleClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Missing Supabase service-role configuration.");
    }

    return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatScheduledStart(iso: string, timezone: string): string {
    try {
        return new Intl.DateTimeFormat("en-GB", {
            dateStyle: "full",
            timeStyle: "short",
            timeZone: timezone,
        }).format(new Date(iso));
    } catch {
        return new Date(iso).toUTCString();
    }
}

function buildManagerBounceHtml(params: {
    workspaceName: string;
    publicReference: string;
    customerFullName: string;
    customerEmail: string;
    bounceReason: string;
    scheduledStart: string;
    reservationTimezone: string;
    dashboardUrl: string;
}): string {
    const when = formatScheduledStart(params.scheduledStart, params.reservationTimezone);
    return `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f7f9;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="560" style="max-width:560px;background:#ffffff;border-radius:14px;border:1px solid #e2e8f0;">
    <tr><td style="padding:28px;">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#ef4444;">booking notification bounced</p>
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#0f172a;">Customer email bounced · ${escapeHtml(params.publicReference)}</h1>
      <p style="margin:0 0 6px;font-size:14px;color:#334155;">Customer: <strong>${escapeHtml(params.customerFullName)}</strong></p>
      <p style="margin:0 0 6px;font-size:14px;color:#334155;">Attempted Email: <code>${escapeHtml(params.customerEmail)}</code></p>
      <p style="margin:0 0 6px;font-size:14px;color:#334155;">Bounce Reason: <span style="color:#ef4444;">${escapeHtml(params.bounceReason)}</span></p>
      <p style="margin:0 0 18px;font-size:14px;color:#334155;">Scheduled: ${escapeHtml(when)}</p>
      <a href="${escapeHtml(params.dashboardUrl)}" style="display:inline-block;padding:10px 18px;border-radius:10px;background:#ef4444;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;">Verify customer address</a>
    </td></tr>
  </table>
</body></html>`;
}

export async function processBookingEmailWebhook(payload: Record<string, unknown>): Promise<{ error: string | null }> {
    const supabase = getServiceRoleClient();
    const eventType = typeof payload.type === "string" ? payload.type : "unknown";
    const data = payload.data && typeof payload.data === "object" ? payload.data as Record<string, unknown> : {};

    const providerMessageId = typeof data.email_id === "string"
        ? data.email_id
        : typeof data.emailId === "string"
            ? data.emailId
            : typeof data.id === "string"
                ? data.id
                : null;

    if (!providerMessageId) {
        return { error: null };
    }

    // 1. Resolve matching booking notification event row.
    const { data: eventRow, error: eventError } = await supabase
        .from("booking_notification_events")
        .select("id, reservation_id, workspace_id, event_type, payload_json")
        .eq("provider_message_id", providerMessageId)
        .maybeSingle();

    if (eventError) {
        return { error: eventError.message };
    }

    if (!eventRow) {
        // No match found for this message id in booking events, return success/no-op so newsletter events keep working
        return { error: null };
    }

    // 2. Retrieve reservation context to check metadata and prepare updates
    const { data: reservation, error: resError } = await supabase
        .from("booking_reservations")
        .select(`
            id,
            public_reference,
            customer_full_name,
            customer_email,
            scheduled_start,
            reservation_timezone,
            metadata,
            workspaces:workspace_id ( name, slug ),
            booking_services!booking_reservations_workspace_service_fk ( title )
        `)
        .eq("id", eventRow.reservation_id)
        .maybeSingle();

    if (resError || !reservation) {
        return { error: resError?.message ?? "Reservation context not found." };
    }

    const resRow = reservation as unknown as {
        id: string;
        public_reference: string;
        customer_full_name: string;
        customer_email: string;
        scheduled_start: string;
        reservation_timezone: string;
        metadata: Json;
        workspaces: { name: string; slug: string } | null;
        booking_services: { title: string } | null;
    };

    const eventPayload = (eventRow.payload_json && typeof eventRow.payload_json === "object" && !Array.isArray(eventRow.payload_json))
        ? (eventRow.payload_json as Record<string, unknown>)
        : {};
    const recipientRole = eventPayload.recipientRole === "manager" ? "manager" : "customer";

    const existingMetadata = (resRow.metadata && typeof resRow.metadata === "object" && !Array.isArray(resRow.metadata))
        ? (resRow.metadata as Record<string, unknown>)
        : {};

    const emailDelivery = existingMetadata.emailDelivery && typeof existingMetadata.emailDelivery === "object" && !Array.isArray(existingMetadata.emailDelivery)
        ? (existingMetadata.emailDelivery as Record<string, unknown>)
        : {};

    const recipientDelivery = emailDelivery[recipientRole] && typeof emailDelivery[recipientRole] === "object" && !Array.isArray(emailDelivery[recipientRole])
        ? (emailDelivery[recipientRole] as Record<string, unknown>)
        : {};

    // Check if manager alert has already been sent to avoid duplicate alerts on webhook retries
    const alreadyAlerted = recipientRole === "customer"
        && (Boolean(eventPayload.managerBounceAlertSentAt) || Boolean(recipientDelivery.managerBounceAlertSentAt));

    // 3. Map Resend event type to booking notification delivery status
    let mappedStatus: "delivered" | "delayed" | "bounced" | "complained" | "sent" | "failed" | null = null;
    let isHardFailure = false;
    let reason = "Unknown Resend event";

    if (eventType === "email.sent") {
        mappedStatus = "sent";
        reason = "Accepted by Resend API";
    } else if (eventType === "email.delivered") {
        mappedStatus = "delivered";
        reason = "Delivered to recipient mail server";
    } else if (eventType === "email.delivery_delayed") {
        mappedStatus = "delayed";
        reason = "Temporary delivery delay (Resend is retrying)";
    } else if (eventType === "email.bounced") {
        mappedStatus = "bounced";
        const bounceType =
            (typeof data.type === "string" && data.type) ||
            (typeof data.bounce_type === "string" && data.bounce_type) ||
            "";
        // All bounces on customer notification transactional emails require attention/correction
        isHardFailure = true;
        reason = `Bounced (${bounceType || "unknown bounce type"})`;
    } else if (eventType === "email.complained") {
        mappedStatus = "complained";
        isHardFailure = true;
        reason = "Recipient marked email as spam / complaint received";
    } else if (eventType === "email.failed") {
        mappedStatus = "failed";
        isHardFailure = true;
        reason = typeof data.reason === "string" ? data.reason : "Send failed";
    }

    if (!mappedStatus) {
        return { error: null };
    }

    const now = new Date().toISOString();
    let sentAlertAt: string | null = null;

    // 4. Send manager bounce alert if it is a hard failure/bounce and has not been sent already
    const shouldSendAlert = recipientRole === "customer" && isHardFailure && !alreadyAlerted;

    if (shouldSendAlert) {
        try {
            const managers = await loadManagerRecipients(supabase, eventRow.workspace_id);
            if (managers.length > 0) {
                const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";
                const dashboardUrl = `${siteUrl}/dashboard/booking?tab=reservations`;

                const managerSubject = `Booking email bounced · ${resRow.public_reference} · ${resRow.customer_full_name}`;
                const managerHtml = buildManagerBounceHtml({
                    workspaceName: resRow.workspaces?.name ?? "Your workspace",
                    publicReference: resRow.public_reference,
                    customerFullName: resRow.customer_full_name,
                    customerEmail: resRow.customer_email,
                    bounceReason: reason,
                    scheduledStart: resRow.scheduled_start,
                    reservationTimezone: resRow.reservation_timezone,
                    dashboardUrl,
                });

                // Create audit entry for manager alert
                const managerEventResult = await supabase
                    .from("booking_notification_events")
                    .insert({
                        workspace_id: eventRow.workspace_id,
                        reservation_id: resRow.id,
                        event_type: eventRow.event_type,
                        channel: "email",
                        delivery_status: "pending",
                        payload_json: {
                            recipientRole: "manager",
                            recipients: managers,
                            reason: `Bounce alert: Customer email ${resRow.customer_email} failed.`,
                            bounceReason: reason,
                        },
                    })
                    .select("id")
                    .single();

                const managerEventId = managerEventResult.data?.id ?? null;

                if (managerEventId && process.env.RESEND_API_KEY?.trim()) {
                    try {
                        const fromEmail = process.env.BOOKING_FROM_EMAIL?.trim() ||
                                          process.env.NEWSLETTER_FROM_EMAIL?.trim() ||
                                          "Bookings <noreply@example.invalid>";
                        const replyTo = process.env.BOOKING_REPLY_TO_EMAIL?.trim() ||
                                        process.env.NEWSLETTER_REPLY_TO_EMAIL?.trim() ||
                                        undefined;

                        const sendResult = await sendEmail({
                            from: fromEmail,
                            to: managers,
                            subject: managerSubject,
                            html: managerHtml,
                            replyTo,
                            idempotencyKey: `booking-bounce:${resRow.id}:${eventRow.id}`,
                        });

                        await supabase
                            .from("booking_notification_events")
                            .update({
                                delivery_status: "sent",
                                sent_at: new Date().toISOString(),
                                provider_message_id: sendResult.id,
                                payload_json: {
                                    recipientRole: "manager",
                                    recipients: managers,
                                    providerMessageId: sendResult.id,
                                },
                            })
                            .eq("id", managerEventId);

                        sentAlertAt = now;
                    } catch (sendError) {
                        const message = sendError instanceof Error ? sendError.message : "Unknown error";
                        await supabase
                            .from("booking_notification_events")
                            .update({
                                delivery_status: "failed",
                                payload_json: {
                                    recipientRole: "manager",
                                    recipients: managers,
                                    emailError: message,
                                },
                            })
                            .eq("id", managerEventId);
                    }
                }
            }
        } catch (managerAlertError) {
            console.error("Failed to dispatch manager fallback bounce alert", managerAlertError);
        }
    }

    // 5. Update original customer booking_notification_events row
    const updatedEventPayload = {
        ...eventPayload,
        resendEvent: eventType,
        resendPayload: data,
        lastEventAt: now,
        reason,
        ...(sentAlertAt || alreadyAlerted ? { managerBounceAlertSentAt: sentAlertAt || recipientDelivery.managerBounceAlertSentAt || now } : {}),
    };

    const patch: Record<string, unknown> = {
        delivery_status: mappedStatus as Database["public"]["Enums"]["booking_notification_delivery_status"],
        payload_json: updatedEventPayload as unknown as Json,
    };

    if (mappedStatus === "sent") {
        patch.sent_at = now;
    }

    const { error: updateEventError } = await supabase
        .from("booking_notification_events")
        .update(patch)
        .eq("id", eventRow.id);

    if (updateEventError) {
        return { error: updateEventError.message };
    }

    // 6. Update reservation context metadata (preserving manager/sibling emailDelivery metadata)
    const updatedMetadata = {
        ...existingMetadata,
        emailDelivery: {
            ...emailDelivery,
            [recipientRole]: {
                ...recipientDelivery,
                status: mappedStatus,
                lastEventAt: now,
                reason,
                requiresEmailCorrection: recipientRole === "customer" && isHardFailure,
                ...(sentAlertAt || alreadyAlerted ? { managerBounceAlertSentAt: sentAlertAt || recipientDelivery.managerBounceAlertSentAt || now } : {}),
            },
        },
    };

    const { error: updateResError } = await supabase
        .from("booking_reservations")
        .update({ metadata: updatedMetadata as unknown as Json })
        .eq("id", resRow.id);

    if (updateResError) {
        return { error: updateResError.message };
    }

    return { error: null };
}
