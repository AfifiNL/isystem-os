import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/shared/lib/supabase/server";
import { assertWorkspaceBookingEnabled } from "@/shared/lib/workspace/context";
import {
    buildGoogleCalendarAuthorizationUrl,
    encodeGoogleOAuthState,
    GOOGLE_CALENDAR_STATE_COOKIE,
} from "@/features/booking/lib/google-calendar-oauth";

export const runtime = "nodejs";

export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"));
    const context = await assertWorkspaceBookingEnabled();
    if ((context.role !== "admin" && context.role !== "manager") || !context.effectiveCapabilities.includes("booking.manage")) {
        return NextResponse.json({ error: "Booking management capability is required." }, { status: 403 });
    }
    const state = encodeGoogleOAuthState({
        workspaceId: context.activeWorkspace.id,
        userId: user.id,
        returnTo: "/dashboard/booking?tab=connections",
    });
    const cookieStore = await cookies();
    cookieStore.set(GOOGLE_CALENDAR_STATE_COOKIE, state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 600,
        path: "/",
    });
    return NextResponse.redirect(buildGoogleCalendarAuthorizationUrl(state));
}
