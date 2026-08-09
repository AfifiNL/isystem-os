import assert from "node:assert/strict";
import test from "node:test";

import { resolveBuilderVideoSource } from "./builder-media";

test("accepts durable uploaded media URLs", () => {
    assert.equal(resolveBuilderVideoSource("/media/example-video"), "/media/example-video");
    assert.equal(
        resolveBuilderVideoSource("https://media.example.invalid/demo.mp4"),
        "https://media.example.invalid/demo.mp4",
    );
});

test("rejects unreviewed local static and insecure video paths", () => {
    assert.equal(resolveBuilderVideoSource("/marketing/demo.mp4"), null);
    assert.equal(resolveBuilderVideoSource("http://media.example.invalid/demo.mp4"), null);
    assert.equal(resolveBuilderVideoSource(""), null);
});
