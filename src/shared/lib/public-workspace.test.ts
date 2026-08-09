import assert from "node:assert/strict";
import test from "node:test";

import { resolvePublicWorkspace } from "./public-workspace";

test("resolves the active public tenant from Host and treats client ids as consistency checks", async () => {
    const workspace = { id: "workspace-1", name: "Client", templateId: "saas", siteDomain: "client.example" };
    assert.deepEqual(await resolvePublicWorkspace({
        requestHost: "WWW.CLIENT.EXAMPLE:443",
        expectedWorkspaceId: "workspace-1",
        expectedTemplateId: "saas",
        lookupByDomain: async (domain) => domain === "client.example" ? workspace : null,
    }), workspace);
    await assert.rejects(resolvePublicWorkspace({
        requestHost: "client.example",
        expectedWorkspaceId: "attacker-workspace",
        lookupByDomain: async () => workspace,
    }), /does not match/i);
});
