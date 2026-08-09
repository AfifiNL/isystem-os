import type { Json } from "@/shared/lib/supabase/database.types";
import { getExternalPublishingPlatformAdapter, type ExternalPublishingPlatformAdapter } from "../platform-adapters";
import type { ExternalPublicationPlatform, ExternalPublicationPlatformProfileRow } from "../types";

export type ExternalPublicationPlatformProfileInput = {
    platform: ExternalPublicationPlatform;
    defaultDisclosure?: string | null;
    blockedCommunities?: string[];
    preferredCommunities?: Array<Record<string, unknown>>;
    toneRules?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
};

export type NormalizedExternalPublicationPlatformProfile = ExternalPublicationPlatformProfileInput & {
    defaultDisclosure: string | null;
    blockedCommunities: string[];
    preferredCommunities: Array<Record<string, unknown>>;
    toneRules: Record<string, unknown>;
    metadata: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
    return Array.isArray(value) ? value.map(asRecord).filter((item) => Object.keys(item).length > 0) : [];
}

function normalizeList(values: unknown): string[] {
    return Array.from(new Set((Array.isArray(values) ? values : [])
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean))).slice(0, 50);
}

export function normalizeExternalPublicationPlatformProfile(input: ExternalPublicationPlatformProfileInput): NormalizedExternalPublicationPlatformProfile {
    return {
        platform: input.platform,
        defaultDisclosure: typeof input.defaultDisclosure === "string" && input.defaultDisclosure.trim() ? input.defaultDisclosure.trim().slice(0, 500) : null,
        blockedCommunities: normalizeList(input.blockedCommunities),
        preferredCommunities: asRecordArray(input.preferredCommunities).slice(0, 50),
        toneRules: asRecord(input.toneRules),
        metadata: asRecord(input.metadata),
    };
}

export function platformProfileRowToInput(row: ExternalPublicationPlatformProfileRow): NormalizedExternalPublicationPlatformProfile {
    return normalizeExternalPublicationPlatformProfile({
        platform: row.platform,
        defaultDisclosure: row.default_disclosure,
        blockedCommunities: row.blocked_communities,
        preferredCommunities: asRecordArray(row.preferred_communities),
        toneRules: asRecord(row.tone_rules),
        metadata: asRecord(row.metadata),
    });
}

export function buildAdapterWithPlatformProfile(
    adapter: ExternalPublishingPlatformAdapter,
    profile?: ExternalPublicationPlatformProfileRow | NormalizedExternalPublicationPlatformProfile | null,
): ExternalPublishingPlatformAdapter {
    if (!profile) return adapter;
    const normalized = "workspace_id" in profile ? platformProfileRowToInput(profile) : normalizeExternalPublicationPlatformProfile(profile);
    return {
        ...adapter,
        disclosureNotes: normalized.defaultDisclosure ? [normalized.defaultDisclosure, ...adapter.disclosureNotes] : adapter.disclosureNotes,
        moderationNotes: [
            ...adapter.moderationNotes,
            ...normalized.blockedCommunities.map((community) => `Blocked community/profile rule: do not publish to ${community}.`),
            ...normalized.preferredCommunities.map((community) => {
                const label = typeof community.name === "string" ? community.name : typeof community.url === "string" ? community.url : "preferred community";
                return `Preferred destination note: ${label}. Validate rules manually before publishing.`;
            }),
        ],
        salesToneRedFlags: [
            ...adapter.salesToneRedFlags,
            ...Object.entries(normalized.toneRules).map(([key, value]) => `Workspace tone rule ${key}: ${String(value)}`),
        ],
    };
}

export function getProfiledExternalPublishingPlatformAdapter(
    platform: ExternalPublicationPlatform,
    profile?: ExternalPublicationPlatformProfileRow | NormalizedExternalPublicationPlatformProfile | null,
): ExternalPublishingPlatformAdapter {
    return buildAdapterWithPlatformProfile(getExternalPublishingPlatformAdapter(platform), profile);
}

export function serializePlatformProfileForDatabase(input: NormalizedExternalPublicationPlatformProfile): {
    default_disclosure: string | null;
    blocked_communities: string[];
    preferred_communities: Json;
    tone_rules: Json;
    metadata: Json;
} {
    return {
        default_disclosure: input.defaultDisclosure,
        blocked_communities: input.blockedCommunities,
        preferred_communities: input.preferredCommunities as Json,
        tone_rules: input.toneRules as Json,
        metadata: input.metadata as Json,
    };
}
