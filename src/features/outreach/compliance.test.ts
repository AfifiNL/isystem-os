import test from "node:test";
import assert from "node:assert/strict";
import { evaluateContactEligibility, normalizeOutreachEmail } from "@/features/outreach/compliance";
import { buildOutreachSearchQueries, isLikelyOutreachProspectResult, normalizeExtractedOutreachEmails } from "@/features/outreach/discovery";
import { getApifyConfig } from "@/features/outreach/discovery/apify-client";
import { mapApifyGoogleMapsItem, mapApifyWebsiteCrawlerItem } from "@/features/outreach/discovery/apify-mappers";
import { processOutreachDiscoveryJob } from "@/features/outreach/discovery";
import type { Json } from "@/shared/lib/supabase/database.types";

function restoreEnv(name: string, value: string | undefined) {
    if (typeof value === "undefined") delete process.env[name];
    else process.env[name] = value;
}

function makeDiscoveryJob(input: Record<string, unknown>) {
    return {
        id: "00000000-0000-0000-0000-000000000001",
        workspace_id: "00000000-0000-0000-0000-000000000002",
        campaign_id: "00000000-0000-0000-0000-000000000003",
        source_id: null,
        job_type: "import" as const,
        status: "running" as const,
        priority: 100,
        attempts: 1,
        max_attempts: 3,
        run_after: new Date().toISOString(),
        locked_at: new Date().toISOString(),
        worker_id: "test",
        input: input as Json,
        result_summary: {} as Json,
        error_message: null,
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
}

test("normalizes valid outreach emails", () => {
    assert.equal(normalizeOutreachEmail(" Person@Example.COM "), "person@example.com");
    assert.equal(normalizeOutreachEmail("not-an-email"), null);
});

test("keeps discovery contacts to valid deduplicated email addresses", () => {
    assert.deepEqual(normalizeExtractedOutreachEmails([
        " Sales@Example.COM ",
        "not an email",
        "sales@example.com",
        "hello@example.org",
        "",
    ]), ["sales@example.com", "hello@example.org"]);
});

test("blocks contacts without an approved lawful basis", () => {
    const result = evaluateContactEligibility({
        contact: {
            email: "lead@example.com",
            lawful_basis: "unknown",
            review_status: "approved",
            suppressed_at: null,
        },
        settings: null,
    });

    assert.equal(result.allowed, false);
});

test("builds concrete search queries from an outreach brief", () => {
    const queries = buildOutreachSearchQueries({
        brief: "Find Dutch SMEs that need AI automation.",
        icpDescription: "B2B service companies with manual intake and support workflows",
        sectors: ["legal firms", "accountants"],
        geographies: ["Netherlands"],
        exclusions: ["iSystem"],
    });

    assert.ok(queries.length >= 2);
    assert.ok(queries.some((query) => query.includes("legal firms")));
    assert.ok(queries.every((query) => query.includes("Netherlands") || query.includes("B2B service")));
    assert.ok(queries.every((query) => query.includes("-iSystem")));
});

test("filters obvious directory and document results from outreach discovery", () => {
    assert.equal(isLikelyOutreachProspectResult({
        title: "Top Digital Marketing Agencies in the Netherlands - 2026 Reviews",
        url: "https://www.goodfirms.co/directory/country/top-digital-marketing-companies/netherlands",
    }), false);
    assert.equal(isLikelyOutreachProspectResult({
        title: "Principles of Management PDF",
        url: "https://example.com/reports/principles-of-management.pdf",
    }), false);
    assert.equal(isLikelyOutreachProspectResult({
        title: "GDPR Compliance in the Netherlands 2026: Step-by-Step Checklist for Dutch Businesses",
        url: "https://securitywall.co/gdpr-compliance-netherlands-checklist",
    }), false);
    assert.equal(isLikelyOutreachProspectResult({
        title: "Banking & Finance: Regulatory, Netherlands, Europe",
        url: "https://chambers.com/legal-rankings/banking-finance-regulatory-netherlands-7:250:155:1",
    }), false);
    assert.equal(isLikelyOutreachProspectResult({
        title: "Whello - Digital marketing agency in Amsterdam",
        url: "https://www.whello.com",
    }), true);
});

test("maps Apify Google Maps items into governed outreach accounts and contacts", () => {
    const mapped = mapApifyGoogleMapsItem({
        title: "Example Automation Studio",
        website: "https://www.example-automation.nl/contact",
        categoryName: "Automation consultant",
        address: "Rotterdam, Netherlands",
        totalScore: 4.6,
        reviewsCount: 31,
        email: "hello@example-automation.nl",
        phone: "+31 10 000 0000",
        placeId: "places/example",
    }, { actorId: "compass/crawler-google-places", runId: "run-1", datasetId: "dataset-1" });

    assert.ok(mapped);
    assert.equal(mapped.name, "Example Automation Studio");
    assert.equal(mapped.domain, "example-automation.nl");
    assert.equal(mapped.contacts.length, 1);
    assert.equal(mapped.contacts[0]?.email, "hello@example-automation.nl");
    assert.equal(mapped.contacts[0]?.contact_type, "generic_business");
    assert.equal(mapped.metadata.provider, "apify");
});

test("maps Apify website crawler items into bounded knowledge documents", () => {
    const mapped = mapApifyWebsiteCrawlerItem({
        url: "https://example-automation.nl/services",
        title: "Services",
        markdown: `${"AI automation ".repeat(500)} Contact us for support.`,
    }, "https://example-automation.nl");

    assert.ok(mapped);
    assert.equal(mapped.canonical_url, "https://example-automation.nl/services");
    assert.ok(mapped.excerpt.length <= 2000);
    assert.equal(mapped.content_hash.length, 64);
    assert.equal(mapped.metadata.provider, "apify");
});

test("parses Apify discovery cost caps from environment", () => {
    const previousEnabled = process.env.APIFY_ENABLED;
    const previousItems = process.env.APIFY_MAX_ITEMS_PER_RUN;
    const previousCharge = process.env.APIFY_MAX_TOTAL_CHARGE_USD;
    process.env.APIFY_ENABLED = "1";
    process.env.APIFY_MAX_ITEMS_PER_RUN = "25";
    process.env.APIFY_MAX_TOTAL_CHARGE_USD = "3.50";

    const config = getApifyConfig();
    assert.equal(config.enabled, true);
    assert.equal(config.maxItemsPerRun, 25);
    assert.equal(config.maxTotalChargeUsd, 3.5);

    restoreEnv("APIFY_ENABLED", previousEnabled);
    restoreEnv("APIFY_MAX_ITEMS_PER_RUN", previousItems);
    restoreEnv("APIFY_MAX_TOTAL_CHARGE_USD", previousCharge);
});

test("fails Apify discovery jobs with a controlled missing-token error", async () => {
    const previousEnabled = process.env.APIFY_ENABLED;
    const previousToken = process.env.APIFY_API_TOKEN;
    process.env.APIFY_ENABLED = "1";
    delete process.env.APIFY_API_TOKEN;

    await assert.rejects(
        () => processOutreachDiscoveryJob({} as never, {
            id: "00000000-0000-0000-0000-000000000001",
            workspace_id: "00000000-0000-0000-0000-000000000002",
            campaign_id: "00000000-0000-0000-0000-000000000003",
            source_id: null,
            job_type: "search",
            status: "running",
            priority: 100,
            attempts: 1,
            max_attempts: 3,
            run_after: new Date().toISOString(),
            locked_at: new Date().toISOString(),
            worker_id: "test",
            input: { provider: "apify_google_maps", query: "automation consultants Rotterdam" },
            result_summary: {},
            error_message: null,
            completed_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }),
        /APIFY_API_TOKEN is not configured/,
    );

    restoreEnv("APIFY_ENABLED", previousEnabled);
    restoreEnv("APIFY_API_TOKEN", previousToken);
});

test("requeues long-running Apify actor runs as delayed poll jobs", async () => {
    const previousEnabled = process.env.APIFY_ENABLED;
    const previousToken = process.env.APIFY_API_TOKEN;
    const previousFetch = globalThis.fetch;
    process.env.APIFY_ENABLED = "1";
    process.env.APIFY_API_TOKEN = "test-token";

    const inserts: Array<{ table: string; payload: unknown }> = [];
    const supabase = {
        from(table: string) {
            return {
                insert(payload: unknown) {
                    inserts.push({ table, payload });
                    return Promise.resolve({ data: null, error: null });
                },
            };
        },
    };
    globalThis.fetch = (async () => new Response(JSON.stringify({
        data: {
            id: "run-123",
            status: "RUNNING",
            defaultDatasetId: null,
        },
    }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;

    const result = await processOutreachDiscoveryJob(supabase as never, makeDiscoveryJob({
        provider: "apify_run_poll",
        import_kind: "google_maps",
        actor_id: "compass/crawler-google-places",
        run_id: "run-123",
        query: "automation consultants Rotterdam",
        poll_attempts: 0,
    }));

    assert.equal((result as Record<string, unknown>).provider, "apify_run_poll");
    assert.equal((result as Record<string, unknown>).poll_jobs, 1);
    assert.equal(inserts.length, 1);
    assert.equal(inserts[0]?.table, "outreach_discovery_jobs");
    assert.match(JSON.stringify(inserts[0]?.payload), /apify_run_poll/);
    assert.match(JSON.stringify(inserts[0]?.payload), /run_after/);

    restoreEnv("APIFY_ENABLED", previousEnabled);
    restoreEnv("APIFY_API_TOKEN", previousToken);
    globalThis.fetch = previousFetch;
});

test("imports uploaded CSV prospect rows through the discovery worker", async () => {
    const inserts: Array<{ table: string; payload: Record<string, unknown> }> = [];
    const updates: Array<{ table: string; payload: Record<string, unknown>; column: string; value: unknown }> = [];
    let accountCounter = 0;
    const supabase = {
        from(table: string) {
            return {
                insert(payload: Record<string, unknown>) {
                    inserts.push({ table, payload });
                    const result = Promise.resolve({ data: null, error: null }) as Promise<{ data: unknown; error: null }> & {
                        select?: (columns: string) => { maybeSingle: () => Promise<{ data: { id: string }; error: null }> };
                    };
                    result.select = () => ({
                        maybeSingle: async () => ({ data: { id: `account-${accountCounter += 1}` }, error: null }),
                    });
                    return result;
                },
                update(payload: Record<string, unknown>) {
                    return {
                        eq(column: string, value: unknown) {
                            updates.push({ table, payload, column, value });
                            return Promise.resolve({ data: null, error: null });
                        },
                    };
                },
            };
        },
    };

    const result = await processOutreachDiscoveryJob(supabase as never, {
        ...makeDiscoveryJob({
            provider: "uploaded_csv",
            import_kind: "prospects_csv",
            filename: "prospects.csv",
            lawful_basis: "manual_warranty",
            rows: [
                {
                    company: "Example Studio",
                    website: "example.com",
                    email: "Hello@Example.com",
                    contact_name: "A. Contact",
                    title: "Founder",
                    notes: "High-intent manual import",
                },
            ],
        }),
        source_id: "00000000-0000-0000-0000-000000000004",
    });

    assert.equal((result as Record<string, unknown>).provider, "uploaded_csv");
    assert.equal((result as Record<string, unknown>).inserted_accounts, 1);
    assert.equal((result as Record<string, unknown>).inserted_contacts, 1);
    assert.equal(inserts.some((insert) => insert.table === "outreach_prospect_accounts"), true);
    assert.equal(inserts.some((insert) => insert.table === "outreach_contacts"), true);
    assert.equal(updates.some((update) => update.table === "outreach_sources" && update.payload.status === "completed"), true);
});

test("processes LinkedIn profile dataset imports through the discovery worker", async () => {
    const previousEnabled = process.env.APIFY_ENABLED;
    const previousToken = process.env.APIFY_API_TOKEN;
    const previousFetch = globalThis.fetch;
    process.env.APIFY_ENABLED = "1";
    process.env.APIFY_API_TOKEN = "test-token";

    const updates: Array<{ table: string; payload: Record<string, unknown>; column: string; value: unknown }> = [];
    const inserts: Array<{ table: string; payload: Record<string, unknown> }> = [];

    const supabase = {
        from(table: string) {
            return {
                update(payload: Record<string, unknown>) {
                    return {
                        eq(column: string, value: unknown) {
                            updates.push({ table, payload, column, value });
                            return Promise.resolve({ data: null, error: null });
                        },
                    };
                },
                insert(payload: Record<string, unknown>) {
                    inserts.push({ table, payload });
                    return Promise.resolve({ data: null, error: null });
                },
                select() {
                    return {
                        eq() {
                            return {
                                maybeSingle() {
                                    return Promise.resolve({ data: { account_id: "account-123" }, error: null });
                                }
                            };
                        }
                    };
                }
            };
        },
    };

    globalThis.fetch = (async () => new Response(JSON.stringify([
        {
            firstName: "John",
            lastName: "Doe",
            headline: "Tech Architect",
            url: "https://linkedin.com/in/johndoe",
            summary: "Passionate about scaling digital SaaS models.",
            skills: ["React", "TypeScript"],
            experience: [
                {
                    companyName: "iSystem",
                    title: "Lead Developer",
                }
            ]
        }
    ]), {
        status: 200,
        headers: {
            "content-type": "application/json",
            "x-apify-pagination-total": "1",
            "x-apify-pagination-offset": "0",
            "x-apify-pagination-count": "1",
            "x-apify-pagination-limit": "10",
        }
    })) as typeof fetch;

    const result = await processOutreachDiscoveryJob(supabase as never, {
        ...makeDiscoveryJob({
            provider: "apify_dataset",
            import_kind: "linkedin_profile",
            dataset_id: "ds-123",
            contact_id: "contact-123",
            account_id: "account-123",
        }),
        job_type: "import",
    });

    assert.equal((result as Record<string, unknown>).job_type, "import");
    assert.equal(updates.length, 1);
    assert.equal(updates[0]?.table, "outreach_contacts");
    assert.equal(updates[0]?.payload.full_name, "John Doe");
    assert.equal(updates[0]?.payload.role_title, "Tech Architect");

    // Two inserts: the knowledge document, then the follow-up score job that
    // enrichment queues for the account.
    assert.equal(inserts.length, 2);

    const knowledgeDocument = inserts.find((insert) => insert.table === "outreach_knowledge_documents");
    assert.ok(knowledgeDocument, "expected a knowledge document insert");
    assert.equal(knowledgeDocument.payload.title, "LinkedIn Profile: John Doe");
    assert.match(String(knowledgeDocument.payload.excerpt), /React, TypeScript/);

    const scoreJob = inserts.find((insert) => insert.table === "outreach_discovery_jobs");
    assert.ok(scoreJob, "expected enrichment to queue a score job for the account");
    const scoreJobRows = scoreJob.payload as unknown as Array<Record<string, unknown>>;
    assert.equal(scoreJobRows.length, 1);
    assert.equal(scoreJobRows[0]?.job_type, "score");
    assert.deepEqual(scoreJobRows[0]?.input, { account_id: "account-123" });

    restoreEnv("APIFY_ENABLED", previousEnabled);
    restoreEnv("APIFY_API_TOKEN", previousToken);
    globalThis.fetch = previousFetch;
});
