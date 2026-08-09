// NL BTW (VAT) helpers. iSystem operates under the standard regime (21 %);
// the codebase keeps the reduced (9 %) and zero (0 %) rates around because
// every Dutch ZZP regularly issues mixed invoices (e.g. printed materials at
// 9 %, intra-EU services at 0 % with reverse-charge).

import type { AccountingEntry } from "@/features/legal-vault/types";

export const BTW_STANDARD_BP = 2100; // 21.00 %
export const BTW_REDUCED_BP = 900; // 9.00 %
export const BTW_ZERO_BP = 0;
export const BTW_REVERSE_CHARGE_BP = 0;

export interface BtwLineCalculation {
    amountExclBtwCents: number;
    btwRateBp: number;
    btwAmountCents: number;
    amountInclBtwCents: number;
}

// Compute BTW from an excluding-BTW base amount using banker's rounding to
// the nearest cent. Belastingdienst accepts either commercial rounding or
// banker's; banker's is more stable across long ledgers.
export function calculateBtwFromExcl(
    amountExclBtwCents: number,
    btwRateBp: number,
): BtwLineCalculation {
    if (!Number.isInteger(amountExclBtwCents) || amountExclBtwCents < 0) {
        throw new Error("amountExclBtwCents must be a non-negative integer.");
    }
    if (!Number.isInteger(btwRateBp) || btwRateBp < 0 || btwRateBp > 10_000) {
        throw new Error("btwRateBp must be an integer in [0, 10_000].");
    }

    const raw = (amountExclBtwCents * btwRateBp) / 10_000;
    const btwAmountCents = bankersRound(raw);

    return {
        amountExclBtwCents,
        btwRateBp,
        btwAmountCents,
        amountInclBtwCents: amountExclBtwCents + btwAmountCents,
    };
}

// Compute BTW from an including-BTW base amount. Useful when an operator
// types a receipt total off a paper invoice.
export function calculateBtwFromIncl(
    amountInclBtwCents: number,
    btwRateBp: number,
): BtwLineCalculation {
    if (!Number.isInteger(amountInclBtwCents) || amountInclBtwCents < 0) {
        throw new Error("amountInclBtwCents must be a non-negative integer.");
    }
    if (!Number.isInteger(btwRateBp) || btwRateBp < 0 || btwRateBp > 10_000) {
        throw new Error("btwRateBp must be an integer in [0, 10_000].");
    }

    const denominator = 10_000 + btwRateBp;
    const exclRaw = (amountInclBtwCents * 10_000) / denominator;
    const amountExclBtwCents = bankersRound(exclRaw);
    const btwAmountCents = amountInclBtwCents - amountExclBtwCents;

    return {
        amountExclBtwCents,
        btwRateBp,
        btwAmountCents,
        amountInclBtwCents,
    };
}

function bankersRound(value: number): number {
    const floor = Math.floor(value);
    const diff = value - floor;
    if (diff > 0.5) return floor + 1;
    if (diff < 0.5) return floor;
    return floor % 2 === 0 ? floor : floor + 1;
}

export interface BtwQuarterTotals {
    income_excl_btw_cents: number;
    income_btw_cents: number;
    expense_excl_btw_cents: number;
    expense_btw_cents: number;
    btw_to_pay_cents: number;
    entry_count: number;
}

export function summarizeBtwQuarter(entries: ReadonlyArray<AccountingEntry>): BtwQuarterTotals {
    return entries.reduce<BtwQuarterTotals>(
        (acc, entry) => {
            const inc = entry.direction === "income";
            return {
                income_excl_btw_cents:
                    acc.income_excl_btw_cents + (inc ? entry.amountExclBtwCents : 0),
                income_btw_cents:
                    acc.income_btw_cents + (inc ? entry.btwAmountCents : 0),
                expense_excl_btw_cents:
                    acc.expense_excl_btw_cents + (!inc ? entry.amountExclBtwCents : 0),
                expense_btw_cents:
                    acc.expense_btw_cents + (!inc ? entry.btwAmountCents : 0),
                btw_to_pay_cents:
                    acc.btw_to_pay_cents +
                    (inc ? entry.btwAmountCents : -entry.btwAmountCents),
                entry_count: acc.entry_count + 1,
            };
        },
        {
            income_excl_btw_cents: 0,
            income_btw_cents: 0,
            expense_excl_btw_cents: 0,
            expense_btw_cents: 0,
            btw_to_pay_cents: 0,
            entry_count: 0,
        },
    );
}

export function formatEuro(cents: number, locale: string = "nl-NL"): string {
    return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "EUR",
    }).format(cents / 100);
}

// Currently the only quarter helper a UI ever needs: which quarter contains
// a given ISO date string, plus its bounds.
export function btwQuarterFor(isoDate: string): { quarter: 1 | 2 | 3 | 4; year: number; startsOn: string; endsOn: string } {
    const date = new Date(`${isoDate}T00:00:00Z`);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const quarter = (Math.floor(month / 3) + 1) as 1 | 2 | 3 | 4;
    const startMonth = (quarter - 1) * 3;
    const endMonth = startMonth + 2;
    const lastDay = new Date(Date.UTC(year, endMonth + 1, 0)).getUTCDate();
    const startsOn = `${year}-${String(startMonth + 1).padStart(2, "0")}-01`;
    const endsOn = `${year}-${String(endMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { quarter, year, startsOn, endsOn };
}
