import type {
    BlogEditorialValidationResult,
    EditorialValidationIssue,
} from "./blog-editorial-validation";

export const BLOG_EDITORIAL_PUBLICATION_SCORE_FLOOR = 82;

const EMPTY_FORBIDDEN_PUBLIC_TERMS: readonly string[] = [];

export interface BlogEditorialPublicPolicy {
    forbiddenPublicTerms: readonly string[];
    publicationScoreFloor: number;
}

export interface BlogEditorialPublicationReadiness {
    ready: boolean;
    blockingIssues: EditorialValidationIssue[];
    meetsScoreFloor: boolean;
    scoreFloor: number;
}

export function getBlogEditorialPublicPolicy(
    templateId: string | null | undefined,
): BlogEditorialPublicPolicy {
    void templateId; // Retained for a stable, template-aware call contract.
    return {
        forbiddenPublicTerms: EMPTY_FORBIDDEN_PUBLIC_TERMS,
        publicationScoreFloor: BLOG_EDITORIAL_PUBLICATION_SCORE_FLOOR,
    };
}

export function assessBlogEditorialPublicationReadiness(
    result: BlogEditorialValidationResult,
    options: {
        locale?: string | null;
        scoreFloor?: number;
    } = {},
): BlogEditorialPublicationReadiness {
    const locale = options.locale === "nl" || options.locale === "ar"
        ? options.locale
        : "en";
    const scoreFloor = options.scoreFloor ?? BLOG_EDITORIAL_PUBLICATION_SCORE_FLOOR;
    const blockingIssues = result.issues.filter((issue) => {
        if (issue.severity !== "error") return false;
        if (locale !== "en" && issue.code === "primary_keyword_missing_from_seo_title") {
            return false;
        }
        if (
            locale === "ar"
            && (
                issue.code === "seo_title_outside_safe_band"
                || issue.code === "seo_description_outside_safe_band"
            )
        ) {
            return false;
        }
        return true;
    });
    const meetsScoreFloor = result.scorecard.overall >= scoreFloor;

    return {
        ready: blockingIssues.length === 0 && meetsScoreFloor,
        blockingIssues,
        meetsScoreFloor,
        scoreFloor,
    };
}

export function getBlogEditorialRepairTargets(
    result: BlogEditorialValidationResult,
    options: {
        locale?: string | null;
        scoreFloor?: number;
    } = {},
): EditorialValidationIssue[] {
    const readiness = assessBlogEditorialPublicationReadiness(result, options);
    if (readiness.blockingIssues.length > 0) return readiness.blockingIssues;
    if (readiness.meetsScoreFloor) return [];
    return result.issues.filter((issue) => issue.severity !== "info");
}
