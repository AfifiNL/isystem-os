/**
 * Pure slot walker: given availability rules, blackouts, reservations and
 * service config, emit all candidate slots in the requested date range.
 *
 * Why pure and isolated: the wall-clock-in-IANA → UTC math is the part most
 * likely to regress, so we keep it free of Supabase/Next so it can be unit
 * tested in isolation. The action layer composes I/O around this.
 *
 * Timezone correctness:
 *   * The business defines availability in its IANA timezone (rule.timezone).
 *   * We compute every wall-clock instant in that zone and convert to UTC via
 *     `date-fns-tz` `fromZonedTime` — this handles DST spring-forward (the
 *     skipped hour) and fall-back (the duplicated hour) correctly.
 *   * UTC ISO is what gets stored and returned to the client; the client
 *     formats per viewer-local timezone.
 */

import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { getEffectiveBookingLeadTimeMinutes } from "@/features/booking/lib/booking-policies";
import type { BookingAvailabilityDateSlot } from "../types";

// ─── Input shapes (subset of DB rows we actually need) ───────────────────

export interface SlotWalkerService {
    id: string;
    duration_minutes: number;
    buffer_before_minutes: number;
    buffer_after_minutes: number;
    lead_time_minutes: number;
    max_advance_days: number;
    capacity_mode: "single" | "shared" | "isolated" | "group" | "pooled" | "capacity";
    capacity_value: number;
    requires_manual_review: boolean;
}

export type RuleType = "recurring" | "date_override" | "seasonal";

export interface AvailabilityRule {
    id: string;
    rule_type: RuleType;
    timezone: string;             // IANA, e.g. "Europe/Amsterdam"
    weekday_json: number[];       // 0=Sunday..6=Saturday (ISO-ish; we accept either if the admin form uses 1..7 we treat 7 as 0)
    starts_on: string | null;     // YYYY-MM-DD inclusive, used for seasonal
    ends_on: string | null;       // YYYY-MM-DD inclusive
    date_json: Record<string, unknown>;          // { "2026-12-25": { time_windows: [...] } } for date_override
    /**
     * Each window is `{ start: "HH:MM", end: "HH:MM", slotMinutes?: number }`.
     * `slotMinutes` is the stride between consecutive slot starts inside this
     * window. Omit to fall back to `defaultStrideMinutes` (= duration). Set to
     * a smaller number to get overlapping starts (e.g. duration=60, stride=30
     * → slots at 09:00, 09:30, 10:00…).
     */
    time_windows_json: Array<{ start: string; end: string; slotMinutes?: number | null }>;
    priority: number;
    service_id: string | null;
    resource_id: string | null;
    location_id: string | null;
}

export interface BlackoutWindow {
    starts_at: string;            // ISO UTC
    ends_at: string;              // ISO UTC
    service_id: string | null;
    resource_id: string | null;
    location_id: string | null;
    reason: string | null;
}

export interface ReservationRow {
    service_id?: string | null;
    scheduled_start: string;      // ISO UTC
    scheduled_end: string;        // ISO UTC
    resource_id: string | null;
    location_id: string | null;
    party_size?: number | null;
    capacity_mode_snapshot?: SlotWalkerService["capacity_mode"] | null;
    capacity_value_snapshot?: number | null;
    buffer_before_minutes?: number | null;
    buffer_after_minutes?: number | null;
}

export interface SlotWalkerInput {
    service: SlotWalkerService;
    rules: AvailabilityRule[];
    blackouts: BlackoutWindow[];
    reservations: ReservationRow[];
    rangeStartIso: string;        // viewer-day inclusive, ISO with TZ; we walk by *business-local* date
    rangeEndIso: string;
    selectedResourceId: string | null;
    selectedLocationId: string | null;
    /** Party size being checked; defaults to one for admin previews/legacy callers. */
    requestedPartySize?: number | null;
    nowMs: number;
    /** Default stride between slot starts when a window has no explicit stride. */
    defaultStrideMinutes: number;
    /** Safety cap for public availability previews. */
    maxSlots?: number;
}

export interface SlotWalkerResult {
    slots: BookingAvailabilityDateSlot[];
    /** IANA TZ extracted from the highest-priority active rule. Null if no rules apply. */
    businessTimezone: string | null;
    /** Notices the action layer can surface (e.g. "no rules configured"). */
    notices: string[];
    truncated: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

const HHMM_RE = /^([0-2]\d):([0-5]\d)$/;

function parseHhmm(value: string): { hour: number; minute: number } | null {
    const m = HHMM_RE.exec(value.trim());
    if (!m) return null;
    const hour = Number(m[1]);
    const minute = Number(m[2]);
    if (hour > 24 || minute > 59) return null;
    if (hour === 24 && minute !== 0) return null;
    return { hour, minute };
}

function ymdInTz(date: Date, tz: string): string {
    return formatInTimeZone(date, tz, "yyyy-MM-dd");
}

function jsWeekdayInTz(date: Date, tz: string): number {
    // 0 = Sunday … 6 = Saturday in JS; date-fns-tz format token "i" gives 1..7 (Mon..Sun).
    // We translate to JS-style for consistent comparison with weekday_json values.
    const isoDow = Number(formatInTimeZone(date, tz, "i")); // 1..7 Mon..Sun
    return isoDow === 7 ? 0 : isoDow;
}

function normalizeWeekday(input: unknown): number | null {
    const n = typeof input === "number" ? input : typeof input === "string" ? Number(input) : NaN;
    if (!Number.isFinite(n)) return null;
    // Accept 0..6 (JS) and 1..7 (ISO). Map 7 → 0.
    if (n >= 0 && n <= 6) return n;
    if (n === 7) return 0;
    return null;
}

function ruleAppliesToScope(
    rule: AvailabilityRule,
    serviceId: string,
    selectedResourceId: string | null,
    selectedLocationId: string | null,
): boolean {
    if (rule.service_id && rule.service_id !== serviceId) return false;
    if (rule.resource_id && selectedResourceId && rule.resource_id !== selectedResourceId) return false;
    if (rule.location_id && selectedLocationId && rule.location_id !== selectedLocationId) return false;
    return true;
}

function ruleCoversDate(rule: AvailabilityRule, ymd: string, tz: string, date: Date): boolean {
    if (rule.starts_on && ymd < rule.starts_on) return false;
    if (rule.ends_on && ymd > rule.ends_on) return false;

    if (rule.rule_type === "date_override") {
        // date_override carries explicit dates in date_json keyed by YYYY-MM-DD.
        // If date_json is empty, fall back to starts_on/ends_on as the override window.
        const keys = Object.keys(rule.date_json ?? {});
        if (keys.length === 0) return true;
        return keys.includes(ymd);
    }

    if (rule.rule_type === "recurring") {
        const weekdays = (rule.weekday_json ?? [])
            .map(normalizeWeekday)
            .filter((n): n is number => n !== null);
        if (weekdays.length === 0) return false;
        return weekdays.includes(jsWeekdayInTz(date, tz));
    }

    // seasonal: starts_on/ends_on already gate; recurring weekday filter still applies if provided.
    if (rule.rule_type === "seasonal") {
        const weekdays = (rule.weekday_json ?? [])
            .map(normalizeWeekday)
            .filter((n): n is number => n !== null);
        if (weekdays.length > 0 && !weekdays.includes(jsWeekdayInTz(date, tz))) return false;
        return true;
    }

    return false;
}

function pickEffectiveRule(rules: AvailabilityRule[]): AvailabilityRule | null {
    if (rules.length === 0) return null;
    // Precedence: date_override > seasonal > recurring; within type, higher priority wins.
    const rank: Record<RuleType, number> = { date_override: 3, seasonal: 2, recurring: 1 };
    return rules.reduce<AvailabilityRule | null>((best, candidate) => {
        if (!best) return candidate;
        const candRank = rank[candidate.rule_type] * 10_000 + candidate.priority;
        const bestRank = rank[best.rule_type] * 10_000 + best.priority;
        return candRank > bestRank ? candidate : best;
    }, null);
}

function effectiveTimeWindows(rule: AvailabilityRule, ymd: string): Array<{ start: string; end: string; slotMinutes?: number | null }> {
    if (rule.rule_type === "date_override") {
        const entry = rule.date_json?.[ymd];
        if (entry && typeof entry === "object" && Array.isArray((entry as { time_windows?: unknown }).time_windows)) {
            return ((entry as { time_windows: unknown[] }).time_windows ?? []).filter((w): w is { start: string; end: string; slotMinutes?: number | null } =>
                typeof w === "object" && w !== null
                && typeof (w as { start?: unknown }).start === "string"
                && typeof (w as { end?: unknown }).end === "string"
            );
        }
        // If the override has no per-date windows, fall through to the rule's time_windows_json
        // (operators may use date_override as an explicit "use these windows on these days" rule).
    }
    return rule.time_windows_json ?? [];
}

function blackoutMatches(
    blackout: BlackoutWindow,
    serviceId: string,
    resourceId: string | null,
    locationId: string | null,
): boolean {
    if (blackout.service_id && blackout.service_id !== serviceId) return false;
    if (blackout.resource_id && resourceId && blackout.resource_id !== resourceId) return false;
    if (blackout.location_id && locationId && blackout.location_id !== locationId) return false;
    return true;
}

// ─── Main walker ─────────────────────────────────────────────────────────

export function walkAvailabilitySlots(input: SlotWalkerInput): SlotWalkerResult {
    const {
        service,
        rules: allRules,
        blackouts,
        reservations,
        rangeStartIso,
        rangeEndIso,
        selectedResourceId,
        selectedLocationId,
        requestedPartySize,
        nowMs,
        defaultStrideMinutes,
    } = input;

    const slots: BookingAvailabilityDateSlot[] = [];
    const notices: string[] = [];
    const maxSlots = Number.isFinite(input.maxSlots) ? Math.max(1, Math.floor(input.maxSlots as number)) : Number.POSITIVE_INFINITY;
    let truncated = false;
    const appendSlot = (slot: BookingAvailabilityDateSlot): boolean => {
        if (slots.length >= maxSlots) {
            truncated = true;
            return false;
        }
        slots.push(slot);
        return true;
    };

    const earliestStartMs = nowMs + getEffectiveBookingLeadTimeMinutes(service.lead_time_minutes) * 60_000;
    const latestStartMs = (service.max_advance_days ?? 0) > 0
        ? nowMs + service.max_advance_days * 24 * 60 * 60 * 1000
        : Number.POSITIVE_INFINITY;

    const inScopeRules = allRules.filter((r) =>
        ruleAppliesToScope(r, service.id, selectedResourceId, selectedLocationId),
    );

    if (inScopeRules.length === 0) {
        notices.push("No availability rules are configured for this service yet.");
        return { slots, businessTimezone: null, notices, truncated };
    }

    // Use the highest-priority recurring rule's timezone as the canonical business TZ
    // for header display. Fall back to the first rule.
    const businessTimezone = inScopeRules.find((r) => r.rule_type === "recurring")?.timezone
        ?? inScopeRules[0].timezone;

    const fallbackStride = Math.max(1, defaultStrideMinutes);
    const slotMinutes = service.duration_minutes;
    const bufferBefore = service.buffer_before_minutes ?? 0;
    const bufferAfter = service.buffer_after_minutes ?? 0;
    const capacity = ["shared", "group", "pooled", "capacity"].includes(service.capacity_mode)
        ? Math.max(1, service.capacity_value ?? 1)
        : 1;

    // Walk by business-local date so DST-aware day boundaries match operator intent.
    // We anchor the walk at the rangeStartIso interpreted as UTC; for each business-local
    // day we render windows in `businessTimezone`. The viewer-side date grouping is the
    // client's job.
    const rangeStart = new Date(rangeStartIso).getTime();
    const rangeEnd = new Date(rangeEndIso).getTime();
    if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeEnd < rangeStart) {
        notices.push("Invalid date range supplied.");
        return { slots, businessTimezone, notices, truncated };
    }

    // Iterate calendar days in the business TZ. We start one day BEFORE the range
    // start (so an early-morning slot whose UTC instant falls in the range still
    // emits) and end one day AFTER the range end. Bounds are filtered below.
    const firstYmd = ymdInTz(new Date(rangeStart - 24 * 60 * 60 * 1000), businessTimezone);
    const lastYmd = ymdInTz(new Date(rangeEnd + 24 * 60 * 60 * 1000), businessTimezone);

    for (let ymd = firstYmd; ymd <= lastYmd; ymd = nextYmd(ymd)) {
        // Resolve the wall-clock midnight of this business-local day to a UTC date,
        // for weekday computation only.
        const dayAnchor = fromZonedTime(`${ymd}T00:00:00`, businessTimezone);

        const dayRules = inScopeRules.filter((r) => ruleCoversDate(r, ymd, r.timezone, dayAnchor));
        const effective = pickEffectiveRule(dayRules);
        if (!effective) continue;

        const windows = effectiveTimeWindows(effective, ymd);
        if (windows.length === 0) continue;

        for (const window of windows) {
            const startHm = parseHhmm(window.start);
            const endHm = parseHhmm(window.end);
            if (!startHm || !endHm) continue;

            const startWall = `${ymd}T${pad2(startHm.hour)}:${pad2(startHm.minute)}:00`;
            const endWall = `${ymd}T${pad2(endHm.hour === 24 ? 23 : endHm.hour)}:${pad2(endHm.hour === 24 ? 59 : endHm.minute)}:${endHm.hour === 24 ? "59" : "00"}`;
            const windowStartUtc = fromZonedTime(startWall, effective.timezone).getTime();
            const windowEndUtc = fromZonedTime(endWall, effective.timezone).getTime() + (endHm.hour === 24 ? 1000 : 0);
            if (!Number.isFinite(windowStartUtc) || !Number.isFinite(windowEndUtc)) continue;

            const windowStride = Math.max(
                1,
                typeof window.slotMinutes === "number" && window.slotMinutes > 0
                    ? window.slotMinutes
                    : fallbackStride,
            );
            for (
                let slotStartMs = windowStartUtc;
                slotStartMs + slotMinutes * 60_000 <= windowEndUtc;
                slotStartMs += windowStride * 60_000
            ) {
                const slotEndMs = slotStartMs + slotMinutes * 60_000;

                // Range filter (use the requested viewer range as a soft fence).
                if (slotEndMs <= rangeStart) continue;
                if (slotStartMs >= rangeEnd) continue;

                // Past + horizon guard.
                if (slotStartMs < earliestStartMs) continue;
                if (slotStartMs > latestStartMs) continue;

                // Blackout intersection.
                const overlappingBlackout = blackouts.find((b) => {
                    if (!blackoutMatches(b, service.id, selectedResourceId, selectedLocationId)) return false;
                    const bStart = new Date(b.starts_at).getTime();
                    const bEnd = new Date(b.ends_at).getTime();
                    return bStart < slotEndMs && bEnd > slotStartMs;
                });
                if (overlappingBlackout) {
                    appendSlot({
                        start: new Date(slotStartMs).toISOString(),
                        end: new Date(slotEndMs).toISOString(),
                        status: "blocked",
                        reason: overlappingBlackout.reason ?? "Blocked by blackout window.",
                    });
                    continue;
                }

                // Reservation intersection with buffer extension. Capacity-aware
                // for shared services; conflict-strict otherwise.
                const conflictWindowStart = slotStartMs - bufferBefore * 60_000;
                const conflictWindowEnd = slotEndMs + bufferAfter * 60_000;
                let overlapUnits = 0;
                for (const r of reservations) {
                    // Resource and location are independent tenant capacity
                    // dimensions. A NULL assignment is workspace-wide; when
                    // both bookings specify a concrete dimension, it must
                    // match. Keep this predicate in lock-step with the
                    // database capacity trigger so previews cannot disagree
                    // with the insert fence.
                    const resourceMatches = !selectedResourceId || !r.resource_id || r.resource_id === selectedResourceId;
                    const locationMatches = !selectedLocationId || !r.location_id || r.location_id === selectedLocationId;
                    if (!resourceMatches || !locationMatches) continue;
                    const rStart = new Date(r.scheduled_start).getTime()
                        - Math.max(0, r.buffer_before_minutes ?? bufferBefore) * 60_000;
                    const rEnd = new Date(r.scheduled_end).getTime()
                        + Math.max(0, r.buffer_after_minutes ?? bufferAfter) * 60_000;
                    if (rStart < conflictWindowEnd && rEnd > conflictWindowStart) {
                        // A capacity booking consumes party-size units, not
                        // merely one reservation row. Snapshot fields keep
                        // historical reservations on their original contract
                        // while the current service capacity remains the
                        // authoritative ceiling for this slot.
                        const reservationMode = r.capacity_mode_snapshot ?? service.capacity_mode;
                        overlapUnits += ["group", "pooled", "capacity"].includes(reservationMode)
                            ? Math.max(1, r.party_size ?? 1)
                            : 1;
                    }
                }
                const requestedUnits = ["group", "pooled", "capacity"].includes(service.capacity_mode)
                    ? Math.max(1, requestedPartySize ?? 1)
                    : 1;
                if (overlapUnits + requestedUnits > capacity) {
                    appendSlot({
                        start: new Date(slotStartMs).toISOString(),
                        end: new Date(slotEndMs).toISOString(),
                        status: "manual_review",
                        reason: capacity > 1
                            ? `All ${capacity} concurrent slots are reserved.`
                            : "Another reservation already overlaps with this time window.",
                    });
                    continue;
                }

                appendSlot({
                    start: new Date(slotStartMs).toISOString(),
                    end: new Date(slotEndMs).toISOString(),
                    status: "available",
                    reason: null,
                });
                if (truncated) break;
            }
            if (truncated) break;
        }
        if (truncated) break;
    }

    // De-duplicate: in DST fall-back, the same wall-clock can map twice; we keep the first.
    const seen = new Set<string>();
    const deduped = slots.filter((s) => {
        const key = `${s.start}|${s.end}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    deduped.sort((a, b) => a.start.localeCompare(b.start));

    return { slots: deduped, businessTimezone, notices, truncated };
}

// ─── Tiny date helpers (kept local to avoid importing more of date-fns) ──

function pad2(n: number): string {
    return String(n).padStart(2, "0");
}

function nextYmd(ymd: string): string {
    // ymd is YYYY-MM-DD. Use UTC arithmetic (the +24h is exact in UTC).
    const d = new Date(`${ymd}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
