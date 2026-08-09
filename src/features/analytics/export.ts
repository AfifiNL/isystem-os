import { isTrueConversionEvent } from "@/features/analytics/taxonomy";
import {
    pickSanitizedAnalyticsMetadataValue,
    sanitizeAnalyticsMetadataForExport,
} from "@/features/analytics/privacy";

export type AnalyticsExportMode = "summary" | "raw" | "conversions";

export interface AnalyticsExportEventRow {
    created_at: string;
    event_type: string;
    event_name: string;
    path: string | null;
    page_slug: string | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    referrer: string | null;
    metadata: Record<string, unknown> | null;
}

export interface AnalyticsExportCsvRow {
    date: string;
    event_type: string;
    event_name: string;
    path: string;
    page_slug: string;
    utm_source: string;
    utm_medium: string;
    utm_campaign: string;
    referrer_domain: string;
    count: number;
    metadata_email_hash: string;
    metadata_contact_id: string;
    metadata_subscriber_id: string;
    metadata_source: string;
    metadata_locale: string;
    metadata_consent_state: string;
    metadata_anti_abuse_decision: string;
    sanitized_metadata: string;
}

const CSV_HEADERS: Array<keyof AnalyticsExportCsvRow> = [
    "date",
    "event_type",
    "event_name",
    "path",
    "page_slug",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "referrer_domain",
    "count",
    "metadata_email_hash",
    "metadata_contact_id",
    "metadata_subscriber_id",
    "metadata_source",
    "metadata_locale",
    "metadata_consent_state",
    "metadata_anti_abuse_decision",
    "sanitized_metadata",
];

export function parseAnalyticsExportMode(value: string | null | undefined): AnalyticsExportMode {
    if (value === "raw" || value === "conversions" || value === "summary") {
        return value;
    }
    return "summary";
}

export function getReferrerDomain(referrer: string | null | undefined) {
    if (!referrer) return "";
    try {
        return new URL(referrer).hostname.replace(/^www\./i, "").toLowerCase();
    } catch {
        return "";
    }
}

function datePart(value: string) {
    return value.slice(0, 10);
}

function buildCsvRow(row: AnalyticsExportEventRow, count = 1): AnalyticsExportCsvRow {
    const sanitizedMetadata = sanitizeAnalyticsMetadataForExport(row.metadata);
    return {
        date: datePart(row.created_at),
        event_type: row.event_type,
        event_name: row.event_name,
        path: row.path ?? "",
        page_slug: row.page_slug ?? "",
        utm_source: row.utm_source ?? "",
        utm_medium: row.utm_medium ?? "",
        utm_campaign: row.utm_campaign ?? "",
        referrer_domain: getReferrerDomain(row.referrer),
        count,
        metadata_email_hash: pickSanitizedAnalyticsMetadataValue(row.metadata, ["emailHash", "email_hash"]),
        metadata_contact_id: pickSanitizedAnalyticsMetadataValue(row.metadata, ["contactId", "contact_id"]),
        metadata_subscriber_id: pickSanitizedAnalyticsMetadataValue(row.metadata, ["subscriberId", "subscriber_id"]),
        metadata_source: pickSanitizedAnalyticsMetadataValue(row.metadata, ["source"]),
        metadata_locale: pickSanitizedAnalyticsMetadataValue(row.metadata, ["locale"]),
        metadata_consent_state: pickSanitizedAnalyticsMetadataValue(row.metadata, ["consentState", "consent_state"]),
        metadata_anti_abuse_decision: pickSanitizedAnalyticsMetadataValue(row.metadata, [
            "antiAbuseDecision",
            "anti_abuse_decision",
        ]),
        sanitized_metadata: JSON.stringify(sanitizedMetadata),
    };
}

export function mapAnalyticsEventsToExportRows(
    rows: AnalyticsExportEventRow[],
    mode: AnalyticsExportMode,
): AnalyticsExportCsvRow[] {
    const conversionRows = mode === "conversions"
        ? rows.filter((row) => isTrueConversionEvent(row.event_type, row.event_name))
        : rows;

    if (mode === "raw" || mode === "conversions") {
        return conversionRows.map((row) => buildCsvRow(row));
    }

    const grouped = new Map<string, { row: AnalyticsExportEventRow; count: number }>();
    for (const row of conversionRows) {
        const key = [
            datePart(row.created_at),
            row.event_type,
            row.event_name,
            row.path ?? "",
            row.page_slug ?? "",
            row.utm_source ?? "",
            row.utm_medium ?? "",
            row.utm_campaign ?? "",
            getReferrerDomain(row.referrer),
        ].join("\u001f");
        const existing = grouped.get(key);
        if (existing) {
            existing.count += 1;
        } else {
            grouped.set(key, { row, count: 1 });
        }
    }

    return Array.from(grouped.values())
        .map(({ row, count }) => buildCsvRow(row, count))
        .sort((a, b) => b.date.localeCompare(a.date));
}

function csvEscape(value: string | number | boolean | null) {
    const asString = value === null ? "" : String(value);
    if (/[",\n\r]/.test(asString)) {
        return `"${asString.replaceAll('"', '""')}"`;
    }
    return asString;
}

export function formatAnalyticsExportCsv(rows: AnalyticsExportCsvRow[]) {
    return [
        CSV_HEADERS.join(","),
        ...rows.map((row) => CSV_HEADERS.map((header) => csvEscape(row[header])).join(",")),
    ].join("\n");
}
