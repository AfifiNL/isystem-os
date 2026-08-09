export type BookingLifecycleStage = "lead" | "qualified" | "customer" | "active";

export interface BookingLifecycleInput {
    status: string;
    serviceKey: string | null;
    paymentStatus: string | null;
    engagementStarted?: boolean;
}

export function deriveBookingLifecycle(input: BookingLifecycleInput): BookingLifecycleStage {
    // "active" is an explicit operational milestone. A confirmed booking or
    // a completed fit call alone must not silently turn a lead into an active
    // client; callers that have actually started delivery must opt in.
    if (input.engagementStarted === true) return "active";

    const isCancelled = input.status === "cancelled_by_customer"
        || input.status === "cancelled_by_workspace"
        || input.status === "expired"
        || input.status === "no_show";
    if (isCancelled) return "lead";

    const isBlueprint = input.serviceKey === "systems-blueprint" || input.serviceKey === "systems_blueprint";
    if (isBlueprint && input.paymentStatus === "verified") return "customer";

    const isFitCall = input.serviceKey === "systems-fit-call" || input.serviceKey === "systems_fit_call";
    if (isFitCall && (input.status === "confirmed" || input.status === "completed")) return "qualified";

    return "lead";
}
