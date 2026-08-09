import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPublicV2Route, normalizePublicSiteRenderer, resolvePublicSiteRenderer } from "./public-site-rollout";

describe("public-site rollout flags", () => {
    it("uses route-specific flags before the workspace default", () => {
        const settings = normalizePublicSiteRenderer({
            default: "legacy",
            routes: { about: "v2", services: "legacy" },
        });

        assert.equal(resolvePublicSiteRenderer(settings, "about"), "v2");
        assert.equal(resolvePublicSiteRenderer(settings, "services"), "legacy");
        assert.equal(resolvePublicSiteRenderer(settings, "home"), "legacy");
    });

    it("keeps rollout flags client-scoped", () => {
        assert.equal(isPublicV2Route("isystem-agency", { default: "v2", routes: {} }, "home"), true);
        assert.equal(isPublicV2Route("facility-services", { default: "v2", routes: {} }, "home"), false);
    });
});
