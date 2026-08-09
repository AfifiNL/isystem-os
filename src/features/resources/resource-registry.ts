export interface LocalizedResourceInfo {
    title: { en: string; nl: string; ar: string };
    description: { en: string; nl: string; ar: string };
    audience: { en: string; nl: string; ar: string };
}

export interface ResourceItem {
    slug: string;
    pdfHref: string;
    coverImage: string;
    type: "Playbook" | "Workbook" | "Canvas" | "Framework" | "Starter Kit";
    pageCount: number;
    readTimeMinutes: number;
    lastModified: string;
    funnelRole: "pillar" | "support" | "sector-support" | "authority" | "diagnostic";
    locales: {
        en: { status: "published"; pdfHref: string; landingSlug: string };
        nl: { status: "planned" | "published"; pdfHref?: string; landingSlug?: string };
        ar: { status: "planned" | "published"; pdfHref?: string; landingSlug?: string };
    };
    info: LocalizedResourceInfo;
}

/**
 * Public distributions ship without private campaign resources. Add only
 * reviewed, redistributable assets here after placing their files in the
 * public export and verifying every localized route.
 */
export const RESOURCE_REGISTRY: ResourceItem[] = [];

const REVIEWED_BUILT_IN_RESOURCE_VISUALS = new Set([
    "/stealth-cto-hero.png",
    "/isystem-assets/isystem-logo-dark.png",
    "/isystem-assets/isystem-logo-light.png",
    "/themes/facility-services/hero.jpg",
    "/themes/facility-services/logo.svg",
]);

export function resolveReviewedResourceVisual(value: string | null | undefined): string | null {
    const candidate = value?.trim();
    return candidate && REVIEWED_BUILT_IN_RESOURCE_VISUALS.has(candidate) ? candidate : null;
}
