interface FooterLogoOptions {
    templateId: string;
    footerLogoUrl?: string;
    navbarLogoUrl?: string;
}

interface NavbarLogoOptions {
    templateId: string;
    navbarLogoUrl?: string;
    isLightSurface: boolean;
}

const ISYSTEM_DARK_SURFACE_LOGO = "/isystem-assets/isystem-logo-dark.png";
const ISYSTEM_LIGHT_SURFACE_LOGO = "/isystem-assets/isystem-logo-light.png";

function isKnownIsystemLogo(url: string, logoPath: string) {
    const normalizedUrl = url.split(/[?#]/, 1)[0].toLowerCase();
    return normalizedUrl.endsWith(logoPath);
}

function resolveIsystemLogoForSurface(configuredLogoUrl: string, surface: "light" | "dark") {
    const preferredLogo = surface === "light"
        ? ISYSTEM_LIGHT_SURFACE_LOGO
        : ISYSTEM_DARK_SURFACE_LOGO;
    const wrongSurfaceLogo = surface === "light"
        ? ISYSTEM_DARK_SURFACE_LOGO
        : ISYSTEM_LIGHT_SURFACE_LOGO;

    if (!configuredLogoUrl || isKnownIsystemLogo(configuredLogoUrl, wrongSurfaceLogo)) {
        return preferredLogo;
    }

    return configuredLogoUrl;
}

export function resolveFooterLogoUrl({
    templateId,
    footerLogoUrl,
    navbarLogoUrl,
}: FooterLogoOptions) {
    const configuredLogoUrl = footerLogoUrl?.trim() || navbarLogoUrl?.trim() || "";

    if (templateId !== "isystem-agency") {
        return configuredLogoUrl;
    }

    return resolveIsystemLogoForSurface(configuredLogoUrl, "dark");
}

export function resolveNavbarLogoUrl({
    templateId,
    navbarLogoUrl,
    isLightSurface,
}: NavbarLogoOptions) {
    const configuredLogoUrl = navbarLogoUrl?.trim() || "";

    if (templateId !== "isystem-agency") {
        return configuredLogoUrl;
    }

    return resolveIsystemLogoForSurface(
        configuredLogoUrl,
        isLightSurface ? "light" : "dark",
    );
}
