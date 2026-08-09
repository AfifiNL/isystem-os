import type { Locale } from "@/features/templates/types";

export type PublicPageEditingMode = "composition" | "hybrid" | "system";
export type PublicPageChromeMode = "default" | "minimal" | "hidden";
export type PublicPageLocalePolicy = "full" | "transactional" | "inherited";

export interface PublicPageMetadata {
    seoTitle?: string;
    seoDescription?: string;
    heroMedia?: string;
    canonicalPath?: string;
    noindex?: boolean;
    pageIntent?: string;
    audienceType?: string;
    conversionGoal?: string;
}

export interface PublicPagePuckBlock {
    type: string;
    props: Record<string, unknown> & { id?: string };
}

export interface PublicPagePuckDataV2 {
    schemaVersion: 2;
    root: {
        props: {
            title: string;
            locale: Locale;
            pageKind: string;
            pageIntent?: string;
            presetId?: string;
            themeVariant?: "default" | "editorial" | "proof" | "transactional";
            chromeMode?: PublicPageChromeMode;
            metadata?: PublicPageMetadata;
        };
    };
    content: PublicPagePuckBlock[];
    zones?: Record<string, PublicPagePuckBlock[]>;
}

export interface PublicPageDefinition {
    id: string;
    routePattern: string;
    pageKind: string;
    editingMode: PublicPageEditingMode;
    contentSlug?: string;
    allowedBlocks: readonly string[];
    requiredBlocks?: readonly string[];
    dataProvider?: string;
    chromeMode: PublicPageChromeMode;
    localePolicy: PublicPageLocalePolicy;
}

export interface PublicPageMigrationDiagnostics {
    converted: Array<{ from: string; to: string; index: number }>;
    unsupported: Array<{ type: string; index: number; props: Record<string, unknown> }>;
    warnings: string[];
}

export interface PublicPageValidationIssue {
    code:
        | "schema_version_invalid"
        | "root_invalid"
        | "content_invalid"
        | "unknown_block"
        | "required_block_missing"
        | "locale_invalid"
        | "unsafe_url"
        | "internal_instruction_exposed"
        | "protected_field_mutated";
    message: string;
    blockType?: string;
    index?: number;
}

export type PublicPageValidationResult =
    | { ok: true; issues: [] }
    | { ok: false; issues: PublicPageValidationIssue[] };

const FOUNDATION_BLOCKS = [
    "Section",
    "Container",
    "Columns",
    "Stack",
    "Rule",
    "Spacer",
    "SurfaceBand",
] as const;

const NARRATIVE_BLOCKS = [
    "OutcomeHero",
    "EditorialLead",
    "ProblemRecognition",
    "SystemMap",
    "OperatingLoop",
    "ServiceArchitecture",
    "OfferComparison",
    "ScopeBoundary",
    "MethodTimeline",
    "FounderWorkingModel",
    "FitAndNonFit",
    "QuestionAccordion",
    "FinalDecisionCta",
] as const;

const EVIDENCE_BLOCKS = [
    "ProductEvidenceWindow",
    "AnnotatedWorkspaceView",
    "WorkflowEvidence",
    "ProofLedger",
    "FeatureStatusMatrix",
    "OutcomeCaseStudy",
    "MetricWithMethod",
    "TrustControlGrid",
    "SourceMethodology",
    "DeliveryChangelog",
    "DemoEvidenceGrid",
] as const;

const DATA_BOUND_BLOCKS = [
    "ArticleCollection",
    "PodcastCollection",
    "VideoCollection",
    "ResourceCollection",
    "CaseStudyCollection",
    "PublicToolCollection",
    "RelatedContent",
    "SearchPerformanceEvidence",
] as const;

const PROTECTED_BLOCKS = [
    "ContactExperience",
    "BookingExperience",
    "PaymentReturnSummary",
    "NewsletterSignup",
    "NewsletterPreferenceAction",
    "ResourceDownload",
    "PublicToolExperience",
    "SharedToolResult",
    "AuthExperience",
] as const;

const COMPATIBILITY_BLOCKS = ["SeoSupportBlock"] as const;

export const PUBLIC_BLOCK_TYPES = [
    ...FOUNDATION_BLOCKS,
    ...NARRATIVE_BLOCKS,
    ...EVIDENCE_BLOCKS,
    ...DATA_BOUND_BLOCKS,
    ...PROTECTED_BLOCKS,
    ...COMPATIBILITY_BLOCKS,
] as const;

const SYSTEM_BLOCKS = [
    ...FOUNDATION_BLOCKS,
    "QuestionAccordion",
    ...PROTECTED_BLOCKS,
    ...COMPATIBILITY_BLOCKS,
] as const;

const COMPOSITION_BLOCKS = [
    ...FOUNDATION_BLOCKS,
    ...NARRATIVE_BLOCKS,
    ...EVIDENCE_BLOCKS,
    ...COMPATIBILITY_BLOCKS,
] as const;

const HYBRID_BLOCKS = [
    ...FOUNDATION_BLOCKS,
    ...NARRATIVE_BLOCKS,
    ...EVIDENCE_BLOCKS,
    ...DATA_BOUND_BLOCKS,
    ...PROTECTED_BLOCKS,
    ...COMPATIBILITY_BLOCKS,
] as const;

export const PUBLIC_PAGE_REGISTRY: readonly PublicPageDefinition[] = [
    {
        id: "home",
        routePattern: "/",
        pageKind: "home",
        editingMode: "composition",
        contentSlug: "home",
        allowedBlocks: COMPOSITION_BLOCKS,
        requiredBlocks: ["OutcomeHero", "SystemMap", "OfferComparison", "FinalDecisionCta"],
        chromeMode: "default",
        localePolicy: "full",
    },
    {
        id: "services",
        routePattern: "/services",
        pageKind: "services",
        editingMode: "composition",
        contentSlug: "services",
        allowedBlocks: COMPOSITION_BLOCKS,
        requiredBlocks: ["ServiceArchitecture", "OfferComparison", "ScopeBoundary", "FinalDecisionCta"],
        chromeMode: "default",
        localePolicy: "full",
    },
    {
        id: "system-proof",
        routePattern: "/system-proof",
        pageKind: "system-proof",
        editingMode: "composition",
        allowedBlocks: COMPOSITION_BLOCKS,
        requiredBlocks: ["OutcomeHero", "SystemMap", "OperatingLoop", "FeatureStatusMatrix", "FinalDecisionCta"],
        chromeMode: "default",
        localePolicy: "full",
    },
    {
        id: "about",
        routePattern: "/about",
        pageKind: "about",
        editingMode: "composition",
        contentSlug: "about",
        allowedBlocks: COMPOSITION_BLOCKS,
        requiredBlocks: ["FounderWorkingModel", "FinalDecisionCta"],
        chromeMode: "default",
        localePolicy: "full",
    },
    {
        id: "contact",
        routePattern: "/contact",
        pageKind: "contact",
        editingMode: "composition",
        contentSlug: "contact",
        allowedBlocks: [...COMPOSITION_BLOCKS, "ContactExperience"],
        requiredBlocks: ["ContactExperience", "FinalDecisionCta"],
        chromeMode: "default",
        localePolicy: "full",
    },
    {
        id: "case-study",
        routePattern: "/case-studies/:slug",
        pageKind: "case-study",
        editingMode: "composition",
        allowedBlocks: COMPOSITION_BLOCKS,
        requiredBlocks: ["OutcomeCaseStudy", "ProofLedger", "FinalDecisionCta"],
        chromeMode: "default",
        localePolicy: "full",
    },
    {
        id: "editorial-index",
        routePattern: "/blog",
        pageKind: "blog-index",
        editingMode: "hybrid",
        allowedBlocks: HYBRID_BLOCKS,
        requiredBlocks: ["ArticleCollection"],
        dataProvider: "articles",
        chromeMode: "default",
        localePolicy: "full",
    },
    {
        id: "editorial-detail",
        routePattern: "/blog/:slug",
        pageKind: "blog-detail",
        editingMode: "hybrid",
        allowedBlocks: HYBRID_BLOCKS,
        requiredBlocks: ["RelatedContent"],
        dataProvider: "article",
        chromeMode: "default",
        localePolicy: "full",
    },
    {
        id: "podcast",
        routePattern: "/podcast",
        pageKind: "podcast",
        editingMode: "hybrid",
        allowedBlocks: HYBRID_BLOCKS,
        requiredBlocks: ["PodcastCollection"],
        dataProvider: "podcasts",
        chromeMode: "default",
        localePolicy: "full",
    },
    {
        id: "videos",
        routePattern: "/videos",
        pageKind: "videos",
        editingMode: "hybrid",
        allowedBlocks: HYBRID_BLOCKS,
        requiredBlocks: ["VideoCollection"],
        dataProvider: "videos",
        chromeMode: "default",
        localePolicy: "full",
    },
    {
        id: "resources",
        routePattern: "/resources",
        pageKind: "resources",
        editingMode: "hybrid",
        allowedBlocks: HYBRID_BLOCKS,
        requiredBlocks: ["ResourceCollection"],
        dataProvider: "resources",
        chromeMode: "default",
        localePolicy: "full",
    },
    {
        id: "tool-index",
        routePattern: "/tools",
        pageKind: "tool-index",
        editingMode: "hybrid",
        allowedBlocks: HYBRID_BLOCKS,
        requiredBlocks: ["PublicToolCollection"],
        dataProvider: "public-tools",
        chromeMode: "default",
        localePolicy: "full",
    },
    {
        id: "tool-detail",
        routePattern: "/tools/:slug",
        pageKind: "tool-detail",
        editingMode: "hybrid",
        allowedBlocks: HYBRID_BLOCKS,
        requiredBlocks: ["PublicToolExperience"],
        dataProvider: "public-tool",
        chromeMode: "default",
        localePolicy: "full",
    },
    {
        id: "booking",
        routePattern: "/booking",
        pageKind: "booking",
        editingMode: "hybrid",
        allowedBlocks: HYBRID_BLOCKS,
        requiredBlocks: ["BookingExperience"],
        dataProvider: "booking",
        chromeMode: "default",
        localePolicy: "transactional",
    },
    {
        id: "booking-payment-return",
        routePattern: "/booking/payment-received",
        pageKind: "booking-payment-return",
        editingMode: "system",
        allowedBlocks: SYSTEM_BLOCKS,
        requiredBlocks: ["PaymentReturnSummary"],
        dataProvider: "payment-return",
        chromeMode: "minimal",
        localePolicy: "transactional",
    },
    {
        id: "projects",
        routePattern: "/projects",
        pageKind: "projects",
        editingMode: "hybrid",
        allowedBlocks: HYBRID_BLOCKS,
        requiredBlocks: ["DemoEvidenceGrid"],
        dataProvider: "projects",
        chromeMode: "default",
        localePolicy: "full",
    },
    {
        id: "audit",
        routePattern: "/audit",
        pageKind: "audit",
        editingMode: "hybrid",
        allowedBlocks: HYBRID_BLOCKS,
        requiredBlocks: ["PublicToolExperience"],
        dataProvider: "audit",
        chromeMode: "default",
        localePolicy: "full",
    },
    {
        id: "newsletter",
        routePattern: "/newsletter",
        pageKind: "newsletter",
        editingMode: "hybrid",
        allowedBlocks: HYBRID_BLOCKS,
        requiredBlocks: ["NewsletterSignup"],
        dataProvider: "newsletter",
        chromeMode: "default",
        localePolicy: "full",
    },
    {
        id: "privacy",
        routePattern: "/privacy",
        pageKind: "privacy",
        editingMode: "composition",
        allowedBlocks: COMPOSITION_BLOCKS,
        chromeMode: "default",
        localePolicy: "full",
    },
    {
        id: "terms",
        routePattern: "/terms",
        pageKind: "terms",
        editingMode: "composition",
        allowedBlocks: COMPOSITION_BLOCKS,
        chromeMode: "default",
        localePolicy: "full",
    },
    {
        id: "auth",
        routePattern: "/login|/reset-password",
        pageKind: "auth",
        editingMode: "system",
        allowedBlocks: SYSTEM_BLOCKS,
        requiredBlocks: ["AuthExperience"],
        dataProvider: "auth",
        chromeMode: "hidden",
        localePolicy: "transactional",
    },
    {
        id: "transactional",
        routePattern: "/:system-route",
        pageKind: "transactional",
        editingMode: "system",
        allowedBlocks: SYSTEM_BLOCKS,
        requiredBlocks: ["AuthExperience"],
        chromeMode: "minimal",
        localePolicy: "transactional",
    },
    {
        id: "custom-composition",
        routePattern: "/:slug",
        pageKind: "custom",
        editingMode: "composition",
        allowedBlocks: COMPOSITION_BLOCKS,
        chromeMode: "default",
        localePolicy: "full",
    },
] as const;

const RESERVED_ROOT_ROUTES = new Set([
    "about",
    "audit",
    "booking",
    "blog",
    "case-studies",
    "contact",
    "login",
    "newsletter",
    "outreach",
    "podcast",
    "privacy",
    "projects",
    "reset-password",
    "services",
    "system-proof",
    "terms",
    "tools",
    "videos",
]);

function stripLocale(pathname: string): string {
    const normalized = pathname.split("?")[0]?.replace(/\/+$/, "") || "/";
    const segments = normalized.split("/").filter(Boolean);
    if (segments[0] === "en" || segments[0] === "nl" || segments[0] === "ar") {
        segments.shift();
    }
    return `/${segments.join("/")}`.replace(/\/$/, "") || "/";
}

export function resolvePublicPageDefinition(pathname: string): PublicPageDefinition | undefined {
    const route = stripLocale(pathname);
    if (route === "/") return PUBLIC_PAGE_REGISTRY.find((definition) => definition.id === "home");
    if (route === "/services") return PUBLIC_PAGE_REGISTRY.find((definition) => definition.id === "services");
    if (route === "/system-proof") return PUBLIC_PAGE_REGISTRY.find((definition) => definition.id === "system-proof");
    if (route === "/about") return PUBLIC_PAGE_REGISTRY.find((definition) => definition.id === "about");
    if (route === "/contact") return PUBLIC_PAGE_REGISTRY.find((definition) => definition.id === "contact");
    if (route.startsWith("/case-studies/")) return PUBLIC_PAGE_REGISTRY.find((definition) => definition.id === "case-study");
    if (route === "/blog") return PUBLIC_PAGE_REGISTRY.find((definition) => definition.id === "editorial-index");
    if (route.startsWith("/blog/")) return PUBLIC_PAGE_REGISTRY.find((definition) => definition.id === "editorial-detail");
    if (route === "/podcast" || route.startsWith("/podcast/")) return PUBLIC_PAGE_REGISTRY.find((definition) => definition.id === "podcast");
    if (route === "/videos" || route.startsWith("/videos/")) return PUBLIC_PAGE_REGISTRY.find((definition) => definition.id === "videos");
    if (route === "/resources" || route.startsWith("/resources/")) return PUBLIC_PAGE_REGISTRY.find((definition) => definition.id === "resources");
    if (route === "/tools") return PUBLIC_PAGE_REGISTRY.find((definition) => definition.id === "tool-index");
    if (route.startsWith("/tools/")) return PUBLIC_PAGE_REGISTRY.find((definition) => definition.id === "tool-detail");
    if (route === "/booking") return PUBLIC_PAGE_REGISTRY.find((definition) => definition.id === "booking");
    if (route === "/booking/payment-received") return PUBLIC_PAGE_REGISTRY.find((definition) => definition.id === "booking-payment-return");
    if (route === "/projects") return PUBLIC_PAGE_REGISTRY.find((definition) => definition.id === "projects");
    if (route === "/audit") return PUBLIC_PAGE_REGISTRY.find((definition) => definition.id === "audit");
    if (route === "/newsletter") return PUBLIC_PAGE_REGISTRY.find((definition) => definition.id === "newsletter");
    if (route === "/privacy") return PUBLIC_PAGE_REGISTRY.find((definition) => definition.id === "privacy");
    if (route === "/terms") return PUBLIC_PAGE_REGISTRY.find((definition) => definition.id === "terms");
    if (route === "/login" || route === "/reset-password") return PUBLIC_PAGE_REGISTRY.find((definition) => definition.id === "auth");

    const rootSegment = route.split("/").filter(Boolean)[0];
    if (rootSegment && RESERVED_ROOT_ROUTES.has(rootSegment)) {
        return PUBLIC_PAGE_REGISTRY.find((definition) => definition.id === "transactional");
    }
    return PUBLIC_PAGE_REGISTRY.find((definition) => definition.id === "custom-composition");
}

const LEGACY_BLOCK_MIGRATIONS: Record<string, string> = {
    HeroSection: "OutcomeHero",
    ServicesShowcaseBlock: "ServiceArchitecture",
    BasicProComparisonBlock: "OfferComparison",
    ContactBlock: "ContactExperience",
    AboutBlock: "FounderWorkingModel",
    SeoSupportBlock: "SeoSupportBlock",
};

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

function localizedLocale(value: unknown): Locale {
    return value === "nl" || value === "ar" ? value : "en";
}

export function migrateLegacyPublicPageData(
    input: unknown,
    pageKind = "custom",
): { data: PublicPagePuckDataV2; diagnostics: PublicPageMigrationDiagnostics } {
    const candidate = asRecord(input);
    const root = asRecord(candidate.root);
    const rootProps = asRecord(root.props);
    const rawContent = Array.isArray(candidate.content) ? candidate.content : [];
    const diagnostics: PublicPageMigrationDiagnostics = {
        converted: [],
        unsupported: [],
        warnings: [],
    };

    const content: PublicPagePuckBlock[] = rawContent.map((value, index) => {
        const block = asRecord(value);
        const from = typeof block.type === "string" ? block.type : "UnknownBlock";
        const to = LEGACY_BLOCK_MIGRATIONS[from];
        const props = asRecord(block.props);
        const id = typeof props.id === "string" && props.id.length > 0
            ? props.id
            : `${pageKind}-${(to ?? from).replace(/Block$/, "").replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()}-${index}`;
        const nextProps = { ...props, id };

        if (to) {
            if (to !== from) diagnostics.converted.push({ from, to, index });
            return { type: to, props: nextProps };
        }

        diagnostics.unsupported.push({ type: from, index, props: nextProps });
        return { type: from, props: nextProps };
    });

    if (rawContent.length === 0) diagnostics.warnings.push("The source layout contained no content blocks.");

    return {
        data: {
            schemaVersion: 2,
            root: {
                props: {
                    title: typeof rootProps.title === "string" && rootProps.title.length > 0 ? rootProps.title : `Site ${pageKind}`,
                    locale: localizedLocale(rootProps.locale),
                    pageKind: typeof rootProps.pageKind === "string" ? rootProps.pageKind : pageKind,
                    pageIntent: typeof rootProps.pageIntent === "string" ? rootProps.pageIntent : undefined,
                    presetId: typeof rootProps.presetId === "string" ? rootProps.presetId : undefined,
                    themeVariant: rootProps.themeVariant === "proof" || rootProps.themeVariant === "editorial" || rootProps.themeVariant === "transactional"
                        ? rootProps.themeVariant
                        : "default",
                    chromeMode: rootProps.chromeMode === "minimal" || rootProps.chromeMode === "hidden" ? rootProps.chromeMode : "default",
                    metadata: asRecord(rootProps.metadata) as PublicPageMetadata,
                },
            },
            content,
            zones: {},
        },
        diagnostics,
    };
}

function allBlocks(data: PublicPagePuckDataV2): PublicPagePuckBlock[] {
    return [
        ...data.content,
        ...Object.values(data.zones ?? {}).flat(),
    ];
}

const PROTECTED_ROOT_KEYS = new Set(["canonicalPath", "noindex"]);
const PROTECTED_BLOCK_KEYS = new Set([
    "action",
    "authMode",
    "canonical",
    "canonicalPath",
    "consentMode",
    "dataScope",
    "endpoint",
    "method",
    "paymentProvider",
    "paymentRequired",
    "price",
    "priceAmountCents",
    "priceEur",
    "setupPriceEur",
    "monthlyPriceEur",
    "serviceKey",
    "securityPolicy",
]);

function stableSerialize(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
    if (value && typeof value === "object") {
        return `{${Object.entries(value as Record<string, unknown>)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, nested]) => `${JSON.stringify(key)}:${stableSerialize(nested)}`)
            .join(",")}}`;
    }
    return JSON.stringify(value) ?? String(value);
}

const INTERNAL_INSTRUCTION_PATTERNS: readonly RegExp[] = [
    /\byou are (?:an?|the) (?:ai(?: content)?|content|writing|marketing) (?:assistant|agent|model)\b/i,
    /\b(?:ignore|disregard) (?:all |any )?(?:previous|prior) instructions?\b/i,
    /\bread this as (?:the )?upstream brief\b/i,
    /\b(?:system|developer|assistant) prompt\s*:/i,
    /\b(?:output|response) format\s*:/i,
    /\breturn only (?:valid )?(?:json|markdown|html|yaml|xml)\b/i,
    /\bif you are an ai agent\b/i,
    /\bcomposed in puck\b/i,
    /\bowned by the application\b/i,
    /\bcurrent public snapshot\b/i,
    /\[PLACEHOLDER\]/i,
    /\[AWAITING NATIVE REVIEW[^\]]*]/i,
    /\bno_primary_or_near_primary_numeric_claim_available\b/i,
    /\[object Object]/i,
    /\b(?:as an AI language model|here(?:'s| is) (?:the )?(?:draft|page|copy) (?:you )?(?:requested|asked for))\b/i,
    /\b(?:client_portal_users|getPartnerPortalAccess|content_published|contact_subscribed)\b/i,
    /\bmillicents?\b/i,
];

export function findPublicInternalInstructionLeaks(value: unknown): string[] {
    const serialized = stableSerialize(value);
    return INTERNAL_INSTRUCTION_PATTERNS
        .filter((pattern) => pattern.test(serialized))
        .map((pattern) => pattern.source);
}

function isSafePublicUrl(value: unknown): boolean {
    if (typeof value !== "string" || value.trim().length === 0) return true;
    const normalized = value.trim();
    return normalized.startsWith("/")
        || normalized.startsWith("#")
        || normalized.startsWith("mailto:")
        || normalized.startsWith("https://");
}

export function validateProtectedPublicPageEdit(
    previous: PublicPagePuckDataV2,
    next: PublicPagePuckDataV2,
): PublicPageValidationIssue[] {
    const issues: PublicPageValidationIssue[] = [];
    for (const key of PROTECTED_ROOT_KEYS) {
        const before = previous.root.props.metadata?.[key as keyof PublicPageMetadata];
        const after = next.root.props.metadata?.[key as keyof PublicPageMetadata];
        if (stableSerialize(before) !== stableSerialize(after)) {
            issues.push({ code: "protected_field_mutated", message: `The protected root field ${key} cannot be changed in Puck.` });
        }
    }

    const previousBlocks = new Map(allBlocks(previous).map((block) => [block.props.id ?? block.type, block]));
    for (const block of allBlocks(next)) {
        const key = block.props.id ?? block.type;
        const before = previousBlocks.get(key);
        if (!before) {
            for (const propKey of PROTECTED_BLOCK_KEYS) {
                if (Object.prototype.hasOwnProperty.call(block.props, propKey)) {
                    issues.push({
                        code: "protected_field_mutated",
                        message: `The protected field ${propKey} on new ${block.type} cannot be authored in Puck.`,
                        blockType: block.type,
                    });
                }
            }
            continue;
        }
        for (const propKey of PROTECTED_BLOCK_KEYS) {
            if (stableSerialize(before.props[propKey]) !== stableSerialize(block.props[propKey])) {
                issues.push({
                    code: "protected_field_mutated",
                    message: `The protected field ${propKey} on ${block.type} cannot be changed in Puck.`,
                    blockType: block.type,
                });
            }
        }
    }
    return issues;
}

/**
 * Drafts may be saved with editorial warnings, but protected semantics must
 * never be persisted from an editor payload. Existing application-owned
 * values win; protected keys on newly-added blocks are removed entirely.
 */
export function preserveProtectedPublicPageSemantics(
    previous: PublicPagePuckDataV2,
    next: PublicPagePuckDataV2,
): PublicPagePuckDataV2 {
    const previousBlocks = new Map(allBlocks(previous).map((block) => [block.props.id ?? block.type, block]));
    const protectBlocks = (blocks: PublicPagePuckBlock[]): PublicPagePuckBlock[] => blocks.map((block) => {
        const before = previousBlocks.get(block.props.id ?? block.type);
        const props = { ...block.props };
        for (const propKey of PROTECTED_BLOCK_KEYS) {
            if (before && Object.prototype.hasOwnProperty.call(before.props, propKey)) {
                props[propKey] = before.props[propKey];
            } else {
                delete props[propKey];
            }
        }
        return { ...block, props };
    });

    const metadata = { ...(next.root.props.metadata ?? {}) };
    const previousMetadata = previous.root.props.metadata;
    if (Object.prototype.hasOwnProperty.call(previousMetadata ?? {}, "canonicalPath")) {
        metadata.canonicalPath = previousMetadata?.canonicalPath;
    } else {
        delete metadata.canonicalPath;
    }
    if (Object.prototype.hasOwnProperty.call(previousMetadata ?? {}, "noindex")) {
        metadata.noindex = previousMetadata?.noindex;
    } else {
        delete metadata.noindex;
    }

    return {
        ...next,
        root: {
            ...next.root,
            props: { ...next.root.props, metadata },
        },
        content: protectBlocks(next.content),
        zones: Object.fromEntries(Object.entries(next.zones ?? {}).map(([zone, blocks]) => [zone, protectBlocks(blocks)])),
    };
}

export function validatePublicPageData(
    data: unknown,
    definition: PublicPageDefinition,
): PublicPageValidationResult {
    const issues: PublicPageValidationIssue[] = [];
    const candidate = asRecord(data);
    if (candidate.schemaVersion !== 2) {
        issues.push({ code: "schema_version_invalid", message: "Public pages must use schema version 2." });
    }

    const root = asRecord(candidate.root);
    const rootProps = asRecord(root.props);
    if (!root.props || typeof root.props !== "object" || Array.isArray(root.props)) {
        issues.push({ code: "root_invalid", message: "A public page requires root.props." });
    }
    if (!Array.isArray(candidate.content)) {
        issues.push({ code: "content_invalid", message: "A public page requires a content array." });
        return { ok: false, issues };
    }
    if (rootProps.locale !== "en" && rootProps.locale !== "nl" && rootProps.locale !== "ar") {
        issues.push({ code: "locale_invalid", message: "A public page locale must be en, nl, or ar." });
    }
    if (findPublicInternalInstructionLeaks(rootProps).length > 0) {
        issues.push({ code: "internal_instruction_exposed", message: "Public root copy contains an internal authoring instruction." });
    }

    const blocks = allBlocks({
        schemaVersion: 2,
        root: { props: rootProps as PublicPagePuckDataV2["root"]["props"] },
        content: candidate.content as PublicPagePuckBlock[],
        zones: candidate.zones as Record<string, PublicPagePuckBlock[]> | undefined,
    });
    const allowed = new Set(definition.allowedBlocks);
    for (const [index, block] of blocks.entries()) {
        if (!block || typeof block.type !== "string") {
            issues.push({ code: "unknown_block", message: "Every public block must have a type.", index });
            continue;
        }
        if (!allowed.has(block.type)) {
            issues.push({ code: "unknown_block", message: `${block.type} is not allowed on ${definition.id}.`, blockType: block.type, index });
        }
        if (!block.props || typeof block.props !== "object" || Array.isArray(block.props)) {
            issues.push({ code: "content_invalid", message: `${block.type} requires an object of props.`, blockType: block.type, index });
        } else {
            if (findPublicInternalInstructionLeaks(block.props).length > 0) {
                issues.push({
                    code: "internal_instruction_exposed",
                    message: `${block.type} contains an internal authoring instruction and cannot be published.`,
                    blockType: block.type,
                    index,
                });
            }
            for (const key of ["href", "primaryCtaHref", "secondaryCtaHref", "canonicalPath"]) {
                if (!isSafePublicUrl(block.props[key])) {
                    issues.push({ code: "unsafe_url", message: `${block.type}.${key} is not a safe public URL.`, blockType: block.type, index });
                }
            }
        }
    }

    for (const requiredBlock of definition.requiredBlocks ?? []) {
        if (!blocks.some((block) => block.type === requiredBlock)) {
            issues.push({ code: "required_block_missing", message: `${requiredBlock} is required on ${definition.id}.`, blockType: requiredBlock });
        }
    }

    return issues.length > 0 ? { ok: false, issues } : { ok: true, issues: [] };
}
