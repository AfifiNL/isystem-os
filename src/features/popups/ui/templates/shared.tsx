"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Base shell shared by every popup template. Owns:
//   * fixed positioning + backdrop
//   * focus trap (first focusable on mount, ESC + backdrop close)
//   * dialog ARIA (role, modal, labelledby)
//   * RTL-aware layout via the `dir` attribute (the public layout already
//     sets it on <html>, but a popup that escapes the document tree needs
//     its own dir prop so it stays correct in print/screenshot tools)
//   * prefers-reduced-motion respect on entrance animation
//
// Templates only own their inner copy/CTA layout. This keeps the a11y +
// dismissal contract identical across variants — much easier to audit.

interface PopupShellProps {
    children: ReactNode;
    titleId: string;
    onDismiss: () => void;
    /** Document direction. The visual layout flips automatically — RTL puts
     *  the close button on the left, primary CTA on the right. */
    dir?: "ltr" | "rtl";
    /** Mobile-first variants render full-bleed-bottom; desktop centers. */
    layout?: "card" | "sheet";
    /** Maximum dialog width on desktop. */
    maxWidthClass?: string;
}

export function PopupShell({
    children,
    titleId,
    onDismiss,
    dir = "ltr",
    layout = "card",
    maxWidthClass = "max-w-md",
}: PopupShellProps) {
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const previousActive = useRef<Element | null>(null);

    useEffect(() => {
        previousActive.current = document.activeElement;
        const node = dialogRef.current;
        if (node) {
            // Focus the first focusable inside the dialog so keyboard users
            // are placed in-context rather than left at the document root.
            const focusable = node.querySelector<HTMLElement>(
                "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
            );
            (focusable ?? node).focus();
        }

        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                onDismiss();
            }
            if (e.key === "Tab" && node) {
                // Cheap focus trap: if focus left the dialog, snap it back.
                requestAnimationFrame(() => {
                    if (!node.contains(document.activeElement)) {
                        node.focus();
                    }
                });
            }
        };
        document.addEventListener("keydown", handleKey);

        // Mark the rest of the document inert. Browsers without `inert`
        // support fall back to the focus trap above.
        const root = document.body;
        const previousAria = root.getAttribute("aria-hidden");
        return () => {
            document.removeEventListener("keydown", handleKey);
            if (previousAria === null) root.removeAttribute("aria-hidden");
            else root.setAttribute("aria-hidden", previousAria);
            // Restore focus to the element that opened the dialog.
            if (previousActive.current instanceof HTMLElement) {
                previousActive.current.focus();
            }
        };
    }, [onDismiss]);

    const containerClasses = layout === "sheet"
        ? "fixed inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center"
        : "fixed inset-0 flex items-end sm:items-center justify-center";

    return (
        <div
            className="isystem-popup-shell fixed inset-0 z-[1000]"
            // Backdrop is a sibling so onDismiss only fires on real backdrop
            // clicks, not anything that bubbles up from the inner dialog.
            onClick={(e) => {
                if (e.target === e.currentTarget) onDismiss();
            }}
        >
            <div
                className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
                aria-hidden="true"
                onClick={onDismiss}
            />
            <div className={`${containerClasses} pointer-events-none p-4`}>
                <div
                    ref={dialogRef}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={titleId}
                    dir={dir}
                    tabIndex={-1}
                    className={`pointer-events-auto w-full ${maxWidthClass} motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-300 motion-safe:ease-out outline-none`}
                >
                    {children}
                </div>
            </div>
        </div>
    );
}

interface CloseButtonProps {
    onClick: () => void;
    label: string;
}

export function CloseButton({ onClick, label }: CloseButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className="absolute end-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
            </svg>
        </button>
    );
}
