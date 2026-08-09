import type { ClientConfig } from "./src/shared/lib/client-config/schema";

/**
 * Safe starter identity for a fresh iSystem OS installation.
 *
 * This config deliberately uses IANA-reserved example.invalid addresses. Edit
 * it before provisioning a real workspace. Secrets belong in `.env.local`,
 * never in this file.
 */
const config: ClientConfig = {
    slug: "starter-workspace",
    displayName: "Starter Workspace",
    template: "saas-product",
    tier: "basic",
    defaultLocale: "en",
    supportedLocales: ["en"],
    brand: {
        palette: {
            primary: "#3157d5",
            primaryForeground: "#ffffff",
            accent: "#d97706",
            accentForeground: "#ffffff",
            background: "#ffffff",
            foreground: "#172033",
        },
        typography: {
            display: "Inter, sans-serif",
            body: "Inter, sans-serif",
        },
        logo: {
            lightUrl: "/file.svg",
            alt: "Starter Workspace logo",
        },
    },
    site: {
        name: "Starter Workspace",
        description: "A neutral starter workspace ready for your brand, content, and operations.",
        domain: "workspace.example.invalid",
        contactEmail: "hello@example.invalid",
        legal: {},
    },
    modules: {
        content: true,
        builder: true,
        "manual-posts": true,
        settings: true,
        analytics: true,
        health: true,
        inbox: true,
        clients: true,
        customers: true,
        work: true,
        "legal-vault": true,
    },
    seedOverlays: [],
    workspaceSeed: {
        ownerEmail: "owner@example.invalid",
        ownerName: "Workspace Owner",
        defaultPages: ["about", "services", "contact"],
    },
    socials: {},
};

export default config;
