import assert from "node:assert/strict";
import test from "node:test";
import { resolveLegacyIndexingRedirect } from "@/features/seo/indexing/legacy-redirects";

test("API query parameters are never rewritten by public indexing cleanup", () => {
    assert.equal(
        resolveLegacyIndexingRedirect({
            pathname: "/api/auth/confirm",
            search: "?token_hash=secret&type=magiclink&next=%2Fdashboard",
        }),
        null,
    );
});

test("legacy home paths redirect to locale roots", () => {
    assert.equal(resolveLegacyIndexingRedirect({ pathname: "/home" }), "/");
    assert.equal(resolveLegacyIndexingRedirect({ pathname: "/nl/home" }), "/nl");
});

test("duplicate-slash podcast URLs fail closed to the locale podcast index", () => {
    assert.equal(
        resolveLegacyIndexingRedirect({ pathname: "/en/podcast//governed-ai-your-business-shield-and-growth-engine" }),
        "/en/podcast",
    );
});

test("stale blog slugs redirect to the nearest blog index", () => {
    assert.equal(
        resolveLegacyIndexingRedirect({ pathname: "/nl/blog/the-true-roi-of-an-integrated-digital-system" }),
        "/nl/blog",
    );
    assert.equal(
        resolveLegacyIndexingRedirect({ pathname: "/en/blog/the-ai-frontier-has-moved-why-standalone-llms-are-no-longer-your-business-future-1776869544870" }),
        "/blog",
    );
});

test("exact legacy 404 routes redirect to the closest live canonical surface", () => {
    assert.equal(resolveLegacyIndexingRedirect({ pathname: "/media-ops-demo" }), "/en/media-agency-digital-systems");
});

test("public indexing noise query params redirect to clean canonical URLs", () => {
    assert.equal(
        resolveLegacyIndexingRedirect({
            pathname: "/nl/tools/gdpr-cookie-scanner",
            search: "?ref=related-nl-zzp-agreement-generator",
        }),
        "/nl/tools/gdpr-cookie-scanner",
    );
    assert.equal(
        resolveLegacyIndexingRedirect({
            pathname: "/ar/contact",
            search: "?type=legal&keep=1",
            hash: "#form",
        }),
        "/ar/contact?keep=1#form",
    );
});
