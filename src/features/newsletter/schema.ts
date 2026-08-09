import { z } from "zod";

export const newsletterSubscribeSchema = z.object({
    email: z.string().trim().email("Please enter a valid email address.").transform((value) => value.toLowerCase()),
    website: z.string().trim().max(1000).optional().default(""),
    formStartedAt: z.string().datetime({ offset: true }).optional().nullable(),
    templateId: z.string().trim().min(1).optional().nullable(),
    // Optional first name captured by the tool-unlock modal. Not used by
    // the audience append today (the audience contract is email-only) but
    // logged into analytics metadata so future personalization can pick
    // it up. Length-bounded for safety.
    firstName: z.string().trim().min(1).max(80).optional(),
    // Free-form attribution string. Used by the popup host to thread the
    // popup id through ("popup_<uuid>") so newsletter analytics can credit
    // the conversion back. Length-bounded; never reflected in user-visible
    // surfaces, so it doesn't need stricter character validation.
    source: z.string().trim().min(1).max(120).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    // When set, the endpoint mints a tool-unlock grant and sets the
    // HttpOnly cookie that unlocks N more runs of the named tool. The
    // tool slug is constrained to the free-tools surface so this can't
    // be repurposed as a generic unlock minter.
    grantUnlock: z.object({
        tool: z.enum([
            "automation-scanner",
            "automation-roi-calculator",
            "ai-stack-recommender",
            "ai-visibility-checker",
            "support-automation-readiness",
            "review-response-generator",
            "gdpr-cookie-scanner",
            "conversion-audit",
            "nl-zzp-agreement-generator",
        ]),
    }).optional(),
});

export type NewsletterSubscribeInput = z.infer<typeof newsletterSubscribeSchema>;

export const NEWSLETTER_DEFAULT_ACCENT = "#0d4f8c";

// Sentinel used by the legacy default so we can detect and warn on settings
// rows that were created before the operator filled in a real postal address.
// CAN-SPAM (US) and the equivalent EU bulk-sender rules require a physical
// address in every commercial email; shipping with this string is non-compliant.
export const NEWSLETTER_ADDRESS_PLACEHOLDER = "Workspace address not configured yet";

export function buildDefaultNewsletterSettings(workspaceName: string) {
    return {
        fromName: workspaceName,
        fromEmail: "noreply@example.invalid",
        replyToEmail: "",
        companyName: workspaceName,
        companyAddress: NEWSLETTER_ADDRESS_PLACEHOLDER,
        defaultAudienceName: `${workspaceName} newsletter`,
        welcomeSubject: `Welcome to ${workspaceName}`,
        welcomeHeading: "You’re in.",
        welcomeBody: "Thanks for subscribing. You’ll get high-signal newsletters, campaign updates, and fresh thinking from the workspace.",
        footerText: "You subscribed to receive newsletters from this workspace. Unsubscribe any time.",
        brandAccent: NEWSLETTER_DEFAULT_ACCENT,
    };
}

export const newsletterSettingsSchema = z.object({
    fromName: z.string().trim().min(1, "From name is required").max(120),
    fromEmail: z.string().trim().email("A valid sender email is required"),
    replyToEmail: z.string().trim().email("A valid reply-to email is required").optional().or(z.literal("")),
    companyName: z.string().trim().min(1, "Company name is required").max(160),
    companyAddress: z.string().trim().min(1, "Company address is required").max(280),
    defaultAudienceName: z.string().trim().min(1, "Default audience name is required").max(120),
    welcomeSubject: z.string().trim().min(1, "Welcome subject is required").max(160),
    welcomeHeading: z.string().trim().min(1, "Welcome heading is required").max(160),
    welcomeBody: z.string().trim().min(1, "Welcome body is required").max(1000),
    footerText: z.string().trim().min(1, "Footer text is required").max(280),
    brandAccent: z.string().trim().regex(/^#([0-9a-fA-F]{6})$/, "Brand accent must be a hex color"),
});

export type NewsletterSettingsInput = z.infer<typeof newsletterSettingsSchema>;

export const newsletterAudienceSchema = z.object({
    name: z.string().trim().min(1, "Audience name is required").max(120),
    description: z.string().trim().max(240).optional().or(z.literal("")),
    isDefault: z.boolean().optional().default(false),
});

export type NewsletterAudienceInput = z.infer<typeof newsletterAudienceSchema>;

export const newsletterTemplateSchema = z.object({
    name: z.string().trim().min(1, "Template name is required").max(120),
    workflowType: z.enum(["broadcast", "welcome_series", "nurture", "reengagement"]).default("broadcast"),
    subjectTemplate: z.string().trim().min(1, "Subject template is required").max(160),
    preheaderTemplate: z.string().trim().max(180).optional().or(z.literal("")),
    bodyMarkdownTemplate: z.string().trim().min(1, "Body template is required").max(12000),
    ctaLabel: z.string().trim().max(80).optional().or(z.literal("")),
    ctaUrl: z.string().trim().url("CTA URL must be valid").optional().or(z.literal("")),
});

export type NewsletterTemplateInput = z.infer<typeof newsletterTemplateSchema>;

export const newsletterCampaignSchema = z.object({
    title: z.string().trim().min(1, "Campaign title is required").max(160),
    workflowType: z.enum(["broadcast", "welcome_series", "nurture", "reengagement"]).default("broadcast"),
    subjectLine: z.string().trim().min(1, "Subject line is required").max(160),
    preheader: z.string().trim().max(180).optional().or(z.literal("")),
    bodyMarkdown: z.string().trim().min(1, "Campaign body is required").max(20000),
    audienceId: z.string().uuid("Audience selection is required"),
    templateId: z.string().uuid().optional().or(z.literal("")),
    sourceContentId: z.string().uuid().optional().or(z.literal("")),
    scheduledFor: z.string().datetime({ offset: true }).optional().nullable().or(z.literal("")),
    // Optional: when the campaign was derived from a content_item, the
    // public URL of that article. Used by the renderer to resolve
    // {{visual:slug}} placeholders into anchored links back to the article.
    articleUrl: z.string().url().optional(),
    // Marker set when the body was auto-derived from the article (excerpt +
    // teaser) because no `newsletter_issue` was produced. Surfaced in the
    // dashboard UI as a "Derived from article" banner so the operator knows
    // to review before sending.
    derivedFromArticle: z.boolean().optional(),
    provenance: z.record(z.string(), z.unknown()).optional(),
}).refine(
    (input) => {
        if (!input.scheduledFor) return true;
        return new Date(input.scheduledFor).getTime() >= Date.now() - 60_000;
    },
    { message: "Scheduled send time cannot be in the past.", path: ["scheduledFor"] },
);

export type NewsletterCampaignInput = z.infer<typeof newsletterCampaignSchema>;

export const newsletterAutomationSchema = z.object({
    name: z.string().trim().min(1, "Automation name is required").max(120),
    triggerType: z.enum(["manual", "contact_subscribed", "content_published"]),
    audienceId: z.string().uuid().optional().or(z.literal("")),
});

export type NewsletterAutomationInput = z.infer<typeof newsletterAutomationSchema>;

export const newsletterAutomationStepSchema = z.object({
    automationId: z.string().uuid(),
    templateId: z.string().uuid("Template is required"),
    position: z.coerce.number().int().positive(),
    delayMinutes: z.coerce.number().int().min(0).default(0),
    subjectLineOverride: z.string().trim().max(160).optional().or(z.literal("")),
    preheaderOverride: z.string().trim().max(180).optional().or(z.literal("")),
    bodyMarkdownOverride: z.string().trim().max(20000).optional().or(z.literal("")),
});

export type NewsletterAutomationStepInput = z.infer<typeof newsletterAutomationStepSchema>;
