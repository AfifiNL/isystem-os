import { createHmac, timingSafeEqual } from "node:crypto";

const ALLOWED_HIGGSFIELD_OUTPUT_HOSTS = new Set([
    "cdn.higgsfield.ai",
    "assets.higgsfield.ai",
    "storage.higgsfield.ai",
]);

export interface HiggsfieldWebhookSignatureInput {
    rawBody: string;
    secret: string | null | undefined;
    signatureHeader: string | null | undefined;
}

export interface HiggsfieldWebhookSignatureResult {
    signatureValid: boolean;
    reason: "valid" | "missing_secret" | "missing_signature" | "invalid_signature";
}

function normalizeSignatureHeader(signatureHeader: string): string[] {
    return signatureHeader
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => part.startsWith("sha256=") ? part.slice("sha256=".length) : part);
}

function timingSafeHexEqual(candidateHex: string, expectedHex: string): boolean {
    try {
        const candidate = Buffer.from(candidateHex, "hex");
        const expected = Buffer.from(expectedHex, "hex");
        return candidate.length === expected.length && timingSafeEqual(candidate, expected);
    } catch {
        return false;
    }
}

export function verifyHiggsfieldWebhookSignature(input: HiggsfieldWebhookSignatureInput): HiggsfieldWebhookSignatureResult {
    const secret = input.secret?.trim();
    if (!secret) return { signatureValid: false, reason: "missing_secret" };

    const signatureHeader = input.signatureHeader?.trim();
    if (!signatureHeader) return { signatureValid: false, reason: "missing_signature" };

    const expected = createHmac("sha256", secret).update(input.rawBody).digest("hex");
    const valid = normalizeSignatureHeader(signatureHeader).some((candidate) => timingSafeHexEqual(candidate, expected));
    return valid
        ? { signatureValid: true, reason: "valid" }
        : { signatureValid: false, reason: "invalid_signature" };
}

export function buildHiggsfieldWebhookLedgerKey(input: {
    providerEventId?: string | null;
    providerJobId?: string | null;
    rawStatus?: string | null;
}): string | null {
    if (input.providerEventId) return `higgsfield:event:${input.providerEventId}`;
    if (input.providerJobId) return `higgsfield:job:${input.providerJobId}:${input.rawStatus ?? "unknown"}`;
    return null;
}

export function isAllowedCreativeProviderOutputUrl(value: string): boolean {
    try {
        const url = new URL(value);
        if (url.protocol !== "https:") return false;
        return ALLOWED_HIGGSFIELD_OUTPUT_HOSTS.has(url.hostname.toLowerCase());
    } catch {
        return false;
    }
}
