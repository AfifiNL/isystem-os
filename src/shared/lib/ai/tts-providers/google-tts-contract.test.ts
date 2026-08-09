import assert from "node:assert/strict";
import test from "node:test";

import {
    buildGoogleTtsRequest,
    buildGoogleMultiSpeakerTtsRequest,
    resolveGoogleTtsRetryDelayMs,
    resolveGoogleTtsEndpoint,
    splitGoogleMultiSpeakerTurns,
} from "./google-tts-contract";

test("Gemini preset voices use the Cloud TTS API and model-specific request contract", () => {
    assert.equal(
        resolveGoogleTtsEndpoint({
            provider: "gemini",
            vertexLocation: "europe-west4",
        }),
        "https://eu-texttospeech.googleapis.com/v1/text:synthesize",
    );

    assert.deepEqual(
        buildGoogleTtsRequest({
            provider: "gemini",
            text: "Welcome to the podcast.",
            voiceId: "Aoede",
            languageCode: "en",
            model: "gemini-2.5-flash-tts",
        }),
        {
            input: { text: "Welcome to the podcast." },
            voice: {
                languageCode: "en-US",
                name: "Aoede",
                modelName: "gemini-2.5-flash-tts",
            },
            audioConfig: { audioEncoding: "MP3" },
        },
    );
});

test("standard Cloud TTS voices keep their regional endpoint and omit a Gemini model", () => {
    assert.equal(
        resolveGoogleTtsEndpoint({
            provider: "vertex",
            vertexLocation: "europe-west4",
        }),
        "https://europe-west4-texttospeech.googleapis.com/v1/text:synthesize",
    );

    assert.deepEqual(
        buildGoogleTtsRequest({
            provider: "vertex",
            text: "Welkom bij de podcast.",
            voiceId: "nl-NL-Studio-W",
            languageCode: "nl",
            model: "gemini-2.5-flash-tts",
        }),
        {
            input: { text: "Welkom bij de podcast." },
            voice: {
                languageCode: "nl-NL",
                name: "nl-NL-Studio-W",
            },
            audioConfig: { audioEncoding: "MP3" },
        },
    );
});

test("Gemini Cloud TTS maps Vertex regions onto supported Cloud TTS endpoints", () => {
    const endpointFor = (vertexLocation: string, overrideLocation?: string) =>
        resolveGoogleTtsEndpoint({ provider: "gemini", vertexLocation, overrideLocation });

    assert.equal(endpointFor("us-central1"), "https://us-texttospeech.googleapis.com/v1/text:synthesize");
    assert.equal(
        endpointFor("northamerica-northeast1"),
        "https://northamerica-northeast1-texttospeech.googleapis.com/v1/text:synthesize",
    );
    assert.equal(endpointFor("asia-east1"), "https://texttospeech.googleapis.com/v1/text:synthesize");
    assert.equal(endpointFor("europe-west4", "global"), "https://texttospeech.googleapis.com/v1/text:synthesize");
    assert.equal(endpointFor("", ""), "https://texttospeech.googleapis.com/v1/text:synthesize");
});

test("Cloud TTS request language codes are normalized or inferred safely", () => {
    const requestFor = (voiceId: string, languageCode?: string) => buildGoogleTtsRequest({
        provider: "vertex",
        text: "Test",
        voiceId,
        languageCode,
        model: "unused",
    });

    assert.equal(requestFor("ar-XA-Wavenet-A", "ar").voice.languageCode, "ar-XA");
    assert.equal(requestFor("en-GB-Studio-B", "en-GB").voice.languageCode, "en-GB");
    assert.equal(requestFor("nl-NL-Studio-W").voice.languageCode, "nl-NL");
    assert.equal(requestFor("custom-voice").voice.languageCode, "en-US");
});

test("Gemini dialogue is batched into quota-efficient native multi-speaker requests", () => {
    const turns = Array.from({ length: 20 }, (_, index) => ({
        speaker: index % 2 === 0 ? "host" as const : "guest" as const,
        text: `Turn ${index + 1}: ${"podcast dialogue ".repeat(5)}`.trim(),
    }));

    const batches = splitGoogleMultiSpeakerTurns(turns, 3_800);

    assert.equal(batches.length, 1);
    assert.deepEqual(batches.flat(), turns);
    assert.ok(Buffer.byteLength(JSON.stringify(batches[0]), "utf8") < 3_800);
});

test("long-form Gemini dialogue uses latency-safe batches below the provider byte maximum", () => {
    const turns = Array.from({ length: 44 }, (_, index) => ({
        speaker: index % 2 === 0 ? "host" as const : "guest" as const,
        text: `${index + 1}. ${"A realistic long-form podcast sentence with operational detail and natural pacing. ".repeat(2)}`.trim(),
    }));

    const batches = splitGoogleMultiSpeakerTurns(turns);

    assert.ok(batches.length >= 3, `expected at least 3 latency-safe batches, received ${batches.length}`);
    assert.ok(batches.length <= 5, `expected at most 5 quota-safe batches, received ${batches.length}`);
    for (const batch of batches) {
        assert.ok(
            Buffer.byteLength(JSON.stringify(batch), "utf8") <= 2_000,
            "default dialogue batch exceeded the 2,000-byte provider reliability budget",
        );
    }
    assert.deepEqual(batches.flat(), turns);
});

test("Gemini dialogue batching accounts for JSON-escaped input bytes", () => {
    const text = "\u0001".repeat(1_344);

    const batches = splitGoogleMultiSpeakerTurns([{ speaker: "host", text }]);

    assert.ok(batches.length > 1, "escaped input should be divided into multiple batches");
    for (const batch of batches) {
        assert.ok(
            Buffer.byteLength(JSON.stringify(batch), "utf8") <= 2_000,
            "JSON-escaped dialogue batch exceeded the latency budget",
        );
    }
    assert.equal(batches.flat().map((turn) => turn.text).join(""), text);
});

test("Gemini native multi-speaker request preserves aliases, voices, locale, and model", () => {
    assert.deepEqual(
        buildGoogleMultiSpeakerTtsRequest({
            turns: [
                { speaker: "host", text: "Welcome back." },
                { speaker: "guest", text: "Thanks for having me." },
            ],
            hostVoiceId: "Aoede",
            guestVoiceId: "Kore",
            languageCode: "nl",
            model: "gemini-2.5-flash-tts",
        }),
        {
            input: {
                prompt: "Speak as a natural two-person podcast conversation.",
                multiSpeakerMarkup: {
                    turns: [
                        { speaker: "Host", text: "Welcome back." },
                        { speaker: "Guest", text: "Thanks for having me." },
                    ],
                },
            },
            voice: {
                languageCode: "nl-NL",
                modelName: "gemini-2.5-flash-tts",
                multiSpeakerVoiceConfig: {
                    speakerVoiceConfigs: [
                        { speakerAlias: "Host", speakerId: "Aoede" },
                        { speakerAlias: "Guest", speakerId: "Kore" },
                    ],
                },
            },
            audioConfig: { audioEncoding: "MP3" },
        },
    );
});

test("quota retries honor Retry-After and otherwise wait for the minute window", () => {
    assert.equal(resolveGoogleTtsRetryDelayMs(429, "12", 1), 12_000);
    assert.equal(resolveGoogleTtsRetryDelayMs(429, null, 1), 60_000);
    assert.equal(resolveGoogleTtsRetryDelayMs(503, null, 1), 500);
    assert.equal(resolveGoogleTtsRetryDelayMs(400, null, 1), null);
});
