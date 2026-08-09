import type { ExternalPublishingOpportunity } from "./opportunity-miner";
import { appendExternalPublishingUtm, buildExternalPublishingAttribution } from "./attribution";
import { getExternalPublishingPlatformAdapter } from "../platform-adapters";
import type { ExternalPublishingPlatformAdapter } from "../platform-adapters";
import type { ExternalPublicationPlatform } from "../types";
import { validateExternalPublishingPackage, type ExternalPublishingValidationResult } from "../validators";

export interface GenerateExternalPublishingPackageInput {
    workspaceId: string;
    templateId?: string | null;
    platform: ExternalPublicationPlatform;
    campaignSlug: string;
    packageSlug: string;
    opportunity: ExternalPublishingOpportunity;
    targetPersona?: string | null;
    evidence?: Array<{ title?: string; url?: string; excerpt?: string }>;
    siteUrl?: string | null;
    platformAdapter?: ExternalPublishingPlatformAdapter;
}

export interface GeneratedExternalPublishingPackage {
    titleOptions: string[];
    bodyMarkdown: string;
    bodyPlaintext: string;
    bodyPlatformSpecific: string;
    noLinkBodyMarkdown: string | null;
    copyBlocks: Record<string, unknown>;
    linkPlan: Record<string, unknown>;
    visualPlan: Record<string, unknown>;
    evidencePack: Array<{ title?: string; url?: string; excerpt?: string }>;
    validation: ExternalPublishingValidationResult;
    qualityScore: number;
    usefulnessScore: number;
    backlinkSafetyScore: number;
    complianceWarnings: string[];
}

export interface ExternalPublishingStructuredGenerator {
    generate(input: GenerateExternalPublishingPackageInput): Promise<GeneratedExternalPublishingPackage>;
}

function stripMarkdown(markdown: string): string {
    return markdown
        .replace(/```[\s\S]*?```/g, "")
        .replace(/[#*_>`\[\]]/g, "")
        .replace(/\((https?:\/\/[^)]+)\)/g, " $1")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function buildNoLinkVersion(body: string, targetUrl: string): string {
    const escapedUrl = targetUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return body.replace(new RegExp(`\\s*\\[[^\]]+\\]\\(${escapedUrl}\\)`, "g"), "");
}

export async function generateDeterministicExternalPackage(input: GenerateExternalPublishingPackageInput): Promise<GeneratedExternalPublishingPackage> {
    const adapter = input.platformAdapter ?? getExternalPublishingPlatformAdapter(input.platform);
    const attribution = buildExternalPublishingAttribution({
        platform: input.platform,
        campaign: input.campaignSlug,
        content: input.packageSlug,
    });
    const targetUrl = appendExternalPublishingUtm(input.opportunity.targetUrl, {
        platform: input.platform,
        campaign: input.campaignSlug,
        content: input.packageSlug,
    });
    const title = input.opportunity.title.slice(0, adapter.titleGuidance.maxLength);
    const linkAnchor = input.opportunity.primaryQuery || input.opportunity.topic;
    const evidence = input.evidence?.length ? input.evidence : [{
        title: "Source signal snapshot",
        excerpt: input.opportunity.scoreReasons.join("; "),
    }];
    const bodyMarkdown = [
        `# ${title}`,
        "",
        `A recurring problem for ${input.targetPersona || "operators"} is turning scattered growth signals into a useful next action instead of another generic content idea.`,
        "",
        `The signal behind this package is **${input.opportunity.topic}**. It scored ${input.opportunity.score}/100 because ${input.opportunity.scoreReasons.join(", ") || "it has relevant demand and source provenance"}.`,
        "",
        "## A practical framework",
        "",
        "1. Start with the reader's actual question, not the product narrative.",
        "2. Share the smallest checklist that helps them make progress today.",
        "3. Add evidence or caveats where the advice could otherwise sound absolute.",
        "4. Link only when the destination helps the reader continue the same task.",
        "",
        "## Example application",
        "",
        `If someone is researching ${input.opportunity.primaryQuery || input.opportunity.topic}, the useful next step is to compare the workflow they have now with a governed alternative: intake, prioritization, review, and measurable follow-through.`,
        "",
        adapter.maxLinks > 0 ? `For the detailed reference, use this contextual resource: [${linkAnchor}](${targetUrl}).` : "This version intentionally avoids links so the advice stands on its own.",
        "",
        "## Caveats",
        "",
        "This is a starting framework, not a universal prescription. Validate it against your audience, community rules, and the evidence available for your specific use case.",
        "",
        input.platform === "reddit" ? "What would you change in this checklist based on your own experience?" : "Use the checklist as a review prompt before turning the idea into a campaign.",
    ].join("\n");
    const noLinkBodyMarkdown = adapter.linkPolicy.noLinkVersionRequired ? buildNoLinkVersion(bodyMarkdown, targetUrl) : null;
    const validation = validateExternalPublishingPackage({
        platform: input.platform,
        titleOptions: [title, `${input.opportunity.topic}: a practical checklist`],
        bodyMarkdown,
        noLinkBodyMarkdown,
        links: adapter.maxLinks > 0 ? [{ url: targetUrl, anchorText: linkAnchor, rationale: "The destination continues the same reader task with a relevant owned resource." }] : [],
        evidencePack: evidence,
        targetPersona: input.targetPersona,
        hasNewPlatformNativeAngle: true,
        hasActionableChecklist: true,
        hasCredibleCaveats: true,
        hasUsefulVisualPlan: true,
        containsUnsupportedClaims: false,
        siteUrl: input.siteUrl,
    });
    const warnings = [...validation.warnings, ...validation.hardFailures];

    return {
        titleOptions: [title, `${input.opportunity.topic}: a practical checklist`],
        bodyMarkdown,
        bodyPlaintext: stripMarkdown(bodyMarkdown),
        bodyPlatformSpecific: input.platform === "reddit" || input.platform === "linkedin" ? stripMarkdown(bodyMarkdown) : bodyMarkdown,
        noLinkBodyMarkdown,
        copyBlocks: {
            checklist: ["reader problem", "framework", "example", "caveats", "non-sales next step"],
            adapterGuidance: adapter.bodyGuidance.guidance,
            disclosureNotes: adapter.disclosureNotes,
            moderationNotes: adapter.moderationNotes,
            salesToneRedFlags: adapter.salesToneRedFlags,
        },
        linkPlan: {
            attribution,
            links: adapter.maxLinks > 0 ? [{ url: targetUrl, anchorText: linkAnchor, rationale: "The link supports the reader's immediate next step." }] : [],
            noLinkVersionRequired: adapter.linkPolicy.noLinkVersionRequired,
        },
        visualPlan: {
            imagePrompt: `Create a clean editorial diagram for ${input.opportunity.topic}: signal → checklist → governed action.`,
            mermaid: "flowchart LR\n  Signal[Growth signal] --> Checklist[Useful checklist]\n  Checklist --> Action[Governed next action]",
            policy: adapter.imageDiagramPolicy,
        },
        evidencePack: evidence,
        validation,
        qualityScore: validation.qualityScore,
        usefulnessScore: validation.usefulnessScore,
        backlinkSafetyScore: validation.backlinkSafetyScore,
        complianceWarnings: warnings,
    };
}

export async function generateStructuredExternalPackage(
    input: GenerateExternalPublishingPackageInput,
    generator?: ExternalPublishingStructuredGenerator,
): Promise<GeneratedExternalPublishingPackage> {
    if (generator) return generator.generate(input);
    return generateDeterministicExternalPackage(input);
}
