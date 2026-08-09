import test from "node:test";
import assert from "node:assert/strict";

import { calculateBookingPrice, isLegacyBookingPricingVersion, type BookingPriceInput } from "./pricing";

test("calculates the Blueprint net, VAT, and gross amounts in cents", () => {
    const result = calculateBookingPrice({ amountCents: 49_000, vatRateBasisPoints: 2_100 });

    assert.deepEqual(result, {
        netAmountCents: 49_000,
        vatRateBasisPoints: 2_100,
        vatAmountCents: 10_290,
        grossAmountCents: 59_290,
        pricingVersion: "vat-inclusive-v1",
    });
});

test("rounds half cents deterministically and preserves zero-VAT services", () => {
    const input: BookingPriceInput = { amountCents: 1, vatRateBasisPoints: 5_000 };
    assert.equal(calculateBookingPrice(input).vatAmountCents, 1);
    assert.deepEqual(calculateBookingPrice({ amountCents: 2_500, vatRateBasisPoints: 0 }), {
        netAmountCents: 2_500,
        vatRateBasisPoints: 0,
        vatAmountCents: 0,
        grossAmountCents: 2_500,
        pricingVersion: "vat-inclusive-v1",
    });
});

test("marks missing and pre-VAT snapshots as legacy without changing their charged amount", () => {
    assert.equal(isLegacyBookingPricingVersion(null), true);
    assert.equal(isLegacyBookingPricingVersion("legacy-pre-vat-v1"), true);
    assert.equal(isLegacyBookingPricingVersion("vat-inclusive-v1"), false);
});
