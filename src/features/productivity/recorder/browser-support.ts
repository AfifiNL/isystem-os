export interface RecorderSupportSnapshot {
    hasMediaDevices: boolean;
    hasGetUserMedia: boolean;
    hasMediaRecorder: boolean;
}

export type RecorderPermissionState = "checking" | "ready" | "blocked" | "unsupported";

export function getRecorderSupportMessage(snapshot: RecorderSupportSnapshot): string | null {
    if (!snapshot.hasMediaDevices || !snapshot.hasGetUserMedia) {
        return "This browser cannot access microphone recording APIs. Use a current browser over HTTPS, then try again.";
    }

    if (!snapshot.hasMediaRecorder) {
        return "This browser can request a microphone, but it cannot encode recordings with MediaRecorder. Use a current Chrome, Edge, Safari, or Firefox build.";
    }

    return null;
}

export function normalizeRecorderPermissionError(err: unknown): string {
    const name = err instanceof DOMException ? err.name : "";
    const message = err instanceof Error ? err.message : String(err ?? "");
    const normalized = `${name} ${message}`.toLowerCase();

    if (normalized.includes("permissions policy") || normalized.includes("permission policy") || normalized.includes("not allowed in this document")) {
        return "This page is blocked by the site microphone policy. Reload /dashboard/recorder over HTTPS, then press Retry microphone.";
    }

    if (name === "NotAllowedError" || name === "SecurityError" || normalized.includes("permission denied") || normalized.includes("denied")) {
        return "Microphone access is blocked. Use HTTPS, enable microphone permission in your browser/site settings, then press Retry microphone.";
    }

    if (name === "NotFoundError" || name === "DevicesNotFoundError" || normalized.includes("not found")) {
        return "No microphone was found. Connect or enable a microphone in your system settings, then press Retry microphone.";
    }

    if (name === "NotReadableError" || normalized.includes("could not start") || normalized.includes("device in use")) {
        return "The microphone is unavailable or already in use by another app. Close other recording apps, then press Retry microphone.";
    }

    return "Could not access the microphone. Use HTTPS, enable microphone permission in your browser/site settings, then press Retry microphone.";
}
