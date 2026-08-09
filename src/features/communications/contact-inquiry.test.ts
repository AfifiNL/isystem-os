import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildInquiryAcknowledgement, buildManagerInquiryEmail } from "@/features/contact/emails";
import { contactSubmitSchema } from "@/features/contact/schema";

const validSubmission = {
    submissionId: "00000000-0000-4000-8000-000000000123",
    name: "Ada Lovelace",
    email: "ADA@EXAMPLE.COM",
    templateId: "example-template",
};

describe("contact inquiry input", () => {
    it("defaults marketing consent to false and normalizes the email", () => {
        const result = contactSubmitSchema.parse(validSubmission);
        assert.equal(result.marketingConsent, false);
        assert.equal(result.email, "ada@example.com");
    });

    it("preserves only an explicit boolean opt-in", () => {
        assert.equal(contactSubmitSchema.parse({ ...validSubmission, marketingConsent: true }).marketingConsent, true);
        assert.equal(contactSubmitSchema.safeParse({ ...validSubmission, marketingConsent: "true" }).success, false);
    });

    it("requires a submission id and tenant-consistency template id", () => {
        assert.equal(contactSubmitSchema.safeParse({ ...validSubmission, submissionId: undefined }).success, false);
        assert.equal(contactSubmitSchema.safeParse({ ...validSubmission, templateId: undefined }).success, false);
    });
});

describe("contact inquiry transactional copy", () => {
    it("escapes customer and workspace values in acknowledgement email HTML", () => {
        const email = buildInquiryAcknowledgement({
            locale: "en",
            workspaceName: "Example & Partners",
            customerName: "<Ada>",
        });
        assert.match(email.html, /Example &amp; Partners/);
        assert.match(email.html, /&lt;Ada&gt;/);
        assert.doesNotMatch(email.html, /<Ada>/);
    });

    it("escapes inquiry values and dashboard URLs in manager email HTML", () => {
        const email = buildManagerInquiryEmail({
            workspaceName: "Example",
            name: "Ada",
            email: "ada@example.com",
            challenge: "<script>alert(1)</script>",
            dashboardUrl: "https://example.com/dashboard?view=\"inbox\"&scope=all",
        });
        assert.match(email.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
        assert.match(email.html, /view=&quot;inbox&quot;&amp;scope=all/);
    });
});
