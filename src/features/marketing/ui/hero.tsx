"use client";

import { useRef } from "react";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Button } from "@/shared/ui/button";
import { MagneticButton } from "@/shared/ui/animations/magnetic-button";
import { ArrowRight, Sparkles } from "lucide-react";
import { canonicalBlogHref } from "@/features/blog/urls";

export function HeroSection() {
    const containerRef = useRef<HTMLElement>(null);

    useGSAP(
        () => {
            if (!containerRef.current) return;
            const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

            tl.fromTo("[data-hero-badge]", {
                y: 20,
                autoAlpha: 0,
            }, {
                y: 0,
                autoAlpha: 1,
                duration: 0.6,
            })
                .from(
                    "[data-hero-title] .word",
                    {
                        y: "100%",
                        duration: 0.8,
                        stagger: 0.06,
                    },
                    "-=0.2"
                )
                .fromTo(
                    "[data-hero-sub]",
                    {
                        y: 30,
                        autoAlpha: 0,
                    },
                    {
                        y: 0,
                        autoAlpha: 1,
                        duration: 0.6,
                    },
                    "-=0.4"
                )
                .fromTo(
                    "[data-hero-cta]",
                    {
                        y: 20,
                        autoAlpha: 0,
                    },
                    {
                        y: 0,
                        autoAlpha: 1,
                        duration: 0.5,
                    },
                    "-=0.3"
                )
                .fromTo(
                    "[data-hero-glow]",
                    {
                        scale: 0.5,
                        autoAlpha: 0,
                    },
                    {
                        scale: 1,
                        autoAlpha: 1,
                        duration: 1.4,
                        ease: "power2.out",
                    },
                    0
                );
        },
        { scope: containerRef }
    );

    const titleWords = ["Build", "the", "future.", "Lead", "with", "AI."];

    return (
        <section
            ref={containerRef}
            className="relative overflow-hidden min-h-[90vh] flex items-center justify-center"
        >
            {/* Background Glows */}
            <div data-hero-glow className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-violet-600/15 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-radial from-indigo-500/10 via-transparent to-transparent rounded-full blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-gradient-radial from-purple-500/10 via-transparent to-transparent rounded-full blur-2xl pointer-events-none" />

            {/* Grid Pattern Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(128,90,213,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(128,90,213,0.03)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />

            <div className="container mx-auto max-w-5xl px-4 md:px-6 text-center relative z-10">
                {/* Badge */}
                <div data-hero-badge className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-500/20 bg-violet-500/5 text-violet-600 text-xs font-medium mb-8" style={{ visibility: "hidden" }}>
                    <Sparkles className="h-3.5 w-3.5" />
                    Stealth CTO Framework
                </div>

                {/* Title with word wrapping for GSAP */}
                <h1
                    data-hero-title
                    className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[1.05] mb-8"
                >
                    {titleWords.map((word, i) => (
                        <span key={i} className="inline-block overflow-hidden align-top mr-[0.2em] last:mr-0">
                            <span className="word inline-block">
                                {i >= 3 ? (
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 via-indigo-500 to-purple-600">
                                        {word}
                                    </span>
                                ) : (
                                    word
                                )}
                            </span>
                        </span>
                    ))}
                </h1>

                {/* Subtitle */}
                <p
                    data-hero-sub
                    className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
                    style={{ visibility: "hidden" }}
                >
                    Transform from industry specialist to strategic orchestrator.
                    Build bespoke micro-SaaS and powerful internal tools
                    with AI — no syntax required.
                </p>

                {/* CTAs */}
                <div
                    data-hero-cta
                    className="flex flex-col sm:flex-row items-center justify-center gap-4"
                    style={{ visibility: "hidden" }}
                >
                    <MagneticButton>
                        <Button
                            asChild
                            size="lg"
                            className="text-base px-8 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-xl shadow-violet-500/25 border-0 rounded-xl h-12"
                        >
                            <Link href={canonicalBlogHref("en", "/blog")}>
                                Read the Blog
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </MagneticButton>
                    <MagneticButton>
                        <Button
                            asChild
                            size="lg"
                            variant="outline"
                            className="text-base px-8 rounded-xl h-12 border-border/60 hover:border-violet-500/40 hover:bg-violet-500/5"
                        >
                            <Link href="/about">Learn More</Link>
                        </Button>
                    </MagneticButton>
                </div>
            </div>
        </section>
    );
}
