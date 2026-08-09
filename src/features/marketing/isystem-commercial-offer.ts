export const ISYSTEM_COMMERCIAL_OFFER = {
    fitCall: {
        name: "Systems Fit Call",
        priceEur: 0,
        durationMinutes: 30,
        bookingPath: "/booking",
    },
    blueprint: {
        name: "Systems Blueprint",
        priceEur: 490,
        durationMinutes: 90,
        bookingPath: "/booking",
        implementationCreditDays: 30,
    },
    foundation: {
        name: "Foundation System",
        setupPriceEur: 3_900,
        monthlyPriceEur: 249,
        deliveryBusinessDays: 21,
    },
    growth: {
        name: "Growth Operating System",
        setupPriceEur: 7_500,
        monthlyPriceEur: 699,
        deliveryBusinessDays: 30,
    },
    embedded: {
        name: "Embedded Systems Engagement",
        pricing: "proposal-only",
        bookingPath: "/contact",
    },
    vatRatePercent: 21,
    minimumCareTermMonths: 6,
    changeRateEurPerHour: 125,
    paymentProvider: "paypal_checkout",
} as const;

export type IsystemOfferId = "fitCall" | "blueprint" | "foundation" | "growth" | "embedded";

export type IsystemBookingServiceKey = "systems-fit-call" | "systems-blueprint";

export const ISYSTEM_PUBLIC_OFFER_NAMES = {
    fitCall: { en: "Systems Fit Call", nl: "Systems Fit Call", ar: "مكالمة ملاءمة الأنظمة" },
    blueprint: { en: "Systems Blueprint", nl: "Systems Blueprint", ar: "مخطط الأنظمة" },
    foundation: { en: "Foundation System", nl: "Foundation-systeem", ar: "نظام التأسيس" },
    growth: { en: "Growth Operating System", nl: "Growth-systeem", ar: "نظام تشغيل النمو" },
    embedded: { en: "Embedded Systems Engagement", nl: "Embedded systeemtraject", ar: "تعاون أنظمة مدمج" },
} as const;

export function getIsystemPublicOfferName(offerId: IsystemOfferId, locale: "en" | "nl" | "ar" = "en"): string {
    return ISYSTEM_PUBLIC_OFFER_NAMES[offerId][locale];
}

/**
 * The booking catalog is a runtime projection of the commercial registry.
 * Database rows remain operational data, but public booking facts must be
 * reconciled against this map before they are displayed or used for checkout.
 */
export const ISYSTEM_BOOKING_SERVICE_FACTS = {
    "systems-fit-call": {
        offerId: "fitCall",
        serviceKey: "systems-fit-call",
        serviceType: "systems_fit_call",
        title: ISYSTEM_COMMERCIAL_OFFER.fitCall.name,
        titleI18n: ISYSTEM_PUBLIC_OFFER_NAMES.fitCall,
        durationMinutes: ISYSTEM_COMMERCIAL_OFFER.fitCall.durationMinutes,
        paymentRequired: false,
        priceAmountCents: 0,
        priceCurrency: "EUR",
        paymentProvider: "paypal_checkout",
        implementationCreditDays: null,
        vatRatePercent: ISYSTEM_COMMERCIAL_OFFER.vatRatePercent,
    },
    "systems-blueprint": {
        offerId: "blueprint",
        serviceKey: "systems-blueprint",
        serviceType: "systems_blueprint",
        title: ISYSTEM_COMMERCIAL_OFFER.blueprint.name,
        titleI18n: ISYSTEM_PUBLIC_OFFER_NAMES.blueprint,
        durationMinutes: ISYSTEM_COMMERCIAL_OFFER.blueprint.durationMinutes,
        paymentRequired: true,
        priceAmountCents: ISYSTEM_COMMERCIAL_OFFER.blueprint.priceEur * 100,
        priceCurrency: "EUR",
        paymentProvider: ISYSTEM_COMMERCIAL_OFFER.paymentProvider,
        implementationCreditDays: ISYSTEM_COMMERCIAL_OFFER.blueprint.implementationCreditDays,
        vatRatePercent: ISYSTEM_COMMERCIAL_OFFER.vatRatePercent,
    },
} as const;

export function getIsystemBookingServiceFacts(serviceKey: string) {
    return ISYSTEM_BOOKING_SERVICE_FACTS[serviceKey as IsystemBookingServiceKey];
}

export const ISYSTEM_PUBLIC_OFFER_NOTES = {
    vatExclusion: {
        en: "Prices exclude 21% VAT, third-party services, and metered AI usage.",
        nl: "Prijzen zijn exclusief 21% btw, externe diensten en gemeten AI-gebruik.",
        ar: "الأسعار لا تشمل ضريبة القيمة المضافة بنسبة 21% أو الخدمات الخارجية أو استخدام الذكاء الاصطناعي المقاس.",
    },
    fitCall: {
        en: "A free 30-minute qualification conversation with Hossam. It is not a free audit or report.",
        nl: "Een gratis kwalificatiegesprek van 30 minuten met Hossam. Geen gratis audit of rapport.",
        ar: "محادثة تأهيل مجانية لمدة 30 دقيقة مع حسام، وليست تدقيقًا أو تقريرًا مجانيًا.",
    },
    blueprint: {
        en: "A 90-minute working session and written system map. The €490 fee is credited toward implementation if contracted within 30 days.",
        nl: "Een werksessie van 90 minuten en een schriftelijke systeembeschrijving. De €490 wordt binnen 30 dagen verrekend met implementatie bij opdracht.",
        ar: "جلسة عمل لمدة 90 دقيقة وخريطة نظام مكتوبة. تُخصم رسوم €490 من التنفيذ عند التعاقد خلال 30 يومًا.",
    },
} as const;

export function getIsystemCommercialSummary(locale: "en" | "nl" | "ar" = "en"): string {
    const fitCall = ISYSTEM_BOOKING_SERVICE_FACTS["systems-fit-call"];
    const blueprint = ISYSTEM_BOOKING_SERVICE_FACTS["systems-blueprint"];
    const foundation = ISYSTEM_COMMERCIAL_OFFER.foundation;
    const growth = ISYSTEM_COMMERCIAL_OFFER.growth;
    const month = locale === "nl" ? "maand" : locale === "ar" ? "شهريًا" : "month";
    const setup = locale === "nl" ? "eenmalig" : locale === "ar" ? "إعداد" : "setup";
    const minutes = locale === "nl" ? "minuten" : locale === "ar" ? "دقيقة" : "minutes";

    return [
        `${fitCall.titleI18n[locale]} — ${formatCommercialPrice(0, locale)} · ${fitCall.durationMinutes} ${minutes}`,
        `${blueprint.titleI18n[locale]} — ${formatCommercialPrice(blueprint.priceAmountCents / 100, locale)} · ${blueprint.durationMinutes} ${minutes}`,
        `${getIsystemPublicOfferName("foundation", locale)} — ${formatCommercialPrice(foundation.setupPriceEur, locale)} ${setup} + ${formatCommercialPrice(foundation.monthlyPriceEur, locale)}/${month}`,
        `${getIsystemPublicOfferName("growth", locale)} — ${formatCommercialPrice(growth.setupPriceEur, locale)} ${setup} + ${formatCommercialPrice(growth.monthlyPriceEur, locale)}/${month}`,
        ISYSTEM_PUBLIC_OFFER_NOTES.vatExclusion[locale],
    ].join(" · ");
}

export type IsystemCommercialCopyContradiction =
    | "contradictory-free-paid"
    | "legacy-paid-discovery"
    | "legacy-basic-pro-pricing"
    | "legacy-revolut-checkout";

const COMMERCIAL_COPY_CHECKS: ReadonlyArray<{
    code: IsystemCommercialCopyContradiction;
    pattern: RegExp;
}> = [
    {
        code: "contradictory-free-paid",
        pattern: /\b(?:free\s+paid|paid\s+free)\b/i,
    },
    {
        code: "legacy-paid-discovery",
        pattern: /\bpaid\b[^\n.]{0,80}\b(?:30[ -]?minute|30\s*min|one[ -]?hour|1[ -]?hour)\b[^\n.]{0,80}\b(?:discovery|strategy|advisory|consultation|consult)\b/i,
    },
    {
        code: "legacy-basic-pro-pricing",
        pattern: /\b(?:basic|pro)\b[^\n.]{0,40}\b(?:from|starting at|vanaf)\b[^\n.]{0,20}€\s*(?:99|299|499)|€\s*(?:99|299|499)[^\n.]{0,30}\/(?:month|maand)/i,
    },
    {
        code: "legacy-revolut-checkout",
        pattern: /\brevolut(?:\s+pro)?\b[^\n.]{0,80}\b(?:payment|checkout|betaling|confirmed|verified)\b/i,
    },
];

export function findIsystemCommercialCopyContradictions(
    copy: string,
): IsystemCommercialCopyContradiction[] {
    return COMMERCIAL_COPY_CHECKS
        .filter(({ pattern }) => pattern.test(copy))
        .map(({ code }) => code);
}

export function formatCommercialPrice(valueEur: number, locale: "en" | "nl" | "ar" = "en"): string {
    if (valueEur === 0) {
        if (locale === "nl") return "Gratis";
        if (locale === "ar") return "مجانًا";
        return "Free";
    }

    const thousandsSeparator = locale === "nl" ? "." : ",";
    const formatted = Math.round(valueEur)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);

    return `€${formatted}`;
}
