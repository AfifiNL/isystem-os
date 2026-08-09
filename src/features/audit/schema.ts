import { z } from "zod";

// Mirror of AuditInputs but expressed as a Zod schema so the API route can
// validate untrusted client input before passing it to the calculation layer.
// Coerce because <input type="number"> serialises to a string when sent over
// JSON if the caller didn't parse it; coerce keeps the route forgiving.
const nonNegativeNumber = z.coerce
    .number()
    .finite("Value must be a finite number.")
    .min(0, "Value cannot be negative.")
    .max(10_000_000, "Value is too large.");

export const auditInputsSchema = z.object({
    crm_spend: nonNegativeNumber,
    marketing_spend: nonNegativeNumber,
    cms_spend: nonNegativeNumber,
    ops_spend: nonNegativeNumber,
    employee_count: nonNegativeNumber,
    hours_wasted: nonNegativeNumber,
    hourly_rate: nonNegativeNumber,
});

export const auditSubmitSchema = z.object({
    name: z.string().trim().min(1, "Name is required.").max(120),
    email: z
        .string()
        .trim()
        .email("Please enter a valid email address.")
        .transform((value) => value.toLowerCase()),
    // Honeypot (must be empty). Same shape as the newsletter schema so the
    // anti-abuse layer treats both surfaces identically.
    website: z.string().trim().max(0).optional().default(""),
    formStartedAt: z.string().datetime({ offset: true }).optional().nullable(),
    templateId: z.string().trim().min(1).optional().nullable(),
    locale: z.enum(["en", "nl", "ar"]).optional().nullable(),
    inputs: auditInputsSchema,
});

export type AuditSubmitInput = z.infer<typeof auditSubmitSchema>;
