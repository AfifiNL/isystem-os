import type { TranscriptionResult } from "@/shared/lib/ai/transcribe";
import type { Json } from "@/shared/lib/supabase/database.types";

export const GENERATED_NOTE_SOURCE_ROUTE = "voice_memo_transcription";
export const GENERATED_NOTE_SOURCE_TYPE = "voice_memo";

export interface VoiceMemoGeneratedNoteInput {
    workspaceId: string;
    profileId: string;
    memo: {
        id: string;
        title: string | null;
        duration_seconds: number | null;
        mime_type: string | null;
    };
    transcript: string;
    summary: string;
    commitments: TranscriptionResult["commitments"];
    processedAt: string;
}

export interface VoiceMemoGeneratedNotePayload {
    workspace_id: string;
    profile_id: string;
    source_type: typeof GENERATED_NOTE_SOURCE_TYPE;
    source_voice_memo_id: string;
    source_metadata: Json;
    title: string;
    body: string;
    archived: false;
    archived_at: null;
    updated_at: string;
}

function normalizeMemoTitle(title: string | null): string {
    return (title ?? "").replace(/\s+/g, " ").trim() || "Untitled voice memo";
}

function formatDuration(seconds: number | null): string {
    const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds ?? 0)) : 0;
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;

    if (minutes === 0) {
        return `${remainingSeconds}s`;
    }

    return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`;
}

function formatCommitments(commitments: TranscriptionResult["commitments"]): string {
    if (commitments.length === 0) {
        return "- No explicit commitments detected.";
    }

    return commitments
        .map((commitment, index) => {
            const details = [
                commitment.description?.trim() ? ` — ${commitment.description.trim()}` : "",
                commitment.priority ? ` (priority: ${commitment.priority})` : "",
            ].join("");
            return `${index + 1}. ${commitment.title.trim() || "Untitled commitment"}${details}`;
        })
        .join("\n");
}

export function buildVoiceMemoGeneratedNotePayload(input: VoiceMemoGeneratedNoteInput): VoiceMemoGeneratedNotePayload {
    const memoTitle = normalizeMemoTitle(input.memo.title);
    const durationSeconds = Number.isFinite(input.memo.duration_seconds)
        ? Math.max(0, Math.round(input.memo.duration_seconds ?? 0))
        : 0;
    const mimeType = input.memo.mime_type?.trim() || "unknown";
    const title = `Voice memo transcript: ${memoTitle}`.slice(0, 200);
    const processedAt = input.processedAt;

    const body = [
        `# ${title}`,
        "",
        "## Summary",
        input.summary.trim() || "No summary generated.",
        "",
        "## Transcript",
        input.transcript.trim() || "No transcript generated.",
        "",
        "## Commitments",
        formatCommitments(input.commitments),
        "",
        "## Source",
        `- Source memo id: ${input.memo.id}`,
        `- Duration: ${formatDuration(durationSeconds)} (${durationSeconds} seconds)`,
        `- MIME type: ${mimeType}`,
        `- Processed at: ${processedAt}`,
        `- Source route: ${GENERATED_NOTE_SOURCE_ROUTE}`,
    ].join("\n");

    return {
        workspace_id: input.workspaceId,
        profile_id: input.profileId,
        source_type: GENERATED_NOTE_SOURCE_TYPE,
        source_voice_memo_id: input.memo.id,
        source_metadata: {
            duration_seconds: durationSeconds,
            mime_type: mimeType,
            processed_at: processedAt,
            source_route: GENERATED_NOTE_SOURCE_ROUTE,
        },
        title,
        body: body.slice(0, 100_000),
        archived: false,
        archived_at: null,
        updated_at: processedAt,
    };
}
