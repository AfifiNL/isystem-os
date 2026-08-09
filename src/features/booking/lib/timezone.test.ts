import test from "node:test";
import assert from "node:assert/strict";

import { calendarDateInTimezone, isValidIanaTimezone, dateRangeToUtc } from "./timezone";

test("accepts IANA timezones and rejects arbitrary strings", () => {
    assert.equal(isValidIanaTimezone("Europe/Amsterdam"), true);
    assert.equal(isValidIanaTimezone("America/New_York"), true);
    assert.equal(isValidIanaTimezone("not-a-timezone"), false);
    assert.equal(isValidIanaTimezone(""), false);
});

test("converts a viewer-local date range without assuming UTC midnight", () => {
    const range = dateRangeToUtc({ start: "2026-03-29", end: "2026-03-29", timezone: "Europe/Amsterdam" });
    assert.equal(range.start < range.end, true);
    assert.equal(new Date(range.start).toISOString(), "2026-03-28T23:00:00.000Z");
});

test("derives a calendar day in the visitor timezone across UTC midnight", () => {
    const instant = new Date("2026-08-04T00:30:00.000Z");
    assert.equal(calendarDateInTimezone(instant, "America/New_York"), "2026-08-03");
    assert.equal(calendarDateInTimezone(instant, "Europe/Amsterdam"), "2026-08-04");
});
