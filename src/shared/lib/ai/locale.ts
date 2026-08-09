import { isSupportedLocale } from "@/shared/lib/i18n/routing";
import type { Locale } from "@/features/templates/types";

/**
 * Resolve the locale a generation should target. Caller-supplied value wins
 * when it is one of the SUPPORTED_LOCALES; otherwise we fall back to the
 * workspace default, then to "en". Used by every AI generation route so
 * locale handling stays identical across draft / node / enhance / assets /
 * podcast flows.
 */
export function resolveGenerationLocale(input: {
    requested?: string | null | undefined;
    workspaceDefault?: string | null | undefined;
}): Locale {
    if (isSupportedLocale(input.requested)) {
        return input.requested;
    }

    if (isSupportedLocale(input.workspaceDefault)) {
        return input.workspaceDefault;
    }

    return "en";
}

/**
 * The locale instruction block injected at the top of every system prompt for
 * text generation. Keep this the single source of truth — duplicating the
 * wording across routes silently drifts the language behavior.
 */
export function buildLocaleSystemPrompt(locale: Locale): string {
    if (locale === "ar") {
        return [
            "You must generate all user-facing content, blog posts, and video dialogue exclusively in Modern Standard Arabic (MSA, الفصحى الحديثة).",
            "Use natural professional Arabic suitable for business audiences.",
            "Do not mix Arabic with English copy in body text — keep English only for proper brand names, product names, and code identifiers.",
            "Punctuation should follow Arabic conventions (e.g., Arabic comma ، and Arabic question mark ؟ where appropriate).",
        ].join(" ");
    }

    if (locale === "nl") {
        return "You must generate all user-facing content, blog posts, and video dialogue exclusively in natural professional Dutch (Nederlands). Keep English only for proper brand names, product names, and code identifiers.";
    }

    return "You must generate all user-facing content, blog posts, and video dialogue exclusively in natural professional English.";
}
