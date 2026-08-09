import { createHash } from "node:crypto";

import type { CreativeSafetyPreflight } from "./evaluator";
import { buildEvaluatorPlan } from "./evaluator";

export interface CreativeScopedBrief {
    id: string;
    workspaceId: string;
    templateId: string | null;
    projectId: string;
    locale: string;
    title: string;
    briefMarkdown: string;
    targetUrl: string | null;
    targetChannel: string | null;
    targetAudience: string | null;
    brandRules: Record<string, unknown>;
    rightsRequirements: Record<string, unknown>;
}

export interface CreativeStrategyPlan {
    positioning: string;
    hook: string;
    narrative: string;
    scenes: Array<{
        title: string;
        visual: string;
        voiceover: string;
        evidence_required: boolean;
    }>;
    negative_prompt: string;
    claims_policy: "source_grounded_only";
}

export interface CreativePromptManifest {
    source_model: string;
    strategy_prompt: string;
    provider_prompt: string;
    negative_prompt: string;
    scene_plan: Record<string, unknown>;
    evaluator_plan: Record<string, unknown>;
    prompt_hash: string;
    safety: CreativeSafetyPreflight;
    evidence_pack: Record<string, unknown>;
}

function canonicalize(value: unknown): string {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
    return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`).join(",")}}`;
}

function asRecord(value: unknown): Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function claimText(claim: unknown): string {
    const record = asRecord(claim);
    return typeof record.claim_text === "string" ? record.claim_text : "";
}

export function extractUnsupportedQuantitativeClaims(briefMarkdown: string, evidencePack: unknown): string[] {
    const quantitativeClaims = briefMarkdown.match(/\b(?:\d+(?:[.,]\d+)?\s?%|\d+\s?(?:x|times|days|weeks|months|hours)|€\s?\d+[\d.,]*)[^.\n]*/gi) ?? [];
    if (quantitativeClaims.length === 0) return [];

    const evidenceClaims = Array.isArray(asRecord(evidencePack).claims) ? asRecord(evidencePack).claims as unknown[] : [];
    const evidenceText = evidenceClaims.map(claimText).join("\n").toLowerCase();

    return quantitativeClaims
        .map((claim) => claim.trim())
        .filter((claim) => {
            const numbers = claim.match(/\d+(?:[.,]\d+)?/g) ?? [];
            return numbers.length > 0 && !numbers.some((number) => evidenceText.includes(number.toLowerCase()));
        });
}

export function sanitizeEvidencePackForPersistence(evidencePack: unknown): Record<string, unknown> {
    const pack = asRecord(evidencePack);
    const claims = Array.isArray(pack.claims) ? pack.claims as unknown[] : [];
    const documents = Array.isArray(pack.documents) ? pack.documents as unknown[] : [];

    return {
        checked_at: typeof pack.checked_at === "string" ? pack.checked_at : new Date().toISOString(),
        retrieval_mode: typeof pack.retrieval_mode === "string" ? pack.retrieval_mode : "none",
        stale: Boolean(pack.stale),
        claim_count: claims.length,
        document_count: documents.length,
        claims: claims.slice(0, 12).map((claim) => {
            const record = asRecord(claim);
            const source = asRecord(record.source);
            const text = claimText(record);
            return {
                id: typeof record.id === "string" ? record.id : null,
                claim_hash: text ? createHash("sha256").update(text).digest("hex") : null,
                quality: typeof record.quality === "string" ? record.quality : null,
                confidence: typeof record.confidence === "number" ? record.confidence : null,
                source: {
                    title: typeof source.title === "string" ? source.title : null,
                    canonical_url: typeof source.canonical_url === "string" ? source.canonical_url : null,
                    publisher: typeof source.publisher === "string" ? source.publisher : null,
                    trust_tier: typeof source.trust_tier === "string" ? source.trust_tier : null,
                },
            };
        }),
        documents: documents.slice(0, 8).map((document) => {
            const record = asRecord(document);
            return {
                id: typeof record.id === "string" ? record.id : null,
                title: typeof record.title === "string" ? record.title : null,
                canonical_url: typeof record.canonical_url === "string" ? record.canonical_url : null,
                quality: typeof record.quality === "string" ? record.quality : null,
                trust_tier: typeof record.trust_tier === "string" ? record.trust_tier : null,
            };
        }),
    };
}

export function evaluateCreativeSafetyPreflight(brief: CreativeScopedBrief, evidencePack: unknown): CreativeSafetyPreflight {
    const unsupported = extractUnsupportedQuantitativeClaims(brief.briefMarkdown, evidencePack);
    const evidence = asRecord(evidencePack);
    const evidenceMode = typeof evidence.retrieval_mode === "string" ? evidence.retrieval_mode : "none";
    const evidenceStatus = evidenceMode === "source_intelligence" && !evidence.stale
        ? "source_grounded"
        : evidenceMode === "source_intelligence"
            ? "stale"
            : "missing";
    const rightsFlags = Object.keys(brief.rightsRequirements ?? {}).length > 0 ? [] : ["rights checklist requires operator confirmation"];
    const policyFlags = /celebrity|famous person|copyrighted character|medical|legal advice|political|before.?after/i.test(brief.briefMarkdown)
        ? ["restricted claim or likeness category requires review"]
        : [];

    return {
        status: unsupported.length > 0 || policyFlags.length > 0 ? "blocked" : rightsFlags.length > 0 || evidenceStatus !== "source_grounded" ? "needs_review" : "pass",
        human_approval_required: true,
        blocked_claims: unsupported,
        downgraded_claims: unsupported.map((claim) => `${claim} → downgraded to qualitative visual concept`),
        rights_flags: rightsFlags,
        policy_flags: policyFlags,
        evidence_status: evidenceStatus,
        render_queueing: "blocked_until_human_approval",
    };
}

function stripUnsupportedClaims(text: string, unsupportedClaims: string[]): string {
    return unsupportedClaims.reduce((current, claim) => current.replace(claim, "a qualitative, source-safe improvement"), text);
}

export function compileCreativePromptManifest(input: {
    brief: CreativeScopedBrief;
    plan: CreativeStrategyPlan;
    evidencePack: unknown;
    sourceModel: string;
}): CreativePromptManifest {
    const safety = evaluateCreativeSafetyPreflight(input.brief, input.evidencePack);
    const safeScenes = input.plan.scenes.map((scene) => ({
        ...scene,
        voiceover: stripUnsupportedClaims(scene.voiceover, safety.blocked_claims),
    }));
    const scenePlan = {
        schema: "creative_scene_plan_v1",
        render_job_created: false,
        human_approval_required: true,
        scenes: safeScenes,
    };
    const strategyPrompt = [
        `Creative Studio strategy for: ${input.brief.title}`,
        `Workspace scope: workspace=${input.brief.workspaceId}; template=${input.brief.templateId ?? "null"}; locale=${input.brief.locale}`,
        `Audience: ${input.brief.targetAudience ?? "not specified"}`,
        `Channel: ${input.brief.targetChannel ?? "manual_export"}`,
        `Positioning: ${input.plan.positioning}`,
        `Hook: ${input.plan.hook}`,
        `Narrative: ${input.plan.narrative}`,
        "Evidence rule: use only Source Intelligence evidence or qualitative, non-quantified language.",
    ].join("\n");
    const providerPrompt = [
        `Create a governed visual/video concept for ${input.brief.targetChannel ?? "manual export"}.`,
        `Style: ${input.plan.positioning}.`,
        `Hook: ${stripUnsupportedClaims(input.plan.hook, safety.blocked_claims)}.`,
        "Scene plan:",
        ...safeScenes.map((scene, index) => `${index + 1}. ${scene.title}: ${scene.visual}. Voiceover: ${scene.voiceover}`),
        safety.blocked_claims.length > 0 ? "Avoid unsupported quantitative claims; use qualitative language only." : "Claims are source-grounded; do not add new factual claims.",
        "Do not imitate celebrities, copyrighted characters, private likenesses, or public figures.",
    ].join("\n");
    const evaluatorPlan = buildEvaluatorPlan({ safety, targetChannel: input.brief.targetChannel, locale: input.brief.locale });
    const persistedEvidence = sanitizeEvidencePackForPersistence(input.evidencePack);
    const hashPayload = {
        source_model: input.sourceModel,
        strategy_prompt: strategyPrompt,
        provider_prompt: providerPrompt,
        negative_prompt: input.plan.negative_prompt,
        scene_plan: scenePlan,
        evaluator_plan: evaluatorPlan,
        safety,
        evidence_pack: persistedEvidence,
    };

    return {
        source_model: input.sourceModel,
        strategy_prompt: strategyPrompt,
        provider_prompt: providerPrompt,
        negative_prompt: input.plan.negative_prompt,
        scene_plan: scenePlan,
        evaluator_plan: evaluatorPlan,
        prompt_hash: createHash("sha256").update(canonicalize(hashPayload)).digest("hex"),
        safety,
        evidence_pack: persistedEvidence,
    };
}
