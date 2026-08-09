import assert from "node:assert/strict";
import test from "node:test";

import { mapWithBoundedConcurrency, withGlobalConcurrencyPermit } from "./bounded-concurrency";
import { generateElevenLabsTts } from "./elevenlabs";
import { requestGoogleTtsAudioWithRetry } from "./google-tts-request";

test("Google TTS batch work is bounded to two concurrent requests and preserves order", async () => {
    let active = 0;
    let peakActive = 0;

    const results = await mapWithBoundedConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
        active += 1;
        peakActive = Math.max(peakActive, active);
        await new Promise<void>((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return value * 10;
    });

    assert.equal(peakActive, 2);
    assert.deepEqual(results, [10, 20, 30, 40, 50]);
});

test("Google TTS batch scheduling stops dequeuing work after a null result", async () => {
    const started: number[] = [];
    const results = await mapWithBoundedConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
        started.push(value);
        if (value === 1) return null;
        await new Promise<void>((resolve) => setTimeout(resolve, 5));
        return value;
    }, { stopWhen: (result) => result === null });

    assert.deepEqual(started, [1, 2]);
    assert.deepEqual(results, [null, 2, null, null, null]);
});

test("Google TTS provider work shares one process-wide concurrency ceiling", async () => {
    let active = 0;
    let peakActive = 0;
    await Promise.all(Array.from({ length: 6 }, () => withGlobalConcurrencyPermit(2, async () => {
        active += 1;
        peakActive = Math.max(peakActive, active);
        await new Promise<void>((resolve) => setTimeout(resolve, 5));
        active -= 1;
    })));

    assert.equal(peakActive, 2);
});

test("an expired global TTS permit waiter is removed without leaking a permit", async () => {
    const releases: Array<() => void> = [];
    const holders = Array.from({ length: 2 }, () => withGlobalConcurrencyPermit(2, () =>
        new Promise<void>((resolve) => releases.push(resolve))
    ));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const releaseTimer = setTimeout(() => releases.forEach((release) => release()), 20);
    await assert.rejects(
        withGlobalConcurrencyPermit(2, async () => "too late", { deadlineAt: Date.now() + 5 }),
        (error: unknown) => error instanceof Error && error.name === "TimeoutError",
    );
    clearTimeout(releaseTimer);
    releases.forEach((release) => release());
    await Promise.all(holders);

    assert.equal(await withGlobalConcurrencyPermit(2, async () => "available"), "available");
});

test("ElevenLabs does not start a chunk after the enclosing route deadline", async (context) => {
    const previousKey = process.env.ELEVENLABS_API_KEY;
    process.env.ELEVENLABS_API_KEY = "test-key";
    let fetchCalls = 0;
    context.mock.method(globalThis, "fetch", async () => {
        fetchCalls += 1;
        return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    });

    try {
        const result = await generateElevenLabsTts("Deadline-aware speech", {
            provider: "elevenlabs",
            voiceId: "voice-id",
            deadlineAt: Date.now() - 1,
        });
        assert.equal(result, null);
        assert.equal(fetchCalls, 0);
    } finally {
        if (previousKey === undefined) delete process.env.ELEVENLABS_API_KEY;
        else process.env.ELEVENLABS_API_KEY = previousKey;
    }
});

test("Google TTS retries a rejected network request before returning audio", async (context) => {
    context.mock.method(console, "error", () => undefined);
    context.mock.method(console, "warn", () => undefined);
    let attempts = 0;
    const waits: number[] = [];
    const expectedAudio = Buffer.from("retry-success");
    const fetchImpl = (async () => {
        attempts += 1;
        if (attempts === 1) throw new TypeError("connection reset");
        return new Response(JSON.stringify({ audioContent: expectedAudio.toString("base64") }), {
            status: 200,
            headers: { "content-type": "application/json" },
        });
    }) as typeof fetch;

    const result = await requestGoogleTtsAudioWithRetry(
        "https://texttospeech.googleapis.com/v1/text:synthesize",
        { Authorization: "Bearer test" },
        { input: { text: "Hello" } },
        "[google-tts-test]",
        {
            fetchImpl,
            sleep: async (delayMs) => {
                waits.push(delayMs);
            },
        },
    );

    assert.equal(attempts, 2);
    assert.deepEqual(waits, [500]);
    assert.deepEqual(result, new Uint8Array(expectedAudio));
});

test("Google TTS skips a quota retry that cannot fit inside the operation deadline", async (context) => {
    context.mock.method(console, "error", () => undefined);
    context.mock.method(console, "warn", () => undefined);
    let attempts = 0;
    let sleeps = 0;

    const result = await requestGoogleTtsAudioWithRetry(
        "https://texttospeech.googleapis.com/v1/text:synthesize",
        { Authorization: "Bearer test" },
        { input: { text: "Hello" } },
        "[google-tts-test]",
        {
            deadlineAt: 10_000,
            now: () => 0,
            fetchImpl: (async () => {
                attempts += 1;
                return new Response("quota", {
                    status: 429,
                    headers: { "retry-after": "60" },
                });
            }) as typeof fetch,
            sleep: async () => {
                sleeps += 1;
            },
        },
    );

    assert.equal(result, null);
    assert.equal(attempts, 1);
    assert.equal(sleeps, 0);
});

test("Google TTS does not repeat an identical request after its synthesis timeout", async (context) => {
    context.mock.method(console, "error", () => undefined);
    context.mock.method(console, "warn", () => undefined);
    let attempts = 0;
    let sleeps = 0;

    const timeoutError = new Error("The operation was aborted due to timeout");
    timeoutError.name = "TimeoutError";
    const result = await requestGoogleTtsAudioWithRetry(
        "https://eu-texttospeech.googleapis.com/v1/text:synthesize",
        { Authorization: "Bearer test" },
        { input: { multiSpeakerMarkup: { turns: [] } } },
        "[google-tts-test]",
        {
            deadlineAt: 1_000_000,
            now: () => 0,
            fetchImpl: (async () => {
                attempts += 1;
                throw timeoutError;
            }) as typeof fetch,
            sleep: async () => {
                sleeps += 1;
            },
        },
    );

    assert.equal(result, null);
    assert.equal(attempts, 1);
    assert.equal(sleeps, 0);
});
