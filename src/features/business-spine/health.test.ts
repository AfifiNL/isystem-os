import test from "node:test";
import assert from "node:assert/strict";
import {
    aggregateBusinessIntegrationStatuses,
    BUSINESS_INTEGRATION_SURFACES,
    deriveBusinessIntegrationStatusFromConfig,
    evaluateBusinessIntegrationConfig,
    type BusinessIntegrationSurface,
} from "@/features/business-spine/health";

const surface: BusinessIntegrationSurface = {
    provider: "example",
    integrationKey: "api",
    label: "Example",
    purpose: "Test surface",
    owner: "Platform",
    href: "/dashboard/integrations",
    category: "provider",
    requiredEnv: ["EXAMPLE_API_KEY"],
    anyRequiredEnv: [["EXAMPLE_WEBHOOK_SECRET", "CRON_SECRET"]],
};

test("integration status rollup gives failures and degradation precedence", () => {
    assert.equal(aggregateBusinessIntegrationStatuses(["healthy", "degraded", "unknown"]).status, "degraded");
    assert.equal(aggregateBusinessIntegrationStatuses(["healthy", "failing", "degraded"]).status, "failing");
});

test("integration status rollup treats unknown as pending evidence", () => {
    assert.equal(aggregateBusinessIntegrationStatuses(["healthy", "unknown"]).status, "unknown");
    assert.equal(aggregateBusinessIntegrationStatuses(["healthy", "healthy", "disabled"]).status, "healthy");
    assert.equal(aggregateBusinessIntegrationStatuses(["disabled", "disabled"]).status, "disabled");
});

test("integration config evaluation reports missing required env groups", () => {
    const evaluation = evaluateBusinessIntegrationConfig(surface, {
        EXAMPLE_API_KEY: "set",
    } as unknown as NodeJS.ProcessEnv);

    assert.equal(evaluation.status, "action_required");
    assert.deepEqual(evaluation.missingEnv, ["EXAMPLE_WEBHOOK_SECRET or CRON_SECRET"]);
    assert.equal(deriveBusinessIntegrationStatusFromConfig(evaluation), "degraded");
});

test("optional integration config becomes disabled when missing", () => {
    const evaluation = evaluateBusinessIntegrationConfig({ ...surface, optional: true }, {} as unknown as NodeJS.ProcessEnv);

    assert.equal(evaluation.status, "disabled");
    assert.equal(deriveBusinessIntegrationStatusFromConfig(evaluation), "disabled");
});

test("Vertex AI health config accepts base64 service-account credentials", () => {
    const vertex = BUSINESS_INTEGRATION_SURFACES.find((item) => item.provider === "vertex-ai" && item.integrationKey === "primary-llm");
    assert.ok(vertex);

    const evaluation = evaluateBusinessIntegrationConfig(vertex, {
        AI_PROVIDER: "vertex",
        GOOGLE_CLOUD_PROJECT: "isystem-prod",
        GOOGLE_CLOUD_LOCATION: "europe-west4",
        GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64: Buffer.from(
            JSON.stringify({ type: "service_account" }),
            "utf8",
        ).toString("base64"),
    } as unknown as NodeJS.ProcessEnv);

    assert.equal(evaluation.status, "configured");
    assert.deepEqual(evaluation.missingEnv, []);
});

test("registers self-hosted and E2E worker evidence surfaces", () => {
    const keys = new Set(BUSINESS_INTEGRATION_SURFACES.map((item) => `${item.provider}/${item.integrationKey}`));
    for (const key of [
        "self-hosted-supabase/db-restore",
        "self-hosted-supabase/extensions-rls",
        "self-hosted-supabase/storage",
        "self-hosted-supabase/backups",
        "seo/internal-links-worker",
        "source-intelligence/worker",
        "content-translation/worker",
        "outreach/discovery-worker",
        "outreach/dispatch-worker",
        "cron/newsletter-dispatch",
        "cron/source-intelligence-run",
        "cron/outreach-dispatch",
        "cron/gsc-sync",
        "cron/seo-indexing-drain",
        "cron/voice-memo-processing",
        "cron/market-monitor-run",
        "cron/booking-payment-followups",
        "cron/stale-content-scanner",
        "workflow/worker",
    ]) {
        assert.equal(keys.has(key), true, `${key} should be registered`);
    }
});

test("Creative Studio health distinguishes API Auto from MCP Manual Mode without automation claims", () => {
    const apiAuto = BUSINESS_INTEGRATION_SURFACES.find((item) => item.provider === "higgsfield" && item.integrationKey === "creative-render");
    const mcpManual = BUSINESS_INTEGRATION_SURFACES.find((item) => item.provider === "higgsfield-mcp" && item.integrationKey === "manual-fulfillment");

    assert.ok(apiAuto);
    assert.equal(apiAuto.label, "Higgsfield API Auto");
    assert.match(apiAuto.purpose, /Configuration-only health surface/);
    assert.match(apiAuto.purpose, /no Higgsfield or MCP network calls/i);

    assert.ok(mcpManual);
    assert.equal(mcpManual.label, "Higgsfield MCP Manual Mode");
    assert.match(mcpManual.purpose, /Operator-managed/);
    assert.match(mcpManual.purpose, /no backend automation/i);
    assert.match(mcpManual.purpose, /credential storage/i);

    const disabledApiAuto = evaluateBusinessIntegrationConfig(apiAuto, {} as unknown as NodeJS.ProcessEnv);
    assert.equal(disabledApiAuto.status, "disabled");

    const manualStatus = evaluateBusinessIntegrationConfig(mcpManual, {} as unknown as NodeJS.ProcessEnv);
    assert.equal(manualStatus.status, "configured");
});
