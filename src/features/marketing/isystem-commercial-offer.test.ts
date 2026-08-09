import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
    ISYSTEM_BOOKING_SERVICE_FACTS,
    ISYSTEM_COMMERCIAL_OFFER,
    findIsystemCommercialCopyContradictions,
    formatCommercialPrice,
    getIsystemCommercialSummary,
    getIsystemPublicOfferName,
} from "./isystem-commercial-offer";

const projectFile = (relativePath: string) =>
    readFileSync(new URL(`../../../${relativePath}`, import.meta.url), "utf8");

describe("iSystem commercial offer", () => {
    it("defines one exact public launch offer", () => {
        assert.deepEqual(ISYSTEM_COMMERCIAL_OFFER.fitCall, {
            name: "Systems Fit Call",
            priceEur: 0,
            durationMinutes: 30,
            bookingPath: "/booking",
        });
        assert.deepEqual(ISYSTEM_COMMERCIAL_OFFER.blueprint, {
            name: "Systems Blueprint",
            priceEur: 490,
            durationMinutes: 90,
            bookingPath: "/booking",
            implementationCreditDays: 30,
        });
        assert.deepEqual(ISYSTEM_COMMERCIAL_OFFER.foundation, {
            name: "Foundation System",
            setupPriceEur: 3_900,
            monthlyPriceEur: 249,
            deliveryBusinessDays: 21,
        });
        assert.deepEqual(ISYSTEM_COMMERCIAL_OFFER.growth, {
            name: "Growth Operating System",
            setupPriceEur: 7_500,
            monthlyPriceEur: 699,
            deliveryBusinessDays: 30,
        });
        assert.deepEqual(ISYSTEM_COMMERCIAL_OFFER.embedded, {
            name: "Embedded Systems Engagement",
            pricing: "proposal-only",
            bookingPath: "/contact",
        });
        assert.equal(ISYSTEM_COMMERCIAL_OFFER.vatRatePercent, 21);
        assert.equal(ISYSTEM_COMMERCIAL_OFFER.minimumCareTermMonths, 6);
        assert.equal(ISYSTEM_COMMERCIAL_OFFER.changeRateEurPerHour, 125);
        assert.equal(ISYSTEM_COMMERCIAL_OFFER.paymentProvider, "paypal_checkout");
    });

    it("formats public euro prices consistently", () => {
        assert.equal(formatCommercialPrice(0, "en"), "Free");
        assert.equal(formatCommercialPrice(490, "en"), "€490");
        assert.equal(formatCommercialPrice(3_900, "en"), "€3,900");
        assert.equal(formatCommercialPrice(3_900, "nl"), "€3.900");
    });

    it("projects booking facts from the commercial registry", () => {
        assert.equal(ISYSTEM_BOOKING_SERVICE_FACTS["systems-fit-call"].durationMinutes, ISYSTEM_COMMERCIAL_OFFER.fitCall.durationMinutes);
        assert.equal(ISYSTEM_BOOKING_SERVICE_FACTS["systems-fit-call"].paymentRequired, false);
        assert.equal(ISYSTEM_BOOKING_SERVICE_FACTS["systems-blueprint"].priceAmountCents, ISYSTEM_COMMERCIAL_OFFER.blueprint.priceEur * 100);
        assert.equal(ISYSTEM_BOOKING_SERVICE_FACTS["systems-blueprint"].implementationCreditDays, 30);
        assert.equal(ISYSTEM_BOOKING_SERVICE_FACTS["systems-blueprint"].paymentProvider, "paypal_checkout");
        assert.equal(ISYSTEM_BOOKING_SERVICE_FACTS["systems-blueprint"].vatRatePercent, 21);
        assert.equal(ISYSTEM_BOOKING_SERVICE_FACTS["systems-fit-call"].titleI18n.ar, "مكالمة ملاءمة الأنظمة");
    });

    it("localizes commercial names and summaries without changing the canonical offer facts", () => {
        assert.equal(getIsystemPublicOfferName("foundation", "nl"), "Foundation-systeem");
        assert.equal(getIsystemPublicOfferName("growth", "ar"), "نظام تشغيل النمو");
        assert.match(getIsystemCommercialSummary("nl"), /Foundation-systeem/);
        assert.doesNotMatch(getIsystemCommercialSummary("nl"), /Growth Operating System/);
        assert.doesNotMatch(getIsystemCommercialSummary("ar"), /Foundation System|Growth Operating System/);
    });

    it("detects the contradictory offer language currently blocking launch", () => {
        const contradictions = findIsystemCommercialCopyContradictions([
            "Free paid €140 online advisory consultation",
            "Plan a paid 30-minute founder-led strategy call",
            "Basic from €99/month. Pro from €299–€499/month.",
            "confirmed after the €140 Revolut Pro payment is verified",
        ].join("\n"));

        assert.deepEqual(contradictions, [
            "contradictory-free-paid",
            "legacy-paid-discovery",
            "legacy-basic-pro-pricing",
            "legacy-revolut-checkout",
        ]);
    });

    it("keeps active public copy sources on the canonical offer", () => {
        const sources = [
            "src/features/templates/configs/isystem-agency.ts",
            "src/features/templates/seo-faq.ts",
            "src/features/templates/ui/theme-renderers/isystem-agency-renderer-data.ts",
            "src/features/tools/shared/jsonld.ts",
            "src/features/ai-discovery/agent-index.ts",
            "src/features/audit/audit-page-client.tsx",
            "src/app/(public)/booking/page.tsx",
        ];

        const contradictions = sources.flatMap((source) =>
            findIsystemCommercialCopyContradictions(projectFile(source))
                .map((code) => `${source}:${code}`)
        );

        assert.deepEqual(contradictions, []);
        const bookingPage = projectFile("src/app/(public)/booking/page.tsx");
        assert.match(bookingPage, /Systems Fit Call & Blueprint/);
        assert.doesNotMatch(bookingPage, /Reserve a consultation, walk-through, or service slot/);
    });
});
