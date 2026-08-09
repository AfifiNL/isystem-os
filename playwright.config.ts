import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./tests",
    fullyParallel: true,
    retries: process.env.CI ? 2 : 0,
    reporter: [["html", { outputFolder: "playwright-report" }]],
    snapshotDir: "./tests/visual/snapshots",
    use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "retain-on-failure",
    },
    projects: [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
        { name: "firefox", use: { ...devices["Desktop Firefox"] } },
        { name: "webkit", use: { ...devices["Desktop Safari"] } },
    ],
    // A production URL is a supported verification target. In that mode the
    // suite must not start a local Next server or mask live failures with a
    // local build. Local runs retain the existing build/start web server.
    ...(process.env.PLAYWRIGHT_BASE_URL
        ? {}
        : {
            webServer: {
                command: process.env.PLAYWRIGHT_SKIP_BUILD
                    ? "PLAYWRIGHT_LOCAL_HTTP=1 npm run start:standalone"
                    : "PLAYWRIGHT_LOCAL_HTTP=1 npm run build && PLAYWRIGHT_LOCAL_HTTP=1 npm run start:standalone",
                url: "http://127.0.0.1:3000",
                reuseExistingServer: true,
                timeout: 240000,
            },
        }),
});
