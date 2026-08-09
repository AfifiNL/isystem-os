export const LOCALE_COOKIE_KEY = "NEXT_LOCALE";

// Sticky user preference — set only when the visitor clicks the language
// switcher. Middleware uses this to redirect any request whose URL locale
// disagrees with the user's choice, so the session never flips back via
// path-locale resolution or Accept-Language.
export const LOCALE_PREF_COOKIE_KEY = "site-locale-pref";

