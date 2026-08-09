import type { Locale } from "@/features/templates/types";
import { resolveWorkspaceContext } from "@/shared/lib/workspace/context";

export type DictionaryKey = keyof typeof import("./dictionaries/en")["enCommon"];

export type Dictionary = Record<string, string>;

const THEME_KEY_MAP: Record<string, keyof typeof import("./dictionaries/en")["enThemes"]> = {
    "personal-brand": "personal_brand",
    "facility-services": "facility_services",
    "creative-agency": "creative_agency",
    "isystem-agency": "isystem_agency",
    "saas-product": "saas_product",
    "restaurant": "restaurant",
    "ecommerce": "ecommerce",
    "nonprofit": "nonprofit",
};

function resolveThemeDictionaryKey(activeThemeKey: string | undefined | null) {
    if (!activeThemeKey) {
        return "personal_brand" as const;
    }

    return THEME_KEY_MAP[activeThemeKey] ?? "personal_brand";
}

export async function getDictionary(locale: Locale): Promise<Dictionary> {
    const context = await resolveWorkspaceContext();
    const themeKey = resolveThemeDictionaryKey(context?.activeThemeVersion?.theme_key);

    if (locale === "nl") {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { nlCommon, nlThemes, themeContent: nlThemeContent } = require("./dictionaries/nl");
        return {
            ...nlCommon,
            ...(nlThemes[themeKey] ?? {}),
            [themeKey]: nlThemeContent?.[themeKey] ?? {},
        } as Dictionary;
    }

    if (locale === "ar") {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { arCommon, arThemes, themeContent: arThemeContent } = require("./dictionaries/ar");
        return {
            ...arCommon,
            ...(arThemes[themeKey] ?? {}),
            [themeKey]: arThemeContent?.[themeKey] ?? {},
        } as Dictionary;
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { enCommon, enThemes, themeContent: enThemeContent } = require("./dictionaries/en");
    return {
        ...enCommon,
        ...(enThemes[themeKey] ?? {}),
        [themeKey]: enThemeContent?.[themeKey] ?? {},
    } as Dictionary;
}
