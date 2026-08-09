export const CONSENT_COOKIE_NAME = "ix-consent";
export const CONSENT_COOKIE_VERSION = 1;
export const CONSENT_COOKIE_MAX_AGE_DAYS = 180;

export interface ConsentChoice {
    v: number;
    essential: true;
    analytics: boolean;
    marketing: boolean;
    ts: number;
}

export const REJECT_ALL: ConsentChoice = {
    v: CONSENT_COOKIE_VERSION,
    essential: true,
    analytics: false,
    marketing: false,
    ts: 0,
};

export const ACCEPT_ALL: Omit<ConsentChoice, "ts"> = {
    v: CONSENT_COOKIE_VERSION,
    essential: true,
    analytics: true,
    marketing: true,
};

export function parseConsentCookie(raw: string | undefined | null): ConsentChoice | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(decodeURIComponent(raw));
        if (
            parsed
            && typeof parsed === "object"
            && parsed.v === CONSENT_COOKIE_VERSION
            && typeof parsed.analytics === "boolean"
            && typeof parsed.marketing === "boolean"
        ) {
            return {
                v: CONSENT_COOKIE_VERSION,
                essential: true,
                analytics: Boolean(parsed.analytics),
                marketing: Boolean(parsed.marketing),
                ts: typeof parsed.ts === "number" ? parsed.ts : Date.now(),
            };
        }
    } catch {
        return null;
    }
    return null;
}

export function readConsentFromBrowserCookie(): ConsentChoice | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie
        .split("; ")
        .find((row) => row.startsWith(`${CONSENT_COOKIE_NAME}=`));
    if (!match) return null;
    return parseConsentCookie(match.slice(CONSENT_COOKIE_NAME.length + 1));
}

export function writeConsentToBrowserCookie(choice: Omit<ConsentChoice, "ts">) {
    if (typeof document === "undefined") return;
    const payload: ConsentChoice = { ...choice, ts: Date.now() };
    const value = encodeURIComponent(JSON.stringify(payload));
    const maxAge = CONSENT_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${CONSENT_COOKIE_NAME}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}
