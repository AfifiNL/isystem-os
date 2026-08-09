import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const assetViewerSource = readFileSync("src/features/content-engine/ui/content-asset-viewer.tsx", "utf8");
const assetRouteSource = readFileSync("src/app/api/generate-assets/route.ts", "utf8");
const generateNodeSource = readFileSync("src/app/api/generate-node/route.ts", "utf8");
const generateDraftSource = readFileSync("src/app/api/generate-draft/route.ts", "utf8");
const humanizeBlogSource = readFileSync("src/app/api/humanize-blog/[id]/route.ts", "utf8");
const repairEditorialSource = readFileSync("src/app/api/repair-editorial/[id]/route.ts", "utf8");
const contentActionsSource = readFileSync("src/features/content-engine/actions.ts", "utf8");
const blogTranslationSource = readFileSync("src/features/blog/translation-service.ts", "utf8");
const blogRegenerationSource = readFileSync("src/features/seo/blog-regeneration-actions.ts", "utf8");
const enhanceNarrativeSource = readFileSync("src/app/api/enhance-narrative/route.ts", "utf8");
const workspaceAiExecutorSource = readFileSync("src/shared/lib/ai/workspace-execution.ts", "utf8");
const runtimeFallbackSource = readFileSync("src/shared/lib/ai/runtime-fallback.ts", "utf8");

describe("content AI workflow and workspace contracts", () => {
    it("routes narration to Podcast Production and never submits the ignored TTS flag", () => {
        assert.doesNotMatch(assetViewerSource, /generate_tts|Generate Narration|Generate All|Regenerate All/);
        assert.match(assetViewerSource, /onOpenPodcastProduction/);
        assert.match(assetViewerSource, /Open Podcast Production/);
        assert.match(assetRouteSource, /parseAssetGenerationRequest/);
        assert.match(
            assetRouteSource,
            /effectiveCapabilities\.includes\("content\.write"\)/,
        );
    });

    it("authorizes generate-node content against the active workspace", () => {
        assert.match(generateNodeSource, /executeWorkspaceAiObject\(\{[\s\S]*authorization:\s*\{[\s\S]*kind:\s*"content",[\s\S]*contentId,/);
        assert.match(generateNodeSource, /requiredCapability:\s*"content\.write"/);
        assert.match(workspaceAiExecutorSource, /assertAuthorizedContentAccess\(authorization\.contentId,\s*\{[\s\S]*requireAiEnabled:\s*true/);
        assert.doesNotMatch(generateNodeSource, /item\.author_id !== user\.id/);
        assert.doesNotMatch(generateNodeSource, /\.select\("title, content_markdown, metadata, author_id, locale"\)/);
    });

    it("authorizes enhance-narrative content before inheriting its locale", () => {
        assert.match(enhanceNarrativeSource, /executeWorkspaceAiText\(\{[\s\S]*kind:\s*"content",\s*contentId/);
        assert.match(enhanceNarrativeSource, /requiredCapability:\s*"content\.write"/);
        assert.match(workspaceAiExecutorSource, /assertAuthorizedContentAccess\(authorization\.contentId,\s*\{[\s\S]*requireAiEnabled:\s*true/);
        assert.doesNotMatch(enhanceNarrativeSource, /\.from\("content_items"\)[\s\S]{0,180}\.select\("locale"\)/);
    });

    it("rejects unsafe model output before it reaches previews or persisted public content", () => {
        for (const [name, source] of Object.entries({
            generateNode: generateNodeSource,
            generateDraft: generateDraftSource,
            humanizeBlog: humanizeBlogSource,
            repairEditorial: repairEditorialSource,
            blogTranslation: blogTranslationSource,
            blogRegeneration: blogRegenerationSource,
        })) {
            assert.match(
                source,
                /assertSafeGeneratedOutput\(/,
                `${name} must enforce the generated-output safety boundary`,
            );
        }
        assert.doesNotMatch(generateDraftSource, /raw_fallback:\s*resultText/);
        assert.match(
            runtimeFallbackSource,
            /generateText\([\s\S]*assertSafeGeneratedOutput\(result\.text\)/,
        );
        assert.match(
            runtimeFallbackSource,
            /generateObject\([\s\S]*assertSafeGeneratedOutput\(result\.object\)/,
        );
    });

    it("uses one template-aware editorial policy from generation through repair and publication", () => {
        assert.match(
            generateDraftSource,
            /forbiddenPublicTerms:\s*getBlogEditorialPublicPolicy\(templateId\)\.forbiddenPublicTerms/,
        );
        assert.match(
            repairEditorialSource,
            /\.select\("[^"]*template_id[^"]*"\)/,
        );
        assert.match(
            repairEditorialSource,
            /getBlogEditorialPublicPolicy\(item\.template_id\)/,
        );
        assert.match(
            contentActionsSource,
            /assessBlogEditorialPublicationReadiness\(result,/,
        );
        assert.doesNotMatch(
            contentActionsSource,
            /templateId\s*===\s*"[^"]+"\s*\?\s*\[[^\]]+\]/,
        );
    });
});
