import { createAdminClient } from "@/shared/lib/supabase/admin";
import { processOutreachDiscoveryJob } from "@/features/outreach/discovery";
import type { OutreachDiscoveryJobRow, OutreachWorkerResult } from "@/features/outreach/types";

type RpcError = { message: string } | null;
type AdminClient = ReturnType<typeof createAdminClient>;

async function finalizeCampaignDiscoveryIfIdle(supabase: AdminClient, campaignId: string) {
    const { data: activeJobs, error: activeJobsError } = await supabase
        .from("outreach_discovery_jobs" as never)
        .select("id" as never)
        .eq("campaign_id" as never, campaignId as never)
        .in("status" as never, ["queued", "running"] as never)
        .limit(1);

    if (activeJobsError || ((activeJobs ?? []) as unknown[]).length > 0) return;

    const { data: accounts, error: accountsError } = await supabase
        .from("outreach_prospect_accounts" as never)
        .select("id" as never)
        .eq("campaign_id" as never, campaignId as never)
        .limit(1);

    if (accountsError) return;
    const hasAccounts = ((accounts ?? []) as unknown[]).length > 0;
    const nextStatus = hasAccounts ? "reviewing" : "draft";

    await supabase
        .from("outreach_campaigns" as never)
        .update({ status: nextStatus } as never)
        .eq("id" as never, campaignId as never)
        .eq("status" as never, "discovering" as never);
}

export async function processNextOutreachDiscoveryJob(workerId: string): Promise<OutreachWorkerResult> {
    const supabase = createAdminClient();
    const { data: job, error: claimError } = await (supabase.rpc as unknown as (
        name: string,
        args: Record<string, unknown>,
    ) => Promise<{ data: OutreachDiscoveryJobRow | null; error: RpcError }>)(
        "claim_next_outreach_discovery_job",
        { p_worker_id: workerId },
    );

    if (claimError) return { success: false, message: claimError.message };
    if (!job?.id) return { success: false, message: "No queued jobs found." };

    try {
        const summary = await processOutreachDiscoveryJob(supabase as never, job);
        await supabase.from("outreach_discovery_jobs" as never).update({
            status: "completed",
            completed_at: new Date().toISOString(),
            result_summary: summary,
            error_message: null,
        } as never).eq("id" as never, job.id as never);
        await finalizeCampaignDiscoveryIfIdle(supabase, job.campaign_id);
        return { success: true, jobId: job.id, workspaceId: job.workspace_id, message: "Outreach discovery job completed." };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await supabase.from("outreach_discovery_jobs" as never).update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: message,
        } as never).eq("id" as never, job.id as never);
        await finalizeCampaignDiscoveryIfIdle(supabase, job.campaign_id);
        return { success: false, jobId: job.id, workspaceId: job.workspace_id, message };
    }
}
