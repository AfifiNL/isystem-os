import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    buildPublicVideoJsonLd,
    getIndexablePublicMediaUrl,
    getPublicVideoEvidenceDetails,
    getPublicVideoContentUrl,
    getPublicVideoSeoTitle,
} from "./public-seo";

const item = {
    id: "video-1",
    title: "SEO execution walkthrough",
    slug: "seo-execution",
    video_url: "https://cdn.example.com/seo.mp4",
    video_duration: 125,
    video_resolution: "1920x1080",
    content_markdown: "See how an approved SEO change moves from preview to execution evidence.",
    metadata: {
        source: "isystem-captured-library",
        description: "See how an approved SEO change moves from preview to execution evidence.",
        poster_url: "https://cdn.example.com/seo.jpg",
        captured_at: "2026-07-25T10:00:00.000Z",
        qa_status: "approved",
        public_system_ids: ["discoverability-growth"],
    },
    created_at: "2026-07-25T10:00:00.000Z",
    updated_at: "2026-07-26T10:00:00.000Z",
};

describe("public video SEO", () => {
    it("builds a complete VideoObject for the captured library", () => {
        const schema = buildPublicVideoJsonLd({
            item,
            locale: "en",
            pageUrl: "https://isystem.ai/en/videos/seo-execution",
            siteName: "iSystem.ai",
            siteUrl: "https://isystem.ai",
        });

        assert.equal(schema["@type"], "VideoObject");
        assert.equal(schema.duration, "PT2M5S");
        assert.equal(schema.thumbnailUrl, "https://cdn.example.com/seo.jpg");
        assert.equal(schema.contentUrl, item.video_url);
        assert.equal(schema.mainEntityOfPage["@id"], "https://isystem.ai/en/videos/seo-execution");
        assert.equal("embedUrl" in schema, false);
    });

    it("marks captured-library recordings as silent evidence with a written alternative", () => {
        assert.equal(getPublicVideoEvidenceDetails(item).silentCapture, true);
    });

    it("expands ambiguous feature labels into search-legible titles", () => {
        assert.equal(
            getPublicVideoSeoTitle({ ...item, slug: "feature-inbox", title: "Inbox" }),
            "Inbox workflow walkthrough",
        );
    });

    it("routes Supabase video bytes and posters through the crawlable first-party media endpoint", () => {
        const supabaseItem = {
            ...item,
            video_url: "https://supabase.isystem.ai/storage/v1/object/public/public-videos/library/demo.mp4",
            metadata: {
                ...item.metadata,
                poster_url: "https://supabase.isystem.ai/storage/v1/object/public/public-media/library/demo.webp",
            },
        };

        assert.equal(
            getPublicVideoContentUrl(supabaseItem),
            "/media/public/public-videos/library/demo.mp4",
        );
        assert.equal(
            getIndexablePublicMediaUrl("https://cdn.example.com/demo.mp4"),
            "https://cdn.example.com/demo.mp4",
        );

        const schema = buildPublicVideoJsonLd({
            item: supabaseItem,
            locale: "en",
            pageUrl: "https://isystem.ai/en/videos/seo-execution",
            siteName: "iSystem.ai",
            siteUrl: "https://isystem.ai",
        });

        assert.equal(
            schema.contentUrl,
            "https://isystem.ai/media/public/public-videos/library/demo.mp4",
        );
        assert.equal(
            schema.thumbnailUrl,
            "https://isystem.ai/media/public/public-media/library/demo.webp",
        );
    });
});
