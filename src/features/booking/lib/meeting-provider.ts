import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/supabase/database.types";
import { resolveBookingMeetingProvider, validateMeetingProvider, type BookingMeetingProvider } from "./meeting-policy";
import { createZoomMeeting, deleteZoomMeeting, updateZoomMeeting } from "./zoom";

type BookingDb = SupabaseClient<Database>;
const MEETING_PROVISIONING_LEASE_MS = 5 * 60_000;

type MeetingResult = {
    provider: BookingMeetingProvider;
    status: "not_configured" | "pending" | "ready" | "failed" | "cancelled";
    joinUrl: string | null;
    error?: string;
};

function safeError(error: unknown): string {
    return error instanceof Error ? error.message : "Meeting provider request failed.";
}

async function loadMeetingContext(supabase: BookingDb, reservationId: string) {
    const { data: reservation, error: reservationError } = await supabase
        .from("booking_reservations")
        .select("id,workspace_id,status,public_reference,scheduled_start,scheduled_end,service_id")
        .eq("id", reservationId)
        .maybeSingle();
    if (reservationError || !reservation) throw new Error("Reservation not found.");
    const { data: service, error: serviceError } = await supabase
        .from("booking_services")
        .select("id,title,service_key,duration_minutes,virtual_meeting_provider,auto_create_virtual_meeting")
        .eq("id", reservation.service_id)
        .eq("workspace_id", reservation.workspace_id)
        .maybeSingle();
    if (serviceError || !service) throw new Error("Booking service not found.");
    return { reservation, service };
}

export async function ensureBookingMeeting(supabase: BookingDb, reservationId: string): Promise<MeetingResult> {
    const { reservation, service } = await loadMeetingContext(supabase, reservationId);
    const provider = resolveBookingMeetingProvider(service.virtual_meeting_provider);
    let { data: existing } = await supabase
        .from("booking_meetings" as never)
        .select("*")
        .eq("workspace_id" as never, reservation.workspace_id as never)
        .eq("reservation_id" as never, reservation.id as never)
        .maybeSingle() as unknown as { data: {
            id: string;
            provider: string;
            provider_meeting_id: string | null;
            calendar_event_id: string | null;
            join_url: string | null;
            status: string;
            scheduled_start: string;
            scheduled_end: string;
            updated_at: string;
            calendar_connection_id: string | null;
            provisioning_token: string | null;
            provisioning_expires_at: string | null;
            } | null };

    const meetingWasPreviouslyProvisioned = Boolean(existing && (
        existing.status !== "cancelled"
        || existing.provider_meeting_id
        || existing.calendar_event_id
    ));
    if (!service.auto_create_virtual_meeting || provider === "none") {
        if (meetingWasPreviouslyProvisioned) {
            try {
                await cancelBookingMeeting(supabase, reservationId);
                const { deleteReservationFromGoogleCalendar } = await import("./google-calendar");
                const calendarCleanup = await deleteReservationFromGoogleCalendar(supabase, reservationId);
                if (!calendarCleanup.success) {
                    return { provider: "none", status: "failed", joinUrl: null, error: calendarCleanup.error };
                }
            } catch (cleanupError) {
                return { provider: "none", status: "failed", joinUrl: null, error: safeError(cleanupError) };
            }
        }
        // Calendar event sync is independent from virtual-room creation. A
        // service may intentionally have no Meet/Zoom room while still
        // requiring the operator's connected Google Calendar to contain the
        // appointment. `pushReservationToGoogleCalendar` is a no-op when no
        // calendar connection exists for non-Meet services.
        if (reservation.status === "confirmed" || reservation.status === "completed") {
            try {
                const { pushReservationToGoogleCalendar } = await import("./google-calendar");
                const sync = await pushReservationToGoogleCalendar(supabase, reservation.id);
                if (!sync.success) return { provider: "none", status: "failed", joinUrl: null, error: sync.error };
            } catch (calendarError) {
                return { provider: "none", status: "failed", joinUrl: null, error: safeError(calendarError) };
            }
        }
        return { provider: "none", status: "not_configured", joinUrl: null };
    }
    if (reservation.status !== "confirmed"
        && reservation.status !== "completed"
        && reservation.status !== "pending_review"
        && reservation.status !== "pending_confirmation") {
        return { provider, status: "pending", joinUrl: null };
    }
    const policy = validateMeetingProvider(provider, service.duration_minutes);
    if (!policy.ok) return { provider, status: "failed", joinUrl: null, error: policy.error };

    if (existing?.provider === provider && existing.status === "ready"
        && existing.scheduled_start === reservation.scheduled_start
        && existing.scheduled_end === reservation.scheduled_end
        && existing.join_url
        // If the event mapping is gone, let Google recreate the event and
        // conference. A mapped event with the same schedule is already
        // synchronized and does not need another provider call.
        && (provider !== "google_meet" || existing.calendar_event_id)) {
        // Probe an existing provider object before returning a customer link.
        // A manager can delete either the Zoom meeting or the Google event
        // outside the workspace; both paths must recreate rather than serve a dead
        // URL forever. Google sync also PATCHes the mapped event, preserving
        // conference data during a reschedule.
        if (provider === "zoom" && existing.provider_meeting_id) {
            try {
                await updateZoomMeeting(existing.provider_meeting_id, {
                    topic: service.title,
                    startTime: reservation.scheduled_start,
                    durationMinutes: service.duration_minutes,
                    reference: reservation.public_reference,
                });
            } catch (providerError) {
                if (!(providerError instanceof Error) || !/\(404\)/.test(providerError.message)) {
                    await supabase
                        .from("booking_meetings" as never)
                        .update({ last_error: safeError(providerError).slice(0, 500), updated_at: new Date().toISOString() } as never)
                        .eq("workspace_id" as never, reservation.workspace_id as never)
                        .eq("reservation_id" as never, reservation.id as never)
                        .eq("status" as never, "ready" as never);
                    return { provider, status: "ready", joinUrl: existing.join_url, error: safeError(providerError) };
                }
                const staleAt = new Date().toISOString();
                await supabase
                    .from("booking_meetings" as never)
                    .update({
                        status: "pending",
                        provider_meeting_id: null,
                        join_url: null,
                        last_error: "The Zoom meeting was removed outside the workspace; provisioning a replacement.",
                        updated_at: staleAt,
                    } as never)
                    .eq("workspace_id" as never, reservation.workspace_id as never)
                    .eq("reservation_id" as never, reservation.id as never)
                    .eq("status" as never, "ready" as never);
                existing = {
                    ...existing,
                    status: "pending",
                    provider_meeting_id: null,
                    join_url: null,
                    updated_at: staleAt,
                };
            }
        }

        if (existing.status === "ready") {
            try {
                const { pushReservationToGoogleCalendar } = await import("./google-calendar");
                const sync = await pushReservationToGoogleCalendar(supabase, reservation.id, { allowPreconfirmation: true });
                if (sync.success) {
                    const { data: refreshed } = await supabase
                        .from("booking_meetings" as never)
                        .select("status,join_url" as never)
                        .eq("workspace_id" as never, reservation.workspace_id as never)
                        .eq("reservation_id" as never, reservation.id as never)
                        .maybeSingle() as unknown as { data: { status: string; join_url: string | null } | null };
                    return {
                        provider,
                        status: (refreshed?.status ?? "ready") as MeetingResult["status"],
                        joinUrl: refreshed?.join_url ?? existing.join_url,
                    };
                }
                await supabase
                    .from("booking_meetings" as never)
                    .update({ last_error: sync.error?.slice(0, 500) ?? null, updated_at: new Date().toISOString() } as never)
                    .eq("workspace_id" as never, reservation.workspace_id as never)
                    .eq("reservation_id" as never, reservation.id as never)
                    .eq("status" as never, "ready" as never);
                return { provider, status: "ready", joinUrl: existing.join_url, error: sync.error };
            } catch (syncError) {
                await supabase
                    .from("booking_meetings" as never)
                    .update({ last_error: safeError(syncError).slice(0, 500), updated_at: new Date().toISOString() } as never)
                    .eq("workspace_id" as never, reservation.workspace_id as never)
                    .eq("reservation_id" as never, reservation.id as never)
                    .eq("status" as never, "ready" as never);
                return { provider, status: "ready", joinUrl: existing.join_url, error: safeError(syncError) };
            }
        }
    }

    const now = new Date().toISOString();
    if (existing?.provider === "google_meet" && existing.provider !== provider) {
        // A provider change must remove every Google event/conference before
        // a Zoom room becomes customer-visible. Otherwise the old Meet link
        // remains live (and can be sent from a stale calendar invite) even
        // though the service now advertises Zoom.
        try {
            const { deleteReservationFromGoogleCalendar } = await import("./google-calendar");
            const calendarCleanup = await deleteReservationFromGoogleCalendar(supabase, reservation.id);
            if (!calendarCleanup.success) {
                return {
                    provider,
                    status: "failed",
                    joinUrl: null,
                    error: calendarCleanup.error ?? "Google Calendar cleanup failed before switching meeting providers.",
                };
            }
        } catch (cleanupError) {
            return {
                provider,
                status: "failed",
                joinUrl: null,
                error: `Google Calendar cleanup failed before switching meeting providers: ${safeError(cleanupError)}`,
            };
        }
    }
    if (existing?.provider === "zoom" && existing.provider !== provider && existing.provider_meeting_id) {
        try {
            await deleteZoomMeeting(existing.provider_meeting_id);
        } catch (cleanupError) {
            // Do not provision a second provider while the old Zoom meeting
            // is still live. A transient delete failure must be retried rather
            // than leaving an orphaned customer-accessible meeting behind.
            throw new Error(`Unable to remove the previous Zoom meeting before switching providers: ${safeError(cleanupError)}`);
        }
    }
    if (existing?.provider === "zoom" && provider === "google_meet") {
        // Zoom services can still have a Google calendar event from the
        // workspace-wide calendar sync. Remove that old event before the Meet
        // provider is provisioned so a stale invite cannot retain a deleted
        // Zoom URL while the new provider is being created.
        try {
            const { deleteReservationFromGoogleCalendar } = await import("./google-calendar");
            const calendarCleanup = await deleteReservationFromGoogleCalendar(supabase, reservation.id);
            if (!calendarCleanup.success) {
                return {
                    provider,
                    status: "failed",
                    joinUrl: null,
                    error: calendarCleanup.error ?? "Google Calendar cleanup failed before switching meeting providers.",
                };
            }
            existing = {
                ...existing,
                status: "cancelled",
                provider_meeting_id: null,
                calendar_event_id: null,
                calendar_connection_id: null,
                join_url: null,
                updated_at: new Date().toISOString(),
            };
        } catch (cleanupError) {
            return {
                provider,
                status: "failed",
                joinUrl: null,
                error: `Google Calendar cleanup failed before switching meeting providers: ${safeError(cleanupError)}`,
            };
        }
    }
    if (existing?.status === "cancelled" && existing.provider === "zoom" && existing.provider_meeting_id) {
        try {
            await deleteZoomMeeting(existing.provider_meeting_id);
        } catch (cleanupError) {
            return {
                provider,
                status: "failed",
                joinUrl: null,
                error: `Unable to finish removing the cancelled Zoom meeting before rescheduling: ${safeError(cleanupError)}`,
            };
        }
    }
    const reusableProviderMeeting = existing
        && existing.provider === provider
        && existing.status !== "cancelled"
        ? existing
        : null;
    const existingScheduleUnchanged = Boolean(
        existing
        && existing.scheduled_start === reservation.scheduled_start
        && existing.scheduled_end === reservation.scheduled_end,
    );
    const preservesGoogleConference = provider === "google_meet"
        && reusableProviderMeeting?.status === "ready"
        && existingScheduleUnchanged
        && Boolean(reusableProviderMeeting.join_url)
        && Boolean(reusableProviderMeeting.calendar_event_id);
    const provisioningToken = randomUUID();
    const provisioningExpiresAt = new Date(Date.now() + MEETING_PROVISIONING_LEASE_MS).toISOString();
    const pendingRow = {
            workspace_id: reservation.workspace_id,
            reservation_id: reservation.id,
            provider,
            // A Google reschedule should PATCH the existing event and retain
            // its conference. Keep the local meeting ready when a customer-
            // safe Meet URL already exists; only a first provision is pending.
            status: preservesGoogleConference ? "ready" : "pending",
            scheduled_start: reservation.scheduled_start,
            scheduled_end: reservation.scheduled_end,
            provider_meeting_id: reusableProviderMeeting?.provider_meeting_id ?? null,
            calendar_event_id: reusableProviderMeeting?.calendar_event_id ?? null,
            join_url: reusableProviderMeeting?.join_url ?? null,
            last_error: null,
            provisioning_token: provisioningToken,
            provisioning_expires_at: provisioningExpiresAt,
            updated_at: now,
        };
    let claimed: {
        id: string;
        provider_meeting_id: string | null;
        join_url: string | null;
        status: string;
        provisioning_token: string | null;
    } | null = null;
    const inserted = await supabase
        .from("booking_meetings" as never)
        .insert(pendingRow as never)
        .select("id,provider_meeting_id,join_url,status,provisioning_token" as never)
        .maybeSingle() as unknown as { data: { id: string; provider_meeting_id: string | null; join_url: string | null; status: string; provisioning_token: string | null } | null; error?: { code?: string; message?: string } | null };
    if (inserted.data) {
        claimed = inserted.data;
    } else {
        const stalePending = existing?.status === "pending"
            && (
                existing.provisioning_expires_at
                    ? Date.parse(existing.provisioning_expires_at) <= Date.now()
                    : Date.parse(existing.updated_at) < Date.now() - MEETING_PROVISIONING_LEASE_MS
            );
        if (existing?.status === "pending" && !stalePending) {
            return { provider, status: "pending", joinUrl: existing.join_url };
        }
        if (!existing) {
            // Another caller may have won the unique insert race; avoid an
            // update with an undefined id and let that caller finish setup.
            return { provider, status: "pending", joinUrl: null };
        }
        const reclaimed = await supabase
            .from("booking_meetings" as never)
            .update(pendingRow as never)
            .eq("id" as never, existing.id as never)
            // Optimistic claim: concurrent retries must not both provision a
            // provider meeting from the same stale pending row.
            .eq("updated_at" as never, existing.updated_at as never)
            .select("id,provider_meeting_id,join_url,status,provisioning_token" as never)
            .maybeSingle() as unknown as { data: { id: string; provider_meeting_id: string | null; join_url: string | null; status: string; provisioning_token: string | null } | null };
        claimed = reclaimed.data;
    }

    if (!claimed) return { provider, status: "pending", joinUrl: null };

    let createdZoomMeetingId: string | null = null;
    try {
        let providerMeetingId = claimed.provider_meeting_id;
        let joinUrl = claimed.join_url;
        if (provider === "zoom") {
            const payload = {
                topic: service.title,
                startTime: reservation.scheduled_start,
                durationMinutes: service.duration_minutes,
                reference: reservation.public_reference,
            };
            if (providerMeetingId) {
                try {
                    await updateZoomMeeting(providerMeetingId, payload);
                } catch (error) {
                    // A provider-side deletion is recoverable. Clear the
                    // stale identifier and create one replacement meeting;
                    // authentication/quota failures still surface as failed.
                    if (!(error instanceof Error) || !/\(404\)/.test(error.message)) {
                        throw error;
                    }
                    providerMeetingId = null;
                    joinUrl = null;
                }
            }
            if (!providerMeetingId) {
                const created = await createZoomMeeting(payload);
                providerMeetingId = created.meetingId;
                joinUrl = created.joinUrl;
                createdZoomMeetingId = created.meetingId;
            }
            const { data: savedMeeting, error: meetingUpdateError } = await supabase
                .from("booking_meetings" as never)
                .update({
                    provider_meeting_id: providerMeetingId,
                    join_url: joinUrl,
                    // Keep the row claimable until the optional calendar
                    // event has been synchronized. If that sync fails, the
                    // retry path must not short-circuit on a ready row.
                    status: "pending",
                    scheduled_start: reservation.scheduled_start,
                    scheduled_end: reservation.scheduled_end,
                    last_error: null,
                    provisioning_token: claimed.provisioning_token,
                    provisioning_expires_at: new Date(Date.now() + MEETING_PROVISIONING_LEASE_MS).toISOString(),
                    updated_at: new Date().toISOString(),
                } as never)
                .eq("id" as never, claimed.id as never)
                .eq("status" as never, "pending" as never)
                .eq("provisioning_token" as never, claimed.provisioning_token as never)
                .select("id" as never)
                .maybeSingle() as unknown as { data: { id: string } | null; error: { message: string } | null };
            if (meetingUpdateError || !savedMeeting) {
                if (createdZoomMeetingId) {
                    const { data: currentClaim } = await supabase
                        .from("booking_meetings" as never)
                        .select("provider_meeting_id,provisioning_token,status" as never)
                        .eq("id" as never, claimed.id as never)
                        .maybeSingle() as unknown as {
                            data: { provider_meeting_id: string | null; provisioning_token: string | null; status: string } | null;
                        };
                    // Cancellation may win while the provider request is in
                    // flight, leaving the same claim token with no local
                    // provider ID. Clean up in that case too, but never delete
                    // a room a successor claim has already adopted.
                    if (currentClaim?.provisioning_token === claimed.provisioning_token
                        && (!currentClaim.provider_meeting_id || currentClaim.provider_meeting_id === createdZoomMeetingId)) {
                        try {
                            await deleteZoomMeeting(createdZoomMeetingId);
                        } catch (cleanupError) {
                            console.warn("[booking] unable to remove Zoom meeting after state-save failure", cleanupError);
                        }
                    }
                }
                throw new Error(`Failed to save Zoom meeting state: ${meetingUpdateError?.message ?? "Meeting row disappeared before state was saved."}`);
            }
            // A connected Google Calendar receives a normal event containing
            // the Zoom join URL; it never receives the host start URL.
            const { pushReservationToGoogleCalendar } = await import("./google-calendar");
            const sync = await pushReservationToGoogleCalendar(supabase, reservation.id, { allowPreconfirmation: true });
            if (!sync.success) {
                throw new Error(sync.error ?? "Google Calendar sync failed after Zoom meeting creation.");
            }
            const { data: readyMeeting, error: readyMeetingError } = await supabase
                .from("booking_meetings" as never)
                .update({ status: "ready", last_error: null, provisioning_token: null, provisioning_expires_at: null, updated_at: new Date().toISOString() } as never)
                .eq("id" as never, claimed.id as never)
                .eq("status" as never, "pending" as never)
                .eq("provisioning_token" as never, claimed.provisioning_token as never)
                .select("id" as never)
                .maybeSingle() as unknown as { data: { id: string } | null; error: { message: string } | null };
            if (readyMeetingError || !readyMeeting) {
                if (!readyMeeting && createdZoomMeetingId) {
                    const { data: currentClaim } = await supabase
                        .from("booking_meetings" as never)
                        .select("provider_meeting_id,provisioning_token,status" as never)
                        .eq("id" as never, claimed.id as never)
                        .maybeSingle() as unknown as {
                            data: { provider_meeting_id: string | null; provisioning_token: string | null; status: string } | null;
                        };
                    // A successor may have reclaimed the row and reused the
                    // provider ID while this worker was waiting on Calendar.
                    // Delete only when the claim token and provider ID still
                    // prove that this worker owns the newly-created room.
                    if (currentClaim?.provisioning_token === claimed.provisioning_token
                        && (!currentClaim.provider_meeting_id || currentClaim.provider_meeting_id === createdZoomMeetingId)) {
                        try {
                            await deleteZoomMeeting(createdZoomMeetingId);
                        } catch (cleanupError) {
                            console.warn("[booking] unable to remove Zoom meeting after claim loss", cleanupError);
                        }
                    }
                    createdZoomMeetingId = null;
                }
                throw new Error(`Failed to finalize Zoom meeting state: ${readyMeetingError?.message ?? "Meeting row disappeared before ready state was saved."}`);
            }
        } else {
            const { pushReservationToGoogleCalendar } = await import("./google-calendar");
            const sync = await pushReservationToGoogleCalendar(supabase, reservation.id, { allowPreconfirmation: true });
            if (!sync.success) {
                throw new Error(sync.error ?? "Google Calendar meeting creation failed.");
            }
            const { data: refreshed } = await supabase
                .from("booking_meetings" as never)
                .select("status,join_url" as never)
                .eq("id" as never, claimed.id as never)
                .maybeSingle() as unknown as { data: { status: string; join_url: string | null } | null };
            await supabase
                .from("booking_meetings" as never)
                .update({ provisioning_token: null, provisioning_expires_at: null, updated_at: new Date().toISOString() } as never)
                .eq("id" as never, claimed.id as never)
                .eq("provisioning_token" as never, claimed.provisioning_token as never);
            return {
                provider,
                status: (refreshed?.status ?? "pending") as MeetingResult["status"],
                joinUrl: refreshed?.join_url ?? null,
            };
        }
        return { provider, status: "ready", joinUrl };
    } catch (error) {
        const message = safeError(error);
        const preserveExistingGoogleMeeting = provider === "google_meet"
            && existing?.status === "ready"
            && existingScheduleUnchanged
            && Boolean(existing.join_url)
            && Boolean(existing.calendar_event_id);
        await supabase
            .from("booking_meetings" as never)
            .update({
                status: preserveExistingGoogleMeeting ? "ready" : "failed",
                last_error: message.slice(0, 500),
                provisioning_token: null,
                provisioning_expires_at: null,
                updated_at: new Date().toISOString(),
            } as never)
            .eq("id" as never, claimed.id as never)
            .eq("status" as never, claimed.status as never)
            .eq("provisioning_token" as never, claimed.provisioning_token as never);
        return preserveExistingGoogleMeeting
            ? { provider, status: "ready", joinUrl: existing?.join_url ?? null, error: message }
            : { provider, status: "failed", joinUrl: null, error: message };
    }
}

export async function cancelBookingMeeting(supabase: BookingDb, reservationId: string): Promise<void> {
    const { data: reservation } = await supabase
        .from("booking_reservations")
        .select("workspace_id")
        .eq("id", reservationId)
        .maybeSingle();
    if (!reservation) return;

    const { data: meeting } = await supabase
        .from("booking_meetings" as never)
        .select("id,provider,provider_meeting_id,calendar_event_id,join_url" as never)
        .eq("workspace_id" as never, reservation.workspace_id as never)
        .eq("reservation_id" as never, reservationId as never)
        .maybeSingle() as unknown as {
            data: {
                id: string;
                provider: string;
                provider_meeting_id: string | null;
                calendar_event_id: string | null;
                join_url: string | null;
            } | null;
        };
    if (!meeting) return;
    let providerDeleteError: unknown = null;
    if (meeting.provider === "zoom" && meeting.provider_meeting_id) {
        try {
            await deleteZoomMeeting(meeting.provider_meeting_id);
        } catch (error) {
            // The local reservation must still become terminal. Keep the
            // provider ID below so an administrator can retry cleanup without
            // accidentally provisioning a second meeting later.
            providerDeleteError = error;
        }
    }
    const { error: updateError } = await supabase
        .from("booking_meetings" as never)
        .update({
            status: "cancelled",
            // Keep an undeleted Zoom id so a later retry can remove the
            // provider meeting. Clearing it after a failed delete would make
            // the remote meeting permanently unreachable from our system.
            provider_meeting_id: providerDeleteError ? meeting.provider_meeting_id : null,
            // The calendar event identifier is also a durable cleanup
            // tombstone. Terminal booking paths call this provider cleanup
            // before Google Calendar cleanup; clearing it here would erase
            // the only address for an event whose mapping insert lost a
            // race, leaving a live Meet event orphaned forever.
            calendar_event_id: meeting.calendar_event_id,
            join_url: null,
            last_error: providerDeleteError
                ? safeError(providerDeleteError).slice(0, 500)
                : meeting.calendar_event_id
                    ? "Meeting cancelled; Google Calendar cleanup is pending."
                    : null,
            updated_at: new Date().toISOString(),
        } as never)
        .eq("id" as never, meeting.id as never);
    if (updateError) throw new Error(updateError.message);
    if (providerDeleteError) throw providerDeleteError;
}
