/* ──────────────────────────────────────────────
 *  Template system — shared type definitions
 * ────────────────────────────────────────────── */

export type Locale = "en" | "nl" | "ar";

export type Direction = "ltr" | "rtl";

export interface BlogPaginationMetadata {
    currentPage: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
}

/**
 * Localized text that requires English (the canonical fallback) and treats
 * other locales as optional. Read paths must use pickLocaleText() so missing
 * locales fall back to en. This lets non-iSystem templates skip Arabic without
 * type errors while iSystem-targeted public surfaces add ar entries.
 */
export type LocaleText = { en: string } & { [K in Exclude<Locale, "en">]?: string };

export type LocaleTextList = { en: string[] } & { [K in Exclude<Locale, "en">]?: string[] };

export type TemplateId =
    | "personal-brand"
    | "facility-services"
    | "creative-agency"
    | "isystem-agency"
    | "saas-product"
    | "restaurant"
    | "ecommerce"
    | "nonprofit";

/* ── Theme colors (oklch values injected as CSS vars) ── */
export interface ThemeColors {
    primary: string;
    primaryForeground: string;
    accent: string;
    accentForeground: string;
    gradientFrom: string;
    gradientTo: string;
    /** Tailwind class for shadow tinting, e.g. "shadow-violet-500/20" */
    shadowTint: string;
}

export interface DesignSurfaceTokens {
    canvas: string;
    light: string;
    soft: string;
    dark: string;
    darkStrong: string;
    inverse: string;
    inverseRaised: string;
    glass: string;
    premium: string;
    premiumRaised: string;
}

export interface DesignBorderTokens {
    subtle: string;
    soft: string;
    strong: string;
    inverse: string;
    accent: string;
    accentSoft: string;
}

export interface DesignTextTokens {
    primary: string;
    secondary: string;
    subtle: string;
    inverse: string;
    inverseMuted: string;
    inverseSubtle: string;
    accent: string;
    accentStrong: string;
}

export interface DesignMotionTokens {
    fast: string;
    base: string;
    slow: string;
    easeStandard: string;
    easeEmphasis: string;
}

export interface DesignDepthTokens {
    sm: string;
    md: string;
    lg: string;
    glow: string;
}

export interface DesignRadiiTokens {
    md: string;
    lg: string;
    xl: string;
    pill: string;
}

export interface DesignTypographyTokens {
    displaySm: string;
    displayMd: string;
    displayLg: string;
}

export interface DesignTokens {
    surfaces: DesignSurfaceTokens;
    borders: DesignBorderTokens;
    text: DesignTextTokens;
    motion: DesignMotionTokens;
    depth: DesignDepthTokens;
    radii: DesignRadiiTokens;
    typography: DesignTypographyTokens;
}

export interface TemplateAppearanceConfig {
    defaultMode: "light" | "dark";
    allowVisitorToggle: boolean;
    inverseSections: string[];
}

/* ── Navigation ── */
export interface NavLink {
    href: string;
    label: LocaleText;
}

export interface NavMenuItem extends NavLink {
    blurb?: LocaleText;
}

export interface NavMenu {
    id: string;
    label: LocaleText;
    href?: string;
    items: NavMenuItem[];
}

export interface SocialLink {
    href: string;
    icon: string; // lucide icon name
    label: string;
}

/* ── Hero section config ── */
export interface HeroConfig {
    badge: LocaleText;
    headline: LocaleTextList; // array of words for GSAP animation
    /** Index at which gradient-colored words begin */
    gradientWordStart: number;
    subtitle: LocaleText;
    primaryCta: { href: string; label: LocaleText };
    secondaryCta: { href: string; label: LocaleText };
}

/* ── Footer config ── */
export interface FooterConfig {
    brandDescription: LocaleText;
    linkColumns: Record<string, NavLink[]>;
    ctaTitle: LocaleText;
    ctaDescription: LocaleText;
    ctaLink: { href: string; label: LocaleText };
    copyright: LocaleText;
}

/* ── Homepage section descriptor ── */
export interface HomeSectionDescriptor {
    /** Component key used to dynamically resolve the section component */
    component: string;
    /** Optional props forwarded to the section */
    props?: Record<string, unknown>;
}

/* ── Pages config ── */
export interface PagesConfig {
    blog: {
        title: LocaleText;
        subtitle: LocaleText;
        description: LocaleText;
    };
    about: {
        title: LocaleText;
        headline: LocaleText;
        description: LocaleText;
    };
    contact: {
        title: LocaleText;
        subtitle: LocaleText;
    };
    newsletter: {
        title: LocaleText;
        description: LocaleText;
    };
    videos: {
        title: LocaleText;
        subtitle: LocaleText;
        description: LocaleText;
    };
    services?: {
        title: LocaleText;
        subtitle: LocaleText;
        description: LocaleText;
    };
    projects?: {
        title: LocaleText;
        subtitle: LocaleText;
        description: LocaleText;
    };
}

/* ── Template Page Renderers ── */
export interface TemplatePageRenderers {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    blogIndex?: React.ComponentType<{ posts: any[]; config: TemplateConfig; locale: Locale; pagination?: BlogPaginationMetadata }>;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    blogPost?: React.ComponentType<{ post: any; relatedPosts: any[]; config: TemplateConfig; locale: Locale }>;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    podcastIndex?: React.ComponentType<{ shows: any[]; config: TemplateConfig; locale: Locale }>;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    podcastShow?: React.ComponentType<{ show: any; episodes: any[]; config: TemplateConfig; locale: Locale }>;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    podcastEpisode?: React.ComponentType<{ show: any; episode: any; previousEpisode: any | null; nextEpisode: any | null; config: TemplateConfig; locale: Locale }>;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    videoIndex?: React.ComponentType<{ items: any[]; config: TemplateConfig; locale: Locale }>;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    videoDetail?: React.ComponentType<{ item: any; config: TemplateConfig; locale: Locale }>;
}

/* ── AI Context Configuration ── */
export interface AiContextConfig {
    industry: string;
    brandVoice: string;
    targetAudience: string;
    contentPillars: string[];
    visualStyle: string;
}

export interface TemplateQuickAction {
    id: string;
    label: LocaleText;
    description: LocaleText;
    prompt: string;
}

export interface TemplateDashboardConfig {
    quick_actions?: TemplateQuickAction[];
    quickActions?: TemplateQuickAction[];
}

/* ── Full template config ── */
export interface TemplateConfig {
    id: TemplateId;
    name: string;
    description: string;
    /** Preview image path for admin selector */
    previewImage: string;
    colors: ThemeColors;
    /** Optional render-layer design tokens for premium theming. */
    designTokens?: DesignTokens;
    /** Optional public appearance strategy for template renderers. */
    appearance?: TemplateAppearanceConfig;
    /** Google Fonts family names to load */
    fonts: { heading: string; body: string };
    navLinks: NavLink[];
    /** Optional nested public navigation menus. Site chrome may override these per workspace. */
    navMenus?: NavMenu[];
    socialLinks: SocialLink[];
    hero: HeroConfig;
    footer: FooterConfig;
    pages: PagesConfig;
    homeSections: HomeSectionDescriptor[];
    /** Optional specific page renderer overrides for this template. */
    renderers?: TemplatePageRenderers;
    /** Dynamic AI prompt context for this template */
    aiContext: AiContextConfig;
    /** Optional dashboard quick actions consumed by admin dashboard state. */
    dashboard?: TemplateDashboardConfig;
    /** Optional long-form AI system prompt (snake_case legacy key). */
    ai_system_context?: string;
    /** Optional long-form AI system prompt (camelCase alias). */
    aiSystemContext?: string;
}
