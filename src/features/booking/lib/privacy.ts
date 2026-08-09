/**
 * Return a policy URL that is safe to place in a public booking link.
 *
 * Workspace settings are manager-controlled data, but they still cross the
 * server/client boundary and must never be allowed to become a javascript:
 * or other executable URL. Relative paths are normalized by the caller so
 * locale routing can be applied before this helper is used.
 */
export function normalizePrivacyPolicyUrl(
    configuredUrl: string | null | undefined,
    fallbackUrl: string,
): string {
    const value = configuredUrl?.trim();
    if (!value) return fallbackUrl;

    // Only same-origin relative paths are accepted. Protocol-relative URLs
    // (//host/path) are deliberately excluded from this branch.
    if (value.startsWith("/") && !value.startsWith("//")) {
        return value;
    }

    try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:"
            ? parsed.toString()
            : fallbackUrl;
    } catch {
        return fallbackUrl;
    }
}

export function resolveLocalizedPrivacyPolicyUrl(
    configuredUrl: string | null | undefined,
    locale: Locale,
): string {
    const value = configuredUrl?.trim();
    const localizedConfigured = value?.startsWith("/") && !value.startsWith("//")
        ? canonicalizePublicHref(locale, value)
        : value;
    return normalizePrivacyPolicyUrl(localizedConfigured, localizeHref(locale, "/privacy"));
}

/** Allowlist manager-configured links that are rendered as payment buttons. */
export function normalizePublicHttpUrl(value: string | null | undefined): string | null {
    const normalized = normalizePrivacyPolicyUrl(value, "");
    return normalized || null;
}
import type { Locale } from "@/features/templates/types";
import { canonicalizePublicHref, localizeHref } from "@/shared/lib/i18n/routing";
