import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    ISYSTEM_PUBLIC_CAPABILITIES,
    ISYSTEM_PUBLIC_SYSTEMS,
    findIsystemPublicClaimViolations,
    getIsystemPublicCapability,
    type IsystemCapabilityStatus,
} from "./isystem-public-truth";

describe("iSystem public truth", () => {
    it("covers the five public operating systems with explicit capability statuses", () => {
        assert.deepEqual(ISYSTEM_PUBLIC_SYSTEMS.map((system) => system.id), [
            "presence-conversion",
            "authority-publishing",
            "discoverability-growth",
            "client-business-operations",
            "trust-commercial-control",
        ]);

        const statuses = new Set<IsystemCapabilityStatus>([
            "shipped",
            "configured",
            "assisted",
            "roadmap",
        ]);

        assert.ok(ISYSTEM_PUBLIC_CAPABILITIES.length >= 20);
        assert.equal(new Set(ISYSTEM_PUBLIC_CAPABILITIES.map((capability) => capability.id)).size, ISYSTEM_PUBLIC_CAPABILITIES.length);
        for (const capability of ISYSTEM_PUBLIC_CAPABILITIES) {
            assert.ok(statuses.has(capability.status));
            assert.ok(ISYSTEM_PUBLIC_SYSTEMS.some((system) => system.id === capability.systemId));
            assert.ok(capability.label.en.length > 0);
            assert.ok(capability.publicDescription.en.length > 0);
        }
        for (const system of ISYSTEM_PUBLIC_SYSTEMS) {
            assert.ok(ISYSTEM_PUBLIC_CAPABILITIES.filter((capability) => capability.systemId === system.id).length >= 3);
        }
    });

    it("resolves capabilities without exposing internal implementation names", () => {
        const booking = getIsystemPublicCapability("booking-checkout");
        assert.ok(booking);
        assert.equal(booking?.status, "shipped");
        assert.doesNotMatch(booking?.label.en ?? "", /Supabase|PayPal|API/i);
    });

    it("blocks public claims that exceed the approved product truth", () => {
        assert.deepEqual(
            findIsystemPublicClaimViolations(
                "Autonomous AI agents guarantee results and replace every tool in a fully integrated stack.",
            ),
            ["autonomous-ai", "guaranteed-outcome", "replaces-everything", "fully-integrated"],
        );
        assert.deepEqual(findIsystemPublicClaimViolations("AI-assisted workflows with human review."), []);
    });
});
