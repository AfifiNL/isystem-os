import { z } from "zod";

export const legalDocumentKindSchema = z.enum([
    "agreement",
    "invoice",
    "receipt",
    "accounting_export",
    "identity",
    "correspondence",
    "other",
]);

export const legalAgreementStatusSchema = z.enum([
    "draft",
    "sent",
    "viewed",
    "signed",
    "void",
    "expired",
]);

export const legalTemplateCategorySchema = z.enum([
    "dvo",
    "nda",
    "dpa",
    "invoice",
    "quote",
    "generic",
]);

// Title is bounded; storage paths come from server, not client. Retention is
// computed server-side when null. Hash is computed server-side.
export const legalDocumentUploadSchema = z.object({
    title: z.string().min(2).max(200),
    kind: legalDocumentKindSchema,
    clientId: z.string().uuid().nullable().optional(),
    relatedAgreementId: z.string().uuid().nullable().optional(),
    relatedEntryId: z.string().uuid().nullable().optional(),
    notes: z.string().max(2000).optional(),
});
export type LegalDocumentUploadInput = z.infer<typeof legalDocumentUploadSchema>;

export const legalDocumentSoftDeleteSchema = z.object({
    documentId: z.string().uuid(),
});

export const templateVariableSchema = z.object({
    key: z.string().regex(/^[a-z][a-z0-9_]*$/),
    label: z.string().min(1).max(80),
    type: z.enum(["string", "number", "date", "money_cents", "multiline"]),
    required: z.boolean(),
    description: z.string().max(280).optional(),
    defaultValue: z.union([z.string(), z.number()]).optional(),
});

export const legalAgreementTemplateUpsertSchema = z.object({
    id: z.string().uuid().optional(),
    slug: z
        .string()
        .min(2)
        .max(80)
        .regex(/^[a-z0-9][a-z0-9-]*$/, "Slug must be kebab-case alphanumerics."),
    name: z.string().min(2).max(160),
    locale: z.enum(["nl", "en", "ar"]),
    jurisdiction: z.string().min(2).max(40).default("NL"),
    category: legalTemplateCategorySchema,
    bodyMdx: z.string().min(20).max(60_000),
    variables: z.array(templateVariableSchema).max(64),
    isActive: z.boolean().default(true),
});
export type LegalAgreementTemplateUpsertInput = z.infer<typeof legalAgreementTemplateUpsertSchema>;

export const legalAgreementCreateSchema = z.object({
    templateId: z.string().uuid(),
    clientId: z.string().uuid().nullable().optional(),
    bookingId: z.string().uuid().nullable().optional(),
    partyName: z.string().min(2).max(160),
    partyEmail: z.string().email(),
    effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    variables: z.record(z.string(), z.union([z.string(), z.number()])),
});
export type LegalAgreementCreateInput = z.infer<typeof legalAgreementCreateSchema>;

export const accountingEntryUpsertSchema = z
    .object({
        id: z.string().uuid().optional(),
        direction: z.enum(["income", "expense"]),
        category: z.string().min(1).max(80),
        description: z.string().min(2).max(500),
        invoiceNumber: z.string().max(40).nullable().optional(),
        partyName: z.string().max(160).nullable().optional(),
        partyVatNumber: z.string().max(40).nullable().optional(),
        amountExclBtwCents: z.number().int(),
        btwRateBp: z.number().int().min(0).max(10_000),
        occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        currency: z.string().length(3).default("EUR"),
        documentId: z.string().uuid().nullable().optional(),
        notes: z.string().max(2000).nullable().optional(),
    })
    .superRefine((value, ctx) => {
        // Direction sign convention: amount cents are always non-negative;
        // direction column carries the sign. Reject obvious mistakes.
        if (value.amountExclBtwCents < 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["amountExclBtwCents"],
                message: "Amount must be non-negative; use direction to indicate income vs expense.",
            });
        }
    });
export type AccountingEntryUpsertInput = z.infer<typeof accountingEntryUpsertSchema>;
