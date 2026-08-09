"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Building2, TrendingUp, Clock, Users, ArrowRight } from "lucide-react";
import Link from "next/link";
import { localizeHref } from "@/shared/lib/i18n/routing";
import { useTemplate } from "@/features/templates/template-provider";
import { SmartBuildingSvg } from "@/features/templates/ui/svgs/facility-services/SmartBuildingSvg";
import type { TemplateConfig, Locale } from "@/features/templates/types";
import { pickLocaleText } from "@/shared/lib/i18n/resolve";

gsap.registerPlugin(ScrollTrigger);

interface ProjectsProps {
    config: TemplateConfig;
    locale: Locale;
}

const CASE_STUDIES = [
    {
        title: { en: "Zuidas Corporate HQ — 12,000 m²", nl: "Zuidas Bedrijfs-HQ — 12.000 m²" },
        description: {
            en: "Consolidated 5 separate vendors into a single facility contract. Within 6 months we reduced management overhead by 40% and improved tenant satisfaction scores from 7.2 to 9.1.",
            nl: "5 afzonderlijke leveranciers geconsolideerd in één facilitair contract. Binnen 6 maanden hebben we de beheerkosten met 40% verlaagd en de huurders-tevredenheidscores van 7.2 naar 9.1 verbeterd.",
        },
        metrics: [
            { icon: TrendingUp, value: "40%", label: { en: "Cost reduction", nl: "Kostenverlaging" } },
            { icon: Users, value: "9.1/10", label: { en: "Satisfaction score", nl: "Tevredenheidsscore" } },
            { icon: Clock, value: "6 mo", label: { en: "Time to results", nl: "Tijd tot resultaat" } },
        ],
        pillars: ["cleaning", "reception", "logistics"],
    },
    {
        title: { en: "TechHub Amsterdam — Co-Working Campus", nl: "TechHub Amsterdam — Co-Working Campus" },
        description: {
            en: "Deployed a full catering and hospitality solution for a 2,000-person tech campus. Our team manages 3 restaurants, 12 coffee points, and event catering — serving 4,500+ meals daily with zero food safety incidents.",
            nl: "Een complete catering- en hospitality-oplossing ingezet voor een techcampus van 2.000 personen. Ons team beheert 3 restaurants, 12 koffiepunten en evenementcatering — dagelijks 4.500+ maaltijden met nul voedselveiligheidsincidenten.",
        },
        metrics: [
            { icon: Users, value: "4,500+", label: { en: "Daily meals", nl: "Dagelijkse maaltijden" } },
            { icon: TrendingUp, value: "0", label: { en: "Safety incidents", nl: "Veiligheidsincidenten" } },
            { icon: Clock, value: "18 mo", label: { en: "Partnership", nl: "Partnerschap" } },
        ],
        pillars: ["catering", "reception"],
    },
    {
        title: { en: "Financial District — Multi-Tenant Office Tower", nl: "Financieel District — Multi-Tenant Kantoortoren" },
        description: {
            en: "Took over cleaning and logistics for a 25-floor tower with 8 tenants. Our centralized Help Desk handles 200+ service requests weekly, maintaining a 98.5% SLA compliance rate.",
            nl: "Schoonmaak en logistiek overgenomen voor een kantoortoren van 25 verdiepingen met 8 huurders. Onze gecentraliseerde Helpdesk verwerkt wekelijks 200+ serviceverzoeken met een SLA-compliance van 98,5%.",
        },
        metrics: [
            { icon: Building2, value: "25", label: { en: "Floors managed", nl: "Beheerde verdiepingen" } },
            { icon: TrendingUp, value: "98.5%", label: { en: "SLA compliance", nl: "SLA-compliance" } },
            { icon: Clock, value: "200+", label: { en: "Weekly requests", nl: "Wekelijkse verzoeken" } },
        ],
        pillars: ["cleaning", "logistics"],
    },
];

const PILLAR_LABELS: Record<string, Record<string, string>> = {
    cleaning: { en: "Cleaning", nl: "Schoonmaak" },
    catering: { en: "Catering", nl: "Catering" },
    reception: { en: "Reception", nl: "Receptie" },
    logistics: { en: "Logistics", nl: "Logistiek" },
};

export function FacilityServicesProjects({ config, locale }: ProjectsProps) {
    useTemplate();
    const heroRef = useRef<HTMLElement>(null);
    const cardsRef = useRef<HTMLDivElement>(null);
    const ctaRef = useRef<HTMLElement>(null);
    const projects = config.pages.projects;

    // Hero entrance
    useGSAP(() => {
        if (!heroRef.current) return;
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
        tl.fromTo("[data-proj-badge]", { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 })
            .fromTo("[data-proj-title]", { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 }, "-=0.2")
            .fromTo("[data-proj-desc]", { y: 25, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }, "-=0.3");
    }, { scope: heroRef });

    // Card stagger
    useGSAP(() => {
        if (!cardsRef.current) return;
        gsap.fromTo("[data-case-card]", { y: 60, opacity: 0 }, {
            y: 0, opacity: 1, duration: 0.7, stagger: 0.2, ease: "power2.out",
            scrollTrigger: { trigger: cardsRef.current, start: "top 80%" },
        });
    }, { scope: cardsRef });

    // CTA entrance
    useGSAP(() => {
        if (!ctaRef.current) return;
        gsap.fromTo("[data-proj-cta]", { y: 40, opacity: 0 }, {
            y: 0, opacity: 1, duration: 0.7, ease: "power2.out",
            scrollTrigger: { trigger: ctaRef.current, start: "top 85%" },
        });
    }, { scope: ctaRef });

    return (
        <div className="min-h-screen">
            {/* ── Dark Gradient Hero ── */}
            <section ref={heroRef} className="relative py-28 md:py-36 overflow-hidden" style={{ background: `linear-gradient(135deg, #0f172a 0%, #1e293b 50%, color-mix(in srgb, var(--template-primary, #0d9488) 15%, #0f172a) 100%)` }}>
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -right-20 top-1/2 -translate-y-1/2 w-[500px] h-[500px] opacity-[0.06]">
                        <SmartBuildingSvg className="w-full h-full" />
                    </div>
                </div>
                <div className="container mx-auto max-w-5xl px-4 md:px-6 relative z-10">
                    <span data-proj-badge className="inline-block px-4 py-1.5 text-xs font-bold uppercase tracking-[0.15em] rounded-full border border-white/10 text-white/70 mb-6"
                        style={{ background: `color-mix(in srgb, var(--template-primary, #0d9488) 15%, transparent)` }}>
                        {pickLocaleText(projects?.subtitle, locale, "Case Studies")}
                    </span>
                    <h1 data-proj-title className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mb-6 leading-[1.1]">
                        {pickLocaleText(projects?.title, locale) ?? (locale === "nl" ? "Onze Impact & Expertise" : "Our Impact & Expertise")}
                    </h1>
                    <p data-proj-desc className="text-lg text-slate-300 leading-relaxed max-w-3xl">
                        {pickLocaleText(projects?.description, locale) ?? (locale === "nl" ? "Ontdek hoe Facility Services Demo meetbare resultaten levert voor toonaangevende organisaties." : "Discover how Facility Services Demo delivers measurable outcomes for leading organizations.")}
                    </p>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-24" style={{ background: "linear-gradient(to top, var(--background, white), transparent)" }} />
            </section>

            {/* ── Case Study Cards ── */}
            <section ref={cardsRef} className="py-20 md:py-28">
                <div className="container mx-auto max-w-5xl px-4 md:px-6 space-y-10">
                    {CASE_STUDIES.map((study, index) => (
                        <div data-case-card key={index} className="group p-8 md:p-10 border border-border/50 bg-card hover:shadow-xl transition-all duration-500 overflow-hidden relative">
                            {/* Accent line */}
                            <div className="absolute top-0 left-0 right-0 h-1 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"
                                style={{ background: `linear-gradient(to right, var(--template-gradient-from, #0d9488), var(--template-gradient-to, #06b6d4))` }} />

                            {/* Pillar badges */}
                            <div className="flex flex-wrap gap-2 mb-5">
                                {study.pillars.map((p) => (
                                    <span key={p} className="px-3 py-1 text-xs font-bold uppercase tracking-wider border"
                                        style={{ borderColor: "color-mix(in srgb, var(--template-primary, #0d9488) 30%, transparent)", color: "var(--template-primary, #0d9488)", background: "color-mix(in srgb, var(--template-primary, #0d9488) 8%, transparent)" }}>
                                        {PILLAR_LABELS[p]?.[locale] ?? p}
                                    </span>
                                ))}
                            </div>

                            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4 leading-tight">
                                {pickLocaleText(study.title, locale)}
                            </h2>

                            <p className="text-muted-foreground leading-relaxed mb-8 max-w-3xl">
                                {pickLocaleText(study.description, locale)}
                            </p>

                            {/* Metrics */}
                            <div className="grid grid-cols-3 gap-4">
                                {study.metrics.map((metric, mi) => {
                                    const Icon = metric.icon;
                                    return (
                                        <div key={mi} className="p-4 text-center border border-border/40 bg-muted/20 group-hover:border-[color-mix(in_srgb,var(--template-primary,#0d9488)_30%,transparent)] transition-colors">
                                            <Icon className="h-5 w-5 mx-auto mb-2" style={{ color: "var(--template-primary, #0d9488)" }} />
                                            <div className="text-2xl font-extrabold text-foreground">{metric.value}</div>
                                            <div className="text-xs text-muted-foreground mt-1">{pickLocaleText(metric.label, locale)}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Bottom CTA ── */}
            <section ref={ctaRef} className="py-20 md:py-28" style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)" }}>
                <div data-proj-cta className="container mx-auto max-w-3xl px-4 text-center">
                    <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-5">
                        {locale === "en" ? "Ready to become our next success story?" : "Klaar om ons volgende succesverhaal te worden?"}
                    </h2>
                    <p className="text-slate-400 mb-8 max-w-xl mx-auto">
                        {locale === "en" ? "Let's start with a free operational audit of your facility." : "Laten we beginnen met een gratis operationele audit van uw pand."}
                    </p>
                    <Link
                        href={localizeHref(locale, "/contact")}
                        className="inline-flex items-center gap-2 px-8 py-4 text-white font-bold text-lg shadow-2xl hover:brightness-110 transition-all"
                        style={{ background: `linear-gradient(to right, var(--template-gradient-from, #0d9488), var(--template-gradient-to, #06b6d4))` }}
                    >
                        {locale === "en" ? "Start Your Partnership" : "Begin Uw Partnerschap"}
                        <ArrowRight className="h-5 w-5" />
                    </Link>
                </div>
            </section>
        </div>
    );
}
