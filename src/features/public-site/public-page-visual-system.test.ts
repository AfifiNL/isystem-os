import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rendererSource = readFileSync(
    new URL("./public-page-renderer.tsx", import.meta.url),
    "utf8",
);
const motionSource = readFileSync(
    new URL("./public-page-motion.tsx", import.meta.url),
    "utf8",
);
const globalsCss = readFileSync(
    new URL("../../app/globals.css", import.meta.url),
    "utf8",
);
const rootLayoutSource = readFileSync(
    new URL("../../app/layout.tsx", import.meta.url),
    "utf8",
);

test("iSystem public pages use the restrained display scale", () => {
    assert.match(rendererSource, /className="isystem-public-display/);
    assert.doesNotMatch(rendererSource, /6\.5rem/);
    assert.match(globalsCss, /\.isystem-public-display\s*\{[^}]*font-size:\s*clamp\(2\.75rem, 5vw, 4\.5rem\)/s);
    assert.ok((rendererSource.match(/isystem-public-title/g) ?? []).length >= 8);
});

test("dense service inventory uses disclosure rows and restrained mobile type", () => {
    assert.match(rendererSource, /isystem-public-service-capability/);
    assert.match(rendererSource, /compactHeroIds/);
    assert.match(rendererSource, /defaultCapabilityIds/);
    assert.match(globalsCss, /font-size:\s*clamp\(2\.4rem, 10\.5vw, 3rem\)/);
});

test("static process sections use premium connected and asymmetric compositions", () => {
    assert.match(rendererSource, /isystem-public-loop-panel/);
    assert.match(rendererSource, /isystem-public-loop-card/);
    assert.match(rendererSource, /isystem-public-method-phase/);
    assert.match(rendererSource, /isystem-public-scope-grid/);
    assert.match(globalsCss, /grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/);
    assert.match(globalsCss, /\.isystem-public-method-step:nth-child\(3\)[^{]*\{[^}]*margin-top:\s*3rem/s);
    assert.match(globalsCss, /@media \(max-width: 639px\)[\s\S]*\.isystem-public-loop-step:last-child[\s\S]*grid-template-columns:\s*2\.5rem minmax\(0, 1fr\)/);
});

test("system, capability, and offer views avoid generic equal-card grids", () => {
    assert.match(rendererSource, /isystem-public-system-network/);
    assert.match(rendererSource, /isystem-public-system-orbit/);
    assert.match(rendererSource, /isystem-public-capability-ledger/);
    assert.match(rendererSource, /isystem-public-offer-inclusions/);
    assert.match(globalsCss, /\.isystem-public-system-row\s*\{[^}]*grid-template-columns:\s*2\.5rem minmax\(0, 1\.1fr\) minmax\(12rem, 0\.9fr\) 1\.5rem/s);
    assert.match(globalsCss, /\.isystem-public-capability-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/s);
});

test("iSystem loads its configured display face instead of falling back to Inter", () => {
    assert.match(rootLayoutSource, /Instrument_Sans/);
    assert.match(rootLayoutSource, /--font-instrument-sans/);
    assert.match(globalsCss, /font-family:\s*var\(--public-font-display\)/);
});

test("published pages use scroll-driven motion with a reduced-motion escape hatch", () => {
    assert.match(rendererSource, /mode === "published" \? <PublicPageMotionController \/>/);
    assert.match(motionSource, /prefers-reduced-motion: no-preference/);
    assert.match(motionSource, /scrub:\s*0\.7/);
    assert.match(motionSource, /ScrollTrigger\.refresh\(\)/);
});
