import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

test("public booking localizes location modes in English, Dutch, and Arabic", () => {
    const source = read("src/features/booking/ui/public-booking-experience.tsx");
    assert.match(source, /locationModeLabels/);
    assert.match(source, /remote: "Remote"/);
    assert.match(source, /remote: "Online"/);
    assert.match(source, /remote: "عن بُعد"/);
    assert.doesNotMatch(source, /\{service\.locationMode\}/);
});

test("default consultation language choices include English, Dutch, and Arabic", () => {
    const defaults = read("src/features/booking/types.ts");

    assert.match(defaults, /options: \["English", "Dutch", "Arabic"\]/);
});
