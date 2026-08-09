/* eslint-disable @next/next/no-img-element */
import { Globe, Linkedin, Github, Twitter } from "lucide-react";
import type { BlogAuthor } from "@/features/blog/types";

interface AuthorBioCardProps {
    author: BlogAuthor | null;
    /** "inverse" for dark surfaces, "default" for light surfaces. */
    surface?: "inverse" | "default";
    /** Localized "About the author" heading. */
    heading?: string;
    className?: string;
}

const SURFACES = {
    inverse: {
        primary: "var(--template-text-inverse)",
        muted: "var(--template-text-inverse-muted)",
        subtle: "var(--template-text-inverse-subtle)",
        border: "var(--template-border-inverse)",
        bg: "var(--template-surface-inverse-raised, rgba(255, 255, 255, 0.03))",
    },
    default: {
        primary: "var(--template-text-primary)",
        muted: "var(--template-text-secondary)",
        subtle: "var(--template-text-subtle)",
        border: "var(--template-border-soft)",
        bg: "var(--template-surface-light)",
    },
} as const;

function authorInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 0 || !parts[0]) return "·";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * Rich author profile card for the end of a blog post: avatar (large), name,
 * role, bio, and social icons. Skips entirely if no author or no bio. The
 * card adheres to the active template's design tokens — accent kicker, soft
 * surface, paired typography sizes.
 */
export function AuthorBioCard({ author, surface = "inverse", heading, className }: AuthorBioCardProps) {
    if (!author) return null;
    // Hide the card if there's literally nothing distinct to show beyond the
    // name. Bylines already cover the name+avatar case; this card earns its
    // place only when we have bio or social context.
    const hasContext = Boolean(author.bio || author.role_title || Object.keys(author.social_links).length);
    if (!hasContext) return null;

    const palette = SURFACES[surface];
    const headingText = heading ?? "About the author";

    return (
        <aside
            className={`mt-16 overflow-hidden rounded-3xl border p-6 sm:p-8 ${className ?? ""}`}
            style={{ borderColor: palette.border, background: palette.bg }}
        >
            <p
                className="mb-6 text-[11px] font-semibold uppercase tracking-[0.22em]"
                style={{ color: "var(--template-text-accent-strong)" }}
            >
                {headingText}
            </p>
            <div className="flex flex-col items-start gap-5 sm:flex-row sm:gap-6">
                <div
                    className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl"
                    style={{
                        background: "color-mix(in oklch, var(--template-accent) 16%, transparent)",
                        boxShadow: `0 0 0 1px ${palette.border}`,
                    }}
                >
                    {author.avatar_url ? (
                        <img
                            src={author.avatar_url}
                            alt={author.display_name}
                            width={80}
                            height={80}
                            className="h-full w-full object-cover"
                            loading="lazy"
                        />
                    ) : (
                        <span
                            className="flex h-full w-full items-center justify-center text-2xl font-bold"
                            style={{ color: "var(--template-text-accent-strong)" }}
                        >
                            {authorInitials(author.display_name)}
                        </span>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold leading-tight" style={{ color: palette.primary }}>
                        {author.display_name}
                    </h3>
                    {author.role_title ? (
                        <p className="mt-1 text-sm font-medium" style={{ color: "var(--template-text-accent-strong)" }}>
                            {author.role_title}
                        </p>
                    ) : null}
                    {author.bio ? (
                        <p className="mt-3 text-sm leading-7" style={{ color: palette.muted }}>
                            {author.bio}
                        </p>
                    ) : null}
                    <SocialLinks author={author} surface={surface} />
                </div>
            </div>
        </aside>
    );
}

function SocialLinks({ author, surface }: { author: BlogAuthor; surface: "inverse" | "default" }) {
    const links: Array<{ key: keyof typeof author.social_links; href?: string; Icon: typeof Linkedin; label: string }> = [
        { key: "linkedin", href: author.social_links.linkedin, Icon: Linkedin, label: "LinkedIn" },
        { key: "x", href: author.social_links.x, Icon: Twitter, label: "X" },
        { key: "github", href: author.social_links.github, Icon: Github, label: "GitHub" },
        { key: "website", href: author.social_links.website, Icon: Globe, label: "Website" },
    ];
    const visible = links.filter((l) => Boolean(l.href));
    if (visible.length === 0) return null;
    const palette = SURFACES[surface];

    return (
        <div className="mt-4 flex flex-wrap items-center gap-2">
            {visible.map(({ key, href, Icon, label }) => (
                <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer me"
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:border-[var(--template-accent)]"
                    style={{ borderColor: palette.border, color: palette.muted }}
                    aria-label={`${label} profile`}
                >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                </a>
            ))}
        </div>
    );
}
