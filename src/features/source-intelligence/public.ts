import { createAdminClient } from "@/shared/lib/supabase/admin";
import type { SourceQuality, SourceTrustTier } from "@/features/source-intelligence/types";

type EvidenceSummaryQueryRow = {
    id: string;
    content_id: string;
    citation_url: string | null;
    citation_label: string | null;
    evidence_type: string | null;
    updated_at: string | null;
    metadata: unknown;
    source_documents?: unknown;
    source_claims?: unknown;
};

type RegistryProofQueryRow = {
    quality: string | null;
    trust_tier: string | null;
    topic_tags: string[] | null;
    last_ingested_at: string | null;
    is_active: boolean | null;
    is_public_safe: boolean | null;
};

type PublicEvidenceQueryOptions = {
    workspaceId?: string | null;
    templateId?: string | null;
    metadata?: unknown;
    contentMarkdown?: string | null;
    siteHost?: string | null;
    limit?: number;
};

type PublicEvidenceSummaryInput = {
    id: string;
    workspaceId?: string | null;
    templateId?: string | null;
    metadata?: unknown;
};

export interface PublicEvidenceSummary {
    contentId: string;
    verifiedSourceCount: number;
    hasPrimaryOrNearPrimary: boolean;
    updatedThisWeek: boolean;
    evidenceTaxonomy: PublicEvidenceCategory[];
}

export type PublicEvidenceCategory = "external_source" | "author_framework" | "scenario_model" | "context_source";

export interface PublicEvidenceSource {
    id: string;
    title: string;
    publisher: string | null;
    quality: SourceQuality | null;
    trustTier: SourceTrustTier | null;
    publishedAt: string | null;
    retrievedAt: string | null;
    citationUrl: string;
    citationLabel: string | null;
    evidenceType: string;
    evidenceCategory: PublicEvidenceCategory;
}

function asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isSourceQuality(value: unknown): value is SourceQuality {
    return value === "unverified" || value === "low" || value === "medium" || value === "high" || value === "authoritative";
}

function isSourceTrustTier(value: unknown): value is SourceTrustTier {
    return value === "unknown" || value === "community" || value === "vendor" || value === "industry" || value === "regulatory" || value === "internal";
}

function isPrimaryOrNearPrimary(quality: SourceQuality | null, trustTier: SourceTrustTier | null): boolean {
    return quality === "authoritative" || quality === "high" || trustTier === "regulatory" || trustTier === "industry" || trustTier === "internal";
}

function isThisWeek(value: string | null): boolean {
    if (!value) return false;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) && Date.now() - timestamp <= 7 * 24 * 60 * 60 * 1000;
}

function isPrivateOrReservedHostname(hostname: string): boolean {
    const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (
        normalized === "localhost"
        || normalized === "0.0.0.0"
        || normalized === "::"
        || normalized === "::1"
        || normalized.endsWith(".localhost")
        || normalized.endsWith(".local")
        || normalized.endsWith(".internal")
        || normalized.endsWith(".test")
        || normalized.endsWith(".example")
        || normalized.endsWith(".invalid")
    ) {
        return true;
    }

    if (
        normalized === "127.0.0.1"
        || normalized.startsWith("127.")
        || normalized.startsWith("10.")
        || normalized.startsWith("192.168.")
        || normalized.startsWith("169.254.")
        || /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
        || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(normalized)
        || /^f[cd][0-9a-f]{2}:/i.test(normalized)
        || /^fe[89ab][0-9a-f]:/i.test(normalized)
    ) {
        return true;
    }

    return false;
}

function safeUrl(value: unknown): string | null {
    if (typeof value !== "string") return null;
    try {
        const url = new URL(value);
        if (url.protocol !== "https:" || url.username || url.password) return null;
        const hostname = url.hostname.toLowerCase();
        if (isPrivateOrReservedHostname(hostname)) return null;
        url.hash = "";
        if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
        return url.toString();
    } catch {
        return null;
    }
}

function dedupeKey(value: string): string {
    try {
        const url = new URL(value);
        url.hash = "";
        if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
        return url.toString().toLowerCase();
    } catch {
        return value.toLowerCase();
    }
}

function publisherFromUrl(value: string): string | null {
    try {
        const host = new URL(value).hostname.replace(/^www\./, "");
        return host || null;
    } catch {
        return null;
    }
}

function normalizeHost(value: string): string {
    try {
        return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
        return value.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
    }
}

function isSameHost(url: string, siteHost?: string | null): boolean {
    if (!siteHost) return false;
    try {
        return normalizeHost(new URL(url).hostname) === normalizeHost(siteHost);
    } catch {
        return false;
    }
}

function markdownLinkLabel(value: string): string | null {
    const label = value
        .replace(/!\s*$/, "")
        .replace(/[*_`~]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    if (!label || /^https?:\/\//i.test(label)) return null;
    return label;
}

function normalizeSourceQuality(value: unknown): SourceQuality | null {
    if (isSourceQuality(value)) return value;
    if (value === "primary") return "authoritative";
    if (value === "near_primary") return "high";
    if (value === "secondary") return "medium";
    if (value === "vendor") return "medium";
    if (value === "internal") return "high";
    if (value === "unknown") return "unverified";
    return null;
}

function normalizeTrustTier(value: unknown): SourceTrustTier | null {
    if (isSourceTrustTier(value)) return value;
    if (value === "primary") return "regulatory";
    if (value === "near_primary" || value === "secondary") return "industry";
    return null;
}

function trustTierFromNumeric(value: unknown): SourceTrustTier | null {
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric)) return null;
    if (numeric >= 4) return "regulatory";
    if (numeric >= 2) return "industry";
    if (numeric >= 1) return "vendor";
    return "unknown";
}

function fallbackSourceProfile(value: string): {
    quality: SourceQuality;
    trustTier: SourceTrustTier;
} {
    const hostname = normalizeHost(value);
    const authoritativeHosts = [
        "europa.eu",
        "eur-lex.europa.eu",
        "edpb.europa.eu",
        "oecd.org",
        "nist.gov",
        "rijksoverheid.nl",
        "autoriteitpersoonsgegevens.nl",
        "ec.europa.eu",
        "eurostat.ec.europa.eu",
    ];
    if (
        hostname.endsWith(".gov")
        || hostname.endsWith(".gov.uk")
        || hostname.endsWith(".government.nl")
        || authoritativeHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))
    ) {
        return { quality: "authoritative", trustTier: "regulatory" };
    }

    if (
        hostname.endsWith(".edu")
        || hostname.endsWith(".ac.uk")
        || hostname === "doi.org"
        || hostname.endsWith(".doi.org")
        || hostname === "nber.org"
        || hostname.endsWith(".nber.org")
    ) {
        return { quality: "high", trustTier: "industry" };
    }

    return { quality: "unverified", trustTier: "unknown" };
}

export function classifyPublicEvidenceCategory(evidenceType: string | null | undefined, trustTier?: SourceTrustTier | null): PublicEvidenceCategory {
    const normalized = (evidenceType ?? "").toLowerCase().replace(/[-\s]+/g, "_");
    if (normalized === "author_framework" || normalized === "author_synthesis") return "author_framework";
    if (normalized === "internal_estimate" || normalized === "scenario_model" || normalized === "forecast") return "scenario_model";
    if (normalized === "supporting" || normalized === "context" || normalized === "citation") return "context_source";
    if (trustTier === "internal") return "author_framework";
    return "external_source";
}

function evidenceTypeFromMetadata(value: unknown): string {
    const raw = asString(value);
    if (!raw) return "citation";
    if (raw === "verified_statistic") return "statistic";
    if (raw === "time_sensitive_benchmark") return "benchmark";
    if (raw === "author_framework" || raw === "author_synthesis" || raw === "internal_estimate" || raw === "forecast") return raw;
    return raw;
}

function publicEvidenceFromUrl(input: {
    id: string;
    url: unknown;
    title?: unknown;
    publisher?: unknown;
    quality?: unknown;
    trustTier?: unknown;
    numericTrustTier?: unknown;
    publishedAt?: unknown;
    retrievedAt?: unknown;
    citationLabel?: unknown;
    evidenceType?: unknown;
}): PublicEvidenceSource | null {
    const citationUrl = safeUrl(input.url);
    if (!citationUrl) return null;
    const title = asString(input.title) ?? asString(input.citationLabel) ?? publisherFromUrl(citationUrl) ?? "Evidence source";
    const evidenceType = evidenceTypeFromMetadata(input.evidenceType);
    const trustTier = normalizeTrustTier(input.trustTier) ?? trustTierFromNumeric(input.numericTrustTier);
    return {
        id: input.id,
        title,
        publisher: asString(input.publisher) ?? publisherFromUrl(citationUrl),
        quality: normalizeSourceQuality(input.quality),
        trustTier,
        publishedAt: asString(input.publishedAt),
        retrievedAt: asString(input.retrievedAt),
        citationUrl,
        citationLabel: asString(input.citationLabel),
        evidenceType,
        evidenceCategory: classifyPublicEvidenceCategory(evidenceType, trustTier),
    };
}

function pushEvidence(target: PublicEvidenceSource[], input: Parameters<typeof publicEvidenceFromUrl>[0]) {
    const evidence = publicEvidenceFromUrl(input);
    if (evidence) target.push(evidence);
}

function extractEvidencePackSources(pack: unknown, prefix: string): PublicEvidenceSource[] {
    const sources: PublicEvidenceSource[] = [];
    const record = asRecord(pack);
    const checkedAt = asString(record.checked_at);
    asArray(record.documents).forEach((item, index) => {
        const source = asRecord(item);
        pushEvidence(sources, {
            id: `${prefix}-document-${asString(source.id) ?? index}`,
            url: source.canonical_url ?? source.url,
            title: source.title,
            publisher: source.publisher,
            quality: source.quality,
            trustTier: source.trust_tier,
            publishedAt: source.published_at ?? source.published_date,
            retrievedAt: checkedAt,
            evidenceType: "supporting",
        });
    });
    asArray(record.claims).forEach((item, index) => {
        const claim = asRecord(item);
        const nestedSource = asRecord(claim.source);
        pushEvidence(sources, {
            id: `${prefix}-claim-${asString(claim.id) ?? index}`,
            url: claim.source_url ?? nestedSource.canonical_url,
            title: claim.source_title ?? nestedSource.title,
            publisher: claim.publisher ?? nestedSource.publisher,
            quality: claim.quality ?? nestedSource.quality,
            trustTier: claim.trust_tier ?? nestedSource.trust_tier,
            publishedAt: claim.published_at ?? nestedSource.published_at,
            retrievedAt: checkedAt,
            evidenceType: claim.evidence_type,
        });
    });
    return sources;
}

function extractSourceListSources(list: unknown, prefix: string, retrievedAt: unknown, evidenceType: string): PublicEvidenceSource[] {
    const sources: PublicEvidenceSource[] = [];
    asArray(list).forEach((item, index) => {
        const source = asRecord(item);
        pushEvidence(sources, {
            id: `${prefix}-${index}`,
            url: source.url ?? source.canonical_url ?? source.citationUrl ?? source.citation_url,
            title: source.title,
            publisher: source.publisher,
            quality: source.quality,
            trustTier: source.trustTier ?? source.trust_tier,
            numericTrustTier: source.trust_tier,
            publishedAt: source.published_date ?? source.published_at,
            retrievedAt,
            citationLabel: source.citationLabel ?? source.citation_label ?? source.reason,
            evidenceType: source.evidenceType ?? source.evidence_type ?? evidenceType,
        });
    });
    return sources;
}

function extractBlueprintCitationSources(blueprint: unknown, prefix: string): PublicEvidenceSource[] {
    const record = asRecord(blueprint);
    return extractSourceListSources(record.externalCitationTargets, prefix, null, "citation");
}

function extractRegenerationSnapshotSources(regeneration: unknown, prefix: string): PublicEvidenceSource[] {
    const record = asRecord(regeneration);
    return extractSourceListSources(
        record.public_evidence_sources ?? record.publicEvidenceSources,
        prefix,
        record.regenerated_at,
        "citation",
    );
}

function mergePublicEvidenceSources(sources: PublicEvidenceSource[], limit = 8): PublicEvidenceSource[] {
    const byUrl = new Map<string, PublicEvidenceSource>();
    sources.forEach((source) => {
        const key = dedupeKey(source.citationUrl);
        const existing = byUrl.get(key);
        if (!existing) {
            byUrl.set(key, source);
            return;
        }
        byUrl.set(key, {
            ...existing,
            title: existing.title === "Evidence source" ? source.title : existing.title,
            publisher: existing.publisher ?? source.publisher,
            quality: existing.quality ?? source.quality,
            trustTier: existing.trustTier ?? source.trustTier,
            publishedAt: existing.publishedAt ?? source.publishedAt,
            retrievedAt: existing.retrievedAt ?? source.retrievedAt,
            citationLabel: existing.citationLabel ?? source.citationLabel,
            evidenceType: existing.evidenceType === "citation" ? source.evidenceType : existing.evidenceType,
            evidenceCategory: existing.evidenceCategory === "context_source" ? source.evidenceCategory : existing.evidenceCategory,
        });
    });
    return Array.from(byUrl.values()).slice(0, limit);
}

export function summarizePublicEvidenceSources(sources: readonly PublicEvidenceSource[], contentId: string): PublicEvidenceSummary {
    const uniqueUrls = new Set(sources.map((source) => source.citationUrl));
    const evidenceTaxonomy = Array.from(new Set(sources.map((source) => source.evidenceCategory)));
    return {
        contentId,
        verifiedSourceCount: uniqueUrls.size,
        hasPrimaryOrNearPrimary: sources.some((source) => isPrimaryOrNearPrimary(source.quality, source.trustTier)),
        updatedThisWeek: sources.some((source) => isThisWeek(source.retrievedAt ?? source.publishedAt)),
        evidenceTaxonomy,
    };
}

export function isPublicEvidenceEnabled(metadata: unknown): boolean {
    return asRecord(metadata).public_evidence_enabled !== false;
}

export function getPublicEvidenceFromContentMetadata(metadata: unknown, contentId = "metadata", limit = 8): PublicEvidenceSource[] {
    const root = asRecord(metadata);
    if (Object.keys(root).length === 0 || !isPublicEvidenceEnabled(root)) return [];

    const curatedSources = extractSourceListSources(
        root.public_evidence_sources,
        `${contentId}-curated`,
        root.public_evidence_reviewed_at,
        "supporting",
    );
    if (root.public_evidence_mode === "curated") {
        return mergePublicEvidenceSources(curatedSources, limit);
    }

    const provenance = asRecord(root.provenance);
    const enrichment = asRecord(root.enrichment);
    const seoSchema = asRecord(enrichment.seo_schema);
    const generatedFormats = asRecord(root.generated_formats);
    const newsletterFull = asRecord(generatedFormats.newsletter_issue_full);
    const generationInputs = asRecord(root.generation_inputs);
    const articleBlueprint = asRecord(generationInputs.article_blueprint);
    const blogRegeneration = asRecord(enrichment.blog_regeneration);
    const sources: PublicEvidenceSource[] = [...curatedSources];

    sources.push(...extractEvidencePackSources(provenance.source_intelligence_evidence_pack, `${contentId}-provenance-pack`));
    sources.push(...extractEvidencePackSources(enrichment.source_intelligence_evidence_pack, `${contentId}-enrichment-pack`));
    sources.push(...extractEvidencePackSources(newsletterFull.evidence_pack, `${contentId}-newsletter-pack`));

    const fallbackFactSheet = asRecord(provenance.fallback_fact_sheet ?? provenance.fact_sheet);
    sources.push(...extractSourceListSources(
        fallbackFactSheet.sources ?? provenance.sources,
        `${contentId}-fact-sheet`,
        fallbackFactSheet.checked_at ?? provenance.checked_at,
        "citation",
    ));

    const provenanceEvergreenPass = asRecord(provenance.fallback_evergreen_source_pass ?? provenance.evergreen_source_pass);
    const enrichmentEvergreenPass = asRecord(enrichment.evergreen_source_pass);
    sources.push(...extractSourceListSources(provenanceEvergreenPass.sources, `${contentId}-provenance-evergreen`, provenanceEvergreenPass.checked_at, "citation"));
    sources.push(...extractSourceListSources(enrichmentEvergreenPass.sources, `${contentId}-enrichment-evergreen`, enrichmentEvergreenPass.checked_at, "citation"));

    sources.push(...extractRegenerationSnapshotSources(blogRegeneration, `${contentId}-regeneration-evidence`));
    sources.push(...extractSourceListSources(seoSchema.citations, `${contentId}-seo-citation`, null, "citation"));
    sources.push(...extractBlueprintCitationSources(articleBlueprint, `${contentId}-blueprint-citation`));

    asArray(enrichment.evidence).forEach((item, index) => {
        const evidence = asRecord(item);
        pushEvidence(sources, {
            id: `${contentId}-visual-evidence-${asString(evidence.claim_id) ?? index}`,
            url: evidence.source_url,
            title: evidence.source_label,
            publisher: evidence.source_label,
            quality: evidence.source_quality,
            publishedAt: evidence.publication_date,
            evidenceType: evidence.evidence_type,
        });
    });

    asArray(enrichment.visual_blocks).forEach((item, index) => {
        const block = asRecord(item);
        const blockEvidence = asRecord(block.evidence);
        pushEvidence(sources, {
            id: `${contentId}-visual-block-${asString(block.id) ?? index}`,
            url: block.source_url ?? blockEvidence.source_url,
            title: block.source_label ?? blockEvidence.source_label ?? block.title,
            publisher: block.source_label ?? blockEvidence.source_label,
            quality: blockEvidence.source_quality,
            publishedAt: blockEvidence.publication_date,
            evidenceType: blockEvidence.evidence_type,
        });
    });

    return mergePublicEvidenceSources(sources, limit);
}

export function getPublicEvidenceFromMarkdownLinks(markdown: string | null | undefined, contentId = "markdown", options: {
    siteHost?: string | null;
    limit?: number;
} = {}): PublicEvidenceSource[] {
    if (!markdown) return [];
    const sources: PublicEvidenceSource[] = [];
    const markdownLinkRe = /\[([^\]]+)]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
    const bareUrlRe = /(?<!\]\()https?:\/\/[^\s<>)]+/g;

    let markdownMatch: RegExpExecArray | null;
    while ((markdownMatch = markdownLinkRe.exec(markdown)) !== null) {
        if (markdown[markdownMatch.index - 1] === "!") continue;
        const citationUrl = safeUrl(markdownMatch[2]);
        if (!citationUrl || isSameHost(citationUrl, options.siteHost)) continue;
        const label = markdownLinkLabel(markdownMatch[1]);
        const profile = fallbackSourceProfile(citationUrl);
        pushEvidence(sources, {
            id: `${contentId}-markdown-link-${sources.length}`,
            url: citationUrl,
            title: label ?? publisherFromUrl(citationUrl) ?? "Evidence source",
            publisher: publisherFromUrl(citationUrl),
            quality: profile.quality,
            trustTier: profile.trustTier,
            citationLabel: label,
            evidenceType: "citation",
        });
    }

    let bareMatch: RegExpExecArray | null;
    while ((bareMatch = bareUrlRe.exec(markdown)) !== null) {
        const citationUrl = safeUrl(bareMatch[0].replace(/[.,;:!?]+$/, ""));
        if (!citationUrl || isSameHost(citationUrl, options.siteHost)) continue;
        const profile = fallbackSourceProfile(citationUrl);
        pushEvidence(sources, {
            id: `${contentId}-bare-url-${sources.length}`,
            url: citationUrl,
            title: publisherFromUrl(citationUrl) ?? "Evidence source",
            publisher: publisherFromUrl(citationUrl),
            quality: profile.quality,
            trustTier: profile.trustTier,
            evidenceType: "citation",
        });
    }

    return mergePublicEvidenceSources(sources, options.limit ?? 8);
}

function rowToPublicEvidence(rawRow: unknown): PublicEvidenceSource | null {
    const row = asRecord(rawRow);
    const document = Array.isArray(row.source_documents) ? asRecord(row.source_documents[0]) : asRecord(row.source_documents);
    const claim = Array.isArray(row.source_claims) ? asRecord(row.source_claims[0]) : asRecord(row.source_claims);
    const claimDocument = asRecord(claim.source_documents);
    const metadata = asRecord(row.metadata);
    const publicSource = asRecord(metadata.public_source);

    const citationUrl = safeUrl(row.citation_url) ?? safeUrl(document.canonical_url) ?? safeUrl(claimDocument.canonical_url) ?? safeUrl(publicSource.url);
    if (!citationUrl) return null;

    const title = typeof document.title === "string"
        ? document.title
        : typeof claimDocument.title === "string"
            ? claimDocument.title
            : typeof publicSource.title === "string"
                ? publicSource.title
                : typeof row.citation_label === "string"
                    ? row.citation_label
                    : "Evidence source";
    const publisher = typeof document.publisher === "string"
        ? document.publisher
        : typeof claimDocument.publisher === "string"
            ? claimDocument.publisher
            : typeof publicSource.publisher === "string"
                ? publicSource.publisher
                : null;
    const quality = isSourceQuality(document.quality)
        ? document.quality
        : isSourceQuality(claim.quality)
            ? claim.quality
            : isSourceQuality(claimDocument.quality)
                ? claimDocument.quality
                : isSourceQuality(publicSource.quality)
                    ? publicSource.quality
                    : null;
    const trustTier = isSourceTrustTier(document.trust_tier)
        ? document.trust_tier
        : isSourceTrustTier(claimDocument.trust_tier)
            ? claimDocument.trust_tier
            : isSourceTrustTier(publicSource.trust_tier)
                ? publicSource.trust_tier
                : null;

    const evidenceType = typeof row.evidence_type === "string" ? row.evidence_type : "citation";
    return {
        id: String(row.id),
        title,
        publisher,
        quality,
        trustTier,
        publishedAt: typeof document.published_at === "string" ? document.published_at : typeof claimDocument.published_at === "string" ? claimDocument.published_at : null,
        retrievedAt: typeof document.retrieved_at === "string" ? document.retrieved_at : typeof row.updated_at === "string" ? row.updated_at : null,
        citationUrl,
        citationLabel: typeof row.citation_label === "string" ? row.citation_label : null,
        evidenceType,
        evidenceCategory: classifyPublicEvidenceCategory(evidenceType, trustTier),
    };
}

export async function getPublicEvidenceForContentIds(contentIds: string[]): Promise<Map<string, PublicEvidenceSummary>> {
    const ids = Array.from(new Set(contentIds.filter(Boolean)));
    const summaries = new Map<string, PublicEvidenceSummary>();
    ids.forEach((contentId) => summaries.set(contentId, { contentId, verifiedSourceCount: 0, hasPrimaryOrNearPrimary: false, updatedThisWeek: false, evidenceTaxonomy: [] }));
    if (ids.length === 0) return summaries;

    try {
        const supabase = createAdminClient();
        const { data, error } = await supabase
            .from("content_evidence_links" as never)
            .select("id,content_id,citation_url,citation_label,evidence_type,updated_at,metadata,source_documents(id,title,canonical_url,publisher,quality,trust_tier,published_at,retrieved_at),source_claims(id,claim_text,quality,source_documents(title,canonical_url,publisher,quality,trust_tier,published_at))" as never)
            .in("content_id" as never, ids as never)
            .eq("is_public_safe" as never, true as never);
        if (error) return summaries;
        const byContent = new Map<string, PublicEvidenceSource[]>();
        ((data as EvidenceSummaryQueryRow[] | null) ?? []).forEach((item) => {
            const contentId = typeof item.content_id === "string" ? item.content_id : null;
            const evidence = rowToPublicEvidence(item);
            if (!contentId || !evidence) return;
            const next = byContent.get(contentId) ?? [];
            next.push(evidence);
            byContent.set(contentId, next);
        });
        byContent.forEach((sources, contentId) => {
            summaries.set(contentId, summarizePublicEvidenceSources(sources, contentId));
        });
        return summaries;
    } catch {
        return summaries;
    }
}

export async function getPublicEvidenceSummariesForContent(inputRows: PublicEvidenceSummaryInput[]): Promise<Map<string, PublicEvidenceSummary>> {
    const rows = inputRows.filter((row) => row.id);
    const summaries = await getPublicEvidenceForContentIds(rows.map((row) => row.id));
    rows.forEach((row) => {
        if (!isPublicEvidenceEnabled(row.metadata)) {
            summaries.set(row.id, {
                contentId: row.id,
                verifiedSourceCount: 0,
                hasPrimaryOrNearPrimary: false,
                updatedThisWeek: false,
                evidenceTaxonomy: [],
            });
            return;
        }
        const metadataSources = getPublicEvidenceFromContentMetadata(row.metadata, row.id);
        if (metadataSources.length === 0) return;
        const existing = summaries.get(row.id);
        const verifiedSourceCount = Math.max(existing?.verifiedSourceCount ?? 0, metadataSources.length);
        summaries.set(row.id, {
            contentId: row.id,
            verifiedSourceCount,
            hasPrimaryOrNearPrimary: Boolean(existing?.hasPrimaryOrNearPrimary) || metadataSources.some((source) => isPrimaryOrNearPrimary(source.quality, source.trustTier)),
            updatedThisWeek: Boolean(existing?.updatedThisWeek) || metadataSources.some((source) => isThisWeek(source.retrievedAt)),
            evidenceTaxonomy: Array.from(new Set([...(existing?.evidenceTaxonomy ?? []), ...metadataSources.map((source) => source.evidenceCategory)])),
        });
    });
    return summaries;
}

export async function getPublicEvidenceForContent(contentId: string, options: PublicEvidenceQueryOptions = {}): Promise<PublicEvidenceSource[]> {
    if (!contentId) return [];
    if (!isPublicEvidenceEnabled(options.metadata)) return [];
    const metadataSources = getPublicEvidenceFromContentMetadata(options.metadata, contentId, options.limit ?? 8);
    if (asRecord(options.metadata).public_evidence_mode === "curated") {
        return metadataSources;
    }
    const markdownSources = getPublicEvidenceFromMarkdownLinks(options.contentMarkdown, contentId, {
        siteHost: options.siteHost,
        limit: options.limit ?? 8,
    });
    try {
        const supabase = createAdminClient();
        let query = supabase
            .from("content_evidence_links" as never)
            .select("id,content_id,citation_url,citation_label,evidence_type,updated_at,metadata,source_documents(id,title,canonical_url,publisher,quality,trust_tier,published_at,retrieved_at),source_claims(id,claim_text,quality,source_documents(title,canonical_url,publisher,quality,trust_tier,published_at))" as never)
            .eq("content_id" as never, contentId as never)
            .eq("is_public_safe" as never, true as never)
            .order("created_at" as never, { ascending: false })
            .limit(Math.max(12, options.limit ?? 8));
        if (options.workspaceId) {
            query = query.eq("workspace_id" as never, options.workspaceId as never);
        }
        if (options.templateId) {
            query = query.eq("template_id" as never, options.templateId as never);
        }
        const { data, error } = await query;
        if (error) return mergePublicEvidenceSources([...metadataSources, ...markdownSources], options.limit ?? 8);
        const dbSources: PublicEvidenceSource[] = [];
        ((data as EvidenceSummaryQueryRow[] | null) ?? []).forEach((row) => {
            const evidence = rowToPublicEvidence(row);
            if (evidence) dbSources.push(evidence);
        });
        return mergePublicEvidenceSources([...dbSources, ...metadataSources, ...markdownSources], options.limit ?? 8);
    } catch {
        return mergePublicEvidenceSources([...metadataSources, ...markdownSources], options.limit ?? 8);
    }
}

export async function getSourceIntelligencePublicProofStats(workspaceId: string): Promise<{
    lastRefreshAt: string | null;
    authoritySourceCount: number;
    watchedThemes: string[];
}> {
    if (!workspaceId) return { lastRefreshAt: null, authoritySourceCount: 0, watchedThemes: [] };
    try {
        const supabase = createAdminClient();
        const { data } = await supabase
            .from("source_registry" as never)
            .select("quality,trust_tier,topic_tags,last_ingested_at,is_active,is_public_safe" as never)
            .eq("workspace_id" as never, workspaceId as never)
            .eq("is_active" as never, true as never)
            .eq("is_public_safe" as never, true as never)
            .limit(80);
        const rows = (data as RegistryProofQueryRow[] | null) ?? [];
        const lastRefreshAt = rows
            .map((row) => row.last_ingested_at)
            .filter((value): value is string => Boolean(value))
            .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
        const authoritySourceCount = rows.filter((row) => row.quality === "authoritative" || row.quality === "high" || row.trust_tier === "regulatory" || row.trust_tier === "industry").length;
        const tags = new Map<string, number>();
        rows.forEach((row) => {
            (row.topic_tags ?? []).forEach((tag) => {
                tags.set(tag, (tags.get(tag) ?? 0) + 1);
            });
        });
        return {
            lastRefreshAt,
            authoritySourceCount,
            watchedThemes: Array.from(tags.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tag]) => tag),
        };
    } catch {
        return { lastRefreshAt: null, authoritySourceCount: 0, watchedThemes: [] };
    }
}
