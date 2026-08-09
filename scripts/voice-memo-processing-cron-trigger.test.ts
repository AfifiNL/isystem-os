import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { parseVoiceMemoCronArgs, resolveVoiceMemoProcessingEndpoint } from "./voice-memo-processing-cron-trigger";

const ENV_KEYS = [
    "VOICE_MEMO_PROCESSING_CRON_LIMIT",
    "VOICE_MEMO_PROCESSING_CRON_URL",
    "NEXT_PUBLIC_SITE_URL",
    "APP_URL",
    "NEXT_PUBLIC_APP_URL",
    "NODE_ENV",
] as const;

const originalEnv = new Map<string, string | undefined>();
for (const key of ENV_KEYS) originalEnv.set(key, process.env[key]);

afterEach(() => {
    for (const key of ENV_KEYS) {
        const value = originalEnv.get(key);
        if (value === undefined) delete process.env[key];
        else (process.env as Record<string, string | undefined>)[key] = value;
    }
});

describe("voice memo processing cron trigger helpers", () => {
    it("caps CLI and environment limits to the API-safe range", () => {
        process.env.VOICE_MEMO_PROCESSING_CRON_LIMIT = "99";
        assert.equal(parseVoiceMemoCronArgs([]).limit, 10);
        assert.equal(parseVoiceMemoCronArgs(["--limit", "0"]).limit, 1);
        assert.equal(parseVoiceMemoCronArgs(["--limit=5"]).limit, 5);
    });

    it("resolves a base URL to the protected processing endpoint", () => {
        assert.equal(
            resolveVoiceMemoProcessingEndpoint({ url: "https://isystem.ai" }),
            "https://isystem.ai/api/voice-memos/process",
        );
        assert.equal(
            resolveVoiceMemoProcessingEndpoint({ url: "https://isystem.ai/api/voice-memos/process" }),
            "https://isystem.ai/api/voice-memos/process",
        );
    });

    it("uses NEXT_PUBLIC_SITE_URL fallback without leaking secrets", () => {
        process.env.NEXT_PUBLIC_SITE_URL = "https://www.isystem.ai";
        assert.equal(
            resolveVoiceMemoProcessingEndpoint({ url: null }),
            "https://www.isystem.ai/api/voice-memos/process",
        );
    });
});
