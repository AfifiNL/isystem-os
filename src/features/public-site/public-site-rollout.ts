export type PublicSiteRendererVersion = "legacy" | "v2";

export interface PublicSiteRendererSettings {
    default: PublicSiteRendererVersion;
    routes: Record<string, PublicSiteRendererVersion>;
}

const DEFAULT_ROLLOUT: PublicSiteRendererSettings = {
    default: "legacy",
    routes: {},
};

function isRendererVersion(value: unknown): value is PublicSiteRendererVersion {
    return value === "legacy" || value === "v2";
}

export function normalizePublicSiteRenderer(value: unknown): PublicSiteRendererSettings {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return { ...DEFAULT_ROLLOUT, routes: {} };
    }

    const record = value as Record<string, unknown>;
    const rawRoutes = record.routes;
    const routes: Record<string, PublicSiteRendererVersion> = {};
    if (rawRoutes && typeof rawRoutes === "object" && !Array.isArray(rawRoutes)) {
        for (const [route, version] of Object.entries(rawRoutes)) {
            if (route.trim() && isRendererVersion(version)) {
                routes[route.trim()] = version;
            }
        }
    }

    return {
        default: isRendererVersion(record.default) ? record.default : DEFAULT_ROLLOUT.default,
        routes,
    };
}

export function resolvePublicSiteRenderer(
    settings: PublicSiteRendererSettings | null | undefined,
    routeId: string,
): PublicSiteRendererVersion {
    const normalized = normalizePublicSiteRenderer(settings);
    return normalized.routes[routeId] ?? normalized.default;
}

export function isPublicV2Route(
    templateId: string,
    settings: PublicSiteRendererSettings | null | undefined,
    routeId: string,
): boolean {
    return templateId === "isystem-agency" && resolvePublicSiteRenderer(settings, routeId) === "v2";
}
