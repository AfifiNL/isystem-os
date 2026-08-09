import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
    new URL("./route.ts", import.meta.url),
    "utf8",
);
const migration = readFileSync(
    new URL("../../../../supabase/migrations/20260804031500_core_podcast_public_media_mime_types.sql", import.meta.url),
    "utf8",
);

test("podcast captions use VTT and the public episode bucket permits every generated media type", () => {
    assert.match(route, /contentType: "text\/vtt"/);
    assert.match(migration, /WHERE id = 'audio-episodes'/);
    for (const mimeType of ["audio/mpeg", "audio/wav", "image/jpeg", "text/vtt", "video/mp4"]) {
        assert.ok(migration.includes(mimeType), `missing ${mimeType} in audio-episodes allowlist`);
    }
});
