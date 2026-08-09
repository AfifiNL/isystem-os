import { fromZonedTime } from "date-fns-tz";

export function isValidIanaTimezone(value: string): boolean {
    const timezone = value.trim();
    if (!timezone) return false;
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
        return true;
    } catch {
        return false;
    }
}

/**
 * Returns the calendar date a UTC instant has in an IANA timezone.  Booking
 * date ranges are visitor-local, so deriving the day with toISOString() would
 * incorrectly move slots across midnight for users west/east of UTC.
 */
export function calendarDateInTimezone(value: Date | string, timezone: string): string {
    if (!isValidIanaTimezone(timezone)) throw new Error("Invalid IANA timezone.");
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error("Invalid date.");
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);
    const part = (type: string) => parts.find((entry) => entry.type === type)?.value;
    const year = part("year");
    const month = part("month");
    const day = part("day");
    if (!year || !month || !day) throw new Error("Could not format date in timezone.");
    return `${year}-${month}-${day}`;
}

function nextCalendarDate(value: string): string {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) throw new Error("Invalid calendar date.");
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
}

export function dateRangeToUtc(input: { start: string; end: string; timezone: string }): { start: string; end: string } {
    if (!isValidIanaTimezone(input.timezone)) throw new Error("Invalid IANA timezone.");
    const start = fromZonedTime(`${input.start}T00:00:00`, input.timezone);
    const end = fromZonedTime(`${nextCalendarDate(input.end)}T00:00:00`, input.timezone);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        throw new Error("Invalid date range.");
    }
    return { start: start.toISOString(), end: end.toISOString() };
}
