export const ANALYTICS_TRAFFIC_EVENT_TYPES = ["page_view"] as const;

export const ANALYTICS_ENGAGEMENT_EVENT_TYPES = [
    "cta_click",
    "audio_play",
    "audio_progress",
    "audio_complete",
] as const;

export const ANALYTICS_LEAD_CONVERSION_EVENT_TYPES = [
    "newsletter_subscribe",
    "contact_submit",
    "audit_submit",
] as const;

export const ANALYTICS_BOOKING_CONVERSION_EVENT_TYPES = [
    "booking_reserved",
    "booking_confirmed",
] as const;

export const ANALYTICS_BOOKING_FUNNEL_EVENT_TYPES = [
    "booking_widget_viewed",
    "booking_service_selected",
    "booking_slot_selected",
    "booking_intake_started",
] as const;

export const ANALYTICS_BOOKING_LIFECYCLE_EVENT_TYPES = [
    "booking_cancelled",
    "booking_completed",
] as const;

export const ANALYTICS_POPUP_EVENT_TYPES = [
    "popup_impression",
    "popup_dismiss",
    "popup_convert",
] as const;

export const ANALYTICS_FORM_SUBMIT_EVENT_TYPES = ["form_submit"] as const;

export const ANALYTICS_EVENT_TYPES = [
    ...ANALYTICS_TRAFFIC_EVENT_TYPES,
    ...ANALYTICS_ENGAGEMENT_EVENT_TYPES,
    ...ANALYTICS_FORM_SUBMIT_EVENT_TYPES,
    ...ANALYTICS_LEAD_CONVERSION_EVENT_TYPES,
    ...ANALYTICS_BOOKING_CONVERSION_EVENT_TYPES,
    ...ANALYTICS_BOOKING_FUNNEL_EVENT_TYPES,
    ...ANALYTICS_BOOKING_LIFECYCLE_EVENT_TYPES,
    ...ANALYTICS_POPUP_EVENT_TYPES,
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

export const ANALYTICS_PUBLIC_TRACK_EVENT_TYPES = [
    ...ANALYTICS_TRAFFIC_EVENT_TYPES,
    ...ANALYTICS_ENGAGEMENT_EVENT_TYPES,
    ...ANALYTICS_BOOKING_FUNNEL_EVENT_TYPES,
] as const satisfies readonly AnalyticsEventType[];

export const ANALYTICS_TRUE_CONVERSION_EVENT_TYPES = [
    ...ANALYTICS_LEAD_CONVERSION_EVENT_TYPES,
    ...ANALYTICS_BOOKING_CONVERSION_EVENT_TYPES,
    "popup_convert",
] as const satisfies readonly AnalyticsEventType[];

export const ANALYTICS_FORM_SUBMIT_COMPATIBLE_CONVERSION_NAMES = [
    "audit_submit",
    "booking_confirmed",
    "booking_reserved",
    "contact_form_submit",
    "contact_submit",
    "isystem_contact_submit",
    "stealth_cto_audit_submit",
] as const;

export const ANALYTICS_CONVERSION_CANDIDATE_EVENT_TYPES = [
    ...ANALYTICS_TRUE_CONVERSION_EVENT_TYPES,
    ...ANALYTICS_FORM_SUBMIT_EVENT_TYPES,
] as const satisfies readonly AnalyticsEventType[];

const LOCALE_PREFIXES = new Set(["en", "nl", "ar"]);
const ROUTE_SLUG_SEGMENTS = new Set([
    "audit",
    "booking",
    "contact",
    "newsletter",
    "podcast",
    "resources",
    "tools",
]);

export function normalizeAnalyticsSlug(value?: string | null) {
    const trimmed = value?.trim().toLowerCase().replace(/^\/+|\/+$/g, "") || "";

    if (!trimmed || trimmed.length > 180) {
        return null;
    }

    if (!/^[a-z0-9\-/]+$/.test(trimmed)) {
        return null;
    }

    return trimmed;
}

export function normalizeAnalyticsPath(value: string) {
    const trimmed = value.trim();

    if (!trimmed.startsWith("/") || trimmed.length > 180) {
        return null;
    }

    if (!/^\/[a-zA-Z0-9\-._~/]*$/.test(trimmed)) {
        return null;
    }

    return trimmed.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
}

export function stripAnalyticsLocalePrefix(path: string) {
    const normalizedPath = normalizeAnalyticsPath(path);
    if (!normalizedPath || normalizedPath === "/") {
        return "/";
    }

    const segments = normalizedPath.split("/").filter(Boolean);
    if (segments[0] && LOCALE_PREFIXES.has(segments[0].toLowerCase())) {
        segments.shift();
    }

    return segments.length > 0 ? `/${segments.join("/")}` : "/";
}

export function derivePageSlug(path: string) {
    const localeStrippedPath = stripAnalyticsLocalePrefix(path);
    if (localeStrippedPath === "/") {
        return "home";
    }

    const segments = localeStrippedPath.split("/").filter(Boolean).map((segment) => segment.toLowerCase());
    const [section, ...rest] = segments;

    if (!section) {
        return "home";
    }

    if (section === "blog") {
        return normalizeAnalyticsSlug(rest.length > 0 ? rest.join("/") : "blog");
    }

    if (ROUTE_SLUG_SEGMENTS.has(section)) {
        return normalizeAnalyticsSlug([section, ...rest].join("/"));
    }

    return normalizeAnalyticsSlug(segments.join("/"));
}

export function deriveAnalyticsContentType(path: string) {
    const localeStrippedPath = stripAnalyticsLocalePrefix(path);
    if (localeStrippedPath.startsWith("/blog/")) return "blog";
    if (localeStrippedPath.startsWith("/podcast")) return "podcast";
    if (localeStrippedPath.startsWith("/tools")) return "system";
    return "page";
}

export function isAnalyticsPublicTrackEvent(eventType: string): eventType is (typeof ANALYTICS_PUBLIC_TRACK_EVENT_TYPES)[number] {
    return (ANALYTICS_PUBLIC_TRACK_EVENT_TYPES as readonly string[]).includes(eventType);
}

export function isAnalyticsEngagementEvent(eventType: string) {
    return (ANALYTICS_ENGAGEMENT_EVENT_TYPES as readonly string[]).includes(eventType);
}

export function isAnalyticsTrafficEvent(eventType: string) {
    return (ANALYTICS_TRAFFIC_EVENT_TYPES as readonly string[]).includes(eventType);
}

export function isTrueConversionEvent(eventType: string, eventName?: string | null) {
    if ((ANALYTICS_TRUE_CONVERSION_EVENT_TYPES as readonly string[]).includes(eventType)) {
        return true;
    }

    if (eventType !== "form_submit") {
        return false;
    }

    const normalizedEventName = eventName?.trim().toLowerCase() ?? "";
    return (ANALYTICS_FORM_SUBMIT_COMPATIBLE_CONVERSION_NAMES as readonly string[]).includes(normalizedEventName);
}
