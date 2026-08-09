import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { processNewsletterWebhook } from "@/features/newsletter/service";
import { processBookingEmailWebhook } from "@/features/booking/lib/booking-email-webhooks";
import { processTransactionalEmailWebhook } from "@/features/communications/transactional-email";

const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;

function verifySvixSignature(params: {
    secret: string;
    svixId: string;
    svixTimestamp: string;
    svixSignature: string;
    body: string;
}): boolean {
    const { secret, svixId, svixTimestamp, svixSignature, body } = params;

    const secretBytes = secret.startsWith("whsec_")
        ? Buffer.from(secret.slice("whsec_".length), "base64")
        : Buffer.from(secret, "utf8");

    const signedPayload = `${svixId}.${svixTimestamp}.${body}`;
    const expected = crypto.createHmac("sha256", secretBytes).update(signedPayload).digest("base64");

    // Resend/Svix sends one or more "v1,<sig>" pairs separated by spaces.
    const provided = svixSignature
        .split(" ")
        .map((chunk) => chunk.trim())
        .filter((chunk) => chunk.startsWith("v1,"))
        .map((chunk) => chunk.slice(3));

    return provided.some((sig) => {
        try {
            const sigBuf = Buffer.from(sig, "base64");
            const expBuf = Buffer.from(expected, "base64");
            return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
        } catch {
            return false;
        }
    });
}

export async function POST(req: NextRequest) {
    const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
    if (!secret) {
        console.error("[resend-webhook] Webhook endpoint is not configured: RESEND_WEBHOOK_SECRET is missing.");
        return NextResponse.json(
            { ok: false, error: "Webhook endpoint is not configured." },
            { status: 503 },
        );
    }

    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
        console.warn("[resend-webhook] Rejecting request due to missing signature headers:", {
            hasId: !!svixId,
            hasTimestamp: !!svixTimestamp,
            hasSignature: !!svixSignature,
        });
        return NextResponse.json({ ok: false, error: "Missing signature headers." }, { status: 401 });
    }

    // Reject replays older than 7 days or in the future by more than 5 minutes to accommodate retries.
    const timestampSeconds = Number.parseInt(svixTimestamp, 10);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (
        !Number.isFinite(timestampSeconds) ||
        (nowSeconds - timestampSeconds > 7 * 24 * 60 * 60) || // older than 7 days
        (timestampSeconds - nowSeconds > 300) // in the future by more than 5 minutes
    ) {
        console.warn(`[resend-webhook] Rejecting request due to invalid timestamp: header timestamp = ${timestampSeconds}, server time = ${nowSeconds}, difference = ${nowSeconds - timestampSeconds}s`);
        return NextResponse.json({ ok: false, error: "Invalid timestamp." }, { status: 401 });
    }

    const contentLength = Number(req.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_WEBHOOK_BODY_BYTES) {
        return NextResponse.json({ ok: false, error: "Payload too large." }, { status: 413 });
    }
    const body = await req.text();
    if (Buffer.byteLength(body, "utf8") > MAX_WEBHOOK_BODY_BYTES) {
        return NextResponse.json({ ok: false, error: "Payload too large." }, { status: 413 });
    }

    if (!verifySvixSignature({ secret, svixId, svixTimestamp, svixSignature, body })) {
        console.error("[resend-webhook] Rejecting request due to invalid signature. The signature did not match.");
        return NextResponse.json({ ok: false, error: "Invalid signature." }, { status: 401 });
    }

    try {
        const payload = JSON.parse(body) as Record<string, unknown>;
        let newsletterError: string | null = null;
        let bookingError: string | null = null;
        let transactionalError: string | null = null;

        try {
            const newsletterResult = await processNewsletterWebhook(payload);
            if (newsletterResult.error) {
                newsletterError = newsletterResult.error;
            }
        } catch (err) {
            newsletterError = err instanceof Error ? err.message : "Newsletter processor failed.";
        }

        try {
            const bookingResult = await processBookingEmailWebhook(payload);
            if (bookingResult.error) {
                bookingError = bookingResult.error;
            }
        } catch (err) {
            bookingError = err instanceof Error ? err.message : "Booking processor failed.";
        }

        try {
            const transactionalResult = await processTransactionalEmailWebhook(payload);
            if (transactionalResult.error) {
                transactionalError = transactionalResult.error;
            }
        } catch (err) {
            transactionalError = err instanceof Error ? err.message : "Transactional email processor failed.";
        }

        if (newsletterError || bookingError || transactionalError) {
            const combined = [
                newsletterError ? `Newsletter: ${newsletterError}` : null,
                bookingError ? `Booking: ${bookingError}` : null,
                transactionalError ? `Transactional: ${transactionalError}` : null,
            ].filter(Boolean).join(" | ");
            console.error(`[resend-webhook] Webhook processing failed: ${combined}`);
            return NextResponse.json({ ok: false, error: combined }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[resend-webhook] Exception in webhook handler:", error);
        return NextResponse.json(
            { ok: false, error: error instanceof Error ? error.message : "Webhook processing failed." },
            { status: 500 },
        );
    }
}
