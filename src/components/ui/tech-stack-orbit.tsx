"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Card } from "@/shared/ui/card";
import { Spotlight } from "@/components/ui/spotlight";
import { cn } from "@/shared/lib/utils";

// The composition is two counter-rotating elliptical rings. Each logo rides
// its ring as a single CSS rotation animation on the orbit track, with a
// counter-rotation applied to the logo itself so it stays upright. This is
// compositor-friendly (transform only) and replaces a previous Spline 3D
// scene that was crashing low-memory browsers.

type Ring = "outer" | "inner";

interface OrbitLogo {
    src: string;
    alt: string;
    size: number;
    ring: Ring;
    startPct: number;
    scale?: number;
}

const orbitingLogos: readonly OrbitLogo[] = [
    { src: "/tech-stack/nextjs.svg", alt: "Next.js", size: 32, ring: "outer", startPct: 0 },
    { src: "/tech-stack/react.svg", alt: "React", size: 34, ring: "inner", startPct: 8 },
    { src: "/tech-stack/typescript.svg", alt: "TypeScript", size: 30, ring: "outer", startPct: 14 },
    { src: "/tech-stack/tailwindcss.svg", alt: "Tailwind CSS", size: 36, ring: "inner", startPct: 28 },
    { src: "/tech-stack/supabase.svg", alt: "Supabase", size: 30, ring: "outer", startPct: 29 },
    { src: "/tech-stack/postgresql.svg", alt: "PostgreSQL", size: 32, ring: "inner", startPct: 48 },
    { src: "/tech-stack/nodejs.svg", alt: "Node.js", size: 32, ring: "outer", startPct: 43 },
    { src: "/tech-stack/react.svg", alt: "Framer Motion", size: 30, ring: "inner", startPct: 68, scale: 0.9 },
    { src: "/tech-stack/typescript.svg", alt: "TypeScript Core", size: 28, ring: "outer", startPct: 57, scale: 0.85 },
    { src: "/tech-stack/nextjs.svg", alt: "Next.js Runtime", size: 30, ring: "outer", startPct: 71, scale: 0.9 },
    { src: "/tech-stack/tailwindcss.svg", alt: "Tailwind", size: 32, ring: "inner", startPct: 88, scale: 0.9 },
    { src: "/tech-stack/supabase.svg", alt: "Supabase Edge", size: 28, ring: "outer", startPct: 85, scale: 0.85 },
] as const;

// Ring geometry as percentages of the orbit container. Outer ring is wider
// than it is tall to feel like a perspective-projected disc. Both rings spin
// forward at different speeds — the speed delta reads as counter-motion
// without needing CSS reverse direction (which complicates delay staggering).
const RING_FRACS: Record<Ring, { w: number; h: number; duration: number }> = {
    outer: { w: 86, h: 62, duration: 48 },
    inner: { w: 66, h: 46, duration: 30 },
};

interface TechStackOrbitProps {
    className?: string;
    contentClassName?: string;
    title?: string;
    description?: string;
    eyebrow?: string;
}

export function TechStackOrbit({
    className,
    contentClassName,
    title,
    description,
    eyebrow,
}: TechStackOrbitProps) {
    const [motionEnabled, setMotionEnabled] = useState(true);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const query = window.matchMedia("(prefers-reduced-motion: reduce)");
        const recompute = () => setMotionEnabled(!query.matches);
        recompute();
        query.addEventListener("change", recompute);
        return () => query.removeEventListener("change", recompute);
    }, []);

    return (
        <div className={cn("relative h-full w-full overflow-visible", className)}>
            <Card className="relative h-full min-h-[460px] w-full overflow-hidden rounded-[1.5rem] border-white/10 bg-transparent shadow-none md:rounded-[2rem]">
                <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="white" />

                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.16)_0%,transparent_42%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.14)_0%,transparent_38%)]" />
                <div className="absolute inset-0 rounded-[2rem] border border-white/10 bg-white/[0.02] backdrop-blur-[2px]" />

                <div className="relative z-10 flex h-full flex-col lg:flex-row">
                    {(eyebrow || title || description) ? (
                        <div className={cn("flex flex-1 flex-col justify-center p-8 md:p-12", contentClassName)}>
                            {eyebrow ? (
                                <p className="text-sm font-bold uppercase tracking-[0.24em] text-cyan-300">
                                    {eyebrow}
                                </p>
                            ) : null}
                            {title ? (
                                <h3 className="mt-6 bg-gradient-to-b from-neutral-50 to-neutral-400 bg-clip-text text-4xl font-bold text-transparent md:text-5xl">
                                    {title}
                                </h3>
                            ) : null}
                            {description ? (
                                <p className="mt-5 max-w-xl text-base leading-relaxed text-neutral-300 md:text-lg">
                                    {description}
                                </p>
                            ) : null}
                        </div>
                    ) : null}

                    <div className="relative min-h-[360px] flex-1 sm:min-h-[420px] lg:min-h-full">
                        {/* Perspective-projected orbit field */}
                        <div
                            className="absolute inset-0 [perspective:1200px]"
                            aria-hidden="true"
                        >
                            <div className="absolute left-1/2 top-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2 [transform-style:preserve-3d] [transform:rotateX(62deg)]">
                                {/* Orbit tracks — two elliptical rings lit with a soft glow */}
                                <div
                                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-cyan-300/25"
                                    style={{
                                        width: `${RING_FRACS.outer.w}%`,
                                        height: `${RING_FRACS.outer.h}%`,
                                        boxShadow: "0 0 60px rgba(34,211,238,0.12) inset",
                                    }}
                                />
                                <div
                                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-violet-300/20"
                                    style={{
                                        width: `${RING_FRACS.inner.w}%`,
                                        height: `${RING_FRACS.inner.h}%`,
                                        boxShadow: "0 0 50px rgba(168,85,247,0.14) inset",
                                    }}
                                />

                                {/* Orbiting logos — each logo is the single moving child of its ring container */}
                                {orbitingLogos.map((logo, index) => {
                                    const ring = RING_FRACS[logo.ring];
                                    // Negative animation-delay freezes the animation at that
                                    // offset on mount, so each logo starts at its own angle
                                    // along the orbit while still sharing the same keyframes.
                                    const orbitDelay = -(logo.startPct / 100) * ring.duration;
                                    const floatDuration = 4 + (index % 4);
                                    const scale = logo.scale ?? 1;

                                    return (
                                        <div
                                            key={`${logo.alt}-${index}`}
                                            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                                            style={{
                                                width: `${ring.w}%`,
                                                height: `${ring.h}%`,
                                                animation: motionEnabled
                                                    ? `orbitSpin ${ring.duration}s linear infinite`
                                                    : undefined,
                                                animationDelay: motionEnabled ? `${orbitDelay}s` : undefined,
                                            }}
                                        >
                                            {/* Pin logo to the ring's east point */}
                                            <div className="absolute right-0 top-1/2 -translate-y-1/2">
                                                {/* Flatten back from the 3D rotation so logos stay face-on */}
                                                <div style={{ transform: "rotateX(-62deg)" }}>
                                                    {/* Counter-spin cancels the ring's rotation so the logo stays upright */}
                                                    <div
                                                        style={{
                                                            animation: motionEnabled
                                                                ? `logoCounterSpin ${ring.duration}s linear infinite`
                                                                : undefined,
                                                            animationDelay: motionEnabled ? `${orbitDelay}s` : undefined,
                                                        }}
                                                    >
                                                        <div
                                                            className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/45 bg-slate-950/90 p-1.5 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_30px_rgba(2,6,23,0.65)] backdrop-blur-md sm:h-12 sm:w-12 md:h-14 md:w-14"
                                                            style={{
                                                                animation: motionEnabled
                                                                    ? `orbitFloat ${floatDuration}s ease-in-out infinite`
                                                                    : undefined,
                                                                animationDelay: motionEnabled ? `${-(index * 0.45)}s` : undefined,
                                                                transform: `scale(${scale})`,
                                                            }}
                                                        >
                                                            <Image
                                                                src={logo.src}
                                                                alt={logo.alt}
                                                                width={logo.size}
                                                                height={logo.size}
                                                                loading="lazy"
                                                                className="drop-shadow-[0_0_10px_rgba(103,232,249,0.45)]"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Platform core — the luminous centerpiece the logos orbit */}
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                        >
                            <div className="relative h-[180px] w-[180px] sm:h-[220px] sm:w-[220px] md:h-[260px] md:w-[260px]">
                                <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,rgba(34,211,238,0.0),rgba(34,211,238,0.5),rgba(168,85,247,0.4),rgba(34,211,238,0.0))] opacity-70 blur-[8px] animate-[coreAura_18s_linear_infinite]" />
                                <div className="absolute inset-[14%] rounded-full border border-cyan-300/35 animate-[corePulse_4s_ease-in-out_infinite]" />
                                <div className="absolute inset-[26%] rounded-full border border-cyan-200/25 animate-[corePulse_5s_ease-in-out_infinite_0.8s]" />
                                <div className="absolute inset-[36%] rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.6)_0%,rgba(99,102,241,0.4)_45%,rgba(15,23,42,0)_72%)] blur-[2px] animate-[coreBreathe_6s_ease-in-out_infinite]" />
                                <div className="absolute inset-[44%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.95)_0%,rgba(34,211,238,0.6)_40%,rgba(15,23,42,0)_80%)] shadow-[0_0_40px_12px_rgba(34,211,238,0.4)]" />
                            </div>
                        </div>

                        {/* Radial beam lines decoration */}
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 opacity-[0.08] [mask-image:radial-gradient(circle_at_center,#000_15%,transparent_55%)]"
                            style={{
                                backgroundImage: "repeating-conic-gradient(from 0deg at 50% 50%, rgba(255,255,255,0.8) 0deg, rgba(255,255,255,0) 2deg 18deg)",
                            }}
                        />
                    </div>
                </div>
            </Card>

            <style jsx>{`
                @keyframes orbitSpin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes logoCounterSpin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(-360deg); }
                }
                @keyframes orbitFloat {
                    0%, 100% { filter: brightness(1) drop-shadow(0 0 6px rgba(103,232,249,0.35)); }
                    50% { filter: brightness(1.25) drop-shadow(0 0 14px rgba(103,232,249,0.65)); }
                }
                @keyframes coreAura {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes corePulse {
                    0%, 100% { opacity: 0.4; transform: scale(1); }
                    50% { opacity: 0.9; transform: scale(1.04); }
                }
                @keyframes coreBreathe {
                    0%, 100% { opacity: 0.85; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.06); }
                }
            `}</style>
        </div>
    );
}
