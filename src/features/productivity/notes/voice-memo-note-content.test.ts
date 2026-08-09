import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildVoiceMemoGeneratedNotePayload, GENERATED_NOTE_SOURCE_ROUTE } from "./voice-memo-note-content";

describe("buildVoiceMemoGeneratedNotePayload", () => {
    it("builds deterministic generated note content with source metadata", () => {
        const payload = buildVoiceMemoGeneratedNotePayload({
            workspaceId: "workspace-1",
            profileId: "profile-1",
            memo: {
                id: "00000000-0000-4000-8000-000000000001",
                title: "  Weekly   ops sync  ",
                duration_seconds: 125.2,
                mime_type: "audio/webm",
            },
            transcript: "Speaker A: Ship the note integration.",
            summary: "The team agreed to ship note generation.",
            commitments: [
                {
                    title: "Ship note integration",
                    description: "Create an idempotent generated note from every completed memo.",
                    priority: "high",
                    suggested_due_days: 1,
                },
            ],
            processedAt: "2026-06-13T22:45:00.000Z",
        });

        assert.equal(payload.workspace_id, "workspace-1");
        assert.equal(payload.profile_id, "profile-1");
        assert.equal(payload.source_type, "voice_memo");
        assert.equal(payload.source_voice_memo_id, "00000000-0000-4000-8000-000000000001");
        assert.equal(payload.title, "Voice memo transcript: Weekly ops sync");
        assert.deepEqual(payload.source_metadata, {
            duration_seconds: 125,
            mime_type: "audio/webm",
            processed_at: "2026-06-13T22:45:00.000Z",
            source_route: GENERATED_NOTE_SOURCE_ROUTE,
        });
        assert.match(payload.body, /## Summary\nThe team agreed to ship note generation\./);
        assert.match(payload.body, /## Transcript\nSpeaker A: Ship the note integration\./);
        assert.match(payload.body, /1\. Ship note integration — Create an idempotent generated note/);
        assert.match(payload.body, /Source memo id: 00000000-0000-4000-8000-000000000001/);
        assert.match(payload.body, /Duration: 2m 05s \(125 seconds\)/);
        assert.match(payload.body, /Processed at: 2026-06-13T22:45:00\.000Z/);
    });

    it("returns the same idempotency key fields for repeated processing of the same memo", () => {
        const input = {
            workspaceId: "workspace-1",
            profileId: "profile-1",
            memo: {
                id: "00000000-0000-4000-8000-000000000002",
                title: "Retry memo",
                duration_seconds: 30,
                mime_type: "audio/ogg",
            },
            transcript: "First transcript.",
            summary: "First summary.",
            commitments: [],
            processedAt: "2026-06-13T22:45:00.000Z",
        };

        const first = buildVoiceMemoGeneratedNotePayload(input);
        const retry = buildVoiceMemoGeneratedNotePayload({
            ...input,
            transcript: "Updated transcript.",
            summary: "Updated summary.",
            processedAt: "2026-06-13T22:46:00.000Z",
        });

        assert.equal(retry.workspace_id, first.workspace_id);
        assert.equal(retry.profile_id, first.profile_id);
        assert.equal(retry.source_voice_memo_id, first.source_voice_memo_id);
        assert.notEqual(retry.body, first.body);
        assert.equal(retry.source_metadata && typeof retry.source_metadata === "object" && "source_route" in retry.source_metadata, true);
    });
});
