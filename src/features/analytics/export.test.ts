import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    formatAnalyticsExportCsv,
    mapAnalyticsEventsToExportRows,
    parseAnalyticsExportMode,
} from "./export";

describe("analytics export formatting", () => {
    const rows = [
        {
            created_at: "2026-06-05T10:00:00.000Z",
            event_type: "newsletter_subscribe",
            event_name: "newsletter_subscribe",
            path: "/newsletter",
            page_slug: "newsletter",
            utm_source: "linkedin",
            utm_medium: "social",
            utm_campaign: "launch",
            referrer: "https://www.linkedin.com/feed/",
            metadata: { email: "lead@example.com", contactId: "contact-1", source: "public_form" },
        },
        {
            created_at: "2026-06-05T11:00:00.000Z",
            event_type: "cta_click",
            event_name: "hero_cta",
            path: "/",
            page_slug: "home",
            utm_source: null,
            utm_medium: null,
            utm_campaign: null,
            referrer: null,
            metadata: { label: "Book call" },
        },
    ];

    it("parses supported modes with summary as the safe default", () => {
        assert.equal(parseAnalyticsExportMode("raw"), "raw");
        assert.equal(parseAnalyticsExportMode("conversions"), "conversions");
        assert.equal(parseAnalyticsExportMode("unknown"), "summary");
    });

    it("exports conversion rows with sanitized metadata only", () => {
        const exportRows = mapAnalyticsEventsToExportRows(rows, "conversions");
        const csv = formatAnalyticsExportCsv(exportRows);

        assert.equal(exportRows.length, 1);
        assert.equal(exportRows[0]?.referrer_domain, "linkedin.com");
        assert.match(exportRows[0]?.metadata_email_hash ?? "", /^[a-f0-9]{64}$/);
        assert.equal(csv.includes("lead@example.com"), false);
        assert.equal(csv.includes("metadata_email_hash"), true);
    });
});
