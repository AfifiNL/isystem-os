import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

test("portal enrollment is optional while privacy acknowledgement remains explicit", () => {
    const client = read("src/features/booking/ui/public-booking-experience.tsx");
    const actions = read("src/features/booking/actions.ts");

    assert.doesNotMatch(client, /requiresAccountConsent && !accountCreationApproved/);
    assert.doesNotMatch(actions, /Consultation bookings require explicit approval for client account creation/);
    assert.match(actions, /if \(isConsultationBooking && payload\.consents\.accountCreationApproved === true\)/);
    assert.match(client, /required\s+checked=\{privacyAccepted\}/);
    assert.match(client, /privacyUrl/);
});
