import type { Json } from "@/shared/lib/supabase/database.types";

export const BOOKING_TEMPLATE_KEYS = ["consultation", "real_estate", "horeca", "custom"] as const;
export const BOOKING_ENTITY_MODES = ["service", "listing", "experience", "inquiry"] as const;
export const BOOKING_SLOT_STRATEGIES = ["fixed_slot", "property_aware", "capacity_seating", "flexible_window"] as const;

export type BookingTemplateKey = (typeof BOOKING_TEMPLATE_KEYS)[number];
export type BookingEntityMode = (typeof BOOKING_ENTITY_MODES)[number];
export type BookingSlotStrategy = (typeof BOOKING_SLOT_STRATEGIES)[number];

export interface BookingSeededCopyBlock {
    key: string;
    label: string;
    content: string;
    contentNl?: string;
    contentAr?: string;
}

export interface BookingSeededServiceDefinition {
    serviceKey: string;
    serviceType: string;
    title: string;
    subtitle: string;
    description: string;
    durationMinutes: number;
    capacityMode: "single" | "group" | "pooled" | "capacity";
    locationMode: "remote" | "onsite" | "hybrid";
    requiresManualReview: boolean;
    metadata?: Record<string, unknown>;
}

export interface BookingSeededContentBundle {
    audience: string[];
    positioning: BookingSeededCopyBlock[];
    trustSignals: string[];
    nextSteps: string[];
}

export interface BookingTemplateAdapterDefinition {
    templateKey: BookingTemplateKey;
    displayName: string;
    entityMode: BookingEntityMode;
    slotStrategy: BookingSlotStrategy;
    defaultServiceTypes: string[];
    defaultIntakeSchema: {
        version: string;
        fields: Array<{
            id: string;
            type: "text" | "textarea" | "select" | "radio" | "checkbox" | "number" | "date";
            label: string;
            required: boolean;
            options?: string[];
        }>;
    };
    availabilityPolicy: {
        requiresResourceSelection: boolean;
        requiresLocationSelection: boolean;
        supportsCapacity: boolean;
    };
    reservationProjection: {
        primaryEntityLabel: string;
        secondaryEntityLabel: string | null;
    };
    analyticsMapping: {
        eventNamespace: string;
        defaultSourceChannel: string;
    };
    seededServices?: BookingSeededServiceDefinition[];
    seededContent?: BookingSeededContentBundle;
    publicSections: string[];
    dashboardModules: string[];
}

export const BOOKING_TEMPLATE_ADAPTERS: Record<BookingTemplateKey, BookingTemplateAdapterDefinition> = {
    consultation: {
        templateKey: "consultation",
        displayName: "Consultation",
        entityMode: "service",
        slotStrategy: "fixed_slot",
        defaultServiceTypes: ["systems_fit_call", "systems_blueprint"],
        defaultIntakeSchema: {
            version: "1.0.0",
            fields: [
                { id: "goal", type: "textarea", label: "What do you need help with?", required: true },
                { id: "urgency", type: "select", label: "How urgent is this?", required: true, options: ["Low", "Medium", "High"] },
                { id: "preferred_language", type: "select", label: "Preferred language", required: false, options: ["English", "Dutch", "Arabic"] },
            ],
        },
        availabilityPolicy: {
            requiresResourceSelection: false,
            requiresLocationSelection: false,
            supportsCapacity: false,
        },
        reservationProjection: {
            primaryEntityLabel: "Service",
            secondaryEntityLabel: "Advisor",
        },
        analyticsMapping: {
            eventNamespace: "booking_consultation",
            defaultSourceChannel: "consultation_flow",
        },
        seededServices: [
            {
                serviceKey: "systems-fit-call",
                serviceType: "systems_fit_call",
                title: "Systems Fit Call",
                subtitle: "Free 30-minute qualification conversation with the founder.",
                description: "Clarify the outcome you need, your current setup, and whether the service is a sensible mutual fit. This call qualifies the next step; it does not include an audit, written report, roadmap, or implementation work.",
                durationMinutes: 30,
                capacityMode: "single",
                locationMode: "remote",
                requiresManualReview: false,
                metadata: {
                    pillar: "digital_systems_partner",
                    consultationTheme: "systems_fit",
                    priceLabel: "Free",
                    paymentProvider: "none",
                },
            },
            {
                serviceKey: "systems-blueprint",
                serviceType: "systems_blueprint",
                title: "Systems Blueprint",
                subtitle: "A 90-minute working session with a written system map, priorities, and fixed proposal.",
                description: "For situations that need deeper diagnosis before implementation. The €490 fee is paid through PayPal Checkout and credited in full to implementation when a contract is signed within 30 days.",
                durationMinutes: 90,
                capacityMode: "single",
                locationMode: "remote",
                requiresManualReview: false,
                metadata: {
                    pillar: "digital_systems_partner",
                    consultationTheme: "systems_blueprint",
                    priceLabel: "€490",
                    paymentProvider: "paypal_checkout",
                    implementationCreditDays: 30,
                },
            },
        ],
        seededContent: {
            audience: [
                "SME founders and operators",
                "Operations-led service businesses",
                "Hospitality, legal, education, media, and real-estate teams",
                "Enterprise teams needing embedded specialist support",
            ],
            positioning: [
                {
                    key: "hero_heading",
                    label: "Hero heading",
                    content: "Start with the free Systems Fit Call. Use the Blueprint only when the complexity warrants it.",
                    contentNl: "Begin met de gratis Systems Fit Call. Gebruik de Blueprint alleen als de complexiteit dat vraagt.",
                    contentAr: "ابدأ بمكالمة ملاءمة الأنظمة المجانية، واستخدم خارطة الأنظمة فقط عندما تستدعي درجة التعقيد ذلك.",
                },
                {
                    key: "hero_body",
                    label: "Hero body",
                    content: "The 30-minute Fit Call qualifies the need and mutual fit; it is not a free audit or report. The €490, 90-minute Systems Blueprint provides a written system map, prioritized plan, and fixed proposal.",
                    contentNl: "De Fit Call van 30 minuten beoordeelt de vraag en de wederzijdse fit; het is geen gratis audit of rapport. De Systems Blueprint van €490 en 90 minuten levert een geschreven systeemkaart, prioriteitenplan en vaste offerte op.",
                    contentAr: "تؤهل مكالمة الملاءمة لمدة 30 دقيقة الحاجة ومدى الملاءمة المتبادلة، وليست تدقيقًا أو تقريرًا مجانيًا. وتوفر خارطة الأنظمة لمدة 90 دقيقة بقيمة €490 خريطة مكتوبة للنظام وخطة مرتبة حسب الأولوية وعرضًا بسعر ثابت.",
                },
                {
                    key: "value_proposition",
                    label: "Value proposition",
                    content: "We design systems that help businesses operate, communicate, and grow with more clarity—combining strategic thinking, technical implementation, and practical AI execution in one focused partnership.",
                    contentNl: "Wij ontwerpen systemen die bedrijven helpen helderder te werken, communiceren en groeien — door strategisch denken, technische implementatie en praktische AI-uitvoering te combineren in één doelgericht partnerschap.",
                    contentAr: "نصمم أنظمة تساعد الشركات على العمل والتواصل والنمو بوضوح أكبر - مع الجمع بين التفكير الاستراتيجي والتنفيذ التقني والتطبيق العملي للذكاء الاصطناعي في شراكة واحدة مركزة.",
                },
                {
                    key: "cta_microcopy",
                    label: "CTA microcopy",
                    content: "Book the Fit Call first. If a Blueprint is the right next step, pay securely through PayPal Checkout; the €490 is credited to implementation when contracted within 30 days.",
                    contentNl: "Plan eerst de Fit Call. Is een Blueprint de juiste vervolgstap, betaal dan veilig via PayPal Checkout; de €490 wordt verrekend bij een implementatiecontract binnen 30 dagen.",
                    contentAr: "احجز مكالمة الملاءمة أولًا. وإذا كانت خارطة الأنظمة هي الخطوة المناسبة، فادفع بأمان عبر PayPal Checkout؛ تُحتسب قيمة €490 ضمن التنفيذ عند التعاقد خلال 30 يومًا.",
                },
            ],
            trustSignals: [
                "Netherlands-based digital systems partner",
                "One accountable founder from qualification through ongoing care",
                "Transparent entry offers and fixed implementation prices",
                "PayPal Checkout for the paid Systems Blueprint",
            ],
            nextSteps: [
                "Start with the free Systems Fit Call.",
                "Recommend the Systems Blueprint only when deeper diagnosis is warranted.",
                "Issue a fixed Foundation, Growth, or scoped service-agreement proposal.",
            ],
        },
        publicSections: ["booking_hero", "service_selector", "advisor_selector", "slot_picker", "intake_form", "confirmation"],
        dashboardModules: ["overview", "setup", "availability", "inbox", "analytics"],
    },
    real_estate: {
        templateKey: "real_estate",
        displayName: "Real Estate",
        entityMode: "listing",
        slotStrategy: "property_aware",
        defaultServiceTypes: ["property_viewing", "valuation_consultation", "buyer_call"],
        defaultIntakeSchema: {
            version: "1.0.0",
            fields: [
                { id: "listing_reference", type: "text", label: "Listing reference", required: false },
                { id: "intent", type: "radio", label: "Are you buying or selling?", required: true, options: ["Buying", "Selling"] },
                { id: "budget", type: "text", label: "Budget range", required: false },
            ],
        },
        availabilityPolicy: {
            requiresResourceSelection: true,
            requiresLocationSelection: true,
            supportsCapacity: false,
        },
        reservationProjection: {
            primaryEntityLabel: "Listing",
            secondaryEntityLabel: "Agent",
        },
        analyticsMapping: {
            eventNamespace: "booking_real_estate",
            defaultSourceChannel: "property_flow",
        },
        publicSections: ["listing_context", "service_selector", "agent_selector", "slot_picker", "intent_form", "confirmation"],
        dashboardModules: ["overview", "setup", "availability", "inbox", "customization", "analytics"],
    },
    horeca: {
        templateKey: "horeca",
        displayName: "Horeca",
        entityMode: "experience",
        slotStrategy: "capacity_seating",
        defaultServiceTypes: ["table_reservation", "private_dining", "tasting_menu"],
        defaultIntakeSchema: {
            version: "1.0.0",
            fields: [
                { id: "party_size", type: "number", label: "Party size", required: true },
                { id: "occasion", type: "text", label: "Occasion", required: false },
                { id: "dietary_requirements", type: "textarea", label: "Dietary requirements", required: false },
            ],
        },
        availabilityPolicy: {
            requiresResourceSelection: false,
            requiresLocationSelection: true,
            supportsCapacity: true,
        },
        reservationProjection: {
            primaryEntityLabel: "Experience",
            secondaryEntityLabel: "Table area",
        },
        analyticsMapping: {
            eventNamespace: "booking_horeca",
            defaultSourceChannel: "reservation_flow",
        },
        publicSections: ["experience_selector", "location_selector", "slot_picker", "guest_details", "confirmation"],
        dashboardModules: ["overview", "setup", "availability", "inbox", "analytics"],
    },
    custom: {
        templateKey: "custom",
        displayName: "Custom",
        entityMode: "service",
        slotStrategy: "flexible_window",
        defaultServiceTypes: ["custom_service"],
        defaultIntakeSchema: {
            version: "1.0.0",
            fields: [
                { id: "request_summary", type: "textarea", label: "Tell us about your request", required: true },
            ],
        },
        availabilityPolicy: {
            requiresResourceSelection: false,
            requiresLocationSelection: false,
            supportsCapacity: false,
        },
        reservationProjection: {
            primaryEntityLabel: "Service",
            secondaryEntityLabel: null,
        },
        analyticsMapping: {
            eventNamespace: "booking_custom",
            defaultSourceChannel: "custom_booking_flow",
        },
        publicSections: ["service_selector", "slot_picker", "intake_form", "confirmation"],
        dashboardModules: ["overview", "setup", "availability", "inbox"],
    },
};

export interface BookingAvailabilityDateSlot {
    start: string;
    end: string;
    status: "available" | "blocked" | "manual_review";
    reason: string | null;
}

export interface BookingAvailabilityResponse {
    bookingState: "active" | "gated" | "unavailable";
    serviceSummary: {
        id: string;
        title: string;
        durationMinutes: number;
        templateKey: BookingTemplateKey;
        virtualMeetingProvider: BookingMeetingProvider;
        autoCreateVirtualMeeting: boolean;
        meetingAvailability: "automatic" | "manual" | "unavailable";
        /** Empty means the service has no explicit mapping and accepts any active workspace option. */
        resourceIds?: string[];
        locationIds?: string[];
    } | null;
    resourceOptions: Array<{ id: string; name: string; resourceType: string }>;
    locationOptions: Array<{ id: string; name: string; locationType: string }>;
    dateSlots: BookingAvailabilityDateSlot[];
    rulesNotices: string[];
    /**
     * IANA business timezone driving the published availability rules.
     * The slot `start`/`end` ISO strings are UTC; the client formats to the
     * viewer's local timezone and labels the business timezone alongside
     * when the two differ. Null when no rules are configured.
     */
    businessTimezone: string | null;
}

export interface BookingDashboardSummary {
    workspaceId: string;
    templateProfiles: number;
    publishedProfiles: number;
    services: number;
    reservations: number;
    pendingReviewReservations: number;
    confirmedReservations: number;
    completedReservations: number;
    cancelledReservations: number;
    upcomingReservations: number;
    topSourceChannel: string | null;
}

export type BookingPaymentProvider = "manual_revolut_pro" | "paypal_checkout";
export type BookingMeetingProvider = "none" | "google_meet" | "zoom";

export interface BookingPricePresentation {
    netAmountCents: number;
    vatRateBasisPoints: number;
    vatAmountCents: number;
    grossAmountCents: number;
    pricingVersion: string;
}

export interface BookingPaymentDirective {
    provider: BookingPaymentProvider;
    amountCents: number;
    netAmountCents: number;
    vatRateBasisPoints: number;
    vatAmountCents: number;
    grossAmountCents: number;
    pricingVersion: string;
    currency: string;
    paymentUrl: string;
    paymentReference: string;
    customerInstructions: string | null;
    deadlineAt: string;
}

export type BookingSubmissionNextStepsKind =
    | "pending_review"
    | "pending_confirmation_payment"
    | "pending_confirmation"
    | "captured";

export interface BookingSubmissionResult {
    reservationId: string;
    publicReference: string;
    status: string;
    /** English fallback list — clients should prefer rendering from `nextStepsKind` + locale dictionary. */
    nextSteps: string[];
    nextStepsKind: BookingSubmissionNextStepsKind;
    consultationAccountProvisioned: boolean;
    notificationState: {
        queued: boolean;
        eventType: string;
    };
    calendarExtensionState: "not_configured" | "pending" | "ready" | "failed";
    paymentExtensionState: "not_configured" | "pending" | "payment_requested";
    payment: BookingPaymentDirective | null;
}

export interface BookingPublicCatalog {
    bookingState: "active" | "gated" | "unavailable";
    workspace: {
        id: string;
        name: string;
        slug: string;
        tier: "basic" | "pro";
    } | null;
    templateKey: BookingTemplateKey;
    profile: {
        id: string;
        profileKey: string;
        status: string;
        settingsJson: Record<string, unknown>;
    } | null;
    services: Array<{
        id: string;
        serviceKey: string;
        title: string;
        subtitle: string | null;
        description: string | null;
        durationMinutes: number;
        capacityMode: string;
        locationMode: string;
        requiresManualReview: boolean;
        paymentRequired: boolean;
        priceAmountCents: number | null;
        priceCurrency: string;
        paymentProvider: BookingPaymentProvider;
        paymentUrl: string | null;
        paymentInstructions: string | null;
        paymentDeadlineMinutes: number;
        implementationCreditDays: number | null;
        vatRatePercent: number | null;
        vatRateBasisPoints: number;
        netAmountCents: number | null;
        vatAmountCents: number | null;
        grossAmountCents: number | null;
        virtualMeetingProvider: BookingMeetingProvider;
        autoCreateVirtualMeeting: boolean;
        meetingAvailability: "automatic" | "manual" | "unavailable";
        /** Empty means the service has no explicit resource mapping. */
        resourceIds?: string[];
        /** Empty means the service has no explicit location mapping. */
        locationIds?: string[];
    }>;
    resources: Array<{
        id: string;
        name: string;
        resourceType: string;
    }>;
    locations: Array<{
        id: string;
        name: string;
        locationType: string;
        instructions: string | null;
    }>;
    formDefinitions: Array<{
        id: string;
        title: string;
        formKey: string;
        schemaJson: Json;
    }>;
    message: string | null;
}

export function normalizeJsonRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    return value as Record<string, unknown>;
}

export function asJson(value: Record<string, unknown> | Array<unknown> | string | number | boolean | null): Json {
    return value as Json;
}
