import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const TOKEN_VERSION = "v1";
const MINIMUM_SECRET_BYTES = 32;

const bookingManagementCapabilitySchema = z.object({
    reservationId: z.string().uuid(),
    workspaceId: z.string().uuid(),
    expiresAt: z.string().datetime({ offset: true }),
});

export type BookingManagementCapability = z.infer<typeof bookingManagementCapabilitySchema>;

function getBookingManagementSecrets(env: NodeJS.ProcessEnv = process.env): {
    current: string | null;
    previous: string | null;
} {
    return {
        current: env.BOOKING_MANAGEMENT_SECRET?.trim() || null,
        previous: env.BOOKING_MANAGEMENT_SECRET_PREVIOUS?.trim() || null,
    };
}

function sign(encodedPayload: string, secret: string): string {
    return createHmac("sha256", secret)
        .update(`${TOKEN_VERSION}.${encodedPayload}`)
        .digest("base64url");
}

function isStrongSecret(secret: string | null): secret is string {
    return Boolean(secret && Buffer.byteLength(secret, "utf8") >= MINIMUM_SECRET_BYTES);
}

function hasInvalidConfiguredSecret(secret: string | null): boolean {
    return secret !== null && !isStrongSecret(secret);
}

function secureEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createBookingManagementToken(
    input: BookingManagementCapability,
    env: NodeJS.ProcessEnv = process.env,
): string {
    const payload = bookingManagementCapabilitySchema.parse(input);
    const secrets = getBookingManagementSecrets(env);
    const secret = secrets.current;

    if (!secret) {
        throw new Error("BOOKING_MANAGEMENT_SECRET is not configured.");
    }
    if (!isStrongSecret(secret)) {
        throw new Error(`BOOKING_MANAGEMENT_SECRET must be at least ${MINIMUM_SECRET_BYTES} bytes.`);
    }
    if (hasInvalidConfiguredSecret(secrets.previous)) {
        throw new Error(`BOOKING_MANAGEMENT_SECRET_PREVIOUS must be at least ${MINIMUM_SECRET_BYTES} bytes when configured.`);
    }

    const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    return `${TOKEN_VERSION}.${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function verifyBookingManagementToken(
    token: string,
    env: NodeJS.ProcessEnv = process.env,
    now: Date = new Date(),
): BookingManagementCapability | null {
    try {
        if (!token || token.length > 2048) return null;
        const secrets = getBookingManagementSecrets(env);
        if (!isStrongSecret(secrets.current) || hasInvalidConfiguredSecret(secrets.previous)) return null;

        const [version, encodedPayload, signature, extra] = token.split(".");
        if (version !== TOKEN_VERSION || !encodedPayload || !signature || extra) return null;
        const accepted = [secrets.current, secrets.previous]
            .filter((secret): secret is string => Boolean(secret))
            .some((secret) => secureEqual(signature, sign(encodedPayload, secret)));
        if (!accepted) return null;

        const parsedJson = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as unknown;
        const parsed = bookingManagementCapabilitySchema.safeParse(parsedJson);
        if (!parsed.success || Date.parse(parsed.data.expiresAt) <= now.getTime()) return null;

        return parsed.data;
    } catch {
        return null;
    }
}

export function getBookingManagementCapabilityExpiry(
    scheduledEnd: string,
    now: Date = new Date(),
): string {
    const scheduledExpiry = Date.parse(scheduledEnd) + 30 * 24 * 60 * 60 * 1000;
    const minimumExpiry = now.getTime() + 7 * 24 * 60 * 60 * 1000;
    return new Date(Math.max(scheduledExpiry, minimumExpiry)).toISOString();
}
