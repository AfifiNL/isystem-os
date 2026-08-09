import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import starterConfig from "../isystem.config";
import { buildOutreachUnsubscribeUrl } from "../src/features/outreach/compliance";
import { resolveIndexingSiteUrl } from "../src/features/seo/indexing/site-url";
import { tavilyCountryForLocale } from "../src/shared/lib/ai/tavily";
import { resolveWorkspaceBrandLogoDataUri } from "../src/shared/lib/client-config/media-branding";

function source(path: string): string {
    return readFileSync(resolve(process.cwd(), path), "utf8");
}

function assertOmits(path: string, forbidden: readonly RegExp[]): void {
    const text = source(path);
    for (const pattern of forbidden) {
        assert.doesNotMatch(text, pattern, `${path} must not contain ${pattern}`);
    }
}

test("AI discovery is derived from runtime identity", () => {
    assertOmits("src/features/ai-discovery/agent-index.ts", [
        /https:\/\/isystem\.ai/i,
        /Published iSystem\.ai/i,
        /About Hossam Afifi/i,
        /getIsystemCommercialSummary/,
        /ISYSTEM_PUBLIC_POSITIONING/,
    ]);
    const text = source("src/features/ai-discovery/agent-index.ts");
    assert.match(text, /filter\(\(page\) => publicToolsEnabled \|\| page\.path !== ["']\/tools["']\)/);
    assert.match(text, /\.\.\.\(index\.tools\.length \? \{\s*tools_hub:/s);
});

test("generic SEO and outbound routing do not fail open to the reference brand", () => {
    assertOmits("src/features/seo/indexing/service.ts", [/https:\/\/isystem\.ai/i]);
    assertOmits("src/app/api/seo/google-search-console/sync/route.ts", [/\|\|\s*['"]isystem-ai['"]/]);
    assertOmits("src/features/outreach/compliance.ts", [/https:\/\/isystem\.ai/i]);
});

test("indexing and unsubscribe links fail closed without an explicit public site URL", () => {
    assert.throws(
        () => resolveIndexingSiteUrl({}),
        /site_url.*required/i,
    );
    assert.throws(
        () => resolveIndexingSiteUrl({ NEXT_PUBLIC_SITE_URL: "file:///tmp/public" }),
        /http or https/i,
    );
    assert.equal(
        resolveIndexingSiteUrl({ GOOGLE_SEARCH_CONSOLE_SITE_URL: "sc-domain:client.example" }),
        "https://client.example",
    );

    const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    try {
        delete process.env.NEXT_PUBLIC_SITE_URL;
        assert.throws(
            () => buildOutreachUnsubscribeUrl("message-1", "token-1"),
            /site_url.*required/i,
        );
        process.env.NEXT_PUBLIC_SITE_URL = "https://client.example/";
        assert.equal(
            buildOutreachUnsubscribeUrl("message-1", "token-1"),
            "https://client.example/outreach/unsubscribe?message=message-1&token=token-1",
        );
    } finally {
        if (previousSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
        else process.env.NEXT_PUBLIC_SITE_URL = previousSiteUrl;
    }
});

test("generic content generation and repair contain no reference-brand policy", () => {
    for (const path of [
        "src/features/seo/blog-regeneration-actions.ts",
        "src/features/content-engine/lib/editorial-repair.ts",
        "src/features/seo/lib/blog-enhancement-remediation.ts",
        "src/app/api/generate-draft/route.ts",
        "src/features/seo/content-mutation.ts",
    ]) {
        assertOmits(path, [/siteHost:\s*["']isystem\.ai["']/i, /Hossam\/iSystem author frameworks/i, /iSystem platform copy context/i]);
    }
    assertOmits("src/features/seo/lib/platform-copy-context.ts", [/docs\/isystem\//i]);
    assertOmits("src/features/content-engine/ui/blog-visual-block.tsx", [/iSystem\.ai source/i]);
});

test("generic outreach and publishing use workspace-neutral attribution", () => {
    assertOmits("src/features/outreach/service.ts", [/Best,\\nHossam/i, /iSystem helps/i]);
    for (const path of [
        "src/features/external-publishing/platform-adapters/linkedin.ts",
        "src/features/external-publishing/platform-adapters/medium.ts",
        "src/features/external-publishing/platform-adapters/reddit.ts",
    ]) {
        assertOmits(path, [/iSystem/i]);
    }
    assertOmits("src/app/api/external-publishing/auto-generate/route.ts", [/utmSource:\s*["']isystem["']/i]);
});

test("generated media does not load a global reference-brand logo", () => {
    assertOmits("src/app/api/generate-assets/overlay.ts", [/public["'],\s*["']isystem-assets/i]);
    assertOmits("src/app/api/generate-podcast-episode/overlay.ts", [/public["'],\s*["']isystem-assets/i]);
});

test("generated media resolves only a validated workspace logo below public", async () => {
    const metadata = { public_config: { brand: starterConfig.brand } };
    const logo = await resolveWorkspaceBrandLogoDataUri(metadata);
    assert.match(logo ?? "", /^data:image\/svg\+xml;base64,/);

    const escapingBrand = {
        ...starterConfig.brand,
        logo: { ...starterConfig.brand.logo, lightUrl: "/../../etc/passwd" },
    };
    assert.equal(
        await resolveWorkspaceBrandLogoDataUri({ public_config: { brand: escapingBrand } }),
        null,
    );
});

test("generic publishable presets contain no reference-brand identity", () => {
    for (const path of [
        "src/features/builder/extended-blocks.tsx",
        "src/features/builder/legal-vault-blocks.tsx",
        "src/features/builder/facility-services-page-data.ts",
        "src/features/popups/schema.ts",
        "src/features/booking/types.ts",
    ]) {
        assertOmits(path, [/iSystem\.ai/i, /Hossam Afifi/i, /with Hossam/i]);
    }
    assertOmits("src/features/builder/puck.config.tsx", [/iSystem signal/i]);
    assertOmits("src/features/templates/configs/personal-brand.ts", [/Hossam Afifi/i, /hossamafifi/i]);
    assertOmits("src/features/templates/ui/theme-renderers/personal-brand-about.tsx", [/Hossam Afifi/i]);
    assertOmits("src/features/marketing/ui/footer.tsx", [/Hossam Afifi/i, /hossamafifi/i]);
});

test("generic public surfaces use configured or neutral identity", () => {
    assertOmits("src/app/(public)/audit/page.tsx", [/iSystem consolidation/i]);
    assertOmits("src/features/audit/audit-page-client.tsx", [/iSystem\.ai/i, /iSystem consolidation/i]);
    assertOmits("src/features/video-stream/public-seo.ts", [/iSystem workspace walkthrough/i]);
});

test("generic admin, portal, and legal surfaces contain no reference-brand identity", () => {
    assertOmits("src/features/admin/ui/sidebar.tsx", [/isystem-assets/i, /alt=["']isystem\.ai/i]);
    assertOmits("src/features/portal/actions/auth.ts", [/iSystem\.ai administrator/i]);
    assertOmits("src/features/legal-vault/actions/signatures.ts", [/via iSystem/i]);
    assertOmits("src/features/legal-vault/ui/public-nl-zzp-generator.tsx", [/iSystem(?:\.ai)?/i]);
    assertOmits("src/features/admin/lib/dashboard-state.ts", [/premium iSystem pages/i]);
    for (const locale of ["en", "nl", "ar"]) {
        const text = source(`src/shared/lib/i18n/dictionaries/${locale}.ts`).split(/(?:export const|const)\s+isystemAgency/i, 1)[0];
        assert.doesNotMatch(text, /premium iSystem/i);
    }
});

test("generic fetchers and operator messages use neutral product language", () => {
    assertOmits("src/features/source-intelligence/ingestion.ts", [/iSystem Source Intelligence Bot/i, /https:\/\/isystem\.ai/i]);
    assertOmits("src/features/outreach/discovery/scrapling-client.ts", [/isystem-outreach-discovery/i]);
    const legacyValidatorIdentity = new RegExp(
        ["hossam", "platform", "seo", "validator"].join("-"),
        "i",
    );
    assertOmits("src/features/seo/lib/url-safety.ts", [legacyValidatorIdentity]);
    assertOmits("src/features/creative-studio/strategy.ts", [/iSystem Creative Studio/i]);
    assertOmits("src/features/legibility-hub/actions.ts", [/iSystem (?:Legibility Hub|Central Semantic)/i]);
    assert.equal(tavilyCountryForLocale("ar"), undefined);
    assert.equal(tavilyCountryForLocale("nl"), "netherlands");
});

test("official public tools cannot be enabled for another template by environment flag", async () => {
    const { isPublicToolsBrandReady } = await import("../src/features/tools/shared/availability");
    assert.equal(isPublicToolsBrandReady("isystem-agency", "false"), true);
    assert.equal(isPublicToolsBrandReady("saas-product", "true"), false);
});
