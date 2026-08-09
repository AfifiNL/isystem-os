import { z } from "zod";
import type { Locale } from "@/features/templates/types";

// LocalizedText follows the site-chrome convention: en is the canonical
// fallback, nl/ar are optional. Read paths must use pickPopupText() so a
// missing locale silently falls back to en instead of rendering "undefined".
export interface PopupLocalizedText {
    en: string;
    nl?: string;
    ar?: string;
}

export const POPUP_TEMPLATE_KINDS = [
    "newsletter-classic",
    "newsletter-minimal",
    "booking-promo",
    "booking-urgency",
] as const;

export type PopupTemplateKind = (typeof POPUP_TEMPLATE_KINDS)[number];

export const POPUP_TRIGGER_TYPES = ["exit_intent", "timed"] as const;
export type PopupTriggerType = (typeof POPUP_TRIGGER_TYPES)[number];

export const POPUP_LOCALES = ["en", "nl", "ar"] as const;

const localizedRequiredSchema = z.object({
    en: z.string().trim().min(1, "English text is required."),
    nl: z.string().trim().min(1).optional(),
    ar: z.string().trim().min(1).optional(),
});

const localizedOptionalSchema = z.object({
    en: z.string().trim().optional(),
    nl: z.string().trim().optional(),
    ar: z.string().trim().optional(),
});

// Discriminated trigger config. Each trigger has its own knobs; the resolver
// and host both narrow on `type` before reading config.
const exitIntentTriggerSchema = z.object({
    type: z.literal("exit_intent"),
    config: z.object({}).strict().default({}),
});

const timedTriggerSchema = z.object({
    type: z.literal("timed"),
    config: z.object({
        // Minimum 500 ms so we never fire before the page has visually settled.
        // 5 minutes max prevents accidentally setting "30 minutes" and never
        // seeing the popup during testing.
        delay_ms: z.number().int().min(500).max(5 * 60 * 1000),
    }),
});

export const popupTriggerSchema = z.discriminatedUnion("type", [
    exitIntentTriggerSchema,
    timedTriggerSchema,
]);

export type PopupTrigger = z.infer<typeof popupTriggerSchema>;

// Path glob patterns are matched against the LOCALE-STRIPPED pathname
// ("/blog/foo", not "/ar/blog/foo"). Supported globs: literal segments,
// trailing /* (matches any subpath), single * inside a segment.
const pathGlobSchema = z.string().trim().min(1).max(180).regex(
    /^\/[a-zA-Z0-9\-._~/*]*$/,
    "Path patterns must start with / and use safe URL characters.",
);

export const popupAudienceSchema = z.object({
    locales: z.array(z.enum(POPUP_LOCALES)).optional(),
    include_paths: z.array(pathGlobSchema).max(20).optional(),
    exclude_paths: z.array(pathGlobSchema).max(20).optional(),
});

export type PopupAudience = z.infer<typeof popupAudienceSchema>;

export const popupContentSchema = z.object({
    eyebrow: localizedOptionalSchema.optional(),
    title: localizedRequiredSchema,
    body: localizedRequiredSchema,
    ctaLabel: localizedRequiredSchema,
    ctaHref: z.string().trim().min(1).max(500),
    dismissLabel: localizedOptionalSchema.optional(),
});

export type PopupContent = z.infer<typeof popupContentSchema>;

// Full row schema — used by server actions on writes. The DB column layout
// is normalized (separate trigger_type / trigger_config columns); the zod
// schema reshapes them into a single discriminated trigger object on the
// client because that's far easier to validate and edit.
export const popupConfigSchema = z.object({
    name: z.string().trim().min(1).max(120),
    template_kind: z.enum(POPUP_TEMPLATE_KINDS),
    trigger: popupTriggerSchema,
    content: popupContentSchema,
    audience: popupAudienceSchema.default({}),
    starts_at: z.string().datetime({ offset: true }).nullable().optional(),
    ends_at: z.string().datetime({ offset: true }).nullable().optional(),
    priority: z.number().int().min(0).max(1000).default(0),
    dismissal_ttl_seconds: z.number().int().min(0).max(365 * 24 * 3600).default(7 * 24 * 3600),
    is_active: z.boolean().default(false),
});

export type PopupConfigInput = z.infer<typeof popupConfigSchema>;

// Server-resolved popup as it ships to the public client. Stripped of
// sensitive / unused fields. Trigger is denormalized for the host to read
// directly without a second discriminator pass.
export interface ResolvedPopup {
    id: string;
    template_kind: PopupTemplateKind;
    trigger: PopupTrigger;
    content: PopupContent;
    dismissal_ttl_seconds: number;
}

// Public event submission. Used by the host whenever the popup renders, the
// user dismisses it, or clicks the CTA. visitor_id / session_id come from
// localStorage and are NOT trusted for authorization — they're frequency
// counters only.
export const popupEventSchema = z.object({
    popupId: z.string().uuid(),
    workspaceId: z.string().uuid(),
    eventType: z.enum(["impression", "dismiss", "convert"]),
    visitorId: z.string().trim().max(120).optional(),
    sessionId: z.string().trim().max(120).optional(),
    locale: z.enum(POPUP_LOCALES).optional(),
    path: z.string().trim().max(180).optional(),
    referrer: z.string().trim().max(500).optional(),
    utmSource: z.string().trim().max(120).optional(),
    utmMedium: z.string().trim().max(120).optional(),
    utmCampaign: z.string().trim().max(120).optional(),
});

export type PopupEventPayload = z.infer<typeof popupEventSchema>;

export function pickPopupText(value: PopupLocalizedText | undefined, locale: Locale): string {
    if (!value) return "";
    if (locale === "nl" && value.nl) return value.nl;
    if (locale === "ar" && value.ar) return value.ar;
    return value.en ?? "";
}

export function pickOptionalPopupText(
    value: { en?: string; nl?: string; ar?: string } | undefined,
    locale: Locale,
): string | undefined {
    if (!value) return undefined;
    if (locale === "nl" && value.nl) return value.nl;
    if (locale === "ar" && value.ar) return value.ar;
    return value.en || undefined;
}

// Glob match: "/" → exact "/"; "/blog" → exact; "/blog/*" → "/blog" or any
// path that starts with "/blog/". Single intra-segment wildcards aren't
// supported on purpose (every real-world need has been a path-prefix match,
// and prefix-only keeps the audience-resolver loop trivially fast).
export function matchPathGlob(path: string, glob: string): boolean {
    if (glob === path) return true;
    if (glob.endsWith("/*")) {
        const prefix = glob.slice(0, -2);
        if (path === prefix) return true;
        return path.startsWith(`${prefix}/`);
    }
    return false;
}

export function popupMatchesAudience(
    audience: PopupAudience | null | undefined,
    ctx: { locale: Locale; localeStrippedPath: string },
): boolean {
    if (!audience) return true;
    if (audience.locales && audience.locales.length > 0 && !audience.locales.includes(ctx.locale)) {
        return false;
    }
    if (audience.exclude_paths?.some((g) => matchPathGlob(ctx.localeStrippedPath, g))) {
        return false;
    }
    if (audience.include_paths && audience.include_paths.length > 0) {
        return audience.include_paths.some((g) => matchPathGlob(ctx.localeStrippedPath, g));
    }
    return true;
}

// Default content seeds for each template, used when the admin clicks
// "create from template". Editable from the editor; this is the starting
// point so admins don't stare at empty fields.
export const POPUP_TEMPLATE_DEFAULTS: Record<PopupTemplateKind, {
    name: string;
    content: PopupContent;
    trigger: PopupTrigger;
}> = {
    "newsletter-classic": {
        name: "Newsletter — classic",
        content: {
            eyebrow: { en: "Workspace newsletter", nl: "Workspace-nieuwsbrief", ar: "نشرة مساحة العمل" },
            title: {
                en: "Get the Systems Brief",
                nl: "Ontvang de Systems Brief",
                ar: "احصل على موجز الأنظمة",
            },
            body: {
                en: "One short, source-backed note every other week on turning expertise into a governed digital system.",
                nl: "Elke twee weken een korte, brongebonden notitie over expertise omzetten in een governed digitaal systeem.",
                ar: "ملاحظة قصيرة مدعومة بالمصادر كل أسبوعين حول تحويل الخبرة إلى نظام رقمي محكوم.",
            },
            ctaLabel: { en: "Subscribe", nl: "Inschrijven", ar: "اشترك" },
            ctaHref: "/newsletter",
            dismissLabel: { en: "Maybe later", nl: "Misschien later", ar: "ربما لاحقًا" },
        },
        trigger: { type: "timed", config: { delay_ms: 8_000 } },
    },
    "newsletter-minimal": {
        name: "Newsletter — minimal",
        content: {
            title: {
                en: "Stay in the loop",
                nl: "Blijf op de hoogte",
                ar: "ابق على اطلاع",
            },
            body: {
                en: "Two short emails per month. Unsubscribe any time.",
                nl: "Twee korte e-mails per maand. Altijd uitschrijfbaar.",
                ar: "رسالتان قصيرتان شهريًا. ألغِ الاشتراك في أي وقت.",
            },
            ctaLabel: { en: "Join", nl: "Aanmelden", ar: "انضم" },
            ctaHref: "/newsletter",
        },
        trigger: { type: "exit_intent", config: {} },
    },
    "booking-promo": {
        name: "Booking — promo",
        content: {
            eyebrow: { en: "Limited slots", nl: "Beperkte plekken", ar: "مواعيد محدودة" },
            title: {
                en: "Book the free Systems Fit Call",
                nl: "Boek de gratis Systems Fit Call",
                ar: "احجز مكالمة ملاءمة الأنظمة المجانية",
            },
            body: {
                en: "A 30-minute qualification conversation with the workspace team about the next accountable system decision.",
                nl: "Een kwalificerend gesprek van 30 minuten met het workspaceteam over de volgende accountable systeemkeuze.",
                ar: "محادثة تأهيلية لمدة 30 دقيقة مع فريق مساحة العمل حول قرار النظام المسؤول التالي.",
            },
            ctaLabel: { en: "Book the Fit Call", nl: "Boek de Fit Call", ar: "احجز مكالمة الملاءمة" },
            ctaHref: "/booking",
            dismissLabel: { en: "Not now", nl: "Niet nu", ar: "ليس الآن" },
        },
        trigger: { type: "timed", config: { delay_ms: 15_000 } },
    },
    "booking-urgency": {
        name: "Booking — urgency",
        content: {
            eyebrow: { en: "Wait — before you go", nl: "Wacht — voordat je vertrekt", ar: "انتظر — قبل أن تغادر" },
            title: {
                en: "Two slots left this week",
                nl: "Nog twee plekken deze week",
                ar: "بقي موعدان هذا الأسبوع",
            },
            body: {
                en: "Pick a time that works. We'll do the rest.",
                nl: "Kies een tijd die past. Wij regelen de rest.",
                ar: "اختر الوقت المناسب. سنتولى الباقي.",
            },
            ctaLabel: { en: "Reserve a slot", nl: "Reserveer een plek", ar: "احجز موعدًا" },
            ctaHref: "/booking",
            dismissLabel: { en: "Close", nl: "Sluiten", ar: "إغلاق" },
        },
        trigger: { type: "exit_intent", config: {} },
    },
};
