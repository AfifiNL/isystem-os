import assert from "node:assert/strict";
import test from "node:test";

import { inspectBoundedMetadata, readBoundedJson } from "./public-request";

test("rejects declared and actual JSON bodies above the cap before parsing", async () => {
    const declared = new Request("https://client.example/api", {
        method: "POST",
        headers: { "content-length": "100" },
        body: "{}",
    });
    assert.deepEqual(await readBoundedJson(declared, 32), { ok: false, status: 413, error: "Payload too large" });

    const actual = new Request("https://client.example/api", { method: "POST", body: JSON.stringify({ value: "x".repeat(64) }) });
    assert.deepEqual(await readBoundedJson(actual, 32), { ok: false, status: 413, error: "Payload too large" });
});

test("bounds metadata depth, property count, and encoded bytes", () => {
    assert.equal(inspectBoundedMetadata({ source: "footer", campaign: { name: "launch" } }).ok, true);
    assert.equal(inspectBoundedMetadata({ a: { b: { c: { d: "too deep" } } } }, { maxDepth: 3 }).ok, false);
    assert.equal(inspectBoundedMetadata(Object.fromEntries(Array.from({ length: 21 }, (_, index) => [`k${index}`, index])), { maxEntries: 20 }).ok, false);
    assert.equal(inspectBoundedMetadata({ value: "x".repeat(200) }, { maxBytes: 100 }).ok, false);
});
