import assert from "node:assert/strict";
import test from "node:test";

import {
    RESOURCE_REGISTRY,
    resolveReviewedResourceVisual,
} from "./resource-registry";

test("public distributions do not advertise private campaign downloads", () => {
    assert.deepEqual(RESOURCE_REGISTRY, []);
});

test("resource previews resolve only reviewed built-in public visuals", () => {
    assert.equal(resolveReviewedResourceVisual("/stealth-cto-hero.png"), "/stealth-cto-hero.png");
    assert.equal(resolveReviewedResourceVisual("business-computer-blueprint.svg"), null);
    assert.equal(resolveReviewedResourceVisual(""), null);
});
