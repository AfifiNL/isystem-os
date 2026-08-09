"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { deriveAnalyticsContentType, stripAnalyticsLocalePrefix } from "@/features/analytics/taxonomy";
import { ensureAnalyticsClientId, useAnalyticsConsent } from "./use-analytics-consent";

interface PublicAnalyticsTrackerProps {
    // Workspace this rendered page belongs to. The server resolves it from the
    // page content row (or active workspace context) and passes it down so the
    // tracker can bind every event to a specific tenant. Without this the
    // server cannot safely attribute by slug alone — slugs are not globally
    // unique across workspaces, and trusting the slug lookup lets an anonymous
    // attacker pollute another tenant's analytics by replaying a guessable slug.
    workspaceId?: string | null;
    /**
     * When true, analytics events are only sent after the visitor opts in via
     * the cookie banner. When false (workspace has GDPR off), analytics fire
     * unconditionally — same behavior as before consent was wired up.
     */
    consentRequired?: boolean;
}

export function PublicAnalyticsTracker({
    workspaceId,
    consentRequired = false,
}: PublicAnalyticsTrackerProps = {}) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const analyticsAllowed = useAnalyticsConsent(consentRequired);

    useEffect(() => {
        if (!analyticsAllowed) return;
        const visitorId = ensureAnalyticsClientId("visitor-id");
        const sessionId = ensureAnalyticsClientId("session-id");
        const normalizedPath = stripAnalyticsLocalePrefix(pathname || "/");

        void fetch("/api/analytics/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                path: normalizedPath,
                contentType: deriveAnalyticsContentType(normalizedPath),
                eventType: "page_view",
                eventName: normalizedPath,
                visitorId,
                sessionId,
                referrer: document.referrer || undefined,
                utmSource: searchParams.get("utm_source") || undefined,
                utmMedium: searchParams.get("utm_medium") || undefined,
                utmCampaign: searchParams.get("utm_campaign") || undefined,
                userAgent: navigator.userAgent,
                workspaceId: workspaceId || undefined,
            }),
            keepalive: true,
        });
    }, [pathname, searchParams, workspaceId, analyticsAllowed]);

    useEffect(() => {
        if (!analyticsAllowed) return;
        const onClick = (event: MouseEvent) => {
            const target = event.target;
            if (!(target instanceof Element)) return;

            const link = target.closest("a[data-analytics-cta='true']");
            if (!(link instanceof HTMLAnchorElement)) return;

            const visitorId = ensureAnalyticsClientId("visitor-id");
            const sessionId = ensureAnalyticsClientId("session-id");
            const normalizedPath = stripAnalyticsLocalePrefix(pathname || "/");

            void fetch("/api/analytics/track", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    path: normalizedPath,
                    contentType: deriveAnalyticsContentType(normalizedPath),
                    eventType: "cta_click",
                    eventName: link.dataset.analyticsName || link.href,
                    visitorId,
                    sessionId,
                    referrer: document.referrer || undefined,
                    userAgent: navigator.userAgent,
                    workspaceId: workspaceId || undefined,
                    metadata: {
                        href: link.href,
                        label: link.textContent?.trim() || "",
                        placement: link.dataset.analyticsPlacement || "unknown",
                    },
                }),
                keepalive: true,
            });
        };

        document.addEventListener("click", onClick, true);
        return () => document.removeEventListener("click", onClick, true);
    }, [pathname, workspaceId, analyticsAllowed]);

    return null;
}
