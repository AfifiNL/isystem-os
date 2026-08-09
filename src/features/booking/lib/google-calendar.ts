import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/supabase/database.types";
import { resolveBookingMeetingProvider } from "./meeting-policy";

const LEGACY_ENCRYPTION_ALGORITHM = "aes-256-cbc";
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const GCM_IV_LENGTH = 12;
const GOOGLE_PROVIDER_TIMEOUT_MS = 15_000;

function googleFetch(input: RequestInfo | URL, init: RequestInit = {}) {
    return fetch(input, {
        ...init,
        signal: init.signal ?? AbortSignal.timeout(GOOGLE_PROVIDER_TIMEOUT_MS),
    });
}

export async function verifyGoogleCalendarConnectionAccess(accessToken: string, calendarId: string): Promise<void> {
    // The OAuth grant intentionally includes Calendar List read access rather
    // than the broader calendar.readonly scope. Test the connection through
    // the matching Calendar List endpoint; calendars.get rejects this
    // least-privilege grant with 403 even though event creation is authorized.
    const response = await googleFetch(
        `https://www.googleapis.com/calendar/v3/users/me/calendarList/${encodeURIComponent(calendarId || "primary")}?fields=id`,
        {
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: "no-store",
        },
    );
    if (response.ok) return;

    let reason: string | null = null;
    try {
        const body = await response.json() as { error?: { errors?: Array<{ reason?: string }> } };
        reason = body.error?.errors?.[0]?.reason?.trim() || null;
    } catch {
        // Provider bodies are not guaranteed to be JSON. The HTTP status is
        // sufficient for the operator-facing diagnostic.
    }
    throw new Error(`Google Calendar test failed (${response.status}${reason ? `, ${reason}` : ""}).`);
}

function extractGoogleMeetJoinUrl(event: {
    hangoutLink?: string;
    conferenceData?: { entryPoints?: Array<{ entryPointType?: string; uri?: string }> };
}): string | null {
    const videoEntry = event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video" && entry.uri);
    return videoEntry?.uri ?? event.hangoutLink ?? null;
}

export async function verifyGoogleMeetingProvisioning(
    accessToken: string,
    calendarId: string,
): Promise<{ meetingReady: true }> {
    const resolvedCalendarId = calendarId.trim() || "primary";
    const encodedCalendarId = encodeURIComponent(resolvedCalendarId);
    const authorization = { Authorization: `Bearer ${accessToken}` };
    await verifyGoogleCalendarConnectionAccess(accessToken, resolvedCalendarId);

    const start = new Date(Date.now() + 10 * 60_000);
    const end = new Date(start.getTime() + 5 * 60_000);
    const freeBusy = await googleFetch("https://www.googleapis.com/calendar/v3/freeBusy", {
        method: "POST",
        headers: { ...authorization, "Content-Type": "application/json" },
        body: JSON.stringify({
            timeMin: start.toISOString(),
            timeMax: end.toISOString(),
            items: [{ id: resolvedCalendarId }],
        }),
        cache: "no-store",
    });
    if (!freeBusy.ok) throw new Error(`Google FreeBusy health check failed (${freeBusy.status}).`);

    const eventList = await googleFetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events?maxResults=1&singleEvents=true&timeMin=${encodeURIComponent(start.toISOString())}`,
        { headers: authorization, cache: "no-store" },
    );
    if (!eventList.ok) throw new Error(`Google Calendar event-read health check failed (${eventList.status}).`);

    let canaryEventId: string | null = null;
    let healthError: Error | null = null;
    try {
        const create = await googleFetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events?conferenceDataVersion=1&sendUpdates=none`,
            {
                method: "POST",
                headers: { ...authorization, "Content-Type": "application/json" },
                body: JSON.stringify({
                    summary: "Booking Google Meet health check",
                    description: "Temporary provider canary. This event is removed automatically.",
                    start: { dateTime: start.toISOString() },
                    end: { dateTime: end.toISOString() },
                    transparency: "transparent",
                    visibility: "private",
                    conferenceData: {
                        createRequest: {
                            requestId: `booking-health-${crypto.randomUUID()}`,
                            conferenceSolutionKey: { type: "hangoutsMeet" },
                        },
                    },
                }),
                cache: "no-store",
            },
        );
        if (!create.ok) throw new Error(`Google Meet canary creation failed (${create.status}).`);
        let event = await create.json() as {
            id?: string;
            hangoutLink?: string;
            conferenceData?: { entryPoints?: Array<{ entryPointType?: string; uri?: string }> };
        };
        canaryEventId = event.id ?? null;
        if (!canaryEventId) throw new Error("Google Meet canary did not return an event ID.");

        let joinUrl = extractGoogleMeetJoinUrl(event);
        for (let attempt = 0; !joinUrl && attempt < 3; attempt += 1) {
            const read = await googleFetch(
                `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events/${encodeURIComponent(canaryEventId)}?conferenceDataVersion=1`,
                { headers: authorization, cache: "no-store" },
            );
            if (!read.ok) throw new Error(`Google Meet canary read failed (${read.status}).`);
            event = await read.json() as typeof event;
            joinUrl = extractGoogleMeetJoinUrl(event);
        }
        if (!joinUrl) throw new Error("Google Meet conference was not ready on the canary event.");
    } catch (error) {
        healthError = error instanceof Error ? error : new Error("Google Meet provisioning health check failed.");
    } finally {
        if (canaryEventId) {
            const deleted = await googleFetch(
                `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events/${encodeURIComponent(canaryEventId)}?sendUpdates=none`,
                { method: "DELETE", headers: authorization, cache: "no-store" },
            ).catch(() => null);
            if (!deleted || (!deleted.ok && deleted.status !== 404 && deleted.status !== 410)) {
                healthError ??= new Error("Google Meet canary cleanup failed.");
            }
        }
    }

    if (healthError) throw healthError;
    return { meetingReady: true };
}

function getEncryptionKey(): Buffer {
    const secret = process.env.CALENDAR_TOKEN_ENCRYPTION_SECRET || process.env.ENCRYPTION_SECRET;
    if (!secret || secret.trim().length < 32) {
        throw new Error("Missing CALENDAR_TOKEN_ENCRYPTION_SECRET. Configure a stable 32+ character secret before enabling calendar sync.");
    }
    return crypto.createHash("sha256").update(secret).digest();
}

export function encryptToken(text: string): string {
    const iv = crypto.randomBytes(GCM_IV_LENGTH);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `gcm1:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptToken(encryptedText: string): string {
    const parts = encryptedText.split(":");
    if (parts[0] === "gcm1") {
        const [, ivHex, tagHex, encryptedHex] = parts;
        if (!ivHex || !tagHex || !encryptedHex) throw new Error("Invalid encrypted token format.");
        const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), Buffer.from(ivHex, "hex"));
        decipher.setAuthTag(Buffer.from(tagHex, "hex"));
        return Buffer.concat([decipher.update(Buffer.from(encryptedHex, "hex")), decipher.final()]).toString("utf8");
    }
    const ivHex = parts[0];
    const encryptedHex = parts.slice(1).join(":");
    if (!ivHex || !encryptedHex) throw new Error("Invalid encrypted token format.");
    const decipher = crypto.createDecipheriv(LEGACY_ENCRYPTION_ALGORITHM, getEncryptionKey(), Buffer.from(ivHex, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedHex, "hex")), decipher.final()]).toString("utf8");
}

function isLegacyEncryptedToken(value: string): boolean {
    return !value.startsWith("gcm1:");
}

interface CalendarConnectionRow {
    id: string;
    workspace_id: string;
    provider: string;
    account_email: string;
    calendar_id: string | null;
    access_token: string;
    refresh_token: string;
    token_expires_at: string;
    sync_enabled: boolean | null;
}

function calendarIdForConnection(connection: CalendarConnectionRow) {
    return connection.calendar_id?.trim() || "primary";
}

function deterministicGoogleEventId(reservationId: string, connectionId: string): string {
    // Google event IDs must be lowercase base32hex-compatible characters.
    // A deterministic ID makes concurrent POSTs converge on one remote event
    // instead of creating two events before the mapping upsert wins a race.
    return crypto.createHash("sha256")
        .update(`platform-booking:${reservationId}:${connectionId}`)
        .digest("hex")
        .slice(0, 32);
}

export async function getValidConnectionToken(
    supabase: SupabaseClient<Database>,
    connection: CalendarConnectionRow
): Promise<string> {
    const expiresAt = new Date(connection.token_expires_at).getTime();
    const now = Date.now();

    // If token is valid for another 5 minutes, return decrypted token
    if (expiresAt - now > 5 * 60 * 1000) {
        const accessToken = decryptToken(connection.access_token);
        if (isLegacyEncryptedToken(connection.access_token)) {
            await supabase
                .from("workspace_calendar_connections" as never)
                .update({ access_token: encryptToken(accessToken) } as never)
                .eq("id" as never, connection.id as never);
        }
        return accessToken;
    }

    // Otherwise, refresh access token from Google
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    const decryptedRefreshToken = decryptToken(connection.refresh_token);

    if (isLegacyEncryptedToken(connection.refresh_token)) {
        await supabase
            .from("workspace_calendar_connections" as never)
            .update({ refresh_token: encryptToken(decryptedRefreshToken) } as never)
            .eq("id" as never, connection.id as never);
    }

    if (!clientId || !clientSecret) {
        throw new Error("Missing Google OAuth credentials (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET).");
    }

    const res = await googleFetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: decryptedRefreshToken,
            grant_type: "refresh_token",
        }),
    });

    if (!res.ok) {
        const bodyText = await res.text();
        throw new Error(`Failed to refresh Google access token: ${res.statusText} - ${bodyText}`);
    }

    const data = await res.json() as { access_token: string; expires_in: number };
    const newAccessTokenEncrypted = encryptToken(data.access_token);
    const newExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

    const { error: updateError } = await supabase
        .from("workspace_calendar_connections" as never)
        .update({
            access_token: newAccessTokenEncrypted,
            token_expires_at: newExpiresAt,
        } as never)
        .eq("id" as never, connection.id as never);

    if (updateError) {
        console.error(`[google-calendar] Failed to update refreshed token in DB: ${updateError.message}`);
    }

    return data.access_token;
}

async function cleanupGoogleEventAfterMeetingRace(params: {
    supabase: SupabaseClient<Database>;
    workspaceId: string;
    reservationId: string;
    connectionId: string;
    externalEventId: string;
    accessToken: string;
    calendarId: string;
}): Promise<{ remoteDeleted: boolean; error?: string }> {
    let remoteDeleted = false;
    try {
        const deleteRes = await googleFetch(
            `https://www.googleapis.com/calendar/v3/calendars/${params.calendarId}/events/${encodeURIComponent(params.externalEventId)}`,
            { method: "DELETE", headers: { Authorization: `Bearer ${params.accessToken}` } },
        );
        remoteDeleted = deleteRes.ok || deleteRes.status === 404 || deleteRes.status === 410;
        if (!remoteDeleted) {
            const message = `[google-calendar] Meeting race cleanup failed for event ${params.externalEventId}: ${deleteRes.status}`;
            console.warn(message);
            return { remoteDeleted: false, error: message };
        }
    } catch (error) {
        console.warn("[google-calendar] Meeting race cleanup request failed", error);
        return {
            remoteDeleted: false,
            error: error instanceof Error ? error.message : "Google Calendar cleanup request failed.",
        };
    }

    if (remoteDeleted) {
        await params.supabase
            .from("booking_calendar_events" as never)
            .delete()
            .eq("workspace_id" as never, params.workspaceId as never)
            .eq("reservation_id" as never, params.reservationId as never)
            .eq("connection_id" as never, params.connectionId as never)
            .eq("external_event_id" as never, params.externalEventId as never);
    }
    return { remoteDeleted, error: remoteDeleted ? undefined : "Google Calendar cleanup did not complete." };
}

export function isReservationEligibleForCalendarSync(
    status: string,
    allowPreconfirmation: boolean,
): boolean {
    if (status === "confirmed" || status === "completed") return true;
    return allowPreconfirmation && (status === "pending_review" || status === "pending_confirmation");
}

export async function pushReservationToGoogleCalendar(
    supabase: SupabaseClient<Database>,
    reservationId: string,
    options: { allowPreconfirmation?: boolean } = {},
): Promise<{ success: boolean; error?: string }> {
    try {
        const { data: reservation, error: fetchResError } = await supabase
            .from("booking_reservations")
            .select(`
                id,
                workspace_id,
                customer_email,
                public_reference,
                scheduled_start,
                scheduled_end,
                status,
                service_id
            `)
            .eq("id", reservationId)
            .single();

        if (fetchResError || !reservation) {
            return { success: false, error: fetchResError?.message ?? "Reservation not found." };
        }

        if (!isReservationEligibleForCalendarSync(reservation.status, options.allowPreconfirmation === true)) {
            return { success: true }; // No-op, not a failure
        }

        const { data: service, error: serviceError } = await supabase
            .from("booking_services")
            .select("title,service_key,virtual_meeting_provider")
            .eq("id", reservation.service_id)
            .eq("workspace_id", reservation.workspace_id)
            .single();

        if (serviceError) {
            return { success: false, error: `Booking service could not be loaded: ${serviceError.message}` };
        }

        const provider = resolveBookingMeetingProvider(service?.virtual_meeting_provider);
        const { data: meeting } = await supabase
            .from("booking_meetings" as never)
            .select("provider,provider_meeting_id,join_url,status,calendar_connection_id" as never)
            .eq("workspace_id" as never, reservation.workspace_id as never)
            .eq("reservation_id" as never, reservationId as never)
            .maybeSingle() as unknown as { data: { provider: string; provider_meeting_id: string | null; join_url: string | null; status: string; calendar_connection_id?: string | null } | null };

        const { data: connections, error: fetchConnError } = await supabase
            .from("workspace_calendar_connections" as never)
            .select("*" as never)
            .eq("workspace_id" as never, reservation.workspace_id as never)
            .eq("provider" as never, "google" as never)
            .eq("sync_enabled" as never, true as never);

        if (fetchConnError || !connections || connections.length === 0) {
            if (provider === "google_meet") {
                return {
                    success: false,
                    error: fetchConnError?.message ?? "Connect a Google Calendar before creating Google Meet booking links.",
                };
            }
            return { success: true }; // No active calendar sync for non-Meet bookings
        }

        const serviceTitle = service?.title ?? "Appointment";

        let firstSyncError: string | null = null;
        let syncedAnyConnection = false;
        let meetingForEvent = meeting;
        for (const conn of (connections as unknown as CalendarConnectionRow[])) {
            try {
                const accessToken = await getValidConnectionToken(supabase, conn);
                const calendarId = encodeURIComponent(calendarIdForConnection(conn));

                // Check if this reservation already has a calendar event mapping
                    const { data: existingEvent } = await supabase
                        .from("booking_calendar_events" as never)
                        .select("*" as never)
                        .eq("workspace_id" as never, reservation.workspace_id as never)
                        .eq("reservation_id" as never, reservationId as never)
                    .eq("connection_id" as never, conn.id as never)
                    .maybeSingle();

                const eventJoinUrl = meetingForEvent?.provider === provider
                    ? meetingForEvent.join_url
                    : null;
                const eventPayload: Record<string, unknown> = {
                    summary: `${serviceTitle} · ${reservation.public_reference}`,
                    description: `Booking reference: ${reservation.public_reference}${eventJoinUrl ? `\nJoin meeting: ${eventJoinUrl}` : ""}`,
                    start: {
                        dateTime: new Date(reservation.scheduled_start).toISOString(),
                    },
                    end: {
                        dateTime: new Date(reservation.scheduled_end).toISOString(),
                    },
                    attendees: [
                        { email: reservation.customer_email }
                    ],
                };

                const conferenceData = {
                    createRequest: {
                        requestId: `booking-${reservation.id}-${conn.id}`.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 100),
                        conferenceSolutionKey: { type: "hangoutsMeet" },
                    },
                };
                // A mapped event that disappeared remotely must receive a
                // fresh Meet conference. Reusing the old join URL here would
                // create a new event without a conference.
                // The provider-neutral meeting row owns exactly one customer
                // Meet URL. Once the first active connection has established
                // that URL, every additional calendar receives an ordinary
                // event containing the same link instead of creating a second
                // conference for the same reservation.
                const hasSharedMeetConference = provider === "google_meet"
                    && meetingForEvent?.provider === "google_meet"
                    && meetingForEvent?.status === "ready"
                    && Boolean(meetingForEvent.join_url);
                const shouldCreateMeetConference = provider === "google_meet"
                    && !hasSharedMeetConference
                    && (!existingEvent
                        || meetingForEvent?.provider !== "google_meet"
                        || meetingForEvent?.status !== "ready"
                        || !meetingForEvent?.join_url);
                if (shouldCreateMeetConference) {
                    eventPayload.conferenceData = conferenceData;
                }

                let externalEventId = "";

                if (existingEvent) {
                    const mappedEvent = existingEvent as unknown as { external_event_id: string };
                    const updateRes = await googleFetch(
                        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(mappedEvent.external_event_id)}?conferenceDataVersion=1&sendUpdates=all`,
                        {
                            method: "PATCH",
                            headers: {
                                Authorization: `Bearer ${accessToken}`,
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify(eventPayload),
                        }
                    );

                    if (updateRes.ok) {
                        externalEventId = mappedEvent.external_event_id;
                        const eventData = await updateRes.json().catch(() => null) as {
                            conferenceData?: {
                                conferenceId?: string;
                                entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
                            };
                        } | null;
                        if (provider === "google_meet" && eventData) {
                            const returnedJoinUrl = eventData.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri ?? null;
                            // Google PATCH responses do not always echo
                            // conferenceData. A reschedule must not turn an
                            // already-ready Meet into a pending one merely
                            // because that optional response block was omitted.
                            const joinUrl = returnedJoinUrl
                                ?? (meetingForEvent?.provider === "google_meet" && meetingForEvent.status === "ready"
                                    ? meetingForEvent.join_url
                                    : null);
                            const providerMeetingId = eventData.conferenceData?.conferenceId
                                ?? (meetingForEvent?.provider === "google_meet" ? meetingForEvent.provider_meeting_id : null);
                            meetingForEvent = {
                                provider: "google_meet",
                                provider_meeting_id: providerMeetingId,
                                join_url: joinUrl,
                                status: joinUrl ? "ready" : "pending",
                            };
                            const { data: meetingUpdate, error: meetingUpsertError } = await supabase
                                .from("booking_meetings" as never)
                                .update({
                                    workspace_id: reservation.workspace_id,
                                    reservation_id: reservation.id,
                                    provider: "google_meet",
                                    provider_meeting_id: providerMeetingId,
                                    calendar_event_id: externalEventId,
                                    calendar_connection_id: conn.id,
                                    join_url: joinUrl,
                                    status: joinUrl ? "ready" : "pending",
                                    scheduled_start: reservation.scheduled_start,
                                    scheduled_end: reservation.scheduled_end,
                                    last_error: joinUrl ? null : "Google Meet conference is still being provisioned.",
                                } as never)
                                .eq("workspace_id" as never, reservation.workspace_id as never)
                                .eq("reservation_id" as never, reservation.id as never)
                                .in("status" as never, ["pending", "ready"] as never)
                                .select("id" as never)
                                .maybeSingle() as unknown as { data: { id: string } | null; error: { message: string } | null };
                            if (meetingUpsertError || !meetingUpdate) {
                                await cleanupGoogleEventAfterMeetingRace({
                                    supabase,
                                    workspaceId: reservation.workspace_id,
                                    reservationId: reservation.id,
                                    connectionId: conn.id,
                                    externalEventId,
                                    accessToken,
                                    calendarId,
                                });
                                throw new Error(`Failed to save Google Meet state: ${meetingUpsertError?.message ?? "Meeting row disappeared before state was saved."}`);
                            }
                        }
                    } else if (updateRes.status !== 404 && updateRes.status !== 410) {
                        const errText = await updateRes.text();
                        throw new Error(`Failed to update Google Calendar event (${updateRes.status}): ${errText}`);
                    } else if (provider === "google_meet") {
                        // The mapped event was deleted outside the platform. The
                        // replacement event needs its own conference even if
                        // the local meeting row still has the old join URL.
                        eventPayload.conferenceData = conferenceData;
                    }
                }

                // If not updated (e.g. no existing or update failed/deleted externally), create a new event
                if (!externalEventId) {
                    let createdExternalEvent = false;
                    const deterministicEventId = deterministicGoogleEventId(reservationId, conn.id);
                    eventPayload.id = deterministicEventId;
                    const createRes = await googleFetch(
                        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?conferenceDataVersion=1&sendUpdates=all`,
                        {
                            method: "POST",
                            headers: {
                                Authorization: `Bearer ${accessToken}`,
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify(eventPayload),
                        }
                    );

                    if (!createRes.ok && createRes.status === 409) {
                        // Another worker may have inserted the deterministic
                        // event first. Read that event and converge on its
                        // conference/mapping rather than creating a second
                        // customer-visible event.
                        const existingRes = await googleFetch(
                            `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(deterministicEventId)}?conferenceDataVersion=1`,
                            { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
                        );
                        if (existingRes.ok) {
                            const existingData = await existingRes.json() as {
                                id?: string;
                                conferenceData?: {
                                    conferenceId?: string;
                                    entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
                                };
                            };
                            externalEventId = existingData.id ?? deterministicEventId;
                            // Fall through to the same mapping/meeting update
                            // path used for a successful create response.
                            const eventData = existingData;
                            const joinUrl = eventData.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri
                                ?? (meetingForEvent?.provider === "google_meet" && meetingForEvent.status === "ready"
                                    ? meetingForEvent.join_url
                                    : null);
                            const providerMeetingId = eventData.conferenceData?.conferenceId
                                ?? (meetingForEvent?.provider === "google_meet" ? meetingForEvent.provider_meeting_id : null);
                            if (provider === "google_meet") {
                                meetingForEvent = {
                                    provider: "google_meet",
                                    provider_meeting_id: providerMeetingId,
                                    join_url: joinUrl,
                                    status: joinUrl ? "ready" : "pending",
                                };
                            }
                        } else {
                            const errText = await existingRes.text();
                            throw new Error(`Failed to converge on concurrent Google Calendar event (${existingRes.status}): ${errText}`);
                        }
                    } else if (!createRes.ok) {
                        const errText = await createRes.text();
                        throw new Error(`Failed to create Google Calendar event: ${errText}`);
                    }

                    const eventData = createRes.ok
                        ? await createRes.json() as {
                            id: string;
                            conferenceData?: {
                                conferenceId?: string;
                                entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
                            };
                        }
                        : null;
                    if (eventData) {
                        createdExternalEvent = true;
                        externalEventId = eventData.id;
                            const joinUrl = eventData.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri
                                ?? (meetingForEvent?.provider === "google_meet" && meetingForEvent.status === "ready"
                                    ? meetingForEvent.join_url
                                    : null);
                            const providerMeetingId = eventData.conferenceData?.conferenceId
                                ?? (meetingForEvent?.provider === "google_meet" ? meetingForEvent.provider_meeting_id : null);
                            if (provider === "google_meet") {
                                meetingForEvent = {
                                    provider: "google_meet",
                                    provider_meeting_id: providerMeetingId,
                                    join_url: joinUrl,
                                    status: joinUrl ? "ready" : "pending",
                                };
                        }
                    }

                    // Persist the external event mapping before the optional
                    // meeting-row update. If the latter fails, a retry can
                    // PATCH this event instead of creating a duplicate.
                    const { error: insertError } = await supabase
                        .from("booking_calendar_events" as never)
                        .upsert({
                            workspace_id: reservation.workspace_id,
                            reservation_id: reservationId,
                            connection_id: conn.id,
                            external_event_id: externalEventId,
                        } as never, {
                            onConflict: "workspace_id,reservation_id,connection_id"
                        } as never);

                    if (insertError) {
                        if (createdExternalEvent) {
                            const cleanup = await cleanupGoogleEventAfterMeetingRace({
                                supabase,
                                workspaceId: reservation.workspace_id,
                                reservationId: reservation.id,
                                connectionId: conn.id,
                                externalEventId,
                                accessToken,
                                calendarId,
                            });
                            if (!cleanup.remoteDeleted) {
                                // Keep a provider-neutral tombstone with the
                                // connection/event identity when both the
                                // mapping write and remote DELETE are
                                // transiently unavailable. Disconnect and
                                // terminal-booking retry paths can then find
                                // and remove this event later.
                                await supabase
                                    .from("booking_meetings" as never)
                                    .update({
                                        calendar_event_id: externalEventId,
                                        calendar_connection_id: conn.id,
                                        status: "failed",
                                        last_error: `${insertError.message}; ${cleanup.error ?? "calendar cleanup pending"}`.slice(0, 500),
                                        updated_at: new Date().toISOString(),
                                    } as never)
                                    .eq("workspace_id" as never, reservation.workspace_id as never)
                                    .eq("reservation_id" as never, reservation.id as never);
                                await supabase
                                    .from("booking_calendar_cleanup_tasks" as never)
                                    .upsert({
                                        workspace_id: reservation.workspace_id,
                                        reservation_id: reservation.id,
                                        connection_id: conn.id,
                                        external_event_id: externalEventId,
                                        status: "failed",
                                        last_error: cleanup.error ?? insertError.message,
                                        updated_at: new Date().toISOString(),
                                    } as never, { onConflict: "workspace_id,reservation_id,connection_id,external_event_id" } as never);
                            }
                        }
                        throw new Error(`Failed to save calendar event mapping: ${insertError.message}`);
                    }

                    if (provider === "google_meet") {
                        const joinUrl = meetingForEvent?.join_url ?? null;
                        const googleMeeting = {
                            provider: "google_meet",
                            provider_meeting_id: meetingForEvent?.provider_meeting_id ?? null,
                            join_url: joinUrl,
                            status: joinUrl ? "ready" : "pending",
                        };
                        meetingForEvent = googleMeeting;
                        const { data: meetingUpdate, error: meetingUpsertError } = await supabase
                            .from("booking_meetings" as never)
                            .update({
                                workspace_id: reservation.workspace_id,
                                reservation_id: reservation.id,
                                provider: "google_meet",
                                provider_meeting_id: googleMeeting.provider_meeting_id,
                                calendar_event_id: externalEventId,
                                calendar_connection_id: conn.id,
                                join_url: joinUrl,
                                status: joinUrl ? "ready" : "pending",
                                scheduled_start: reservation.scheduled_start,
                                scheduled_end: reservation.scheduled_end,
                                last_error: joinUrl ? null : "Google Meet conference is still being provisioned.",
                            } as never)
                            .eq("workspace_id" as never, reservation.workspace_id as never)
                            .eq("reservation_id" as never, reservation.id as never)
                            .in("status" as never, ["pending", "ready"] as never)
                            .select("id" as never)
                            .maybeSingle() as unknown as { data: { id: string } | null; error: { message: string } | null };
                        if (meetingUpsertError || !meetingUpdate) {
                            await cleanupGoogleEventAfterMeetingRace({
                                supabase,
                                workspaceId: reservation.workspace_id,
                                reservationId: reservation.id,
                                connectionId: conn.id,
                                externalEventId,
                                accessToken,
                                calendarId,
                            });
                            throw new Error(`Failed to save Google Meet state: ${meetingUpsertError?.message ?? "Meeting row disappeared before state was saved."}`);
                        }
                    }

                }

                if (provider === "zoom" && meetingForEvent?.status === "ready") {
                    const { data: meetingUpdate, error: meetingUpdateError } = await supabase
                        .from("booking_meetings" as never)
                        .update({ calendar_event_id: externalEventId, calendar_connection_id: conn.id, updated_at: new Date().toISOString() } as never)
                        .eq("workspace_id" as never, reservation.workspace_id as never)
                        .eq("reservation_id" as never, reservation.id as never)
                        .in("status" as never, ["pending", "ready"] as never)
                        .select("id" as never)
                        .maybeSingle() as unknown as { data: { id: string } | null; error: { message: string } | null };
                    if (meetingUpdateError || !meetingUpdate) {
                        await cleanupGoogleEventAfterMeetingRace({
                            supabase,
                            workspaceId: reservation.workspace_id,
                            reservationId: reservation.id,
                            connectionId: conn.id,
                            externalEventId,
                            accessToken,
                            calendarId,
                        });
                        throw new Error(`Failed to save calendar event on Zoom meeting: ${meetingUpdateError?.message ?? "Meeting row disappeared before calendar state was saved."}`);
                    }
                }

                await supabase
                    .from("workspace_calendar_connections" as never)
                    .update({ last_sync_at: new Date().toISOString(), last_error: null } as never)
                    .eq("id" as never, conn.id as never);
                syncedAnyConnection = true;
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                firstSyncError ??= message;
                await supabase
                    .from("workspace_calendar_connections" as never)
                    .update({ last_error: message.slice(0, 500) } as never)
                    .eq("id" as never, conn.id as never);
                console.error(`[google-calendar] Connection ${conn.account_email} failed to sync reservation ${reservationId}:`, message);
            }
        }

        // A workspace may have more than one Google connection. One healthy
        // connection is enough to keep the provider-neutral meeting ready;
        // another account failing must not downgrade the usable join link.
        return syncedAnyConnection
            ? { success: true, error: firstSyncError ?? undefined }
            : firstSyncError
                ? { success: false, error: firstSyncError }
                : { success: true };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
}

export async function deleteReservationFromGoogleCalendar(
    supabase: SupabaseClient<Database>,
    reservationId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const { data: reservation } = await supabase
            .from("booking_reservations")
            .select("workspace_id")
            .eq("id", reservationId)
            .maybeSingle();
        if (!reservation) return { success: true };

        const { data: mappings, error: mappingsError } = await supabase
            .from("booking_calendar_events" as never)
            .select("*, workspace_calendar_connections(*)" as never)
            .eq("workspace_id" as never, reservation.workspace_id as never)
            .eq("reservation_id" as never, reservationId as never);

        if (mappingsError) return { success: false, error: mappingsError.message };
        if (!mappings || mappings.length === 0) {
            // A remote event can exist briefly before its mapping row is
            // committed. The provider-neutral meeting tombstone retains the
            // connection and event identity so terminal cleanup remains
            // addressable even after that race.
            const { data: orphanMeetings, error: orphanLookupError } = await supabase
                .from("booking_meetings" as never)
                .select("id,calendar_event_id,calendar_connection_id" as never)
                .eq("workspace_id" as never, reservation.workspace_id as never)
                .eq("reservation_id" as never, reservationId as never)
                .not("calendar_event_id" as never, "is" as never, null as never)
                .not("calendar_connection_id" as never, "is" as never, null as never) as unknown as {
                    data: Array<{ id: string; calendar_event_id: string; calendar_connection_id: string }> | null;
                    error: { message: string } | null;
                };
            if (orphanLookupError) return { success: false, error: orphanLookupError.message };
            const { data: cleanupTasks, error: cleanupTaskError } = await supabase
                .from("booking_calendar_cleanup_tasks" as never)
                .select("id,connection_id,external_event_id,last_error" as never)
                .eq("workspace_id" as never, reservation.workspace_id as never)
                .eq("reservation_id" as never, reservationId as never)
                .in("status" as never, ["pending", "failed"] as never) as unknown as {
                    data: Array<{ id: string; connection_id: string; external_event_id: string; last_error: string | null }> | null;
                    error: { message: string } | null;
                };
            if (cleanupTaskError) return { success: false, error: cleanupTaskError.message };
            if (!orphanMeetings?.length && !cleanupTasks?.length) return { success: true };

            let orphanError: string | null = null;
            const orphanRows = [
                ...(orphanMeetings ?? []).map((orphan) => ({
                    id: `meeting-tombstone:${orphan.id}`,
                    calendar_connection_id: orphan.calendar_connection_id,
                    calendar_event_id: orphan.calendar_event_id,
                })),
                ...(cleanupTasks ?? []).map((task) => ({
                    id: `cleanup-task:${task.id}`,
                    calendar_connection_id: task.connection_id,
                    calendar_event_id: task.external_event_id,
                })),
            ];
            for (const orphan of orphanRows) {
                const { data: connection } = await supabase
                    .from("workspace_calendar_connections" as never)
                    .select("*" as never)
                    .eq("id" as never, orphan.calendar_connection_id as never)
                    .eq("workspace_id" as never, reservation.workspace_id as never)
                    .maybeSingle() as unknown as { data: CalendarConnectionRow | null };
                if (!connection) {
                    orphanError ??= "Google Calendar connection for the orphaned event is unavailable.";
                    continue;
                }
                try {
                    const accessToken = await getValidConnectionToken(supabase, connection);
                    const deleteRes = await googleFetch(
                        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarIdForConnection(connection))}/events/${encodeURIComponent(orphan.calendar_event_id)}`,
                        { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
                    );
                    if (!deleteRes.ok && deleteRes.status !== 404 && deleteRes.status !== 410) {
                        const message = `Failed to delete orphaned Google Calendar event (${deleteRes.status}).`;
                        orphanError ??= message;
                        if (orphan.id.startsWith("cleanup-task:")) {
                            await supabase
                                .from("booking_calendar_cleanup_tasks" as never)
                                .update({ status: "failed", last_error: message, updated_at: new Date().toISOString() } as never)
                                .eq("id" as never, orphan.id.slice("cleanup-task:".length) as never)
                                .eq("workspace_id" as never, reservation.workspace_id as never);
                        }
                        continue;
                    }
                    if (orphan.id.startsWith("meeting-tombstone:")) {
                        await supabase
                            .from("booking_meetings" as never)
                            .update({ calendar_event_id: null, calendar_connection_id: null, status: "cancelled", last_error: null, updated_at: new Date().toISOString() } as never)
                            .eq("id" as never, orphan.id.slice("meeting-tombstone:".length) as never)
                            .eq("workspace_id" as never, reservation.workspace_id as never);
                    } else {
                        await supabase
                            .from("booking_calendar_cleanup_tasks" as never)
                            .delete()
                            .eq("id" as never, orphan.id.slice("cleanup-task:".length) as never)
                            .eq("workspace_id" as never, reservation.workspace_id as never);
                    }
                } catch (error) {
                    const message = error instanceof Error ? error.message : "Google Calendar orphan cleanup failed.";
                    orphanError ??= message;
                    if (orphan.id.startsWith("cleanup-task:")) {
                        await supabase
                            .from("booking_calendar_cleanup_tasks" as never)
                            .update({ status: "failed", last_error: message.slice(0, 500), updated_at: new Date().toISOString() } as never)
                            .eq("id" as never, orphan.id.slice("cleanup-task:".length) as never)
                            .eq("workspace_id" as never, reservation.workspace_id as never);
                    }
                }
            }
            return orphanError ? { success: false, error: orphanError } : { success: true };
        }

        interface MappedEventRow {
            id: string;
            external_event_id: string;
            workspace_calendar_connections: CalendarConnectionRow;
        }

        let firstDeleteError: string | null = null;
        for (const mapping of (mappings as unknown as MappedEventRow[])) {
            try {
                const conn = mapping.workspace_calendar_connections;
                if (!conn) continue;

                const accessToken = await getValidConnectionToken(supabase, conn);
                const calendarId = encodeURIComponent(calendarIdForConnection(conn));

                const deleteRes = await googleFetch(
                    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(mapping.external_event_id)}`,
                    {
                        method: "DELETE",
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                        },
                    }
                );

                if (!deleteRes.ok && deleteRes.status !== 404 && deleteRes.status !== 410) {
                    const errText = await deleteRes.text();
                    const message = `Failed to delete Google Calendar event (${deleteRes.status}): ${errText}`;
                    firstDeleteError ??= message;
                    console.warn(`[google-calendar] Failed to delete event ${mapping.external_event_id}: ${errText}`);
                    // Keep the mapping so a later retry still knows which
                    // external event must be removed.
                    continue;
                }

                // Delete local mapping
                const { error: mappingDeleteError } = await supabase
                    .from("booking_calendar_events" as never)
                    .delete()
                    .eq("id" as never, mapping.id as never);
                if (mappingDeleteError) {
                    const message = `Failed to delete local calendar mapping: ${mappingDeleteError.message}`;
                    firstDeleteError ??= message;
                }

            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                firstDeleteError ??= message;
                console.error(`[google-calendar] Failed to process delete mapping ${mapping.id}:`, message);
            }
        }

        // Mapping rows and cleanup tombstones are independent records. A
        // different connection may still have a mapping while a newly
        // created event is waiting in the durable cleanup queue, so always
        // process the queue after mapped events rather than only when the
        // mapping query is empty.
        const { data: orphanMeetings, error: orphanLookupError } = await supabase
            .from("booking_meetings" as never)
            .select("id,calendar_event_id,calendar_connection_id" as never)
            .eq("workspace_id" as never, reservation.workspace_id as never)
            .eq("reservation_id" as never, reservationId as never)
            .not("calendar_event_id" as never, "is" as never, null as never)
            .not("calendar_connection_id" as never, "is" as never, null as never) as unknown as {
                data: Array<{ id: string; calendar_event_id: string; calendar_connection_id: string }> | null;
                error: { message: string } | null;
            };
        const { data: cleanupTasks, error: cleanupTaskError } = await supabase
            .from("booking_calendar_cleanup_tasks" as never)
            .select("id,connection_id,external_event_id,last_error" as never)
            .eq("workspace_id" as never, reservation.workspace_id as never)
            .eq("reservation_id" as never, reservationId as never)
            .in("status" as never, ["pending", "failed"] as never) as unknown as {
                data: Array<{ id: string; connection_id: string; external_event_id: string; last_error: string | null }> | null;
                error: { message: string } | null;
            };
        if (orphanLookupError) firstDeleteError ??= orphanLookupError.message;
        if (cleanupTaskError) firstDeleteError ??= cleanupTaskError.message;

        const mappedEventKeys = new Set(
            (mappings as unknown as MappedEventRow[]).map((mapping) =>
                `${mapping.workspace_calendar_connections?.id ?? ""}:${mapping.external_event_id}`,
            ),
        );
        const orphanRows = [
            ...(orphanMeetings ?? [])
                .filter((orphan) => !mappedEventKeys.has(`${orphan.calendar_connection_id}:${orphan.calendar_event_id}`))
                .map((orphan) => ({
                    id: `meeting-tombstone:${orphan.id}`,
                    calendar_connection_id: orphan.calendar_connection_id,
                    calendar_event_id: orphan.calendar_event_id,
                })),
            ...(cleanupTasks ?? [])
                .filter((task) => !mappedEventKeys.has(`${task.connection_id}:${task.external_event_id}`))
                .map((task) => ({
                    id: `cleanup-task:${task.id}`,
                    calendar_connection_id: task.connection_id,
                    calendar_event_id: task.external_event_id,
                })),
        ];
        for (const orphan of orphanRows) {
            try {
                const { data: connection, error: connectionError } = await supabase
                    .from("workspace_calendar_connections" as never)
                    .select("*" as never)
                    .eq("id" as never, orphan.calendar_connection_id as never)
                    .eq("workspace_id" as never, reservation.workspace_id as never)
                    .maybeSingle() as unknown as { data: CalendarConnectionRow | null; error: { message: string } | null };
                if (connectionError || !connection) {
                    firstDeleteError ??= connectionError?.message ?? "Google Calendar connection for the orphaned event is unavailable.";
                    continue;
                }
                const accessToken = await getValidConnectionToken(supabase, connection);
                const deleteRes = await googleFetch(
                    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarIdForConnection(connection))}/events/${encodeURIComponent(orphan.calendar_event_id)}`,
                    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
                );
                if (!deleteRes.ok && deleteRes.status !== 404 && deleteRes.status !== 410) {
                    const message = `Failed to delete orphaned Google Calendar event (${deleteRes.status}).`;
                    firstDeleteError ??= message;
                    if (orphan.id.startsWith("cleanup-task:")) {
                        await supabase
                            .from("booking_calendar_cleanup_tasks" as never)
                            .update({ status: "failed", last_error: message, updated_at: new Date().toISOString() } as never)
                            .eq("id" as never, orphan.id.slice("cleanup-task:".length) as never)
                            .eq("workspace_id" as never, reservation.workspace_id as never);
                    }
                    continue;
                }
                if (orphan.id.startsWith("meeting-tombstone:")) {
                    await supabase
                        .from("booking_meetings" as never)
                        .update({ calendar_event_id: null, calendar_connection_id: null, status: "cancelled", last_error: null, updated_at: new Date().toISOString() } as never)
                        .eq("id" as never, orphan.id.slice("meeting-tombstone:".length) as never)
                        .eq("workspace_id" as never, reservation.workspace_id as never);
                } else {
                    await supabase
                        .from("booking_calendar_cleanup_tasks" as never)
                        .delete()
                        .eq("id" as never, orphan.id.slice("cleanup-task:".length) as never)
                        .eq("workspace_id" as never, reservation.workspace_id as never);
                }
            } catch (error) {
                firstDeleteError ??= error instanceof Error ? error.message : "Google Calendar orphan cleanup failed.";
            }
        }

        return firstDeleteError
            ? { success: false, error: firstDeleteError }
            : { success: true };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
}

/**
 * Remove every event owned by one Google connection before the connection is
 * revoked. Mappings are retained when a remote delete fails so an
 * administrator can retry without losing the external event identifier.
 */
export async function deleteGoogleCalendarConnectionEvents(
    supabase: SupabaseClient<Database>,
    connectionId: string,
): Promise<{ success: boolean; error?: string; reservationIds: string[] }> {
    const { data: mappings, error: mappingsError } = await supabase
        .from("booking_calendar_events" as never)
        .select("id,reservation_id,external_event_id,workspace_calendar_connections(*)" as never)
        .eq("connection_id" as never, connectionId as never);

    if (mappingsError) {
        return { success: false, error: mappingsError.message, reservationIds: [] };
    }

    interface ConnectionEventRow {
        id: string;
        reservation_id: string;
        external_event_id: string;
        workspace_calendar_connections: CalendarConnectionRow | null;
    }

    const rows = (mappings ?? []) as unknown as ConnectionEventRow[];
    const { data: orphanMeetings, error: orphanLookupError } = await supabase
        .from("booking_meetings" as never)
        .select("id,reservation_id,calendar_event_id" as never)
        .eq("calendar_connection_id" as never, connectionId as never)
        .not("calendar_event_id" as never, "is" as never, null as never) as unknown as {
            data: Array<{ id: string; reservation_id: string; calendar_event_id: string }> | null;
            error: { message: string } | null;
        };
    if (orphanLookupError) {
        return { success: false, error: orphanLookupError.message, reservationIds: Array.from(new Set(rows.map((row) => row.reservation_id))) };
    }
    const { data: cleanupTasks, error: cleanupTaskLookupError } = await supabase
        .from("booking_calendar_cleanup_tasks" as never)
        .select("id,reservation_id,external_event_id" as never)
        .eq("connection_id" as never, connectionId as never)
        .in("status" as never, ["pending", "failed"] as never) as unknown as {
            data: Array<{ id: string; reservation_id: string; external_event_id: string }> | null;
            error: { message: string } | null;
        };
    if (cleanupTaskLookupError) {
        return { success: false, error: cleanupTaskLookupError.message, reservationIds: Array.from(new Set(rows.map((row) => row.reservation_id))) };
    }
    const mappedEventIds = new Set(rows.map((row) => `${row.reservation_id}:${row.external_event_id}`));
    const orphanConnection = (orphanMeetings?.length || cleanupTasks?.length)
        ? await supabase
            .from("workspace_calendar_connections" as never)
            .select("*" as never)
            .eq("id" as never, connectionId as never)
            .maybeSingle() as unknown as { data: CalendarConnectionRow | null }
        : { data: null };
    for (const orphan of orphanMeetings ?? []) {
        if (mappedEventIds.has(`${orphan.reservation_id}:${orphan.calendar_event_id}`)) continue;
        rows.push({
            id: `meeting-tombstone:${orphan.id}`,
            reservation_id: orphan.reservation_id,
            external_event_id: orphan.calendar_event_id,
            workspace_calendar_connections: orphanConnection.data,
        });
    }
    for (const task of cleanupTasks ?? []) {
        if (mappedEventIds.has(`${task.reservation_id}:${task.external_event_id}`)) continue;
        rows.push({
            id: `cleanup-task:${task.id}`,
            reservation_id: task.reservation_id,
            external_event_id: task.external_event_id,
            workspace_calendar_connections: orphanConnection.data,
        });
    }
    const reservationIds = Array.from(new Set(rows.map((row) => row.reservation_id)));
    let firstDeleteError: string | null = null;

    for (const mapping of rows) {
        try {
            const connection = mapping.workspace_calendar_connections;
            if (!connection) {
                firstDeleteError ??= "Google Calendar connection mapping is missing its connection record.";
                continue;
            }

            const accessToken = await getValidConnectionToken(supabase, connection);
            const calendarId = encodeURIComponent(calendarIdForConnection(connection));
            const deleteResponse = await googleFetch(
                `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(mapping.external_event_id)}`,
                {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${accessToken}` },
                    cache: "no-store",
                },
            );

            if (!deleteResponse.ok && deleteResponse.status !== 404 && deleteResponse.status !== 410) {
                const body = await deleteResponse.text();
                const message = `Failed to delete Google Calendar event (${deleteResponse.status}): ${body}`;
                firstDeleteError ??= message;
                if (mapping.id.startsWith("cleanup-task:")) {
                    await supabase
                        .from("booking_calendar_cleanup_tasks" as never)
                        .update({ status: "failed", last_error: message.slice(0, 500), updated_at: new Date().toISOString() } as never)
                        .eq("id" as never, mapping.id.slice("cleanup-task:".length) as never)
                        .eq("connection_id" as never, connectionId as never);
                }
                continue;
            }

            if (mapping.id.startsWith("meeting-tombstone:")) {
                const meetingId = mapping.id.slice("meeting-tombstone:".length);
                const { error: meetingClearError } = await supabase
                    .from("booking_meetings" as never)
                    .update({ calendar_event_id: null, calendar_connection_id: null, status: "cancelled", last_error: null, updated_at: new Date().toISOString() } as never)
                    .eq("id" as never, meetingId as never);
                if (meetingClearError) firstDeleteError ??= `Failed to clear local calendar tombstone: ${meetingClearError.message}`;
            } else if (mapping.id.startsWith("cleanup-task:")) {
                const { error: cleanupTaskDeleteError } = await supabase
                    .from("booking_calendar_cleanup_tasks" as never)
                    .delete()
                    .eq("id" as never, mapping.id.slice("cleanup-task:".length) as never)
                    .eq("connection_id" as never, connectionId as never);
                if (cleanupTaskDeleteError) firstDeleteError ??= `Failed to delete calendar cleanup task: ${cleanupTaskDeleteError.message}`;
            } else {
                const { error: mappingDeleteError } = await supabase
                    .from("booking_calendar_events" as never)
                    .delete()
                    .eq("id" as never, mapping.id as never);
                if (mappingDeleteError) {
                    firstDeleteError ??= `Failed to delete local calendar mapping: ${mappingDeleteError.message}`;
                }
            }
        } catch (error) {
            firstDeleteError ??= error instanceof Error ? error.message : String(error);
        }
    }

    return firstDeleteError
        ? { success: false, error: firstDeleteError, reservationIds }
        : { success: true, reservationIds };
}

export async function fetchBusySlots(
    supabase: SupabaseClient<Database>,
    workspaceId: string,
    startIso: string,
    endIso: string
): Promise<Array<{ start: string; end: string }>> {
    const busySlots: Array<{ start: string; end: string }> = [];

    try {
        const { data: connections, error: fetchConnError } = await supabase
            .from("workspace_calendar_connections" as never)
            .select("*" as never)
            .eq("workspace_id" as never, workspaceId as never)
            .eq("provider" as never, "google" as never)
            .eq("sync_enabled" as never, true as never);

        if (fetchConnError) {
            throw new Error(`Google Calendar connections could not be loaded: ${fetchConnError.message}`);
        }
        if (!connections || connections.length === 0) {
            return [];
        }

        let firstError: string | null = null;
        for (const conn of (connections as unknown as CalendarConnectionRow[])) {
            try {
                const accessToken = await getValidConnectionToken(supabase, conn);

                // Fetch Google Freebusy API
                const freebusyRes = await googleFetch(
                    "https://www.googleapis.com/calendar/v3/freeBusy",
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            timeMin: startIso,
                            timeMax: endIso,
                            items: [{ id: calendarIdForConnection(conn) }],
                        }),
                    }
                );

                if (!freebusyRes.ok) {
                    const errText = await freebusyRes.text();
                    firstError ??= `Google FreeBusy request failed (${freebusyRes.status}).`;
                    console.error(`[google-calendar] Freebusy API request failed for ${conn.account_email}: ${errText}`);
                    continue;
                }

                const fbData = await freebusyRes.json() as {
                    calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }>;
                };

                const primaryBusy = fbData.calendars?.[calendarIdForConnection(conn)]?.busy;
                if (Array.isArray(primaryBusy)) {
                    for (const slot of primaryBusy) {
                        busySlots.push({
                            start: slot.start,
                            end: slot.end,
                        });
                    }
                }
            } catch (err) {
                firstError ??= err instanceof Error ? err.message : "Google FreeBusy request failed.";
                console.error(`[google-calendar] Failed to fetch busy slots from connection ${conn.account_email}:`, err);
            }
        }
        if (firstError) throw new Error(firstError);
    } catch (e) {
        console.error("[google-calendar] Exception fetching busy slots:", e);
        throw e instanceof Error ? e : new Error("Google Calendar availability could not be verified.");
    }

    return busySlots;
}
