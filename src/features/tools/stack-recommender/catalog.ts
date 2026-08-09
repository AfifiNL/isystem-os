import { z } from "zod";
import { toolGuardrailsSchema } from "../shared/guardrails";

export const STACK_INDUSTRIES = [
    "agency",
    "consultant",
    "ecommerce",
    "real-estate",
    "law-firm",
    "dental-clinic",
    "restaurant",
    "saas",
    "trades",
    "other",
] as const;

export const STACK_PAINS = [
    "lead-gen",
    "support",
    "content",
    "scheduling",
    "reporting",
    "compliance",
    "sales-followup",
    "ops",
] as const;

export const stackInputSchema = z.object({
    industry: z.enum(STACK_INDUSTRIES),
    teamSize: z.enum(["solo", "2-5", "6-15", "16-50", "50+"]),
    monthlyBudgetEur: z.number().min(0).max(20000),
    pains: z.array(z.enum(STACK_PAINS)).min(1).max(STACK_PAINS.length),
    techComfort: z.enum(["low", "medium", "high"]),
}).extend(toolGuardrailsSchema.shape);

export type StackInput = z.infer<typeof stackInputSchema>;

export interface StackItem {
    affiliateId: string;
    name: string;
    purpose: string;
    estMonthlyEur: number;
    setupHours: number;
}

export interface StackTier {
    label: "Starter" | "Growth" | "Automation";
    monthlyCostEur: number;
    setupHours: number;
    items: StackItem[];
    summary: string;
}

export type BudgetVerdict = "comfortable" | "tight" | "stretch";

export interface StackRecommendation {
    starter: StackTier;
    growth: StackTier | null;
    automation: StackTier | null;
    tiers: StackTier[];
    budgetVerdict: BudgetVerdict;
    sequenceNote: string;
}

const ITEMS: Record<string, StackItem> = {
    hubspot: { affiliateId: "hubspot", name: "HubSpot Free CRM", purpose: "Contact + deal pipeline", estMonthlyEur: 0, setupHours: 4 },
    pipedrive: { affiliateId: "pipedrive", name: "Pipedrive", purpose: "Sales-led CRM with strong pipeline UX", estMonthlyEur: 19, setupHours: 6 },
    notion: { affiliateId: "notion", name: "Notion", purpose: "Wiki + lightweight CRM + SOPs", estMonthlyEur: 8, setupHours: 4 },
    n8n: { affiliateId: "n8n", name: "n8n (self-hosted or cloud)", purpose: "Workflow automation between apps", estMonthlyEur: 20, setupHours: 12 },
    zapier: { affiliateId: "zapier", name: "Zapier", purpose: "No-code automation, biggest connector library", estMonthlyEur: 49, setupHours: 6 },
    make: { affiliateId: "make", name: "Make.com", purpose: "Visual automation with generous free tier", estMonthlyEur: 16, setupHours: 8 },
    tidio: { affiliateId: "tidio", name: "Tidio", purpose: "AI chatbot + live chat + helpdesk", estMonthlyEur: 29, setupHours: 5 },
    crisp: { affiliateId: "crisp", name: "Crisp", purpose: "Shared inbox + chatbot + email campaigns", estMonthlyEur: 25, setupHours: 5 },
    calendly: { affiliateId: "calendly", name: "Calendly", purpose: "Self-serve scheduling", estMonthlyEur: 10, setupHours: 1 },
    semrush: { affiliateId: "semrush", name: "Semrush", purpose: "SEO + AI search visibility + content gap", estMonthlyEur: 119, setupHours: 4 },
    cookieyes: { affiliateId: "cookieyes", name: "CookieYes", purpose: "GDPR cookie banner + consent log", estMonthlyEur: 10, setupHours: 1 },
};

const PAIN_TO_TIER_ADDONS: Record<(typeof STACK_PAINS)[number], { starter: string[]; growth: string[]; automation: string[] }> = {
    "lead-gen": { starter: ["hubspot"], growth: ["hubspot", "semrush"], automation: ["hubspot", "n8n", "semrush"] },
    support: { starter: ["tidio"], growth: ["tidio"], automation: ["crisp", "n8n"] },
    content: { starter: ["notion"], growth: ["notion", "semrush"], automation: ["notion", "n8n"] },
    scheduling: { starter: ["calendly"], growth: ["calendly"], automation: ["calendly", "n8n"] },
    reporting: { starter: ["notion"], growth: ["notion"], automation: ["n8n", "notion"] },
    compliance: { starter: ["cookieyes"], growth: ["cookieyes"], automation: ["cookieyes"] },
    "sales-followup": { starter: ["hubspot"], growth: ["hubspot", "make"], automation: ["pipedrive", "n8n"] },
    ops: { starter: ["zapier"], growth: ["make"], automation: ["n8n"] },
};

function tierComplexity(input: StackInput): { starterCap: number; growthCap: number } {
    const comfortFactor = input.techComfort === "high" ? 1.4 : input.techComfort === "low" ? 0.7 : 1.0;
    return {
        starterCap: Math.max(50, input.monthlyBudgetEur * 0.4 * comfortFactor),
        growthCap: Math.max(150, input.monthlyBudgetEur * 0.8 * comfortFactor),
    };
}

function buildTier(label: StackTier["label"], itemIds: string[], summary: string): StackTier {
    const dedup = Array.from(new Set(itemIds));
    const items = dedup.map((id) => ITEMS[id]).filter((x): x is StackItem => Boolean(x));
    return {
        label,
        monthlyCostEur: items.reduce((s, i) => s + i.estMonthlyEur, 0),
        setupHours: items.reduce((s, i) => s + i.setupHours, 0),
        items,
        summary,
    };
}

export function recommendStack(input: StackInput): StackRecommendation {
    const { starterCap, growthCap } = tierComplexity(input);

    const starterIds = input.pains.flatMap((p) => PAIN_TO_TIER_ADDONS[p].starter);
    const growthIds = input.pains.flatMap((p) => PAIN_TO_TIER_ADDONS[p].growth);
    const automationIds = input.pains.flatMap((p) => PAIN_TO_TIER_ADDONS[p].automation);

    const starter = buildTier("Starter", starterIds, `Minimum-viable setup tuned to a ~€${Math.round(starterCap)} / month software budget.`);
    const growth = buildTier("Growth", growthIds, `Adds growth tooling (CRM upgrade, SEO/AI visibility). Targets ~€${Math.round(growthCap)} / month.`);
    const automation = buildTier(
        "Automation",
        automationIds,
        "Adds an automation engine (n8n or Make) and removes manual hand-offs across the stack.",
    );

    const budget = input.monthlyBudgetEur;
    const budgetVerdict: BudgetVerdict = starter.monthlyCostEur <= budget * 0.6
        ? "comfortable"
        : starter.monthlyCostEur <= budget * 0.95
            ? "tight"
            : "stretch";
    const growthWithinBudget = growth.monthlyCostEur <= budget;
    const hasAutomationPain = input.pains.some((pain) => pain === "lead-gen" || pain === "sales-followup" || pain === "support");
    const automationWithinBudget = automation.monthlyCostEur <= budget;
    const includedGrowth = growthWithinBudget ? growth : null;
    const includedAutomation = hasAutomationPain && automationWithinBudget ? automation : null;
    const tiers = [starter, includedGrowth, includedAutomation].filter((tier): tier is StackTier => Boolean(tier));
    const sequenceNote = [
        "Start with Starter until the process is actually used by the team.",
        includedGrowth ? "Add Growth once the CRM/content rhythm is stable." : "Skip Growth for now because it exceeds the stated software budget.",
        includedAutomation
            ? "Add Automation last, after lead/support hand-offs are clear enough to automate."
            : hasAutomationPain
                ? "Automation matches your pains, but exceeds the stated budget today."
                : "Automation is withheld because your selected pains do not require workflow automation yet.",
    ].join(" ");

    return { starter, growth: includedGrowth, automation: includedAutomation, tiers, budgetVerdict, sequenceNote };
}
