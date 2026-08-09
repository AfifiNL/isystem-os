import { z } from "zod";

export const contactSubmitSchema = z.object({
    submissionId: z.string().uuid("Invalid contact submission id."),
    name: z.string().trim().min(1, "Please enter your name.").max(120),
    email: z.string().trim().email("Please enter a valid email address.").transform((value) => value.toLowerCase()),
    company: z.string().trim().max(160).optional().default(""),
    phone: z.string().trim().max(80).optional().default(""),
    requestType: z.string().trim().max(120).optional().default(""),
    timeline: z.string().trim().max(240).optional().default(""),
    challenge: z.string().trim().max(5000).optional().default(""),
    website: z.string().trim().max(1000).optional().default(""), // Honeypot field, intentionally accepted so anti-abuse can return a generic bot-safe response.
    formStartedAt: z.string().datetime({ offset: true }).optional().nullable(),
    templateId: z.string().trim().min(1),
    locale: z.string().trim().max(5).optional().nullable(),
    marketingConsent: z.boolean().optional().default(false),
});

export type ContactSubmitInput = z.infer<typeof contactSubmitSchema>;
