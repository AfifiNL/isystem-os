"use server";

import { updateContentItem } from "@/features/content-engine/actions";
import { revalidatePath } from "next/cache";

interface SyncVideoMetadataInput {
    contentItemId: string;
    video_url: string;
    video_duration?: number;
    video_resolution?: string;
}

/**
 * Syncs video metadata to an existing content item after a successful upload to Supabase Storage.
 * This acts as a tailored wrapper around the core content updates specific to video workflows.
 */
export async function syncVideoMetadata({
    contentItemId,
    video_url,
    video_duration,
    video_resolution,
}: SyncVideoMetadataInput) {

    if (!contentItemId) return { error: "Content Item ID is required to sync metadata." };
    if (!video_url) return { error: "Video URL is required." };

    const result = await updateContentItem(contentItemId, {
        video_url,
        video_duration,
        video_resolution,
    });

    if (result.error) {
        console.error("Failed to sync video metadata:", result.error);
        return { error: result.error };
    }

    // Revalidate both the route-group form (matches the segment tree) and
    // the URL-path form (matches the resolved path object). Every other
    // revalidate site in this codebase uses the URL form; keep both to be
    // safe against Next caching whichever shape the request arrives as.
    revalidatePath("/(admin)/dashboard/content");
    revalidatePath(`/(admin)/dashboard/content/${contentItemId}`);
    revalidatePath("/dashboard/content");
    revalidatePath(`/dashboard/content/${contentItemId}`);

    return { success: true, data: result.data };
}
