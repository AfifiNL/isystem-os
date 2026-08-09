import type { DesignTokens, TemplateConfig, ThemeColors } from "./types";

function buildDefaultDesignTokens(colors: ThemeColors): DesignTokens {
    return {
        surfaces: {
            canvas: "oklch(0.985 0.006 258)",
            light: "oklch(0.995 0.004 258)",
            soft: `color-mix(in oklch, ${colors.primary} 4%, white)`,
            dark: `color-mix(in oklch, ${colors.primary} 18%, oklch(0.19 0.02 255))`,
            darkStrong: `color-mix(in oklch, ${colors.primary} 24%, oklch(0.15 0.02 255))`,
            inverse: `color-mix(in oklch, ${colors.primary} 18%, oklch(0.19 0.02 255))`,
            inverseRaised: `color-mix(in oklch, ${colors.primary} 24%, oklch(0.22 0.025 255))`,
            glass: `color-mix(in oklch, white 92%, ${colors.primary} 8%)`,
            premium: `linear-gradient(135deg, color-mix(in oklch, ${colors.accent} 16%, white), white)`,
            premiumRaised: `linear-gradient(135deg, color-mix(in oklch, ${colors.accent} 10%, white), color-mix(in oklch, ${colors.primary} 4%, white))`,
        },
        borders: {
            subtle: "rgba(148, 163, 184, 0.18)",
            soft: `color-mix(in oklch, ${colors.primary} 18%, rgba(148, 163, 184, 0.32))`,
            strong: "rgba(15, 23, 42, 0.12)",
            inverse: "rgba(255, 255, 255, 0.14)",
            accent: colors.accent,
            accentSoft: `color-mix(in oklch, ${colors.accent} 42%, transparent)`,
        },
        text: {
            primary: "oklch(0.235 0.03 258)",
            secondary: "oklch(0.48 0.03 255)",
            subtle: "oklch(0.58 0.02 255)",
            inverse: "oklch(0.985 0.01 258)",
            inverseMuted: "rgba(226, 232, 240, 0.82)",
            inverseSubtle: "rgba(191, 203, 221, 0.62)",
            accent: colors.primary,
            accentStrong: colors.accent,
        },
        motion: {
            fast: "160ms",
            base: "260ms",
            slow: "420ms",
            easeStandard: "cubic-bezier(0.22, 1, 0.36, 1)",
            easeEmphasis: "cubic-bezier(0.16, 1, 0.3, 1)",
        },
        depth: {
            sm: "0 10px 30px rgba(15, 23, 42, 0.08)",
            md: "0 18px 42px rgba(15, 23, 42, 0.14)",
            lg: "0 26px 72px rgba(15, 23, 42, 0.18)",
            glow: `0 0 0 1px color-mix(in oklch, ${colors.primary} 16%, transparent), 0 24px 80px color-mix(in oklch, ${colors.primary} 20%, transparent)`,
        },
        radii: {
            md: "18px",
            lg: "24px",
            xl: "32px",
            pill: "999px",
        },
        typography: {
            displaySm: "clamp(2.5rem, 5vw, 4.25rem)",
            displayMd: "clamp(3rem, 6.5vw, 5.5rem)",
            displayLg: "clamp(3.75rem, 8vw, 7rem)",
        },
    };
}

export function resolveDesignTokens(config: TemplateConfig): DesignTokens {
    return config.designTokens ?? buildDefaultDesignTokens(config.colors);
}

export function buildTemplateCssVariables(config: TemplateConfig): Record<string, string> {
    const tokens = resolveDesignTokens(config);

    const variables: Record<string, string> = {
        "--template-primary": config.colors.primary,
        "--template-primary-fg": config.colors.primaryForeground,
        "--template-accent": config.colors.accent,
        "--template-accent-fg": config.colors.accentForeground,
        "--template-gradient-from": config.colors.gradientFrom,
        "--template-gradient-to": config.colors.gradientTo,
        "--template-shadow-tint": config.colors.shadowTint,
        "--template-font-heading": config.fonts.heading,
        "--template-font-body": config.fonts.body,
        "--public-font-display": config.fonts.heading,
        "--public-font-body": config.fonts.body,
        "--template-surface-canvas": tokens.surfaces.canvas,
        "--template-surface-light": tokens.surfaces.light,
        "--template-surface-soft": tokens.surfaces.soft,
        "--template-surface-dark": tokens.surfaces.dark,
        "--template-surface-dark-strong": tokens.surfaces.darkStrong,
        "--template-surface-inverse": tokens.surfaces.inverse,
        "--template-surface-inverse-raised": tokens.surfaces.inverseRaised,
        "--template-surface-glass": tokens.surfaces.glass,
        "--template-surface-premium": tokens.surfaces.premium,
        "--template-surface-premium-raised": tokens.surfaces.premiumRaised,
        "--template-border-subtle": tokens.borders.subtle,
        "--template-border-soft": tokens.borders.soft,
        "--template-border-strong": tokens.borders.strong,
        "--template-border-inverse": tokens.borders.inverse,
        "--template-border-accent": tokens.borders.accent,
        "--template-border-accent-soft": tokens.borders.accentSoft,
        "--template-text-primary": tokens.text.primary,
        "--template-text-secondary": tokens.text.secondary,
        "--template-text-subtle": tokens.text.subtle,
        "--template-text-inverse": tokens.text.inverse,
        "--template-text-inverse-muted": tokens.text.inverseMuted,
        "--template-text-inverse-subtle": tokens.text.inverseSubtle,
        "--template-text-accent": tokens.text.accent,
        "--template-text-accent-strong": tokens.text.accentStrong,
        "--template-motion-fast": tokens.motion.fast,
        "--template-motion-base": tokens.motion.base,
        "--template-motion-slow": tokens.motion.slow,
        "--template-motion-ease-standard": tokens.motion.easeStandard,
        "--template-motion-ease-emphasis": tokens.motion.easeEmphasis,
        "--template-depth-sm": tokens.depth.sm,
        "--template-depth-md": tokens.depth.md,
        "--template-depth-lg": tokens.depth.lg,
        "--template-depth-glow": tokens.depth.glow,
        "--template-radius-md": tokens.radii.md,
        "--template-radius-lg": tokens.radii.lg,
        "--template-radius-xl": tokens.radii.xl,
        "--template-radius-pill": tokens.radii.pill,
        "--template-display-sm": tokens.typography.displaySm,
        "--template-display-md": tokens.typography.displayMd,
        "--template-display-lg": tokens.typography.displayLg,
    };

    if (config.id === "isystem-agency") {
        Object.assign(variables, {
            "--public-canvas": "#FBFAF7",
            "--public-paper": "#FFFFFF",
            "--public-soft": "#F1F4F4",
            "--public-mist": "#E7EEF1",
            "--public-ink": "#102432",
            "--public-secondary": "#425563",
            "--public-subtle": "#5A6D78",
            "--public-navy": "#0B2239",
            "--public-navy-raised": "#132F49",
            "--public-action": "#1769AA",
            "--public-action-strong": "#0D568F",
            "--public-brass": "#9A7335",
            "--public-line": "#D7DFE2",
            "--public-inverse-line": "rgba(255, 255, 255, 0.16)",
            "--public-success": "#24684A",
            "--public-warning": "#8A5B16",
            "--public-danger": "#9B3434",
            "--public-radius-sm": "4px",
            "--public-radius-md": "8px",
            "--public-radius-lg": "12px",
            "--public-radius-xl": "18px",
            "--public-shadow-evidence": "0 14px 42px rgba(16, 36, 50, 0.09)",
            "--public-shadow-float": "0 28px 80px rgba(16, 36, 50, 0.14)",
            "--public-shadow-hover": "0 20px 54px rgba(16, 36, 50, 0.13)",
            "--public-font-display": "var(--font-instrument-sans), var(--font-inter), sans-serif",
            "--public-font-body": "var(--font-inter), sans-serif",
            "--public-motion-fast": "140ms",
            "--public-motion-base": "240ms",
            "--public-motion-explain": "520ms",
            "--public-motion-ease": "cubic-bezier(0.22, 1, 0.36, 1)",
        });
    }

    return variables;
}
