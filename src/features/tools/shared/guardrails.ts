import { z } from "zod";

/**
 * Anti-abuse + rate-limit fields every public tool's Zod input must include.
 * Add via `.extend(toolGuardrailsSchema.shape)` on each tool's schema.
 *
 * This module is intentionally server-free — it lives separately from
 * `action-wrapper.ts` because tool schemas are imported by client components
 * (which can't pull `next/headers`).
 */
export const toolGuardrailsSchema = z.object({
    /** Honeypot — real users never fill this. */
    website: z.string().max(200).optional(),
    /** ISO timestamp captured at form mount; used for dwell-time check. */
    formStartedAt: z.string().datetime({ offset: true }).optional(),
});

export type ToolGuardrails = z.infer<typeof toolGuardrailsSchema>;
