
import { createVertex, type GoogleVertexProvider } from "@ai-sdk/google-vertex";
import { createVertexAnthropic, type GoogleVertexAnthropicProvider } from "@ai-sdk/google-vertex/anthropic";
import { createVertexMaas, type GoogleVertexMaasProvider } from "@ai-sdk/google-vertex/maas";
import { createAiProviderConfigError } from "@/shared/lib/ai/errors";
import { getVertexGoogleAuthOptions } from "@/shared/lib/ai/vertex-auth";

export interface VertexConfig {
    provider: "vertex";
    project: string;
    location: string;
    usesCredentialsJson: boolean;
}

// Current Gemini generation and partner MaaS models are served through the
// global endpoint. Keep these separate from GOOGLE_CLOUD_LOCATION because
// Chirp, Cloud TTS, and some other REST workloads still require a region.
export const VERTEX_GOOGLE_LOCATION = "global";
export const VERTEX_IMAGE_LOCATION = "global";
export const VERTEX_ANTHROPIC_LOCATION = "global";
export const VERTEX_MAAS_LOCATION = "global";

let cachedVertex: GoogleVertexProvider | null = null;
let cachedVertexProject: string | null = null;
let cachedVertexImage: GoogleVertexProvider | null = null;
let cachedVertexImageProject: string | null = null;
let cachedAnthropic: GoogleVertexAnthropicProvider | null = null;
let cachedAnthropicProject: string | null = null;
let cachedMaas: GoogleVertexMaasProvider | null = null;
let cachedMaasProject: string | null = null;

function readEnv(name: string): string | undefined {
    const value = process.env[name];
    return value?.trim() ? value.trim() : undefined;
}

export function isVertexProviderEnabled(): boolean {
    return readEnv("AI_PROVIDER") === "vertex";
}

export function getVertexConfig(): VertexConfig {
    const project = readEnv("GOOGLE_CLOUD_PROJECT") ?? readEnv("GOOGLE_VERTEX_PROJECT");
    const location = readEnv("GOOGLE_CLOUD_LOCATION") ?? readEnv("GOOGLE_VERTEX_LOCATION");

    if (!project) {
        throw createAiProviderConfigError(
            "AI_PROVIDER=vertex requires GOOGLE_CLOUD_PROJECT or GOOGLE_VERTEX_PROJECT.",
            { provider: "vertex", region: location },
        );
    }

    if (!location) {
        throw createAiProviderConfigError(
            "AI_PROVIDER=vertex requires GOOGLE_CLOUD_LOCATION or GOOGLE_VERTEX_LOCATION.",
            { provider: "vertex" },
        );
    }

    return {
        provider: "vertex",
        project,
        location,
        usesCredentialsJson: Boolean(readEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON") || readEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64")),
    };
}

export function getVertexProvider(): GoogleVertexProvider {
    const config = getVertexConfig();
    if (cachedVertex && cachedVertexProject === config.project) {
        return cachedVertex;
    }

    cachedVertex = createVertex({
        project: config.project,
        location: VERTEX_GOOGLE_LOCATION,
        baseURL: `https://aiplatform.googleapis.com/v1/projects/${config.project}/locations/${VERTEX_GOOGLE_LOCATION}/publishers/google`,
        googleAuthOptions: getVertexGoogleAuthOptions(),
    });
    cachedVertexProject = config.project;
    return cachedVertex;
}

export function getVertexImageProvider(): GoogleVertexProvider {
    const config = getVertexConfig();
    if (cachedVertexImage && cachedVertexImageProject === config.project) {
        return cachedVertexImage;
    }

    cachedVertexImage = createVertex({
        project: config.project,
        location: VERTEX_IMAGE_LOCATION,
        baseURL: `https://aiplatform.googleapis.com/v1/projects/${config.project}/locations/${VERTEX_IMAGE_LOCATION}/publishers/google`,
        googleAuthOptions: getVertexGoogleAuthOptions(),
    });
    cachedVertexImageProject = config.project;
    return cachedVertexImage;
}

export function getVertexAnthropicProvider(): GoogleVertexAnthropicProvider {
    const config = getVertexConfig();
    if (cachedAnthropic && cachedAnthropicProject === config.project) {
        return cachedAnthropic;
    }

    cachedAnthropic = createVertexAnthropic({
        project: config.project,
        location: VERTEX_ANTHROPIC_LOCATION,
        googleAuthOptions: getVertexGoogleAuthOptions(),
    });
    cachedAnthropicProject = config.project;
    return cachedAnthropic;
}

export function getVertexMaasProvider(): GoogleVertexMaasProvider {
    const config = getVertexConfig();
    if (cachedMaas && cachedMaasProject === config.project) {
        return cachedMaas;
    }

    cachedMaas = createVertexMaas({
        project: config.project,
        location: VERTEX_MAAS_LOCATION,
        googleAuthOptions: getVertexGoogleAuthOptions(),
    });
    cachedMaasProject = config.project;
    return cachedMaas;
}

export function resetVertexProviderForTests(): void {
    cachedVertex = null;
    cachedVertexProject = null;
    cachedVertexImage = null;
    cachedVertexImageProject = null;
    cachedAnthropic = null;
    cachedAnthropicProject = null;
    cachedMaas = null;
    cachedMaasProject = null;
}
