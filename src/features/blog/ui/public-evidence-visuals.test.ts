import assert from "node:assert/strict";
import test from "node:test";

import { getPublicEvidenceSurfaceClasses } from "./public-evidence-visuals";

test("light evidence UI uses semantic public surfaces and readable foregrounds", () => {
    const classes = getPublicEvidenceSurfaceClasses("light");
    const combined = Object.values(classes).flat().join(" ");

    assert.match(classes.drawer, /template-surface-inverse-raised/);
    assert.match(classes.source, /template-surface-soft/);
    assert.match(classes.title, /template-text-inverse/);
    assert.doesNotMatch(combined, /text-white|text-slate-|text-cyan-300/);
});

test("dark evidence UI preserves its inverse-surface treatment", () => {
    const classes = getPublicEvidenceSurfaceClasses("dark");

    assert.match(classes.drawer, /border-white\/10/);
    assert.match(classes.title, /text-white/);
});
