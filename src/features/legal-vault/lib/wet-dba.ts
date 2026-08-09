export type WetDbaAnswer = "yes" | "no" | "unknown";

export interface WetDbaPreflightInput {
    clientControlsWork: WetDbaAnswer;
    fixedWorkingHours: WetDbaAnswer;
    exclusivityRequired: WetDbaAnswer;
    freeSubstitutionAllowed: WetDbaAnswer;
    contractorUsesOwnTools: WetDbaAnswer;
    entrepreneurialRisk: WetDbaAnswer;
    embeddedInOrganization: WetDbaAnswer;
}

export interface WetDbaPreflightResult {
    score: number;
    level: "low" | "medium" | "high";
    findings: Array<{ key: keyof WetDbaPreflightInput; severity: "low" | "medium" | "high"; message: string }>;
}

export function evaluateWetDbaPreflight(input: WetDbaPreflightInput): WetDbaPreflightResult {
    const findings: WetDbaPreflightResult["findings"] = [];
    let score = 0;

    addRisk(input.clientControlsWork === "yes", "clientControlsWork", "high", "Client authority/control suggests possible gezagsverhouding.");
    addRisk(input.fixedWorkingHours === "yes", "fixedWorkingHours", "medium", "Fixed working hours can indicate employment-like control.");
    addRisk(input.exclusivityRequired === "yes", "exclusivityRequired", "medium", "Exclusivity weakens independent contractor positioning.");
    addRisk(input.freeSubstitutionAllowed !== "yes", "freeSubstitutionAllowed", "high", "No free substitution is a Wet DBA risk marker.");
    addRisk(input.contractorUsesOwnTools === "no", "contractorUsesOwnTools", "low", "Using client tools can contribute to employment-like embedding.");
    addRisk(input.entrepreneurialRisk !== "yes", "entrepreneurialRisk", "medium", "Lack of entrepreneurial risk weakens ZZP posture.");
    addRisk(input.embeddedInOrganization === "yes", "embeddedInOrganization", "high", "Embedding in the client organization is a schijnzelfstandigheid risk marker.");

    const level = score >= 7 ? "high" : score >= 3 ? "medium" : "low";
    return { score, level, findings };

    function addRisk(condition: boolean, key: keyof WetDbaPreflightInput, severity: "low" | "medium" | "high", message: string) {
        if (!condition) return;
        score += severity === "high" ? 3 : severity === "medium" ? 2 : 1;
        findings.push({ key, severity, message });
    }
}
