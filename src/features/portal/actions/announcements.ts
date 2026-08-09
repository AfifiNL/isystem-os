"use server";

import { createClient } from "@/shared/lib/supabase/server";

export type PartnerAnnouncementTone = "info" | "milestone" | "action";

export interface PartnerAnnouncement {
    id: string;
    title: string;
    body: string | null;
    tone: PartnerAnnouncementTone;
    publishedAt: string;
}

function coerceTone(value: string | null | undefined): PartnerAnnouncementTone {
    if (value === "milestone" || value === "action") {
        return value;
    }
    return "info";
}

export async function fetchPartnerAnnouncements(workspaceId: string): Promise<PartnerAnnouncement[]> {
    if (!workspaceId) {
        return [];
    }

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("partner_portal_announcements")
        .select("id, title, body, tone, published_at, is_published")
        .eq("workspace_id", workspaceId)
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(6);

    if (error) {
        console.error("fetchPartnerAnnouncements error:", error);
        return [];
    }

    return (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        tone: coerceTone(row.tone),
        publishedAt: row.published_at,
    }));
}
