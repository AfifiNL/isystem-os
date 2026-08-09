import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    extractYouTubeVideoId,
    parseVideoShortcode,
    splitMarkdownByVideoShortcodes,
} from "./video-shortcodes";

describe("extractYouTubeVideoId", () => {
    it("accepts raw YouTube ids", () => {
        assert.equal(extractYouTubeVideoId("dQw4w9WgXcQ"), "dQw4w9WgXcQ");
    });

    it("extracts ids from supported YouTube URL formats", () => {
        assert.equal(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ?t=43"), "dQw4w9WgXcQ");
        assert.equal(extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share"), "dQw4w9WgXcQ");
        assert.equal(extractYouTubeVideoId("https://m.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
        assert.equal(extractYouTubeVideoId("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
    });

    it("rejects unsupported hosts and malformed ids", () => {
        assert.equal(extractYouTubeVideoId("https://example.com/watch?v=dQw4w9WgXcQ"), null);
        assert.equal(extractYouTubeVideoId("https://www.youtube.com/watch?v=too-short"), null);
        assert.equal(extractYouTubeVideoId("javascript:alert(1)"), null);
    });
});

describe("parseVideoShortcode", () => {
    it("parses a YouTube shortcode into render-safe data", () => {
        assert.deepEqual(parseVideoShortcode("{{video:youtube id=https://youtu.be/dQw4w9WgXcQ title=Demo launch video}}"), {
            kind: "youtube",
            raw: "{{video:youtube id=https://youtu.be/dQw4w9WgXcQ title=Demo launch video}}",
            id: "dQw4w9WgXcQ",
            title: "Demo launch video",
        });
    });

    it("sanitizes shortcode titles so control characters cannot break markup", () => {
        const parsed = parseVideoShortcode("{{video:youtube id=dQw4w9WgXcQ title=Bad=title\nwith newlines}}") as { title: string } | null;

        assert.equal(parsed?.title, "Bad title with newlines");
    });

    it("parses uploaded video URLs and rejects non-http media URLs", () => {
        assert.deepEqual(parseVideoShortcode("{{video:url src=https://cdn.example.com/video.mp4 title=Uploaded walkthrough poster=https://cdn.example.com/poster.jpg}}"), {
            kind: "url",
            raw: "{{video:url src=https://cdn.example.com/video.mp4 title=Uploaded walkthrough poster=https://cdn.example.com/poster.jpg}}",
            src: "https://cdn.example.com/video.mp4",
            title: "Uploaded walkthrough",
            poster: "https://cdn.example.com/poster.jpg",
        });
        assert.equal(parseVideoShortcode("{{video:url src=javascript:alert(1) title=Bad}}"), null);
    });
});

describe("splitMarkdownByVideoShortcodes", () => {
    it("splits markdown around valid shortcodes while preserving order", () => {
        const chunks = splitMarkdownByVideoShortcodes([
            "Intro paragraph.",
            "",
            "{{video:youtube id=dQw4w9WgXcQ title=Launch demo}}",
            "",
            "Outro paragraph.",
        ].join("\n"));

        assert.equal(chunks.length, 3);
        assert.deepEqual(chunks[0], { type: "markdown", content: "Intro paragraph.\n\n" });
        assert.equal(chunks[1].type, "video");
        if (chunks[1].type === "video") {
            assert.equal(chunks[1].video.kind, "youtube");
            assert.equal(chunks[1].video.id, "dQw4w9WgXcQ");
        }
        assert.deepEqual(chunks[2], { type: "markdown", content: "\n\nOutro paragraph." });
    });

    it("leaves invalid shortcodes as markdown text", () => {
        assert.deepEqual(splitMarkdownByVideoShortcodes("Before {{video:youtube id=bad title=Bad}} after"), [
            { type: "markdown", content: "Before " },
            { type: "markdown", content: "{{video:youtube id=bad title=Bad}}" },
            { type: "markdown", content: " after" },
        ]);
    });
});
