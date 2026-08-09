import "server-only";

import { GoogleAuth } from "google-auth-library";
import { getVertexCredentials } from "@/shared/lib/ai/vertex-auth";
import { settleProviderPromiseWithin } from "@/shared/lib/ai/provider-timeout";

const GOOGLE_OAUTH_TIMEOUT_MS = 30_000;

export async function getGoogleCloudAccessToken(): Promise<string | null> {
    try {
        const credentials = getVertexCredentials();
        const auth = new GoogleAuth({
            ...(credentials ? { credentials } : {}),
            scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        });
        const token = await settleProviderPromiseWithin(
            (async () => {
                const client = await auth.getClient();
                const tokenResponse = await client.getAccessToken();
                return tokenResponse.token ?? null;
            })(),
            GOOGLE_OAUTH_TIMEOUT_MS,
            null,
        );
        if (!token) {
            console.error(`[google-oauth] OAuth token request returned no token within ${GOOGLE_OAUTH_TIMEOUT_MS}ms.`);
        }
        return token;
    } catch (error) {
        console.error("[google-oauth] Failed to obtain Google Cloud OAuth token:", error);
        return null;
    }
}
