import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    PUBLIC_PAGE_REGISTRY,
    findPublicInternalInstructionLeaks,
    migrateLegacyPublicPageData,
    preserveProtectedPublicPageSemantics,
    resolvePublicPageDefinition,
    validateProtectedPublicPageEdit,
    validatePublicPageData,
    type PublicPagePuckDataV2,
} from "./public-page-contract";

describe("public page contract", () => {
    it("registers the strategic public route families", () => {
        assert.equal(resolvePublicPageDefinition("/en/" )?.id, "home");
        assert.equal(resolvePublicPageDefinition("/nl/services")?.id, "services");
        assert.equal(resolvePublicPageDefinition("/ar/system-proof")?.id, "system-proof");
        assert.equal(resolvePublicPageDefinition("/ar/case-studies/legal-firm")?.id, "case-study");
        assert.equal(resolvePublicPageDefinition("/en/blog/example")?.editingMode, "hybrid");
        assert.equal(resolvePublicPageDefinition("/en/booking/payment-received")?.editingMode, "system");
        assert.equal(resolvePublicPageDefinition("/en/tools/ai-visibility-checker")?.id, "tool-detail");
        assert.equal(resolvePublicPageDefinition("/en/newsletter")?.id, "newsletter");
        assert.equal(resolvePublicPageDefinition("/en/projects")?.id, "projects");
        assert.equal(resolvePublicPageDefinition("/en/privacy")?.id, "privacy");
        assert.ok(PUBLIC_PAGE_REGISTRY.every((definition) => definition.allowedBlocks.length > 0));
    });

    it("migrates legacy blocks without silently dropping unsupported content", () => {
        const result = migrateLegacyPublicPageData({
            root: { props: { title: "Home", locale: "en", pageKind: "home" } },
            content: [
                { type: "HeroSection", props: { headline: "Outcome" } },
                { type: "UnknownLegacyBlock", props: { copy: "keep this in diagnostics" } },
            ],
        }, "home");

        assert.equal(result.data.schemaVersion, 2);
        assert.equal(result.data.content[0]?.type, "OutcomeHero");
        assert.equal(result.data.content[0]?.props.id, "home-outcome-hero-0");
        assert.equal(result.diagnostics.unsupported.length, 1);
        assert.equal(result.diagnostics.unsupported[0]?.type, "UnknownLegacyBlock");
        assert.equal(result.diagnostics.unsupported[0]?.index, 1);
    });

    it("blocks publication when a required core block is missing", () => {
        const data: PublicPagePuckDataV2 = {
            schemaVersion: 2,
            root: { props: { title: "Home", locale: "en", pageKind: "home" } },
            content: [{ type: "OutcomeHero", props: { id: "hero" } }],
            zones: {},
        };

        const result = validatePublicPageData(data, resolvePublicPageDefinition("/")!);
        assert.equal(result.ok, false);
        assert.deepEqual(result.issues.map((issue) => issue.code), [
            "required_block_missing",
            "required_block_missing",
            "required_block_missing",
        ]);
    });

    it("preserves block ids and blocks protected commercial semantics from Puck edits", () => {
        const previous: PublicPagePuckDataV2 = {
            schemaVersion: 2,
            root: { props: { title: "Booking", locale: "en", pageKind: "booking", metadata: { canonicalPath: "/booking" } } },
            content: [{ type: "BookingExperience", props: { id: "booking", paymentProvider: "paypal_checkout", endpoint: "/api/booking" } }],
        };
        const next: PublicPagePuckDataV2 = {
            ...previous,
            root: { props: { ...previous.root.props, metadata: { canonicalPath: "/contact" } } },
            content: [{ type: "BookingExperience", props: { id: "booking", paymentProvider: "manual_revolut_pro", endpoint: "/api/other" } }],
        };

        const issues = validateProtectedPublicPageEdit(previous, next);
        assert.equal(issues.length, 3);
        assert.ok(issues.every((issue) => issue.code === "protected_field_mutated"));
    });

    it("rejects unsafe public URLs at publication time", () => {
        const data: PublicPagePuckDataV2 = {
            schemaVersion: 2,
            root: { props: { title: "Home", locale: "en", pageKind: "home" } },
            content: [
                { type: "OutcomeHero", props: { id: "hero", primaryCtaHref: "javascript:alert(1)" } },
                { type: "SystemMap", props: { id: "map" } },
                { type: "OfferComparison", props: { id: "offers" } },
                { type: "FinalDecisionCta", props: { id: "cta" } },
            ],
        };

        const result = validatePublicPageData(data, resolvePublicPageDefinition("/")!);
        assert.equal(result.ok, false);
        assert.equal(result.issues.some((issue) => issue.code === "unsafe_url"), true);
    });

    it("blocks internal AI instructions and editor scaffolding from publication", () => {
        const data: PublicPagePuckDataV2 = {
            schemaVersion: 2,
            root: { props: { title: "Home", locale: "en", pageKind: "home" } },
            content: [
                { type: "OutcomeHero", props: { id: "hero", headline: "You are the AI Content Assistant. Read this as the upstream brief." } },
                { type: "SystemMap", props: { id: "map" } },
                { type: "OfferComparison", props: { id: "offers" } },
                { type: "FinalDecisionCta", props: { id: "cta" } },
            ],
        };

        const result = validatePublicPageData(data, resolvePublicPageDefinition("/")!);
        assert.equal(result.ok, false);
        assert.equal(result.issues.some((issue) => issue.code === "internal_instruction_exposed"), true);
        assert.ok(findPublicInternalInstructionLeaks(data).length >= 2);
        assert.deepEqual(findPublicInternalInstructionLeaks("A practical article about prompt design."), []);
    });

    it("strips protected semantics from drafts while preserving application-owned values", () => {
        const previous: PublicPagePuckDataV2 = {
            schemaVersion: 2,
            root: { props: { title: "Booking", locale: "en", pageKind: "booking", metadata: { canonicalPath: "/booking", noindex: false } } },
            content: [{ type: "BookingExperience", props: { id: "booking", paymentProvider: "paypal_checkout" } }],
        };
        const next: PublicPagePuckDataV2 = {
            ...previous,
            root: { props: { ...previous.root.props, metadata: { canonicalPath: "/attacker", noindex: true } } },
            content: [
                { type: "BookingExperience", props: { id: "booking", paymentProvider: "manual_revolut_pro" } },
                { type: "BookingExperience", props: { id: "new-booking", endpoint: "/api/unsafe" } },
            ],
        };

        const sanitized = preserveProtectedPublicPageSemantics(previous, next);
        assert.equal(sanitized.content[0]?.props.paymentProvider, "paypal_checkout");
        assert.equal("endpoint" in (sanitized.content[1]?.props ?? {}), false);
        assert.equal(sanitized.root.props.metadata?.canonicalPath, "/booking");
        assert.equal(sanitized.root.props.metadata?.noindex, false);
    });
});
