import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import { BOOKING_MINIMUM_LEAD_TIME_MINUTES, BOOKING_PAYMENT_COMPLETION_WINDOW_MINUTES } from "@/features/booking/lib/booking-policies";
import { bookingServiceUpsertSchema } from "@/features/booking/schema";

type PayPalModule = typeof import("@/features/booking/lib/paypal");
type NodeModuleLoader = {
    _load?: (request: string, parent: unknown, isMain: boolean) => unknown;
};

const require = createRequire(import.meta.url);

async function importPayPalModule(): Promise<PayPalModule> {
    const moduleLoader = require("node:module") as NodeModuleLoader;
    const originalLoad = moduleLoader._load;

    if (originalLoad) {
        moduleLoader._load = function patchedLoad(request: string, parent: unknown, isMain: boolean) {
            if (request === "server-only") return {};

            return originalLoad.call(this, request, parent, isMain);
        };
    }

    return import("@/features/booking/lib/paypal");
}

const basePaidService = {
    templateProfileId: "00000000-0000-4000-8000-000000000001",
    serviceKey: "paid-consultation",
    serviceType: "consultation_call",
    title: "Paid consultation",
    subtitle: null,
    description: null,
    durationMinutes: 45,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    leadTimeMinutes: BOOKING_MINIMUM_LEAD_TIME_MINUTES,
    maxAdvanceDays: 90,
    capacityMode: "single" as const,
    capacityValue: 1,
    locationMode: "remote" as const,
    visibilityStatus: "published" as const,
    requiresManualReview: false,
    paymentRequired: true,
    priceAmountCents: 5000,
    priceCurrency: "EUR",
    paymentInstructions: null,
    paymentDeadlineMinutes: BOOKING_PAYMENT_COMPLETION_WINDOW_MINUTES,
    metadata: {},
};

describe("booking payment provider schema", () => {
    it("allows PayPal Checkout paid services without a static payment URL", () => {
        const result = bookingServiceUpsertSchema.safeParse({
            ...basePaidService,
            paymentProvider: "paypal_checkout",
            paymentUrl: null,
        });

        assert.equal(result.success, true);
    });

    it("continues to require a static payment URL for manual Revolut Pro", () => {
        const result = bookingServiceUpsertSchema.safeParse({
            ...basePaidService,
            paymentProvider: "manual_revolut_pro",
            paymentUrl: null,
        });

        assert.equal(result.success, false);
        assert.equal(result.error?.issues.some((issue) => issue.path.join(".") === "paymentUrl"), true);
    });
});

describe("PayPal order approval URL extraction", () => {
    it("accepts PayPal v2 payer-action links as the approval URL", async () => {
        const { extractPayPalApprovalUrl } = await importPayPalModule();
        const approvalUrl = extractPayPalApprovalUrl({
            id: "8HP16600000000000",
            status: "PAYER_ACTION_REQUIRED",
            links: [
                {
                    href: "https://api.sandbox.paypal.com/v2/checkout/orders/8HP16600000000000",
                    rel: "self",
                    method: "GET",
                },
                {
                    href: "https://www.sandbox.paypal.com/checkoutnow?token=8HP16600000000000",
                    rel: "payer-action",
                    method: "GET",
                },
            ],
        });

        assert.equal(approvalUrl, "https://www.sandbox.paypal.com/checkoutnow?token=8HP16600000000000");
    });

    it("prefers legacy approve links when both rels are present", async () => {
        const { extractPayPalApprovalUrl } = await importPayPalModule();
        const approvalUrl = extractPayPalApprovalUrl({
            links: [
                {
                    href: "https://www.sandbox.paypal.com/checkoutnow?token=payer-action-order",
                    rel: "payer-action",
                    method: "GET",
                },
                {
                    href: "https://www.sandbox.paypal.com/checkoutnow?token=approve-order",
                    rel: "approve",
                    method: "GET",
                },
            ],
        });

        assert.equal(approvalUrl, "https://www.sandbox.paypal.com/checkoutnow?token=approve-order");
    });
});

describe("PayPal pricing payload", () => {
    it("sends the Blueprint net item, VAT, and gross total as one purchase unit", async () => {
        const { createPayPalOrder } = await importPayPalModule();
        const originalFetch = globalThis.fetch;
        const originalEnvironment = process.env.PAYPAL_ENV;
        const originalClientId = process.env.PAYPAL_CLIENT_ID;
        const originalClientSecret = process.env.PAYPAL_CLIENT_SECRET;
        const calls: Array<{ url: string; init?: RequestInit }> = [];

        process.env.PAYPAL_ENV = "sandbox";
        process.env.PAYPAL_CLIENT_ID = "test-client-id";
        process.env.PAYPAL_CLIENT_SECRET = "test-client-secret";
        globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            calls.push({ url, init });
            if (url.endsWith("/v1/oauth2/token")) {
                return new Response(JSON.stringify({ access_token: "test-access-token", expires_in: 3600 }), { status: 200 });
            }
            return new Response(JSON.stringify({
                id: "TEST-ORDER",
                status: "CREATED",
                links: [{ rel: "approve", href: "https://www.sandbox.paypal.com/checkoutnow?token=TEST-ORDER" }],
            }), { status: 201 });
        }) as typeof fetch;

        try {
            await createPayPalOrder({
                amountCents: 59_290,
                netAmountCents: 49_000,
                vatAmountCents: 10_290,
                vatRateBasisPoints: 2_100,
                grossAmountCents: 59_290,
                pricingVersion: "vat-inclusive-v1",
                currency: "EUR",
                paymentReference: "ISY-TEST",
                returnUrl: "https://isystem.ai/return",
                cancelUrl: "https://isystem.ai/cancel",
                description: "Systems Blueprint",
            });

            const payload = JSON.parse(String(calls[1]?.init?.body)) as {
                purchase_units: Array<{
                    items: Array<{ unit_amount: { value: string } }>;
                    amount: { value: string; breakdown: { item_total: { value: string }; tax_total: { value: string } } };
                }>;
            };
            const purchaseUnit = payload.purchase_units[0];
            assert.equal(purchaseUnit.items[0]?.unit_amount.value, "490.00");
            assert.equal(purchaseUnit.amount.value, "592.90");
            assert.equal(purchaseUnit.amount.breakdown.item_total.value, "490.00");
            assert.equal(purchaseUnit.amount.breakdown.tax_total.value, "102.90");
        } finally {
            globalThis.fetch = originalFetch;
            if (originalEnvironment === undefined) delete process.env.PAYPAL_ENV;
            else process.env.PAYPAL_ENV = originalEnvironment;
            if (originalClientId === undefined) delete process.env.PAYPAL_CLIENT_ID;
            else process.env.PAYPAL_CLIENT_ID = originalClientId;
            if (originalClientSecret === undefined) delete process.env.PAYPAL_CLIENT_SECRET;
            else process.env.PAYPAL_CLIENT_SECRET = originalClientSecret;
        }
    });
});
