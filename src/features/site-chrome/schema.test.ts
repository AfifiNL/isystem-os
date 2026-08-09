import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveSiteChromeConfig, validateSiteChromeConfig, type SiteChromeConfig } from "./schema";

const baseChrome: SiteChromeConfig = {
    brand: { name: { en: "iSystem", nl: "iSystem", ar: "آي سيستم" }, accentText: { en: ".ai", nl: ".ai", ar: ".ai" }, homeHref: "/" },
    navbar: {
        links: [{ href: "/services", label: { en: "Services", nl: "Diensten", ar: "الخدمات" } }],
        menus: [{ id: "services", href: "/services", label: { en: "Services", nl: "Diensten", ar: "الخدمات" }, items: [{ href: "/services#foundation", label: { en: "Foundation", nl: "Foundation", ar: "التأسيس" } }] }],
        cta: { enabled: true, href: "/booking", label: { en: "Book", nl: "Boeken", ar: "احجز" } },
        mobileCta: { enabled: true, href: "/booking", label: { en: "Book", nl: "Boeken", ar: "احجز" } },
    },
    footer: {
        description: { en: "Description", nl: "Beschrijving", ar: "وصف" },
        groups: [{ title: { en: "Legal", nl: "Juridisch", ar: "قانوني" }, links: [{ href: "/privacy", label: { en: "Privacy", nl: "Privacy", ar: "الخصوصية" } }] }],
        socialLinks: [],
        cta: { title: { en: "Start", nl: "Start", ar: "ابدأ" }, description: { en: "Description", nl: "Beschrijving", ar: "وصف" }, label: { en: "Book", nl: "Boeken", ar: "احجز" }, href: "/booking" },
        legalLinks: [{ href: "/terms", label: { en: "Terms", nl: "Voorwaarden", ar: "الشروط" } }],
        copyright: { en: "Copyright", nl: "Copyright", ar: "حقوق النشر" },
    },
};

describe("site chrome contract", () => {
    it("reports unsafe, duplicate, and missing-locale links", () => {
        const diagnostics = validateSiteChromeConfig({
            ...baseChrome,
            navbar: {
                ...baseChrome.navbar,
                links: [
                    { href: "javascript:alert(1)", label: { en: "Unsafe" } },
                    { href: "/services", label: { en: "Services" } },
                    { href: "/services", label: { en: "Services again" } },
                ],
            },
        });

        assert.equal(diagnostics.some((diagnostic) => diagnostic.code === "unsafe_url"), true);
        assert.equal(diagnostics.some((diagnostic) => diagnostic.code === "duplicate_link"), true);
        assert.equal(diagnostics.some((diagnostic) => diagnostic.code === "missing_locale_label"), true);
    });

    it("rewrites the legacy offer URL before public chrome is resolved", () => {
        const resolved = resolveSiteChromeConfig({
            ...baseChrome,
            navbar: { ...baseChrome.navbar, links: [{ href: "/basic-vs-pro", label: { en: "Offers" } }] },
        }, baseChrome);

        assert.equal(resolved.navbar.links[0]?.href, "/services");
    });

    it("allows a top-level link to be repeated inside its own menu", () => {
        const diagnostics = validateSiteChromeConfig({
            ...baseChrome,
            navbar: {
                ...baseChrome.navbar,
                menus: [{
                    ...baseChrome.navbar.menus![0],
                    items: [{ href: "/services", label: { en: "Services", nl: "Diensten", ar: "الخدمات" } }],
                }],
            },
        });

        assert.equal(diagnostics.some((diagnostic) => diagnostic.code === "duplicate_link"), false);
    });
});
