import { z } from "zod";
import { toolGuardrailsSchema } from "../shared/guardrails";

export const roiTaskSchema = z.object({
    name: z.string().min(1).max(80),
    hoursPerWeek: z.number().min(0).max(200),
    hourlyCostEur: z.number().min(5).max(500),
    errorReworkPercent: z.number().min(0).max(100),
});

export const roiInputSchema = z.object({
    tasks: z.array(roiTaskSchema).min(1).max(8),
    monthlyToolingCostEur: z.number().min(0).max(20000),
    implementationCostEur: z.number().min(0).max(500000),
    automationCoveragePercent: z.number().min(10).max(95),
}).extend(toolGuardrailsSchema.shape);

export type RoiTask = z.infer<typeof roiTaskSchema>;
export type RoiInput = z.infer<typeof roiInputSchema>;

export interface RoiTaskResult extends RoiTask {
    monthlyHours: number;
    monthlyWastedCostEur: number;
    yearlyWastedCostEur: number;
    yearlyAutomatedSavingsEur: number;
}

export interface RoiResult {
    tasks: RoiTaskResult[];
    monthlyWastedCostEur: number;
    yearlyWastedCostEur: number;
    monthlyToolingCostEur: number;
    yearlyAutomatedSavingsEur: number;
    netYearlySavingsEur: number;
    paybackMonths: number | null;
    automationLevel: "starter" | "growth" | "consolidation";
}

const WEEKS_PER_MONTH = 4.345;

export function computeRoi(input: RoiInput): RoiResult {
    const coverage = input.automationCoveragePercent / 100;
    const tasks: RoiTaskResult[] = input.tasks.map((task) => {
        const monthlyHours = task.hoursPerWeek * WEEKS_PER_MONTH;
        const reworkFactor = 1 + task.errorReworkPercent / 100;
        const monthlyWastedCostEur = Math.round(monthlyHours * task.hourlyCostEur * reworkFactor);
        const yearlyWastedCostEur = monthlyWastedCostEur * 12;
        const yearlyAutomatedSavingsEur = Math.round(yearlyWastedCostEur * coverage);
        return {
            ...task,
            monthlyHours: Math.round(monthlyHours * 10) / 10,
            monthlyWastedCostEur,
            yearlyWastedCostEur,
            yearlyAutomatedSavingsEur,
        };
    });

    const monthlyWastedCostEur = tasks.reduce((s, t) => s + t.monthlyWastedCostEur, 0);
    const yearlyWastedCostEur = monthlyWastedCostEur * 12;
    const yearlyAutomatedSavingsEur = tasks.reduce((s, t) => s + t.yearlyAutomatedSavingsEur, 0);
    const yearlyToolingCost = input.monthlyToolingCostEur * 12;
    const netYearlySavingsEur = Math.round(yearlyAutomatedSavingsEur - yearlyToolingCost - input.implementationCostEur);
    const monthlyNet = (yearlyAutomatedSavingsEur - yearlyToolingCost) / 12;
    const paybackMonths = monthlyNet > 0 ? Math.max(0, Math.round((input.implementationCostEur / monthlyNet) * 10) / 10) : null;
    const automationLevel: RoiResult["automationLevel"] =
        yearlyAutomatedSavingsEur >= 75000 ? "consolidation" : yearlyAutomatedSavingsEur >= 25000 ? "growth" : "starter";

    return {
        tasks,
        monthlyWastedCostEur,
        yearlyWastedCostEur,
        monthlyToolingCostEur: input.monthlyToolingCostEur,
        yearlyAutomatedSavingsEur,
        netYearlySavingsEur,
        paybackMonths,
        automationLevel,
    };
}
