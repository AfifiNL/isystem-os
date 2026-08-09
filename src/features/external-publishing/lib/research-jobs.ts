import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/shared/lib/supabase/database.types";
import { externalPublicationResearchJobInputSchema } from "../schema";
import type { ExternalPublicationResearchJobInput } from "../schema";
import type { ExternalPublicationResearchJobRow } from "../types";

type ExternalPublishingSupabaseClient = SupabaseClient<Database>;

export async function enqueueExternalPublicationResearchJob(
    supabase: ExternalPublishingSupabaseClient,
    input: ExternalPublicationResearchJobInput,
): Promise<ExternalPublicationResearchJobRow> {
    const parsed = externalPublicationResearchJobInputSchema.parse(input);
    const { data, error } = await supabase
        .from("external_publication_research_jobs")
        .insert({
            workspace_id: parsed.workspaceId,
            package_id: parsed.packageId ?? null,
            campaign_id: parsed.campaignId ?? null,
            provider: parsed.provider,
            job_type: parsed.jobType,
            priority: parsed.priority,
            run_after: parsed.runAfter,
            input: parsed.input as Json,
        })
        .select("*")
        .single();

    if (error) throw new Error(`Failed to enqueue external publication research job: ${error.message}`);
    return data;
}
