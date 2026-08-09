import test from "node:test";
import assert from "node:assert/strict";
import { EXTERNAL_PUBLISHING_PLATFORM_ADAPTERS, getExternalPublishingPlatformAdapter } from "./platform-adapters";
import { appendExternalPublishingUtm, buildExternalPublishingAttribution, buildExternalPublishingAttributionKey } from "./lib/attribution";
import { validateExternalPublishingBacklinks } from "./lib/backlink-policy";
import { scoreExternalPublishingUsefulness } from "./lib/usefulness-score";
import { scoreGscOpportunity, scoreSeoOpportunity } from "./lib/opportunity-miner";
import { validateExternalPublishingPackage } from "./validators";
import { buildExternalPublicationBundleMarkdown } from "./lib/export-bundle";
import { summarizeExternalPublishingAttribution } from "./lib/performance-attribution";
import { buildExternalPublishingWorkflowEventInput } from "./lib/workflow-integration";
import { BUSINESS_SPINE_WORKFLOW_EVENTS, buildWorkflowIdempotencyKey, getWorkflowEventDefinition } from "@/features/business-spine/workflow-events";
import { parseExternalPublishingManualPublicationUrl } from "./lib/manual-publication-url";
import { mergeExternalPublishingEvidence } from "./lib/source-evidence";
import { normalizeExternalPublicationPlatformProfile, buildAdapterWithPlatformProfile } from "./lib/platform-profiles";
import { buildExternalPublicationAssetManifestFromVisualPlan } from "./lib/asset-manifests";
import { buildExternalPublishingConversionFeedback } from "./lib/conversion-feedback";
import { buildExternalPublishingGrowthLoopReport } from "./lib/growth-loop-report";
import { AiExternalPublishingGenerator } from "./lib/ai-generator";
import { externalPublishingVisualFilename, extractExternalPublishingVisualFromAsset, extractExternalPublishingVisualsFromPlan } from "./lib/visual-rendering";

const baseOpportunity = {
    id: "package:pkg-123",
    workspaceId: "workspace-1",
    templateId: "template-1",
    locale: "en" as const,
    sourceType: "content_item" as const,
    sourceContentId: "content-1",
    sourceSeoPlanId: null,
    sourceSeoOpportunityId: null,
    topic: "AI intake checklist",
    primaryQuery: "AI intake workflow",
    title: "AI intake checklist",
    targetUrl: "https://isystem.ai/services",
    targetSlug: "services",
    score: 82,
    scoreReasons: ["strong search intent", "source-backed buyer question"],
    provenance: { packageId: "pkg-123" },
};

function words(count: number) {
    return Array.from({ length: count }, (_, index) => `word${index + 1}`).join(" ");
}

function markdownSection(markdown: string, heading: string) {
    const start = markdown.indexOf(heading);
    assert.notEqual(start, -1, `Missing markdown heading: ${heading}`);
    const next = markdown.indexOf("\n## ", start + heading.length);
    return markdown.slice(start, next === -1 ? undefined : next);
}

test("defines required platform adapter rules", () => {
    assert.equal(getExternalPublishingPlatformAdapter("medium").maxLinks, 3);
    assert.equal(getExternalPublishingPlatformAdapter("reddit").linkPolicy.noLinkVersionRequired, true);
    assert.equal(getExternalPublishingPlatformAdapter("linkedin").linkPolicy.preferLinkPlacement, "comments");
    assert.equal(getExternalPublishingPlatformAdapter("devto").outputShapes.includes("markdown_article"), true);
    assert.equal(getExternalPublishingPlatformAdapter("generic_forum").linkPolicy.noLinkVersionRequired, true);
    assert.equal(Object.keys(EXTERNAL_PUBLISHING_PLATFORM_ADAPTERS).length, 8);
});

test("builds deterministic UTM attribution and keys", () => {
    const attribution = buildExternalPublishingAttribution({
        platform: "medium",
        campaign: "Q3 AI Growth Plan!",
        content: "Package 123",
    });
    assert.deepEqual(attribution, {
        utm_source: "medium",
        utm_medium: "external_publishing",
        utm_campaign: "q3-ai-growth-plan",
        utm_content: "package-123",
    });
    assert.equal(
        appendExternalPublishingUtm("https://isystem.ai/services?existing=1", { platform: "medium", campaign: "Q3 AI Growth Plan!", content: "Package 123" }),
        "https://isystem.ai/services?existing=1&utm_source=medium&utm_medium=external_publishing&utm_campaign=q3-ai-growth-plan&utm_content=package-123",
    );
    assert.equal(buildExternalPublishingAttributionKey({ platform: "medium", campaign: "Q3", content: "P1" }), "medium:external_publishing:q3:p1");
});

test("backlink policy blocks link stuffing and unsafe external targets", () => {
    const result = validateExternalPublishingBacklinks({
        platform: "reddit",
        siteUrl: "https://isystem.ai",
        links: [
            { url: "https://isystem.ai/services", anchorText: "AI automation AI automation", rationale: "Useful." },
            { url: "https://example.com", anchorText: "external", rationale: "Useful." },
        ],
    });
    assert.equal(result.allowed, false);
    assert.ok(result.hardFailures.some((failure) => failure.includes("at most 1")));
    assert.ok(result.hardFailures.some((failure) => failure.includes("keyword-stuffed")));
    assert.ok(result.hardFailures.some((failure) => failure.includes("outside")));
});

test("usefulness scoring hard-fails Reddit without no-link version", () => {
    const result = scoreExternalPublishingUsefulness({
        platform: "reddit",
        title: "A practical checklist for AI intake",
        bodyMarkdown: "This checklist gives steps, examples, caveats, and asks for critique. 99% of teams should verify evidence before claiming stats.",
        evidenceCount: 0,
        linkCandidates: [{ url: "https://isystem.ai/services", anchorText: "AI intake checklist", rationale: "Useful next step." }],
        hasNewPlatformNativeAngle: true,
        hasActionableChecklist: true,
        hasCredibleCaveats: true,
        hasUsefulVisualPlan: false,
        containsUnsupportedClaims: false,
        siteUrl: "https://isystem.ai",
    });
    assert.ok(result.hardFailures.some((failure) => failure.includes("requires a no-link version")));
    assert.ok(result.hardFailures.some((failure) => failure.includes("evidence pack")));
    assert.ok(result.usefulnessScore < 70);
});

test("opportunity scoring rewards striking-distance search demand and dedupe-compatible SEO signals", () => {
    const gsc = scoreGscOpportunity({ impressions: 900, clicks: 4, ctr: 0.01, position: 8 });
    assert.ok(gsc.score >= 85);
    assert.ok(gsc.reasons.includes("striking-distance ranking"));

    const seo = scoreSeoOpportunity({ priorityScore: 80, analyticsScore: 60, strategicImportanceScore: 90 });
    assert.equal(seo.score, 79);
});

test("package validation enforces hard fails and backlink safety threshold", () => {
    const result = validateExternalPublishingPackage({
        platform: "generic_forum",
        titleOptions: ["Helpful checklist"],
        bodyMarkdown: "A short helpful answer with checklist steps and caveats. Use this to compare options and ask for critique.",
        noLinkBodyMarkdown: null,
        links: [{ url: "https://isystem.ai/services", anchorText: "click here", rationale: "Useful." }],
        evidencePack: [{ title: "Signal", excerpt: "Observed source." }],
        hasNewPlatformNativeAngle: true,
        hasActionableChecklist: true,
        hasCredibleCaveats: true,
        hasUsefulVisualPlan: false,
        containsUnsupportedClaims: false,
        siteUrl: "https://isystem.ai",
    });
    assert.equal(result.valid, false);
    assert.ok(result.hardFailures.some((failure) => failure.includes("requires a no-link version")));
    assert.ok(result.warnings.some((warning) => warning.includes("generic anchor")));
});

test("bundle export includes manual-only copy, evidence, link plans, compliance notes, and asset references", () => {
    const markdown = buildExternalPublicationBundleMarkdown({
        id: "pkg-123",
        topic: "AI intake checklist",
        platform: "medium",
        status: "generated",
        target_url: "https://isystem.ai/services?utm_source=medium&utm_medium=external_publishing&utm_campaign=q3&utm_content=ai-intake",
        utm_source: "medium",
        utm_medium: "external_publishing",
        utm_campaign: "q3",
        utm_content: "ai-intake",
        title_options: ["A practical AI intake checklist", "What to ask before automating"],
        body_markdown: "Read the [guide](https://isystem.ai/services).",
        body_plaintext: "Read the guide.",
        body_platform_specific: "Platform copy",
        visual_plan: { hero: "workflow diagram" },
        evidence_pack: [{ title: "GSC signal", url: "https://example.com", excerpt: "Observed demand" }],
        link_plan: { canonical: "https://isystem.ai/services" },
        compliance_warnings: ["Disclose owned link."],
        validation_result: { valid: true },
    }, [{
        asset_type: "diagram_mermaid",
        title: "Workflow diagram",
        description: "Mermaid source",
        markdown_embed: "```mermaid\ngraph TD\n```",
        public_url: null,
        storage_path: null,
        alt_text: "Automation workflow diagram",
        metadata: { source: "visual_plan" },
    }]);

    assert.match(markdown, /Manual publishing only/i);
    assert.match(markdown, /## Title options/);
    assert.match(markdown, /## Platform copy/);
    assert.match(markdown, /## No-link version/);
    const noLinkSection = markdownSection(markdown, "## No-link version");
    assert.doesNotMatch(noLinkSection, /\[guide\]\(https:\/\/isystem\.ai\/services\)/);
    assert.match(markdown, /## Visual plan/);
    assert.match(markdown, /## Evidence pack/);
    assert.match(markdown, /## Link\/UTM plan/);
    assert.match(markdown, /## Compliance notes/);
    assert.match(markdown, /## Manual checklist/);
    assert.match(markdown, /## Asset references/);
    assert.match(markdown, /Workflow diagram/);
});

test("bundle export uses full Medium article as platform copy when platform-specific candidate is short metadata", () => {
    const longArticle = [
        "# AI intake checklist for operators",
        "",
        "Platform engineers need a complete article here, not a teaser or package explanation.",
        "",
        `${words(930)}`,
        "",
        "For the implementation details, read the [AI intake workflow](https://isystem.ai/services?utm_source=medium&utm_medium=external_publishing&utm_campaign=q3&utm_content=ai-intake).",
    ].join("\n");
    const shortMeta = "This article was written specifically for platform engineers and AI operators on Medium.";

    const markdown = buildExternalPublicationBundleMarkdown({
        id: "pkg-123",
        topic: "AI intake checklist",
        platform: "medium",
        status: "generated",
        target_url: "https://isystem.ai/services?utm_source=medium&utm_medium=external_publishing&utm_campaign=q3&utm_content=ai-intake",
        utm_source: "medium",
        utm_medium: "external_publishing",
        utm_campaign: "q3",
        utm_content: "ai-intake",
        title_options: ["AI intake checklist for operators"],
        body_markdown: longArticle,
        body_plaintext: longArticle,
        body_platform_specific: shortMeta,
        visual_plan: { hero: "workflow diagram" },
        evidence_pack: [{ title: "GSC signal", excerpt: "Observed demand" }],
        link_plan: { links: [{ url: "https://isystem.ai/services", anchorText: "AI intake workflow" }] },
        compliance_warnings: [],
        validation_result: { valid: true },
    });

    const platformSection = markdownSection(markdown, "## Platform copy");
    const noLinkSection = markdownSection(markdown, "## No-link version");
    assert.match(platformSection, /Platform engineers need a complete article here/);
    assert.match(platformSection, /\[AI intake workflow\]\(https:\/\/isystem\.ai\/services\?utm_source=medium/);
    assert.doesNotMatch(platformSection, new RegExp(shortMeta));
    assert.match(noLinkSection, /AI intake workflow/);
    assert.doesNotMatch(noLinkSection, /https:\/\/isystem\.ai\/services/);
});

test("source intelligence evidence is preferred and deduplicated before package fallback evidence", () => {
    const merged = mergeExternalPublishingEvidence([
        { title: "Canonical source", url: "https://example.com/source", excerpt: "Verified", source: "source_intelligence" },
    ], [
        { title: "Canonical source", url: "https://example.com/source", excerpt: "Duplicate fallback", source: "package" },
        { title: "Package fallback", url: "https://example.com/fallback", excerpt: "Fallback", source: "package" },
    ]);

    assert.equal(merged.length, 2);
    assert.equal(merged[0].source, "source_intelligence");
    assert.equal(merged[1].title, "Package fallback");
});

test("platform profile normalization extends adapter rules without enabling automation", () => {
    const normalized = normalizeExternalPublicationPlatformProfile({
        platform: "reddit",
        defaultDisclosure: "I work on the product linked here.",
        blockedCommunities: [" r/startups ", "r/startups"],
        toneRules: { avoid: "sales pitch" },
    });
    const adapter = buildAdapterWithPlatformProfile(getExternalPublishingPlatformAdapter("reddit"), normalized);

    assert.deepEqual(normalized.blockedCommunities, ["r/startups"]);
    assert.equal(adapter.disclosureNotes[0], "I work on the product linked here.");
    assert.ok(adapter.moderationNotes.some((note) => note.includes("r/startups")));
    assert.ok(adapter.salesToneRedFlags.some((note) => note.includes("sales pitch")));
});

test("asset manifest stores visual-plan prompts and Mermaid as manifest-only metadata", () => {
    const manifest = buildExternalPublicationAssetManifestFromVisualPlan({
        id: "pkg-123",
        topic: "AI intake checklist",
        platform: "linkedin",
        visual_plan: { imagePrompt: "Draw the workflow", mermaid: "flowchart LR\nA-->B", altText: "Workflow" },
        evidence_pack: [{ title: "Evidence" }],
    });

    assert.equal(manifest.asset_type, "diagram_mermaid");
    assert.match(manifest.markdown_embed ?? "", /```mermaid/);
    assert.equal(manifest.metadata.generationStatus, "manifest_only");
    assert.equal((manifest.metadata.storage as { publicUrl: null }).publicUrl, null);
});

test("visual rendering extracts Mermaid, future chart specs, prompt fallback, and export filename", () => {
    const visuals = extractExternalPublishingVisualsFromPlan({
        title: "AI intake operating model",
        mermaid: "```mermaid\nflowchart LR\n  Intake --> Review\n```",
        imagePrompt: "Editorial workflow illustration",
        charts: [{
            title: "Review checkpoints",
            chartType: "bar",
            unit: "%",
            data: [
                { label: "Intake", value: 45, note: "First pass" },
                { label: "Review", value: "80" },
            ],
        }],
        altText: "AI intake visual",
    }, {
        topic: "AI intake checklist",
        platform: "medium",
        utm_content: "medium-ai-intake",
    } as never);

    assert.equal(visuals.length, 3);
    assert.equal(visuals[0].kind, "mermaid");
    assert.equal(visuals[0].source, "flowchart LR\n  Intake --> Review");
    assert.equal(visuals[1].kind, "chart");
    assert.equal(visuals[1].data?.[1].value, 80);
    assert.equal(visuals[2].kind, "prompt");
    assert.equal(
        externalPublishingVisualFilename({ platform: "medium", utm_content: "medium-ai-intake", target_slug: null, id: "pkg-123", visualTitle: visuals[0].title } as never),
        "external-publishing-medium-medium-ai-intake-ai-intake-operating-model-visual.png",
    );
});

test("visual rendering extracts renderable assets and gracefully ignores empty manifests", () => {
    const visual = extractExternalPublishingVisualFromAsset({
        id: "asset-1",
        title: "Workflow diagram",
        description: "Stored source",
        markdown_embed: "```mermaid\nflowchart LR\nA-->B\n```",
        alt_text: "Workflow",
        metadata: {},
    } as never);

    assert.equal(visual?.kind, "mermaid");
    assert.match(visual?.source ?? "", /^flowchart LR/);
    assert.equal(extractExternalPublishingVisualFromAsset({ id: "asset-2", title: "Empty", metadata: {}, markdown_embed: null, alt_text: null, description: null } as never), null);
});

test("AI generator builds validated rich package with min words, visual plan, and propagated scores", async () => {
    const adapter = getExternalPublishingPlatformAdapter("medium");
    let validationCalled = false;
    const generator = new AiExternalPublishingGenerator({
        workspaceId: "workspace-1",
        profileId: "profile-1",
        generateObject: async () => ({
            object: {
                titleOptions: ["A practical AI intake checklist", "What to ask before automating"],
                bodyMarkdown: `# A practical AI intake checklist\n\n${words(adapter.bodyGuidance.minWords + 40)}\n\n## Checklist\n\n- Confirm ownership\n- Add caveats`,
                bodyPlatformSpecific: `A practical AI intake checklist\n\n${words(adapter.bodyGuidance.minWords + 20)}`,
                noLinkBodyMarkdown: null,
                copyBlocks: { checklist: ["Confirm ownership", "Add caveats"] },
                links: [{ url: "https://isystem.ai/services", anchorText: "AI intake workflow", rationale: "Continues the same reader task." }],
                visualPlan: {
                    imagePrompt: "Editorial diagram showing intake, review, and governed AI action.",
                    mermaid: "flowchart LR\n  Intake[AI intake] --> Review[Human review]\n  Review --> Action[Governed action]",
                    altText: "AI intake workflow diagram",
                    notes: [],
                },
                evidencePack: [{ title: "Search signal", url: "https://example.com/source", excerpt: "Observed buyer question." }],
                hasNewPlatformNativeAngle: true,
                hasActionableChecklist: true,
                hasCredibleCaveats: true,
                hasUsefulVisualPlan: true,
                containsUnsupportedClaims: false,
                complianceWarnings: ["Keep claims evidence-aware."],
            },
            usage: { inputTokens: 1200, outputTokens: 2400 },
            runtimeFallback: { selectedAlias: "text.writer", selectedModelId: "gemini-test", attempts: [] },
        }),
        assertSufficientAiBalance: async () => undefined,
        checkAiRateLimitPg: async () => ({ allowed: true, remaining: 4, retryAfterSeconds: 0 }),
        meterAndCharge: async () => null,
        validatePackage: (input) => {
            validationCalled = true;
            assert.ok(input.bodyMarkdown);
            assert.equal(input.bodyMarkdown.split(/\s+/).length >= adapter.bodyGuidance.minWords, true);
            return { valid: true, platform: "medium", qualityScore: 91, usefulnessScore: 88, backlinkSafetyScore: 96, warnings: ["review disclosure"], hardFailures: [], adapterNotes: { maxLinks: 3, noLinkVersionRequired: false, canonicalGuidance: [], moderationNotes: [] } };
        },
    });

    const generated = await generator.generate({
        workspaceId: "workspace-1",
        templateId: "template-1",
        platform: "medium",
        platformAdapter: adapter,
        campaignSlug: "q3",
        packageSlug: "ai-intake",
        opportunity: baseOpportunity,
        evidence: [{ title: "Search signal", url: "https://example.com/source", excerpt: "Observed buyer question." }],
        siteUrl: "https://isystem.ai",
        targetPersona: "agency operators",
    });

    assert.equal(validationCalled, true);
    assert.equal(generated.bodyPlaintext.split(/\s+/).length >= adapter.bodyGuidance.minWords, true);
    assert.match(String(generated.visualPlan.imagePrompt), /diagram/i);
    assert.match(String(generated.visualPlan.mermaid), /^flowchart\s+LR/m);
    assert.equal(generated.qualityScore, 91);
    assert.equal(generated.usefulnessScore, 88);
    assert.equal(generated.backlinkSafetyScore, 96);
    assert.deepEqual(generated.complianceWarnings, ["review disclosure", "Keep claims evidence-aware."]);
});

test("AI generator ignores short Medium platform-specific metadata and keeps full linked article as platform body", async () => {
    const adapter = getExternalPublishingPlatformAdapter("medium");
    const targetUrl = "https://isystem.ai/services?utm_source=medium&utm_medium=external_publishing&utm_campaign=q3&utm_content=ai-intake";
    const bodyMarkdown = [
        "# AI intake checklist for platform teams",
        "",
        "This is the complete Medium article that should remain publish-ready in the platform body.",
        "",
        words(adapter.bodyGuidance.minWords + 30),
        "",
        `For the detailed implementation guide, read the [AI intake workflow](${targetUrl}).`,
    ].join("\n");
    const shortMeta = "This article was written specifically for platform engineers and AI operators on Medium.";
    const generator = new AiExternalPublishingGenerator({
        workspaceId: "workspace-1",
        profileId: "profile-1",
        generateObject: async () => ({
            object: {
                titleOptions: ["AI intake checklist for platform teams"],
                bodyMarkdown,
                bodyPlatformSpecific: shortMeta,
                noLinkBodyMarkdown: null,
                copyBlocks: {},
                links: [{ url: targetUrl, anchorText: "AI intake workflow", rationale: "Continues the same implementation task." }],
                visualPlan: { imagePrompt: "Diagram", mermaid: "flowchart LR\nA-->B", notes: [] },
                evidencePack: [{ title: "Search signal", excerpt: "Observed buyer question." }],
                hasNewPlatformNativeAngle: true,
                hasActionableChecklist: true,
                hasCredibleCaveats: true,
                hasUsefulVisualPlan: true,
                containsUnsupportedClaims: false,
                complianceWarnings: [],
            },
            usage: { inputTokens: 1200, outputTokens: 2400 },
            runtimeFallback: { selectedAlias: "text.writer", selectedModelId: "gemini-test", attempts: [] },
        }),
        assertSufficientAiBalance: async () => undefined,
        checkAiRateLimitPg: async () => ({ allowed: true, remaining: 4, retryAfterSeconds: 0 }),
        meterAndCharge: async () => null,
        validatePackage: () => ({ valid: true, platform: "medium", qualityScore: 91, usefulnessScore: 88, backlinkSafetyScore: 96, warnings: [], hardFailures: [], adapterNotes: { maxLinks: 3, noLinkVersionRequired: false, canonicalGuidance: [], moderationNotes: [] } }),
    });

    const generated = await generator.generate({
        workspaceId: "workspace-1",
        templateId: "template-1",
        platform: "medium",
        platformAdapter: adapter,
        campaignSlug: "q3",
        packageSlug: "ai-intake",
        opportunity: baseOpportunity,
        evidence: [{ title: "Search signal", excerpt: "Observed buyer question." }],
        siteUrl: "https://isystem.ai",
        targetPersona: "platform teams",
    });

    assert.equal(generated.bodyPlatformSpecific, bodyMarkdown);
    assert.notEqual(generated.bodyPlatformSpecific, shortMeta);
    assert.match(generated.bodyPlatformSpecific, /\[AI intake workflow\]\(https:\/\/isystem\.ai\/services\?utm_source=medium/);
});

test("AI generator creates no-link version for platforms that require one", async () => {
    const adapter = getExternalPublishingPlatformAdapter("reddit");
    const generator = new AiExternalPublishingGenerator({
        workspaceId: "workspace-1",
        profileId: "profile-1",
        generateObject: async () => ({
            object: {
                titleOptions: ["How would you review this AI intake checklist?"],
                bodyMarkdown: `# AI intake checklist\n\n${words(adapter.bodyGuidance.minWords + 20)}\n\nRead [the reference](https://isystem.ai/services?utm_source=reddit&utm_medium=external_publishing&utm_campaign=q3&utm_content=ai-intake).`,
                bodyPlatformSpecific: `${words(adapter.bodyGuidance.minWords + 20)}`,
                noLinkBodyMarkdown: null,
                copyBlocks: { discussionPrompt: "What would you change?" },
                links: [{ url: "https://isystem.ai/services?utm_source=reddit&utm_medium=external_publishing&utm_campaign=q3&utm_content=ai-intake", anchorText: "the reference", rationale: "Optional follow-up reference." }],
                visualPlan: { imagePrompt: "Diagram", mermaid: "flowchart LR\nA-->B", notes: [] },
                evidencePack: [{ title: "Forum signal", excerpt: "Repeated workflow question." }],
                hasNewPlatformNativeAngle: true,
                hasActionableChecklist: true,
                hasCredibleCaveats: true,
                hasUsefulVisualPlan: true,
                containsUnsupportedClaims: false,
                complianceWarnings: [],
            },
            usage: { inputTokens: 300, outputTokens: 700 },
            runtimeFallback: { selectedAlias: "text.writer", selectedModelId: "gemini-test", attempts: [] },
        }),
        assertSufficientAiBalance: async () => undefined,
        checkAiRateLimitPg: async () => ({ allowed: true, remaining: 2, retryAfterSeconds: 0 }),
        meterAndCharge: async () => null,
    });

    const generated = await generator.generate({
        workspaceId: "workspace-1",
        platform: "reddit",
        platformAdapter: adapter,
        campaignSlug: "q3",
        packageSlug: "ai-intake",
        opportunity: baseOpportunity,
        siteUrl: "https://isystem.ai",
    });

    assert.ok(generated.noLinkBodyMarkdown);
    assert.doesNotMatch(generated.noLinkBodyMarkdown ?? "", /https:\/\/isystem\.ai/);
    assert.equal((generated.linkPlan as { noLinkVersionRequired: boolean }).noLinkVersionRequired, true);
});

test("conversion feedback creates idempotent conversion opportunity payloads", () => {
    const feedback = buildExternalPublishingConversionFeedback({
        id: "pkg-123",
        workspace_id: "workspace-1",
        platform: "medium",
        topic: "AI intake checklist",
        target_url: "https://isystem.ai/services",
        manual_published_url: "https://medium.com/post",
    } as never, {
        packageId: "pkg-123",
        totalEvents: 8,
        utmMatchedEvents: 5,
        referrerMatchedEvents: 3,
        pageViews: 5,
        ctaClicks: 2,
        conversions: 1,
        lastSeenAt: "2026-06-01T10:00:00.000Z",
        topReferrers: [],
        staleNoTraffic: false,
    }, "2026-06-02T10:00:00.000Z");

    assert.equal(feedback.opportunity?.signal_key, "conversion_external_publishing_winner:pkg-123");
    assert.equal(feedback.opportunity?.category, "conversion");
    assert.equal(feedback.eventPayload?.conversions, 1);
});

test("growth-loop report connects signal, package, URL, traffic, conversion, and follow-up", () => {
    const rows = buildExternalPublishingGrowthLoopReport({
        packages: [{
            id: "pkg-123",
            source_type: "content_item",
            source_content_id: "content-1",
            source_seo_plan_id: null,
            source_seo_opportunity_id: null,
            target_slug: "ai-intake",
            primary_query: "ai intake",
            topic: "AI intake checklist",
            platform: "linkedin",
            status: "published_manual",
            manual_published_url: "https://linkedin.com/posts/1",
        } as never],
        performanceByPackageId: {
            "pkg-123": {
                packageId: "pkg-123",
                totalEvents: 4,
                utmMatchedEvents: 4,
                referrerMatchedEvents: 0,
                pageViews: 3,
                ctaClicks: 1,
                conversions: 1,
                lastSeenAt: "2026-06-01T10:00:00.000Z",
                topReferrers: [],
                staleNoTraffic: false,
            },
        },
        recentEvents: [{ package_id: "pkg-123", event_type: "analytics_attributed", occurred_at: "2026-06-02T10:00:00.000Z", payload: { signalKey: "conversion_external_publishing_winner:pkg-123" } } as never],
    });

    assert.equal(rows[0].sourceEntity, "content-1");
    assert.equal(rows[0].totalTraffic, 4);
    assert.equal(rows[0].conversions, 1);
    assert.match(rows[0].latestFollowUp ?? "", /conversion_external_publishing_winner/);
});

test("analytics attribution aggregates UTM and manual host traffic without counting unrelated events", () => {
    const summary = summarizeExternalPublishingAttribution({
        packageId: "pkg-123",
        utmSource: "medium",
        utmMedium: "external_publishing",
        utmCampaign: "q3",
        utmContent: "ai-intake",
        manualPublishedUrl: "https://medium.com/@isystem/post",
        events: [
            { event_type: "page_view", event_name: "page_view", created_at: "2026-06-01T10:00:00.000Z", utm_source: "medium", utm_medium: "external_publishing", utm_campaign: "q3", metadata: { utm_content: "ai-intake" }, referrer: null },
            { event_type: "cta_click", event_name: "book_demo", created_at: "2026-06-01T10:05:00.000Z", utm_source: "medium", utm_medium: "external_publishing", utm_campaign: "q3", metadata: { utm_content: "ai-intake" }, referrer: "https://medium.com/@isystem/post" },
            { event_type: "page_view", event_name: "page_view", created_at: "2026-06-01T10:10:00.000Z", utm_source: null, utm_medium: null, utm_campaign: null, metadata: {}, referrer: "https://medium.com/@isystem/post" },
            { event_type: "page_view", event_name: "page_view", created_at: "2026-06-01T10:15:00.000Z", utm_source: "linkedin", utm_medium: "social", utm_campaign: "other", metadata: {}, referrer: null },
        ],
    });

    assert.equal(summary.totalEvents, 3);
    assert.equal(summary.utmMatchedEvents, 2);
    assert.equal(summary.referrerMatchedEvents, 2);
    assert.equal(summary.pageViews, 2);
    assert.equal(summary.ctaClicks, 1);
    assert.equal(summary.lastSeenAt, "2026-06-01T10:10:00.000Z");
    assert.deepEqual(summary.topReferrers, [{ host: "medium.com", count: 2 }]);
});

test("manual publication URL validation accepts only absolute HTTP(S) URLs", () => {
    assert.equal(parseExternalPublishingManualPublicationUrl("https://medium.com/@isystem/post"), "https://medium.com/@isystem/post");
    assert.throws(() => parseExternalPublishingManualPublicationUrl("javascript:alert(1)"), /http or https/);
    assert.throws(() => parseExternalPublishingManualPublicationUrl("medium.com/@isystem/post"), /valid absolute HTTP\(S\) URL/);
});

test("external publishing workflow events are catalogued with stable idempotency inputs", () => {
    assert.equal(getWorkflowEventDefinition(BUSINESS_SPINE_WORKFLOW_EVENTS.EXTERNAL_PUBLISHING_READY_FOR_REVIEW)?.sourceModule, "external-publishing");
    assert.equal(getWorkflowEventDefinition(BUSINESS_SPINE_WORKFLOW_EVENTS.EXTERNAL_PUBLISHING_EXPORTED)?.sourceModule, "external-publishing");
    assert.equal(getWorkflowEventDefinition(BUSINESS_SPINE_WORKFLOW_EVENTS.EXTERNAL_PUBLISHING_PUBLISHED_MANUAL)?.sourceModule, "external-publishing");
    assert.equal(getWorkflowEventDefinition(BUSINESS_SPINE_WORKFLOW_EVENTS.EXTERNAL_PUBLISHING_STALE_NO_TRAFFIC)?.sourceModule, "external-publishing");

    assert.equal(
        buildWorkflowIdempotencyKey(BUSINESS_SPINE_WORKFLOW_EVENTS.EXTERNAL_PUBLISHING_EXPORTED, { packageId: "pkg-123" }),
        "workflow:external-publishing.exported:pkg-123",
    );

    const event = buildExternalPublishingWorkflowEventInput({
        workspaceId: "00000000-0000-4000-8000-000000000001",
        packageId: "pkg-123",
        eventKey: BUSINESS_SPINE_WORKFLOW_EVENTS.EXTERNAL_PUBLISHING_PUBLISHED_MANUAL,
        payload: { topic: "AI intake checklist" },
    });

    assert.equal(event.sourceEntityType, "external_publication_package");
    assert.equal(event.sourceEntityId, "pkg-123");
    assert.equal(event.idempotencyValues.packageId, "pkg-123");
    assert.equal(event.payload.packageId, "pkg-123");
});
