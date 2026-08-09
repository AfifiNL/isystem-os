import "server-only";

import { createHash } from "node:crypto";
import type { Json, TablesInsert } from "@/shared/lib/supabase/database.types";

const PAYPAL_SANDBOX_BASE_URL = "https://api-m.sandbox.paypal.com";
const PAYPAL_LIVE_BASE_URL = "https://api-m.paypal.com";
const DEFAULT_CURRENCY = "EUR";
const PAYPAL_PROVIDER_TIMEOUT_MS = 15_000;

function paypalFetch(input: RequestInfo | URL, init: RequestInit = {}) {
    return fetch(input, {
        ...init,
        signal: init.signal ?? AbortSignal.timeout(PAYPAL_PROVIDER_TIMEOUT_MS),
    });
}

type PayPalEnvironment = "sandbox" | "live";
type PayPalWebhookVerifyMode = "postback" | "self_crypto" | "disabled";

type PayPalJson = null | boolean | number | string | PayPalJson[] | { [key: string]: PayPalJson | undefined };

interface PayPalAccessTokenResponse {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
}

export interface PayPalOrderRequest {
    amountCents: number;
    netAmountCents?: number | null;
    vatAmountCents?: number | null;
    vatRateBasisPoints?: number | null;
    grossAmountCents?: number | null;
    pricingVersion?: string | null;
    currency?: string | null;
    paymentReference: string;
    returnUrl: string;
    cancelUrl: string;
    description?: string | null;
    brandName?: string | null;
    requestId?: string | null;
    customId?: string | null;
    invoiceId?: string | null;
}

export interface PayPalCaptureRequest {
    orderId: string;
    requestId?: string | null;
}

export interface PayPalOrderResult {
    id: string;
    status: string | null;
    approvalUrl: string;
    raw: PayPalJson;
}

export interface PayPalCaptureResult {
    orderId: string;
    orderStatus: string | null;
    captureId: string;
    captureStatus: string | null;
    amountCents: number | null;
    currency: string | null;
    payerId: string | null;
    payerEmail: string | null;
    paypalFeeCents: number | null;
    paypalNetCents: number | null;
    raw: PayPalJson;
}

export interface PayPalOrderLookupResult {
    id: string;
    status: string | null;
    capture: PayPalCaptureResult | null;
    raw: PayPalJson;
}

export interface PayPalWebhookHeaders {
    transmissionId: string;
    transmissionTime: string;
    certUrl: string;
    authAlgo: string;
    transmissionSig: string;
}

export interface PayPalWebhookVerificationInput {
    headers: Headers;
    rawBody: string;
    webhookId?: string | null;
    verifyMode?: PayPalWebhookVerifyMode | null;
}

export interface PayPalWebhookVerificationResult {
    verified: boolean;
    mode: PayPalWebhookVerifyMode;
    providerEventId: string | null;
    providerEventType: string | null;
    rawBodySha256: string;
    headers: PayPalWebhookHeaders | null;
    payload: Record<string, unknown> | null;
    error: string | null;
}

export interface PayPalWebhookLedgerInput {
    verification: PayPalWebhookVerificationResult;
    workspaceId?: string | null;
    bookingPaymentId?: string | null;
    reservationId?: string | null;
    processingStatus?: "received" | "processing" | "processed" | "duplicate" | "ignored" | "failed";
    processingError?: string | null;
    deliveryAttempt?: number;
    metadata?: Record<string, Json>;
}

class PayPalConfigurationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PayPalConfigurationError";
    }
}

export class PayPalApiError extends Error {
    status: number;
    responseBody: string;

    constructor(message: string, status: number, responseBody: string) {
        super(message);
        this.name = "PayPalApiError";
        this.status = status;
        this.responseBody = responseBody;
    }
}

function isAlreadyCapturedError(error: unknown): error is PayPalApiError {
    return error instanceof PayPalApiError
        && /ORDER_ALREADY_CAPTURED|already[^\n]{0,80}captur/i.test(error.responseBody);
}

let cachedAccessToken: { token: string; expiresAtMs: number } | null = null;

function readEnv(name: string): string | null {
    const value = process.env[name]?.trim();
    return value && value.length > 0 ? value : null;
}

function normalizeCurrency(currency?: string | null): string {
    const value = (currency ?? readEnv("PAYPAL_DEFAULT_CURRENCY") ?? DEFAULT_CURRENCY).trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(value)) {
        throw new PayPalConfigurationError("PayPal currency must be a three-letter ISO 4217 code.");
    }
    return value;
}

export function getPayPalEnvironment(): PayPalEnvironment {
    const value = (readEnv("PAYPAL_ENV") ?? "sandbox").toLowerCase();
    if (value === "live" || value === "production") return "live";
    if (value === "sandbox" || value === "test") return "sandbox";
    throw new PayPalConfigurationError("PAYPAL_ENV must be sandbox or live.");
}

export function getPayPalBaseUrl(environment: PayPalEnvironment = getPayPalEnvironment()): string {
    return environment === "live" ? PAYPAL_LIVE_BASE_URL : PAYPAL_SANDBOX_BASE_URL;
}

export function getPayPalWebhookVerifyMode(): PayPalWebhookVerifyMode {
    const value = (readEnv("PAYPAL_WEBHOOK_VERIFY_MODE") ?? "postback").toLowerCase();
    if (value === "postback" || value === "self_crypto" || value === "disabled") return value;
    throw new PayPalConfigurationError("PAYPAL_WEBHOOK_VERIFY_MODE must be postback, self_crypto, or disabled.");
}

function getPayPalCredentials(): { clientId: string; clientSecret: string } {
    const clientId = readEnv("PAYPAL_CLIENT_ID");
    const clientSecret = readEnv("PAYPAL_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
        throw new PayPalConfigurationError("Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET.");
    }
    return { clientId, clientSecret };
}

export function getPayPalWebhookId(): string {
    const webhookId = readEnv("PAYPAL_WEBHOOK_ID");
    if (!webhookId) {
        throw new PayPalConfigurationError("Missing PAYPAL_WEBHOOK_ID.");
    }
    return webhookId;
}

export function centsToPayPalDecimal(cents: number): string {
    if (!Number.isInteger(cents) || cents < 0) {
        throw new Error("Amount must be a non-negative integer number of cents.");
    }

    const whole = Math.floor(cents / 100);
    const fractional = String(cents % 100).padStart(2, "0");
    return `${whole}.${fractional}`;
}

export function paypalDecimalToCents(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    const normalized = String(value).trim();
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
    if (!match) return null;
    const whole = Number.parseInt(match[1] ?? "0", 10);
    const cents = Number.parseInt((match[2] ?? "0").padEnd(2, "0"), 10);
    return whole * 100 + cents;
}

function buildRequestId(prefix: string, stableId: string): string {
    const digestLength = Math.max(8, 38 - prefix.length - 1);
    const digest = createHash("sha256").update(stableId).digest("hex").slice(0, digestLength);
    return `${prefix}-${digest}`;
}

function normalizeRequestId(prefix: string, requestId: string | null | undefined): string {
    const candidate = requestId?.trim();
    if (candidate && candidate.length <= 38 && /^[\x21-\x7e]+$/.test(candidate)) {
        return candidate;
    }
    return buildRequestId(prefix, candidate ?? "booking");
}

async function parsePayPalResponse<T>(response: Response): Promise<T> {
    const body = await response.text();
    if (!response.ok) {
        throw new PayPalApiError(`PayPal request failed with status ${response.status}.`, response.status, body);
    }

    return (body.length > 0 ? JSON.parse(body) : {}) as T;
}

async function getPayPalAccessToken(): Promise<string> {
    const now = Date.now();
    if (cachedAccessToken && cachedAccessToken.expiresAtMs > now + 60_000) {
        return cachedAccessToken.token;
    }

    const { clientId, clientSecret } = getPayPalCredentials();
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const response = await paypalFetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
        method: "POST",
        headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ grant_type: "client_credentials" }),
        cache: "no-store",
    });

    const data = await parsePayPalResponse<PayPalAccessTokenResponse>(response);
    if (!data.access_token) {
        throw new PayPalApiError("PayPal OAuth response did not include an access token.", response.status, JSON.stringify(data));
    }

    cachedAccessToken = {
        token: data.access_token,
        expiresAtMs: now + Math.max((data.expires_in ?? 300) - 30, 60) * 1000,
    };

    return data.access_token;
}

async function paypalJsonRequest<T>(path: string, init: RequestInit & { requestId?: string | null }): Promise<T> {
    const accessToken = await getPayPalAccessToken();
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set("Content-Type", "application/json");
    headers.set("Accept", "application/json");
    if (init.requestId) {
        headers.set("PayPal-Request-Id", init.requestId);
    }

    const response = await paypalFetch(`${getPayPalBaseUrl()}${path}`, {
        ...init,
        headers,
        cache: "no-store",
    });

    return parsePayPalResponse<T>(response);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string | null {
    return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readPath(root: unknown, path: Array<string | number>): unknown {
    let current: unknown = root;
    for (const segment of path) {
        if (typeof segment === "number") {
            if (!Array.isArray(current)) return undefined;
            current = current[segment];
            continue;
        }
        if (!isRecord(current)) return undefined;
        current = current[segment];
    }
    return current;
}

export function extractPayPalApprovalUrl(order: unknown): string {
    const links = readPath(order, ["links"]);
    if (!Array.isArray(links)) {
        throw new Error("PayPal order response did not include approval links.");
    }

    let payerActionUrl: string | null = null;

    for (const link of links) {
        if (!isRecord(link)) continue;
        if (link.rel === "approve") {
            const href = readString(link.href);
            if (href) return href;
        }
        if (link.rel === "payer-action") {
            payerActionUrl = readString(link.href);
        }
    }

    if (payerActionUrl) return payerActionUrl;

    throw new Error("PayPal order response did not include an approval URL.");
}

export function extractPayPalCaptureDetails(order: unknown): PayPalCaptureResult {
    const orderId = readString(readPath(order, ["id"]));
    const purchaseUnits = readPath(order, ["purchase_units"]);
    const firstPurchaseUnit = Array.isArray(purchaseUnits) ? purchaseUnits[0] : null;
    const captures = readPath(firstPurchaseUnit, ["payments", "captures"]);
    const capture = Array.isArray(captures) ? captures[0] : null;
    const captureId = readString(readPath(capture, ["id"]));

    if (!orderId) throw new Error("PayPal capture response did not include an order ID.");
    if (!captureId) throw new Error("PayPal capture response did not include a capture ID.");

    return {
        orderId,
        orderStatus: readString(readPath(order, ["status"])),
        captureId,
        captureStatus: readString(readPath(capture, ["status"])),
        amountCents: paypalDecimalToCents(readString(readPath(capture, ["amount", "value"]))),
        currency: readString(readPath(capture, ["amount", "currency_code"])),
        payerId: readString(readPath(order, ["payer", "payer_id"])),
        payerEmail: readString(readPath(order, ["payer", "email_address"])),
        paypalFeeCents: paypalDecimalToCents(readString(readPath(capture, ["seller_receivable_breakdown", "paypal_fee", "value"]))),
        paypalNetCents: paypalDecimalToCents(readString(readPath(capture, ["seller_receivable_breakdown", "net_amount", "value"]))),
        raw: order as PayPalJson,
    };
}

export async function createPayPalOrder(input: PayPalOrderRequest): Promise<PayPalOrderResult> {
    const currency = normalizeCurrency(input.currency);
    const requestId = normalizeRequestId("booking-order", input.requestId ?? input.paymentReference);
    const brandName = input.brandName ?? readEnv("PAYPAL_BRAND_NAME") ?? undefined;

    const netAmountCents = input.netAmountCents ?? input.amountCents;
    const vatAmountCents = input.vatAmountCents ?? 0;
    const grossAmountCents = input.grossAmountCents ?? input.amountCents;
    if (grossAmountCents !== input.amountCents || netAmountCents + vatAmountCents !== grossAmountCents) {
        throw new Error("PayPal pricing snapshot does not reconcile to the checkout amount.");
    }

    const body = {
        intent: "CAPTURE",
        purchase_units: [
            {
                reference_id: input.paymentReference,
                custom_id: input.customId ?? input.paymentReference,
                invoice_id: input.invoiceId ?? undefined,
                description: input.description ?? "Booking payment",
                items: [
                    {
                        name: input.description ?? "Booking payment",
                        description: input.pricingVersion ? `Pricing ${input.pricingVersion}` : undefined,
                        quantity: "1",
                        unit_amount: {
                            currency_code: currency,
                            value: centsToPayPalDecimal(netAmountCents),
                        },
                        category: "DIGITAL_GOODS",
                    },
                ],
                amount: {
                    currency_code: currency,
                    value: centsToPayPalDecimal(grossAmountCents),
                    breakdown: {
                        item_total: {
                            currency_code: currency,
                            value: centsToPayPalDecimal(netAmountCents),
                        },
                        tax_total: {
                            currency_code: currency,
                            value: centsToPayPalDecimal(vatAmountCents),
                        },
                    },
                },
            },
        ],
        payment_source: {
            paypal: {
                experience_context: {
                    brand_name: brandName,
                    landing_page: "LOGIN",
                    user_action: "PAY_NOW",
                    return_url: input.returnUrl,
                    cancel_url: input.cancelUrl,
                },
            },
        },
    };

    const raw = await paypalJsonRequest<PayPalJson>("/v2/checkout/orders", {
        method: "POST",
        body: JSON.stringify(body),
        requestId,
    });

    const id = readString(readPath(raw, ["id"]));
    if (!id) throw new Error("PayPal order response did not include an order ID.");

    return {
        id,
        status: readString(readPath(raw, ["status"])),
        approvalUrl: extractPayPalApprovalUrl(raw),
        raw,
    };
}

export async function capturePayPalOrder(input: PayPalCaptureRequest): Promise<PayPalCaptureResult> {
    const orderId = input.orderId.trim();
    if (!orderId) throw new Error("PayPal order ID is required for capture.");

    let raw: PayPalJson;
    try {
        raw = await paypalJsonRequest<PayPalJson>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
            method: "POST",
            body: JSON.stringify({}),
            requestId: normalizeRequestId("booking-capture", input.requestId ?? orderId),
        });
    } catch (error) {
        // A webhook or a retried browser request may have captured the order
        // immediately before this POST. Read the provider order once and
        // reconcile its completed capture instead of converting a real charge
        // into a local failed/expired booking.
        if (!isAlreadyCapturedError(error)) throw error;
        try {
            raw = await paypalJsonRequest<PayPalJson>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
                method: "GET",
                requestId: normalizeRequestId("booking-order-read", orderId),
            });
        } catch {
            throw error;
        }
        const recovered = extractPayPalCaptureDetails(raw);
        if (recovered.orderStatus !== "COMPLETED" || recovered.captureStatus !== "COMPLETED") {
            throw error;
        }
    }

    return extractPayPalCaptureDetails(raw);
}

/**
 * Read an order after an interrupted capture. A GET is deliberately kept
 * separate from capturePayPalOrder so reconciliation never retries a charge;
 * it only observes the provider's committed order/capture state.
 */
export async function getPayPalOrder(orderId: string): Promise<PayPalOrderLookupResult> {
    const normalizedOrderId = orderId.trim();
    if (!normalizedOrderId) throw new Error("PayPal order ID is required for an order lookup.");

    const raw = await paypalJsonRequest<PayPalJson>(`/v2/checkout/orders/${encodeURIComponent(normalizedOrderId)}`, {
        method: "GET",
        requestId: normalizeRequestId("booking-order-read", normalizedOrderId),
    });
    const id = readString(readPath(raw, ["id"]));
    if (!id) throw new Error("PayPal order lookup did not include an order ID.");

    let capture: PayPalCaptureResult | null = null;
    try {
        const extracted = extractPayPalCaptureDetails(raw);
        capture = extracted.captureStatus ? extracted : null;
    } catch {
        // CREATED/APPROVED orders do not contain a capture yet. Keep the raw
        // order status so the caller can safely restore the local marker.
    }

    return {
        id,
        status: readString(readPath(raw, ["status"])),
        capture,
        raw,
    };
}

function requirePayPalWebhookHeaders(headers: Headers): PayPalWebhookHeaders {
    const values: PayPalWebhookHeaders = {
        transmissionId: headers.get("paypal-transmission-id")?.trim() ?? "",
        transmissionTime: headers.get("paypal-transmission-time")?.trim() ?? "",
        certUrl: headers.get("paypal-cert-url")?.trim() ?? "",
        authAlgo: headers.get("paypal-auth-algo")?.trim() ?? "",
        transmissionSig: headers.get("paypal-transmission-sig")?.trim() ?? "",
    };

    const missing = Object.entries(values)
        .filter(([, value]) => value.length === 0)
        .map(([key]) => key);
    if (missing.length > 0) {
        throw new Error(`Missing required PayPal webhook header(s): ${missing.join(", ")}.`);
    }

    return values;
}

export function parsePayPalWebhookPayload(rawBody: string): Record<string, unknown> {
    const parsed = JSON.parse(rawBody) as unknown;
    if (!isRecord(parsed)) {
        throw new Error("PayPal webhook payload must be a JSON object.");
    }
    return parsed;
}

export function getPayPalWebhookEventIdentity(payload: Record<string, unknown>): {
    providerEventId: string | null;
    providerEventType: string | null;
} {
    return {
        providerEventId: readString(payload.id),
        providerEventType: readString(payload.event_type),
    };
}

export function getPayPalWebhookResource(payload: Record<string, unknown>): Record<string, unknown> | null {
    return isRecord(payload.resource) ? payload.resource : null;
}

export function serializePayPalWebhookHeaders(headers: PayPalWebhookHeaders | null): Record<string, Json> {
    if (!headers) return {};
    return {
        paypalTransmissionId: headers.transmissionId,
        paypalTransmissionTime: headers.transmissionTime,
        paypalCertUrl: headers.certUrl,
        paypalAuthAlgo: headers.authAlgo,
        paypalTransmissionSig: headers.transmissionSig,
    };
}

export function hashRawBodySha256(rawBody: string): string {
    return createHash("sha256").update(rawBody, "utf8").digest("hex");
}

async function verifyPayPalWebhookByPostback(params: {
    webhookId: string;
    headers: PayPalWebhookHeaders;
    payload: Record<string, unknown>;
}): Promise<boolean> {
    const response = await paypalJsonRequest<{ verification_status?: string }>("/v1/notifications/verify-webhook-signature", {
        method: "POST",
        body: JSON.stringify({
            auth_algo: params.headers.authAlgo,
            cert_url: params.headers.certUrl,
            transmission_id: params.headers.transmissionId,
            transmission_sig: params.headers.transmissionSig,
            transmission_time: params.headers.transmissionTime,
            webhook_id: params.webhookId,
            webhook_event: params.payload,
        }),
        requestId: buildRequestId("booking-webhook-verify", `${params.headers.transmissionId}:${params.webhookId}`),
    });

    return response.verification_status === "SUCCESS";
}

export async function verifyPayPalWebhook(input: PayPalWebhookVerificationInput): Promise<PayPalWebhookVerificationResult> {
    const mode = input.verifyMode ?? getPayPalWebhookVerifyMode();
    const rawBodySha256 = hashRawBodySha256(input.rawBody);

    let payload: Record<string, unknown> | null = null;
    let headers: PayPalWebhookHeaders | null = null;
    let providerEventId: string | null = null;
    let providerEventType: string | null = null;

    try {
        payload = parsePayPalWebhookPayload(input.rawBody);
        const identity = getPayPalWebhookEventIdentity(payload);
        providerEventId = identity.providerEventId;
        providerEventType = identity.providerEventType;

        if (!providerEventId || !providerEventType) {
            throw new Error("PayPal webhook payload is missing id or event_type.");
        }

        if (mode === "disabled") {
            return { verified: false, mode, providerEventId, providerEventType, rawBodySha256, headers: null, payload, error: "Webhook verification is disabled." };
        }

        headers = requirePayPalWebhookHeaders(input.headers);

        if (mode === "self_crypto") {
            return {
                verified: false,
                mode,
                providerEventId,
                providerEventType,
                rawBodySha256,
                headers,
                payload,
                error: "Self-crypto PayPal webhook verification is not implemented; payload must not be trusted.",
            };
        }

        const webhookId = input.webhookId?.trim() || getPayPalWebhookId();
        const verified = await verifyPayPalWebhookByPostback({ webhookId, headers, payload });

        return {
            verified,
            mode,
            providerEventId,
            providerEventType,
            rawBodySha256,
            headers,
            payload,
            error: verified ? null : "PayPal webhook postback verification failed.",
        };
    } catch (error) {
        return {
            verified: false,
            mode,
            providerEventId,
            providerEventType,
            rawBodySha256,
            headers,
            payload,
            error: error instanceof Error ? error.message : "PayPal webhook verification failed.",
        };
    }
}

export function buildPayPalWebhookEventLedgerInsert(
    input: PayPalWebhookLedgerInput,
): TablesInsert<"payment_webhook_events"> {
    const providerEventId = input.verification.providerEventId;
    const providerEventType = input.verification.providerEventType;

    if (!providerEventId || !providerEventType) {
        throw new Error("Cannot build PayPal webhook ledger row without event id and event_type.");
    }

    const payload = input.verification.payload ?? {};
    const resource = getPayPalWebhookResource(payload) ?? {};
    const verificationStatus = input.verification.verified
        ? "verified"
        : input.verification.error
            ? "failed"
            : "unverified";

    return {
        workspace_id: input.workspaceId ?? null,
        booking_payment_id: input.bookingPaymentId ?? null,
        reservation_id: input.reservationId ?? null,
        provider: "paypal",
        provider_event_id: providerEventId,
        provider_event_type: providerEventType,
        verification_status: verificationStatus,
        verification_mode: input.verification.mode,
        processing_status: input.processingStatus ?? "received",
        raw_body_sha256: input.verification.rawBodySha256,
        headers_json: serializePayPalWebhookHeaders(input.verification.headers),
        payload_json: payload as Json,
        resource_json: resource as Json,
        delivery_attempt: input.deliveryAttempt ?? 1,
        processing_error: input.processingError ?? input.verification.error,
        metadata: input.metadata ?? {},
    };
}
