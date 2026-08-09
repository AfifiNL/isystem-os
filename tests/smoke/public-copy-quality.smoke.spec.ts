import { expect, test } from "@playwright/test";

const remediatedPosts = [
    {
        path: "/blog/ai-systems-for-real-estate-management",
        heading: "AI Systems for Real Estate Management",
    },
    {
        path: "/blog/system-that-learns-your-business",
        heading: "A System That Learns Your Business",
    },
    {
        path: "/blog/smes-systems-and-processes",
        heading: "SME Systems and Processes: From Advice to Repeatable Operations",
    },
] as const;

const implementationLeakPattern = /Tavily|millicents?|reason codes?|client_portal_users|getPartnerPortalAccess|content_published|contact_subscribed|Supabase|Svix|FFmpeg|\bRLS\b|\[AWAITING NATIVE REVIEW|no_primary_or_near_primary_numeric_claim_available|\[object Object]/i;
const auditedBlogLeakPattern = /Example Client|Artic Sledge|TeraWulf|absolute data security|complete compliance|These agents do your company guidelines|moving past brittle and building/i;

test.describe("public copy quality boundaries", () => {
    test.beforeEach(async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
        await page.route("**/api/analytics/track", async (route) => {
            await route.fulfill({
                status: 204,
                contentType: "application/json",
                body: "{}",
            });
        });
    });

    for (const post of remediatedPosts) {
        test(`publishes reviewed copy for ${post.path}`, async ({ page }) => {
            await page.goto(post.path, { waitUntil: "domcontentloaded" });
            await expect(page.getByRole("heading", { level: 1, name: post.heading })).toBeVisible();

            const mainText = await page.locator("main").innerText();
            expect(mainText).not.toMatch(auditedBlogLeakPattern);
            expect(mainText).not.toMatch(implementationLeakPattern);
            expect(mainText).not.toMatch(/\bverified sources?\b/i);

            const integratedVisuals = page.locator("main article [data-blog-visual-block]");
            await expect(integratedVisuals).toHaveCount(2);
            const visualText = (await integratedVisuals.allTextContents()).join("\n");
            expect(visualText).not.toMatch(auditedBlogLeakPattern);
            expect(visualText).not.toMatch(implementationLeakPattern);
        });
    }

    test("keeps newsletter cadence consistent", async ({ page }) => {
        await page.goto("/newsletter", { waitUntil: "domcontentloaded" });
        const mainText = await page.locator("main").innerText();

        expect(mainText).toMatch(/Twice a month/i);
        expect(mainText).toMatch(/Two short emails per month/i);
        expect(mainText).not.toMatch(/One short email per week/i);
    });

    for (const path of [
        "/ai-media-operations",
        "/client-sla-operations",
        "/governance",
        "/media-agency-digital-systems",
        "/seo-growth-ops",
    ] as const) {
        test(`does not expose implementation copy on ${path}`, async ({ page }) => {
            await page.goto(path, { waitUntil: "domcontentloaded" });
            await expect(page.locator("main")).toBeVisible();
            await expect(page.locator("main")).not.toContainText(implementationLeakPattern);
        });
    }

    test("keeps malformed and retired URLs out of the sitemap", async ({ request }) => {
        const response = await request.get("/sitemap.xml");
        expect(response.ok()).toBe(true);
        const xml = await response.text();
        const locations = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), (match) => match[1]);

        expect(locations.length).toBeGreaterThan(0);
        expect(locations.some((location) => new URL(location).pathname.includes("//"))).toBe(false);
        expect(locations.some((location) => new URL(location).pathname.includes("/basic-vs-pro"))).toBe(false);
    });
});
