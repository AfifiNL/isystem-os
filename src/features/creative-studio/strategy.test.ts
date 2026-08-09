import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    buildDeterministicCreativeStrategy,
    compileCreativePromptManifest,
    evaluateCreativeSafetyPreflight,
} from "./strategy";

const scopedBrief = {
    id: "brief-1",
    workspaceId: "workspace-1",
    templateId: "isystem",
    projectId: "project-1",
    locale: "en",
    title: "AI orchestration explainer",
    briefMarkdown: "Create a LinkedIn video about AI orchestration. Claim: teams can cut operating cost by 40% in 30 days.",
    targetUrl: "https://isystem.ai/services",
    targetChannel: "linkedin",
    targetAudience: "B2B founders",
    brandRules: { tone: "operator-led" },
    rightsRequirements: { human_approval_required: true },
} as const;

describe("Creative Studio Phase 5 prompt compiler", () => {
    it("creates a stable prompt hash for equivalent structured manifests", () => {
        const evidencePack = {
            checked_at: "2026-06-18T10:00:00.000Z",
            retrieval_mode: "source_intelligence",
            stale: false,
            claims: [
                {
                    id: "claim-1",
                    claim_text: "AI orchestration improves handoff quality.",
                    confidence: 82,
                    quality: "high",
                    source: { title: "Internal case note", canonical_url: "https://example.com/proof" },
                },
            ],
            documents: [],
        };

        const plan = buildDeterministicCreativeStrategy(scopedBrief, evidencePack);
        const first = compileCreativePromptManifest({ brief: scopedBrief, plan, evidencePack, sourceModel: "gemini-3.5-flash" });
        const second = compileCreativePromptManifest({ brief: { ...scopedBrief }, plan: { ...plan }, evidencePack: { ...evidencePack }, sourceModel: "gemini-3.5-flash" });

        assert.equal(first.prompt_hash, second.prompt_hash);
        assert.match(first.prompt_hash, /^[a-f0-9]{64}$/);
    });

    it("blocks unsupported quantitative claims instead of compiling them into provider prompts", () => {
        const evidencePack = { checked_at: "2026-06-18T10:00:00.000Z", retrieval_mode: "none", stale: true, claims: [], documents: [] };
        const safety = evaluateCreativeSafetyPreflight(scopedBrief, evidencePack);
        const plan = buildDeterministicCreativeStrategy(scopedBrief, evidencePack);
        const manifest = compileCreativePromptManifest({ brief: scopedBrief, plan, evidencePack, sourceModel: "gemini-3.5-flash" });

        assert.equal(safety.status, "blocked");
        assert.ok(safety.blocked_claims.some((claim) => claim.includes("40%")));
        assert.doesNotMatch(manifest.provider_prompt, /40%|30 days/i);
        assert.match(manifest.provider_prompt, /avoid unsupported quantitative claims/i);
    });

    it("keeps render queueing disabled until a human approves the prompt manifest", () => {
        const evidencePack = { checked_at: "2026-06-18T10:00:00.000Z", retrieval_mode: "none", stale: true, claims: [], documents: [] };
        const plan = buildDeterministicCreativeStrategy(scopedBrief, evidencePack);
        const manifest = compileCreativePromptManifest({ brief: scopedBrief, plan, evidencePack, sourceModel: "gemini-3.5-flash" });

        assert.equal(manifest.evaluator_plan.render_queueing, "blocked_until_human_approval");
        assert.equal(manifest.safety.human_approval_required, true);
        assert.equal(manifest.scene_plan.render_job_created, false);
    });
});
