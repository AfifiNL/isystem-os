// Pure calculation layer for the iSystem public Systems Audit. No React, no
// network — everything here must remain deterministic and side-effect-free
// so it can be reused by the API route (for payload persistence) and the
// client renderer (for live previews) without divergence.

export interface AuditInputs {
    crm_spend: number;
    marketing_spend: number;
    cms_spend: number;
    ops_spend: number;
    employee_count: number;
    hours_wasted: number;
    hourly_rate: number;
}

export interface AuditOutputs {
    total_monthly_saas_spend: number;
    total_annual_saas_spend: number;
    isystem_consolidation_savings: number;
    weekly_productivity_bleed: number;
    annual_productivity_bleed: number;
    projected_automation_recovery: number;
    combined_annual_savings: number;
}

export const CONSOLIDATION_SAVINGS_RATE = 0.45;
export const AUTOMATION_RECOVERY_RATE = 0.75;
export const WEEKS_PER_YEAR = 52;
export const MONTHS_PER_YEAR = 12;

export const EMPTY_AUDIT_INPUTS: AuditInputs = {
    crm_spend: 0,
    marketing_spend: 0,
    cms_spend: 0,
    ops_spend: 0,
    employee_count: 0,
    hours_wasted: 0,
    hourly_rate: 0,
};

// Coerce any user-supplied numeric value (string from <input type="number">,
// negative numbers, NaN) into a non-negative finite number. Inputs are money
// or counts — negatives are never meaningful.
export function clampNonNegative(value: unknown): number {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return 0;
    return n < 0 ? 0 : n;
}

export function sanitizeAuditInputs(raw: Partial<Record<keyof AuditInputs, unknown>>): AuditInputs {
    return {
        crm_spend: clampNonNegative(raw.crm_spend),
        marketing_spend: clampNonNegative(raw.marketing_spend),
        cms_spend: clampNonNegative(raw.cms_spend),
        ops_spend: clampNonNegative(raw.ops_spend),
        employee_count: clampNonNegative(raw.employee_count),
        hours_wasted: clampNonNegative(raw.hours_wasted),
        hourly_rate: clampNonNegative(raw.hourly_rate),
    };
}

export function calculateAuditOutputs(inputs: AuditInputs): AuditOutputs {
    const totalMonthlySaas =
        inputs.crm_spend + inputs.marketing_spend + inputs.cms_spend + inputs.ops_spend;
    const totalAnnualSaas = totalMonthlySaas * MONTHS_PER_YEAR;
    const consolidationSavings = totalAnnualSaas * CONSOLIDATION_SAVINGS_RATE;

    const weeklyBleed = inputs.employee_count * inputs.hours_wasted * inputs.hourly_rate;
    const annualBleed = weeklyBleed * WEEKS_PER_YEAR;
    const automationRecovery = annualBleed * AUTOMATION_RECOVERY_RATE;

    return {
        total_monthly_saas_spend: round2(totalMonthlySaas),
        total_annual_saas_spend: round2(totalAnnualSaas),
        isystem_consolidation_savings: round2(consolidationSavings),
        weekly_productivity_bleed: round2(weeklyBleed),
        annual_productivity_bleed: round2(annualBleed),
        projected_automation_recovery: round2(automationRecovery),
        combined_annual_savings: round2(consolidationSavings + automationRecovery),
    };
}

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

// Whether the user has supplied enough data for the totals to be meaningful.
// A single non-zero input in either module is enough to advance to the gate;
// it's the user's prerogative to leave fields they don't track at zero.
export function hasMeaningfulAuditInputs(inputs: AuditInputs): boolean {
    return Object.values(inputs).some((value) => value > 0);
}
