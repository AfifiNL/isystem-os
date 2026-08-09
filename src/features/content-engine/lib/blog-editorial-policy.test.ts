import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
    BlogEditorialValidationResult,
    EditorialValidationIssue,
} from "./blog-editorial-validation";
import {
    assessBlogEditorialPublicationReadiness,
    getBlogEditorialPublicPolicy,
} from "./blog-editorial-policy";

function resultWith(
    issues: EditorialValidationIssue[],
    overall = 100,
): BlogEditorialValidationResult {
    return {
        valid: !issues.some((issue) => issue.severity === "error"),
        issues,
        scorecard: {
            overall,
            passed: !issues.some((issue) => issue.severity === "error"),
            dimensions: {} as BlogEditorialValidationResult["scorecard"]["dimensions"],
        },
        headings: [],
        stats: {
            wordCount: 0,
            h2Count: 0,
            h3Count: 0,
            h4PlusCount: 0,
            visualShortcodeCount: 0,
            internalMarkdownLinkCount: 0,
            externalMarkdownLinkCount: 0,
        },
    };
}

const WARNING: EditorialValidationIssue = {
    code: "editorial_recommendation",
    severity: "warning",
    dimension: "editorialDepth",
    message: "A non-blocking recommendation remains.",
    repairInstruction: "Improve this during the next editorial pass.",
};

describe("blog editorial publication policy", () => {
    it("does not embed client-specific forbidden terms in the reusable policy", () => {
        assert.deepEqual(
            getBlogEditorialPublicPolicy("isystem-agency").forbiddenPublicTerms,
            [],
        );
        assert.deepEqual(
            getBlogEditorialPublicPolicy("another-template").forbiddenPublicTerms,
            [],
        );
    });

    it("treats recommendations as publishable when there are no errors and the score meets the floor", () => {
        const readiness = assessBlogEditorialPublicationReadiness(
            resultWith([WARNING], 92),
            { locale: "en" },
        );

        assert.equal(readiness.ready, true);
        assert.deepEqual(readiness.blockingIssues, []);
    });

    it("keeps the score floor and true errors as publication blockers", () => {
        const error: EditorialValidationIssue = {
            ...WARNING,
            code: "forbidden_public_term",
            severity: "error",
        };

        assert.equal(
            assessBlogEditorialPublicationReadiness(resultWith([WARNING], 81), { locale: "en" }).ready,
            false,
        );
        assert.deepEqual(
            assessBlogEditorialPublicationReadiness(resultWith([error], 95), { locale: "en" }).blockingIssues,
            [error],
        );
    });

    it("preserves the existing locale-specific publication exceptions in the shared policy", () => {
        const localizedKeywordIssue: EditorialValidationIssue = {
            ...WARNING,
            code: "primary_keyword_missing_from_seo_title",
            severity: "error",
            dimension: "seo",
        };

        assert.equal(
            assessBlogEditorialPublicationReadiness(resultWith([localizedKeywordIssue], 90), { locale: "en" }).ready,
            false,
        );
        assert.equal(
            assessBlogEditorialPublicationReadiness(resultWith([localizedKeywordIssue], 90), { locale: "nl" }).ready,
            true,
        );
    });
});
