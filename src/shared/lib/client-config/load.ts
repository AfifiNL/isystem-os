import { clientConfigSchema, type ClientConfig } from "./schema";

/**
 * Validate a raw config object against the schema and return a typed
 * `ClientConfig`. Throws a Zod error if invalid — callers should catch
 * and surface a readable message at provisioning time.
 *
 * The runtime app does NOT call this directly. The schema is consumed
 * by the provisioning script and (optionally) by a future server-side
 * loader if we ever want config-driven defaults at request time.
 */
export function parseClientConfig(input: unknown): ClientConfig {
    return clientConfigSchema.parse(input);
}

/**
 * Helper for the dashboard module gate. Reads the client's `modules`
 * map and decides whether a given module should be visible. A module
 * absent from the map falls through to the platform default (which
 * the existing dashboard-state.ts already handles by tier).
 */
export function isClientModuleEnabled(
    config: Pick<ClientConfig, "modules">,
    moduleKey: string,
): boolean | null {
    const value = (config.modules as Record<string, boolean | undefined>)[moduleKey];
    if (typeof value !== "boolean") return null;
    return value;
}

/**
 * Apply workspace-level client switches to an already-authorized module list.
 * This is intentionally subtractive: `false` removes a launcher module, while
 * `true` cannot invent a module or bypass tier, role, or capability checks.
 */
export function applyClientModuleOverrides<T extends { key: string }>(
    modules: readonly T[],
    overrides: unknown,
): T[] {
    if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
        return [...modules];
    }

    const values = overrides as Record<string, unknown>;
    return modules.filter((module) => values[module.key] !== false);
}
