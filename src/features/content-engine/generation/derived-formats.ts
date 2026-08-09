import type { DraftContentType } from "./draft-request-contract";

export interface DerivedDraftOutput {
    format: "newsletter_issue";
    derivedFrom: "blog_post";
    status: "generated" | "failed";
    companionFormats: Array<"newsletter_subject_lines" | "newsletter_preheader">;
}

interface NormalizeGeneratedDraftFormatsInput {
    generatedFormats: Record<string, unknown>;
    requestedFormats: readonly DraftContentType[];
    evidencePack: unknown;
}

export function normalizeGeneratedDraftFormats({
    generatedFormats,
    requestedFormats,
    evidencePack,
}: NormalizeGeneratedDraftFormatsInput): {
    generatedFormats: Record<string, unknown>;
    derivedOutputs: DerivedDraftOutput[];
} {
    const formats = { ...generatedFormats };
    const newsletterWasDerived = requestedFormats.includes("blog_post")
        && !requestedFormats.includes("newsletter_issue");
    const derivedOutputs: DerivedDraftOutput[] = [];
    const newsletterRaw = formats.newsletter_issue;

    if (newsletterRaw && typeof newsletterRaw === "object" && !Array.isArray(newsletterRaw)) {
        const object = newsletterRaw as Record<string, unknown>;
        const body = typeof object.body_markdown === "string"
            ? object.body_markdown.trim()
            : "";
        const subjectLines = Array.isArray(object.subject_lines)
            ? object.subject_lines.filter((value): value is string => typeof value === "string")
            : [];
        const preheader = typeof object.preheader === "string"
            ? object.preheader.trim()
            : "";

        if (body) {
            formats.newsletter_issue = body;
            formats.newsletter_issue_full = {
                body,
                subject_lines: subjectLines,
                preheader,
                evidence_pack: evidencePack,
            };
            if (subjectLines.length > 0) {
                formats.newsletter_subject_lines = subjectLines;
            }
            if (preheader) {
                formats.newsletter_preheader = preheader;
            }
            if (newsletterWasDerived) {
                derivedOutputs.push({
                    format: "newsletter_issue",
                    derivedFrom: "blog_post",
                    status: "generated",
                    companionFormats: [
                        ...(subjectLines.length > 0 ? ["newsletter_subject_lines" as const] : []),
                        ...(preheader ? ["newsletter_preheader" as const] : []),
                    ],
                });
            }
        } else {
            delete formats.newsletter_issue;
            if (newsletterWasDerived) {
                derivedOutputs.push({
                    format: "newsletter_issue",
                    derivedFrom: "blog_post",
                    status: "failed",
                    companionFormats: [],
                });
            }
        }
    } else if (newsletterWasDerived) {
        derivedOutputs.push({
            format: "newsletter_issue",
            derivedFrom: "blog_post",
            status: "failed",
            companionFormats: [],
        });
    }

    return { generatedFormats: formats, derivedOutputs };
}
