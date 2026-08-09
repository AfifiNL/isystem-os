import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BOOKING_MINIMUM_LEAD_TIME_MINUTES } from "@/features/booking/lib/booking-policies";
import { walkAvailabilitySlots, type AvailabilityRule, type SlotWalkerService } from "@/features/booking/lib/slot-walker";

const service: SlotWalkerService = {
    id: "service-1",
    duration_minutes: 60,
    buffer_before_minutes: 0,
    buffer_after_minutes: 0,
    lead_time_minutes: 0,
    max_advance_days: 90,
    capacity_mode: "single",
    capacity_value: 1,
    requires_manual_review: false,
};

const weekdayRule: AvailabilityRule = {
    id: "rule-1",
    rule_type: "recurring",
    timezone: "Europe/Amsterdam",
    weekday_json: [1, 2, 3, 4, 5],
    starts_on: null,
    ends_on: null,
    date_json: {},
    time_windows_json: [{ start: "09:00", end: "17:00", slotMinutes: 60 }],
    priority: 100,
    service_id: null,
    resource_id: null,
    location_id: null,
};

describe("walkAvailabilitySlots booking lead-time policy", () => {
    it("hides slots inside the platform 72-hour minimum even if service config is lower", () => {
        const nowMs = Date.parse("2026-06-08T18:00:00.000Z");

        const result = walkAvailabilitySlots({
            service,
            rules: [weekdayRule],
            blackouts: [],
            reservations: [],
            rangeStartIso: "2026-06-09T00:00:00.000Z",
            rangeEndIso: "2026-06-12T23:59:59.999Z",
            selectedResourceId: null,
            selectedLocationId: null,
            nowMs,
            defaultStrideMinutes: service.duration_minutes,
        });

        assert.ok(result.slots.every((slot) => new Date(slot.start).getTime() >= nowMs + BOOKING_MINIMUM_LEAD_TIME_MINUTES * 60_000));
        assert.equal(result.slots.some((slot) => slot.start.startsWith("2026-06-09")), false);
    });

    it("continues to respect non-bookable weekend days when finding the first slot after 72 hours", () => {
        const fridayAfternoonMs = Date.parse("2026-06-05T14:00:00.000Z");

        const result = walkAvailabilitySlots({
            service: { ...service, lead_time_minutes: BOOKING_MINIMUM_LEAD_TIME_MINUTES },
            rules: [weekdayRule],
            blackouts: [],
            reservations: [],
            rangeStartIso: "2026-06-05T00:00:00.000Z",
            rangeEndIso: "2026-06-10T23:59:59.999Z",
            selectedResourceId: null,
            selectedLocationId: null,
            nowMs: fridayAfternoonMs,
            defaultStrideMinutes: service.duration_minutes,
        });

        const firstAvailable = result.slots.find((slot) => slot.status === "available");

        assert.ok(firstAvailable);
        assert.ok(firstAvailable.start.startsWith("2026-06-08T"));
        assert.equal(result.slots.some((slot) => slot.start.startsWith("2026-06-06") || slot.start.startsWith("2026-06-07")), false);
    });

    it("uses party-size units for capacity availability instead of counting rows", () => {
        const capacityService: SlotWalkerService = {
            ...service,
            capacity_mode: "capacity",
            capacity_value: 10,
        };
        const reservation = {
            service_id: "service-1",
            scheduled_start: "2026-06-15T07:00:00.000Z",
            scheduled_end: "2026-06-15T08:00:00.000Z",
            resource_id: null,
            location_id: null,
            party_size: 6,
            capacity_mode_snapshot: "capacity" as const,
            capacity_value_snapshot: 10,
        };

        const availableForSmallParty = walkAvailabilitySlots({
            service: capacityService,
            rules: [weekdayRule],
            blackouts: [],
            reservations: [reservation],
            rangeStartIso: "2026-06-15T00:00:00.000Z",
            rangeEndIso: "2026-06-15T23:59:59.999Z",
            selectedResourceId: null,
            selectedLocationId: null,
            requestedPartySize: 4,
            nowMs: Date.parse("2026-06-01T00:00:00.000Z"),
            defaultStrideMinutes: 60,
        });
        assert.equal(availableForSmallParty.slots.find((slot) => slot.start === reservation.scheduled_start)?.status, "available");

        const blockedForLargeParty = walkAvailabilitySlots({
            service: capacityService,
            rules: [weekdayRule],
            blackouts: [],
            reservations: [reservation],
            rangeStartIso: "2026-06-15T00:00:00.000Z",
            rangeEndIso: "2026-06-15T23:59:59.999Z",
            selectedResourceId: null,
            selectedLocationId: null,
            requestedPartySize: 5,
            nowMs: Date.parse("2026-06-01T00:00:00.000Z"),
            defaultStrideMinutes: 60,
        });
        assert.equal(blockedForLargeParty.slots.find((slot) => slot.start === reservation.scheduled_start)?.status, "manual_review");
    });
});
