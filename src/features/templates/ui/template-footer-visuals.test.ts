import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
    resolveFooterLogoUrl,
    resolveNavbarLogoUrl,
} from "./template-footer-visuals";

const globalsCss = readFileSync(
    new URL("../../../app/globals.css", import.meta.url),
    "utf8",
);

test("iSystem footer uses the light-on-dark logo when the configured asset is empty", () => {
    assert.equal(
        resolveFooterLogoUrl({
            templateId: "isystem-agency",
            footerLogoUrl: "",
            navbarLogoUrl: "",
        }),
        "/isystem-assets/isystem-logo-dark.png",
    );
});

test("iSystem footer replaces the known dark-on-light artwork on its navy surface", () => {
    assert.equal(
        resolveFooterLogoUrl({
            templateId: "isystem-agency",
            footerLogoUrl: "https://isystem.ai/isystem-assets/isystem-logo-light.png",
            navbarLogoUrl: "",
        }),
        "/isystem-assets/isystem-logo-dark.png",
    );
});

test("footer logo resolution preserves explicit assets for other templates", () => {
    assert.equal(
        resolveFooterLogoUrl({
            templateId: "facility-services",
            footerLogoUrl: "/themes/facility-services/logo.svg",
            navbarLogoUrl: "/themes/facility-services/logo.svg",
        }),
        "/themes/facility-services/logo.svg",
    );
});

test("iSystem navbar replaces the known white artwork on its light surface", () => {
    assert.equal(
        resolveNavbarLogoUrl({
            templateId: "isystem-agency",
            navbarLogoUrl: "https://isystem.ai/isystem-assets/isystem-logo-dark.png",
            isLightSurface: true,
        }),
        "/isystem-assets/isystem-logo-light.png",
    );
});

test("iSystem navbar supplies dark artwork when no light-surface logo is configured", () => {
    assert.equal(
        resolveNavbarLogoUrl({
            templateId: "isystem-agency",
            navbarLogoUrl: "",
            isLightSurface: true,
        }),
        "/isystem-assets/isystem-logo-light.png",
    );
});

test("navbar logo resolution preserves custom artwork", () => {
    assert.equal(
        resolveNavbarLogoUrl({
            templateId: "isystem-agency",
            navbarLogoUrl: "/brand/custom-navigation-mark.svg",
            isLightSurface: true,
        }),
        "/brand/custom-navigation-mark.svg",
    );
});

test("iSystem heading typography inherits the active surface color", () => {
    const headingRule = globalsCss.match(
        /\[data-template-id="isystem-agency"\] h1,[\s\S]*?\{([^}]+)\}/,
    );

    assert.ok(headingRule, "expected the shared iSystem heading rule");
    assert.doesNotMatch(
        headingRule[1],
        /\bcolor\s*:/,
        "the shared heading rule must not override dark-surface foreground colors",
    );
});

test("iSystem footer titles have an explicit inverse-color contract", () => {
    assert.match(
        globalsCss,
        /\[data-template-id="isystem-agency"\] \.isystem-public-footer h4\s*\{[^}]*color:\s*var\(--template-text-inverse\)/s,
    );
});
