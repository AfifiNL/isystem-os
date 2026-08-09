import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const watchPageSource = readFileSync(
    new URL("../templates/pages/personal-brand/videos-detail.tsx", import.meta.url),
    "utf8",
);

test("video detail is a dedicated watch page with the player before supporting content", () => {
    const playerPosition = watchPageSource.indexOf("<VideoPlayer");
    const headerPosition = watchPageSource.indexOf("<header");
    const bodyPosition = watchPageSource.indexOf("{body &&");

    assert.ok(playerPosition >= 0, "watch page must render a video player");
    assert.ok(headerPosition > playerPosition, "video player must render before the title and metadata");
    assert.ok(bodyPosition > playerPosition, "video player must render before supporting text");
    assert.match(watchPageSource, /data-video-primary-content/);
    assert.match(watchPageSource, /max-w-4xl/);
});
