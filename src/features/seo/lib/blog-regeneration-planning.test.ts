import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    buildBlogRegenerationPrompt,
    ensureRegeneratedMarkdownHasEvidenceCitations,
    evaluateBlogRegenerationSimilarity,
} from "./blog-regeneration-planning";
import { validateGeneratedBlogDraft } from "@/features/content-engine/lib/blog-editorial-validation";
import type { PublicEvidenceSource } from "@/features/source-intelligence/public";

const CURRENT_MARKDOWN = `AI operations audits start with the work people already do.

## Map the workflow before choosing tools

Teams should list the handoffs, approvals, data stores, and recurring exceptions before they buy another automation product. That map keeps the discussion grounded in the operating model rather than vendor demos.

## Evidence decides what should be automated

Good automation candidates have a visible trigger, a clear owner, and a result that can be checked after the fact. Weak candidates depend on informal judgment that has not been written down yet.

## Governance prevents invisible drift

Review gates, access controls, and exception logs make the automation safer to maintain. Without them, the workflow becomes another black box that only one operator understands.

{{visual:workflow-governance-map}}

## Practical next step

Start with one workflow, document the failure modes, and build the smallest reviewable improvement before expanding the system.`;

const NEAR_DUPLICATE_MARKDOWN = `AI operations reviews begin with the work people already do.

## Map the workflow before selecting tools

Teams should list the handoffs, approvals, data stores, and recurring exceptions before they buy another automation product. That map keeps the discussion grounded in the operating model rather than vendor demos.

## Evidence decides what should be automated

Good automation candidates have a visible trigger, a clear owner, and a result that can be checked after the fact. Weak candidates depend on informal judgment that has not been written down yet.

## Governance prevents invisible drift

Review gates, access controls, and exception logs make the automation safer to maintain. Without them, the workflow becomes another black box that only one operator understands.

{{visual:workflow-governance-map}}

## Practical next step

Start with one workflow, document the failure modes, and build the smallest reviewable improvement before expanding the system.`;

describe("blog regeneration planning", () => {
    it("rejects a regenerated article that is mostly a paragraph-level paraphrase", () => {
        const verdict = evaluateBlogRegenerationSimilarity({
            currentMarkdown: CURRENT_MARKDOWN,
            regeneratedMarkdown: NEAR_DUPLICATE_MARKDOWN,
            locale: "en",
        });

        assert.equal(verdict.acceptable, false);
        assert.equal(verdict.reason, "near_duplicate");
        assert.ok(verdict.similarity >= 0.9, `expected near-duplicate similarity >= 0.9, got ${verdict.similarity}`);
    });

    it("builds a full-stack regeneration prompt that treats current markdown as contrast, not source", () => {
        const prompt = buildBlogRegenerationPrompt({
            contentId: "content_123",
            currentTitle: "AI operations audit",
            currentMarkdown: CURRENT_MARKDOWN,
            currentSeo: {
                title: "AI operations audit for governed teams",
                description: "A practical guide to mapping workflows, evidence, and governance before automating operations.",
                keywords: ["AI operations audit", "workflow automation governance"],
            },
            generationInputs: {
                length: "long",
                narrative_style: "instructional",
                keywords: ["AI operations audit", "workflow automation governance"],
                visual_density: "balanced",
                article_blueprint: {
                    primaryKeyword: "AI operations audit",
                    sections: [{ h2: "Start with workflow evidence", role: "reframe opening architecture" }],
                },
            },
            researchBrief: {
                prose: "Research notes about audit-first automation, governance controls, and evidence-led rollout sequencing.",
            },
            evidencePack: {
                claims: [{ claim_text: "Governed automation needs review gates and logs.", source_url: "https://example.com/report" }],
            },
            publicEvidencePrompt: "1. Governance report — https://example.com/report | publisher=Example Institute",
            gscSignalsPrompt: "- workflow automation governance | page=/en/blog/ai-operations-audit | impressions=120 | signal=near_page_one",
            internalInventoryPrompt: "- Automation governance (blog) slug=automation-governance keywords=workflow governance",
            visualRequirementsPrompt: "Keep {{visual:workflow-governance-map}} and preserve 3-5 high-value visual blocks.",
            locale: "en",
            lengthTier: "long",
            existingWordCount: 1200,
        });

        assert.match(prompt, /new article architecture/i);
        assert.match(prompt, /new outline/i);
        assert.match(prompt, /not a paragraph-level paraphrase/i);
        assert.match(prompt, /CURRENT MARKDOWN FOR CONTRAST ONLY/i);
        assert.match(prompt, /ORIGINAL GENERATION INPUTS/i);
        assert.match(prompt, /RESEARCH BRIEF/i);
        assert.match(prompt, /SOURCE\/EVIDENCE PACK/i);
        assert.match(prompt, /PUBLIC EVIDENCE SOURCES/i);
        assert.match(prompt, /VISUAL ENRICHMENT REQUIREMENTS/i);
        assert.match(prompt, /SEO METADATA AND KEYWORDS/i);
        assert.match(prompt, /SEARCH CONSOLE SIGNALS/i);
        assert.match(prompt, /markdown links/i);
        assert.match(prompt, /Evidence sources/i);
    });

    it("repairs regenerated markdown with public evidence links that editorial validation counts", () => {
        const regeneratedMarkdown = `AI operating systems need evidence-led rollout decisions because teams are now stitching model output into daily process ownership. Without cited public evidence, the article can sound confident while hiding where the research boundary actually sits.

## Start with the operating decision

The practical question is not whether AI can automate a task. It is whether the workflow has a visible trigger, a responsible owner, and a reviewable output. Teams should describe the decision being delegated, the data used to make it, and the exception path when confidence drops.

## Separate research from assumptions

Research-led planning keeps the public facts, internal observations, and scenario assumptions in different lanes. That separation protects the editor from turning a directional model into a benchmark and helps readers understand which claims are externally grounded.

## Keep governance close to execution

Governance works best when it is attached to the operating sequence: intake, approval, run, review, and rollback. A policy document that never reaches the queue will not prevent an unsafe automation from becoming the default workflow.

## Publish only what can be defended

Before publication, the editor should check that source-backed claims point to the exact public source and that unsupported operational advice is labelled as an author framework or implementation scenario.`;

        const withoutRepair = validateGeneratedBlogDraft({
            markdown: regeneratedMarkdown,
            length: "short",
            title: "Evidence-led AI operating systems",
            seoTitle: "AI operating systems need evidence-led rollout",
            seoDescription: "A practical guide to AI operating systems that separates public research, assumptions, and workflow governance before automation scales.",
            primaryKeyword: "AI operating systems",
            keywords: ["AI operating systems"],
            siteHost: "isystem.ai",
        });

        assert.ok(withoutRepair.issues.some((issue) => issue.code === "insufficient_research_citations"));

        // Typed as PublicEvidenceSource because that is what production passes
        // (see blog-regeneration-actions.ts); the planner reads a structural
        // subset of those fields.
        const evidenceSource: PublicEvidenceSource = {
            id: "eu-ai-act",
            title: "EU AI Act official overview",
            publisher: "European Commission",
            quality: "authoritative",
            trustTier: "regulatory",
            publishedAt: "2024-08-01",
            retrievedAt: "2026-07-06",
            citationUrl: "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai",
            citationLabel: "European Commission AI Act overview",
            evidenceType: "citation",
            evidenceCategory: "external_source",
        };
        const repaired = ensureRegeneratedMarkdownHasEvidenceCitations({
            markdown: regeneratedMarkdown,
            lengthTier: "short",
            siteHost: "isystem.ai",
            publicEvidenceSources: [evidenceSource],
        });

        assert.equal(repaired.insertedCitationCount, 1);
        assert.doesNotMatch(repaired.markdown, /## Evidence sources/);
        assert.match(repaired.markdown, /Evidence sources:/);
        assert.match(repaired.markdown, /\[EU AI Act official overview \(European Commission\)\]\(https:\/\/digital-strategy\.ec\.europa\.eu\/en\/policies\/regulatory-framework-ai\)/);

        const validation = validateGeneratedBlogDraft({
            markdown: repaired.markdown,
            length: "short",
            title: "Evidence-led AI operating systems",
            seoTitle: "AI operating systems need evidence-led rollout",
            seoDescription: "A practical guide to AI operating systems that separates public research, assumptions, and workflow governance before automation scales.",
            primaryKeyword: "AI operating systems",
            keywords: ["AI operating systems"],
            siteHost: "isystem.ai",
        });

        assert.ok(!validation.issues.some((issue) => issue.code === "insufficient_research_citations"));
        assert.ok(!validation.issues.some((issue) => issue.code === "h2_missing_substantive_paragraph"));
    });

    it("rewrites generated evidence-source H2 lists into a validator-safe citation paragraph", () => {
        const regeneratedMarkdown = `AI workflow governance needs evidence that operators can inspect before a system is trusted. The article should separate public references from implementation judgment and make each claim easy to review before publication.

## Start with the operating question

Teams need a clear workflow owner, a visible input, and a review path before any AI automation becomes part of daily operations. Without that operating question, the project becomes a tool trial instead of a managed change to how decisions are made.

## Check the integration surface

The stack matters because integrations decide which handoffs can be observed, retried, or rolled back. A workflow that crosses several apps should be mapped through the exact connector layer before anyone promises speed, savings, or reliability.

## Evidence sources

* Make Integrations Library: https://www.make.com/en/integrations`;

        const repaired = ensureRegeneratedMarkdownHasEvidenceCitations({
            markdown: regeneratedMarkdown,
            lengthTier: "short",
            siteHost: "isystem.ai",
            publicEvidenceSources: [
                {
                    id: "make-integrations",
                    title: "Make Integrations Library",
                    publisher: "Make",
                    citationUrl: "https://www.make.com/en/integrations",
                },
            ],
        });

        assert.doesNotMatch(repaired.markdown, /## Evidence sources/);
        assert.match(repaired.markdown, /Evidence sources:/);
        assert.match(repaired.markdown, /\[Make Integrations Library \(Make\)\]\(https:\/\/www\.make\.com\/en\/integrations\)/);
        assert.match(repaired.markdown.trim(), /\.$/);

        const validation = validateGeneratedBlogDraft({
            markdown: repaired.markdown,
            length: "short",
            title: "Evidence-led AI workflow governance",
            seoTitle: "Evidence-led AI workflow governance",
            seoDescription: "A practical guide to AI workflow governance with source-backed integration checks before automation becomes daily operating practice.",
            primaryKeyword: "AI workflow governance",
            keywords: ["AI workflow governance"],
            siteHost: "isystem.ai",
        });

        assert.ok(!validation.issues.some((issue) => issue.code === "insufficient_research_citations"));
        assert.ok(!validation.issues.some((issue) => issue.code === "h2_missing_substantive_paragraph"));
    });
});
