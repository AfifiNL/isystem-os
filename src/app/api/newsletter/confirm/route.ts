import { NextRequest, NextResponse } from "next/server";
import { confirmNewsletterSubscription } from "@/features/newsletter/service";
import { buildSiteUrl } from "@/shared/lib/site-url";

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") ?? "";
    const result = await confirmNewsletterSubscription(token);
    const target = new URL(buildSiteUrl("/newsletter/confirm"));
    target.searchParams.set("status", result.ok ? "ok" : "error");
    if (!result.ok && result.error) {
        target.searchParams.set("message", result.error);
    }
    return NextResponse.redirect(target, { status: 302 });
}
