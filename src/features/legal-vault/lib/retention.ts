// Bewaarplicht — Belastingdienst requires that administratie (and the source
// documents supporting it) be retained for seven full fiscal years after the
// year to which they pertain. The DB trigger blocks hard DELETE inside that
// window; this helper computes the canonical retention_until date used at
// insert time and reused by UI to display "retained until …" badges.

const NL_TZ = "Europe/Amsterdam";

// Default retention window: end of the calendar year following the seven-year
// counter. We anchor on the document's `occurred_on` (or upload date as a
// fallback) — so a 2026 expense stays in the vault until 2033-12-31.
export function defaultRetentionUntil(anchor: Date = new Date()): string {
    const year = new Intl.DateTimeFormat("en-CA", {
        timeZone: NL_TZ,
        year: "numeric",
    }).format(anchor);
    const yearNum = Number.parseInt(year, 10);
    return `${yearNum + 7}-12-31`;
}

export function isWithinRetentionWindow(retentionUntilIso: string, today: Date = new Date()): boolean {
    const todayIso = new Intl.DateTimeFormat("en-CA", {
        timeZone: NL_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(today);
    return retentionUntilIso > todayIso;
}
