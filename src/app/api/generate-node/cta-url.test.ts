import assert from "node:assert/strict";
import test from "node:test";
import {
    normalizeWorkspaceSiteUrl,
    sanitizeWorkspaceCtaUrl,
} from "./cta-url";

test("generated CTA URLs remain on the configured workspace domain", () => {
    assert.equal(
        sanitizeWorkspaceCtaUrl("/contact?from=newsletter", "client.example"),
        "https://client.example/contact?from=newsletter",
    );
    assert.equal(
        sanitizeWorkspaceCtaUrl(
            "https://client.example/services",
            "client.example",
        ),
        "https://client.example/services",
    );
    assert.equal(
        sanitizeWorkspaceCtaUrl("https://attacker.example/phish", "client.example"),
        "https://client.example/",
    );
    assert.equal(
        sanitizeWorkspaceCtaUrl("//attacker.example/phish", "client.example"),
        "https://client.example/",
    );
    assert.equal(
        sanitizeWorkspaceCtaUrl("javascript:alert(1)", "client.example"),
        "https://client.example/",
    );
    assert.equal(
        sanitizeWorkspaceCtaUrl(
            ["https://operator", "secret@client.example/private"].join(":"),
            "client.example",
        ),
        "https://client.example/",
    );
});

test("workspace site domains reject credentials and non-HTTP schemes", () => {
    assert.throws(
        () => normalizeWorkspaceSiteUrl(
            ["https://operator", "secret@client.example"].join(":"),
        ),
        /Invalid workspace site domain/,
    );
    assert.throws(
        () => normalizeWorkspaceSiteUrl("javascript:alert(1)"),
    );
});
