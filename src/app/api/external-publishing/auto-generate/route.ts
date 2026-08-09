import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { mineExternalPublishingOpportunitiesForWorkspace } from "@/features/external-publishing/service";
import { createExternalPublishingPackageDraft, generateAndStoreExternalPublishingPackage } from "@/features/external-publishing/service";

export const maxDuration = 120; // 2 minute timeout for generation

function getCronSecrets(): string[] {
    return [process.env.EXTERNAL_PUBLISHING_CRON_SECRET, process.env.CRON_SECRET]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value));
}

function isValidCronSecret(candidate: string | null): boolean {
    if (!candidate) return false;
    const candidateBuffer = Buffer.from(candidate);
    return getCronSecrets().some((secret) => {
        const secretBuffer = Buffer.from(secret);
        if (candidateBuffer.length !== secretBuffer.length) return false;
        return timingSafeEqual(candidateBuffer, secretBuffer);
    });
}

function isAuthorizedCronRequest(req: NextRequest): boolean {
    const authorization = req.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) return false;
    return isValidCronSecret(authorization.slice("Bearer ".length).trim());
}

export async function POST(req: NextRequest) {
    if (!isAuthorizedCronRequest(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const supabase = await createClient();

        // Find all workspaces that have active campaigns or just grab all workspaces with active research documents
        const { data: workspaces, error: workspaceError } = await (supabase as unknown as {
            from: (t: string) => {
                select: (c: string) => {
                    eq: (c: string, v: string) => {
                        limit: (n: number) => Promise<{ data: Array<{ workspace_id: string }> | null; error: { message: string } | null }>;
                    };
                };
            };
        })
            .from("external_publication_research_documents")
            .select("workspace_id")
            .eq("source_kind", "reddit_question")
            .limit(1000);

        if (workspaceError) {
            return NextResponse.json({ error: workspaceError.message }, { status: 500 });
        }

        const uniqueWorkspaceIds = Array.from(new Set((workspaces || []).map((w: { workspace_id: string }) => w.workspace_id)));
        const results = [];

        for (const workspaceId of uniqueWorkspaceIds) {
            const scope = { workspaceId, locale: "en" as const };
            const opportunities = await mineExternalPublishingOpportunitiesForWorkspace(scope);

            // Filter for high priority reddit questions
            const redditOpps = opportunities.filter((opp) =>
                opp.sourceType === "market_signal" &&
                opp.score > 70 &&
                opp.scoreReasons.some((r) => r === "Reddit audience opportunity")
            );

            let generatedCount = 0;
            for (const opp of redditOpps) {
                // Check if we already created a package for this topic to avoid duplicates
                const { data: existing } = await supabase
                    .from("external_publication_packages")
                    .select("id")
                    .eq("workspace_id", workspaceId)
                    .eq("source_type", "market_signal")
                    .eq("topic", opp.topic)
                    .limit(1);

                if (existing && existing.length > 0) {
                    continue; // Already processed
                }

                // 1. Create draft
                const draft = await createExternalPublishingPackageDraft(scope, {
                    platform: "reddit",
                    sourceType: opp.sourceType,
                    sourceContentId: opp.sourceContentId ?? null,
                    topic: opp.topic,
                    targetUrl: opp.targetUrl,
                    targetSlug: opp.targetSlug,
                    locale: opp.locale,
                    utmSource: "workspace",
                    utmMedium: "community",
                    utmCampaign: "reddit_auto_gen",
                    utmContent: "reddit_response",
                });

                // 2. Generate package
                await generateAndStoreExternalPublishingPackage(scope, draft.id);
                generatedCount++;
            }

            results.push({ workspaceId, opportunitiesFound: redditOpps.length, generatedPackages: generatedCount });
        }

        return NextResponse.json({ success: true, results });
    } catch (error) {
        console.error("[external-publishing-auto-generate]", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Generation failed" },
            { status: 500 }
        );
    }
}
