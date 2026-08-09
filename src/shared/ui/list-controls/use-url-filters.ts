"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

/**
 * Hook that returns helpers for reading and writing filter values to the URL
 * search params. Empty/null values remove the param. All updates preserve the
 * current pathname and unrelated params.
 */
export function useUrlFilters() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const updateParams = useCallback(
        (patch: Record<string, string | null>) => {
            const next = new URLSearchParams(searchParams?.toString() ?? "");
            for (const [key, value] of Object.entries(patch)) {
                if (value === null || value === "") next.delete(key);
                else next.set(key, value);
            }
            const qs = next.toString();
            router.push(qs ? `${pathname}?${qs}` : pathname);
        },
        [router, pathname, searchParams],
    );

    const resetParams = useCallback(() => {
        router.push(pathname);
    }, [router, pathname]);

    return { updateParams, resetParams, searchParams };
}

export function parseListParam(value: string | string[] | undefined): string[] {
    if (!value) return [];
    const raw = Array.isArray(value) ? value.join(",") : value;
    return raw
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
}

export function parseIntParam(
    value: string | string[] | undefined,
    fallback: number,
    { min, max }: { min?: number; max?: number } = {},
): number {
    const raw = Array.isArray(value) ? value[0] : value;
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return fallback;
    let result = parsed;
    if (typeof min === "number") result = Math.max(min, result);
    if (typeof max === "number") result = Math.min(max, result);
    return result;
}

export function parseEnumParam<T extends string>(
    value: string | string[] | undefined,
    allowed: readonly T[],
    fallback: T,
): T {
    const raw = Array.isArray(value) ? value[0] : value;
    if (raw && (allowed as readonly string[]).includes(raw)) return raw as T;
    return fallback;
}
