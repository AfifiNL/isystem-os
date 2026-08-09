import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    createPodcastEpisodePath,
    isPublicPageLayoutNoIndex,
    isRetiredPublicSlug,
} from "./sitemap-policy";

describe("public sitemap policy", () => {
    it("keeps retired offer routes out of the index", () => {
        assert.equal(isRetiredPublicSlug("basic-vs-pro"), true);
        assert.equal(isRetiredPublicSlug("/basic-vs-pro/"), true);
        assert.equal(isRetiredPublicSlug("services"), false);
    });

    it("keeps builder pages marked noindex out of discovery surfaces", () => {
        assert.equal(isPublicPageLayoutNoIndex({
            root: { props: { metadata: { noindex: true } } },
        }), true);
        assert.equal(isPublicPageLayoutNoIndex({
            root: { props: { metadata: { noindex: false } } },
        }), false);
    });

    it("rejects podcast episode paths that would produce empty or nested segments", () => {
        assert.equal(createPodcastEpisodePath("", "episode"), null);
        assert.equal(createPodcastEpisodePath("show", ""), null);
        assert.equal(createPodcastEpisodePath("show/extra", "episode"), null);
    });

    it("builds one canonical slash between valid podcast path segments", () => {
        assert.equal(
            createPodcastEpisodePath("/systems-show/", "/governed-ai/"),
            "/podcast/systems-show/governed-ai",
        );
    });
});
