import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveOutreachSenderName } from "./sender-identity";

test("outreach draft identity comes from workspace settings before deployment config", () => {
    assert.equal(resolveOutreachSenderName("Workspace Team", "Configured Team"), "Workspace Team");
    assert.equal(resolveOutreachSenderName(null, "Configured Team"), "Configured Team");
});

test("outreach draft identity fails closed when no sender is configured", () => {
    assert.equal(resolveOutreachSenderName("", ""), null);
    assert.equal(resolveOutreachSenderName(null, undefined), null);
});

test("outreach sequence generation wires workspace sender settings instead of campaign names", () => {
    const source = readFileSync(new URL("./service.ts", import.meta.url), "utf8");
    assert.match(source, /\.from\("outreach_workspace_settings"/);
    assert.match(source, /resolveOutreachSenderName/);
    assert.match(source, /buildSequenceDrafts\(\{ account, campaign, docs, senderName \}\)/);
    assert.doesNotMatch(source, /const brandName = input\.campaign\.name/);
});
