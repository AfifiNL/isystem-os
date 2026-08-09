import assert from "node:assert/strict";
import test from "node:test";

import { clientConfigSchema, MODULE_KEYS } from "./schema";

const dashboardModuleKeys = [
    "admin-workspaces",
    "analytics",
    "automations",
    "booking",
    "builder",
    "case-snippets",
    "clients",
    "commercial-ops",
    "content",
    "creative-studio",
    "customers",
    "external-publishing",
    "generate",
    "health",
    "inbox",
    "integrations",
    "legal-vault",
    "legibility-hub",
    "manual-posts",
    "market-monitor",
    "music-library",
    "newsletter",
    "opportunities",
    "outreach",
    "podcast",
    "popups",
    "render-queue",
    "seo",
    "settings",
    "slas",
    "source-intelligence",
    "videos",
    "voices",
    "work",
] as const;

function validConfig() {
    return {
        slug: "example-client",
        displayName: "Example Client",
        template: "saas-product",
        tier: "pro",
        defaultLocale: "nl",
        supportedLocales: ["en", "nl"],
        brand: {
            palette: {
                primary: "#102030",
                accent: "#506070",
            },
            typography: {
                display: "Inter, sans-serif",
                body: "Inter, sans-serif",
            },
            logo: {
                lightUrl: "/clients/example-client/logo.svg",
                alt: "Example Client",
            },
        },
        site: {
            name: "Example Client",
            description: "A complete client configuration contract.",
            domain: "example-client.nl",
            contactEmail: "hello@example-client.nl",
            legal: {},
        },
        modules: Object.fromEntries(dashboardModuleKeys.map((key) => [key, true])),
        seedOverlays: [],
        workspaceSeed: {
            ownerEmail: "owner@example-client.nl",
            defaultPages: ["about", "services", "contact"],
        },
        socials: {},
    };
}

test("client config exposes every dashboard module as a typed switch", () => {
    assert.deepEqual([...MODULE_KEYS].sort(), [...dashboardModuleKeys].sort());
    assert.equal(clientConfigSchema.safeParse(validConfig()).success, true);
});

test("defaultLocale must be included in supportedLocales", () => {
    const config = validConfig();
    config.supportedLocales = ["en"];

    const result = clientConfigSchema.safeParse(config);

    assert.equal(result.success, false);
    if (!result.success) {
        assert.equal(
            result.error.issues.some((issue) => issue.path.join(".") === "supportedLocales"),
            true,
        );
    }
});

test("client config requires an explicit public contact address", () => {
    const config = validConfig();
    delete (config.site as Partial<typeof config.site>).contactEmail;

    const result = clientConfigSchema.safeParse(config);

    assert.equal(result.success, false);
    if (!result.success) {
        assert.equal(
            result.error.issues.some((issue) => issue.path.join(".") === "site.contactEmail"),
            true,
        );
    }
});
