export type PublicEvidenceSurface = "dark" | "light";

const DARK_BADGES = [
    "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
    "border-cyan-400/25 bg-cyan-400/10 text-cyan-300",
    "border-amber-300/25 bg-amber-300/10 text-amber-200",
    "border-violet-300/25 bg-violet-300/10 text-violet-200",
] as const;

const LIGHT_BADGES = [
    "border-emerald-700/20 bg-emerald-50 text-emerald-800",
    "border-sky-700/20 bg-sky-50 text-sky-800",
    "border-amber-700/20 bg-amber-50 text-amber-800",
    "border-violet-700/20 bg-violet-50 text-violet-800",
] as const;

export function getPublicEvidenceSurfaceClasses(surface: PublicEvidenceSurface) {
    if (surface === "light") {
        return {
            badges: LIGHT_BADGES,
            empty: "border-[var(--template-border-inverse)] bg-[var(--template-surface-inverse-raised)] text-[var(--template-text-inverse-muted)]",
            drawer: "border-[var(--template-border-inverse)] bg-[var(--template-surface-inverse-raised)]",
            summary: "text-[var(--template-text-inverse)] hover:bg-[var(--template-surface-soft)]",
            summaryIcon: "text-[var(--template-text-accent-strong)]",
            summaryCount: "text-[var(--template-text-inverse-subtle)]",
            content: "border-[var(--template-border-inverse)]",
            source: "border-[var(--template-border-inverse)] bg-[var(--template-surface-soft)] hover:border-[var(--template-border-accent-soft)] hover:bg-[var(--template-surface-inverse-raised)]",
            title: "text-[var(--template-text-inverse)] group-hover/source:text-[var(--template-text-accent-strong)]",
            publisher: "text-[var(--template-text-inverse-muted)]",
            sourceIcon: "text-[var(--template-text-accent-strong)]",
            meta: "text-[var(--template-text-inverse-subtle)]",
        };
    }

    return {
        badges: DARK_BADGES,
        empty: "border-white/10 bg-white/[0.035] text-slate-400",
        drawer: "border-white/10 bg-white/[0.035] backdrop-blur-md",
        summary: "text-white hover:bg-white/[0.04]",
        summaryIcon: "text-cyan-300",
        summaryCount: "text-slate-400",
        content: "border-white/10",
        source: "border-white/10 bg-slate-950/50 hover:border-cyan-300/35 hover:bg-slate-900/70",
        title: "text-white group-hover/source:text-cyan-100",
        publisher: "text-slate-400",
        sourceIcon: "text-cyan-300",
        meta: "text-slate-500",
    };
}
