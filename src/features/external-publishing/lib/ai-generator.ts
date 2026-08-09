import { z } from "zod";
import { getModelMetadata, runWithWorkspaceAiConfig, buildResolvedAiRequestMetadata, type AiModelAlias } from "@/shared/lib/ai/provider";
import { generateObjectWithFallback, type GenerateObjectWithFallbackResult } from "@/shared/lib/ai/runtime-fallback";
import { assertSufficientAiBalance, checkAiRateLimitPg, meterAndCharge, type MeterResult, type RateLimitResult } from "@/shared/lib/ai/metering";
import { appendExternalPublishingUtm, buildExternalPublishingAttribution } from "./attribution";
import { getExternalPublishingPlatformAdapter } from "../platform-adapters";
import type { ExternalPublishingPlatformAdapter } from "../platform-adapters";
import { validateExternalPublishingPackage, type ExternalPublishingPackageValidationInput, type ExternalPublishingValidationResult } from "../validators";
import { generateDeterministicExternalPackage, type ExternalPublishingStructuredGenerator, type GenerateExternalPublishingPackageInput, type GeneratedExternalPublishingPackage } from "./package-generator";
import { countExternalPublishingWords, selectExternalPublishingPlatformBody, stripBrokenOwnedResourceTrailingSentence, stripExternalPublishingMarkdown } from "./platform-body";

const MODEL_ALIAS: AiModelAlias = "text.writer";
const ROUTE_NAME = "external_publishing_generate_package";

const externalPublishingAiCandidateSchema = z.object({
    titleOptions: z.array(z.string().trim().min(1)).min(1).max(5),
    bodyMarkdown: z.string().trim().min(1),
    bodyPlatformSpecific: z.string().trim().optional(),
    noLinkBodyMarkdown: z.string().trim().nullable().optional(),
    copyBlocks: z.record(z.string(), z.unknown()).default({}),
    links: z.array(z.object({
        url: z.string().url(),
        anchorText: z.string().trim().min(1),
        rationale: z.string().trim().min(1),
        placement: z.string().trim().nullable().optional(),
    })).default([]),
    visualPlan: z.object({
        imagePrompt: z.string().trim().min(1),
        mermaid: z.string().trim().min(1),
        altText: z.string().trim().optional(),
        notes: z.array(z.string().trim()).default([]),
    }),
    evidencePack: z.array(z.object({
        title: z.string().optional(),
        url: z.string().url().optional(),
        excerpt: z.string().optional(),
    })).default([]),
    hasNewPlatformNativeAngle: z.boolean().default(true),
    hasActionableChecklist: z.boolean().default(true),
    hasCredibleCaveats: z.boolean().default(true),
    hasUsefulVisualPlan: z.boolean().default(true),
    containsUnsupportedClaims: z.boolean().default(false),
    complianceWarnings: z.array(z.string().trim()).default([]),
});

type ExternalPublishingAiCandidate = z.infer<typeof externalPublishingAiCandidateSchema>;

/**
 * The slice of the generate-object result this generator actually consumes.
 * Narrowed from the full AI SDK result so the injected seam only demands what
 * it uses — the real `generateObjectWithFallback` still satisfies it.
 */
type ExternalPublishingAiResult = Pick<
    GenerateObjectWithFallbackResult<ExternalPublishingAiCandidate>,
    "object" | "runtimeFallback"
> & {
    usage: Pick<GenerateObjectWithFallbackResult<ExternalPublishingAiCandidate>["usage"], "inputTokens" | "outputTokens">;
};

type ExternalPublishingAiGenerateObject = (alias: AiModelAlias, params: Parameters<typeof generateObjectWithFallback<ExternalPublishingAiCandidate>>[1]) => Promise<ExternalPublishingAiResult>;

export interface AiExternalPublishingGeneratorContext {
    workspaceId: string;
    profileId: string | null;
    routeName?: string;
    generateObject?: ExternalPublishingAiGenerateObject;
    assertSufficientAiBalance?: typeof assertSufficientAiBalance;
    checkAiRateLimitPg?: typeof checkAiRateLimitPg;
    meterAndCharge?: typeof meterAndCharge;
    validatePackage?: typeof validateExternalPublishingPackage;
}

function stripMarkdown(markdown: string): string {
    return stripExternalPublishingMarkdown(markdown);
}

function wordCount(text: string): number {
    return countExternalPublishingWords(text);
}

function removeMarkdownLinks(markdown: string): string {
    return markdown.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1");
}

function ensureNoLinkBody(candidate: ExternalPublishingAiCandidate, adapter: ExternalPublishingPlatformAdapter): string | null {
    if (!adapter.linkPolicy.noLinkVersionRequired) return candidate.noLinkBodyMarkdown ?? null;
    return removeMarkdownLinks(candidate.noLinkBodyMarkdown || candidate.bodyMarkdown);
}

function normalizeMermaid(mermaid: string): string {
    const trimmed = mermaid.trim().replace(/^```mermaid\s*/i, "").replace(/```$/i, "").trim();
    if (/^(flowchart|graph|sequenceDiagram|journey|mindmap|timeline|classDiagram|stateDiagram)/i.test(trimmed)) return trimmed;
    return `flowchart LR\n  Idea[Reader problem] --> Framework[Useful framework]\n  Framework --> Action[Next action]\n  Action --> Review[Human review]\n%% Candidate diagram notes: ${trimmed.replace(/\n/g, " ").slice(0, 160)}`;
}

function truncateTitles(titles: string[], adapter: ExternalPublishingPlatformAdapter, fallbackTitle: string): string[] {
    const cleaned = titles.map((title) => title.trim()).filter(Boolean);
    const output = (cleaned.length ? cleaned : [fallbackTitle]).map((title) => title.slice(0, adapter.titleGuidance.maxLength));
    return Array.from(new Set(output)).slice(0, 5);
}

function buildPrompt(input: GenerateExternalPublishingPackageInput, adapter: ExternalPublishingPlatformAdapter, targetUrl: string): string {
    return `Create an external publishing candidate for manual publication. Do not emit the final database package shape; emit only fields matching the schema.

Platform adapter:
- Platform label: ${adapter.label}
- Output shapes: ${adapter.outputShapes.join(", ")}
- Title max length: ${adapter.titleGuidance.maxLength}
- Title guidance: ${adapter.titleGuidance.guidance.join(" | ")}
- Body min words: ${adapter.bodyGuidance.minWords}
- Body max words where reasonable: ${adapter.bodyGuidance.maxWords}
- Body guidance: ${adapter.bodyGuidance.guidance.join(" | ")}
- Max links: ${adapter.maxLinks}
- Link density policy: ${adapter.linkPolicy.densityGuidance}
- Preferred link placement: ${adapter.linkPolicy.preferLinkPlacement}
- No-link version required: ${adapter.linkPolicy.noLinkVersionRequired}
- Disclosure notes: ${adapter.disclosureNotes.join(" | ") || "none"}
- Moderation notes: ${adapter.moderationNotes.join(" | ") || "none"}
- Sales-tone red flags: ${adapter.salesToneRedFlags.join(" | ") || "none"}
- Image/diagram policy: ${adapter.imageDiagramPolicy.join(" | ") || "use a useful explanatory visual"}
- Canonical/link guidance: ${adapter.canonicalGuidance.join(" | ") || "only link when useful"}

Opportunity:
- Topic: ${input.opportunity.topic}
- Primary query: ${input.opportunity.primaryQuery || "none"}
- Target persona: ${input.targetPersona || "operators evaluating practical AI workflows"}
- Target URL with UTM: ${targetUrl}
- Score reasons: ${input.opportunity.scoreReasons.join(" | ") || "stored package"}

Evidence pack available:
${JSON.stringify(input.evidence ?? [], null, 2)}

Requirements:
- Produce AT LEAST ${adapter.bodyGuidance.minWords} words in bodyMarkdown. Do not exceed ${adapter.bodyGuidance.maxWords} words where reasonable.
- If you provide bodyPlatformSpecific, it must be the full publish-ready body for ${adapter.label}, not a summary, meta-description, rationale, teaser, or explanation of the package. For article platforms, bodyPlatformSpecific should normally be the complete article and roughly the same length as bodyMarkdown unless you are making a valid full-length platform-native transformation.
- Include markdown headings, concrete examples, a checklist, caveats, and a platform-native angle for ${adapter.label}.
- Include visualPlan.imagePrompt and visualPlan.mermaid. Mermaid must be valid Mermaid syntax, preferably starting with flowchart LR.
- Make evidence-aware claims only. Do not invent unsupported benchmarks, customers, statistics, or guarantees.
- Include links only if allowed by maxLinks and useful to the reader. If no links are allowed, links must be empty and the body must stand alone.
- If a no-link version is required, provide noLinkBodyMarkdown without URLs or markdown links.
- Avoid product pitch tone. Teach something useful before mentioning the owned resource.
- The link plan should explain why any link helps the same reader task; if no link is used, explain the no-link behavior in copyBlocks.

Rich example direction:
- Open with the reader's real problem.
- Add a framework with named steps.
- Give one practical mini-example.
- Add a checklist readers can apply immediately.
- Add caveats about context, evidence, moderation, and when not to automate.
- Close with a non-sales next step or discussion prompt native to ${adapter.label}.`;
}

export class AiExternalPublishingGenerator implements ExternalPublishingStructuredGenerator {
    private readonly routeName: string;
    private readonly generateObject: ExternalPublishingAiGenerateObject;
    private readonly assertBalance: typeof assertSufficientAiBalance;
    private readonly checkRateLimit: typeof checkAiRateLimitPg;
    private readonly charge: typeof meterAndCharge;
    private readonly validate: typeof validateExternalPublishingPackage;

    constructor(private readonly context: AiExternalPublishingGeneratorContext) {
        this.routeName = context.routeName ?? ROUTE_NAME;
        this.generateObject = context.generateObject ?? generateObjectWithFallback;
        this.assertBalance = context.assertSufficientAiBalance ?? assertSufficientAiBalance;
        this.checkRateLimit = context.checkAiRateLimitPg ?? checkAiRateLimitPg;
        this.charge = context.meterAndCharge ?? meterAndCharge;
        this.validate = context.validatePackage ?? validateExternalPublishingPackage;
    }

    async generate(input: GenerateExternalPublishingPackageInput): Promise<GeneratedExternalPublishingPackage> {
        try {
            return await runWithWorkspaceAiConfig(this.context.workspaceId, () => this.generateWithAi(input));
        } catch (error) {
            console.error("[external-publishing] AI package generation failed; using validated deterministic fallback", error);
            return generateDeterministicExternalPackage(input);
        }
    }

    private async generateWithAi(input: GenerateExternalPublishingPackageInput): Promise<GeneratedExternalPublishingPackage> {
        const adapter = input.platformAdapter ?? getExternalPublishingPlatformAdapter(input.platform);
        const targetUrl = appendExternalPublishingUtm(input.opportunity.targetUrl, {
            platform: input.platform,
            campaign: input.campaignSlug,
            content: input.packageSlug,
        });

        await this.assertBalance(this.context.workspaceId);
        const rateLimit = await this.checkRateLimit(this.context.workspaceId, this.routeName, { maxPerWindow: 10, windowSeconds: 60 });
        if (!rateLimit.allowed) throw new Error(`External publishing AI generation rate limit exceeded. Retry in ${rateLimit.retryAfterSeconds}s.`);

        const result = await this.generateObject(MODEL_ALIAS, {
            schema: externalPublishingAiCandidateSchema,
            prompt: buildPrompt(input, adapter, targetUrl),
        });

        await this.meter(result, rateLimit, input, adapter);
        return this.toPackage(result.object, input, adapter, targetUrl);
    }

    private async meter(result: ExternalPublishingAiResult, rateLimit: RateLimitResult, input: GenerateExternalPublishingPackageInput, adapter: ExternalPublishingPlatformAdapter): Promise<MeterResult | null> {
        const modelMetadata = getModelMetadata(MODEL_ALIAS);
        const runtimeModelId = result.runtimeFallback.selectedModelId;
        const successfulAttempt = result.runtimeFallback.attempts.find((attempt) => !attempt.failed);
        const aiMetadata = buildResolvedAiRequestMetadata({
            alias: result.runtimeFallback.selectedAlias,
            metadata: { ...modelMetadata, modelId: runtimeModelId, transport: successfulAttempt?.transport ?? modelMetadata.transport },
            workspaceId: this.context.workspaceId,
            routeName: this.routeName,
            operation: "external_publishing_package",
        });

        return this.charge({
            workspaceId: this.context.workspaceId,
            profileId: this.context.profileId,
            route: this.routeName,
            usage: {
                unitType: "tokens",
                model: runtimeModelId,
                tokensIn: result.usage.inputTokens ?? 0,
                tokensOut: result.usage.outputTokens ?? 0,
            },
            metadata: {
                ai: aiMetadata,
                runtimeFallback: result.runtimeFallback,
                platform: input.platform,
                adapterLabel: adapter.label,
                packageSlug: input.packageSlug,
                rateLimitRemaining: rateLimit.remaining,
            },
        });
    }

    private toPackage(candidate: ExternalPublishingAiCandidate, input: GenerateExternalPublishingPackageInput, adapter: ExternalPublishingPlatformAdapter, targetUrl: string): GeneratedExternalPublishingPackage {
        const titleOptions = truncateTitles(candidate.titleOptions, adapter, input.opportunity.title);
        const bodyMarkdown = stripBrokenOwnedResourceTrailingSentence(candidate.bodyMarkdown.trim());
        const bodyWords = wordCount(bodyMarkdown);
        const minWordWarning = bodyWords < adapter.bodyGuidance.minWords
            ? [`AI output is below ${adapter.label} minimum word guidance (${bodyWords}/${adapter.bodyGuidance.minWords}). Regenerate or expand before publishing.`]
            : [];
        const noLinkBodyMarkdown = ensureNoLinkBody(candidate, adapter);
        const links = adapter.maxLinks > 0 ? candidate.links.slice(0, adapter.maxLinks) : [];
        const evidencePack = candidate.evidencePack.length ? candidate.evidencePack : input.evidence ?? [];
        const validationInput: ExternalPublishingPackageValidationInput = {
            platform: input.platform,
            titleOptions,
            bodyMarkdown,
            noLinkBodyMarkdown,
            links,
            evidencePack,
            targetPersona: input.targetPersona,
            hasNewPlatformNativeAngle: candidate.hasNewPlatformNativeAngle,
            hasActionableChecklist: candidate.hasActionableChecklist,
            hasCredibleCaveats: candidate.hasCredibleCaveats,
            hasUsefulVisualPlan: candidate.hasUsefulVisualPlan && Boolean(candidate.visualPlan.imagePrompt && candidate.visualPlan.mermaid),
            containsUnsupportedClaims: candidate.containsUnsupportedClaims,
            siteUrl: input.siteUrl,
        };
        const rawValidation = this.validate(validationInput);
        const validation: ExternalPublishingValidationResult = minWordWarning.length
            ? { ...rawValidation, valid: false, hardFailures: [...rawValidation.hardFailures, ...minWordWarning] }
            : rawValidation;
        const warnings = [...validation.warnings, ...validation.hardFailures, ...candidate.complianceWarnings];

        return {
            titleOptions,
            bodyMarkdown,
            bodyPlaintext: stripMarkdown(bodyMarkdown),
            bodyPlatformSpecific: selectExternalPublishingPlatformBody({
                platform: input.platform,
                adapter,
                bodyMarkdown,
                bodyPlaintext: stripMarkdown(bodyMarkdown),
                bodyPlatformSpecific: candidate.bodyPlatformSpecific ? stripBrokenOwnedResourceTrailingSentence(candidate.bodyPlatformSpecific.trim()) : null,
            }),
            noLinkBodyMarkdown,
            copyBlocks: {
                ...candidate.copyBlocks,
                adapterGuidance: adapter.bodyGuidance.guidance,
                disclosureNotes: adapter.disclosureNotes,
                moderationNotes: adapter.moderationNotes,
                salesToneRedFlags: adapter.salesToneRedFlags,
                minWordCheck: { words: bodyWords, minWords: adapter.bodyGuidance.minWords, passed: bodyWords >= adapter.bodyGuidance.minWords },
            },
            linkPlan: {
                attribution: buildExternalPublishingAttribution({ platform: input.platform, campaign: input.campaignSlug, content: input.packageSlug }),
                links,
                targetUrl,
                noLinkVersionRequired: adapter.linkPolicy.noLinkVersionRequired,
                policy: adapter.linkPolicy,
            },
            visualPlan: {
                ...candidate.visualPlan,
                mermaid: normalizeMermaid(candidate.visualPlan.mermaid),
                policy: adapter.imageDiagramPolicy,
            },
            evidencePack,
            validation,
            qualityScore: validation.qualityScore,
            usefulnessScore: validation.usefulnessScore,
            backlinkSafetyScore: validation.backlinkSafetyScore,
            complianceWarnings: warnings,
        };
    }
}
