export const BOOKING_PRICING_VERSION = "vat-inclusive-v1" as const;
export const LEGACY_BOOKING_PRICING_VERSION = "legacy-pre-vat-v1" as const;

export interface BookingPriceInput {
    amountCents: number;
    vatRateBasisPoints: number;
}

export interface BookingPriceSnapshot {
    netAmountCents: number;
    vatRateBasisPoints: number;
    vatAmountCents: number;
    grossAmountCents: number;
    pricingVersion: typeof BOOKING_PRICING_VERSION;
}

/**
 * Calculates a tax-inclusive charge using integer cents. VAT is rounded to the
 * nearest cent with halves rounded up, matching standard invoice arithmetic.
 */
export function calculateBookingPrice(input: BookingPriceInput): BookingPriceSnapshot {
    if (!Number.isInteger(input.amountCents) || input.amountCents < 0) {
        throw new Error("Booking net amount must be a non-negative integer number of cents.");
    }
    if (!Number.isInteger(input.vatRateBasisPoints) || input.vatRateBasisPoints < 0 || input.vatRateBasisPoints > 100_000) {
        throw new Error("Booking VAT rate must be a non-negative integer number of basis points.");
    }

    const vatAmountCents = Math.floor((input.amountCents * input.vatRateBasisPoints + 5_000) / 10_000);
    return {
        netAmountCents: input.amountCents,
        vatRateBasisPoints: input.vatRateBasisPoints,
        vatAmountCents,
        grossAmountCents: input.amountCents + vatAmountCents,
        pricingVersion: BOOKING_PRICING_VERSION,
    };
}

export function vatRatePercentFromBasisPoints(vatRateBasisPoints: number): number {
    return vatRateBasisPoints / 100;
}

export function isLegacyBookingPricingVersion(value: string | null | undefined): boolean {
    return !value || value === LEGACY_BOOKING_PRICING_VERSION;
}
