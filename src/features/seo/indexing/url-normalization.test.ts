import assert from "node:assert/strict";
import test from "node:test";
import {
    buildCanonicalBlogUrl,
    buildCanonicalPublicContentUrl,
    cleanIndexingUrl,
    gscPageSlugCandidatesForBlog,
    isNoisyIndexingUrl,
} from "@/features/seo/indexing/url-normalization";

test("buildCanonicalBlogUrl keeps English blog canonical unprefixed", () => {
    const result = buildCanonicalBlogUrl({
        siteUrl: "https://isystem.ai/",
        slug: "custom-business-ai-architecture",
        locale: "en",
    });

    assert.equal(result.url, "https://isystem.ai/blog/custom-business-ai-architecture");
    assert.equal(result.canonicalPath, "/blog/custom-business-ai-architecture");
});

test("buildCanonicalBlogUrl keeps translated blog URLs locale-prefixed", () => {
    const result = buildCanonicalBlogUrl({
        siteUrl: "https://isystem.ai",
        slug: "governed-ai-your-business-shield",
        locale: "nl",
    });

    assert.equal(result.url, "https://isystem.ai/nl/blog/governed-ai-your-business-shield");
    assert.equal(result.canonicalPath, "/nl/blog/governed-ai-your-business-shield");
});

test("buildCanonicalPublicContentUrl builds locale-prefixed public pages", () => {
    const result = buildCanonicalPublicContentUrl({
        siteUrl: "https://isystem.ai/",
        type: "page",
        slug: "services",
        locale: "nl",
    });

    assert.equal(result.url, "https://isystem.ai/nl/services");
    assert.equal(result.canonicalPath, "/nl/services");
});

test("buildCanonicalPublicContentUrl maps home page slug to locale root", () => {
    const result = buildCanonicalPublicContentUrl({
        siteUrl: "https://isystem.ai",
        type: "page",
        slug: "home",
        locale: "ar",
    });

    assert.equal(result.url, "https://isystem.ai/ar");
    assert.equal(result.canonicalPath, "/ar");
});

test("cleanIndexingUrl strips indexing noise and duplicate slashes", () => {
    const result = cleanIndexingUrl("https://isystem.ai/nl/tools/gdpr-cookie-scanner?ref=related&keep=1#fragment");

    assert.deepEqual(result, {
        url: "https://isystem.ai/nl/tools/gdpr-cookie-scanner?keep=1",
        canonicalPath: "/nl/tools/gdpr-cookie-scanner",
    });
    assert.equal(isNoisyIndexingUrl("https://isystem.ai/contact?type=legal"), true);
});

test("gscPageSlugCandidatesForBlog includes canonical and localized candidates", () => {
    assert.deepEqual(
        gscPageSlugCandidatesForBlog({ slug: "post", locale: "en" }),
        ["/blog/post", "/en/blog/post"],
    );
    assert.deepEqual(
        gscPageSlugCandidatesForBlog({ slug: "post", locale: "ar" }),
        ["/ar/blog/post", "/blog/post"],
    );
});
