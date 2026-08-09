"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { classifyTopicFreshnessRisk } from "@/shared/lib/ai/freshness";
import { buildFactSheet } from "@/shared/lib/ai/research-facts";
import type { CanonicalFactSheet } from "@/shared/lib/ai/research-facts";

export type ContentVerificationStatus = "fresh" | "stale" | "uncertain" | "evergreen" | "error";

export interface ContentVerificationResult {
    contentId: string;
    title: string;
    verification_status: ContentVerificationStatus;
    checked_at: string;
    freshness_risk: "evergreen" | "recent" | "breaking";
    fact_sheet: CanonicalFactSheet | null;
    stale_indicators: string[];
    error: string | null;
}

const STALE_PHRASES = [
    "highly anticipated",
    "expected to launch",
    "upcoming release",
    "rumored to arrive",
    "set to launch",
    "will be released",
    "yet to be released",
    "eagerly awaited",
    "slated for release",
];

/**
 * Persist a freshness check into `content_items.metadata.provenance.last_freshness_check`.
 * Always runs — even for the evergreen early-return and the error path — so the
 * badge in the editor UI updates on the next page refresh instead of the
 * button silently no-oping. Prior versions skipped the write on evergreen,
 * which made the "Verify freshness" button look broken for any content that
 * didn't trip the vendor/breaking detector.
 */
async function persistFreshnessCheck(
    supabase: Awaited<ReturnType<typeof createClient>>,
    contentId: string,
    previousMetadata: Record<string, unknown>,
    payload: {
        checked_at: string;
        freshness_risk: "evergreen" | "recent" | "breaking";
        verification_status: ContentVerificationStatus;
        topic_status?: string;
        stale_indicators: string[];
        error?: string | null;
    },
): Promise<{ error: string | null }> {
    const updatedProvenance = {
        ...((previousMetadata.provenance as Record<string, unknown>) ?? {}),
        last_freshness_check: payload,
    };
    const { error } = await supabase
        .from("content_items")
        .update({ metadata: { ...previousMetadata, provenance: updatedProvenance } })
        .eq("id", contentId);
    return { error: error?.message ?? null };
}

type SupabaseClientType = Awaited<ReturnType<typeof createClient>>;

export async function verifyContentFreshness(
    contentId: string,
    supabaseClientOverride?: SupabaseClientType,
): Promise<ContentVerificationResult> {
    const supabase = supabaseClientOverride ?? await createClient();
    const checkedAt = new Date().toISOString();

    const { data: item, error: fetchError } = await supabase
        .from("content_items")
        .select("id, title, content_markdown, metadata, locale")
        .eq("id", contentId)
        .single();

    if (fetchError || !item) {
        return {
            contentId,
            title: "",
            verification_status: "error",
            checked_at: checkedAt,
            freshness_risk: "evergreen",
            fact_sheet: null,
            stale_indicators: [],
            error: fetchError?.message ?? "Content item not found",
        };
    }

    const metadata = (item.metadata as Record<string, unknown> | null) ?? {};
    const generationInputs = metadata.generation_inputs as Record<string, unknown> | null;
    const rawKeywords = generationInputs?.keywords;
    const keywords = Array.isArray(rawKeywords) ? (rawKeywords as string[]) : [];

    const freshnessRisk = classifyTopicFreshnessRisk(item.title, keywords);

    // Evergreen topics don't need Tavily — still persist so the badge flips to
    // "Evergreen · today" and the operator sees something changed.
    if (freshnessRisk === "evergreen") {
        const writeResult = await persistFreshnessCheck(supabase, contentId, metadata, {
            checked_at: checkedAt,
            freshness_risk: "evergreen",
            verification_status: "evergreen",
            stale_indicators: [],
        });
        revalidatePath(`/dashboard/content/${contentId}`);
        return {
            contentId,
            title: item.title,
            verification_status: "evergreen",
            checked_at: checkedAt,
            freshness_risk: "evergreen",
            fact_sheet: null,
            stale_indicators: [],
            error: writeResult.error,
        };
    }

    let factSheet: CanonicalFactSheet | null = null;
    let factSheetError: string | null = null;
    try {
        // Pass the post's own locale so freshness research finds same-language
        // sources for NL/AR posts instead of falling back to global English.
        factSheet = await buildFactSheet(item.title, keywords, freshnessRisk, item.locale);
    } catch (err) {
        factSheetError = err instanceof Error ? err.message : "Fact sheet build failed";
    }

    if (factSheetError || !factSheet) {
        // Persist the error state so the badge shows "Check failed" + timestamp
        // instead of looking inert after a click.
        await persistFreshnessCheck(supabase, contentId, metadata, {
            checked_at: checkedAt,
            freshness_risk: freshnessRisk,
            verification_status: "error",
            stale_indicators: [],
            error: factSheetError,
        });
        revalidatePath(`/dashboard/content/${contentId}`);
        return {
            contentId,
            title: item.title,
            verification_status: "error",
            checked_at: checkedAt,
            freshness_risk: freshnessRisk,
            fact_sheet: null,
            stale_indicators: [],
            error: factSheetError ?? "Fact sheet unavailable",
        };
    }

    const staleIndicators: string[] = [];
    if (factSheet.status === "released") {
        const contentLower = (item.content_markdown ?? "").toLowerCase();
        for (const phrase of STALE_PHRASES) {
            if (contentLower.includes(phrase)) {
                staleIndicators.push(
                    `Stale phrase: "${phrase}" — this topic has status "${factSheet.status}"`,
                );
            }
        }
    }

    const verificationStatus: ContentVerificationStatus =
        staleIndicators.length > 0 ? "stale"
        : factSheet.status === "unclear" ? "uncertain"
        : "fresh";

    const writeResult = await persistFreshnessCheck(supabase, contentId, metadata, {
        checked_at: checkedAt,
        freshness_risk: freshnessRisk,
        verification_status: verificationStatus,
        topic_status: factSheet.status,
        stale_indicators: staleIndicators,
    });

    revalidatePath(`/dashboard/content/${contentId}`);

    return {
        contentId,
        title: item.title,
        verification_status: verificationStatus,
        checked_at: checkedAt,
        freshness_risk: freshnessRisk,
        fact_sheet: factSheet,
        stale_indicators: staleIndicators,
        error: writeResult.error,
    };
}
