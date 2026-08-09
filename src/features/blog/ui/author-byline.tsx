/* eslint-disable @next/next/no-img-element */
import type { BlogAuthor } from "@/features/blog/types";

interface AuthorBylineProps {
    author: BlogAuthor | null;
    /** Visual variant. "inverse" = on dark surfaces, "default" = on light cards. */
    surface?: "inverse" | "default";
    /** Compact size for blog list cards; standard size for post header. */
    size?: "compact" | "standard";
    /** Optional published date inline next to the byline. */
    publishedDate?: string | null;
    /** Locale for the date format. */
    locale?: "en" | "nl" | "ar";
    className?: string;
}

const SURFACES = {
    inverse: {
        primary: "var(--template-text-inverse)",
        muted: "var(--template-text-inverse-muted)",
        subtle: "var(--template-text-inverse-subtle)",
        border: "var(--template-border-inverse)",
    },
    default: {
        primary: "var(--template-text-primary)",
        muted: "var(--template-text-secondary)",
        subtle: "var(--template-text-subtle)",
        border: "var(--template-border-soft)",
    },
} as const;

function formatDate(date: string, locale: AuthorBylineProps["locale"]) {
    const tag = locale === "nl" ? "nl-NL" : locale === "ar" ? "ar-AE" : "en-US";
    return new Date(date).toLocaleDateString(tag, { month: "long", day: "numeric", year: "numeric" });
}

function authorInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 0 || !parts[0]) return "·";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * Compact author byline — avatar + name + role, optionally with publish date.
 * Used in blog list cards and at the top of blog post pages. Uses template
 * tokens so it lives inside any template's color system.
 */
export function AuthorByline({
    author,
    surface = "inverse",
    size = "standard",
    publishedDate,
    locale = "en",
    className,
}: AuthorBylineProps) {
    if (!author) return null;
    const palette = SURFACES[surface];
    const avatarSize = size === "compact" ? 32 : 44;
    const nameClass = size === "compact" ? "text-sm font-semibold" : "text-base font-semibold";
    const roleClass = size === "compact" ? "text-[11px]" : "text-xs";

    return (
        <div className={`flex items-center gap-3 ${className ?? ""}`}>
            <div
                className="relative flex-shrink-0 overflow-hidden rounded-full ring-1"
                style={{
                    width: avatarSize,
                    height: avatarSize,
                    background: "color-mix(in oklch, var(--template-accent) 14%, transparent)",
                    // ring-color via boxShadow so we don't fight Tailwind's ring utility
                    boxShadow: `0 0 0 1px ${palette.border}`,
                }}
            >
                {author.avatar_url ? (
                    <img
                        src={author.avatar_url}
                        alt={author.display_name}
                        width={avatarSize}
                        height={avatarSize}
                        className="h-full w-full object-cover"
                        loading="lazy"
                    />
                ) : (
                    <span
                        className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase"
                        style={{ color: "var(--template-text-accent-strong)" }}
                    >
                        {authorInitials(author.display_name)}
                    </span>
                )}
            </div>
            <div className="flex min-w-0 flex-col leading-tight">
                <span className={nameClass} style={{ color: palette.primary }}>
                    {author.display_name}
                </span>
                <span className={`${roleClass} truncate`} style={{ color: palette.subtle }}>
                    {author.role_title}
                    {author.role_title && publishedDate ? " · " : null}
                    {publishedDate ? (
                        <time dateTime={publishedDate}>
                            {formatDate(publishedDate, locale)}
                        </time>
                    ) : null}
                </span>
            </div>
        </div>
    );
}
