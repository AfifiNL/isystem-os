import assert from "node:assert/strict";
import test from "node:test";

import { isPublicToolsBrandReady } from "./availability";

test("public tools are available for the reviewed iSystem template", () => {
    assert.equal(isPublicToolsBrandReady("isystem-agency"), true);
});

test("public tools fail closed for an unreviewed client template", () => {
    assert.equal(isPublicToolsBrandReady("saas-product"), false);
});

test("an environment flag cannot bypass the reviewed-template boundary", () => {
    assert.equal(isPublicToolsBrandReady("saas-product", "true"), false);
});
