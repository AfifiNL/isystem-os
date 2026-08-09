"use client";

import { useEffect, useState } from "react";
import { readConsentFromBrowserCookie, type ConsentChoice } from "@/features/gdpr/consent";

export function useAnalyticsConsent(consentRequired = false) {
    const [analyticsAllowed, setAnalyticsAllowed] = useState<boolean>(!consentRequired);

    useEffect(() => {
        if (!consentRequired) {
            setAnalyticsAllowed(true);
            return;
        }

        const existing = readConsentFromBrowserCookie();
        setAnalyticsAllowed(Boolean(existing?.analytics));

        const onChange = (event: Event) => {
            const detail = (event as CustomEvent<ConsentChoice>).detail;
            setAnalyticsAllowed(Boolean(detail?.analytics));
        };

        window.addEventListener("ix-consent:change", onChange);
        return () => window.removeEventListener("ix-consent:change", onChange);
    }, [consentRequired]);

    return analyticsAllowed;
}

export function ensureAnalyticsClientId(key: string) {
    if (typeof window === "undefined") return "";
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const value = `${key}-${crypto.randomUUID()}`;
    try {
        window.localStorage.setItem(key, value);
    } catch {
        return value;
    }
    return value;
}
