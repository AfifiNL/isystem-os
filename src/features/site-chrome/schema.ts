import { z } from "zod";
import type { Locale, TemplateConfig } from "@/features/templates/types";
import { pickLocaleText } from "@/shared/lib/i18n/resolve";

export const SITE_CHROME_SOCIAL_ICONS = ["github", "linkedin", "twitter", "youtube", "facebook", "instagram", "globe"] as const;

export type SiteChromeSocialIcon = (typeof SITE_CHROME_SOCIAL_ICONS)[number];

// English required as canonical fallback; nl/ar optional. Read paths must use
// pickLocaleText() / getLocalizedSiteChromeText() so missing locales fall back.
export interface LocalizedText {
    en: string;
    nl?: string;
    ar?: string;
}

export interface SiteChromeLink {
    label: LocalizedText;
    href: string;
}

export interface SiteChromeMenuItem extends SiteChromeLink {
    blurb?: LocalizedText;
}

export interface SiteChromeMenu {
    id: string;
    label: LocalizedText;
    href?: string;
    items: SiteChromeMenuItem[];
}

export interface SiteChromeBrand {
    name: LocalizedText;
    accentText: LocalizedText;
    homeHref: string;
    navbarLogoUrl?: string;
    footerLogoUrl?: string;
    faviconUrl?: string;
}

export interface SiteChromeAction {
    enabled: boolean;
    label: LocalizedText;
    href: string;
}

export interface SiteChromeFooterGroup {
    title: LocalizedText;
    links: SiteChromeLink[];
}

export interface SiteChromeSocialLink {
    label: string;
    href: string;
    icon: SiteChromeSocialIcon;
}

export interface SiteChromeFooterCta {
    title: LocalizedText;
    description: LocalizedText;
    label: LocalizedText;
    href: string;
}

export interface SiteChromeConfig {
    brand: SiteChromeBrand;
    navbar: {
        links: SiteChromeLink[];
        menus?: SiteChromeMenu[];
        cta: SiteChromeAction;
        mobileCta: SiteChromeAction;
    };
    footer: {
        description: LocalizedText;
        groups: SiteChromeFooterGroup[];
        socialLinks: SiteChromeSocialLink[];
        cta: SiteChromeFooterCta;
        legalLinks: SiteChromeLink[];
        copyright: LocalizedText;
    };
}

export interface SiteChromeOverrides {
    hideNavbar?: boolean;
    hideFooter?: boolean;
    ctaVariant?: "default" | "mobile";
}

export type SiteChromeDiagnosticCode = "unsafe_url" | "duplicate_link" | "missing_locale_label" | "duplicate_menu";

export interface SiteChromeDiagnostic {
    code: SiteChromeDiagnosticCode;
    path: string;
    message: string;
}

const localizedTextSchema = z.object({
    en: z.string().trim().min(1),
    nl: z.string().trim().min(1).optional(),
    ar: z.string().trim().min(1).optional(),
});

const localizedOptionalTextSchema = z.object({
    en: z.string().trim(),
    nl: z.string().trim().optional(),
    ar: z.string().trim().optional(),
});

const siteChromeLinkSchema = z.object({
    label: localizedTextSchema,
    href: z.string().trim().min(1),
});

const siteChromeMenuItemSchema = siteChromeLinkSchema.extend({
    blurb: localizedOptionalTextSchema.optional(),
});

const siteChromeMenuSchema = z.object({
    id: z.string().trim().min(1),
    label: localizedTextSchema,
    href: z.string().trim().min(1).optional(),
    items: z.array(siteChromeMenuItemSchema).min(1).max(8),
});

const siteChromeActionSchema = z.object({
    enabled: z.boolean(),
    label: localizedTextSchema,
    href: z.string().trim().min(1),
});

export const siteChromeSchema = z.object({
    brand: z.object({
        name: localizedTextSchema,
        accentText: localizedOptionalTextSchema,
        homeHref: z.string().trim().min(1),
        navbarLogoUrl: z.string().trim().optional(),
        footerLogoUrl: z.string().trim().optional(),
        faviconUrl: z.string().trim().optional(),
    }),
    navbar: z.object({
        links: z.array(siteChromeLinkSchema).min(1).max(8),
        menus: z.array(siteChromeMenuSchema).max(8).optional(),
        cta: siteChromeActionSchema,
        mobileCta: siteChromeActionSchema,
    }),
    footer: z.object({
        description: localizedTextSchema,
        groups: z.array(z.object({
            title: localizedTextSchema,
            links: z.array(siteChromeLinkSchema).min(1).max(8),
        })).min(1).max(4),
        socialLinks: z.array(z.object({
            label: z.string().trim().min(1),
            href: z.string().trim().min(1),
            icon: z.enum(SITE_CHROME_SOCIAL_ICONS),
        })).max(8),
        cta: z.object({
            title: localizedTextSchema,
            description: localizedTextSchema,
            label: localizedTextSchema,
            href: z.string().trim().min(1),
        }),
        legalLinks: z.array(siteChromeLinkSchema).min(1).max(4),
        copyright: localizedTextSchema,
    }),
});

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function localized(en: string, nl?: string): LocalizedText {
    return {
        en,
        nl: nl ?? en,
    };
}

function detectSocialIcon(label: string): SiteChromeSocialIcon {
    const normalized = label.toLowerCase();

    if (normalized.includes("github")) return "github";
    if (normalized.includes("linkedin")) return "linkedin";
    if (normalized.includes("twitter") || normalized.includes("x")) return "twitter";
    if (normalized.includes("youtube")) return "youtube";
    if (normalized.includes("facebook")) return "facebook";
    if (normalized.includes("instagram")) return "instagram";

    return "globe";
}

export function buildDefaultSiteChrome(config: TemplateConfig, siteName: string): SiteChromeConfig {
    const firstWord = siteName.split(" ")[0] ?? siteName;
    const accentTail = siteName.slice(firstWord.length).trim();

    return {
        brand: {
            name: localized(firstWord || siteName),
            accentText: localized(accentTail),
            homeHref: "/",
            navbarLogoUrl: "",
            footerLogoUrl: "",
            faviconUrl: "",
        },
        navbar: {
            links: config.navLinks.map((link) => ({
                href: link.href,
                label: { ...link.label },
            })),
            menus: config.navMenus?.map((menu) => ({
                id: menu.id,
                href: menu.href,
                label: { ...menu.label },
                items: menu.items.map((item) => ({
                    href: item.href,
                    label: { ...item.label },
                    ...(item.blurb ? { blurb: { ...item.blurb } } : {}),
                })),
            })),
            cta: {
                enabled: true,
                label: { ...config.hero.primaryCta.label },
                href: config.hero.primaryCta.href,
            },
            mobileCta: {
                enabled: true,
                label: { ...config.hero.primaryCta.label },
                href: config.hero.primaryCta.href,
            },
        },
        footer: {
            description: { ...config.footer.brandDescription },
            groups: Object.entries(config.footer.linkColumns).map(([title, links]) => ({
                title: localized(title),
                links: links.map((link) => ({ href: link.href, label: { ...link.label } })),
            })),
            socialLinks: config.socialLinks.map((link) => ({
                label: link.label,
                href: link.href,
                icon: detectSocialIcon(link.icon || link.label),
            })),
            cta: {
                title: { ...config.footer.ctaTitle },
                description: { ...config.footer.ctaDescription },
                label: { ...config.footer.ctaLink.label },
                href: config.footer.ctaLink.href,
            },
            legalLinks: [
                { href: "/privacy", label: localized("Privacy", "Privacy") },
                { href: "/terms", label: localized("Terms", "Voorwaarden") },
            ],
            copyright: { ...config.footer.copyright },
        },
    };
}

export function resolveSiteChromeConfig(value: unknown, fallback: SiteChromeConfig): SiteChromeConfig {
    const parsed = siteChromeSchema.safeParse(value);
    if (!parsed.success) return clone(fallback);
    const normalized = normalizeLegacySiteChrome(parsed.data);
    const diagnostics = validateSiteChromeConfig(normalized);
    if (diagnostics.some((diagnostic) => diagnostic.code === "unsafe_url" || diagnostic.code === "duplicate_link" || diagnostic.code === "duplicate_menu")) {
        return clone(fallback);
    }
    return {
        ...normalized,
        navbar: {
            ...normalized.navbar,
            menus: normalized.navbar.menus ?? fallback.navbar.menus,
        },
    };
}

function normalizeLegacyHref(href: string): string {
    return href === "/basic-vs-pro" || href.startsWith("/basic-vs-pro#") ? href.replace("/basic-vs-pro", "/services") : href;
}

function normalizeLegacySiteChrome(config: SiteChromeConfig): SiteChromeConfig {
    const mapLink = (link: SiteChromeLink): SiteChromeLink => ({ ...link, href: normalizeLegacyHref(link.href) });
    return {
        ...config,
        navbar: {
            ...config.navbar,
            links: config.navbar.links.map(mapLink),
            menus: config.navbar.menus?.map((menu) => ({
                ...menu,
                href: menu.href ? normalizeLegacyHref(menu.href) : menu.href,
                items: menu.items.map((item) => ({ ...item, href: normalizeLegacyHref(item.href) })),
            })),
        },
        footer: {
            ...config.footer,
            groups: config.footer.groups.map((group) => ({ ...group, links: group.links.map(mapLink) })),
            legalLinks: config.footer.legalLinks.map(mapLink),
        },
    };
}

function isSafeChromeHref(href: string): boolean {
    return href.startsWith("/") || href.startsWith("#") || href.startsWith("https://") || href.startsWith("mailto:");
}

export function validateSiteChromeConfig(config: SiteChromeConfig): SiteChromeDiagnostic[] {
    const diagnostics: SiteChromeDiagnostic[] = [];
    const visitLocalized = (value: LocalizedText, path: string) => {
        for (const locale of ["nl", "ar"] as const) {
            if (!value[locale]?.trim()) {
                diagnostics.push({ code: "missing_locale_label", path: `${path}.${locale}`, message: `${path} is missing a ${locale} label.` });
            }
        }
    };
    const visitLink = (link: SiteChromeLink, path: string, seenHrefs: Map<string, string>) => {
        visitLocalized(link.label, `${path}.label`);
        if (!isSafeChromeHref(link.href)) {
            diagnostics.push({ code: "unsafe_url", path: `${path}.href`, message: `Unsafe site-chrome URL: ${link.href}` });
        }
        const previous = seenHrefs.get(link.href);
        if (previous) {
            diagnostics.push({ code: "duplicate_link", path: `${path}.href`, message: `Duplicate link also appears at ${previous}.` });
        } else {
            seenHrefs.set(link.href, `${path}.href`);
        }
    };

    const navbarLinks = new Map<string, string>();
    config.navbar.links.forEach((link, index) => visitLink(link, `navbar.links[${index}]`, navbarLinks));
    const visitAction = (action: SiteChromeAction, path: string) => {
        visitLocalized(action.label, `${path}.label`);
        if (!isSafeChromeHref(action.href)) {
            diagnostics.push({ code: "unsafe_url", path: `${path}.href`, message: `Unsafe site-chrome URL: ${action.href}` });
        }
    };
    visitAction(config.navbar.cta, "navbar.cta");
    visitAction(config.navbar.mobileCta, "navbar.mobileCta");
    const menuIds = new Set<string>();
    config.navbar.menus?.forEach((menu, menuIndex) => {
        if (menuIds.has(menu.id)) {
            diagnostics.push({ code: "duplicate_menu", path: `navbar.menus[${menuIndex}].id`, message: `Duplicate menu id: ${menu.id}` });
        }
        menuIds.add(menu.id);
        visitLocalized(menu.label, `navbar.menus[${menuIndex}].label`);
        if (menu.href && !isSafeChromeHref(menu.href)) {
            diagnostics.push({ code: "unsafe_url", path: `navbar.menus[${menuIndex}].href`, message: `Unsafe menu URL: ${menu.href}` });
        }
        const menuLinks = new Map<string, string>();
        menu.items.forEach((item, itemIndex) => visitLink(item, `navbar.menus[${menuIndex}].items[${itemIndex}]`, menuLinks));
    });
    const footerLinks = new Map<string, string>();
    config.footer.groups.forEach((group, groupIndex) => {
        visitLocalized(group.title, `footer.groups[${groupIndex}].title`);
        group.links.forEach((link, linkIndex) => visitLink(link, `footer.groups[${groupIndex}].links[${linkIndex}]`, footerLinks));
    });
    const legalLinks = new Map<string, string>();
    config.footer.legalLinks.forEach((link, index) => visitLink(link, `footer.legalLinks[${index}]`, legalLinks));
    visitLocalized(config.footer.cta.title, "footer.cta.title");
    visitLocalized(config.footer.cta.description, "footer.cta.description");
    visitLocalized(config.footer.cta.label, "footer.cta.label");
    if (!isSafeChromeHref(config.footer.cta.href)) {
        diagnostics.push({ code: "unsafe_url", path: "footer.cta.href", message: `Unsafe site-chrome URL: ${config.footer.cta.href}` });
    }
    return diagnostics;
}

export function getLocalizedSiteChromeText(locale: Locale, value: LocalizedText): string {
    return pickLocaleText(value, locale);
}
