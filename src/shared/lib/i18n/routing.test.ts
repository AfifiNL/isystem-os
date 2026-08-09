import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canonicalizePublicHref, localizeHref } from "./routing";

describe("localized public hrefs", () => {
    it("uses the unprefixed canonical blog surface for default-English links", () => {
        assert.equal(localizeHref("en", "/blog"), "/blog");
        assert.equal(localizeHref("en", "/blog/governed-ai?source=nav#proof"), "/blog/governed-ai?source=nav#proof");
    });

    it("keeps non-default blog links locale-prefixed", () => {
        assert.equal(localizeHref("nl", "/blog"), "/nl/blog");
        assert.equal(localizeHref("ar", "/blog/governed-ai"), "/ar/blog/governed-ai");
    });

    it("localizes normal public links and leaves infrastructure links alone", () => {
        assert.equal(localizeHref("nl", "/booking"), "/nl/booking");
        assert.equal(localizeHref("ar", "/sitemap.xml"), "/sitemap.xml");
        assert.equal(
            localizeHref("en", "/resources/starter-kit/en/playbook.pdf"),
            "/resources/starter-kit/en/playbook.pdf",
        );
    });

    it("re-localizes CMS links and collapses the default blog redirect form", () => {
        assert.equal(canonicalizePublicHref("en", "/en/blog/example"), "/blog/example");
        assert.equal(canonicalizePublicHref("nl", "/en/blog/example?ref=guide#step"), "/nl/blog/example?ref=guide#step");
        assert.equal(canonicalizePublicHref("ar", "/nl/booking"), "/ar/booking");
    });
});
