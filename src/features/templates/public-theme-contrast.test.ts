import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const configSource = readFileSync(
    new URL("./configs/isystem-agency.ts", import.meta.url),
    "utf8",
);

function tokenBlock(name: "surfaces" | "text", nextBlock: "borders" | "motion") {
    const match = configSource.match(new RegExp(
        `\\b${name}:\\s*\\{([\\s\\S]*?)\\n\\s*\\},\\n\\s*${nextBlock}:`,
    ));
    assert.ok(match, `expected the ${name} token block`);
    return match[1];
}

const surfaceTokens = tokenBlock("surfaces", "borders");
const textTokens = tokenBlock("text", "motion");

function hexToken(name: "canvas" | "light" | "subtle" | "accentStrong") {
    const source = name === "canvas" || name === "light" ? surfaceTokens : textTokens;
    const match = source.match(new RegExp(`\\b${name}:\\s*"(#[0-9A-F]{6})"`, "i"));
    assert.ok(match, `expected ${name} to be an explicit hex token`);
    return match[1];
}

function relativeLuminance(hex: string) {
    const channels = hex
        .slice(1)
        .match(/.{2}/g)!
        .map((value) => Number.parseInt(value, 16) / 255)
        .map((value) => value <= 0.04045
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4);

    return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
}

function contrastRatio(foreground: string, background: string) {
    const foregroundLuminance = relativeLuminance(foreground);
    const backgroundLuminance = relativeLuminance(background);
    const lighter = Math.max(foregroundLuminance, backgroundLuminance);
    const darker = Math.min(foregroundLuminance, backgroundLuminance);
    return (lighter + 0.05) / (darker + 0.05);
}

test("iSystem muted public text meets AA on canvas and paper", () => {
    const subtle = hexToken("subtle");

    assert.ok(contrastRatio(subtle, hexToken("canvas")) >= 4.5);
    assert.ok(contrastRatio(subtle, hexToken("light")) >= 4.5);
});

test("iSystem textual accents meet AA on canvas and paper", () => {
    const accentStrong = hexToken("accentStrong");

    assert.ok(contrastRatio(accentStrong, hexToken("canvas")) >= 4.5);
    assert.ok(contrastRatio(accentStrong, hexToken("light")) >= 4.5);
});
