import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    extractMarkdownHeadings,
    formatValidationIssuesForPrompt,
    normalizeHeadingForEditorialMatch,
    resolveEffectivePrimaryKeyword,
    validateGeneratedBlogDraft,
} from "./blog-editorial-validation";

function issueCodes(markdown: string, overrides: Partial<Parameters<typeof validateGeneratedBlogDraft>[0]> = {}): string[] {
    return validateGeneratedBlogDraft({
        markdown,
        length: "medium",
        intent: "guide",
        primaryKeyword: "AI governance",
        seoTitle: "AI Governance for Dutch SMEs: Practical Control",
        seoDescription: "AI governance helps Dutch SMEs control adoption, evidence, review, and rollout without turning each workflow into chaos.",
        internalLinkSuggestions: ["/blog/ai-governance", "/blog/ai-adoption"],
        externalCitations: ["https://www.oecd.org/digital/", "https://digital-strategy.ec.europa.eu/"],
        siteHost: "isystem.ai",
        ...overrides,
    }).issues.map((issue) => issue.code);
}

const VALID_LONG_MARKDOWN = `Opening paragraph about AI implementation for Dutch SMEs. AI implementation for Dutch SMEs needs a practical structure because operators need governance, budget control, and measurable adoption before they trust a new workflow.

## AI implementation for Dutch SMEs starts with operational friction

Most small teams do not need another abstract strategy document. They need a clear view of which repetitive decisions, content workflows, and client handoffs are already costing time. This section gives enough context to stand as a substantive paragraph before any supporting structure.

For isystem, that means naming the operational seam before naming the AI feature. A hospitality operator, legal partner, or education provider can all recognise a backlog of repeated requests, half-finished content ideas, and undocumented decisions. The article should make that friction visible in business language before it recommends tooling.

### Where the friction appears first

The useful audit starts with existing work queues, not a generic vendor list.

## Governance turns experiments into controlled workflows

Agreed usage limits, reviewable changes, and rollback make AI adoption safer for the Dutch SME buyer who wants proof before expansion. The point is not to slow teams down. The point is to make every AI action traceable enough that an owner can keep using the system after the first pilot.

That governance layer also makes the draft credible for enterprise-adjacent readers. They do not need exaggerated autonomy claims. They need to see that costs are bounded, approvals stay human, and the system keeps an audit trail when content or workflow changes are proposed.

[Internal adoption plan](/blog/ai-adoption-plan) connects this section to a related article.

## Internal knowledge decides what the model can safely do

An AI workflow only improves when the source material is specific enough. Teams should map brand rules, existing service packages, legal constraints, and known customer questions before asking a model to draft anything public.

This is where many generic AI rollouts fail. The model receives a vague prompt, then invents a generic answer that sounds plausible but does not match the business. A stronger process gives the system approved examples, preferred language, sector constraints, and the few claims that must never be overstated.

### Source material that earns reuse

The strongest inputs are documents the business already trusts.

## Evidence separates a useful guide from AI filler

Research-led content should cite external sources where it makes claims about market behaviour, compliance pressure, or adoption trends. That keeps the article useful for readers and safer for later editorial review.

Evidence also changes the tone of the piece. Instead of sounding like another AI prediction, the article can compare the reader's situation with public research, authority sources, and grounded examples. That is especially important in the Dutch market, where measured claims usually land better than transformation language.

[OECD research](https://www.oecd.org/digital/) supports the adoption context.

## A ninety-day rollout keeps the work manageable

A practical rollout moves from audit to governed pilot to repeatable workflow. Each phase should have a small success condition, a responsible owner, and a clear stop rule if the workflow does not save time or improve quality.

The first month should narrow the scope, the second should run one controlled workflow, and the third should decide whether the workflow deserves a permanent place in operations. That sequence gives the business enough time to learn without pretending every process should become AI-assisted at once.

{{visual:rollout_framework}}

## Frequently asked questions

These common questions help readers move from the guide into practical decision-making. They should answer real adoption concerns rather than repeat the article summary.

### How should a Dutch SME begin with AI?

Start with one workflow that already has clear inputs, human review, and measurable business value. The best first candidate is usually repetitive enough to justify setup work, but important enough that the owner still wants a review step before anything reaches a client or public channel.

### What makes governed AI different from a normal chatbot?

Governed AI adds usage limits, review, rollback, and accountability around the generation step. A normal chatbot can produce text quickly, but governed AI makes the surrounding business process visible enough for a cautious team to trust it.`;

describe("blog editorial validation", () => {
    it("normalizes headings without stripping Dutch or Arabic letters", () => {
        assert.equal(
            normalizeHeadingForEditorialMatch("AI implementatie voor MKB in Nederland"),
            "ai implementatie voor mkb in nederland",
        );
        assert.equal(
            normalizeHeadingForEditorialMatch("الذكاء الاصطناعي للشركات الصغيرة"),
            "الذكاء الاصطناعي للشركات الصغيرة",
        );
    });

    it("extracts H2/H3/H4+ headings with parent H2 context", () => {
        const headings = extractMarkdownHeadings(`Intro

## AI implementatie voor MKB

### Waarom governance telt

#### الدليل العملي`);

        assert.deepEqual(headings, [
            {
                level: 2,
                text: "AI implementatie voor MKB",
                normalizedText: "ai implementatie voor mkb",
                parentH2: null,
                index: 0,
            },
            {
                level: 3,
                text: "Waarom governance telt",
                normalizedText: "waarom governance telt",
                parentH2: "AI implementatie voor MKB",
                index: 1,
            },
            {
                level: 4,
                text: "الدليل العملي",
                normalizedText: "الدليل العملي",
                parentH2: "AI implementatie voor MKB",
                index: 2,
            },
        ]);
    });

    it("passes a structurally complete long-form draft", () => {
        const result = validateGeneratedBlogDraft({
            markdown: VALID_LONG_MARKDOWN,
            length: "long",
            intent: "guide",
            primaryKeyword: "AI implementation for Dutch SMEs",
            seoTitle: "AI Implementation for Dutch SMEs: A Practical Guide",
            seoDescription: "AI implementation for Dutch SMEs works best when governance, evidence, and a ninety-day rollout turn experiments into controlled workflows.",
            internalLinkSuggestions: ["/blog/ai-adoption-plan", "/blog/governed-ai", "/services/ai-consultancy"],
            externalCitations: [
                "https://www.oecd.org/digital/",
                "https://digital-strategy.ec.europa.eu/",
                "https://www.cbs.nl/",
            ],
            faqItems: [
                { question: "How should a Dutch SME begin with AI?", answer: "Start with one governed workflow." },
                { question: "What makes governed AI different?", answer: "Usage limits, review, rollback, and accountability." },
            ],
            visualBlocks: [
                { id: "rollout_framework", type: "diagram", title: "Ninety-day rollout", placement_hint: "A ninety-day rollout keeps the work manageable" },
            ],
            siteHost: "isystem.ai",
        });

        assert.equal(result.valid, true);
        assert.equal(result.stats.h2Count, 6);
        assert.equal(result.stats.h3Count, 4);
        assert.equal(result.scorecard.passed, true);
    });

    it("flags the failure modes later repair prompts need", () => {
        const weakMarkdown = `# Duplicate title

## Introduction

Tiny.

#### Skipped detail

## Step 1: Audit

Short.

## Step 2: Plan

Short.

{{ visual:bad id }}

{{visual:same}}

{{visual:same}}

{{visual:orphan}}`;

        const result = validateGeneratedBlogDraft({
            markdown: weakMarkdown,
            length: "medium",
            intent: "how-to",
            primaryKeyword: "AI governance",
            seoTitle: "Bad",
            seoDescription: "Too short.",
            visualBlocks: [
                { id: "same", type: "diagram", title: "Same" },
                { id: "same", type: "diagram", title: "Duplicate" },
            ],
            siteHost: "isystem.ai",
        });

        const codes = result.issues.map((issue) => issue.code);
        assert.equal(result.valid, false);
        assert.ok(codes.includes("body_h1_present"));
        assert.ok(codes.includes("h2_count_below_tier_minimum"));
        assert.ok(codes.includes("skipped_heading_level"));
        assert.ok(codes.includes("banned_generic_heading"));
        assert.ok(codes.includes("adjacent_h2_pattern_repetition"));
        assert.ok(codes.includes("invalid_visual_shortcode"));
        assert.ok(codes.includes("duplicate_visual_block_id"));
        assert.ok(codes.includes("duplicate_visual_shortcode_id"));
        assert.ok(codes.includes("visual_shortcode_missing_block"));
        assert.ok(codes.includes("all_tail_visual_dump"));
        assert.match(formatValidationIssuesForPrompt(result.issues, { maxIssues: 3 }), /Repair:/);
    });

    it("flags deep-dive drafts with no H3 depth", () => {
        const markdown = `AI governance for Dutch SMEs needs layered detail because operators must connect policy, workflow ownership, evidence, review, and measurement before the system can scale safely.

${Array.from({ length: 7 }, (_, index) => `## AI governance section ${index + 1}

This section explains a specific operating layer for AI governance in enough detail to avoid a thin-section warning. It gives managers practical context about ownership, review, data quality, and measurable rollout decisions so the draft behaves like a real deep article rather than a compressed outline.`).join("\n\n")}`;

        const codes = issueCodes(markdown, {
            length: "deep-dive",
            externalCitations: [
                "https://www.oecd.org/digital/",
                "https://digital-strategy.ec.europa.eu/",
                "https://www.cbs.nl/",
                "https://www.mckinsey.com/capabilities/quantumblack/our-insights",
            ],
        });

        assert.ok(codes.includes("h3_count_below_tier_expectation"));
    });

    it("flags generic headings in English, Dutch, and Arabic after normalization", () => {
        const codes = issueCodes(`AI governance needs a clearer editorial structure for Dutch SMEs.

## Overview

This section has enough explanatory words to be substantive, but the heading itself is generic and should not pass as a final generated H2 for a production article.

## Samenvatting

Deze sectie bevat voldoende woorden om inhoudelijk te lijken, maar de kop is generiek en hoort vervangen te worden door een concrete redactionele belofte voor de lezer.

## الخلاصة

هذا القسم يحتوي على كلمات كافية ليبدو مفيداً، لكن العنوان عام جداً ولا يقدم وعداً تحريرياً محدداً للقارئ أو لفريق المراجعة.

## AI governance rollout evidence

This section gives practical context about review queues, evidence, workflow ownership, and the kind of operating discipline that makes adoption safer for a small business team.`);

        assert.ok(codes.includes("banned_generic_heading"));
    });

    it("flags post-cleanup H2 loss", () => {
        const codes = issueCodes(`AI governance for Dutch SMEs needs more than one cleaned-up section.

## AI governance has one surviving section

This paragraph is substantive enough to show that markdown cleanup preserved prose, but it also proves the structural failure: only one H2 survived after cleanup, so the validator must block the route from saving a flattened article.`);

        assert.ok(codes.includes("h2_count_below_tier_minimum"));
    });

    it("flags SEO titles over the production-safe band", () => {
        const result = validateGeneratedBlogDraft({
            markdown: VALID_LONG_MARKDOWN,
            length: "long",
            intent: "guide",
            primaryKeyword: "AI implementation for Dutch SMEs",
            seoTitle: "AI implementation for Dutch SMEs with governance evidence rollout measurement and operating controls",
            seoDescription: "AI implementation for Dutch SMEs works best when governance, evidence, and a ninety-day rollout turn experiments into controlled workflows.",
            internalLinkSuggestions: ["/blog/ai-adoption-plan", "/blog/governed-ai", "/services/ai-consultancy"],
            externalCitations: ["https://www.oecd.org/digital/", "https://digital-strategy.ec.europa.eu/", "https://www.cbs.nl/"],
            visualBlocks: [{ id: "rollout_framework", type: "diagram", title: "Ninety-day rollout" }],
            siteHost: "isystem.ai",
        });

        assert.ok(result.issues.map((issue) => issue.code).includes("seo_title_outside_safe_band"));
    });

    it("flags missing citations for research-led medium and long claims", () => {
        const markdown = `AI governance for Dutch SMEs needs evidence because the article makes adoption, compliance, and market-behaviour claims that readers should be able to verify.

## AI governance evidence shapes adoption

This section discusses public adoption trends, budget behaviour, compliance pressure, and sector benchmarks in enough detail to clearly require external citation support rather than unsupported model prose.

## Review loops protect public claims

This section explains why review, rollback, and measured publication discipline matter when teams are using external research claims inside articles, landing pages, and client-facing documentation.

## Operating cadence keeps rollout realistic

This section describes a practical operating cadence with enough words to be substantive, while intentionally omitting external links so the validator catches missing research-led citations.

## Measurement turns governance into management

This section explains that management needs metrics, evidence, and follow-up ownership before scaling AI workflows across customer communication, internal knowledge, or sales content.`;

        const codes = issueCodes(markdown, { externalCitations: [] });

        assert.ok(codes.includes("insufficient_research_citations"));
    });

    it("flags visual shortcodes dumped at the tail or duplicated", () => {
        const markdown = `AI governance for Dutch SMEs needs inline visual support.

## Governance starts with workflow ownership

This section gives enough explanatory context about ownership, review, and measurable adoption to count as substantive content before visuals are evaluated.

## Evidence turns claims into reusable decisions

This section describes how evidence, source URLs, and review notes should sit near the claims they support rather than being separated from the narrative.

## Review loops keep risk visible

This section explains that operators need review loops, rollback, and ownership if generated drafts are going to be published safely.

## Measurement keeps the rollout honest

This section gives practical context about metrics, operating cadence, and adoption checkpoints for the management team.

{{visual:governance_map}}

{{visual:governance_map}}

{{visual:evidence_loop}}`;

        const codes = issueCodes(markdown, {
            visualBlocks: [
                { id: "governance_map", type: "diagram", title: "Governance map" },
                { id: "evidence_loop", type: "chart", title: "Evidence loop" },
                { id: "rollout_meter", type: "chart", title: "Rollout meter" },
            ],
        });

        assert.ok(codes.includes("duplicate_visual_shortcode_id"));
        assert.ok(codes.includes("all_tail_visual_dump"));
        assert.ok(codes.includes("visual_block_not_placed"));
    });

    it("blocks numeric chart evidence without structured source metadata", () => {
        const codes = issueCodes(VALID_LONG_MARKDOWN, {
            length: "long",
            primaryKeyword: "AI implementation for Dutch SMEs",
            seoTitle: "AI Implementation for Dutch SMEs: A Practical Guide",
            seoDescription: "AI implementation for Dutch SMEs works best when governance, evidence, and a ninety-day rollout turn experiments into controlled workflows.",
            visualBlocks: [{
                id: "rollout_framework",
                type: "chart",
                chart_type: "bar",
                title: "AI adoption benchmark 73%",
                placement_hint: "A ninety-day rollout keeps the work manageable",
                source_label: "AI research synthesis",
                data: [{ label: "Adoption", value: 73 }],
                evidence: {
                    evidence_type: "author_synthesis",
                    source_label: "AI research synthesis",
                },
            }],
        });

        assert.ok(codes.includes("visual_evidence_banned_source_label"));
        assert.ok(codes.includes("visual_numeric_chart_invalid_evidence_type"));
        assert.ok(codes.includes("visual_numeric_chart_missing_source_url"));
    });

    it("allows internally estimated numeric charts with methodology notes", () => {
        const result = validateGeneratedBlogDraft({
            markdown: VALID_LONG_MARKDOWN,
            length: "long",
            intent: "guide",
            primaryKeyword: "AI implementation for Dutch SMEs",
            seoTitle: "AI Implementation for Dutch SMEs: A Practical Guide",
            seoDescription: "AI implementation for Dutch SMEs works best when governance, evidence, and a ninety-day rollout turn experiments into controlled workflows.",
            internalLinkSuggestions: ["/blog/ai-adoption-plan", "/blog/governed-ai", "/services/ai-consultancy"],
            externalCitations: ["https://www.oecd.org/digital/", "https://digital-strategy.ec.europa.eu/", "https://www.cbs.nl/"],
            visualBlocks: [{
                id: "rollout_framework",
                type: "chart",
                chart_type: "kpi",
                title: "Internal rollout effort estimate",
                placement_hint: "A ninety-day rollout keeps the work manageable",
                data: [{ label: "Review touchpoints", value: 6 }],
                evidence: {
                    evidence_type: "internal_estimate",
                    source_quality: "internal",
                    metric_definition: "Directional estimate based on a ninety-day pilot with weekly reviews and two approval checkpoints.",
                    source_note: "Internal methodology note; directional, not external proof.",
                    confidence: "medium",
                },
            }],
            siteHost: "isystem.ai",
        });

        assert.equal(result.valid, true);
        assert.equal(result.issues.filter((issue) => issue.code.startsWith("visual_")).length, 0);
    });

    it("warns when author synthesis is displayed with an external source URL", () => {
        const codes = issueCodes(VALID_LONG_MARKDOWN, {
            length: "long",
            primaryKeyword: "AI implementation for Dutch SMEs",
            seoTitle: "AI Implementation for Dutch SMEs: A Practical Guide",
            seoDescription: "AI implementation for Dutch SMEs works best when governance, evidence, and a ninety-day rollout turn experiments into controlled workflows.",
            visualBlocks: [{
                id: "rollout_framework",
                type: "diagram",
                title: "Ninety-day rollout",
                source_url: "https://www.mckinsey.com/example",
                evidence: {
                    evidence_type: "author_framework",
                    source_quality: "internal",
                    source_url: "https://www.mckinsey.com/example",
                    source_note: "Author framework, not external proof.",
                },
            }],
        });

        assert.ok(codes.includes("visual_author_synthesis_displayed_as_external_proof"));
    });

    it("blocks quantitative statistic visuals backed only by social or weak source hierarchy", () => {
        const codes = issueCodes(VALID_LONG_MARKDOWN, {
            length: "long",
            primaryKeyword: "AI implementation for Dutch SMEs",
            seoTitle: "AI Implementation for Dutch SMEs: A Practical Guide",
            seoDescription: "AI implementation for Dutch SMEs works best when governance, evidence, and a ninety-day rollout turn experiments into controlled workflows.",
            visualBlocks: [{
                id: "ai_usage_stat",
                type: "chart",
                chart_type: "bar",
                title: "AI usage reached 75%",
                source_label: "LinkedIn post",
                source_url: "https://www.linkedin.com/posts/example-ai-stat",
                data: [{ label: "AI users", value: 75 }],
                evidence: {
                    evidence_type: "verified_statistic",
                    source_quality: "secondary",
                    source_label: "LinkedIn post",
                    source_url: "https://www.linkedin.com/posts/example-ai-stat",
                    publication_date: "2024-06-01",
                    metric_definition: "Share of workers using AI tools.",
                    geography_and_sample: "Unspecified social-post summary.",
                },
            }],
        });

        assert.ok(codes.includes("visual_quantitative_weak_source_hierarchy"));
        assert.ok(codes.includes("visual_quantitative_social_source"));
    });

    it("rejects social and UGC sources as exact quantitative evidence even when metadata claims high confidence", () => {
        const codes = issueCodes(VALID_LONG_MARKDOWN, {
            length: "long",
            primaryKeyword: "AI implementation for Dutch SMEs",
            seoTitle: "AI Implementation for Dutch SMEs: A Practical Guide",
            seoDescription: "AI implementation for Dutch SMEs works best when governance, evidence, and a ninety-day rollout turn experiments into controlled workflows.",
            visualBlocks: [{
                id: "ugc_chart",
                type: "chart",
                chart_type: "bar",
                title: "AI adoption 73%",
                source_label: "Reddit discussion",
                source_url: "https://www.reddit.com/r/example/comments/ai_adoption",
                data: [{ label: "Adoption", value: 73 }],
                evidence: {
                    evidence_type: "verified_statistic",
                    source_quality: "primary",
                    source_label: "Reddit discussion",
                    source_url: "https://www.reddit.com/r/example/comments/ai_adoption",
                    publication_date: "2025-01-01",
                    metric_definition: "Claimed adoption percentage from user-generated discussion.",
                    geography_and_sample: "Unverified UGC sample.",
                    confidence: "high",
                },
            }],
        });

        assert.ok(codes.includes("visual_quantitative_weak_source_hierarchy"));
        assert.ok(codes.includes("visual_quantitative_social_source"));
    });

    it("preserves locked English source-plan primary keyword as SEO title blocker", () => {
        const codes = issueCodes(VALID_LONG_MARKDOWN, {
            primaryKeyword: "AI implementation for Dutch SMEs",
            seoTitle: "Governed Rollouts for Small Teams",
        });

        assert.ok(codes.includes("primary_keyword_missing_from_seo_title"));
    });

    it("reduces a headline-style primary keyword to its core phrase", () => {
        assert.equal(
            resolveEffectivePrimaryKeyword("Enterprise Systems Enablement: A Roadmap for Operational Directors"),
            "Enterprise Systems Enablement",
        );
        assert.equal(resolveEffectivePrimaryKeyword("AI governance"), "AI governance");
        assert.equal(
            resolveEffectivePrimaryKeyword("A very long keyword phrase that keeps going without any subtitle separator at all"),
            "A very long keyword phrase that keeps going",
        );
    });

    it("accepts an SEO title containing the core phrase of a headline-style primary keyword", () => {
        const codes = issueCodes(VALID_LONG_MARKDOWN, {
            primaryKeyword: "Enterprise Systems Enablement: A Roadmap for Operational Directors",
            seoTitle: "Enterprise Systems Enablement for Operations Teams",
        });

        assert.equal(codes.includes("primary_keyword_missing_from_seo_title"), false);
    });

    it("still blocks when the core phrase of a headline-style keyword is missing from the SEO title", () => {
        const codes = issueCodes(VALID_LONG_MARKDOWN, {
            primaryKeyword: "Enterprise Systems Enablement: A Roadmap for Operational Directors",
            seoTitle: "Governed Rollouts for Small Operations Teams",
        });

        assert.ok(codes.includes("primary_keyword_missing_from_seo_title"));
    });

    it("does not flag grammatically correct singular-head constructions ending in a plural noun before 'is'", () => {
        const codes = issueCodes(`${VALID_LONG_MARKDOWN}

One of the biggest risks is vendor dependence, and the number of systems is growing every quarter. The platform that hosts your documents is audited annually.`);

        assert.equal(codes.includes("subject_verb_agreement_plural_is"), false);
    });

    it("still flags genuine plural subject-verb disagreement", () => {
        const codes = issueCodes(`${VALID_LONG_MARKDOWN}

The systems is ready for review and the workflows is documented.`);

        assert.ok(codes.includes("subject_verb_agreement_plural_is"));
    });

    it("requires scope metadata for exact external statistic visuals", () => {
        const codes = issueCodes(VALID_LONG_MARKDOWN, {
            length: "long",
            primaryKeyword: "AI implementation for Dutch SMEs",
            seoTitle: "AI Implementation for Dutch SMEs: A Practical Guide",
            seoDescription: "AI implementation for Dutch SMEs works best when governance, evidence, and a ninety-day rollout turn experiments into controlled workflows.",
            visualBlocks: [{
                id: "automation_potential",
                type: "chart",
                chart_type: "kpi",
                title: "Automation potential 65%",
                source_label: "McKinsey Global Institute, 2023",
                source_url: "https://www.mckinsey.com/capabilities/tech-and-ai/our-insights/the-economic-potential-of-generative-ai-the-next-productivity-frontier",
                data: [{ label: "Work activities", value: 65 }],
                evidence: {
                    evidence_type: "verified_statistic",
                    source_quality: "near_primary",
                    source_label: "McKinsey Global Institute, 2023",
                    source_url: "https://www.mckinsey.com/capabilities/tech-and-ai/our-insights/the-economic-potential-of-generative-ai-the-next-productivity-frontier",
                    publication_date: "2023-06-14",
                    metric_definition: "Share of work activities with technical automation potential.",
                },
            }],
        });

        assert.ok(codes.includes("visual_exact_number_missing_scope"));
    });

    it("blocks hard productivity claims when source metadata is vendor or scenario quality without caveat", () => {
        const codes = issueCodes(VALID_LONG_MARKDOWN, {
            length: "long",
            primaryKeyword: "AI implementation for Dutch SMEs",
            seoTitle: "AI Implementation for Dutch SMEs: A Practical Guide",
            seoDescription: "AI implementation for Dutch SMEs works best when governance, evidence, and a ninety-day rollout turn experiments into controlled workflows.",
            visualBlocks: [{
                id: "vendor_productivity_claim",
                type: "chart",
                chart_type: "bar",
                title: "Productivity savings 40%",
                source_label: "Vendor report, 2025",
                source_url: "https://www.salesforce.com/news/stories/generative-ai-skills-research",
                data: [{ label: "Productivity savings", value: 40 }],
                evidence: {
                    evidence_type: "time_sensitive_benchmark",
                    source_quality: "secondary",
                    source_label: "Vendor report, 2025",
                    source_url: "https://www.salesforce.com/news/stories/generative-ai-skills-research",
                    publication_date: "2025-01-01",
                    metric_definition: "Productivity savings claim.",
                    geography_and_sample: "Secondary summary with unspecified sample.",
                    source_note: "Research summary.",
                },
            }],
        });

        assert.ok(codes.includes("visual_quantitative_weak_source_hierarchy"));
        assert.ok(codes.includes("visual_hard_roi_claim_needs_caveat"));
    });

    it("warns when author-framework visuals are described like external benchmarks", () => {
        const codes = issueCodes(VALID_LONG_MARKDOWN, {
            length: "long",
            primaryKeyword: "AI implementation for Dutch SMEs",
            seoTitle: "AI Implementation for Dutch SMEs: A Practical Guide",
            seoDescription: "AI implementation for Dutch SMEs works best when governance, evidence, and a ninety-day rollout turn experiments into controlled workflows.",
            visualBlocks: [{
                id: "framework_benchmark",
                type: "diagram",
                title: "Observed governance benchmark",
                evidence: {
                    evidence_type: "author_framework",
                    source_quality: "internal",
                    source_note: "Author framework showing observed benchmark steps.",
                },
            }],
        });

        assert.ok(codes.includes("visual_framework_displayed_as_benchmark"));
    });

    it("flags invalid internal links while allowing valid and implicitly allowed internal links", () => {
        const markdown = `
Intro paragraph with valid internal links.

## Section 1

Here is a [link to home](/en), an implicitly allowed page.
Here is a [link to services](/services), another implicitly allowed page.
Here is a [valid blog post](/en/blog/scaling-up-safely).
Here is an [invalid blog post](/en/blog/non-existent-slug).
`;

        const result = validateGeneratedBlogDraft({
            markdown,
            length: "short",
            intent: "guide",
            allowedInternalLinks: [
                "/en/blog/scaling-up-safely",
            ],
            siteHost: "isystem.ai",
        });

        const issues = result.issues.filter((issue) => issue.code === "invalid_internal_link");
        assert.equal(issues.length, 1);
        assert.equal(issues[0].details?.href, "/en/blog/non-existent-slug");
    });

    it("flags public-trust gaps: unsupported metrics, vague claims, repetition, and missing workflow examples", () => {
        const markdown = `${"AI governance ".repeat(18)}helps teams.

## AI governance changes everything

This comprehensive solution can unlock the potential of the business. It is a seamless solution and a robust platform for every team.

The system saves 40% of time for operators without showing a source.

${Array.from({ length: 16 }, () => "The article stays abstract about adoption and uses confident language without naming the concrete work, the people involved, or the operating constraints that would make the advice usable.").join("\n\n")}

## AI governance improves operations

This section keeps repeating the same keyword phrase AI governance because SEO phrasing can leak into the article body when the generator is not constrained.

${Array.from({ length: 16 }, () => "The draft continues with general promises about clarity, control, and better decisions while avoiding the practical mechanics a reader would need to trust the recommendation.").join("\n\n")}

## AI governance for management

This section is long enough to read like a practical guide, but it avoids any concrete operating example that would make the claim useful.

${Array.from({ length: 16 }, () => "The language stays at the level of strategic ambition and does not identify who acts, what changes first, where the handover happens, or how the reader should judge the next move.").join("\n\n")}

## AI governance evidence

This final section discusses evidence in broad terms without adding a visual block or named scenario for the reader.`;

        const codes = issueCodes(markdown, {
            externalCitations: ["https://digital-strategy.ec.europa.eu/"],
            visualBlocks: [],
        });

        assert.ok(codes.includes("quantified_claim_without_source_or_caveat"));
        assert.ok(codes.includes("missing_before_after_workflow_example"));
        assert.ok(codes.includes("missing_implementation_concreteness"));
        assert.ok(codes.includes("vague_big_claim_density"));
        assert.ok(codes.includes("repetitive_exact_keyword_phrasing"));
        assert.ok(codes.includes("missing_visual_or_diagram_support"));
    });

    it("blocks machine diagnostics, review markers, and cross-client terms", () => {
        const markdown = `## Operational review

Here is the draft you requested for the Example Client operation.

## Evidence handling

no_primary_or_near_primary_numeric_claim_available

The public ledger stores costs in millicents.

## Localization

[AWAITING NATIVE REVIEW — do not publish]`;
        const codes = issueCodes(markdown, {
            length: "short",
            forbiddenPublicTerms: ["Example Client"],
        });

        assert.ok(codes.includes("model_preamble_exposed"));
        assert.ok(codes.includes("internal_evidence_reason_exposed"));
        assert.ok(codes.includes("internal_billing_unit_exposed"));
        assert.ok(codes.includes("native_review_marker_exposed"));
        assert.ok(codes.includes("forbidden_public_term"));
    });

    it("blocks the audited grammar defects and absolute guarantees", () => {
        const markdown = `## A learning system

Navigating toward 2027 requires moving past brittle and building a durable operation.

## Company context

These agents do your company guidelines.

## Hosting

The workflow requires running open-source models and Mistral, on private infrastructure.

## Guarantees

This approach ensures complete compliance and absolute data security.`;
        const codes = issueCodes(markdown, { length: "short" });

        assert.ok(codes.includes("missing_object_after_past"));
        assert.ok(codes.includes("incorrect_do_guidelines_collocation"));
        assert.ok(codes.includes("broken_requires_running_phrase"));
        assert.ok(codes.includes("absolute_compliance_or_security_promise"));
    });

    describe("diagram leaks", () => {
        it("returns an error for raw Mermaid", () => {
            const markdown = [
                "## Introduction",
                "Here is a flowchart:",
                "```mermaid",
                "flowchart TD A-->B",
                "```",
                "## Next",
                "More text",
            ].join("\n");
            const codes = issueCodes(markdown, { length: "short" });
            assert.ok(codes.includes("leaked_diagram_dsl"));
        });

        it("returns an error for ASCII art diagrams", () => {
            const markdown = [
                "## Introduction",
                "Here is an architecture:",
                "┌────────┐",
                "│ System │",
                "└────────┘",
                "## Next",
                "More text",
            ].join("\n");
            const codes = issueCodes(markdown, { length: "short" });
            assert.ok(codes.includes("leaked_ascii_art_diagram"));
        });

        it("returns an error for plain fenced bracket-and-connector diagrams", () => {
            const markdown = [
                "## Communication architecture",
                "```",
                "Traditional:",
                "[Staff A] <=========> [Staff B]",
                "\\\\ //",
                "[Staff C] <=========> [Staff D]",
                "",
                "Centralized:",
                "[Staff A] ========\\\\ [System] //======== [Staff B]",
                "```",
                "## Next",
                "More text",
            ].join("\n");
            const codes = issueCodes(markdown, { length: "short" });
            assert.ok(codes.includes("leaked_ascii_art_diagram"));
        });
    });

    // Route-level helper coverage assumption: the Next route keeps editorial
    // validation inputs pure by passing saved blueprint/fact-sheet/evergreen
    // source URLs into `externalCitations`. Server-only imports make direct
    // route helper imports brittle under `tsx --test`, so these fixtures assert
    // the deterministic validator contract the route repair gate depends on.
});
