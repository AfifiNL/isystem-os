import { z } from "zod";
import {
    BOOKING_MINIMUM_LEAD_TIME_MINUTES,
    BOOKING_PAYMENT_COMPLETION_WINDOW_MINUTES,
} from "@/features/booking/lib/booking-policies";
import { isValidIanaTimezone } from "@/features/booking/lib/timezone";
import { BOOKING_ENTITY_MODES, BOOKING_SLOT_STRATEGIES, BOOKING_TEMPLATE_KEYS } from "@/features/booking/types";

const jsonRecordSchema: z.ZodType<Record<string, unknown>> = z.record(z.string(), z.unknown());
const jsonArraySchema = z.array(z.unknown());
const isoDateTimeSchema = z.string().datetime({ offset: true });

const BOOKING_PUBLIC_JSON_MAX_BYTES = 64_000;
const BOOKING_PUBLIC_JSON_MAX_DEPTH = 8;
const BOOKING_PUBLIC_JSON_MAX_KEYS = 300;
const BOOKING_PUBLIC_JSON_MAX_STRING_LENGTH = 8_000;
const BOOKING_PUBLIC_JSON_MAX_ARRAY_ITEMS = 300;
const BOOKING_PUBLIC_JSON_MAX_NODES = 1_000;

function validateBoundedPublicJson(value: unknown, ctx: z.RefinementCtx): void {
    let keyCount = 0;
    let nodeCount = 0;
    let tooDeep = false;
    let tooManyKeys = false;
    let tooManyNodes = false;
    let oversizedArray = false;
    let oversizedString = false;
    const visit = (current: unknown, depth: number) => {
        if (tooManyKeys || tooManyNodes) return;
        nodeCount += 1;
        if (nodeCount > BOOKING_PUBLIC_JSON_MAX_NODES) {
            tooManyNodes = true;
            return;
        }
        if (depth > BOOKING_PUBLIC_JSON_MAX_DEPTH) {
            tooDeep = true;
            return;
        }
        if (typeof current === "string") {
            if (current.length > BOOKING_PUBLIC_JSON_MAX_STRING_LENGTH) oversizedString = true;
            return;
        }
        if (Array.isArray(current)) {
            if (current.length > BOOKING_PUBLIC_JSON_MAX_ARRAY_ITEMS) {
                oversizedArray = true;
                return;
            }
            for (const item of current) visit(item, depth + 1);
            return;
        }
        if (!current || typeof current !== "object") return;
        for (const child of Object.values(current)) {
            keyCount += 1;
            if (keyCount > BOOKING_PUBLIC_JSON_MAX_KEYS) {
                tooManyKeys = true;
                return;
            }
            visit(child, depth + 1);
        }
    };
    visit(value, 0);

    let serializedBytes = 0;
    try {
        serializedBytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
    } catch {
        serializedBytes = BOOKING_PUBLIC_JSON_MAX_BYTES + 1;
    }

    if (serializedBytes > BOOKING_PUBLIC_JSON_MAX_BYTES) {
        ctx.addIssue({ code: "custom", message: "Booking intake metadata is too large." });
    }
    if (tooManyKeys || keyCount > BOOKING_PUBLIC_JSON_MAX_KEYS) {
        ctx.addIssue({ code: "custom", message: "Booking intake metadata contains too many fields." });
    }
    if (tooManyNodes) {
        ctx.addIssue({ code: "custom", message: "Booking intake metadata contains too many values." });
    }
    if (oversizedArray) {
        ctx.addIssue({ code: "custom", message: "Booking intake metadata contains too many array items." });
    }
    if (tooDeep) {
        ctx.addIssue({ code: "custom", message: "Booking intake metadata is nested too deeply." });
    }
    if (oversizedString) {
        ctx.addIssue({ code: "custom", message: "Booking intake metadata contains an oversized text value." });
    }
}

const boundedPublicJsonRecordSchema = jsonRecordSchema.superRefine(validateBoundedPublicJson);
const bookingConsentsSchema = z.object({
    marketing: z.boolean().optional(),
    privacyAccepted: z.boolean().refine((value) => value, "Privacy policy acknowledgement is required."),
    accountCreationApproved: z.boolean().optional(),
}).strict().default({
    marketing: false,
    privacyAccepted: false,
    accountCreationApproved: false,
});
const antiAbuseSchema = z.object({
    honeypot: z.string().max(0).optional().default(""),
    formStartedAt: isoDateTimeSchema.nullable().optional(),
    pagePath: z.string().trim().max(200).nullable().optional(),
}).default({
    honeypot: "",
    formStartedAt: null,
    pagePath: null,
});

export const bookingTemplateKeySchema = z.enum(BOOKING_TEMPLATE_KEYS);
export const bookingEntityModeSchema = z.enum(BOOKING_ENTITY_MODES);
export const bookingSlotStrategySchema = z.enum(BOOKING_SLOT_STRATEGIES);
export const bookingProfileStatusSchema = z.enum(["draft", "active", "archived"]);
export const bookingServiceVisibilitySchema = z.enum(["draft", "published", "hidden", "archived"]);
export const bookingCapacityModeSchema = z.enum(["single", "group", "pooled", "capacity"]);
export const bookingLocationModeSchema = z.enum(["remote", "onsite", "hybrid"]);
export const bookingMeetingProviderSchema = z.enum(["none", "google_meet", "zoom"]);
export const bookingResourceTypeSchema = z.enum(["staff", "agent", "room", "table_zone", "property", "generic_asset"]);
export const bookingLocationTypeSchema = z.enum(["site", "office", "venue", "property", "remote"]);
export const bookingRuleScopeSchema = z.enum(["workspace", "service", "resource", "location"]);
export const bookingAvailabilityRuleTypeSchema = z.enum(["recurring", "date_override", "seasonal"]);
export const bookingReservationStatusSchema = z.enum([
    "draft",
    "pending_review",
    "pending_confirmation",
    "confirmed",
    "completed",
    "cancelled_by_customer",
    "cancelled_by_workspace",
    "no_show",
    "expired",
]);

export const BOOKING_PAYMENT_PROVIDERS = ["manual_revolut_pro", "paypal_checkout"] as const;
export const bookingPaymentProviderSchema = z.enum(BOOKING_PAYMENT_PROVIDERS);

export const bookingPaymentStatusSchema = z.enum([
    "requested",
    "verified",
    "failed",
    "expired",
    "refunded",
]);

// Three-letter ISO 4217 currency code (e.g. EUR, USD, GBP).
const currencyCodeSchema = z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO code, e.g. EUR.")
    .default("EUR");

// Price expressed in minor units to avoid floating point drift (e.g. 5000 = €50.00).
const priceAmountCentsSchema = z
    .number()
    .int()
    .min(0)
    .max(10_000_000)
    .nullable()
    .optional();

const idSchema = z.string().uuid();
const nullableIdSchema = idSchema.nullable().optional();

export const bookingTemplateProfileUpsertSchema = z.object({
    id: idSchema.optional(),
    profileKey: z.string().trim().min(1).max(80).default("primary"),
    templateKey: bookingTemplateKeySchema,
    status: bookingProfileStatusSchema.default("draft"),
    entityMode: bookingEntityModeSchema.optional(),
    slotStrategy: bookingSlotStrategySchema.optional(),
    settingsJson: jsonRecordSchema.default({}),
    brandingJson: jsonRecordSchema.default({}),
    analyticsJson: jsonRecordSchema.default({}),
    placementConfigJson: jsonRecordSchema.default({}),
    publishedAt: isoDateTimeSchema.nullable().optional(),
});

// Per-locale copy slots written to booking_*.copy_i18n.{locale}.{field}.
// English is canonical and mirrored from the plain text columns by a DB
// trigger; nl/ar are admin-controlled overrides that live only in JSONB.
const localeOverridesSchema = z
    .object({
        nl: z.object({
            title: z.string().trim().max(160).optional(),
            subtitle: z.string().trim().max(220).optional(),
            description: z.string().trim().max(4000).optional(),
        }).optional(),
        ar: z.object({
            title: z.string().trim().max(160).optional(),
            subtitle: z.string().trim().max(220).optional(),
            description: z.string().trim().max(4000).optional(),
        }).optional(),
    })
    .optional();

export const bookingServiceUpsertSchema = z.object({
    id: idSchema.optional(),
    templateProfileId: idSchema,
    serviceKey: z.string().trim().min(1).max(120),
    serviceType: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(160),
    subtitle: z.string().trim().max(220).nullable().optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    durationMinutes: z.number().int().min(5).max(1440),
    bufferBeforeMinutes: z.number().int().min(0).max(480).default(0),
    bufferAfterMinutes: z.number().int().min(0).max(480).default(0),
    leadTimeMinutes: z.number().int().min(0).max(43200).default(BOOKING_MINIMUM_LEAD_TIME_MINUTES),
    maxAdvanceDays: z.number().int().min(0).max(730).default(90),
    capacityMode: bookingCapacityModeSchema.default("single"),
    capacityValue: z.number().int().min(1).max(10000).default(1),
    locationMode: bookingLocationModeSchema.default("onsite"),
    visibilityStatus: bookingServiceVisibilitySchema.default("draft"),
    requiresManualReview: z.boolean().default(false),
    paymentRequired: z.boolean().default(false),
    priceAmountCents: priceAmountCentsSchema,
    priceCurrency: currencyCodeSchema,
    paymentProvider: bookingPaymentProviderSchema.default("manual_revolut_pro"),
    paymentUrl: z.string().trim().url().nullable().optional(),
    paymentInstructions: z.string().trim().max(2000).nullable().optional(),
    vatRateBasisPoints: z.number().int().min(0).max(100000).default(0),
    virtualMeetingProvider: bookingMeetingProviderSchema.default("none"),
    autoCreateVirtualMeeting: z.boolean().default(true),
    paymentDeadlineMinutes: z
        .number()
        .int()
        .min(BOOKING_PAYMENT_COMPLETION_WINDOW_MINUTES)
        .max(BOOKING_PAYMENT_COMPLETION_WINDOW_MINUTES)
        .default(BOOKING_PAYMENT_COMPLETION_WINDOW_MINUTES),
    metadata: jsonRecordSchema.default({}),
    localeOverrides: localeOverridesSchema,
}).superRefine((data, ctx) => {
    if (data.virtualMeetingProvider === "zoom" && data.durationMinutes > 40) {
        ctx.addIssue({
            code: "custom",
            path: ["virtualMeetingProvider"],
            message: "Free Zoom meetings are limited to services of 40 minutes or less.",
        });
    }
    if (!data.paymentRequired) {
        return;
    }
    if (!data.priceAmountCents || data.priceAmountCents <= 0) {
        ctx.addIssue({
            code: "custom",
            path: ["priceAmountCents"],
            message: "Paid services must have a price greater than zero.",
        });
    }
    if (data.paymentProvider === "manual_revolut_pro" && (!data.paymentUrl || data.paymentUrl.length === 0)) {
        ctx.addIssue({
            code: "custom",
            path: ["paymentUrl"],
            message: "Manual Revolut Pro paid services need a payment link.",
        });
    }
});

export const bookingMarkPaymentVerifiedSchema = z.object({
    reservationId: z.string().uuid(),
    note: z.string().trim().max(400).nullable().optional(),
    autoConfirm: z.boolean().default(true),
});

export const bookingExpireUnpaidReservationsSchema = z.object({
    workspaceScoped: z.boolean().default(true),
});

export type BookingMarkPaymentVerifiedInput = z.infer<typeof bookingMarkPaymentVerifiedSchema>;
export type BookingPaymentStatus = z.infer<typeof bookingPaymentStatusSchema>;
export type BookingPaymentProvider = z.infer<typeof bookingPaymentProviderSchema>;

export const bookingResourceUpsertSchema = z.object({
    id: idSchema.optional(),
    resourceType: bookingResourceTypeSchema,
    name: z.string().trim().min(1).max(160),
    slug: z.string().trim().min(1).max(160),
    isActive: z.boolean().default(true),
    capacityValue: z.number().int().min(1).max(10000).default(1),
    attributesJson: jsonRecordSchema.default({}),
    metadata: jsonRecordSchema.default({}),
});

export const bookingStaffProfileUpsertSchema = z.object({
    id: idSchema.optional(),
    resourceId: idSchema,
    displayName: z.string().trim().min(1).max(160),
    roleLabel: z.string().trim().max(120).nullable().optional(),
    bio: z.string().trim().max(4000).nullable().optional(),
    avatarAssetUrl: z.string().url().nullable().optional(),
    languagesJson: jsonArraySchema.default([]),
    specialtiesJson: jsonArraySchema.default([]),
    contactRulesJson: jsonRecordSchema.default({}),
    isBookable: z.boolean().default(true),
    metadata: jsonRecordSchema.default({}),
});

const locationLocaleOverridesSchema = z
    .object({
        nl: z.object({
            name: z.string().trim().max(160).optional(),
            instructions: z.string().trim().max(4000).optional(),
        }).optional(),
        ar: z.object({
            name: z.string().trim().max(160).optional(),
            instructions: z.string().trim().max(4000).optional(),
        }).optional(),
    })
    .optional();

export const bookingLocationUpsertSchema = z.object({
    id: idSchema.optional(),
    locationType: bookingLocationTypeSchema,
    name: z.string().trim().min(1).max(160),
    slug: z.string().trim().min(1).max(160),
    addressJson: jsonRecordSchema.default({}),
    geoJson: jsonRecordSchema.default({}),
    capacityValue: z.number().int().min(1).max(10000).nullable().optional(),
    instructions: z.string().trim().max(4000).nullable().optional(),
    isActive: z.boolean().default(true),
    metadata: jsonRecordSchema.default({}),
    localeOverrides: locationLocaleOverridesSchema,
});

export const bookingAvailabilityRuleUpsertSchema = z.object({
    id: idSchema.optional(),
    templateProfileId: idSchema.optional().nullable(),
    serviceId: nullableIdSchema,
    resourceId: nullableIdSchema,
    locationId: nullableIdSchema,
    scopeType: bookingRuleScopeSchema,
    ruleType: bookingAvailabilityRuleTypeSchema,
    timezone: z.string().trim().min(1).max(80).refine(isValidIanaTimezone, "Availability timezone must be a valid IANA timezone."),
    weekdayJson: jsonArraySchema.default([]),
    startsOn: z.string().date().nullable().optional(),
    endsOn: z.string().date().nullable().optional(),
    dateJson: jsonRecordSchema.default({}),
    timeWindowsJson: jsonArraySchema.default([]),
    priority: z.number().int().min(0).max(1000).default(100),
    isActive: z.boolean().default(true),
    metadata: jsonRecordSchema.default({}),
});

export const bookingBlackoutWindowUpsertSchema = z.object({
    id: idSchema.optional(),
    serviceId: nullableIdSchema,
    resourceId: nullableIdSchema,
    locationId: nullableIdSchema,
    timezone: z.string().trim().min(1).max(80).default("UTC"),
    startsAt: isoDateTimeSchema,
    endsAt: isoDateTimeSchema,
    reason: z.string().trim().max(240).nullable().optional(),
    source: z.string().trim().max(120).nullable().optional(),
    isActive: z.boolean().default(true),
    metadata: jsonRecordSchema.default({}),
}).refine((input) => new Date(input.endsAt).getTime() > new Date(input.startsAt).getTime(), {
    message: "End time must be after start time.",
    path: ["endsAt"],
}).refine((input) => {
    if (input.id) {
        return true;
    }
    return new Date(input.startsAt).getTime() >= Date.now() - 60_000;
}, {
    message: "Blackout windows cannot start in the past.",
    path: ["startsAt"],
});

export const bookingRuleDefinitionUpsertSchema = z.object({
    id: idSchema.optional(),
    serviceId: nullableIdSchema,
    ruleKey: z.string().trim().min(1).max(120),
    ruleType: z.string().trim().min(1).max(120),
    ruleValueJson: jsonRecordSchema.default({}),
    priority: z.number().int().min(0).max(1000).default(100),
    isActive: z.boolean().default(true),
    metadata: jsonRecordSchema.default({}),
});

const formLocaleOverridesSchema = z
    .object({
        nl: z.object({ title: z.string().trim().max(160).optional() }).optional(),
        ar: z.object({ title: z.string().trim().max(160).optional() }).optional(),
    })
    .optional();

export const bookingFormDefinitionUpsertSchema = z.object({
    id: idSchema.optional(),
    templateProfileId: idSchema,
    formKey: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(160),
    schemaJson: jsonRecordSchema,
    uiSchemaJson: jsonRecordSchema.default({}),
    completionRulesJson: jsonRecordSchema.default({}),
    version: z.number().int().min(1).max(999).default(1),
    isActive: z.boolean().default(true),
    localeOverrides: formLocaleOverridesSchema,
    metadata: jsonRecordSchema.default({}),
});

export const bookingServiceResourceLinkSchema = z.object({
    serviceId: idSchema,
    resourceId: idSchema,
    assignmentMode: z.string().trim().max(80).default("manual"),
    metadata: jsonRecordSchema.default({}),
});

export const bookingServiceLocationLinkSchema = z.object({
    serviceId: idSchema,
    locationId: idSchema,
    isDefault: z.boolean().default(false),
    metadata: jsonRecordSchema.default({}),
});

export const bookingAvailabilityPreviewSchema = z.object({
    serviceId: idSchema,
    resourceId: nullableIdSchema,
    locationId: nullableIdSchema,
    dateRange: z.object({
        start: z.string().date(),
        end: z.string().date(),
    }),
    timezone: z.string().trim().min(1).max(80).refine(isValidIanaTimezone, "Availability timezone must be a valid IANA timezone."),
    partySize: z.number().int().min(1).max(1000).optional(),
}).refine((input) => input.dateRange.end >= input.dateRange.start, {
    message: "Date range end must not be before start.",
    path: ["dateRange", "end"],
}).refine((input) => {
    const start = Date.parse(`${input.dateRange.start}T00:00:00.000Z`);
    const end = Date.parse(`${input.dateRange.end}T00:00:00.000Z`);
    const days = Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1;
    return Number.isFinite(days) && days <= 90;
}, {
    message: "Availability previews may cover at most 90 calendar days.",
    path: ["dateRange", "end"],
});

export const bookingReservationSubmissionSchema = z.object({
    // The browser keeps this stable across retries of one logical submit. The
    // database unique index is the final concurrency fence; the server still
    // accepts legacy callers without a key and derives one from the booking
    // intent.
    idempotencyKey: z.string().trim().min(16).max(128).optional(),
    serviceId: idSchema,
    resourceId: nullableIdSchema,
    locationId: nullableIdSchema,
    scheduledStart: isoDateTimeSchema,
    partySize: z.number().int().min(1).max(1000).default(1),
    reservationTimezone: z.string().trim().min(1).max(80).refine(isValidIanaTimezone, "Reservation timezone must be a valid IANA timezone."),
    customer: z.object({
        fullName: z.string().trim().min(1).max(160),
        email: z.string().email(),
        phone: z.string().trim().max(40).nullable().optional(),
    }),
    intakePayload: boundedPublicJsonRecordSchema.default({}),
    attribution: z.object({
        sourceChannel: z.string().trim().max(120).nullable().optional(),
        sourceCampaign: z.string().trim().max(120).nullable().optional(),
        sourceReferrer: z.string().trim().max(400).nullable().optional(),
        metadata: boundedPublicJsonRecordSchema.default({}),
    }).default({ metadata: {} }),
    consents: bookingConsentsSchema,
    antiAbuse: antiAbuseSchema,
});

export const bookingReservationStatusTransitionSchema = z.object({
    reservationId: idSchema,
    nextStatus: bookingReservationStatusSchema,
    reason: z.string().trim().max(400).nullable().optional(),
});

export const bookingDeliveryStartSchema = z.object({
    reservationId: idSchema,
    signedAgreementId: idSchema.optional(),
    reason: z.string().trim().max(400).nullable().optional(),
});

export const bookingReservationFiltersSchema = z.object({
    statuses: z.array(bookingReservationStatusSchema).optional(),
    status: bookingReservationStatusSchema.optional(),
    serviceId: idSchema.optional(),
    from: isoDateTimeSchema.optional(),
    to: isoDateTimeSchema.optional(),
    search: z.string().trim().max(120).optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(5).max(200).default(25),
    limit: z.number().int().min(1).max(200).default(50),
});

export type BookingTemplateProfileUpsertInput = z.infer<typeof bookingTemplateProfileUpsertSchema>;
export type BookingServiceUpsertInput = z.infer<typeof bookingServiceUpsertSchema>;
export type BookingResourceUpsertInput = z.infer<typeof bookingResourceUpsertSchema>;
export type BookingStaffProfileUpsertInput = z.infer<typeof bookingStaffProfileUpsertSchema>;
export type BookingLocationUpsertInput = z.infer<typeof bookingLocationUpsertSchema>;
export type BookingAvailabilityRuleUpsertInput = z.infer<typeof bookingAvailabilityRuleUpsertSchema>;
export type BookingBlackoutWindowUpsertInput = z.infer<typeof bookingBlackoutWindowUpsertSchema>;
export type BookingRuleDefinitionUpsertInput = z.infer<typeof bookingRuleDefinitionUpsertSchema>;
export type BookingFormDefinitionUpsertInput = z.infer<typeof bookingFormDefinitionUpsertSchema>;
export type BookingAvailabilityPreviewInput = z.infer<typeof bookingAvailabilityPreviewSchema>;
export type BookingReservationSubmissionInput = z.infer<typeof bookingReservationSubmissionSchema>;
export type BookingReservationStatusTransitionInput = z.infer<typeof bookingReservationStatusTransitionSchema>;
export type BookingDeliveryStartInput = z.infer<typeof bookingDeliveryStartSchema>;
export type BookingReservationFiltersInput = z.infer<typeof bookingReservationFiltersSchema>;
