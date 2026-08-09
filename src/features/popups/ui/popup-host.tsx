"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Locale } from "@/features/templates/types";
import type { ResolvedPopup } from "@/features/popups/schema";
import { ensureAnalyticsClientId, useAnalyticsConsent } from "@/features/analytics/ui/use-analytics-consent";
import { renderPopupTemplate } from "./templates";

interface PopupHostProps {
    popup: ResolvedPopup | null;
    workspaceId: string | null;
    locale: Locale;
    /** Locale-stripped pathname; used for the event payload. */
    path: string;
    consentRequired?: boolean;
}

const DISMISS_KEY_PREFIX = "isystem-popup:dismissed:";
function readDismissedAt(popupId: string): number | null {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(`${DISMISS_KEY_PREFIX}${popupId}`);
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function writeDismissedAt(popupId: string) {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(`${DISMISS_KEY_PREFIX}${popupId}`, String(Date.now()));
    } catch {
        // Storage may be unavailable (private mode, quota). Best-effort only.
    }
}

function isLikelyDesktop(): boolean {
    if (typeof window === "undefined") return false;
    // Exit-intent only makes sense on devices with a real cursor leaving the
    // viewport. Touch and coarse-pointer devices don't have this signal.
    if (window.matchMedia("(hover: none), (pointer: coarse)").matches) return false;
    return true;
}

export function PopupHost({ popup, workspaceId, locale, path, consentRequired = false }: PopupHostProps) {
    const searchParams = useSearchParams();
    const analyticsAllowed = useAnalyticsConsent(consentRequired);
    const [isOpen, setIsOpen] = useState(false);
    const firedImpressionRef = useRef(false);
    const firedTriggerRef = useRef(false);

    const sendEvent = useCallback(
        (eventType: "impression" | "dismiss" | "convert") => {
            if (!popup || !workspaceId || !analyticsAllowed) return;
            // Use sendBeacon for the dismiss/convert paths so the request
            // survives navigation (especially convert, which is followed by a
            // link click). Falls back to fetch keepalive when unavailable.
            const payload = JSON.stringify({
                popupId: popup.id,
                workspaceId,
                eventType,
                locale,
                path,
                visitorId: ensureAnalyticsClientId("visitor-id"),
                sessionId: ensureAnalyticsClientId("session-id"),
                referrer: document.referrer || undefined,
                utmSource: searchParams.get("utm_source") || undefined,
                utmMedium: searchParams.get("utm_medium") || undefined,
                utmCampaign: searchParams.get("utm_campaign") || undefined,
            });
            try {
                if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
                    const blob = new Blob([payload], { type: "application/json" });
                    if (navigator.sendBeacon("/api/popups/event", blob)) return;
                }
            } catch {
                /* fall through to fetch */
            }
            void fetch("/api/popups/event", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: payload,
                keepalive: true,
            }).catch(() => undefined);
        },
        [popup, workspaceId, locale, path, searchParams, analyticsAllowed],
    );

    const open = useCallback(() => {
        if (!popup || firedTriggerRef.current) return;
        firedTriggerRef.current = true;
        setIsOpen(true);
    }, [popup]);

    // Wire the configured trigger. Both branches are no-ops if a recent
    // dismissal is still within the TTL window.
    useEffect(() => {
        if (!popup) return;
        const dismissedAt = readDismissedAt(popup.id);
        if (dismissedAt && Date.now() - dismissedAt < popup.dismissal_ttl_seconds * 1000) {
            return;
        }

        if (popup.trigger.type === "timed") {
            const timer = window.setTimeout(open, popup.trigger.config.delay_ms);
            return () => window.clearTimeout(timer);
        }

        if (popup.trigger.type === "exit_intent") {
            if (!isLikelyDesktop()) return;
            const onLeave = (e: MouseEvent) => {
                // Only trigger when the cursor exits via the TOP edge of the
                // viewport — that's the established UX signal for "user is
                // moving toward the tab bar / back button." Mouse leaving
                // sideways or downward isn't an exit signal.
                if (e.clientY > 0) return;
                open();
            };
            document.addEventListener("mouseleave", onLeave);
            return () => document.removeEventListener("mouseleave", onLeave);
        }

        return undefined;
    }, [popup, open]);

    // Fire impression once, the first time the dialog actually mounts.
    useEffect(() => {
        if (!isOpen || firedImpressionRef.current) return;
        firedImpressionRef.current = true;
        sendEvent("impression");
    }, [isOpen, sendEvent]);

    // Also dismiss-and-suppress on Escape / close, so the user isn't
    // re-prompted within the TTL window.
    const handleDismiss = useCallback(() => {
        if (popup) writeDismissedAt(popup.id);
        sendEvent("dismiss");
        setIsOpen(false);
    }, [popup, sendEvent]);

    const handleConvert = useCallback(() => {
        if (popup) writeDismissedAt(popup.id);
        sendEvent("convert");
        // We don't close immediately — the inline newsletter form needs to
        // remain mounted to render its success state. The link-CTA variants
        // navigate away on their own.
    }, [popup, sendEvent]);

    if (!popup || !workspaceId || !isOpen) return null;

    return renderPopupTemplate(popup.template_kind, {
        popupId: popup.id,
        workspaceId,
        content: popup.content,
        locale,
        onDismiss: handleDismiss,
        onConvert: handleConvert,
    });
}
