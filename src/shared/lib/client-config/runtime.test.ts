import assert from "node:assert/strict";
import test from "node:test";

import { getTemplateById } from "@/features/templates/registry";
import {
    applyPublicBrandToSiteChrome,
    applyPublicBrandToTemplate,
    extractPublicRuntimeConfig,
} from "./runtime";
import { buildDefaultSiteChrome } from "@/features/site-chrome/schema";

const brand = {
    palette: { primary: "#102030", accent: "#506070", background: "#fefefe" },
    typography: { display: "Display Sans", body: "Body Sans" },
    logo: { lightUrl: "/clients/acme/light.svg", darkUrl: "/clients/acme/dark.svg", alt: "Acme" },
};

test("runtime config is read only from validated public metadata", () => {
    assert.deepEqual(extractPublicRuntimeConfig({ public_config: {
        brand,
        modules: { booking: false },
        supportedLocales: ["en", "ar"],
    } }), { brand, modules: { booking: false }, supportedLocales: ["en", "ar"] });
    assert.deepEqual(extractPublicRuntimeConfig({ public_config: { supportedLocales: ["xx"] } }), {});
});

test("brand overlay changes template tokens and chrome identity without mutating defaults", () => {
    const template = getTemplateById("saas-product");
    const chrome = buildDefaultSiteChrome(template, "Old Brand");
    const themed = applyPublicBrandToTemplate(template, brand);
    const brandedChrome = applyPublicBrandToSiteChrome(chrome, "Acme Systems", brand);

    assert.equal(themed.colors.primary, "#102030");
    assert.equal(themed.fonts.heading, "Display Sans");
    assert.equal(themed.designTokens?.surfaces.canvas, "#fefefe");
    assert.notEqual(template.colors.primary, themed.colors.primary);
    assert.equal(brandedChrome.brand.name.en, "Acme Systems");
    assert.equal(brandedChrome.brand.footerLogoUrl, "/clients/acme/dark.svg");
});
