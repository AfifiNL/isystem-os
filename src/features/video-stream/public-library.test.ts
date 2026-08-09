import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    getPublicVideoLibraryMetadata,
    sortPublicVideoLibrary,
} from "./public-library";

describe("public video library metadata", () => {
    it("reads governed catalog metadata without trusting malformed values", () => {
        assert.deepEqual(getPublicVideoLibraryMetadata({
            metadata: {
                library_kind: "feature",
                library_group: "Growth",
                library_sequence: 5,
                public_system_ids: ["discoverability-growth", 17, ""],
                qa_status: "approved",
                captured_at: "2026-07-25T14:00:00Z",
            },
        }), {
            kind: "feature",
            group: "Growth",
            sequence: 5,
            publicSystemIds: ["discoverability-growth"],
            qaApproved: true,
            capturedAt: "2026-07-25T14:00:00Z",
        });
    });

    it("orders systematic chapters before feature clips and keeps future uploads", () => {
        const items = [
            { slug: "manual-new", metadata: null, created_at: "2026-07-26T10:00:00Z" },
            { slug: "manual-old", metadata: null, created_at: "2026-07-24T10:00:00Z" },
            { slug: "feature-b", metadata: { library_kind: "feature", library_sequence: 2 }, created_at: "2026-07-25T10:00:00Z" },
            { slug: "system-a", metadata: { library_kind: "system", library_sequence: 1 }, created_at: "2026-07-25T10:00:00Z" },
            { slug: "feature-a", metadata: { library_kind: "feature", library_sequence: 1 }, created_at: "2026-07-25T10:00:00Z" },
        ];

        assert.deepEqual(
            sortPublicVideoLibrary(items).map((item) => item.slug),
            ["system-a", "feature-a", "feature-b", "manual-new", "manual-old"],
        );
    });
});
