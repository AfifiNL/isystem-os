/**
 * Business identity for schema.org JSON-LD and trust-signal display.
 *
 * Deliberately omits a postal street address. The business operates remotely;
 * client meetings in NL are arranged in Breda, Rotterdam, or Amsterdam at the
 * client's preferred location, and client visits in the rest of Europe are
 * discussed case by case. There is no visitable office, so we don't publish
 * a street to avoid implying one.
 *
 * Surface KvK and the country textually wherever a trust signal is helpful
 * — the master production brief §7 explicitly calls out KvK + real human
 * contact info as trust signals to feature, not hide.
 */
export const ISYSTEM_BUSINESS = {
    legalName: "isystem.ai",
    /** Dutch Chamber of Commerce (Kamer van Koophandel) registration number. */
    kvkNumber: "42053547",
    /** Registration country. We do not expose a street — see file header. */
    countryCode: "NL",
    /** Display string for the country (used in copy + schema). */
    countryName: "Netherlands",
    /** Region — Breda is in North Brabant. Public info, no privacy concern. */
    region: "Noord-Brabant",
    /** Languages we operate in. BCP-47 codes for schema; labels for UI. */
    languages: ["en", "nl", "ar"] as const,
    languageLabels: { en: "English", nl: "Dutch", ar: "Arabic" } as const,
    /** Cities where in-person meetings can be arranged (no office at any). */
    meetingCities: ["Breda", "Rotterdam", "Amsterdam"] as const,
    /** Whether we accept walk-in / visitor traffic. We do not. */
    acceptsVisitors: false,
    /** Whether client visits abroad are possible. Yes, in Europe, ad hoc. */
    travelsToClientsIn: "Europe" as const,
    /** Founder name — referenced from Organization.founder + tool author. */
    founderName: "Hossam Afifi",
    /** Public contact channels. */
    contactEmail: "hossam@isystem.ai",
    /** External profiles for Organization.sameAs (Person profiles live elsewhere). */
    sameAs: ["https://www.linkedin.com/in/hossamafifi"],
} as const;

export function formatTradeRegistryLine(locale: "en" | "nl" | "ar"): string {
    const { legalName, kvkNumber, countryName } = ISYSTEM_BUSINESS;
    switch (locale) {
        case "nl":
            return `${legalName} · KvK ${kvkNumber} · gevestigd in ${countryName}`;
        case "ar":
            return `${legalName} · سجل تجاري هولندي (KvK) رقم ${kvkNumber} · مقرّ التسجيل: ${countryName}`;
        case "en":
        default:
            return `${legalName} · Dutch Trade Register (KvK) ${kvkNumber} · Registered in the ${countryName}`;
    }
}
