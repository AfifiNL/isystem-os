import {
    resolvePublicPageDefinition,
    validatePublicPageData,
    type PublicPagePuckDataV2,
} from "./public-page-contract";
import { createIsystemPublicPageData } from "./isystem-public-page-seeds";

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function isPublicPagePuckDataV2(value: unknown): value is PublicPagePuckDataV2 {
    if (!isRecord(value) || value.schemaVersion !== 2 || !Array.isArray(value.content)) return false;
    const root = isRecord(value.root) ? value.root : null;
    const props = root && isRecord(root.props) ? root.props : null;
    return Boolean(props && typeof props.title === "string" && typeof props.pageKind === "string");
}

export function resolveIsystemPublicPageData(
    value: unknown,
    pageKind: "home" | "services" | "about" | "contact" | "system-proof",
): { data: PublicPagePuckDataV2; source: "v2" | "safe-seed" } {
    if (isPublicPagePuckDataV2(value)) {
        const definition = pageKind === "home"
            ? resolvePublicPageDefinition("/")
            : resolvePublicPageDefinition(`/${pageKind}`);
        // The expand migration converted legacy layouts into the v2 envelope,
        // but those documents do not carry an approved preset id. Do not let
        // a converted legacy homepage masquerade as the approved composition
        // when its route is promoted. A real v2 save retains the preset id.
        const isLegacyConvertedHome = pageKind === "home" && !value.root.props.presetId;
        if (definition && !isLegacyConvertedHome && validatePublicPageData(value, definition).ok) {
            return { data: value, source: "v2" };
        }
    }

    return { data: createIsystemPublicPageData(pageKind), source: "safe-seed" };
}
