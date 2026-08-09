import assert from "node:assert/strict";
import test from "node:test";

import { buildWorkspaceSettingsSeed } from "./provisioning";

test("workspace settings are provisioned from client identity without platform defaults", () => {
    const payload = buildWorkspaceSettingsSeed(
        {
            slug: "acme",
            displayName: "Acme",
            template: "saas-product",
            tier: "pro",
            defaultLocale: "nl",
            supportedLocales: ["en", "nl"],
            brand: {
                palette: { primary: "#102030", accent: "#506070" },
                typography: { display: "Inter", body: "Inter" },
                logo: { lightUrl: "/clients/acme/logo.svg", alt: "Acme" },
            },
            site: {
                name: "Acme Systems",
                description: "Acme's public site.",
                domain: "acme.example",
                contactEmail: "hello@acme.example",
                contactPhone: "+31 20 000 0000",
                legal: {},
            },
            modules: {},
            seedOverlays: [],
            workspaceSeed: {
                ownerEmail: "owner@acme.example",
                defaultPages: [],
            },
            socials: {},
        },
        "workspace-id",
    );

    assert.deepEqual(payload, {
        workspace_id: "workspace-id",
        site_name: "Acme Systems",
        site_description: "Acme's public site.",
        site_domain: "acme.example",
        contact_email: "hello@acme.example",
        contact_phone: "+31 20 000 0000",
        locale_override: "nl",
        template_override: "saas-product",
        metadata: {
            public_config: {
                brand: {
                    palette: { primary: "#102030", accent: "#506070" },
                    typography: { display: "Inter", body: "Inter" },
                    logo: { lightUrl: "/clients/acme/logo.svg", alt: "Acme" },
                },
                modules: {},
                supportedLocales: ["en", "nl"],
            },
        },
    });
});
