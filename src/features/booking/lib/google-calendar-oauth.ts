import "server-only";

import crypto from "node:crypto";
import { buildSiteUrl } from "@/shared/lib/auth/redirect-url";
import { encryptToken } from "./google-calendar";

export const GOOGLE_CALENDAR_STATE_COOKIE = "isystem-google-calendar-oauth-state";
const GOOGLE_SCOPES = [
    "openid",
    "email",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
    "https://www.googleapis.com/auth/calendar.freebusy",
].join(" ");
const GOOGLE_OAUTH_TIMEOUT_MS = 15_000;

function googleOAuthFetch(input: RequestInfo | URL, init: RequestInit = {}) {
    return fetch(input, {
        ...init,
        signal: init.signal ?? AbortSignal.timeout(GOOGLE_OAUTH_TIMEOUT_MS),
    });
}

type OAuthState = { workspaceId: string; userId: string; returnTo: string; nonce: string; exp: number };

function secret(): Buffer {
    const value = process.env.CALENDAR_OAUTH_STATE_SECRET?.trim()
        || process.env.CALENDAR_TOKEN_ENCRYPTION_SECRET?.trim();
    if (!value || value.length < 32) throw new Error("Missing CALENDAR_OAUTH_STATE_SECRET.");
    return crypto.createHash("sha256").update(value).digest();
}

function base64Url(value: string | Buffer): string {
    return Buffer.from(value).toString("base64url");
}

function sign(payload: string): string {
    return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function encodeGoogleOAuthState(input: Omit<OAuthState, "nonce" | "exp">): string {
    const payload = base64Url(JSON.stringify({ ...input, nonce: base64Url(crypto.randomBytes(16)), exp: Date.now() + 10 * 60_000 }));
    return `${payload}.${sign(payload)}`;
}

export function decodeGoogleOAuthState(value: string): OAuthState | null {
    const [payload, signature] = value.split(".");
    const expected = payload ? sign(payload) : "";
    if (!payload || !signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    try {
        const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthState;
        if (!parsed.workspaceId || !parsed.userId || !parsed.nonce || !parsed.returnTo || !Number.isFinite(parsed.exp) || parsed.exp <= Date.now()) return null;
        if (!parsed.returnTo.startsWith("/dashboard/booking")) return null;
        return parsed;
    } catch {
        return null;
    }
}

export function googleCalendarRedirectUri(): string {
    return process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim() || buildSiteUrl("/api/booking/calendar/google/callback");
}

export function buildGoogleCalendarAuthorizationUrl(state: string): string {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!clientId) throw new Error("Missing GOOGLE_CLIENT_ID.");
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: googleCalendarRedirectUri(),
        response_type: "code",
        access_type: "offline",
        prompt: "consent",
        scope: GOOGLE_SCOPES,
        state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleAuthorizationCode(code: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) throw new Error("Missing Google OAuth credentials.");
    const response = await googleOAuthFetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: googleCalendarRedirectUri(),
            grant_type: "authorization_code",
        }),
        cache: "no-store",
    });
    const body = await response.text();
    if (!response.ok) throw new Error("Google OAuth code exchange failed.");
    const token = JSON.parse(body) as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!token.access_token) throw new Error("Google OAuth did not return an access token.");
    return token;
}

export async function loadGoogleAccount(accessToken: string) {
    const [userinfoResponse, calendarsResponse] = await Promise.all([
        googleOAuthFetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }),
        googleOAuthFetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer&showDeleted=false", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }),
    ]);
    if (!userinfoResponse.ok || !calendarsResponse.ok) throw new Error("Google account or calendar list could not be read.");
    const userinfo = await userinfoResponse.json() as { email?: string };
    const calendars = await calendarsResponse.json() as { items?: Array<{ id?: string; primary?: boolean; summary?: string }> };
    const primary = calendars.items?.find((calendar) => calendar.primary) ?? calendars.items?.[0];
    if (!userinfo.email || !primary?.id) throw new Error("Google did not return a writable calendar.");
    return { accountEmail: userinfo.email, calendarId: primary.id, calendarName: primary.summary ?? "Primary" };
}

export function encryptGoogleToken(value: string): string {
    return encryptToken(value);
}
