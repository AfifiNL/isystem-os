import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    getPublicEvidenceFromContentMetadata,
    getPublicEvidenceFromMarkdownLinks,
    isPublicEvidenceEnabled,
} from "@/features/source-intelligence/public";

describe("public evidence metadata extraction", () => {
    it("extracts Source Intelligence and fallback source links from persisted article metadata", () => {
        const sources = getPublicEvidenceFromContentMetadata({
            enrichment: {
                source_intelligence_evidence_pack: {
                    checked_at: "2026-06-08T10:00:00.000Z",
                    claims: [{
                        id: "claim-1",
                        evidence_type: "statistic",
                        quality: "high",
                        source_url: "https://oecd.org/report#section",
                        source_title: "OECD AI report",
                        publisher: "OECD",
                        trust_tier: "regulatory",
                    }],
                    documents: [{
                        id: "document-1",
                        canonical_url: "https://ec.europa.eu/ai-act/",
                        title: "EU AI Act",
                        publisher: "European Commission",
                        quality: "authoritative",
                        trust_tier: "regulatory",
                    }],
                },
                evergreen_source_pass: {
                    checked_at: "2026-06-08T10:00:00.000Z",
                    sources: [{
                        url: "https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai",
                        title: "The state of AI",
                        trust_tier: 2,
                    }],
                },
            },
        }, "article-1");

        assert.equal(sources.length, 3);
        assert.deepEqual(sources.map((source) => source.citationUrl), [
            "https://ec.europa.eu/ai-act",
            "https://oecd.org/report",
            "https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai",
        ]);
        assert.equal(sources[0].quality, "authoritative");
        assert.equal(sources[1].trustTier, "regulatory");
    });

    it("deduplicates URLs and rejects non-public URLs", () => {
        const sources = getPublicEvidenceFromContentMetadata({
            provenance: {
                sources: [
                    { url: "https://example.com/research/#intro", title: "First label", trust_tier: 3 },
                    { url: "https://example.com/research/", title: "Duplicate label", trust_tier: 3 },
                    { url: "http://localhost:54321/internal", title: "Localhost" },
                    { url: "javascript:alert(1)", title: "Unsafe" },
                ],
            },
        }, "article-2");

        assert.equal(sources.length, 1);
        assert.equal(sources[0].citationUrl, "https://example.com/research");
        assert.equal(sources[0].title, "First label");
        assert.equal(sources[0].trustTier, "industry");
    });

    it("honors an explicit public evidence kill switch for remediated content", () => {
        const metadata = {
            public_evidence_enabled: false,
            provenance: {
                sources: [{
                    url: "https://example.com/research",
                    title: "Stale source mapping",
                }],
            },
        };

        assert.equal(isPublicEvidenceEnabled(metadata), false);
        assert.deepEqual(getPublicEvidenceFromContentMetadata(metadata, "article-disabled"), []);
        assert.equal(isPublicEvidenceEnabled({}), true);
    });

    it("extracts regenerated blog evidence snapshots and original blueprint citation targets", () => {
        const sources = getPublicEvidenceFromContentMetadata({
            enrichment: {
                blog_regeneration: {
                    public_evidence_sources: [{
                        citationUrl: "https://cloudsecurityalliance.org/ai-safety-initiative",
                        title: "AI Safety Initiative",
                        publisher: "Cloud Security Alliance",
                        quality: "high",
                        trustTier: "industry",
                        evidenceType: "statistic",
                    }],
                },
            },
            generation_inputs: {
                article_blueprint: {
                    externalCitationTargets: [{
                        url: "https://www.nist.gov/itl/ai-risk-management-framework",
                        title: "AI Risk Management Framework",
                        publisher: "NIST",
                        reason: "Original generation citation target for AI governance claims.",
                    }],
                },
            },
        }, "regenerated-post");

        assert.deepEqual(sources.map((source) => source.citationUrl), [
            "https://cloudsecurityalliance.org/ai-safety-initiative",
            "https://www.nist.gov/itl/ai-risk-management-framework",
        ]);
        assert.equal(sources[0].publisher, "Cloud Security Alliance");
        assert.equal(sources[0].evidenceType, "statistic");
        assert.equal(sources[1].citationLabel, "Original generation citation target for AI governance claims.");
    });

    it("recovers public evidence sources from existing blog markdown links", () => {
        const sources = getPublicEvidenceFromMarkdownLinks(`
The public article cites [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework#overview), ignores [internal iSystem](/blog/internal), and keeps the canonical host [local page](https://isystem.ai/blog/internal).

A legacy editor also pasted a bare public URL: https://www.oecd.org/artificial-intelligence/.
        `, "legacy-post", { siteHost: "isystem.ai" });

        assert.deepEqual(sources.map((source) => source.citationUrl), [
            "https://www.nist.gov/itl/ai-risk-management-framework",
            "https://www.oecd.org/artificial-intelligence",
        ]);
        assert.equal(sources[0].title, "NIST AI RMF");
        assert.equal(sources[0].citationLabel, "NIST AI RMF");
        assert.equal(sources[1].publisher, "oecd.org");
    });

    it("treats curated public evidence as an allowlist over stale generation metadata", () => {
        const sources = getPublicEvidenceFromContentMetadata({
            public_evidence_mode: "curated",
            public_evidence_sources: [{
                url: "https://www.nist.gov/itl/ai-risk-management-framework",
                title: "AI Risk Management Framework",
                publisher: "NIST",
                quality: "authoritative",
                trustTier: "regulatory",
                evidenceType: "supporting",
            }],
            provenance: {
                sources: [{
                    url: "https://private-azure-llm-endpoint.internal/v1",
                    title: "Private implementation endpoint",
                    quality: "high",
                }, {
                    url: "https://example.com/unreviewed-generation-source",
                    title: "Unreviewed generation source",
                    quality: "high",
                }],
            },
        }, "curated-article");

        assert.deepEqual(sources.map((source) => source.citationUrl), [
            "https://www.nist.gov/itl/ai-risk-management-framework",
        ]);
        assert.equal(sources[0].quality, "authoritative");
        assert.equal(sources[0].trustTier, "regulatory");
    });

    it("rejects private, reserved, credential-bearing, and non-HTTPS markdown URLs", () => {
        const sources = getPublicEvidenceFromMarkdownLinks(`
[private endpoint](https://private-azure-llm-endpoint.internal/v1)
[metadata service](https://169.254.169.254/latest/meta-data)
[reserved test host](https://evidence.example.test/report)
[credential leak](${["https://token", "secret@example.com/report"].join(":")})
[insecure source](http://example.com/report)
        `, "unsafe-links");

        assert.deepEqual(sources, []);
    });

    it("classifies markdown fallback sources conservatively from their public host", () => {
        const sources = getPublicEvidenceFromMarkdownLinks(`
[NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework)
[University study](https://www.hbs.edu/faculty/Pages/item.aspx?num=64700)
[Unreviewed vendor article](https://example.com/vendor-claim)
        `, "host-classification");

        assert.deepEqual(
            sources.map((source) => [source.quality, source.trustTier]),
            [
                ["authoritative", "regulatory"],
                ["high", "industry"],
                ["unverified", "unknown"],
            ],
        );
    });
});
