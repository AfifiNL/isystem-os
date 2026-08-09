import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { verifyContentFreshness } from "@/features/content-engine/verify-freshness";
import { reportWorkerHealth } from "@/shared/lib/health/evidence";
import type { Database } from "@/shared/lib/supabase/database.types";

function getAcceptedSecrets(): string[] {
    return [process.env.CONTENT_FRESHNESS_CRON_SECRET, process.env.CRON_SECRET]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value));
}

function authorize(req: NextRequest): boolean {
    const header = req.headers.get("authorization");
    if (!header?.startsWith("Bearer ")) return false;
    const candidate = header.slice("Bearer ".length).trim();
    const cBuf = Buffer.from(candidate);
    return getAcceptedSecrets().some((secret) => {
        const sBuf = Buffer.from(secret);
        if (cBuf.length !== sBuf.length) return false;
        return timingSafeEqual(cBuf, sBuf);
    });
}

function getServiceRoleClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Missing Supabase service-role configuration.");
    }

    return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}

export async function POST(req: NextRequest) {
    const startTime = Date.now();
    if (!authorize(req)) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    let supabase;
    try {
        supabase = getServiceRoleClient();
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }

    try {
        // 1. Fetch published content items and their corresponding freshness review state
        const { data: contentItems, error: fetchError } = await supabase
            .from("content_items")
            .select(`
                id,
                workspace_id,
                title,
                created_at
            `)
            .eq("status", "published");

        if (fetchError) {
            throw new Error(`Failed to query published content: ${fetchError.message}`);
        }

        if (!contentItems || contentItems.length === 0) {
            await reportWorkerHealth({
                provider: "cron",
                integrationKey: "stale-content-scanner",
                status: "healthy",
                latencyMs: Date.now() - startTime,
                message: "No published content items found to scan.",
            });
            return NextResponse.json({ ok: true, scanned: 0, message: "No published content items found." });
        }

        // 2. Fetch all existing reviews to sort by checked_at in memory
        const { data: existingReviews, error: reviewsError } = await supabase
            .from("content_freshness_reviews" as never)
            .select("content_item_id,checked_at" as never);

        if (reviewsError) {
            console.warn(`[stale-content-scanner] Could not fetch existing reviews: ${reviewsError.message}`);
        }

        interface FreshnessReviewRow {
            content_item_id: string;
            checked_at: string;
        }

        const reviewsMap = new Map<string, string>();
        if (existingReviews) {
            for (const r of (existingReviews as unknown as FreshnessReviewRow[])) {
                reviewsMap.set(r.content_item_id, r.checked_at);
            }
        }

        // 3. Sort items: items never checked first, then oldest checked first
        const sortedItems = [...contentItems].sort((a, b) => {
            const dateA = reviewsMap.get(a.id);
            const dateB = reviewsMap.get(b.id);
            if (!dateA && !dateB) {
                const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
                const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
                return timeB - timeA;
            }
            if (!dateA) return -1;
            if (!dateB) return 1;
            return new Date(dateA).getTime() - new Date(dateB).getTime();
        });

        // Batch scan up to 5 items to keep latency and API costs low
        const batchToScan = sortedItems.slice(0, 5);
        let scannedCount = 0;
        let staleCount = 0;
        const results = [];

        for (const item of batchToScan) {
            try {
                // Execute freshness verify logic using service role client override
                const result = await verifyContentFreshness(
                    item.id,
                    supabase as unknown as Parameters<typeof verifyContentFreshness>[1]
                );
                scannedCount++;

                if (result.verification_status === "stale") {
                    staleCount++;
                }

                // Write review details to content_freshness_reviews
                const { error: upsertError } = await supabase
                    .from("content_freshness_reviews" as never)
                    .upsert({
                        workspace_id: item.workspace_id,
                        content_item_id: item.id,
                        status: result.verification_status,
                        risk: result.freshness_risk,
                        stale_indicators: result.stale_indicators,
                        checked_at: result.checked_at,
                    } as never, {
                        onConflict: "workspace_id,content_item_id"
                    } as never);

                if (upsertError) {
                    console.error(`[stale-content-scanner] Failed to upsert review for ${item.id}: ${upsertError.message}`);
                }

                results.push({
                    contentId: item.id,
                    title: item.title,
                    status: result.verification_status,
                    indicators: result.stale_indicators,
                });
            } catch (err) {
                console.error(`[stale-content-scanner] Exception scanning content item ${item.id}:`, err);
            }
        }

        const duration = Date.now() - startTime;
        await reportWorkerHealth({
            provider: "cron",
            integrationKey: "stale-content-scanner",
            status: "healthy",
            latencyMs: duration,
            message: `Scanned ${scannedCount} published items. Found ${staleCount} stale items.`,
            details: { results },
        });

        return NextResponse.json({
            ok: true,
            scanned: scannedCount,
            stale: staleCount,
            results,
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        const msg = error instanceof Error ? error.message : String(error);
        await reportWorkerHealth({
            provider: "cron",
            integrationKey: "stale-content-scanner",
            status: "failing",
            latencyMs: duration,
            message: `Stale content scanner run failed: ${msg}`,
        });

        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
