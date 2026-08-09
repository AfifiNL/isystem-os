export type MusicMood =
    | "upbeat"
    | "calm"
    | "cinematic"
    | "corporate"
    | "lofi"
    | "dramatic"
    | "warm"
    | "tense"
    | "playful"
    | "ambient";

export const MUSIC_MOODS: readonly MusicMood[] = [
    "upbeat",
    "calm",
    "cinematic",
    "corporate",
    "lofi",
    "dramatic",
    "warm",
    "tense",
    "playful",
    "ambient",
] as const;

export type MusicSource = "generated" | "uploaded";

export interface MusicTrack {
    id: string;
    workspace_id: string;
    template_id: string | null;
    created_by_profile_id: string | null;
    title: string;
    mood: MusicMood;
    duration_seconds: number;
    storage_path: string;
    audio_mime_type: string;
    audio_byte_size: number | null;
    prompt_text: string | null;
    source: MusicSource;
    generator_model: string | null;
    cost_millicents: number;
    is_intro: boolean;
    is_outro: boolean;
    is_bed: boolean;
    loop_safe: boolean;
    archived_at: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface MusicTrackWithUrl extends MusicTrack {
    /** Signed playback URL — short-lived; regenerate per request. */
    signed_url: string | null;
}

export interface MusicTrackRoleFlags {
    is_intro: boolean;
    is_outro: boolean;
    is_bed: boolean;
    loop_safe: boolean;
}
