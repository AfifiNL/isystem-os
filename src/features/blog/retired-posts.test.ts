import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    isRetiredBlogSlug,
    RETIRED_BLOG_POSTGREST_FILTER,
    RETIRED_BLOG_SLUGS,
} from "./retired-posts";

describe("retired blog policy", () => {
    it("shares one source of truth between redirects and publication queries", () => {
        assert.equal(isRetiredBlogSlug("fifteen-minute-workspace-setup"), true);
        assert.equal(isRetiredBlogSlug("governed-ai-workflows"), false);
        assert.equal(
            RETIRED_BLOG_POSTGREST_FILTER,
            `(${RETIRED_BLOG_SLUGS.join(",")})`,
        );
    });
});
