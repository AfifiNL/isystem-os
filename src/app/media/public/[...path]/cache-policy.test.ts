import assert from "node:assert/strict";
import test from "node:test";

import { publicMediaCacheControl } from "./cache-policy";

test("public media is immutable only when a full response path is content addressed", () => {
    assert.equal(publicMediaCacheControl({ status: 200, path: ["public-media", "asset.abcdef123456.webp"] }), "public, max-age=31536000, immutable");
    assert.equal(publicMediaCacheControl({ status: 200, path: ["public-media", "mutable.webp"] }), "public, max-age=300, stale-while-revalidate=86400");
    assert.equal(publicMediaCacheControl({ status: 206, path: ["public-media", "asset.abcdef123456.webp"] }), "public, max-age=300, stale-while-revalidate=86400");
    assert.equal(publicMediaCacheControl({ status: 200, path: ["public-media", "asset.webp"], version: "abcdef123456" }), "public, max-age=31536000, immutable");
    assert.equal(publicMediaCacheControl({ status: 206, path: ["public-media", "asset.webp"], version: "abcdef123456" }), "public, max-age=300, stale-while-revalidate=86400");
});

test("public media never caches upstream errors", () => {
    assert.equal(publicMediaCacheControl({ status: 404, path: ["public-media", "missing.webp"] }), "no-store");
    assert.equal(publicMediaCacheControl({ status: 429, path: ["public-media", "asset.webp"] }), "no-store");
    assert.equal(publicMediaCacheControl({ status: 503, path: ["public-media", "asset.webp"] }), "no-store");
});
