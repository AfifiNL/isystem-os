"use client";

import { useEffect } from "react";

/**
 * Defeat browser back/forward cache (bfcache) for public pages.
 *
 * Even with `Cache-Control: no-store`, Chrome and Safari can restore a
 * previously-rendered page from memory when the user hits back/forward.
 * For dynamic SSR pages whose copy is edited in the CMS, that means
 * visitors briefly see the stale prior render. Forcing a reload when the
 * page is restored from bfcache eliminates that vector.
 */
export function BfcacheGuard() {
    useEffect(() => {
        const onPageShow = (event: PageTransitionEvent) => {
            if (event.persisted) {
                window.location.reload();
            }
        };
        window.addEventListener("pageshow", onPageShow);
        return () => window.removeEventListener("pageshow", onPageShow);
    }, []);

    return null;
}
