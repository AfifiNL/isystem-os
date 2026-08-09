import { z } from "zod";
import { toolGuardrailsSchema } from "../shared/guardrails";

export const TEAM_SIZE_OPTIONS = ["solo", "2-5", "6-15", "16-50", "50+"] as const;
export const INDUSTRY_OPTIONS = [
    "agency",
    "ecommerce",
    "consultant",
    "real-estate",
    "law-firm",
    "dental-clinic",
    "restaurant",
    "saas",
    "trades",
    "other",
] as const;

export const RECURRING_TASK_OPTIONS = [
    "lead-intake",
    "scheduling",
    "invoicing",
    "quotes",
    "support",
    "reviews",
    "social-posting",
    "report-building",
    "data-entry",
    "onboarding",
] as const;

export const automationScannerInputSchema = z.object({
    industry: z.enum(INDUSTRY_OPTIONS),
    teamSize: z.enum(TEAM_SIZE_OPTIONS),
    monthlyLeads: z.number().int().min(0).max(50000),
    avgHourlyCostEur: z.number().min(5).max(500),
    repetitiveHoursPerWeek: z.number().min(0).max(200),
    monthlyCustomerInquiries: z.number().int().min(0).max(50000),
    repeatedQuestionsPercent: z.number().min(0).max(100),
    currentStack: z.array(z.string().max(40)).max(20),
    recurringTasks: z.array(z.enum(RECURRING_TASK_OPTIONS)).min(1).max(RECURRING_TASK_OPTIONS.length),
    biggestPainPoint: z.string().min(2).max(200),
    techComfort: z.enum(["low", "medium", "high"]),
}).extend(toolGuardrailsSchema.shape);

export type AutomationScannerInput = z.infer<typeof automationScannerInputSchema>;
