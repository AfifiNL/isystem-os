const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDate(value: unknown): Date {
    if (typeof value !== "string" || !ISO_DATE.test(value)) {
        throw new Error("GSC sync dates must use YYYY-MM-DD.");
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        throw new Error("GSC sync dates must use valid YYYY-MM-DD values.");
    }
    return date;
}

export function parseGscSyncDates(input: { targetDate?: unknown; startDate?: unknown; endDate?: unknown }): string[] {
    if (input.targetDate !== undefined) return [parseIsoDate(input.targetDate).toISOString().slice(0, 10)];
    if (input.startDate === undefined && input.endDate === undefined) return [];
    if (input.startDate === undefined || input.endDate === undefined) throw new Error("Both startDate and endDate are required.");
    const start = parseIsoDate(input.startDate);
    const end = parseIsoDate(input.endDate);
    if (start > end) throw new Error("startDate must be before or equal to endDate.");
    const spanDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    if (spanDays > 60) throw new Error("GSC sync ranges cannot exceed 60 days.");
    return Array.from({ length: spanDays }, (_, index) => new Date(start.getTime() + index * 86_400_000).toISOString().slice(0, 10));
}
