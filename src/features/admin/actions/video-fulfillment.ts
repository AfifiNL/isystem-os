"use server";

import { createClient } from "@/shared/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function uploadRenderedVideo(jobId: string, workspaceId: string, formData: FormData) {
    try {
        const file = formData.get("file") as File;
        if (!file) {
            return { success: false, error: "No file provided" };
        }

        const supabase = await createClient();

        // Security check: Must be an admin
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not authenticated" };

        const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

        if (!profile || profile.role !== "admin") {
            return { success: false, error: "Unauthorized. Admin access required." };
        }

        // Upload to protected-videos bucket
        const storagePath = `${workspaceId}/${jobId}_final.mp4`;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { error: uploadError } = await supabase
            .storage
            .from("protected-videos")
            .upload(storagePath, buffer, {
                contentType: "video/mp4",
                upsert: true
            });

        if (uploadError) {
            console.error("Storage upload error:", uploadError);
            return { success: false, error: "Failed to upload video to storage" };
        }

        // Update the video_render_jobs table
        const { error: dbError } = await supabase
            .from("video_render_jobs")
            .update({
                status: "completed",
                result_video_url: storagePath
            })
            .eq("id", jobId);

        if (dbError) {
            console.error("Database update error:", dbError);
            return { success: false, error: "Failed to update job status" };
        }

        revalidatePath("/dashboard/render-queue");

        return { success: true };
    } catch (error) {
        console.error("Error in uploadRenderedVideo:", error);
        return { success: false, error: "An unexpected error occurred" };
    }
}
