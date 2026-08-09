"use client";

import { useEffect } from "react";

const SUPPRESSED = [
    "THREE.THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.",
    "THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.",
    "WARNING: Multiple instances of Three.js being imported.",
];

// Must mount before any r3f Canvas so its `new THREE.Clock()` deprecation
// warning is swallowed at emission time. Pure side-effect component.
export function ThreeWarningsSilencer() {
    useEffect(() => {
        const originalWarn = console.warn;
        console.warn = (...args: unknown[]) => {
            const first = args[0];
            const message = typeof first === "string" ? first : "";
            if (SUPPRESSED.some((entry) => message.includes(entry))) return;
            originalWarn(...args);
        };
        return () => {
            console.warn = originalWarn;
        };
    }, []);

    return null;
}
