export type VoiceProvider = "gemini" | "elevenlabs" | "vertex";
export type VoiceType = "prebuilt" | "instant_clone" | "professional_clone" | "designed" | "library";
export type ConsentStatus = "pending" | "granted" | "revoked" | "not_required";
export type ProviderStatus = "pending" | "training" | "ready" | "failed" | "archived";

export interface WorkspaceVoice {
    id: string;
    workspace_id: string;
    template_id: string | null;
    created_by_profile_id: string | null;
    provider: VoiceProvider;
    provider_voice_id: string;
    display_name: string;
    voice_type: VoiceType;
    language_code: string;
    model_preference: string | null;
    consent_status: ConsentStatus;
    consent_captured_at: string | null;
    consent_actor_name: string | null;
    consent_source: string | null;
    sample_retention_policy: "discard_after_clone" | "retained_with_consent";
    provider_status: ProviderStatus;
    provider_metadata: Record<string, unknown>;
    archived_at: string | null;
    created_at: string;
    updated_at: string;
}
