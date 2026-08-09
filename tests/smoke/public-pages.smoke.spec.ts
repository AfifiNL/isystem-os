import { expect, test } from "@playwright/test";

const routes = ["/", "/services", "/about", "/contact", "/blog", "/projects", "/newsletter", "/videos", "/booking", "/case-studies/legal-firm", "/system-proof"] as const;

test.describe("public page cross-browser smoke", () => {
    test.beforeEach(async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
        await page.addInitScript(() => {
            document.documentElement.dataset.playwrightVisual = "true";
            window.localStorage.setItem("theme", "light");
        });
        await page.route("**/api/analytics/track", async (route) => {
            await route.fulfill({
                status: 204,
                contentType: "application/json",
                body: "{}",
            });
        });
    });

    for (const route of routes) {
        test(`loads ${route}`, async ({ page }) => {
            await page.goto(route, { waitUntil: "domcontentloaded" });
            await expect(page.locator("main")).toBeVisible();
            await expect(page.getByRole("banner")).toBeVisible({ timeout: 15000 });
            await expect(page.getByRole("contentinfo")).toBeVisible({ timeout: 15000 });
        });
    }

    test("redirects the retired offer URL to services", async ({ page }) => {
        await page.goto("/basic-vs-pro", { waitUntil: "domcontentloaded" });
        await expect(page).toHaveURL(/\/services$/);
    });
});
