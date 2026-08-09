import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    buildCreativeMcpCommandText,
    buildCreativeMcpProductionPack,
    HIGGSFIELD_MCP_SERVER_URL,
    MCP_MANUAL_OPERATOR_WARNING,
    normalizeCreativeManualCreditSource,
    normalizeCreativeManualProvider,
    normalizeCreativeRenderProviderMode,
} from "./providers/mcp-manual";
import { isCreativeRenderPendingStatus, isCreativeRenderTerminalStatus, normalizeCreativeRenderStatus } from "./providers/status";
import { isCreativeRenderProviderMode } from "./providers/types";

const manifest = {
    provider_prompt: "Create a cinematic source-safe workflow OS video.",
    negative_prompt: "No celebrity likeness, no unsupported claims.",
    scene_plan: { scenes: [{ title: "System reveal" }] },
    evaluator_plan: { checks: ["rights", "claims"] },
    prompt_hash: "b".repeat(64),
    safety: {
        status: "needs_review" as const,
        human_approval_required: true as const,
        blocked_claims: [],
        downgraded_claims: [],
        rights_flags: ["operator confirmation required"],
        policy_flags: [],
        evidence_status: "missing" as const,
        render_queueing: "blocked_until_human_approval" as const,
    },
};

describe("Creative Studio MCP Manual Mode domain helpers", () => {
    it("validates provider modes and manual values without accepting credentials", () => {
        assert.equal(isCreativeRenderProviderMode("mcp_manual"), true);
        assert.equal(isCreativeRenderProviderMode("higgsfield_cookie_session"), false);
        assert.equal(normalizeCreativeRenderProviderMode("mcp_bridge_experimental"), "mcp_bridge_experimental");
        assert.equal(normalizeCreativeRenderProviderMode("bad"), "api_auto");
        assert.equal(normalizeCreativeManualProvider("higgsfield_mcp"), "higgsfield_mcp");
        assert.equal(normalizeCreativeManualProvider("browser_cookie"), "higgsfield_mcp");
        assert.equal(normalizeCreativeManualCreditSource("operator_creator_credits"), "operator_creator_credits");
        assert.equal(normalizeCreativeManualCreditSource("session_token"), "unknown");
    });

    it("builds an operator copy/paste MCP production pack without automation fields", () => {
        const pack = buildCreativeMcpProductionPack({
            manifest,
            manualCreditSource: "operator_creator_credits",
            job: {
                id: "job-1",
                workspace_id: "workspace-1",
                template_id: "isystem-agency",
                project_id: "project-1",
                brief_id: "brief-1",
                prompt_id: "prompt-1",
                job_kind: "video",
                provider_model: "higgsfield-operator-choice",
                duration_seconds: 8,
            },
        });

        assert.equal(pack.schema, "creative_studio_mcp_production_pack_v1");
        assert.equal(pack.providerMode, "mcp_manual");
        assert.equal(pack.manualProvider, "higgsfield_mcp");
        assert.equal(pack.mcpServerUrl, HIGGSFIELD_MCP_SERVER_URL);
        assert.match(pack.warning, /copy\/paste instruction/i);
        assert.match(MCP_MANUAL_OPERATOR_WARNING, /must not automate/i);
        assert.equal(pack.scope.workspaceId, "workspace-1");
        assert.equal(pack.scope.templateId, "isystem-agency");
        assert.equal(pack.render.prompt, manifest.provider_prompt);
        assert.equal(pack.operatorInstructions.checklist.no_credentials_stored_in_isystem, true);
        assert.equal(pack.operatorInstructions.checklist.no_backend_mcp_or_browser_automation, true);

        const serialized = JSON.stringify(pack).toLowerCase();
        assert.equal(serialized.includes("session_token"), false);
        assert.equal(serialized.includes("auth_token"), false);
        assert.equal(serialized.includes("browser_credentials"), false);
    });

    it("builds copyable command text with scope, server URL, and no credential storage instructions", () => {
        const pack = buildCreativeMcpProductionPack({
            manifest,
            manualCreditSource: "operator_creator_credits",
            job: {
                id: "job-2",
                workspace_id: "workspace-1",
                template_id: "isystem-agency",
                project_id: "project-1",
                brief_id: "brief-1",
                prompt_id: "prompt-1",
                job_kind: "video",
                provider_model: "higgsfield-operator-choice",
                duration_seconds: 8,
            },
        });

        const commandText = buildCreativeMcpCommandText(pack);
        assert.match(commandText, /MCP server URL: https:\/\/mcp\.higgsfield\.ai\/mcp/);
        assert.match(commandText, /job_id: job-2/);
        assert.match(commandText, /Do not paste Higgsfield cookies/);
        assert.match(commandText, /Create a cinematic source-safe workflow OS video/);
        assert.equal(commandText.toLowerCase().includes("auth_token"), false);
        assert.equal(commandText.toLowerCase().includes("session_token"), false);
    });

    it("normalizes MCP manual statuses and classifies pending/terminal states", () => {
        assert.equal(normalizeCreativeRenderStatus("prompt ready"), "prompt_ready");
        assert.equal(normalizeCreativeRenderStatus("manual_required"), "mcp_manual_required");
        assert.equal(normalizeCreativeRenderStatus("manual generation started"), "mcp_generation_in_progress");
        assert.equal(normalizeCreativeRenderStatus("awaiting-upload"), "awaiting_manual_upload");
        assert.equal(normalizeCreativeRenderStatus("manual_upload_complete"), "uploaded_for_review");
        assert.equal(isCreativeRenderPendingStatus("uploaded_for_review"), true);
        assert.equal(isCreativeRenderTerminalStatus("approved"), true);
        assert.equal(isCreativeRenderTerminalStatus("rejected"), true);
    });
});
