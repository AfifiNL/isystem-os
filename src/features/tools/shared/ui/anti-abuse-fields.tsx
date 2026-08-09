"use client";

import { useMemo } from "react";

/**
 * Reusable anti-abuse primitives for every public tool form.
 *
 * `HoneypotField` is rendered offscreen via the same `clip` trick the
 * audit + newsletter forms use. Real users never see it; automated form-
 * fillers blindly populate every input and get blocked server-side.
 *
 * `useFormStartedAt()` returns an ISO timestamp captured at mount, used by
 * the server's dwell-time check to reject sub-2.5s submissions.
 */

interface HoneypotFieldProps {
    /** Controlled value bound to the form's state. */
    value: string;
    onChange: (next: string) => void;
    /** Field name. Defaults to `website` — same as audit/newsletter forms. */
    name?: string;
}

export function HoneypotField({ value, onChange, name = "website" }: HoneypotFieldProps) {
    return (
        <div
            aria-hidden="true"
            className="absolute h-px w-px overflow-hidden whitespace-nowrap"
            style={{ clip: "rect(0 0 0 0)", clipPath: "inset(50%)" }}
        >
            <label>
                Company website
                <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    name={name}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
            </label>
        </div>
    );
}

export function useFormStartedAt(): string {
    // Frozen at first render so the dwell window measures from mount, not
    // from each re-render. `useMemo` with empty deps is the right primitive
    // here — `useState(() => …)` would also work but adds a setter we don't
    // need.
    return useMemo(() => new Date().toISOString(), []);
}
