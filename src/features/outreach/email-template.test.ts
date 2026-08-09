import assert from "node:assert/strict";
import test from "node:test";

import { renderOutreachEmailHtml } from "./email-template";

test("outreach email template renders the active client identity", () => {
    const html = renderOutreachEmailHtml({
        bodyHtml: "<p>Hello.</p>",
        unsubscribeUrl: "https://client.example/outreach/unsubscribe",
        brandName: "Client Example",
        siteUrl: "https://client.example",
    });

    assert.match(html, /Client Example/);
    assert.match(html, /https:\/\/client\.example/);
    assert.doesNotMatch(html, /iSystem|isystem\.ai|Hossam/);
});
