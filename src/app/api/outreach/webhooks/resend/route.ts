import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { processOutreachResendWebhook } from "@/features/outreach/webhooks";

function verifySvixSignature(params: {
    secret: string;
    svixId: string;
    svixTimestamp: string;
    svixSignature: string;
    body: string;
}) {
    const secretBytes = params.secret.startsWith("whsec_")
        ? Buffer.from(params.secret.slice("whsec_".length), "base64")
        : Buffer.from(params.secret, "utf8");
    const signedPayload = `${params.svixId}.${params.svixTimestamp}.${params.body}`;
    const expected = crypto.createHmac("sha256", secretBytes).update(signedPayload).digest("base64");
    return params.svixSignature
        .split(" ")
        .map((chunk) => chunk.trim())
        .filter((chunk) => chunk.startsWith("v1,"))
        .map((chunk) => chunk.slice(3))
        .some((signature) => {
            try {
                const provided = Buffer.from(signature, "base64");
                const expectedBuffer = Buffer.from(expected, "base64");
                return provided.length === expectedBuffer.length && crypto.timingSafeEqual(provided, expectedBuffer);
            } catch {
                return false;
            }
        });
}

export async function POST(req: NextRequest) {
    const secret = process.env.OUTREACH_WEBHOOK_SECRET?.trim() || process.env.RESEND_WEBHOOK_SECRET?.trim();
    if (!secret) {
        return NextResponse.json({ ok: false, error: "Outreach webhook endpoint is not configured." }, { status: 503 });
    }

    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");
    if (!svixId || !svixTimestamp || !svixSignature) {
        return NextResponse.json({ ok: false, error: "Missing signature headers." }, { status: 401 });
    }

    const timestampSeconds = Number.parseInt(svixTimestamp, 10);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(timestampSeconds) || nowSeconds - timestampSeconds > 7 * 24 * 60 * 60 || timestampSeconds - nowSeconds > 300) {
        return NextResponse.json({ ok: false, error: "Invalid timestamp." }, { status: 401 });
    }

    const body = await req.text();
    if (!verifySvixSignature({ secret, svixId, svixTimestamp, svixSignature, body })) {
        return NextResponse.json({ ok: false, error: "Invalid signature." }, { status: 401 });
    }

    const payload = JSON.parse(body) as Record<string, unknown>;
    const result = await processOutreachResendWebhook(payload);
    return NextResponse.json({ ok: true, ...result });
}
