export type EpisodeStatus = "draft" | "scheduled" | "published" | "archived";
export type EpisodeType = "full" | "trailer" | "bonus";
export type MusicRole = "intro" | "bed" | "outro";

export interface PodcastShow {
    id: string;
    workspace_id: string;
    template_id: string | null;
    slug: string;
    title: string;
    subtitle: string | null;
    description: string | null;
    language: string;
    author: string | null;
    owner_email: string | null;
    category: string | null;
    explicit: boolean;
    cover_art_url: string | null;
    feed_url: string | null;
    website_url: string | null;
    is_published: boolean;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface PodcastEpisode {
    id: string;
    workspace_id: string;
    show_id: string;
    template_id: string | null;
    content_item_id: string | null;
    /** Episode language. Public locale-prefixed routes filter on this column. */
    locale: "en" | "nl" | "ar";
    slug: string;
    title: string;
    summary: string | null;
    description: string | null;
    season_number: number | null;
    episode_number: number | null;
    episode_type: EpisodeType;
    audio_url: string | null;
    audio_byte_size: number | null;
    audio_duration_seconds: number | null;
    audio_mime_type: string;
    narration_only_url: string | null;
    cover_art_url: string | null;
    transcript_text: string | null;
    transcript_vtt_url: string | null;
    chapters: Array<{ start_ms: number; title: string }>;
    generation_metadata: Record<string, unknown>;
    voice_id: string | null;
    host_voice_id: string | null;
    guest_voice_id: string | null;
    status: EpisodeStatus;
    published_at: string | null;
    scheduled_for: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface EpisodeMusicAttachment {
    id: string;
    episode_id: string;
    track_id: string;
    role: MusicRole;
    start_offset_ms: number;
    fade_in_ms: number;
    fade_out_ms: number;
    gain_db: number;
    created_at: string;
}
