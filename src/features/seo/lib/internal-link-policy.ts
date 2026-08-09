import type { Json } from "@/shared/lib/supabase/database.types";
import type { Locale } from "@/features/templates/types";
import type { SeoContentAnalytics, SeoPublishedContentItem } from "@/features/seo/types";
import {
    buildAnchorText,
    computeAnalyticsScore,
    computePriorityScore,
    computeStrategicImportance,
    getContentFingerprint,
    normalizeAnalyticsMap,
    similarityScore,
    targetDuplicateKeys,
} from "@/features/seo/lib/analysis";
import { MIN_TOPIC_JACCARD, jaccardSimilarity, tokenizeForOverlap } from "@/features/seo/lib/text-overlap";

const POLICY_VERSION = "2026-06-02.contextual-internal-links.v1";
const MIN_SEMANTIC_FIT = 8;
const MIN_READER_NEXT_STEP_SCORE = 22;
const MAX_INTERNAL_LINKS_PER_1000_WORDS = 8;
const MIN_NARRATIVE_WORDS_FOR_AUTO_LINK = 120;
const GENERIC_ANCHORS = new Set([
    "click here",
    "read more",
    "learn more",
    "more information",
    "more info",
    "this page",
    "this article",
    "here",
    "link",
]);

export const INTERNAL_LINK_POLICY_LIMITS = {
    specialistAudit: {
        maxCandidates: 60,
        maxAutoApplyTotal: 12,
        maxAutoApplyPerSource: 1,
    },
    workerJob: {
        maxCandidates: 10,
        maxAutoApplyTotal: 3,
        maxAutoApplyPerSource: 1,
    },
} as const;

export interface InternalLinkOpportunityCandidate {
    workspace_id: string;
    run_id?: string | null;
    locale: string;
    status: "pending";
    source_content_id: string;
    target_content_id: string;
    source_slug: string;
    target_slug: string;
    source_title: string;
    target_title: string;
    anchor_text: string;
    rationale: string;
    source_excerpt: string | null;
    target_excerpt: string | null;
    source_traffic: number;
    target_conversions: number;
    target_conversion_goal: string | null;
    semantic_fit_score: number;
    analytics_score: number;
    strategic_importance_score: number;
    priority_score: number;
    confidence_score: number;
    existing_link_count: number;
    is_orphan_target: boolean;
    suggestion: Json;
    metadata: Json;
}

export interface GscSummaryRow {
    page_slug: string;
    query: string;
    total_impressions: number;
    total_clicks: number;
    avg_ctr: number;
    avg_position: number;
    min_date?: string;
    max_date?: string;
}

export interface BuildInternalLinkCandidatesInput {
    workspaceId: string;
    runId?: string | null;
    locale: Locale | string;
    templateId?: string | null;
    inventory: SeoPublishedContentItem[];
    analytics: SeoContentAnalytics[];
    incomingLinks: Map<string, number>;
    sourceContentId?: string | null;
    includeInboundForSource?: boolean;
    maxCandidates: number;
    maxAutoApplyTotal: number;
    maxAutoApplyPerSource: number;
    gscSummaries?: GscSummaryRow[];
}

function asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
}

function normalizeComparable(value: string): string {
    return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

function wordCount(value: string): number {
    return value.match(/\p{L}[\p{L}\p{N}\p{M}]*/gu)?.length ?? 0;
}

function getNarrativeText(item: SeoPublishedContentItem): string {
    return [
        item.title,
        item.excerpt,
        item.seoTitle ?? "",
        item.seoDescription ?? "",
        item.contentMarkdown,
        item.visualLayoutText,
    ].join("\n");
}

function getCandidateExcerpt(item: SeoPublishedContentItem): string {
    const value = [
        item.excerpt,
        item.seoDescription ?? "",
        item.visualLayoutText,
        item.contentMarkdown,
    ].find((candidate) => candidate.trim().length > 0) ?? "";
    const cleaned = value
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    return cleaned.length > 600 ? `${cleaned.slice(0, 599).trimEnd()}…` : cleaned;
}

function getSourceDensity(item: SeoPublishedContentItem) {
    const words = wordCount(getNarrativeText(item));
    const outboundLinks = item.links.length;
    const linksPer1000Words = words > 0 ? Number(((outboundLinks / words) * 1000).toFixed(2)) : outboundLinks * 1000;
    const sensibleMaxLinks = Math.max(3, Math.floor(words / 160) + 2);
    const nearThreshold = words < MIN_NARRATIVE_WORDS_FOR_AUTO_LINK
        || linksPer1000Words >= MAX_INTERNAL_LINKS_PER_1000_WORDS
        || outboundLinks >= sensibleMaxLinks;
    return { words, outboundLinks, linksPer1000Words, sensibleMaxLinks, nearThreshold };
}

function getMetadataSignal(item: SeoPublishedContentItem, keys: string[]): string | null {
    const metadata = asRecord(item.metadata);
    const seo = asRecord(metadata.seo);
    const manualBuilder = asRecord(metadata.manual_builder);
    const structured = asRecord(metadata.structured_content);
    const rootProps = asRecord(asRecord(structured.root).props);
    const builderMetadata = asRecord(rootProps.metadata);
    for (const key of keys) {
        const candidates = [metadata[key], seo[key], manualBuilder[key], rootProps[key], builderMetadata[key]];
        const found = candidates.find((value) => typeof value === "string" && value.trim().length > 0);
        if (typeof found === "string") return found.trim();
    }
    return null;
}

function getPolicySignals(item: SeoPublishedContentItem) {
    const metadata = asRecord(item.metadata);
    const seo = asRecord(metadata.seo);
    const cluster = getMetadataSignal(item, ["cluster", "clusterName", "topicCluster", "pillarTopic"]);
    const role = getMetadataSignal(item, ["clusterRole", "cluster_role", "contentRole", "seoRole"]);
    const pageIntent = item.pageIntent ?? getMetadataSignal(item, ["pageIntent", "page_intent"]);
    const audienceType = item.audienceType ?? getMetadataSignal(item, ["audienceType", "audience_type", "sector"]);
    const pillarSignal = getMetadataSignal(item, ["isPillar", "pillar"]);
    const isPillar = role?.toLowerCase().includes("pillar")
        || pillarSignal?.toLowerCase().includes("true") === true
        || Boolean(seo.isPillar);
    return { cluster, role, pageIntent, audienceType, isPillar };
}

function areSameLocalePair(source: SeoPublishedContentItem, target: SeoPublishedContentItem, locale: string) {
    const sourceLocale = source.locale ?? locale;
    const targetLocale = target.locale ?? locale;
    if (source.type === "page" || target.type === "page") return true;
    return !sourceLocale || !targetLocale || sourceLocale === targetLocale;
}

function sourceAlreadyLinksTarget(source: SeoPublishedContentItem, target: SeoPublishedContentItem): boolean {
    const sourceLinks = new Set(source.links.map((link) => link.replace(/^\/+|\/+$/g, "")));
    return targetDuplicateKeys({ slug: target.slug, type: target.type }).some((key) => sourceLinks.has(key));
}

function getSharedTopics(sourceText: string, targetText: string, locale: string): string[] {
    const sourceTokens = tokenizeForOverlap(sourceText, locale);
    const targetTokens = tokenizeForOverlap(targetText, locale);
    const shared: string[] = [];
    for (const token of targetTokens) {
        if (sourceTokens.has(token)) shared.push(token);
        if (shared.length >= 12) break;
    }
    return shared;
}

export function evaluateInternalLinkAnchor(anchorText: string, target: Pick<SeoPublishedContentItem, "title" | "keywords">) {
    const normalizedAnchor = normalizeComparable(anchorText);
    const normalizedTitle = normalizeComparable(target.title);
    const words = normalizedAnchor ? normalizedAnchor.split(/\s+/).filter(Boolean) : [];
    const reasons: string[] = [];

    if (normalizedAnchor.length < 3) reasons.push("Anchor is too short for an unattended contextual link.");
    if (words.length > 7) reasons.push("Anchor is too long and risks reading like SEO stuffing.");
    if (GENERIC_ANCHORS.has(normalizedAnchor)) reasons.push("Anchor is generic and does not explain the reader's next step.");
    if (/^https?:|^www\./i.test(anchorText)) reasons.push("Anchor text looks like a URL, not editorial copy.");
    if (normalizedAnchor === normalizedTitle && (words.length > 4 || /[|—–-]/.test(target.title))) {
        reasons.push("Anchor repeats the exact page title in a way that can read as title stuffing.");
    }

    const targetKeywordTokens = new Set(target.keywords.flatMap((keyword) => normalizeComparable(keyword).split(/\s+/).filter(Boolean)));
    const targetTitleTokens = new Set(normalizedTitle.split(/\s+/).filter(Boolean));
    const supportedByTarget = words.some((word) => targetKeywordTokens.has(word) || targetTitleTokens.has(word));
    if (!supportedByTarget && words.length > 0) {
        reasons.push("Anchor does not reuse a recognizable destination topic or keyword.");
    }

    return {
        safe: reasons.length === 0,
        reasons,
        wordCount: words.length,
        normalizedAnchor,
    };
}

function scoreReaderNextStep(input: {
    source: SeoPublishedContentItem;
    target: SeoPublishedContentItem;
    sharedTopics: string[];
    sourceSignals: ReturnType<typeof getPolicySignals>;
    targetSignals: ReturnType<typeof getPolicySignals>;
}) {
    let score = 0;
    const reasons: string[] = [];
    if (input.sharedTopics.length >= 3) {
        score += 22;
        reasons.push(`Shared topical vocabulary (${input.sharedTopics.slice(0, 4).join(", ")}) makes the next page contextually useful.`);
    } else if (input.sharedTopics.length >= 1) {
        score += 12;
        reasons.push(`A small shared topic set (${input.sharedTopics.join(", ")}) supports the link, but weakly.`);
    }
    if (input.sourceSignals.cluster && input.sourceSignals.cluster === input.targetSignals.cluster) {
        score += 24;
        reasons.push("Both pages appear to sit in the same topic cluster.");
    }
    if (input.targetSignals.isPillar) {
        score += 18;
        reasons.push("The target appears to be pillar content, so the link supports cluster architecture.");
    }
    if (input.target.conversionGoal) {
        score += 18;
        reasons.push("The target has a conversion goal, so the link can serve a reader next step instead of only distributing equity.");
    }
    if (input.source.type === "blog" && input.target.type === "page") {
        score += 10;
        reasons.push("A supporting article can naturally route readers to a relevant pillar, sector, or conversion page.");
    }
    if (input.sourceSignals.audienceType && input.sourceSignals.audienceType === input.targetSignals.audienceType) {
        score += 10;
        reasons.push("Both pages appear aimed at the same audience or sector.");
    }
    return { score: Math.min(100, score), reasons };
}

function scoreStrategicPath(input: {
    source: SeoPublishedContentItem;
    target: SeoPublishedContentItem;
    sourceSignals: ReturnType<typeof getPolicySignals>;
    targetSignals: ReturnType<typeof getPolicySignals>;
}) {
    let score = 0;
    const reasons: string[] = [];
    if (input.targetSignals.isPillar) {
        score += 28;
        reasons.push("pillar_target");
    }
    if (input.sourceSignals.cluster && input.sourceSignals.cluster === input.targetSignals.cluster) {
        score += 24;
        reasons.push("same_cluster");
    }
    if (input.target.conversionGoal) {
        score += 24;
        reasons.push("conversion_path");
    }
    if (/quote|book|contact|consult|pricing|campaign|landing/i.test(input.target.pageIntent ?? input.targetSignals.pageIntent ?? "")) {
        score += 14;
        reasons.push("bottom_funnel_intent");
    }
    if (input.target.type === "page") {
        score += 10;
        reasons.push("durable_page_target");
    }
    return { score: Math.min(100, score), reasons };
}

function buildRationale(input: {
    source: SeoPublishedContentItem;
    target: SeoPublishedContentItem;
    sharedTopics: string[];
    readerReasons: string[];
    targetConversionGoal: string | null;
}) {
    const topicPhrase = input.sharedTopics.length > 0
        ? ` around ${input.sharedTopics.slice(0, 3).join(", ")}`
        : " where the surrounding section introduces the same problem";
    const nextStep = input.targetConversionGoal
        ? ` and gives readers a relevant next step toward ${input.targetConversionGoal}`
        : " and gives readers a deeper next page instead of a decorative link";
    const reason = input.readerReasons[0] ?? "The pages share a practical reader journey.";
    return `Connect ${input.source.title} to ${input.target.title}${topicPhrase}${nextStep}. ${reason}`;
}

function buildCandidate(input: {
    workspaceId: string;
    runId?: string | null;
    locale: string;
    templateId?: string | null;
    source: SeoPublishedContentItem;
    target: SeoPublishedContentItem;
    analyticsMap: Map<string, SeoContentAnalytics>;
    incomingLinks: Map<string, number>;
    gscSummaries?: GscSummaryRow[];
}): InternalLinkOpportunityCandidate | null {
    const { source, target, locale } = input;
    if (source.id === target.id) return null;
    if (!areSameLocalePair(source, target, locale)) return null;
    if (sourceAlreadyLinksTarget(source, target)) return null;

    const sourceDensity = getSourceDensity(source);
    if (sourceDensity.nearThreshold) return null;

    const sourceText = getContentFingerprint(source);
    const targetText = getContentFingerprint(target);
    const sourceTokens = tokenizeForOverlap(sourceText, locale);
    const targetTokens = tokenizeForOverlap(targetText, locale);
    const topicJaccard = jaccardSimilarity(sourceTokens, targetTokens);
    const topicOverlapScore = Number((topicJaccard * 100).toFixed(2));
    const legacySemanticFit = similarityScore(sourceText, targetText);
    const semanticFit = Number(Math.max(legacySemanticFit, topicOverlapScore).toFixed(2));

    if (topicJaccard < MIN_TOPIC_JACCARD) return null;
    if (semanticFit < MIN_SEMANTIC_FIT && topicJaccard < MIN_TOPIC_JACCARD * 1.75) return null;

    const sharedTopics = getSharedTopics(sourceText, targetText, locale);
    const sourceSignals = getPolicySignals(source);
    const targetSignals = getPolicySignals(target);
    const readerNextStep = scoreReaderNextStep({ source, target, sharedTopics, sourceSignals, targetSignals });
    if (readerNextStep.score < MIN_READER_NEXT_STEP_SCORE) return null;

    const strategicPath = scoreStrategicPath({ source, target, sourceSignals, targetSignals });
    const sourceAnalytics = input.analyticsMap.get(source.slug);
    const targetAnalytics = input.analyticsMap.get(target.slug);
    const analyticsScore = computeAnalyticsScore(sourceAnalytics, targetAnalytics);
    const incomingCount = input.incomingLinks.get(target.id) ?? 0;
    const strategicImportance = computeStrategicImportance(target, incomingCount, targetAnalytics);
    const sourceNarrativeLength = (source.contentMarkdown.length || 0) + (source.visualLayoutText.length || 0);
    const basePriority = computePriorityScore({
        semanticFit,
        analyticsScore,
        strategicImportance,
        sourceOutboundCount: source.links.length,
        sourceNarrativeLength,
    });
    let priority = Number(Math.min(100, basePriority + readerNextStep.score * 0.12 + strategicPath.score * 0.1).toFixed(2));
    const anchorText = buildAnchorText(source, target);
    const anchorPolicy = evaluateInternalLinkAnchor(anchorText, target);
    if (!anchorPolicy.safe) return null;

    const targetConversionGoal = target.conversionGoal ?? null;
    let confidence = Math.min(100, Number((semanticFit * 0.5 + readerNextStep.score * 0.25 + strategicImportance * 0.15 + strategicPath.score * 0.1).toFixed(2)));

    // GSC Signal Integration
    const targetGscRows = input.gscSummaries?.filter(r => r.page_slug === target.slug) || [];
    let bestGsc: GscSummaryRow | null = null;
    for (const row of targetGscRows) {
        if (!bestGsc || row.total_impressions > bestGsc.total_impressions) {
            bestGsc = row;
        }
    }

    let gscEvidence: {
        provenance: string;
        query: string;
        page_slug: string;
        impressions: number;
        clicks: number;
        ctr: number;
        position: number;
        min_date?: string;
        max_date?: string;
        opportunity_type: string;
        confidence_score: number;
    } | null = null;
    if (bestGsc) {
        const isNearPageOne = bestGsc.avg_position >= 4 && bestGsc.avg_position <= 12;
        const isLowCtr = bestGsc.avg_ctr <= 0.02 && bestGsc.total_impressions >= 20;
        const opportunityType = isNearPageOne ? 'near-page-one' : (isLowCtr ? 'low-ctr' : 'general');
        const scoreAdjustment = isNearPageOne ? 15 : (isLowCtr ? 10 : 5);

        gscEvidence = {
            provenance: 'gsc',
            query: bestGsc.query,
            page_slug: target.slug,
            impressions: bestGsc.total_impressions,
            clicks: bestGsc.total_clicks,
            ctr: bestGsc.avg_ctr,
            position: bestGsc.avg_position,
            min_date: bestGsc.min_date,
            max_date: bestGsc.max_date,
            opportunity_type: opportunityType,
            confidence_score: isNearPageOne ? 85 : 70
        };

        priority = Math.min(100, priority + scoreAdjustment);
        confidence = Math.min(100, confidence + scoreAdjustment);
    }

    const policyMetadata = {
        version: POLICY_VERSION,
        decision: "candidate_selected",
        semanticFit,
        legacySemanticFit,
        topicJaccard: Number(topicJaccard.toFixed(4)),
        topicOverlapScore,
        sharedTopics,
        readerNextStepScore: readerNextStep.score,
        readerNextStepReasons: readerNextStep.reasons,
        strategicPathScore: strategicPath.score,
        strategicPathReasons: strategicPath.reasons,
        sourceDensity,
        anchorPolicy,
        localeIsolation: {
            sourceLocale: source.locale ?? locale,
            targetLocale: target.locale ?? locale,
            crossLocaleAllowed: source.type === "page" || target.type === "page",
        },
        templateScope: input.templateId ?? null,
    };

    return {
        workspace_id: input.workspaceId,
        ...(input.runId ? { run_id: input.runId } : {}),
        locale,
        status: "pending",
        source_content_id: source.id,
        target_content_id: target.id,
        source_slug: source.slug,
        target_slug: target.slug,
        source_title: source.title,
        target_title: target.title,
        anchor_text: anchorText,
        rationale: buildRationale({ source, target, sharedTopics, readerReasons: readerNextStep.reasons, targetConversionGoal }),
        source_excerpt: getCandidateExcerpt(source),
        target_excerpt: getCandidateExcerpt(target),
        source_traffic: sourceAnalytics?.pageViews ?? 0,
        target_conversions: targetAnalytics?.conversions ?? 0,
        target_conversion_goal: targetConversionGoal,
        semantic_fit_score: semanticFit,
        analytics_score: analyticsScore,
        strategic_importance_score: strategicImportance,
        priority_score: priority,
        confidence_score: confidence,
        existing_link_count: incomingCount,
        is_orphan_target: incomingCount === 0,
        suggestion: {
            sourceType: source.type,
            targetType: target.type,
            sourceKeywords: source.keywords,
            targetKeywords: target.keywords,
            policy: {
                readerNextStepScore: readerNextStep.score,
                strategicPathScore: strategicPath.score,
                sharedTopics,
            },
        } as Json,
        metadata: {
            sourcePageIntent: source.pageIntent,
            targetPageIntent: target.pageIntent,
            targetAudienceType: target.audienceType,
            internalLinkPolicy: policyMetadata,
            ...(gscEvidence ? { gsc: gscEvidence } : {}),
        } as Json,
    };
}

function attachAutoApplyDecisions(
    candidates: InternalLinkOpportunityCandidate[],
    limits: Pick<BuildInternalLinkCandidatesInput, "maxAutoApplyPerSource" | "maxAutoApplyTotal">,
) {
    const perSource = new Map<string, number>();
    let total = 0;
    return candidates.map((candidate) => {
        const sourceCount = perSource.get(candidate.source_content_id) ?? 0;
        const eligible = total < limits.maxAutoApplyTotal && sourceCount < limits.maxAutoApplyPerSource;
        if (eligible) {
            total += 1;
            perSource.set(candidate.source_content_id, sourceCount + 1);
        }
        const metadata = asRecord(candidate.metadata);
        const existingPolicy = asRecord(metadata.internalLinkPolicy);
        return {
            ...candidate,
            metadata: {
                ...metadata,
                internalLinkPolicy: {
                    ...existingPolicy,
                    autoApplyEligible: eligible,
                    autoApplyDecisionReason: eligible
                        ? "Passed relevance, density, duplicate, anchor, per-source, and run-level auto-apply limits."
                        : "Kept as a recommendation but excluded from unattended auto-apply to avoid excessive linking in one run/job.",
                    autoApplyLimits: {
                        maxAutoApplyTotal: limits.maxAutoApplyTotal,
                        maxAutoApplyPerSource: limits.maxAutoApplyPerSource,
                    },
                },
            } as Json,
        };
    });
}

export function buildInternalLinkCandidates(input: BuildInternalLinkCandidatesInput): InternalLinkOpportunityCandidate[] {
    const analyticsMap = normalizeAnalyticsMap(input.analytics);
    const sourceFilter = input.sourceContentId
        ? new Set([input.sourceContentId])
        : null;
    const focusedSource = input.sourceContentId
        ? input.inventory.find((item) => item.id === input.sourceContentId) ?? null
        : null;

    const candidates: InternalLinkOpportunityCandidate[] = [];
    for (const source of input.inventory) {
        if (sourceFilter && !sourceFilter.has(source.id) && !(input.includeInboundForSource && focusedSource)) {
            continue;
        }
        for (const target of input.inventory) {
            if (sourceFilter && source.id !== input.sourceContentId && target.id !== input.sourceContentId) {
                continue;
            }
            if (!input.includeInboundForSource && input.sourceContentId && source.id !== input.sourceContentId) {
                continue;
            }
            const candidate = buildCandidate({
                workspaceId: input.workspaceId,
                runId: input.runId,
                locale: input.locale,
                templateId: input.templateId,
                source,
                target,
                analyticsMap,
                incomingLinks: input.incomingLinks,
                gscSummaries: input.gscSummaries,
            });
            if (candidate) candidates.push(candidate);
        }
    }

    const sorted = candidates
        .sort((a, b) => b.priority_score - a.priority_score)
        .slice(0, input.maxCandidates);
    return attachAutoApplyDecisions(sorted, input);
}
