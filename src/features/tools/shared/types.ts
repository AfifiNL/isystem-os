export type ToolSlug =
    | "automation-scanner"
    | "automation-roi-calculator"
    | "ai-stack-recommender"
    | "ai-visibility-checker"
    | "support-automation-readiness"
    | "review-response-generator"
    | "gdpr-cookie-scanner"
    | "conversion-audit"
    | "nl-zzp-agreement-generator";

export type ToolLocale = "en" | "nl" | "ar";

export interface ToolMeta {
    slug: ToolSlug;
    title: Record<ToolLocale, string>;
    summary: Record<ToolLocale, string>;
    /** SEO meta description (≤155 chars). */
    description: Record<ToolLocale, string>;
    /** Primary search keyword for the page H1 / JSON-LD. */
    keyword: Record<ToolLocale, string>;
    /** Category for the hub grouping. */
    category: "automation" | "ai-search" | "compliance" | "growth" | "support";
    /** Estimated time to complete. */
    timeMinutes: number;
    /** Whether the tool requires URL fetching (affects layout / disclaimers). */
    requiresUrl?: boolean;
    /** Whether the tool calls an AI provider on submit. */
    usesAi?: boolean;
}

export interface ToolActionResult<T> {
    ok: boolean;
    data?: T;
    error?: string;
    /** Optional share token to surface a public result page. */
    shareToken?: string;
    /**
     * Set when the action was denied by the per-IP daily cap AND the visitor
     * has no active unlock grant (i.e. has not subscribed via the unlock
     * modal). The client should open the subscribe-to-unlock modal, then
     * retry the action after the modal reports success.
     */
    requiresSubscription?: boolean;
    /**
     * Remaining unlock uses for this tool after this request was served
     * (only present when the visitor has an active grant). The client can
     * surface this as "2 runs left" so the user understands the limit.
     */
    unlockUsesRemaining?: number;
}

export interface ToolRequestContext {
    ipHash: string | null;
    userAgentHash: string | null;
    userAgent: string | null;
    locale: ToolLocale;
    referrer: string | null;
    utm: Record<string, string>;
}
