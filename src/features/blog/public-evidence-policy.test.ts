import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const migrationUrl = new URL(
    "../../../supabase/migrations/20260725010000_isystem_curate_all_published_blog_evidence.sql",
    import.meta.url,
);
const migrationSource = existsSync(migrationUrl) ? readFileSync(migrationUrl, "utf8") : "";

const PUBLISHED_BLOG_SLUGS = [
    "5-practical-ai-tools-that-can-immediately-help-your-sme",
    "a-deep-dig-into-the-isystemai-client-sla-dashboard",
    "ai-implementatie-zonder-hype-mkb-raamwerk",
    "ai-systems-for-real-estate-management",
    "ai-voor-nederlandse-advocatenkantoren-waar-het-helpt-en-waar-niet",
    "architecting-transparency-your-guide-to-ai-audit-trails",
    "automating-your-horeca-operations-a-practical-guide-for-owners-1777162759441",
    "b2b-audio-marketing",
    "bespoke-nodejs-webhook-services-vs-no-code",
    "build-a-topic-cluster-strategy-for-your-business-website-1777162992436",
    "case-study-automating-client-onboarding-for-a-dutch-legal-firm",
    "consolidating-disconnected-saas-with-a-unified-postgresql-portal",
    "content-studio-distribution-channels",
    "custom-api-gateway-for-corporate-ai-cost-control",
    "custom-business-ai-architecture",
    "custom-llm-proxy-gateway-with-pii-redaction",
    "fifteen-minute-workspace-setup",
    "from-agency-stack-to-ai-operating-system-redefining-agency-growth",
    "gdpr-compliant-legal-tech-automation",
    "governed-ai-your-business-shield",
    "isystemai-vs-traditional-web-agencies-a-complete-comparison",
    "mythe-onbeperkt-ai-bedrijfssoftware",
    "scaling-up-safely-governed-ai-ledger",
    "shadow-it-and-ai-the-hidden-risks-in-your-organization",
    "sme-digital-systems-audit-playbook",
    "smes-systems-and-processes",
    "systeemdenken-in-het-ai-tijdperk-de-sleutel-tot-echte-digitale-transformatie-1777284475871",
    "system-of-action-for-modern-business",
    "system-that-learns-your-business",
    "the-true-roi-of-an-integrated-digital-system",
    "wat-is-een-growth-operating-system",
    "why-the-w2-model-is-cracking",
    "why-your-business-needs-operating-system",
    "wrappers-vs-governed-ai",
    "zapier-vs-make-which-automation-platform-is-right-for-your-business-1777162506647",
] as const;

describe("published iSystem blog evidence policy", () => {
    it("ships a reviewed source allowlist for every published article topic", () => {
        assert.ok(migrationSource, "expected the curated blog evidence migration");
        for (const slug of PUBLISHED_BLOG_SLUGS) {
            assert.ok(migrationSource.includes(`'${slug}'`), `missing curated sources for ${slug}`);
        }
    });

    it("enforces curated mode and validates public source safety in SQL", () => {
        assert.match(migrationSource, /public_evidence_mode/);
        assert.match(migrationSource, /public_evidence_sources/);
        assert.match(migrationSource, /public_evidence_enabled/);
        assert.match(migrationSource, /jsonb_array_length/);
        assert.match(migrationSource, /https:\/\//);
        assert.match(migrationSource, /\.internal/);
        assert.doesNotMatch(migrationSource, /private-azure-llm-endpoint/i);
    });
});
