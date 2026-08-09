import assert from "node:assert/strict";
import test from "node:test";
import { marketMonitorResultToSignal } from "./market-monitor-detector";

test("normalizes a Market Monitor row into a provenance-rich opportunity signal", () => {
    const signal = marketMonitorResultToSignal({
        id: "result-1",
        workspace_id: "workspace-1",
        config_id: "config-1",
        url: "https://competitor.example/pricing",
        canonical_url: "https://competitor.example/pricing",
        title: "Competitor launches a new pricing tier",
        snippet: "A lower-cost plan is now available.",
        change_type: "pricing_signal",
        trust_tier: 4,
        published_date: "2026-07-23",
        detected_at: "2026-07-24T08:00:00.000Z",
        read: false,
        archived: false,
        archived_at: null,
    });

    assert.equal(signal.category, "market");
    assert.equal(signal.signalKey, "market_monitor:result-1");
    assert.equal(signal.severity, "high");
    assert.equal(signal.signalData.marketMonitorResultId, "result-1");
    assert.equal(signal.signalData.sourceUrl, "https://competitor.example/pricing");
    assert.equal(signal.signalData.bridgeVersion, 1);
});
