import assert from "node:assert/strict";
import test from "node:test";

import { getPublicPageAvailableLocales, resolvePublicPageSeo } from "./public-page-seo";

const page = {
    title: "Fallback title",
    content_markdown: "Fallback description",
    visual_layout: null,
    public_layout_v2: {
        schemaVersion: 2,
        root: {
            props: {
                title: "Page",
                pageKind: "system-proof",
                metadata: {
                    seoTitle: "English SEO title",
                    seoDescription: "English SEO description",
                    noindex: true,
                    canonicalPath: "//unsafe.example/path",
                },
            },
        },
        content: [{
            type: "PublicHero",
            props: {
                id: "hero",
                headline: { en: "English hero", ar: "عنوان عربي" },
                description: { en: "English hero description", ar: "وصف عربي مكتوب" },
            },
        }],
    },
};

test("public page SEO respects noindex, rejects protocol-relative canonicals, and localizes copy", () => {
    const seo = resolvePublicPageSeo(page, "ar", "Acme");
    assert.equal(seo.noindex, true);
    assert.equal(seo.canonicalPath, undefined);
    assert.match(seo.seoTitle, /عنوان عربي/);
    assert.match(seo.seoDescription, /وصف عربي/);
});

test("hreflang inventory only includes independently authored locales", () => {
    assert.deepEqual(getPublicPageAvailableLocales(page), ["en", "ar"]);
});
