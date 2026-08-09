"use client";

import { useRef } from "react";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Button } from "@/shared/ui/button";
import { MagneticButton } from "@/shared/ui/animations/magnetic-button";
import { ArrowRight, Sparkles } from "lucide-react";
import { useTemplate } from "@/features/templates/template-provider";
import { pickLocaleText, pickLocaleTextList } from "@/shared/lib/i18n/resolve";

export function TemplateHero() {
    const { config, locale } = useTemplate();
    const { hero } = config;
    const containerRef = useRef<HTMLElement>(null);

    useGSAP(
        () => {
            if (!containerRef.current) return;
            const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

            tl.fromTo("[data-hero-badge]", { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6 })
                .from("[data-hero-title] .word", { y: "100%", duration: 0.8, stagger: 0.06 }, "-=0.2")
                .fromTo("[data-hero-sub]", { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6 }, "-=0.4")
                .fromTo("[data-hero-cta]", { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5 }, "-=0.3")
                .fromTo("[data-hero-glow]", { scale: 0.5, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 1.4, ease: "power2.out" }, 0);
        },
        { scope: containerRef }
    );

    const titleWords = pickLocaleTextList(hero.headline, locale);

    return (
        <section
            ref={containerRef}
            className="relative overflow-hidden min-h-[90vh] flex items-center justify-center"
        >
            {/* Background Glows — using template colors */}
            <div
                data-hero-glow
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-3xl pointer-events-none opacity-15"
                style={{ background: `radial-gradient(circle, var(--template-gradient-from), transparent 70%)` }}
            />
            <div
                className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full blur-2xl pointer-events-none opacity-10"
                style={{ background: `radial-gradient(circle, var(--template-gradient-to), transparent 70%)` }}
            />
            <div
                className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full blur-2xl pointer-events-none opacity-10"
                style={{ background: `radial-gradient(circle, var(--template-primary), transparent 70%)` }}
            />

            {/* Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(128,90,213,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(128,90,213,0.03)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />

            <div className="container mx-auto max-w-5xl px-4 md:px-6 text-center relative z-10">
                {/* Badge */}
                <div
                    data-hero-badge
                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-medium mb-8"
                    style={{
                        borderColor: `color-mix(in oklch, var(--template-primary) 20%, transparent)`,
                        backgroundColor: `color-mix(in oklch, var(--template-primary) 5%, transparent)`,
                        color: `var(--template-primary)`,
                        visibility: "hidden",
                    }}
                >
                    <Sparkles className="h-3.5 w-3.5" />
                    {pickLocaleText(hero.badge, locale)}
                </div>

                {/* Title */}
                <h1
                    data-hero-title
                    className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[1.05] mb-8"
                >
                    {titleWords.map((word, i) => (
                        <span key={i} className="inline-block overflow-hidden align-top me-[0.2em] last:me-0">
                            <span className="word inline-block">
                                {i >= hero.gradientWordStart ? (
                                    <span
                                        className="text-transparent bg-clip-text"
                                        style={{
                                            backgroundImage: `linear-gradient(to right, var(--template-gradient-from), var(--template-gradient-to))`,
                                        }}
                                    >
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
                    {pickLocaleText(hero.subtitle, locale)}
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
                            className="text-base px-8 text-white shadow-xl border-0 rounded-xl h-12"
                            style={{
                                background: `linear-gradient(to right, var(--template-gradient-from), var(--template-gradient-to))`,
                            }}
                        >
                            <Link href={hero.primaryCta.href} data-analytics-cta="true" data-analytics-name="hero-primary-cta" data-analytics-placement="hero">
                                {pickLocaleText(hero.primaryCta.label, locale)}
                                <ArrowRight className="ms-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </MagneticButton>
                    <MagneticButton>
                        <Button
                            asChild
                            size="lg"
                            variant="outline"
                            className="text-base px-8 rounded-xl h-12 border-border/60 hover:bg-muted/50"
                        >
                            <Link href={hero.secondaryCta.href} data-analytics-cta="true" data-analytics-name="hero-secondary-cta" data-analytics-placement="hero">
                                {pickLocaleText(hero.secondaryCta.label, locale)}
                            </Link>
                        </Button>
                    </MagneticButton>
                </div>
            </div>
        </section>
    );
}
