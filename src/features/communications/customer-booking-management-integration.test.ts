import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("customer booking management integration", () => {
    it("adds a localized, signed management link to customer booking messages", () => {
        const source = read("src/features/booking/lib/booking-emails.ts");
        assert.match(source, /createBookingManagementToken/);
        assert.match(source, /localizeHref\(ctx\.locale, "\/booking\/manage"\)/);
        assert.match(source, /Manage booking/);
        assert.match(source, /Boeking beheren/);
        assert.match(source, /إدارة الحجز/);
        assert.match(source, /const eventInstanceKey = params\.eventInstanceKey \?\? \(/);
        assert.match(source, /params\.eventType === "reservation_rescheduled"/);
    });

    it("exposes token-verified cancel and reschedule actions without trusting client identity fields", () => {
        const actions = read("src/features/booking/actions/customer-management.ts");
        assert.match(actions, /verifyBookingManagementToken/);
        assert.match(actions, /\.eq\("id", capability\.reservationId\)/);
        assert.match(actions, /\.eq\("workspace_id", capability\.workspaceId\)/);
        assert.match(actions, /getBookingAvailabilityPreview/);
        assert.match(actions, /reservation_rescheduled/);
        assert.match(actions, /cancelled_by_customer/);
        assert.doesNotMatch(actions, /formData\.get\(["']customer(?:Email|_email)["']\)/);
    });

    it("renders the public management route in the existing locale-aware surface", () => {
        const page = read("src/app/(public)/booking/manage/page.tsx");
        const client = read("src/features/booking/ui/customer-booking-manager.tsx");
        assert.match(page, /getCustomerBookingManagementView/);
        assert.match(client, /manageCustomerBookingAction/);
        assert.match(client, /type="hidden" name="token"/);
    });

    it("shows customer-safe meeting and location handoff details", () => {
        const actions = read("src/features/booking/actions/customer-management.ts");
        const client = read("src/features/booking/ui/customer-booking-manager.tsx");
        assert.match(actions, /booking_meetings!booking_meetings_workspace_reservation_fk/);
        assert.match(actions, /booking_locations!booking_reservations_workspace_location_fk/);
        assert.doesNotMatch(actions, /booking_locations:location_id/);
        assert.match(actions, /joinUrl:/);
        assert.match(actions, /locationInstructions:/);
        assert.match(client, /view\.joinUrl/);
        assert.match(client, /view\.locationInstructions/);
        assert.match(client, /Join meeting/);
        assert.match(client, /Deelnemen aan de vergadering/);
        assert.match(client, /انضم إلى الاجتماع/);
        assert.doesNotMatch(actions, /start_url/);
    });

    it("includes localized location instructions in customer booking emails", () => {
        const source = read("src/features/booking/lib/booking-emails.ts");
        assert.match(source, /booking_locations!booking_reservations_workspace_location_fk/);
        assert.doesNotMatch(source, /booking_locations:location_id/);
        assert.match(source, /booking-emails: reservation context lookup failed/);
        assert.match(source, /locationInstructions/);
        assert.match(source, /resolveLocalizedJson/);
        assert.match(source, /ctx\.locationInstructions/);
        assert.match(source, /ctx\.meeting\?\.joinUrl/);
    });

    it("retries pending meetings and confirms only after the room is ready", () => {
        const actions = read("src/features/booking/actions.ts");
        assert.match(actions, /export async function retryBookingMeeting/);
        assert.match(actions, /provisionAndConfirmReservation/);
        assert.match(actions, /\.in\("status", \["pending_review", "pending_confirmation", "confirmed", "completed"\]\)/);
        assert.match(actions, /payment\.status === "verified"/);
        assert.match(actions, /eventType: "reservation_confirmed"/);
    });

    it("gates operator confirmation on successful meeting provisioning", () => {
        const actions = read("src/features/booking/actions.ts");
        const start = actions.indexOf("export async function transitionBookingReservationStatus");
        const end = actions.indexOf("export async function markBookingDeliveryStarted", start);
        const transition = actions.slice(start, end);

        assert.match(transition, /provisionAndConfirmReservation/);
        assert.match(transition, /provisionMeeting: \(\) => ensureBookingMeeting/);
        assert.match(transition, /commitConfirmation: async \(\) =>/);
        assert.doesNotMatch(transition, /meeting creation failed on confirmation/);
    });

    it("stages a confirmed self-service reschedule until its meeting is updated", () => {
        const actions = read("src/features/booking/actions/customer-management.ts");
        const start = actions.indexOf("async function rescheduleCustomerReservation");
        const end = actions.indexOf("export async function manageCustomerBookingAction", start);
        const reschedule = actions.slice(start, end);

        assert.match(reschedule, /directConfirmedReschedule/);
        assert.match(reschedule, /stagedStatus.*"pending_review"/s);
        assert.match(reschedule, /provisionAndConfirmReservation/);
        assert.match(reschedule, /provisionMeeting: \(\) => ensureBookingMeeting/);
        assert.match(reschedule, /eventType = resultingStatus === "confirmed"/);
    });

    it("creates an idempotent operator work item instead of auto-sending a proposal", () => {
        const service = read("src/features/business-spine/service.ts");
        const policy = read("src/features/booking/lib/customer-management-policy.ts");
        assert.match(service, /getPostSessionCommercialFollowUpPlan/);
        assert.match(policy, /booking_commercial_follow_up/);
        assert.match(service, /requiresHumanApproval: true/);
        assert.doesNotMatch(service, /send.*proposal/i);
    });
});
