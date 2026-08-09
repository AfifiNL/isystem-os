"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Subtle entrance animation honoring reduced-motion. Used to layer in cards
 * and section blocks without distraction.
 */
export function FadeUp({
    children,
    delay = 0,
    className,
}: {
    children: ReactNode;
    delay?: number;
    className?: string;
}) {
    const prefersReduced = useReducedMotion();
    return (
        <motion.div
            initial={prefersReduced ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

/**
 * Large editorial display heading with optional eyebrow label. Defaults to
 * the active template's font-sans + scales fluidly with viewport.
 */
export function EditorialHeading({
    eyebrow,
    title,
    description,
    align = "left",
}: {
    eyebrow?: string;
    title: string;
    description?: string;
    align?: "left" | "center";
}) {
    const alignClass = align === "center" ? "text-center mx-auto" : "text-left";
    return (
        <header className={`flex max-w-3xl flex-col gap-4 ${alignClass}`}>
            {eyebrow && (
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground backdrop-blur">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {eyebrow}
                </span>
            )}
            <h1 className="text-balance font-semibold leading-[1.05] tracking-tight text-foreground"
                style={{ fontSize: "clamp(2.5rem, 1.2rem + 4vw, 5rem)" }}>
                {title}
            </h1>
            {description && (
                <p className="max-w-2xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
                    {description}
                </p>
            )}
        </header>
    );
}

/**
 * Subscribe-platforms strip with a primary RSS link plus optional Apple /
 * Spotify URLs. Designed in card form with bordered icon tiles.
 */
export function SubscribeStrip({
    feedHref,
    appleHref,
    spotifyHref,
}: {
    feedHref: string;
    appleHref?: string;
    spotifyHref?: string;
}) {
    return (
        <div className="flex flex-wrap items-center gap-2 rounded-full border border-border/60 bg-card/40 p-1.5 backdrop-blur">
            <span className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Listen on
            </span>
            <SubscribeChip href={feedHref} label="RSS" />
            {appleHref && <SubscribeChip href={appleHref} label="Apple" external />}
            {spotifyHref && <SubscribeChip href={spotifyHref} label="Spotify" external />}
        </div>
    );
}

function SubscribeChip({ href, label, external }: { href: string; label: string; external?: boolean }) {
    return (
        <a
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            className="inline-flex items-center gap-1.5 rounded-full bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm ring-1 ring-border/40 transition hover:ring-primary/60"
        >
            {label}
        </a>
    );
}

export function CoverArt({
    src,
    alt,
    size = "md",
    className,
}: {
    src: string | null;
    alt: string;
    size?: "sm" | "md" | "lg";
    className?: string;
}) {
    const dimensions = size === "lg" ? "h-64 w-64 sm:h-80 sm:w-80" : size === "sm" ? "h-16 w-16" : "h-40 w-40";
    const wrapperClass = `relative ${dimensions} shrink-0 overflow-hidden rounded-xl ${className ?? ""}`;
    if (!src) {
        return (
            <div className={`${wrapperClass} flex items-center justify-center bg-gradient-to-br from-primary/15 via-primary/5 to-transparent ring-1 ring-border/40`}>
                <svg className="h-8 w-8 text-primary/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                </svg>
            </div>
        );
    }
    return (
        <div className={wrapperClass}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={src}
                alt={alt}
                className="h-full w-full object-cover"
                loading="lazy"
            />
            <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-foreground/10" />
        </div>
    );
}

/**
 * Format a duration in seconds as 'M:SS' or 'H:MM:SS'.
 */
export function formatDuration(seconds: number | null): string {
    if (!seconds || seconds < 0) return "—";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatDate(value: string | null, locale?: string): string {
    if (!value) return "";
    try {
        return new Date(value).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });
    } catch {
        return "";
    }
}
