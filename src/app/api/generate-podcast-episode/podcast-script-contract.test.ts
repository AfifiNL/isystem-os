import assert from "node:assert/strict";
import test from "node:test";

import { isReadyMultiSpeakerPodcastScript } from "./podcast-script-contract";
import {
    PODCAST_FINALIZATION_RESERVE_MS,
    PODCAST_ROUTE_TIMEOUT_MS,
    PODCAST_TTS_RESERVE_MS,
    resolvePodcastPhaseTimeoutMs,
} from "./podcast-generation-deadline";

test("pre-authored host and guest dialogue can bypass script generation", () => {
    assert.equal(isReadyMultiSpeakerPodcastScript(`
        [HOST]: Why do reliable systems matter?
        [GUEST]: They make delivery repeatable.
        [HOST]: Where should a small business start?
        [GUEST]: Start with intake and follow-up.
    `), true);
});

test("ordinary source copy and one-sided dialogue still require script generation", () => {
    assert.equal(isReadyMultiSpeakerPodcastScript("Reliable systems make delivery repeatable."), false);
    assert.equal(isReadyMultiSpeakerPodcastScript("[HOST]: Welcome to the show."), false);
});

test("podcast generation phases share one route deadline with finalization time reserved", () => {
    const deadlineAt = PODCAST_ROUTE_TIMEOUT_MS;
    const scriptTimeoutMs = resolvePodcastPhaseTimeoutMs({
        deadlineAt,
        maxPhaseMs: 90_000,
        reserveMs: PODCAST_TTS_RESERVE_MS + PODCAST_FINALIZATION_RESERVE_MS,
        nowMs: 5_000,
    });
    const coverTimeoutMs = resolvePodcastPhaseTimeoutMs({
        deadlineAt,
        maxPhaseMs: 90_000,
        reserveMs: PODCAST_FINALIZATION_RESERVE_MS,
        nowMs: 200_000,
    });

    assert.equal(scriptTimeoutMs, 80_000);
    assert.equal(coverTimeoutMs, 35_000);
    assert.equal(resolvePodcastPhaseTimeoutMs({
        deadlineAt,
        maxPhaseMs: 90_000,
        reserveMs: PODCAST_FINALIZATION_RESERVE_MS,
        nowMs: 235_000,
    }), null);
});
