"use server";

import { buildAdvice, buildEditChecklist, buildTemplateReply, getRatingBand, reviewInputSchema, type ReviewResult } from "./compute";
import { runWithToolGuardrails } from "../shared/action-wrapper";
import { saveToolLead } from "../shared/store";
import type { ToolActionResult } from "../shared/types";
import { callPublicAi } from "../shared/ai";

export interface ReviewActionResponse {
    result: ReviewResult;
    leadId: string | null;
    shareToken: string | null;
}

const LANGUAGE_LABEL: Record<"en" | "nl" | "ar", string> = {
    en: "English",
    nl: "Dutch (Nederlands)",
    ar: "Arabic (modern standard)",
};

export async function runReviewResponse(input: unknown): Promise<ToolActionResult<ReviewActionResponse>> {
    const parsed = reviewInputSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    const data = parsed.data;
    const { reviewText, starRating, businessName, businessType, locale, reviewerName, tone } = data;

    const guarded = await runWithToolGuardrails({
        tool: "review-response-generator",
        guardrails: { website: data.website, formStartedAt: data.formStartedAt },
        // The pasted review is the most likely vector for spammy content
        // (links, "viagra", crypto). Hand it to the shared spam-keyword scan.
        contentSummary: reviewText,
        sourcePath: "/tools/review-response-generator",
        compute: async (context) => {
            const instructions = [
                `Generate a single ${LANGUAGE_LABEL[locale]} reply to a Google review.`,
                `Business name: ${businessName}. Business type: ${businessType}. Star rating: ${starRating}/5. Tone: ${tone}.`,
                reviewerName ? `Reviewer first name: ${reviewerName}.` : "Reviewer name unknown — use a neutral greeting.",
                "Reply rules: 60-130 words, no markdown, no emojis, no apologies for things that weren't claimed, do not promise refunds or specific compensation, offer a direct email follow-up if rating is 1-2.",
                "Return strict JSON only: {\"reply\": string, \"editChecklist\": string[]}.",
            ].join("\n");

            const ai = await callPublicAi({
                purpose: "Reply to public reviews in a professional, locale-appropriate tone.",
                userContent: reviewText,
                instructions,
                maxOutputTokens: 320,
            });

            const fallbackChecklist = buildEditChecklist(data);
            let result: ReviewResult = {
                reply: buildTemplateReply(data),
                source: "template",
                locale,
                ratingBand: getRatingBand(starRating),
                toneApplied: tone,
                editChecklist: fallbackChecklist,
                advice: buildAdvice(data),
            };

            if (ai.ok && ai.text) {
                try {
                    const cleaned = ai.text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
                    const parsed = JSON.parse(cleaned) as { reply?: unknown; editChecklist?: unknown };
                    result = {
                        ...result,
                        reply: typeof parsed.reply === "string" && parsed.reply.trim() ? parsed.reply.trim() : result.reply,
                        editChecklist: Array.isArray(parsed.editChecklist)
                            ? parsed.editChecklist.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 5)
                            : result.editChecklist,
                        source: "ai",
                    };
                } catch {
                    result = { ...result, reply: ai.text.trim(), source: "ai" };
                }
            }

            const saved = await saveToolLead({
                tool: "review-response-generator",
                payload: { ...data, reviewText: reviewText.slice(0, 500) },
                result: result as unknown as Record<string, unknown>,
                context,
                shareable: false,
            });

            return { ok: true, data: { result, leadId: saved?.id ?? null, shareToken: null } };
        },
    });

    return guarded as ToolActionResult<ReviewActionResponse>;
}
