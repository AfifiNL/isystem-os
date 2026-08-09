import { createHash } from "node:crypto";

// SHA-256 hex digest of a binary payload. Used as the canonical content
// fingerprint stored on legal_documents.sha256 and on
// legal_signature_events.payload_sha256 — a later mismatch on fetch surfaces
// as a tamper warning in the UI.
export function sha256Hex(payload: Buffer | Uint8Array | string): string {
    const hash = createHash("sha256");
    hash.update(payload);
    return hash.digest("hex");
}

export function sha256Base64(payload: Buffer | Uint8Array | string): string {
    const hash = createHash("sha256");
    hash.update(payload);
    return hash.digest("base64");
}
