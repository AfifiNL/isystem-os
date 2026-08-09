"use server";

import { createClient } from "@/shared/lib/supabase/server";
import { upsertWorkItem } from "@/features/business-spine/service";

export async function runNextBestActionEngine(workspaceId: string): Promise<{ ok: boolean; generatedTasks: number; message: string }> {
    const supabase = await createClient();
    let generatedTasks = 0;

    // 1. Scan for active customers with no owner
    const { data: orphans } = await supabase
        .from("workspace_customers" as never)
        .select("id, display_name" as never)
        .eq("workspace_id" as never, workspaceId as never)
        .eq("lifecycle_status" as never, "active" as never)
        .is("owner_profile_id" as never, null as never)
        .is("deleted_at" as never, null as never) as unknown as { data: { id: string; display_name: string }[] | null };

    for (const customer of orphans ?? []) {
        await upsertWorkItem({
            supabase,
            workspaceId,
            customerId: customer.id,
            title: `Assign account owner for ${customer.display_name}`,
            description: "This customer is active but has no assigned owner. Please assign someone to manage this account.",
            kind: "account_management",
            priority: "normal",
            sourceModule: "next_best_action",
            sourceEntityType: "workspace_customer",
            sourceEntityId: customer.id,
            idempotencyKey: `nba:assign-owner:${customer.id}`,
        });
        generatedTasks += 1;
    }

    // 2. We can add more rules here (e.g. overdue invoices) when we have direct access to legal_invoices
    // For now, the engine is seeded with the first structural rule.

    return { ok: true, generatedTasks, message: `Next-Best-Action engine ran successfully. Generated ${generatedTasks} tasks.` };
}
