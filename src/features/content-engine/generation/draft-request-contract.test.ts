import assert from "node:assert/strict";
import test from "node:test";
import { parseDraftGenerationRequest } from "./draft-request-contract";

const validRequest = {
    title: "A governed content workflow",
    keywords: ["content operations"],
    narrative_style: "analytical",
    length: "medium",
    content_types: ["blog_post"],
    geography: "europe",
    locale: "en",
    generate_charts: true,
    generate_diagrams: true,
    visual_density: "balanced",
};

test("draft request contract accepts and normalizes the supported workflow", () => {
    const parsed = parseDraftGenerationRequest(validRequest);

    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    assert.deepEqual(parsed.data.content_types, ["blog_post"]);
    assert.equal(parsed.data.title, validRequest.title);
});

test("draft request contract rejects unknown fields and unsupported formats", () => {
    assert.equal(parseDraftGenerationRequest({
        ...validRequest,
        content_types: ["podcast_episode"],
    }).success, false);
    assert.equal(parseDraftGenerationRequest({
        ...validRequest,
        workspace_id: "attacker-selected-workspace",
    }).success, false);
});

test("draft request contract rejects duplicate and empty content format selections", () => {
    assert.equal(parseDraftGenerationRequest({
        ...validRequest,
        content_types: [],
    }).success, false);
    assert.equal(parseDraftGenerationRequest({
        ...validRequest,
        content_types: ["blog_post", "blog_post"],
    }).success, false);
});
