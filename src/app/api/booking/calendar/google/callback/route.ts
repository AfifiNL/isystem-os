import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { createClient } from "@/shared/lib/supabase/server";
import { assertWorkspaceBookingEnabled } from "@/shared/lib/workspace/context";
import {
    decodeGoogleOAuthState,
    exchangeGoogleAuthorizationCode,
    GOOGLE_CALENDAR_STATE_COOKIE,
    loadGoogleAccount,
} from "@/features/booking/lib/google-calendar-oauth";
import { encryptToken, verifyGoogleMeetingProvisioning } from "@/features/booking/lib/google-calendar";

export const runtime = "nodejs";

function redirectTo(returnTo: string, status: string) {
    const url = new URL(returnTo, process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
    url.searchParams.set("calendar", status);
    return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
    const stateValue = request.nextUrl.searchParams.get("state") ?? "";
    const code = request.nextUrl.searchParams.get("code") ?? "";
    const cookieStore = await cookies();
    const cookieState = cookieStore.get(GOOGLE_CALENDAR_STATE_COOKIE)?.value;
    const state = decodeGoogleOAuthState(stateValue);
    cookieStore.delete(GOOGLE_CALENDAR_STATE_COOKIE);
    if (!state || stateValue !== cookieState) {
        return redirectTo("/dashboard/booking?tab=connections", "error");
    }
    if (!code) return redirectTo(state.returnTo, "error");

    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const context = await assertWorkspaceBookingEnabled();
        if (!user || user.id !== state.userId || context.activeWorkspace.id !== state.workspaceId || (context.role !== "admin" && context.role !== "manager") || !context.effectiveCapabilities.includes("booking.manage")) {
            return redirectTo(state.returnTo, "error");
        }
        const token = await exchangeGoogleAuthorizationCode(code);
        const account = await loadGoogleAccount(token.access_token!);
        await verifyGoogleMeetingProvisioning(token.access_token!, account.calendarId);
        const admin = createAdminClient();
        const { data: existing } = await admin
            .from("workspace_calendar_connections" as never)
            .select("id,refresh_token" as never)
            .eq("workspace_id" as never, state.workspaceId as never)
            .eq("provider" as never, "google" as never)
            .eq("account_email" as never, account.accountEmail as never)
            .eq("calendar_id" as never, account.calendarId as never)
            .maybeSingle() as unknown as { data: { id: string; refresh_token: string } | null };
        const refreshToken = token.refresh_token
            ? encryptToken(token.refresh_token)
            : existing?.refresh_token;
        if (!refreshToken) {
            throw new Error("Google did not return a refresh token. Reconnect with consent to enable offline calendar sync.");
        }
        const { error: connectionError } = await admin
            .from("workspace_calendar_connections" as never)
            .upsert({
                id: existing?.id,
                workspace_id: state.workspaceId,
                provider: "google",
                account_email: account.accountEmail,
                calendar_id: account.calendarId,
                access_token: encryptToken(token.access_token!),
                refresh_token: refreshToken,
                token_expires_at: new Date(Date.now() + Math.max((token.expires_in ?? 3600) - 60, 60) * 1000).toISOString(),
                sync_enabled: true,
                last_sync_at: new Date().toISOString(),
                last_error: null,
            } as never, { onConflict: "workspace_id,provider,account_email,calendar_id" } as never);
        if (connectionError) throw new Error("Google Calendar connection could not be saved.");
        return redirectTo(state.returnTo, "connected");
    } catch (error) {
        console.error("[booking] Google Calendar OAuth callback failed", error);
        return redirectTo(state.returnTo, "error");
    }
}
