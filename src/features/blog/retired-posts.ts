export const RETIRED_BLOG_SLUGS = [
    "the-era-of-the-junior-developer-is-over-what-it-means-for-your-business-1776798451962",
    "the-ai-frontier-has-moved-why-standalone-llms-are-no-longer-your-business-future-1776869544870",
    "ais-impact-on-business-a-permanent-operational-shift-1777066069690",
    "the-ai-wealth-wave-how-one-man-businesses-are-minting-millions-through-strategic-1776867356110",
    "from-agency-stack-to-ai-operating-system-redefining-agency-growth",
    "the-sme-ai-imperative-act-now-or-risk-obsolescence-1777064032975",
    "automating-your-horeca-operations-a-practical-guide-for-owners-1777162759441",
    "the-true-roi-of-an-integrated-digital-system",
    "ai-3d-modelling-from-hype-to-commercial-reality-1777033805287",
    "fifteen-minute-workspace-setup",
] as const;

const RETIRED_BLOG_SLUG_SET = new Set<string>(RETIRED_BLOG_SLUGS);

// PostgREST's `in` operator expects a parenthesized value list.
export const RETIRED_BLOG_POSTGREST_FILTER = `(${RETIRED_BLOG_SLUGS.join(",")})`;

export function isRetiredBlogSlug(value: string): boolean {
    return RETIRED_BLOG_SLUG_SET.has(value.trim());
}
