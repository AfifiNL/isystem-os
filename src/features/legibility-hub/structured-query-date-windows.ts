import type { StructuredHubDateWindow } from "./structured-query-types";

const DAY_MS = 86_400_000;

function startOfUtcDay(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcMonth(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function startOfUtcWeek(date: Date) {
    const day = date.getUTCDay() || 7;
    const start = startOfUtcDay(date);
    start.setUTCDate(start.getUTCDate() - (day - 1));
    return start;
}

function makeWindow(label: string, from: Date, to: Date, timezone: string): StructuredHubDateWindow {
    return {
        label,
        from: from.toISOString(),
        to: to.toISOString(),
        timezone,
    };
}

export function createRecentStructuredHubDateWindow(timezone = "UTC", days = 30, now = new Date()): StructuredHubDateWindow {
    return makeWindow(`the last ${days} days`, new Date(now.getTime() - days * DAY_MS), now, timezone);
}

export function parseStructuredHubDateWindow(queryText: string, timezone = "UTC", now = new Date()): StructuredHubDateWindow | null {
    const normalized = queryText.toLowerCase();
    const todayStart = startOfUtcDay(now);

    if (/\btoday\b/.test(normalized)) {
        return makeWindow("today", todayStart, now, timezone);
    }

    if (/\bthis week\b/.test(normalized)) {
        return makeWindow("this week", startOfUtcWeek(now), now, timezone);
    }

    if (/\blast week\b/.test(normalized)) {
        const thisWeek = startOfUtcWeek(now);
        return makeWindow("last week", new Date(thisWeek.getTime() - 7 * DAY_MS), thisWeek, timezone);
    }

    if (/\bthis month\b/.test(normalized)) {
        return makeWindow("this month", startOfUtcMonth(now), now, timezone);
    }

    if (/\blast month\b/.test(normalized)) {
        const thisMonth = startOfUtcMonth(now);
        return makeWindow("last month", new Date(Date.UTC(thisMonth.getUTCFullYear(), thisMonth.getUTCMonth() - 1, 1)), thisMonth, timezone);
    }

    const lastDaysMatch = normalized.match(/\blast\s+(7|30)\s+days\b/);
    if (lastDaysMatch) {
        const days = Number(lastDaysMatch[1]);
        return createRecentStructuredHubDateWindow(timezone, days, now);
    }

    if (/\brecent\b/.test(normalized)) {
        return createRecentStructuredHubDateWindow(timezone, 30, now);
    }

    return null;
}
