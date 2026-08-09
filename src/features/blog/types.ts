// Public-facing author shape. Built from `public.profiles` columns added in
// migration 20260427160000. The blog list / detail pages render this object;
// keep it serializable so server actions can return it without coercion.

export interface BlogAuthorSocialLinks {
    linkedin?: string;
    x?: string;
    github?: string;
    website?: string;
}

export interface BlogAuthor {
    id: string;
    display_name: string;
    role_title: string | null;
    bio: string | null;
    avatar_url: string | null;
    social_links: BlogAuthorSocialLinks;
}

export interface ProfileRow {
    id: string;
    email: string | null;
    display_name: string | null;
    role_title: string | null;
    bio: string | null;
    avatar_url: string | null;
    social_links: BlogAuthorSocialLinks | null;
}

export interface BlogPaginationMetadata {
    currentPage: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
}

/**
 * Coerce a raw profiles row (or any object that quacks like one) into the
 * public BlogAuthor shape. Falls back to a humanized email local-part for
 * the display name so historical posts still render a usable byline before
 * the operator fills in the real name.
 */
export function toBlogAuthor(row: Partial<ProfileRow> | null | undefined): BlogAuthor | null {
    if (!row || !row.id) return null;
    const fallbackName = row.email ? humanizeEmailLocalPart(row.email) : "Editor";
    return {
        id: row.id,
        display_name: (row.display_name ?? "").trim() || fallbackName,
        role_title: row.role_title?.trim() || null,
        bio: row.bio?.trim() || null,
        avatar_url: row.avatar_url?.trim() || null,
        social_links: normalizeSocialLinks(row.social_links),
    };
}

function humanizeEmailLocalPart(email: string): string {
    const local = email.split("@")[0] || "Editor";
    const cleaned = local.replace(/[._-]+/g, " ").trim();
    return cleaned
        .split(" ")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ") || "Editor";
}

function normalizeSocialLinks(value: unknown): BlogAuthorSocialLinks {
    if (!value || typeof value !== "object") return {};
    const raw = value as Record<string, unknown>;
    const out: BlogAuthorSocialLinks = {};
    for (const key of ["linkedin", "x", "github", "website"] as const) {
        const candidate = raw[key];
        if (typeof candidate === "string" && /^https?:\/\//i.test(candidate.trim())) {
            out[key] = candidate.trim();
        }
    }
    return out;
}
