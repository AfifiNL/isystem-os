import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildNoteSemanticContent, buildNoteSemanticMetadata, type NoteSemanticRecord } from "./semantic-payload";

const baseNote: NoteSemanticRecord = {
    id: "note-1",
    workspace_id: "workspace-1",
    profile_id: "profile-1",
    title: "Voice memo transcript: Weekly sync",
    body: "  ## Summary\nShip the semantic sync.  ",
    archived: false,
    archived_at: null,
    source_type: "voice_memo",
    source_voice_memo_id: "memo-1",
    source_metadata: {
        duration_seconds: 42,
        mime_type: "audio/webm",
        processed_at: "2026-06-13T22:45:00.000Z",
    },
};

describe("note semantic payload helpers", () => {
    it("indexes note body content without changing entity identity", () => {
        assert.equal(buildNoteSemanticContent(baseNote), "## Summary\nShip the semantic sync.");

        assert.deepEqual(buildNoteSemanticMetadata(baseNote), {
            workspace_id: "workspace-1",
            profile_id: "profile-1",
            archived: false,
            archived_at: null,
            source_type: "voice_memo",
            source_voice_memo_id: "memo-1",
            source_metadata: {
                duration_seconds: 42,
                mime_type: "audio/webm",
                processed_at: "2026-06-13T22:45:00.000Z",
            },
        });
    });

    it("returns blank semantic content for empty note bodies so sync deletes instead of indexing", () => {
        assert.equal(buildNoteSemanticContent({ body: " \n\t " }), "");
    });
});
