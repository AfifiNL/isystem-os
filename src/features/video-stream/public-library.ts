export type PublicVideoLibraryKind = "system" | "feature" | "other";

export interface PublicVideoLibraryMetadata {
    kind: PublicVideoLibraryKind;
    group: string | null;
    sequence: number;
    publicSystemIds: string[];
    qaApproved: boolean;
    capturedAt: string | null;
}

interface VideoWithLibraryMetadata {
    slug: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
}

function readStringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
        : [];
}

export function getPublicVideoLibraryMetadata(
    item: Pick<VideoWithLibraryMetadata, "metadata">,
): PublicVideoLibraryMetadata {
    const metadata = item.metadata ?? {};
    const rawKind = metadata.library_kind;
    const kind: PublicVideoLibraryKind =
        rawKind === "system" || rawKind === "feature" ? rawKind : "other";
    const rawSequence = metadata.library_sequence;

    return {
        kind,
        group: typeof metadata.library_group === "string" && metadata.library_group.length > 0
            ? metadata.library_group
            : null,
        sequence: typeof rawSequence === "number" && Number.isFinite(rawSequence)
            ? rawSequence
            : Number.MAX_SAFE_INTEGER,
        publicSystemIds: readStringArray(metadata.public_system_ids),
        qaApproved: metadata.qa_status === "approved",
        capturedAt: typeof metadata.captured_at === "string" ? metadata.captured_at : null,
    };
}

export function sortPublicVideoLibrary<T extends VideoWithLibraryMetadata>(items: readonly T[]): T[] {
    return [...items].sort((left, right) => {
        const leftMetadata = getPublicVideoLibraryMetadata(left);
        const rightMetadata = getPublicVideoLibraryMetadata(right);
        const kindOrder = { system: 0, feature: 1, other: 2 } as const;

        return kindOrder[leftMetadata.kind] - kindOrder[rightMetadata.kind]
            || leftMetadata.sequence - rightMetadata.sequence
            || right.created_at.localeCompare(left.created_at)
            || (left.slug ?? "").localeCompare(right.slug ?? "");
    });
}
