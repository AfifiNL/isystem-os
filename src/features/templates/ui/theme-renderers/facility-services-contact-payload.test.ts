import assert from "node:assert/strict";
import test from "node:test";

import { buildFacilityServicesContactPayload } from "./facility-services-contact-payload";

test("maps facility-specific fields onto the generic contact contract", () => {
    const payload = buildFacilityServicesContactPayload({
        name: "Demo User",
        company: "Example Workspace",
        email: "demo@example.invalid",
        phone: "",
        facilitySize: "2,000 m²",
        needs: "Cleaning and maintenance coverage",
        website: "",
        formStartedAt: "2026-08-09T12:00:00.000Z",
    }, "facility-services", "en");

    assert.equal(payload.templateId, "facility-services");
    assert.equal(payload.requestType, "facility-services-consultation");
    assert.equal(payload.marketingConsent, false);
    assert.equal(payload.challenge, "Facility size: 2,000 m²\n\nCleaning and maintenance coverage");
});

test("does not add an empty facility-size prefix", () => {
    const payload = buildFacilityServicesContactPayload({
        name: "Demo User",
        company: "",
        email: "demo@example.invalid",
        phone: "",
        facilitySize: " ",
        needs: "Single-site support",
        website: "",
        formStartedAt: "2026-08-09T12:00:00.000Z",
    }, "facility-services", "nl");

    assert.equal(payload.challenge, "Single-site support");
    assert.equal(payload.locale, "nl");
});
