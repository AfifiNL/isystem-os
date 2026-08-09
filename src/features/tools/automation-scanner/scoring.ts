import type { AutomationScannerInput } from "./schema";

export type Difficulty = "easy" | "medium" | "hard";

export interface AutomationRecommendation {
    id: string;
    title: string;
    summary: string;
    monthlyHoursSaved: number;
    monthlyEurSaved: number;
    difficulty: Difficulty;
    /** Recommended tools (affiliate ids). */
    tools: string[];
}

export interface AutomationScannerResult {
    readinessScore: number; // 0-100
    monthlyHoursReclaimable: number;
    yearlyEurReclaimable: number;
    /** @deprecated Use readinessScore. */
    readiness: number; // 0-100
    readinessLabel: "low" | "moderate" | "high" | "critical";
    /** @deprecated Use monthlyHoursReclaimable. */
    monthlyHoursSaved: number;
    monthlyEurSaved: number;
    /** @deprecated Use yearlyEurReclaimable. */
    yearlyEurSaved: number;
    recommendations: AutomationRecommendation[];
    stackSummary: string;
}

const TASK_BLUEPRINTS: Record<
    string,
    {
        title: string;
        summary: string;
        baseHoursPerMonth: number;
        difficulty: Difficulty;
        tools: string[];
    }
> = {
    "lead-intake": {
        title: "Auto-route and qualify inbound leads",
        summary:
            "Capture leads from forms/email/WhatsApp into your CRM, score them with AI, and trigger a personalized first-touch sequence.",
        baseHoursPerMonth: 12,
        difficulty: "medium",
        tools: ["n8n", "hubspot", "pipedrive"],
    },
    scheduling: {
        title: "Self-serve appointment booking",
        summary:
            "Replace email tag with a booking page synced to your calendar, sending automated reminders and confirmations.",
        baseHoursPerMonth: 10,
        difficulty: "easy",
        tools: ["calendly", "hubspot"],
    },
    invoicing: {
        title: "Recurring invoice + reminder automation",
        summary:
            "Trigger invoices on contract events, send dunning reminders automatically, sync to bookkeeping.",
        baseHoursPerMonth: 8,
        difficulty: "easy",
        tools: ["zapier", "make"],
    },
    quotes: {
        title: "AI-assisted quote generation",
        summary:
            "Pre-fill quote templates from intake forms; let AI draft scope + price ranges for review before sending.",
        baseHoursPerMonth: 14,
        difficulty: "medium",
        tools: ["n8n", "hubspot"],
    },
    support: {
        title: "Tier-1 support deflection",
        summary:
            "Train a chatbot on your FAQs + docs; auto-resolve repetitive questions and route everything else to humans with context.",
        baseHoursPerMonth: 20,
        difficulty: "medium",
        tools: ["tidio", "crisp"],
    },
    reviews: {
        title: "Post-service review collection",
        summary:
            "After a job/booking, automatically request a Google/Trustpilot review with a smart sentiment-aware ask.",
        baseHoursPerMonth: 5,
        difficulty: "easy",
        tools: ["zapier", "make"],
    },
    "social-posting": {
        title: "Multi-channel social publishing",
        summary:
            "Plan posts in one place, AI-rewrite per channel, schedule and track engagement automatically.",
        baseHoursPerMonth: 9,
        difficulty: "easy",
        tools: ["zapier", "notion"],
    },
    "report-building": {
        title: "Automated client reports",
        summary:
            "Pull data from your tools, run a templated summary, send a branded PDF on a schedule.",
        baseHoursPerMonth: 12,
        difficulty: "medium",
        tools: ["n8n", "make"],
    },
    "data-entry": {
        title: "Data-entry / migration automation",
        summary:
            "Eliminate copy-paste between tools with mapped, two-way sync. Validate inputs and surface mismatches automatically.",
        baseHoursPerMonth: 16,
        difficulty: "medium",
        tools: ["n8n", "zapier"],
    },
    onboarding: {
        title: "Client onboarding sequencer",
        summary:
            "Trigger contracts, intake forms, kickoff invites, and resources from a single 'new client' event.",
        baseHoursPerMonth: 11,
        difficulty: "medium",
        tools: ["hubspot", "n8n"],
    },
};

function teamMultiplier(team: AutomationScannerInput["teamSize"]): number {
    switch (team) {
        case "solo":
            return 0.7;
        case "2-5":
            return 1.0;
        case "6-15":
            return 1.4;
        case "16-50":
            return 1.8;
        case "50+":
            return 2.4;
    }
}

function comfortMultiplier(level: AutomationScannerInput["techComfort"]): number {
    return level === "high" ? 1.1 : level === "medium" ? 1.0 : 0.85;
}

function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
}

export function scoreAutomationScanner(input: AutomationScannerInput): AutomationScannerResult {
    const teamMult = teamMultiplier(input.teamSize);
    const comfortMult = comfortMultiplier(input.techComfort);

    const recommendations: AutomationRecommendation[] = input.recurringTasks
        .flatMap<AutomationRecommendation>((taskId) => {
            const blueprint = TASK_BLUEPRINTS[taskId];
            if (!blueprint) return [];
            const repetitionBoost = 1 + input.repeatedQuestionsPercent / 200;
            const inquiriesBoost = taskId === "support" ? 1 + Math.min(1, input.monthlyCustomerInquiries / 600) : 1;
            const monthlyHoursSaved = Math.round(blueprint.baseHoursPerMonth * teamMult * comfortMult * repetitionBoost * inquiriesBoost * 10) / 10;
            const monthlyEurSaved = Math.round(monthlyHoursSaved * input.avgHourlyCostEur);
            return [{
                id: taskId,
                title: blueprint.title,
                summary: blueprint.summary,
                monthlyHoursSaved,
                monthlyEurSaved,
                difficulty: blueprint.difficulty,
                tools: blueprint.tools,
            }];
        })
        .sort((a, b) => b.monthlyEurSaved - a.monthlyEurSaved)
        .slice(0, 5);

    const monthlyHoursSaved = Math.round(recommendations.reduce((s, r) => s + r.monthlyHoursSaved, 0) * 10) / 10;
    const monthlyEurSaved = Math.round(recommendations.reduce((s, r) => s + r.monthlyEurSaved, 0));
    const yearlyEurSaved = monthlyEurSaved * 12;

    // Readiness: combines repetition, inquiry volume, current stack maturity, and comfort.
    const stackMaturity = clamp(input.currentStack.length * 8, 0, 32);
    const repetitionScore = clamp(input.repeatedQuestionsPercent * 0.3, 0, 30);
    const volumeScore = clamp(input.monthlyCustomerInquiries / 30, 0, 18);
    const comfortScore = input.techComfort === "high" ? 15 : input.techComfort === "medium" ? 10 : 5;
    const readiness = clamp(Math.round(stackMaturity + repetitionScore + volumeScore + comfortScore), 0, 100);
    const readinessLabel: AutomationScannerResult["readinessLabel"] =
        readiness >= 75 ? "critical" : readiness >= 55 ? "high" : readiness >= 35 ? "moderate" : "low";

    const stackSummary = `Recommended core stack: CRM (HubSpot Free or Pipedrive) + Workflow engine (n8n or Make.com) + ${
        input.recurringTasks.includes("support") ? "Chatbot (Tidio/Crisp)" : "Email automation"
    } + ${input.recurringTasks.includes("scheduling") ? "Scheduling (Calendly)" : "Knowledge base (Notion)"}.`;

    return {
        readinessScore: readiness,
        monthlyHoursReclaimable: monthlyHoursSaved,
        yearlyEurReclaimable: yearlyEurSaved,
        readiness,
        readinessLabel,
        monthlyHoursSaved,
        monthlyEurSaved,
        yearlyEurSaved,
        recommendations,
        stackSummary,
    };
}
