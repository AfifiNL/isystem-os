import assert from "node:assert/strict";
import test from "node:test";

import { applyClientModuleOverrides } from "./load";

test("client module overrides remove explicitly disabled launcher modules", () => {
    const modules = [
        { key: "content", label: "Content" },
        { key: "creative-studio", label: "Creative Studio" },
        { key: "legal-vault", label: "Legal Vault" },
    ];

    const result = applyClientModuleOverrides(modules, {
        content: true,
        "creative-studio": false,
    });

    assert.deepEqual(
        result.map((module) => module.key),
        ["content", "legal-vault"],
    );
});

test("client module overrides never invent access to unknown modules", () => {
    const result = applyClientModuleOverrides(
        [{ key: "content" }],
        { content: true, "not-a-module": true },
    );

    assert.deepEqual(result, [{ key: "content" }]);
});
