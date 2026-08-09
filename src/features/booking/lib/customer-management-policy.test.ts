import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    getCustomerBookingManagementPolicy,
    getPostSessionCommercialFollowUpPlan,
} from "./customer-management-policy";

describe("customer booking management policy", () => {
    const now = new Date("2026-08-01T12:00:00.000Z");
    const future = "2026-08-10T12:00:00.000Z";

    it("allows active future reservations to be cancelled or rescheduled", () => {
        for (const status of ["pending_review", "pending_confirmation", "confirmed"] as const) {
            assert.deepEqual(
                getCustomerBookingManagementPolicy({ status, scheduledStart: future, now }),
                {
                    canCancel: true,
                    canReschedule: true,
                    isTerminal: false,
                    reason: null,
                },
                status,
            );
        }
    });

    it("fails closed for past and terminal reservations", () => {
        const past = getCustomerBookingManagementPolicy({
            status: "confirmed",
            scheduledStart: "2026-07-31T12:00:00.000Z",
            now,
        });
        assert.equal(past.canCancel, false);
        assert.equal(past.canReschedule, false);

        for (const status of [
            "completed",
            "cancelled_by_customer",
            "cancelled_by_workspace",
            "no_show",
            "expired",
        ] as const) {
            const result = getCustomerBookingManagementPolicy({ status, scheduledStart: future, now });
            assert.equal(result.canCancel, false, status);
            assert.equal(result.canReschedule, false, status);
            assert.equal(result.isTerminal, true, status);
        }
    });

    it("requires human review for commercial follow-up after a completed session", () => {
        assert.deepEqual(
            getPostSessionCommercialFollowUpPlan({
                reservationId: payloadReservationId,
                customerName: "Ada Lovelace",
                completedAt: "2026-08-01T12:00:00.000Z",
            }),
            {
                title: "Review completed session with Ada Lovelace",
                kind: "booking_commercial_follow_up",
                priority: "high",
                dueAt: "2026-08-02T12:00:00.000Z",
                idempotencyKey: `work:booking-commercial-follow-up:${payloadReservationId}`,
                requiresHumanApproval: true,
            },
        );
    });
});

const payloadReservationId = "00000000-0000-4000-8000-000000000001";
