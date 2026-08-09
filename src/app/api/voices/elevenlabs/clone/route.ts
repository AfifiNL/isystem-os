import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { assertWorkspaceAdminOrManager, assertWorkspaceAiEnabled } from "@/shared/lib/workspace/context";
import { createInstantVoiceClone, isElevenLabsConfigured } from "@/shared/lib/ai/tts-providers/elevenlabs";

export const maxDuration = 120;

const MAX_FILES = 5;
const MAX_BYTES_PER_FILE = 12 * 1024 * 1024;
const MIN_TOTAL_BYTES = 100 * 1024;          // ≥100 KB ensures sample isn't empty noise
const ACCEPTED_MIME_PREFIX = "audio/";
const CONSENT_VERSION = "2026-04-26-ivc-v1";
const CONSENT_TEXT =
    "I confirm that the voice in this audio sample is mine, OR I am authorized by " +
    "the speaker to clone their voice for use in this workspace, AND that I will " +
    "not use the cloned voice to impersonate, deceive, or generate content that " +
    "violates the speaker's consent.";

function hashIp(ip: string | null): string {
    if (!ip) return "unknown";
    return createHash("sha256").update(ip).digest("hex");
}

export async function POST(request: NextRequest) {
    try {
        // Pro-tier gate first: ElevenLabs voice cloning hits a paid external
        // API on the platform's quota. Basic-tier workspaces should not be
        // able to reach this endpoint via direct call even if they have a
        // manager account.
        await assertWorkspaceAiEnabled();
        const context = await assertWorkspaceAdminOrManager();

        if (!isElevenLabsConfigured()) {
            return NextResponse.json(
                { error: "ElevenLabs is not configured. Set ELEVENLABS_API_KEY." },
                { status: 503 },
            );
        }

        const formData = await request.formData();

        const displayName = (formData.get("display_name") as string | null)?.trim();
        const description = (formData.get("description") as string | null)?.trim() || undefined;
        const languageCode = (formData.get("language_code") as string | null)?.trim() || "en";
        const modelPreference = (formData.get("model_preference") as string | null)?.trim() || "eleven_multilingual_v2";
        const consentGranted = formData.get("consent_granted") === "true";
        const consentActorName = (formData.get("consent_actor_name") as string | null)?.trim();
        const consentSource = (formData.get("consent_source") as string | null)?.trim() || "self_upload";

        if (!displayName) {
            return NextResponse.json({ error: "display_name is required" }, { status: 400 });
        }
        if (!consentGranted) {
            return NextResponse.json({ error: "Consent must be explicitly granted before cloning." }, { status: 400 });
        }
        if (!consentActorName) {
            return NextResponse.json({ error: "consent_actor_name is required" }, { status: 400 });
        }

        const rawFiles = formData.getAll("samples");
        const files: File[] = [];
        let totalBytes = 0;
        for (const entry of rawFiles) {
            if (!(entry instanceof File)) continue;
            if (entry.size === 0) continue;
            if (entry.size > MAX_BYTES_PER_FILE) {
                return NextResponse.json(
                    { error: `Each sample must be ≤${MAX_BYTES_PER_FILE / 1024 / 1024}MB.` },
                    { status: 400 },
                );
            }
            if (!entry.type.toLowerCase().startsWith(ACCEPTED_MIME_PREFIX)) {
                return NextResponse.json({ error: "All samples must be audio files." }, { status: 400 });
            }
            files.push(entry);
            totalBytes += entry.size;
        }
        if (files.length === 0) {
            return NextResponse.json({ error: "At least one sample audio file is required." }, { status: 400 });
        }
        if (files.length > MAX_FILES) {
            return NextResponse.json({ error: `At most ${MAX_FILES} samples per clone.` }, { status: 400 });
        }
        if (totalBytes < MIN_TOTAL_BYTES) {
            return NextResponse.json({ error: "Sample is too short. Provide at least 30 seconds of clean audio." }, { status: 400 });
        }

        // Talk to ElevenLabs. This is the single point where the raw audio
        // bytes leave our infrastructure — we never persist them.
        const cloneResult = await createInstantVoiceClone({
            name: `${displayName} — ${context.activeWorkspace.slug}`,
            description,
            audioFiles: files,
        });

        // Persist the workspace voice row + initial consent audit.
        const supabase = await createClient();
        const ipHeader =
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
            ?? request.headers.get("x-real-ip")
            ?? null;
        const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null;
        const ipHash = hashIp(ipHeader);

        const { data: voiceRow, error: insertError } = await supabase
            .from("workspace_voices")
            .insert({
                workspace_id: context.activeWorkspace.id,
                template_id: context.activeWorkspace.legacy_template_id,
                created_by_profile_id: context.userId,
                provider: "elevenlabs",
                provider_voice_id: cloneResult.voiceId,
                display_name: displayName,
                voice_type: "instant_clone",
                language_code: languageCode,
                model_preference: modelPreference,
                consent_status: "granted",
                consent_captured_at: new Date().toISOString(),
                consent_actor_name: consentActorName,
                consent_source: consentSource,
                sample_retention_policy: "discard_after_clone",
                provider_status: cloneResult.requiresVerification ? "pending" : "ready",
                provider_metadata: {
                    requires_verification: cloneResult.requiresVerification,
                    consent_version: CONSENT_VERSION,
                },
            })
            .select("id")
            .single();

        if (insertError) {
            return NextResponse.json(
                { error: `Voice persisted at ElevenLabs but DB insert failed: ${insertError.message}` },
                { status: 500 },
            );
        }

        // Audit trail — append-only.
        await supabase.from("voice_consent_audits").insert([
            {
                voice_id: voiceRow.id,
                workspace_id: context.activeWorkspace.id,
                actor_profile_id: context.userId,
                event: "consent_granted",
                consent_text: CONSENT_TEXT,
                ip_hash: ipHash,
                user_agent: userAgent,
                metadata: {
                    consent_version: CONSENT_VERSION,
                    consent_actor_name: consentActorName,
                    consent_source: consentSource,
                },
            },
            {
                voice_id: voiceRow.id,
                workspace_id: context.activeWorkspace.id,
                actor_profile_id: context.userId,
                event: "clone_created",
                ip_hash: ipHash,
                user_agent: userAgent,
                metadata: {
                    provider: "elevenlabs",
                    provider_voice_id: cloneResult.voiceId,
                    requires_verification: cloneResult.requiresVerification,
                    sample_count: files.length,
                    sample_total_bytes: totalBytes,
                },
            },
        ]);

        return NextResponse.json({
            voiceId: voiceRow.id,
            providerVoiceId: cloneResult.voiceId,
            requiresVerification: cloneResult.requiresVerification,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Clone failed";
        console.error("[voices/clone]", err);
        const status = message.startsWith("Forbidden") ? 403 : message.startsWith("Unauthorized") ? 401 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
