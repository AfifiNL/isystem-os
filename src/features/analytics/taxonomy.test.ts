import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    deriveAnalyticsContentType,
    derivePageSlug,
    isAnalyticsEngagementEvent,
    isAnalyticsPublicTrackEvent,
    isTrueConversionEvent,
} from "./taxonomy";

describe("analytics taxonomy helpers", () => {
    it("derives canonical route-aware slugs across public and localized paths", () => {
        assert.equal(derivePageSlug("/"), "home");
        assert.equal(derivePageSlug("/nl"), "home");
        assert.equal(derivePageSlug("/blog/ai-systems"), "ai-systems");
        assert.equal(derivePageSlug("/ar/blog/ai-systems"), "ai-systems");
        assert.equal(derivePageSlug("/tools/automation-roi-calculator"), "tools/automation-roi-calculator");
        assert.equal(derivePageSlug("/booking"), "booking");
        assert.equal(derivePageSlug("/newsletter"), "newsletter");
        assert.equal(derivePageSlug("/podcast/show/episode"), "podcast/show/episode");
        assert.equal(derivePageSlug("/audit"), "audit");
        assert.equal(derivePageSlug("/contact"), "contact");
        assert.equal(derivePageSlug("/resources/ai-readiness"), "resources/ai-readiness");
        assert.equal(derivePageSlug("/sectors/legal"), "sectors/legal");
    });

    it("classifies CTA clicks as engagement, not true conversions", () => {
        assert.equal(isAnalyticsEngagementEvent("cta_click"), true);
        assert.equal(isTrueConversionEvent("cta_click"), false);
    });

    it("classifies true conversion events and semantic form-submit compatibility", () => {
        assert.equal(isTrueConversionEvent("newsletter_subscribe"), true);
        assert.equal(isTrueConversionEvent("contact_submit"), true);
        assert.equal(isTrueConversionEvent("audit_submit"), true);
        assert.equal(isTrueConversionEvent("booking_reserved"), true);
        assert.equal(isTrueConversionEvent("booking_confirmed"), true);
        assert.equal(isTrueConversionEvent("popup_convert"), true);
        assert.equal(isTrueConversionEvent("form_submit", "booking_reserved"), true);
        assert.equal(isTrueConversionEvent("form_submit", "generic_form_submit"), false);
    });

    it("keeps non-conversion booking lifecycle events out of conversion counts", () => {
        assert.equal(isTrueConversionEvent("booking_cancelled"), false);
        assert.equal(isTrueConversionEvent("booking_completed"), false);
    });

    it("classifies booking funnel events as public trackable but not true conversions", () => {
        assert.equal(isAnalyticsPublicTrackEvent("booking_widget_viewed"), true);
        assert.equal(isAnalyticsPublicTrackEvent("booking_service_selected"), true);
        assert.equal(isAnalyticsPublicTrackEvent("booking_slot_selected"), true);
        assert.equal(isAnalyticsPublicTrackEvent("booking_intake_started"), true);
        assert.equal(isTrueConversionEvent("booking_widget_viewed"), false);
    });

    it("derives lightweight content-type hints from canonical routes", () => {
        assert.equal(deriveAnalyticsContentType("/nl/blog/ai-systems"), "blog");
        assert.equal(deriveAnalyticsContentType("/podcast/isystem/episode-1"), "podcast");
        assert.equal(deriveAnalyticsContentType("/tools/conversion-audit"), "system");
        assert.equal(deriveAnalyticsContentType("/contact"), "page");
    });
});
