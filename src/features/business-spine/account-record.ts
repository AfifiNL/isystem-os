import type { Json } from "@/shared/lib/supabase/database.types";
import type { BusinessLifecycleStatus } from "@/features/business-spine/types";

export const BUSINESS_LIFECYCLE_STATUSES = ["prospect", "lead", "qualified", "customer", "active", "paused", "churned"] as const satisfies readonly BusinessLifecycleStatus[];

const LIFECYCLE_STATUSES = new Set<BusinessLifecycleStatus>(BUSINESS_LIFECYCLE_STATUSES);

export function validateBusinessLifecycleStatus(value: string): BusinessLifecycleStatus | null {
    return LIFECYCLE_STATUSES.has(value as BusinessLifecycleStatus) ? value as BusinessLifecycleStatus : null;
}

export function buildCustomerNoteTimelinePayload(input: { note: string; authorProfileId: string | null }) {
    const note = input.note.trim();
    return {
        eventType: "customer.note",
        summary: note.length > 96 ? `${note.slice(0, 93)}...` : note,
        body: note,
        actorType: "workspace_manager",
        sourceModule: "business_spine",
        visibility: "internal",
        payload: {
            note,
            authored_by_profile_id: input.authorProfileId,
            created_from: "dashboard_customer_detail",
        } as Json,
    };
}
