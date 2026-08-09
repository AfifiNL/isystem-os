import assert from "node:assert/strict";
import test from "node:test";

import { splitTtsTextByUtf8Bytes } from "./text-chunker";

test("TTS byte-aware chunking stays below the Cloud TTS limit for multibyte text", () => {
    const text = `${"مرحبا بالعالم. ".repeat(90)}${"🎙️ podcast. ".repeat(90)}`;
    const chunks = splitTtsTextByUtf8Bytes(text, 500);

    assert.ok(chunks.length > 1);
    assert.ok(chunks.every((chunk) => Buffer.byteLength(chunk, "utf8") <= 500));
    assert.equal(chunks.join(" ").replace(/\s+/g, " ").trim(), text.replace(/\s+/g, " ").trim());
});
