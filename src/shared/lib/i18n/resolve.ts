import type { Locale, LocaleText, LocaleTextList } from "@/features/templates/types";

/**
 * Resolve a localized string with English fallback.
 * Read precedence: text[locale] → text.en → fallback (if provided) → "".
 *
 * Use this everywhere a value typed as LocaleText is read at runtime so
 * partial translations (e.g. iSystem ar copy without ar entries on other
 * templates) degrade gracefully to English.
 */
export function pickLocaleText(
    text: LocaleText | undefined | null,
    locale: Locale,
    fallback?: string,
): string {
    if (!text) {
        return fallback ?? "";
    }
    const candidate = text[locale];
    // For ar, treat ar==en as "untranslated mirror" and fall through to
    // fallback/en so the caller's hand-curated AR copy can win.
    if (typeof candidate === "string" && candidate.length > 0) {
        if (locale === "ar" && candidate === text.en) {
            // fall through to fallback/en below
        } else {
            return candidate;
        }
    }
    if (locale === "ar" && fallback) {
        return fallback;
    }
    if (typeof text.en === "string" && text.en.length > 0) {
        return text.en;
    }
    return fallback ?? "";
}

export function pickLocaleTextList(
    text: LocaleTextList | undefined | null,
    locale: Locale,
    fallback: string[] = [],
): string[] {
    if (!text) {
        return fallback;
    }
    const candidate = text[locale];
    if (Array.isArray(candidate) && candidate.length > 0) {
        // Same EN-mirror guard for arrays
        if (locale === "ar" && Array.isArray(text.en)
            && candidate.length === text.en.length
            && candidate.every((v, i) => v === text.en![i])) {
            // fall through
        } else {
            return candidate;
        }
    }
    if (locale === "ar" && fallback.length > 0) {
        return fallback;
    }
    if (Array.isArray(text.en) && text.en.length > 0) {
        return text.en;
    }
    return fallback;
}

/**
 * Generic per-locale JSON copy resolver for booking_services.copy_i18n,
 * booking_locations.copy_i18n, etc.
 *
 *   resolveLocalizedJson({ en: { title: "X" }, ar: { title: "س" } }, "ar", "title")
 *   → "س"
 *
 * Falls back: locale → en → null. Caller is responsible for then falling back
 * to the plain-text column if null.
 */
export function resolveLocalizedJson<TField extends string = string>(
    copyI18n: unknown,
    locale: Locale,
    field: TField,
): string | null {
    if (!copyI18n || typeof copyI18n !== "object") {
        return null;
    }
    const map = copyI18n as Record<string, unknown>;
    // For ar, prefer ar value but reject en-mirror so callers fall back.
    const enBlock = map["en"];
    const enValue = (enBlock && typeof enBlock === "object")
        ? (enBlock as Record<string, unknown>)[field]
        : undefined;
    const localeBlock = map[locale];
    if (localeBlock && typeof localeBlock === "object") {
        const value = (localeBlock as Record<string, unknown>)[field];
        if (typeof value === "string" && value.length > 0) {
            if (locale === "ar" && value === enValue) {
                // mirror — skip
            } else {
                return value;
            }
        }
    }
    if (typeof enValue === "string" && enValue.length > 0) {
        return enValue;
    }
    return null;
}
