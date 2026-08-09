import type { ReactNode } from "react";

/**
 * Bidi-isolated inline span. Wrap Latin tokens (brand names, URLs, emails,
 * code identifiers, numbers in mixed-direction text) inside Arabic flow so
 * the bidirectional algorithm doesn't reorder neighboring text.
 *
 * Example:
 *   <p>{"تواصل عبر البريد الإلكتروني "}<Bdi>hossam@isystem.ai</Bdi></p>
 */
export function Bdi({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <bdi style={{ unicodeBidi: "isolate" }} className={className}>
            {children}
        </bdi>
    );
}
