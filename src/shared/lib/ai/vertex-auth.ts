
import { createAiProviderConfigError } from "@/shared/lib/ai/errors";

export interface VertexCredentials {
    type?: string;
    client_email?: string;
    private_key?: string;
    client_id?: string;
    refresh_token?: string;
    project_id?: string;
    [key: string]: unknown;
}

function parseCredentialsJson(raw: string): VertexCredentials {
    try {
        const parsed = JSON.parse(raw) as Partial<VertexCredentials>;
        if (parsed.type === "authorized_user") {
            if (!parsed.client_id || !parsed.refresh_token) {
                throw new Error("Authorized user JSON must contain client_id and refresh_token.");
            }
            return parsed as VertexCredentials;
        }

        if (!parsed.client_email || !parsed.private_key) {
            throw new Error("JSON must contain client_email and private_key.");
        }
        return {
            ...parsed,
            client_email: parsed.client_email,
            private_key: parsed.private_key.replace(/\\n/g, "\n"),
        } as VertexCredentials;
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw createAiProviderConfigError(
                "GOOGLE_APPLICATION_CREDENTIALS_JSON is not valid JSON for Vertex AI authentication.",
                { provider: "vertex" },
            );
        }
        throw createAiProviderConfigError(
            `GOOGLE_APPLICATION_CREDENTIALS_JSON is invalid: ${error instanceof Error ? error.message : "unknown parse error"}`,
            { provider: "vertex" },
        );
    }
}

export function getVertexCredentials(): VertexCredentials | undefined {
    const rawJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    const base64Json = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64;

    let raw = "";
    if (rawJson?.trim()) {
        raw = rawJson.trim();
    } else if (base64Json?.trim()) {
        try {
            raw = Buffer.from(base64Json.trim(), "base64").toString("utf-8");
        } catch {
            throw createAiProviderConfigError(
                "GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64 is not valid Base64.",
                { provider: "vertex" },
            );
        }
    }

    if (!raw) return undefined;
    return parseCredentialsJson(raw);
}

/**
 * Supports service-account or authorized-user JSON in environment variables without writing secrets to
 * disk. If absent, the Vertex SDK falls back to Application Default Credentials.
 */
export function getVertexGoogleAuthOptions(): { credentials?: VertexCredentials } | undefined {
    const credentials = getVertexCredentials();
    if (!credentials) return undefined;

    return {
        credentials,
    };
}
