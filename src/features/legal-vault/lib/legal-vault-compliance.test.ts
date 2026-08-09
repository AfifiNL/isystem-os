import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateBtwFromExcl } from "./btw";
import { calculateInvoiceTotals, validateDutchInvoice } from "./invoice-validation";
import { evaluateWetDbaPreflight } from "./wet-dba";
import { extractLegalSignals } from "./document-extraction";

describe("Legal Vault compliance helpers", () => {
    it("calculates Dutch BTW totals in cents", () => {
        assert.deepEqual(calculateBtwFromExcl(10_000, 2100), {
            amountExclBtwCents: 10_000,
            btwRateBp: 2100,
            btwAmountCents: 2_100,
            amountInclBtwCents: 12_100,
        });
    });

    it("blocks KOR invoices from charging BTW", () => {
        const errors = validateDutchInvoice({
            supplier: {
                legalName: "Example ZZP",
                addressLine1: "Straat 1",
                postalCode: "1000AA",
                city: "Amsterdam",
                countryCode: "NL",
                kvkNumber: "12345678",
                btwId: null,
                korEnabled: true,
            },
            client: { name: "Client BV", countryCode: "NL", address: "Laan 2" },
            lines: [{ description: "Consulting", quantity: 1, unitPriceCents: 10_000, btwRateBp: 2100 }],
        });
        assert.ok(errors.includes("Line 1: KOR invoices cannot charge BTW."));
    });

    it("summarizes invoice line totals", () => {
        assert.deepEqual(
            calculateInvoiceTotals([
                { description: "A", quantity: 2, unitPriceCents: 5_000, btwRateBp: 2100 },
                { description: "B", quantity: 1, unitPriceCents: 1_000, btwRateBp: 900 },
            ]),
            { subtotalCents: 11_000, btwTotalCents: 2_190, totalCents: 13_190 },
        );
    });

    it("scores Wet DBA risk markers", () => {
        const result = evaluateWetDbaPreflight({
            clientControlsWork: "yes",
            fixedWorkingHours: "yes",
            exclusivityRequired: "no",
            freeSubstitutionAllowed: "no",
            contractorUsesOwnTools: "yes",
            entrepreneurialRisk: "unknown",
            embeddedInOrganization: "yes",
        });
        assert.equal(result.level, "high");
        assert.ok(result.findings.length > 0);
    });

    it("extracts legal signals from Dutch/English agreement text", () => {
        const signals = extractLegalSignals("Betaling moet plaatsvinden binnen 14 dagen. Personal data breach notice within 72 hours.");
        assert.ok(signals.map((signal) => signal.kind).includes("payment"));
        assert.ok(signals.map((signal) => signal.kind).includes("dpa_breach"));
    });
});
