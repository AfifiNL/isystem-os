import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    buildEditorialRepairValidationInput,
    buildRepairedBlogMetadata,
    extractVisualShortcodes,
    repairAdjacentHeadingDiagnostics,
    repairDeterministicGrammarDiagnostics,
    repairInvalidInternalLinks,
    repairVisualShortcodeDiagnostics,
    repairVisualEvidenceDiagnostics,
    validateRepairRewrite,
} from "./editorial-repair";
import { validateGeneratedBlogDraft } from "./blog-editorial-validation";

describe("editorial repair helpers", () => {
    it("deterministically repairs the reported subject-verb diagnostics", () => {
        const markdown = "These is the controls. The systems is ready, but the workflows is not.";
        const validation = validateGeneratedBlogDraft({ markdown, length: "short" });
        const repaired = repairDeterministicGrammarDiagnostics(markdown, validation.issues);

        assert.equal(repaired, "These are the controls. The systems are ready, but the workflows are not.");
        const remainingCodes = validateGeneratedBlogDraft({
            markdown: repaired,
            length: "short",
        }).issues.map((issue) => issue.code);
        assert.equal(remainingCodes.includes("subject_verb_agreement_these_is"), false);
        assert.equal(remainingCodes.includes("subject_verb_agreement_plural_is"), false);
    });

    it("preserves correct singular-head phrasing while repairing genuine plural disagreement", () => {
        const markdown = "One of the biggest risks is vendor dependence. The systems is ready, though the platform that hosts your documents is audited.";
        const validation = validateGeneratedBlogDraft({ markdown, length: "short" });
        const repaired = repairDeterministicGrammarDiagnostics(markdown, validation.issues);

        assert.equal(
            repaired,
            "One of the biggest risks is vendor dependence. The systems are ready, though the platform that hosts your documents is audited.",
        );
    });

    it("tracks only canonical visual shortcodes during rewrite validation", () => {
        assert.deepEqual(
            extractVisualShortcodes("Intro\n\n{{visual:chart_1}}\n\n[Visual: legacy]"),
            ["{{visual:chart_1}}"],
        );

        const original = "Intro\n\n## Section\n\nBody with {{visual:chart_1}}.";
        const revised = "Intro\n\n## Section\n\nBody with [Visual: chart_1].";

        assert.equal(validateRepairRewrite(original, revised)?.code, "shortcodes_changed");
    });

    it("can allow heading text repair without allowing heading structure drift", () => {
        const original = "Intro\n\n## What this means for teams\n\nBody.\n\n## What this means for owners\n\nBody.";
        const revisedTextOnly = "Intro\n\n## Workflow pressure for teams\n\nBody.\n\n## Decision pressure for owners\n\nBody.";
        const revisedLevelDrift = "Intro\n\n## Workflow pressure for teams\n\nBody.\n\n### Decision pressure for owners\n\nBody.";

        assert.equal(validateRepairRewrite(original, revisedTextOnly)?.code, "headings_changed");
        assert.equal(validateRepairRewrite(original, revisedTextOnly, { allowHeadingTextChanges: true }), null);
        assert.equal(validateRepairRewrite(original, revisedLevelDrift, { allowHeadingTextChanges: true })?.code, "headings_changed");
    });

    it("deterministically varies repeated H2 heading patterns named by diagnostics", () => {
        const markdown = "Intro\n\n## What this means for teams\n\nBody.\n\n## What this means for owners\n\nBody.";
        const repaired = repairAdjacentHeadingDiagnostics(markdown, [
            {
                code: "adjacent_h2_pattern_repetition",
                severity: "warning",
                dimension: "editorialDepth",
                message: "Repeated pattern.",
                repairInstruction: "Vary heading architecture.",
                heading: "What this means for owners",
            },
        ]);

        assert.match(repaired, /## This means for owners/);
        assert.equal(validateRepairRewrite(markdown, repaired, { allowHeadingTextChanges: true }), null);
    });

    it("scans adjacent H2 patterns when diagnostics do not include a heading", () => {
        const markdown = "Intro\n\n## How teams decide\n\nBody.\n\n## How leaders review\n\nBody.";
        const repaired = repairAdjacentHeadingDiagnostics(markdown, [
            {
                code: "adjacent_h2_pattern_repetition",
                severity: "warning",
                dimension: "editorialDepth",
                message: "Repeated pattern.",
                repairInstruction: "Vary heading architecture.",
            },
        ]);

        assert.match(repaired, /## Leaders review/);
        assert.equal(validateRepairRewrite(markdown, repaired, { allowHeadingTextChanges: true }), null);
    });

    it("replaces invalid internal links with allowed internal paths", () => {
        const markdown = "Read [the related guide](/blog/missing-guide) before publishing.";
        const repaired = repairInvalidInternalLinks(markdown, [
            {
                code: "invalid_internal_link",
                severity: "warning",
                dimension: "linkingEvidence",
                message: "Invalid link.",
                repairInstruction: "Replace link URL.",
                details: { href: "/blog/missing-guide" },
            },
        ], ["/blog/valid-guide"]);

        assert.equal(repaired, "Read [the related guide](/blog/valid-guide) before publishing.");
    });

    it("uses saved allowed-link metadata when repairing invalid internal links", () => {
        const metadata = {
            enrichment: {
                allowed_internal_links: ["/blog/valid-guide"],
            },
        };
        const markdown = "Read [the related guide](/blog/missing-guide) before publishing.";
        const input = buildEditorialRepairValidationInput({ markdown, title: "Internal links", metadata });
        const before = validateGeneratedBlogDraft(input);
        const repaired = repairInvalidInternalLinks(markdown, before.issues, input.allowedInternalLinks);

        assert.equal(repaired, "Read [the related guide](/blog/valid-guide) before publishing.");
    });

    it("adds author-framework caveats for visuals displayed as benchmarks", () => {
        const metadata = {
            enrichment: {
                visual_blocks: [
                    {
                        id: "framework_1",
                        type: "diagram",
                        diagram_type: "framework",
                        title: "Benchmark workflow model",
                        description: "Observed workflow model",
                        caption: "Benchmark style framework",
                        source_label: "Author framework",
                        seo_alt: "Framework",
                        nodes: [{ id: "one", label: "Benchmark workflow" }],
                        evidence: {
                            claim_id: "framework_1-evidence",
                            visual_id: "framework_1",
                            claim_text: "Observed benchmark workflow",
                            claim_type: "author_framework",
                            evidence_type: "author_framework",
                            source_quality: "internal",
                            confidence: "low",
                            source_note: "Author synthesis.",
                            badge_label: "Author framework",
                        },
                    },
                ],
            },
        };
        const before = validateGeneratedBlogDraft({
            markdown: "Intro about governance.\n\n## Workflow\n\nBody with {{visual:framework_1}}.",
            length: "short",
            visualBlocks: buildEditorialRepairValidationInput({ markdown: "", title: "Test", metadata }).visualBlocks,
        });

        assert.ok(before.issues.some((issue) => issue.code === "visual_framework_displayed_as_benchmark"));

        const repair = repairVisualEvidenceDiagnostics(metadata, before.issues);
        const after = validateGeneratedBlogDraft({
            markdown: "Intro about governance.\n\n## Workflow\n\nBody with {{visual:framework_1}}.",
            length: "short",
            visualBlocks: buildEditorialRepairValidationInput({ markdown: "", title: "Test", metadata: repair.metadata }).visualBlocks,
        });

        assert.equal(repair.repaired, true);
        assert.equal(after.issues.some((issue) => issue.code === "visual_framework_displayed_as_benchmark"), false);
    });

    it("downgrades weak quantitative visual evidence without inventing a source", () => {
        const metadata = {
            enrichment: {
                visual_blocks: [
                    {
                        id: "roi_chart",
                        type: "chart",
                        chart_type: "bar",
                        title: "ROI improvement 40%",
                        description: "Scenario chart",
                        caption: "Scenario estimate",
                        source_label: "Example blog",
                        source_url: "https://example.com/blog/roi",
                        seo_alt: "ROI chart",
                        data: [{ label: "Before", value: 20 }, { label: "After", value: 40 }],
                        evidence: {
                            claim_id: "roi_chart-evidence",
                            visual_id: "roi_chart",
                            claim_text: "ROI improvement 40%",
                            claim_type: "verified_statistic",
                            evidence_type: "verified_statistic",
                            source_quality: "secondary",
                            confidence: "medium",
                            source_url: "https://example.com/blog/roi",
                            source_note: "Blog restatement.",
                            badge_label: "External source",
                        },
                    },
                ],
            },
        };
        const markdown = "AI governance needs careful evidence handling.\n\n## ROI evidence\n\nThis section explains why ROI visuals need caveats, methodology, and careful source hierarchy before publication.\n\n{{visual:roi_chart}}";
        const before = validateGeneratedBlogDraft({
            markdown,
            length: "short",
            visualBlocks: buildEditorialRepairValidationInput({ markdown, title: "ROI", metadata }).visualBlocks,
        });

        assert.ok(before.issues.some((issue) => issue.code === "visual_quantitative_weak_source_hierarchy"));

        const repair = repairVisualEvidenceDiagnostics(metadata, before.issues);
        const after = validateGeneratedBlogDraft({
            markdown,
            length: "short",
            visualBlocks: buildEditorialRepairValidationInput({ markdown, title: "ROI", metadata: repair.metadata }).visualBlocks,
        });
        const repairedBlock = buildEditorialRepairValidationInput({ markdown, title: "ROI", metadata: repair.metadata }).visualBlocks?.[0];

        assert.equal(repair.repaired, true);
        assert.equal(after.issues.some((issue) => issue.code === "visual_quantitative_weak_source_hierarchy"), false);
        assert.equal(repairedBlock?.source_url, undefined);
        assert.equal(repairedBlock?.evidence?.evidence_type, "internal_estimate");
        assert.match(repairedBlock?.evidence?.source_note ?? "", /not an external benchmark/i);
    });

    it("builds full validation input from saved metadata", () => {
        const input = buildEditorialRepairValidationInput({
            markdown: "Intro paragraph.\n\n## Workflow\n\nBody paragraph with [internal](/blog/internal).\n\n{{visual:chart_1}}",
            title: "AI Governance",
            metadata: {
                seo: {
                    title: "AI Governance for SMEs",
                    description: "A useful description for governed AI adoption.",
                    keywords: ["AI governance"],
                },
                generation_inputs: { length: "long", search_intent: "how-to" },
                faqs: [{ question: "What is governed AI?", answer: "It is AI with review and audit controls." }],
                enrichment: {
                    visual_blocks: [
                        {
                            id: "chart_1",
                            type: "chart",
                            chart_type: "bar",
                            title: "Adoption chart",
                            description: "Scenario chart",
                            caption: "Scenario estimate",
                            source_label: "Internal estimate",
                            seo_alt: "Adoption chart",
                            data: [{ label: "A", value: 1 }],
                            evidence: {
                                claim_id: "chart_1-evidence",
                                visual_id: "chart_1",
                                claim_text: "Scenario estimate",
                                claim_type: "internal_estimate",
                                evidence_type: "internal_estimate",
                                source_quality: "internal",
                                confidence: "low",
                                metric_definition: "Scenario model for editorial illustration.",
                                source_note: "Internal estimate; not an external benchmark.",
                                badge_label: "Internal estimate",
                            },
                        },
                    ],
                    allowed_internal_links: ["/blog/internal"],
                },
            },
        });

        assert.equal(input.length, "long");
        assert.equal(input.intent, "how-to");
        assert.equal(input.primaryKeyword, "AI governance");
        assert.equal(input.faqItems?.length, 1);
        assert.equal(input.visualBlocks?.length, 1);
        assert.deepEqual(input.allowedInternalLinks, ["/blog/internal"]);
    });

    it("carries the public-term policy into saved-draft repair validation", () => {
        const input = buildEditorialRepairValidationInput({
            markdown: "An Example Client reference should not appear in this public article.",
            title: "Cross-client safety",
            metadata: {},
            forbiddenPublicTerms: ["Example Client"],
        });
        const codes = validateGeneratedBlogDraft(input).issues.map((issue) => issue.code);

        assert.deepEqual(input.forbiddenPublicTerms, ["Example Client"]);
        assert.equal(codes.includes("forbidden_public_term"), true);
    });

    it("recovers saved generation context for citations and internal links", () => {
        const metadata = {
            seo: {
                title: "AI Governance for SMEs With Practical Controls",
                description: "AI governance helps SMEs control review, rollout, audit, and operating decisions with source-backed evidence.",
                keywords: ["AI governance"],
            },
            generation_inputs: {
                length: "medium",
                search_intent: "guide",
                article_blueprint: {
                    internalLinkTargets: [
                        { url: "/blog/governed-ai", anchor: "governed AI" },
                        { url: "/services/ai-consultancy", anchor: "AI consultancy" },
                    ],
                    externalCitationTargets: [
                        { url: "https://www.nist.gov/itl/ai-risk-management-framework", title: "AI RMF", publisher: "NIST" },
                    ],
                },
            },
            enrichment: {
                seo_schema: {
                    citations: [
                        { url: "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai", title: "EU AI Act" },
                    ],
                    internal_link_suggestions: [
                        { url: "/blog/ai-adoption-plan", anchor: "AI adoption plan" },
                    ],
                },
                source_intelligence_evidence_pack: {
                    checked_at: "2026-06-01T00:00:00.000Z",
                    claims: [{
                        id: "claim-1",
                        evidence_type: "statistic",
                        quality: "high",
                        source_url: "https://www.oecd.org/digital/artificial-intelligence/",
                        source_title: "OECD AI",
                        publisher: "OECD",
                        trust_tier: "regulatory",
                    }],
                    documents: [],
                },
                evergreen_source_pass: {
                    checked_at: "2026-06-01T00:00:00.000Z",
                    sources: [{ url: "https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai", title: "The state of AI", trust_tier: 2 }],
                },
                allowed_internal_links: ["/blog/governed-ai", "/services/ai-consultancy", "/blog/ai-adoption-plan"],
            },
            provenance: {
                fallback_fact_sheet: {
                    checked_at: "2026-06-01T00:00:00.000Z",
                    sources: [{ url: "https://ec.europa.eu/commission/presscorner/detail/en/ip_24_4123", title: "AI Act entry into force", trust_tier: 4 }],
                },
            },
        };
        const markdown = `AI governance gives SME teams a practical way to connect policy, workflow ownership, review, and audit evidence before generated content or internal automation reaches customers.

## AI governance starts with ownership

This section gives enough practical detail about workflow ownership, review queues, policy decisions, and operating cadence to count as a substantive article section for managers.

### Ownership checkpoints

Teams need visible checkpoints for intake, review, approval, and rollback so AI governance becomes a daily operating rhythm rather than a document nobody uses.

## Evidence keeps AI governance decisions inspectable

This section explains how source context, citations, implementation notes, and review logs keep publication claims traceable when a team is moving quickly across channels.

## Review loops protect customer-facing work

This section describes the approval workflow, handoff owner, escalation point, and rollback process that help managers keep generated assets accurate and accountable.

## Measurement turns AI governance into management

This section explains how dashboards, recurring checks, quality signals, and source reviews help managers decide what to scale, pause, or rework.`;

        const input = buildEditorialRepairValidationInput({ markdown, title: "AI Governance", metadata });
        const citationUrls = (input.externalCitations ?? []).map((citation) => typeof citation === "string" ? citation : citation.url);
        const internalUrls = (input.internalLinkSuggestions ?? []).map((link) => typeof link === "string" ? link : link.url);
        const validation = validateGeneratedBlogDraft(input);
        const codes = validation.issues.map((issue) => issue.code);

        assert.ok(citationUrls.includes("https://www.nist.gov/itl/ai-risk-management-framework"));
        assert.ok(citationUrls.includes("https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai"));
        assert.ok(citationUrls.includes("https://www.oecd.org/digital/artificial-intelligence/"));
        assert.ok(citationUrls.includes("https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai"));
        assert.ok(citationUrls.includes("https://ec.europa.eu/commission/presscorner/detail/en/ip_24_4123"));
        assert.ok(internalUrls.includes("/blog/governed-ai"));
        assert.ok(internalUrls.includes("/services/ai-consultancy"));
        assert.equal(codes.includes("insufficient_research_citations"), false);
        assert.equal(codes.includes("insufficient_internal_link_suggestions"), false);
    });

    it("repairs visual shortcode placement diagnostics without changing visual ids", () => {
        const markdown = `AI governance needs visuals near the decisions they support.

## Governance ownership

This section gives concrete operating detail about ownership, review, approval, and rollback so the section is substantive before visual placement is evaluated.

## Evidence review

This section explains why evidence and source review should be near the claims they support instead of being separated from the editorial argument.

## Rollout measurement

This section explains how metrics, review cadence, and dashboards keep the rollout visible for managers who need decisions rather than decoration.

{{visual:governance_map}}

{{visual:governance_map}}

{{visual:evidence_loop}}`;
        const visualBlocks = [
            { id: "governance_map", type: "diagram", title: "Governance map" },
            { id: "evidence_loop", type: "chart", title: "Evidence loop" },
            { id: "rollout_meter", type: "chart", title: "Rollout meter" },
        ];
        const before = validateGeneratedBlogDraft({ markdown, length: "short", visualBlocks });
        const repaired = repairVisualShortcodeDiagnostics(markdown, before.issues, visualBlocks);
        const after = validateGeneratedBlogDraft({ markdown: repaired, length: "short", visualBlocks });
        const codes = after.issues.map((issue) => issue.code);

        assert.equal(codes.includes("duplicate_visual_shortcode_id"), false);
        assert.equal(codes.includes("visual_block_not_placed"), false);
        assert.equal(codes.includes("all_tail_visual_dump"), false);
        assert.deepEqual(extractVisualShortcodes(repaired).sort(), ["{{visual:evidence_loop}}", "{{visual:governance_map}}", "{{visual:rollout_meter}}"].sort());
    });

    it("persists repaired SEO fields and fresh diagnostics metadata", () => {
        const validation = validateGeneratedBlogDraft({
            markdown: "Intro paragraph about AI governance.\n\n## Practical workflow\n\nThis section explains the workflow with concrete process detail and an external citation to [OECD](https://www.oecd.org/digital/).",
            length: "short",
            title: "AI Governance",
            seoTitle: "AI Governance for SMEs",
            seoDescription: "AI governance helps SMEs control review, rollout, and audit decisions.",
            primaryKeyword: "AI governance",
            keywords: ["AI governance"],
            externalCitations: ["https://www.oecd.org/digital/"],
            siteHost: "isystem.ai",
        });
        const metadata = buildRepairedBlogMetadata({
            metadata: { seo: { title: "Old", description: "Old", keywords: ["old"] }, enrichment: {} },
            seoData: { title: "New SEO Title", description: "New SEO description.", keywords: ["AI governance"] },
            validation,
            repairAttempts: 2,
            repaired: true,
        }) as {
            seo: { title: string; description: string; keywords: string[] };
            enrichment: {
                editorial_validation: { repair_attempts: number; issue_count: number };
                editorial_scorecard: unknown;
            };
        };

        assert.equal(metadata.seo.title, "New SEO Title");
        assert.equal(metadata.seo.description, "New SEO description.");
        assert.deepEqual(metadata.seo.keywords, ["AI governance"]);
        assert.equal(metadata.enrichment.editorial_validation.repair_attempts, 2);
        assert.equal(metadata.enrichment.editorial_validation.issue_count, validation.issues.length);
        assert.deepEqual(metadata.enrichment.editorial_scorecard, validation.scorecard);
    });
});
