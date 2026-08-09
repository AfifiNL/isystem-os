import "server-only";

import type { CreativeRenderProviderId } from "./types";

export interface HiggsfieldProviderConfig {
    enabled: boolean;
    apiBaseUrl: string | null;
    apiKey: string | null;
    webhookSecret: string | null;
    webhookToleranceSeconds: number;
    maxDurationSeconds: number;
    maxPendingJobsPerWorkspace: number;
    dailyRenderLimitPerWorkspace: number;
    monthlyBudgetMillicents: number;
    downloadMaxBytes: number;
}

export interface CreativeRenderProviderConfig {
    fakeProviderEnabled: boolean;
    cronSecret: string | null;
    workerDrainLimit: number;
    higgsfield: HiggsfieldProviderConfig;
}

function readBoolean(name: string, fallback = false): boolean {
    const value = process.env[name]?.trim().toLowerCase();
    if (value === undefined || value === "") return fallback;
    return value === "1" || value === "true" || value === "yes" || value === "on";
}

function readInteger(name: string, fallback: number, options: { min?: number; max?: number } = {}): number {
    const parsed = Number.parseInt(process.env[name]?.trim() ?? "", 10);
    const value = Number.isFinite(parsed) ? parsed : fallback;
    return Math.min(options.max ?? value, Math.max(options.min ?? value, value));
}

function readString(name: string): string | null {
    return process.env[name]?.trim() || null;
}

export function getCreativeRenderProviderConfig(): CreativeRenderProviderConfig {
    return {
        fakeProviderEnabled: readBoolean("CREATIVE_RENDER_FAKE_PROVIDER_ENABLED", true),
        cronSecret: readString("CREATIVE_RENDER_CRON_SECRET"),
        workerDrainLimit: readInteger("CREATIVE_RENDER_WORKER_DRAIN_LIMIT", 3, { min: 1, max: 25 }),
        higgsfield: {
            enabled: readBoolean("HIGGSFIELD_ENABLED", false),
            apiBaseUrl: readString("HIGGSFIELD_API_BASE_URL"),
            apiKey: readString("HIGGSFIELD_API_KEY"),
            webhookSecret: readString("HIGGSFIELD_WEBHOOK_SECRET"),
            webhookToleranceSeconds: readInteger("HIGGSFIELD_WEBHOOK_TOLERANCE_SECONDS", 300, { min: 30, max: 3600 }),
            maxDurationSeconds: readInteger("HIGGSFIELD_MAX_DURATION_SECONDS", 8, { min: 1, max: 300 }),
            maxPendingJobsPerWorkspace: readInteger("HIGGSFIELD_MAX_PENDING_JOBS_PER_WORKSPACE", 3, { min: 0, max: 100 }),
            dailyRenderLimitPerWorkspace: readInteger("HIGGSFIELD_DAILY_RENDER_LIMIT_PER_WORKSPACE", 10, { min: 0, max: 1000 }),
            monthlyBudgetMillicents: readInteger("HIGGSFIELD_MONTHLY_BUDGET_MILLICENTS", 0, { min: 0 }),
            downloadMaxBytes: readInteger("HIGGSFIELD_DOWNLOAD_MAX_BYTES", 524_288_000, { min: 1_048_576 }),
        },
    };
}

export function isCreativeRenderProviderEnabled(provider: CreativeRenderProviderId): boolean {
    const config = getCreativeRenderProviderConfig();
    if (provider === "fake") return config.fakeProviderEnabled;
    if (provider === "higgsfield") return config.higgsfield.enabled;
    return false;
}

export function getHiggsfieldDisabledReason(config = getCreativeRenderProviderConfig().higgsfield): string | null {
    if (!config.enabled) return "Higgsfield rendering is disabled by HIGGSFIELD_ENABLED.";
    if (!config.apiBaseUrl) return "HIGGSFIELD_API_BASE_URL is not configured.";
    if (!config.apiKey) return "HIGGSFIELD_API_KEY is not configured.";
    if (config.monthlyBudgetMillicents <= 0) return "HIGGSFIELD_MONTHLY_BUDGET_MILLICENTS must be approved before live renders.";
    if (config.maxPendingJobsPerWorkspace <= 0) return "HIGGSFIELD_MAX_PENDING_JOBS_PER_WORKSPACE must allow at least one pending job.";
    if (config.dailyRenderLimitPerWorkspace <= 0) return "HIGGSFIELD_DAILY_RENDER_LIMIT_PER_WORKSPACE must allow at least one render.";
    return null;
}
