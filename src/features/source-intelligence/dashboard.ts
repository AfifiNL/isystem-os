import { validateGeneratedBlogDraft, type BlogDraftLengthTier } from "@/features/content-engine/lib/blog-editorial-validation";
import { createClient } from "@/shared/lib/supabase/server";
import type { Json } from "@/shared/lib/supabase/database.types";
import type {
    ContentEvidenceLinkRow,
    SourceEvidenceType,
    SourceIngestionJobStatus,
    SourceIngestionRunReason,
    SourceQuality,
    SourceRegistryRow,
    SourceTrustTier,
} from "@/features/source-intelligence/types";

type Locale = "en" | "nl" | "ar";

type UnknownRecord = Record<string, unknown>;

export interface SourceIntelligenceFilters {
    search?: string;
    locale?: Locale | "all";
    quality?: SourceQuality | "all";
    trustTier?: SourceTrustTier | "all";
    topic?: string;
    contentId?: string | null;
}

export interface SourceRegistryDashboardItem {
    id: string;
    name: string;
    canonicalUrl: string;
    sourceType: string;
    quality: SourceQuality;
    trustTier: SourceTrustTier;
    locale: Locale;
    topicTags: string[];
    enabled: boolean;
    publicSafe: boolean;
    cadence: string;
    lastCheckedAt: string | null;
    latestStatus: SourceIngestionJobStatus | null;
    sourceHealthStatus: string | null;
    sourceHealthReason: string | null;
}

export interface SourceIngestionRunDashboardItem {
    id: string;
    registryId: string | null;
    sourceName: string | null;
    reason: SourceIngestionRunReason;
    trigger: string;
    requestedAt: string | null;
    drainLimit: number | null;
    status: SourceIngestionJobStatus;
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    documentCount: number;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
}

export interface SourceEvidenceClaimDashboardItem {
    id: string;
    documentId: string;
    registryId: string;
    claimText: string;
    evidenceType: SourceEvidenceType;
    confidence: number;
    quality: SourceQuality;
    trustTier: SourceTrustTier;
    locale: Locale;
    topicTags: string[];
    publishedAt: string | null;
    sourceTitle: string;
    publisher: string | null;
    citationUrl: string;
    visualEligible: boolean;
}

export interface ContentEvidenceLinkDashboardItem {
    id: string;
    contentId: string;
    contentTitle: string;
    contentSlug: string | null;
    contentStatus: string | null;
    evidenceType: SourceEvidenceType;
    citationUrl: string | null;
    citationLabel: string | null;
    anchorText: string | null;
    isPublicSafe: boolean;
    validationStatus: "accepted" | "rejected" | "downgraded" | "pending";
    sourceTitle: string | null;
    publisher: string | null;
    quality: SourceQuality | null;
    trustTier: SourceTrustTier | null;
    createdAt: string;
}

export interface SourceIntelligenceContentItem {
    id: string;
    title: string;
    slug: string | null;
    status: string | null;
    locale: string | null;
    updatedAt: string | null;
}

export interface SourceIntelligenceValidationPreview {
    contentId: string;
    title: string;
    valid: boolean;
    blockerCount: number;
    warningCount: number;
    repairAttempts: number;
    topIssues: Array<{
        code: string;
        severity: string;
        message: string;
        repairInstruction: string;
    }>;
}

export interface SourceIntelligenceDashboardData {
    workspaceId: string;
    registry: SourceRegistryDashboardItem[];
    runs: SourceIngestionRunDashboardItem[];
    claims: SourceEvidenceClaimDashboardItem[];
    contentItems: SourceIntelligenceContentItem[];
    contentLinks: ContentEvidenceLinkDashboardItem[];
    validationPreview: SourceIntelligenceValidationPreview | null;
    stats: {
        approvedSources: number;
        enabledSources: number;
        authoritativeSources: number;
        recentRunCount: number;
        publicEvidenceLinks: number;
        visualEligibleClaims: number;
        queuedJobs: number;
        runningJobs: number;
        failedJobs: number;
        latestRunReason: SourceIngestionRunReason | null;
        latestRunTrigger: string | null;
        latestScheduledRunAt: string | null;
    };
    error: string | null;
}

function asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
}

function stringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeInterval(value: unknown): string {
    if (typeof value === "string") return value.replace(/^@\s*/, "").trim();
    return "not scheduled";
}

function escapeLike(value: string): string {
    return value.replace(/[%_]/g, "\\$&");
}

function isSourceQuality(value: unknown): value is SourceQuality {
    return value === "unverified" || value === "low" || value === "medium" || value === "high" || value === "authoritative";
}

function isSourceTrustTier(value: unknown): value is SourceTrustTier {
    return value === "unknown" || value === "community" || value === "vendor" || value === "industry" || value === "regulatory" || value === "internal";
}

function isLocale(value: unknown): value is Locale {
    return value === "en" || value === "nl" || value === "ar";
}

function isEvidenceType(value: unknown): value is SourceEvidenceType {
    return value === "citation" || value === "supporting" || value === "contradicting" || value === "benchmark" || value === "definition" || value === "case_study" || value === "statistic";
}

function numberValue(value: unknown): number {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function isVisualEligible(quality: SourceQuality, trustTier: SourceTrustTier, confidence: number, text: string): boolean {
    const primaryQuality = quality === "authoritative" || quality === "high";
    const primaryTier = trustTier === "regulatory" || trustTier === "industry" || trustTier === "internal";
    const numeric = /\b\d+(?:[.,]\d+)?\s?%|\b\d{2,}/.test(text);
    return numeric && confidence >= 65 && (primaryQuality || primaryTier);
}

function validationStatus(metadata: Json): "accepted" | "rejected" | "downgraded" | "pending" {
    const record = asRecord(metadata);
    const status = typeof record.validation_status === "string" ? record.validation_status : typeof record.operator_feedback === "string" ? record.operator_feedback : "";
    if (status === "accepted" || status === "rejected" || status === "downgraded") return status;
    return "pending";
}

function inferLengthTier(markdown: string): BlogDraftLengthTier {
    const words = (markdown.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) ?? []).length;
    if (words >= 2400) return "deep-dive";
    if (words >= 1400) return "long";
    if (words >= 700) return "medium";
    return "short";
}

function publicCitationFromLink(link: ContentEvidenceLinkRow, document: Record<string, unknown> | null, claim: Record<string, unknown> | null): string | null {
    if (link.citation_url) return link.citation_url;
    const docUrl = typeof document?.canonical_url === "string" ? document.canonical_url : null;
    const claimDocument = asRecord(claim?.source_documents);
    const claimUrl = typeof claimDocument.canonical_url === "string" ? claimDocument.canonical_url : null;
    return docUrl ?? claimUrl;
}

export async function loadSourceIntelligenceDashboard(input: {
    workspaceId: string;
    templateId: string;
    filters?: SourceIntelligenceFilters;
}): Promise<SourceIntelligenceDashboardData> {
    const filters = input.filters ?? {};
    const supabase = await createClient();

    try {
        let registryQuery = supabase
            .from("source_registry" as never)
            .select("*" as never)
            .or(`workspace_id.eq.${input.workspaceId},workspace_id.is.null`)
            .order("quality" as never, { ascending: true })
            .limit(80);

        if (filters.locale && filters.locale !== "all") registryQuery = registryQuery.eq("locale" as never, filters.locale as never);
        if (filters.quality && filters.quality !== "all") registryQuery = registryQuery.eq("quality" as never, filters.quality as never);
        if (filters.trustTier && filters.trustTier !== "all") registryQuery = registryQuery.eq("trust_tier" as never, filters.trustTier as never);
        if (filters.topic?.trim()) registryQuery = registryQuery.contains("topic_tags" as never, [filters.topic.trim()] as never);
        if (filters.search?.trim()) {
            const term = escapeLike(filters.search.trim());
            registryQuery = registryQuery.or(`name.ilike.%${term}%,canonical_url.ilike.%${term}%`);
        }

        let claimsQuery = supabase
            .from("source_claims" as never)
            .select("id,document_id,registry_id,claim_text,evidence_type,confidence,quality,topic_tags,locale,published_at,metadata,source_documents!inner(id,title,canonical_url,publisher,trust_tier,quality,is_public_safe,published_at)" as never)
            .eq("workspace_id" as never, input.workspaceId as never)
            .order("confidence" as never, { ascending: false })
            .limit(80);

        if (filters.locale && filters.locale !== "all") claimsQuery = claimsQuery.eq("locale" as never, filters.locale as never);
        if (filters.quality && filters.quality !== "all") claimsQuery = claimsQuery.eq("quality" as never, filters.quality as never);
        if (filters.topic?.trim()) claimsQuery = claimsQuery.contains("topic_tags" as never, [filters.topic.trim()] as never);
        if (filters.search?.trim()) claimsQuery = claimsQuery.ilike("claim_text" as never, `%${escapeLike(filters.search.trim())}%` as never);

        const [registryRes, runsRes, jobsRes, claimsRes, contentRes, linksRes] = await Promise.all([
            registryQuery,
            supabase
                .from("source_ingestion_runs" as never)
                .select("*, source_registry(name)" as never)
                .eq("workspace_id" as never, input.workspaceId as never)
                .order("created_at" as never, { ascending: false })
                .limit(20),
            supabase
                .from("source_ingestion_jobs" as never)
                .select("registry_id,status,document_id,run_id" as never)
                .eq("workspace_id" as never, input.workspaceId as never)
                .order("created_at" as never, { ascending: false })
                .limit(300),
            claimsQuery,
            supabase
                .from("content_items")
                .select("id,title,slug,status,locale,updated_at,content_markdown,metadata")
                .eq("type", "blog")
                .eq("template_id", input.templateId)
                .or(`workspace_id.eq.${input.workspaceId},and(workspace_id.is.null,template_id.eq.${input.templateId})`)
                .order("updated_at", { ascending: false })
                .limit(40),
            supabase
                .from("content_evidence_links" as never)
                .select("*, content_items!inner(id,title,slug,status,content_markdown,metadata), source_documents(id,title,canonical_url,publisher,quality,trust_tier,published_at), source_claims(id,claim_text,quality,source_documents(title,canonical_url,publisher,quality,trust_tier,published_at))" as never)
                .eq("workspace_id" as never, input.workspaceId as never)
                .eq("template_id" as never, input.templateId as never)
                .order("created_at" as never, { ascending: false })
                .limit(60),
        ]);

        const firstError = registryRes.error ?? runsRes.error ?? jobsRes.error ?? claimsRes.error ?? contentRes.error ?? linksRes.error;
        if (firstError) {
            return emptyDashboard(input.workspaceId, firstError.message);
        }

        const latestStatusByRegistry = new Map<string, SourceIngestionJobStatus>();
        const documentIdsByRun = new Map<string, Set<string>>();
        let queuedJobs = 0;
        let runningJobs = 0;
        ((jobsRes.data as UnknownRecord[] | null) ?? []).forEach((item) => {
            const registryId = typeof item.registry_id === "string" ? item.registry_id : null;
            const status = typeof item.status === "string" ? item.status as SourceIngestionJobStatus : null;
            if (registryId && status && !latestStatusByRegistry.has(registryId)) latestStatusByRegistry.set(registryId, status);
            if (status === "queued") queuedJobs += 1;
            if (status === "running") runningJobs += 1;
            const runId = typeof item.run_id === "string" ? item.run_id : null;
            const documentId = typeof item.document_id === "string" ? item.document_id : null;
            if (runId && documentId) {
                const set = documentIdsByRun.get(runId) ?? new Set<string>();
                set.add(documentId);
                documentIdsByRun.set(runId, set);
            }
        });

        const registry = ((registryRes.data as SourceRegistryRow[] | null) ?? []).map((row) => {
            const item = row as SourceRegistryRow;
            const metadata = asRecord(item.metadata);
            const sourceHealth = asRecord(metadata.source_health);
            const sourceHealthStatus = typeof item.source_health_status === "string" ? item.source_health_status : typeof sourceHealth.status === "string" ? sourceHealth.status : null;
            const sourceHealthReason = typeof item.last_fetch_error_classification === "string" ? item.last_fetch_error_classification
                : typeof item.disabled_reason === "string" ? item.disabled_reason
                    : typeof sourceHealth.last_error_classification === "string" ? sourceHealth.last_error_classification
                        : typeof sourceHealth.disabled_reason === "string" ? sourceHealth.disabled_reason : null;
            return {
                id: item.id,
                name: item.name,
                canonicalUrl: item.canonical_url,
                sourceType: item.source_type,
                quality: isSourceQuality(item.quality) ? item.quality : "unverified",
                trustTier: isSourceTrustTier(item.trust_tier) ? item.trust_tier : "unknown",
                locale: isLocale(item.locale) ? item.locale : "en",
                topicTags: stringArray(item.topic_tags),
                enabled: Boolean(item.is_active),
                publicSafe: Boolean(item.is_public_safe),
                cadence: normalizeInterval(item.crawl_frequency),
                lastCheckedAt: item.last_fetch_checked_at ?? (typeof sourceHealth.last_checked_at === "string" ? sourceHealth.last_checked_at : item.last_ingested_at),
                latestStatus: latestStatusByRegistry.get(item.id) ?? null,
                sourceHealthStatus,
                sourceHealthReason,
            } satisfies SourceRegistryDashboardItem;
        });

        const runs = ((runsRes.data as UnknownRecord[] | null) ?? []).map((item) => {
            const registryJoin = asRecord(item.source_registry);
            const summary = asRecord(item.summary);
            const id = String(item.id ?? "");
            const requestedAt = typeof summary.requested_at === "string" ? summary.requested_at : null;
            const trigger = typeof summary.trigger === "string" ? summary.trigger : item.run_reason === "manual" ? "dashboard" : "api";
            return {
                id,
                registryId: typeof item.registry_id === "string" ? item.registry_id : null,
                sourceName: typeof registryJoin.name === "string" ? registryJoin.name : null,
                reason: String(item.run_reason ?? "scheduled") as SourceIngestionRunReason,
                trigger,
                requestedAt,
                drainLimit: typeof summary.limit === "number" ? summary.limit : typeof summary.drain === "number" ? summary.drain : null,
                status: String(item.status ?? "queued") as SourceIngestionJobStatus,
                totalJobs: numberValue(item.total_jobs),
                completedJobs: numberValue(item.completed_jobs),
                failedJobs: numberValue(item.failed_jobs),
                documentCount: documentIdsByRun.get(id)?.size ?? 0,
                startedAt: typeof item.started_at === "string" ? item.started_at : null,
                completedAt: typeof item.completed_at === "string" ? item.completed_at : null,
                createdAt: String(item.created_at ?? new Date().toISOString()),
            } satisfies SourceIngestionRunDashboardItem;
        });

        const latestRun = runs[0] ?? null;
        const latestScheduledRun = runs.find((run) => run.reason === "scheduled" || run.trigger === "cron") ?? null;

        const claims = ((claimsRes.data as UnknownRecord[] | null) ?? []).map((item) => {
            const document = Array.isArray(item.source_documents) ? asRecord(item.source_documents[0]) : asRecord(item.source_documents);
            const quality = isSourceQuality(item.quality) ? item.quality : "unverified";
            const trustTier = isSourceTrustTier(document.trust_tier) ? document.trust_tier : "unknown";
            const claimText = String(item.claim_text ?? "");
            const confidence = numberValue(item.confidence);
            return {
                id: String(item.id),
                documentId: String(item.document_id),
                registryId: String(item.registry_id),
                claimText,
                evidenceType: isEvidenceType(item.evidence_type) ? item.evidence_type : "supporting",
                confidence,
                quality,
                trustTier,
                locale: isLocale(item.locale) ? item.locale : "en",
                topicTags: stringArray(item.topic_tags),
                publishedAt: typeof item.published_at === "string" ? item.published_at : null,
                sourceTitle: String(document.title ?? "Untitled source"),
                publisher: typeof document.publisher === "string" ? document.publisher : null,
                citationUrl: String(document.canonical_url ?? ""),
                visualEligible: isVisualEligible(quality, trustTier, confidence, claimText),
            } satisfies SourceEvidenceClaimDashboardItem;
        });

        const contentItems = ((contentRes.data as UnknownRecord[] | null) ?? []).map((item) => {
            return {
                id: String(item.id),
                title: String(item.title ?? "Untitled content"),
                slug: typeof item.slug === "string" ? item.slug : null,
                status: typeof item.status === "string" ? item.status : null,
                locale: typeof item.locale === "string" ? item.locale : null,
                updatedAt: typeof item.updated_at === "string" ? item.updated_at : null,
            } satisfies SourceIntelligenceContentItem;
        });

        let rawLinks = ((linksRes.data as UnknownRecord[] | null) ?? []);
        if (filters.contentId) {
            rawLinks = rawLinks.filter((row) => row.content_id === filters.contentId);
        }
        const contentLinks = rawLinks.map((row) => {
            const item = row as ContentEvidenceLinkRow & Record<string, unknown>;
            const content = asRecord(item.content_items);
            const document = Array.isArray(item.source_documents) ? asRecord(item.source_documents[0]) : asRecord(item.source_documents);
            const claim = Array.isArray(item.source_claims) ? asRecord(item.source_claims[0]) : asRecord(item.source_claims);
            const claimDocument = asRecord(claim.source_documents);
            const sourceTitle = typeof document.title === "string" ? document.title : typeof claimDocument.title === "string" ? claimDocument.title : null;
            const publisher = typeof document.publisher === "string" ? document.publisher : typeof claimDocument.publisher === "string" ? claimDocument.publisher : null;
            const quality = isSourceQuality(document.quality) ? document.quality : isSourceQuality(claim.quality) ? claim.quality : isSourceQuality(claimDocument.quality) ? claimDocument.quality : null;
            const trustTier = isSourceTrustTier(document.trust_tier) ? document.trust_tier : isSourceTrustTier(claimDocument.trust_tier) ? claimDocument.trust_tier : null;
            return {
                id: item.id,
                contentId: item.content_id,
                contentTitle: String(content.title ?? "Untitled content"),
                contentSlug: typeof content.slug === "string" ? content.slug : null,
                contentStatus: typeof content.status === "string" ? content.status : null,
                evidenceType: isEvidenceType(item.evidence_type) ? item.evidence_type : "citation",
                citationUrl: publicCitationFromLink(item, document, claim),
                citationLabel: item.citation_label,
                anchorText: item.anchor_text,
                isPublicSafe: Boolean(item.is_public_safe),
                validationStatus: validationStatus(item.metadata),
                sourceTitle,
                publisher,
                quality,
                trustTier,
                createdAt: item.created_at,
            } satisfies ContentEvidenceLinkDashboardItem;
        });

        const selectedContent = filters.contentId
            ? ((contentRes.data as UnknownRecord[] | null) ?? []).find((row) => row.id === filters.contentId)
            : ((contentRes.data as UnknownRecord[] | null) ?? [])[0];
        const validationPreview = selectedContent ? buildValidationPreview(selectedContent, contentLinks) : null;

        return {
            workspaceId: input.workspaceId,
            registry,
            runs,
            claims,
            contentItems,
            contentLinks,
            validationPreview,
            stats: {
                approvedSources: registry.length,
                enabledSources: registry.filter((source) => source.enabled).length,
                authoritativeSources: registry.filter((source) => source.quality === "authoritative" || source.trustTier === "regulatory").length,
                recentRunCount: runs.length,
                publicEvidenceLinks: contentLinks.filter((link) => link.isPublicSafe).length,
                visualEligibleClaims: claims.filter((claim) => claim.visualEligible).length,
                queuedJobs,
                runningJobs,
                failedJobs: latestRun?.failedJobs ?? 0,
                latestRunReason: latestRun?.reason ?? null,
                latestRunTrigger: latestRun?.trigger ?? null,
                latestScheduledRunAt: latestScheduledRun?.requestedAt ?? latestScheduledRun?.createdAt ?? null,
            },
            error: null,
        };
    } catch (error) {
        return emptyDashboard(input.workspaceId, error instanceof Error ? error.message : "Failed to load Source Intelligence.");
    }
}

function buildValidationPreview(content: Record<string, unknown>, contentLinks: ContentEvidenceLinkDashboardItem[]): SourceIntelligenceValidationPreview {
    const metadata = asRecord(content.metadata);
    const seo = asRecord(metadata.seo);
    const markdown = String(content.content_markdown ?? asRecord(metadata.generated_formats).blog_post ?? "");
    const validation = validateGeneratedBlogDraft({
        markdown,
        length: inferLengthTier(markdown),
        seoTitle: typeof seo.title === "string" ? seo.title : String(content.title ?? ""),
        seoDescription: typeof seo.description === "string" ? seo.description : typeof metadata.excerpt === "string" ? metadata.excerpt : undefined,
        keywords: stringArray(seo.keywords),
        externalCitations: contentLinks.map((link) => ({
            url: link.citationUrl ?? "",
            title: link.sourceTitle ?? link.citationLabel ?? undefined,
            publisher: link.publisher ?? undefined,
        })).filter((citation) => citation.url),
        title: String(content.title ?? ""),
    });
    const errors = validation.issues.filter((issue) => issue.severity === "error");
    const warnings = validation.issues.filter((issue) => issue.severity === "warning");
    const enrichment = asRecord(metadata.enrichment);
    const editorialValidation = asRecord(enrichment.editorial_validation);

    return {
        contentId: String(content.id),
        title: String(content.title ?? "Untitled content"),
        valid: validation.valid,
        blockerCount: errors.length,
        warningCount: warnings.length,
        repairAttempts: numberValue(editorialValidation.repair_attempts),
        topIssues: validation.issues.slice(0, 5).map((issue) => ({
            code: issue.code,
            severity: issue.severity,
            message: issue.message,
            repairInstruction: issue.repairInstruction,
        })),
    };
}

function emptyDashboard(workspaceId: string, error: string): SourceIntelligenceDashboardData {
    return {
        workspaceId,
        registry: [],
        runs: [],
        claims: [],
        contentItems: [],
        contentLinks: [],
        validationPreview: null,
        stats: {
            approvedSources: 0,
            enabledSources: 0,
            authoritativeSources: 0,
            recentRunCount: 0,
            publicEvidenceLinks: 0,
            visualEligibleClaims: 0,
            queuedJobs: 0,
            runningJobs: 0,
            failedJobs: 0,
            latestRunReason: null,
            latestRunTrigger: null,
            latestScheduledRunAt: null,
        },
        error,
    };
}
