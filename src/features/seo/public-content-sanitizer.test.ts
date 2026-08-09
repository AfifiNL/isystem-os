import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizePublicContent } from "./public-content-sanitizer";

describe("public content sanitizer", () => {
    it("replaces internal deployment paths with localized reader-facing evidence labels", () => {
        assert.equal(
            sanitizePublicContent("See client/example-client-production for proof.", "en"),
            "See the audited deployment history for proof.",
        );
        assert.equal(
            sanitizePublicContent("Zie client/example-client-production als bewijs.", "nl"),
            "Zie de gecontroleerde implementatiegeschiedenis als bewijs.",
        );
    });

    it("canonicalizes legacy markdown and HTML links and retires stale articles", () => {
        const stale = "the-true-roi-of-an-integrated-digital-system";
        assert.equal(
            sanitizePublicContent(
                `[Current](/en/blog/current?ref=old) [Retired](/en/blog/${stale}) <a href="/booking">Book</a>`,
                "en",
            ),
            "[Current](/blog/current?ref=old) [Retired](/blog) <a href=\"/en/booking\">Book</a>",
        );
        assert.equal(
            sanitizePublicContent("[Lees](/en/blog/current)", "nl"),
            "[Lees](/nl/blog/current)",
        );
    });
});
