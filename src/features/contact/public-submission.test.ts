import assert from "node:assert/strict";
import test from "node:test";

import {
    buildAtomicContactSubmission,
    contactEmailIdempotencyKeys,
    contactSubmissionFingerprint,
    getContactDeliveryDisposition,
    isContactSubmissionReplayConflict,
    normalizeContactRequestHost,
    resolveContactWorkspace,
} from "./public-submission";

test("normalizes the public request host without trusting paths or ports", () => {
    assert.equal(normalizeContactRequestHost("WWW.Client.Example:443"), "client.example");
    assert.equal(normalizeContactRequestHost("https://client.example/contact"), "client.example");
    assert.equal(normalizeContactRequestHost("client.example, proxy.invalid"), "client.example");
    assert.equal(normalizeContactRequestHost("javascript:alert(1)"), null);
});

test("resolves contact tenancy from the host and uses template id only as a consistency check", async () => {
    const seenDomains: string[] = [];
    const lookup = async (domain: string) => {
        seenDomains.push(domain);
        return { id: "workspace-1", name: "Client", templateId: "saas-product" };
    };

    assert.deepEqual(
        await resolveContactWorkspace({ requestHost: "www.client.example:443", templateId: "saas-product", lookupByDomain: lookup }),
        { id: "workspace-1", name: "Client", templateId: "saas-product" },
    );
    assert.deepEqual(seenDomains, ["client.example"]);
    await assert.rejects(
        resolveContactWorkspace({ requestHost: "client.example", templateId: "other-template", lookupByDomain: lookup }),
        /template does not match/i,
    );
});

test("derives stable inquiry email keys from the client submission id", () => {
    const submissionId = "00000000-0000-4000-8000-000000000123";
    assert.deepEqual(contactEmailIdempotencyKeys(submissionId, "MANAGER@CLIENT.EXAMPLE"), {
        customer: `contact-submission:${submissionId}:customer`,
        manager: `contact-submission:${submissionId}:manager:manager@client.example`,
    });
});

test("fingerprints only normalized stable public contact input", () => {
    const input = {
        name: "Ada Lovelace",
        email: "ADA@EXAMPLE.COM",
        company: "  Example Ltd  ",
        phone: " +31 20 123 4567 ",
        requestType: "Consulting",
        timeline: "This quarter",
        challenge: "Ship safely",
        locale: "en" as const,
        marketingConsent: true,
    };

    const first = contactSubmissionFingerprint(input);
    const normalizedReplay = contactSubmissionFingerprint({
        ...input,
        email: "ada@example.com",
        company: "Example Ltd",
        phone: "+31 20 123 4567",
    });
    const changed = contactSubmissionFingerprint({ ...input, challenge: "A different request" });

    assert.match(first, /^[0-9a-f]{64}$/);
    assert.equal(normalizedReplay, first);
    assert.notEqual(changed, first);
});

test("builds the same atomic inquiry and exact durable jobs for a stable retry", () => {
    const input = {
        workspaceId: "00000000-0000-4000-8000-000000000001",
        submissionId: "00000000-0000-4000-8000-000000000123",
        name: "Ada Lovelace",
        email: "ADA@EXAMPLE.COM",
        company: "Example Ltd",
        phone: "+31 20 123 4567",
        requestType: "Consulting",
        timeline: "This quarter",
        challenge: "Ship safely",
        locale: "en" as const,
        marketingConsent: true,
        metadata: { source: "contact_form", antiAbuse: { outcome: "allow" } },
        fromEmail: "Platform <hello@example.com>",
        customer: {
            eventType: "inquiry_acknowledgement" as const,
            locale: "en" as const,
            replyToEmail: "team@example.com",
            subject: "We received your inquiry",
            html: "<p>Thanks</p>",
        },
        managers: [{
            email: "MANAGER@EXAMPLE.COM",
            eventType: "inquiry_manager_notification" as const,
            locale: "en" as const,
            subject: "New inquiry",
            html: "<p>Review it</p>",
        }],
    };

    const first = buildAtomicContactSubmission(input);
    const retry = buildAtomicContactSubmission(input);

    assert.deepEqual(retry, first);
    assert.equal(first.emailJobs.length, 2);
    assert.deepEqual(first.emailJobs.map((job) => job.idempotency_key), [
        `contact-submission:${input.submissionId}:customer`,
        `contact-submission:${input.submissionId}:manager:manager@example.com`,
    ]);
    assert.equal(first.emailJobs.filter((job) => job.recipient_role === "customer").length, 1);
    assert.deepEqual(Object.keys(first.inquiry).sort(), [
        "challenge",
        "company",
        "customer_email",
        "customer_name",
        "locale",
        "marketing_consent",
        "metadata",
        "request_type",
        "submission_id",
        "timeline",
        "workspace_id",
    ]);
    assert.equal(first.inquiry.metadata.phone, input.phone);
    assert.ok(first.emailJobs.every((job) => !("aggregate_id" in job)));
});

test("recognizes only the RPC's explicit replay conflicts", () => {
    assert.equal(isContactSubmissionReplayConflict({
        code: "23514",
        message: "Contact submission ID was already used with a different fingerprint.",
    }), true);
    assert.equal(isContactSubmissionReplayConflict({
        code: "23514",
        message: "p_inquiry.workspace_id must match p_workspace_id.",
    }), false);
    assert.equal(isContactSubmissionReplayConflict({
        code: "22023",
        message: "Contact submission ID was already used with a different fingerprint.",
    }), false);
});

test("reports committed jobs as accepted/degraded until every delivery succeeds", () => {
    assert.deepEqual(getContactDeliveryDisposition({ requested: 2, delivered: 2 }), {
        deliveryDegraded: false,
        status: 200,
    });
    assert.deepEqual(getContactDeliveryDisposition({ requested: 2, delivered: 1 }), {
        deliveryDegraded: true,
        status: 202,
    });
    assert.deepEqual(getContactDeliveryDisposition(null), {
        deliveryDegraded: true,
        status: 202,
    });
});
