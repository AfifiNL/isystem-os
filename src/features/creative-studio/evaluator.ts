import { z } from "zod";

export const creativeSafetyPreflightSchema = z.object({
    status: z.enum(["pass", "needs_review", "blocked"]),
    human_approval_required: z.literal(true),
    blocked_claims: z.array(z.string()).default([]),
    downgraded_claims: z.array(z.string()).default([]),
    rights_flags: z.array(z.string()).default([]),
    policy_flags: z.array(z.string()).default([]),
    evidence_status: z.enum(["source_grounded", "metadata_only", "missing", "stale"]),
    render_queueing: z.literal("blocked_until_human_approval"),
});

export const creativeEvaluatorOutputSchema = z.object({
    overall_score: z.number().min(0).max(100),
    claim_safety_score: z.number().min(0).max(100),
    rights_safety_score: z.number().min(0).max(100),
    brand_fit_score: z.number().min(0).max(100),
    platform_fit_score: z.number().min(0).max(100),
    verdict: z.enum(["pass", "needs_human_review", "fail"]),
    unsupported_claims: z.array(z.string()).default([]),
    required_human_checks: z.array(z.string()).default([]),
    regeneration_recommendations: z.array(z.string()).default([]),
});

export type CreativeSafetyPreflight = z.infer<typeof creativeSafetyPreflightSchema>;
export type CreativeEvaluatorOutput = z.infer<typeof creativeEvaluatorOutputSchema>;

export function buildEvaluatorPlan(input: {
    safety: CreativeSafetyPreflight;
    targetChannel: string | null;
    locale: string;
}): Record<string, unknown> {
    return {
        schema: "creative_evaluator_output_v1",
        required_before_asset_export: true,
        render_queueing: "blocked_until_human_approval",
        target_channel: input.targetChannel,
        locale: input.locale,
        checks: [
            "source-grounded claim review",
            "rights and likeness review",
            "brand fit review",
            "platform constraint review",
            "human final approval",
        ],
        preflight_status: input.safety.status,
        blocked_claims_count: input.safety.blocked_claims.length,
        rights_flags_count: input.safety.rights_flags.length,
    };
}
