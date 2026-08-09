import type { Json } from "@/shared/lib/supabase/database.types";
import { createSeededStructuredPageData, isPublicBuilderData, type PublicBuilderData } from "@/features/builder/puck.config";
import {
    isCorePageKind,
    type FacilityServicesAboutStructuredData,
    type FacilityServicesContactStructuredData,
    type FacilityServicesHomeStructuredData,
    type FacilityServicesServicesStructuredData,
    type CommitmentBlockProps,
    getLocaleValue,
    getRichTextLocaleValue,
    translateListItem,
    type ContactBlockProps,
    type LocaleField,
    type LocaleListItem,
    type PageKind,
    type RichLocaleField,
    type SupportedLocale,
} from "@/features/builder/facility-services-page-data";

type PuckContentNode = PublicBuilderData["content"][number];

export type FacilityServicesHomeRendererData = FacilityServicesHomeStructuredData;
export type FacilityServicesServicesRendererData = FacilityServicesServicesStructuredData;
export type FacilityServicesAboutRendererData = FacilityServicesAboutStructuredData;
export type FacilityServicesContactRendererData = FacilityServicesContactStructuredData;

function mergeStructured<T extends Record<string, unknown>>(fallback: T, incoming: T | null | undefined): T {
    if (!incoming) {
        return fallback;
    }

    return {
        ...fallback,
        ...incoming,
    };
}

export function extractHomeRendererData(visualLayout: Json | null | undefined): FacilityServicesHomeRendererData {
    const puckData = isPublicBuilderData(visualLayout) ? visualLayout : null;
    const fallback = createSeededStructuredPageData("home") as FacilityServicesHomeStructuredData;

    return {
        hero: mergeStructured(fallback.hero, extractBlock<typeof fallback.hero>(puckData, "HeroBlock")),
        stats: mergeStructured(fallback.stats, extractBlock<typeof fallback.stats>(puckData, "StatsBlock")),
        foundation: mergeStructured(fallback.foundation, extractBlock<typeof fallback.foundation>(puckData, "FoundationBlock")),
        about: mergeStructured(fallback.about, extractBlock<typeof fallback.about>(puckData, "AboutBlock")),
        services: mergeStructured(fallback.services, extractBlock<typeof fallback.services>(puckData, "ServicesShowcaseBlock")),
        methodology: mergeStructured(fallback.methodology, extractBlock<typeof fallback.methodology>(puckData, "MethodologyBlock")),
    };
}

export function extractServicesRendererData(visualLayout: Json | null | undefined): FacilityServicesServicesRendererData {
    const puckData = isPublicBuilderData(visualLayout) ? visualLayout : null;
    const fallback = createSeededStructuredPageData("services") as FacilityServicesServicesStructuredData;

    return {
        showcase: mergeStructured(fallback.showcase, extractBlock<typeof fallback.showcase>(puckData, "ServicesShowcaseBlock")),
        methodology: mergeStructured(fallback.methodology, extractBlock<typeof fallback.methodology>(puckData, "MethodologyBlock")),
    };
}

export function extractAboutRendererData(visualLayout: Json | null | undefined): FacilityServicesAboutRendererData {
    const puckData = isPublicBuilderData(visualLayout) ? visualLayout : null;
    const fallback = createSeededStructuredPageData("about") as FacilityServicesAboutStructuredData;

    return {
        about: mergeStructured(fallback.about, extractBlock<typeof fallback.about>(puckData, "AboutBlock")),
        commitment: mergeStructured(
            fallback.commitment,
            extractBlock<(CommitmentBlockProps & { id: string }) | null>(puckData, "CommitmentBlock")
        ),
    };
}

export function extractContactRendererData(visualLayout: Json | null | undefined): FacilityServicesContactRendererData {
    const puckData = isPublicBuilderData(visualLayout) ? visualLayout : null;
    const fallback = createSeededStructuredPageData("contact") as FacilityServicesContactStructuredData;

    return {
        main: mergeStructured(fallback.main, extractBlock<typeof fallback.main>(puckData, "ContactBlock")),
    };
}

function extractBlock<T>(data: PublicBuilderData | null | undefined, type: string) {
    const block = data?.content.find((item) => item.type === type) as PuckContentNode | undefined;
    return (block?.props ?? null) as T | null;
}

export function extractStructuredPageDataFromVisualLayout(pageKind: PageKind, visualLayout: Json | null | undefined) {
    if (!isCorePageKind(pageKind)) {
        return null;
    }

    if (pageKind === "home") {
        return extractHomeRendererData(visualLayout);
    }

    if (pageKind === "services") {
        return extractServicesRendererData(visualLayout);
    }

    if (pageKind === "about") {
        return extractAboutRendererData(visualLayout);
    }

    return extractContactRendererData(visualLayout);
}

export function translateFacilityServicesField(locale: SupportedLocale, field: LocaleField) {
    return getLocaleValue(locale, field);
}

export function translateFacilityServicesRichText(locale: SupportedLocale, field: LocaleField | RichLocaleField) {
    return getRichTextLocaleValue(locale, field);
}

export function translateFacilityServicesListItem(locale: SupportedLocale, item: LocaleListItem) {
    return translateListItem(locale, item);
}

export function buildContactDetailItems(locale: SupportedLocale, data: ContactBlockProps) {
    return [
        { label: locale === "nl" ? "E-mail" : "Email", value: data.email },
        { label: locale === "nl" ? "Telefoon" : "Phone", value: data.phone },
        { label: locale === "nl" ? "Adres" : "Address", value: translateFacilityServicesField(locale, data.address) },
        { label: "KvK", value: data.kvk },
        { label: locale === "nl" ? "Supporturen" : "Support Hours", value: translateFacilityServicesField(locale, data.supportHours) },
    ];
}
