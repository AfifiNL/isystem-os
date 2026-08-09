"use client";

import { useRef } from "react";
import Image from "next/image";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CheckCircle2 } from "lucide-react";
import { Counter } from "@/shared/ui/animations/counter";
import { RichTextRenderer } from "@/features/content-engine/ui/rich-text-renderer";
import { useTemplate } from "@/features/templates/template-provider";
import { HorizonHeroSection } from "@/components/ui/horizon-hero-section";
import {
    extractHomeRendererData,
    translateFacilityServicesField,
    translateFacilityServicesRichText,
    translateFacilityServicesListItem,
} from "@/features/builder/facility-services-renderer-data";
import {
    prefersReducedMotion,
    scrubReveal,
    scrubMaskReveal,
} from "./gsap-utils";
import { FacilityServicesCubeArrow } from "../svgs/facility-services/FacilityServicesCubeArrow";
import { GearSystemSvg } from "../svgs/facility-services/GearSystemSvg";

gsap.registerPlugin(ScrollTrigger);

/* ────────────────────────────────────────────────────────────── */
/*  Types & helpers                                              */
/* ────────────────────────────────────────────────────────────── */

interface ThemeHomeProps {
    locale: string;
    dictionary: Record<string, unknown>;
    visualLayout?: import("@/shared/lib/supabase/database.types").Json | null;
}

/* ────────────────────────────────────────────────────────────── */
/*  Component                                                    */
/* ────────────────────────────────────────────────────────────── */

export default function FacilityServicesHome({ locale, visualLayout }: ThemeHomeProps) {
    useTemplate();
    const resolvedLocale = locale === "nl" ? "nl" : "en";
    const builderData = extractHomeRendererData(visualLayout);

    /* ── Refs ───────────────────────────────────────────────── */
    const foundationRef = useRef<HTMLElement>(null);
    const aboutRef = useRef<HTMLElement>(null);
    const servicesRef = useRef<HTMLElement>(null);
    const methodRef = useRef<HTMLElement>(null);

    /* ── Data ───────────────────────────────────────────────── */
    const stats = builderData.stats.items.map((item) => ({
        value: item.value,
        label: translateFacilityServicesField(resolvedLocale, item.label),
    }));
    const services = builderData.services.items.map((item) => ({
        id: item.id,
        title: translateFacilityServicesField(resolvedLocale, item.title),
        description: translateFacilityServicesRichText(resolvedLocale, item.description),
        image: item.image,
        alt: translateFacilityServicesField(resolvedLocale, item.alt),
        orderLabel: item.orderLabel,
        features: item.features.map((feature) => translateFacilityServicesListItem(resolvedLocale, feature)),
    }));
    const methodSteps = builderData.methodology.steps.map((step) => ({
        title: translateFacilityServicesField(resolvedLocale, step.title),
        description: translateFacilityServicesRichText(resolvedLocale, step.description),
    }));

    /* ═══════════════════════════════════════════════════════════
       GSAP — Section 3: Foundation
       ═══════════════════════════════════════════════════════════ */
    useGSAP(
        () => {
            if (!foundationRef.current) return;
            if (prefersReducedMotion()) {
                gsap.set("[data-foundation-title]", {
                    clipPath: "inset(0 0% 0 0)",
                });
                gsap.set("[data-foundation-text]", { opacity: 1, y: 0 });
                gsap.set("[data-foundation-line]", { scaleX: 1 });
                return;
            }

            /* title wipe — very slow, dramatic reveal */
            scrubMaskReveal(foundationRef.current, "[data-foundation-title]", {
                direction: "left",
                startOffset: "top 90%",
                endOffset: "top 35%",
            });

            /* text slides up with generous stagger */
            scrubReveal(
                foundationRef.current,
                "[data-foundation-text]",
                { y: 35, opacity: 0 },
                { y: 0, opacity: 1, ease: "power2.out" },
                { startOffset: "top 82%", endOffset: "top 25%", stagger: 0.2 }
            );

            /* decorative accent line grows from center */
            gsap.fromTo(
                "[data-foundation-line]",
                { scaleX: 0 },
                {
                    scaleX: 1,
                    ease: "power2.inOut",
                    scrollTrigger: {
                        trigger: foundationRef.current,
                        start: "top 75%",
                        end: "top 30%",
                        scrub: 2.5,
                    },
                }
            );
        },
        { scope: foundationRef }
    );

    /* ═══════════════════════════════════════════════════════════
       GSAP — Section 4: Sticky About
       ═══════════════════════════════════════════════════════════ */
    useGSAP(
        () => {
            if (!aboutRef.current) return;
            const reduced = prefersReducedMotion();

            if (reduced) {
                gsap.set("[data-about-item]", { opacity: 1, y: 0 });
                return;
            }

            /* pin the left image column */
            ScrollTrigger.create({
                trigger: aboutRef.current,
                start: "top 80px",
                end: "bottom bottom",
                pin: "[data-about-pin]",
                pinSpacing: false,
            });

            /* each about-item gets its own individual trigger for sequential reveal */
            const aboutItems = aboutRef.current.querySelectorAll("[data-about-item]");
            aboutItems.forEach((item) => {
                gsap.fromTo(
                    item,
                    { y: 60, opacity: 0 },
                    {
                        y: 0,
                        opacity: 1,
                        ease: "power2.out",
                        scrollTrigger: {
                            trigger: item,
                            start: "top 88%",
                            end: "top 40%",
                            scrub: 2.5,
                        },
                    }
                );
            });
        },
        { scope: aboutRef }
    );

    /* ═══════════════════════════════════════════════════════════
       GSAP — Section 5: Services
       ═══════════════════════════════════════════════════════════ */
    useGSAP(
        () => {
            if (!servicesRef.current) return;
            if (prefersReducedMotion()) {
                gsap.set("[data-bento-card]", { opacity: 1, y: 0, x: 0 });
                return;
            }

            /* each service card enters individually — slide from alternating sides + fade + slight scale */
            const cards = servicesRef.current.querySelectorAll("[data-bento-card]");
            cards.forEach((card, idx) => {
                const fromX = idx % 2 === 0 ? -60 : 60;
                gsap.fromTo(
                    card,
                    { x: fromX, y: 40, opacity: 0, scale: 0.97 },
                    {
                        x: 0,
                        y: 0,
                        opacity: 1,
                        scale: 1,
                        ease: "power2.out",
                        scrollTrigger: {
                            trigger: card,
                            start: "top 92%",
                            end: "top 35%",
                            scrub: 2.5,
                        },
                    }
                );
            });
        },
        { scope: servicesRef }
    );

    /* ═══════════════════════════════════════════════════════════
       GSAP — Section 6: Methodology
       ═══════════════════════════════════════════════════════════ */
    useGSAP(
        () => {
            if (!methodRef.current) return;
            if (prefersReducedMotion()) {
                gsap.set("[data-method-step]", { opacity: 1, x: 0 });
                return;
            }

            /* each methodology step sweeps in from the left with a slight rotation */
            const steps = methodRef.current.querySelectorAll("[data-method-step]");
            steps.forEach((step) => {
                gsap.fromTo(
                    step,
                    { x: -40, opacity: 0, rotateY: 4 },
                    {
                        x: 0,
                        opacity: 1,
                        rotateY: 0,
                        ease: "power2.out",
                        scrollTrigger: {
                            trigger: step,
                            start: "top 92%",
                            end: "top 50%",
                            scrub: 2.5,
                        },
                    }
                );
            });
        },
        { scope: methodRef }
    );

    /* ═══════════════════════════════════════════════════════════
       RENDER
       ═══════════════════════════════════════════════════════════ */
    return (
        <div className="min-h-screen bg-white [font-family:var(--font-inter)] text-slate-900">
            {/* ──────────────────────────────────────────────────
                SECTION 1 — THE PRECISION HERO
            ────────────────────────────────────────────────── */}
            <section className="relative overflow-hidden bg-[#002f58]">
                <HorizonHeroSection
                    locale={resolvedLocale as "en" | "nl"}
                    eyebrow={translateFacilityServicesField(resolvedLocale, builderData.hero.eyebrow)
                        .split("\n")
                        .filter(Boolean)}
                    titleLines={[
                        translateFacilityServicesField(resolvedLocale, builderData.hero.titleLineOne),
                        translateFacilityServicesField(resolvedLocale, builderData.hero.titleLineTwo),
                    ]}
                    subtitle={translateFacilityServicesField(resolvedLocale, builderData.hero.subtitle)}
                    primaryCta={{
                        label: translateFacilityServicesField(resolvedLocale, builderData.hero.primaryCta),
                        href: builderData.hero.primaryHref,
                    }}
                    secondaryCta={{
                        label: translateFacilityServicesField(resolvedLocale, builderData.hero.secondaryCta),
                        href: builderData.hero.secondaryHref,
                    }}
                    trustBadges={builderData.hero.trustBadges.map((item) =>
                        translateFacilityServicesListItem(resolvedLocale, item)
                    )}
                />
            </section>

            {/* ──────────────────────────────────────────────────
                SECTION 2 — TRUST & SCALE (Stats Bar)
            ────────────────────────────────────────────────── */}
            <section className="border-b border-slate-800 bg-[#001f3f] py-16">
                <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 md:grid-cols-4">
                    {stats.map((stat, idx) => {
                        const numeric = String(stat.value).replace(
                            /[^0-9.]/g,
                            ""
                        );
                        const suffix = String(stat.value).replace(
                            /[0-9.]/g,
                            ""
                        );
                        return (
                            <div
                                key={idx}
                                className="border-s border-white/15 ps-6 first:border-s-0 first:ps-0"
                            >
                                <div className="text-3xl font-extrabold tracking-tight text-white lg:text-4xl">
                                    <Counter
                                        end={Number(numeric || 0)}
                                        suffix={suffix}
                                        duration={2.8}
                                    />
                                </div>
                                <p className="mt-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-white/50">
                                    {stat.label}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ──────────────────────────────────────────────────
                SECTION 3 — THE FOUNDATION / BRAND PROMISE
            ────────────────────────────────────────────────── */}
            <section ref={foundationRef} className="relative bg-white py-24 lg:py-32 overflow-hidden">
                {/* Decorative cube system background */}
                <div className="absolute right-[-12px] top-10 h-auto w-[150px] opacity-[0.18] sm:right-0 sm:top-1/2 sm:mt-0 sm:w-[300px] sm:-translate-y-1/2 md:w-[360px] lg:right-[-20px] lg:w-[420px] lg:opacity-[0.22] xl:w-[520px]">
                    <FacilityServicesCubeArrow
                        className="h-full w-full"
                        primaryColor="#002f58"
                        accentColor="#4A90E2"
                    />
                </div>

                <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
                    <h2
                        data-foundation-title
                        className="mb-5 text-3xl font-bold tracking-[-0.01em] text-slate-900 lg:text-4xl"
                        style={{ clipPath: "inset(0 100% 0 0)" }}
                    >
                        {translateFacilityServicesField(resolvedLocale, builderData.foundation.title)}
                    </h2>
                    <div
                        data-foundation-text
                        className="mx-auto mb-4 max-w-3xl text-lg leading-relaxed text-slate-600"
                    >
                        <RichTextRenderer content={translateFacilityServicesRichText(resolvedLocale, builderData.foundation.description)} className="text-lg leading-relaxed text-slate-600" />
                    </div>
                    <div
                        data-foundation-text
                        className="text-sm font-bold uppercase tracking-[0.15em] text-[#0d4f8c]"
                    >
                        <RichTextRenderer content={translateFacilityServicesRichText(resolvedLocale, builderData.foundation.supportLine)} className="text-sm font-bold uppercase tracking-[0.15em] text-[#0d4f8c]" />
                    </div>
                    <div
                        data-foundation-line
                        className="mx-auto mt-8 h-px w-24 bg-[#0d4f8c]/40"
                        style={{ transformOrigin: "center", transform: "scaleX(0)" }}
                    />
                </div>
            </section>

            {/* ──────────────────────────────────────────────────
                SECTION 4 — STICKY STORY (About Split-Screen)
            ────────────────────────────────────────────────── */}
            <section
                ref={aboutRef}
                className="relative border-y border-slate-200 bg-slate-50"
            >
                <div className="mx-auto grid max-w-7xl grid-cols-1 lg:grid-cols-2">
                    {/* Left — pinned image */}
                    <div
                        data-about-pin
                        className="relative hidden h-screen lg:block"
                    >
                        <Image
                            src={builderData.about.image}
                            alt={translateFacilityServicesField(resolvedLocale, builderData.about.imageAlt)}
                            fill
                            sizes="50vw"
                            className="object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-slate-50/30" />
                    </div>

                    {/* Right — scrolling content */}
                    <div className="flex flex-col gap-16 px-6 py-24 lg:px-16 lg:py-32">
                        {/* Mobile-only image */}
                        <div className="relative h-64 overflow-hidden lg:hidden">
                            <Image
                                src={builderData.about.image}
                                alt={translateFacilityServicesField(resolvedLocale, builderData.about.imageAlt)}
                                fill
                                sizes="100vw"
                                className="object-cover"
                            />
                        </div>

                        <div data-about-item>
                            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#0d4f8c]">
                                {translateFacilityServicesField(resolvedLocale, builderData.about.eyebrow)}
                            </p>
                            <RichTextRenderer
                                content={translateFacilityServicesRichText(resolvedLocale, builderData.about.headline)}
                                className="mb-4 text-3xl font-bold tracking-[-0.01em] text-slate-900 lg:text-4xl [&_p]:m-0 [&_p]:text-inherit [&_strong]:text-inherit [&_a]:text-[#0d4f8c] [&_a]:underline"
                            />
                            <RichTextRenderer content={translateFacilityServicesRichText(resolvedLocale, builderData.about.description)} className="text-lg leading-relaxed text-slate-600" />
                        </div>

                        <div data-about-item className="border-t border-slate-200 pt-12">
                            <h3 className="mb-3 text-xl font-bold text-slate-900">
                                {translateFacilityServicesField(resolvedLocale, builderData.about.missionTitle)}
                            </h3>
                            <RichTextRenderer content={translateFacilityServicesRichText(resolvedLocale, builderData.about.missionText)} className="leading-relaxed text-slate-600" />
                        </div>

                        <div data-about-item className="border-t border-slate-200 pt-12">
                            <h3 className="mb-3 text-xl font-bold text-slate-900">
                                {translateFacilityServicesField(resolvedLocale, builderData.about.visionTitle)}
                            </h3>
                            <RichTextRenderer content={translateFacilityServicesRichText(resolvedLocale, builderData.about.visionText)} className="leading-relaxed text-slate-600" />
                        </div>

                        <div data-about-item className="border-t border-slate-200 pt-12">
                            <h3 className="mb-4 text-xl font-bold text-slate-900">
                                {translateFacilityServicesField(resolvedLocale, builderData.about.whyTitle)}
                            </h3>
                            <ul className="space-y-3">
                                {builderData.about.whyPoints.map((point) => (
                                    <li
                                        key={point.id}
                                        className="flex items-start gap-2.5 text-sm text-slate-700"
                                    >
                                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#0d4f8c]" />
                                        <span>{translateFacilityServicesListItem(resolvedLocale, point)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* ──────────────────────────────────────────────────
                SECTION 5 — STRUCTURAL SERVICES GRID (Bento Box)
            ────────────────────────────────────────────────── */}
            <section ref={servicesRef} className="bg-white py-24 lg:py-32">
                <div className="mx-auto max-w-7xl px-6">
                    <div className="mb-14">
                        <h2 className="mb-3 text-4xl font-bold tracking-[-0.01em] text-slate-900">
                            {translateFacilityServicesField(resolvedLocale, builderData.services.title)}
                        </h2>
                        <RichTextRenderer content={translateFacilityServicesRichText(resolvedLocale, builderData.services.description)} className="max-w-2xl text-lg text-slate-600" />
                    </div>

                    {/* Services — split-panel cards */}
                    <div className="space-y-5">
                        {services.map((service, idx) => (
                            <article
                                key={service.id}
                                data-bento-card
                                className="group grid overflow-hidden border border-slate-200 md:grid-cols-2"
                            >
                                {/* Content panel */}
                                <div
                                    className={`flex flex-col justify-center bg-[#002f58] p-8 lg:p-12 ${idx % 2 !== 0 ? "md:order-2" : ""
                                        }`}
                                >
                                    <p className="mb-4 text-4xl font-bold leading-none tracking-[-0.04em] text-white/20 lg:text-5xl">
                                        {service.orderLabel}
                                    </p>
                                    <h3 className="mb-3 text-2xl font-bold text-white lg:text-3xl">
                                        {service.title}
                                    </h3>
                                    <RichTextRenderer content={service.description} className="mb-6 max-w-lg text-sm leading-relaxed text-white/75 [&_a]:text-white [&_a]:underline" />
                                    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        {service.features.map(
                                            (feature, fIdx) => (
                                                <li
                                                    key={fIdx}
                                                    className="flex items-center gap-2 text-sm font-medium text-white/85"
                                                >
                                                    <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-white/50" />
                                                    {feature}
                                                </li>
                                            )
                                        )}
                                    </ul>
                                </div>

                                {/* Image panel */}
                                <div
                                    className={`relative h-64 md:h-auto md:min-h-[360px] ${idx % 2 !== 0 ? "md:order-1" : ""
                                        }`}
                                >
                                    <Image
                                        src={service.image}
                                        alt={service.alt}
                                        fill
                                        sizes="(max-width: 768px) 100vw, 50vw"
                                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                                    />
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {/* ──────────────────────────────────────────────────
                SECTION 6a — METHODOLOGY (Process Steps)
            ────────────────────────────────────────────────── */}
            <section
                ref={methodRef}
                className="relative overflow-hidden border-y border-slate-200 bg-slate-50 py-24"
            >
                {/* Decorative Structural SVG Background */}
                <div className="absolute left-1/2 top-0 mt-8 h-auto w-[220px] -translate-x-1/2 opacity-[0.22] mix-blend-multiply sm:left-auto sm:-right-10 sm:top-1/2 sm:-mt-10 sm:w-[350px] sm:-translate-x-0 sm:-translate-y-1/2 sm:opacity-[0.23] lg:-right-[100px] lg:w-[450px] xl:w-[650px]">
                    <GearSystemSvg className="h-full w-full" />
                </div>

                <div className="relative z-10 mx-auto max-w-6xl px-6">
                    <h2 className="mb-2 text-3xl font-bold tracking-[-0.01em] text-slate-900">
                        {translateFacilityServicesField(resolvedLocale, builderData.methodology.title)}
                    </h2>
                    <RichTextRenderer
                        content={translateFacilityServicesRichText(resolvedLocale, builderData.methodology.subtitle)}
                        className="mb-14 max-w-3xl text-slate-600 [&_p]:m-0"
                    />

                    <div className="grid gap-px overflow-hidden rounded-none bg-slate-200 md:grid-cols-4">
                        {methodSteps.map((step, idx) => (
                            <div
                                key={idx}
                                data-method-step
                                className="bg-white p-8"
                            >
                                <div className="mb-4 flex h-10 w-10 items-center justify-center bg-[#002f58] text-sm font-bold text-white">
                                    {String(idx + 1).padStart(2, "0")}
                                </div>
                                <h3 className="mb-2 text-lg font-bold text-slate-900">
                                    {step.title}
                                </h3>
                                <p className="text-sm leading-relaxed text-slate-600">
                                    {step.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ──────────────────────────────────────────────────
                SECTION 6b — CTA
            ────────────────────────────────────────────────── */}
        </div>
    );
}
