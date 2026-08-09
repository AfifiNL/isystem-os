import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
    ISYSTEM_PUBLIC_CAPABILITIES,
    ISYSTEM_PUBLIC_SCOPE_COLUMNS,
    ISYSTEM_PUBLIC_SYSTEMS,
} from "@/features/marketing/isystem-public-truth";
import { publicPuckComponents } from "@/features/builder/public-puck-blocks";
import { isystemAgencyConfig } from "@/features/templates/configs/isystem-agency";
import { buildPublicTemplateConfig } from "@/features/templates/public-template-payload";
import {
    createIsystemCaseStudyPageData,
    createIsystemProofIndexPageData,
    createIsystemPublicPageData,
} from "./isystem-public-page-seeds";
import { findPublicInternalInstructionLeaks } from "./public-page-contract";
import { renderPublicPageBlock } from "./public-page-renderer";

const publicLayoutSource = readFileSync(
    new URL("../../app/(public)/layout.tsx", import.meta.url),
    "utf8",
);
const rendererSource = readFileSync(
    new URL("./public-page-renderer.tsx", import.meta.url),
    "utf8",
);
const publicFallbackSources = [
    readFileSync(
        new URL("../templates/ui/theme-renderers/isystem-agency-renderer-data.ts", import.meta.url),
        "utf8",
    ),
    readFileSync(
        new URL("../builder/facility-services-page-data.ts", import.meta.url),
        "utf8",
    ),
];
const requiredLocalizedPropsByBlock: Record<string, string[]> = {
    OutcomeHero: ["eyebrow", "headline", "subtitle", "primaryCtaLabel", "secondaryCtaLabel", "commercialLine", "evidenceEyebrow", "evidenceTitle", "evidenceDescription"],
    ProblemRecognition: ["eyebrow", "title", "points"],
    SystemMap: ["eyebrow", "title", "description"],
    OperatingLoop: ["eyebrow", "title", "description", "steps"],
    ServiceArchitecture: ["eyebrow", "title", "description"],
    OfferComparison: ["eyebrow", "title", "description", "fitCallLabel", "recommendedLabel", "foundationDescription", "growthDescription"],
    ScopeBoundary: ["eyebrow", "title", "description"],
    MethodTimeline: ["eyebrow", "title", "steps"],
    FeatureStatusMatrix: ["eyebrow", "title"],
    FounderWorkingModel: ["eyebrow", "title", "description"],
    FitAndNonFit: ["fitEyebrow", "fitTitle", "fitDescription", "nonFitEyebrow", "nonFitTitle", "nonFitDescription"],
    QuestionAccordion: ["eyebrow", "title", "items"],
    FinalDecisionCta: ["eyebrow", "title", "description", "label"],
    ContactExperience: ["eyebrow", "title", "description", "primaryLabel", "secondaryLabel"],
};

function assertLocalizedTriples(value: unknown, path: string): void {
    if (Array.isArray(value)) {
        value.forEach((item, index) => assertLocalizedTriples(item, `${path}[${index}]`));
        return;
    }
    if (!value || typeof value !== "object") return;

    const record = value as Record<string, unknown>;
    if (typeof record.en === "string") {
        assert.equal(typeof record.nl, "string", `${path}.nl is missing`);
        assert.equal(typeof record.ar, "string", `${path}.ar is missing`);
        assert.ok((record.nl as string).trim().length > 0, `${path}.nl is empty`);
        assert.ok((record.ar as string).trim().length > 0, `${path}.ar is empty`);
    }
    Object.entries(record).forEach(([key, item]) => assertLocalizedTriples(item, `${path}.${key}`));
}

describe("iSystem public copy integrity", () => {
    it("keeps authoring prompts and theme dictionaries out of the public payload", () => {
        const publicConfig = buildPublicTemplateConfig(isystemAgencyConfig) as unknown as Record<string, unknown>;
        const serialized = JSON.stringify(publicConfig);

        assert.equal("aiContext" in publicConfig, false);
        assert.equal("dashboard" in publicConfig, false);
        assert.equal("ai_system_context" in publicConfig, false);
        assert.equal("aiSystemContext" in publicConfig, false);
        assert.doesNotMatch(serialized, /You are the AI Content Assistant|Draft a sector landing page|return only valid/i);
        assert.doesNotMatch(publicLayoutSource, /getDictionary/);
        assert.match(publicLayoutSource, /buildPublicTemplateConfig/);
    });

    it("renders real service architecture and scope blocks instead of generic problem copy", () => {
        assert.match(rendererSource, /case "ServiceArchitecture": return <ServiceArchitecture/);
        assert.match(rendererSource, /case "ScopeBoundary": return <ScopeBoundary/);
        assert.doesNotMatch(rendererSource, /composed in Puck while commercial and functional facts remain owned by the application/);
        assert.doesNotMatch(rendererSource, /current public snapshot/);
        assert.doesNotMatch(rendererSource, /payment, consent, authentication, and endpoint behavior owned by the application/);
    });

    it("renders localized fallback copy beside numbered rows", () => {
        const recognition = renderToStaticMarkup(renderPublicPageBlock({
            type: "ProblemRecognition",
            props: { id: "recognition" },
        }, "en", "fixture"));
        const operatingLoop = renderToStaticMarkup(renderPublicPageBlock({
            type: "OperatingLoop",
            props: { id: "loop" },
        }, "nl", "fixture"));

        assert.match(recognition, /Your public presence, sales follow-up, and delivery records/);
        assert.match(recognition, />01</);
        assert.match(operatingLoop, /Beoordeeld bewijs/);
        assert.match(operatingLoop, /Bewijs wordt gecontroleerd voordat het een publieke claim wordt/);
        assert.match(operatingLoop, /Klantwerk en dossier/);
        assert.match(operatingLoop, /Operationele route/);
    });

    it("covers every operating system with a complete, localized service inventory", () => {
        assert.ok(ISYSTEM_PUBLIC_CAPABILITIES.length >= 20);
        assert.deepEqual(ISYSTEM_PUBLIC_SCOPE_COLUMNS.map((column) => column.id), [
            "foundation",
            "growth",
            "embedded",
            "boundary",
        ]);

        for (const system of ISYSTEM_PUBLIC_SYSTEMS) {
            const capabilities = ISYSTEM_PUBLIC_CAPABILITIES.filter(
                (capability) => capability.systemId === system.id && capability.status !== "roadmap",
            );
            assert.ok(capabilities.length >= 3, `${system.id} needs at least three public capabilities`);
            for (const capability of capabilities) {
                assert.ok(capability.label.en && capability.label.nl && capability.label.ar);
                assert.ok(capability.publicDescription.en && capability.publicDescription.nl && capability.publicDescription.ar);
            }
        }
    });

    it("ships the complete services decision sequence without internal instructions", () => {
        const services = createIsystemPublicPageData("services");
        const types = services.content.map((block) => block.type);

        assert.deepEqual(types, [
            "OutcomeHero",
            "ServiceArchitecture",
            "OperatingLoop",
            "OfferComparison",
            "ScopeBoundary",
            "MethodTimeline",
            "FounderWorkingModel",
            "QuestionAccordion",
            "FinalDecisionCta",
        ]);
        assert.deepEqual(findPublicInternalInstructionLeaks(services), []);
        assert.deepEqual(findPublicInternalInstructionLeaks(createIsystemPublicPageData("home")), []);
    });

    it("rejects workflow markers, machine reason codes, and implementation identifiers", () => {
        const leaks = findPublicInternalInstructionLeaks({
            review: "[AWAITING NATIVE REVIEW — do not publish]",
            evidence: "no_primary_or_near_primary_numeric_claim_available",
            portal: "Membership lives in client_portal_users and uses getPartnerPortalAccess.",
            billing: "The ledger stores costs in millicents.",
        });

        assert.equal(leaks.length, 4);
    });

    it("keeps internal billing units out of public fallbacks and remediation copy", () => {
        publicFallbackSources.forEach((source) => {
            assert.doesNotMatch(source, /\bmillicents?\b/i);
        });
    });

    it("keeps the contact journey concise and avoids repeating the same decision CTA", () => {
        const contact = createIsystemPublicPageData("contact");
        const types = contact.content.map((block) => block.type);
        const hero = contact.content.find((block) => block.type === "OutcomeHero");
        const experience = contact.content.find((block) => block.type === "ContactExperience");

        assert.deepEqual(types, ["OutcomeHero", "ContactExperience", "FitAndNonFit"]);
        assert.notDeepEqual(hero?.props.headline, experience?.props.title);
        assert.equal(hero?.props.showCommercial, false);
        assert.deepEqual(findPublicInternalInstructionLeaks(contact), []);
    });

    it("seeds every visible semantic block with complete Dutch and Arabic copy", () => {
        const pages = [
            ...(["home", "services", "about", "contact", "system-proof"] as const).map(createIsystemPublicPageData),
            createIsystemCaseStudyPageData(),
            createIsystemProofIndexPageData(),
        ];

        for (const page of pages) {
            for (const publicBlock of page.content) {
                const requiredProps = requiredLocalizedPropsByBlock[publicBlock.type] ?? [];
                for (const key of requiredProps) {
                    assert.notEqual(publicBlock.props[key], undefined, `${publicBlock.props.id}.${key} is not seeded`);
                }
                assertLocalizedTriples(publicBlock.props, String(publicBlock.props.id));
            }
        }
    });

    it("does not render canonical English fallback sentences on Dutch or Arabic public pages", () => {
        const forbiddenEnglishCopy = [
            "Book the free Systems Fit Call",
            "See how the system works",
            "The operating question",
            "Can the next buyer, the next delivery step, and the next decision see the same system?",
            "Start with a Fit Call. Use a Blueprint when the system needs to be mapped before implementation.",
            "For a broader operating loop",
            "A small number of decisions, made in the right order.",
            "The person who designed the system is accountable for the work.",
            "Owner-led Dutch service firms that need the operation to become legible.",
            "Not a cheap brochure site, an unmetered AI sandbox, or a 24/7 enterprise delivery team.",
            "Start with the question the system needs to answer.",
            "Book the free Fit Call",
            "Email Hossam",
        ];

        for (const locale of ["nl", "ar"] as const) {
            for (const pageKind of ["home", "services", "about", "contact", "system-proof"] as const) {
                const page = createIsystemPublicPageData(pageKind);
                const markup = page.content
                    .map((publicBlock) => renderToStaticMarkup(renderPublicPageBlock(publicBlock, locale, "fixture")))
                    .join("\n");

                for (const phrase of forbiddenEnglishCopy) {
                    assert.doesNotMatch(markup, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${locale}/${pageKind} leaked: ${phrase}`);
                }
            }
        }
    });

    it("keeps new builder blocks and legacy English-only values locale-safe", () => {
        for (const [type, component] of Object.entries(publicPuckComponents)) {
            assertLocalizedTriples(component.defaultProps, `builder.${type}`);
        }

        const legacyDutch = renderToStaticMarkup(renderPublicPageBlock({
            type: "FinalDecisionCta",
            props: {
                id: "legacy-final",
                title: { en: "An English-only saved title" },
                description: "An English-only saved description",
                label: { en: "An English-only saved button" },
            },
        }, "nl", "fixture"));
        const legacyArabic = renderToStaticMarkup(renderPublicPageBlock({
            type: "ContactExperience",
            props: {
                id: "legacy-contact",
                title: { en: "An English-only saved title" },
                description: "An English-only saved description",
            },
        }, "ar", "fixture"));

        assert.doesNotMatch(legacyDutch, /An English-only saved/);
        assert.match(legacyDutch, /Begin met de vraag die het systeem moet beantwoorden/);
        assert.doesNotMatch(legacyArabic, /An English-only saved/);
        assert.match(legacyArabic, /محادثة واحدة قبل أي عرض/);
    });
});
