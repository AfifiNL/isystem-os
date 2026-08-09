import "server-only";

type ZoomMeeting = {
    id?: number | string;
    join_url?: string;
    start_url?: string;
};

type ZoomToken = { accessToken: string; expiresAt: number };
const ZOOM_PROVIDER_TIMEOUT_MS = 15_000;

function zoomFetch(input: RequestInfo | URL, init: RequestInit = {}) {
    return fetch(input, {
        ...init,
        signal: init.signal ?? AbortSignal.timeout(ZOOM_PROVIDER_TIMEOUT_MS),
    });
}

let cachedToken: ZoomToken | null = null;

function env(name: string): string | null {
    const value = process.env[name]?.trim();
    return value ? value : null;
}

function getZoomConfig() {
    const accountId = env("ZOOM_ACCOUNT_ID");
    const clientId = env("ZOOM_CLIENT_ID");
    const clientSecret = env("ZOOM_CLIENT_SECRET");
    const hostUserId = env("ZOOM_HOST_USER_ID");
    if (!accountId || !clientId || !clientSecret || !hostUserId) {
        throw new Error("Zoom free meeting creation is not configured on the server.");
    }
    return { accountId, clientId, clientSecret, hostUserId };
}

async function getAccessToken(): Promise<string> {
    if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.accessToken;
    const config = getZoomConfig();
    const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
    const response = await zoomFetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(config.accountId)}`, {
        method: "POST",
        headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        cache: "no-store",
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`Zoom OAuth failed (${response.status}).`);
    const parsed = JSON.parse(body) as { access_token?: string; expires_in?: number };
    if (!parsed.access_token) throw new Error("Zoom OAuth did not return an access token.");
    cachedToken = {
        accessToken: parsed.access_token,
        expiresAt: Date.now() + Math.max((parsed.expires_in ?? 3600) - 60, 60) * 1000,
    };
    return parsed.access_token;
}

async function zoomRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await getAccessToken();
    const response = await zoomFetch(`https://api.zoom.us/v2${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            ...(init.headers ?? {}),
        },
        cache: "no-store",
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`Zoom API failed (${response.status}).`);
    return (body ? JSON.parse(body) : {}) as T;
}

export async function createZoomMeeting(input: {
    topic: string;
    startTime: string;
    durationMinutes: number;
    reference: string;
}): Promise<{ meetingId: string; joinUrl: string }> {
    if (input.durationMinutes > 40) throw new Error("Free Zoom meetings are limited to 40 minutes.");
    const config = getZoomConfig();
    const meeting = await zoomRequest<ZoomMeeting>(`/users/${encodeURIComponent(config.hostUserId)}/meetings`, {
        method: "POST",
        body: JSON.stringify({
            topic: `${input.topic} · ${input.reference}`,
            type: 2,
            start_time: input.startTime,
            duration: input.durationMinutes,
            timezone: "UTC",
            agenda: "Booking meeting",
            settings: {
                join_before_host: false,
                waiting_room: true,
                participant_video: false,
                host_video: false,
            },
        }),
    });
    const meetingId = meeting.id == null ? null : String(meeting.id);
    if (!meetingId) throw new Error("Zoom did not return a meeting ID.");
    if (!meeting.join_url) {
        try {
            await deleteZoomMeeting(meetingId);
        } catch {
            throw new Error("Zoom did not return a customer join URL and the incomplete meeting could not be removed.");
        }
        throw new Error("Zoom did not return a customer join URL.");
    }
    return { meetingId, joinUrl: meeting.join_url };
}

export async function updateZoomMeeting(meetingId: string, input: { topic: string; startTime: string; durationMinutes: number; reference: string }) {
    if (input.durationMinutes > 40) throw new Error("Free Zoom meetings are limited to 40 minutes.");
    await zoomRequest(`/meetings/${encodeURIComponent(meetingId)}`, {
        method: "PATCH",
        body: JSON.stringify({
            topic: `${input.topic} · ${input.reference}`,
            start_time: input.startTime,
            duration: input.durationMinutes,
            timezone: "UTC",
        }),
    });
}

export async function deleteZoomMeeting(meetingId: string): Promise<void> {
    try {
        await zoomRequest(`/meetings/${encodeURIComponent(meetingId)}`, { method: "DELETE" });
    } catch (error) {
        if (error instanceof Error && /\(404\)/.test(error.message)) return;
        throw error;
    }
}

export async function verifyZoomMeetingProvisioning(): Promise<{ meetingReady: true }> {
    const meeting = await createZoomMeeting({
        topic: "Booking Zoom health check",
        startTime: new Date(Date.now() + 10 * 60_000).toISOString(),
        durationMinutes: 5,
        reference: "provider-canary",
    });
    try {
        const url = new URL(meeting.joinUrl);
        if (url.protocol !== "https:" || !url.hostname) {
            throw new Error("Zoom canary did not return a customer-safe join URL.");
        }
    } finally {
        await deleteZoomMeeting(meeting.meetingId);
    }
    return { meetingReady: true };
}

export function isZoomConfigured(): boolean {
    return Boolean(env("ZOOM_ACCOUNT_ID") && env("ZOOM_CLIENT_ID") && env("ZOOM_CLIENT_SECRET") && env("ZOOM_HOST_USER_ID"));
}
