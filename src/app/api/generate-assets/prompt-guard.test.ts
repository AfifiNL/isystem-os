import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    buildAssetGenerationState,
} from "./asset-generation-state";
import {
    buildTextFreeEditorialPrompt,
    enforceTextFreeImagenPrompt,
    TEXT_FREE_IMAGEN_NEGATIVE_PROMPT,
} from "./prompt-guard";
import {
    generateSvgOverlay,
    normalizeOverlayText,
    OVERLAY_DESIGN_IDS,
    selectOverlayDesign,
} from "./overlay";

describe("generate-assets prompt guard", () => {
    it("removes article-title phrasing and document-like surfaces from Imagen prompts", () => {
        const guarded = enforceTextFreeImagenPrompt(
            "Create a hero image for an article titled \"The Business Owner's Guide to Integrated Systems\" with a printed guide page beside a dashboard.",
        );

        assert.equal(/article titled/i.test(guarded), false);
        assert.equal(/printed guide page/i.test(guarded), false);
        assert.equal(/\bdashboard\b/i.test(guarded), false);
        assert.match(guarded, /CRITICAL TEXT-FREE BACKGROUND REQUIREMENT/);
        assert.match(guarded, /do not render the article title/i);
    });

    it("passes a negative prompt with text-specific failure modes", () => {
        assert.match(TEXT_FREE_IMAGEN_NEGATIVE_PROMPT, /pseudo-text/);
        assert.match(TEXT_FREE_IMAGEN_NEGATIVE_PROMPT, /dashboard labels/);
        assert.match(TEXT_FREE_IMAGEN_NEGATIVE_PROMPT, /document/);
    });

    it("builds overlay-asset prompts without user-title words or text-bearing surfaces", () => {
        const prompt = buildTextFreeEditorialPrompt({
            industry: "Technology",
            keywords: ["integrated systems", "business owners", "dashboards"],
            visualStyle: "premium editorial",
            assetDescription: "a blog post featured hero background",
        });

        assert.equal(/Business Owner.s Guide/i.test(prompt), false);
        assert.equal(/\bdashboard\b/i.test(prompt), false);
        assert.equal(/\bscreen\b/i.test(prompt), false);
        assert.match(prompt, /left 55 percent/i);
        assert.match(prompt, /right half only/i);
    });

    it("renders SVG overlay text with a solid panel and normalized max-seven-word title", () => {
        const overlayText = normalizeOverlayText("The Business Owner's Guide to Integrated Systems", "fallback");
        const svg = generateSvgOverlay(overlayText, "Technology").toString("utf8");

        assert.equal(overlayText, "The Business Owner s Guide to Integrated");
        assert.match(svg, /data-overlay-design="integrated-panel"/);
        assert.match(svg, /width="620"/);
        assert.match(svg, /THE BUSINESS OWNER/);
        assert.match(svg, /S GUIDE/);
        assert.match(svg, /TO INTEGRATED/);
        assert.match(svg, /<image href="data:image\/svg\+xml;base64,/);
    });

    it("escapes unsafe overlay text and truncates oversized single tokens", () => {
        const overlayText = normalizeOverlayText(
            "<script>alert(1)</script> Supercalifragilisticexpialidocious & partners",
            "fallback",
        );
        const svg = generateSvgOverlay(overlayText, "Technology").toString("utf8");

        assert.equal(overlayText, "script alert 1 script Supercalifragilis… partners");
        assert.equal(svg.includes("<script>"), false);
        assert.match(svg, /SUPERCALIFRAGILIS…/);
        assert.match(svg, /PARTNERS/);
    });

    it("renders Arabic overlay text with RTL anchoring and without LTR letter spacing", () => {
        const overlayText = normalizeOverlayText("حوكمة الذكاء الاصطناعي للشركات الصغيرة", "fallback");
        const svg = generateSvgOverlay(overlayText, "Technology").toString("utf8");

        assert.match(svg, /direction="rtl"/);
        assert.match(svg, /text-anchor="end"/);
        assert.equal(/letter-spacing="-1\.2"/.test(svg), false);
        assert.match(svg, /حوكمة/);
    });

    it("exposes the integrated overlay plus seven additional iSystem overlay designs", () => {
        assert.deepEqual(OVERLAY_DESIGN_IDS, [
            "integrated-panel",
            "governance-ledger",
            "automation-flow",
            "business-os-grid",
            "saas-consolidation",
            "ai-frontier",
            "compliance-shield",
            "growth-intelligence",
        ]);
    });

    it("selects subject-aware overlay designs for distinct iSystem topics", () => {
        const cases = [
            {
                title: "Audit Trails for Governed AI Approval",
                description: "Checksum rows, review logs, and accountable approval records for management.",
                keywords: ["audit trail", "governance", "approval"],
                expected: "governance-ledger",
            },
            {
                title: "Workflow Automation Without Broken Handoffs",
                description: "Route operational tasks through clean workflow automation between teams.",
                keywords: ["workflow automation", "handoff", "process"],
                expected: "automation-flow",
            },
            {
                title: "Why SMEs Need a Business Operating System",
                description: "A command center and modular workspace for daily business operations.",
                keywords: ["business os", "command center", "workspace"],
                expected: "business-os-grid",
            },
            {
                title: "Escape App Sprawl with SaaS Consolidation",
                description: "Fragmented tool stacks collapse into one serious operational hub.",
                keywords: ["app sprawl", "saas consolidation", "tool stack"],
                expected: "saas-consolidation",
            },
            {
                title: "Human in the Loop AI Adoption",
                description: "Model boundaries, capability zones, and responsible generative AI operations.",
                keywords: ["human in the loop", "generative ai", "ai adoption"],
                expected: "ai-frontier",
            },
            {
                title: "GDPR Compliance Guardrails for Dutch SMEs",
                description: "Privacy risk, policy rails, retention duties, and safe legal operations.",
                keywords: ["gdpr", "compliance", "privacy risk"],
                expected: "compliance-shield",
            },
            {
                title: "Market Monitor Signals for SEO Growth",
                description: "Opportunity engine insights, analytics, visibility, conversion, and campaign momentum.",
                keywords: ["market monitor", "seo", "opportunity engine"],
                expected: "growth-intelligence",
            },
        ] as const;

        for (const item of cases) {
            assert.equal(
                selectOverlayDesign({
                    title: item.title,
                    description: item.description,
                    keywords: [...item.keywords],
                    locale: "en",
                    assetKey: "blog_featured",
                    promptContext: "iSystem.ai operational systems for Dutch SMEs",
                    category: "Digital systems",
                }),
                item.expected,
            );
        }
    });

    it("selects overlays deterministically for the same input", () => {
        const input = {
            title: "Operational Clarity for Dutch SME Growth",
            description: "A serious founder-led system design note for a digital systems partner.",
            keywords: ["strategy", "digital systems", "SME"],
            locale: "nl",
            assetKey: "blog_featured",
            promptContext: "premium editorial image prompt",
            category: "Technology",
        };

        const first = selectOverlayDesign(input);
        const repeated = Array.from({ length: 20 }, () => selectOverlayDesign(input));

        assert.deepEqual(repeated, Array.from({ length: 20 }, () => first));
    });

    it("renders every overlay design as a valid server-safe SVG buffer", () => {
        for (const designId of OVERLAY_DESIGN_IDS) {
            const svg = generateSvgOverlay("Governed AI Systems", "Technology", designId).toString("utf8");
            assert.match(svg, new RegExp(`data-overlay-design="${designId}"`));
            assert.match(svg, /<svg width="1200" height="675"/);
            assert.match(svg, /GOVERNED AI SYSTEMS/);
        }
    });

    it("fallback image generation can still resolve and render a valid overlay selection", () => {
        const overlayDesign = selectOverlayDesign({
            title: "GDPR Compliance Guardrails for AI Workflows",
            description: "Fallback image path should use the same deterministic subject-aware overlay.",
            keywords: ["gdpr", "ai", "workflow"],
            locale: "en",
            assetKey: "blog_featured",
            promptContext: "fallback deterministic svg background",
            category: "Technology",
        });
        const svg = generateSvgOverlay("GDPR Compliance Guardrails", "Technology", overlayDesign).toString("utf8");

        assert.equal(overlayDesign, "compliance-shield");
        assert.match(svg, /data-overlay-design="compliance-shield"/);
        assert.match(svg, /GDPR COMPLIANCE/);
    });

    it("marks all-image generation misses as recoverable failures with missing keys", () => {
        const state = buildAssetGenerationState({
            requestedImages: true,
            requestedKeys: ["blog_featured"],
            generatedKeys: [],
            failures: [],
            featuredImageUrl: null,
            generatedAt: "2026-06-07T09:00:00.000Z",
        });

        assert.equal(state.status, "failed");
        assert.equal(state.recoverable, true);
        assert.deepEqual(state.failed_keys, ["blog_featured"]);
        assert.equal(state.featured_image_url, null);
    });

    it("does not report all-assets-fail when blog featured is recovered by deterministic fallback", () => {
        const state = buildAssetGenerationState({
            requestedImages: true,
            requestedKeys: ["blog_featured"],
            generatedKeys: ["blog_featured"],
            failures: [{
                key: "blog_featured",
                stage: "image_generation",
                message: "AI_PROVIDER=vertex requires GOOGLE_CLOUD_PROJECT or GOOGLE_VERTEX_PROJECT.",
                category: "auth_config_missing",
                provider: "vertex",
                model_alias: "image.fast",
                model_id: "gemini-3.1-flash-lite-image",
                retryable: false,
            }],
            fallbacks: [{
                key: "blog_featured",
                status: "succeeded",
                source: "deterministic_svg",
                reason: "primary_auth_config_missing",
                url: "https://example.com/blog_featured-fallback.webp",
            }],
            featuredImageUrl: "https://example.com/blog_featured-fallback.webp",
            generatedAt: "2026-06-07T09:00:00.000Z",
        });

        assert.equal(state.status, "succeeded");
        assert.equal(state.recoverable, false);
        assert.deepEqual(state.generated_keys, ["blog_featured"]);
        assert.deepEqual(state.failed_keys, []);
        assert.equal(state.failures[0]?.category, "auth_config_missing");
        assert.equal(state.fallbacks[0]?.status, "succeeded");
        assert.equal(state.fallbacks[0]?.source, "deterministic_svg");
        assert.equal(state.featured_image_url, "https://example.com/blog_featured-fallback.webp");
    });

    it("marks partial asset generation as recoverable while preserving featured image url", () => {
        const state = buildAssetGenerationState({
            requestedImages: true,
            requestedKeys: ["blog_featured", "social_linkedin"],
            generatedKeys: ["blog_featured"],
            failures: [{ key: "social_linkedin", stage: "upload", message: "bucket unavailable" }],
            featuredImageUrl: "https://example.com/blog_featured.webp",
            generatedAt: "2026-06-07T09:00:00.000Z",
        });

        assert.equal(state.status, "partial");
        assert.equal(state.recoverable, true);
        assert.deepEqual(state.generated_keys, ["blog_featured"]);
        assert.deepEqual(state.failed_keys, ["social_linkedin"]);
        assert.equal(state.featured_image_url, "https://example.com/blog_featured.webp");
    });
});
