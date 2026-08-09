import test from "node:test";
import assert from "node:assert/strict";

import { normalizePrivacyPolicyUrl, resolveLocalizedPrivacyPolicyUrl } from "./privacy";

test("privacy policy URLs allow localized paths and http(s) links", () => {
    assert.equal(normalizePrivacyPolicyUrl("/nl/privacy", "/privacy"), "/nl/privacy");
    assert.equal(normalizePrivacyPolicyUrl("https://example.com/privacy", "/privacy"), "https://example.com/privacy");
});

test("configured locale prefixes are canonicalized for the requested booking locale", () => {
    assert.equal(resolveLocalizedPrivacyPolicyUrl("/nl/privacy", "ar"), "/ar/privacy");
    assert.equal(resolveLocalizedPrivacyPolicyUrl("/privacy", "nl"), "/nl/privacy");
    assert.equal(resolveLocalizedPrivacyPolicyUrl("https://legal.example/privacy", "ar"), "https://legal.example/privacy");
});

test("privacy policy URLs fail closed for executable and protocol-relative URLs", () => {
    assert.equal(normalizePrivacyPolicyUrl("javascript:alert(1)", "/privacy"), "/privacy");
    assert.equal(normalizePrivacyPolicyUrl("//evil.example/privacy", "/privacy"), "/privacy");
    assert.equal(normalizePrivacyPolicyUrl("not a URL", "/privacy"), "/privacy");
});
