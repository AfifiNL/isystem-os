import { z } from "zod";
import { toolGuardrailsSchema } from "../shared/guardrails";

export const supportInputSchema = z.object({
    monthlyTickets: z.number().int().min(0).max(200000).optional(),
    monthlyInquiries: z.number().int().min(0).max(200000),
    repeatRatePercent: z.number().min(0).max(100).optional(),
    repeatedQuestionsPercent: z.number().min(0).max(100),
    avgResolutionMinutes: z.number().min(0).max(10080).optional(),
    channels: z.array(z.enum(["email", "chat", "phone", "whatsapp", "social"])).min(1),
    avgResponseHours: z.number().min(0).max(168),
    avgComplexity: z.enum(["low", "medium", "high"]),
    teamSize: z.number().int().min(0).max(500),
    avgAgentCostEurMonth: z.number().min(0).max(20000),
    hasFaq: z.boolean(),
    hasHelpdesk: z.boolean(),
    currentAutomations: z.array(z.string().max(60)).max(20).optional(),
}).extend(toolGuardrailsSchema.shape);

export type SupportInput = z.infer<typeof supportInputSchema>;

export type AutomationType = "chatbot" | "ai_phone_agent" | "faq_kb" | "ticket_triage" | "hybrid_human";

export interface SupportResult {
    readinessScore: number; // 0-100
    recommendedApproach: string;
    recommendedChannels: string[];
    pitfalls: string[];
    /** @deprecated Use recommendedApproach. */
    primaryRecommendation: AutomationType;
    monthlyHoursSaved: number;
    monthlyEurSaved: number;
    payback: { tooling: number; recoveredHours: number };
    rationale: string[];
}

const TYPE_LABEL: Record<AutomationType, string> = {
    chatbot: "AI chatbot (web/chat-first)",
    ai_phone_agent: "AI phone / voice agent",
    faq_kb: "Self-serve FAQ + knowledge base",
    ticket_triage: "AI ticket triage + drafting",
    hybrid_human: "Human-led with AI assist",
};

export function getAutomationTypeLabel(type: AutomationType): string {
    return TYPE_LABEL[type];
}

export function computeSupportReadiness(input: SupportInput): SupportResult {
    const rationale: string[] = [];

    // Volume × repetition is the biggest signal for automation viability.
    let score = 0;
    score += Math.min(35, input.monthlyInquiries / 30);
    if (input.monthlyInquiries >= 500) rationale.push("High inquiry volume — automation has a clear ROI ceiling.");
    score += input.repeatedQuestionsPercent * 0.25;
    if (input.repeatedQuestionsPercent >= 60) rationale.push("Most inquiries are repeated — deflection will hit quickly.");

    // Channels: chat/whatsapp lean chatbot, phone leans voice agent, mixed favors hybrid.
    const hasChat = input.channels.some((c) => c === "chat" || c === "whatsapp" || c === "social");
    const hasPhone = input.channels.includes("phone");
    if (hasChat) score += 5;
    if (hasPhone) score += 3;

    // Slow response is a strong driver.
    if (input.avgResponseHours > 8) {
        score += 10;
        rationale.push("Response time > 8h — first-touch automation will materially improve SLA.");
    } else if (input.avgResponseHours <= 1) {
        rationale.push("Already responsive — automation augments rather than replaces.");
    }

    // Complexity caps automation viability.
    if (input.avgComplexity === "low") score += 10;
    if (input.avgComplexity === "high") {
        score -= 8;
        rationale.push("High complexity inquiries — AI should triage and draft, humans must approve.");
    }

    // Infrastructure helpers.
    if (input.hasFaq) score += 4;
    if (input.hasHelpdesk) score += 4;
    if (!input.hasFaq) rationale.push("Build a public FAQ first — it doubles as your chatbot's training corpus.");

    score = Math.max(0, Math.min(100, Math.round(score)));

    // Pick primary recommendation by signal mix.
    let primary: AutomationType;
    if (input.avgComplexity === "high" && input.repeatedQuestionsPercent < 40) {
        primary = "hybrid_human";
    } else if (hasPhone && !hasChat) {
        primary = "ai_phone_agent";
    } else if (input.repeatedQuestionsPercent >= 70) {
        primary = hasChat ? "chatbot" : "faq_kb";
    } else if (input.avgResponseHours > 24) {
        primary = "ticket_triage";
    } else {
        primary = "chatbot";
    }

    // Savings model: deflection rate from primary recommendation × per-inquiry handle time × cost.
    const deflectionRate =
        primary === "chatbot" ? 0.45 :
            primary === "ai_phone_agent" ? 0.3 :
                primary === "faq_kb" ? 0.25 :
                    primary === "ticket_triage" ? 0.35 : 0.15;
    const minutesPerInquiry = input.avgComplexity === "low" ? 5 : input.avgComplexity === "high" ? 18 : 10;
    const deflectedInquiries = input.monthlyInquiries * deflectionRate * (input.repeatedQuestionsPercent / 100);
    const minutesSaved = deflectedInquiries * minutesPerInquiry;
    const monthlyHoursSaved = Math.round((minutesSaved / 60) * 10) / 10;
    const hourlyCost = input.avgAgentCostEurMonth > 0 ? input.avgAgentCostEurMonth / 160 : 35;
    const monthlyEurSaved = Math.round(monthlyHoursSaved * hourlyCost);
    const recommendedChannels = primary === "ai_phone_agent"
        ? ["phone", "helpdesk"]
        : primary === "chatbot"
            ? [hasChat ? "chat" : "web chat", "knowledge base"]
            : primary === "ticket_triage"
                ? ["email", "helpdesk"]
                : ["knowledge base", "email"];
    const pitfalls = [
        !input.hasFaq ? "No FAQ/knowledge base yet — build source content before training a bot." : null,
        input.avgComplexity === "high" ? "High-complexity tickets need human approval; do not fully automate resolution." : null,
        input.repeatedQuestionsPercent < 35 ? "Low repetition limits deflection; use AI drafting before chatbot containment." : null,
    ].filter((item): item is string => Boolean(item));

    return {
        readinessScore: score,
        recommendedApproach: TYPE_LABEL[primary],
        recommendedChannels,
        pitfalls,
        primaryRecommendation: primary,
        monthlyHoursSaved,
        monthlyEurSaved,
        payback: {
            tooling:
                primary === "chatbot" ? 29 :
                    primary === "ai_phone_agent" ? 89 :
                        primary === "ticket_triage" ? 39 :
                            primary === "faq_kb" ? 15 : 0,
            recoveredHours: monthlyHoursSaved,
        },
        rationale,
    };
}
